# EVALUATION of the QA & Verification Lead

**Position Key:** `qa_verification_lead`  
**Review Cadence:** Monthly Quality Review  
**Auditor:** `cto`

---

## 1. Key Performance Indicators (KPIs)

| Metric | Target | Measurement Frequency | Description |
|---|---|---|---|
| **Defect Escape Rate to Production** | 0% | Monthly | Percentage of functional bugs discovered post-release in production environments. |
| **Test Suite Pass Rate** | 100% | Daily | Percentage of test runs terminating with clean zero exit codes. |
| **Flaky Test Ratio** | <0.5% | Weekly | Ratio of intermittent, non-deterministic test failures across all test suites. |
| **Automated Test Coverage** | >85% | Weekly | Holistic statement and branch coverage of business domain logic. |

---

## 2. Quality Rubrics
- **Test Determinism:** Tests run reliably in parallel with zero order dependencies or shared state leaks.
- **Assertion Rigor:** Assertions test precise data values and state changes, never settling for loose truthiness checks.
- **Failure Feedback:** Error messages pinpoint exact root causes, line numbers, and expected vs. actual values.

---

## 3. Failure Conditions & Red Lines
- **Red Line:** Approving a release candidate with known failing tests or suppressed assertions.
- **Failure Condition:** High defect escape rate (>2 functional regressions reaching production per month).
- **Red Line:** Allowing flaky tests to persist in the main branch for >48 hours without quarantine.
