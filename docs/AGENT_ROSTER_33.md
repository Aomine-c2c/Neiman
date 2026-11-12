# NEIMAN / Sila 33-Agent Canonical Roster & Hiring Architecture

## 1. Capacity Model
- **Seat 0 (Outside 33 Cap)**: `ceo` — Human Sovereign via Sila UI Decision Cards & CLI only.
- **Core Seeded AI Agents (22 Slots)**: Provisioned by default in `apps/api/nexora/domains/blueprints/catalog.py` with `soul.md` + `SKILLS.md` under `apps/api/nexora/domains/agents/souls/<slug>/`.
- **Reserved Dynamic / External Slots (11 Slots, 23–33)**: Dynamically provisioned by `cto_agent` via `CTOService.hire_agent` (`POST /api/v1/companies/{company_id}/cto/hire`), hard-capped at `AgentService.MAX_COMPANY_AGENTS = 33` non-retired agents.
  - **Temporary / External Contractors** (e.g., `hermes`): Autonomous within the 33 cap; external proxies receive a lightweight proxy `soul.md`, worktree/branch scoping, and `security_lead_auto_audit: true` on per-task MCP grants.
  - **Permanent Internal Hires** (e.g., `customer_ops_agent` when needed): Provisioned in `PAUSED` state with `pending_ceo_approval: true` until CEO 1-click Decision Card approval.

## 2. Core 22 Seeded AI Agents

| # | Biblical Name | Slug | Department | Role Title | Key Gates / Authority |
|---|---|---|---|---|---|
| 1 | Solomon | `cto_agent` | Executive Leadership | Chief Technology Officer | Coordinator-only; hires up to 33 cap; external dispatch |
| 2 | Esther | `cpo_agent` | Executive Leadership | Chief Product Officer | Hard sign-off gate on PRD & UX acceptance |
| 3 | Nehemiah | `coo_agent` | Executive Leadership | Chief Operating Officer | Auto-pauses non-critical workflows & rotates models on quota spikes |
| 4 | Bezalel | `lead_architect_agent` | Product & Architecture | Lead Software Architect | Hard PR block on circular deps & boundary/schema breaks |
| 5 | Daniel | `product_spec_agent` | Product & Architecture | Product Spec Manager | Hard gate: eng dispatch blocked until specs + 4 UI states ratified |
| 6 | Miriam | `ui_ux_designer_agent` | Product & Architecture | UI/UX Design Lead | Hard PR gate on UI Light/Dark parity, contrast, 4-state UI |
| 7 | Nicodemus | `research_intel_agent` | Product & Architecture | Research & Intelligence Lead | Tunes routing/tiers; new paid providers need CTO + CEO |
| 8 | Joshua | `engineering_lead_agent` | Core Engineering | Engineering Lead | Player-coach; merges to integration/`main` once gates green |
| 9 | Luke | `backend_engineer_agent` | Core Engineering | Senior Backend Engineer | Hard TDD gate: `pytest` (200/400/404/500) + `mypy`/`ruff` |
| 10 | Ruth | `frontend_engineer_agent` | Core Engineering | Senior Frontend / UI Engineer | Next.js + Tauri; `tsc` + `eslint` + tests + 4-state UI |
| 11 | Ezra | `database_engineer_agent` | Core Engineering | Database & Migrations Engineer | `upgrade->downgrade->upgrade` round-trip; drops need CEO |
| 12 | Enoch | `ai_ml_engineer_agent` | Core Engineering | AI & Agent Systems Engineer | Owns `adapters/`, `execution.py`, `mcp.py`, `memory/`, `external_agents.py` |
| 13 | Gideon | `qa_lead_agent` | Quality & Reliability | QA & Verification Lead | Hard veto on PRs & Stage 4 release if tests fail or <80% diff cov |
| 14 | Deborah | `qa_automation_agent` | Quality & Reliability | QA Test Automation Engineer | `pytest`/`Vitest`/`Playwright`/`cargo`; test files only |
| 15 | Michael | `security_sentinel_agent` | Security & Compliance | Security & Governance Lead | Immediate suspend tripwire on anomalous/external agents |
| 16 | Gabriel | `sre_guard_agent` | Quality & Reliability | SRE & Performance Guard | Auto-trips breakers & instant rollback on P99/error-rate breach |
| 17 | Noah | `devops_release_agent` | Infrastructure & Operations | DevOps & Release Lead | Staging autonomous; Prod gated on Stage 5 CEO Decision Card |
| 18 | Nathan | `code_reviewer_agent` | Code Quality & Governance | Code Reviewer & Quality Sentinel | Read-only hard merge gate on every PR |
| 19 | Jethro | `scrum_master_agent` | Product & Architecture | Scrum Master & Workflow Coordinator | Reassigns >5m stalled tasks; >2-cycle deadlocks to CTO |
| 20 | Baruch | `technical_writer_agent` | Documentation & Knowledge | Technical Writer | Hard gate on public API/CLI docs & OpenAPI before release |
| 21 | Samuel | `knowledge_eval_agent` | Documentation & Knowledge | Knowledge, Eval & Evolution Lead | Proposes `SKILLS.md` (CTO) and `soul.md` (CEO) evolutions |
| 22 | Joseph | `growth_bd_agent` | Growth & Ecosystem | Business Development & Growth Lead | External publication / binding terms gated on CEO approval |
