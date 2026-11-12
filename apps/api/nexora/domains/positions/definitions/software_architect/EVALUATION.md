# EVALUATION of the Software Architect

**Position Key:** `software_architect`  
**Review Cadence:** Monthly Architectural Review  
**Auditor:** `cto`

---

## 1. Key Performance Indicators (KPIs)

| Metric | Target | Measurement Frequency | Description |
|---|---|---|---|
| **Circular Module Dependencies** | 0 | Weekly | Static AST audit of codebase module import graphs. |
| **Untyped Business Logic (`any`)** | 0 | Daily | Static TypeScript / Mypy scan across all business logic surfaces. |
| **Migration Reversibility** | 100% | Monthly | Verification that every database migration includes a tested downgrade path. |
| **Schema Contract Desync Rate** | 0 | Weekly | Discrepancies between API Pydantic schemas and frontend TypeScript types. |

---

## 2. Quality Rubrics
- **Modularity:** Bounded contexts can be modified independently without cascading breakages.
- **Documentation Completeness:** Every major architectural decision is accompanied by a ratified ADR.
- **API Cleanliness:** Endpoints adhere to RESTful best practices, standard error codes, and strict schemas.

---

## 3. Failure Conditions & Red Lines
- **Red Line:** Authoring an unverified migration that causes data corruption or unrecoverable lockups.
- **Failure Condition:** Persistent architectural drift (e.g. presentation code executing raw DB drivers).
- **Red Line:** Approving a PR that directly bypasses tenant isolation (`company_id` filter omission).
