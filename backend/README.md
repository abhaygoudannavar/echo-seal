# backend

Owner: Person 2.

- API Gateway + Lambda: `/generate` (Polly → watermark → S3) and `/verify` (upload → detect)
- Lambda packaged as a **container image**, not a zip — PyTorch won't fit in a zip
- DynamoDB `trust_registry` table: `agent_id` → entity name
- S3 bucket for audio

Read the "Notes for the backend" section of [../ml-audio/README.md](../ml-audio/README.md)
before wiring in the watermark functions. It covers baking the model weights into the
image (otherwise the first request times out), why `/verify` should score overlapping
windows rather than whole uploads, and why an ID that isn't in `trust_registry` must be
treated as unverified.
