# NEIMAN — Autonomous Organization OS

> The AI-native platform for organizational intelligence and automation.

## Overview

NEIMAN is a full-stack platform that enables organizations to:

- Define operational workflows in natural language
- Delegate repetitive decisions to autonomous AI agents
- Surface real-time organizational intelligence into a unified interface
- Maintain full auditability of every AI-assisted action

## Architecture

```text
┌─────────────────────────────────────────────────────────┐
│                    NEIMAN Platform                       │
│                                                         │
│   ┌──────────────┐     ┌──────────────────────────┐     │
│   │   Frontend   │────▶│     API Gateway (HTTPS)  │     │
│   │  (Next.js)   │◀────│     + Rate Limiting       │     │
│   └──────────────┘     └──────────┬───────────────┘     │
│                                   │                      │
│              ┌────────────────────┼───────────────┐      │
│              │                    │               │      │
│      ┌───────▼──────┐  ┌─────────▼──────┐  ┌────▼───┐  │
│      │  Core API    │  │  Agent API      │  │ WS Hub │  │
│      │  (FastAPI)   │  │  (FastAPI)      │  │(async) │  │
│      └───────┬──────┘  └─────────┬──────┘  └────┬───┘  │
│              │                    │               │      │
│      ┌───────▼────────────────────▼───────────────┘      │
│      │              Service Layer                        │
│      └───────┬──────────────┬────────────────────────┐   │
│              │               │                        │   │
│      ┌───────▼──────┐  ┌───▼──────────┐               │
│      │  PostgreSQL  │  │  LanceDB     │               │
│      │ (SQLAlchemy) │  │ (embedded)   │               │
│      └──────────────┘  └──────────────┘               │
│                                                         │
│   ┌─────────────────────────────────────────────────┐   │
│   │           LLM Adapter Layer                      │   │
│   │   OpenAI | Anthropic | Gemini | Local (Ollama)   │   │
│   └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## Tech Stack

### Backend (API)

- **Framework**: FastAPI (Python 3.11+)
- **Database**: PostgreSQL 16 via SQLAlchemy; SQLite is also supported for development
- **Semantic memory**: embedded LanceDB with FastEmbed; Redis is present in Compose for infrastructure checks, but no Redis-backed cache or job queue is wired into the API
- **ORM**: SQLAlchemy 2.0 + Alembic
- **Auth**: JWT using the configured `ALGORITHM` (HS256 by default); do not assume refresh-token rotation without verifying the implementation
- **Validation**: Pydantic v2
- **Logging**: structlog
- **Testing**: pytest + pytest-asyncio + httpx

### Frontend (Web)

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State**: TanStack Query + Zustand
- **Forms**: React Hook Form + Zod
- **Charts**: Recharts
- **Testing**: Jest + React Testing Library
- **Components**: Storybook

### Infrastructure

- **Containerization**: Docker (multi-stage builds)
- **Orchestration**: Docker Compose for local development; production orchestration is deployment-specific
- **CI/CD**: GitHub Actions workflows are present; deployment behavior depends on workflow configuration

## Project Structure

```text
NEIMAN/
├── .github/
│   └── workflows/          # CI/CD pipelines
├── apps/
│   ├── api/                # FastAPI backend
│   │   ├── nexora/         # FastAPI application and domain modules
│   │   │   ├── domains/    # Agents, auth, governance, memory, projects, workflows, etc.
│   │   │   ├── core/       # Shared models, security, permissions, runtime
│   │   │   └── main.py     # API application entry point
│   │   ├── tests/          # API tests (coverage must be verified by running them)
│   │   ├── alembic/        # Database migrations
│   │   ├── Dockerfile
│   │   └── pyproject.toml
│   └── web/                # Next.js frontend
│       ├── src/
│       │   ├── app/        # App Router pages
│       │   ├── components/ # React components
│       │   ├── hooks/      # Custom hooks
│       │   ├── lib/        # Utilities
│       │   ├── store/      # Zustand stores
│       │   └── types/      # TypeScript types
│       ├── Dockerfile
│       └── package.json
├── apps/tui-rs/            # Rust keyboard-driven operator TUI
├── packages/engine-rs/     # Shared Rust engine crate
├── docker-compose.yml
├── Makefile
└── README.md
```

## Quick Start & Installation

### Option 1: Native Workstation Installation (Recommended for Local Use)

Install NEIMAN directly into your Linux desktop environment with one command:

```bash
# Clone the repository
git clone https://github.com/Aomine-c2c/Sila.git neiman
cd neiman

# Run the installer
./scripts/install.sh
```

This automatically:

1. Installs the **NEIMAN** desktop launcher into your system application menu (`~/.local/share/applications/neiman.desktop`).
2. Configures the custom cyber-obsidian application icon across system icon themes.
3. Installs the global CLI launcher (`neiman`) into `~/.local/bin/neiman`.
4. Installs the automated GitHub updater (`neiman-update`) into `~/.local/bin/neiman-update`.
5. Pre-configures local SQLite storage and migrations. Authentication is enabled by default; create or sign in to an operator account.

#### Launching the App

- **From App Launcher**: Search for **NEIMAN** in your system application menu.
- **From Terminal**:

  ```bash
  neiman
  ```

- **From Source**:

  ```bash
  ./run-desktop.sh
  ```

#### Pulling Updates from GitHub

To pull new updates, apply latest database migrations, and rebuild the application:

```bash
neiman-update
```

---

### Option 2: Running via Docker

```bash
# Start all containerized services
docker-compose up --build
```

Services will be available at:

- **Web Console**: <http://localhost:3000>
- **API Documentation**: <http://localhost:8000/api/docs>
- **Health Check**: <http://localhost:8000/health>
- **API**: <http://localhost:8000>
- **API Docs**: <http://localhost:8000/api/docs>

### Local Development

#### Backend

```bash
cd apps/api
uv sync --extra dev
cp .env.example .env  # Edit with your values
make migrate
make dev-api
```

#### Frontend

```bash
cd apps/web
npm ci
cp .env.example .env.local  # Edit with your values
npm run dev
```

#### Desktop App (Tauri)

```bash
# Run desktop app with automatic API orchestration & hot-reload:
make dev-desktop

# Or directly via the runner script:
./scripts/run-desktop.sh

# Build native production desktop binary:
make tauri-build
```

## Available Commands

```bash
make help           # Show all commands
make install        # Install all dependencies
make dev            # Start full stack (Docker)
make dev-api        # Start API only (hot reload)
make dev-web        # Start Web only (hot reload)
make test           # Run all tests
make test-api       # Run API tests only
make test-web       # Run Web tests only
make migrate        # Run database migrations
make migrate-new msg="description"  # Create new migration
make lint           # Run all linters
make format         # Format all code
```

## API Domains

| Domain | Description | Endpoints |
| --- | --- | --- |
| **Auth** | Authentication & authorization | `/api/v1/auth/*` |
| **Organizations** | Companies, departments, roles, DNA | `/api/v1/companies/*` |
| **Agents** | Agent lifecycle, execution, hierarchy | `/api/v1/companies/{id}/agents/*` |
| **Workflows** | Workflow definitions & executions | `/api/v1/companies/{id}/workflows/*` |
| **Councils** | Agent councils & deliberations | `/api/v1/companies/{id}/councils/*` |
| **Governance** | Approvals, escalations, constitution | `/api/v1/companies/{id}/governance/*` |
| **Decisions** | Decision records & outcomes | `/api/v1/companies/{id}/decisions/*` |
| **Intelligence** | Multi-provider LLM routing | `/api/v1/companies/{id}/intelligence/*` |
| **Memory** | Organizational memory & search | `/api/v1/companies/{id}/memory/*` |
| **Resources** | Budget pools & allocations | `/api/v1/companies/{id}/resources/*` |
| **Policies** | Policy engine & versioning | `/api/v1/companies/{id}/policies/*` |
| **Projects** | Projects, tasks, milestones | `/api/v1/companies/{id}/projects/*` |
| **Blueprints** | Company templates | `/api/v1/companies/{id}/blueprints/*` |

## UI Routes

| Route | Description |
| --- | --- |
| `/dashboard` | Main dashboard with stats & activity |
| `/organizations` | Company & department management |
| `/agents` | Agent browser & configuration |
| `/workflows` | Workflow designer & observability |
| `/councils` | Council deliberation viewer |
| `/memory` | Knowledge base & search |
| `/governance` | Approvals, escalations, audit |
| `/resources` | Resource control center |
| `/blueprints` | Company blueprints & templates |
| `/settings` | Organization settings |

## Key Features Implemented

### Workflow Engine

- Sequential & parallel execution
- Conditional branching
- Human-in-the-loop approval gates
- Resource request evaluation
- Retries with backoff & timeouts
- Full state persistence & observability

### Agent Councils & Deliberation

- Multi-agent councils with heterogeneous models
- Structured deliberation: Proposal → Review → Objections → Discussion → Synthesis → Decision
- Dissent recording as organizational knowledge
- Decision ratification & memory integration

### Agent Execution Lifecycle

- 10-step execution: Context Assembly → Plan → Resource Check → Intelligence Selection → Tool Execution → Result → Validation → Report → Memory Update
- Policy enforcement at each step
- Budget & rate limiting per agent
- Full audit trail

### Organizational Memory

- 10 memory domains (Company, Department, Agent, Project, Customer, Decision, Policy, Experiment, Failure, Knowledge Base)
- Permission-aware context assembly
- Decision records with lessons learned
- Vector similarity search

### Resource Engine

- Priority-based allocation (Critical → Background)
- Request evaluation: Approve / Deny / Defer / Reduce / Queue
- Budget tracking with observed vs estimated telemetry
- Real-time capacity monitoring

## Testing

```bash
# API tests (100 tests)
cd apps/api
uv run pytest tests/ -v

# Web tests
cd apps/web
npm test

# All tests
make test
```

## Deployment

### Staging (Auto on main branch)

```bash
# Triggered automatically on push to main
# Deploys to staging environment
```

### Production (On version tags)

```bash
git tag v0.1.0
git push origin v0.1.0
# Triggers production deployment
```

## Environment Variables

### API (`apps/api/.env`)

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | No | Redis health-check target; current API does not use Redis for cache or job processing |
| `SECRET_KEY` | Yes | JWT signing key; production requires a unique key of at least 32 characters |
| `OPENAI_API_KEY` | No | OpenAI API key |
| `ANTHROPIC_API_KEY` | No | Anthropic API key |
| `GOOGLE_API_KEY` | No | Google AI API key |

### Web (`apps/web/.env.local`)

| Variable | Required | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | No | Optional API destination for the Next.js `/api` rewrite; defaults to `http://localhost:8000` |
| `NEXT_PUBLIC_APP_NAME` | No | App display name |

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `make lint` and `make test`
5. Submit a PR

## License

Proprietary — All rights reserved.
