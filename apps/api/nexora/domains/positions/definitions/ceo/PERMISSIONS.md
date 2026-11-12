# PERMISSIONS of the Chief Executive Officer (CEO)

**Position Key:** `ceo`  
**Classification:** Human Sovereign Executive  
**Max Autonomy Level:** Level 5 (Executive Owner)  
**Human Only:** `true`

---

## 1. Granted Tools & Capabilities
```yaml
allowed_tools:
  - "all_administrative_tools"
  - "executive_approval_sign"
  - "company_budget_allocate"
  - "company_constitution_amend"
  - "agent_provision_and_deprovision"
  - "policy_override_authorize"
  - "audit_log_full_inspect"
  - "project_archive_and_purge"
  - "telemetry_deep_inspect"
denied_tools: []
allowed_actions:
  - "AUTHORIZE_BUDGET"
  - "SIGN_APPROVAL"
  - "AMEND_CHARTER"
  - "TERMINATE_AGENT"
  - "REVOKE_CAPABILITY"
  - "DEPLOY_PRODUCTION"
  - "ARCHIVE_COMPANY"
denied_actions: []
network_egress_allowed: true
can_access_pii: true
can_modify_infrastructure: true
can_execute_arbitrary_shell: true
requires_human_approval_for: []
resource_quota:
  max_daily_tokens: 10000000
  max_parallel_tasks: 20
  max_spend_usd: 10000.0
```

---

## 2. Decision Sovereignty
- Unrestricted read access across all company domains, projects, tasks, memory stores, and audit logs.
- Absolute veto authority over any automated workflow execution or proposed agent action.
- Exclusive privilege to create, assign, or reassign C-level organizational roles.
