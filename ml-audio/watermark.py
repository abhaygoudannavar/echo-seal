"""
AudioSeal watermarking for the AI Voice Verification app.

Public API (stable — Person 2 imports these into the Lambda):

    embed_watermark(audio_path, agent_id, output_path=None, alpha=1.0) -> str
    verify_watermark(audio_path) -> (found: bool, decoded_id: int | None, confidence: float)

Notes for the backend:
  * AudioSeal models run at 16 kHz mono ONLY. As of AudioSeal 0.2 the library no
    longer resamples internally, so this module does it. Any sample rate / channel
    count can go in; output .wav is always 16 kHz mono 16-bit PCM.
  * agent_id is a 16-bit integer: 0..65535. That is the DynamoDB trust_registry key.
  * Models are lazy-loaded and cached per process. First call downloads ~300 MB from
    HuggingFace — in the Lambda container image, bake the weights in at build time
    (set AUDIOSEAL_CACHE_DIR / call _get_generator() in the Dockerfile) or the first
    request will time out.
"""

from functools import lru_cache
from pathlib import Path
from typing import Optional, Tuple

import julius
import numpy as np
import soundfile as sf
import torch
from audioseal import AudioSeal

# AudioSeal's pretrained models are trained at this rate; do not change.
SAMPLE_RATE = 16000
NBITS = 16
MAX_AGENT_ID = (1 << NBITS) - 1  # 65535

# Two distinct thresholds — do not collapse them into one.
#
# FRAME_THRESHOLD: per-frame classifier cutoff, AudioSeal's trained default. Leave at 0.5.
FRAME_THRESHOLD = 0.5
#
# DETECTION_THRESHOLD: what fraction of frames must look watermarked before we call it
# a match. Lowered from 0.5 to 0.25 on measured evidence: across simulated room reverb,
# noise and codec degradations, watermarked audio never scored below 0.44, while
# NON-watermarked audio never scored above 0.017. 0.25 sits in that gap with margin on
# both sides. Raising it back to 0.5 makes re-recorded audio fail. See test_realistic.py.
DETECTION_THRESHOLD = 0.25


@lru_cache(maxsize=1)
def _get_generator():
    model = AudioSeal.load_generator("audioseal_wm_16bits")
    return model.eval()


@lru_cache(maxsize=1)
def _get_detector():
    model = AudioSeal.load_detector("audioseal_detector_16bits")
    return model.eval()


def _int_to_bits(value: int) -> torch.Tensor:
    """16-bit int -> tensor of 16 bits, most-significant bit first."""
    if not 0 <= value <= MAX_AGENT_ID:
        raise ValueError(f"agent_id must be 0..{MAX_AGENT_ID}, got {value}")
    bits = [(value >> shift) & 1 for shift in reversed(range(NBITS))]
    return torch.tensor(bits, dtype=torch.int32)


def _bits_to_int(bits: torch.Tensor) -> int:
    """Inverse of _int_to_bits. Expects 16 bits, most-significant first."""
    value = 0
    for bit in bits.flatten().tolist():
        value = (value << 1) | int(bit)
    return value


def _load_audio_16k_mono(audio_path: str) -> torch.Tensor:
    """Read any wav/flac/ogg, downmix to mono, resample to 16 kHz.

    Returns a tensor shaped (1, 1, samples) — the batch x channels x time layout
    AudioSeal expects.
    """
    data, sr = sf.read(str(audio_path), dtype="float32", always_2d=True)
    wav = torch.from_numpy(data.T)  # (channels, samples)
    if wav.shape[0] > 1:
        wav = wav.mean(dim=0, keepdim=True)  # downmix to mono
    if sr != SAMPLE_RATE:
        wav = julius.resample_frac(wav, sr, SAMPLE_RATE)
    return wav.unsqueeze(0)  # (1, 1, samples)


def embed_watermark(
    audio_path: str,
    agent_id: int,
    output_path: Optional[str] = None,
    alpha: float = 1.0,
) -> str:
    """Embed agent_id inaudibly into a speech clip and write a new .wav.

    Args:
        audio_path: source audio (Polly output, a recording, any sample rate).
        agent_id: 0..65535, the registered entity's ID in trust_registry.
        output_path: where to write. Defaults to "<source>_wm.wav" alongside input.
        alpha: watermark strength multiplier. 1.0 is AudioSeal's trained default and
            is inaudible. Raising it (e.g. 1.5-2.0) survives noisy channels better at
            the cost of a faint artifact. See robustness notes before changing.

    Returns:
        Path to the watermarked .wav (16 kHz mono 16-bit PCM).
    """
    wav = _load_audio_16k_mono(audio_path)
    message = _int_to_bits(agent_id).unsqueeze(0)  # (1, 16)

    with torch.no_grad():
        watermarked = _get_generator()(
            wav, sample_rate=SAMPLE_RATE, message=message, alpha=alpha
        )

    # The watermark is added on top of the signal, so a loud source can push samples
    # past full scale; clip rather than let 16-bit PCM wrap around.
    watermarked = watermarked.clamp(-1.0, 1.0)

    if output_path is None:
        src = Path(audio_path)
        output_path = str(src.with_name(f"{src.stem}_wm.wav"))

    sf.write(output_path, watermarked[0, 0].numpy(), SAMPLE_RATE, subtype="PCM_16")
    return output_path


def verify_watermark(audio_path: str) -> Tuple[bool, Optional[int], float]:
    """Check whether a clip carries our watermark and recover the agent ID.

    Args:
        audio_path: audio to check — an upload, or a phone re-recording of a call.

    Returns:
        (found, decoded_id, confidence)
          found:      True if the watermark was detected above DETECTION_THRESHOLD.
          decoded_id: the 16-bit agent ID, or None when found is False. Look this up
                      in trust_registry to get the entity name.
          confidence: 0.0-1.0, the fraction of audio frames carrying the watermark.
                      Note this is a detection score, not a probability the ID is right.

    When found is False the decoder still emits bits, but they are noise — that is why
    decoded_id is None. Never trust the ID without checking found first.
    """
    wav = _load_audio_16k_mono(audio_path)

    with torch.no_grad():
        detect_prob, message_bits = _get_detector().detect_watermark(
            wav, sample_rate=SAMPLE_RATE, detection_threshold=FRAME_THRESHOLD
        )

    confidence = float(detect_prob[0])
    found = confidence >= DETECTION_THRESHOLD
    decoded_id = _bits_to_int(message_bits[0]) if found else None
    return found, decoded_id, confidence
