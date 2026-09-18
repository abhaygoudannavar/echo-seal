"""
Simulated robustness sweep for the AudioSeal watermark.

IMPORTANT: this is a SIMULATION of the speaker -> phone-mic path, not the real test.
It applies band-limiting, room reverb, noise and codec round-trips in software. It
does NOT capture real loudspeaker distortion, phone mic AGC, or room acoustics. Treat
it as an early signal only. The real test is test_rerecord.py with an actual phone.

Run:  python test_robustness.py
"""

import subprocess
import tempfile
import warnings
from pathlib import Path

import julius
import numpy as np
import soundfile as sf
import torch

warnings.filterwarnings("ignore")

from watermark import SAMPLE_RATE, embed_watermark, verify_watermark

# Reverb and noise are randomly generated; seed so reported numbers are reproducible.
torch.manual_seed(0)

SOURCE = "audio/sample.wav"
AGENT_ID = 1337
OUT_DIR = Path("audio/robustness")


def _write(wav: torch.Tensor, path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(path), wav.clamp(-1, 1)[0, 0].numpy(), SAMPLE_RATE, subtype="PCM_16")
    return path


def _read(path: str) -> torch.Tensor:
    data, sr = sf.read(str(path), dtype="float32", always_2d=True)
    wav = torch.from_numpy(data.T).mean(dim=0, keepdim=True)
    if sr != SAMPLE_RATE:
        wav = julius.resample_frac(wav, sr, SAMPLE_RATE)
    return wav.unsqueeze(0)


def add_noise(wav: torch.Tensor, snr_db: float) -> torch.Tensor:
    """Additive white gaussian noise at a target SNR — stands in for room noise."""
    signal_power = wav.pow(2).mean()
    noise = torch.randn_like(wav)
    noise_power = noise.pow(2).mean()
    scale = (signal_power / (noise_power * 10 ** (snr_db / 10))).sqrt()
    return wav + noise * scale


def add_reverb(wav: torch.Tensor, rt60: float = 0.3) -> torch.Tensor:
    """Convolve with a synthetic exponentially-decaying room impulse response.

    WORST CASE ON PURPOSE: normalising the whole impulse response buries the direct
    path under the reverb tail, which models a mic far across a room, not a phone held
    near a speaker. That is why these rows fail while test_realistic.py passes — that
    script controls the direct-to-reverberant ratio explicitly. Read the two together.
    """
    n = int(rt60 * SAMPLE_RATE)
    t = torch.arange(n, dtype=torch.float32) / SAMPLE_RATE
    rir = torch.randn(n) * torch.exp(-6.9 * t / rt60)
    rir[0] = 1.0  # direct path
    rir = rir / rir.norm()
    out = torch.nn.functional.conv1d(
        wav.view(1, 1, -1), rir.flip(0).view(1, 1, -1), padding=n - 1
    )
    return out[..., : wav.shape[-1]]


def bandpass(wav: torch.Tensor, low_hz: float, high_hz: float) -> torch.Tensor:
    """Speaker + phone-mic frequency response, roughly."""
    out = julius.highpass_filter(wav, low_hz / SAMPLE_RATE)
    out = julius.lowpass_filter(out, high_hz / SAMPLE_RATE)
    return out


def codec_roundtrip(
    wav: torch.Tensor, name: str, args: list, decode_args: list | None = None
) -> torch.Tensor:
    """Encode/decode through a real codec with ffmpeg.

    decode_args is needed for raw/headerless formats (g726) that can't be sniffed.
    """
    with tempfile.TemporaryDirectory() as td:
        src = Path(td) / "in.wav"
        enc = Path(td) / f"enc.{name}"
        dec = Path(td) / "out.wav"
        _write(wav, src)
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(src), *args, str(enc)],
            capture_output=True, check=True,
        )
        subprocess.run(
            ["ffmpeg", "-y", *(decode_args or []), "-i", str(enc),
             "-ar", str(SAMPLE_RATE), "-ac", "1", str(dec)],
            capture_output=True, check=True,
        )
        return _read(str(dec))


def evaluate(label: str, wav: torch.Tensor, expect_id: int) -> dict:
    path = _write(wav, OUT_DIR / f"{label.replace(' ', '_').replace('/', '-')}.wav")
    found, dec_id, conf = verify_watermark(str(path))
    return {
        "label": label,
        "found": found,
        "id_ok": dec_id == expect_id,
        "decoded": dec_id,
        "conf": conf,
    }


def main():
    print(f"Source: {SOURCE}   agent_id={AGENT_ID}")
    print("SIMULATED degradations — not a substitute for the real phone re-recording.\n")

    for alpha in (1.0, 1.5, 2.0):
        wm_path = embed_watermark(
            SOURCE, AGENT_ID, output_path=f"audio/wm_alpha{alpha}.wav", alpha=alpha
        )
        wm = _read(wm_path)

        cases = [
            ("clean", wm),
            ("bandpass 200-7000Hz (speaker+mic)", bandpass(wm, 200, 7000)),
            ("bandpass 300-3400Hz (telephone)", bandpass(wm, 300, 3400)),
            ("reverb rt60=0.3s", add_reverb(wm, 0.3)),
            ("reverb rt60=0.6s", add_reverb(wm, 0.6)),
            ("noise snr=20dB", add_noise(wm, 20)),
            ("noise snr=10dB", add_noise(wm, 10)),
            ("noise snr=5dB", add_noise(wm, 5)),
            # Closest software proxy for the demo: room echo + ambient noise + the
            # limited bandwidth of a laptop speaker into a phone mic.
            ("ROOM PROXY reverb+noise15+bandpass",
             bandpass(add_noise(add_reverb(wm, 0.3), 15), 200, 7000)),
            ("mp3 64k", codec_roundtrip(wm, "mp3", ["-b:a", "64k"])),
            ("opus 24k", codec_roundtrip(wm, "opus", ["-c:a", "libopus", "-b:a", "24k"])),
            ("g726 16k @8kHz (telephone ADPCM)",
             codec_roundtrip(
                 wm, "g726",
                 ["-ar", "8000", "-ac", "1", "-acodec", "g726", "-b:a", "16k", "-f", "g726"],
                 decode_args=["-f", "g726", "-code_size", "2", "-ar", "8000"],
             )),
        ]

        print(f"=== alpha = {alpha} ===")
        print(f"{'case':<40} {'found':<7} {'id ok':<7} {'conf':<8}")
        print("-" * 64)
        for label, wav in cases:
            r = evaluate(f"a{alpha}_{label}", wav, AGENT_ID)
            print(f"{label:<40} {str(r['found']):<7} {str(r['id_ok']):<7} {r['conf']:.4f}")
        print()

    # Clip length matters: a short verification snippet has fewer frames to vote on.
    print("=== clip length (alpha=1.0, clean) ===")
    wm = _read("audio/wm_alpha1.0.wav")
    print(f"{'duration':<40} {'found':<7} {'id ok':<7} {'conf':<8}")
    print("-" * 64)
    for secs in (1, 2, 3, 5, 10):
        seg = wm[..., : int(secs * SAMPLE_RATE)]
        r = evaluate(f"len_{secs}s", seg, AGENT_ID)
        print(f"{str(secs) + 's':<40} {str(r['found']):<7} {str(r['id_ok']):<7} {r['conf']:.4f}")


if __name__ == "__main__":
    main()
