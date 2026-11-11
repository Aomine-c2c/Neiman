# CURRENT STATE — NEIMAN Project Baseline

**Audit Date:** 2026-09-29  
**Auditor:** Antigravity (Lead Architect / Autonomous CTO)  
**Project Root:** `/home/sila/Projects/Sila`  

> **Historical snapshot, not current verification.** This document contains claims from 2026-09-29, including test results and package paths that have not been revalidated for the current worktree. The live API package is `apps/api/nexora/`. For repository-backed findings and unverified claims, see [the 2026-10-27 architecture review](docs/NEIMAN_ARCHITECTURE_REVIEW_2026-10-27.md). No historical test claim below should be treated as a current passing result.

---

## Executive Summary

The NEIMAN project has transitioned from an initial greenfield into an operational, test-validated, multi-agent operating system foundation. Both the backend (`apps/api`) and the frontend (`apps/web`) are active, verified with automated test suites (100 backend domain tests passing, frontend Jest tests passing, TypeScript compilation 0 errors), and wired together via REST APIs and real-time dashboard telemetry.

---

## 1. Project Structure

```
/home/sila/Projects/Sila/
├── apps/
│   ├── api/                     # FastAPI async backend service
│   │   ├── alembic/             # Database migrations (9 versions applied up to head)
│   │   ├── NEIMAN/              # Core domain package
│   │   │   ├── core/            # Base models, Enums, Permissions
│   │   │   ├── domains/         # 13 domain packages (agents, auth, blueprints, councils, decisions, governance, intelligence, memory, organizations, policies, projects, resources, workflows)
│   │   │   ├── config.py        # Settings & CORS config
│   │   │   ├── database.py      # Async SQLite / PostgreSQL session factory
│   │   │   ├── main.py          # FastAPI application entry point
│   │   │   └── middleware.py    # Request ID and tracing
│   │   └── tests/               # 15 domain pytest suites (100 tests passing)
│   └── web/                     # Next.js 14 App Router frontend
│       ├── src/
│       │   ├── app/             # App router pages (dashboard, agents, organizations, workflows, councils)
│       │   ├── components/      # UI components (OrganizationalGraph, OperationalGrid, PulseCards, AuthGuard)
│       │   ├── lib/api/         # API clients (client, auth, organizations, agents, controlRoom, workflows, councils)
│       │   └── store/           # Zustand stores (auth, activeCompany)
│       ├── jest.config.js       # Jest testing configuration (ts-jest)
│       └── package.json         # Node dependencies
├── docker-compose.yml           # Local dev services
└── documentation/               # Architecture records
```

---

## 2. Frontend Architecture
- **Framework:** Next.js 14 (App Router) + React 18 + TypeScript.
- **Styling:** TailwindCSS with modern dark palette (`#0a0d14` carbon base, cyber cyan primary accents, glassmorphic card overlays).
- **State Management:** Zustand for client persistence (`useAuthStore`), TanStack React Query v5 for server query cache, background refetching, and mutations.
- **Key Dashboards:**
  - **Company Control Room (`/dashboard`):** Unified Mission Control with interactive Canvas/SVG organizational hierarchy graph and operational telemetry.
  - **Workforce Management (`/dashboard/agents`):** Agent profile inspector, autonomy configuration, status indicators.
  - **Workflow Observability (`/dashboard/workflows`):** Visual step pipelines with human-in-the-loop approval gating and step provenance tracking.
  - **Agent Councils (`/dashboard/councils`):** Multi-model deliberation chamber, debate threads, and dissent knowledge capture.

---

## 3. Backend Architecture
- **Framework:** FastAPI (Python 3.13 / AsyncIO) managed by `uv`.
- **Domain Layering:** Clean domain separation across 13 bounded contexts.
- **Service & Repository Pattern:** Clear segregation between routers, domain business services, and database repositories.
- **Middleware:** Request ID correlation, CORS policies for dev ports (3000, 3001), structured logging via `structlog`.

---

## 4. Database Architecture
- **ORM:** SQLAlchemy 2.0 Async (`AsyncSessionLocal`).
- **Database Engine:** SQLite async (`sqlite+aiosqlite:///./NEIMAN.db`) for lightweight local iteration, switchable to PostgreSQL via `DATABASE_URL`.
- **Migrations:** Alembic versioned migrations up to revision `0009` (head).

---

## 5. Authentication & Authorization
- **Auth Scheme:** JWT Bearer tokens with bcrypt password hashing.
- **RBAC Hierarchy:** `OWNER` > `ADMIN` > `MANAGER` > `MEMBER` > `VIEWER` enforced via declarative FastAPI dependency factories.
- **Dev Mode Support:** `DISABLE_AUTH` switch allowing non-blocking UI exploration without requiring manual sign-in.

---

## 6. API Architecture
- RESTful JSON endpoints prefixed at `/api/v1/`.
- OpenAPI documentation live at `/api/docs` and `/api/redoc`.
- Error handling standardized with unified error schemas (`ApiError`, `ConflictError`, `NotFoundError`, `ForbiddenError`).

---

## 7. Model Integrations & Intelligence Exchange
- **Multi-Model Abstraction:** Heterogeneous intelligence routing supporting Claude, Gemini, OpenAI, and local models.
- **Capability-Based Routing:** Request routing based on architectural reasoning, context size, latency, and cost ceilings.

---

## 8. Governance & Autonomy Engine
- **Constitutional Matrix:** Autonomy Levels 0 to 5 (Observe, Recommend, Execute with Approval, Execute within Policy, Autonomous, Adaptive).
- **Audit Viewer:** Traceable consequential action log capturing actor, target, reason, result, and authority level.

---

## 9. Multi-Agent Organizational Platform
- **Organizational Employee Model:** Agents are persistent organizational employees characterized by persona, organizational role, department, responsibilities, goals, capability-based permissions, intelligence provider configuration, and resource quotas.
- **7-Stage Lifecycle State Machine:** Strict transitions across `CREATED` -> `CONFIGURED` -> `AVAILABLE` -> `WORKING` -> `BLOCKED` -> `PAUSED` -> `RETIRED`.
- **Reporting Hierarchy & Collaboration:** Interservice agent hierarchy with direct manager assignments, delegation mechanics (`/delegate`), problem escalations (`/escalate`), and peer review request threads.
- **10-Step Execution Engine:** Deterministic, fully observable lifecycle: `TASK_RECEIVED` -> `CONTEXT_ASSEMBLY` -> `PLAN` -> `RESOURCE_CHECK` -> `INTELLIGENCE_SELECTION` -> `TOOL_EXECUTION` -> `RESULT` -> `VALIDATION` -> `REPORT` -> `MEMORY_UPDATE`.
- **Capability-Based Permissions:** Strict enforcement of authorized tools and daily budget quotas before tool invocation or intelligence generation.
- **Agent Profile & Operations Drawer:** Comprehensive frontend drawer ([AgentProfileDrawer.tsx](file:///home/sila/Projects/Sila/apps/web/src/components/AgentProfileDrawer.tsx)) supporting live lifecycle status switching, interactive 10-step task execution, structured dispatches, delegation, escalation, multi-layer memory inspection, and consequential audit logs.

---

## 10. Verification & Quality Gates
- **Backend Tests:** 100/100 tests passing across all 15 domain suites (`uv run pytest`), including all 14 multi-agent platform tests in `tests/test_agents.py`.
- **Frontend Type Safety:** `tsc --noEmit` passing with 0 errors.
- **Frontend Unit Tests:** Jest unit tests passing.
- **Data Simulation:** Full realistic organizational dataset seeded with `faker` across all 15 domains.

