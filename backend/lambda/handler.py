"""
EchoSeal Lambda handler — /generate and /verify.

Fixes applied from the 2026-09-19 hardware-validated implementation plan:
  FIX 1 — nearest Hamming distance lookup, not exact DynamoDB get_item
  FIX 2 — registry IDs are 0 and 2047 (11 bits apart), not 1337/42
  FIX 3 — embed_watermark called at alpha=2.0, not the default 1.0
  FIX 4 — torch installed explicitly from CPU wheel (see requirements.txt)
  FIX 5 — ffmpeg is a static binary in the image, not yum-installed

Environment variables (set by CloudFormation):
  TRUST_REGISTRY_TABLE  — DynamoDB table name (default: trust_registry)
  AUDIO_BUCKET          — S3 bucket name
  ECHOSEAL_LOCAL        — set to "1" to skip AWS calls for local Docker testing

Local testing:
  docker run -e ECHOSEAL_LOCAL=1 -p 9000:8080 echoseal-lambda:latest
  python tests/test_local.py
"""

import base64
import json
import logging
import os
import tempfile
import wave

import boto3

# watermark.py is copied into the same directory at build time.
# This dodges the ml-audio hyphen problem (ml-audio is not a valid Python module name).
from watermark import (
    DETECTION_THRESHOLD,
    FRAME_THRESHOLD,
    SAMPLE_RATE,
    _bits_to_int,
    _get_detector,
    _get_generator,
    _load_audio_16k_mono,
    embed_watermark,
    nearest_agent,
    verify_watermark,
)
import torch

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Hard-code region so ambient AWS_DEFAULT_REGION in Suhaan's shell can't change it.
REGION = "ap-south-1"
TABLE = os.environ.get("TRUST_REGISTRY_TABLE", "trust_registry")
BUCKET = os.environ.get("AUDIO_BUCKET", "")
LOCAL = os.environ.get("ECHOSEAL_LOCAL") == "1"

# ── Model warm-up ────────────────────────────────────────────────────────────
# Called at module scope so the models are loaded once per process, not per
# request. The Dockerfile pre-downloads the weights at image build time, so
# this is a fast disk load, not a 300 MB network fetch.
_get_generator()
_get_detector()

# ── AWS clients (skipped in LOCAL mode) ──────────────────────────────────────
_dynamodb = None if LOCAL else boto3.client("dynamodb", region_name=REGION)
# endpoint_url is explicit because boto3 otherwise presigns against the global
# s3.amazonaws.com host. For a bucket outside us-east-1 that returns a
# TemporaryRedirect, and the signature is bound to the host so following the
# redirect fails too — every presigned download link is dead on arrival.
_s3 = None if LOCAL else boto3.client(
    "s3", region_name=REGION, endpoint_url=f"https://s3.{REGION}.amazonaws.com"
)
_polly = None if LOCAL else boto3.client("polly", region_name=REGION)

# ── Registry cache ────────────────────────────────────────────────────────────
# The table holds exactly two rows for the demo. Cached at module scope so
# every invocation in the same process gets it for free.
# NOTE: Keep the LOCAL dict in sync with infra/seed_registry.py. If they
# disagree you get bugs that only appear after deploy.
_LOCAL_REGISTRY = {
    0: "SecureBank AI Assistant",
    2047: "Example Telecom Support",
}
_registry_cache: dict[int, str] | None = None


def _load_registry() -> dict[int, str]:
    global _registry_cache
    if _registry_cache is not None:
        return _registry_cache
    if LOCAL:
        _registry_cache = dict(_LOCAL_REGISTRY)
        return _registry_cache
    resp = _dynamodb.scan(TableName=TABLE)
    _registry_cache = {
        int(item["agent_id"]["N"]): item["entity_name"]["S"]
        for item in resp["Items"]
    }
    logger.info("Registry loaded: %s", _registry_cache)
    return _registry_cache


# ── Helpers ───────────────────────────────────────────────────────────────────

def _response(status: int, body: dict) -> dict:
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
        },
        "body": json.dumps(body),
    }


def _publish_audio(local_path: str, s3_key: str) -> str:
    """Upload to S3 and return a presigned GET URL (or a file:// URI locally)."""
    if LOCAL:
        return f"file://{local_path}"
    _s3.upload_file(local_path, BUCKET, s3_key)
    url = _s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": BUCKET, "Key": s3_key},
        ExpiresIn=3600,
    )
    return url


def _window_scan(wav_path: str, window_s: float = 5.0, hop_s: float = 1.0):
    """Score overlapping windows and return (best_conf, best_decoded_id).

    Silence padding dilutes whole-file confidence — a 60 s recording of a 15 s
    clip scores ~0.24 and fails even on a perfect capture. The best window is
    the signal that actually matters. Pattern mirrors test_rerecord._window_scan.

    Returns (0.0, None) when the file is shorter than one window.
    """
    wav = _load_audio_16k_mono(wav_path)
    n = wav.shape[-1]
    win = int(window_s * SAMPLE_RATE)
    hop = int(hop_s * SAMPLE_RATE)
    if n <= win:
        return 0.0, None

    best_conf, best_id = 0.0, None
    detector = _get_detector()
    with torch.no_grad():
        for start in range(0, n - win + 1, hop):
            seg = wav[..., start : start + win]
            prob, bits = detector.detect_watermark(
                seg, sample_rate=SAMPLE_RATE, detection_threshold=FRAME_THRESHOLD
            )
            conf = float(prob[0])
            if conf > best_conf:
                best_conf = conf
                best_id = _bits_to_int(bits[0])

    return best_conf, best_id


# ── /generate ─────────────────────────────────────────────────────────────────

def handle_generate(event: dict) -> dict:
    """POST /generate — synthesize speech via Polly, embed watermark, return audio URL.

    Body (JSON):
      agent_id   int  required  0 or 2047 for the demo
      text       str  optional  text to synthesize (Polly)
      voice_id   str  optional  Polly voice, default "Aditi"
      wav_base64 str  optional  base64-encoded WAV to skip Polly (for Person 4 testing)
    """
    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _response(400, {"error": "Invalid JSON body"})

    agent_id = body.get("agent_id")
    if agent_id is None:
        return _response(400, {"error": "agent_id is required"})
    try:
        agent_id = int(agent_id)
    except (TypeError, ValueError):
        return _response(400, {"error": "agent_id must be an integer"})
    if not (0 <= agent_id <= 65535):
        return _response(400, {"error": "agent_id must be 0..65535"})

    registry = _load_registry()
    if agent_id not in registry:
        return _response(400, {"error": f"agent_id {agent_id} is not in trust_registry"})

    with tempfile.TemporaryDirectory() as tmpdir:
        polly_path = os.path.join(tmpdir, "polly_out.wav")
        wm_path = os.path.join(tmpdir, "watermarked.wav")

        # ── Audio source: wav_base64 > Polly > stub ──────────────────────────
        wav_b64 = body.get("wav_base64")
        text = body.get("text", "")

        if wav_b64:
            # Person 4 or test: caller supplies a pre-generated WAV as base64.
            with open(polly_path, "wb") as f:
                f.write(base64.b64decode(wav_b64))

        elif text:
            if LOCAL:
                # Stub: fall back to the sample clip baked into the image.
                stub = os.path.join(os.path.dirname(__file__), "sample.wav")
                if not os.path.exists(stub):
                    return _response(503, {
                        "error": "LOCAL mode: no sample.wav stub found. "
                                 "Copy ml-audio/audio/sample.wav to backend/lambda/sample.wav."
                    })
                import shutil
                shutil.copy(stub, polly_path)
            else:
                # TODO (Person 4): verify valid SampleRate values for OutputFormat="pcm"
                # against the Polly API reference before the demo. If "16000" is rejected,
                # use "8000" and let watermark.py's julius resampler handle it.
                resp = _polly.synthesize_speech(
                    Text=text,
                    OutputFormat="pcm",
                    SampleRate="16000",
                    VoiceId=body.get("voice_id", "Aditi"),
                )
                audio_bytes = resp["AudioStream"].read()
                # Polly "pcm" is headerless signed 16-bit little-endian mono — add RIFF.
                with wave.open(polly_path, "wb") as w:
                    w.setnchannels(1)
                    w.setsampwidth(2)
                    w.setframerate(16000)
                    w.writeframes(audio_bytes)
        else:
            return _response(400, {
                "error": "Provide 'text' to synthesize or 'wav_base64' to skip Polly"
            })

        # ── Watermark embed ───────────────────────────────────────────────────
        # FIX 3: alpha=2.0. At alpha=1.0 a re-recorded clip scored 0.2385 —
        # below the 0.25 detection threshold. At 2.0 the same clip scored 0.4659.
        # Audio watermarked at 1.0 cannot be verified after re-recording.
        embed_watermark(polly_path, agent_id, output_path=wm_path, alpha=2.0)

        # ── Publish ───────────────────────────────────────────────────────────
        s3_key = f"audio/agent_{agent_id}/watermarked.wav"
        audio_url = _publish_audio(wm_path, s3_key)

        # In LOCAL mode the file:// path points inside the container and the temp
        # directory is gone the moment this block exits, so it is useless to the
        # caller. Return the bytes instead — same base64 convention /verify accepts,
        # which lets the round-trip test actually run.
        audio_b64 = (
            base64.b64encode(open(wm_path, "rb").read()).decode() if LOCAL else None
        )

    payload = {
        "audio_url": audio_url,
        "agent_id": agent_id,
        "entity_name": registry[agent_id],
    }
    if audio_b64:
        payload["audio_base64"] = audio_b64
    return _response(200, payload)


# ── /verify ───────────────────────────────────────────────────────────────────

def handle_verify(event: dict) -> dict:
    """POST /verify — detect watermark in uploaded audio, resolve to registered entity.

    Accepts JSON body with one of:
      wav_base64  str  base64-encoded WAV bytes
      s3_key      str  S3 key of a file pre-uploaded via presigned PUT

    Returns:
      { verified: bool, entity_name: str|null, agent_id: int|null, confidence: float }

    Lookup strategy (FIX 1): re-recording corrupts 3–5 bits, so exact DynamoDB
    get_item always misses. Instead: load all registered IDs, call nearest_agent()
    (Hamming distance ≤5), accept the unambiguous closest match.

    Detection strategy: run both the whole-file decode and the best 5 s window
    decode through nearest_agent, accept whichever resolves. Report best-window
    confidence to the caller (unaffected by silence padding).
    """
    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        body = {}

    with tempfile.TemporaryDirectory() as tmpdir:
        upload_path = os.path.join(tmpdir, "upload.wav")

        wav_b64 = body.get("wav_base64")
        s3_key = body.get("s3_key")

        if wav_b64:
            with open(upload_path, "wb") as f:
                f.write(base64.b64decode(wav_b64))
        elif s3_key and not LOCAL:
            _s3.download_file(BUCKET, s3_key, upload_path)
        else:
            return _response(400, {
                "error": "Provide 'wav_base64' or 's3_key' (s3_key requires AWS mode)"
            })

        # ── Whole-file detection ──────────────────────────────────────────────
        # Anything can arrive here — a browser sending webm, a truncated upload, an
        # HTML error page. soundfile raises on all of them; a 400 saying what is wrong
        # is far more useful to the frontend than a 500.
        try:
            whole_found, whole_decoded_id, whole_conf = verify_watermark(upload_path)
        except Exception as exc:
            logger.warning("Unreadable audio upload: %s", exc)
            return _response(400, {
                "error": "Could not read that audio. Send a WAV file "
                         "(browser MediaRecorder output must be converted first).",
                "detail": str(exc)[:200],
            })
        logger.info(
            "Whole-file: found=%s id=%s conf=%.4f", whole_found, whole_decoded_id, whole_conf
        )

        # ── Window scan ───────────────────────────────────────────────────────
        win_conf, win_decoded_id = _window_scan(upload_path)
        logger.info("Best window: conf=%.4f id=%s", win_conf, win_decoded_id)

        # Best-window confidence is what we report — silence padding doesn't dilute it.
        report_conf = max(win_conf, whole_conf)

        # ── Nearest-match registry lookup (FIX 1) ────────────────────────────
        registry = _load_registry()
        registered_ids = list(registry.keys())

        # Try whole-file decode first, then best-window decode.
        # Per hardware notes: averaging bits across windows was worse (10/16 vs 11/16);
        # the two decodes are independent guesses — take the first that resolves.
        resolved_id = None

        if whole_found and whole_decoded_id is not None:
            resolved_id = nearest_agent(whole_decoded_id, registered_ids)
            if resolved_id is not None:
                logger.info("Resolved via whole-file decode: %s", resolved_id)

        if resolved_id is None and win_decoded_id is not None and win_conf >= DETECTION_THRESHOLD:
            resolved_id = nearest_agent(win_decoded_id, registered_ids)
            if resolved_id is not None:
                logger.info("Resolved via window decode: %s", resolved_id)

        if resolved_id is not None:
            return _response(200, {
                "verified": True,
                "entity_name": registry[resolved_id],
                "agent_id": resolved_id,
                "confidence": round(report_conf, 4),
            })

    return _response(200, {
        "verified": False,
        "entity_name": None,
        "agent_id": None,
        "confidence": round(report_conf, 4),
    })


# ── Router ────────────────────────────────────────────────────────────────────

def lambda_handler(event: dict, context) -> dict:
    path = event.get("rawPath", event.get("path", ""))
    method = (
        event.get("requestContext", {}).get("http", {}).get("method", "")
        or event.get("httpMethod", "GET")
    )

    logger.info("Request: %s %s", method, path)

    try:
        if path == "/generate" and method == "POST":
            return handle_generate(event)
        if path == "/verify" and method == "POST":
            return handle_verify(event)
        if method == "OPTIONS":
            return _response(200, {})
        return _response(404, {"error": f"No route: {method} {path}"})
    except Exception:
        logger.exception("Unhandled error")
        return _response(500, {"error": "Internal server error"})
