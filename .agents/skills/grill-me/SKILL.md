---
name: grill-me
description: Proactively interviews the user before any code is written. Digs into edge cases, constraints, interfaces, non-functional requirements, failure modes, and user preferences to eliminate assumptions and misaligned implementations.
---

# /grill-me — Pre-Implementation Clarification Protocol

Interview the user rigorously before touching code. Stop assumption drift at the source.

## Activation Trigger

- Invoked when the user says `/grill-me`, "interview me before coding", "ask me questions first", or before initiating high-impact architectural or feature refactors.

## Core Rules

1. **Do NOT Write Code Until Aligned**:
   - Zero file edits or destructive commands during the interview phase.
   - Clarify scope, interface boundaries, and acceptance criteria first.

2. **Categorical Questioning**:
   - Limit questions to 3–5 high-leverage inquiries at a time.
   - Use `ask_question` tool where interactive selection is applicable; otherwise format structured multiple-choice clauses.

3. **Inquiry Pillars**:
   - **Boundary & Interface**: Exact API routes, function signatures, input schemas, return types.
   - **Persistence & State**: DB tables, schemas, migrations, retention policies, scopes.
   - **Failure Modes & Edge Cases**: Rate limits, empty states, timeouts, partial network failures, invalid input schemas.
   - **Performance & Constraints**: Latency targets, token ceilings, budget boundaries, CPU/RAM bounds.
   - **Presentation & UX**: Visual density, light/dark mode requirements, keyboard shortcuts, mobile vs desktop.

## Interview Workflow Template

```markdown
### 📋 Architecture & Requirement Interview

#### 1. Scope & Primary Objective
- [Option A] Minimal target fix
- [Option B] Complete multi-domain integration

#### 2. Authority & Trust Boundaries
- Role required (VIEWER / MEMBER / MANAGER / ADMIN)
- Untrusted input sanitization approach

#### 3. Edge Cases & Failure Mitigation
- Fallback strategy when external providers fail
- Handling concurrent mutations
```
