# NEIMAN Shared Company Governance Policies

**Version:** 1.0.0  
**Effective Date:** 2026-10-28  
**Scope:** Universal baseline policies inherited by all 13 organizational positions.

---

## 1. Policy Inheritance Framework

Every position in NEIMAN automatically inherits this shared policy framework. Position-specific permissions (`PERMISSIONS.md`) can narrow restrictions or specify authorized tools, but **cannot override or expand beyond** these company-wide governance baselines:

1. **Deny-by-Default:** Any tool, API endpoint, or resource not explicitly whitelisted in a position's `PERMISSIONS.md` is strictly forbidden.
2. **Inherited Prohibitions:** All prohibitions defined in the Company Constitution take precedence over any departmental or role-level directive.
3. **Subordinate Autonomy:** A position's effective autonomy level cannot exceed its supervisor's autonomy ceiling.

---

## 2. Escalation Matrix & Chain of Command

When an agent encounters a blocker, policy ambiguity, risk condition, or resource exhaustion, it must route an escalation through the official chain of command:

| Position Tier | Position Title | Direct Supervisor | Escalation Authority |
|---|---|---|---|
| **Tier 1 (Executive)** | CEO (Human Owner) | Sovereign Board / Self | Final arbitration, constitutional amendments, capital decisions |
| **Tier 1 (Executive)** | COO | CEO | Cross-departmental operational deadlocks, SLA breaches |
| **Tier 1 (Executive)** | CTO | CEO | Technological deadlocks, irreversible architecture changes |
| **Tier 1 (Executive)** | CPO | CEO | Product strategy pivots, mission alignment disputes |
| **Tier 2 (Leads)** | Software Architect | CTO | Domain model disputes, breaking API contract changes |
| **Tier 2 (Leads)** | Engineering Lead | CTO | Unresolvable build failures, sprint delivery blockers |
| **Tier 2 (Leads)** | UI/UX Design Lead | CPO | Design system divergence, severe accessibility failures |
| **Tier 2 (Leads)** | QA & Verification Lead | CTO | Critical security/functional defects blocking release |
| **Tier 2 (Leads)** | DevOps & Infrastructure Lead | CTO | Production outages, infrastructure quota exhaustion |
| **Tier 2 (Leads)** | Security & Governance Lead | CEO / CTO | High-severity vulnerability alerts, prompt injection attacks |
| **Tier 2 (Leads)** | Research & Intelligence Lead | CTO | Model provider outage, severe inference cost overruns |
| **Tier 2 (Leads)** | Business Development & Growth Lead | COO | Partner contractual obligations, integration liabilities |
| **Tier 2 (Leads)** | Knowledge/Evaluation/Evolution Lead | CTO | Evaluation rubric drift, persistent regression patterns |

---

## 3. Resource Allocation & Financial Governance

1. **Daily Token Ceilings:** Every agent operates under a daily token budget. If an agent reaches 80% of its allocation, a telemetry warning is dispatched to the COO. At 100%, execution is paused until the next UTC midnight or explicit budget grant by the human CEO.
2. **Model Selection Priority:** Agents must route requests through the most cost-effective tier capable of satisfying task requirements. High-cost reasoning models (e.g. Gemini 3.1 Pro, Claude 3.5 Sonnet) are reserved for architecture, security audits, and complex coding. Standard tasks use Tier-2 models.
3. **Negative Drift Prevention:** Budget reservations are checked atomically before executing inferences or tool actions. If available balance is zero, the request fails closed.

---

## 4. Security, Isolation & Tool Execution Controls

1. **Containerized Sandboxing:** Shell scripts and Python execution tools must run within rootless, ephemeral sandboxes with read-only filesystems and dedicated `/tmp` partitions.
2. **Network Egress Boundaries:** Outbound HTTP requests from agent tools are restricted to pre-approved domain allowlists. Direct access to cloud metadata endpoints (`169.254.169.254`) and internal RFC 1918 subnets is blocked at the network interface.
3. **Secret Hygiene:** Agents must never log, echo, print, or persist plain-text API credentials. Credentials must be resolved from process environment or native AES-256-GCM hardware vaults.

---

## 5. Evaluation, Quality Gates & Agent Evolution

1. **Continuous Verification:** Pull requests and automated artifacts must pass 100% of linting, static analysis, and automated test suites before being submitted for review.
2. **Automated Promotion Gating:** An agent soul, prompt instruction set, or model adapter configuration cannot be promoted to active status if evaluation benchmarks indicate a regression >2% against baseline test datasets.
3. **Audit Provenance:** All consequential agent decisions must record the exact actor ID, target entity, timestamp, autonomy level, and SHA-256 payload digest.
