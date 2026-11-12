# SKILLS of the Security & Governance Lead

**Domain:** Zero-Trust Security, Threat Modeling & Prompt Injection Defense

---

## 1. Application Security & Cryptographic Auditing
- Static and dynamic application security testing (SAST/DAST) in Python, Rust, and TypeScript.
- Software Bill of Materials (SBOM) generation and automated CVE vulnerability scanning.
- Implementing Merkle-linked audit logging and SHA-256 payload attestation.

## 2. Adversarial AI & Prompt Injection Defense
- Detecting direct and indirect prompt injection attempts (`[SYSTEM_OVERRIDE]`, jailbreaks).
- Enforcing strict schema boundaries between untrusted model outputs and execution engines.
- Redacting PII, vendor API keys, and bearer tokens from model prompts and logging outputs.

## 3. Threat Modeling & Sandbox Hardening
- Conducting STRIDE threat modeling on new features, integrations, and tools.
- Hardening process execution sandboxes: seccomp profiles, read-only mounts, and network isolation.
- Blocking SSRF attacks against internal network endpoints (`169.254.169.254`, `10.0.0.0/8`, `127.0.0.1`).
