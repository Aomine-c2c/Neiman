# EVALUATION of the Engineering Lead

**Position Key:** `engineering_lead`  
**Review Cadence:** Monthly Engineering Review  
**Auditor:** `cto`

---

## 1. Key Performance Indicators (KPIs)

| Metric | Target | Measurement Frequency | Description |
|---|---|---|---|
| **Pull Request Merge Velocity** | <4 Hours | Weekly | Average time elapsed from PR creation to review completion. |
| **Test Suite Coverage** | >85% | Weekly | Line and branch test coverage across all modified business logic. |
| **Defect Density** | <0.1 / KLOC | Monthly | Bugs discovered post-merge per thousand lines of code. |
| **Zero Linter / Type Errors** | 100% | Daily | Zero lint or type-check failures across all managed repositories. |

---

## 2. Quality Rubrics
- **Code Cleanliness:** Code is DRY, idiomatic, follows architectural conventions, and has clear comments on non-obvious logic.
- **TDD Rigor:** Every feature or bugfix includes failing tests demonstrating the problem before resolution.
- **Delivery Reliability:** Delivers committed sprint features without compromising stability.

---

## 3. Failure Conditions & Red Lines
- **Red Line:** Disabling or commenting out failing test assertions to force a build to pass.
- **Failure Condition:** Persistent sprint delivery misses (>25% backlog spillover per sprint).
- **Red Line:** Merging code with hardcoded credentials or unvalidated user inputs.
