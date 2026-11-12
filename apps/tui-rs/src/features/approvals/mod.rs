pub mod model;
pub mod ui;

pub use model::*;
pub use ui::*;

use crate::AppState;

pub fn inspector_text(state: &AppState) -> Option<String> {
    let q = &state.approval_queue_state;
    let item = q.selected_item()?;

    let mut out = format!(
        "GATE INSPECTOR\n\nID         : {}\nTITLE      : {}\nCATEGORY   : {} {}\nRISK       : {}\nSTATUS     : {}\nACTION     : {}\nTARGET     : {}\nREQUESTOR  : {} ({})\nPROJECT    : {}\nREASON     : {}\nDIGEST     : {}\n",
        item.id,
        item.title,
        item.category.symbol(),
        item.category.label(),
        item.risk_level,
        item.status.as_str(),
        item.action,
        item.target,
        item.requesting_agent,
        item.agent_role,
        item.project_name,
        item.reason,
        &item.payload_fingerprint[..item.payload_fingerprint.len().min(16)]
    );

    if let Some(ref notes) = item.reviewer_notes {
        out.push_str(&format!("\nREVIEWER NOTES: {notes}\n"));
    }

    out.push_str("\nACTIONS:\n[a] Approve\n[r] Reject\n[k] Request Changes\n");
    Some(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::client::{AgentPayload, ApprovalPayload, ProjectPayload, TaskPayload};
    use ratatui::{backend::TestBackend, Terminal};

    fn create_test_fixtures() -> (Vec<ApprovalPayload>, Vec<AgentPayload>, Vec<TaskPayload>, Vec<ProjectPayload>) {
        let approvals = vec![
            ApprovalPayload {
                id: "appr-01".into(),
                title: "Production Release v2.4.0".into(),
                action: Some("DEPLOY_PRODUCTION".into()),
                target: Some("k8s-prod-us-east-1".into()),
                risk_level: Some("CRITICAL".into()),
                category: None,
                agent_id: Some("agent-01".into()),
                agent_name: Some("LeadArchitect".into()),
                agent_role: Some("Software Architecture".into()),
                project_id: Some("proj-core".into()),
                project_name: Some("Enterprise Core".into()),
                task_id: Some("task-deploy".into()),
                status: "PENDING".into(),
                reason: Some("All staging integration tests passed".into()),
                proposed_payload: Some(serde_json::json!({
                    "version": "2.4.0",
                    "replicas": 8,
                    "canary": true
                })),
                action_fingerprint: None,
                expires_at: Some("2026-10-29T00:00:00Z".into()),
                reviewer_user_id: None,
                reviewer_notes: None,
                resolved_at: None,
                created_at: Some("2026-10-28T08:00:00Z".into()),
            },
            ApprovalPayload {
                id: "appr-02".into(),
                title: "Drop Deprecated Legacy Orders Table".into(),
                action: Some("DROP_TABLE".into()),
                target: Some("orders_legacy_v1".into()),
                risk_level: Some("HIGH".into()),
                category: None,
                agent_id: Some("agent-02".into()),
                agent_name: Some("BackendLead".into()),
                agent_role: Some("Data Engineering".into()),
                project_id: Some("proj-core".into()),
                project_name: Some("Enterprise Core".into()),
                task_id: Some("task-migrate".into()),
                status: "PENDING".into(),
                reason: Some("Table drained and replaced by v2 ledger".into()),
                proposed_payload: Some(serde_json::json!({
                    "table": "orders_legacy_v1",
                    "backup_verified": true
                })),
                action_fingerprint: None,
                expires_at: None,
                reviewer_user_id: None,
                reviewer_notes: None,
                resolved_at: None,
                created_at: Some("2026-10-28T08:30:00Z".into()),
            },
            ApprovalPayload {
                id: "appr-03".into(),
                title: "Increase GPU Budget Allocation".into(),
                action: Some("INCREASE_BUDGET".into()),
                target: Some("aws-monthly-cap".into()),
                risk_level: Some("LOW".into()),
                category: None,
                agent_id: Some("agent-03".into()),
                agent_name: Some("InfraDevOps".into()),
                agent_role: Some("Infrastructure".into()),
                project_id: Some("proj-core".into()),
                project_name: Some("Enterprise Core".into()),
                task_id: None,
                status: "APPROVED".into(),
                reason: Some("Load testing headroom needed".into()),
                proposed_payload: Some(serde_json::json!({
                    "delta_usd": 500
                })),
                action_fingerprint: None,
                expires_at: None,
                reviewer_user_id: Some("user-ceo".into()),
                reviewer_notes: Some("Approved within quarterly reserve".into()),
                resolved_at: Some("2026-10-28T08:45:00Z".into()),
                created_at: Some("2026-10-28T08:15:00Z".into()),
            },
        ];

        let agents = vec![
            AgentPayload {
                id: "agent-01".into(),
                name: "LeadArchitect".into(),
                role_title: Some("Software Architecture".into()),
                status: "BUSY".into(),
                autonomy: Some("Tier 3".into()),
                current_task: None,
            },
            AgentPayload {
                id: "agent-02".into(),
                name: "BackendLead".into(),
                role_title: Some("Data Engineering".into()),
                status: "IDLE".into(),
                autonomy: Some("Tier 2".into()),
                current_task: None,
            },
        ];

        let tasks = vec![
            TaskPayload {
                id: "task-deploy".into(),
                project_id: Some("proj-core".into()),
                title: "Production Release Pipeline".into(),
                status: "WAITING".into(),
                priority: Some("P0".into()),
                assigned_agent_id: Some("agent-01".into()),
                dependencies: vec![],
                ..Default::default()
            },
        ];

        let projects = vec![
            ProjectPayload {
                id: "proj-core".into(),
                name: "Enterprise Core".into(),
                objective: Some("Core Platform".into()),
                status: Some("ACTIVE".into()),
                priority: Some("HIGH".into()),
            },
        ];

        (approvals, agents, tasks, projects)
    }

    #[test]
    fn test_approval_categories_and_risk_classification() {
        let (approvals, agents, tasks, projects) = create_test_fixtures();
        let state = ApprovalQueueState::from_payloads(&approvals, &agents, &tasks, &projects);

        assert_eq!(state.items.len(), 3);

        // appr-01: DEPLOY_PRODUCTION -> ProductionRelease, CRITICAL
        let it1 = &state.items[0];
        assert_eq!(it1.category, ApprovalCategory::ProductionRelease);
        assert_eq!(it1.risk_level, "CRITICAL");
        assert!(it1.is_consequential());

        // appr-02: DROP_TABLE -> DestructiveOperation, HIGH
        let it2 = &state.items[1];
        assert_eq!(it2.category, ApprovalCategory::DestructiveOperation);
        assert_eq!(it2.risk_level, "HIGH");
        assert!(it2.is_consequential());

        // appr-03: INCREASE_BUDGET -> ResourceBudgetIncrease, LOW
        let it3 = &state.items[2];
        assert_eq!(it3.category, ApprovalCategory::ResourceBudgetIncrease);
        assert_eq!(it3.status, ApprovalStatusEnum::Approved);
        assert!(!it3.is_consequential());
    }

    #[test]
    fn test_consequential_confirmation_required_for_critical_and_high() {
        let (approvals, agents, tasks, projects) = create_test_fixtures();
        let mut state = ApprovalQueueState::from_payloads(&approvals, &agents, &tasks, &projects);

        // Consequential item (CRITICAL): requires explicit confirmation modal
        let needs_conf = state.request_decision("appr-01", ApprovalStatusEnum::Approved).unwrap();
        assert!(needs_conf);
        assert!(state.confirmation_modal_open);
        assert!(state.pending_action.is_some());

        // Confirm the decision
        let record = state.confirm_pending_decision("CEO (devine-general)", None).unwrap();
        assert_eq!(record.decision, "APPROVED");
        assert_eq!(record.actor, "CEO (devine-general)");
        assert!(!state.confirmation_modal_open);

        // Item status is now APPROVED
        assert_eq!(state.items[0].status, ApprovalStatusEnum::Approved);
    }

    #[test]
    fn test_replay_prevention_duplicate_submission_blocked() {
        let (approvals, agents, tasks, projects) = create_test_fixtures();
        let mut state = ApprovalQueueState::from_payloads(&approvals, &agents, &tasks, &projects);

        // First decision succeeds
        let _ = state.request_decision("appr-01", ApprovalStatusEnum::Approved).unwrap();
        let _ = state.confirm_pending_decision("CEO", None).unwrap();

        // Attempting to decide on already resolved request fails (Replay prevention)
        let err = state.request_decision("appr-01", ApprovalStatusEnum::Approved);
        assert!(err.is_err());
        assert!(err.unwrap_err().contains("Replay error"));
    }

    #[test]
    fn test_stale_approval_invalidation_on_tampered_payload() {
        let (approvals, agents, tasks, projects) = create_test_fixtures();
        let state = ApprovalQueueState::from_payloads(&approvals, &agents, &tasks, &projects);

        let it = &state.items[0];
        let original_payload = serde_json::json!({
            "version": "2.4.0",
            "replicas": 8,
            "canary": true
        });

        // Exact payload is valid and not stale
        assert!(!it.is_stale_with(&original_payload));
        assert!(state.validate_not_stale("appr-01", &original_payload));

        // Tampered payload (e.g. canary turned off, replicas changed) MUST be flagged as stale
        let tampered_payload = serde_json::json!({
            "version": "2.4.0",
            "replicas": 32,
            "canary": false
        });
        assert!(it.is_stale_with(&tampered_payload));
        assert!(!state.validate_not_stale("appr-01", &tampered_payload));
    }

    #[test]
    fn test_approval_filtering_by_status_and_category() {
        let (approvals, agents, tasks, projects) = create_test_fixtures();
        let mut state = ApprovalQueueState::from_payloads(&approvals, &agents, &tasks, &projects);

        // Pending count: 2
        assert_eq!(state.pending_count(), 2);
        assert_eq!(state.high_priority_pending_count(), 2);

        // Filter by Pending: 2 items
        state.filter_status = Some(ApprovalStatusEnum::Pending);
        assert_eq!(state.filtered_indices().len(), 2);

        // Filter by Approved: 1 item
        state.filter_status = Some(ApprovalStatusEnum::Approved);
        assert_eq!(state.filtered_indices().len(), 1);

        // Filter by Category: DestructiveOperation: 1 item
        state.filter_status = None;
        state.filter_category = Some(ApprovalCategory::DestructiveOperation);
        assert_eq!(state.filtered_indices().len(), 1);
        assert_eq!(state.items[state.filtered_indices()[0]].id, "appr-02");
    }

    #[test]
    fn test_render_docked_approvals_pane() {
        let backend = TestBackend::new(60, 16);
        let mut terminal = Terminal::new(backend).unwrap();
        let mut state = AppState::new();

        let (approvals, agents, tasks, projects) = create_test_fixtures();
        state.approval_queue_state = ApprovalQueueState::from_payloads(&approvals, &agents, &tasks, &projects);
        state.focus_pane = crate::common::FocusPane::Approvals;
        state.is_nav_mode = true;

        terminal
            .draw(|f| {
                render_docked_approvals_pane(f, &state, f.area());
            })
            .unwrap();

        let buffer = terminal.backend().buffer();
        let content: String = buffer
            .content()
            .iter()
            .map(|cell| cell.symbol())
            .collect();

        assert!(content.contains("CEO APPROVAL QUEUE"));
        assert!(content.contains("PENDING"));
        assert!(content.contains("DEPLOY_PRODUCTION") || content.contains("DEPLOY"));
    }

    #[test]
    fn test_render_approvals_tab_empty() {
        let backend = TestBackend::new(100, 30);
        let mut terminal = Terminal::new(backend).unwrap();
        let state = AppState::new();

        terminal
            .draw(|f| {
                render_approvals_tab(f, &state, f.area());
            })
            .unwrap();

        let buffer = terminal.backend().buffer();
        let buffer_str: String = buffer
            .content()
            .iter()
            .map(|cell| cell.symbol())
            .collect();

        assert!(buffer_str.contains("Executive Governance") || buffer_str.contains("ZERO GOVERNANCE GATES PENDING"));
    }

    #[test]
    fn test_render_approvals_tab_with_items() {
        let backend = TestBackend::new(120, 35);
        let mut terminal = Terminal::new(backend).unwrap();
        let mut state = AppState::new();

        let (approvals, agents, tasks, projects) = create_test_fixtures();
        state.approval_queue_state = ApprovalQueueState::from_payloads(&approvals, &agents, &tasks, &projects);

        terminal
            .draw(|f| {
                render_approvals_tab(f, &state, f.area());
            })
            .unwrap();

        let buffer = terminal.backend().buffer();
        let content: String = buffer
            .content()
            .iter()
            .map(|cell| cell.symbol())
            .collect();

        assert!(content.contains("CEO Executive Governance"));
        assert!(content.contains("Production Release"));
        assert!(content.contains("Gate Inspector"));
    }

    #[test]
    fn test_approvals_inspector_text_with_selected_item() {
        let mut state = AppState::new();
        let (approvals, agents, tasks, projects) = create_test_fixtures();
        state.approval_queue_state = ApprovalQueueState::from_payloads(&approvals, &agents, &tasks, &projects);

        let text = inspector_text(&state);
        assert!(text.is_some());
        let t = text.unwrap();
        assert!(t.contains("GATE INSPECTOR"));
        assert!(t.contains("appr-01"));
        assert!(t.contains("CRITICAL"));
    }
}
