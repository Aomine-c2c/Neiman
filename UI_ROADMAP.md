# NEIMAN Frontend UI Roadmap

> **Status:** Implementation in progress
> **Goal:** Build a production-grade Next.js frontend for NEIMAN that replaces all 6 static HTML prototypes
> **Approach:** Phase-based delivery — core functionality first, then enhancements, then platform extensions

> **Implementation update (2026-09-30):** `apps/web` is now an operational Next.js dashboard with auth, organization management, agents, workflows, councils, memory, governance, resources, blueprints, intelligence, evolution, and decision routes. This plan is a backlog, not a statement that these planned tasks are all still untouched. The latest implemented items are documented in `FRONTEND_TECHNICAL_DEBT.md`; project/task management, comprehensive accessibility review, preferences, and broader end-to-end coverage remain open.

---

## Phase 0: Foundation (Week 1–2)

**Goal:** Scaffold the monorepo, shared packages, and foundational infrastructure.

### Tasks

| # | Task | Details |
|---|---|---|
| 0.1 | Initialize `apps/web/` | Create Next.js 14+ project with App Router, TypeScript, Tailwind CSS |
| 0.2 | Set up `packages/` monorepo | npm/yarn workspaces: `types`, `api-client`, `ui`, `design-tokens` |
| 0.3 | Generate types from OpenAPI | Use `openapi-typescript` to generate `packages/types/` from backend's `/api/openapi.json` |
| 0.4 | Generate API client | Use `orval` or `openapi-typescript` to generate typed hooks in `packages/api-client/` |
| 0.5 | Configure shared Tailwind | Tailwind config in `packages/ui/`, extended with design tokens |
| 0.6 | Set up testing stack | Vitest (unit), React Testing Library (component), Playwright (e2e) |
| 0.7 | CI/CD pipeline | GitHub Actions: lint → test → build → type-check |

### Deliverables

- `apps/web/` with dev server running at `http://localhost:3000`
- `packages/types/` with all backend API types generated
- `packages/api-client/` with typed API functions
- Basic auth flow: login page → JWT → HttpOnly cookie

### Acceptance Criteria

- `npm run dev` starts the dev server
- Login page renders and can POST to `/api/v1/auth/login`
- JWT is stored in HttpOnly cookie
- Protected routes redirect to login when no cookie
- Type generation completes without errors

---

## Phase 1: Core MVP — Agent Inspector (Week 3–4)

**Goal:** Replace `agent_profile.html` with a fully-typed Next.js page. This is the highest-priority UI surface — it represents the core "employee profile" concept.

### Tasks

| # | Task | API Endpoints |
|---|---|---|
| 1.1 | Layout component | Shared header + sidebar navigation |
| 1.2 | Auth provider & middleware | JWT cookie → `/auth/me` on load |
| 1.3 | Company context selector | `/companies/me` to list user's companies |
| 1.4 | Agent list page | `GET /companies/{id}/agents` |
| 1.5 | Agent profile page | `GET /companies/{id}/agents/{id}/profile` |
| 1.6 | Status badge component | Map `AgentStatus` enum to color + icon |
| 1.7 | Tab system | Audits / Memories / Communications tabs |
| 1.8 | Status transition modal | `POST /companies/{id}/agents/{id}/transition` |
| 1.9 | Audit timeline | `GET /companies/{id}/agents/{id}/audits` |
| 1.10 | Memory list | `GET /companies/{id}/agents/{id}/memories` |
| 1.11 | Transition validation | Enforce `VALID_TRANSITIONS` rules in frontend |
| 1.12 | Loading skeletons | Agent profile hero + metric rows |
| 1.13 | Error boundaries | 404 for invalid agent ID |

### Design Deliverables

- Agent profile page matches `agent_profile.html` visual design
- Status tags use unified color system (see DESIGN_SYSTEM.md §5.2)
- Responsive: sidebar collapses to hamburger on mobile

### Acceptance Criteria

- Agent list shows all agents with live status badges
- Clicking an agent navigates to `/agents/[id]`
- Profile page shows: avatar, status, autonomy, role/department, instructions, intelligence config, tools, resource usage, performance metrics, audits timeline, memories
- Status transition dropdown enforces valid transitions only
- All 7 `AgentStatus` values are correctly color-coded

---

## Phase 2: Governance & Control Center (Week 4–5)

**Goal:** Replace `governance_dashboard.html` and `resource_control_center.html`. These are the second and third most important UI surfaces.

### Tasks

| # | Task | API Endpoints |
|---|---|---|
| 2.1 | Governance constitution page | `GET/PATCH /companies/{id}/governance/constitution` |
| 2.2 | Action evaluator | `POST /companies/{id}/governance/evaluate-action` |
| 2.3 | Autonomy matrix | `GET/POST /companies/{id}/governance/autonomy-configs` |
| 2.4 | Approvals list + decision | `GET /companies/{id}/governance/approvals`, `POST /approvals/{id}/decision` |
| 2.5 | Escalations list + resolve | `GET/POST /companies/{id}/governance/escalations`, `POST /escalations/{id}/resolve` |
| 2.6 | Audit query | `GET /companies/{id}/governance/audits` |
| 2.7 | Intelligence dashboard | `GET /companies/{id}/intelligence/dashboard` |
| 2.8 | Model provider catalog | `GET /companies/{id}/intelligence/providers`, `GET /intelligence/models` |
| 2.9 | Resource control center | `GET /companies/{id}/resources/control-center` |
| 2.10 | Resource pools table | `GET /companies/{id}/resources/pools` |
| 2.11 | Resource budgets | `GET /companies/{id}/resources/budgets` |
| 2.12 | Resource request evaluator | `POST /companies/{id}/resources/requests` |
| 2.13 | Cost/spend charts | Use Recharts: bar chart (spend by provider), progress bars (budget utilization) |

### Acceptance Criteria

- Constitution page shows amendment history with diff view
- Action evaluator returns APPROVE/DENY/REDUCE/DEFER/QUEUE with reason
- Approvals table shows pending + historical with decision buttons
- Resource control center matches `resource_control_center.html` design (stats grid + pools table + evaluator)
- Intelligence dashboard matches `intelligence_dashboard.html` design

---

## Phase 3: Blueprints & Memory (Week 5–6)

**Goal:** Replace `company_blueprints.html` and `organizational_memory.html`.

### Tasks

| # | Task | API Endpoints |
|---|---|---|
| 3.1 | Blueprints catalog | `GET /blueprints` |
| 3.2 | Blueprint inspector | `GET /blueprints/{id_or_key}` |
| 3.3 | Blueprint instantiation | `POST /blueprints/{id}/instantiate` |
| 3.4 | Build My Company | `POST /blueprints/build-my-company`, `GET /blueprints/build-my-company/{id}` |
| 3.5 | Blueprint import/export | `POST /blueprints/import`, `GET /blueprints/{id}/export` |
| 3.6 | Memory knowledge base | `GET /companies/{id}/memory/items` |
| 3.7 | Memory search | `GET /companies/{id}/memory/search?q=...` |
| 3.8 | Context assembly | `POST /companies/{id}/memory/assemble-context` |
| 3.9 | Decision records | `GET/POST /companies/{id}/memory/decisions`, `POST /decisions/{id}/outcome` |
| 3.10 | Domain filter pills | Filter memory items by domain (10 domains) |
| 3.11 | Context assembly pipeline | Interactive form for task → knowledge → minimal prompt |
| 3.12 | Blueprint proposal modal | Multi-step: NL prompt → cost estimate → risks → approve/instantiate |

### Acceptance Criteria

- Blueprints catalog shows all preconfigured blueprints with category filtering
- "Build My Company" accepts natural language prompt and renders proposal
- Memory knowledge base supports search + domain filtering (10 domains)
- Context assembly engine builds minimal prompt with permission filtering
- Decision records show full deliberation → outcome → lessons learned

---

## Phase 4: Projects & Tasks (Week 6–7)

**Goal:** Implement the project/task management surface — the workflow engine integration.

### Tasks

| # | Task | API Endpoints |
|---|---|---|
| 4.1 | Projects list | `GET /companies/{id}/projects` |
| 4.2 | Project detail page | `GET /companies/{id}/projects/{id}` |
| 4.3 | Task board (Kanban) | `GET /companies/{id}/projects/{id}/tasks` |
| 4.4 | Create/Edit project | `POST /projects`, `PATCH /projects/{id}` |
| 4.5 | Create/Edit task | `POST /tasks`, `PATCH /tasks/{id}` |
| 4.6 | Task execution | `POST /companies/{id}/tasks/{id}/execute` (if exists) |
| 4.7 | Task status flow | Match backend `TaskStatus` enum |
| 4.8 | Project metrics | Budget, timeline, progress visualization |
| 4.9 | Gantt-style timeline | For project deadlines/milestones |

### Acceptance Criteria

- Kanban board with drag-and-drop status transitions
- Task creation form with dependency selection
- Project detail shows metrics charts
- Task execution triggers agent assignment

---

## Phase 5: Company Management & Settings (Week 7)

**Goal:** Implement the company/org management surface — the foundation for multi-tenancy.

### Tasks

| # | Task | API Endpoints |
|---|---|---|
| 5.1 | Company switcher | `/companies/me` → current company context |
| 5.2 | Company detail | `GET/PATCH /companies/{id}` |
| 5.3 | Company DNA editor | `GET/PUT /companies/{id}/dna`, `PATCH /dna` |
| 5.4 | Departments management | CRUD for `/departments/` |
| 5.5 | Roles management | CRUD for `/roles/` |
| 5.6 | Members management | CRUD for `/members/` (invite, role change, remove) |
| 5.7 | Company switcher dropdown | Top-level in header |
| 5.8 | Role-based UI hiding | Hide elements based on `MembershipRole` |

### Acceptance Criteria

- Company switcher works across all pages
- DNA editor has markdown/YAML textarea with syntax highlighting
- Department/role/member tables support inline editing
- Role-based: only OWNER/ADMIN can delete company, only ADMIN+ can manage members

---

## Phase 6: Enhancements & Polish (Week 8–9)

**Goal:** Production-quality improvements across all surfaces.

### Tasks

| # | Task | Priority |
|---|---|---|
| 6.1 | Command palette (`Cmd+K`) | High |
| 6.2 | Global notification system | High |
| 6.3 | Keyboard shortcuts guide | Medium |
| 6.4 | Dark/light mode toggle | Low (currently dark-only) |
| 6.5 | Loading skeletons everywhere | High |
| 6.6 | Empty state illustrations | Medium |
| 6.7 | Error boundaries (route-level) | High |
| 6.8 | Accessibility audit | High |
| 6.9 | Internationalization (i18n) | Future |
| 6.10 | Search bar in header | Medium |
| 6.11 | User profile dropdown | Medium |
| 6.12 | Data export buttons | Low |

### Acceptance Criteria

- `Cmd+K` opens command palette searchable across all entities
- Notifications appear as toasts with auto-dismiss
- Loading skeletons match final content layout (no layout shift)
- Empty states include helpful text and primary CTA
- All interactive elements have visible focus rings
- Keyboard navigation works end-to-end (Tab, arrows, Enter, Escape)

---

## Phase 7: Real-time Features (Week 10–11)

**Goal:** Add real-time updates for approvals, escalations, and agent execution.

### Tasks

| # | Task | Notes |
|---|---|---|
| 7.1 | SSE client library | `EventSource` connection to `/api/v1/events/` |
| 7.2 | Event bus | Global event dispatcher in `lib/events.ts` |
| 7.3 | Push notifications | Browser notifications for approvals |
| 7.4 | Live approval badges | Unread count in nav + header |
| 7.5 | Agent execution streaming | Stream execution steps to UI |
| 7.6 | Resource telemetry polling | Auto-refresh control center every 30s |
| 7.7 | Audit live feed | New audit entries appear without refresh |

### Acceptance Criteria

- New approvals appear in header badge within 1s of creation
- Agent status changes reflect immediately in agent list
- Resource control center auto-refreshes with smooth transitions
- SSE connection auto-reconnects on network blip

---

## Phase 8: Tauri Desktop (Week 12+)**

**Goal:** Package the same Next.js app into a Tauri desktop application with native capabilities.

### Tasks

| # | Task | Notes |
|---|---|---|
| 8.1 | Initialize Tauri project | `tauri init` with `apps/web/` as frontend |
| 8.2 | Native file system | Import/export blueprint JSON files |
| 8.3 | System tray | Background agent status indicator |
| 8.4 | Deep linking | `nexus://` protocol for agent links |
| 8.5 | Native notifications | OS notifications for approvals |
| 8.6 | App updates | Auto-update via Tauri plugin |
| 8.7 | Menu bar app | macOS dock/menu bar integration |
| 8.8 | Keyboard shortcuts | Global shortcuts for common actions |
| 8.9 | Window state | Persist size/position across launches |
| 8.10 | DevTools toggle | `Cmd/Ctrl+D` to toggle dev tools |

### Acceptance Criteria

- Desktop app launches and loads the same UI as web
- File → Import Blueprint opens native file picker
- System tray shows agent status colors
- Deep links (`nexus://agents/{id}`) open specific agent profiles
- Native OS notifications fire for pending approvals

---

## Phase 9: TUI / Terminal Interface (Week 13+)**

**Goal:** Terminal-based interface sharing the same API client and types.

### Tasks

| # | Task | Notes |
|---|---|---|
| 9.1 | Initialize CLI project | `packages/tui/` with `ink` (React for terminal) |
| 9.2 | Auth flow | Login + JWT stored in keychain |
| 9.3 | Agent dashboard view | Agent list with status + quick actions |
| 9.4 | Command execution | `NEIMAN agent execute <id> --task "..."` |
| 9.5 | Interactive forms | Terminal-based form filling |
| 9.6 | Live output streaming | Terminal output during task execution |
| 9.7 | Table views | `NEIMAN list agents`, `NEIMAN list tasks` |
| 9.8 | Help system | `NEIMAN help` with command reference |

### Acceptance Criteria

- `NEIMAN login` authenticates and stores token
- `NEIMAN agents` shows interactive agent list
- `NEIMAN execute --agent <id> --task "..."` runs and streams output
- `NEIMAN approvals` shows pending approvals with accept/reject keys
- All commands show spinner/loading states during API calls

---

## Phase 10: Testing & Quality Assurance (Ongoing)

**Goal:** Ensure the frontend is production-ready with comprehensive test coverage.

### Tasks

| # | Task | Tool | Scope |
|---|---|---|---|
| 10.1 | Unit tests | Vitest | Utility functions, store logic, hooks |
| 10.2 | Component tests | RTL + Vitest | All `components/ui/` primitives, feature components |
| 10.3 | E2E tests | Playwright | Login → Agent profile → transition status → verify |
| 10.4 | Visual regression | Storybook + Chromatic | All component states |
| 10.5 | Accessibility tests | axe-core | All pages, automated + manual |
| 10.6 | Performance tests | Lighthouse | P90 LCP < 1.5s, FID < 100ms |
| 10.7 | Type tests | `tsc --noEmit` | Zero type errors against generated types |
| 10.8 | Linting | ESLint + Prettier | Auto-fix on commit |

### Acceptance Criteria

- `npm test` passes all tests
- `npm run test:e2e` runs 20+ Playwright scenarios
- Lighthouse score ≥ 90 on all metrics
- Zero TypeScript errors
- Zero ESLint errors
- All components have Storybook stories with dark theme showcase

---

## Priority Matrix

### Must-Have (Phases 0–4)

| Feature | Phase | Value |
|---|---|---|
| Authentication | Phase 0 | Critical |
| Agent Profile Inspector | Phase 1 | Core product |
| Governance Dashboard | Phase 2 | Trust & Safety |
| Resource Control Center | Phase 2 | Cost Management |
| Blueprints & Build-My-Company | Phase 3 | Rapid Onboarding |
| Memory Knowledge Base | Phase 3 | Context Engine |
| Projects & Tasks | Phase 4 | Workflow Core |
| Company Management | Phase 5 | Multi-tenant |

### Should-Have (Phases 6–7)

| Feature | Phase | Value |
|---|---|---|
| Command Palette | Phase 6 | Power user UX |
| Notifications | Phase 6 | Engagement |
| Real-time SSE | Phase 7 | Safety |
| Agent execution streaming | Phase 7 | Transparency |

### Could-Have (Phases 8–10)

| Feature | Phase | Value |
|---|---|---|
| Tauri Desktop | Phase 8 | Enterprise deployment |
| TUI Interface | Phase 9 | Developer power user |
| Full test suite | Phase 10 | Reliability |

---

## Timeline Summary

| Phase | Duration | Key Deliverable |
|---|---|---|
| 0 | Week 1–2 | Monorepo + types + auth |
| 1 | Week 3–4 | Agent Inspector (replaces agent_profile.html) |
| 2 | Week 4–5 | Governance + Resource Center (replaces 2 HTMLs) |
| 3 | Week 5–6 | Blueprints + Memory (replaces 2 HTMLs) |
| 4 | Week 6–7 | Projects & Tasks |
| 5 | Week 7 | Company Management & Settings |
| 6 | Week 8–9 | Command palette, notifications, polish |
| 7 | Week 10–11 | Real-time updates (SSE, streaming) |
| 8 | Week 12+ | Tauri Desktop packaging |
| 9 | Week 13+ | TUI / terminal interface |
| 10 | Ongoing | Testing & QA |

**Note:** Phases 8 and 9 are marked for future consideration — they depend on the core web app being stable. Phase 10 (testing) runs continuously throughout.

---

## Success Metrics

By the end of Phase 3 (replacing all 6 static HTML pages), we will measure:

1. **Functional parity**: All 6 prototype UIs have Next.js equivalents
2. **Type safety**: Zero TypeScript errors against generated backend types
3. **Performance**: Lighthouse score ≥ 90 on desktop, ≥ 85 on mobile
4. **Accessibility**: WCAG 2.1 AA pass rate ≥ 95%
5. **Developer experience**: `npm run dev` starts in < 3s, hot reload in < 500ms
6. **Bundle size**: Initial JS bundle < 250KB (excluding fonts)
7. **API coverage**: 100% of endpoints used by UI are type-safe

---

## Next Steps

## Frontend cycle update — 2026-09-30

- **Completed:** established graphite/lime visual tokens, grouped navigation, added a responsive authentication composition, populated the local-only UI preview across dashboard routes, and reframed the Control Room as an interactive isometric office with a distinct provider switchboard, memory archive, policy perimeter, and human review suite. Department names and employee locations follow organization records by ID; additional teams are clearly called out and remain available in the organization graph. The preview is read-only and API mode keeps data-led status and unavailable states.
- **Verified:** lint, TypeScript, all 20 Jest tests (including room/person selection, keyboard inspection, and extra-department mapping), `git diff --check`, and optimized Next.js production build pass.
- **Next:** audit every route at narrow/mobile widths, add browser-level visual coverage, and measure real-user loading/accessibility performance. Local dashboard preview uses the explicit development-only bypass and synthetic read-only fixtures.

1. **Approve this roadmap** — confirms scope and priorities
2. **Create `apps/web/` and `packages/`** — start Phase 0
3. **Set up OpenAPI type generation** — ensures all subsequent work is type-safe from day 1
