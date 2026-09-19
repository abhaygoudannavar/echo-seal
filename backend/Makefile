# EchoSeal Backend Makefile
# Region is hard-coded to ap-south-1 — do not rely on AWS_DEFAULT_REGION.
#
# Ownership split:
#   YOU  (local, no AWS):  make build  make test-local
#   SUHAAN (AWS access):   make ecr make push make infra make deploy make seed make all

REGION     := ap-south-1
# python3 on macOS/Linux; override with `make PYTHON=python` on Windows.
PYTHON     ?= python3
STACK      := echoseal-backend
IMAGE      := echoseal-lambda
# Build context is the repo root so both backend/ and ml-audio/ are reachable.
REPO_ROOT  := ..
# -f is resolved relative to the working directory (here: backend/), NOT to the build
# context. "backend/Dockerfile" would look for backend/backend/Dockerfile and fail.
DOCKERFILE := Dockerfile

# These require AWS credentials — only Suhaan runs targets that use them.
ACCOUNT_ID := $(shell aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "NO_CREDENTIALS")
ECR_URI    := $(ACCOUNT_ID).dkr.ecr.$(REGION).amazonaws.com/$(IMAGE)

.PHONY: build test-local ecr push infra deploy seed all teardown help

# ── Local (no AWS needed) ─────────────────────────────────────────────────────

## build: Build the Lambda container image (linux/amd64).
##        First run downloads ~300 MB of model weights — subsequent builds use cache.
##        Run from backend/ — context is repo root so ml-audio/ is reachable.
# --provenance=false: BuildKit otherwise emits an OCI manifest list with an
# attestation manifest attached, and Lambda rejects it with "The image manifest,
# config or layer media type for the source image is not supported." Lambda needs a
# plain Docker v2 schema 2 manifest. The image builds and runs locally either way, so
# this only shows up at stack-create time.
build:
	docker build --provenance=false --platform linux/amd64 -f $(DOCKERFILE) -t $(IMAGE):latest $(REPO_ROOT)

## test-local: Build image, start container with ECHOSEAL_LOCAL=1, run test suite.
test-local: build
	@printf '\n── Starting local container ──\n'
	-@docker stop echoseal-local 2>/dev/null
	docker run -d --rm --name echoseal-local \
	  -e ECHOSEAL_LOCAL=1 \
	  -p 9000:8080 \
	  $(IMAGE):latest
	@echo "Waiting for RIE to be ready..."
	@sleep 4
	@printf '\n── Running test suite ──\n'
	$(PYTHON) tests/test_local.py; \
	docker stop echoseal-local

## test-rerecord: Run test suite with a phone re-recording (set ECHOSEAL_RERECORD=<path>).
test-rerecord: build
	@if [ -z "$(ECHOSEAL_RERECORD)" ]; then \
	  echo "Set ECHOSEAL_RERECORD=<path to recording.wav> first"; exit 1; \
	fi
	-@docker stop echoseal-local 2>/dev/null
	docker run -d --rm --name echoseal-local \
	  -e ECHOSEAL_LOCAL=1 \
	  -p 9000:8080 \
	  $(IMAGE):latest
	@sleep 4
	ECHOSEAL_RERECORD=$(ECHOSEAL_RERECORD) $(PYTHON) tests/test_local.py; \
	docker stop echoseal-local

# ── AWS (Suhaan runs these) ───────────────────────────────────────────────────

## ecr: Create the ECR repository (run once — idempotent on subsequent runs).
ecr:
	aws ecr describe-repositories --repository-names $(IMAGE) --region $(REGION) >/dev/null 2>&1 || \
	aws ecr create-repository --repository-name $(IMAGE) --region $(REGION)

## push: Log in to ECR, tag the local image, and push it.
push: ecr build
	aws ecr get-login-password --region $(REGION) | \
	  docker login --username AWS --password-stdin $(ACCOUNT_ID).dkr.ecr.$(REGION).amazonaws.com
	docker tag $(IMAGE):latest $(ECR_URI):latest
	docker push $(ECR_URI):latest
	@echo "Pushed: $(ECR_URI):latest"

## infra: Deploy (or update) the CloudFormation stack.
##        Requires ImageUri because Lambda needs a container image to create the function.
##        Run `make push` first.
infra:
	aws cloudformation deploy \
	  --template-file infra/template.yaml \
	  --stack-name $(STACK) \
	  --capabilities CAPABILITY_NAMED_IAM \
	  --region $(REGION) \
	  --parameter-overrides ImageUri=$(ECR_URI):latest \
	  --no-fail-on-empty-changeset
	@printf '\nStack outputs:\n'
	@aws cloudformation describe-stacks \
	  --stack-name $(STACK) \
	  --region $(REGION) \
	  --query "Stacks[0].Outputs" \
	  --output table

## deploy: Push a new image and update the Lambda function code.
##         Use this for code-only changes after the first `make infra`.
deploy: push
	aws lambda update-function-code \
	  --function-name echoseal-api \
	  --image-uri $(ECR_URI):latest \
	  --region $(REGION)
	@echo "Waiting for Lambda update to complete..."
	aws lambda wait function-updated \
	  --function-name echoseal-api \
	  --region $(REGION)
	@echo "Deploy complete."

## seed: Seed trust_registry with demo entries (agent_id=0 and agent_id=2047).
##       Run after `make infra`. Safe to re-run (put_item is idempotent).
seed:
	$(PYTHON) infra/seed_registry.py --region $(REGION)

## all: Full first-time deploy: push image → create infra → seed registry.
all: push infra seed
	@printf '\n✓ EchoSeal is live. API URL:\n'
	@aws cloudformation describe-stacks \
	  --stack-name $(STACK) \
	  --region $(REGION) \
	  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
	  --output text

## teardown: Delete the CloudFormation stack and all resources.
##           Empty the S3 bucket first or the stack deletion will fail.
teardown:
	@echo "Emptying S3 bucket before stack deletion..."
	$(eval BUCKET := $(shell aws cloudformation describe-stacks \
	  --stack-name $(STACK) --region $(REGION) \
	  --query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" \
	  --output text 2>/dev/null))
	@if [ -n "$(BUCKET)" ] && [ "$(BUCKET)" != "None" ]; then \
	  aws s3 rm s3://$(BUCKET) --recursive --region $(REGION); \
	else \
	  echo "  no bucket found in stack outputs — skipping"; \
	fi
	aws cloudformation delete-stack --stack-name $(STACK) --region $(REGION)
	@echo "Stack deletion initiated. Monitor at:"
	@echo "  https://ap-south-1.console.aws.amazon.com/cloudformation"

help:
	@grep -E '^## ' Makefile | sed 's/## //'
