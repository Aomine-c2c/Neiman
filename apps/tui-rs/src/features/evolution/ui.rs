use ratatui::{
    layout::{Constraint, Rect},
    style::{Color, Modifier, Style},
    text::Span,
    widgets::{Block, Borders, Paragraph, Row, Table, Wrap},
    Frame,
};

use crate::AppState;

pub fn render_evolution_tab(f: &mut Frame, state: &AppState, area: Rect) {
    if state.adaptations.is_empty() {
        let p = Paragraph::new(
            "EVOLUTION ENGINE\n\nNo adaptations returned from /evolution/adaptations.\n\
            Empty backlog — not a health claim.\n\n\
            Hotkeys when proposals exist: [m] simulate  [a] approve/deploy  [b] rollback",
        )
        .block(Block::default().title(" Evolution Engine ").borders(Borders::ALL))
        .wrap(Wrap { trim: true });
        f.render_widget(p, area);
    } else {
        let rows: Vec<Row> = state
            .adaptations
            .iter()
            .enumerate()
            .map(|(display_idx, a)| {
                let is_selected = display_idx == state.selected_index;
                let style = if is_selected {
                    Style::default().bg(Color::Blue).fg(Color::White).add_modifier(Modifier::BOLD)
                } else {
                    Style::default()
                };
                Row::new(vec![
                    Span::styled(&a.id[..a.id.len().min(8)], style),
                    Span::styled(&a.title, style),
                    Span::styled(a.stage.as_deref().unwrap_or("PROPOSE"), style),
                    Span::styled(&a.status, Style::default().fg(Color::Green)),
                ])
            })
            .collect();

        let table = Table::new(
            rows,
            [
                Constraint::Length(10),
                Constraint::Length(34),
                Constraint::Length(14),
                Constraint::Length(14),
            ],
        )
        .header(
            Row::new(vec!["ID", "ADAPTATION PROPOSAL", "STAGE", "STATUS"])
                .style(Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD)),
        )
        .block(Block::default().title(" Self-Improvement Adaptations ").borders(Borders::ALL));
        f.render_widget(table, area);
    }
}

pub fn inspector_text(state: &AppState) -> Option<String> {
    if state.adaptations.is_empty() {
        return None;
    }
    let a = &state.adaptations[state.selected_index.min(state.adaptations.len() - 1)];
    Some(format!(
        "ADAPTATION INSPECTOR\n\nID     : {}\nTITLE  : {}\nSTAGE  : {}\nSTATUS : {}\nDIAGNOSIS : {}\nEXPECTED   : {}\n\n[m] simulate  [a] approve/deploy  [b] rollback",
        a.id,
        a.title,
        a.stage.as_deref().unwrap_or("[unavailable]"),
        a.status,
        a.trigger_diagnosis.as_deref().unwrap_or("[unavailable]"),
        a.expected_improvement.as_deref().unwrap_or("[unavailable]")
    ))
}
