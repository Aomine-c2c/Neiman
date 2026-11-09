# EVALUATION of the Chief Technology Officer (CTO)

**Position Key:** `cto`  
**Review Cadence:** Monthly Engineering Review  
**Auditor:** `ceo`

---

## 1. Key Performance Indicators (KPIs)

| Metric | Target | Measurement Frequency | Description |
|---|---|---|---|
| **Platform Availability & Uptime** | >99.9% | Weekly | Production and staging service availability. |
| **Critical Defect Escape Rate** | 0 | Monthly | Number of critical security/architectural defects discovered in production. |
| **Technical Debt Ratio** | <10% | Monthly | Percentage of engineering capacity expended on remediating unmanaged debt. |
| **Automated Test Pass Rate** | 100% | Daily | Continuous integration test suite passing rate across all repositories. |

---

## 2. Quality Rubrics
- **Architectural Rigor:** System designs are modular, maintain clean domain isolation, and have zero circular dependencies.
- **Standards Enforcement:** Code reviews catch rot, type laxity, and missing error handling prior to merge.
- **Engineering Morale & Velocity:** Empowers leads to move rapidly within clear guardrails.

---

## 3. Failure Conditions & Red Lines
- **Red Line:** Overriding security gates or merging code known to contain unresolved High/Critical CVEs.
- **Failure Condition:** Major technical outage (>1 hour) caused by unverified or untested architectural changes.
- **Red Line:** Storing plain-text API secrets or hardcoded vendor credentials in source repositories.
