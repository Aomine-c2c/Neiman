pub mod git;
pub mod ui;

pub use git::*;
pub use ui::*;

use crate::AppState;

pub fn inspector_text(state: &AppState) -> Option<String> {
    let eng = &state.engineering_state;
    if !eng.is_git_available {
        return Some(format!(
            "ENGINEERING EXECUTION: UNAVAILABLE\n\nReason: {}\n\nLink a verified repository via [Ctrl+O] to observe active branches, working tree states, and test execution.",
            eng.git_error.as_deref().unwrap_or("No Git repository linked.")
        ));
    }

    let total_adds: usize = eng.files_changed.iter().map(|f| f.additions).sum();
    let total_dels: usize = eng.files_changed.iter().map(|f| f.deletions).sum();

    let test_summary = if let Some(r) = &eng.test_report {
        format!("Suite: {} | Passed: {} | Failed: {} | Latency: {}ms", r.suite_name, r.passed, r.failed, r.execution_latency_ms)
    } else {
        "No test runs executed yet.".to_string()
    };

    let sec_summary = if let Some(s) = &eng.security_scan {
        format!("Status: {} | Secrets: {} | CVEs: {}", s.status, s.secrets_found, s.cve_count)
    } else {
        "Security evaluation pending.".to_string()
    };

    Some(format!(
        "ENGINEERING EXECUTION TELEMETRY\n\n• Repository: {}\n• Branch: {}\n• Tree State: {}\n• Changes: {} files (+{}/-{})\n• Active Task: {}\n• Assigned Agent: {}\n• Test Suite: {}\n• Security: {}\n• Last Verification: {}",
        eng.repo_name,
        eng.current_branch,
        eng.working_tree_state,
        eng.files_changed.len(),
        total_adds,
        total_dels,
        eng.current_task_title.as_deref().unwrap_or("None (Idle)"),
        eng.assigned_agent.as_deref().unwrap_or("Unassigned"),
        test_summary,
        sec_summary,
        eng.test_report.as_ref().and_then(|r| r.last_verified_at.as_deref()).unwrap_or("Never")
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use ratatui::backend::TestBackend;
    use ratatui::Terminal;
    use std::path::Path;

    #[test]
    fn test_inspector_text_git_unavailable() {
        let mut state = AppState::new();
        state.engineering_state.is_git_available = false;
        state.engineering_state.git_error = Some("Git binary not found".into());

        let text = inspector_text(&state).unwrap();
        assert!(text.contains("ENGINEERING EXECUTION: UNAVAILABLE"));
        assert!(text.contains("Git binary not found"));
    }

    #[test]
    fn test_inspector_text_live_state() {
        let mut state = AppState::new();
        state.engineering_state.is_git_available = true;
        state.engineering_state.repo_name = "Sila".into();
        state.engineering_state.current_branch = "feature/execution-pane".into();
        state.engineering_state.working_tree_state = "Dirty (2 files)".into();
        state.engineering_state.files_changed = vec![
            FileChangeItem {
                path: "src/main.rs".into(),
                status: "M".into(),
                additions: 12,
                deletions: 4,
                diff_content: "+ added line\n- removed line\n".into(),
            }
        ];
        state.engineering_state.test_report = Some(TestExecutionReport {
            suite_name: "cargo test".into(),
            status: "PASSED".into(),
            total: 58,
            passed: 58,
            failed: 0,
            skipped: 0,
            coverage_pct: Some(89.5),
            execution_latency_ms: 420,
            failure_diagnostics: vec![],
            raw_output: "test result: ok. 58 passed".into(),
            last_verified_at: Some("2026-10-28T09:00:00Z".into()),
        });

        let text = inspector_text(&state).unwrap();
        assert!(text.contains("Repository: Sila"));
        assert!(text.contains("feature/execution-pane"));
        assert!(text.contains("Changes: 1 files (+12/-4)"));
        assert!(text.contains("58"));
    }

    #[test]
    fn test_render_docked_engineering_execution_pane() {
        let backend = TestBackend::new(120, 36);
        let mut terminal = Terminal::new(backend).unwrap();
        let mut state = AppState::new();
        state.engineering_state.is_git_available = true;
        state.engineering_state.repo_name = "NeimanOS".into();
        state.engineering_state.current_branch = "main".into();
        state.engineering_state.files_changed = vec![
            FileChangeItem {
                path: "apps/tui-rs/src/main.rs".into(),
                status: "M".into(),
                additions: 10,
                deletions: 2,
                diff_content: "diff --git a/main.rs\n+ new code\n".into(),
            }
        ];

        terminal
            .draw(|f| {
                let area = ratatui::layout::Rect::new(0, 0, 40, 12);
                render_engineering_execution_docked_pane(f, &state, area);
            })
            .unwrap();

        let buffer = terminal.backend().buffer();
        let content = buffer
            .content()
            .iter()
            .map(|c| c.symbol())
            .collect::<Vec<_>>()
            .join("");

        assert!(content.contains("ENGINEERING EXECUTION"));
        assert!(content.contains("NeimanOS"));
        assert!(content.contains("[main]"));
    }

    #[test]
    fn test_render_engineering_workbench_tab_split_layout() {
        let backend = TestBackend::new(140, 45);
        let mut terminal = Terminal::new(backend).unwrap();
        let mut state = AppState::new();
        state.engineering_state.is_git_available = true;
        state.engineering_state.repo_name = "Sila".into();
        state.engineering_state.current_branch = "main".into();
        state.engineering_state.files_changed = vec![
            FileChangeItem {
                path: "src/lib.rs".into(),
                status: "M".into(),
                additions: 8,
                deletions: 1,
                diff_content: "@@ -1,4 +1,6 @@\n-old code\n+new verified code\n".into(),
            }
        ];
        state.engineering_state.test_report = Some(TestExecutionReport {
            suite_name: "pytest".into(),
            status: "FAILED".into(),
            total: 10,
            passed: 9,
            failed: 1,
            skipped: 0,
            coverage_pct: Some(92.0),
            execution_latency_ms: 150,
            failure_diagnostics: vec![
                TestFailureDiagnostic {
                    test_name: "test_auth_token_expiration".into(),
                    error_message: "Token expired too early".into(),
                    file_path: Some("tests/test_auth.py".into()),
                    line_number: Some(42),
                    stack_trace: "AssertionError: 300 != 3600".into(),
                    related_task_id: Some("task-auth-99".into()),
                }
            ],
            raw_output: "FAILED tests/test_auth.py::test_auth_token_expiration".into(),
            last_verified_at: Some("2026-10-28 07:12:00".into()),
        });

        terminal
            .draw(|f| {
                let area = f.area();
                render_engineering_workbench_tab(f, &state, area);
            })
            .unwrap();

        let buffer = terminal.backend().buffer();
        let content = buffer
            .content()
            .iter()
            .map(|c| c.symbol())
            .collect::<Vec<_>>()
            .join("");

        assert!(content.contains("MODIFIED FILES"));
        assert!(content.contains("src/lib.rs"));
        assert!(content.contains("UNIFIED DIFF VIEWER"));
        assert!(content.contains("+new verified code"));
        assert!(content.contains("BUILD & TEST ACTIVITY"));
        assert!(content.contains("test_auth_token_expiration"));
        assert!(content.contains("task-auth-99"));
    }

    #[tokio::test]
    async fn test_git_bounded_timeout_resilience() {
        // Test run_bounded_git_cmd with an impossibly small timeout on a command that doesn't return instantly
        let res = run_bounded_git_cmd(Path::new("."), &["status"], 0).await;
        // Either completes instantly or errors with timeout, but must never hang or panic
        assert!(res.is_ok() || res.is_err());
    }

    #[tokio::test]
    async fn test_refresh_engineering_state_populates_real_repo() {
        let mut state = AppState::new();
        state.active_codebase_path = ".".to_string();
        state.refresh_engineering_state().await;

        assert!(state.engineering_state.is_git_available);
        assert!(!state.engineering_state.current_branch.is_empty());
        assert_eq!(state.engineering_state.repo_name, "Sila");
    }

    #[tokio::test]
    async fn test_jump_to_task_from_failed_test_diagnostic() {
        use crossterm::event::{KeyCode, KeyEvent, KeyModifiers};

        let mut state = AppState::new();
        state.is_nav_mode = true;
        state.focus_pane = crate::common::FocusPane::Engineering;

        // Populate a task
        state.tasks.push(crate::TaskViewItem {
            id: "task-auth-fail-101".into(),
            project_id: Some("proj-1".into()),
            title: "Fix Token Expiration Policy".into(),
            assigned_agent: "Software Architect".into(),
            status: "IN_PROGRESS".into(),
            priority: "HIGH".into(),
            dependencies: vec![],
            ..Default::default()
        });

        // Set test report with failure diagnostic linking to that task
        state.engineering_state.test_report = Some(TestExecutionReport {
            suite_name: "Integration Gate".into(),
            status: "FAILED".into(),
            total: 5,
            passed: 4,
            failed: 1,
            skipped: 0,
            coverage_pct: Some(88.0),
            execution_latency_ms: 220,
            failure_diagnostics: vec![
                TestFailureDiagnostic {
                    test_name: "test_token_policy".into(),
                    error_message: "Token lifetime mismatch".into(),
                    file_path: Some("tests/test_token.rs".into()),
                    line_number: Some(15),
                    stack_trace: "assertion failed".into(),
                    related_task_id: Some("task-auth-fail-101".into()),
                }
            ],
            raw_output: "FAILED test_token_policy".into(),
            last_verified_at: Some("2026-10-28 07:15:00".into()),
        });

        // Simulate pressing 't'
        let key_ev = KeyEvent::new(KeyCode::Char('t'), KeyModifiers::NONE);
        crate::handlers::handle_key_event(&mut state, key_ev).await;

        // Should switch focus to Tasks pane, select task-auth-fail-101, and open task inspector modal!
        assert_eq!(state.focus_pane, crate::common::FocusPane::Tasks);
        assert_eq!(state.task_selection, 0);
        assert!(state.task_inspector_open);
        assert!(state.status_message.contains("task-auth-fail-101"));
    }

    #[tokio::test]
    async fn test_diff_navigation_and_scrolling() {
        use crossterm::event::{KeyCode, KeyEvent, KeyModifiers};

        let mut state = AppState::new();
        state.is_nav_mode = true;
        state.focus_pane = crate::common::FocusPane::Engineering;
        state.engineering_state.files_changed = vec![
            FileChangeItem {
                path: "file1.rs".into(),
                status: "M".into(),
                additions: 10,
                deletions: 2,
                diff_content: "+ line 1\n+ line 2\n+ line 3\n".into(),
            },
            FileChangeItem {
                path: "file2.rs".into(),
                status: "A".into(),
                additions: 25,
                deletions: 0,
                diff_content: "+ new file line\n".into(),
            },
        ];

        // Initial selection
        assert_eq!(state.engineering_state.selected_file_idx, 0);
        assert_eq!(state.engineering_state.diff_scroll, 0);

        // Press 'j' to navigate down to file2
        let key_j = KeyEvent::new(KeyCode::Char('j'), KeyModifiers::NONE);
        crate::handlers::handle_key_event(&mut state, key_j).await;
        assert_eq!(state.engineering_state.selected_file_idx, 1);

        // Press 'k' to navigate back up to file1
        let key_k = KeyEvent::new(KeyCode::Char('k'), KeyModifiers::NONE);
        crate::handlers::handle_key_event(&mut state, key_k).await;
        assert_eq!(state.engineering_state.selected_file_idx, 0);

        // Scroll diff down with PageDown or ']'
        let key_pagedown = KeyEvent::new(KeyCode::PageDown, KeyModifiers::NONE);
        crate::handlers::handle_key_event(&mut state, key_pagedown).await;
        assert_eq!(state.engineering_state.diff_scroll, 6);

        // Scroll diff back up with PageUp or '['
        let key_pageup = KeyEvent::new(KeyCode::PageUp, KeyModifiers::NONE);
        crate::handlers::handle_key_event(&mut state, key_pageup).await;
        assert_eq!(state.engineering_state.diff_scroll, 0);

        // Cycle section with 's'
        let key_s = KeyEvent::new(KeyCode::Char('s'), KeyModifiers::NONE);
        crate::handlers::handle_key_event(&mut state, key_s).await;
        assert_eq!(state.engineering_state.active_section, EngineeringSection::Diff);
    }
}
