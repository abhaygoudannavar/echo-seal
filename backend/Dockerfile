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
# Baked in at build time. This is not optional: a Lambda container filesystem is
# READ-ONLY except for /tmp, so a runtime download into ~/.cache cannot write at
# all — the function fails outright rather than merely running slowly. Even with
# a writable path, pulling ~300 MB inside a 120 s timeout on every cold start
# would not reliably finish.
#
# Downloading during build was previously avoided because a partial download
# corrupts the checkpoint (PytorchStreamReader errors). The retry below handles
# that: on failure it clears the cache and starts clean, then a final load
# outside the loop fails the build if the weights are still unusable, so a broken
# image can never reach ECR.
# AudioSeal's bundled moshi SEANet decorates forward() with @torch_compile_lazy,
# which invokes TorchInductor and shells out to a C++ compiler at RUNTIME. The Lambda
# image has no gcc, so /generate dies with BackendCompilerFailed. (/verify survives —
# the detector takes a different path.) It works on a dev Mac only because Xcode's
# clang is present. moshi reads this flag when the decorator is applied, i.e. at
# import time, so it has to be in the environment rather than set in Python.
# Eager mode is marginally slower per call and avoids a compile on every cold start.
ENV NO_TORCH_COMPILE=1

ENV AUDIOSEAL_CACHE_DIR=/opt/audioseal
RUN mkdir -p /opt/audioseal && cd ${LAMBDA_TASK_ROOT} && \
    for attempt in 1 2 3; do \
      echo "fetching model weights (attempt $attempt)" && \
      python -c "from watermark import _get_generator, _get_detector; _get_generator(); _get_detector()" \
        && break \
        || { echo "attempt $attempt failed; clearing cache"; rm -rf /opt/audioseal/*; sleep 5; }; \
    done && \
    python -c "from watermark import _get_generator, _get_detector; _get_generator(); _get_detector(); print('weights verified, loaded from cache')" && \
    du -sh /opt/audioseal

CMD ["handler.lambda_handler"]
