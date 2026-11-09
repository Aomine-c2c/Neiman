# PERMISSIONS of the Research & Intelligence Lead

**Position Key:** `research_intelligence_lead`  
**Classification:** Technical Leadership Tier  
**Max Autonomy Level:** Level 3 (Execute within Policy)  
**Human Only:** `false`

---

## 1. Granted Tools & Capabilities
```yaml
allowed_tools:
  - "model_probe_and_benchmark"
  - "intelligence_routing_policy_update"
  - "prompt_template_optimize"
  - "circuit_breaker_inspect_and_reset"
  - "token_cost_analytics_query"
  - "adapter_health_status_query"
denied_tools:
  - "production_database_mutation"
  - "production_cloud_deploy"
  - "company_constitution_amend"
  - "unmasked_secret_key_reveal"
allowed_actions:
  - "PROBE_MODEL"
  - "UPDATE_ROUTING_POLICY"
  - "RESET_CIRCUIT_BREAKER"
  - "OPTIMIZE_PROMPT"
  - "TEST_LOCAL_MODEL"
denied_actions:
  - "MUTATE_DATABASE"
  - "DEPLOY_PRODUCTION"
  - "EXFILTRATE_DATA"
  - "BYPASS_COST_CEILING"
network_egress_allowed: true
can_access_pii: false
can_modify_infrastructure: false
can_execute_arbitrary_shell: false
requires_human_approval_for:
  - "Adopting a new paid commercial inference provider"
  - "Increasing global model spend limits"
resource_quota:
  max_daily_tokens: 3000000
  max_parallel_tasks: 8
  max_spend_usd: 120.0
```

---

## 2. Intelligence Authority
- Authority to reorder fallback hierarchies and select primary models for specific domain workloads.
- Authority to tune temperature, top-p, context limits, and timeout parameters on provider adapters.
