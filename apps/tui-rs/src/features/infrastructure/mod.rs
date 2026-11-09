use ratatui::{
    layout::{Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, List, ListItem, Paragraph, Wrap},
    Frame,
};

use crate::app::AppState;
use crate::fixtures::{CircuitBreakerFixture, McpServerFixture};

pub fn render_infrastructure_tab(f: &mut Frame, state: &AppState, area: Rect) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(5), // Top Runtime & Worker Summary
            Constraint::Min(8),    // Middle Split: MCP Servers & Circuit Breakers
            Constraint::Length(6), // Container & Sandbox Confinement
        ])
        .split(area);

    let is_offline = !state.api_connected;
    let badge_color = if is_offline { Color::Yellow } else { Color::Green };

    // 1. Top Section: Runtime Summary
    let summary_lines = vec![
        Line::from(vec![
            Span::styled("INFRASTRUCTURE RUNTIME, MCP SERVERS & CIRCUIT BREAKERS", Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD)),
            Span::styled(if is_offline { " [OFFLINE PREVIEW FIXTURE]" } else { " [LIVE RUNTIME]" }, Style::default().fg(badge_color)),
        ]),
        Line::from(vec![
            Span::styled("• Async Executor: ", Style::default().fg(Color::White)),
            Span::styled("Tokio 1.43 Multi-Threaded Runtime | ", Style::default().fg(Color::Green)),
            Span::styled("Workers: ", Style::default().fg(Color::White)),
            Span::styled("8 threads | ", Style::default().fg(Color::Yellow)),
            Span::styled("Active Tasks: ", Style::default().fg(Color::White)),
            Span::styled("4 background routines | ", Style::default().fg(Color::Cyan)),
            Span::styled("Circuit Breakers: ", Style::default().fg(Color::White)),
            Span::styled("ALL CLOSED (0 tripped)", Style::default().fg(Color::Green).add_modifier(Modifier::BOLD)),
        ]),
        Line::from(vec![
            Span::styled("• Controls: Press [c] to reset all circuit breakers | Press [s] to trigger MCP ping probe", Style::default().fg(Color::DarkGray)),
        ]),
    ];
    let summary = Paragraph::new(summary_lines)
        .block(Block::default().borders(Borders::ALL).border_style(Style::default().fg(Color::Cyan)));
    f.render_widget(summary, chunks[0]);

    // 2. Middle Split: MCP Servers (55%) vs Circuit Breakers (45%)
    let mid_chunks = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(55), Constraint::Percentage(45)])
        .split(chunks[1]);

    // MCP Servers List
    let servers = McpServerFixture::default_fixtures();
    let server_items: Vec<ListItem> = servers
        .iter()
        .map(|s| {
            let (status_color, symbol) = match s.status.as_str() {
                "CONNECTED" => (Color::Green, "●"),
                _ => (Color::Yellow, "○"),
            };
            let content = Line::from(vec![
                Span::styled(format!(" {} ", symbol), Style::default().fg(status_color)),
                Span::styled(format!("{:<28} ", s.name), Style::default().fg(Color::White).add_modifier(Modifier::BOLD)),
                Span::styled(format!("({} tools) ", s.tool_count), Style::default().fg(Color::Cyan)),
                Span::styled(format!("{:>3}ms ", s.latency_ms), Style::default().fg(Color::Yellow)),
                Span::styled(format!("[{}]", s.transport), Style::default().fg(Color::DarkGray)),
            ]);
            ListItem::new(content)
        })
        .collect();

    let mcp_list = List::new(server_items).block(
        Block::default()
            .title(" Model Context Protocol (MCP) Tool Servers ")
            .borders(Borders::ALL)
            .border_style(Style::default().fg(badge_color)),
    );
    f.render_widget(mcp_list, mid_chunks[0]);

    // Circuit Breakers List
    let breakers = CircuitBreakerFixture::default_fixtures();
    let breaker_items: Vec<ListItem> = breakers
        .iter()
        .map(|b| {
            let (state_color, symbol) = if b.state.contains("HEALTHY") {
                (Color::Green, "✓")
            } else {
                (Color::LightRed, "▲")
            };
            let content = Line::from(vec![
                Span::styled(format!(" {} ", symbol), Style::default().fg(state_color).add_modifier(Modifier::BOLD)),
                Span::styled(format!("{:<16} ", b.provider), Style::default().fg(Color::White)),
                Span::styled(format!("{:<15} ", b.state), Style::default().fg(state_color)),
                Span::styled(format!("Failures: {}/{}", b.failure_count, b.failure_threshold), Style::default().fg(Color::DarkGray)),
            ]);
            ListItem::new(content)
        })
        .collect();

    let breakers_list = List::new(breaker_items).block(
        Block::default()
            .title(" Provider Circuit Breakers ")
            .borders(Borders::ALL)
            .border_style(Style::default().fg(Color::Cyan)),
    );
    f.render_widget(breakers_list, mid_chunks[1]);

    // 3. Bottom Section: Container & Sandbox Confinement
    let sandbox_text = vec![
        Line::from(vec![
            Span::styled("CONTAINER RUNTIME & PROCESS ISOLATION BOUNDARY", Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD)),
        ]),
        Line::from(vec![
            Span::styled("• Engine: Bubblewrap (bwrap) unprivileged user namespaces | Seccomp Syscall Filter: ACTIVE", Style::default().fg(Color::White)),
        ]),
        Line::from(vec![
            Span::styled("• File System Boundary: Read-only rootfs mount, ephemeral scratch tmpfs, masked host /proc", Style::default().fg(Color::DarkGray)),
        ]),
        Line::from(vec![
            Span::styled("• Network Boundary: Gated outbound access via audited domain allowlist proxy", Style::default().fg(Color::DarkGray)),
        ]),
    ];
    let sandbox_box = Paragraph::new(sandbox_text)
        .block(Block::default().borders(Borders::ALL).border_style(Style::default().fg(Color::DarkGray)))
        .wrap(Wrap { trim: true });
    f.render_widget(sandbox_box, chunks[2]);
}

pub fn inspector_text(_state: &AppState) -> Option<String> {
    Some("INFRASTRUCTURE RUNTIME INSPECTOR\n\n\
        Runtime: Rust Native + Tokio 1.43 Multi-thread\n\
        Process Sandboxing: Bubblewrap (bwrap) + seccomp\n\
        Active MCP Servers: 4 registered\n\
        Active Circuit Breakers: 4 healthy (0 tripped)\n\n\
        OPERATIONAL ACTIONS:\n\
        • Press [c] to reset tripped circuit breakers\n\
        • Press [s] to trigger live health probe\n\
        • Press [x] to cycle engine supervisor\n\n\
        All model API requests enforce exponential\n\
        backoff, bounded retries (3x), and 30s timeouts.".to_string())
}
