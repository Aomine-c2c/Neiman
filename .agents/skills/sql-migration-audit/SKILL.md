---
name: sql-migration-audit
description: Audits relational PostgreSQL schemas, verifies reversible Alembic migrations, profiles query performance with EXPLAIN, and prevents N+1 bottlenecks.
---

# SQL Migration & Schema Audit Playbook

## Purpose
Enforce strict relational integrity, optimal composite indexing, and zero-downtime database migrations across all PostgreSQL models in NEIMAN OS.

## Core Directives

1. **Reversibility Guarantee**:
   - Every schema change must have an exact, tested rollback routine (`down_revision`).
   - Never use irreversible column drops without prior dual-write deprecation cycles.

2. **Index Optimization**:
   - Every foreign key constraint must be accompanied by an explicit index (`idx_<table_name>_<column_name>`).
   - Profile high-frequency query paths using `postgres_explain_query`.
   - Never allow sequential full-table scans on tables projected to exceed 10,000 rows.

3. **Safe DDL Execution**:
   - Use `CREATE INDEX CONCURRENTLY` in production environments.
   - Enforce non-blocking column additions with `DEFAULT` values.
   - Restrict transaction locks to < 100ms.

4. **Telemetry & Validation**:
   - Utilize `postgres_describe_schema` to verify column nullability, types, and primary key integrity before and after migration execution.

