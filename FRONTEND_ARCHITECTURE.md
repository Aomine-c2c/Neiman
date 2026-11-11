# NEIMAN Frontend Architecture

> **Status:** Implemented foundation; ongoing hardening
> **Audience:** Frontend engineers, architects, Tauri/desktop team
> **Last Updated:** 2026-09-30

---

## 1. Executive Summary

> This document began as a frontend plan. The Next.js application, dashboard, domain API clients, auth pages, and Tauri shell now exist under `apps/web`. Some planned package boundaries and product surfaces are still outstanding; see `FRONTEND_TECHNICAL_DEBT.md` and `UI_ROADMAP.md` before treating the planned layout below as current implementation.

NEIMAN is an AI-native Organization Operating System. The backend (FastAPI + async SQLAlchemy + PostgreSQL) is fully implemented across 13 domains. There is **no existing frontend** — only six static HTML prototype pages in `apps/api/NEIMAN/static/` that serve as design reference for six core UI surfaces.

This document defines the frontend architecture for a **shared, multi-platform application** that targets:

| Platform | Runtime | Primary UI |
|----------|---------|------------|
| Web | Browser (Next.js SSR) | React + TypeScript |
| Desktop | Tauri (Rust-based) | Same React app, native shell |
| TUI | Terminal (optional) | React + ink, or dedicated CLI in Python/Go |

The key principle: **share as much as possible** across platforms — types, API clients, permissions, state management, and business logic — while accepting that rendering layers differ (DOM vs. Tauri WebView vs. terminal canvas).

---

## 2. Monorepo Structure

```
Sila/
├── apps/
│   ├── api/                    # FastAPI backend (existing)
│   │   └── NEIMAN/
│   │       ├── domains/        # 13 domain modules
│   │       ├── core/            # Enums, permissions, base classes
│   │       ├── config.py        # Pydantic Settings (env-driven)
│   │       ├── database.py      # Async SQLAlchemy engine + session
│   │       └── main.py          # FastAPI app creation, route mounting
│   └── web/                    # Next.js frontend (TO BE CREATED)
│       ├── src/
│       │   ├── app/             # App Router (Next.js 14+)
│       │   ├── lib/             # Shared library (API client, types, utils)
│       │   ├── components/      # UI components
│       │   ├── hooks/           # React hooks
│       │   ├── stores/          # State management (Zustand)
│       │   ├── features/        # Feature modules (domain-aligned)
│       │   └── styles/          # Global CSS + design tokens
│       ├── public/             # Static assets
│       ├── package.json
│       ├── next.config.js
│       ├── tsconfig.json
│       └── tailwind.config.js
├── packages/
│   ├── api-client/             # Auto-generated API client (shared by web + TUI)
│   ├── types/                  # Shared TypeScript types (mirrors backend Pydantic schemas)
│   ├── ui/                     # Shared React component library
│   └── design-tokens/          # Design token package (CSS vars, Figma variables)
└── tauri/                      # Tauri desktop config (TO BE CREATED)
    ├── src-tauri/
    │   └── tauri.conf.json
    └── src/                    # Tauri frontend entry (uses apps/web)
```

### Rationale

- **`packages/` (npm/yarn workspaces)**: Contains code shared between Next.js and Tauri. The `api-client`, `types`, `ui`, and `design-tokens` packages are imported by both `apps/web` and the Tauri frontend.
- **Feature-sliced `features/`**: Each domain from the backend (agents, governance, blueprints, etc.) maps to a feature directory. This maintains the backend's DDD structure in the frontend.
- **No `apps/tui/` initially**: The TUI (terminal interface) is optional and can be implemented as a separate package using a library like `ink` or as a Python/Go CLI. It shares the `api-client` and `types` packages but has its own rendering layer.

---

## 3. Next.js Structure (App Router)

Using the **App Router** (Next.js 14+), with the following conventions:

### 3.1 Directory Layout

```
src/app/
├── (auth)/
│   ├── login/page.tsx          # /auth/login
│   └── register/page.tsx       # /auth/register
├── (main)/
│   ├── layout.tsx              # Root layout with sidebar/nav
│   ├── agents/
│   │   ├── page.tsx            # /agents — list all agents
│   │   └── [id]/
│   │       └── page.tsx        # /agents/[id] — agent profile
│   ├── governance/
│   │   ├── page.tsx            # /governance — constitution + approvals
│   │   ├── autonomy/page.tsx   # /governance/autonomy
│   │   └── audits/page.tsx     # /governance/audits
│   ├── intelligence/
│   │   └── page.tsx            # /intelligence — model analytics
│   ├── resources/
│   │   └── page.tsx            # /resources — control center
│   ├── memory/
│   │   └── page.tsx            # /memory — searchable knowledge base
│   ├── blueprints/
│   │   ├── page.tsx            # /blueprints — catalog + builder
│   │   └── [id]/page.tsx       # /blueprints/[id] — inspector
│   ├── projects/
│   │   ├── page.tsx            # /projects
│   │   └── [id]/page.tsx       # /projects/[id]
│   └── settings/
│       └── page.tsx            # /settings — company & user settings
├── api/                        # API Routes (proxy to backend)
│   └── health/route.ts
├── layout.tsx                  # Root HTML layout (providers, fonts)
├── page.tsx                    # Landing → redirect to /agents
└── globals.css                 # Tailwind imports + base styles
```

### 3.2 Routing Strategy

| Route Pattern | Component | Description |
|---|---|---|
| `/auth/login` | Public | Login form → JWT token → store in HttpOnly cookie |
| `/auth/register` | Public | Register new account |
| `/agents` | Protected (viewer+) | Agent list with status filters |
| `/agents/[id]` | Protected (viewer+) | Agent profile inspector (mirrors `agent_profile.html` design) |
| `/agents/[id]/execute` | Protected (member+) | Task execution interface |
| `/governance` | Protected (viewer+) | Constitution + action evaluator |
| `/governance/autonomy` | Protected (admin+) | Autonomy matrix config |
| `/governance/approvals` | Protected (viewer+) | Pending/historical approvals |
| `/governance/audits` | Protected (viewer+) | Audit trail viewer |
| `/intelligence` | Protected (viewer+) | Model analytics dashboard |
| `/resources` | Protected (member+) | Resource control center |
| `/memory` | Protected (member+) | Knowledge base + context assembly |
| `/blueprints` | Public* | Blueprint catalog + "Build My Company" |
| `/blueprints/[id]` | Protected | Blueprint inspector |
| `/projects` | Protected (viewer+) | Project list |
| `/projects/[id]` | Protected (viewer+) | Project detail + task board |
| `/settings` | Protected (member+) | Company settings, members, roles |

\* Blueprints catalog is publicly viewable (no auth required per `blueprints/router.py` — the `list_blueprints` and `get_blueprint` endpoints have no `current_user` dependency).

### 3.3 Navigation

- **Sidebar navigation**: Persistent left sidebar with nav items per domain. Collapsible.
- **Breadcrumbs**: Dynamic breadcrumb trail showing current location within a domain.
- **Command palette**: `Cmd+K` / `Ctrl+K` global search across agents, projects, tasks, memory items, and governance actions.
- **Tab navigation**: Within detail pages (e.g., agent profile tabs for Audits / Memories / Communications as shown in `agent_profile.html`).

---

## 4. Component Architecture

### 4.1 Component Hierarchy

```
components/
├── ui/                    # Design system primitive components (reusable, unstyled first)
│   ├── button.tsx
│   ├── card.tsx
│   ├── input.tsx
│   ├── select.tsx
│   ├── badge.tsx
│   ├── modal.tsx
│   ├── table.tsx
│   ├── tabs.tsx
│   ├── status-badge.tsx
│   ├── loading-skeleton.tsx
│   ├── error-boundary.tsx
│   └── empty-state.tsx
├── layout/
│   ├── app-layout.tsx       # Main layout with sidebar + header
│   ├── auth-layout.tsx      # Auth page layout
│   └── mobile-nav.tsx       # Mobile drawer navigation
├── forms/                   # Domain-specific forms
│   ├── agent-form.tsx
│   ├── task-form.tsx
│   ├── constitution-form.tsx
│   └── autonomy-config-form.tsx
├── data-display/            # Read-heavy components
│   ├── agent-card.tsx
│   ├── stat-grid.tsx
│   ├── audit-table.tsx
│   ├── resource-pool-table.tsx
│   └── memory-item.tsx
├── shared/                  # Cross-domain components
│   ├── company-switcher.tsx
│   ├── user-menu.tsx
│   ├── command-palette.tsx
│   ├── notification-toaster.tsx
│   └── theme-toggle.tsx
└── features/                # Feature-specific composition components
    ├── agents/
    ├── governance/
    ├── intelligence/
    ├── resources/
    ├── memory/
    ├── blueprints/
    └── projects/
```

### 4.2 Composition Principles

1. **Primitives first**: `components/ui/` contains minimal, composable primitives. No domain knowledge.
2. **Domain components**: `components/features/<domain>/` compose primitives + business logic.
3. **No prop drilling**: State is managed via Zustand stores (see §6).
4. **Headless where possible**: Complex components (modals, dropdowns) use Radix UI patterns for accessibility.

---

## 5. State Management

### 5.1 Architecture: Zustand + React Query

```
stores/
├── auth.store.ts          # Session, JWT, user context
├── company.store.ts       # Current company, membership role, permissions
├── agents.store.ts        # Agent list, filters, selected agent
├── memory.store.ts        # Memory search, selected memory
├── intelligence.store.ts  # Provider/model catalog, routing decisions
├── resource.store.ts      # Resource pools, budgets, allocations
└── ui.store.ts            # Command palette, notifications, modals
```

### 5.2 Two-Layer Pattern

```
┌────────────────────────────────────────────────────┐
│                 Client State (Zustand)             │
│  • Auth session, company context, UI flags         │
│  • Selected items, form drafts, navigation state   │
│  • Optimistic updates (immediate UI feedback)      │
└────────────────────────────────────────────────────┘
                     │
                     │ sync via
                     ▼
┌────────────────────────────────────────────────────┐
│                 Server State (React Query)         │
│  • API data fetching (list, get, create, update)   │
│  • Caching, background refetch, pagination          │
│  • Automatic cache invalidation on mutations       │
│  • Stale-while-revalidate pattern                   │
└────────────────────────────────────────────────────┘
```

**Why both?**
- **Zustand** for fast, synchronous UI reactions (e.g., modal open/close, selected nav tab).
- **React Query** for async data that needs caching, pagination, refetch-on-focus.
- Cross-cutting data (e.g., "current company") lives in Zustand, but the actual company data is fetched via React Query hooks.

### 5.3 Data Flow Example (Agent Profile)

```
1. User clicks agent in /agents list
2. agents.store.ts → sets selectedAgentId
3. agents.hooks.ts → useAgentProfile(agentId) → React Query fetch
4. API client → GET /api/v1/companies/{cid}/agents/{id}/profile
5. Response cached by React Query
6. AgentProfile component renders with data
7. User transitions status → POST /transition
8. React Query mutation → invalidates query
9. AgentProfile re-fetches → shows updated status
```

---

## 6. API Client Architecture

### 6.1 Layered API Client

```
lib/api/
├── client.ts              # Base fetch wrapper (auth, interceptors, error handling)
├── auth.ts                # /auth/* endpoints
├── companies.ts           # /companies/* endpoints
├── agents.ts             # /companies/{cid}/agents/* endpoints
├── governance.ts         # /companies/{cid}/governance/* endpoints
├── intelligence.ts       # /companies/{cid}/intelligence/* endpoints
├── resources.ts          # /companies/{cid}/resources/* endpoints
├── memory.ts             # /companies/{cid}/memory/* endpoints
├── blueprints.ts          # /blueprints/* endpoints
├── projects.ts           # /companies/{cid}/projects/* + /tasks/* endpoints
├── workflows.ts          # /companies/{cid}/workflows/* endpoints
├── policies.ts           # /companies/{cid}/policies/* endpoints
└── decisions.ts          # /companies/{cid}/decisions/* endpoints
```

### 6.2 Base Client

```typescript
// lib/api/client.ts
class NexoraClient {
  private baseURL: string;
  private getToken: () => string | null;

  async request<T>(endpoint: string, options: RequestOptions): Promise<T> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.getToken()}`,
        'X-Request-ID': crypto.randomUUID(),
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new NexoraAPIError(error.message, error.error, response.status);
    }

    // Handle empty responses (204 No Content)
    if (response.status === 204) return null as T;

    return response.json();
  }
}
```

### 6.3 Type Generation from OpenAPI

The backend auto-generates an OpenAPI spec at `/api/docs` (Redoc) and `/api/openapi.json`. The frontend should use **`openapi-typescript`** or **`orval`** to generate:

1. TypeScript types from Pydantic schemas (in `packages/types/`)
2. Typed API hooks (in `packages/api-client/`)

This eliminates manual type duplication and ensures the frontend types stay in sync with the backend.

### 6.4 Error Handling

All backend errors return `{ error: string, message: string }` with appropriate HTTP status codes. The client maps these:

| Status | Error Type | Frontend Action |
|--------|---|---|
| 401 | UnauthorizedError | Redirect to login, clear session |
| 403 | ForbiddenError | Show "insufficient permissions" toast |
| 404 | NotFoundError | Show 404 page or empty state |
| 409 | ConflictError | Show conflict message inline |
| 400 | BusinessRuleError | Show validation/business error inline |
| 422 | ValidationError | Show field-level validation errors |
| 500 | Generic | Show error page with retry |

---

## 7. Authentication

### 7.1 Flow

```
1. User navigates to /auth/login
2. Submits email + password
3. POST /api/v1/auth/login → receives { access_token, token_type, expires_in }
4. Token stored in HttpOnly, SameSite=Strict cookie (NOT localStorage)
5. HttpOnly cookie automatically sent with all subsequent requests
6. GET /auth/me validates token and returns UserResponse
7. On token expiry (401), redirect to login with return-to param
```

### 7.2 Implementation

- **Cookie storage**: `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/auth`
- **Refresh flow**: Token expires in 15 minutes. A refresh token flow is planned but not yet implemented in the backend (only `ACCESS_TOKEN_EXPIRE_MINUTES` exists). The frontend should handle short-lived tokens by redirecting to login on 401.
- **Route protection**: `middleware.ts` (Next.js) checks for cookie presence. If absent and route is `(main)`, redirect to `/auth/login`.
- **Role-aware rendering**: The user's membership role (OWNER/ADMIN/MANAGER/MEMBER/VIEWER) is fetched at login and stored in the auth store. UI elements that require higher roles are hidden or disabled.

### 7.3 RBAC Integration

```typescript
// Permission helper
function canAccess(role: MembershipRole, required: MinimumRole): boolean {
  const hierarchy = ['VIEWER', 'MEMBER', 'MANAGER', 'ADMIN', 'OWNER'];
  return hierarchy.indexOf(role) >= hierarchy.indexOf(required);
}

// In components
{canAccess(currentUser.role, 'MANAGER') && (
  <TransitionStatusButton />
)}
```

The backend already provides `require_company_role(MembershipRole.XXX)` dependencies. The frontend should mirror this with a `usePermission(requiredRole)` hook that reads the current user's role from the auth store.

---

## 8. Authorization

### 8.1 Permission Model

The backend uses a 5-level hierarchy: `OWNER > ADMIN > MANAGER > MEMBER > VIEWER`.

The frontend must understand these levels to:
1. Show/hide UI elements
2. Disable buttons/actions
3. Route users to appropriate pages

### 8.2 Company Context

Every company-scoped endpoint requires `company_id`. The frontend stores the current company in a Zustand store:

```typescript
interface CompanyContext {
  currentCompanyId: UUID | null;
  membershipRole: MembershipRole;
  hasPermission: (min: MinimumRole) => boolean;
  switchCompany: (id: UUID) => void;
}
```

### 8.3 UI-Level Guarding

| Permission | UI Elements |
|---|---|
| OWNER/ADMIN | Delete company, invite members, manage roles, create policies |
| MANAGER | Create agents, transition agent status, create projects/tasks, approve escalations |
| MEMBER | Execute tasks, create workflows, submit resource requests |
| VIEWER | Read-only: view agents, profiles, audits, decisions |

---

## 9. Forms

### 9.1 Form Library

**Zod + React Hook Form + `@ui` components**

```
- Validation: Zod schemas (mirroring Pydantic validators from schemas.py)
- State: React Hook Form (uncontrolled, performant)
- UI: Custom <FormField> component wrapping primitives
- Error display: Inline field errors + submit-level error toast
```

### 9.2 Patterns

1. **Create/Edit forms**: Single form component with optional `id` prop. If `id` present → PATCH, else POST.
2. **Wizard forms**: Multi-step wizards for complex objects (e.g., blueprint creation, "Build My Company").
3. **Inline editing**: Click-to-edit fields on detail pages (e.g., constitution amendment, autonomy config).
4. **Form persistence**: Draft state saved to localStorage to prevent loss on navigation.

### 9.3 Examples

| Form | Backend Endpoint | Fields |
|---|---|---|
| Agent Creation | POST /agents/ | name, role_id, department_id, system_instructions, capabilities, tools, autonomy, intelligence_config, resource_limits |
| Agent Status Transition | POST /agents/{id}/transition | status (enum), reason (optional) |
| Task Creation | POST /projects/{id}/tasks/ | title, description, assigned_agent_id, priority, dependencies, resource_requirements, due_date |
| Constitution Amendment | PATCH /governance/constitution | mission, values, operating_principles, prohibited_actions, approval_requirements, security_rules, financial_rules, data_rules, escalation_rules |

---

## 10. Tables

### 10.1 Table Component

A generic, accessible `<DataTable>` component with:
- Column sorting (click header)
- Column resizing
- Row selection (checkbox)
- Bulk actions
- Pagination (server-side via React Query)
- Row hover state
- Empty state integration
- Loading skeleton integration
- Zebra striping

```typescript
const { columns, data } = useAgents(companyId);
<DataTable
  columns={columns}
  data={data}
  selectable
  onRowClick={(row) => router.push(`/agents/${row.id}`)}
  bulkActions={<BulkTransitionButton />}
/>
```

### 10.2 Data-Intensive Tables

| Table | API Endpoint | Key Columns |
|---|---|---|
| Agents | GET /agents | Name, Status, Role, Department, Autonomy, Performance |
| Projects | GET /projects | Name, Status, Priority, Deadline |
| Tasks | GET /projects/{id}/tasks | Title, Status, Assignee, Priority, Due Date |
| Auditors | GET /governance/audits | Timestamp, Actor, Action, Target, Result, Autonomy |
| Approvals | GET /governance/approvals | Title, Action, Risk, Submitted, Reviewer |
| Escalations | GET /governance/escalations | Reason, Severity, Status, Created |
| Memory Items | GET /memory/items | Title, Domain, Scope, Last Accessed |
| Resource Pools | GET /resources/pools | Category, Limited, Allocated, Available |
| Model Catalog | GET /intelligence/models | Model, Provider, Capabilities, Cost, Latency |

---

## 11. Charts

### 11.1 Library Choice

**`recharts`** (headless, React-native-friendly) for most visualizations.

| Chart Type | Use Case | Component |
|---|---|---|
| Bar chart | Cost breakdown by provider | `<BarChart>` |
| Line chart | Spend over time, latency trends | `<LineChart>` |
| Pie/Donut | Agent count by department, memory by domain | `<PieChart>` |
| Area chart | Resource utilization over time | `<AreaChart>` |
| Heatmap | Autonomy levels across departments | Custom `<Heatmap>` |

### 11.2 Key Dashboards

| Dashboard | Charts |
|---|---|
| Resource Control Center | Budget utilization bars, compute allocation progress, token quota usage, expensive tasks ranking |
| Intelligence Exchange | Spend over time, model latency comparison, provider health rate, cost breakdown by provider |
| Governance | Audit volume by action type, approval pipeline funnel, autonomy level distribution |

---

## 12. Notifications

### 12.1 Notification System

A toast-based notification system using `react-hot-toast` or a custom `<Toaster>` component.

### 12.2 Notification Sources

| Source | Type | Description |
|---|---|---|
| User actions | Success/Error | "Agent created", "Status transition failed" |
| Approvals | Info/Warning | "New approval request requires your review" |
| Escalations | Warning/Danger | "Agent has escalated a blocking issue" |
| Resource limits | Warning | "Daily budget 80% consumed" |
| Governance violations | Danger | "Action blocked by company constitution" |

### 12.3 Realtime Delivery

Currently, the backend has no WebSocket or SSE endpoints. The frontend should:
1. **Phase 1**: Poll for updates (e.g., check for new approvals every 30s)
2. **Phase 2**: Integrate Server-Sent Events (SSE) for approval/escalation notifications
3. **Phase 3**: Integrate WebSockets for real-time agent execution events

---

## 13. Modal / Dialog System

### 13.1 Architecture

A centralized modal/dialog system using a Zustand store for state management.

```typescript
// stores/ui.store.ts
interface UIState {
  modals: Record<string, { isOpen: boolean; data: any }>;
  openModal: (id: string, data?: any) => void;
  closeModal: (id: string) => void;
}

// Component usage
const { openModal } = useUIStore();
<button onClick={() => openModal('transition-status', { agentId })}>
  Transition Status
</button>

// In page/layout
<TransitionStatusModal /> // listens to `modals['transition-status']`
```

### 13.2 Modal Types

| Modal | Trigger | Content |
|---|---|---|
| Agent Status Transition | Agent profile → "Transition" button | Status dropdown, reason field |
| Agent Execution | Agent detail → "Execute Task" | Task selector, input data, override model |
| Delegate Task | Agent detail → "Delegate" | To-agent selector, task, message |
| Escalation | Agent detail → "Escalate" | Problem description, severity, context |
| Create Agent | Agents list → "Create" | Full agent creation form |
| Create Project | Projects list → "Create" | Project name, objective, deadline, milestones |
| Approval Decision | Approvals table → row action | Approve/Reject buttons, reviewer notes |
| Blueprint Inspector | Blueprint card → "Inspect" | Full blueprint spec with tabs |
| Build My Company | Blueprints → "Synthesize" | NL prompt input, cost estimate, risks |

---

## 14. Command Palette

### 14.1 Functionality

`Cmd+K` / `Ctrl+K` opens a global command palette that supports:

| Command Category | Commands |
|---|---|
| Navigation | Go to Agents, Governance, Intelligence, Resources, Memory, Blueprints, Projects |
| Agent Actions | Transition agent status, execute task, send message, delegate, escalate |
| Search | Search agents, projects, tasks, memories, policies |
| Governance | Evaluate action, create approval, view pending approvals |
| System | Toggle dark mode, settings, logout |

### 14.2 Implementation

Built on top of the existing `cmdk` library or a custom headless implementation. Commands are registered dynamically based on the current company context and user's permissions.

---

## 15. Responsive Behavior

### 15.1 Breakpoints

```css
/* matches Tailwind defaults */
sm: 640px    /* Mobile landscape / small tablet */
md: 768px    /* Tablet */
lg: 1024px   /* Laptop / small desktop */
xl: 1280px   /* Desktop */
2xl: 1536px  /* Large desktop */
```

### 15.2 Mobile Adaptations

| Component | Desktop | Mobile |
|---|---|---|
| Sidebar | Persistent left sidebar | Collapsed → hamburger menu → slide-over drawer |
| Data tables | Full columns | Horizontal scroll + priority columns hidden |
| Agent profile | 2-column grid | Single column, accordion tabs |
| Stats grid | 4-column grid | 2-column grid |
| Modals | Centered overlay | Full-screen drawer |

### 15.3 Touch Targets

All interactive elements minimum 44x44px per WCAG 2.1.

---

## 16. Accessibility (a11y)

### 16.1 Standards

- WCAG 2.1 AA compliance
- Semantic HTML structure
- ARIA labels for icon-only buttons
- Keyboard navigation (Tab, Enter, Escape)
- Focus visible indicators
- Color contrast ratios ≥ 4.5:1

### 16.2 Specific Requirements

| Component | a11y Pattern |
|---|---|
| Status badges | `<span role="status" aria-label="Agent status: Available">` |
| Modal dialogs | `role="dialog"`, `aria-modal="true"`, focus trap, Escape to close |
| Tables | `<caption>`, scoped `<th>`, sortable column `aria-sort` |
| Forms | `<label>` + `aria-describedby`, `aria-invalid` on errors |
| Navigation | Skip to main content link, landmarks (`<nav>`, `<main>`) |

---

## 17. Loading States

### 17.1 Strategy

Two-tier loading: **Route-level** and **Component-level**.

| Level | Technique |
|---|---|
| Route | `loading.tsx` in App Router — shows skeleton while page data loads |
| Component | `<LoadingSkeleton />` — shimmers while sub-component data fetches |

### 17.2 Skeleton Patterns

| Component | Skeleton |
|---|---|
| Agent list | Shimmer rows with avatar + text lines |
| Agent profile | Hero skeleton + metric-row skeleton + timeline-item skeleton |
| Stats grid | Shimmer stat cards |
| Tables | Rows with pulsing gray bars |
| Memory items | Shimmer cards with domain badge + text |

---

## 18. Error States

### 18.1 Error Boundaries

```
<ErrorBoundary>
  <AgentProfile />
</ErrorBoundary>
```

Catches JavaScript errors in subtree and renders a fallback UI with:
- Error message
- Retry button (re-mounts component)
- "Go home" link

### 18.2 API Error States

| Scenario | UI Treatment |
|---|---|
| Network error | Toast: "Unable to reach server. Check your connection." + retry |
| 401 Unauthorized | Auto-redirect to login |
| 403 Forbidden | Toast: "You don't have permission to perform this action." |
| 404 Not Found | 404 page with "Go back" button |
| 500 Server Error | Error page with "Retry" + correlation ID (from X-Request-ID header) |

---

## 19. Empty States

### 19.1 Empty State Patterns

Each list/detail view provides a contextual empty state:

| View | Empty State Message |
|---|---|
| Agents list | "No agents found. Create your first autonomous employee." + CTA |
| Agent profile | "Select an agent from the sidebar to inspect their profile." |
| Audit trail | "No audit entries yet. This agent hasn't been activated." |
| Approvals | "No pending approval requests. All clear!" |
| Audits (governance) | "No consequential action logs found." |
| Memory items | "No memory records match your query." + search suggestion |
| Projects | "No projects created yet." + CTA |
| Tasks | "No tasks assigned to this project." + CTA |
| Resource pools | "No resource pools configured." |
| Provider catalog | "Add your first AI provider to get started." |

---

## 20. Realtime / Event Architecture

### 20.1 Current State

The backend currently has **no realtime transport** (no WebSocket, no SSE). All communication is request-response REST.

### 20.2 Frontend Strategy

#### Phase 1: Polling (MVP)
- React Query's `refetchInterval` for near-realtime data
- Polling intervals per data type:
  - Approvals/Escalations: 30s
  - Resource utilization: 60s
  - Agent status: 15s
  - Intelligence telemetry: 30s

#### Phase 2: SSE (Planned)
- A new `/api/v1/events/` endpoint serving Server-Sent Events
- Events: `approval.created`, `escalation.resolved`, `agent.status_changed`, `audit.recorded`
- Frontend connects via `EventSource` and dispatches events through a global event bus

#### Phase 3: WebSocket (Future)
- Full-duplex for agent execution streaming
- Agent execution steps streamed in real time
- Live terminal output during task execution

### 20.3 Event Bus (Frontend)

```typescript
// lib/events.ts
class EventBus {
  private listeners = new Map<string, Set<Function>>();

  emit(event: string, data: any) {
    this.listeners.get(event)?.forEach(fn => fn(data));
  }

  on(event: string, fn: Function) {
    // subscribe
  }
}

// Usage: SSE pushes event → EventBus.emit → React Query invalidate or store update
```

---

## 21. Tauri Integration

### 21.1 Architecture

```
tauri/
├── src/                        # Symlink or copy of apps/web/.next/export
├── src-tauri/
│   ├── tauri.conf.json
│   ├── Cargo.toml
│   └── icons/
└── package.json                # Minimal, depends on apps/web build
```

### 21.2 Shared Frontend

The Tauri desktop app bundles the **same Next.js build** as the web app:
1. `apps/web` builds static export (`next export`) → `out/` directory
2. Tauri copies `out/` into `tauri/src/`
3. Tauri serves it as a WebView with additional Rust capabilities

### 21.3 Native Capabilities

| Capability | Tauri API | Frontend Hook |
|---|---|---|
| File system | `@tauri-apps/api/fs` | `saveBlueprintAsJson()`, `loadLocalBlueprint()` |
| System info | `@tauri-apps/api/os` | Display CPU/ram in Resource Control Center |
| Clipboard | `@tauri-apps/api/clipboard` | Copy audit JSON to clipboard |
| Notifications | `@tauri-apps/api/notification` | Native desktop notifications for approvals |
| Window management | `@tauri-apps/api/window` | Dark mode follows system, window size persistence |
| Deep linking | `@tauri-apps/plugin-deep-link` | `nexus://agents/{id}` protocol links |
| Update checking | `@tauri-apps/plugin-updater` | In-app update notifications |

### 21.4 Desktop-Specific UI

| Menu Item | Description |
|---|---|
| File | Import Blueprint, Export Configuration |
| Edit | Preferences, Keyboard Shortcuts |
| Window | Toggle Dev Tools, Zoom |
| Tools | Run AI Agent (context menu), Generate Report |
| Help | Documentation, Check for Updates |

### 21.5 Data Layer Differences

| Web | Tauri Desktop |
|---|---|
| Fetch from `http://localhost:8000/api/v1` | Same, or embedded API via Rust plugin |
| Cookies for auth | Secure storage via `@tauri-apps/api` |
| No local file access | Read/write blueprint JSON files natively |
| Browser notifications | OS-native notifications |

**Recommendation**: Keep the API client identical. The Tauri app talks to the same backend HTTP API. Desktop-specific features (file system, native notifications) are opt-in layers on top.

---

## 22. Environment Configuration

### 22.1 Environment Variables

| Variable | Web | Tauri | TUI |
|---|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8000/api/v1` | Same (or embedded) | `http://localhost:8000/api/v1` |
| `NEXT_PUBLIC_APP_NAME` | `NEIMAN` | `NEIMAN` | `NEIMAN` |
| `NEXT_PUBLIC_ENVIRONMENT` | `development` | `production` (desktop) | auto-detected |
| `NEXT_PUBLIC_ENABLE_TELEMETRY` | `false` | `true` (host metrics) | `true` |
| `NEXT_PUBLIC_DEFAULT_COMPANY_ID` | `00000000-0000-0000-0000-000000000001` | Same | Same |

### 22.2 Build Config

- **Development**: Hot reload via `Next.js dev server`
- **Production (Web)**: `next build && next export` → static hosting (Vercel, S3 + CloudFront)
- **Production (Tauri)**: `next build && next export` → bundled in Tauri WebView
- **TUI**: Separate `packages/tui/` with its own build

---

## 23. Frontend/Backend Boundaries

### 23.1 Clear Separation

| Concern | Layer |
|---|---|
| Business logic | Backend (service.py) |
| Data validation | Backend (Pydantic schemas) + Frontend (Zod) |
| Permission checks | Backend (require_company_role) — frontend mirrors for UX |
| Data persistence | Backend (SQLAlchemy repositories) |
| API contract | Backend (OpenAPI spec) → Frontend (generated types) |
| State management | Frontend (Zustand + React Query) |
| UI rendering | Frontend (React components) |
| Auth token | Backend (JWT) → Frontend (HttpOnly cookie) |

### 23.2 Type Sharing

```
Backend (Python)                    Frontend (TypeScript)
────────────────────────    ────────────────────────────
Pydantic schemas (models)  ←→  Zod schemas (validation)
Enums (enum.py)           ←→  Generated enum types
API endpoints (router.py) ←→  API client (generated)
DB models (models.py)     ←→  Type definitions (generated)
```

**Key**: Never hand-write API types. Always generate from OpenAPI spec. This ensures:
- Types stay in sync
- New fields are automatically available
- No runtime type errors from mismatched expectations

### 23.3 What Stays in Frontend

1. **View concerns**: Layout, positioning, animations, transitions
2. **Interaction concerns**: Form validation (user-facing), optimistic updates, loading states
3. **Presentation concerns**: Formatting dates, currencies, truncating text, status badge colors
4. **Navigation**: Routing, breadcrumbs, deep linking, command palette
5. **Local state**: Modal open/close, selected tabs, form drafts, UI preferences

### 23.4 What Must NOT be in Frontend

1. **Permission logic** (only for display/UX — always re-check backend)
2. **Data integrity rules** (always server-side)
3. **Business workflow orchestration** (agent lifecycle, autonomy evaluation)
4. **Encryption, hashing, secrets** (JWT validation, password hashing)
5. **Resource allocation decisions** (resource engine evaluation logic)

---

## 24. Shared Architecture (Web + Tauri + TUI)

### 24.1 Shared Packages

```
packages/
├── types/                  # Generated from OpenAPI
│   ├── index.ts            # All API types
│   ├── enums.ts            # Enum types (AgentStatus, MembershipRole, etc.)
│   ├── schemas.ts          # Pydantic schema equivalents (Request/Response)
│   └── index.d.ts          # Type-only export
│
├── api-client/             # Typed API client
│   ├── client.ts           # Base client (fetch wrapper)
│   ├── generated/          # Auto-generated endpoint functions
│   ├── auth.ts             # Auth-specific methods
│   └── types.ts            # APIError, PaginatedResponse
│
├── ui/                     # React component library
│   ├── dist/               # Built output
│   └── src/                # Source components
│
└── design-tokens/          # Design token package
    ├── css/                # CSS custom properties
    ├── ts/                 # TypeScript token values
    └── figma/              # Figma variable exports
```

### 24.2 Consumption

```jsonc
// apps/web/package.json
{
  "dependencies": {
    "@nexus/types": "workspace:*",
    "@nexus/api-client": "workspace:*",
    "@nexus/ui": "workspace:*",
    "@nexus/design-tokens": "workspace:*"
  }
}
```

### 24.3 TUI Integration

The TUI (terminal interface) consumes `packages/api-client` and `packages/types` but replaces the UI layer:

```
packages/
├── tui/
│   ├── src/
│   │   ├── cli.ts           # Entry point (Commander.js or yargs)
│   │   ├── commands/        # CLI commands (list-agents, execute-task, etc.)
│   │   ├── components/      # ink/react-ink UI components
│   │   ├── hooks/           # TTY-aware hooks
│   │   └── formatters/      # Text formatters for tables, progress bars
│   └── package.json
│     (depends on @nexus/api-client, @nexus/types)
```

The TUI can share the same API client, auth flow, and type definitions while using a completely different rendering engine (terminal canvas via `ink` or `blessed`).

### 24.4 Type Safety Contract

```
Backend Pydantic schemas  →  OpenAPI spec  →  openapi-typescript  →  packages/types/
                                    ↘
                     API endpoints    →  orval/openapi-typescript  →  packages/api-client/
```

Both the Next.js app and Tauri app import from `packages/types` and `packages/api-client`. This ensures **end-to-end type safety** — a backend schema change propagates to all three frontends.

---

## 25. Build & Deployment

### 25.1 CI/CD Pipeline (Conceptual)

```
1. Backend: python -m ruff check && mypy && pytest
2. Types: openapi-typescript docs.json --output packages/types/index.ts
3. API Client: orval docs.json --output packages/api-client/generated/
4. Web: next build && next export
5. Web Tests: playwright test (e2e)
6. Tauri: cargo build (desktop bundle)
7. TUI: npm run build (CLI package)
8. Deploy: Web → Vercel/S3, Tauri → GitHub Releases, TUI → npm publish
```

### 25.2 Development Workflow

```bash
# Backend
make dev-api            # uvicorn NEIMAN.main:app --reload

# Frontend (Next.js)
cd apps/web && npm run dev  # localhost:3000

# Tauri (desktop)
cd tauri && npm run tauri dev

# Run all
docker-compose up --build
```

### 25.3 SSR / SSG Strategy

- **Static pages**: Blueprint catalog, auth login/register (no auth check needed)
- **SSR pages**: Agent lists, profiles, governance pages (require auth + company context)
- **ISR**: Intelligence dashboard (revalidate every 60s)
- **CSR**: Actions that mutate data (execute task, transition status)

---

## 26. Design Inconsistencies Identified

| Issue | Severity | Recommendation |
|---|---|---|
| Each static HTML has unique color palette | Medium | Unify into one dark theme with per-domain accent colors |
| No shared CSS between static HTMLs | High | Replace with Tailwind + shared design tokens |
| No login/auth flow in prototypes | High | Implement JWT auth with HttpOnly cookies |
| Auth token pasted manually | Critical | Replace with proper login form |
| No responsive design in prototypes | High | Implement mobile-first with breakpoints |
| No type safety | Critical | Generate types from OpenAPI |
| Inline event handlers (`onclick=""`) | Medium | Replace with proper React event handlers |
| Inline styles everywhere | High | Move all to Tailwind classes |
| No accessibility attributes | High | Add ARIA labels, semantic HTML, keyboard nav |
| No error/loading/empty states | High | Implement all three patterns |
| Hardcoded mock data in JS | High | Replace with real API calls |
| `window.location.href` for navigation | Medium | Use Next.js router for SPA navigation |

---

## 27. Frontend/Backend Boundaries Summary

### 27.1 API Contract

The frontend interacts with the backend exclusively through the REST API documented at `/api/openapi.json`. Key principles:

1. **No direct database access** — all data flows through the API
2. **No shared code between frontend and backend** — types are generated from the OpenAPI spec
3. **Backend is the source of truth** for all business logic, validation, and permissions
4. **Frontend is responsible for presentation** — but must not trust any data; always validate

### 27.2 Data Fetching Patterns

| Pattern | Use Case | Libraries |
|---|---|---|
| Server-side fetch (SSR) | Initial page load with auth | Next.js `fetch` in `page.tsx` |
| Client-side fetch (CSR) | Actions, mutations, revalidation | React Query `useQuery`/`useMutation` |
| Polling | Near-realtime data | React Query `refetchInterval` |
| Optimistic updates | Status transitions, form saves | React Query `onMutate` + `onError` rollback |

### 27.3 Error Boundary Strategy

```
Root layout
  <ErrorBoundary>           ← catches all uncaught errors
    <Providers>             ← Auth, Theme, QueryClient
      <AuthGate>            ← redirects to login if not authenticated
        <CompanyGate>       ← redirects to company selector if no company
          <Outbox>          ← React Query error boundary (catches fetch errors)
            <Route handler> ← page-specific error handling
```

---

## 28. Roadmap Integration

This architecture is implemented in phases as defined in `UI_ROADMAP.md`. The shared packages approach ensures that:

1. **Phase 1** (Next.js web) establishes the patterns
2. **Phase 2** (Tauri desktop) reuses 80% of the web code
3. **Phase 3** (TUI) reuses only the API client and types
4. **Phase 4** (Real-time) adds SSE/WebSocket on top of the shared event bus

---

## 29. Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| CSS framework | Tailwind CSS | Rapid development, consistent design tokens, no runtime CSS-in-JS |
| Component library | Custom (`@nexus/ui`) | NEIMAN has unique dark theme requirements; existing libraries don't match |
| Form library | React Hook Form + Zod | Performant, TypeScript-first, Zod schemas can be exported to backend |
| State management | Zustand + React Query | Minimal boilerplate, React Query handles all async, Zustand for UI state |
| Routing | Next.js App Router | File-system routing + nested layouts + loading states |
| Auth storage | HttpOnly cookie | Secure, protected from XSS, automatically sent with requests |
| Type generation | openapi-typescript + orval | Zero manual type maintenance, always in sync |
| Testing | Vitest + React Testing Library + Playwright | Unit, component, and e2e coverage |

## 30. Visual system (2026-09)

The current web shell uses a graphite canvas with lichen-lime action color, shared fine grain, restrained hairline borders, and a mono uppercase eyebrow style for system labels. The Control Room's primary visual is a clickable isometric office: the three team spaces map to the first three department records by ID, agents appear in their assigned room, human approval has its own review suite, and providers remain separate infrastructure. Additional teams and employees are called out and accessible through the full organization graph. A side console exposes people, provider health, memory, governance links, projects, and capacity. SVG geometry is presentation-only. Dashboard navigation is grouped by work area (Operate, Intelligence, Govern), a route-aware location strip spans all pages, and the active route has a quiet inset rail. Shared CSS variables in `src/app/globals.css` remain the source of truth so all dashboard routes inherit the visual identity.

Operational summary cards must derive status labels from loaded data. Do not claim a provider mesh, healthy execution, or ready council unless the corresponding live state supports it. The older `/intelligence` view now reads the active organization from auth state instead of a fixed demo UUID.

The organizational map renders real records only, with links limited to relationships available in the API payload. Provider records map the intelligence API's `available_providers` health fields; request-level metrics remain blank when the API only supplies aggregate usage.
| Build system | npm workspaces | Standard monorepo tooling, widely understood |
