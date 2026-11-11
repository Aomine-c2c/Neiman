use ratatui::{
    layout::{Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, List, ListItem, Paragraph, Wrap},
    Frame,
};

use crate::app::AppState;
use crate::fixtures::DirectiveFixture;

pub fn render_executive_tab(f: &mut Frame, state: &AppState, area: Rect) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(4), // Header / Directive Action Hint
            Constraint::Min(8),    // Directive Stream
            Constraint::Length(7), // Escalations & High-Priority Alerts
        ])
        .split(area);

    let is_offline = !state.api_connected;
    let badge_color = if is_offline { Color::Yellow } else { Color::Green };

    // 1. Executive Directive Dispatch Header
    let header_text = vec![
        Line::from(vec![
            Span::styled("EXECUTIVE COMMUNICATIONS & CEO DIRECTIVES", Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD)),
            Span::styled(if is_offline { " [OFFLINE PREVIEW FIXTURE]" } else { " [LIVE API]" }, Style::default().fg(badge_color)),
        ]),
        Line::from(vec![
            Span::styled("Authoritative direct dispatch from Human Owner (CEO) to the 13 Autonomous Leads. ", Style::default().fg(Color::White)),
            Span::styled("Press [d] to dispatch new executive directive.", Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD)),
        ]),
    ];
    let header = Paragraph::new(header_text)
        .block(Block::default().borders(Borders::ALL).border_style(Style::default().fg(Color::Cyan)));
    f.render_widget(header, chunks[0]);

    // 2. Directives Stream
    let directives = DirectiveFixture::default_fixtures();
    let directive_items: Vec<ListItem> = directives
        .iter()
        .map(|dir| {
            let status_color = match dir.status.as_str() {
                "COMPLETED" => Color::Green,
                "IN_PROGRESS" => Color::Cyan,
                "ACTIVE" => Color::Yellow,
                _ => Color::White,
            };

            let lines = vec![
                Line::from(vec![
                    Span::styled(format!(" [{}] ", dir.id), Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD)),
                    Span::styled(format!("{} ", dir.title), Style::default().fg(Color::White).add_modifier(Modifier::BOLD)),
                    Span::styled(format!("({}) ", dir.status), Style::default().fg(status_color)),
                    Span::styled(format!("— {} by {}", dir.timestamp, dir.author), Style::default().fg(Color::DarkGray)),
                ]),
                Line::from(vec![
                    Span::raw("    "),
                    Span::styled(&dir.details, Style::default().fg(Color::DarkGray)),
                ]),
            ];
            ListItem::new(lines)
        })
        .collect();

    let list = List::new(directive_items).block(
        Block::default()
            .title(" Executive Directives & Intent Log ")
            .borders(Borders::ALL)
            .border_style(Style::default().fg(badge_color)),
    );
    f.render_widget(list, chunks[1]);

    // 3. Escalations Box
    let escalations = vec![
        Line::from(vec![
            Span::styled(" ! ESCALATION [CRITICAL] ", Style::default().fg(Color::LightRed).add_modifier(Modifier::BOLD)),
            Span::styled("Four-Eyes Review Gate Waiting Signoff for Release Candidate v2.4.0-rc1.", Style::default().fg(Color::White)),
        ]),
        Line::from(vec![
            Span::styled("   Initiated by: ", Style::default().fg(Color::DarkGray)),
            Span::styled("DevOps & Infrastructure Lead | Required: CEO + CTO signoff", Style::default().fg(Color::Yellow)),
        ]),
        Line::from(vec![
            Span::styled("   Action: ", Style::default().fg(Color::DarkGray)),
            Span::styled("Press [a] to approve, [r] to reject in Governance workspace [6].", Style::default().fg(Color::Green)),
        ]),
    ];
    let escalations_box = Paragraph::new(escalations)
        .block(
            Block::default()
                .title(" Active Escalation Inbox ")
                .borders(Borders::ALL)
                .border_style(Style::default().fg(Color::LightRed)),
        )
        .wrap(Wrap { trim: true });
    f.render_widget(escalations_box, chunks[2]);
}

pub fn inspector_text(_state: &AppState) -> Option<String> {
    Some("EXECUTIVE COMMUNICATIONS INSPECTOR\n\n\
        Author: CEO (Human Owner)\n\
        Authority: Absolute constitutional veto & override\n\
        Active Directives: 3 logged\n\
        Escalation Queue: 1 pending signoff\n\n\
        DIRECTIVE DISPATCH INSTRUCTIONS:\n\
        • Press [d] in command area to type a directive\n\
        • Directives are broadcast as high-priority\n\
          system events to all 13 autonomous leads\n\
        • Execution traces are cryptographically audited".to_string())
}
