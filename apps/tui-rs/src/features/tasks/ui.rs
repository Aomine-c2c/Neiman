use ratatui::{
    layout::{Constraint, Rect},
    style::{Color, Modifier, Style},
    text::Span,
    widgets::{Block, Borders, Paragraph, Row, Table, Wrap},
    Frame,
};

use crate::{common::TaskViewItem, AppState};

pub fn render_tasks_tab(f: &mut Frame, state: &AppState, area: Rect) {
    if state.tasks.is_empty() {
        let empty_msg = if !state.api_connected {
            "OFFLINE: Backend not reachable. Press [s] to reconnect."
        } else {
            "ZERO OPERATIONAL TASKS FOUND\n\nNo project task units currently exist for this company.\nCreate projects and tasks in the workspace to populate this board."
        };
        let p = Paragraph::new(empty_msg)
            .block(Block::default().title(" Operational Tasks & Backlog ").borders(Borders::ALL))
            .wrap(Wrap { trim: true });
        f.render_widget(p, area);
    } else {
        let filtered_tasks: Vec<(usize, &TaskViewItem)> = state
            .tasks
            .iter()
            .enumerate()
            .filter(|(_, t)| {
                state.filter_query.is_empty()
                    || t.title.to_lowercase().contains(&state.filter_query.to_lowercase())
                    || t.status.to_lowercase().contains(&state.filter_query.to_lowercase())
            })
            .collect();

        let rows: Vec<Row> = filtered_tasks
            .iter()
            .enumerate()
            .map(|(display_idx, (_, t))| {
                let is_selected = display_idx == state.selected_index;
                let style = if is_selected {
                    Style::default().bg(Color::Blue).fg(Color::White).add_modifier(Modifier::BOLD)
                } else {
                    Style::default()
                };
                let status_style = match t.status.as_str() {
                    "COMPLETED" => Style::default().fg(Color::Green),
                    "IN_PROGRESS" => Style::default().fg(Color::Cyan),
                    "BLOCKED" | "FAILED" => Style::default().fg(Color::Red),
                    _ => Style::default().fg(Color::Yellow),
                };
                Row::new(vec![
                    Span::styled(&t.id[..t.id.len().min(8)], style),
                    Span::styled(&t.title, style),
                    Span::styled(&t.status, status_style),
                    Span::styled(&t.priority, style),
                    Span::styled(&t.assigned_agent, style),
                ])
            })
            .collect();

        let table = Table::new(
            rows,
            [
                Constraint::Length(10),
                Constraint::Length(34),
                Constraint::Length(14),
                Constraint::Length(10),
                Constraint::Length(18),
            ],
        )
        .header(
            Row::new(vec!["ID", "TASK TITLE", "STATUS", "PRIORITY", "AGENT"])
                .style(Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD)),
        )
        .block(Block::default().title(" Operational Tasks & Backlog ").borders(Borders::ALL));
        f.render_widget(table, area);
    }
}

pub fn inspector_text(state: &AppState) -> Option<String> {
    if state.tasks.is_empty() {
        return None;
    }
    let t = &state.tasks[state.selected_index.min(state.tasks.len() - 1)];
    let preds = if t.dependencies.is_empty() {
        "none".to_string()
    } else {
        t.dependencies
            .iter()
            .map(|id| {
                state
                    .tasks
                    .iter()
                    .find(|x| x.id == *id)
                    .map(|x| format!("{} [{}]", x.title, x.status))
                    .unwrap_or_else(|| id.clone())
            })
            .collect::<Vec<_>>()
            .join(", ")
    };
    let successors: Vec<String> = state
        .tasks
        .iter()
        .filter(|x| x.dependencies.iter().any(|d| d == &t.id))
        .map(|x| format!("{} [{}]", x.title, x.status))
        .collect();
    let succ = if successors.is_empty() {
        "none".to_string()
    } else {
        successors.join(", ")
    };
    let ready = state.dag.get_executable_nodes();
    Some(format!(
        "TASK INSPECTOR\n\nID       : {}\nTITLE    : {}\nSTATUS   : {}\nPRIORITY : {}\nAGENT    : {}\nPREDS    : {}\nSUCCS    : {}\n\nLocal ready-set size: {}\nPress [x]/Space] for backend supervisor tick",
        t.id, t.title, t.status, t.priority, t.assigned_agent, preds, succ, ready.len()
    ))
}
