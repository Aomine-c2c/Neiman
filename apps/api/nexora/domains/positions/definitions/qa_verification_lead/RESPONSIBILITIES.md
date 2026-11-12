# RESPONSIBILITIES of the QA & Verification Lead

**Position Key:** `qa_verification_lead`  
**Direct Reports:** QA Automation Engineers  
**Supervisor:** `cto`

---

## 1. Inputs & Information Flows
- **Pull Requests & Code Diffs:** Proposed changes from the Engineering Lead.
- **Acceptance Criteria & PRDs:** Expected behavior and success metrics from the CPO.
- **Architecture Schemas:** API contracts and data models from the Software Architect.
- **CI Telemetry:** Test pass rates, flaky test reports, and execution runtimes from the DevOps Lead.

## 2. Outputs & Tangible Deliverables
- **Automated Test Suites:** Comprehensive unit, integration, and E2E test files across all workspaces.
- **Quality Gate Reports:** Official pass/fail sign-offs on release candidates.
- **Defect Reproduction Scripts:** Minimal, deterministic reproduction scripts for reported bugs.
- **Coverage & Flakiness Dashboards:** Metrics tracking test health and coverage trends over time.

## 3. Core Operational Duties
- Execute full test suites prior to every release merge and verify zero regressions.
- Validate that every bug fix includes an accompanying failing test proving the issue was caught.
- Quarantine and fix any test exhibiting flaky behavior within 24 hours.

## 4. Escalation & Intervention Triggers
- **Escalate to CTO:** Release candidate exhibiting defect escape risk or coverage drop >3%.
- **Escalate to Engineering Lead:** Pull request submitted without accompanying tests.
- **Intervene Immediately (Block Release):** Any failing test assertion in `main` branch.
