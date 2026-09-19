# EchoSeal Backend Makefile
# Region is hard-coded to ap-south-1 — do not rely on AWS_DEFAULT_REGION.
#
# Ownership split:
#   YOU  (local, no AWS):  make build  make test-local
#   SUHAAN (AWS access):   make ecr make push make infra make deploy make seed make all

REGION     := ap-south-1
STACK      := echoseal-backend
IMAGE      := echoseal-lambda
# Build context is the repo root so both backend/ and ml-audio/ are reachable.
REPO_ROOT  := ..
DOCKERFILE := backend/Dockerfile

# These require AWS credentials — only Suhaan runs targets that use them.
ACCOUNT_ID := $(shell aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "NO_CREDENTIALS")
ECR_URI    := $(ACCOUNT_ID).dkr.ecr.$(REGION).amazonaws.com/$(IMAGE)

.PHONY: build test-local ecr push infra deploy seed all teardown help

# ── Local (no AWS needed) ─────────────────────────────────────────────────────

## build: Build the Lambda container image (linux/amd64).
##        First run downloads ~300 MB of model weights — subsequent builds use cache.
##        Run from backend/ — context is repo root so ml-audio/ is reachable.
build:
	docker build --platform linux/amd64 -f $(DOCKERFILE) -t $(IMAGE):latest $(REPO_ROOT)

## test-local: Build image, start container with ECHOSEAL_LOCAL=1, run test suite.
test-local: build
	@echo "\n── Starting local container ──"
	@docker stop echoseal-local 2>NUL; exit 0
	docker run -d --rm --name echoseal-local \
	  -e ECHOSEAL_LOCAL=1 \
	  -p 9000:8080 \
	  $(IMAGE):latest
	@echo "Waiting for RIE to be ready..."
	@timeout /t 4 >NUL 2>&1 || sleep 4
	@echo "\n── Running test suite ──"
	python tests/test_local.py; \
	docker stop echoseal-local

## test-rerecord: Run test suite with a phone re-recording (set ECHOSEAL_RERECORD=<path>).
test-rerecord: build
	@if "$(ECHOSEAL_RERECORD)"=="" ( \
	  echo "Set ECHOSEAL_RERECORD=<path to recording.wav> first"; exit 1 )
	@docker stop echoseal-local 2>NUL; exit 0
	docker run -d --rm --name echoseal-local \
	  -e ECHOSEAL_LOCAL=1 \
	  -p 9000:8080 \
	  $(IMAGE):latest
	@timeout /t 4 >NUL 2>&1 || sleep 4
	ECHOSEAL_RERECORD=$(ECHOSEAL_RERECORD) python tests/test_local.py; \
	docker stop echoseal-local

# ── AWS (Suhaan runs these) ───────────────────────────────────────────────────

## ecr: Create the ECR repository (run once — idempotent on subsequent runs).
ecr:
	aws ecr describe-repositories --repository-names $(IMAGE) --region $(REGION) 2>NUL || \
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
	@echo "\nStack outputs:"
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
	python infra/seed_registry.py --region $(REGION)

## all: Full first-time deploy: push image → create infra → seed registry.
all: push infra seed
	@echo "\n✓ EchoSeal is live. API URL:"
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
	@if "$(BUCKET)" NEQ "" ( \
	  aws s3 rm s3://$(BUCKET) --recursive --region $(REGION) )
	aws cloudformation delete-stack --stack-name $(STACK) --region $(REGION)
	@echo "Stack deletion initiated. Monitor at:"
	@echo "  https://ap-south-1.console.aws.amazon.com/cloudformation"

help:
	@grep -E '^## ' Makefile | sed 's/## //'
