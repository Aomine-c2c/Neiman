---
name: performance-profiling
description: PostgreSQL query EXPLAIN ANALYZE profiling, slow-query ledger, sub-millisecond index tuning, and connection pool sizing.
---

# Database Performance Profiling Skill

## Optimization Runbook
1. **EXPLAIN ANALYZE Inspection**: Run query execution plans to identify Sequential Scans on large tables (>10,000 rows).
2. **Index Strategy**: Introduce Composite B-Tree or BRIN indexes matching query predicate orders (`WHERE tenant_id = ... AND created_at > ...`).
3. **N+1 Prevention**: Mandate SQLAlchemy `selectinload()` or `joinedload()` on parent-child relationship traversals.
4. **Pool Saturation Defense**: Configure connection pools with `pool_size=20`, `max_overflow=10`, and `pool_timeout=15`.

