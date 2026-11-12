use ratatui::{
    layout::{Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, List, ListItem, Paragraph, Row, Table, Wrap},
    Frame,
};

use crate::{
    common::FocusPane,
    features::memory::model::{CompanyMemoryState, KnowledgeVerificationStatus},
    AppState,
};

const COLOR_CYAN: Color = Color::Rgb(14, 243, 206);

/// Compact Docked Pane in Command Cockpit
pub fn render_docked_memory_pane(f: &mut Frame, state: &AppState, area: Rect) {
    let mem = &state.company_memory_state;
    let is_focused = state.is_nav_mode && state.focus_pane == FocusPane::CompanyMemory;

    let indices = mem.filtered_indices();
    let title = format!(
        " 🧠 COMPANY MEMORY & INTELLIGENCE [CODE GRAPH: {} syms] ({}) ",
        mem.code_graph.total_symbols,
        indices.len()
    );

    let mut list_items = Vec::new();
    for (i, &rec_idx) in indices.iter().take(10).enumerate() {
        if let Some(item) = mem.records.get(rec_idx) {
            let is_sel = is_focused && i == mem.selected_idx;
            let (st_color, st_badge) = match item.status {
                KnowledgeVerificationStatus::Current => (Color::Green, "●"),
                KnowledgeVerificationStatus::Stale => (Color::Yellow, "▲"),
                KnowledgeVerificationStatus::Disputed => (Color::Red, "✖"),
                KnowledgeVerificationStatus::Unverified => (Color::DarkGray, "○"),
            };

            let pointer = if is_sel { "▶ " } else { "  " };
            let row_line = Line::from(vec![
                Span::styled(pointer, Style::default().fg(if is_sel { COLOR_CYAN } else { Color::DarkGray })),
                Span::styled(format!("[{}] ", item.id), Style::default().fg(Color::DarkGray)),
                Span::styled(format!("{} ", st_badge), Style::default().fg(st_color).add_modifier(Modifier::BOLD)),
                Span::styled(format!("[{}] ", item.category.label()), Style::default().fg(COLOR_CYAN)),
                Span::styled(&item.title, Style::default().fg(if is_sel { COLOR_CYAN } else { Color::White })),
                Span::styled(format!(" ({})", item.version), Style::default().fg(Color::DarkGray)),
            ]);
            list_items.push(ListItem::new(row_line));
        }
    }

    if list_items.is_empty() {
        list_items.push(ListItem::new(Line::from(vec![
            Span::styled("  No knowledge records found matching query.", Style::default().fg(Color::DarkGray)),
        ])));
    }

    let block = Block::default()
        .title(title)
        .borders(Borders::ALL)
        .border_style(Style::default().fg(if is_focused { COLOR_CYAN } else { Color::DarkGray }));

    f.render_widget(List::new(list_items).block(block), area);
}

/// Full Workspace for Company Memory & Intelligence
pub fn render_company_memory_workspace(f: &mut Frame, state: &AppState, area: Rect) {
    let mem = &state.company_memory_state;

    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(6),      // Search & Category Header + AST Pre-Index + Source Graph Banner
            Constraint::Percentage(45), // Records Table
            Constraint::Percentage(55), // Full Content & Source Provenance Inspector
        ])
        .split(area);

    // 1. Header Bar with Search & Provenance Policy
    let cat_filter_str = mem.filter_category.map(|c| c.label()).unwrap_or("ALL");
    let status_filter_str = mem.filter_status.map(|s| s.as_str()).unwrap_or("ALL");

    let header_lines = vec![
        Line::from(vec![
            Span::styled("COMPANY MEMORY & ORGANIZATIONAL INTELLIGENCE", Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD)),
            Span::styled(" | Verified Knowledge, Research & Reusable Agent Skills", Style::default().fg(Color::DarkGray)),
        ]),
        Line::from(vec![
            Span::styled("Category (c): ", Style::default().fg(Color::DarkGray)),
            Span::styled(cat_filter_str, Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD)),
            Span::styled(" | Status (s): ", Style::default().fg(Color::DarkGray)),
            Span::styled(status_filter_str, Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD)),
            Span::styled(" | Search (q): ", Style::default().fg(Color::DarkGray)),
            Span::styled(if mem.search_query.is_empty() { "None (All items)" } else { &mem.search_query }, Style::default().fg(Color::White)),
            Span::styled(" | [j/k Navigate | z Zoom]", Style::default().fg(Color::DarkGray)),
        ]),
        Line::from(vec![
            Span::styled("AST Knowledge Graph: ", Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD)),
            Span::styled(format!("{} files | {} symbols | {} edges (Indexed in {}ms) ", mem.code_graph.indexed_files, mem.code_graph.total_symbols, mem.code_graph.total_dependencies, mem.code_graph.duration_ms), Style::default().fg(Color::White)),
            Span::styled("● ZERO-GREP RETRIEVAL ACTIVE", Style::default().fg(Color::Green).add_modifier(Modifier::BOLD)),
        ]),
        Line::from(vec![
            Span::styled("Source Graph Radar: ", Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD)),
            Span::styled(format!("Target: {} | Risk: {} ({}) | Impacted Files: {} | Endpoints: {} | Tests: {} ", 
                mem.blast_radius.target, 
                mem.blast_radius.risk_level, 
                mem.blast_radius.risk_score,
                mem.blast_radius.total_impacted_files,
                mem.blast_radius.impacted_endpoints_count,
                mem.blast_radius.impacted_tests_count
            ), Style::default().fg(Color::White)),
            Span::styled("● SOURCEGRAPH AST RESOLVER READY", Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD)),
        ]),
    ];
    let header = Paragraph::new(header_lines).block(
        Block::default().borders(Borders::ALL).border_style(Style::default().fg(COLOR_CYAN)),
    );
    f.render_widget(header, chunks[0]);

    // 2. Knowledge Records Table
    let indices = mem.filtered_indices();
    let rows: Vec<Row> = indices
        .iter()
        .enumerate()
        .map(|(i, &idx)| {
            let rec = &mem.records[idx];
            let is_sel = i == mem.selected_idx;
            let row_style = if is_sel {
                Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD)
            } else {
                Style::default().fg(Color::White)
            };

            let status_style = match rec.status {
                KnowledgeVerificationStatus::Current => Style::default().fg(Color::Green),
                KnowledgeVerificationStatus::Stale => Style::default().fg(Color::Yellow),
                KnowledgeVerificationStatus::Disputed => Style::default().fg(Color::Red).add_modifier(Modifier::BOLD),
                KnowledgeVerificationStatus::Unverified => Style::default().fg(Color::DarkGray),
            };

            Row::new(vec![
                Span::styled(&rec.id, row_style),
                Span::styled(rec.category.label(), Style::default().fg(COLOR_CYAN)),
                Span::styled(&rec.title, row_style),
                Span::styled(&rec.version, Style::default().fg(Color::White)),
                Span::styled(&rec.author_or_agent, Style::default().fg(Color::Yellow)),
                Span::styled(rec.status.badge(), status_style),
                Span::styled(rec.last_verified_at.format("%Y-%m-%d").to_string(), Style::default().fg(Color::DarkGray)),
            ])
        })
        .collect();

    let table = Table::new(
        rows,
        [
            Constraint::Length(9),  // ID
            Constraint::Length(15), // Category
            Constraint::Min(24),    // Title
            Constraint::Length(10), // Version
            Constraint::Length(20), // Author
            Constraint::Length(14), // Status
            Constraint::Length(10), // Verified
        ],
    )
    .header(
        Row::new(vec!["ID", "CATEGORY", "TITLE", "VERSION", "AUTHOR / AGENT", "STATUS", "VERIFIED"])
            .style(Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD)),
    )
    .block(
        Block::default()
            .title(format!(" Knowledge Items ({}) ", indices.len()))
            .borders(Borders::ALL)
            .border_style(Style::default().fg(COLOR_CYAN)),
    );
    f.render_widget(table, chunks[1]);

    // 3. Deep-Dive Inspector
    render_knowledge_inspector(f, mem, chunks[2]);
}

fn render_knowledge_inspector(f: &mut Frame, mem: &CompanyMemoryState, area: Rect) {
    let block = Block::default()
        .title(" Knowledge Record Content & Source Provenance ")
        .borders(Borders::ALL)
        .border_style(Style::default().fg(COLOR_CYAN));

    let rec = match mem.selected_record() {
        Some(r) => r,
        None => {
            let p = Paragraph::new("Select a knowledge record to view details.").block(block);
            f.render_widget(p, area);
            return;
        }
    };

    let sub_chunks = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(55), Constraint::Percentage(45)])
        .split(area);

    // Left Column: Full Content & Summary
    let mut left_lines = Vec::new();
    left_lines.push(Line::from(vec![
        Span::styled("RECORD ID     : ", Style::default().fg(Color::DarkGray)),
        Span::styled(&rec.id, Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD)),
        Span::styled(format!(" ({})", rec.category.label()), Style::default().fg(Color::Yellow)),
    ]));
    left_lines.push(Line::from(vec![
        Span::styled("TITLE         : ", Style::default().fg(Color::DarkGray)),
        Span::styled(&rec.title, Style::default().fg(Color::White).add_modifier(Modifier::BOLD)),
    ]));
    left_lines.push(Line::from(vec![
        Span::styled("SUMMARY       : ", Style::default().fg(Color::DarkGray)),
        Span::styled(&rec.summary, Style::default().fg(Color::Gray)),
    ]));
    left_lines.push(Line::from(""));
    left_lines.push(Line::from(Span::styled("FULL KNOWLEDGE CONTENT:", Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD))));
    left_lines.push(Line::from(Span::styled(&rec.full_content, Style::default().fg(Color::White))));

    f.render_widget(Paragraph::new(left_lines).block(Block::default().borders(Borders::NONE)).wrap(Wrap { trim: true }), sub_chunks[0]);

    // Right Column: Provenance, Verification, and Usage
    let mut right_lines = Vec::new();
    right_lines.push(Line::from(Span::styled("PROVENANCE & USAGE AUDIT:", Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD))));
    right_lines.push(Line::from(vec![
        Span::styled("  • Source Reference  : ", Style::default().fg(Color::DarkGray)),
        Span::styled(&rec.source_reference, Style::default().fg(COLOR_CYAN)),
    ]));
    right_lines.push(Line::from(vec![
        Span::styled("  • Required Scope    : ", Style::default().fg(Color::DarkGray)),
        Span::styled(&rec.required_permission, Style::default().fg(Color::Green)),
    ]));
    right_lines.push(Line::from(vec![
        Span::styled("  • Last Verified At  : ", Style::default().fg(Color::DarkGray)),
        Span::styled(rec.last_verified_at.format("%Y-%m-%d %H:%M:%S UTC").to_string(), Style::default().fg(Color::White)),
    ]));
    right_lines.push(Line::from(vec![
        Span::styled("  • Epistemic Status  : ", Style::default().fg(Color::DarkGray)),
        Span::styled(rec.status.badge(), Style::default().fg(if rec.status == KnowledgeVerificationStatus::Current { Color::Green } else { Color::Yellow })),
    ]));

    right_lines.push(Line::from(""));
    right_lines.push(Line::from(Span::styled("WHERE THIS KNOWLEDGE IS USED:", Style::default().fg(COLOR_CYAN))));
    if rec.usage_locations.is_empty() {
        right_lines.push(Line::from(Span::styled("  No registered consumer references.", Style::default().fg(Color::DarkGray))));
    } else {
        for loc in &rec.usage_locations {
            right_lines.push(Line::from(vec![
                Span::styled("  ◈ ", Style::default().fg(COLOR_CYAN)),
                Span::styled(loc, Style::default().fg(Color::Gray)),
            ]));
        }
    }

    f.render_widget(Paragraph::new(right_lines).block(Block::default().borders(Borders::NONE)).wrap(Wrap { trim: true }), sub_chunks[1]);
}
