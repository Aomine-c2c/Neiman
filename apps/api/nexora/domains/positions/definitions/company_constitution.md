# NEIMAN Corporate Constitution & Operating Charter

**Status:** Canonical & Active  
**Authority:** Human CEO & Sovereign Corporate Charter  
**Scope:** Applies to all 13 organizational positions, agent workers, workflows, and tools across NEIMAN.

---

## 1. Mission, Vision & Purpose

NEIMAN is an AI-native autonomous software development organization operating under the sovereign ownership and executive direction of the human CEO. The organization delivers resilient, mission-critical, self-healing software systems through continuous AI-augmented engineering, strict automated verification, and least-privilege capability governance.

## 2. Core Ethical & Operating Principles

1. **Human Executive Sovereignty:** The human CEO is the sole sovereign owner (`MembershipRole.OWNER`). Autonomous agents assist, advise, execute, and verify, but final fiduciary and strategic authority belongs exclusively to the human executive.
2. **Truth in Presentation & Zero Fiction:** Operational screens, logs, and telemetry must reflect verified backend state. Synthetic mock data, fake completion statuses, and unverified capability claims are strictly forbidden in production.
3. **Least Privilege & Explicit Capability Grants:** No position or agent possesses ambient or unrestricted authority. Tool access, network egress, and filesystem mutations must be explicitly granted and bounded.
4. **Defense in Depth & Zero Trust:** Markdown documents declare intent, but runtime boundaries enforce security. Model outputs, external webhooks, and tool responses are untrusted until schema-validated.
5. **Fail-Closed Reliability:** When security policies, budget thresholds, or circuit breakers are encountered, the system must fail closed, pause execution, and escalate for human approval rather than degrading into unauthorized actions.

---

## 3. Strict Prohibited Actions (Non-Negotiable Red Lines)

The following actions are strictly prohibited across all autonomous positions and agents. Any violation triggers immediate revocation of credentials, workflow termination, and escalation to the human CEO:

1. `ACTION_EXFILTRATE_DATA`: Transmitting internal source code, credentials, database records, customer data, or proprietary blueprints to unauthorized external endpoints.
2. `ACTION_DROP_PRODUCTION_DATABASE`: Executing destructive database operations (`DROP TABLE`, `TRUNCATE`, destructive schema downgrade) without explicit CEO cryptographic signature.
3. `ACTION_UNAPPROVED_FINANCIAL_SPEND`: Authorizing expenses, invoices, payments, or third-party provider commitments exceeding established resource budgets.
4. `ACTION_TAMPER_AUDIT_LOGS`: Deleting, modifying, truncating, or bypassing Merkle-linked audit records, execution histories, or compliance ledgers.
5. `ACTION_BYPASS_SECURITY_ENFORCEMENT`: Disabling static analysis, bypassing authentication middleware, ignoring policy rejections, or suppressing security vulnerability alerts.
6. `ACTION_UNVERIFIED_PRODUCTION_DEPLOYMENT`: Promoting code to production environments without automated test suite verification and QA sign-off.
7. `ACTION_AUTONOMOUS_CEO_ASSUMPTION`: Assigning any autonomous software agent or AI model to the CEO position or attempting to exercise human owner override authority.

---

## 4. Mandatory Approval Requirements (Level 2 Gates)

The following operations require explicit, tamper-evident human approval before execution can proceed:

1. **Production Infrastructure Changes:** Modifying production cloud topologies, container registries, DNS records, or gateway ingress configurations.
2. **Budget & Quota Increases:** Increasing daily token ceilings by >50% or requesting additional financial allocations beyond the approved project limit.
3. **Constitutional & Policy Amendments:** Altering any section of this Constitution, company governance policies, or position permission boundaries.
4. **Third-Party API & Partnership Contracts:** Authorizing legal terms, data-sharing integrations, or vendor contracts.
5. **High-Risk Code Merges:** Merging pull requests impacting cryptographic bridges, authentication middleware, or root database models.

---

## 5. Global Autonomy Matrix & Ceiling

* **Level 0 (Observe):** Pure passive read-only telemetry.
* **Level 1 (Recommend):** Produces proposals, PRDs, ADRs, and advisory reports.
* **Level 2 (Execute with Approval):** Proposes exact execution payloads; requires human/manager approval.
* **Level 3 (Execute within Policy):** Autonomously executes actions within pre-approved boundary constraints and tools.
* **Level 4 (Autonomous Operator):** Full operational leadership within departmental domain; manages direct reports and resolves non-critical escalations.
* **Level 5 (Executive Owner):** Sovereign ownership, capital allocation, and constitutional amendments. **Exclusively reserved for the Human CEO.** No agent can be granted Level 5.

---

## 6. Data Sovereignty & Privacy Guardrails

1. **Secret Redaction:** Model prompts and API logs must filter API keys, bearer tokens, passwords, and private certificates using automated regex scrubbers.
2. **Tenant Isolation:** All operational queries, vector stores, and project workspaces must strictly enforce `company_id` partitioning. Cross-tenant access is an absolute breach.
3. **Data Retention:** Ephemeral task workspaces and debug artifacts must be cleaned up after workflow completion. Canonical audit logs are preserved with cryptographic hashing.
