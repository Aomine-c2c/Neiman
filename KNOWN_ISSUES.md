# Known Issues

- `ToolSandbox` validation helpers are not an execution sandbox. Commands must run in an isolated process/container with OS-enforced resource and filesystem limits.
- URL validation does not resolve DNS or pin destination IPs; DNS rebinding and redirects can bypass a preflight hostname check. Enforce egress restrictions at the network layer and revalidate each redirect before production use.
- `AuditIntegrityChamber` currently uses a source-defined constant HMAC key. This provides no meaningful protection from an attacker who can read or modify application code; production signing requires protected key management and rotation.
- Production readiness is incomplete: the default database is SQLite and durable distributed workflow workers are not yet present.
- Ruff reports outstanding import-order, unused-import, and line-length violations across the current security, provider, and newly added test modules; the repository-wide lint baseline needs cleanup.
- Existing workspace contains substantial uncommitted changes. Review and attribute those changes before release.
- The isometric Control Room currently has three department rooms. Additional departments and their employees are disclosed as overflow and available in the full organization graph; a fully dynamic floor topology remains a frontend improvement.
