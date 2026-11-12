# Security

## Security model

NEIMAN treats user content, retrieved memory, tool output, and model responses as untrusted. Authorization is enforced per company and capability. Consequential actions require governance checks and, where configured, human approval.

## Current controls and limitations

The API includes prompt scanning, secret/PII scrubbing helpers, filesystem and URL validation helpers, SQL pattern checks, and audit-signature utilities. These checks are defense in depth. Agent subprocesses now fail closed unless `bubblewrap` is installed; when available they run with isolated namespaces, no network namespace access, a per-run workspace, sanitized environment, resource limits, and a bounded timeout. This is a local OS sandbox, not a substitute for a dedicated container/VM boundary on a multi-tenant production host.

Provider credential fallback literals remain in the private source tree at the owner's explicit direction. Repository privacy does not prevent compromise through collaborators, backups, build artifacts, logs, or a later repository exposure. Never print or log those values; rotate them if exposure is suspected.

Local dashboard preview can bypass the frontend auth guard only when `NODE_ENV=development` and the explicit preview flag is enabled. It uses labeled, read-only, local fixtures and does not bypass API authorization. Do not enable the flag in a production build.

The audit-signature utility currently has a code-defined key and is not production-grade cryptographic audit storage. See [KNOWN_ISSUES.md](KNOWN_ISSUES.md).

## Reporting

Do not put credentials or sensitive customer data in issue reports. Provide a minimal reproduction and affected component through the repository's approved private security reporting channel.
