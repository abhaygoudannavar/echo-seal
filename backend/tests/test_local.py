"""
EchoSeal local verification suite — runs against a Docker container.

All five tests exercise the same code path that runs in production — the only
difference is ECHOSEAL_LOCAL=1 swaps out DynamoDB/S3/Polly for in-process stubs.

Prerequisites:
  1. Build the image:       make build   (or: docker build --platform linux/amd64 -t echoseal-lambda .)
  2. Start the container:   docker run -d --rm --name echoseal-local \\
                              -e ECHOSEAL_LOCAL=1 -p 9000:8080 echoseal-lambda:latest
  3. Run this script:       python tests/test_local.py

The Lambda Runtime Interface Emulator (included in the base image) listens on
port 9000 and proxies JSON events to the handler exactly as API Gateway would.

Test order matches the implementation plan's verification plan:
  Test 1 — /verify demo_validate.wav         → verified, SecureBank AI Assistant
  Test 2 — /verify phone re-recording        → verified (run if file is available)
  Test 3 — /verify sample.wav (no watermark) → not verified, confidence < 0.01
  Test 4 — /verify agent 2047 audio          → verified, Example Telecom Support (not SecureBank)
  Test 5 — /generate agent 0 → /verify       → full loop, resolves to agent 0

Test 2 is the one that matters most for the demo. Get it first.
"""

import base64
import json
import os
import sys
import tempfile
import urllib.request
from pathlib import Path

# Lambda RIE endpoint
ENDPOINT = "http://localhost:9000/2015-03-31/functions/function/invocations"

# Paths relative to the repo root
REPO_ROOT = Path(__file__).resolve().parent.parent.parent  # echo-seal/
ML_AUDIO = REPO_ROOT / "ml-audio"
DEMO_VALIDATE = ML_AUDIO / "audio" / "demo_validate.wav"
SAMPLE_WAV = ML_AUDIO / "audio" / "sample.wav"


def invoke(event: dict) -> dict:
    """POST an event to the Lambda RIE and return the parsed response body."""
    data = json.dumps(event).encode()
    req = urllib.request.Request(ENDPOINT, data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=180) as resp:
        result = json.loads(resp.read())
    # result is the Lambda response envelope; body is JSON string inside it
    if isinstance(result.get("body"), str):
        result["body"] = json.loads(result["body"])
    return result


def verify_wav(wav_path: Path) -> dict:
    """Build a /verify event from a local WAV file and invoke."""
    audio_b64 = base64.b64encode(wav_path.read_bytes()).decode()
    event = {
        "rawPath": "/verify",
        "requestContext": {"http": {"method": "POST"}},
        "headers": {"content-type": "application/json"},
        "body": json.dumps({"wav_base64": audio_b64}),
        "isBase64Encoded": False,
    }
    return invoke(event)


def generate_wav(agent_id: int) -> dict:
    """Build a /generate event and invoke."""
    event = {
        "rawPath": "/generate",
        "requestContext": {"http": {"method": "POST"}},
        "headers": {"content-type": "application/json"},
        "body": json.dumps({"agent_id": agent_id, "text": "Hello from EchoSeal."}),
        "isBase64Encoded": False,
    }
    return invoke(event)


PASS = "\033[32mPASS\033[0m"
FAIL = "\033[31mFAIL\033[0m"
SKIP = "\033[33mSKIP\033[0m"

results = []


def check(name: str, resp: dict, expect_verified: bool, expect_entity: str | None = None) -> bool:
    body = resp.get("body", {})
    status = resp.get("statusCode", 0)
    verified = body.get("verified")
    entity = body.get("entity_name")
    conf = body.get("confidence", 0.0)

    ok = status == 200 and verified == expect_verified
    if expect_entity is not None:
        ok = ok and entity == expect_entity
    if expect_verified is False:
        ok = ok and conf < 0.05  # non-watermarked audio must score very low

    tag = PASS if ok else FAIL
    print(f"\n{'─'*60}")
    print(f"  {tag}  {name}")
    print(f"  status={status}  verified={verified}  conf={conf:.4f}")
    print(f"  entity={entity!r}")
    if not ok:
        print(f"  expected: verified={expect_verified}  entity={expect_entity!r}")
    results.append(ok)
    return ok


# ── Test 1 — demo_validate.wav → verified as SecureBank ───────────────────────
print("\n=== Test 1: /verify demo_validate.wav → SecureBank AI Assistant ===")
if not DEMO_VALIDATE.exists():
    print(f"  {SKIP}  {DEMO_VALIDATE} not found — copy from ml-audio/audio/")
    results.append(None)
else:
    r = verify_wav(DEMO_VALIDATE)
    check("demo_validate.wav → SecureBank AI Assistant", r,
          expect_verified=True, expect_entity="SecureBank AI Assistant")

# ── Test 2 — phone re-recording (optional, run if file available) ──────────────
RERECORDING = Path(os.environ.get("ECHOSEAL_RERECORD", ""))
print("\n=== Test 2: /verify phone re-recording (most important for demo) ===")
if not RERECORDING.exists():
    print(f"  {SKIP}  Set ECHOSEAL_RERECORD=<path> to run this test.")
    print("         Ask Person 1 for the recording, or re-record demo_validate.wav")
    print("         on a phone with spatial audio OFF, phone ~15-30 cm from speaker.")
    results.append(None)
else:
    r = verify_wav(RERECORDING)
    check("phone re-recording → verified", r,
          expect_verified=True, expect_entity="SecureBank AI Assistant")

# ── Test 3 — unwatermarked sample.wav → not verified ─────────────────────────
print("\n=== Test 3: /verify sample.wav (no watermark) → not verified ===")
if not SAMPLE_WAV.exists():
    print(f"  {SKIP}  {SAMPLE_WAV} not found")
    results.append(None)
else:
    r = verify_wav(SAMPLE_WAV)
    check("sample.wav → not verified, conf < 0.05", r, expect_verified=False)

# ── Test 4 — agent 2047 audio → Example Telecom Support (NOT SecureBank) ─────
print("\n=== Test 4: /verify agent 2047 → Example Telecom Support ===")
print("  Generating agent 2047 audio first via /generate ...")
try:
    gen_resp = generate_wav(agent_id=2047)
    gen_body = gen_resp.get("body", {})
    audio_url = gen_body.get("audio_url", "")
    if audio_url.startswith("file://"):
        audio_path = Path(audio_url[len("file://"):])
        if audio_path.exists():
            r = verify_wav(audio_path)
            check("agent 2047 audio → Example Telecom Support (not SecureBank)", r,
                  expect_verified=True, expect_entity="Example Telecom Support")
        else:
            print(f"  {FAIL}  /generate returned file:// path but file not found: {audio_path}")
            results.append(False)
    else:
        print(f"  {SKIP}  /generate returned non-file URL (S3 mode?): {audio_url}")
        results.append(None)
except Exception as e:
    print(f"  {FAIL}  Exception: {e}")
    results.append(False)

# ── Test 5 — /generate agent 0 → /verify closes the loop ─────────────────────
print("\n=== Test 5: /generate agent 0 → /verify → resolves to agent 0 ===")
try:
    gen_resp = generate_wav(agent_id=0)
    gen_body = gen_resp.get("body", {})
    audio_url = gen_body.get("audio_url", "")
    if audio_url.startswith("file://"):
        audio_path = Path(audio_url[len("file://"):])
        if audio_path.exists():
            r = verify_wav(audio_path)
            check("generate→verify loop closes for agent 0", r,
                  expect_verified=True, expect_entity="SecureBank AI Assistant")
        else:
            print(f"  {FAIL}  /generate returned file:// path not found: {audio_path}")
            results.append(False)
    else:
        print(f"  {SKIP}  /generate returned non-file URL (S3 mode?): {audio_url}")
        results.append(None)
except Exception as e:
    print(f"  {FAIL}  Exception: {e}")
    results.append(False)

# ── Summary ────────────────────────────────────────────────────────────────────
print(f"\n{'='*60}")
passed = sum(1 for r in results if r is True)
failed = sum(1 for r in results if r is False)
skipped = sum(1 for r in results if r is None)
print(f"  PASSED: {passed}   FAILED: {failed}   SKIPPED: {skipped}")
if failed > 0:
    print("  ✗ Fix failures before handing off to Suhaan for deploy.")
else:
    print("  ✓ All non-skipped tests pass. Container is ready for deploy.")
print()
sys.exit(1 if failed > 0 else 0)
