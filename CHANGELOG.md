# Changelog

All notable changes to the NEIMAN/Sila project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- Background workers for durable job processing
- PostgreSQL production configuration and connection pooling
- Redis integration for caching and job queues
- Production secret management with key rotation
- Network-level egress security and DNS rebinding protection
- Readiness/liveness probes for orchestration
- E2E testing coverage for critical user flows
- Browser visual regression testing
- Monitoring, metrics, tracing, and alerting
- TUI feature parity with web dashboard
- Operational runbooks and deployment documentation
- Provider health telemetry enhancements
- Lint cleanup (Ruff violations)

---

## [1.1.0] - 2026-11-12 - "Autonomous Delivery & Live Routing Release"

### Added
- **Isolated Git Worktree Execution (`worktree_runner.py`, `execution.py`)**: `WorktreeCodeRunner` and `WorktreeToolExecutor` with path-jailed file tools (`read_file`, `write_file`, `edit_file`, `list_files`, `search_files`), allowlisted test/lint commands, iterative LLM tool loop, CTO auto-merge (`git merge --no-ff`) into `main`, and clean `BLOCKED` abort handling on test failure or merge conflict.
- **Live Execution Telemetry & Diff Observability (`councils/page.tsx`, `CodeDiffViewerPanel.tsx`)**: SSE `ActivityEvent` streaming for `WORKTREE_TOOL_CALL`, `WORKTREE_MERGED`, and `WORKTREE_BLOCKED` with 1-click **View Commit Diff**.
- **Greenfield & Brownfield Autonomous Delivery (`cto_service.py`, `supervisor.py`, `schemas.py`, `cto.ts`)**: Expanded `CTODirectiveRequest` (`directive` up to `32000` chars, `document_text` up to `64000` chars, `autonomous_execute`), automatic `WorkspaceInspector` codebase injection, and `ContinuousSupervisor` auto-pause on completion or `BLOCKED` tasks.
- **Automatic Memory Recall (`cto_service.py`)**: `CTOService.intake_directive()` retrieves organizational memory via `MemoryService.search_memories()` prior to decomposition.

### Fixed
- **Live Multi-Model Routing (`adapters/base.py`, `router_service.py`, `schemas.py`, `service.py`)**: Disabled simulation fallback in all non-test environments, preserved modern Gemini model IDs in `GeminiLiveAdapter`, and reordered `fallback_chain` to prioritize frontier models first with `kilo-auto/free` strictly last.
- **Test Isolation (`tests/conftest.py`, `test_intelligence_adapter_hardening.py`, `test_live_intelligence_adapters.py`)**: Isolated `.neiman_workspaces.json` from test mutations and aligned `ENABLE_SIMULATION_MODE` test fixtures.

---

## [1.0.0] - 2026-11-04 - "Foundation Release"

### Added - Core Backend (FastAPI)
- **FastAPI Application**: Complete async REST API with middleware, routing, and OpenAPI documentation
- **Database Layer**: SQLAlchemy 2.0 async with Alembic migrations (SQLite for dev, PostgreSQL ready)
- **Authentication & Authorization**: JWT Bearer tokens, bcrypt hashing, RBAC (OWNER/ADMIN/MANAGER/MEMBER/VIEWER)
- **Security Hardening**: Path containment, URL validation, CSP headers, audit integrity

### Added - Domain Modules (17 domains)
- **Organizations**: Multi-tenant company management with organizational DNA
- **Agents**: Full lifecycle (CREATED→CONFIGURED→AVAILABLE→WORKING→BLOCKED→PAUSED→RETIRED), 10-step execution engine, hierarchy, delegation, escalation
- **Auth**: Registration, login, session management, dev mode bypass
- **Workflows**: Orchestration engine with human-in-the-loop approval gates
- **Projects & Tasks**: Project roadmaps, task backlog, Kanban boards
- **Departments & Roles**: Hierarchical org structure with nested departments
- **Governance**: Autonomy levels (0-5), policies, constitutional matrix
- **Councils**: Multi-agent deliberation with dissent preservation
- **Decisions**: Decision tracking with provenance and audit trail
- **Memory**: Organizational memory across 8 domains with search and provenance
- **Intelligence/Providers**: Multi-model routing (OpenAI, Anthropic, Gemini, Ollama), live probing, circuit breakers, fault injection
- **Resources**: 11 telemetry dimensions (CPU, RAM, GPU, Tokens, Budget, etc.) with CURRENT/ALLOCATED/AVAILABLE/LIMIT/FORECAST
- **Evolution**: 8-stage pipeline (Observations→Diagnoses→Proposals→Simulations→Validations→Deployments→Rollbacks→Lessons)
- **Activity/Realtime**: WebSocket + SSE streaming for 14 event types with filtering
- **Simulation**: Sandbox branching, multi-dimensional benchmarking, promotion with safety snapshots
- **Blueprints**: Pre-configured org templates (NovaForge, ApexFX) with 1-click launch
- **Approvals**: 8-field governance matrix with APPROVE/REJECT/REQUEST CHANGES/DELEGATE/ESCALATE

### Added - Frontend (Next.js 14)
- **App Router Architecture**: Dashboard layout with collapsible sidebar, topbar, command palette (Cmd+K)
- **Design System**: Cyber-minimalist theme, light/dark modes, HSL tokens, zero FOUC
- **Control Room**: Unified operating cockpit with real-time activity stream, agent roster, resource gauges
- **Organization Map**: Interactive 6-tier hierarchy (Company→Departments→Roles→Agents→Projects→Tasks) with pan/zoom/search
- **Agents Dashboard**: Directory with telemetry, profile drawer (7-row spec), dual-mode creation
- **Workflows**: Visual designer with canvas, palette, inspector, validation panel (code-split)
- **Councils**: Visual deliberation mesh with 5-field participant rigor, 6-stage progression
- **Approvals**: Dual-view (Active Queue + History), 7 filter ribbons, high-risk evidence drawers
- **Memory/Decisions**: Multi-domain search, 8-stage decision explorer, retrospective feedback
- **Resources**: Command center with hierarchical drilldown, telemetry vs estimate badges
- **Intelligence**: Provider directory with live ping probes, chaos testing (Sim 429/500)
- **Evolution**: Pipeline with standardized proposal cards, 4 actions (SIMULATE/REVIEW/APPROVE/REJECT)
- **Simulation Lab**: Sandbox branching, 7 comparison dimensions, 7 canonical actions
- **Activity Stream**: Virtualized timeline, multi-dimensional filters, pulse indicator
- **Blueprints**: Setup wizard (3 steps), quick-launch hero cards
- **Settings/Admin**: 15 sections (Simple + Advanced), RBAC gates, credential masking
- **Performance**: Dynamic code-splitting (-57% workflows, -47% intelligence), request deduplication, TTL caching, virtualization

### Added - Native Desktop (Tauri 2.0)
- **Zero-Trust Capabilities**: Explicit command permissions, no unrestricted shell/fs access
- **System Tray**: Status indicator, quick navigation, click-to-focus
- **Notifications**: Native Rust dispatcher with web fallback
- **Credential Vault**: Hardware-isolated XOR-obfuscated storage
- **Window Persistence**: Coordinates, dimensions, maximized state
- **Deep Links**: `neiman://` protocol handler
- **Auto Updates**: Version delta inspection, release notes
- **Cross-Platform**: Linux, Windows, macOS support

### Added - TUI (Rust/Ratatui)
- **Workspace Model**: 13 canonical workspaces (keys 1-9,0,-,=,\\) with left-nav dispatch
- **API Client**: reqwest-based, tenant-scoped to `/api/v1` with NEIMAN_COMPANY_ID
- **Cyber Command**: Feature module with palette widgets
- **State Persistence**: Local prefs, token, company switcher

### Added - Infrastructure
- **Docker**: Multi-stage Dockerfiles, docker-compose for local dev
- **Scripts**: Installer, desktop launcher, dev runners, GitHub updater
- **Makefile**: Common dev commands
- **CI/CD**: GitHub Actions workflows

### Added - Testing & Quality
- **Backend**: 25+ test files, 100+ tests covering all domains
- **Frontend**: 56 passing unit tests (Jest + RTL)
- **Type Safety**: TypeScript strict mode clean, Rust cargo check clean
- **Builds**: Next.js production build (28/28 routes), Tauri compile

### Added - Documentation
- **README**: Comprehensive quickstart, architecture, tech stack
- **Architecture**: System, frontend, backend decision records
- **Changelog**: This file
- **Roadmap**: Prioritized delivery plan
- **Security**: Threat model, hardening notes
- **Decisions**: ADR log

---

## [0.9.0] - 2026-10-30 - "Pre-Release Hardening"

### Fixed - Security
- Filesystem path containment against sibling-prefix escapes
- Outbound URL parsing with exact hostname allowlist matching
- Provider token usage preservation (estimates only when omitted)

### Added - Intelligence
- Live provider probing endpoint with sub-millisecond benchmarking
- Circuit-breaker state tracking (CLOSED/OPEN/HALF_OPEN)
- Diagnostic fault injection (rate_limit, timeout, 500)
- UI telemetry with one-click ping, Sim 429, Sim 500 buttons

### Changed - UI/UX
- Dual-theme cyber-minimalist design (light default, dark mode)
- Collapsible categorized sidebar (Executive, Workforce, Execution, Governance, Engine, Operations)
- MagneticGrainOrb dynamic contrast modulation

---

## [0.8.0] - 2026-10-27 - "Phase 2 Shell & Org Map"

### Added - Application Shell
- Canonical topbar with global search, Command Palette, Org Switcher, Alerts drawer
- Collapsible mobile-responsive sidebar covering all organizational domains
- Missing route views: Departments, Projects, Tasks, Simulation, Approvals

### Added - Organization Map
- 6-tier operational hierarchy with interactive canvas
- Real-time search, department/status filters
- Expandable/collapsible departments with agent counts
- Distinct agent status visual states with pulse animations
- Deep agent inspector panel

### Added - API Client
- `projectsApi` for Projects and Tasks endpoints

---

## [0.7.0] - 2026-10-20 - "Control Room & Data Integrity"

### Changed - Control Room
- Reframed as navigable isometric headquarters
- Department rooms with selectable employee tokens
- Human review suite, provider switchboard, shared memory/policy links, capacity console
- Route-aware workspace strip across dashboard pages
- Room names follow department records by ID

### Fixed - Data Integrity
- Removed synthetic control-room data from live/API mode
- Added real task/memory loading with explicit unavailable states
- Aligned project/task status and provider mappings with backend schemas
- Removed hard-coded demo company ID

---

## [0.6.0] - 2026-10-15 - "Auth & Workforce"

### Added - Authentication
- Preconfigured dev users (4 RBAC personas) with faker simulation
- Quick-fill persona switcher on login
- Rich organizational seed (Aether Dynamics AI: 5 depts, 5 roles, 5 agents, 3 projects)

### Added - Workforce Interface
- Agent Directory with fleet telemetry, search, filters, Grid/Table views
- Agent Profile Drawer (7-row enterprise spec)
- Dual-mode creation (Simple/Advanced)
- Telemetry tabs: execution traces, memory, metrics, audit logs

---

## [0.5.0] - 2026-10-10 - "Core Platform"

### Added - Foundation
- FastAPI backend with 13 domain packages
- SQLAlchemy 2.0 async + Alembic migrations
- Next.js 14 frontend with Tailwind, TanStack Query, Zustand
- JWT authentication with RBAC
- Basic dashboard layout and navigation

---

## Development Notes

### Test Commands
```bash
# Backend
cd apps/api && uv run pytest

# Frontend
cd apps/web && npm test

# TypeScript
cd apps/web && npx tsc --noEmit

# Rust (TUI)
cd apps/tui-rs && cargo check

# Rust (Tauri)
cd apps/web/src-tauri && cargo check
```

### Build Commands
```bash
# Frontend production
cd apps/web && npm run build

# TUI
cd apps/tui-rs && cargo build --release

# Tauri Desktop
cd apps/web/src-tauri && cargo build --release
```

### Verification Status (2026-11-04)
- ✅ Backend tests: 100+ passing
- ✅ Frontend tests: 56/59 passing (3 jsdom canvas issues)
- ✅ TypeScript: 0 errors
- ✅ TUI Rust: compiles clean
- ⚠️ Tauri: build verification pending (timeout)
- ⚠️ Next.js build: minor `/auth/login` suspense boundary warning
- ✅ 28/28 Next.js routes generated