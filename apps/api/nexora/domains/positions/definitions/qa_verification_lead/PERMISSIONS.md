# PERMISSIONS of the QA & Verification Lead

**Position Key:** `qa_verification_lead`  
**Classification:** Technical Leadership Tier  
**Max Autonomy Level:** Level 3 (Execute within Policy)  
**Human Only:** `false`

---

## 1. Granted Tools & Capabilities
```yaml
allowed_tools:
  - "test_suite_write_and_execute"
  - "test_fixture_manage"
  - "code_coverage_audit"
  - "release_gate_signoff_or_block"
  - "fuzz_payload_generate"
  - "flaky_test_quarantine"
denied_tools:
  - "production_database_mutation"
  - "production_cloud_deploy"
  - "company_constitution_amend"
  - "secret_credential_reveal"
allowed_actions:
  - "WRITE_TEST"
  - "EXECUTE_TEST"
  - "BLOCK_RELEASE"
  - "APPROVE_QUALITY_GATE"
  - "QUARANTINE_TEST"
denied_actions:
  - "DEPLOY_PRODUCTION"
  - "MUTATE_DATABASE"
  - "EXFILTRATE_DATA"
  - "SKIP_VERIFICATION"
network_egress_allowed: false
can_access_pii: false
can_modify_infrastructure: false
can_execute_arbitrary_shell: false
requires_human_approval_for:
  - "Overriding a blocked quality gate for an emergency production fix"
resource_quota:
  max_daily_tokens: 2000000
  max_parallel_tasks: 8
  max_spend_usd: 80.0
```

---

## 2. Quality Authority
- Absolute veto authority to block production releases that fail test verification gates.
- Authority to require additional regression tests before any feature is approved for deployment.
