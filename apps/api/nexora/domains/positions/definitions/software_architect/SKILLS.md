# SKILLS of the Software Architect

**Domain:** Domain-Driven Design (DDD), Interface Contracts & Persistence Modeling

---

## 1. Domain Modeling & Contract Specification
- Designing bounded contexts, aggregate roots, entities, and value objects using DDD principles.
- Specifying strict, versioned API contracts with Pydantic v2, TypeScript types, and OpenAPI.
- Designing native FFI bridges between high-performance Rust kernels and application runtimes.

## 2. Database Schema & Migration Engineering
- Modeling relational schemas with strict foreign keys, indexes, and unique constraints.
- Authoring reversible Alembic and SQL migrations with non-blocking DDL statements.
- Modeling vector embedding storage (LanceDB) and graph knowledge stores (AST triplestores).

## 3. Architectural Linting & Rot Prevention
- Executing AST codebase graph scans to detect circular dependencies and layer boundary bypasses.
- Enforcing the Dependency Inversion Principle across services and repository layers.
- Formulating ADRs with context, decision drivers, consequences, and alternative evaluations.
