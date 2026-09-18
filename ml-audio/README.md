# ml-audio — watermark embed & verify

Owner: Person 1.

Wraps [AudioSeal](https://github.com/facebookresearch/audioseal) (Meta, MIT) into two
functions the rest of the system calls. Embeds an inaudible 16-bit agent ID into speech,
and recovers it from a recording.

## Setup

Requires Python 3.10+ and ffmpeg (`brew install ffmpeg`).

```bash
cd ml-audio
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

On macOS with a python.org Python, the model download fails SSL verification unless you
point Python at certifi's bundle:

```bash
export SSL_CERT_FILE=$(.venv/bin/python -c 'import certifi; print(certifi.where())')
```

First run downloads ~300 MB of model weights from HuggingFace.

## API

Two functions, stable signatures. Run scripts from inside `ml-audio/` — the audio paths
are relative.

```python
from watermark import embed_watermark, verify_watermark

# Embed an agent's ID into a clip. agent_id is 0..65535.
out_path = embed_watermark("polly_output.wav", agent_id=1337)

# Check a clip and recover the ID.
found, decoded_id, confidence = verify_watermark("suspicious_call.wav")
```

`embed_watermark(audio_path, agent_id, output_path=None, alpha=1.0) -> str`
Returns the path to a 16 kHz mono 16-bit PCM wav. Any input sample rate and channel
count is accepted; resampling and mono downmix happen internally, because AudioSeal 0.2
dropped its own resampling and the models are 16 kHz only.

`verify_watermark(audio_path) -> (found: bool, decoded_id: int | None, confidence: float)`
`decoded_id` is `None` when `found` is `False` — the decoder always emits bits, but on
unwatermarked audio they are noise.

## Results

All figures from one seeded run each of `test_realistic.py` and `test_robustness.py`,
at `alpha=1.0` on a 14.5 s speech clip. These are **simulations** of the acoustic path,
not a real re-recording — see the status note in the root README.

**Codecs and band-limiting** — no trouble at all:

| Condition | Confidence | ID correct |
|---|---|---|
| Clean | 1.0000 | yes |
| MP3 64 kbps | 1.0000 | yes |
| Opus 24 kbps | 1.0000 | yes |
| Telephone band (300–3400 Hz) | 1.0000 | yes |
| G.726 ADPCM @ 8 kHz | 0.6495 | yes |

**Simulated room, by how close the phone is** (reverb + noise + speaker/mic band).
Direct-to-reverberant ratio is the proxy for microphone distance — roughly 15–25 dB for
a phone held 15–30 cm from a speaker, near 0–5 dB for a phone across the room:

| DRR | Confidence | ID correct |
|---|---|---|
| 30 dB | 0.7387 | yes |
| 20 dB | 0.7357 | yes |
| 15 dB | 0.6608 | yes |
| 10 dB | 0.5518 | yes |
| 5 dB | 0.6347 | yes |

**False positives** — non-watermarked audio put through the same degradations never
exceeded **0.0072**. That is the headroom the detection threshold is built on.

Clip length is not a constraint: even a 1-second segment detects at 1.0000.

Raising `alpha` above 1.0 does **not** help against reverb — 1.5 and 2.0 were no better,
and sometimes worse. If the live test struggles, move the phone closer rather than
turning up watermark strength.

## Why the detection threshold is 0.25

AudioSeal's default is 0.5. Every realistic re-recording scenario above lands between
0.34 and 0.74, so a 0.5 cutoff would fail them all. Non-watermarked audio never scored
above 0.0072 under any degradation tested. 0.25 sits in that gap with margin on both
sides. Don't move it back without re-running `test_realistic.py`.

The per-frame classifier cutoff (`FRAME_THRESHOLD`, 0.5, AudioSeal's trained default)
and the whole-file decision threshold (`DETECTION_THRESHOLD`, 0.25) are separate values
and must stay that way.

## Notes for the backend

**Bake the model into the container image.** The weights download from HuggingFace on
first use. Call `_get_generator()` and `_get_detector()` at image build time, or the
first real request will time out. Models are `lru_cache`d per process, so initialize at
module scope, outside the handler — not per invocation. PyTorch is why this ships as a
container image rather than a zip.

**Importing from another folder.** `ml-audio` has a hyphen, so it is not a valid Python
module name — don't try `from ml_audio import watermark`. Either copy `watermark.py`
into the Lambda build context, or add the directory to the path:

```python
sys.path.insert(0, "../ml-audio")
from watermark import embed_watermark, verify_watermark
```

**Confidence is a fraction of frames, so silence dilutes it.** A 60-second upload
containing a 15-second watermarked clip scores about 0.24 and fails even on a perfect
capture. The `/verify` endpoint should score overlapping windows rather than the whole
upload — see the sliding-window scan in `test_rerecord.py`.

**`found=True` does not guarantee the ID is right.** At 10 dB SNR the detector reported
`found=True` with a corrupted ID. The `trust_registry` lookup is the safety net: treat
an ID that isn't in the table as unverified, rather than rendering a wrong entity name.
With only a handful of registered agents out of 65536 possible IDs, a corrupted ID
almost never lands on a real entry.

## Testing

```bash
python test_robustness.py    # simulated codecs, noise, worst-case reverb
python test_realistic.py     # mic distance and room noise sweeps, false positives
```

The real test, which needs an actual phone:

```bash
python test_rerecord.py prepare
# play audio/demo_playback.wav through a speaker at normal speaking volume,
# record on a phone ~15-30 cm away in a quiet room, transfer the file back
python test_rerecord.py verify ~/Downloads/recording.m4a
```

It reports whole-file confidence, the best 5-second window, and the decoded ID.

The two reverb models differ on purpose: `test_robustness.py` buries the direct path
(far mic, worst case), `test_realistic.py` controls the direct-to-reverberant ratio
(phone near a speaker). Read them together.

## Files

```
watermark.py          the module — embed_watermark / verify_watermark
test_rerecord.py      the real speaker -> phone-mic test harness
test_realistic.py     mic distance (DRR) and room noise sweeps, false-positive check
test_robustness.py    codec, filtering and worst-case reverb sweep
audio/sample.wav      test speech clip
audio/demo_playback.wav  watermarked clip to play for the re-recording test
```
