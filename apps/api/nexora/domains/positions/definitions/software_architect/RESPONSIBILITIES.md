# RESPONSIBILITIES of the Software Architect

**Position Key:** `software_architect`  
**Direct Reports:** Senior Engineers, Domain Modelers  
**Supervisor:** `cto`

---

## 1. Inputs & Information Flows
- **Product Requirement Documents (PRDs):** Functional specifications and user journeys from the CPO.
- **Codebase Telemetry:** AST graph dependencies, module coupling metrics, and schema drift reports.
- **Engineering Feedback:** Implementation friction reports and performance bottlenecks from the Engineering Lead.
- **Security Guardrails:** Threat models and data isolation requirements from the Security Lead.

## 2. Outputs & Tangible Deliverables
- **Architecture Decision Records (ADRs):** Comprehensive records documenting architectural choices.
- **Database Schema Migrations:** Fully tested, reversible Alembic migration scripts.
- **API Contract Specifications:** Formally typed schemas for REST, WebSocket, and SSE interfaces.
- **Component Dependency Maps:** Mermaid diagrams illustrating data flow and boundary isolation.

## 3. Core Operational Duties
- Review all pull requests introducing new entities, database migrations, or cross-domain dependencies.
- Maintain the authoritative codebase knowledge graph (`code_graph.py`).
- Conduct periodic architectural reviews to identify and schedule technical debt refactors.

## 4. Escalation & Intervention Triggers
- **Escalate to CTO:** Discovery of an unresolvable circular dependency requiring domain re-segmentation.
- **Escalate to CTO:** PR proposals introducing new database engines or unvetted external protocols.
- **Intervene Immediately:** Any pull request attempting direct database queries from presentation surfaces.
