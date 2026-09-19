# backend — Person 2

Lambda + API Gateway + DynamoDB + S3 for EchoSeal.

## Ownership split

| Who | What |
|---|---|
| **You** | Write code, build locally, run `make build` + `make test-local` |
| **Suhaan** | Has AWS credentials, runs `make push infra seed` to deploy |

You do not need AWS credentials. The container runs entirely locally with `ECHOSEAL_LOCAL=1`.

---

## File layout

```
backend/
  Dockerfile              container image (PyTorch CPU, audioseal, static ffmpeg)
  Makefile                build / test / deploy targets
  lambda/
    handler.py            /generate and /verify Lambda handler
    watermark.py          copy of ml-audio/watermark.py (avoids hyphen import bug)
    requirements.txt      CPU-only torch + audioseal + boto3
  infra/
    template.yaml         CloudFormation stack (DynamoDB, S3, IAM, Lambda, API GW)
    seed_registry.py      seed demo entries into trust_registry
  tests/
    test_local.py         5-test verification suite (no AWS needed)
```

---

## Local build and test (no AWS credentials needed)

```bash
cd backend

# Build the image. First run downloads ~300 MB of model weights.
# Subsequent runs use the Docker layer cache.
docker build --platform linux/amd64 -t echoseal-lambda .

# Start the container with local stubs
docker run -d --rm --name echoseal-local \
  -e ECHOSEAL_LOCAL=1 \
  -p 9000:8080 \
  echoseal-lambda:latest

# Run the test suite
python tests/test_local.py

# Or one-shot via make
make test-local
```

### Quick manual curl check

```bash
# /generate — watermark a clip
curl -s -X POST http://localhost:9000/2015-03-31/functions/function/invocations \
  -H "Content-Type: application/json" \
  -d '{
    "rawPath": "/generate",
    "requestContext": {"http": {"method": "POST"}},
    "headers": {"content-type": "application/json"},
    "body": "{\"agent_id\": 0, \"text\": \"Hello from SecureBank\"}",
    "isBase64Encoded": false
  }' | python -m json.tool

# /verify — check a file (replace <base64> with actual base64-encoded WAV)
curl -s -X POST http://localhost:9000/2015-03-31/functions/function/invocations \
  -H "Content-Type: application/json" \
  -d "{
    \"rawPath\": \"/verify\",
    \"requestContext\": {\"http\": {\"method\": \"POST\"}},
    \"headers\": {\"content-type\": \"application/json\"},
    \"body\": \"{\\\"wav_base64\\\": \\\"<base64>\\\"}\"
  }" | python -m json.tool
```

### Test with the phone re-recording

```bash
# Set path to the recording, then run
$env:ECHOSEAL_RERECORD = "C:\path\to\recording.wav"
make test-rerecord
```

---

## Deploy (Suhaan runs these)

### Prerequisites

- `aws configure` done with ap-south-1 as default region
- Docker installed and running
- Python 3.10+ with `boto3` installed

### First-time deploy

```bash
cd backend
make all        # push image → create infra → seed registry
```

This runs:
1. `make ecr` — creates the ECR repository
2. `make push` — builds the image and pushes to ECR
3. `make infra` — deploys the CloudFormation stack (DynamoDB, S3, Lambda, API GW)
4. `make seed` — seeds `trust_registry` with agent_id=0 and agent_id=2047

**Budget alert**: Set a billing alert before running this. The main costs are ECR storage (~$0.10/GB/month for the multi-GB image) and Lambda invocations. Everything should be torn down after the demo.

### Code-only updates (after first deploy)

```bash
make deploy     # push new image → update Lambda function code only
```

### Tear down when done

```bash
make teardown   # empties S3 bucket, then deletes the CloudFormation stack
```

### Get the API URL

```bash
aws cloudformation describe-stacks \
  --stack-name echoseal-backend \
  --region ap-south-1 \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
  --output text
```

Give this URL to Person 3 (frontend) and Person 4 (demo).

---

## API reference

### POST /generate

Generate watermarked speech.

**Request body (JSON):**
```json
{
  "agent_id": 0,
  "text": "Hello, this is SecureBank calling.",
  "voice_id": "Aditi"
}
```

Or bypass Polly (Person 4 testing):
```json
{
  "agent_id": 0,
  "wav_base64": "<base64-encoded WAV>"
}
```

**Response:**
```json
{
  "audio_url": "https://...",
  "agent_id": 0,
  "entity_name": "SecureBank AI Assistant"
}
```

### POST /verify

Check whether audio carries a registered watermark.

**Request body (JSON):**
```json
{
  "wav_base64": "<base64-encoded WAV>"
}
```

Or with an S3 key (after direct browser upload via presigned PUT):
```json
{
  "s3_key": "audio/agent_0/upload.wav"
}
```

**Response — verified:**
```json
{
  "verified": true,
  "entity_name": "SecureBank AI Assistant",
  "agent_id": 0,
  "confidence": 0.6961
}
```

**Response — not verified:**
```json
{
  "verified": false,
  "entity_name": null,
  "agent_id": null,
  "confidence": 0.0031
}
```

---

## Trust registry

The demo registry has exactly two agents — the hard ceiling at the current measured
bit-error rate of 3–5 bits per re-recording:

| agent_id | entity_name | Notes |
|---|---|---|
| 0 | SecureBank AI Assistant | Primary demo agent |
| 2047 | Example Telecom Support | Secondary demo agent |

IDs are 11 bits apart in Hamming distance (from `pick_agent_ids(2, min_distance=11)`).
This absorbs up to 5 bit errors while keeping the two agents distinguishable. Do not
add a third agent or change the IDs without re-running the hardware test.

---

## Key implementation notes

These are the fixes applied from the 2026-09-19 hardware-validated plan. Do not revert them.

| # | Fix | Why |
|---|---|---|
| FIX 1 | Nearest Hamming distance lookup, not exact `get_item` | Re-recording corrupts 3–5 bits — exact lookup misses 100% of the time |
| FIX 2 | Registry IDs are 0 and 2047, stored as Number (N) | 1337/42 are only 5 bits apart — wrong-entity matches at the demo |
| FIX 3 | `embed_watermark(..., alpha=2.0)` | alpha=1.0 scores 0.2385 after re-recording (below 0.25 threshold); 2.0 scores 0.4659 |
| FIX 4 | CPU-only torch wheel in requirements.txt | Base Lambda image has no ML packages; default pip pull is CUDA (~2.5 GB) |
| FIX 5 | Static ffmpeg binary, not `yum install` | ffmpeg is not in Amazon Linux's default repos; yum install fails the build |

`DETECTION_THRESHOLD = 0.25` in watermark.py — do not change it back to AudioSeal's
default 0.5. Every re-recorded clip fails at 0.5.
