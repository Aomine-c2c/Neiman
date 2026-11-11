---
name: secret-scanner-mitigation
description: High-entropy token detection, secret remediation, environment variable masking, and git commit history scrubbing.
---

# Secret Scanner & Mitigation Skill

## Detection & Mitigation Patterns
1. **Entropy Checks**: Scan source trees for high-entropy strings matching private key headers (`BEGIN RSA PRIVATE KEY`), JWT tokens, and cloud provider API keys (`sk-...`, `ghp_...`).
2. **Masking in Telemetry**: Always mask credentials in logs, API responses, and telemetry feeds using prefix/suffix redaction (`nm_live_••••••••••••••••••••••••••••94b2`).
3. **Commit Quarantine**: Abort commit workflows immediately if any staged file contains unencrypted secrets.

