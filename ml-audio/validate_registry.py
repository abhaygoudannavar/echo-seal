"""
End-to-end check: play demo_validate.wav, record it on a phone, run this.

Picks up the newest recording from ~/Downloads by itself, so there is no filename to
type. Converts whatever format the phone produced, detects the watermark, and matches
the noisy 16-bit decode against the registry by nearest Hamming distance.

    python validate_registry.py                 # newest file in ~/Downloads
    python validate_registry.py <path>          # or name one explicitly

Pass = "matched agent: 0". Record with iPhone spatial audio OFF; with it on the
watermark reads exactly zero.
"""

import subprocess
import sys
import tempfile
import warnings
from pathlib import Path

warnings.filterwarnings("ignore")

from watermark import (
    DETECTION_THRESHOLD,
    SAMPLE_RATE,
    nearest_agent,
    verify_watermark,
)

REGISTRY = {0: "SecureBank AI Assistant", 2047: "Example Telecom Support"}
EXPECTED = 0
AUDIO_EXT = (".m4a", ".qta", ".wav", ".mp3", ".aac", ".caf", ".mov", ".mp4")


def newest_recording() -> Path:
    downloads = Path.home() / "Downloads"
    files = [p for p in downloads.iterdir()
             if p.is_file() and p.suffix.lower() in AUDIO_EXT]
    if not files:
        raise SystemExit(
            f"No audio files in {downloads}.\n"
            "Record the playback on your phone and AirDrop it over first."
        )
    return max(files, key=lambda p: p.stat().st_mtime)


def to_wav(src: Path) -> str:
    if src.suffix.lower() == ".wav":
        return str(src)
    dst = Path(tempfile.mkdtemp()) / "converted.wav"
    r = subprocess.run(
        ["ffmpeg", "-y", "-i", str(src), "-ar", str(SAMPLE_RATE), "-ac", "1", str(dst)],
        capture_output=True, text=True,
    )
    if r.returncode != 0:
        raise SystemExit(f"ffmpeg could not read {src}:\n{r.stderr.strip()[-600:]}")
    return str(dst)


def main():
    src = Path(sys.argv[1]).expanduser() if len(sys.argv) > 1 else newest_recording()
    if not src.is_file():
        raise SystemExit(f"Not a readable file: {src}")
    print(f"Recording : {src.name}")

    found, decoded, conf = verify_watermark(to_wav(src))
    print(f"  detected  : {found}  (confidence {conf:.4f}, threshold {DETECTION_THRESHOLD})")
    print(f"  raw decode: {decoded}")

    if not found:
        print("\nFAIL — no watermark detected. Check spatial audio is OFF, phone close,")
        print("volume up, and that you played demo_validate.wav.")
        return

    match = nearest_agent(decoded, list(REGISTRY))
    errors = bin(decoded ^ EXPECTED).count("1") if decoded is not None else None
    print(f"  bit errors vs expected {EXPECTED}: {errors}/16")
    print(f"\nmatched agent: {match}" + (f"  -> {REGISTRY[match]}" if match is not None else ""))

    if match == EXPECTED:
        print("\nPASS — watermark detected and resolved to the right entity.")
    elif match is None:
        print("\nFAIL — detected, but the decode was too corrupted to match any agent.")
    else:
        print(f"\nFAIL — matched the WRONG agent ({match}). Worse than no match; the")
        print("registry IDs may be too close together.")


if __name__ == "__main__":
    main()
