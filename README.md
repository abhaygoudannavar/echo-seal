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
| Survives **real** speaker → phone-mic re-recording | **Not yet verified — needs hardware** |
| Backend, frontend, end-to-end | Not started |

That last watermarking row is the claim the demo rests on, and it has **not** been
confirmed. The numbers in `ml-audio/README.md` come from software simulation of the
acoustic path: band-limiting, room reverb, additive noise, codec round-trips.
Simulation does not capture real loudspeaker distortion, phone mic AGC, or actual room
acoustics. `ml-audio/test_rerecord.py` is the harness for the real test.

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
