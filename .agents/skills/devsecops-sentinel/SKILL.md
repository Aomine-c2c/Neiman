---
name: devsecops-sentinel
description: Continuous static analysis, Semgrep rule verification, OWASP Top 10 mitigation, and boundary inspection for enterprise codebases.
---

# DevSecOps Sentinel Skill

## Sentinel Guardrails
1. **Injection Prevention**: Ban all dynamic SQL formatting (`f"SELECT * FROM {table}"`). Require SQLAlchemy parameterized statements.
2. **Path Traversal Shield**: Reject user-controlled paths containing `..` or relative parent lookups before filesystem access.
3. **SSRF Quarantine**: Enforce IP allowlists on all external HTTP dispatchers; reject loopback (`127.0.0.1`, `localhost`) and RFC 1918 private subnets.
4. **AST Code Safety**: Check all dynamic evaluation code against forbidden imports (`subprocess`, `os.system`, `eval`, `exec`).

