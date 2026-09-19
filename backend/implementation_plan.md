# EchoSeal Backend — Implementation Plan (corrected)

Reviewed against the hardware results from 2026-09-19. The original plan was written
against an earlier version of `ml-audio/README.md`; five things in it break, three of
them silently at demo time. Corrections are marked **[FIX]** with the reason.

---

## Blockers to fix before writing code

### [FIX 1] Exact DynamoDB lookup will never match — use nearest Hamming distance

The original plan does:

```python
trust_registry.get_item(Key={"agent_id": str(decoded_id)})   # WRONG
```

Over-the-air re-recording corrupts 3 to 5 of the 16 message bits, every single time.
Measured on a real phone: the clip carrying agent 0 decoded as 268 (3 bits wrong); an
earlier run carrying 1337 decoded as 41341 (5 bits wrong). An exact key lookup misses
100% of the time on re-recorded audio, which is the entire demo.

The registry is tiny, so it doubles as an error-correcting codebook. Load every
registered ID and pick the closest:

```python
from watermark import nearest_agent

registry = load_registry()                       # {0: "SecureBank AI Assistant", ...}
agent_id = nearest_agent(decoded_id, list(registry))
if agent_id is None:
    return unverified(confidence)                # too corrupted, or ambiguous tie
return verified(agent_id, registry[agent_id], confidence)
```

`nearest_agent` returns `None` when nothing is within the bit-error budget **or** when
two candidates tie. Both must render as unverified — never guess an entity name.

Because this needs the whole registry rather than one key, use `scan` on the table
(it holds two rows) and cache the result at module scope alongside the models.

### [FIX 2] Registry IDs must be 0 and 2047, not 1337 and 42

`seed_registry.py` in the original seeds `1337` and `42`. Those are only 5 bits apart
in Hamming distance. With 3 to 5 bit errors on every re-recording, a decode can land
closer to the wrong one — which would show a user the wrong bank's name. That failure
is worse than showing nothing.

Use the IDs from `pick_agent_ids()`, which spaces them 11 bits apart so a 5-error
decode is still unambiguous:

```
agent_id=0     → "SecureBank AI Assistant"
agent_id=2047  → "Example Telecom Support"
```

Two agents is the hard ceiling at the current error rate. Adding a third drops the
separation to 9 bits (4 correctable errors) and risks wrong-entity matches. Do not add
more without re-running the hardware test.

Store `agent_id` as a **Number**, not a String — the code does integer XOR on it, and
string keys invite `"0"` vs `0` bugs.

### [FIX 3] `/generate` must embed at alpha=2.0

The original calls `embed_watermark("/tmp/polly_out.wav", agent_id)`, which uses the
default `alpha=1.0`. At 1.0 a re-recorded clip scored **0.2385** — below the 0.25
threshold, i.e. it fails. At 2.0 the same setup scored **0.4659**. Audio watermarked at
1.0 cannot be verified after re-recording, so the demo would break.

```python
embed_watermark(path, agent_id, alpha=2.0)
```

Inaudibility at 2.0 has been confirmed by measurement (23 dB below the speech) but is
still pending a listening check. If it turns out audible, that trade gets revisited —
coordinate before changing it.

### [FIX 4] `torch` is missing from requirements.txt — the build will fail

The original says "(torch/torchaudio come from the base image)". They do not.
`public.ecr.aws/lambda/python:3.11` is a minimal runtime image with no ML packages.
`audioseal` depends on torch and pip will pull the full CUDA build by default, which is
gigabytes of GPU libraries Lambda cannot use.

Pin the CPU-only wheel explicitly:

```
--extra-index-url https://download.pytorch.org/whl/cpu
torch
audioseal
julius
soundfile
numpy
boto3
```

`torchaudio` is not needed — `watermark.py` uses `soundfile` and `julius` instead.

### [FIX 5] `yum install -y ffmpeg` does not work on the Lambda base image

ffmpeg is not in Amazon Linux's default repositories. That line fails the build.

Simplest fix: drop ffmpeg entirely and have the **frontend** upload WAV. Browser
`MediaRecorder` produces webm/ogg, so Person 3 either converts client-side or the API
accepts only file uploads that are already wav.

If you do need server-side conversion, pull a static binary rather than a package:

```dockerfile
RUN curl -sL https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz \
    | tar -xJ --strip-components=1 -C /usr/local/bin --wildcards '*/ffmpeg'
```

Confirm the URL is still live at build time; if not, any static build on the image's
architecture works. Match the architecture to the Lambda (`--platform linux/amd64`
unless you are deploying arm64).

---

## Things the original plan got right — keep these

- Models initialized at module scope, outside the handler
- Model weights baked in at image build time, so cold starts don't time out
- `DETECTION_THRESHOLD = 0.25`, not AudioSeal's 0.5
- Sliding-window scan on `/verify` rather than scoring the whole upload
- "Detected but not in registry" renders as unverified
- Container image rather than zip
- Copying `watermark.py` into the Lambda build context to dodge the `ml-audio` hyphen

Copy the **current** `ml-audio/watermark.py` — it now contains `nearest_agent()` and
`pick_agent_ids()`, which the original plan predates.

---

## Missing pieces to add

### Lambda configuration

Not specified in the original, and the defaults will not work.

- **Memory: 3008 MB.** Lambda scales CPU with memory; torch inference on a 15 s clip is
  CPU-bound. Less memory means proportionally slower inference.
- **Timeout: 120 s.** A cold start loading torch plus the models takes tens of seconds.
- **Ephemeral storage:** default 512 MB is enough for `/tmp` audio, but raise it if you
  buffer large uploads.
- Expect a multi-GB image and a slow first invocation. Consider provisioned concurrency
  for the demo so the judge's first click isn't a 60 s wait.

### Which window's ID to trust

The plan says take "the best window confidence and its decoded ID". Measured caveat:
averaging soft bits across windows made accuracy *worse* (10/16 vs 11/16), and in the
passing run the whole-file decode was the one that landed at 3 errors.

Do this instead: compute the whole-file decode **and** the best-window decode, run both
through `nearest_agent`, and accept the first that resolves. Report the best-window
confidence to the user, since that is the one unaffected by silence padding.

### Polly output format

Polly does not return WAV. `OutputFormat="pcm"` returns headerless signed 16-bit
little-endian mono, which needs a RIFF header before `soundfile` can read it:

```python
import wave
with wave.open("/tmp/polly_out.wav", "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(16000)
    w.writeframes(audio_bytes)
```

16 kHz is what AudioSeal wants, so PCM at 16000 avoids a resample. **Verify the valid
`SampleRate` values for `pcm` against the Polly API reference before relying on this** —
I could not confirm them in this session, and mp3 and pcm support different sets.

### Binary uploads to `/verify`

Multipart parsing inside Lambda is fiddly and API Gateway caps payloads at ~10 MB
(Lambda synchronous invoke is 6 MB). Simpler and more robust: `/verify` issues a
presigned S3 PUT, the browser uploads directly, and the API then takes the S3 key.
Keeps big audio out of the request path entirely and reuses the bucket you already need.

If you keep direct upload, remember `isBase64Encoded` handling and enable binary media
types on the API.

### IAM scope

"DynamoDB + S3 + Polly + CloudWatch" should be scoped to the specific table ARN, bucket
ARN (both `bucket` and `bucket/*` — they are different resources), and `polly:Synthesize
Speech`. Avoid `Resource: "*"`, and do not attach `iam:PassRole` broadly.

---

## Answers to the open questions

**Region.** `ap-south-1` (Mumbai) — the users in the story are in India, and it keeps
the demo latency honest. Confirm Polly supports your chosen voice there; if not,
`us-east-1` is the safe fallback.

**Polly.** Stub it, as the original recommends. `/generate` should accept either
`text` (synthesize) or an uploaded wav, so Person 4 can slot Polly in without touching
infrastructure. Agreed with the original.

**Deployment tool.** The project's own guidance prefers infrastructure-as-code, and CDK
or CloudFormation gives you a clean teardown when the credits run low — worth it even
under time pressure. If you go with shell scripts, at minimum make them idempotent and
write down every resource created, so nothing is left running after the hackathon.

**Cost.** The team has $200 of credits total. A multi-GB container image, ECR storage
and a warm Lambda are the main draws. Set an AWS Budget alert before deploying, and
tear down when the demo is filmed.

---

## Verification plan

Replace the original's "clean watermarked wav → verified: true" with the test that
actually matters, since a clean wav passing proves nothing about the demo:

1. `/verify` with **`ml-audio/audio/demo_validate.wav`** → `verified: true`, entity
   "SecureBank AI Assistant"
2. `/verify` with a **phone re-recording** of that clip → same result. This is the only
   test that reflects the demo. Ask Person 1 for the recording already captured, or
   re-record one.
3. `/verify` with `ml-audio/audio/sample.wav` (no watermark) → `verified: false`,
   confidence below 0.01
4. `/verify` with audio watermarked at agent 2047 → resolves to the *other* entity, not
   SecureBank. Catches registry and nearest-match wiring bugs.
5. `/generate` with `agent_id=0` → returned audio, downloaded and passed back to
   `/verify`, resolves to agent 0. Closes the loop.

Test 2 is the one to run first. If it fails, nothing else matters.
