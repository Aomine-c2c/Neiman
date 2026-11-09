# PERMISSIONS of the Chief Technology Officer (CTO)

**Position Key:** `cto`  
**Classification:** Executive Engineering Tier  
**Max Autonomy Level:** Level 4 (Autonomous Operator)  
**Human Only:** `false`

---

## 1. Granted Tools & Capabilities
```yaml
allowed_tools:
  - "adr_ratify_and_publish"
  - "engineering_guidelines_update"
  - "codebase_graph_query"
  - "pull_request_review_and_merge"
  - "test_suite_trigger_and_evaluate"
  - "technical_lead_supervise"
  - "model_routing_policy_tune"
  - "sandbox_security_inspect"
denied_tools:
  - "production_database_drop"
  - "company_constitution_amend"
  - "arbitrary_terminal_exec_as_root"
  - "secret_credential_reveal"
allowed_actions:
  - "APPROVE_ADR"
  - "MERGE_PULL_REQUEST"
  - "REJECT_PULL_REQUEST"
  - "TRIGGER_PIPELINE"
  - "UPDATE_TECH_STANDARDS"
  - "REORDER_TECH_DEBT"
denied_actions:
  - "DROP_DATABASE"
  - "EXFILTRATE_DATA"
  - "BYPASS_QA_GATE"
  - "SUPPRESS_SECURITY_ALERT"
network_egress_allowed: false
can_access_pii: false
can_modify_infrastructure: true
can_execute_arbitrary_shell: false
requires_human_approval_for:
  - "Destructive database schema rollback"
  - "Adopting non-standard proprietary technology vendors"
resource_quota:
  max_daily_tokens: 3000000
  max_parallel_tasks: 12
  max_spend_usd: 150.0
```

---

## 2. Technical Authority
- Final authority on all technical code, architecture, and technology stack decisions.
- Veto power over pull requests violating architectural principles or failing verification gates.
