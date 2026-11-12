use ratatui::{
    layout::{Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, Paragraph, Row, Table, Wrap},
    Frame,
};

use crate::AppState;

pub fn render_cto_tab(f: &mut Frame, state: &AppState, area: Rect) {
    let cto_chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Length(6), Constraint::Min(10)])
        .split(area);

    let (cto_name, total_agents, working_agents) = match &state.cto_status {
        Some(st) => (st.cto_agent_name.as_str(), st.total_agents, st.working_agents),
        None => ("Autonomous CTO", state.agents.len(), 0),
    };

    let (sup_state, is_running, cycle, pending, in_prog, completed) = match &state.supervisor_status {
        Some(s) => (
            s.state.as_str(),
            s.is_running,
            s.active_cycle,
            s.pending_tasks_count,
            s.in_progress_tasks_count,
            s.completed_tasks_count,
        ),
        None => ("PAUSED", false, 0, 0, 0, 0),
    };

    let state_style = if is_running {
        Style::default().fg(Color::Green).add_modifier(Modifier::BOLD)
    } else {
        Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD)
    };

    let header_p = Paragraph::new(vec![
        Line::from(vec![
            Span::styled("CTO AGENT: ", Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD)),
            Span::styled(format!("{}  ", cto_name), Style::default().fg(Color::White).add_modifier(Modifier::BOLD)),
            Span::styled(format!("Swarm Workforce: {} ({} active)", total_agents, working_agents), Style::default().fg(Color::DarkGray)),
        ]),
        Line::from(vec![
            Span::styled("SUPERVISOR DAEMON: ", Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD)),
            Span::styled(format!("[{}] ", sup_state), state_style),
            Span::styled(format!("Cycle #{} | Tasks: {} pending, {} active, {} completed", cycle, pending, in_prog, completed), Style::default().fg(Color::White)),
        ]),
        Line::from(vec![
            Span::styled("OPERATOR CONTROLS: ", Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD)),
            Span::styled("[D] ", Style::default().fg(Color::Green).add_modifier(Modifier::BOLD)),
            Span::raw("Directive  "),
            Span::styled("[Space] ", Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD)),
            Span::raw(if is_running { "Pause  " } else { "Play  " }),
            Span::styled("[T] ", Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD)),
            Span::raw("Cycle Tick  "),
            Span::styled("[A] ", Style::default().fg(Color::Green).add_modifier(Modifier::BOLD)),
            Span::raw("Approve  "),
            Span::styled("[X] ", Style::default().fg(Color::Red).add_modifier(Modifier::BOLD)),
            Span::raw("Dismiss"),
        ]),
    ])
    .block(Block::default().title(" Autonomous CTO Command & Continuous Supervisor ").borders(Borders::ALL).border_style(Style::default().fg(Color::Cyan)));
    f.render_widget(header_p, cto_chunks[0]);

    if state.cto_proposals.is_empty() {
        let empty_p = Paragraph::new("NO PROACTIVE PROPOSALS IN QUEUE\n\nAll engineering initiatives are currently decomposed or under execution.\nPress [D] to submit a high-level directive to the CTO.")
            .block(Block::default().title(" Proactive Initiatives & Architectural Proposals ").borders(Borders::ALL))
            .wrap(Wrap { trim: true });
        f.render_widget(empty_p, cto_chunks[1]);
    } else {
        let rows: Vec<Row> = state
            .cto_proposals
            .iter()
            .enumerate()
            .map(|(display_idx, p)| {
                let is_selected = display_idx == state.selected_index;
                let style = if is_selected {
                    Style::default().bg(Color::Blue).fg(Color::White).add_modifier(Modifier::BOLD)
                } else {
                    Style::default()
                };
                let status_style = match p.status.as_str() {
                    "APPROVED" => Style::default().fg(Color::Green),
                    "DISMISSED" => Style::default().fg(Color::Red),
                    _ => Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD),
                };
                Row::new(vec![
                    Span::styled(&p.id[..p.id.len().min(8)], style),
                    Span::styled(&p.category, style),
                    Span::styled(&p.title, style),
                    Span::styled(&p.status, status_style),
                    Span::styled(format!("{}", p.proposed_tasks.len()), style),
                ])
            })
            .collect();

        let table = Table::new(
            rows,
            [
                Constraint::Length(10),
                Constraint::Length(14),
                Constraint::Length(34),
                Constraint::Length(12),
                Constraint::Length(8),
            ],
        )
        .header(
            Row::new(vec!["ID", "CATEGORY", "INITIATIVE TITLE", "STATUS", "TASKS"])
                .style(Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD)),
        )
        .block(
            Block::default()
                .title(" Proactive Initiatives & Architectural Proposals (Press [A] to Approve, [X] to Dismiss) ")
                .borders(Borders::ALL),
        );
        f.render_widget(table, cto_chunks[1]);
    }
}

pub fn inspector_text(state: &AppState) -> Option<String> {
    if state.cto_proposals.is_empty() {
        return None;
    }
    let p = &state.cto_proposals[state.selected_index.min(state.cto_proposals.len() - 1)];
    let mut text = format!(
        "PROPOSAL INSPECTOR\n\nID       : {}\nTITLE    : {}\nCATEGORY : {}\nSTATUS   : {}\n\nRATIONALE:\n{}\n\nIMPACT ASSESSMENT:\n{}\n\nPROPOSED TASKS ({}):\n",
        p.id,
        p.title,
        p.category,
        p.status,
        p.rationale,
        p.impact_assessment,
        p.proposed_tasks.len()
    );
    for (idx, task) in p.proposed_tasks.iter().take(4).enumerate() {
        let title = task.get("title").and_then(|t| t.as_str()).unwrap_or("Task");
        let role = task.get("role").and_then(|r| r.as_str()).unwrap_or("worker");
        text.push_str(&format!(" {}. [{}] {}\n", idx + 1, role.to_uppercase(), title));
    }
    if p.status == "PROPOSED" {
        text.push_str("\nPress [a] to Approve & Delegate, [x] to Dismiss.");
    }
    Some(text)
}
