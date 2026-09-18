"""
Focused sweep of the two things that actually decide the demo:
  1. how close the phone is to the speaker  (direct-to-reverberant ratio, DRR)
  2. how quiet the room is                  (SNR)

Plus a false-positive check, to see whether DETECTION_THRESHOLD has room to move.

Still a SIMULATION — see test_robustness.py header. Real test is test_rerecord.py.
"""

import warnings
from pathlib import Path

import julius
import soundfile as sf
import torch

warnings.filterwarnings("ignore")

from watermark import SAMPLE_RATE, _get_detector, embed_watermark

# Reverb and noise are randomly generated; seed so reported numbers are reproducible.
torch.manual_seed(0)

AGENT_ID = 1337
OUT = Path("audio/realistic")


def _read(path):
    data, sr = sf.read(str(path), dtype="float32", always_2d=True)
    wav = torch.from_numpy(data.T).mean(dim=0, keepdim=True)
    if sr != SAMPLE_RATE:
        wav = julius.resample_frac(wav, sr, SAMPLE_RATE)
    return wav.unsqueeze(0)


def reverb(wav, rt60=0.3, drr_db=15.0):
    """Room echo with an explicit direct-to-reverberant ratio.

    drr_db is the knob that matters: a phone held ~15 cm from a speaker is roughly
    15-25 dB DRR; a phone across a room is closer to 0-5 dB.
    """
    n = int(rt60 * SAMPLE_RATE)
    t = torch.arange(n, dtype=torch.float32) / SAMPLE_RATE
    tail = torch.randn(n) * torch.exp(-6.9 * t / rt60)
    tail[0] = 0.0
    tail = tail / tail.norm()
    rir = tail * (10 ** (-drr_db / 20))
    rir[0] = 1.0  # direct path, held at unit gain
    out = torch.nn.functional.conv1d(
        wav.view(1, 1, -1), rir.flip(0).view(1, 1, -1), padding=n - 1
    )
    return out[..., : wav.shape[-1]]


def noise(wav, snr_db):
    sp = wav.pow(2).mean()
    nz = torch.randn_like(wav)
    return wav + nz * (sp / (nz.pow(2).mean() * 10 ** (snr_db / 10))).sqrt()


def bandpass(wav, lo=200, hi=7000):
    return julius.lowpass_filter(
        julius.highpass_filter(wav, lo / SAMPLE_RATE), hi / SAMPLE_RATE
    )


def score(wav):
    """Return (fraction-of-frames score, decoded id, mean per-bit certainty)."""
    with torch.no_grad():
        prob, bits = _get_detector().detect_watermark(wav, sample_rate=SAMPLE_RATE)
    value = 0
    for b in bits[0].tolist():
        value = (value << 1) | int(b)
    return float(prob[0]), value


def main():
    wm = _read(embed_watermark(SOURCE := "audio/sample.wav", AGENT_ID,
                               output_path="audio/wm_a1.wav", alpha=1.0))
    clean = _read(SOURCE)

    print("=== DRR sweep (rt60=0.3s, no noise) — how close is the phone? ===")
    print(f"{'DRR':<12} {'conf':<10} {'id ok'}")
    print("-" * 34)
    for drr in (30, 25, 20, 15, 10, 5, 0):
        c, i = score(reverb(wm, 0.3, drr))
        print(f"{str(drr) + ' dB':<12} {c:<10.4f} {i == AGENT_ID}")

    print("\n=== SNR sweep (no reverb) — how quiet is the room? ===")
    print(f"{'SNR':<12} {'conf':<10} {'id ok'}")
    print("-" * 34)
    for snr in (40, 30, 25, 20, 15, 10):
        c, i = score(noise(wm, snr))
        print(f"{str(snr) + ' dB':<12} {c:<10.4f} {i == AGENT_ID}")

    print("\n=== combined room proxy: reverb(DRR) + noise 30dB + bandpass ===")
    print(f"{'DRR':<12} {'conf':<10} {'id ok'}")
    print("-" * 34)
    for drr in (30, 25, 20, 15, 10, 5):
        c, i = score(bandpass(noise(reverb(wm, 0.3, drr), 30)))
        print(f"{str(drr) + ' dB':<12} {c:<10.4f} {i == AGENT_ID}")

    print("\n=== FALSE POSITIVES: same degradations on NON-watermarked audio ===")
    print("(how low can DETECTION_THRESHOLD safely go?)")
    print(f"{'case':<34} {'conf'}")
    print("-" * 44)
    for label, wav in [
        ("clean original", clean),
        ("reverb drr=10", reverb(clean, 0.3, 10)),
        ("noise snr=20", noise(clean, 20)),
        ("room proxy drr=10", bandpass(noise(reverb(clean, 0.3, 10), 30))),
        ("room proxy drr=5", bandpass(noise(reverb(clean, 0.3, 5), 30))),
    ]:
        c, _ = score(wav)
        print(f"{label:<34} {c:.4f}")


if __name__ == "__main__":
    main()
