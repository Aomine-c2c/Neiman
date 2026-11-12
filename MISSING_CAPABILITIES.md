# MISSING CAPABILITIES & GAP ANALYSIS — NEIMAN

> **Historical roadmap snapshot, not a current capability inventory.** The “Implemented” and “Remaining” classifications below were not revalidated and may be stale. In particular, paths under `NEIMAN/` do not match the current `apps/api/nexora/` package, and source presence is not operational verification. See [the 2026-10-27 architecture review](docs/NEIMAN_ARCHITECTURE_REVIEW_2026-10-27.md) for current repository evidence and gaps.

**Audit Date:** 2026-09-29  
**Scope:** Production-Ready Autonomous Organization OS Roadmap  

---

## 1. Implemented Capabilities (Verified Operational)

| Domain | Implemented Features | Evidence |
| :--- | :--- | :--- |
| **Organizations & Core** | Companies, Departments, Roles, DNA, Membership RBAC | `NEIMAN/domains/organizations/`, tested |
| **Workforce & Agents** | Full 7-stage lifecycle, capabilities, hierarchy, communications | `NEIMAN/domains/agents/`, tested |
| **Intelligence Exchange** | Provider abstraction (Claude, Gemini, OpenAI), capability routing | `NEIMAN/domains/intelligence/`, tested |
| **Resource Engine** | Compute, intelligence tokens, financial budgets, scheduling | `NEIMAN/domains/resources/`, tested |
| **Governance & Policies** | 6-level autonomy matrix (0-5), approval gates, audit viewer | `NEIMAN/domains/governance/`, tested |
| **Workflow Engine** | Triggers, conditions, retries, branching, human-in-the-loop, observability | `NEIMAN/domains/workflows/`, tested |
| **Agent Councils** | Multi-model deliberation (7 stages), dissent knowledge capture | `NEIMAN/domains/councils/`, tested |
| **Company Control Room** | Mission Control dashboard, interactive canvas organizational graph | `apps/web/src/app/dashboard/`, live |

---

## 2. Capabilities Remaining to Implement

| Phase | Capability | Priority | Description |
| :---: | :--- | :---: | :--- |
| **11** | **Organizational Performance** | High | Multi-dimensional KPI tracking across company, departments, agents, models, and tasks. |
| **12** | **Evolution Engine** | Critical | Continuous observation of bottlenecks and proposed adaptations with immutable snapshots and rollback. |
| **13** | **Simulation Lab** | High | Isolated sandboxed organizational simulations to evaluate alternative agent structures and model routing. |
| **14** | **Natural Language "Build My Company"** | High | Conversational onboarding flow generating fully instantiated companies from natural-language descriptions. |
| **15** | **Multi-Provider Resilience Mesh** | Critical | Circuit breakers, adaptive timeouts, and automatic failovers between Claude, Gemini, and OpenAI. |
| **16** | **Security Hardening** | Critical | Adversarial prompt injection defense, strict sandboxing for agent tools, and data loss prevention rules. |
| **17** | **Self-Diagnostics** | Medium | Automated platform health probes, schema invariant validation, and regression test suites. |
