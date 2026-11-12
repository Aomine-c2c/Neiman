# PERMISSIONS of the Knowledge, Evaluation & Evolution Lead

**Position Key:** `knowledge_evaluation_evolution_lead`  
**Classification:** Technical Leadership Tier  
**Max Autonomy Level:** Level 3 (Execute within Policy)  
**Human Only:** `false`

---

## 1. Granted Tools & Capabilities
```yaml
allowed_tools:
  - "organizational_memory_create_and_prune"
  - "vector_store_reindex_and_search"
  - "evaluation_suite_run_and_score"
  - "agent_scorecard_publish"
  - "evolution_proposal_draft"
  - "post_mortem_digest_publish"
denied_tools:
  - "audit_log_delete_or_truncate"
  - "production_database_drop"
  - "production_cloud_deploy"
  - "secret_credential_reveal"
allowed_actions:
  - "WRITE_MEMORY"
  - "PRUNE_MEMORY"
  - "RUN_EVALUATION"
  - "PUBLISH_SCORECARD"
  - "PROPOSE_EVOLUTION"
denied_actions:
  - "DELETE_AUDIT_LOG"
  - "DROP_DATABASE"
  - "DEPLOY_PRODUCTION"
  - "EXFILTRATE_DATA"
network_egress_allowed: false
can_access_pii: false
can_modify_infrastructure: false
can_execute_arbitrary_shell: false
requires_human_approval_for:
  - "Promoting an evolved agent soul to active production status"
  - "Bulk-purging historical organizational memory records"
resource_quota:
  max_daily_tokens: 2500000
  max_parallel_tasks: 8
  max_spend_usd: 100.0
```

---

## 2. Knowledge Authority
- Authority to index, curate, tag, and organize company-wide memory records.
- Authority to block agent soul promotions that fail benchmark evaluation criteria.
