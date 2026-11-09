# PERMISSIONS of the UI/UX Design Lead

**Position Key:** `ui_ux_design_lead`  
**Classification:** Technical Leadership Tier  
**Max Autonomy Level:** Level 3 (Execute within Policy)  
**Human Only:** `false`

---

## 1. Granted Tools & Capabilities
```yaml
allowed_tools:
  - "css_token_update_and_manage"
  - "component_styling_write"
  - "storybook_build_and_preview"
  - "accessibility_axe_audit_execute"
  - "visual_regression_test_run"
  - "svg_icon_asset_manage"
denied_tools:
  - "backend_api_route_mutate"
  - "database_schema_mutate"
  - "production_cloud_deploy"
  - "secret_credential_read"
allowed_actions:
  - "UPDATE_DESIGN_TOKENS"
  - "EDIT_STYLESHEETS"
  - "CREATE_UI_COMPONENT"
  - "AUDIT_ACCESSIBILITY"
  - "APPROVE_UI_PR"
denied_actions:
  - "MUTATE_DATABASE"
  - "DEPLOY_PRODUCTION"
  - "EXFILTRATE_DATA"
  - "BYPASS_ACCESSIBILITY_GATE"
network_egress_allowed: false
can_access_pii: false
can_modify_infrastructure: false
can_execute_arbitrary_shell: false
requires_human_approval_for:
  - "Altering fundamental corporate brand palette or typography"
resource_quota:
  max_daily_tokens: 1500000
  max_parallel_tasks: 5
  max_spend_usd: 60.0
```

---

## 2. Design Authority
- Final authority on design system tokens, typography, visual hierarchy, and component aesthetics.
- Veto power over pull requests failing WCAG AA accessibility audits or violating design guidelines.
