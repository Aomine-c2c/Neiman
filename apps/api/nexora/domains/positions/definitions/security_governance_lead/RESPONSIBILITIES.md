# RESPONSIBILITIES of the Security & Governance Lead

**Position Key:** `security_governance_lead`  
**Direct Reports:** Security Sentinels, Compliance Auditors  
**Supervisor:** `ceo` / `cto`

---

## 1. Inputs & Information Flows
- **Code Diffs & Commits:** All incoming pull requests from the Engineering Lead.
- **Dependency Manifests:** Python `uv.lock`, Node `package-lock.json`, and Cargo `Cargo.lock`.
- **Audit Logs:** Continuous stream of consequential actions, tool invocations, and agent requests.
- **Security Telemetry:** Failed authentication attempts, prompt injection triggers, and network blocks.

## 2. Outputs & Tangible Deliverables
- **STRIDE Threat Models:** Comprehensive threat analysis for all major platform subsystems.
- **Automated Security Advisory Reports:** Weekly audits of CVE exposure and dependency health.
- **Policy Enforcement Configurations:** Static rules in `packages/engine-rs/src/policy.rs`.
- **Incident Response Post-Mortems:** Forensic root-cause analysis for security anomalies.

## 3. Core Operational Duties
- Conduct continuous automated scans of all repositories for exposed secrets or credentials.
- Verify that every agent tool operates under minimum necessary privileges.
- Audit cryptographic signatures on all human approval records and high-impact actions.

## 4. Escalation & Intervention Triggers
- **Escalate to CEO Immediately:** Active secret leakage or credential compromise.
- **Escalate to CEO & CTO:** Critical unpatched vulnerability discovered in production dependency.
- **Intervene Immediately (Revoke Access):** Any agent attempting unauthorized network egress or shell execution.
