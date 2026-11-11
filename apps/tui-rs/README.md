# NEIMAN Operator TUI (`tui-rs`)

Keyboard-first Ratatui console for live backend control. Speaks only to `/api/v1` — no mock-as-real telemetry.

## Run

```bash
# from repo root
make dev-tui-rs
# or
./run-tui.sh
```

Non-TTY CLI mode (pipes / scripts):

```bash
cargo run -p tui-rs -- status
cargo run -p tui-rs -- help
```

## Auth

| Source | Behavior |
|--------|----------|
| `NEIMAN_TOKEN` | Bearer token (preferred) |
| `NEIMAN_EMAIL` + `NEIMAN_PASSWORD` | Login exchange |
| neither | Labeled **dev fallback** `admin@neiman.ai` / `password123` |

Optional: `NEIMAN_API_URL`, `NEIMAN_COMPANY_ID` (CLI).

## Surfaces

| Key | Workspace |
|-----|-----------|
| `1` | Dashboard cockpit (swarm / chat / telemetry) |
| `2`–`9` | CTO, Agents, Tasks, Approvals, Resources, Intelligence, Evolution, Security |
| `o` | Company / org switcher |
| `Ctrl+P` | Provider configure / probe |
| `x` / `Space` | Backend supervisor tick (local DAG ready-set is advisory) |
| Evolution: `m` / `a` / `b` | Simulate / approve-deploy / rollback |

## Truth-in-presentation

Missing API fields render as `[unavailable]` / empty — never invented CPU%, DAG edges, or security claims. Task predecessors/successors come from live `dependencies`. Security tab loads constitution + governance audits plus the local `engine-rs` policy enforcer config.
