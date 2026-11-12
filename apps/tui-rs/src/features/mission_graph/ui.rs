use ratatui::{
    layout::{Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, List, ListItem, Paragraph, Wrap},
    Frame,
};

use crate::AppState;
use crate::common::FocusPane;
use super::model::{GraphNodeStatus, GraphNodeType};

pub const COLOR_CYAN: Color = Color::Rgb(0, 255, 204);
pub const COLOR_NEON_GREEN: Color = Color::Rgb(57, 255, 20);
pub const COLOR_BG_CARD: Color = Color::Rgb(0, 35, 35);

/// Docked presentation of the Mission & Dependency Graph Pane (left column in Cockpit)
pub fn render_docked_graph_pane(f: &mut Frame, state: &AppState, area: Rect) {
    let is_focused = state.is_nav_mode && state.focus_pane == FocusPane::Graph;
    let graph = &state.mission_graph_state;
    let indices = graph.filtered_indices();

    let mut items = Vec::new();

    if graph.nodes.is_empty() {
        items.push(ListItem::new(Line::from(vec![
            Span::styled("No project tasks registered in graph.", Style::default().fg(Color::DarkGray)),
        ])));
        items.push(ListItem::new(Line::from(vec![
            Span::styled("Dispatch CTO directive to construct DAG.", Style::default().fg(COLOR_CYAN)),
        ])));
    } else {
        let max_visible = area.height.saturating_sub(3) as usize;
        let selected_filtered_idx = graph.selected_idx.min(indices.len().saturating_sub(1));
        
        let start_idx = if selected_filtered_idx >= max_visible {
            selected_filtered_idx + 1 - max_visible
        } else {
            0
        };

        for (display_pos, &node_idx) in indices.iter().skip(start_idx).take(max_visible).enumerate() {
            let actual_pos = start_idx + display_pos;
            let is_sel = is_focused && actual_pos == selected_filtered_idx;
            let node = &graph.nodes[node_idx];

            let (badge_color, symbol) = match node.status {
                GraphNodeStatus::Ready => (COLOR_NEON_GREEN, "⚡"),
                GraphNodeStatus::InProgress => (COLOR_CYAN, "▶"),
                GraphNodeStatus::Waiting => (Color::Yellow, "⏳"),
                GraphNodeStatus::Blocked => (Color::Red, "⛔"),
                GraphNodeStatus::Failed => (Color::Red, "✗"),
                GraphNodeStatus::Done => (COLOR_NEON_GREEN, "✓"),
                GraphNodeStatus::Cancelled => (Color::DarkGray, "⊘"),
            };

            let prefix = if is_sel { "▶ " } else { "  " };
            let depth_pad = "  ".repeat(node.depth);

            let max_title_len = (area.width as usize).saturating_sub(14 + node.depth * 2).max(10);
            let title_disp = if node.title.len() > max_title_len {
                format!("{}…", &node.title[..max_title_len.saturating_sub(1)])
            } else {
                node.title.clone()
            };

            let node_line = Line::from(vec![
                Span::styled(prefix, Style::default().fg(if is_sel { COLOR_CYAN } else { Color::DarkGray })),
                Span::raw(depth_pad),
                Span::styled(format!("{} ", node.connector), Style::default().fg(Color::DarkGray)),
                Span::styled(format!("{} ", symbol), Style::default().fg(badge_color).add_modifier(Modifier::BOLD)),
                Span::styled(
                    title_disp,
                    Style::default().fg(if is_sel { COLOR_CYAN } else { Color::White }).add_modifier(if node.depth == 0 { Modifier::BOLD } else { Modifier::empty() }),
                ),
                Span::styled(format!(" @{}", node.assigned_agent), Style::default().fg(Color::DarkGray)),
            ]);

            items.push(ListItem::new(node_line));
        }
    }

    let ready_count = graph.parallel_ready_count();
    let blocked_count = graph.critical_blockers_count();

    let title = if area.width < 28 {
        format!(" 🕸 GRAPH ({}) ", indices.len())
    } else {
        format!(" 🕸 MISSION GRAPH [⚡{} ⛔{}] ", ready_count, blocked_count)
    };

    let block = Block::default()
        .title(title)
        .borders(Borders::ALL)
        .border_style(Style::default().fg(if is_focused { COLOR_CYAN } else { Color::DarkGray }));

    f.render_widget(List::new(items).block(block), area);
}

/// Full Split-Pane Mission & Dependency Graph Workspace (used for Tab 3 and maximized view)
pub fn render_mission_graph_workspace(f: &mut Frame, state: &AppState, area: Rect) {
    let graph = &state.mission_graph_state;

    let main_layout = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Length(3), Constraint::Min(12)])
        .split(area);

    // 1. Top Summary & Filter Bar
    let ready_count = graph.parallel_ready_count();
    let blocker_count = graph.critical_blockers_count();
    let total_count = graph.nodes.len();

    let p_filter_label = graph.filter_project.as_deref().unwrap_or("ALL");
    let s_filter_label = graph.filter_status.map(|s| s.as_str()).unwrap_or("ALL");
    let prio_filter_label = graph.filter_priority.as_deref().unwrap_or("ALL");

    let line1 = Line::from(vec![
        Span::styled(" 🕸 MISSION & DEPENDENCY TOPOLOGY ", Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD)),
        Span::styled(format!(":: {} nodes mapped  ", total_count), Style::default().fg(Color::White)),
        Span::styled(
            format!(" [⚡ PARALLEL READY: {}] ", ready_count),
            Style::default().fg(Color::Black).bg(Color::Green).add_modifier(Modifier::BOLD),
        ),
        Span::raw(" "),
        if blocker_count > 0 {
            Span::styled(
                format!(" [⛔ CRITICAL BLOCKERS: {}] ", blocker_count),
                Style::default().fg(Color::White).bg(Color::Red).add_modifier(Modifier::BOLD),
            )
        } else {
            Span::styled(" [✓ ZERO BLOCKERS] ", Style::default().fg(Color::Green))
        },
    ]);

    let line2 = Line::from(vec![
        Span::styled(" Filters: ", Style::default().fg(Color::Yellow)),
        Span::styled(format!("[p] Project: {} ", p_filter_label), Style::default().fg(COLOR_CYAN)),
        Span::styled(format!("| [s] Status: {} ", s_filter_label), Style::default().fg(COLOR_CYAN)),
        Span::styled(format!("| [P] Priority: {} ", prio_filter_label), Style::default().fg(COLOR_CYAN)),
        Span::styled(
            if graph.search_query.is_empty() { "| [/] Search: [None]".to_string() } else { format!("| [/] Search: '{}'", graph.search_query) },
            Style::default().fg(Color::White),
        ),
        Span::styled("  | Shortcuts: [↑/↓] Select  [Enter] Details  [a] Agent  [e] Changes  [z] Zoom", Style::default().fg(Color::DarkGray)),
    ]);

    let header_block = Block::default()
        .borders(Borders::ALL)
        .border_style(Style::default().fg(COLOR_CYAN));
    f.render_widget(Paragraph::new(vec![line1, line2]).block(header_block), main_layout[0]);

    // 2. Body Split: Left Graph Tree (60%) + Right Selected Node Inspector (40%)
    let body_split = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(60), Constraint::Percentage(40)])
        .split(main_layout[1]);

    render_graph_tree_view(f, state, body_split[0]);
    render_graph_node_inspector(f, state, body_split[1]);
}

fn render_graph_tree_view(f: &mut Frame, state: &AppState, area: Rect) {
    let graph = &state.mission_graph_state;
    let indices = graph.filtered_indices();
    let is_focused = state.is_nav_mode && (state.focus_pane == FocusPane::Graph || state.focus_pane == FocusPane::Tasks);

    let mut items = Vec::new();

    if indices.is_empty() {
        items.push(ListItem::new(Line::from(vec![
            Span::styled("No graph nodes matching current filter criteria.", Style::default().fg(Color::Yellow)),
        ])));
        items.push(ListItem::new(Line::from(vec![
            Span::styled("Press [s] or [p] to reset active filters.", Style::default().fg(Color::DarkGray)),
        ])));
    } else {
        let max_rows = area.height.saturating_sub(2) as usize;
        let selected_filtered_idx = graph.selected_idx.min(indices.len().saturating_sub(1));
        
        let start_idx = if selected_filtered_idx >= max_rows {
            selected_filtered_idx + 1 - max_rows
        } else {
            0
        };

        for (display_pos, &node_idx) in indices.iter().skip(start_idx).take(max_rows).enumerate() {
            let actual_pos = start_idx + display_pos;
            let is_sel = actual_pos == selected_filtered_idx;
            let node = &graph.nodes[node_idx];

            let (badge_color, status_text) = match node.status {
                GraphNodeStatus::Ready => (COLOR_NEON_GREEN, "READY"),
                GraphNodeStatus::InProgress => (COLOR_CYAN, "RUNNING"),
                GraphNodeStatus::Waiting => (Color::Yellow, "WAITING"),
                GraphNodeStatus::Blocked => (Color::Red, "BLOCKED"),
                GraphNodeStatus::Failed => (Color::Red, "FAILED"),
                GraphNodeStatus::Done => (COLOR_NEON_GREEN, "DONE"),
                GraphNodeStatus::Cancelled => (Color::DarkGray, "CANCELLED"),
            };

            let prefix = if is_sel { "▶ " } else { "  " };
            let depth_indent = "    ".repeat(node.depth);

            let node_symbol = match node.node_type {
                GraphNodeType::ProjectRoot => "◆ ",
                GraphNodeType::Milestone => "◇ ",
                GraphNodeType::Task => "● ",
                GraphNodeType::Subtask => "↳ ",
            };

            let dep_badge = if !node.dependencies.is_empty() {
                format!(" [deps: {}]", node.dependencies.len())
            } else {
                String::new()
            };

            let impact_badge = if node.downstream_impact > 0 {
                format!(" [holds: {}]", node.downstream_impact)
            } else {
                String::new()
            };

            let line = Line::from(vec![
                Span::styled(prefix, Style::default().fg(if is_sel { COLOR_CYAN } else { Color::DarkGray })),
                Span::raw(depth_indent),
                Span::styled(&node.connector, Style::default().fg(Color::DarkGray)),
                Span::styled(node_symbol, Style::default().fg(if node.depth == 0 { Color::Yellow } else { COLOR_CYAN })),
                Span::styled(
                    format!("[{:<7}] ", status_text),
                    Style::default().fg(badge_color).add_modifier(Modifier::BOLD),
                ),
                Span::styled(
                    node.title.clone(),
                    Style::default().fg(if is_sel { COLOR_CYAN } else { Color::White }).add_modifier(if node.depth == 0 { Modifier::BOLD } else { Modifier::empty() }),
                ),
                Span::styled(dep_badge, Style::default().fg(Color::DarkGray)),
                Span::styled(impact_badge, Style::default().fg(if node.status == GraphNodeStatus::Blocked || node.status == GraphNodeStatus::Failed { Color::Red } else { Color::DarkGray })),
                Span::styled(format!("  @{}", node.assigned_agent), Style::default().fg(Color::DarkGray)),
            ]);

            items.push(ListItem::new(line));
        }
    }

    let block = Block::default()
        .title(" Mission Directives & Dependency Tree ")
        .borders(Borders::ALL)
        .border_style(Style::default().fg(if is_focused { COLOR_CYAN } else { Color::DarkGray }));

    f.render_widget(List::new(items).block(block), area);
}

fn render_graph_node_inspector(f: &mut Frame, state: &AppState, area: Rect) {
    let graph = &state.mission_graph_state;
    let selected = graph.selected_node();

    let lines = if let Some(node) = selected {
        let (status_color, status_text) = match node.status {
            GraphNodeStatus::Ready => (Color::Green, "READY (Dependencies Met - Can run in parallel)"),
            GraphNodeStatus::InProgress => (COLOR_CYAN, "IN PROGRESS (Agent actively executing)"),
            GraphNodeStatus::Waiting => (Color::Yellow, "WAITING (Pending upstream completion)"),
            GraphNodeStatus::Blocked => (Color::Red, "BLOCKED (Upstream dependency failed or blocked)"),
            GraphNodeStatus::Failed => (Color::Red, "FAILED (Verification gate error)"),
            GraphNodeStatus::Done => (Color::Green, "DONE (Successfully completed)"),
            GraphNodeStatus::Cancelled => (Color::DarkGray, "CANCELLED"),
        };

        let mut doc = vec![
            Line::from(vec![
                Span::styled("NODE ID      : ", Style::default().fg(Color::DarkGray)),
                Span::styled(&node.id, Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD)),
            ]),
            Line::from(vec![
                Span::styled("TITLE        : ", Style::default().fg(Color::DarkGray)),
                Span::styled(&node.title, Style::default().fg(Color::White).add_modifier(Modifier::BOLD)),
            ]),
            Line::from(vec![
                Span::styled("PROJECT ROOT : ", Style::default().fg(Color::DarkGray)),
                Span::styled(&node.project_name, Style::default().fg(Color::White)),
            ]),
            Line::from(vec![
                Span::styled("ASSIGNED TO  : ", Style::default().fg(Color::DarkGray)),
                Span::styled(format!("@{} ", node.assigned_agent), Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD)),
                Span::styled("[a: Open Profile]", Style::default().fg(Color::DarkGray)),
            ]),
            Line::from(vec![
                Span::styled("PRIORITY     : ", Style::default().fg(Color::DarkGray)),
                Span::styled(&node.priority, Style::default().fg(if node.priority == "CRITICAL" { Color::Red } else { Color::White })),
            ]),
            Line::from(vec![
                Span::styled("STATUS       : ", Style::default().fg(Color::DarkGray)),
                Span::styled(status_text, Style::default().fg(status_color).add_modifier(Modifier::BOLD)),
            ]),
            Line::from(""),
        ];

        // Direct Blockers breakdown
        if !node.blockers.is_empty() {
            doc.push(Line::from(vec![
                Span::styled("⛔ ROOT CAUSE BLOCKERS:", Style::default().fg(Color::Red).add_modifier(Modifier::BOLD)),
            ]));
            for blk in &node.blockers {
                doc.push(Line::from(vec![
                    Span::styled("  ✗ ", Style::default().fg(Color::Red)),
                    Span::styled(blk, Style::default().fg(Color::White)),
                ]));
            }
            doc.push(Line::from(""));
        }

        // Downstream Impact
        doc.push(Line::from(vec![
            Span::styled("DOWNSTREAM IMPACT : ", Style::default().fg(Color::DarkGray)),
            Span::styled(
                format!("{} dependent task(s) impacted", node.downstream_impact),
                Style::default().fg(if node.downstream_impact > 0 { Color::Yellow } else { Color::Green }).add_modifier(Modifier::BOLD),
            ),
        ]));

        // Upstream Dependencies
        let preds_str = if node.dependencies.is_empty() {
            "None (Root Task)".to_string()
        } else {
            node.dependencies.join(", ")
        };
        doc.push(Line::from(vec![
            Span::styled("UPSTREAM (PREDS)  : ", Style::default().fg(Color::DarkGray)),
            Span::styled(preds_str, Style::default().fg(Color::White)),
        ]));

        // Downstream Dependants
        let succs_str = if node.dependants.is_empty() {
            "None (Leaf Task)".to_string()
        } else {
            node.dependants.join(", ")
        };
        doc.push(Line::from(vec![
            Span::styled("DOWNSTREAM (SUCCS): ", Style::default().fg(Color::DarkGray)),
            Span::styled(succs_str, Style::default().fg(Color::White)),
        ]));

        doc.push(Line::from(""));
        doc.push(Line::from(vec![
            Span::styled("ACCEPTANCE CRITERIA & VERIFICATION:", Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD)),
        ]));
        for crit in &node.acceptance_criteria {
            doc.push(Line::from(vec![
                Span::styled("  • ", Style::default().fg(COLOR_CYAN)),
                Span::styled(crit, Style::default().fg(Color::White)),
            ]));
        }

        doc.push(Line::from(""));
        doc.push(Line::from(vec![
            Span::styled("OPERATIONAL CONTROLS:", Style::default().fg(Color::DarkGray).add_modifier(Modifier::BOLD)),
        ]));
        doc.push(Line::from(vec![
            Span::styled("  [a] Inspect Agent  [e] Engineering Changes  [Enter] Full Task Modal", Style::default().fg(COLOR_CYAN)),
        ]));

        doc
    } else {
        vec![
            Line::from(vec![
                Span::styled("Select a node on the left to inspect its dependency topology.", Style::default().fg(Color::DarkGray)),
            ]),
        ]
    };

    let block = Block::default()
        .title(" Node Topology & Impact Inspector ")
        .borders(Borders::ALL)
        .border_style(Style::default().fg(COLOR_CYAN));

    f.render_widget(Paragraph::new(lines).block(block).wrap(Wrap { trim: false }), area);
}
