# NEIMAN CTO System Audit & Implementation Plan

**Audit Date:** 2026-09-30
**Scope:** `apps/api` (FastAPI/Python 3.11) + `apps/web` (Next.js 14)
**Test Suite:** 125 test functions across 19 files; 9 security adversarial tests
**Status:** Audit complete — implementation ready (this plan cannot be executed by the plan agent)

---

## Audit Findings

### What Works (Production-Quality)

| Component | Evidence |
|-----------|----------|
| **Security Kernel** (`core/security.py`) | 9/9 adversarial tests pass. 6 control types: prompt injection, secret/PII scrubbing, filesystem traversal, terminal command blocking, SQL destructive blocking, SSRF, model output smuggling, HMAC-SHA256 audit chaining, tenant isolation. |
| **Intelligence Router** (`intelligence/router_service.py`) | 4-tier fallback (Primary→Fallback→Secondary→Local), per-provider circuit breaker (CLOSED/OPEN/HALF_OPEN), capability-based selection, cost & context pre-flight, structured output validation. |
| **Agent Execution Engine** (`agents/execution.py`) | Full 10-step lifecycle, governance constitution evaluation, resource budget enforcement, security boundary checks, per-step audit logging, episodic memory persistence. |
| **Evolution Engine** (`intelligence/evolution_service.py`) | PROPOSE→SIMULATE→EVALUATE→VALIDATE→APPROVE→DEPLOY→MONITOR→ROLLBACK lifecycle, immutable snapshots, rollback with organizational memory recording. |
| **Resource Engine** (`resources/engine.py`) | Multi-dimensional evaluation (APPROVE/DENY/DEFER/REDUCE/QUEUE), real host telemetry inspection (CPU, RAM, disk, load avg), pool allocation tracking. |
| **Database** | SQLAlchemy 2.0 async, Alembic (9 migrations), UUID PKs, declarative FKs with cascading. |
| **Auth & RBAC** | JWT + bcrypt, 5-level role hierarchy, company-scoped tenant isolation. |

### Partially Implemented

| Component | Issue | Location |
|-----------|-------|----------|
| Intelligence adapters | Named `*MockAdapter` but contain real `httpx` HTTP bridges. Falls back to synthetic text when no API key. Live tests mock `httpx.AsyncClient.post` — never hit real APIs. | `intelligence/adapters/base.py` |
| Resource Control Center | `expensive_tasks` and `provider_usage` are hardcoded arrays with fabricated data, not DB queries. | `resources/service.py:327-359` |
| Evolution summary | `get_multidimensional_summary()` generates synthetic metrics (completion_rate=94.5, latency=1420ms, etc.) when no `PerformanceMetricRecord` rows exist. | `intelligence/evolution_service.py:156-174` |
| Simulation benchmark | Uses hardcoded formula (string-matching on routing strategy) with constants `base_cost_per_task=0.035`, `base_latency_ms=480.0`. No real Monte Carlo. | `intelligence/evolution_service.py:629-664` |
| Agent execution | Runs synchronously in HTTP request lifecycle — blocks web worker for long tasks. No background job queue. | `agents/execution.py` |
| `ModelAdapterRegistry` | `_instance = None` class variable is dead code (singleton never used). | `intelligence/adapters/base.py:655` |

### Mocked / Synthetic Data

1. **`resources/service.py:328-359`** — `expensive_tasks` (1 hardcoded entry), `provider_usage` (3 hardcoded entries with fabricated token counts/costs)
2. **`intelligence/adapters/base.py:246-274, 377-396, 493-511, 603-619`** — All 4 adapters produce synthetic sample output text when no API key or HTTP error
3. **`intelligence/evolution_service.py:309-325`** — `simulate_in_lab` returns hardcoded results (latency_reduction_pct=42.2%, cost_savings_pct=37.7%)
4. **`intelligence/evolution_service.py:629-664`** — `run_simulation_benchmark` uses hardcoded base values
5. **`agents/execution.py:142-146`** — `plan_steps` is a hardcoded 3-item list

### Fragile / Insecure

| Issue | File:Line | Risk |
|-------|-----------|------|
| AuditIntegrityChamber salt hardcoded in source | `security.py:287` | If source exposed, audit chain is forgeable |
| SECRET_KEY defaults to "change-me-in-production" | `config.py:23` | JWT forgery if not overridden |
| DATABASE_URL defaults to SQLite | `config.py:19` | Not concurrency-safe; production blocker |
| No rate-limiting middleware | `middleware.py` (only RequestID + CORS) | Brute-force on auth endpoints |
| CORS allows all methods/headers | `main.py:77-83` | Overly permissive |
| Circuit breaker state per-process singleton | `router_service.py:44` | Lost on restart; no distributed state |
| Resource allocation has no concurrency safety | `resources/service.py` | Race condition: concurrent requests can over-allocate pools |
| Agent error handler doesn't wrap DB updates | `execution.py:502-514` | If DB fails during error handling, original exception is masked |
| `.env.example` has `GOOGLE_API_KEY` but config uses `GEMINI_API_KEY` | `.env.example:28` vs `config.py:43` | Gemini key never loaded |
| `.env.example` has `OLLAMA_BASE_URL` but config uses `OLLAMA_HOST` | `.env.example:29` vs `config.py:44` | Ollama URL never loaded |
| `.env.example` suggests `ALGORITHM=RS256` but config defaults to `HS256` | `.env.example:12` vs `config.py:24` | Symmetric JWT by default |

### What Prevents Production Deployment

1. **No distributed task queue** — no Celery/Arq/BullMQ dependency; agent tasks run synchronously in-process
2. **SQLite as default DB** — not suitable for concurrent multi-worker deployment
3. **No rate-limiting middleware** on auth endpoints
4. **Weak default SECRET_KEY** ("change-me-in-production")
5. **No security response headers** (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)
6. **No deep health/readiness probes** — only basic `/health` returning app version (no DB/Redis/provider checks)
7. **No connection pooling** for PostgreSQL (no PgBouncer config)
8. **No logging aggregation** or error tracking (Sentry dependency not in pyproject.toml)
9. **Circuit breaker state lost on process restart**

### What Prevents True Multi-Provider Operation

1. Adapters named "Mock" — misleading for ops teams
2. No provider health check cron — health only checked on request-time circuit breaker
3. No parallel fan-out — providers queried sequentially, not simultaneously
4. Structured output validation only checks JSON parseability + required keys, not full JSON Schema
5. Rate limit backoff uses fixed multipliers, not `Retry-After` header parsing

### What Prevents Autonomous Organizational Operation

1. Evolution requires explicit API calls — no autonomous monitoring daemon
2. Agent execution is request-driven — no continuous agent loop or autonomous task scheduling
3. No inter-agent messaging bus — agents can't collaborate or delegate dynamically
4. `get_multidimensional_summary` returns synthetic data when no metrics — can't observe real bottlenecks
5. No automatic rollback based on drift detection

### What Prevents Organizational Evolution

1. `get_multidimensional_summary` generates fake metrics — evolution engine can't detect real bottlenecks
2. Simulation Lab uses hardcoded formula, not real historical workload replay
3. No continuous adaptation loop — evolution is manually triggered
4. No A/B testing framework for comparing live adaptations

---

## Implementation Plan

### Priority 0 — Frontend Fix: TypeScript Compilation Error (Blocking)

**Task 0.1: Fix `department_id` reference on `Project` type in resources dashboard**
- File: `apps/web/src/app/dashboard/resources/page.tsx:1173`
- Error: `p.department_id` — `Project` interface (`apps/web/src/lib/api/projects.ts:18-35`) and backend model (`apps/api/nexora/domains/projects/models.py:14-44`) do NOT define `department_id`
- Root cause: The filter on line 1173 was copied from the Agent filter (line 1191) which correctly uses `department_id`, but `Project` has no department association (only `company_id` and `owner_id`)
- Fix: Remove `.filter()` call on line 1173 — show all projects regardless of department selection. Department scoping does not apply to projects.
- Corrected line 1173: `{projects.map((p) => (`
- Verification: Run `npx tsc --noEmit` in `apps/web` — should eliminate TS2339 error. The Agent filter on line 1191 remains unchanged since `Agent` type (`agents.ts:39`) does have `department_id`
- Risk: None — projects were already visible in all department selections; the filter was dead code (TypeScript would error at compile, but runtime JS would silently return `undefined` for the missing field, making the filter a no-op anyway)

### Priority 1 — Security & Config Hardening (Safe, High-Impact)

**Task 1.1: Fix `.env.example` naming inconsistencies**
- File: `apps/api/.env.example`
- Changes: `GOOGLE_API_KEY` → `GEMINI_API_KEY`; `OLLAMA_BASE_URL` → `OLLAMA_HOST`; `ALGORITHM=RS256` → `ALGORITHM=HS256` (match config default)
- Rationale: Config uses different field names; mismatched env vars mean adapters never activate.

**Task 1.2: Add audit salt to environment configuration**
- File: `apps/api/NEIMAN/config.py` — add `AUDIT_SECRET_SALT: str` field with warning default
- File: `apps/api/NEIMAN/core/security.py:287` — replace hardcoded salt with `get_settings().AUDIT_SECRET_SALT`
- Risk: Backward compatible (default matches existing value). Must avoid circular import (security.py is imported by many modules; config.py should not import security.py).

**Task 1.3: Add security response headers middleware**
- File: `apps/api/NEIMAN/middleware.py` — add `SecurityHeadersMiddleware(BaseHTTPMiddleware)`
- Headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security` (production only), `Content-Security-Policy: default-src 'self'`
- Register in: `apps/api/NEIMAN/main.py` — `app.add_middleware(SecurityHeadersMiddleware)`
- Risk: Low. CSP should not break API-only responses. Static UI at `/ui/*` loads from same origin.

**Task 1.4: Tighten CORS**
- File: `apps/api/NEIMAN/main.py:77-83`
- Change: `allow_methods=["*"]` → `["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]`; `allow_headers=["*"]` → `["Authorization", "Content-Type", "X-Request-ID"]`

**Task 1.5: Add rate-limiting middleware for auth endpoints**
- File: `apps/api/NEIMAN/middleware.py` — add `RateLimitMiddleware` using in-memory sliding window counter (IP-keyed dict with TTL)
- Config: Add `RATE_LIMIT_AUTH_REQUESTS: int = 20` and `RATE_LIMIT_AUTH_WINDOW: int = 60` to `config.py`
- Register: Apply only to paths starting with `/api/v1/auth/`
- Risk: Low but must verify `test_auth.py` tests don't hit the limit (tests make ~3-4 auth calls per test, fresh client per test — should be safe). Add ability to disable via `DISABLE_AUTH_RATE_LIMIT` or `DEBUG` mode in tests.
- Note: In-memory limiter is sufficient for single-instance deployment. Document that Redis-backed limiter is needed for multi-instance.

**Task 1.6: Enhance `/health` endpoint**
- File: `apps/api/NEIMAN/main.py:155-162`
- Add: DB ping (`select 1` via async session), Redis connectivity check, intelligence circuit breaker states
- Return structured JSON: `{"status": "ok", "components": {"database": "ok", "redis": "ok", "providers": {"anthropic": "CLOSED", ...}}}`
- Risk: Low — additive. Need DB dependency injection for health check.

### Priority 2 — Naming Clarity & Data Integrity (Medium-Impact)

**Task 2.1: Rename adapter classes**
- File: `apps/api/NEIMAN/domains/intelligence/adapters/base.py`
- Rename: `OpenAIMockAdapter` → `OpenAILiveAdapter`, `AnthropicMockAdapter` → `AnthropicLiveAdapter`, `GeminiMockAdapter` → `GeminiLiveAdapter`, `LocalModelMockAdapter` → `LocalModelLiveAdapter`
- Update `ModelAdapterRegistry.__init__` references
- Update imports in: `tests/test_live_intelligence_adapters.py`
- Risk: Low — internal naming only.

**Task 2.2: Replace hardcoded data in resource control center**
- File: `apps/api/NEIMAN/domains/resources/service.py:327-359`
- `expensive_tasks`: Query top 5 from `ResourceUsageRecord` (or `ModelRequestLog`) grouped by task, aggregated by cost
- `provider_usage`: Query `ModelRequestLog` grouped by `selected_provider_name`, aggregate tokens/cost/request_count
- If no data: return empty lists `[]` instead of fabricated entries
- Verify: `test_resources.py:262-286` only checks that `expensive_tasks` and `provider_usage` keys exist (not their content) — will still pass

**Task 2.3: Fix evolution summary to avoid synthetic data**
- File: `apps/api/NEIMAN/domains/intelligence/evolution_service.py:129-194`
- When no `PerformanceMetricRecord` rows exist for a dimension: return zeroed metrics with `observations_count: 0`
- When metrics exist: aggregate only from real data; remove hardcoded `avg_cycle_time_ms=1420.0`, `resource_efficiency_score=0.88`, `quality_score=0.94`, etc.
- Check `evolution/page.tsx` — frontend uses `?? 95.0`, `?? 5.0`, `?? 0.88`, `?? 99.4` fallbacks, so zeroed backend data renders gracefully

### Priority 3 — Concurrency Safety (Medium-Risk)

**Task 3.1: Add transactional safety to resource pool allocation**
- File: `apps/api/NEIMAN/domains/resources/service.py` (`submit_and_evaluate_request`)
- Wrap the evaluate → allocate → update-capacity flow in a transaction with `SELECT FOR UPDATE` (`with_for_update`) on pool rows
- Risk: Medium — potential deadlocks. Must review `repository.py` methods for existing transaction handling.
- Validation: `test_resources.py:63-107` tests approval flow; must still pass.

### Priority 4 — Frontend Type Fix (Safe, Low-Impact)

**Task 4.1: Fix `floatNumber` type alias**
- File: `apps/web/src/lib/api/evolution.ts:288,325`
- Change: Replace `floatNumber` with `number` — the alias is declared at line 325 but used at line 288 (forward reference)

---

## Implementation Order

```
1.1 → 1.2 → 1.3 → 1.4 → 1.5 (auth rate limit) → 1.6 (health probes)
   ↓
2.1 (rename adapters) → 2.2 (real control center data) → 2.3 (fix evolution summary)
   ↓
3.1 (pool allocation concurrency) [defer if deadlock risk too high]
   ↓
4.1 (frontend floatNumber fix)
```

Rationale: Security & config gaps are production blockers → fix first. Then naming clarity → then replace fake data for trustworthiness → then concurrency for reliability → then frontend.

---

## Validation Plan

| Step | Command | Checks |
|------|---------|--------|
| After all tasks | `cd apps/api && uv run pytest tests/ -v --tb=short` | All 125 tests pass, including 9 security tests |
| After Task 1.1 | `grep -E "GEMINI_API_KEY\|OLLAMA_HOST" .env.example` | Names match `config.py` |
| After Task 1.2 | `grep "AUDIT_SECRET_SALT" NEIMAN/core/security.py` | Salt sourced from config |
| After Task 1.3 | `curl -I http://localhost:8000/` (dev) | Response includes security headers |
| After Task 1.5 | `uv run pytest tests/test_auth.py -v` | Auth tests still pass (no rate limit conflicts) |
| After Task 1.6 | `curl http://localhost:8000/health` | Returns component status JSON |
| After Task 2.1 | `uv run pytest tests/test_intelligence.py tests/test_live_intelligence_adapters.py -v` | All intelligence tests pass |
| After Task 2.2 | Hit `/resources/control-center` for new company | `expensive_tasks: []`, `provider_usage: []` |
| After Task 3.1 | Run concurrent resource request test | No over-allocation (pool capacity stays within bounds) |
| After Task 4.1 | `cd apps/web && npx tsc --noEmit` | Zero TypeScript errors |
| Lint check | `cd apps/api && uv run ruff check NEIMAN/ tests/` | Zero lint errors |

---

## Out of Scope (Requires Architectural Change)

- **Distributed task queue** — no Celery/Arq dependency exists; requires adding worker infrastructure
- **True Monte Carlo simulation** — current simulation is formula-based, not real workload replay
- **Autonomous evolution daemon** — evolution is API-driven, not continuously autonomous
- **Multi-provider parallel fan-out** — providers queried sequentially
- **Full JSON Schema validation** for structured output
- **Redis-backed circuit breakers** — needed for multi-instance deployments
- **GPU detection** — requires adding `GPUtil` or similar dependency
- **CSRF protection** — currently JWT-only auth; add if cookie-based sessions introduced
- **Password complexity requirements** — auth service doesn't enforce beyond min length

---

## Notes on Existing Readiness Docs

The 7 existing markdown files (`SYSTEM_HEALTH.md`, etc.) contain accurate descriptions of some features but make overstated claims:

- SYSTEM_HEALTH.md: "118/118 tests passing" — actual is 125 test functions
- INTELLIGENCE_PROVIDER_READINESS.md: "Live Execution Bridge" — tests use `unittest.mock.patch`, never hit real APIs
- RESOURCE_ENGINE_READINESS.md: Does not mention hardcoded fake telemetry data in control center
- PRODUCTION_READINESS.md: Checklist items (rate limiting, deep health probes) are NOT implemented despite claims
- SECURITY_READINESS.md: Accurate on security controls, but misses weak SECRET_KEY default and hardcoded audit salt as findings

These docs should be updated post-implementation to reflect verified reality.
