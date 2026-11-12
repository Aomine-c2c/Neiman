---
name: enforce-tdd
description: Strictly enforces Test-Driven Development (Red-Green-Refactor) for coding agents. Mandates creating a failing test verifying the requirement before any implementation code is written, ensuring 100% test passing before completing work.
---

# /enforce-tdd — Test-Driven Development Protocol

No implementation without a prior failing test.

## Core Rules

1. **Phase 1: Red (Test First)**:
   - Identify the target requirement, bug, or interface.
   - Author the test case first in the appropriate test suite (`tests/` for Python, `*.test.ts/tsx` for TypeScript, `#[test]` for Rust).
   - Run the test suite and confirm that it fails for the expected reason (e.g. missing function, failed assertion).

2. **Phase 2: Green (Minimal Implementation)**:
   - Implement the minimal viable code necessary to satisfy the test contract.
   - Run the test suite again and confirm that the test passes cleanly.
   - Zero speculative features beyond the test specification.

3. **Phase 3: Refactor (Clean & Optimize)**:
   - Polish code structure, types, and naming while keeping tests passing green.
   - Ensure zero lint errors (`npm run lint`, `ruff check`, `cargo check`).

## Enforcement Checklist

- [ ] New endpoint, function, or component has a dedicated test file.
- [ ] Test executed and observed failing prior to implementation.
- [ ] Implementation completed and verified passing.
- [ ] Regressions tested across adjacent domain test suites.
- [ ] Full test run exit code == 0.
