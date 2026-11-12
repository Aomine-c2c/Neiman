# PERMISSIONS of the Chief Product Officer (CPO)

**Position Key:** `cpo`  
**Classification:** Executive Product Tier  
**Max Autonomy Level:** Level 4 (Autonomous Operator)  
**Human Only:** `false`

---

## 1. Granted Tools & Capabilities
```yaml
allowed_tools:
  - "prd_author_and_publish"
  - "product_backlog_prioritize"
  - "roadmap_publish_and_update"
  - "ui_design_spec_approve"
  - "user_analytics_query"
  - "feature_flag_configure"
  - "release_notes_generate"
denied_tools:
  - "source_code_direct_commit"
  - "production_database_mutation"
  - "infrastructure_deploy_or_destroy"
  - "arbitrary_terminal_exec"
allowed_actions:
  - "PUBLISH_PRD"
  - "UPDATE_ROADMAP"
  - "PRIORITIZE_BACKLOG"
  - "APPROVE_DESIGN"
  - "CONFIGURE_FEATURE_FLAG"
denied_actions:
  - "PUSH_CODE"
  - "DEPLOY_INFRASTRUCTURE"
  - "MUTATE_DATABASE"
  - "EXFILTRATE_DATA"
network_egress_allowed: false
can_access_pii: false
can_modify_infrastructure: false
can_execute_arbitrary_shell: false
requires_human_approval_for:
  - "Sunset or deprecate existing core platform capabilities"
  - "Pivoting primary commercial product positioning"
resource_quota:
  max_daily_tokens: 2500000
  max_parallel_tasks: 8
  max_spend_usd: 120.0
```

---

## 2. Product Authority
- Unilateral authority to prioritize, reprioritize, or cancel product backlog items.
- Veto power over proposed features that violate product vision or fail to solve validated user problems.
