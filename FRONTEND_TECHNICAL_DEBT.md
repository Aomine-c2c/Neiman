# NEIMAN Frontend Technical Debt

> **Status:** Audit Report
> **Scope:** Existing static HTML prototypes + identified backend issues affecting frontend
> **Date:** 2026-09-25

> **Update (2026-09-30):** This file's opening assessment records the historical pre-Next.js baseline and is no longer current. The Next.js application is implemented in `apps/web`; see the current review below for remaining gaps and verified work.

---

## 1. Executive Summary

The NEIMAN codebase has no production frontend. The "frontend" consists of **six static HTML prototype files** in `apps/api/NEIMAN/static/` that serve as design references. These prototypes are functional in a browser but lack:

- Type safety
- Authentication
- Real API integration
- Accessibility
- Responsive design
- Component reusability
- State management
- Error/loading/empty states

Additionally, the backend has several issues that create **frontend risk** (type shadowing, broad exception handling, missing error context).

This document catalogs all issues found during the frontend architecture audit, categorized by severity and impact.

---

## 2. Severity Legend

| Severity | Meaning |
|---|---|
| **Critical** | Blocks production readiness; must be fixed before frontend launch |
| **High** | Causes significant user-facing issues; fix in Phase 1–2 |
| **Medium** | Noticeable but tolerable; fix in Phase 3–5 |
| **Low** | Minor polish; fix in Phase 6+ |
| **Info** | Design decision worth noting; no action required yet |

---

## 3. Static HTML Prototype Debt

### 3.1 No Authentication Flow

| # | Issue | File | Severity | Impact |
|---|---|---|---|---|
| 1 | Token must be pasted manually into a text input | All static HTMLs | Critical | No real auth flow; no HttpOnly cookie; vulnerable to XSS token theft |
| 2 | No login/register pages | All | Critical | Users cannot authenticate with email/password |
| 3 | No token refresh | All | High | Tokens expire in 15 min; users get logged out frequently |
| 4 | No 401 handling | agent_profile.html | High | API calls fail silently on expired token |

**Fix in Phase 0–1:** Implement proper JWT auth flow with HttpOnly, SameSite=Strict cookies. Add `/auth/login` and `/auth/register` pages.

### 3.2 No Type Safety

| # | Issue | File | Severity | Impact |
|---|---|---|---|---|
| 5 | No TypeScript types for API responses | All | Critical | Runtime errors from mismatched expectations; typos in field names |
| 6 | No API client — uses raw `fetch()` | All | High | No error handling, no retry, no type validation |
| 7 | No input validation | All | High | API 422 errors not surfaced to user |

**Fix in Phase 0:** Generate TypeScript types from OpenAPI spec. Create typed API client in `packages/api-client/`.

### 3.3 No Component Architecture

| # | Issue | File | Severity | Impact |
|---|---|---|---|---|
| 8 | All HTML/CSS/JS in single files — no reusability | All (6 files) | High | 100% code duplication of header, nav, cards across files |
| 9 | Inline `onclick=""` event handlers | All | Medium | No event delegation, no testing hooks, hard to maintain |
| 10 | Inline styles everywhere | All | Medium | Impossible to theme; CSS overrides are fragile |
| 11 | No CSS variables shared across files | All | High | Each file redefines colors, fonts, spacing independently |
| 12 | No build pipeline | All | High | No minification, no bundling, no PostCSS/Tailwind |

**Fix in Phase 1:** Extract all shared patterns into a component library. Use Tailwind CSS with shared design tokens.

### 3.4 Design Inconsistencies

| # | Issue | Details | Severity |
|---|---|---|---|
| 13 | **Different color palettes per page** | Agent profile uses `#090d16` bg + indigo primary; Resource Center uses `#07090e` bg + green primary; Memory uses `#080a0f` bg + purple primary; Blueprints uses `#080a0f` bg + indigo primary | High |
| 14 | **Inconsistent font weights** | Headers use 800 in some files, 700 in others | Low |
| 15 | **Inconsistent spacing** | Cards use 22px padding in some, 24px in others | Low |
| 16 | **Inconsistent border radius** | Uses 12px in most, 10px in resource center, 16px in blueprints | Low |
| 17 | **Inconsistent shadow intensity** | Varies from `rgba(0,0,0,0.3)` to `rgba(0,0,0,0.4)` | Low |
| 18 | **Inconsistent button style** | Some use `btn`, some inline, some with different hover states | Medium |

**Fix in Phase 0–1:** Unify into single design system (see DESIGN_SYSTEM.md). All colors, spacing, typography from shared token package.

### 3.5 Mock Data Instead of Real API

| # | Issue | File | Severity |
|---|---|---|---|
| 19 | Hardcoded fallback data used instead of real API calls | resource_control_center.html (lines 521–566) | Critical |
| 20 | `mockCompanyId` hardcoded as UUID | resource_control_center.html (line 503) | High |
| 21 | All memory items are hardcoded arrays | organizational_memory.html (lines 354–409) | Critical |
| 22 | All blueprint data is hardcoded | company_blueprints.html (no API call shown for data) | Critical |

**Fix in Phase 1+:** Replace all mock data with real API calls via typed client.

### 3.6 Accessibility Issues

| # | Issue | File | Severity |
|---|---|---|---|
| 23 | No `<title>` on some pages or generic titles | All | Medium |
| 24 | `onclick=""` attributes are not keyboard accessible | All | High |
| 25 | No `aria-label` or `role` attributes | All | High |
| 26 | No `<nav>` landmark or skip link | All | Medium |
| 27 | Color-only status indicators (no text alternative) | agent_profile.html | Medium |
| 28 | No focus management | All | High |
| 29 | `<select>` without accessible label | agent_profile.html (status dropdown) | Low |

**Fix in Phase 6:** Accessibility audit using axe-core. Add ARIA labels, semantic HTML, keyboard navigation.

### 3.7 Responsive Design

| # | Issue | File | Severity |
|---|---|---|---|
| 30 | Fixed grid layouts (`grid-template-columns: repeat(4, 1fr)`) break on mobile | All | High |
| 31 | No `@media` queries | All | Critical |
| 32 | `max-width: 1540px` with fixed padding — no mobile adaptation | All | High |
| 33 | Input fields too wide for mobile | agent_profile.html | Medium |

**Fix in Phase 1:** Use Tailwind responsive utilities. Implement mobile-first breakpoints.

### 3.8 Error Handling

| # | Issue | File | Severity |
|---|---|---|---|
| 34 | `alert()` used for all error/success messages | agent_profile.html, company_blueprints.html | High |
| 35 | No loading states — content appears instantly or shows default text | All | High |
| 36 | No error states — `catch` blocks just log to console | All | High |
| 37 | No retry mechanism for failed API calls | All | Medium |

**Fix in Phase 2+:** Replace alerts with toast notifications. Implement loading skeletons and error boundaries.

---

## 4. Backend Issues Creating Frontend Risk

These are issues in the backend code that will cause problems for the frontend:

### 4.1 Enum Type Shadowing (Already Fixed)

| # | Issue | File | Status | Description |
|---|---|---|---|---|
| 38 | `list` method shadows builtin `list` type | `service.py:87` | **FIXED** | The `AgentService.list()` method at line 87 shadowed Python's builtin `list` type, causing Pyrefly to report `list[AgentExecutionAudit]` as "not subscriptable" at lines 296 and 318. Fixed by renaming to `list_agents()`. |

### 4.2 Alias Members in `AgentStatus` Enum

| # | Issue | File | Status | Description |
|---|---|---|---|---|
| 39 | `str, Enum` with duplicate-value aliases | `enums.py:124-137` | **FIXED** | `ACTIVE = "AVAILABLE"`, `INACTIVE = "PAUSED"`, etc. were aliases. Pyrefly cannot resolve primary members when aliases exist. Fixed by switching to `StrEnum` and removing unused aliases. |

### 4.3 Unreachable Code in `service.py`

| # | Issue | File | Status | Description |
|---|---|---|---|---|
| 40 | `hasattr` checks wrong method name | `service.py:354` | Open | `hasattr(self.task_repo, "list_by_agent")` checks for `list_by_agent` but calls `list_by_project`. The hasattr will always be False, so `active_tasks` is always `[]`. |

### 4.4 Missing Metrics on Failure

| # | Issue | File | Status | Description |
|---|---|---|---|---|
| 41 | `tasks_failed` never incremented | `execution.py:402-415` | **FIXED** | The exception handler in `execute_task` sets task and agent status to BLOCKED but doesn't increment `tasks_failed` or update `success_rate` in `performance_metadata`. Fixed by adding metric tracking in the except block. |

### 4.5 Hardcoded Default Model

| # | Issue | File | Status | Description |
|---|---|---|---|---|
| 42 | Hardcoded `gpt-4o` + `openai` fallback | `execution.py:204-205` | Open | If no intelligence models are configured, the execution engine falls back to hardcoded `gpt-4o`/`openai` rather than raising an error. |

### 4.6 Malformed f-string

| # | Issue | File | Status | Description |
|---|---|---|---|---|
| 43 | Unnecessary `f` prefix + awkward phrasing | `service.py:239` | Open | `subject=f"Review Requested for Task deliverable"` has no interpolation but uses f-string. Also, "for Task deliverable" reads awkwardly. |

---

## 5. API Design Issues

### 5.1 Inconsistent Permission Declaration

| # | Issue | Files | Severity |
|---|---|---|---|
| 44 | Some routers use `CurrentUser = Annotated[...]` alias, others use direct `Depends` | agents/service.py uses `current_user: User = Depends(get_current_user)` and `db: AsyncSession = Depends(get_db)` inline; intelligence/router.py uses `CurrentUser` and `DB` type aliases | Low |
| 45 | `_: None = Depends(require_member())` pattern returns `None` | governance, intelligence, memory routers | Medium — confusing for type checkers, but works |

### 5.2 Inconsistent Route Suffixes

| # | Issue | Severity |
|---|---|---|
| 46 | Agents router uses `/agents/{id}/profile` and `/agents/{id}/transition` (action suffixes); Governance uses cleaner RESTful routes | Medium — action-based routes don't map well to REST conventions |

### 5.3 No Pagination Strategy

| # | Issue | Files | Severity |
|---|---|---|---|
| 47 | Some list endpoints have `limit` parameter (e.g., memory search), others don't (e.g., agent list) | resources, memory, agents routers | Medium |

---

## 6. Static HTML → Next.js Migration Mapping

| Static HTML | Next.js Page | Shared Components Needed |
|---|---|---|
| `agent_profile.html` | `/agents/[id]/page.tsx` | AgentCard, StatusBadge, Tabs, Timeline, StatsGrid, FormField |
| `governance_dashboard.html` | `/governance/page.tsx` | ConstitutionEditor, DecisionPill, Tabs, DataTable |
| `intelligence_dashboard.html` | `/intelligence/page.tsx` | StatCard, ProgressBar, ModelTable, AreaChart |
| `resource_control_center.html` | `/resources/page.tsx` | StatCard, ProgressBar, ResourcePoolTable, DecisionPill |
| `organizational_memory.html` | `/memory/page.tsx` | MemoryItem, FilterPill, SearchBar, PromptBox, ContextPipeline |
| `company_blueprints.html` | `/blueprints/page.tsx` | BlueprintCard, Modal, HeroBanner, FilterPill, RiskPill |

---

## 7. Technical Debt Register

| ID | Title | Severity | Files | Phase to Fix |
|---|---|---|---|---|
| TD-01 | No authentication flow | Critical | All static HTMLs | Phase 0 |
| TD-02 | No type safety / API client | Critical | All | Phase 0 |
| TD-03 | Hardcoded mock data | Critical | resource_control_center.html, organizational_memory.html, company_blueprints.html | Phase 1–3 |
| TD-04 | `alert()` for all messages | High | agent_profile.html, company_blueprints.html | Phase 2 |
| TD-05 | No loading states | High | All | Phase 1 |
| TD-06 | No error states | High | All | Phase 2 |
| TD-07 | No empty states | High | All | Phase 1 |
| TD-08 | Inline styles everywhere | High | All | Phase 1 |
| TD-09 | No responsive design | High | All | Phase 1 |
| TD-10 | Inaccessible (`onclick=""`, no ARIA) | High | All | Phase 6 |
| TD-11 | Inconsistent color palettes | High | All | Phase 0 |
| TD-12 | No build pipeline | High | All | Phase 0 |
| TD-13 | 100% code duplication | High | All | Phase 1 |
| TD-14 | `hasattr` checks wrong method (service.py:354) | Medium | service.py | Phase 1 |
| TD-15 | Malformed f-string (service.py:239) | Low | service.py | Phase 1 |
| TD-16 | Hardcoded `gpt-4o` fallback | Medium | execution.py:204-205 | Phase 4+ |
| TD-17 | Inconsistent permission declaration style | Low | Multiple routers | Phase 6 |
| TD-18 | Action-based route suffixes | Medium | agents router | Future refactor |
| TD-19 | No pagination on some list endpoints | Medium | agents, governance routers | Phase 4+ |
| TD-20 | `current_user: CurrentUser = None` in router | Medium | governance/router.py:226-227, 246-247 | Phase 1 (type fix) |

---

## 8. Backend Code Quality Issues

### 8.1 ruff Findings (from `ruff check`)

| Issue | Files | Fix |
|---|---|---|
| `UP042`: Use `StrEnum` instead of `str, Enum` | enums.py (all enum classes) | Run `ruff check --fix --select UP042` — but this is a broader change; only `AgentStatus` was converted to `StrEnum` in this session |
| `E501`: Line too long (> 88 chars) | Multiple files | Run `ruff format` |
| `F401`: Unused import | schemas.py, intelligence/router.py | Run `ruff check --fix --select F401` |
| `F541`: f-string without placeholders | service.py:239 | Remove `f` prefix |
| `F841`: Unused local variable | service.py, intelligence/service.py | Remove or prefix with `_` |
| `I001`: Import order | Multiple files | Run `ruff check --fix --select I001` |

### 8.2 Pyrefly Findings (from `pyrefly check NEIMAN/domains/agents/`)

| Issue | Files | Status |
|---|---|---|
| `list[...]` not subscriptable (method shadowing) | service.py:296, 318 | **FIXED** (renamed `list` → `list_agents`) |
| Forward reference errors for SQLAlchemy relationships | models.py:150-154 | Pre-existing, marked with `# noqa: F821` |

## 9. Current Frontend Review — 2026-09-30

- Protected dashboard routes now wait for Zustand persistence hydration and validate the stored bearer token through `/auth/me`; expired sessions are cleared and redirected to login.
- The login page now returns to the requested same-origin dashboard path after authentication. Redirect targets beginning with `//` are rejected.
- The account settings route now uses the authenticated profile and active organization instead of a placeholder screen or fabricated identity.
- Decision records now list, create, resolve, filter, and record outcomes through the decisions API.
- Jest now transforms JSX correctly and ignores `.next` build artifacts. Auth-guard and decisions-page behavior has component coverage.
- Remaining: token persistence uses browser local storage because the current API returns bearer tokens; migrating to a secure HttpOnly cookie requires a coordinated backend auth change. Project/task screens and preference editing remain incomplete. Current lint/build/test results should be taken from the latest cycle report rather than this historical register.
| `None` default for non-Optional parameter | router.py:226-227, 246-247 | Pre-existing, type annotation mismatch |

### 8.3 Test Coverage Gaps

| # | Gap | Impact |
|---|---|---|
| `test_agents.py` | 14 tests cover basic lifecycle | Does not test edge cases (invalid transitions, permissions) |
| `test_governance.py` | Exists but not verified | Governance is complex; needs thorough testing |
| `test_organizations.py` | Exists but not verified | Company/DNA management needs coverage |
| `test_auth.py` | Exists but not verified | Auth flow is critical |
| No TUI tests | N/A | TUI not yet implemented |
| No frontend tests | N/A | Frontend not yet implemented |

---

## 9. Recommendations Summary

### 9.1 Immediate Actions (Before Frontend Development)

1. **Fix `service.py:354`** — `hasattr` checks `list_by_agent` but calls `list_by_project`. This silently returns `[]` for `active_tasks` in agent profiles.
2. **Fix `service.py:239`** — Remove unnecessary `f` prefix from string. Minor but clean.
3. **Fix `execution.py:204-205`** — Replace hardcoded `gpt-4o`/`openai` fallback with a proper error or configurable default.
4. **Fix `governance/router.py:226-227, 246-247`** — Change `current_user: CurrentUser = None` and `db: DB = None` to proper Optional types or remove the `= None` defaults.
5. **Run `ruff check --fix`** across the backend to clean up import ordering, unused imports, and other lint issues.
6. **Run `ruff format`** to standardize formatting.

### 9.2 Frontend Development Approach

1. **Start with type generation** — Generate TypeScript types from the OpenAPI spec before writing any component.
2. **Preserve the visual design** — The static HTMLs have a cohesive dark theme aesthetic; the Next.js app should match it exactly.
3. **Component-first development** — Build a shared component library (`packages/ui/`) before building pages.
4. **Don't trust the backend** — Even though the backend should be the source of truth, the frontend must validate all inputs and handle all error states gracefully.
5. **Plan for Tauri** — Structure the app so it can be easily packaged as a desktop app.

### 9.3 What to Preserve

| Asset | Reason |
|---|---|
| Dark theme aesthetic | Consistent across all prototypes; strong brand identity |
| Status badge color system | Maps directly to `AgentStatus` enum values |
| Tab patterns | Used consistently across agent profile (audits/memories/comms) |
| Card-based layout | Familiar pattern for data-dense enterprise UIs |
| Domain color accents | Each domain has a distinct color (agents: indigo, resources: green, memory: violet) |

### 9.4 What to Replace

| Asset | Replace With |
|---|---|
| Inline styles | Tailwind CSS utility classes |
| Inline `onclick` handlers | React event handlers |
| `alert()` messages | Toast notifications (react-hot-toast) |
| Hardcoded mock data | Real API calls via typed client |
| Manual token paste | Login form + HttpOnly JWT cookie |
| Raw `fetch()` calls | Typed API client with error handling |
| Duplicated HTML in 6 files | React component library + App Router |

---

## 10. Risk Assessment

### Cycle update — 2026-09-30

- The design tokens and shell now have a distinct graphite/lime identity; verify all route-level hard-coded color utilities converge on tokens during future screen passes.
- Responsive auth markup and desktop layout were inspected in a production browser preview. Authenticated dashboard visual regression remains unverified because this cycle had no valid user session in the preview browser.
- The legacy `/intelligence` page previously used a demo organization UUID; it now uses the active organization from auth state. Continue consolidating this route with `/dashboard/intelligence` to avoid duplicate UX/API patterns.
- Current automated frontend coverage is 10 Jest tests across auth guard, decisions list, control-room telemetry integrity, organization-map empty state, and test setup; additional workflow, navigation, accessibility, and visual coverage is still needed.
- Control-room demo telemetry has been removed. Real tasks and memory are loaded from their organization endpoints, missing resource fields stay unavailable, and rejected domains are surfaced to the operator. A focused regression test now guards this boundary.
- The organization map no longer seeds fictional departments, employees, projects, tasks, decisions, or provenance nodes. It draws only returned records and known project/task links. Intelligence routing no longer displays a made-up fallback chain or resilience guarantee.

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Backend API changes break generated types | Medium | High | Regenerate types in CI on every backend PR |
| Static HTML design doesn't translate to React | Low | Medium | Component library with Storybook for design validation |
| Auth token expiry during long sessions | High | Medium | Implement silent token refresh or redirect to login |
| Permission mismatches between frontend and backend | High | High | Frontend mirrors backend RBAC but always re-checks on API call |
| Type generation produces breaking changes | Medium | High | Pin openapi-typescript version; review diffs in PRs |
| Real-time features require backend SSE/WS support | Medium | Medium | Implement polling in Phase 1, upgrade to SSE in Phase 2 |
| Tauri packaging complexity | Medium | Low | Start Tauri integration only after web app is stable |
| Mobile responsiveness not matching desktop | Medium | Medium | Implement mobile-first from Phase 1; test on actual devices |
