use ratatui::{
    layout::{Constraint, Rect},
    style::{Color, Modifier, Style},
    text::Span,
    widgets::{Block, Borders, Paragraph, Row, Table, Wrap},
    Frame,
};

use crate::{client::AgentPayload, AppState};

pub fn render_agents_tab(f: &mut Frame, state: &AppState, area: Rect) {
    if state.agents.is_empty() {
        let empty_msg = if !state.api_connected {
            "OFFLINE: Backend not reachable. Press [s] to reconnect."
        } else {
            "ZERO AGENTS REGISTERED\n\nNo autonomous agent records exist for this company in the database.\nRegister agents via the API or Web interface."
        };
        let p = Paragraph::new(empty_msg)
            .block(Block::default().title(" Autonomous Workforce ").borders(Borders::ALL))
            .wrap(Wrap { trim: true });
        f.render_widget(p, area);
    } else {
        let filtered_agents: Vec<(usize, &AgentPayload)> = state
            .agents
            .iter()
            .enumerate()
            .filter(|(_, a)| {
                state.filter_query.is_empty()
                    || a.name.to_lowercase().contains(&state.filter_query.to_lowercase())
                    || a.status.to_lowercase().contains(&state.filter_query.to_lowercase())
            })
            .collect();

        let rows: Vec<Row> = filtered_agents
            .iter()
            .enumerate()
            .map(|(display_idx, (_real_idx, a))| {
                let is_selected = display_idx == state.selected_index;
                let style = if is_selected {
                    Style::default().bg(Color::Blue).fg(Color::White).add_modifier(Modifier::BOLD)
                } else {
                    Style::default()
                };
                let status_style = match a.status.as_str() {
                    "WORKING" | "AVAILABLE" => Style::default().fg(Color::Green),
                    "PAUSED" => Style::default().fg(Color::Red),
                    _ => Style::default().fg(Color::Yellow),
                };
                Row::new(vec![
                    Span::styled(&a.name, style),
                    Span::styled(a.role_title.as_deref().unwrap_or("Agent"), style),
                    Span::styled(&a.status, status_style),
                    Span::styled(a.autonomy.as_deref().unwrap_or("SUPERVISED"), style),
                ])
            })
            .collect();

        let table = Table::new(
            rows,
            [
                Constraint::Length(22),
                Constraint::Length(26),
                Constraint::Length(14),
                Constraint::Length(12),
            ],
        )
        .header(
            Row::new(vec!["AGENT NAME", "ROLE", "STATUS", "AUTONOMY"])
                .style(Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD)),
        )
        .block(Block::default().title(" Autonomous Workforce ").borders(Borders::ALL));
        f.render_widget(table, area);
    }
}

pub fn inspector_text(state: &AppState) -> Option<String> {
    if state.agents.is_empty() {
        return None;
    }
    let a = &state.agents[state.selected_index.min(state.agents.len() - 1)];
    Some(format!(
        "AGENT INSPECTOR\n\nID       : {}\nNAME     : {}\nROLE     : {}\nSTATUS   : {}\nAUTONOMY : {}\nFOCUS    : {}\n\nPress [p] to Toggle Pause/Resume\nPress [s] to Sync with API",
        a.id,
        a.name,
        a.role_title.as_deref().unwrap_or("Agent"),
        a.status,
        a.autonomy.as_deref().unwrap_or("SUPERVISED"),
        a.current_task.as_deref().unwrap_or("Awaiting task assignment")
    ))
}
