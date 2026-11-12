use ratatui::{
    layout::{Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, List, ListItem, Paragraph, Row, Table, Wrap},
    Frame,
};

use crate::{
    common::FocusPane,
    features::decisions::model::{DecisionTraceState, EpistemicType, VerificationOutcome},
    AppState,
};

const COLOR_CYAN: Color = Color::Rgb(14, 243, 206);

/// Compact Docked Pane in Command Cockpit
pub fn render_docked_decision_trace_pane(f: &mut Frame, state: &AppState, area: Rect) {
    let dt = &state.decision_trace_state;
    let is_focused = state.is_nav_mode && state.focus_pane == FocusPane::DecisionTrace;

    let indices = dt.filtered_indices();
    let title = format!(" ⚖ DECISION & AUDIT TRACE ({}) ", indices.len());

    let mut list_items = Vec::new();
    for (i, &trace_idx) in indices.iter().take(10).enumerate() {
        if let Some(item) = dt.traces.get(trace_idx) {
            let is_sel = is_focused && i == dt.selected_idx;
            let (ep_color, ep_prefix) = match item.epistemic_type {
                EpistemicType::ObservedFact => (Color::Green, "◉ FACT: "),
                EpistemicType::ModelExplanation => (Color::Yellow, "◇ EXPL: "),
                EpistemicType::ProposedAction => (COLOR_CYAN, "▷ PROP: "),
                EpistemicType::CompletedAction => (Color::LightGreen, "✓ DONE: "),
            };

            let pointer = if is_sel { "▶ " } else { "  " };
            let row_line = Line::from(vec![
                Span::styled(pointer, Style::default().fg(if is_sel { COLOR_CYAN } else { Color::DarkGray })),
                Span::styled(format!("[{}] ", item.id), Style::default().fg(Color::DarkGray)),
                Span::styled(ep_prefix, Style::default().fg(ep_color).add_modifier(Modifier::BOLD)),
                Span::styled(format!("{}: ", item.actor_name), Style::default().fg(Color::White).add_modifier(Modifier::BOLD)),
                Span::styled(&item.summary, Style::default().fg(if is_sel { COLOR_CYAN } else { Color::Gray })),
            ]);
            list_items.push(ListItem::new(row_line));
        }
    }

    if list_items.is_empty() {
        list_items.push(ListItem::new(Line::from(vec![
            Span::styled("  No decision traces matching active criteria.", Style::default().fg(Color::DarkGray)),
        ])));
    }

    let block = Block::default()
        .title(title)
        .borders(Borders::ALL)
        .border_style(Style::default().fg(if is_focused { COLOR_CYAN } else { Color::DarkGray }));

    f.render_widget(List::new(list_items).block(block), area);
}

/// Full Split-View Workspace for Decision & Audit Trace Tab / Zoom Mode
pub fn render_decision_trace_workspace(f: &mut Frame, state: &AppState, area: Rect) {
    let dt = &state.decision_trace_state;

    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(4), // Filter & Status Header
            Constraint::Percentage(50), // Decision Trace Table
            Constraint::Percentage(50), // Deep-Dive Evidence & Tool Trace Inspector
        ])
        .split(area);

    // 1. Filter Header Bar
    let epistemic_filter_str = dt.filter_epistemic.map(|e| e.as_str()).unwrap_or("ALL");
    let header_lines = vec![
        Line::from(vec![
            Span::styled("DECISION & AUDIT TRACE REGISTRY", Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD)),
            Span::styled(" | Grounded Epistemic Observability & Cryptographic Policy Audits", Style::default().fg(Color::DarkGray)),
        ]),
        Line::from(vec![
            Span::styled("Filter Epistemic (e): ", Style::default().fg(Color::DarkGray)),
            Span::styled(epistemic_filter_str, Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD)),
            Span::styled(" | Search (q): ", Style::default().fg(Color::DarkGray)),
            Span::styled(if dt.filter_query.is_empty() { "None (All records)" } else { &dt.filter_query }, Style::default().fg(Color::White)),
            Span::styled(" | Navigate: [j/k] | Refresh: [r] | Zoom: [z]", Style::default().fg(Color::DarkGray)),
        ]),
    ];
    let header = Paragraph::new(header_lines).block(
        Block::default().borders(Borders::ALL).border_style(Style::default().fg(COLOR_CYAN)),
    );
    f.render_widget(header, chunks[0]);

    // 2. Decision Traces Table
    let indices = dt.filtered_indices();
    let rows: Vec<Row> = indices
        .iter()
        .enumerate()
        .map(|(i, &idx)| {
            let item = &dt.traces[idx];
            let is_sel = i == dt.selected_idx;
            let row_style = if is_sel {
                Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD)
            } else {
                Style::default().fg(Color::White)
            };

            let (ep_color, ep_label) = match item.epistemic_type {
                EpistemicType::ObservedFact => (Color::Green, "FACT"),
                EpistemicType::ModelExplanation => (Color::Yellow, "EXPLANATION"),
                EpistemicType::ProposedAction => (COLOR_CYAN, "PROPOSAL"),
                EpistemicType::CompletedAction => (Color::LightGreen, "COMPLETED"),
            };

            let verif_style = match item.verification_outcome {
                VerificationOutcome::Passed => Style::default().fg(Color::Green),
                VerificationOutcome::Failed => Style::default().fg(Color::Red).add_modifier(Modifier::BOLD),
                VerificationOutcome::Pending => Style::default().fg(Color::Yellow),
                VerificationOutcome::Exempt => Style::default().fg(Color::DarkGray),
            };

            Row::new(vec![
                Span::styled(&item.id, row_style),
                Span::styled(item.timestamp.format("%H:%M:%S").to_string(), Style::default().fg(Color::DarkGray)),
                Span::styled(ep_label, Style::default().fg(ep_color).add_modifier(Modifier::BOLD)),
                Span::styled(&item.actor_name, row_style),
                Span::styled(item.task_id.as_deref().unwrap_or("-"), Style::default().fg(Color::DarkGray)),
                Span::styled(&item.summary, row_style),
                Span::styled(item.verification_outcome.as_str(), verif_style),
            ])
        })
        .collect();

    let table = Table::new(
        rows,
        [
            Constraint::Length(10), // ID
            Constraint::Length(10), // Time
            Constraint::Length(14), // Epistemic
            Constraint::Length(22), // Actor
            Constraint::Length(14), // Task ID
            Constraint::Min(28),    // Summary
            Constraint::Length(12), // Verification
        ],
    )
    .header(
        Row::new(vec!["ID", "TIME", "EPISTEMIC", "RESPONSIBLE ACTOR", "TASK ID", "DECISION SUMMARY", "VERIFICATION"])
            .style(Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD)),
    )
    .block(
        Block::default()
            .title(format!(" Audited Decisions ({}) ", indices.len()))
            .borders(Borders::ALL)
            .border_style(Style::default().fg(COLOR_CYAN)),
    );
    f.render_widget(table, chunks[1]);

    // 3. Deep-Dive Inspector Pane
    render_decision_inspector(f, dt, chunks[2]);
}

fn render_decision_inspector(f: &mut Frame, dt: &DecisionTraceState, area: Rect) {
    let block = Block::default()
        .title(" Decision Evidence, Tool Invocations & Verification Trace ")
        .borders(Borders::ALL)
        .border_style(Style::default().fg(COLOR_CYAN));

    let item = match dt.selected_item() {
        Some(it) => it,
        None => {
            let p = Paragraph::new("Select a decision trace record to inspect.").block(block);
            f.render_widget(p, area);
            return;
        }
    };

    let sub_chunks = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(50), Constraint::Percentage(50)])
        .split(area);

    // Left Column: Metadata & Evidence
    let mut left_lines = Vec::new();
    left_lines.push(Line::from(vec![
        Span::styled("DECISION ID   : ", Style::default().fg(Color::DarkGray)),
        Span::styled(&item.id, Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD)),
        Span::styled(format!(" ({})", item.timestamp.format("%Y-%m-%d %H:%M:%S UTC")), Style::default().fg(Color::DarkGray)),
    ]));
    left_lines.push(Line::from(vec![
        Span::styled("RESPONSIBLE   : ", Style::default().fg(Color::DarkGray)),
        Span::styled(&item.actor_name, Style::default().fg(Color::White).add_modifier(Modifier::BOLD)),
        Span::styled(format!(" [{}]", item.actor_role), Style::default().fg(Color::Yellow)),
    ]));
    left_lines.push(Line::from(vec![
        Span::styled("OBJECTIVE     : ", Style::default().fg(Color::DarkGray)),
        Span::styled(&item.task_objective, Style::default().fg(Color::White)),
    ]));
    left_lines.push(Line::from(vec![
        Span::styled("POLICY CHECK  : ", Style::default().fg(Color::DarkGray)),
        Span::styled(&item.policy_check_result, Style::default().fg(if item.policy_check_result == "APPROVED" { Color::Green } else { Color::Red }).add_modifier(Modifier::BOLD)),
        Span::styled(if item.sensitive_redacted { " [SENSITIVE CREDENTIALS REDACTED]" } else { "" }, Style::default().fg(Color::Cyan)),
    ]));
    left_lines.push(Line::from(Span::styled("SUPPORTING EVIDENCE & GROUNDING:", Style::default().fg(Color::Yellow))));

    for ev in &item.evidence {
        left_lines.push(Line::from(vec![
            Span::styled("  • ", Style::default().fg(Color::Cyan)),
            Span::styled(format!("[{}] ", ev.source_type), Style::default().fg(Color::White).add_modifier(Modifier::BOLD)),
            Span::styled(&ev.summary, Style::default().fg(Color::Gray)),
        ]));
        left_lines.push(Line::from(vec![
            Span::styled("    Ref: ", Style::default().fg(Color::DarkGray)),
            Span::styled(&ev.reference, Style::default().fg(COLOR_CYAN)),
        ]));
    }

    f.render_widget(Paragraph::new(left_lines).block(Block::default().borders(Borders::NONE)).wrap(Wrap { trim: true }), sub_chunks[0]);

    // Right Column: Tools Invoked & Links
    let mut right_lines = Vec::new();
    right_lines.push(Line::from(Span::styled("OBSERVED TOOL INVOCATIONS & OUTCOMES:", Style::default().fg(Color::Yellow))));

    if item.tool_invocations.is_empty() {
        right_lines.push(Line::from(Span::styled("  Zero external tool calls recorded for this action.", Style::default().fg(Color::DarkGray))));
    } else {
        for tool in &item.tool_invocations {
            let out_color = if tool.outcome_status == "SUCCESS" { Color::Green } else { Color::Red };
            right_lines.push(Line::from(vec![
                Span::styled("  ⚙ ", Style::default().fg(COLOR_CYAN)),
                Span::styled(&tool.tool_name, Style::default().fg(Color::White).add_modifier(Modifier::BOLD)),
                Span::styled(format!(" ({:.1}ms) -> ", tool.duration_ms), Style::default().fg(Color::DarkGray)),
                Span::styled(&tool.outcome_status, Style::default().fg(out_color).add_modifier(Modifier::BOLD)),
            ]));
            right_lines.push(Line::from(vec![
                Span::styled("    Args: ", Style::default().fg(Color::DarkGray)),
                Span::styled(&tool.sanitized_arguments, Style::default().fg(Color::DarkGray)),
            ]));
        }
    }

    right_lines.push(Line::from(""));
    right_lines.push(Line::from(Span::styled("TRACEABILITY LINKS:", Style::default().fg(Color::Yellow))));
    if let Some(ref l) = item.log_link {
        right_lines.push(Line::from(vec![
            Span::styled("  • Execution Logs  : ", Style::default().fg(Color::DarkGray)),
            Span::styled(l, Style::default().fg(COLOR_CYAN)),
        ]));
    }
    if let Some(ref c) = item.code_diff_link {
        right_lines.push(Line::from(vec![
            Span::styled("  • Code Diff / Git : ", Style::default().fg(Color::DarkGray)),
            Span::styled(c, Style::default().fg(Color::Green)),
        ]));
    }
    if let Some(ref t) = item.test_run_link {
        right_lines.push(Line::from(vec![
            Span::styled("  • Verification Run: ", Style::default().fg(Color::DarkGray)),
            Span::styled(t, Style::default().fg(Color::Yellow)),
        ]));
    }
    if let Some(ref a) = item.approval_id {
        right_lines.push(Line::from(vec![
            Span::styled("  • CEO Approval ID : ", Style::default().fg(Color::DarkGray)),
            Span::styled(a, Style::default().fg(Color::LightMagenta)),
        ]));
    }

    f.render_widget(Paragraph::new(right_lines).block(Block::default().borders(Borders::NONE)).wrap(Wrap { trim: true }), sub_chunks[1]);
}
