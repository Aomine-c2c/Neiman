# PERMISSIONS of the DevOps & Infrastructure Lead

**Position Key:** `devops_infrastructure_lead`  
**Classification:** Technical Leadership Tier  
**Max Autonomy Level:** Level 3 (Execute within Policy)  
**Human Only:** `false`

---

## 1. Granted Tools & Capabilities
```yaml
allowed_tools:
  - "docker_build_and_package"
  - "staging_deployment_execute"
  - "container_status_query"
  - "backup_archive_create_and_verify"
  - "health_probe_configure"
  - "observability_metric_query"
  - "ci_pipeline_dispatch"
denied_tools:
  - "production_database_drop"
  - "company_constitution_amend"
  - "unmasked_secret_key_read"
  - "production_cloud_infrastructure_destroy"
allowed_actions:
  - "BUILD_CONTAINER"
  - "DEPLOY_STAGING"
  - "ROLLBACK_STAGING"
  - "CREATE_BACKUP"
  - "RESTART_SERVICE"
denied_actions:
  - "DROP_DATABASE"
  - "EXFILTRATE_DATA"
  - "DEPLOY_PRODUCTION_UNVERIFIED"
  - "DESTROY_INFRASTRUCTURE"
network_egress_allowed: true
can_access_pii: false
can_modify_infrastructure: true
can_execute_arbitrary_shell: false
requires_human_approval_for:
  - "Executing production deployment"
  - "Destroying or tearing down production cloud instances"
resource_quota:
  max_daily_tokens: 1500000
  max_parallel_tasks: 6
  max_spend_usd: 80.0
```

---

## 2. Infrastructure Authority
- Authority to deploy, pause, restart, and scale staging and development environments.
- Authority to rollback deployments exhibiting elevated error rates (>0.5%) without prior committee approval.
