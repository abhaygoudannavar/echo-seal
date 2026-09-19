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
| ID recovered via nearest-match on a 2-agent registry | Works on replayed bits; one end-to-end run still pending |
| Backend, frontend, end-to-end | Not started |

The re-recording rows are measured on a real phone, not simulated. Two findings
shaped the design:

**Recording the clip with iPhone spatial audio enabled destroys the watermark**
(confidence 0.0000). Spatial recording runs multi-mic beamforming and noise
suppression, which strips a signal sitting 29 dB below the speech. With spatial audio
off the same setup scored 0.2385, and at alpha 2.0 it reached 0.4659.

**Detection survives the air; the exact 16-bit ID does not.** 11 of 16 bits come
through (chance is 8), so `trust_registry` is matched by nearest Hamming distance
rather than exact equality — see `nearest_agent()`. That caps the registry at two
agents at the current error rate, which is why IDs must be chosen with
`pick_agent_ids()` rather than picked arbitrarily.

## What we are claiming

Surviving real telecom-grade phone compression is genuinely hard and we are not
claiming it. The scoped claim is narrower and demoable: the watermark survives
**speaker playback → phone microphone re-recording**, filmed live.

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
