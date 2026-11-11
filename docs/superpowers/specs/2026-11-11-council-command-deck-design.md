# Council & Command Deck Live Sovereign Alignment Design

## 1. Intent & Why
Ensure the NEIMAN OS CTO & Squad Command Chat (`apps/web/src/app/dashboard/councils/page.tsx`, `apps/web/src/components/layout/AppSidebar.tsx`, and `apps/web/src/components/layout/AgentContributionGraph.tsx`) connects to the live FastAPI backend by default, enforces functional engineering role identities (`CTO`, `Architect`, `Security`, `Backend`, `QA Lead`), and complies 100% with `DESIGN.md` and `impeccable detect` (zero `border-l-4` side-tab slop, semantic `SUPPORTS`/`OBJECTS` badges, and `tabular-nums` telemetry).

## 2. Goals, Non-Goals, Anti-Goals
- **Goals**:
  1. Connect live FastAPI backend by default in `apps/web/.env.local` and `scripts/install.sh` (disable `NEXT_PUBLIC_NEIMAN_DEV_AUTH_BYPASS=true` hijacking into the read-only `Northstar Studio` preview fixture during normal runtime while preserving isolated `preview-company-NEIMAN` unit tests).
  2. Standardize agent identities to functional engineering roles (`CTO`, `Architect`, `Security`, `Backend`, `QA Lead`) across `AgentContributionGraph.tsx`, `AppSidebar.tsx`, `councils/page.tsx`, `layout.tsx`, and preview fixtures (`controlRoomPreview.ts`, `previewFixtures.ts`, `WorkflowExecutionPanel.tsx`).
  3. Eliminate `border-l-4` side-tab accent borders in `councils/page.tsx`, replace with uniform 1px hairline borders (`border border-border`), enforce semantic `SUPPORTS` (`emerald`) / `OBJECTS` (`rose`) badges, and add `tabular-nums` to all numeric badges.
  4. Configure the 5-minute **Continuous Architecture & Design Audit** scheduled sidecar automation (`~/.gemini/config/sidecars/continuous-arch-design-audit/sidecar.json`).
- **Non-Goals**: Modifying backend SQLAlchemy database migrations or Rust Tauri shell binaries.
- **Anti-Goals**: Leaving any `border-l-4` classes, hardcoded persona names (`Eli Okafor`, `Sora Patel`, `Mara Chen`, `Noah Williams`), or non-functional read-only preview traps in default local startup.

## 3. Constraints
- Strict TypeScript (`strict: true`, zero untyped `any`).
- Zero `impeccable detect` warnings across `councils/page.tsx` and `AppSidebar.tsx`.
- All existing Jest and Pytest unit tests must pass.

## 4. Approaches Considered
- **Option A (Selected)**: Full-stack alignment — connect live FastAPI backend by default, replace persona names with functional roles across UI + preview fixtures + tests, and polish `councils/page.tsx` to strict `DESIGN.md` compliance.
- **Option B**: UI-only surface patch inside `councils/page.tsx`. Rejected because `.env.local` would still trap the app in read-only preview mode (`Northstar Studio`) and show persona names in `AgentContributionGraph`.
- **Option C**: Backend-only reseed. Rejected because frontend `border-l-4` and `.env.local` preview bypass would remain broken.
