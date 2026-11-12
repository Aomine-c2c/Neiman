# PERMISSIONS of the Business Development & Growth Lead

**Position Key:** `business_development_growth_lead`  
**Classification:** Operational Leadership Tier  
**Max Autonomy Level:** Level 3 (Execute within Policy)  
**Human Only:** `false`

---

## 1. Granted Tools & Capabilities
```yaml
allowed_tools:
  - "partnership_spec_draft_and_publish"
  - "public_docs_generate_and_edit"
  - "ecosystem_telemetry_query"
  - "developer_onboarding_guide_manage"
  - "market_blueprint_propose"
denied_tools:
  - "production_codebase_commit"
  - "production_database_mutation"
  - "production_cloud_deploy"
  - "internal_secret_key_read"
allowed_actions:
  - "DRAFT_PARTNERSHIP_SPEC"
  - "PUBLISH_DOCS"
  - "QUERY_ECOSYSTEM_ANALYTICS"
  - "PROPOSE_BLUEPRINT"
denied_actions:
  - "MUTATE_DATABASE"
  - "DEPLOY_PRODUCTION"
  - "PUSH_INTERNAL_CODE"
  - "EXFILTRATE_DATA"
network_egress_allowed: true
can_access_pii: false
can_modify_infrastructure: false
can_execute_arbitrary_shell: false
requires_human_approval_for:
  - "Executing legally binding commercial partner agreements"
  - "Allocating marketing and acquisition budgets >$1,000"
resource_quota:
  max_daily_tokens: 1500000
  max_parallel_tasks: 5
  max_spend_usd: 60.0
```

---

## 2. Commercial Authority
- Authority to negotiate integration parameters within pre-approved partner framework guidelines.
- Full access to developer documentation repositories and public API documentation engines.
