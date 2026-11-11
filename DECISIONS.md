# Architecture Decisions

## ADR-001: Domain-oriented modular monolith

**Status:** Accepted. **Date:** 2026-09-30.

Keep the API as a modular monolith while domain boundaries and deployment needs are still evolving. Domain packages provide separation without introducing distributed consistency and operational costs prematurely.

## ADR-002: Provider-neutral intelligence boundary

**Status:** Accepted. **Date:** 2026-09-30.

Agents request capabilities and policy-compliant routing; provider adapters implement vendor-specific calls. Provider identity must not define organizational roles or agent identity.

## ADR-003: Defense-in-depth security helpers

**Status:** Accepted with limitations. **Date:** 2026-09-30.

Input sanitizers and tool validators are useful guardrails, but are not substitutes for OS/container isolation, network egress controls, authorization, or human review. Do not describe them as a complete sandbox.

## ADR-004: Data-led operational interface

**Status:** Accepted. **Date:** 2026-09-30.

Use an organization-first graphite/lime design system with named navigation zones. Operational summaries derive their claims from API state; a polished interface must not imply healthy execution, model availability, or completed governance when those facts are not available. Keep visual treatments CSS-native and shared across routes so product identity remains provider-neutral.

## ADR-005: Development-only authentication bypass for UI review

**Status:** Accepted. **Date:** 2026-09-30.

Allow the local Next.js development server to render protected routes only when an explicit preview flag is set and NODE_ENV is development. Keep API authorization intact and show a persistent preview notice. The bypass must remain impossible in production builds and must not invent a user. For explicitly requested design review, permit a synthetic dashboard fixture behind this same local-only gate; keep it read-only, unpersisted, conspicuously labeled, and outside every API path.

## ADR-006: The organization headquarters is a navigable spatial overview

**Status:** Accepted. **Date:** 2026-09-30.

Use an interactive SVG office as the Control Room's primary overview. Department rooms and employee locations are derived from department IDs, human approval is a distinct review suite, and provider services are a separate switchboard. The current floorplan has three department spaces; additional teams and employees are called out and remain accessible through the full organization graph rather than being assigned to a misleading room. The visualization is presentation-only; selecting items leads to existing domain views. Keep it keyboard-navigable, respectful of reduced motion, and dependency-free. Sample records remain clearly labeled under the local preview gate.

## ADR-007: Active provider probing and synthetic chaos fault injection

**Status:** Accepted. **Date:** 2026-10-02.

Intelligence providers (both cloud APIs and local air-gapped instances) must be proactively verifiable through dedicated health probes (`/providers/{provider_name}/probe`) rather than relying solely on passive failures during live task execution. Probing must record sub-millisecond round-trip latency, update consecutive failure counts, and reflect the real-time circuit-breaker state (`CLOSED`, `OPEN`, `HALF_OPEN`). Probing endpoints must also support diagnostic fault injection (`rate_limit`, `timeout`, `500`) to enable deterministic resiliency validation across model routing fallbacks.

## ADR-008: Core client surfaces, default light mode, and state completeness standards

**Status:** Accepted. **Date:** 2026-10-02.

Establishes foundational UI and delivery rules:
1. **Surfaces**: Next.js + React is the primary web application; Tauri provides desktop distribution; TUI serves as the optional terminal interface.
2. **Language**: TypeScript is mandatory across all frontend codebases with strict type safety.
3. **Theming**: Light mode is the platform default; dark mode remains fully supported and switchable.
4. **Ergonomics**: Responsive layout optimized for desktop command centers, keyboard-first navigation with universal command palette (`Cmd/Ctrl+K`), and live activity streams.
5. **Truth in Presentation & State Completeness**: No fake functionality or mock data masquerading as live state. Every data-backed view must explicitly implement Loading, Empty, Error, and Permission states while consuming backend domain APIs rather than duplicating business logic.


