"""
Run the speaker -> phone-mic test in one command, no file transfer.

macOS Continuity exposes a nearby iPhone's microphone as an audio input device, so
ffmpeg can capture from the real phone mic while the Mac plays the watermarked clip
out of its speakers. That is the same acoustic path as recording in Voice Memos and
AirDropping the file, minus the faff.

    python record_and_verify.py --list          # show input devices
    python record_and_verify.py                 # auto-pick the iPhone mic
    python record_and_verify.py --device 0      # or choose one explicitly

Set up first: phone 15-30 cm from the speakers, quiet room, volume at normal talking
level. The Mac must be allowed to use the microphone (System Settings > Privacy &
Security > Microphone > Terminal).

CAVEAT for the demo video: Continuity may apply its own processing over the wireless
link, so a plain Voice Memos recording is still the cleaner evidence. Use this to get
a fast answer; film the Voice Memos version.
"""

import argparse
import re
import subprocess
import sys
import time
from pathlib import Path

import soundfile as sf

PLAYBACK = "audio/demo_playback.wav"
CAPTURE = "audio/rerecorded_capture.wav"
LEAD_IN = 1.0   # start recording before playback so nothing is clipped
TAIL = 1.5


def list_devices() -> list[tuple[int, str]]:
    """Parse ffmpeg's avfoundation device list."""
    out = subprocess.run(
        ["ffmpeg", "-hide_banner", "-f", "avfoundation", "-list_devices", "true", "-i", ""],
        capture_output=True, text=True,
    ).stderr
    audio = out.split("AVFoundation audio devices:")
    if len(audio) < 2:
        return []
    return [
        (int(m.group(1)), m.group(2).strip())
        for m in re.finditer(r"\[(\d+)\] (.+)", audio[1])
    ]


def pick_device(devices: list[tuple[int, str]]) -> int:
    for idx, name in devices:
        if "iphone" in name.lower():
            return idx
    if devices:
        return devices[0][0]
    raise SystemExit("No audio input devices found.")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--list", action="store_true", help="list input devices and exit")
    ap.add_argument("--device", type=int, help="audio input device index")
    args = ap.parse_args()

    devices = list_devices()
    if args.list or not devices:
        for idx, name in devices:
            print(f"  [{idx}] {name}")
        if not devices:
            print("  (none found)")
        return

    device = args.device if args.device is not None else pick_device(devices)
    name = dict(devices).get(device, "?")

    if not Path(PLAYBACK).is_file():
        raise SystemExit(f"{PLAYBACK} missing — run: python test_rerecord.py prepare")
    duration = sf.info(PLAYBACK).duration
    total = duration + LEAD_IN + TAIL

    print(f"Recording from [{device}] {name}")
    print(f"Playing {PLAYBACK} ({duration:.1f}s), capturing {total:.1f}s\n")
    print("Phone 15-30 cm from the speakers, quiet room. Starting in 3s...")
    time.sleep(3)

    rec = subprocess.Popen(
        ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
         "-f", "avfoundation", "-i", f":{device}", "-t", str(total),
         "-ac", "1", CAPTURE],
        stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True,
    )
    time.sleep(LEAD_IN)
    print("  playing...")
    subprocess.run(["afplay", PLAYBACK])
    print("  done, finishing capture...")
    _, err = rec.communicate(timeout=total + 15)

    if rec.returncode != 0 or not Path(CAPTURE).is_file():
        raise SystemExit(
            f"Recording failed:\n{(err or '').strip()[-800:]}\n\n"
            "If this mentions permissions, allow microphone access for your terminal "
            "in System Settings > Privacy & Security > Microphone."
        )

    print(f"\nCaptured {CAPTURE} ({sf.info(CAPTURE).duration:.1f}s)\n")
    subprocess.run([sys.executable, "test_rerecord.py", "verify", CAPTURE])


if __name__ == "__main__":
    main()
