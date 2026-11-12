# NEIMAN Architecture Review — 2026-10-27

## Scope and evidence rules

This review reflects repository source and manifests inspected on 2026-10-27. “Verified” means visible in code/configuration; it does not mean the feature was exercised at runtime. “Target” describes an architectural recommendation or requirement and must not be read as an implemented feature. No tests were run for this review. The provider adapter source `apps/api/nexora/domains/intelligence/adapters/base.py` was left unchanged.

The older root-level `ARCHITECTURE_AUDIT.md`, `CURRENT_STATE.md`, `MISSING_CAPABILITIES.md`, `DECISIONS.md`, and `EVOLUTION_READINESS.md` remain untouched. Their descriptions conflict with current manifests and runtime wiring in several places (for example Redis/pgvector/Kubernetes/RS256 claims); use this dated review for current audit findings and reconcile those documents separately.

## Executive summary

NEIMAN is currently a Python modular monolith with a FastAPI API, SQLAlchemy async persistence, Next.js web UI, Tauri desktop wrapper, and a Rust Ratatui operator TUI. Its backend already has domain modules for organizations, agents, intelligence, projects, workflows, governance, resources, memory, decisions, policies, councils, blueprints, activity and system administration. PostgreSQL/asyncpg is the configured production database path; SQLite/aiosqlite is supported for development/testing. LanceDB is an embedded vector store. Docker Compose includes PostgreSQL and Redis, but the Python manifest does not declare a Redis client or a queue worker, and no Redis-backed queue integration was found in the inspected runtime. Redis health reporting is not evidence of cache/queue use.

The codebase has substantial breadth but uneven execution depth. Workflow types include agent, tool, approval, resource, decision, validation and control steps; the engine now fails explicitly for unsupported parallel execution. Evaluations are not a first-class persisted/evaluable domain: intelligence evolution simulations and council/quorum code exist, but no general evaluation suite/scorecard pipeline was found. The 13 organization positions are represented through workforce/blueprint setup and 13 SOUL/SKILLS pairs. The shared resolver now feeds startup/blueprint creation, direct task execution, workflow agent inference and CTO inference. Runtime behavior remains unverified because tests were not run.

Recent hardening in this working tree makes authentication opt-out disabled by default, persists activity, binds workflow approval to a stored approval record, bounds execution retries/timeouts, scopes project inspection, and constrains subprocess execution. These changes have only received syntax/diff checks; database migration execution and behavioral tests remain unverified.

## Verified repository facts

### Stack and entry points

| Area | Verified implementation |
|---|---|
| API | Python 3.11+, FastAPI, Pydantic v2, SQLAlchemy 2 async, Alembic, asyncpg and aiosqlite (`apps/api/pyproject.toml`) |
| Primary SQL persistence | `apps/api/nexora/database.py`; configured async SQLAlchemy engine, PostgreSQL driver dependency and SQLite support |
| Vector memory | LanceDB dependency and embedded store (`domains/memory/vector_store.py`); no external vector service required |
| Web | Next.js 14 App Router, React 18, TypeScript, Jest (`apps/web/package.json`) |
| Desktop | Tauri Rust wrapper under `apps/web/src-tauri` |
| TUI | Rust Ratatui/Crossterm client under `apps/tui-rs`; depends on local `packages/engine-rs` |
| API entry | `apps/api/nexora/main.py:create_app()` and module-level `app`; routers and model modules are registered there |
| CLI entry | `apps/api/nexora/neiman_cli.py:main()` |
| Admin bootstrap | `apps/api/nexora/scripts/init_admin.py` |
| Dev/test orchestration | Root `Makefile`, Docker Compose, `run-dev.sh`, `run-desktop.sh`, `run-tui.sh` |

Compose defines PostgreSQL and Redis services. Python configuration mentions a Redis URL and health check, but the API dependency list has no Redis client and no queue/worker runtime was found. README architecture diagrams and claims of Kubernetes, pgvector, OpenTelemetry, RS256, refresh-token rotation and Redis queueing are not substantiated by those manifests/runtime paths and should be treated as unverified or stale.

### Implemented domain surface (code presence, not end-to-end guarantees)

Routers and models exist for authentication, organizations, agents, blueprints, councils, decisions, governance, intelligence/provider configuration, memory, policies, projects, resources, system/MCP/harvester, workflows, and activity. Workflow persistence includes definitions, executions and step records (`domains/workflows/models.py`). Memory includes relational records, context/code graph utilities and LanceDB-backed semantic storage. There are 13 agent SOUL folders and 13 corresponding `SKILLS.md` files under `domains/agents/souls`; `identity_files.py` resolves them for workforce construction and the direct task, workflow and CTO model paths. This is source evidence, not a behavioral test result.

Test assets exist: API pytest files under `apps/api/tests`, web Jest tests under `apps/web/src`, and Makefile test targets for API, web, and Rust crates. Presence does not establish that the current branch passes. The Makefile contains stale paths in formatting commands (`NEIMAN/` while the package is `nexora/`) and names `build`/migration targets in help that are not all implemented consistently.

### Material gaps and broken/fragile workflows

- Workflow `PARALLEL` is explicitly unsupported in the current engine despite its module documentation describing it. Unsupported operations should remain explicit failures until semantics, persistence and cancellation are implemented.
- The workflow engine calls provider/tool services inline in the API process. Long-running work therefore consumes request capacity and has weak recovery semantics compared with a durable worker/outbox design.
- MCP configuration lives in a process-global in-memory registry. The declared `stdio` and `sse` transports have no execution adapter, and the built-in adapters are canned simulations; calls now fail closed unless explicit simulation mode is enabled. Registry mutations require platform administration and direct human tool calls require company-admin authority, but persistent tenant-scoped MCP configuration and real transport adapters remain target work.
- The newly added activity persistence migration has not been applied in this review. Existing historical migration behavior prevented a clean isolated migration check; the chain needs a repeatable PostgreSQL and SQLite migration verification path.
- Activity WebSocket/SSE fan-out is process-local. Durable history is now stored, but live events are not distributed across API replicas.
- Provider and tool adapters are spread across intelligence, MCP/system and workflow domains. A formal provider capability contract, credential lifecycle, circuit breakers and uniform usage accounting need consolidation.
- The memory subsystem combines SQL records, LanceDB, graph utilities and code-specific inspection. Retention, rebuild, tenant isolation and deletion consistency need explicit policies.
- The TUI and desktop are separate clients over the API; `packages/engine-rs` is present as a local Rust dependency but it is not evidence of a shared, authoritative domain engine. Avoid duplicating business policy in clients.
- A generic, versioned evaluation domain with datasets, runs, model/agent scorecards, regression gates and human review was not found.
- Organizational positions and agent prompts exist, but assignment/authority boundaries and exactly which SOUL/SKILLS files are applied at each execution boundary need a single enforced resolver.
- Legacy documents, comments and README diagrams overstate infrastructure and maturity. Keep generated/current capability claims sourced from executable configuration.

## Architecture decision record

### ADR-001: Keep a modular monolith as the system of record

**Status:** Accepted for the next phases. **Decision:** Keep FastAPI/SQLAlchemy as the authoritative domain/API boundary while making domain dependencies explicit. Do not split microservices until independent scaling, release cadence or isolation needs are measured. **Reason:** Existing modules and SQL transactions are deeply coupled; early service extraction adds distributed failure and migration cost. **Consequences:** Establish import-direction rules, service interfaces and integration boundaries now. Long-running work may move to a worker while sharing domain packages and database contracts.

### ADR-002: Make PostgreSQL the durable production source of truth

**Status:** Proposed. SQLAlchemy models and asyncpg support PostgreSQL; SQLite should remain a local/test adapter, not a production multi-user substitute. LanceDB remains a derived semantic index whose data can be rebuilt from canonical records. Redis may be used for coordination only after a declared client, failure policy and ownership model are added. Do not describe it as a queue/cache until integrated.

### ADR-003: Separate request handling from durable job execution

**Status:** Proposed. Persist workflow execution and an outbox/job record transactionally, then execute bounded steps in a worker with leases, idempotency keys, heartbeat, cancellation and retry classification. Keep approval and resource gates as durable states. API requests create/read/control executions; they do not run unbounded autonomous loops.

### ADR-004: Use a canonical organization and identity contract

**Status:** Proposed. Model the human owner as the CEO/principal with explicit company membership and immutable audit identity. Store the 13 positions as versioned organization roles; agents reference role, model policy and versioned SOUL/SKILLS bundles. Human permissions and agent capabilities are distinct; agent authority is granted per project/workflow and never inferred from a title alone.

### ADR-005: Enforce mediated, least-privilege autonomy

**Status:** Proposed. All model, tool, filesystem, shell, network and spend effects pass through policy evaluation and a capability broker. Default to deny. Require an immutable approval record for high-impact actions and revalidate it against exact action/target at execution time. Sandboxing is defense in depth, not authorization. Keep secrets in a managed secret store/environment injection; do not expose credentials in API, logs, UI or source-control artifacts.

### ADR-006: Make evaluations a versioned product domain

**Status:** Proposed. Persist evaluation definitions/datasets, immutable run inputs, provider/model/agent versions, rubric versions, outputs, metrics, human adjudication and promotion decisions. Gate prompt/model/skill changes on reproducible offline evaluations and sampled online review. Keep evaluation separate from business workflow completion.

### ADR-007: Treat activity and audit as distinct streams

**Status:** Proposed. Product activity is queryable and retention-bounded; security/audit records are append-only, access-restricted and carry actor, tenant, authorization decision, target, correlation ID and outcome. Use transactional outbox delivery for realtime fan-out. Current activity persistence is not a substitute for tamper-resistant security audit.

## Component dependency map

```mermaid
flowchart TD
  CEO[Human CEO / operator] --> WEB[Next.js web]
  CEO --> DESKTOP[Tauri desktop]
  CEO --> TUI[Rust keyboard-first TUI]
  WEB --> API[FastAPI modular monolith]
  DESKTOP --> WEB
  TUI --> API
  API --> AUTH[Auth and tenant authorization]
  API --> DOM[Organization, agents, projects, workflows, governance, resources, memory, decisions]
  DOM --> SQL[(SQLAlchemy / PostgreSQL]
  DOM --> VEC[(LanceDB derived index)]
  DOM --> POLICY[Policy and capability checks]
  DOM --> MODEL[Provider adapter boundary]
  DOM --> TOOL[MCP / external tool boundary]
  MODEL --> PROVIDERS[Heterogeneous model providers]
  TOOL --> EXT[External systems]
  API -. current process-local fan-out .-> LIVE[WebSocket / SSE]
  DOM -. target durable job/outbox .-> WORKER[Workflow workers]
  WORKER --> SQL
  WORKER --> POLICY
  WORKER --> MODEL
  WORKER --> TOOL
```

**Dependency rule:** clients call API contracts; routers validate/authenticate and delegate; services coordinate domains; repositories own persistence; external effects go through adapters and policy. Domain services must not import UI/client logic. Memory vectors and realtime events are derived/distributable projections, not authorization authorities.

## Current versus target capability matrix

| Capability | Current evidence | Assessment | Target state |
|---|---|---|---|
| 13 organizational positions | Workforce bootstrap/blueprint code, 13 SOUL directories | Present in source; runtime consistency not verified | Versioned role catalog, explicit CEO ownership, authority matrix and migration validation |
| SOUL.md / SKILLS.md | 13 pairs, shared resolver, startup/blueprint/direct-task/workflow/CTO call sites | Source wiring present; runtime behavior unverified | Versioned bundles with provenance, review and a verified single policy boundary for every agent inference |
| Heterogeneous model providers | Intelligence catalog, adapters, routing/config domains | Implemented surface; provider behavior not tested here | Capability-neutral interface, key vault, health/circuit-breakers, cost/latency telemetry |
| Controlled autonomy | Governance/policies/approvals/resources and sandbox code | Partial; enforcement must be verified per effect path | Default-deny capability broker, explicit action tiers, verified approval and auditable execution |
| Projects | Project/task domain, repository/router/service and inspector | Present; inspection scope recently constrained | Tenant-bound workspaces, repository permissions, safe patch/branch lifecycle |
| Workflows | Definition/execution/step records, inline engine, retry/timeouts/gates | Partial; parallel unsupported; worker durability absent | Durable worker, idempotency, DAG semantics, cancellation, recovery and complete audit |
| Persistent memory | SQL memory domain, LanceDB, graph/context utilities | Present as components; lifecycle consistency unverified | Tenant-scoped canonical records, retention/deletion, provenance and rebuildable indexes |
| Resource management | Pools/budgets/requests and evaluator | Present; missing budget now fails closed for paid inference | Reservations, reconciliation, quotas and provider-cost truth |
| Security governance | Auth, policy, governance, approval, middleware | Present but broad control coverage still needs verification | Threat-model-driven controls, security audit, key rotation, isolation and incident response |
| Evaluations | Evolution simulations and council/quorum related code | No general evaluation subsystem found | Dataset/rubric/run/scorecard domain and promotion gates |
| Keyboard-first TUI | Rust Ratatui app and command modules | UI exists; full API/task-path coverage unverified | Complete accessible keyboard flows, contextual confirmation and offline/reconnect handling |
| Activity/audit | Activity domain; durable event model added in working tree | Activity persistence added; migration and replica fan-out unverified; not security audit | Outbox-backed activity plus separate append-only audit stream |
| Deploy/runtime | Dockerfiles/Compose and launcher scripts | Local composition present; production operations claim unsupported | Reproducible CI/CD, migration gates, backup/restore, observability and secrets management |

## Data model proposal

Retain existing SQL models where they fit and introduce only the missing durable contracts through additive migrations.

| Entity | Key fields and relationships |
|---|---|
| `Company` / `User` / `Membership` | Tenant root; owner user is CEO; membership role/status; unique tenant/user; all business rows carry `company_id` |
| `OrgPosition` | Company, stable position key, title, department, authority profile, version, active interval; seed 13 positions deterministically |
| `Agent` / `AgentIdentityVersion` | Company, position, status; immutable SOUL/SKILLS content hashes, source, version, approved timestamp, model policy reference |
| `Project` / `Workspace` | Company, repo/workspace identity, lifecycle; workspace path or remote provider reference and scoped capability grants |
| `WorkflowDefinition` / `WorkflowVersion` | Company, immutable graph/version, schema, allowed agents/tools/models, timeout/retry policy, activation metadata |
| `WorkflowExecution` / `StepExecution` | Tenant, definition version, state, lease, idempotency key, correlation; step input/output references, attempts, timestamps, error class, approval/resource relation |
| `ApprovalRequest` / `ApprovalDecision` | Tenant, exact action and target hash, requesting actor, policy snapshot, reviewer, decision, expiry, resolved timestamp; immutable decision record |
| `CapabilityGrant` / `PolicyDecision` | Actor/agent, resource, action, scope, expiry; decision input/policy version/reason and correlation ID |
| `ResourceBudget` / `Reservation` / `UsageLedger` | Tenant and optional project/agent/provider, period/limit; reservation and settled usage, currency/token/compute units, idempotent provider event |
| `MemoryRecord` / `MemoryIndexReference` | Tenant, owner/scope, type, content or encrypted object reference, provenance, retention/expiry, embedding/index version and tombstone |
| `EvaluationSuite` / `DatasetCase` / `EvaluationRun` / `EvaluationResult` | Versioned suite/cases/rubric; immutable agent/model/prompt/skill refs; raw result, metric, human adjudication, promotion decision |
| `AuditEvent` / `ActivityEvent` | Separate security and product streams. Both tenant-scoped/correlated; audit append-only with actor/action/target/decision/outcome; activity user-facing and retention-bounded |
| `OutboxEvent` / `JobLease` | Transactional event publication, delivery count/state; worker lease, heartbeat, retry and dead-letter reason |

Use database constraints for tenant consistency, unique stable keys, valid state transitions where practical, and foreign keys. Prefer JSON for versioned workflow payloads and provider-specific metadata, not for authorization relationships, budgets or lifecycle state. Encrypt credentials outside ordinary domain rows and store only secret references.

## Security threat model

| Threat / asset | Example path | Required controls |
|---|---|---|
| Cross-tenant data access | Object ID guessed across companies; unscoped SQL/API/WebSocket | Tenant context required in service/repository APIs; membership checks; tenant-aware constraints; negative authorization tests on every route and stream |
| Secret disclosure | Provider keys in source/config responses/logs/UI/errors | Keep literals unchanged per owner instruction for this private project, but treat them as exposed credentials: rotate/revoke and migrate to secret storage; generic configured status only; redact logs/errors; scan history and build artifacts without printing values |
| Prompt/tool injection | Untrusted issue/repo/document text changes agent instructions | Mark trust boundaries, isolate system instructions, tool allowlists, output validation, human approval for high-impact actions, adversarial evaluation cases |
| Unsafe code execution | Agent-generated shell or filesystem actions | Per-run OS isolation, non-root, read-only mounts by default, explicit network egress policy, CPU/memory/time limits, ephemeral workspace, no host credentials; sandbox failure denies execution |
| Approval replay/confusion | Approval reused for different target or after expiry | Bind approval to tenant, exact normalized action/target hash, policy version, expiration and one execution; verify reviewer authorization and revalidate at use |
| Spend exhaustion | Loops/retries or provider abuse | Preflight budget reservation, per-agent/project/provider quotas, bounded retries/deadlines/concurrency, provider usage reconciliation and alerting |
| Malicious extension/provider | MCP server exfiltrates data or returns hostile output | Per-tool grants, isolated credentials, egress allowlists, schema validation, timeouts, output sanitization and audit |
| Compromised account/session | Stolen JWT or bootstrap credentials | Strong bootstrap flow, short-lived access and revocation strategy, MFA for CEO/admin, rate limits, secure desktop token storage, session/audit review |
| Persistence/index drift | SQL deletion leaves vector copies; activity event mismatch | Transactional outbox, tombstones/deletion propagation, index rebuild/checks, retention and backup-restore exercises |
| Supply chain/deployment | Dependency or container compromise | Lockfiles, pinned base images, SBOM/scanning/signing, least-privilege CI, migrations gated and rollback tested |

**Trust boundaries:** human operator/browser/TUI; API authentication and tenant boundary; agent/model prompt boundary; tool/provider network boundary; workspace/sandbox boundary; SQL versus derived vector store; runtime process versus deployment secrets. “Private project” reduces exposure likelihood but does not make hardcoded credentials secure; possession of the repository or its history is equivalent to possession of those credentials.

## Phased migration plan

1. **Baseline and containment (now):** preserve existing behavior; inventory real routes, auth dependencies, model registrations and external effects; keep auth fail-closed; rotate committed provider credentials; add secret references and safe status reporting; confirm tenant filters and sandbox default-deny; reconcile inaccurate docs.
2. **Schema and contract foundation:** formalize CEO/tenant/membership and 13-position seed; add versioned agent identity bundles; add audit, outbox, capability and budget-reservation contracts with additive migrations; validate SQLite and PostgreSQL migration chains from empty and prior supported versions.
3. **Reliable workflows:** move execution to durable worker leases; introduce step idempotency, explicit DAG/parallel semantics, cancellation, heartbeats, dead-letter handling and approval/resource resume; make provider/tool side effects observable and reconciled.
4. **Memory and project isolation:** define canonical memory scopes, retention/deletion and provenance; make vector indexes rebuildable; establish per-project workspaces and stronger OS/network isolation; safely gate patch/branch operations.
5. **Evaluation and model operations:** establish versioned evaluation datasets/rubrics, regression gates, provider capability matrix, model routing policies and cost/quality telemetry; require evidence before agent/prompt/model promotion.
6. **Operator surfaces and production readiness:** complete keyboard-first TUI workflows, accessible web/desktop parity, audit review and incident controls; add backup/restore drills, SLO dashboards, dependency scanning and deployment/migration gates.

At each phase: ship additive schema changes first; dual-write/read only where needed; backfill with resumable jobs; verify counts and tenant boundaries; switch reads behind a flag; retain rollback compatibility until evidence supports cleanup. Avoid destructive schema or data actions without an explicit migration/backup plan.

## Test and verification strategy

No tests were run as part of this audit. Recent edits received Python AST parsing for 132 API Python files, `git diff --check`, shell syntax checks for the three run scripts, and a check that the provider adapter source file is unchanged. Offline PostgreSQL SQL generation now traverses the entire migration chain through the activity revision. SQLite offline generation is still blocked by an existing historical batch migration that requires live reflection, and an online disposable SQLite upgrade did not complete within the command window; the migration has not been verified against a live database.

Before release, use a staged verification matrix:

1. **Static/contract:** Ruff, mypy, TypeScript type-check, Rust `cargo check`, OpenAPI schema snapshots, migration lint and dependency/import-boundary checks. Fix stale Makefile paths and ensure each documented target exists.
2. **API unit/integration:** run existing pytest suite; add tests for auth bootstrap/login/token expiry, tenant isolation on every domain, approval exact-target/replay/expiry, budget fail-closed/reservation, workflow retries/timeouts/resume/idempotency, and all activity persistence/fan-out transaction outcomes.
3. **Migration:** PostgreSQL and SQLite upgrades from empty and every supported prior revision, downgrade where safe, model/schema parity, index/FK checks, and migration rerun/recovery behavior. Run against disposable databases only.
4. **Adapters:** contract tests with deterministic fake providers/MCP servers; timeout, malformed response, rate limit, credential redaction, retry classification, usage accounting and cancellation.
5. **Sandbox/security:** subprocess escape attempts, symlink/path traversal, environment inheritance, CPU/memory/time limits, network denial, concurrent tenant isolation; test that missing sandbox tooling prevents launch.
6. **Frontend/TUI:** Jest tests for auth and role-gated routes; keyboard-only workflows for approvals, execution control, project selection and reconnect; Rust tests for navigation, command parsing and API error states.
7. **System/resilience:** multi-worker event delivery, worker crash/reclaim, duplicate outbox delivery, DB outage, Redis unavailable behavior, vector-index rebuild, backup/restore and load/cost limits.

Prioritize security boundaries and migration verification before broad feature expansion. Do not interpret existing test files or Makefile targets as evidence of passing results.
