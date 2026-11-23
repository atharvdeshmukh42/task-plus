# Local development runs natively; only PostgreSQL runs in Docker (start it once with `make db`).
.PHONY: help setup db db-stop migrate seed api web mobile test check deploy

help:
	@grep -E "^[a-z-]+:.*?## " $(MAKEFILE_LIST) | awk -F ":.*?## " "{printf \"  %-9s %s\\n\", \$$1, \$$2}"

setup: ## Install backend, web and mobile dependencies
	cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
	cd web && npm install
	cd mobile && npm install

db: ## Start PostgreSQL in Docker and leave it running
	docker compose -f docker-compose.dev.yml up -d --wait

db-stop: ## Stop the dev PostgreSQL container (data is kept)
	docker compose -f docker-compose.dev.yml stop

migrate: ## Apply database migrations
	cd backend && .venv/bin/alembic upgrade head

seed: ## Create the demo organization (add ARGS=--reset to recreate it)
	cd backend && .venv/bin/python -m app.seed $(ARGS)

api: ## Run the API with reload on :8000 (reachable from phones on your network)
	cd backend && .venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

web: ## Run the web app on :5173
	cd web && npm run dev

mobile: ## Start Expo for the employee app
	cd mobile && npx expo start

test: ## Backend tests
	cd backend && .venv/bin/pytest

check: test ## Tests plus web build, lint and mobile typecheck/lint
	cd web && npm run lint && npm run build
	cd mobile && npx tsc --noEmit && npx expo lint

deploy: ## Build and start the full stack with Docker (needs .env)
	docker compose up -d --build
