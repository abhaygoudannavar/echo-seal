"""
The REAL robustness test: speaker playback -> phone microphone -> detect.
This is the claim the demo rests on, and it needs actual hardware. Nothing here
is simulated.

Step 1 — make the clip to play:
    python test_rerecord.py prepare

Step 2 — play audio/demo_playback.wav out of a laptop/desk speaker at a normal
    speaking volume. Record it with a phone (Voice Memos / any recorder) held
    roughly 15-30 cm from the speaker. Keep the room quiet.

Step 3 — transfer the recording to this folder (AirDrop) and check it:
    python test_rerecord.py verify ~/Downloads/recording.m4a

m4a/mp3/whatever is fine — it gets converted automatically.
"""

import subprocess
import sys
import tempfile
import warnings
from pathlib import Path

import soundfile as sf
import torch

warnings.filterwarnings("ignore")

from watermark import (
    DETECTION_THRESHOLD,
    SAMPLE_RATE,
    _get_detector,
    _load_audio_16k_mono,
    embed_watermark,
    verify_watermark,
)

AGENT_ID = 1337
PLAYBACK = "audio/demo_playback.wav"


def prepare():
    out = embed_watermark("audio/sample.wav", AGENT_ID, output_path=PLAYBACK)
    info = sf.info(out)
    print(f"Wrote {out}  ({info.duration:.1f}s, agent_id={AGENT_ID})")
    print("\nPlay this out of a speaker and record it on a phone ~15-30 cm away.")
    print("Then run:  python test_rerecord.py verify <recording>")


def _to_wav(path: str) -> str:
    """Phone recorders emit m4a; soundfile can't read it. Convert via ffmpeg."""
    if Path(path).suffix.lower() in (".wav", ".flac", ".ogg"):
        return path
    dst = Path(tempfile.mkdtemp()) / "converted.wav"
    subprocess.run(
        ["ffmpeg", "-y", "-i", path, "-ar", str(SAMPLE_RATE), "-ac", "1", str(dst)],
        capture_output=True, check=True,
    )
    return str(dst)


def _window_scan(path: str, window_s: float = 5.0, hop_s: float = 1.0):
    """Score overlapping windows, not just the whole file.

    Why this matters: confidence is the FRACTION of frames carrying the watermark, so
    silence or room tone before and after the clip drags the whole-file number down. A
    30 s recording of a 14 s clip caps out near 0.47 even on a flawless capture. The
    best window tells you whether the watermark itself survived, separately from how
    much dead air you recorded around it.
    """
    wav = _load_audio_16k_mono(path)
    n = wav.shape[-1]
    win, hop = int(window_s * SAMPLE_RATE), int(hop_s * SAMPLE_RATE)
    if n <= win:
        return None
    best = (0.0, None, 0.0)
    with torch.no_grad():
        for start in range(0, n - win + 1, hop):
            seg = wav[..., start:start + win]
            prob, bits = _get_detector().detect_watermark(seg, sample_rate=SAMPLE_RATE)
            conf = float(prob[0])
            if conf > best[0]:
                value = 0
                for b in bits[0].tolist():
                    value = (value << 1) | int(b)
                best = (conf, value, start / SAMPLE_RATE)
    return best


def verify(path: str):
    wav_path = _to_wav(path)
    info = sf.info(wav_path)
    print(f"Recording: {path}")
    print(f"  {info.samplerate} Hz, {info.channels} ch, {info.duration:.1f} s\n")

    found, dec_id, conf = verify_watermark(wav_path)
    print("--- whole file ---")
    print(f"  found       : {found}")
    print(f"  confidence  : {conf:.4f}   (threshold {DETECTION_THRESHOLD})")
    print(f"  decoded id  : {dec_id}")
    print(f"  expected id : {AGENT_ID}")
    print(f"  ID CORRECT  : {dec_id == AGENT_ID}")

    best = _window_scan(wav_path)
    if best:
        conf_b, id_b, at = best
        print("\n--- best 5s window (ignores silence padding) ---")
        print(f"  confidence  : {conf_b:.4f}  at t={at:.1f}s")
        print(f"  decoded id  : {id_b}   ID CORRECT: {id_b == AGENT_ID}")

    print()
    if dec_id == AGENT_ID and found:
        print("PASS — watermark survived re-recording and the ID decoded correctly.")
    elif best and best[1] == AGENT_ID:
        print("PARTIAL — ID recovers in the best window but the whole-file score is")
        print("low. Trim the recording to just the spoken clip, or have the verifier")
        print("scan windows instead of scoring the whole upload.")
    else:
        print("FAIL — watermark did not survive. Try: phone closer to the speaker,")
        print("louder playback, quieter room, harder surface (less soft furnishing).")


if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] not in ("prepare", "verify"):
        print(__doc__)
        sys.exit(1)
    if sys.argv[1] == "prepare":
        prepare()
    else:
        if len(sys.argv) < 3:
            print("usage: python test_rerecord.py verify <recording>")
            sys.exit(1)
        verify(sys.argv[2])
