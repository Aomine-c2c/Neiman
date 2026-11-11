use ratatui::{
    layout::{Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, Clear, List, ListItem, Paragraph, Wrap},
    Frame,
};

use crate::app::AppState;
use crate::common::{is_narrow_terminal, ActiveTab, ConnectionState, LayoutFocus};
use crate::features::{
    agents, approvals, cockpit, command_center, config, evolution, executive, growth,
    infrastructure, memory, onboarding, resources, security,
};
use crate::theme::ThemeMode;

pub fn render_app(f: &mut Frame, state: &AppState) {
    let area = f.area();

    // Onboarding wizard mode override
    if state.is_onboarding {
        let chunks = Layout::default()
            .direction(Direction::Vertical)
            .constraints([
                Constraint::Length(3),
                Constraint::Min(12),
                Constraint::Length(3),
            ])
            .split(area);

        render_top_status_bar(f, state, chunks[0]);
        onboarding::render_onboarding_wizard(f, state, chunks[1]);

        let status_bar = Paragraph::new(Span::styled(
            format!(
                " ONBOARDING WIZARD: {} | [↑/↓/j/k] Navigate, [1-9] Select, [Enter/y] Confirm & Advance, [Esc] Exit",
                state.onboarding_status_text
            ),
            Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD),
        ))
        .block(Block::default().borders(Borders::ALL).border_style(Style::default().fg(Color::Cyan)));
        f.render_widget(status_bar, chunks[2]);
        return;
    }

    let is_narrow = is_narrow_terminal(area);

    // Global Vertical Topology: Top Status Bar (3), Main Body (Min), Bottom Command Bar (3)
    let vert_chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3),
            Constraint::Min(8),
            Constraint::Length(3),
        ])
        .split(area);

    // 1. Persistent Top Status Bar
    if state.active_tab == ActiveTab::CommandCenter {
        crate::features::cockpit::render_cyber_header(f, state, vert_chunks[0]);
        crate::features::cockpit::render_unified_cockpit(f, state, vert_chunks[1]);
        render_bottom_status_bar(f, state, vert_chunks[2]);
        return;
    }

    render_top_status_bar(f, state, vert_chunks[0]);

    // 2. Main Body: Adaptive Layout (Narrow vs Standard Desktop)
    if is_narrow {
        // Narrow Terminal Fallback: Full central workspace, compact nav, omitted right inspector
        render_central_workspace(f, state, vert_chunks[1]);
    } else {
        // Standard Desktop Topology: Left Nav Rail (25 cols) + Central Workspace (60%) + Contextual Right Inspector (40%)
        let body_chunks = Layout::default()
            .direction(Direction::Horizontal)
            .constraints([
                Constraint::Length(25), // Left Navigation Rail (13 workspaces)
                Constraint::Percentage(50), // Central Workspace
                Constraint::Percentage(30), // Contextual Right Inspector
            ])
            .split(vert_chunks[1]);

        render_left_nav_rail(f, state, body_chunks[0]);
        render_central_workspace(f, state, body_chunks[1]);
        render_right_inspector(f, state, body_chunks[2]);
    }

    // 3. Persistent Bottom Command / Status Area
    render_bottom_status_bar(f, state, vert_chunks[2]);

    // 4. Modal Overlays Stack
    if state.palette_open {
        render_command_palette_modal(f, state, area);
    } else if state.help_modal_open {
        render_help_modal(f, state, area);
    } else if state.provider_modal_open {
        cockpit::render_provider_modal(f, state, area);
    } else if state.company_picker_open {
        cockpit::render_company_picker_modal(f, state, area);
    }
}

pub fn render_top_status_bar(f: &mut Frame, state: &AppState, area: Rect) {
    let connection_indicator = match state.connection_state {
        ConnectionState::Connected => Span::styled(
            format!(" ● LIVE CONNECTED ({})", state.client.base_url),
            Style::default().fg(Color::Green).add_modifier(Modifier::BOLD),
        ),
        ConnectionState::Connecting => Span::styled(
            format!(" ⠋ CONNECTING ({})", state.client.base_url),
            Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD),
        ),
        ConnectionState::Degraded => Span::styled(
            format!(" ▲ DEGRADED ({})", state.client.base_url),
            Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD),
        ),
        ConnectionState::Offline => Span::styled(
            " ○ OFFLINE (PREVIEW FIXTURE MODE)",
            Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD),
        ),
    };

    let theme_label = match state.theme.mode {
        ThemeMode::Light => "[LIGHT]",
        ThemeMode::Dark => "[DARK]",
    };

    let border_color = match state.connection_state {
        ConnectionState::Connected => Color::Cyan,
        ConnectionState::Connecting => Color::Cyan,
        ConnectionState::Degraded => Color::Yellow,
        ConnectionState::Offline => Color::Yellow,
    };

    let header_lines = vec![
        Line::from(vec![
            Span::styled(" NEIMAN OS ", Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD)),
            Span::styled(format!(":: {} ", state.company_name), Style::default().fg(Color::White).add_modifier(Modifier::BOLD)),
            connection_indicator,
            Span::styled(format!("  {}  ", theme_label), Style::default().fg(Color::DarkGray)),
            Span::styled("[Ctrl+K Palette | ? Help]", Style::default().fg(Color::Cyan)),
        ]),
    ];

    let header = Paragraph::new(header_lines)
        .block(Block::default().borders(Borders::ALL).border_style(Style::default().fg(border_color)));
    f.render_widget(header, area);
}

pub fn render_left_nav_rail(f: &mut Frame, state: &AppState, area: Rect) {
    let is_focused = state.layout_focus == LayoutFocus::NavRail;
    let border_color = if is_focused { Color::Cyan } else { Color::DarkGray };

    let items: Vec<ListItem> = ActiveTab::all()
        .iter()
        .map(|tab| {
            let is_active = *tab == state.active_tab;
            let shortcut = tab.shortcut();
            let name = tab.name();

            let (style, prefix) = if is_active {
                (
                    Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD),
                    "▶ ",
                )
            } else {
                (Style::default().fg(Color::White), "  ")
            };

            let line = Line::from(vec![
                Span::styled(prefix, style),
                Span::styled(format!("[{}] ", shortcut), Style::default().fg(Color::Yellow)),
                Span::styled(name, style),
            ]);
            ListItem::new(line)
        })
        .collect();

    let list = List::new(items).block(
        Block::default()
            .title(" Workspaces ")
            .borders(Borders::ALL)
            .border_style(Style::default().fg(border_color)),
    );
    f.render_widget(list, area);
}

pub fn render_central_workspace(f: &mut Frame, state: &AppState, area: Rect) {
    match state.active_tab {
        ActiveTab::CommandCenter => {
            command_center::render_operator_command_center(f, state, area);
        }
        ActiveTab::AgentRoster => {
            agents::render_agents_tab(f, state, area);
        }
        ActiveTab::MissionControl => {
            crate::features::mission_graph::render_mission_graph_workspace(f, state, area);
        }
        ActiveTab::ExecutiveComms => {
            executive::render_executive_tab(f, state, area);
        }
        ActiveTab::EngineeringWorkbench => {
            crate::features::engineering::render_engineering_workbench_tab(f, state, area);
        }
        ActiveTab::GovernanceApprovals => {
            approvals::render_approvals_tab(f, state, area);
        }
        ActiveTab::ResourceExchange => {
            resources::render_resources_tab(f, state, area);
        }
        ActiveTab::CompanyMemory => {
            memory::render_memory_tab(f, state, area);
        }
        ActiveTab::EvolutionLab => {
            evolution::render_evolution_tab(f, state, area);
        }
        ActiveTab::BusinessGrowth => {
            growth::render_growth_tab(f, state, area);
        }
        ActiveTab::SecurityAudit => {
            security::render_security_tab(f, state, area);
        }
        ActiveTab::InfrastructureRuntime => {
            infrastructure::render_infrastructure_tab(f, state, area);
        }
        ActiveTab::CompanyConfiguration => {
            config::render_config_tab(f, state, area);
        }
    }
}

pub fn render_right_inspector(f: &mut Frame, state: &AppState, area: Rect) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Percentage(45), Constraint::Percentage(55)])
        .split(area);

    let is_focused = state.layout_focus == LayoutFocus::Inspector;
    let border_color = if is_focused { Color::Cyan } else { Color::Yellow };

    // Top: Dynamic Context-Sensitive Entity Inspector
    let text = match state.active_tab {
        ActiveTab::CommandCenter => command_center::inspector_text(state),
        ActiveTab::AgentRoster => agents::inspector_text(state),
        ActiveTab::MissionControl => crate::features::mission_graph::inspector_text(state),
        ActiveTab::ExecutiveComms => executive::inspector_text(state),
        ActiveTab::EngineeringWorkbench => crate::features::engineering::inspector_text(state),
        ActiveTab::GovernanceApprovals => approvals::inspector_text(state),
        ActiveTab::ResourceExchange => resources::inspector_text(state),
        ActiveTab::CompanyMemory => memory::inspector_text(state),
        ActiveTab::EvolutionLab => evolution::inspector_text(state),
        ActiveTab::BusinessGrowth => growth::inspector_text(state),
        ActiveTab::SecurityAudit => security::inspector_text(state),
        ActiveTab::InfrastructureRuntime => infrastructure::inspector_text(state),
        ActiveTab::CompanyConfiguration => config::inspector_text(state),
    }
    .unwrap_or_else(|| "Select an entity on the central pane to view detailed runtime telemetry.".to_string());

    let inspector_widget = Paragraph::new(text)
        .block(
            Block::default()
                .title(" Contextual Inspector ")
                .borders(Borders::ALL)
                .border_style(Style::default().fg(border_color)),
        )
        .wrap(Wrap { trim: true });
    f.render_widget(inspector_widget, chunks[0]);

    // Bottom: Realtime Audit Stream
    let log_items: Vec<ListItem> = state
        .logs
        .iter()
        .rev()
        .take(15)
        .map(|l| ListItem::new(Line::from(Span::raw(l))))
        .collect();

    let logs_list = List::new(log_items).block(
        Block::default()
            .title(" Realtime Audit Stream ")
            .borders(Borders::ALL)
            .border_style(Style::default().fg(Color::DarkGray)),
    );
    f.render_widget(logs_list, chunks[1]);
}

pub fn render_bottom_status_bar(f: &mut Frame, state: &AppState, area: Rect) {
    let status_widget = if state.is_command_mode {
        Paragraph::new(Span::styled(
            format!(" :{}█", state.command_input),
            Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD),
        ))
        .block(
            Block::default()
                .title(" COMMAND HUB (type: roster, mission, comms, cto, memory, evolution, config, theme) ")
                .borders(Borders::ALL)
                .border_style(Style::default().fg(Color::Cyan)),
        )
    } else if state.is_entering_directive {
        Paragraph::new(Span::styled(
            format!(" DIRECTIVE: {}█ (Press Enter to dispatch, Esc to cancel)", state.directive_input),
            Style::default().fg(Color::Green).add_modifier(Modifier::BOLD),
        ))
        .block(
            Block::default()
                .title(" DISPATCH DIRECTIVE TO AUTONOMOUS LEADS ")
                .borders(Borders::ALL)
                .border_style(Style::default().fg(Color::Green)),
        )
    } else if state.is_filtering {
        Paragraph::new(Span::styled(
            format!(" FILTER: {}█ (Press Enter to apply, Esc to clear)", state.filter_query),
            Style::default().fg(Color::Yellow),
        ))
        .block(Block::default().borders(Borders::ALL).border_style(Style::default().fg(Color::Yellow)))
    } else {
        Paragraph::new(Span::styled(
            format!(
                " STATUS: {} | [Ctrl+K] Palette | [1-9,0,-,=,\\] Workspaces | [Tab] Focus | [?] Help | [t] Theme | [q] Quit",
                state.status_message
            ),
            Style::default().fg(if state.api_connected { Color::Green } else { Color::Yellow }),
        ))
        .block(Block::default().borders(Borders::ALL).border_style(Style::default().fg(Color::DarkGray)))
    };

    f.render_widget(status_widget, area);
}

pub fn render_command_palette_modal(f: &mut Frame, state: &AppState, area: Rect) {
    let popup_area = centered_rect(65, 65, area);
    f.render_widget(Clear, popup_area);

    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3), // Input Search Box
            Constraint::Min(6),    // Filtered Commands & Workspaces List
            Constraint::Length(2), // Bottom Controls Hint
        ])
        .split(popup_area);

    // 1. Search Box
    let search_bar = Paragraph::new(Span::styled(
        format!(" > {}█", state.palette_query),
        Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD),
    ))
    .block(
        Block::default()
            .title(" COMMAND PALETTE (Ctrl+K) ")
            .borders(Borders::ALL)
            .border_style(Style::default().fg(Color::Cyan)),
    );
    f.render_widget(search_bar, chunks[0]);

    // 2. Filtered Items List
    let items = state.get_palette_items();
    let list_items: Vec<ListItem> = items
        .iter()
        .enumerate()
        .map(|(i, item)| {
            let is_selected = i == state.palette_selection;
            let (style, prefix) = if is_selected {
                (
                    Style::default().fg(Color::Black).bg(Color::Cyan).add_modifier(Modifier::BOLD),
                    " ▶ ",
                )
            } else {
                (Style::default().fg(Color::White), "   ")
            };

            let shortcut_str = item.shortcut.as_deref().unwrap_or("");
            let content = Line::from(vec![
                Span::styled(prefix, style),
                Span::styled(format!("[{:<10}] ", item.category), Style::default().fg(Color::DarkGray)),
                Span::styled(format!("{:<46} ", item.title), style),
                Span::styled(shortcut_str, Style::default().fg(Color::Yellow)),
            ]);
            ListItem::new(content)
        })
        .collect();

    let list = List::new(list_items).block(
        Block::default()
            .borders(Borders::LEFT | Borders::RIGHT)
            .border_style(Style::default().fg(Color::Cyan)),
    );
    f.render_widget(list, chunks[1]);

    // 3. Hint
    let hint = Paragraph::new(Span::styled(
        " [↑/↓/j/k] Navigate | [Enter] Execute | [Esc] Close Palette ",
        Style::default().fg(Color::DarkGray),
    ))
    .block(
        Block::default()
            .borders(Borders::LEFT | Borders::RIGHT | Borders::BOTTOM)
            .border_style(Style::default().fg(Color::Cyan)),
    );
    f.render_widget(hint, chunks[2]);
}

pub fn render_help_modal(f: &mut Frame, _state: &AppState, area: Rect) {
    let popup_area = centered_rect(70, 70, area);
    f.render_widget(Clear, popup_area);

    let help_text = vec![
        Line::from(vec![
            Span::styled("NEIMAN OPERATING SYSTEM :: KEYBOARD SHORTCUTS", Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD)),
        ]),
        Line::from(""),
        Line::from(vec![
            Span::styled("NAVIGATION & PANE MANAGEMENT:", Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD)),
        ]),
        Line::from("  • [Ctrl+K]       : Open universal fuzzy command palette across all tools"),
        Line::from("  • [1-9,0,-,=,\\]  : Jump directly to any of the 13 canonical workspaces"),
        Line::from("  • [Tab] / [S-Tab]: Cycle focus: Chat ➔ Swarm ➔ Tasks ➔ Graph ➔ Activity ➔ Telemetry ➔ Eng ➔ Approvals ➔ Res ➔ QA ➔ Dec ➔ Mem"),
        Line::from("  • [↑/↓] or [j/k] : Navigate items in active pane"),
        Line::from("  • [z]            : Maximize / restore selected pane (toggle zoom)"),
        Line::from("  • [d]            : Cycle docked pane in right column (Eng ➔ Approvals ➔ Res ➔ QA ➔ Dec ➔ Mem)"),
        Line::from("  • [</>]          : Resize left column width (shrink / expand)"),
        Line::from("  • [-/+]          : Resize right column width (shrink / expand)"),
        Line::from("  • [ [ ] / [ ] ]  : Collapse / restore left / right column"),
        Line::from("  • [0]            : Reset to original default 3-column command layout & save"),
        Line::from("  • [Esc]          : Close modal / clear filter / return to default focus"),
        Line::from(""),
        Line::from(vec![
            Span::styled("OPERATIONAL ACTIONS & GOVERNANCE:", Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD)),
        ]),
        Line::from("  • [a] / [y]      : Approve selected four-eyes governance review gate"),
        Line::from("  • [n]            : Reject selected four-eyes governance review gate"),
        Line::from("  • [r]            : Refresh telemetry, repository diffs, and pipeline gates"),
        Line::from("  • [t]            : Jump to related task from diagnostic or activity event"),
        Line::from("  • [e]            : Jump to diff or cycle epistemic filter in Decision Trace"),
        Line::from("  • [c]            : Cycle category filter in Approvals or Company Memory"),
        Line::from("  • [Ctrl+P]       : Configure AI model providers & API credentials"),
        Line::from("  • [Ctrl+O]       : Link active codebase repository"),
        Line::from("  • [q] / [Ctrl+C] : Quit operator console"),
        Line::from(""),
        Line::from(Span::styled("Press [Esc] or [?] to close this help cheatsheet.", Style::default().fg(Color::Cyan))),
    ];

    let help_widget = Paragraph::new(help_text)
        .block(
            Block::default()
                .title(" Keyboard Shortcuts & Ergonomics ")
                .borders(Borders::ALL)
                .border_style(Style::default().fg(Color::Cyan)),
        )
        .wrap(Wrap { trim: true });
    f.render_widget(help_widget, popup_area);
}

fn centered_rect(percent_x: u16, percent_y: u16, r: Rect) -> Rect {
    let popup_layout = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Percentage((100 - percent_y) / 2),
            Constraint::Percentage(percent_y),
            Constraint::Percentage((100 - percent_y) / 2),
        ])
        .split(r);

    Layout::default()
        .direction(Direction::Horizontal)
        .constraints([
            Constraint::Percentage((100 - percent_x) / 2),
            Constraint::Percentage(percent_x),
            Constraint::Percentage((100 - percent_x) / 2),
        ])
        .split(popup_layout[1])[1]
}
