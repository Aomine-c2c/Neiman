# Development Guide

## Local setup

- API: Python 3.11+, `cd apps/api`, install the `dev` extra, and configure `DATABASE_URL` as needed.
- Web: Node.js 20+, `cd apps/web`, then `npm ci`.
- Local defaults are intended for development, not production deployment. Authentication is enabled by default. Docker Compose requires a non-empty `SECRET_KEY`.
- Compose also requires `POSTGRES_PASSWORD`; use a URL-safe random value so the API connection string parses correctly (for example, `openssl rand -hex 32`). Compose-published database, Redis, API, and web ports bind to loopback only. Start with `POSTGRES_PASSWORD=... SECRET_KEY=... docker compose up --build`; the web app talks to the API through Next.js's same-origin `/api` rewrite.
- Set `ENVIRONMENT=staging` or `ENVIRONMENT=production` in the process environment for deployed runs. In those modes the API ignores dotenv files and reads secrets from the deployment environment. Both modes require a unique `SECRET_KEY` of at least 32 characters, authentication enabled, and `DEBUG=false`.
- CI and isolated test runs may set `ENVIRONMENT=test`; test mode also ignores dotenv files and is not a deployable runtime mode.

### First platform administrator

For a fresh database, set a private bootstrap password and initialize the first administrator explicitly:

```bash
cd apps/api
read -rsp "Initial administrator password: " NEIMAN_BOOTSTRAP_ADMIN_PASSWORD
export NEIMAN_BOOTSTRAP_ADMIN_PASSWORD
uv run python -m nexora.scripts.init_admin
unset NEIMAN_BOOTSTRAP_ADMIN_PASSWORD
```

The API will not invent a default password or elevate a public signup account. A fresh install can register ordinary users, but platform administration requires this explicit bootstrap step.

## Verification

From the repository root, `make test-api` runs API tests and `make test-web` runs frontend tests. `make lint` runs configured linters. Run the narrow affected test first, then the relevant regression suite. Provider integration tests may require live credentials and should not be assumed to have run unless explicitly reported.

## Change expectations

Preserve domain boundaries, provider neutrality, tenant isolation, least privilege, explicit state transitions, and human authority over consequential changes. Update architecture and operational records when behavior or risks change. Do not treat readiness claims as evidence without repeatable verification.

## Local frontend UI preview

The ignored local apps/web/.env.development.local file enables NEXT_PUBLIC_NEIMAN_DEV_AUTH_BYPASS for the Next.js development server. Open /dashboard to inspect protected UI routes without signing in.

AuthGuard allows this only when both NODE_ENV=development and the explicit flag are present. Production builds cannot enable the bypass. Every dashboard route uses the same read-only sample organization and route-specific fixtures, with a persistent synthetic-data notice. Fixtures live in `apps/web/src/lib/api/controlRoomPreview.ts` and `apps/web/src/lib/api/previewFixtures.ts`; they are not persisted, and preview API requests return locally without network access. Writes and sign-out are blocked in preview mode.

The Control Room presents this organization as an interactive office map. Select a room or employee to inspect it; the room console links to shared memory, governance, decisions, provider, and resource views. The floorplan maps the first three department records by ID. When an organization has additional departments or employees outside those rooms, the UI calls that out and points to the complete organization graph. The visualization is not a separate source of truth.
