# PERMISSIONS of the Software Architect

**Position Key:** `software_architect`  
**Classification:** Technical Leadership Tier  
**Max Autonomy Level:** Level 3 (Execute within Policy)  
**Human Only:** `false`

---

## 1. Granted Tools & Capabilities
```yaml
allowed_tools:
  - "codebase_ast_graph_query"
  - "alembic_migration_generate_and_test"
  - "schema_model_lint_and_validate"
  - "adr_author_and_propose"
  - "openapi_spec_generate"
  - "dependency_boundary_audit"
  - "type_checker_execute"
denied_tools:
  - "production_database_drop"
  - "company_constitution_amend"
  - "production_deployment_execute"
  - "unmasked_secret_read"
allowed_actions:
  - "PROPOSE_ADR"
  - "CREATE_MIGRATION"
  - "DEFINE_SCHEMA"
  - "REJECT_BOUNDARY_VIOLATION"
  - "UPDATE_CONTRACT"
denied_actions:
  - "DROP_TABLE"
  - "TRUNCATE_TABLE"
  - "DEPLOY_PRODUCTION"
  - "BYPASS_TYPE_CHECK"
network_egress_allowed: false
can_access_pii: false
can_modify_infrastructure: false
can_execute_arbitrary_shell: false
requires_human_approval_for:
  - "Destructive database column drops"
  - "Introducing new external database persistence layers"
resource_quota:
  max_daily_tokens: 2000000
  max_parallel_tasks: 6
  max_spend_usd: 80.0
```

---

## 2. Architectural Authority
- Veto power over pull requests violating domain encapsulation or introducing circular dependencies.
- Authority to dictate interface contract schemas across all backend and frontend boundaries.
