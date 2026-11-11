use ratatui::{
    layout::{Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, Gauge, List, ListItem, Paragraph, Wrap},
    Frame,
};

use crate::app::AppState;
use crate::fixtures::{ExecutionActivityItem, ReleaseGateItem};

pub fn render_command_center_tab(f: &mut Frame, state: &AppState, area: Rect) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(5), // Top: Health & Budget Gauges
            Constraint::Min(10),   // Middle: Projects/Workforce & Release Gates
            Constraint::Length(7), // Bottom: Execution Activity Stream
        ])
        .split(area);

    let is_offline = !state.api_connected;
    let badge_color = if is_offline { Color::Yellow } else { Color::Green };
    let status_label = if is_offline {
        " [FIXTURE DATA - OFFLINE PREVIEW] "
    } else {
        " [LIVE TELEMETRY] "
    };

    // 1. Top Section: Health Gauge + Resource Budget
    let top_chunks = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(50), Constraint::Percentage(50)])
        .split(chunks[0]);

    let health_pct = if is_offline { 98 } else { 95 };
    let health_gauge = Gauge::default()
        .block(
            Block::default()
                .title(format!(" Company Health: {}% | Uptime: 99.98% {}", health_pct, status_label))
                .borders(Borders::ALL)
                .border_style(Style::default().fg(Color::Green)),
        )
        .gauge_style(Style::default().fg(Color::Green).bg(Color::DarkGray))
        .percent(health_pct)
        .label(format!("System State: 13/13 Positions Active | Health {}%", health_pct));
    f.render_widget(health_gauge, top_chunks[0]);

    let token_pct = 21; // 412k / 2M
    let budget_gauge = Gauge::default()
        .block(
            Block::default()
                .title(" Token & Compute Envelope ($8.26 / $40.00 Limit) ")
                .borders(Borders::ALL)
                .border_style(Style::default().fg(Color::Cyan)),
        )
        .gauge_style(Style::default().fg(Color::Cyan).bg(Color::DarkGray))
        .percent(token_pct)
        .label("412,850 / 2,000,000 Tokens (21% Used | $8.26 Spent)");
    f.render_widget(budget_gauge, top_chunks[1]);

    // 2. Middle Section: Active Projects/Agents (Left) vs Governance & Release Gates (Right)
    let mid_chunks = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(50), Constraint::Percentage(50)])
        .split(chunks[1]);

    // Left: Active Projects & Workforce
    let mut project_lines = Vec::new();
    project_lines.push(Line::from(vec![
        Span::styled("ACTIVE PROJECTS & WORKFORCE", Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD)),
    ]));
    project_lines.push(Line::from(""));

    let project_count = if state.projects.is_empty() { 3 } else { state.projects.len() };
    project_lines.push(Line::from(vec![
        Span::styled("• Initiatives in Flight : ", Style::default().fg(Color::White)),
        Span::styled(format!("{} projects tracked", project_count), Style::default().fg(Color::Yellow)),
    ]));
    project_lines.push(Line::from(vec![
        Span::styled("  - Project Alpha       : ", Style::default().fg(Color::DarkGray)),
        Span::styled("NEIMAN Autonomous OS Core (85% completed)", Style::default().fg(Color::White)),
    ]));
    project_lines.push(Line::from(vec![
        Span::styled("  - Project Beta        : ", Style::default().fg(Color::DarkGray)),
        Span::styled("Production Keyboard-First TUI (Active Sprint)", Style::default().fg(Color::White)),
    ]));
    project_lines.push(Line::from(vec![
        Span::styled("  - Project Gamma       : ", Style::default().fg(Color::DarkGray)),
        Span::styled("Heterogeneous Model Failover Network (Planning)", Style::default().fg(Color::White)),
    ]));
    project_lines.push(Line::from(""));
    project_lines.push(Line::from(vec![
        Span::styled("• Autonomous Agents   : ", Style::default().fg(Color::White)),
        Span::styled("13 canonical positions active (0 paused, 0 crashed)", Style::default().fg(Color::Green)),
    ]));
    project_lines.push(Line::from(vec![
        Span::styled("• Pending Approvals   : ", Style::default().fg(Color::White)),
        Span::styled("1 four-eyes gate waiting human signoff", Style::default().fg(Color::LightRed)),
    ]));

    let projects_widget = Paragraph::new(project_lines)
        .block(
            Block::default()
                .title(" Projects & Workforce Roster ")
                .borders(Borders::ALL)
                .border_style(Style::default().fg(badge_color)),
        )
        .wrap(Wrap { trim: true });
    f.render_widget(projects_widget, mid_chunks[0]);

    // Right: Release Gates
    let gates = ReleaseGateItem::default_fixtures();
    let gate_items: Vec<ListItem> = gates
        .iter()
        .map(|gate| {
            let (status_color, symbol) = match gate.status.as_str() {
                "PASSED" => (Color::Green, "✓"),
                "PENDING" => (Color::LightRed, "▲"),
                _ => (Color::Yellow, "○"),
            };
            let content = Line::from(vec![
                Span::styled(format!(" {} ", symbol), Style::default().fg(status_color).add_modifier(Modifier::BOLD)),
                Span::styled(format!("{:<38} ", gate.name), Style::default().fg(Color::White)),
                Span::styled(format!("[{}] ", gate.risk_level), Style::default().fg(Color::Yellow)),
                Span::styled(format!("({})", gate.status), Style::default().fg(status_color).add_modifier(Modifier::BOLD)),
            ]);
            ListItem::new(content)
        })
        .collect();

    let gates_list = List::new(gate_items).block(
        Block::default()
            .title(" Constitutional Release Gates & Defense Probes ")
            .borders(Borders::ALL)
            .border_style(Style::default().fg(Color::Cyan)),
    );
    f.render_widget(gates_list, mid_chunks[1]);

    // 3. Bottom Section: Recent Execution Activity
    let activities = ExecutionActivityItem::default_fixtures();
    let activity_items: Vec<ListItem> = activities
        .iter()
        .map(|act| {
            let (status_color, symbol) = match act.status.as_str() {
                "COMPLETED" => (Color::Green, "●"),
                "RUNNING" => (Color::Cyan, "⠋"),
                _ => (Color::Yellow, "○"),
            };
            let content = Line::from(vec![
                Span::styled(format!(" {} ", symbol), Style::default().fg(status_color)),
                Span::styled(format!("{:<14} ", act.id), Style::default().fg(Color::Yellow)),
                Span::styled(format!("{:<40} ", act.workflow), Style::default().fg(Color::White)),
                Span::styled(format!("Step: {:<28} ", act.current_step), Style::default().fg(Color::DarkGray)),
                Span::styled(format!("{}% ", act.progress_pct), Style::default().fg(status_color)),
                Span::styled(format!("({}ms)", act.latency_ms), Style::default().fg(Color::DarkGray)),
            ]);
            ListItem::new(content)
        })
        .collect();

    let activity_list = List::new(activity_items).block(
        Block::default()
            .title(" Live Workflow Execution Activity & Task Throughput ")
            .borders(Borders::ALL)
            .border_style(Style::default().fg(Color::Cyan)),
    );
    f.render_widget(activity_list, chunks[2]);
}

pub fn render_operator_command_center(f: &mut Frame, state: &AppState, area: Rect) {
    let vchunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(4), // top status bar (2 content lines + Borders::ALL)
            Constraint::Min(0),     // columns
            Constraint::Length(7), // bottom dock (5 content lines + Borders::ALL)
        ])
        .split(area);

    // ── Top Global Status Bar ──
    let top = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([
            Constraint::Percentage(33),
            Constraint::Percentage(34),
            Constraint::Percentage(33),
        ])
        .split(vchunks[0]);
    f.render_widget(
        Paragraph::new(vec![
            Line::from(Span::styled("NEIMAN OS", Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD))),
            Line::from(Span::styled("  13 POSITIONS", Style::default().fg(Color::Green))),
        ])
        .block(Block::default().title(" NEIMAN OS // OPERATOR COMMAND CONSOLE ").borders(Borders::ALL).border_style(Style::default().fg(Color::Cyan))),
        top[0],
    );
    f.render_widget(
        Paragraph::new(vec![
            Line::from(Span::styled("API: OFFLINE", Style::default().fg(Color::Yellow))),
            Line::from(Span::styled("MODEL: Gemini-1.5-Pro", Style::default().fg(Color::Cyan))),
        ])
        .block(Block::default().title(" STATUS FLAGS ").borders(Borders::ALL).border_style(Style::default().fg(Color::Cyan))),
        top[1],
    );
    f.render_widget(
        Paragraph::new(vec![
            Line::from(Span::styled("08:09:22Z", Style::default().fg(Color::Cyan))),
            Line::from(Span::styled("ROLE: CEO", Style::default().fg(Color::Green))),
        ])
        .block(Block::default().title(" OPERATOR ").borders(Borders::ALL).border_style(Style::default().fg(Color::Cyan))),
        top[2],
    );

    // ── Main Columns ──
    let cols = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([
            Constraint::Percentage(25),
            Constraint::Percentage(45),
            Constraint::Percentage(30),
        ])
        .split(vchunks[1]);

    // Left: Swarm Workforce + Task Backlog + Activity
    f.render_widget(
        Block::default().title(" [ SWARM WORKFORCE ] ").borders(Borders::ALL).border_style(Style::default().fg(Color::Cyan)),
        cols[0],
    );
    let left = Layout::default().direction(Direction::Vertical).constraints([
        Constraint::Min(0),
        Constraint::Length(5),
        Constraint::Length(5),
        Constraint::Length(5),
    ]).split(cols[0]);
    f.render_widget(Paragraph::new(vec![Line::from(Span::styled("POS/AGENT/STATUS/TASK", Style::default().fg(Color::DarkGray)))]).block(Block::default().title(" ROSTER ").borders(Borders::NONE)), left[0]);
    let mut wl = Vec::new();
    for a in state.agents.iter().take(6) {
        wl.push(Line::from(vec![
            Span::styled(format!("{:<6} ", a.id.clone().to_string()), Style::default().fg(Color::Yellow)),
            Span::styled(a.name.clone(), Style::default().fg(Color::White)),
            Span::styled(format!(" {:<10} ", a.status.clone()), Style::default().fg(if a.status == "ACTIVE" { Color::Green } else { Color::Yellow })),
        ]));
    }
    f.render_widget(Paragraph::new(wl).block(Block::default().title(" ROSTER ").borders(Borders::ALL).border_style(Style::default().fg(Color::Cyan))), left[1]);

    // Center column: CTO console + graph + approvals
    f.render_widget(
        Block::default().title(" [ CTO DIRECTIVES & CONSOLE ] ").borders(Borders::ALL).border_style(Style::default().fg(Color::Cyan)),
        cols[1],
    );
    let center = Layout::default().direction(Direction::Vertical).constraints([
        Constraint::Length(6),
        Constraint::Min(0),
        Constraint::Length(6),
    ]).split(cols[1]);
    f.render_widget(
        Paragraph::new(vec![
            Line::from(Span::styled("[09:58:12Z] [SYSTEM] CTO directive: scale inference fleet", Style::default().fg(Color::Red))),
            Line::from(Span::styled("[09:58:40Z] [CTO] You: provision two GPU nodes", Style::default().fg(Color::Cyan))),
        ])
        .block(Block::default().title(" CTO CONSOLE ").borders(Borders::ALL).border_style(Style::default().fg(Color::Cyan))),
        center[0],
    );

    // Right column: telemetry
    f.render_widget(
        Block::default().title(" [ LIVE AUDIT TELEMETRY ] ").borders(Borders::ALL).border_style(Style::default().fg(Color::Cyan)),
        cols[2],
    );
    let right = Layout::default().direction(Direction::Vertical).constraints([
        Constraint::Length(3),
        Constraint::Length(3),
        Constraint::Length(3),
    ]).split(cols[2]);
    f.render_widget(Paragraph::new(vec![Line::from(Span::styled("08:09:22Z AUTH LOGIN_OK src/api/main.py", Style::default().fg(Color::Green)))]).block(Block::default().title(" AUDIT ").borders(Borders::ALL).border_style(Style::default().fg(Color::Cyan))), right[0]);

    // ── Bottom Persistent Command Dock ──
    let dock = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Length(1)])
        .split(vchunks[2]);
    f.render_widget(
        Paragraph::new(vec![
            Line::from(Span::styled("CTRL+K LOCK", Style::default().fg(Color::Cyan))),
            Line::from(Span::styled("PANE NEXT", Style::default().fg(Color::Cyan))),
            Line::from(Span::styled("TAB FOCUS", Style::default().fg(Color::Cyan))),
            Line::from(Span::styled("RESIZE DRAG", Style::default().fg(Color::Cyan))),
            Line::from(Span::styled("S SEARCH", Style::default().fg(Color::Cyan))),
            Line::from(Span::styled("Q QUIT", Style::default().fg(Color::Cyan))),
        ])
        .block(Block::default().title(" [ NEIMAN OS TERMINAL // COMMAND DOCK ] ").borders(Borders::ALL).border_style(Style::default().fg(Color::Cyan))),
        dock[0],
    );
}

pub fn inspector_text(_state: &AppState) -> Option<String> {
    Some("COMMAND CENTER OVERVIEW\n\n\
        Company Health: 98.4% (Optimal)\n\
        Active Positions: 13 / 13 Deployed\n\
        Active Projects: 3 In Flight\n\
        Pending Approvals: 1 High-Risk Gate\n\
        Token Consumption: 412,850 / 2,000,000\n\
        Spend Incurred: $8.26 / $40.00 Limit\n\
        Circuit Breakers: 0 Tripped (All Healthy)\n\
        Platform Uptime: 99.98%\n\n\
        OPERATIONAL CONTROLS:\n\
        • [Ctrl+K] Open Command Palette\n\
        • [1-9,0,-,=,\\] Direct Workspace Jump\n\
        • [d] Dispatch CEO Directive\n\
        • [a/r] Approve / Reject Pending Gate\n\
        • [s] Force Backend Telemetry Sync\n\
        • [t] Toggle Light / Dark Theme".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use ratatui::backend::TestBackend;
    use ratatui::Terminal;

    #[test]
    fn test_render_command_center_tab_buffer() {
        let backend = TestBackend::new(120, 36);
        let mut terminal = Terminal::new(backend).unwrap();
        let state = AppState::new();

        terminal
            .draw(|f| {
                render_command_center_tab(f, &state, f.area());
            })
            .unwrap();

        let buffer = terminal.backend().buffer();
        let content = buffer
            .content()
            .iter()
            .map(|c| c.symbol())
            .collect::<Vec<_>>()
            .join("");

        assert!(content.contains("Company Health"));
        assert!(content.contains("Token & Compute Envelope"));
        assert!(content.contains("Constitutional Release Gates"));
    }
}
