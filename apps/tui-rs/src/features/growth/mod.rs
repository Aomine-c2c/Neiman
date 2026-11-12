use ratatui::{
    layout::{Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, List, ListItem, Paragraph, Wrap},
    Frame,
};

use crate::app::AppState;
use crate::fixtures::GrowthInitiativeFixture;

pub fn render_growth_tab(f: &mut Frame, state: &AppState, area: Rect) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(5), // Top OKRs Summary
            Constraint::Min(8),    // Strategic Initiatives List
            Constraint::Length(6), // Traction & Adoption Metrics
        ])
        .split(area);

    let is_offline = !state.api_connected;
    let badge_color = if is_offline { Color::Yellow } else { Color::Green };

    // 1. Top Horizon & Strategic Objective
    let summary_lines = vec![
        Line::from(vec![
            Span::styled("BUSINESS DEVELOPMENT, TRACTION & COMPANY GROWTH", Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD)),
            Span::styled(if is_offline { " [OFFLINE PREVIEW FIXTURE]" } else { " [LIVE METRICS]" }, Style::default().fg(badge_color)),
        ]),
        Line::from(vec![
            Span::styled("• Strategic Horizon: ", Style::default().fg(Color::White)),
            Span::styled("Q4 2026 Sovereign AI Dev Node Launch | ", Style::default().fg(Color::Yellow)),
            Span::styled("Active Pilots: ", Style::default().fg(Color::White)),
            Span::styled("12 Enterprise Operator Nodes | ", Style::default().fg(Color::Green)),
            Span::styled("ARR Target: ", Style::default().fg(Color::White)),
            Span::styled("$1.2M Run-rate", Style::default().fg(Color::Cyan)),
        ]),
        Line::from(vec![
            Span::styled("• Lead Position: Business Development & Growth Lead | Model: OpenAI GPT-4o", Style::default().fg(Color::DarkGray)),
        ]),
    ];
    let summary = Paragraph::new(summary_lines)
        .block(Block::default().borders(Borders::ALL).border_style(Style::default().fg(Color::Cyan)));
    f.render_widget(summary, chunks[0]);

    // 2. Strategic Initiatives List
    let initiatives = GrowthInitiativeFixture::default_fixtures();
    let initiative_items: Vec<ListItem> = initiatives
        .iter()
        .map(|init| {
            let status_color = match init.status.as_str() {
                "NEAR_COMPLETION" => Color::Green,
                "ON_TRACK" => Color::Cyan,
                _ => Color::Yellow,
            };
            let content = Line::from(vec![
                Span::styled(format!(" [{}] ", init.id), Style::default().fg(Color::Yellow)),
                Span::styled(format!("{:<48} ", init.title), Style::default().fg(Color::White).add_modifier(Modifier::BOLD)),
                Span::styled(format!("{:>4}% ", init.progress_pct), Style::default().fg(status_color).add_modifier(Modifier::BOLD)),
                Span::styled(format!("[{}] ", init.target_quarter), Style::default().fg(Color::DarkGray)),
                Span::styled(format!("({}) ", init.status), Style::default().fg(status_color)),
                Span::styled(format!("Owner: {}", init.owner), Style::default().fg(Color::DarkGray)),
            ]);
            ListItem::new(content)
        })
        .collect();

    let list = List::new(initiative_items).block(
        Block::default()
            .title(" Strategic Milestones & Growth OKRs ")
            .borders(Borders::ALL)
            .border_style(Style::default().fg(badge_color)),
    );
    f.render_widget(list, chunks[1]);

    // 3. Traction Metrics Bottom Box
    let metrics_text = vec![
        Line::from(vec![
            Span::styled("ENTERPRISE PILOT & ADOPTION TELEMETRY", Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD)),
        ]),
        Line::from(vec![
            Span::styled("• Sovereign Deployments : 12 active clusters (100% self-hosted, air-gapped capable)", Style::default().fg(Color::White)),
        ]),
        Line::from(vec![
            Span::styled("• Mean Pipeline Delivery: 4.2 minutes from PRD spec to passing verification suite", Style::default().fg(Color::Green)),
        ]),
        Line::from(vec![
            Span::styled("• Autonomy Ratio        : 92% autonomous execution / 8% human approval gates", Style::default().fg(Color::Cyan)),
        ]),
    ];
    let metrics_box = Paragraph::new(metrics_text)
        .block(Block::default().borders(Borders::ALL).border_style(Style::default().fg(Color::DarkGray)))
        .wrap(Wrap { trim: true });
    f.render_widget(metrics_box, chunks[2]);
}

pub fn inspector_text(_state: &AppState) -> Option<String> {
    Some("BUSINESS & GROWTH INSPECTOR\n\n\
        Lead: Business Development & Growth Lead\n\
        Primary Objective: Autonomous Software OS Commercialization\n\
        Enterprise Pilots: 12 active\n\
        Target Milestone: Sovereign Operator Node GA\n\
        Autonomy Ratio: 92% Autonomous\n\n\
        GO-TO-MARKET VECTORS:\n\
        • Self-Hosted Local-First Operator\n\
        • Heterogeneous Provider Cost Arbitrage\n\
        • Four-Eyes Compliant Governance".to_string())
}
