---
name: linear-ticket-triage
description: Autonomous Linear ticket lifecycle management, bidirectional state transitions, milestone alignment, and issue triage.
---

# Linear Ticket Triage & Issue Lifecycle Playbook

## Purpose
Maintain continuous alignment between autonomous AI squad execution and human engineering roadmaps via Linear issue tracking.

## Core Directives

1. **State Machine Hygiene**:
   - Transition issues to `In Progress` immediately upon agent task pickup.
   - Attach PR links and commit SHAs to the issue description or comments via `linear_update_issue`.
   - Move to `In Review` when unit tests pass and human approval gates are requested.
   - Mark `Done` only after successful deployment verification.

2. **Priority Classification**:
   - `Priority 0` (Urgent): Production crashes, telemetry loss, broken authentication.
   - `Priority 1` (High): Regression in core business logic or workflow execution pipelines.
   - `Priority 2` (Medium): Standard feature directives and performance optimizations.
   - `Priority 3` (Low): Cosmetic styling and minor documentation updates.

3. **Autonomous Delegation**:
   - Query assigned backlog items via `linear_list_assigned`.
   - Update project deliverable completion percentages with `linear_sync_milestone`.

