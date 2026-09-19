# EchoSeal Lambda — container image
#
# Build context MUST be the repo root (echo-seal/), not backend/, so that
# both backend/ and ml-audio/ are reachable by COPY instructions.
#
# From the repo root:
#   docker build --platform linux/amd64 -f backend/Dockerfile -t echoseal-lambda .
#
# Test:    docker run -e ECHOSEAL_LOCAL=1 -p 9000:8080 echoseal-lambda:latest
# Verify:  cd backend && python tests/test_local.py
#
# Must be built for linux/amd64 — Lambda's architecture. If you develop on
# Apple Silicon, --platform linux/amd64 is required or the torch wheels will
# be the wrong architecture.

FROM public.ecr.aws/lambda/python:3.11

# ── ffmpeg (optional, not needed for the demo) ───────────────────────────────
# /verify accepts WAV directly — soundfile reads it without ffmpeg.
# `yum install -y ffmpeg` fails (not in Amazon Linux repos), and `tar` is not
# present in this minimal base image so the static-binary approach also fails.
# If Person 3 later needs webm/m4a support, add before the curl step:
#   RUN yum install -y tar xz
# and then re-add the curl | tar pipeline below.

# ── System dependencies ───────────────────────────────────────────────────────
# libsndfile: soundfile (Python) is a ctypes wrapper around this C library.
# The Lambda base image doesn't ship it, but it IS in Amazon Linux's default
# repos (unlike ffmpeg), so yum works here.
RUN yum install -y libsndfile && yum clean all

# ── Python dependencies ───────────────────────────────────────────────────────
# Copied in before source so Docker can cache this layer independently.
COPY backend/lambda/requirements.txt ${LAMBDA_TASK_ROOT}/
RUN pip install --no-cache-dir -r ${LAMBDA_TASK_ROOT}/requirements.txt

# ── Lambda source ─────────────────────────────────────────────────────────────
COPY backend/lambda/handler.py    ${LAMBDA_TASK_ROOT}/
COPY backend/lambda/watermark.py  ${LAMBDA_TASK_ROOT}/

# Stub audio for LOCAL mode /generate testing (ml-audio/audio/sample.wav).
COPY ml-audio/audio/sample.wav ${LAMBDA_TASK_ROOT}/sample.wav

# ── Model weights ─────────────────────────────────────────────────────────────
# AudioSeal models (~300 MB total) are downloaded from HuggingFace on first use
# into /root/.cache/audioseal/. They are NOT baked into the image because large
# file downloads during `docker build` are unreliable (partial downloads corrupt
# the zip, causing PytorchStreamReader errors — observed in practice).
#
# For LOCAL testing: mount a named volume so models download once and persist:
#   docker run -v echoseal-model-cache:/root/.cache -e ECHOSEAL_LOCAL=1 ...
# First request takes ~3-5 min (model download). All subsequent requests are fast.
#
# For Lambda (Suhaan): use provisioned concurrency to pre-warm the function so
# the judge's first click isn't a 60-second cold start. The Lambda execution
# environment persists the /tmp cache across warm invocations.

CMD ["handler.lambda_handler"]
