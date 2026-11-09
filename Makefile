.PHONY: help install dev dev-api dev-web dev-desktop dev-tui-rs build tauri-build test test-api test-web test-rust test-cov migrate migrate-new migrate-rollback lint format shell

API_DIR = apps/api
WEB_DIR = apps/web
TAURI_DIR = apps/web/src-tauri
ENGINE_RS_DIR = packages/engine-rs
TUI_RS_DIR = apps/tui-rs

help:
	@echo "NEIMAN — Autonomous Organization OS"
	@echo ""
	@echo "Usage:"
	@echo "  make install       Install all dependencies (API + Web)"
	@echo "  make dev           Start full stack (Docker Compose; requires POSTGRES_PASSWORD and SECRET_KEY)"
	@echo "  make dev-api       Start API only (local, hot-reload)"
	@echo "  make dev-web       Start Web only (local, hot-reload)"
	@echo "  make dev-desktop   Start Desktop app in Tauri with hot-reload"
	@echo "  make dev-tui-rs    Run native Rust TUI operator client"
	@echo "  make build         Build unified desktop application (Next.js + Tauri Release Binary)"
	@echo "  make tauri-build   Build production native desktop binary"
	@echo "  make test          Run all tests (API + Web + Rust)"
	@echo "  make test-rust     Run Rust unit and integration tests"
	@echo "  make test-api      Run API tests only"
	@echo "  make test-web      Run Web tests only"
	@echo "  make migrate       Run database migrations"
	@echo "  make migrate-new   Create new migration (usage: make migrate-new msg=\"description\")"
	@echo "  make migrate-rollback  Rollback last migration"
	@echo "  make lint          Run linters (API + Web)"
	@echo "  make format        Format code (API + Web)"


install:
	cd $(API_DIR) && uv sync --extra dev
	cd $(WEB_DIR) && npm ci

dev:
	docker compose up --build

dev-api:
	cd $(API_DIR) && uv run uvicorn nexora.main:app --reload --host 127.0.0.1 --port 8000

dev-web:
	cd $(WEB_DIR) && npm run dev

dev-desktop:
	./run-dev.sh

dev-tui-rs:
	cd $(TUI_RS_DIR) && cargo run

build:
	cd $(WEB_DIR) && npm run build:all

tauri-build:
	cd $(WEB_DIR) && npx @tauri-apps/cli build

test: test-api test-web test-rust

test-rust:
	cd $(TAURI_DIR) && cargo test
	cd $(ENGINE_RS_DIR) && cargo test
	cd $(TUI_RS_DIR) && cargo test


test-api:
	cd $(API_DIR) && uv run pytest tests/ -v --tb=short

test-web:
	cd $(WEB_DIR) && NODE_ENV=test npx jest

test-cov:
	cd $(API_DIR) && uv run pytest tests/ -v --tb=short --cov=nexora --cov-report=term-missing

migrate:
	cd $(API_DIR) && uv run alembic upgrade head

migrate-new:
	cd $(API_DIR) && uv run alembic revision --autogenerate -m "$(msg)"

migrate-rollback:
	cd $(API_DIR) && uv run alembic downgrade -1

lint:
	cd $(API_DIR) && uv run ruff check nexora/ tests/
	cd $(API_DIR) && uv run mypy nexora/
	cd $(WEB_DIR) && npm run lint
	cd $(WEB_DIR) && npm run type-check

format:
	cd $(API_DIR) && uv run ruff format nexora/ tests/
	cd $(API_DIR) && uv run ruff check --fix nexora/ tests/
	cd $(WEB_DIR) && npx prettier --write src/

shell:
	cd $(API_DIR) && uv run python -m asyncio
