SHELL := /bin/bash
PNPM := corepack pnpm

.PHONY: bootstrap setup dev lint typecheck test-unit test-contract test-integration test-e2e test-infra test-security build deploy evidence

bootstrap:
	corepack pnpm --version
	$(PNPM) install --frozen-lockfile

setup: bootstrap
	@test -f .env.local || cp .env.example .env.local
	@echo "Local fixture configuration ready. No Fire OS, companion, relay, or AWS service was started."

dev:
	$(PNPM) dev

lint:
	$(PNPM) lint

typecheck:
	$(PNPM) typecheck

test-unit:
	$(PNPM) test:unit

test-contract:
	$(PNPM) test:contract

test-security:
	$(PNPM) test:security

build:
	$(PNPM) build

test-integration:
	@echo "BLOCKED: native apps, signed bundle storage, and deployed relay integration are not implemented." >&2
	@exit 1

test-e2e:
	@echo "BLOCKED: actual Fire TV/simulator and companion E2E paths are not implemented." >&2
	@exit 1

test-infra:
	$(PNPM) test:infra

deploy:
	@echo "BLOCKED: deployment requires operator AWS/SAM preflight and explicit region/model parameters. See docs/backend-deployment.md." >&2
	@exit 1

evidence:
	@echo "Foundation only: no Fire TV, companion, family, learning, or release evidence. See docs/validation.md."

.PHONY: dev-compose test-local-services record-demo test-pages
# Explicitly local fixtures; native/deployed integration targets above remain blocked.
dev-compose:
	docker compose up --build --wait

test-local-services:
	$(PNPM) verify:local

record-demo:
	$(PNPM) record:demo

test-pages:
	$(PNPM) smoke:pages
