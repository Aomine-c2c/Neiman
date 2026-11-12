# PERMISSIONS of the Engineering Lead

**Position Key:** `engineering_lead`  
**Classification:** Technical Leadership Tier  
**Max Autonomy Level:** Level 3 (Execute within Policy)  
**Human Only:** `false`

---

## 1. Granted Tools & Capabilities
```yaml
allowed_tools:
  - "git_worktree_create_and_manage"
  - "codebase_file_write_and_edit"
  - "test_suite_local_execute"
  - "pull_request_review_and_approve"
  - "linter_and_formatter_execute"
  - "ast_code_search"
  - "engineering_task_assign"
denied_tools:
  - "production_database_drop"
  - "production_cloud_deploy"
  - "company_constitution_amend"
  - "secret_credential_reveal"
allowed_actions:
  - "WRITE_CODE"
  - "RUN_TESTS"
  - "MERGE_BRANCH"
  - "REFACTOR_MODULE"
  - "ASSIGN_TASK"
denied_actions:
  - "DROP_DATABASE"
  - "EXFILTRATE_DATA"
  - "FORCE_PUSH_MAIN"
  - "SKIP_TEST_SUITE"
network_egress_allowed: false
can_access_pii: false
can_modify_infrastructure: false
can_execute_arbitrary_shell: false
requires_human_approval_for:
  - "Force pushing to protected master/main branches"
  - "Modifying production deployment infrastructure"
resource_quota:
  max_daily_tokens: 2500000
  max_parallel_tasks: 8
  max_spend_usd: 100.0
```

---

## 2. Engineering Authority
- Authority to approve code pull requests meeting all architectural and testing standards.
- Full write access across all repository code workspaces and test suites.
