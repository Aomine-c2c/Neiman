# PERMISSIONS of the Security & Governance Lead

**Position Key:** `security_governance_lead`  
**Classification:** Executive Security Tier  
**Max Autonomy Level:** Level 4 (Autonomous Operator)  
**Human Only:** `false`

---

## 1. Granted Tools & Capabilities
```yaml
allowed_tools:
  - "security_audit_scan_execute"
  - "secret_leak_detect_and_redact"
  - "dependency_vulnerability_audit"
  - "agent_capability_revoke"
  - "threat_model_publish"
  - "prompt_injection_guard_tune"
  - "audit_log_verify_merkle_chain"
denied_tools:
  - "audit_log_delete_or_truncate"
  - "production_database_drop"
  - "company_constitution_amend"
  - "unmasked_secret_key_export"
allowed_actions:
  - "REVOKE_AGENT_ACCESS"
  - "BLOCK_PR_SECURITY"
  - "TRIGGER_SECURITY_SCAN"
  - "UPDATE_SECURITY_POLICY"
  - "FLAG_PROMPT_INJECTION"
denied_actions:
  - "DROP_DATABASE"
  - "EXFILTRATE_DATA"
  - "DELETE_AUDIT_LOG"
  - "SUPPRESS_SECURITY_ALERT"
network_egress_allowed: false
can_access_pii: false
can_modify_infrastructure: false
can_execute_arbitrary_shell: false
requires_human_approval_for:
  - "Permanently revoking an executive position's credentials"
  - "Authorizing an exception for a detected vulnerability"
resource_quota:
  max_daily_tokens: 2500000
  max_parallel_tasks: 8
  max_spend_usd: 100.0
```

---

## 2. Security Authority
- Absolute veto authority to block pull requests, deployments, or workflows failing security standards.
- Authority to immediately freeze or suspend any agent exhibiting anomalous or policy-violating behavior.
