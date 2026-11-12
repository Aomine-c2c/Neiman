# Council & Command Deck Live Sovereign Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the NEIMAN OS CTO & Squad Command Deck with live FastAPI backend state, functional role identities (`CTO`, `Architect`, `Security`, `Backend`, `QA Lead`), and strict `DESIGN.md` / `impeccable` visual rules.

**Architecture:** Remove the default `NEXT_PUBLIC_NEIMAN_DEV_AUTH_BYPASS=true` override in `.env.local` and `scripts/install.sh` so the web client connects directly to the live FastAPI backend (`NovaForge Technologies`), map agent slugs/roles cleanly in `layout.tsx` and `AppSidebar.tsx`, replace persona names with functional role identities across `AgentContributionGraph.tsx` and preview fixtures, and strip `border-l-4` side-tab borders in `councils/page.tsx` while enforcing semantic telemetry badges and `tabular-nums`.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, React Query, Jest / React Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-11-council-command-deck-design.md`

## Global Constraints

- Zero `border-l-4` side-tab accent borders on cards (`DESIGN.md` & `impeccable detect`).
- All numeric metrics, confidence percentages, quorum weights, and VCS counters must include `tabular-nums`.
- Functional role identities (`CTO`, `Architect`, `Security`, `Backend`, `QA Lead`) replace persona names (`Mara Chen`, `Eli Okafor`, `Sora Patel`, `Noah Williams`).
- Strict TypeScript (`0` errors on `npx tsc --noEmit`).

## Review Focus

1. Backend agent records where `role_title` is `null` in JSON: derive functional role label from `identity.slug` or `name` (`CTO`, `Architect`, `Security`, `Backend`, `QA Lead`) in `layout.tsx` and `AppSidebar.tsx` instead of falling back to generic `@Specialist`.
2. Council review cards with objections (`rev.objections.length > 0`): render `OBJECTS` badge with `bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 tabular-nums` and `SUPPORTS` badge with `bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 tabular-nums` per `DESIGN.md`.
3. `AgentContributionGraph` filter chips: filter by functional role IDs (`cto`, `architect`, `security`, `backend`, `qa`) matching both live backend agent names/slugs and preview events.
4. Preview isolation tests (`clientPreview.test.ts`, `OrganizationOffice.test.tsx`, `AgentContributionGraph.test.tsx`): update assertions to match functional role identities while preserving `NEXT_PUBLIC_NEIMAN_DEV_AUTH_BYPASS=true` test isolation.
5. `councils/page.tsx` `getRoleAccentBorder` removal: remove unused `border-l-*` helper so no dead code or `border-l-4` class remains.

---

### Task 1: Functional Role Identities in `AgentContributionGraph`, `AppSidebar`, and `layout.tsx`

**Files:**
- Modify: `apps/web/src/components/layout/AgentContributionGraph.tsx`
- Modify: `apps/web/src/components/layout/AgentContributionGraph.test.tsx`
- Modify: `apps/web/src/components/layout/AppSidebar.tsx`
- Modify: `apps/web/src/app/dashboard/layout.tsx`

**Interfaces:**
- Produces: `DEFAULT_AGENTS` in `AgentContributionGraph.tsx` with `{ id, name, shortName }` for `CTO`, `Architect`, `Security`, `Backend`, `QA Lead`, and `resolveFunctionalRole(agent)` in `layout.tsx`.

- [ ] **Step 1: Update `AgentContributionGraph.test.tsx` to assert functional role filter chips (`CTO`, `Architect`, `Security`, `Backend`, `QA Lead`)**
- [ ] **Step 2: Run Jest on `AgentContributionGraph.test.tsx` to verify it fails**
  Run: `npm --prefix apps/web test -- src/components/layout/AgentContributionGraph.test.tsx`
- [ ] **Step 3: Update `DEFAULT_AGENTS` in `AgentContributionGraph.tsx` and role resolution in `layout.tsx` & `AppSidebar.tsx`**
- [ ] **Step 4: Run Jest on `AgentContributionGraph.test.tsx` to verify it passes**
  Run: `npm --prefix apps/web test -- src/components/layout/AgentContributionGraph.test.tsx`

---

### Task 2: Sovereign Monochrome Card Polish & `border-l-4` Removal in `councils/page.tsx`

**Files:**
- Modify: `apps/web/src/app/dashboard/councils/page.tsx`

**Interfaces:**
- Consumes: `DESIGN.md` card and telemetry badge specifications.
- Produces: Zero `impeccable detect` warnings on `councils/page.tsx`.

- [ ] **Step 1: Remove `border-l-4` and `getRoleAccentBorder` in `apps/web/src/app/dashboard/councils/page.tsx`, enforce `DESIGN.md` semantic `SUPPORTS`/`OBJECTS` badges and `tabular-nums` across confidence, quorum, and git counters**
- [ ] **Step 2: Run `impeccable detect` to verify 0 findings**
  Run: `.agents/skills/impeccable/scripts/impeccable detect --json apps/web/src/app/dashboard/councils/page.tsx apps/web/src/components/layout/AppSidebar.tsx`
  Expected: `[]` (exit code 0)

---

### Task 3: Functional Role Identities in Preview Fixtures & Live Backend Default Connection

**Files:**
- Modify: `apps/web/src/lib/api/controlRoomPreview.ts`
- Modify: `apps/web/src/lib/api/previewFixtures.ts`
- Modify: `apps/web/src/components/control-room/panels/WorkflowExecutionPanel.tsx`
- Modify: `apps/web/src/components/OrganizationOffice.test.tsx`
- Modify: `apps/web/.env.local`
- Modify: `scripts/install.sh`

**Interfaces:**
- Produces: Functional role identities across all preview fixtures and live backend connection by default (`NEXT_PUBLIC_NEIMAN_DEV_AUTH_BYPASS=false` in `.env.local` and `scripts/install.sh`).

- [ ] **Step 1: Update `OrganizationOffice.test.tsx` to assert functional role names (`Chief Technology Agent`, `Systems Architect Agent`, `Cybersecurity Agent`, `Quality Assurance Agent`)**
- [ ] **Step 2: Update `controlRoomPreview.ts`, `previewFixtures.ts`, `WorkflowExecutionPanel.tsx`, `.env.local`, and `scripts/install.sh`**
- [ ] **Step 3: Run Jest suite across `OrganizationOffice.test.tsx`, `clientPreview.test.ts`, and `previewFixtures.test.ts` plus `tsc --noEmit`**
  Run: `npm --prefix apps/web test -- src/components/OrganizationOffice.test.tsx src/lib/api/clientPreview.test.ts src/lib/api/previewFixtures.test.ts && npm --prefix apps/web exec tsc -- --noEmit`
  Expected: PASS with 0 errors.
