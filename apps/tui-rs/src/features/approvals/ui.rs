use ratatui::{
    layout::{Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, Clear, List, ListItem, Paragraph, Row, Table, Wrap},
    Frame,
};

use crate::{
    common::{ConnectionState, FocusPane},
    features::approvals::model::ApprovalStatusEnum,
    AppState,
};

const COLOR_CYAN: Color = Color::Rgb(14, 243, 206);

/// Compact dockable pane in Cockpit (Right or Left Column)
pub fn render_docked_approvals_pane(f: &mut Frame, state: &AppState, area: Rect) {
    let q = &state.approval_queue_state;
    let is_focused = state.is_nav_mode && state.focus_pane == FocusPane::Approvals;
    let pending_cnt = q.pending_count();
    let high_cnt = q.high_priority_pending_count();

    let title = if pending_cnt > 0 {
        if high_cnt > 0 {
            format!(" ⚖ CEO APPROVAL QUEUE [⚡ {pending_cnt} PENDING | ⚠️ {high_cnt} HIGH] ")
        } else {
            format!(" ⚖ CEO APPROVAL QUEUE [⚡ {pending_cnt} PENDING] ")
        }
    } else {
        " ⚖ CEO APPROVAL QUEUE [0 PENDING] ".to_string()
    };

    let border_color = if is_focused {
        if high_cnt > 0 {
            Color::Yellow
        } else {
            COLOR_CYAN
        }
    } else {
        Color::DarkGray
    };

    let block = Block::default()
        .title(title)
        .borders(Borders::ALL)
        .border_style(Style::default().fg(border_color));

    if q.items.is_empty() {
        let msg = match state.connection_state {
            ConnectionState::Offline => "○ BACKEND OFFLINE\nApproval gates unavailable while disconnected.",
            ConnectionState::Connecting => "⠋ Synchronizing approval queue...",
            _ => "● ZERO GOVERNANCE GATES PENDING\nNo operations currently awaiting CEO approval.",
        };
        let p = Paragraph::new(msg)
            .block(block)
            .style(Style::default().fg(Color::DarkGray))
            .wrap(Wrap { trim: true });
        f.render_widget(p, area);
        return;
    }

    let filtered = q.filtered_indices();
    let max_display = area.height.saturating_sub(2) as usize;

    let items: Vec<ListItem> = filtered
        .iter()
        .take(max_display)
        .enumerate()
        .map(|(display_idx, &real_idx)| {
            let item = &q.items[real_idx];
            let is_selected = is_focused && display_idx == q.selected_index;

            let status_color = match item.status {
                ApprovalStatusEnum::Approved => Color::Green,
                ApprovalStatusEnum::Rejected => Color::Red,
                ApprovalStatusEnum::ChangesRequested => Color::Yellow,
                ApprovalStatusEnum::Pending => {
                    if item.is_consequential() {
                        Color::Rgb(255, 80, 80)
                    } else {
                        COLOR_CYAN
                    }
                }
                ApprovalStatusEnum::Expired => Color::DarkGray,
                ApprovalStatusEnum::Cancelled => Color::DarkGray,
            };

            let risk_style = match item.risk_level.to_uppercase().as_str() {
                "CRITICAL" => Style::default().fg(Color::Black).bg(Color::Red).add_modifier(Modifier::BOLD),
                "HIGH" => Style::default().fg(Color::Black).bg(Color::Yellow).add_modifier(Modifier::BOLD),
                "MEDIUM" => Style::default().fg(Color::Yellow),
                _ => Style::default().fg(Color::Green),
            };

            let cursor = if is_selected { "▶ " } else { "  " };

            let line = Line::from(vec![
                Span::styled(cursor, Style::default().fg(COLOR_CYAN)),
                Span::styled(format!("{} ", item.category.symbol()), Style::default()),
                Span::styled(
                    format!("[{}] ", &item.risk_level[..item.risk_level.len().min(4)]),
                    risk_style,
                ),
                Span::styled(
                    format!("{} ", &item.id[..item.id.len().min(8)]),
                    Style::default().fg(Color::DarkGray),
                ),
                Span::styled(
                    format!("{}: ", item.action),
                    Style::default().fg(Color::White).add_modifier(Modifier::BOLD),
                ),
                Span::styled(
                    format!("{} ", item.target),
                    Style::default().fg(COLOR_CYAN),
                ),
                Span::styled(
                    format!("({}) ", item.requesting_agent),
                    Style::default().fg(Color::DarkGray),
                ),
                Span::styled(
                    format!("[{}]", item.status.as_str()),
                    Style::default().fg(status_color).add_modifier(Modifier::BOLD),
                ),
            ]);

            if is_selected {
                ListItem::new(line).style(Style::default().bg(Color::Rgb(10, 30, 45)))
            } else {
                ListItem::new(line)
            }
        })
        .collect();

    f.render_widget(List::new(items).block(block), area);
}

/// Full CEO Governance & Approval Queue Workspace (Tab 6 or Zoomed pane)
pub fn render_approvals_tab(f: &mut Frame, state: &AppState, area: Rect) {
    let q = &state.approval_queue_state;

    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3), // Top metric & filter bar
            Constraint::Min(8),    // Split: List + Inspector
        ])
        .split(area);

    // 1. Top Metric & Filter Bar
    let pending_cnt = q.pending_count();
    let high_cnt = q.high_priority_pending_count();

    let status_filter_label = q.filter_status
        .map(|s| s.as_str())
        .unwrap_or("ALL");

    let cat_filter_label = q.filter_category
        .map(|c| c.label())
        .unwrap_or("ALL");

    let filter_line = Line::from(vec![
        Span::styled(" GATES: ", Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD)),
        Span::styled(
            format!(" [⚡ {pending_cnt} PENDING] "),
            if pending_cnt > 0 {
                Style::default().fg(Color::Black).bg(Color::Yellow).add_modifier(Modifier::BOLD)
            } else {
                Style::default().fg(Color::DarkGray)
            },
        ),
        Span::raw(" "),
        Span::styled(
            format!(" [⚠️ {high_cnt} HIGH/CRITICAL] "),
            if high_cnt > 0 {
                Style::default().fg(Color::White).bg(Color::Red).add_modifier(Modifier::BOLD)
            } else {
                Style::default().fg(Color::DarkGray)
            },
        ),
        Span::raw(" | "),
        Span::styled("[s] Status Filter: ", Style::default().fg(Color::DarkGray)),
        Span::styled(status_filter_label, Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD)),
        Span::raw(" | "),
        Span::styled("[c] Category Filter: ", Style::default().fg(Color::DarkGray)),
        Span::styled(cat_filter_label, Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD)),
        Span::raw(" | "),
        Span::styled("Keys: [a] Approve  [r] Reject  [k] Request Changes  [Space] Detail", Style::default().fg(Color::DarkGray)),
    ]);

    let filter_block = Block::default()
        .title(" CEO Executive Governance & Four-Eyes Release Gates ")
        .borders(Borders::ALL)
        .border_style(Style::default().fg(COLOR_CYAN));

    f.render_widget(Paragraph::new(filter_line).block(filter_block), chunks[0]);

    // 2. Split: Left (55%) Queue Table, Right (45%) Decision Inspector
    let main_chunks = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(55), Constraint::Percentage(45)])
        .split(chunks[1]);

    render_queue_table(f, q, main_chunks[0]);
    render_decision_inspector(f, q, main_chunks[1]);

    // 3. Consequential confirmation modal if active
    if q.confirmation_modal_open {
        render_approval_confirmation_modal(f, q, area);
    }
}

fn render_queue_table(f: &mut Frame, q: &crate::features::approvals::model::ApprovalQueueState, area: Rect) {
    if q.items.is_empty() {
        let empty_p = Paragraph::new(
            "● ZERO GOVERNANCE GATES PENDING\n\nNo pending approval requests. Human-in-the-loop gates will appear here when an agent proposes an action exceeding its autonomy tier."
        )
        .block(Block::default().title(" Approval Request Queue ").borders(Borders::ALL))
        .style(Style::default().fg(Color::DarkGray))
        .wrap(Wrap { trim: true });
        f.render_widget(empty_p, area);
        return;
    }

    let filtered = q.filtered_indices();

    let rows: Vec<Row> = filtered
        .iter()
        .enumerate()
        .map(|(display_idx, &real_idx)| {
            let item = &q.items[real_idx];
            let is_selected = display_idx == q.selected_index;

            let row_style = if is_selected {
                Style::default().bg(Color::Rgb(15, 35, 55)).fg(Color::White).add_modifier(Modifier::BOLD)
            } else {
                Style::default()
            };

            let risk_style = match item.risk_level.to_uppercase().as_str() {
                "CRITICAL" => Style::default().fg(Color::Red).add_modifier(Modifier::BOLD),
                "HIGH" => Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD),
                "MEDIUM" => Style::default().fg(Color::Yellow),
                _ => Style::default().fg(Color::Green),
            };

            let status_style = match item.status {
                ApprovalStatusEnum::Approved => Style::default().fg(Color::Green).add_modifier(Modifier::BOLD),
                ApprovalStatusEnum::Rejected => Style::default().fg(Color::Red).add_modifier(Modifier::BOLD),
                ApprovalStatusEnum::ChangesRequested => Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD),
                ApprovalStatusEnum::Pending => {
                    if item.is_consequential() {
                        Style::default().fg(Color::Red).add_modifier(Modifier::BOLD)
                    } else {
                        Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD)
                    }
                }
                _ => Style::default().fg(Color::DarkGray),
            };

            let short_id = if item.id.len() > 8 { &item.id[..8] } else { &item.id };
            let action_target = format!("{} → {}", item.action, item.target);

            Row::new(vec![
                Span::styled(short_id, row_style),
                Span::styled(format!("{} {}", item.category.symbol(), item.category.label()), row_style),
                Span::styled(&item.risk_level, risk_style),
                Span::styled(action_target, row_style),
                Span::styled(&item.requesting_agent, row_style),
                Span::styled(format!("{} {}", item.status.symbol(), item.status.as_str()), status_style),
            ])
        })
        .collect();

    let table = Table::new(
        rows,
        [
            Constraint::Length(10), // ID
            Constraint::Length(22), // Category
            Constraint::Length(10), // Risk
            Constraint::Min(24),    // Action & Target
            Constraint::Length(18), // Agent
            Constraint::Length(18), // Status
        ],
    )
    .header(
        Row::new(vec!["ID", "CATEGORY", "RISK", "REQUESTED ACTION", "AGENT", "STATUS"])
            .style(Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD)),
    )
    .block(
        Block::default()
            .title(format!(" Pending & Recent Gates ({}) ", filtered.len()))
            .borders(Borders::ALL)
            .border_style(Style::default().fg(COLOR_CYAN)),
    );

    f.render_widget(table, area);
}

fn render_decision_inspector(f: &mut Frame, q: &crate::features::approvals::model::ApprovalQueueState, area: Rect) {
    let block = Block::default()
        .title(" Gate Inspector & Audit Evidence ")
        .borders(Borders::ALL)
        .border_style(Style::default().fg(COLOR_CYAN));

    let item = match q.selected_item() {
        Some(it) => it,
        None => {
            let p = Paragraph::new("Select a gate from the queue to inspect.")
                .block(block)
                .style(Style::default().fg(Color::DarkGray));
            f.render_widget(p, area);
            return;
        }
    };

    let mut lines = Vec::new();

    // Header
    lines.push(Line::from(vec![
        Span::styled("REQUEST ID    : ", Style::default().fg(Color::DarkGray)),
        Span::styled(&item.id, Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD)),
    ]));
    lines.push(Line::from(vec![
        Span::styled("TITLE         : ", Style::default().fg(Color::DarkGray)),
        Span::styled(&item.title, Style::default().fg(Color::White).add_modifier(Modifier::BOLD)),
    ]));
    lines.push(Line::from(vec![
        Span::styled("CATEGORY      : ", Style::default().fg(Color::DarkGray)),
        Span::styled(
            format!("{} {}", item.category.symbol(), item.category.label()),
            Style::default().fg(Color::Yellow),
        ),
    ]));

    let risk_color = match item.risk_level.to_uppercase().as_str() {
        "CRITICAL" => Color::Red,
        "HIGH" => Color::Yellow,
        _ => Color::Green,
    };
    lines.push(Line::from(vec![
        Span::styled("RISK LEVEL    : ", Style::default().fg(Color::DarkGray)),
        Span::styled(
            format!("{} (Consequential: {})", item.risk_level, if item.is_consequential() { "YES" } else { "NO" }),
            Style::default().fg(risk_color).add_modifier(Modifier::BOLD),
        ),
    ]));

    lines.push(Line::from(vec![
        Span::styled("REQUESTOR     : ", Style::default().fg(Color::DarkGray)),
        Span::styled(format!("{} [{}]", item.requesting_agent, item.agent_role), Style::default().fg(Color::White)),
    ]));

    lines.push(Line::from(vec![
        Span::styled("PROJECT/TASK  : ", Style::default().fg(Color::DarkGray)),
        Span::styled(
            format!("Project: {} | Task: {}", item.project_name, item.task_id.as_deref().unwrap_or("None")),
            Style::default().fg(Color::Cyan),
        ),
    ]));

    lines.push(Line::from(vec![
        Span::styled("STATUS        : ", Style::default().fg(Color::DarkGray)),
        Span::styled(
            format!("{} {}", item.status.symbol(), item.status.as_str()),
            Style::default().fg(if item.status == ApprovalStatusEnum::Approved { Color::Green } else { Color::Yellow }).add_modifier(Modifier::BOLD),
        ),
    ]));

    lines.push(Line::from(""));
    lines.push(Line::from(vec![
        Span::styled("── CONTEXT & REASON ────────────────────────────────", Style::default().fg(Color::DarkGray)),
    ]));
    lines.push(Line::from(Span::styled(&item.reason, Style::default().fg(Color::White))));

    lines.push(Line::from(""));
    lines.push(Line::from(vec![
        Span::styled("── SUPPORTING AUDIT EVIDENCE ──────────────────────", Style::default().fg(Color::DarkGray)),
    ]));
    for ev in &item.evidence {
        lines.push(Line::from(vec![
            Span::styled("  • ", Style::default().fg(COLOR_CYAN)),
            Span::styled(ev, Style::default().fg(Color::DarkGray)),
        ]));
    }

    lines.push(Line::from(""));
    lines.push(Line::from(vec![
        Span::styled("── PARAMETERS & CRYPTOGRAPHIC BINDING ─────────────", Style::default().fg(Color::DarkGray)),
    ]));
    lines.push(Line::from(vec![
        Span::styled("ACTION & TARGET : ", Style::default().fg(Color::DarkGray)),
        Span::styled(format!("{} → {}", item.action, item.target), Style::default().fg(COLOR_CYAN)),
    ]));
    lines.push(Line::from(vec![
        Span::styled("SHA256 DIGEST   : ", Style::default().fg(Color::DarkGray)),
        Span::styled(&item.payload_fingerprint, Style::default().fg(Color::Yellow)),
    ]));

    if let Some(ref notes) = item.reviewer_notes {
        lines.push(Line::from(""));
        lines.push(Line::from(vec![
            Span::styled("── REVIEWER DECISION & AUDIT ───────────────────────", Style::default().fg(Color::DarkGray)),
        ]));
        lines.push(Line::from(vec![
            Span::styled("REVIEWER NOTES : ", Style::default().fg(Color::DarkGray)),
            Span::styled(notes, Style::default().fg(Color::White)),
        ]));
        if let Some(ref res_at) = item.resolved_at {
            lines.push(Line::from(vec![
                Span::styled("RESOLVED AT    : ", Style::default().fg(Color::DarkGray)),
                Span::styled(res_at, Style::default().fg(Color::DarkGray)),
            ]));
        }
    }

    lines.push(Line::from(""));
    lines.push(Line::from(vec![
        Span::styled("ACTIONS: [a] Approve  [r] Reject  [k] Request Changes", Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD)),
    ]));

    let p = Paragraph::new(lines)
        .block(block)
        .wrap(Wrap { trim: true });

    f.render_widget(p, area);
}

/// Floating confirmation dialog for consequential actions or review feedback
pub fn render_approval_confirmation_modal(
    f: &mut Frame,
    q: &crate::features::approvals::model::ApprovalQueueState,
    area: Rect,
) {
    let pending = match q.pending_action {
        Some(ref p) => p,
        None => return,
    };

    let popup_width = 70.min(area.width.saturating_sub(4));
    let popup_height = 14.min(area.height.saturating_sub(4));

    let x = (area.width.saturating_sub(popup_width)) / 2;
    let y = (area.height.saturating_sub(popup_height)) / 2;
    let popup_area = Rect::new(x, y, popup_width, popup_height);

    f.render_widget(Clear, popup_area);

    let is_consequential = pending.is_consequential;
    let border_color = if is_consequential { Color::Red } else { Color::Yellow };

    let title = if is_consequential {
        " ⚠️ CONFIRM CONSEQUENTIAL ACTION "
    } else {
        " ⚖ CONFIRM GOVERNANCE DECISION "
    };

    let block = Block::default()
        .title(title)
        .borders(Borders::ALL)
        .border_style(Style::default().fg(border_color).add_modifier(Modifier::BOLD));

    let mut lines = Vec::new();
    lines.push(Line::from(vec![
        Span::styled("DECISION    : ", Style::default().fg(Color::DarkGray)),
        Span::styled(
            pending.decision.as_str(),
            Style::default().fg(if pending.decision == ApprovalStatusEnum::Approved { Color::Green } else { Color::Red }).add_modifier(Modifier::BOLD),
        ),
    ]));
    lines.push(Line::from(vec![
        Span::styled("REQUEST ID  : ", Style::default().fg(Color::DarkGray)),
        Span::styled(&pending.request_id, Style::default().fg(COLOR_CYAN)),
    ]));
    lines.push(Line::from(vec![
        Span::styled("ACTION      : ", Style::default().fg(Color::DarkGray)),
        Span::styled(format!("{} → {}", pending.action, pending.target), Style::default().fg(Color::White).add_modifier(Modifier::BOLD)),
    ]));
    lines.push(Line::from(vec![
        Span::styled("RISK LEVEL  : ", Style::default().fg(Color::DarkGray)),
        Span::styled(&pending.risk_level, Style::default().fg(border_color).add_modifier(Modifier::BOLD)),
    ]));
    lines.push(Line::from(vec![
        Span::styled("FINGERPRINT : ", Style::default().fg(Color::DarkGray)),
        Span::styled(&pending.payload_fingerprint[..pending.payload_fingerprint.len().min(24)], Style::default().fg(Color::DarkGray)),
    ]));

    if q.feedback_input_active {
        lines.push(Line::from(""));
        lines.push(Line::from(vec![
            Span::styled("ENTER REVIEWER NOTES / INSTRUCTIONS:", Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD)),
        ]));
        lines.push(Line::from(vec![
            Span::styled("▶ ", Style::default().fg(COLOR_CYAN)),
            Span::styled(format!("{}_", q.feedback_input), Style::default().fg(Color::White)),
        ]));
        lines.push(Line::from(""));
        lines.push(Line::from(vec![
            Span::styled("Press [Enter] to Submit Decision | Press [Esc] to Cancel", Style::default().fg(Color::DarkGray)),
        ]));
    } else {
        lines.push(Line::from(""));
        lines.push(Line::from(vec![
            Span::styled(
                "This action cannot be undone. Backend will enforce policy execution.",
                Style::default().fg(Color::Yellow),
            ),
        ]));
        lines.push(Line::from(""));
        lines.push(Line::from(vec![
            Span::styled("Press [y] to Confirm & Authorize  |  Press [n / Esc] to Abort", Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD)),
        ]));
    }

    f.render_widget(Paragraph::new(lines).block(block).wrap(Wrap { trim: true }), popup_area);
}
