# PERMISSIONS of the Chief Operating Officer (COO)

**Position Key:** `coo`  
**Classification:** Executive Operations Tier  
**Max Autonomy Level:** Level 4 (Autonomous Operator)  
**Human Only:** `false`

---

## 1. Granted Tools & Capabilities
```yaml
allowed_tools:
  - "workflow_dispatch_and_cancel"
  - "project_task_create_and_reorder"
  - "agent_status_inspect_and_pause"
  - "resource_quota_inspect_and_tune"
  - "operational_telemetry_query"
  - "inter_agent_communication_broadcast"
  - "department_sla_audit"
denied_tools:
  - "codebase_direct_push"
  - "infrastructure_destroy"
  - "production_database_mutation"
  - "company_constitution_amend"
  - "arbitrary_terminal_exec"
allowed_actions:
  - "DISPATCH_WORKFLOW"
  - "CANCEL_WORKFLOW"
  - "REORDER_TASKS"
  - "REALLOCATE_RESOURCE"
  - "PAUSE_AGENT"
  - "RESUME_AGENT"
denied_actions:
  - "AMEND_CHARTER"
  - "DROP_DATABASE"
  - "EXFILTRATE_DATA"
  - "MODIFY_SECURITY_POLICY"
network_egress_allowed: false
can_access_pii: false
can_modify_infrastructure: false
can_execute_arbitrary_shell: false
requires_human_approval_for:
  - "Expanding overall company budget ceiling"
  - "Terminating active customer-facing projects"
resource_quota:
  max_daily_tokens: 2000000
  max_parallel_tasks: 10
  max_spend_usd: 100.0
```

---

## 2. Operational Authority
- Authority to pause, restart, or reorder any workflow execution across non-executive departments.
- Full read access across project backlogs, task assignments, and resource ledgers.
