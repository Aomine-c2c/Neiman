# TECHNICAL DEBT REGISTER — NEIMAN

**Audit Date:** 2026-09-29  
**Status:** Active Tracking & Remediation Register  

---

## 1. Resolved Technical Debt

| Item | Description | Resolution | Status |
| :--- | :--- | :--- | :---: |
| **TD-001** | Frontend Jest test parsing failure with TypeScript modules | Updated `jest.config.js` to use `ts-jest` and `setupFilesAfterEnv`. Tests now passing cleanly. | ✅ **RESOLVED** |
| **TD-002** | Missing CORS permissions for Next.js port 3001 | Added `http://localhost:3001` and `127.0.0.1:3001` to `CORS_ORIGINS` in `config.py`. | ✅ **RESOLVED** |
| **TD-003** | Auth friction blocking local development testing | Implemented `DISABLE_AUTH` configurable setting allowing non-blocking developer access without breaking unit tests. | ✅ **RESOLVED** |
| **TD-004** | Missing Control Room and Workflow Engine UIs | Implemented mission control dashboard, interactive canvas organizational graph, and step observability runner. | ✅ **RESOLVED** |

---

## 2. Active & Monitored Technical Debt

### TD-005 — TypeScript / Backend Schema Drift
- **Issue:** Frontend API interfaces in `src/lib/api/` are manually maintained to match Pydantic schemas.
- **Risk:** Potential schema drift as domain models evolve.
- **Remediation Plan:** Set up `openapi-typescript` code generation script in `apps/web` triggered on backend build.
- **Priority:** Medium (Scheduled for Phase 11).

### TD-006 — In-Memory / SQLite Vector Search Gap
- **Issue:** Memory domain currently queries SQLite text indexes; dense vector embedding generation is stubbed for local dev.
- **Risk:** Semantic search accuracy will degrade as organizational knowledge scales.
- **Remediation Plan:** Integrate `pgvector` container in `docker-compose.yml` with fast cosine distance queries.
- **Priority:** High (Scheduled for Phase 11/15).

### TD-007 — Real-Time WebSocket Streaming
- **Issue:** Workflow execution steps and agent communications currently refresh via short-polling (React Query interval).
- **Risk:** Additional HTTP request overhead during high-frequency parallel agent tasks.
- **Remediation Plan:** Introduce FastAPI WebSocket router endpoint broadcasting execution step events directly to client Zustand state.
- **Priority:** Medium.
