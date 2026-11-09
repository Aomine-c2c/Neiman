# ARCHITECTURE AUDIT — NEIMAN

**Audit Date:** 2026-09-29  
**Auditor:** Antigravity (Lead Architect / Autonomous CTO)  
**Status:** Baseline Established & Operational Foundation Verified  

---

## 1. Executive Assessment

NEIMAN has established a modular, provider-agnostic, and observable foundation. Rather than treating agents as standalone conversational bots, the system represents agents as **organizational employees** bound by company roles, departments, capability permissions, and constitutional autonomy policies.

---

## 2. Architectural Analysis by Dimension

### 2.1 Project Structure & Monorepo Layout
- **Current State:** Decoupled monorepo with `apps/api` (FastAPI backend) and `apps/web` (Next.js frontend).
- **Assessment:** Clean separation of concerns. Shared schemas and TypeScript interfaces currently mirrored; auto-generation via OpenAPI CLI recommended for Phase 3+.

### 2.2 Frontend Architecture
- **Current State:** Next.js 14 App Router, React 18, TanStack Query v5, Zustand.
- **Assessment:** Fast initial paint with client hydration. Highly cohesive dashboard views (`Control Room`, `Workflows`, `Agent Councils`, `Organizations`).
- **Reuse Opportunities:** SVG/Canvas Organizational Graph component, Operational Pulse Cards, and real-time step pipelines.

### 2.3 Backend & Service Architecture
- **Current State:** FastAPI async application partitioned into 13 domain packages (`agents`, `auth`, `blueprints`, `councils`, `decisions`, `governance`, `intelligence`, `memory`, `organizations`, `policies`, `projects`, `resources`, `workflows`).
- **Assessment:** Strong domain-driven design (DDD). Each domain encapsulates its ORM models, schemas, repositories, and services.

### 2.4 Database Architecture & Multi-Tenancy
- **Current State:** Multi-tenancy anchored on `Company` entity. Models inherit UUID primary keys and timestamp mixins (`NexoraBase`). Foreign keys enforce `company_id` indexing.
- **Assessment:** Solid relational structure. Data isolation enforced at database and query repository layers.

### 2.5 Intelligence Provider Abstraction
- **Current State:** `IntelligenceService` implements model adapter abstractions for Anthropic (Claude), Google (Gemini), and OpenAI.
- **Assessment:** Prevents vendor lock-in. Agents request capabilities rather than hard-coded vendor APIs.

### 2.6 Workflow Engine & Observability
- **Current State:** `WorkflowExecutionEngine` coordinates sequential, parallel, conditional, and approval-gated steps.
- **Assessment:** State is persisted to SQL tables (`workflow_executions`, `workflow_execution_steps`) at every step rather than relying on LLM context memory.

### 2.7 Agent Councils & Deliberation
- **Current State:** 7-stage deliberation pipeline (`PROPOSAL` -> `INDEPENDENT REVIEW` -> `OBJECTIONS` -> `DISCUSSION` -> `SYNTHESIS` -> `DECISION` -> `RECORD`).
- **Assessment:** Captures dissent as first-class organizational knowledge rather than forcing false consensus.

---

## 3. Recommended Actions & Migration Path

1. **Preserve:**
   - 13-domain backend structure and repository abstraction layer.
   - Constitutional governance matrix and human-in-the-loop approval gates.
   - Dual-mode auth configuration (strict production JWT + developer auto-bypass).
2. **Refactor:**
   - Standardize WebSocket event hub for live streaming workflow telemetry.
   - Expand vector database integration (`pgvector` / Qdrant) for organizational semantic search.
3. **Add in Subsequent Phases:**
   - Autonomous Evolution Engine (Phase 12).
   - Organizational Simulation Lab (Phase 13).
   - Natural Language "Build My Company" generator (Phase 14).
