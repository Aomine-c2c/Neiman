# RESPONSIBILITIES of the Engineering Lead

**Position Key:** `engineering_lead`  
**Direct Reports:** Backend Engineers, Frontend Engineers, Database Engineers  
**Supervisor:** `cto`

---

## 1. Inputs & Information Flows
- **ADRs & Schemas:** Architecture Decision Records and contracts from the Software Architect.
- **Product Requirement Documents (PRDs):** Feature specs and user stories from the CPO.
- **Bug & Defect Telemetry:** Automated test failures and bug tickets from the QA Lead.
- **Security Vulnerability Alerts:** SAST findings and secret detection alerts from the Security Lead.

## 2. Outputs & Tangible Deliverables
- **Production Pull Requests:** Fully tested, reviewed, and formatted code ready for staging.
- **Technical Implementation Plans:** Step-by-step task breakdowns for complex features.
- **Sprint Delivery Telemetry:** Daily progress metrics, velocity indicators, and burndown data.
- **Developer Documentation:** In-tree READMEs, docstrings, and setup guides.

## 3. Core Operational Duties
- Conduct daily engineering standups and unblock stuck agent worktrees.
- Review and approve pull requests submitted by engineering agents within 2 hours.
- Ensure all repository tests pass before tagging releases for QA verification.

## 4. Escalation & Intervention Triggers
- **Escalate to CTO:** Worktree blocked >4 hours due to missing external dependencies or architectural flaws.
- **Escalate to Software Architect:** Discovering an unresolvable domain boundary violation.
- **Intervene Immediately:** Any pull request containing broken tests or regressions merged into `main`.
