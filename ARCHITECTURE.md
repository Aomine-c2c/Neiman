# NEIMAN Architecture

## Current structure

NEIMAN is a monorepo with a FastAPI service in `apps/api` and a Next.js application in `apps/web`. The API is organized by organizational domain (agents, organizations, workflows, intelligence, governance, memory, resources, and related domains). SQLAlchemy models and repositories own persisted state; service and engine modules implement domain behavior. Provider adapters normalize model calls behind intelligence routing. The frontend uses the API through typed clients and dashboard routes.

## Trust and authority boundaries

- Agents are organizational records with capabilities and governance constraints; a model is only an intelligence provider.
- External inputs and model output are untrusted. Validate outputs before they trigger tools or state changes.
- Tool access must be capability-scoped and bounded to approved resources. Humans retain approval authority for consequential organizational changes.
- Tenant ownership is checked at API/repository boundaries. Persisted decisions and workflow state should remain attributable and auditable.

## Runtime and persistence

The current default database is SQLite for local development; PostgreSQL support is configured through `DATABASE_URL`. Long-running work currently executes in-process. Production deployment therefore requires a durable worker strategy and operational database configuration.

## Rust Native Acceleration & High-Performance Surfaces

1. **Native Desktop Runtime (`apps/web/src-tauri`)**:
   - Zero-trust native container providing authenticated AES-256-GCM local credential encryption (`encrypt_credential` & `decrypt_credential` with random 96-bit nonces per call).
   - Real-time desktop telemetry querying host and process RSS footprint (`sysinfo`).
   - Hardened filename, path-traversal, and deep link boundary validators.

2. **Autonomous Task Graph & Policy Engine (`packages/engine-rs`)**:
   - High-throughput acyclic directed graph (`TaskDag`) execution orchestrator with dependency resolution and cycle prevention.
   - Zero-trust security policy scanner (`PolicyEnforcer`) with adversarial boundary detection (anti-smuggling, payload bounds, capability authorization).
   - In-memory lock-free multi-producer event broadcaster (`EventDispatcher`).

3. **Native Operator Console (`apps/tui-rs`)**:
   - Built on `ratatui` and `crossterm` providing sub-millisecond keyboard navigation, real-time telemetry observation, and headless DAG execution.

4. **Cryptographic & FFI Bridge (`packages/neiman-native`)**:
   - SHA-256 payload attestation and Python extension module bindings for zero-overhead validation in backend dispatch routines.

## Known architectural gaps


See [ROADMAP.md](ROADMAP.md), [KNOWN_ISSUES.md](KNOWN_ISSUES.md), and [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md). In particular, the security helpers are defensive checks, not an operating-system sandbox or a complete SSRF defense against DNS rebinding.

## Frontend presentation boundary

The frontend visual system is defined by shared CSS variables in `apps/web/src/app/globals.css` and Tailwind mappings. Its graphite/lime palette, grouped command navigation, shared fine grain, and interactive isometric headquarters express NEIMAN as an organization with rooms for departments, employees, and human review. Model providers stay visually separate as infrastructure. The office maps the first three loaded department records by ID; additional departments and their employees are explicitly surfaced as overflow and remain available in the organization graph. The floorplan is presentation-only and does not own or persist organizational state. Operational status copy should be computed from loaded API state; presentation must not invent health or provider availability.

The control room reads tasks from each organization's real project task endpoints and memory from the organization memory API. Missing telemetry is nullable and surfaced as unavailable; successful empty responses are shown as empty states. Rejected domain requests are listed so empty data is not confused with missing data.
