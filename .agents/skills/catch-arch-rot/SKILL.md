---
name: catch-arch-rot
description: Audits the codebase for architectural drift and decay before it spreads. Catches untyped business logic, boundary violations, mock data presented as live state, dead imports, schema desync, circular module dependencies, and missing error/loading states.
---

# /catch-arch-rot — Architectural Drift & Decay Prevention

Inspect, detect, and arrest architecture decay at the pull request and commit boundary.

## What is Architecture Rot?

- Leaking mock data into live operational paths.
- Untyped `any` or loose dictionaries in core business logic.
- Domain boundary crossing (e.g. web directly accessing DB or bypassing API client layer).
- Missing state completeness (omitted `Loading`, `Error`, `Empty`, or `Permission` branches in UI).
- Circular imports and non-isolated domain dependencies.
- Discarding zero-filler protocol in agent outputs.

## Audit Checklist & Verification Commands

### 1. Static Type & Contract Integrity

- **Frontend Type Safety**:

  ```bash
  cd apps/web && npx tsc --noEmit
  ```

  *Rule*: 0 untyped `any` in business logic; strict interface alignment with API schemas.

- **Backend Type Safety & Linting**:

  ```bash
  uv run --directory apps/api ruff check .
  ```

- **Rust High-Performance Kernels**:

  ```bash
  cd packages/engine-rs && cargo check
  ```

### 2. Boundary Isolation Checks

- **No Direct DB Access in Presentation**: All frontend routes MUST consume `lib/api/*.ts` client modules.
- **Strict Tenant & Company Isolation**: Every API endpoint handling enterprise state MUST accept and verify `company_id`.
- **Model Output Untrusted**: Model outputs must be validated against schemas (`PromptSanitizer`, `ModelOutputBoundary`).

### 3. Automated Rot Scanner Script

Run the automated architectural rot scanner:

```bash
python3 .agents/skills/catch-arch-rot/scripts/audit_rot.py
```
