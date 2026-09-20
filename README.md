# EchoSeal

Check whether an AI voice on a call is genuinely who it claims to be.

A legitimate AI voice agent (a bank's automated assistant, say) speaks through Amazon
Polly. Before the audio goes out, we embed an inaudible 16-bit ID into it using
[AudioSeal](https://github.com/facebookresearch/audioseal). Anyone who receives that
call, or a recording of it, can run it through the verifier: if the watermark is found
and the ID matches a registered entity, they get `Verified: SecureBank AI Assistant`.
If not, they get `Unverified — this may not be a legitimate AI agent`.

Built for the WeMakeDevs "First Commit" AWS hackathon. The problem it targets is
cloned-voice scams — fake bank calls, fake relatives in distress — which are a live
and growing problem for Indian phone users.

## Repo layout

```
ml-audio/     watermark embed + verify (AudioSeal)        Person 1
backend/      Lambda, API Gateway, DynamoDB, S3           Person 2
frontend/     Amplify-hosted web app                      Person 3
demo/         end-to-end tests, demo video, writeup       Person 4
```

Each folder has its own README with setup and ownership. Dependencies are per-folder —
there is no root-level install.

## Architecture

| Piece | Tool |
|---|---|
| Voice generation | Amazon Polly |
| Watermark embed/detect | AudioSeal, 16-bit ID per agent |
| Trust registry | DynamoDB (`trust_registry`: agent_id → entity name) |
| API | API Gateway + Lambda (`/generate`, `/verify`), container image |
| Audio storage | S3 |
| Frontend | Amplify Hosting — Agent Console + Verify a Call |

Lambda ships as a container image rather than a zip because PyTorch won't fit in a zip.

## Status

| Piece | State |
|---|---|
| Embed + detect, clean audio | Working — confidence 1.0000, ID decodes exactly |
| ID round-trip across full 0–65535 range | Working — exact on every value tested |
| Rejects non-watermarked audio | Working — scores ≤0.008, never false-positives |
| Survives codecs (MP3, Opus, telephone ADPCM) | Working |
| **Detected** after real speaker → phone-mic re-recording | Working at alpha 2.0 — 0.4659 whole-file, 0.7074 best window |
| **Exact ID** recovered after re-recording | Fails — 11/16 bits survive, so exact lookup misses |
| ID recovered via nearest-match on a 2-agent registry | **Verified end to end** — 0.6961 confidence, 3/16 bit errors, correct entity |
| Backend deployed (Lambda, API Gateway, DynamoDB, S3) | **Live** |
| Frontend deployed (Next.js static export on Amplify) | **Live** |
| Browser recording → verify, end to end | **Working** |

The re-recording rows are measured on a real phone, not simulated. Two findings
shaped the design:

**Recording the clip with iPhone spatial audio enabled destroys the watermark**
(confidence 0.0000). Spatial recording runs multi-mic beamforming and noise
suppression, which strips a signal sitting 29 dB below the speech. With spatial audio
off the same setup scored 0.2385, and at alpha 2.0 it reached 0.4659.

**Detection survives the air; the exact 16-bit ID does not.** Only 11 to 13 of 16 bits
come through (chance is 8), so `trust_registry` is matched by nearest Hamming distance
rather than exact equality — see `nearest_agent()`. That caps the registry at two
agents at the observed error rate, which is why IDs must be chosen with
`pick_agent_ids()` rather than picked arbitrarily.

The full loop has been run end to end: watermarked speech played through a laptop
speaker, recorded on a phone 15-30 cm away with spatial audio off, detected at 0.6961
confidence with 3 of 16 bits corrupted, and resolved to the correct registered entity.
That leaves 2 bits of margin against the 5-error budget, so recording conditions still
matter — alpha 2.0, spatial audio off, phone close, volume up.

## Live

- Site: https://main.d2ylqawe7qumqu.amplifyapp.com
- API: `https://mzvlf6prc2.execute-api.ap-south-1.amazonaws.com` (`/generate`, `/verify`)

Pushing to `main` rebuilds and redeploys the frontend automatically.

## Three things that destroy the watermark

Every one of them is a feature designed to clean up speech, and every one treats an
inaudible mark as noise to remove. Finding them was most of the work.

| Processing | Effect |
|---|---|
| iPhone spatial audio recording | Confidence 0.0000, watermark gone entirely |
| Browser `getUserMedia` defaults (noise suppression, echo cancellation, AGC) | Watermark stripped during capture |
| macOS echo cancellation, same device playing and recording | 0.005 to 0.025, unusable |

A Mac cancels its own speaker output out of its own microphone, so same-device
capture cannot work at all. Verification needs two devices.

Clipping is the other killer: a capture pinned at full scale still detects at 0.55 but
loses 9 of 16 ID bits, which reads as a failure for a different reason.

## What we are claiming

Surviving real telecom-grade phone compression is genuinely hard and we are not
claiming it. The scoped claim is narrower, demoable, and now measured: the watermark
survives **speaker playback → phone microphone re-recording** and still resolves to the
right registered entity.

What we do not claim: detecting AI-generated voices in general. An unwatermarked clip
could be a human, a scammer, or a legitimate agent that has not adopted EchoSeal. This
verifies known callers; it does not identify fakes.

## Getting started

The watermarking module is the only part with code so far:

```bash
cd ml-audio
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

See [ml-audio/README.md](ml-audio/README.md) for the API, measured results, and the
integration notes the backend needs.

AudioSeal is MIT licensed (Meta).
