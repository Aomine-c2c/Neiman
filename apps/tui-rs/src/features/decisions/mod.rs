pub mod model;
pub mod ui;

pub use model::{DecisionEvidence, DecisionTraceItem, DecisionTraceState, EpistemicType, ToolInvocation, VerificationOutcome};
pub use ui::{render_decision_trace_workspace, render_docked_decision_trace_pane};

use crate::app::AppState;

pub fn inspector_text(state: &AppState) -> Option<String> {
    state.decision_trace_state.selected_item().map(|item| {
        format!(
            "DECISION AUDIT TRACE\n\n\
            ID: {}\n\
            Timestamp: {}\n\
            Actor: {} ({})\n\
            Epistemic: {}\n\
            Objective: {}\n\
            Summary: {}\n\
            Policy Check: {}\n\
            Verification: {}\n\
            Tools Invoked: {}\n\
            Evidence Items: {}\n\
            Sensitive Redacted: {}",
            item.id,
            item.timestamp.format("%Y-%m-%d %H:%M:%S UTC"),
            item.actor_name,
            item.actor_role,
            item.epistemic_type.as_str(),
            item.task_objective,
            item.summary,
            item.policy_check_result,
            item.verification_outcome.as_str(),
            item.tool_invocations.len(),
            item.evidence.len(),
            item.sensitive_redacted
        )
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use ratatui::backend::TestBackend;
    use ratatui::Terminal;

    #[test]
    fn test_decision_trace_filtering_and_search() {
        let mut dt = DecisionTraceState::new();
        assert_eq!(dt.traces.len(), 3);

        // Filter by EpistemicType
        dt.filter_epistemic = Some(EpistemicType::ObservedFact);
        let indices = dt.filtered_indices();
        assert_eq!(indices.len(), 1);
        assert_eq!(dt.traces[indices[0]].id, "dec-902");

        // Filter by Query
        dt.filter_epistemic = None;
        dt.filter_query = "procfs".into();
        let query_indices = dt.filtered_indices();
        assert_eq!(query_indices.len(), 1);
        assert_eq!(dt.traces[query_indices[0]].id, "dec-901");
    }

    #[test]
    fn test_epistemic_distinctions() {
        let dt = DecisionTraceState::new();
        let fact = dt.traces.iter().find(|t| t.epistemic_type == EpistemicType::ObservedFact).unwrap();
        assert_eq!(fact.epistemic_type.as_str(), "FACT");
        assert_eq!(fact.epistemic_type.symbol(), "◉");

        let action = dt.traces.iter().find(|t| t.epistemic_type == EpistemicType::CompletedAction).unwrap();
        assert_eq!(action.epistemic_type.as_str(), "COMPLETED");
        assert_eq!(action.epistemic_type.symbol(), "✓");
    }

    #[test]
    fn test_sensitive_data_redaction_and_links() {
        let dt = DecisionTraceState::new();
        let item = &dt.traces[0];
        assert!(item.sensitive_redacted);
        assert!(item.log_link.is_some());
        assert!(item.code_diff_link.is_some());
        assert!(item.test_run_link.is_some());
    }

    #[test]
    fn test_render_docked_decision_trace_pane() {
        let backend = TestBackend::new(80, 20);
        let mut terminal = Terminal::new(backend).unwrap();
        let mut app_state = AppState::new();
        app_state.decision_trace_state = DecisionTraceState::new();

        terminal
            .draw(|f| {
                render_docked_decision_trace_pane(f, &app_state, f.area());
            })
            .unwrap();

        let buffer = terminal.backend().buffer();
        let content: String = buffer
            .content()
            .iter()
            .map(|cell| cell.symbol())
            .collect();

        assert!(content.contains("DECISION & AUDIT TRACE"));
        assert!(content.contains("dec-901"));
    }

    #[test]
    fn test_render_decision_trace_workspace() {
        let backend = TestBackend::new(120, 30);
        let mut terminal = Terminal::new(backend).unwrap();
        let mut app_state = AppState::new();
        app_state.decision_trace_state = DecisionTraceState::new();

        terminal
            .draw(|f| {
                render_decision_trace_workspace(f, &app_state, f.area());
            })
            .unwrap();

        let buffer = terminal.backend().buffer();
        let content: String = buffer
            .content()
            .iter()
            .map(|cell| cell.symbol())
            .collect();

        assert!(content.contains("DECISION & AUDIT TRACE REGISTRY"));
        assert!(content.contains("CoreEngineerAgent"));
    }
}
