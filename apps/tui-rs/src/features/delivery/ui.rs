use ratatui::{
    layout::{Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, Paragraph, Row, Table, Wrap},
    Frame,
};

use crate::{
    common::FocusPane,
    features::delivery::model::{GateStatus, QaReleaseState},
    AppState,
};

const COLOR_CYAN: Color = Color::Rgb(14, 243, 206);

/// Compact Docked Pane in Cockpit
pub fn render_docked_qa_release_pane(f: &mut Frame, state: &AppState, area: Rect) {
    let q = &state.qa_release_state;
    let is_focused = state.is_nav_mode && state.focus_pane == FocusPane::QaRelease;

    let run = match q.current_run() {
        Some(r) => r,
        None => {
            let p = Paragraph::new("No active delivery runs.")
                .block(Block::default().title(" 🚀 QA & RELEASE PIPELINE ").borders(Borders::ALL));
            f.render_widget(p, area);
            return;
        }
    };

    let failed_cnt = run.failed_gate_count();
    let title = if failed_cnt > 0 {
        format!(" 🚀 QA & RELEASE PIPELINE [{}] [⛔ {} GATES FAILED] ", run.run_id, failed_cnt)
    } else {
        format!(" 🚀 QA & RELEASE PIPELINE [{}] [✓ PIPELINE GREEN] ", run.run_id)
    };

    let border_color = if is_focused {
        if failed_cnt > 0 { Color::Red } else { COLOR_CYAN }
    } else {
        Color::DarkGray
    };

    let block = Block::default()
        .title(title)
        .borders(Borders::ALL)
        .border_style(Style::default().fg(border_color));

    let mut lines = Vec::new();

    // 1. Pipeline Stepper
    let mut step_spans = Vec::new();
    for (i, gate) in run.gates.iter().enumerate() {
        if i > 0 {
            step_spans.push(Span::styled("─", Style::default().fg(Color::DarkGray)));
        }

        let code = gate.gate_type.short_code();
        let sym = gate.status.symbol();
        let col = match gate.status {
            GateStatus::Passed => Color::Green,
            GateStatus::Failed | GateStatus::Blocked => Color::Red,
            GateStatus::Running => COLOR_CYAN,
            GateStatus::Pending => Color::Yellow,
            GateStatus::Skipped => Color::DarkGray,
        };

        let style = if i == q.selected_gate_idx {
            Style::default().fg(Color::Black).bg(col).add_modifier(Modifier::BOLD)
        } else {
            Style::default().fg(col).add_modifier(Modifier::BOLD)
        };

        step_spans.push(Span::styled(format!("[{code} {sym}]"), style));
    }
    lines.push(Line::from(step_spans));

    // 2. Run Meta
    lines.push(Line::from(vec![
        Span::styled("RUN: ", Style::default().fg(Color::DarkGray)),
        Span::styled(format!("{} @ {} ", run.git_branch, &run.commit_sha[..run.commit_sha.len().min(7)]), Style::default().fg(Color::White)),
        Span::styled(format!("[{}] ", run.target_environment), Style::default().fg(Color::Yellow)),
        Span::styled(format!("({:.1}s)", run.duration_seconds), Style::default().fg(Color::DarkGray)),
    ]));

    // 3. Release Authorization Status
    match run.can_authorize_production_release() {
        Ok(_) => {
            lines.push(Line::from(vec![
                Span::styled("STATUS : ", Style::default().fg(Color::DarkGray)),
                Span::styled("✓ PRODUCTION AUTHORIZED (Policy verified & CEO approved)", Style::default().fg(Color::Green).add_modifier(Modifier::BOLD)),
            ]));
        }
        Err(ref reason) => {
            lines.push(Line::from(vec![
                Span::styled("STATUS : ", Style::default().fg(Color::DarkGray)),
                Span::styled(format!("⛔ {reason}"), Style::default().fg(Color::Red).add_modifier(Modifier::BOLD)),
            ]));
        }
    }

    // 4. Selected Gate Detail
    if let Some(gate) = q.current_gate() {
        lines.push(Line::from(vec![
            Span::styled("GATE   : ", Style::default().fg(Color::DarkGray)),
            Span::styled(format!("{} ", gate.name), Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD)),
            Span::styled(format!("[{}] ", gate.status.as_str()), Style::default().fg(if gate.status == GateStatus::Passed { Color::Green } else { Color::Red })),
            Span::styled(format!("Agent: {}", gate.responsible_agent), Style::default().fg(Color::DarkGray)),
        ]));

        if let Some(ref diag) = gate.failure_diagnostic {
            lines.push(Line::from(vec![
                Span::styled("DIAG   : ", Style::default().fg(Color::Red).add_modifier(Modifier::BOLD)),
                Span::styled(diag, Style::default().fg(Color::White)),
            ]));
        } else {
            lines.push(Line::from(vec![
                Span::styled("EVID   : ", Style::default().fg(Color::DarkGray)),
                Span::styled(&gate.evidence_summary, Style::default().fg(Color::DarkGray)),
            ]));
        }
    }

    lines.push(Line::from(vec![
        Span::styled("Keys: [↑/↓] Gate  [t] Jump Task  [e] View Diff  [z] Zoom Pipeline", Style::default().fg(Color::DarkGray)),
    ]));

    let p = Paragraph::new(lines).block(block).wrap(Wrap { trim: true });
    f.render_widget(p, area);
}

/// Full QA & Release Pipeline Workspace
pub fn render_qa_release_workspace(f: &mut Frame, state: &AppState, area: Rect) {
    let q = &state.qa_release_state;

    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3), // Top run header
            Constraint::Min(8),    // Split: Stage Table + Gate Inspector
        ])
        .split(area);

    let run = match q.current_run() {
        Some(r) => r,
        None => {
            let p = Paragraph::new("No delivery pipeline runs available.").block(Block::default().borders(Borders::ALL));
            f.render_widget(p, area);
            return;
        }
    };

    // 1. Top Bar
    let auth_badge = match run.can_authorize_production_release() {
        Ok(_) => Span::styled(" [✓ PROD RELEASE AUTHORIZED] ", Style::default().fg(Color::Black).bg(Color::Green).add_modifier(Modifier::BOLD)),
        Err(_) => Span::styled(" [⛔ RELEASE BLOCKED BY FAILED GATES] ", Style::default().fg(Color::White).bg(Color::Red).add_modifier(Modifier::BOLD)),
    };

    let top_line = Line::from(vec![
        Span::styled(" DELIVERY RUN: ", Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD)),
        Span::styled(&run.run_id, Style::default().fg(Color::White).add_modifier(Modifier::BOLD)),
        Span::raw(" | "),
        Span::styled(format!("Branch: {} @ {} ", run.git_branch, &run.commit_sha[..run.commit_sha.len().min(7)]), Style::default().fg(Color::Cyan)),
        Span::raw(" | "),
        Span::styled(format!("Env: {} ", run.target_environment), Style::default().fg(Color::Yellow)),
        Span::raw(" | "),
        auth_badge,
    ]);

    let top_block = Block::default()
        .title(format!(" {} ", run.title))
        .borders(Borders::ALL)
        .border_style(Style::default().fg(COLOR_CYAN));
    f.render_widget(Paragraph::new(top_line).block(top_block), chunks[0]);

    // 2. Split: Left (50%) Stage Table, Right (50%) Gate Inspector
    let main_chunks = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(52), Constraint::Percentage(48)])
        .split(chunks[1]);

    render_stages_table(f, q, run, main_chunks[0]);
    render_gate_inspector(f, q, run, main_chunks[1]);
}

fn render_stages_table(f: &mut Frame, q: &QaReleaseState, run: &crate::features::delivery::model::DeliveryPipelineRun, area: Rect) {
    let rows: Vec<Row> = run
        .gates
        .iter()
        .enumerate()
        .map(|(i, gate)| {
            let is_selected = i == q.selected_gate_idx;
            let row_style = if is_selected {
                Style::default().bg(Color::Rgb(15, 35, 55)).fg(Color::White).add_modifier(Modifier::BOLD)
            } else {
                Style::default()
            };

            let status_style = match gate.status {
                GateStatus::Passed => Style::default().fg(Color::Green).add_modifier(Modifier::BOLD),
                GateStatus::Failed | GateStatus::Blocked => Style::default().fg(Color::Red).add_modifier(Modifier::BOLD),
                GateStatus::Running => Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD),
                GateStatus::Pending => Style::default().fg(Color::Yellow),
                GateStatus::Skipped => Style::default().fg(Color::DarkGray),
            };

            Row::new(vec![
                Span::styled(gate.gate_type.short_code(), row_style),
                Span::styled(&gate.name, row_style),
                Span::styled(&gate.responsible_agent, row_style),
                Span::styled(format!("{} {}", gate.status.symbol(), gate.status.as_str()), status_style),
                Span::styled(&gate.evidence_summary, Style::default().fg(Color::DarkGray)),
            ])
        })
        .collect();

    let table = Table::new(
        rows,
        [
            Constraint::Length(8),
            Constraint::Length(28),
            Constraint::Length(22),
            Constraint::Length(14),
            Constraint::Min(20),
        ],
    )
    .header(
        Row::new(vec!["CODE", "GATE PIPELINE STAGE", "RESPONSIBLE AGENT", "STATUS", "EVIDENCE SUMMARY"])
            .style(Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD)),
    )
    .block(
        Block::default()
            .title(format!(" Pipeline Gates & Progression ({}) ", run.gates.len()))
            .borders(Borders::ALL)
            .border_style(Style::default().fg(COLOR_CYAN)),
    );

    f.render_widget(table, area);
}

fn render_gate_inspector(f: &mut Frame, q: &QaReleaseState, run: &crate::features::delivery::model::DeliveryPipelineRun, area: Rect) {
    let block = Block::default()
        .title(" Gate Deep-Dive Inspector & Artifact Audit ")
        .borders(Borders::ALL)
        .border_style(Style::default().fg(COLOR_CYAN));

    let gate = match q.current_gate() {
        Some(g) => g,
        None => {
            let p = Paragraph::new("Select a gate to inspect evidence.").block(block);
            f.render_widget(p, area);
            return;
        }
    };

    let mut lines = vec![
        // Gate Details
        Line::from(vec![
            Span::styled("GATE NAME     : ", Style::default().fg(Color::DarkGray)),
            Span::styled(&gate.name, Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD)),
        ]),
        Line::from(vec![
            Span::styled("STAGE TYPE    : ", Style::default().fg(Color::DarkGray)),
            Span::styled(gate.gate_type.label(), Style::default().fg(Color::White)),
        ]),
        Line::from(vec![
            Span::styled("AGENT OWNER   : ", Style::default().fg(Color::DarkGray)),
            Span::styled(&gate.responsible_agent, Style::default().fg(Color::Yellow)),
        ]),
        Line::from(vec![
            Span::styled("LINKED TASK   : ", Style::default().fg(Color::DarkGray)),
            Span::styled(gate.associated_task_id.as_deref().unwrap_or("None (Global Gate)"), Style::default().fg(Color::Cyan)),
        ]),
    ];

    let (status_col, status_txt) = match gate.status {
        GateStatus::Passed => (Color::Green, "PASSED (Criteria Verified)"),
        GateStatus::Failed => (Color::Red, "FAILED (Release Blocked)"),
        GateStatus::Blocked => (Color::Red, "BLOCKED (Upstream Failure)"),
        GateStatus::Running => (COLOR_CYAN, "RUNNING (Active Execution)"),
        GateStatus::Pending => (Color::Yellow, "PENDING (Awaiting Pre-requisites)"),
        GateStatus::Skipped => (Color::DarkGray, "SKIPPED"),
    };
    lines.push(Line::from(vec![
        Span::styled("GATE STATUS   : ", Style::default().fg(Color::DarkGray)),
        Span::styled(status_txt, Style::default().fg(status_col).add_modifier(Modifier::BOLD)),
    ]));

    lines.push(Line::from(""));

    // Failure Diagnostics if failed
    if let Some(ref diag) = gate.failure_diagnostic {
        lines.push(Line::from(vec![
            Span::styled("── ROOT-CAUSE FAILURE DIAGNOSTIC ──────────────────", Style::default().fg(Color::Red)),
        ]));
        lines.push(Line::from(Span::styled(diag, Style::default().fg(Color::White))));
        lines.push(Line::from(""));
    }

    // Evidence Details
    lines.push(Line::from(vec![
        Span::styled("── VERIFIED ARTIFACT EVIDENCE ─────────────────────", Style::default().fg(Color::DarkGray)),
    ]));
    for ev in &gate.evidence_details {
        lines.push(Line::from(vec![
            Span::styled("  • ", Style::default().fg(COLOR_CYAN)),
            Span::styled(ev, Style::default().fg(Color::White)),
        ]));
    }

    // Rollback record if present
    if let Some(ref rb) = run.rollback_record {
        lines.push(Line::from(""));
        lines.push(Line::from(vec![
            Span::styled("── ROLLBACK TELEMETRY & AUDIT ─────────────────────", Style::default().fg(Color::Yellow)),
        ]));
        lines.push(Line::from(vec![
            Span::styled("ROLLED BACK TO : ", Style::default().fg(Color::DarkGray)),
            Span::styled(format!("{} (from {})", rb.rolled_back_to_sha, rb.rolled_back_from_sha), Style::default().fg(COLOR_CYAN)),
        ]));
        lines.push(Line::from(vec![
            Span::styled("REASON         : ", Style::default().fg(Color::DarkGray)),
            Span::styled(&rb.reason, Style::default().fg(Color::White)),
        ]));
        lines.push(Line::from(vec![
            Span::styled("STATUS         : ", Style::default().fg(Color::DarkGray)),
            Span::styled(if rb.successful { "✓ Rollback Successful" } else { "✗ Rollback Failed" }, Style::default().fg(if rb.successful { Color::Green } else { Color::Red })),
        ]));
    }

    lines.push(Line::from(""));
    lines.push(Line::from(vec![
        Span::styled("ACTIONS: [t] Jump Task  [e] View Code Diff  [r] Refresh Pipeline", Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD)),
    ]));

    let p = Paragraph::new(lines).block(block).wrap(Wrap { trim: true });
    f.render_widget(p, area);
}
