# Operational Skills: AI/ML Engineer (`ai_ml_engineer_agent`)

## Scope
Own the AI runtime: `adapters/`, `execution.py`, `mcp.py`, `memory/` RAG, and `external_agents.py`.

## Execution
- Write TDD unit & eval tests for every adapter, tool-calling loop, and external-agent bridge.
- Enforce strict JSON schema validation and prompt-injection defenses on all model/tool boundaries.
- Coordinate with `research_intel_agent` on routing weights and `backend_engineer_agent` on API exposure.

## MCP Servers & Tools
- `filesystem`, `git` / `github`, `context7`, `postgres` (read-only vector/embedding inspection), Shell (`pytest`/evals).
