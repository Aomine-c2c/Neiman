pub mod model;
pub mod ui;

pub use model::*;
pub use ui::*;

use crate::AppState;

pub fn inspector_text(state: &AppState) -> Option<String> {
    let q = &state.qa_release_state;
    let run = q.current_run()?;
    let gate = q.current_gate()?;

    let mut out = format!(
        "QA & RELEASE PIPELINE INSPECTOR\n\n\
        RUN ID        : {}\n\
        TITLE         : {}\n\
        BRANCH        : {} ({})\n\
        ENVIRONMENT   : {}\n\
        GATE          : {}\n\
        STAGE         : {}\n\
        STATUS        : {}\n\
        RESPONSIBLE   : {}\n\
        TASK          : {}\n\
        EVIDENCE      : {}\n",
        run.run_id,
        run.title,
        run.git_branch,
        &run.commit_sha[..run.commit_sha.len().min(7)],
        run.target_environment,
        gate.name,
        gate.gate_type.label(),
        gate.status.as_str(),
        gate.responsible_agent,
        gate.associated_task_id.as_deref().unwrap_or("None"),
        gate.evidence_summary
    );

    if let Some(ref diag) = gate.failure_diagnostic {
        out.push_str(&format!("\nFAILURE DIAGNOSTIC:\n{diag}\n"));
    }

    match run.can_authorize_production_release() {
        Ok(_) => out.push_str("\nRELEASE AUTHORIZATION: AUTHORIZED\n"),
        Err(e) => out.push_str(&format!("\nRELEASE AUTHORIZATION: BLOCKED\nReason: {e}\n")),
    }

    Some(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use ratatui::{backend::TestBackend, Terminal};

    #[test]
    fn test_qa_pipeline_gates_progression() {
        let state = QaReleaseState::new();
        assert_eq!(state.runs.len(), 2);

        let run1 = &state.runs[0];
        assert_eq!(run1.gates.len(), 7);

        // Gate 0: Build Passed
        assert_eq!(run1.gates[0].gate_type, QaGateType::Build);
        assert_eq!(run1.gates[0].status, GateStatus::Passed);

        // Gate 5: QA Acceptance Failed
        assert_eq!(run1.gates[5].gate_type, QaGateType::AcceptanceVerification);
        assert_eq!(run1.gates[5].status, GateStatus::Failed);

        // Gate 6: Production Release Blocked
        assert_eq!(run1.gates[6].gate_type, QaGateType::ProductionRelease);
        assert_eq!(run1.gates[6].status, GateStatus::Blocked);
    }

    #[test]
    fn test_failed_gate_blocks_production_release() {
        let state = QaReleaseState::new();
        let run_blocked = &state.runs[0];

        // Must reject production authorization because QA Acceptance failed
        let res = run_blocked.can_authorize_production_release();
        assert!(res.is_err());
        let err_msg = res.unwrap_err();
        assert!(err_msg.contains("Release BLOCKED"));
        assert!(err_msg.contains("QA Acceptance Criteria"));
    }

    #[test]
    fn test_production_authorization_requires_all_gates_and_ceo_signoff() {
        let state = QaReleaseState::new();
        let run_verified = &state.runs[1];

        // All gates passed + CEO signoff -> Authorized
        assert!(run_verified.can_authorize_production_release().is_ok());

        // Without CEO signoff -> Blocked
        let mut unsigned_run = run_verified.clone();
        unsigned_run.ceo_signoff = false;
        let res = unsigned_run.can_authorize_production_release();
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("requires explicit CEO authorization signoff"));
    }

    #[test]
    fn test_rollback_record_tracking() {
        let state = QaReleaseState::new();
        let run_with_rb = &state.runs[1];

        assert!(run_with_rb.rollback_record.is_some());
        let rb = run_with_rb.rollback_record.as_ref().unwrap();
        assert_eq!(rb.rolled_back_to_sha, "f4b7a12");
        assert!(rb.successful);
        assert!(rb.reason.contains("memory growth"));
    }

    #[test]
    fn test_render_docked_qa_release_pane() {
        let backend = TestBackend::new(80, 20);
        let mut terminal = Terminal::new(backend).unwrap();
        let mut app_state = AppState::new();
        app_state.qa_release_state = QaReleaseState::new();

        terminal
            .draw(|f| {
                render_docked_qa_release_pane(f, &app_state, f.area());
            })
            .unwrap();

        let buffer = terminal.backend().buffer();
        let content: String = buffer
            .content()
            .iter()
            .map(|cell| cell.symbol())
            .collect();

        assert!(content.contains("QA & RELEASE PIPELINE"));
        assert!(content.contains("BUILD"));
        assert!(content.contains("TEST"));
        assert!(content.contains("STATUS"));
    }

    #[test]
    fn test_render_qa_release_workspace() {
        let backend = TestBackend::new(120, 35);
        let mut terminal = Terminal::new(backend).unwrap();
        let mut app_state = AppState::new();
        app_state.qa_release_state = QaReleaseState::new();

        terminal
            .draw(|f| {
                render_qa_release_workspace(f, &app_state, f.area());
            })
            .unwrap();

        let buffer = terminal.backend().buffer();
        let content: String = buffer
            .content()
            .iter()
            .map(|cell| cell.symbol())
            .collect();

        assert!(content.contains("DELIVERY RUN"));
        assert!(content.contains("Pipeline Gates & Progression"));
        assert!(content.contains("Gate Deep-Dive Inspector"));
    }
}
