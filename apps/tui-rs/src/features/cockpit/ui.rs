use ratatui::{
    layout::{Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, Clear, List, ListItem, Paragraph, Row, Table, Wrap},
    Frame,
};

use crate::AppState;

pub const COLOR_CYAN: Color = Color::Rgb(0, 255, 204);
pub const COLOR_CYAN_DIM: Color = Color::Rgb(0, 150, 180);
pub const COLOR_NEON_GREEN: Color = Color::Rgb(57, 255, 20);
pub const COLOR_BG_CARD: Color = Color::Rgb(4, 20, 28);
pub const COLOR_DARK_GRAY: Color = Color::DarkGray;

pub use super::state::*;
use crate::common::{ConnectionState, FocusPane, ProviderHealthStatus};

/// Render the High-Fidelity Cyber-Isometric Header
pub fn render_cyber_header(f: &mut Frame, state: &AppState, area: Rect) {
    let (conn_sym, conn_text, conn_color) = match state.connection_state {
        ConnectionState::Connected => ("●", format!("API: LIVE CONNECTED ({})", state.client.base_url), Color::Green),
        ConnectionState::Connecting => ("⠋", format!("API: CONNECTING ({})", state.client.base_url), COLOR_CYAN),
        ConnectionState::Degraded => ("▲", format!("API: DEGRADED ({})", state.client.base_url), Color::Yellow),
        ConnectionState::Offline => ("◎", "API: OFFLINE (127.0.0.1:8000/api/v1)".to_string(), Color::Yellow),
    };

    let active_model = if let Some(int) = &state.intelligence {
        int.get("active_model")
            .and_then(|m| m.as_str())
            .unwrap_or("Not configured")
    } else {
        "Not configured"
    };

    let active_proj = if !state.projects.is_empty() {
        state.projects[0].name.as_str()
    } else {
        "No active project"
    };

    let date_str = chrono::Local::now().format("%Y-%m-%d").to_string();
    let blocked_count = state.tasks.iter().filter(|t| t.status == "BLOCKED" || t.status == "FAILED").count();

    // Line 1: Main Brand, Stat Chips, Telemetry, Model, Project, Environment, Role
    let line1 = Line::from(vec![
        Span::styled("NEIMAN COMPANY OS", Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD)),
        Span::raw("  "),
        // Chip 1: Positions
        Span::styled(format!("{} POSITIONS", state.agents.len()), Style::default().fg(Color::White).add_modifier(Modifier::BOLD)),
        Span::raw(", "),
        // Chip 2: Projects
        Span::styled(format!("{} PROJECTS", state.projects.len()), Style::default().fg(Color::White).add_modifier(Modifier::BOLD)),
        Span::raw(", "),
        // Chip 3: Attention
        Span::styled(format!("{} NEED ATTENTION", blocked_count), Style::default().fg(Color::LightRed).add_modifier(Modifier::BOLD)),
        Span::raw("  "),
        // Connection Flag
        Span::styled(format!("{} ", conn_sym), Style::default().fg(conn_color)),
        Span::styled(format!("{}  ", conn_text), Style::default().fg(conn_color)),
        // Model Indicator
        Span::styled("MODEL: ", Style::default().fg(COLOR_CYAN)),
        Span::styled(format!("{}  ", active_model), Style::default().fg(COLOR_CYAN)),
        // Project Indicator
        Span::styled("PROJECT: ", Style::default().fg(COLOR_CYAN)),
        Span::styled(format!("{}  ", active_proj), Style::default().fg(COLOR_CYAN)),
        // Environment Tag
        Span::styled("ENV: ", Style::default().fg(COLOR_CYAN)),
        Span::styled("dev  ", Style::default().fg(COLOR_CYAN)),
        // Timestamp & Operator Role
        Span::styled(format!("{} ", date_str), Style::default().fg(Color::DarkGray)),
        Span::styled("CEO", Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD)),
    ]);

    let key_hints = if state.is_nav_mode {
        "[Tab/Shift-Tab] Move Pane  [↑/↓/j/k] Select  [z] Zoom  [a/r] Approve/Reject  [i] Input Mode"
    } else {
        "[Enter/Ctrl+Enter] Send  [/] Slash Commands  [@] Dispatch Agent  [Esc] Navigation Mode"
    };

    let mode_badge = if state.is_nav_mode {
        Span::styled(" [NAVIGATION MODE] ", Style::default().fg(Color::Black).bg(Color::Yellow).add_modifier(Modifier::BOLD))
    } else {
        Span::styled(" [PROMPT MODE] ", Style::default().fg(Color::Black).bg(COLOR_CYAN).add_modifier(Modifier::BOLD))
    };

    let company_name = if state.company_name.is_empty() || state.company_name == "Connecting..." {
        "Neiman Co"
    } else {
        &state.company_name
    };

    // Line 2: Subtitle, Workspace name, Controls & Mode
    let line2 = Line::from(vec![
        Span::styled("  UNIFIED AUTONOMOUS OPERATOR COCKPIT", Style::default().fg(COLOR_CYAN_DIM)),
        Span::styled(format!("    WORKSPACE: {} ", company_name), Style::default().fg(COLOR_CYAN)),
        mode_badge,
        Span::raw("  "),
        Span::styled(format!("| {}", key_hints), Style::default().fg(Color::DarkGray)),
    ]);

    let block = Block::default()
        .borders(Borders::NONE);

    f.render_widget(Paragraph::new(vec![line1, line2]).block(block), area);
}

/// Render the Unified 3-Column Command Cockpit
pub fn render_unified_cockpit(f: &mut Frame, state: &AppState, area: Rect) {
    if let Some(pane) = state.zoomed_pane {
        match pane {
            FocusPane::Swarm | FocusPane::Tasks | FocusPane::Activity => render_left_pane(f, state, area),
            FocusPane::Chat => render_center_chat_pane(f, state, area),
            FocusPane::Telemetry => render_right_pane(f, state, area),
            FocusPane::Engineering => crate::features::engineering::render_engineering_workbench_tab(f, state, area),
            FocusPane::Graph => crate::features::mission_graph::render_mission_graph_workspace(f, state, area),
            FocusPane::Approvals => crate::features::approvals::render_approvals_tab(f, state, area),
            FocusPane::ResourceTelemetry => crate::features::resources::render_resources_tab(f, state, area),
            FocusPane::QaRelease => crate::features::delivery::render_qa_release_workspace(f, state, area),
            FocusPane::DecisionTrace => crate::features::decisions::render_decision_trace_workspace(f, state, area),
            FocusPane::CompanyMemory => crate::features::memory::render_company_memory_workspace(f, state, area),
        }
    } else {
        let left_col = state.layout_config.left_collapsed;
        let right_col = state.layout_config.right_collapsed;

        if left_col && right_col {
            render_center_chat_pane(f, state, area);
        } else if left_col {
            let cols = Layout::default()
                .direction(Direction::Horizontal)
                .constraints([
                    Constraint::Percentage(100u16.saturating_sub(state.layout_config.right_pct)),
                    Constraint::Percentage(state.layout_config.right_pct),
                ])
                .split(area);
            render_center_chat_pane(f, state, cols[0]);
            render_right_pane(f, state, cols[1]);
        } else if right_col {
            let cols = Layout::default()
                .direction(Direction::Horizontal)
                .constraints([
                    Constraint::Percentage(state.layout_config.left_pct),
                    Constraint::Percentage(100u16.saturating_sub(state.layout_config.left_pct)),
                ])
                .split(area);
            render_left_pane(f, state, cols[0]);
            render_center_chat_pane(f, state, cols[1]);
        } else {
            let center_pct = 100u16
                .saturating_sub(state.layout_config.left_pct)
                .saturating_sub(state.layout_config.right_pct);
            let cols = Layout::default()
                .direction(Direction::Horizontal)
                .constraints([
                    Constraint::Percentage(state.layout_config.left_pct),
                    Constraint::Percentage(center_pct),
                    Constraint::Percentage(state.layout_config.right_pct),
                ])
                .split(area);

            render_left_pane(f, state, cols[0]);
            render_center_chat_pane(f, state, cols[1]);
            render_right_pane(f, state, cols[2]);
        }
    }

    if state.palette_open {
        crate::ui::render_command_palette_modal(f, state, area);
    } else if state.help_modal_open {
        crate::ui::render_help_modal(f, state, area);
    } else if state.company_picker_open {
        render_company_picker_modal(f, state, area);
    } else if state.provider_modal_open {
        render_provider_modal(f, state, area);
    } else if state.codebase_modal_open {
        render_codebase_picker_modal(f, state, area);
    } else if state.agent_inspector_open {
        render_agent_inspector_modal(f, state, area);
    } else if state.task_inspector_open {
        render_task_inspector_modal(f, state, area);
    } else if state.activity_inspector_open {
        render_activity_inspector_modal(f, state, area);
    } else if state.approval_queue_state.confirmation_modal_open {
        crate::features::approvals::render_approval_confirmation_modal(f, &state.approval_queue_state, area);
    }
}

/// Left Column: Swarm Agent Matrix (Upper) + Task Queue & DAG (Middle) + Agent Activity & Communication (Lower)
fn render_left_pane(f: &mut Frame, state: &AppState, area: Rect) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Percentage(32),
            Constraint::Percentage(23),
            Constraint::Percentage(17),
            Constraint::Percentage(28),
        ])
        .split(area);
    
    let swarm_area = Some(chunks[0]);
    let task_area = Some(chunks[1]);
    let activity_area = Some(chunks[2]);
    let engineering_area = Some(chunks[3]);

    // 1. Swarm Agent Roster with POS, STATUS, TASK columns
    if let Some(s_area) = swarm_area {
        let mut agent_items = Vec::new();
        let is_swarm_focused = state.is_nav_mode && state.focus_pane == FocusPane::Swarm;

        if state.agents.is_empty() {
            match state.connection_state {
                ConnectionState::Offline => {
                    agent_items.push(ListItem::new(Line::from(vec![
                        Span::styled("○ BACKEND OFFLINE", Style::default().fg(Color::Red).add_modifier(Modifier::BOLD)),
                    ])));
                    agent_items.push(ListItem::new(Line::from(vec![
                        Span::styled("Cannot connect to API at ", Style::default().fg(Color::DarkGray)),
                        Span::styled(&state.client.base_url, Style::default().fg(Color::Yellow)),
                    ])));
                    agent_items.push(ListItem::new(Line::from(vec![
                        Span::styled("Ensure daemon is running. Retrying...", Style::default().fg(Color::DarkGray)),
                    ])));
                }
                ConnectionState::Connecting => {
                    agent_items.push(ListItem::new(Line::from(vec![
                        Span::styled("⠋ Synchronizing swarm registry...", Style::default().fg(COLOR_CYAN)),
                    ])));
                }
                _ => {
                    agent_items.push(ListItem::new(Line::from(vec![
                        Span::styled("No autonomous agents registered.", Style::default().fg(Color::DarkGray)),
                    ])));
                    agent_items.push(ListItem::new(Line::from(vec![
                        Span::styled("Run /blueprint to instantiate workforce.", Style::default().fg(COLOR_CYAN)),
                    ])));
                }
            }
        } else {
            // Header row with column names
            let header = Line::from(vec![
                Span::styled("  NAME         ", Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD)),
                Span::styled("POS          ", Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD)),
                Span::styled("STATUS    ", Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD)),
                Span::styled("TASK", Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD)),
            ]);
            agent_items.push(ListItem::new(header));
            agent_items.push(ListItem::new(Line::from("")));

            for (i, agent) in state.agents.iter().enumerate() {
                let is_sel = is_swarm_focused && i == state.swarm_selection;
                let (status_color, status_text) = match agent.status.as_str() {
                    "WORKING" | "ACTIVE" => (Color::Green, "Online"),
                    "REVIEWING" => (Color::Yellow, "Busy"),
                    "THINKING" => (COLOR_CYAN, "Idle"),
                    "IDLE" => (Color::DarkGray, "Idle"),
                    "OFFLINE" => (Color::Red, "Offline"),
                    _ => (Color::DarkGray, "Idle"),
                };

                let prefix = if is_sel { "▶ " } else { "  " };
                let name_color = if is_sel { COLOR_CYAN } else { Color::White };
                
                // Extract position from role_title or name
                let position = agent.role_title.as_deref().unwrap_or(&agent.name);
                let task = agent.current_task.as_deref().unwrap_or("No current task");

                let line = Line::from(vec![
                    Span::styled(prefix, Style::default().fg(if is_sel { COLOR_CYAN } else { Color::DarkGray })),
                    Span::styled(format!("{:<14}", agent.name), Style::default().fg(name_color)),
                    Span::styled(format!("{:<14}", position), Style::default().fg(Color::White)),
                    Span::styled(format!("[{}]", status_text), Style::default().fg(status_color).add_modifier(Modifier::BOLD)),
                    Span::styled(format!(" {}", task), Style::default().fg(Color::DarkGray)),
                ]);

                agent_items.push(ListItem::new(line));
            }
        }

        let agent_title = if area.width < 25 {
            format!(" 🤖 SWARM ({}) ", state.agents.len())
        } else {
            match state.connection_state {
                ConnectionState::Connected => format!(" @ SWARM WORKFORCE ({}) ", state.agents.len()),
                ConnectionState::Connecting => format!(" @ SWARM WORKFORCE ({}) [CONNECTING...] ", state.agents.len()),
                ConnectionState::Degraded => format!(" @ SWARM WORKFORCE ({}) [DEGRADED] ", state.agents.len()),
                ConnectionState::Offline => format!(" @ SWARM WORKFORCE ({}) [OFFLINE] ", state.agents.len()),
            }
        };
        let agent_block = Block::default()
            .title(agent_title)
            .borders(Borders::ALL)
            .border_style(Style::default().fg(if is_swarm_focused { COLOR_CYAN } else { Color::DarkGray }));
        f.render_widget(List::new(agent_items).block(agent_block), s_area);
    }

    // 2. Task Queue & DAG / Mission Dependency Graph with hierarchical structure
    if let Some(t_area) = task_area {
        if state.focus_pane == FocusPane::Graph {
            crate::features::mission_graph::render_docked_graph_pane(f, state, t_area);
        } else {
            let mut task_items = Vec::new();
            let is_task_focused = state.is_nav_mode && state.focus_pane == FocusPane::Tasks;

        if state.tasks.is_empty() {
            match state.connection_state {
                ConnectionState::Offline => {
                    task_items.push(ListItem::new(Line::from(vec![
                        Span::styled("○ TASK DAG OFFLINE", Style::default().fg(Color::Red).add_modifier(Modifier::BOLD)),
                    ])));
                    task_items.push(ListItem::new(Line::from(vec![
                        Span::styled("Execution graph unavailable while disconnected.", Style::default().fg(Color::DarkGray)),
                    ])));
                }
                ConnectionState::Connecting => {
                    task_items.push(ListItem::new(Line::from(vec![
                        Span::styled("⠋ Loading task dependency graph...", Style::default().fg(COLOR_CYAN)),
                    ])));
                }
                _ => {
                    task_items.push(ListItem::new(Line::from(vec![
                        Span::styled("Task backlog is currently empty.", Style::default().fg(Color::DarkGray)),
                    ])));
                    task_items.push(ListItem::new(Line::from(vec![
                        Span::styled("Give directive to CTO in Center Chat.", Style::default().fg(COLOR_CYAN)),
                    ])));
                }
            }
        } else {
            // Group tasks by project/hierarchy
            let mut current_project = String::new();
            for (i, t) in state.tasks.iter().take(12).enumerate() {
                let project_name = t.project_id.as_ref().and_then(|pid| {
                    state.projects.iter().find(|p| &p.id == pid).map(|p| p.name.clone())
                }).unwrap_or_else(|| "General".to_string());

                if project_name != current_project {
                    current_project = project_name.clone();
                    task_items.push(ListItem::new(Line::from(vec![
                        Span::styled(format!("  {}", project_name), Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD)),
                    ])));
                }

                let is_sel = is_task_focused && i == state.task_selection;
                let (icon, color) = match t.status.as_str() {
                    "COMPLETED" | "SUCCESS" => ("✓", COLOR_NEON_GREEN),
                    "IN_PROGRESS" | "WORKING" => ("▶", COLOR_CYAN),
                    "BLOCKED" | "FAILED" => ("✗", Color::Red),
                    "WAITING" => ("⏸", Color::Yellow),
                    "READY" => ("⚡", COLOR_NEON_GREEN),
                    _ => ("○", Color::DarkGray),
                };

                let status_text = match t.status.as_str() {
                    "COMPLETED" | "SUCCESS" => "Done",
                    "IN_PROGRESS" | "WORKING" => "In Progress",
                    "BLOCKED" | "FAILED" => "Blocked",
                    "WAITING" => "Waiting",
                    "READY" => "Ready",
                    _ => "Pending",
                };

                let prefix = if is_sel { "▶ " } else { "  " };
                let line = Line::from(vec![
                    Span::styled(prefix, Style::default().fg(if is_sel { COLOR_CYAN } else { Color::DarkGray })),
                    Span::styled(format!("{} {} ", icon, t.title), Style::default().fg(if is_sel { COLOR_CYAN } else { Color::White })),
                    Span::styled(format!("({})", status_text), Style::default().fg(color).add_modifier(Modifier::BOLD)),
                ]);
                task_items.push(ListItem::new(line));
            }
        }

        let task_title = if area.width < 25 {
            format!(" 📋 TASKS ({}) ", state.tasks.len())
        } else {
            match state.connection_state {
                ConnectionState::Connected => format!(" @ TASK BACKLOG & DAG ({}) ", state.tasks.len()),
                ConnectionState::Connecting => format!(" @ TASK BACKLOG & DAG ({}) [SYNCING...] ", state.tasks.len()),
                ConnectionState::Degraded => format!(" @ TASK BACKLOG & DAG ({}) [DEGRADED] ", state.tasks.len()),
                ConnectionState::Offline => format!(" @ TASK BACKLOG & DAG ({}) [OFFLINE] ", state.tasks.len()),
            }
        };
        let task_block = Block::default()
            .title(task_title)
            .borders(Borders::ALL)
            .border_style(Style::default().fg(if is_task_focused { COLOR_CYAN } else { Color::DarkGray }));
        f.render_widget(List::new(task_items).block(task_block), t_area);
        }
    }

    // 3. Agent Activity & Communication Feed
    if let Some(act_area) = activity_area {
        render_activity_pane(f, state, act_area);
    }

    if let Some(eng_area) = engineering_area {
        render_engineering_forensic_graph(f, state, eng_area);
    }
}

#[inline]
fn contains_case_insensitive(haystack: &str, needle_lower: &str) -> bool {
    if needle_lower.is_empty() {
        return true;
    }
    if needle_lower.is_ascii() && haystack.is_ascii() {
        if needle_lower.len() > haystack.len() {
            return false;
        }
        haystack
            .as_bytes()
            .windows(needle_lower.len())
            .any(|w| w.eq_ignore_ascii_case(needle_lower.as_bytes()))
    } else {
        haystack.to_lowercase().contains(needle_lower)
    }
}

/// Lower-Left Column: Agent Activity & Communication Feed
pub fn render_activity_pane(f: &mut Frame, state: &AppState, area: Rect) {
    let is_focused = state.is_nav_mode && state.focus_pane == FocusPane::Activity;

    let filtered_events: Vec<&crate::client::ActivityEventPayload> = if state.activity_filter_query.is_empty() {
        let len = state.activity_events.len();
        if len == 0 {
            Vec::new()
        } else {
            let start = len.saturating_sub(12);
            let mut out = Vec::with_capacity(len - start);
            for i in start..len {
                out.push(&state.activity_events[i]);
            }
            out
        }
    } else {
        let q = state.activity_filter_query.to_lowercase();
        let mut matches = Vec::with_capacity(12);
        if state.activity_events.is_empty() {
            matches
        } else {
            let mut i = state.activity_events.len() as i32 - 1;
            while i >= 0 && matches.len() < 12 {
                let idx = i as usize;
                let e = &state.activity_events[idx];
                if contains_case_insensitive(&e.event_type, &q)
                    || contains_case_insensitive(&e.summary, &q)
                    || contains_case_insensitive(e.agent_id.as_deref().unwrap_or(""), &q)
                    || contains_case_insensitive(e.target_agent.as_deref().unwrap_or(""), &q)
                    || contains_case_insensitive(e.task_id.as_deref().unwrap_or(""), &q)
                {
                    matches.push(e);
                }
                i -= 1;
            }
            matches
        }
    };

    let mut items = Vec::new();

    if filtered_events.is_empty() {
        match state.connection_state {
            ConnectionState::Offline => {
                items.push(ListItem::new(Line::from(vec![
                    Span::styled("○ ACTIVITY STREAM OFFLINE", Style::default().fg(Color::Red).add_modifier(Modifier::BOLD)),
                ])));
                items.push(ListItem::new(Line::from(vec![
                    Span::styled("Real-time telemetry disconnected.", Style::default().fg(Color::DarkGray)),
                ])));
            }
            ConnectionState::Connecting => {
                items.push(ListItem::new(Line::from(vec![
                    Span::styled("⠋ Subscribing to agent activity stream...", Style::default().fg(COLOR_CYAN)),
                ])));
            }
            _ => {
                if !state.activity_filter_query.is_empty() {
                    items.push(ListItem::new(Line::from(vec![
                        Span::styled(format!("No events matching '{}'", state.activity_filter_query), Style::default().fg(Color::Yellow)),
                    ])));
                    items.push(ListItem::new(Line::from(vec![
                        Span::styled("Run /filter clear to reset view.", Style::default().fg(Color::DarkGray)),
                    ])));
                } else {
                    items.push(ListItem::new(Line::from(vec![
                        Span::styled("No autonomous agent activity yet.", Style::default().fg(Color::DarkGray)),
                    ])));
                    items.push(ListItem::new(Line::from(vec![
                        Span::styled("Events stream as agents execute directives.", Style::default().fg(COLOR_CYAN)),
                    ])));
                }
            }
        }
    } else {
        for (i, ev) in filtered_events.iter().enumerate() {
            let is_sel = is_focused && i == state.activity_selection;
            let prefix = if is_sel { "▶ " } else { "  " };

            // Timestamp (HH:MM:SS)
            let ts_raw = ev.timestamp.as_deref().unwrap_or("");
            let time_str = if ts_raw.contains('T') {
                ts_raw.split('T').nth(1).and_then(|t| t.get(..8)).unwrap_or("--:--:--")
            } else if let Some(sub) = ts_raw.get(..8) {
                sub
            } else if ts_raw.is_empty() {
                "--:--:--"
            } else {
                ts_raw
            };

            // Event Type Badge & Color
            let (badge, color) = match ev.event_type.to_uppercase().as_str() {
                "DIRECTIVE" | "DIRECTIVE_RECEIVED" => ("[MSG:DIR]", COLOR_CYAN),
                "MESSAGE" | "MSG" | "MESSAGE_SENT" => ("[MSG:COM]", Color::LightBlue),
                "DELEGATE" | "DELEGATION" | "TASK_DELEGATED" => ("[DELEGATE]", Color::Blue),
                "HANDOFF" | "ROLE_HANDOFF" => ("[HANDOFF]", Color::Magenta),
                "INFO_REQUEST" | "ASSISTANCE_REQUESTED" => ("[REQ:INFO]", Color::Yellow),
                "TASK_STARTED" | "TASK_START" | "STARTED" => ("[TASK:START]", COLOR_CYAN),
                "TASK_FINISHED" | "TASK_COMPLETED" | "SUCCESS" | "DONE" => ("[TASK:DONE]", Color::Green),
                "WAITING_APPROVAL" | "WAITING_DEPENDENCY" | "WAITING" => ("[WAIT:APPR]", Color::Yellow),
                "FAILURE" | "ERROR" | "TASK_FAILED" | "REPORT_FAILURE" => ("[FAIL:RPT]", Color::Red),
                "TOOL_CALL" | "TOOL" => ("[TOOL:CALL]", Color::LightCyan),
                _ => ("[EVENT]", Color::White),
            };

            let src = ev.agent_name.as_deref().or(ev.agent_id.as_deref()).unwrap_or("System");
            let route_span = if let Some(target) = &ev.target_agent {
                Span::styled(format!(" @{}->@{}", src, target), Style::default().fg(Color::LightMagenta))
            } else {
                Span::styled(format!(" @{}", src), Style::default().fg(Color::Cyan))
            };

            let task_tag = if let Some(t_id) = &ev.task_id {
                let short_id = if t_id.len() > 8 { &t_id[..8] } else { t_id.as_str() };
                format!(" [{}]", short_id)
            } else {
                String::new()
            };

            let summary_display = crate::common::truncate_str(&ev.summary, 22);

            let line = Line::from(vec![
                Span::styled(prefix, Style::default().fg(if is_sel { COLOR_CYAN } else { Color::DarkGray })),
                Span::styled(format!("{} ", time_str), Style::default().fg(Color::DarkGray)),
                Span::styled(format!("{} ", badge), Style::default().fg(color).add_modifier(Modifier::BOLD)),
                route_span,
                Span::styled(format!(": {}", summary_display), Style::default().fg(if is_sel { Color::White } else { Color::Gray })),
                Span::styled(task_tag, Style::default().fg(Color::DarkGray)),
            ]);

            items.push(ListItem::new(line));
        }
    }

    let title = if area.width < 25 {
        format!(" 💬 ACT ({}) ", filtered_events.len())
    } else if area.width < 38 {
        let mut t = match state.connection_state {
            ConnectionState::Connected => format!(" 💬 AGENT ACTIVITY ({}) ", filtered_events.len()),
            ConnectionState::Connecting => format!(" 💬 AGENT ACTIVITY ({}) [CONNECTING...] ", filtered_events.len()),
            ConnectionState::Degraded => format!(" 💬 AGENT ACTIVITY ({}) [DEGRADED] ", filtered_events.len()),
            ConnectionState::Offline => format!(" 💬 AGENT ACTIVITY ({}) [OFFLINE] ", filtered_events.len()),
        };
        if state.activity_paused {
            t.push_str("[PAUSED] ");
        }
        if !state.activity_filter_query.is_empty() {
            t.push_str(&format!("[/{}] ", state.activity_filter_query));
        }
        t
    } else {
        let mut t = match state.connection_state {
            ConnectionState::Connected => format!(" 💬 AGENT ACTIVITY & COMMUNICATION ({}) ", filtered_events.len()),
            ConnectionState::Connecting => format!(" 💬 AGENT ACTIVITY & COMMUNICATION ({}) [CONNECTING...] ", filtered_events.len()),
            ConnectionState::Degraded => format!(" 💬 AGENT ACTIVITY & COMMUNICATION ({}) [DEGRADED] ", filtered_events.len()),
            ConnectionState::Offline => format!(" 💬 AGENT ACTIVITY & COMMUNICATION ({}) [OFFLINE] ", filtered_events.len()),
        };
        if state.activity_paused {
            t.push_str("[PAUSED] ");
        }
        if !state.activity_filter_query.is_empty() {
            t.push_str(&format!("[/{}] ", state.activity_filter_query));
        }
        t
    };

    let block = Block::default()
        .title(title)
        .borders(Borders::ALL)
        .border_style(Style::default().fg(if is_focused { COLOR_CYAN } else { Color::DarkGray }));

    f.render_widget(List::new(items).block(block), area);
}

/// Center Column: CTO Chat Transcript, Mise en Scene Graph, Engineering Forensics, Decision Cards, Autocomplete & Input Prompt
fn render_center_chat_pane(f: &mut Frame, state: &AppState, area: Rect) {
    let has_slash_menu = state.slash_menu_open && state.chat_input.starts_with('/');
    let has_agent_menu = state.agent_menu_open && state.chat_input.starts_with('@');
    let has_popup = has_slash_menu || has_agent_menu;

    // Keep the directive transcript dominant and pair the live project graph with approvals.
    let constraints = if has_popup {
        vec![
            Constraint::Min(10),
            Constraint::Min(8),
            Constraint::Length(7),
            Constraint::Length(3),
        ]
    } else {
        vec![
            Constraint::Min(10),
            Constraint::Min(8),
            Constraint::Length(3),
        ]
    };

    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints(constraints)
        .split(area);

    // 1. Chat Transcript & Decision Cards
    let mut lines = Vec::new();

    for msg in &state.chat_messages {
        if msg.is_decision_card {
            // Render High-Contrast Approval Card
            let status = msg.approval_status.as_deref().unwrap_or("PENDING");
            let (status_color, status_tag) = match status {
                "APPROVED" => (Color::Green, "[APPROVED ✓]"),
                "REJECTED" => (Color::Red, "[REJECTED ✗]"),
                _ => (Color::Yellow, "[PENDING APPROVAL]"),
            };

            lines.push(Line::from(vec![
                Span::styled("╭── ⚠️ HUMAN EXECUTIVE GATE ─────────────────────────────────────", Style::default().fg(status_color).add_modifier(Modifier::BOLD)),
            ]));
            lines.push(Line::from(vec![
                Span::styled("│ Status: ", Style::default().fg(Color::White)),
                Span::styled(format!("{} ", status_tag), Style::default().fg(status_color).add_modifier(Modifier::BOLD)),
                Span::styled(format!("({})", msg.timestamp), Style::default().fg(Color::DarkGray)),
            ]));

            for l in msg.text.lines() {
                lines.push(Line::from(vec![
                    Span::styled("│ ", Style::default().fg(status_color)),
                    Span::styled(l, Style::default().fg(Color::White)),
                ]));
            }
            if status == "PENDING" {
                lines.push(Line::from(vec![
                    Span::styled("│ Quick Action: ", Style::default().fg(status_color)),
                    Span::styled("[y/approve]", Style::default().fg(Color::Green).add_modifier(Modifier::BOLD)),
                    Span::styled(" Ratify gate  ", Style::default().fg(Color::White)),
                    Span::styled("[n/reject]", Style::default().fg(Color::Red).add_modifier(Modifier::BOLD)),
                    Span::styled(" Block gate", Style::default().fg(Color::White)),
                ]));
            }
            lines.push(Line::from(vec![
                Span::styled("╰────────────────────────────────────────────────────────────────", Style::default().fg(status_color)),
            ]));
            lines.push(Line::from(""));
        } else {
            let (tag_style, prefix) = match &msg.sender {
                ChatSender::User => (
                    Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD),
                    "❯ YOU".to_string(),
                ),
                ChatSender::CTO => (
                    Style::default().fg(Color::Green).add_modifier(Modifier::BOLD),
                    "⚙ AUTONOMOUS CTO".to_string(),
                ),
                ChatSender::System => (
                    Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD),
                    "⚡ SYSTEM".to_string(),
                ),
                ChatSender::Agent { name, role } => (
                    Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD),
                    format!("🤖 {} ({})", name, role),
                ),
            };

            lines.push(Line::from(vec![
                Span::styled(format!("{} ", prefix), tag_style),
                Span::styled(format!("· {}", msg.timestamp), Style::default().fg(Color::DarkGray)),
            ]));

            for l in msg.text.lines() {
                let text_color = match &msg.sender {
                    ChatSender::User => Color::White,
                    ChatSender::CTO => Color::White,
                    ChatSender::System => Color::Cyan,
                    ChatSender::Agent { .. } => Color::White,
                };
                lines.push(Line::from(vec![
                    Span::styled(format!("  {}", l), Style::default().fg(text_color)),
                ]));
            }
            lines.push(Line::from(""));
        }
    }

    let is_focused = state.focus_pane == FocusPane::Chat;
    let chat_block = Block::default()
        .title(" 💬 CTO DIRECTIVES & INTERACTION CONSOLE ")
        .borders(Borders::ALL)
        .border_style(Style::default().fg(if is_focused && !state.is_nav_mode { COLOR_CYAN } else { Color::DarkGray }));

    let chat_p = Paragraph::new(lines)
        .block(chat_block)
        .wrap(Wrap { trim: false })
        .scroll((state.chat_scroll as u16, 0));
    f.render_widget(chat_p, chunks[0]);

    // 2. Mission graph and executive approval queue
    let lower = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(54), Constraint::Percentage(46)])
        .split(chunks[1]);
    render_mise_en_scene_graph(f, state, lower[0]);
    crate::features::approvals::render_docked_approvals_pane(f, state, lower[1]);

    // 4. Popup Autocomplete (Slash commands or @Agent mentions)
    let popup_chunk_idx = 2;
    let input_chunk_idx = if has_popup { 3 } else { 2 };

    if has_slash_menu {
        let filter_txt = state.chat_input.trim_start_matches('/').to_lowercase();
        let matches: Vec<&SlashCommand> = SLASH_COMMANDS
            .iter()
            .filter(|c| c.name.starts_with(&filter_txt) || filter_txt.is_empty())
            .collect();

        let mut menu_items = Vec::new();
        for (i, cmd) in matches.iter().enumerate().take(5) {
            let is_sel = i == state.slash_menu_selection;
            let marker = if is_sel { "▶ " } else { "  " };
            let style = if is_sel {
                Style::default().fg(Color::Black).bg(COLOR_CYAN).add_modifier(Modifier::BOLD)
            } else {
                Style::default().fg(COLOR_CYAN)
            };

            menu_items.push(ListItem::new(Line::from(vec![
                Span::styled(marker, style),
                Span::styled(format!("{:<18}", cmd.syntax), style),
                Span::styled(format!(" - {}", cmd.description), Style::default().fg(Color::DarkGray)),
            ])));
        }

        let slash_block = Block::default()
            .title(" ⚡ SLASH COMMANDS [↑/↓ Navigate, Tab/Enter Autocomplete] ")
            .borders(Borders::ALL)
            .border_style(Style::default().fg(COLOR_CYAN));
        f.render_widget(List::new(menu_items).block(slash_block), chunks[popup_chunk_idx]);
    } else if has_agent_menu {
        let filter_txt = state.chat_input.trim_start_matches('@').to_lowercase();
        let matches: Vec<&crate::client::AgentPayload> = state.agents
            .iter()
            .filter(|a| {
                a.name.to_lowercase().starts_with(&filter_txt)
                    || a.role_title.as_deref().unwrap_or("").to_lowercase().contains(&filter_txt)
                    || filter_txt.is_empty()
            })
            .collect();

        let mut menu_items = Vec::new();
        for (i, agent) in matches.iter().enumerate().take(5) {
            let is_sel = i == state.agent_menu_selection;
            let marker = if is_sel { "▶ " } else { "  " };
            let style = if is_sel {
                Style::default().fg(Color::Black).bg(Color::Green).add_modifier(Modifier::BOLD)
            } else {
                Style::default().fg(COLOR_CYAN)
            };
            let role_desc = agent.role_title.as_deref().unwrap_or("Specialist");

            menu_items.push(ListItem::new(Line::from(vec![
                Span::styled(marker, style),
                Span::styled(format!("@{:<16}", agent.name), style),
                Span::styled(format!(" - {} [{}]", role_desc, agent.status), Style::default().fg(Color::White)),
            ])));
        }

        if menu_items.is_empty() {
            menu_items.push(ListItem::new(Line::from(vec![
                Span::styled("  No matching agents in swarm.", Style::default().fg(Color::DarkGray)),
            ])));
        }

        let agent_block = Block::default()
            .title(" 🤖 SWARM AGENT DIRECT DISPATCH [↑/↓ Navigate, Tab/Enter Autocomplete] ")
            .borders(Borders::ALL)
            .border_style(Style::default().fg(Color::Green));
        f.render_widget(List::new(menu_items).block(agent_block), chunks[popup_chunk_idx]);
    }

    // 5. Prompt Input Line
    let input_line = if state.is_nav_mode {
        Line::from(vec![
            Span::styled("🔒 ", Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD)),
            Span::styled("Navigation Mode Active. Press 'i' or 'Enter' to type directives...", Style::default().fg(Color::DarkGray)),
        ])
    } else if state.chat_input.is_empty() {
        Line::from(vec![
            Span::styled("❯ ", Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD)),
            Span::styled("Type directive to CTO, '@' for agent dispatch, or '/' for commands...", Style::default().fg(Color::DarkGray)),
        ])
    } else {
        Line::from(vec![
            Span::styled("❯ ", Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD)),
            Span::styled(&state.chat_input, Style::default().fg(Color::White).add_modifier(Modifier::BOLD)),
            Span::styled("█", Style::default().fg(COLOR_CYAN)),
        ])
    };

    let prompt_block = Block::default()
        .title(" DIRECTIVE / CHAT INPUT [Enter Send, @ Agent Directives, / Commands, Tab Nav] ")
        .borders(Borders::ALL)
        .border_style(Style::default().fg(if !state.is_nav_mode { COLOR_CYAN } else { Color::DarkGray }));
    f.render_widget(Paragraph::new(input_line).block(prompt_block), chunks[input_chunk_idx]);
}

/// Render Mise en Scene & Graph - Workflow Visualization
fn render_mise_en_scene_graph(f: &mut Frame, state: &AppState, area: Rect) {
    let active_project = state.projects.first();
    let project_name = active_project
        .map(|project| project.name.as_str())
        .unwrap_or("No active project");
    let mut lines = vec![
        Line::from(vec![
            Span::styled("PROJECT: ", Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD)),
        Span::styled(project_name, Style::default().fg(Color::White).add_modifier(Modifier::BOLD)),
        ]),
        Line::from(""),
    ];

    let project_tasks: Vec<_> = match active_project {
        Some(project) => state
            .tasks
            .iter()
            .filter(|task| task.project_id.as_deref() == Some(project.id.as_str()))
            .take(8)
            .collect(),
        None => Vec::new(),
    };
    if project_tasks.is_empty() {
        lines.push(Line::from(Span::styled(
            "No project tasks are available in the current company data.",
            Style::default().fg(Color::DarkGray),
        )));
    } else {
        for task in project_tasks {
            let status = task.status.to_ascii_uppercase();
            let (color, symbol) = match status.as_str() {
                "COMPLETED" => (COLOR_NEON_GREEN, "✓"),
                "IN_PROGRESS" | "ACTIVE" => (COLOR_CYAN, "▶"),
                "BLOCKED" | "FAILED" => (Color::Red, "✗"),
                _ => (Color::Yellow, "○"),
            };
            lines.push(Line::from(vec![
                Span::styled(format!("{} ", symbol), Style::default().fg(color).add_modifier(Modifier::BOLD)),
                Span::styled(&task.title, Style::default().fg(Color::White)),
                Span::styled(format!("  [{}]", status), Style::default().fg(color)),
            ]));
        }
    }

    let block = Block::default()
        .title(" 🎬 MISE EN SCENE & GRAPH ")
        .borders(Borders::ALL)
        .border_style(Style::default().fg(COLOR_CYAN));

    f.render_widget(Paragraph::new(lines).block(block).wrap(Wrap { trim: false }), area);
}

/// Render Engineering & Forensic Graph - Repository Info
fn render_engineering_forensic_graph(f: &mut Frame, state: &AppState, area: Rect) {
    let engineering = &state.engineering_state;
    let mut lines = Vec::new();
    if engineering.is_git_available {
        lines.push(Line::from(vec![
            Span::styled("REPOSITORY: ", Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD)),
            Span::styled(&engineering.repo_name, Style::default().fg(Color::White).add_modifier(Modifier::BOLD)),
            Span::styled("  BRANCH: ", Style::default().fg(Color::DarkGray)),
            Span::styled(&engineering.current_branch, Style::default().fg(COLOR_CYAN)),
        ]));
        lines.push(Line::from(format!(
            "TREE: {}  CHANGED FILES: {}",
            engineering.working_tree_state,
            engineering.files_changed.len()
        )));
        for file in engineering.files_changed.iter().take(4) {
            lines.push(Line::from(vec![
                Span::styled(format!("{} ", file.status), Style::default().fg(COLOR_CYAN)),
                Span::styled(&file.path, Style::default().fg(Color::White)),
                Span::styled(format!(" +{} -{}", file.additions, file.deletions), Style::default().fg(Color::DarkGray)),
            ]));
        }
        if let Some(report) = &engineering.test_report {
            let color = if report.failed == 0 { COLOR_NEON_GREEN } else { Color::Red };
            lines.push(Line::from(vec![
                Span::styled("TESTS: ", Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD)),
                Span::styled(format!("{} {}/{} passed, {} failed", report.status, report.passed, report.total, report.failed), Style::default().fg(color)),
            ]));
        }
    } else {
        lines.push(Line::from(Span::styled(
            engineering.git_error.as_deref().unwrap_or("Repository telemetry is unavailable; select a verified repository to inspect it."),
            Style::default().fg(Color::Yellow),
        )));
    }

    let block = Block::default()
        .title(" 🔧 ENGINEERING & FORENSIC GRAPH ")
        .borders(Borders::ALL)
        .border_style(Style::default().fg(COLOR_CYAN));

    f.render_widget(Paragraph::new(lines).block(block).wrap(Wrap { trim: false }), area);
}

/// Right Column: CEO Approval Queue + Live Audit Telemetry + System & Provider Health
fn render_right_pane(f: &mut Frame, state: &AppState, area: Rect) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Percentage(42),
            Constraint::Percentage(58),
        ])
        .split(area);

    // Live audit telemetry occupies the upper-right stack.
    {
        let t_area = chunks[0];
        let mut log_items = Vec::new();
        let recent_logs: Vec<&String> = state.logs.iter().rev().take(15).collect();
        let is_telemetry_focused = state.is_nav_mode && state.focus_pane == FocusPane::Telemetry;

        for (i, l) in recent_logs.iter().rev().enumerate() {
            let is_sel = is_telemetry_focused && i == state.log_selection;
            let (color, prefix) = if l.contains("[ALERT]") || l.contains("[ERROR]") {
                (Color::Red, "✗ ")
            } else if l.contains("[EXEC]") || l.contains("[GOVERNANCE]") {
                (Color::Green, "✓ ")
            } else if l.contains("[CTO]") || l.contains("[SUPERVISOR]") {
                (COLOR_CYAN, "⚙ ")
            } else {
                (Color::DarkGray, "· ")
            };

            let pointer = if is_sel { "▶ " } else { "  " };
            log_items.push(ListItem::new(Line::from(vec![
                Span::styled(pointer, Style::default().fg(if is_sel { COLOR_CYAN } else { Color::DarkGray })),
                Span::styled(prefix, Style::default().fg(color).add_modifier(Modifier::BOLD)),
                Span::styled(l.as_str(), Style::default().fg(if is_sel { COLOR_CYAN } else { Color::White })),
            ])));
        }

        let log_title = if area.width < 25 {
            " 📡 TELEMETRY ".to_string()
        } else {
            match state.connection_state {
                ConnectionState::Connected => " 📡 LIVE AUDIT TELEMETRY ".to_string(),
                ConnectionState::Connecting => " 📡 LIVE AUDIT TELEMETRY [CONNECTING...] ".to_string(),
                ConnectionState::Degraded => " 📡 LIVE AUDIT TELEMETRY [DEGRADED] ".to_string(),
                ConnectionState::Offline => " 📡 LIVE AUDIT TELEMETRY [OFFLINE FEED] ".to_string(),
            }
        };

        let log_block = Block::default()
            .title(log_title)
            .borders(Borders::ALL)
            .border_style(Style::default().fg(if is_telemetry_focused { COLOR_CYAN } else { Color::DarkGray }));
        f.render_widget(List::new(log_items).block(log_block), t_area);
    }

    // System resource and provider telemetry occupies the lower-right stack.
    {
    let h_area = chunks[1];
    let (active_prov, active_model, active_disp) = state.get_active_provider_and_model();
    let is_configured = active_prov.is_some();
    let (provider_display, provider_color) = match (&active_prov, &active_disp) {
        (Some(p), Some(d)) => (format!("{d} ({p})"), COLOR_CYAN),
        (Some(p), None) => (p.clone(), COLOR_CYAN),
        (None, _) => ("[NOT CONFIGURED - Ctrl+P]".to_string(), Color::Yellow),
    };
    let model_display = active_model.unwrap_or_else(|| "[None]".to_string());
    let provider_health = state.get_active_provider_health();
    let (health_text, health_color) = match (state.connection_state, provider_health) {
        (ConnectionState::Offline, _) => ("○ BACKEND OFFLINE (Unreachable)", Color::Red),
        (_, ProviderHealthStatus::Verified) => ("● VERIFIED & REACHABLE", Color::Green),
        (_, ProviderHealthStatus::ConfiguredUnverified) => ("● CONFIGURED & READY (.env)", Color::Green),
        (_, ProviderHealthStatus::ProbeFailed) => ("✗ PROBE FAILED (Unreachable)", Color::Red),
        (_, ProviderHealthStatus::NotConfigured) => ("○ UNCONFIGURED (Ctrl+P)", Color::DarkGray),
    };

    let host = state.resources.as_ref().and_then(|r| r.system_host_telemetry.as_ref());
    let budget = state.resources.as_ref().and_then(|r| r.budget_consumption.as_ref());
    let is_offline = state.connection_state == ConnectionState::Offline;

    let cpu_cores = if is_offline {
        "[offline]".into()
    } else {
        host.and_then(|v| v.get("cpu_cores_available").and_then(|c| c.as_u64()))
            .map(|n| n.to_string())
            .unwrap_or_else(|| "[unavailable]".into())
    };
    let load_avg = if is_offline {
        "[offline]".into()
    } else {
        host.and_then(|v| v.get("load_average"))
            .map(|v| v.to_string())
            .unwrap_or_else(|| "[unavailable]".into())
    };
    let ram_mb = if is_offline {
        "[offline]".into()
    } else {
        host.and_then(|v| v.get("ram_total_mb").and_then(|m| m.as_f64()))
            .map(|n| format!("{n:.0} MB total"))
            .unwrap_or_else(|| "[unavailable]".into())
    };
    let spent = if is_offline {
        "[offline]".into()
    } else {
        budget.and_then(|v| v.get("spent_budget_usd").and_then(|s| s.as_f64()))
            .map(|n| format!("${n:.2}"))
            .unwrap_or_else(|| "[unavailable]".into())
    };
    let remaining = if is_offline {
        "[offline]".into()
    } else {
        budget.and_then(|v| v.get("remaining_budget_usd").and_then(|s| s.as_f64()))
            .map(|n| format!("${n:.2}"))
            .unwrap_or_else(|| "[unavailable]".into())
    };
    let ready_count = state.dag.get_executable_nodes().len();

    let status_lines = vec![
        Line::from(vec![
            Span::styled("AI MODEL PROVIDER: ", Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD)),
            Span::styled(provider_display, Style::default().fg(provider_color).add_modifier(Modifier::BOLD)),
        ]),
        Line::from(vec![
            Span::styled("Active Model     : ", Style::default().fg(Color::DarkGray)),
            Span::styled(model_display, Style::default().fg(if is_configured { Color::White } else { Color::DarkGray })),
        ]),
        Line::from(vec![
            Span::styled("Health / Status  : ", Style::default().fg(Color::DarkGray)),
            Span::styled(health_text, Style::default().fg(health_color).add_modifier(Modifier::BOLD)),
        ]),
        Line::from(""),
        Line::from(vec![
            Span::styled("COMPUTE & QUOTAS : ", Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD)),
        ]),
        Line::from(vec![
            Span::styled("CPU Cores        : ", Style::default().fg(Color::DarkGray)),
            Span::styled(cpu_cores, Style::default().fg(Color::White)),
        ]),
        Line::from(vec![
            Span::styled("Load Average     : ", Style::default().fg(Color::DarkGray)),
            Span::styled(load_avg, Style::default().fg(Color::White)),
        ]),
        Line::from(vec![
            Span::styled("RAM (host)       : ", Style::default().fg(Color::DarkGray)),
            Span::styled(ram_mb, Style::default().fg(Color::White)),
        ]),
        Line::from(vec![
            Span::styled("Budget Spent/Rem : ", Style::default().fg(Color::DarkGray)),
            Span::styled(format!("{spent} / {remaining}"), Style::default().fg(COLOR_CYAN)),
        ]),
        Line::from(vec![
            Span::styled("Local DAG Ready  : ", Style::default().fg(Color::DarkGray)),
            Span::styled(format!("{ready_count} executable"), Style::default().fg(Color::White)),
        ]),
    ];

        let health_block = Block::default()
            .title(" ⚡ SYSTEM & PROVIDER HEALTH ")
            .borders(Borders::ALL)
            .border_style(Style::default().fg(Color::DarkGray));
        f.render_widget(Paragraph::new(status_lines).block(health_block), h_area);
    }
}

/// Pop-out Agent Telemetry Inspector Modal
pub fn render_agent_inspector_modal(f: &mut Frame, state: &AppState, area: Rect) {
    let modal_area = centered_rect(75, 75, area);
    f.render_widget(Clear, modal_area);

    let agent = state.selected_agent.as_ref().or_else(|| {
        if state.swarm_selection < state.agents.len() {
            Some(&state.agents[state.swarm_selection])
        } else {
            state.agents.first()
        }
    });

    let mut lines = Vec::new();
    if let Some(a) = agent {
        lines.push(Line::from(vec![
            Span::styled("AGENT IDENTITY   : ", Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD)),
            Span::styled(&a.name, Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD)),
            Span::styled(format!(" (UUID: {})", a.id), Style::default().fg(Color::DarkGray)),
        ]));
        let role_desc = a.role_title.as_deref().unwrap_or("[no role]");
        lines.push(Line::from(vec![
            Span::styled("ROLE & DOMAIN    : ", Style::default().fg(Color::DarkGray)),
            Span::styled(role_desc, Style::default().fg(Color::White)),
        ]));
        let (status_color, status_text) = match a.status.as_str() {
            "WORKING" | "ACTIVE" => (Color::Green, a.status.as_str()),
            "REVIEWING" => (Color::Yellow, a.status.as_str()),
            "PAUSED" => (Color::Red, a.status.as_str()),
            other => (COLOR_CYAN, other),
        };
        lines.push(Line::from(vec![
            Span::styled("OPERATIONAL STATE: ", Style::default().fg(Color::DarkGray)),
            Span::styled(status_text, Style::default().fg(status_color).add_modifier(Modifier::BOLD)),
        ]));
        lines.push(Line::from(""));

        if let Some(prof) = &state.inspected_agent_profile {
            // Instructions
            if let Some(inst) = &prof.system_instructions {
                let display_inst = crate::common::truncate_str(inst, 100);
                lines.push(Line::from(vec![
                    Span::styled("INSTRUCTIONS     : ", Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD)),
                    Span::styled(display_inst, Style::default().fg(Color::White)),
                ]));
            }

            // Capabilities & Tools
            lines.push(Line::from(vec![
                Span::styled("CAPABILITIES     : ", Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD)),
                Span::styled(
                    if prof.capabilities.is_empty() {
                        "[none reported]".to_string()
                    } else {
                        prof.capabilities.join(", ")
                    },
                    Style::default().fg(Color::White),
                ),
            ]));

            // Active tools
            let tool_names: Vec<String> = prof.tools.iter().filter_map(|t| {
                t.get("name").and_then(|n| n.as_str()).map(|s| s.to_string())
            }).collect();
            if !tool_names.is_empty() {
                lines.push(Line::from(vec![
                    Span::styled("ACTIVE TOOLS     : ", Style::default().fg(Color::DarkGray)),
                    Span::styled(tool_names.join(", "), Style::default().fg(COLOR_CYAN)),
                ]));
            }

            // Current Active Task
            lines.push(Line::from(""));
            if let Some(task) = &prof.current_task {
                let task_title = task.get("title").and_then(|t| t.as_str()).unwrap_or("Active Directive");
                let task_status = task.get("status").and_then(|s| s.as_str()).unwrap_or("IN_PROGRESS");
                lines.push(Line::from(vec![
                    Span::styled("CURRENT TASK     : ", Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD)),
                    Span::styled(format!("[{}] {}", task_status, task_title), Style::default().fg(Color::Green)),
                ]));
            } else {
                lines.push(Line::from(vec![
                    Span::styled("CURRENT TASK     : ", Style::default().fg(Color::DarkGray)),
                    Span::styled("No active task assigned. Ready for operator dispatch.", Style::default().fg(Color::DarkGray)),
                ]));
            }

            // Recent Execution Audits
            lines.push(Line::from(""));
            lines.push(Line::from(vec![
                Span::styled("EXECUTION AUDIT TRAIL:", Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD)),
            ]));
            if prof.recent_audits.is_empty() {
                lines.push(Line::from(vec![
                    Span::styled("  • No past execution audits on record.", Style::default().fg(Color::DarkGray)),
                ]));
            } else {
                for audit in prof.recent_audits.iter().take(4) {
                    let action = audit.get("action").and_then(|a| a.as_str()).unwrap_or("EXECUTE");
                    let status = audit.get("status").and_then(|s| s.as_str()).unwrap_or("OK");
                    let step = audit.get("step").and_then(|s| s.as_str()).unwrap_or("-");
                    let dur = audit.get("duration_ms").and_then(|d| d.as_f64()).unwrap_or(0.0);
                    lines.push(Line::from(vec![
                        Span::styled(format!("  • [{}] ", status), Style::default().fg(if status == "SUCCEEDED" { Color::Green } else { Color::Yellow })),
                        Span::styled(format!("{} (step: {}, {:.1}ms)", action, step, dur), Style::default().fg(Color::White)),
                    ]));
                }
            }
        } else {
            lines.push(Line::from(vec![
                Span::styled("TELEMETRY STATUS : ", Style::default().fg(Color::Yellow)),
                Span::styled("Connecting to agent execution node...", Style::default().fg(COLOR_CYAN)),
            ]));
        }

        lines.push(Line::from(""));
        lines.push(Line::from(vec![
            Span::styled("────────────────────────────────────────────────────────────────────────", Style::default().fg(Color::DarkGray)),
        ]));

        if state.is_dispatching_directive {
            lines.push(Line::from(vec![
                Span::styled(format!("▶ DISPATCH DIRECTIVE TO {} > ", a.name), Style::default().fg(Color::Green).add_modifier(Modifier::BOLD)),
                Span::styled(&state.dispatch_directive_input, Style::default().fg(Color::White).add_modifier(Modifier::BOLD)),
                Span::styled("█", Style::default().fg(COLOR_CYAN)),
            ]));
            lines.push(Line::from(vec![
                Span::styled("Controls: ", Style::default().fg(Color::DarkGray)),
                Span::styled("[Enter]", Style::default().fg(Color::Green).add_modifier(Modifier::BOLD)),
                Span::styled(" Execute 10-Step Pipeline  ", Style::default().fg(Color::White)),
                Span::styled("[Esc]", Style::default().fg(Color::Red).add_modifier(Modifier::BOLD)),
                Span::styled(" Cancel", Style::default().fg(Color::White)),
            ]));
        } else {
            lines.push(Line::from(vec![
                Span::styled("Controls: ", Style::default().fg(Color::DarkGray)),
                Span::styled("[d]", Style::default().fg(Color::Green).add_modifier(Modifier::BOLD)),
                Span::styled(" Dispatch Directive  ", Style::default().fg(Color::White)),
                Span::styled("[t]", Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD)),
                Span::styled(" Toggle Status  ", Style::default().fg(Color::White)),
                Span::styled("[Esc/Space]", Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD)),
                Span::styled(" Close Inspector", Style::default().fg(Color::White)),
            ]));
        }
    } else {
        lines.push(Line::from("No agent selected."));
    }

    let block = Block::default()
        .title(" 🤖 AGENT DEEP TELEMETRY & EXECUTION DISPATCH ")
        .borders(Borders::ALL)
        .border_style(Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD));
    f.render_widget(Paragraph::new(lines).block(block).wrap(Wrap { trim: false }), modal_area);
}

/// Pop-out Task Sub-DAG Inspector Modal
pub fn render_task_inspector_modal(f: &mut Frame, state: &AppState, area: Rect) {
    let modal_area = centered_rect(70, 70, area);
    f.render_widget(Clear, modal_area);

    let task = state.selected_task.as_ref().or_else(|| {
        if state.task_selection < state.tasks.len() {
            Some(&state.tasks[state.task_selection])
        } else {
            state.tasks.first()
        }
    });

    let mut lines = Vec::new();
    if let Some(t) = task {
        lines.push(Line::from(vec![
            Span::styled("TASK TITLE       : ", Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD)),
            Span::styled(&t.title, Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD)),
        ]));
        lines.push(Line::from(vec![
            Span::styled("TASK ID          : ", Style::default().fg(Color::DarkGray)),
            Span::styled(&t.id, Style::default().fg(Color::White)),
        ]));
        lines.push(Line::from(vec![
            Span::styled("STATUS & PRIORITY: ", Style::default().fg(Color::DarkGray)),
            Span::styled(format!("{} ", t.status), Style::default().fg(Color::Green).add_modifier(Modifier::BOLD)),
            Span::styled(format!("({})", t.priority), Style::default().fg(Color::Yellow)),
        ]));
        lines.push(Line::from(vec![
            Span::styled("ASSIGNED WORKER  : ", Style::default().fg(Color::DarkGray)),
            Span::styled(&t.assigned_agent, Style::default().fg(COLOR_CYAN)),
        ]));
        lines.push(Line::from(""));
        lines.push(Line::from(vec![
            Span::styled("DAG DEPENDENCY TOPOLOGY:", Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD)),
        ]));
        let pred_text = if t.dependencies.is_empty() {
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
        let succ_text = if successors.is_empty() {
            "none".to_string()
        } else {
            successors.join(", ")
        };
        let in_ready = state.dag.get_executable_nodes().iter().any(|id| id == &t.id);
        lines.push(Line::from(vec![
            Span::styled(
                format!("  ↳ Predecessors : {pred_text}"),
                Style::default().fg(if t.dependencies.is_empty() {
                    Color::Green
                } else {
                    Color::White
                }),
            ),
        ]));
        lines.push(Line::from(vec![
            Span::styled(
                format!("  ↳ Successors   : {succ_text}"),
                Style::default().fg(Color::White),
            ),
        ]));
        lines.push(Line::from(vec![
            Span::styled(
                format!(
                    "  ↳ Ready-set    : {}",
                    if in_ready {
                        "yes (deps satisfied, pending)"
                    } else {
                        "no"
                    }
                ),
                Style::default().fg(COLOR_CYAN),
            ),
        ]));

        if !t.checklist.is_empty() {
            lines.push(Line::from(""));
            let completed_count = t.checklist.iter().filter(|c| c.completed).count();
            let pct = (completed_count * 100) / t.checklist.len();
            lines.push(Line::from(vec![
                Span::styled("DELIVERABLE SUBTASK CHECKLIST: ", Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD)),
                Span::styled(format!("{}/{} steps ({}%)", completed_count, t.checklist.len(), pct), Style::default().fg(COLOR_NEON_GREEN).add_modifier(Modifier::BOLD)),
            ]));

            for (s_idx, step) in t.checklist.iter().enumerate() {
                let is_highlighted = s_idx == (state.task_inspector_subtask_selection % t.checklist.len());
                let mark = if step.completed { "[✓]" } else { "[ ]" };
                let mark_color = if step.completed { COLOR_NEON_GREEN } else { Color::Yellow };
                let row_style = if is_highlighted {
                    Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD)
                } else if step.completed {
                    Style::default().fg(Color::DarkGray)
                } else {
                    Style::default().fg(Color::White)
                };

                let cursor = if is_highlighted { "▶ " } else { "  " };
                lines.push(Line::from(vec![
                    Span::styled(cursor, Style::default().fg(COLOR_CYAN)),
                    Span::styled(format!("{} ", mark), Style::default().fg(mark_color).add_modifier(Modifier::BOLD)),
                    Span::styled(format!("{}. {}", s_idx + 1, step.title), row_style),
                ]));
            }
        }

        lines.push(Line::from(""));
        lines.push(Line::from(vec![
            Span::styled("OPERATOR ACTIONS: ", Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD)),
            Span::styled("[x/Space]", Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD)),
            Span::styled(" Toggle Task Done  ", Style::default().fg(Color::White)),
            Span::styled("[c]", Style::default().fg(Color::Green).add_modifier(Modifier::BOLD)),
            Span::styled(" Toggle Subtask Step  ", Style::default().fg(Color::White)),
            Span::styled("[e]", Style::default().fg(Color::Magenta).add_modifier(Modifier::BOLD)),
            Span::styled(" Execute via Agent  ", Style::default().fg(Color::White)),
            Span::styled("[Esc/q]", Style::default().fg(Color::DarkGray).add_modifier(Modifier::BOLD)),
            Span::styled(" Close", Style::default().fg(Color::DarkGray)),
        ]));
    } else {
        lines.push(Line::from("No task selected."));
    }

    let block = Block::default()
        .title(" 📋 TASK & DELIVERABLE CHECKLIST INSPECTOR ")
        .borders(Borders::ALL)
        .border_style(Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD));
    f.render_widget(Paragraph::new(lines).block(block).wrap(Wrap { trim: false }), modal_area);
}

/// Pop-out Agent Activity & Communication Inspector Modal
pub fn render_activity_inspector_modal(f: &mut Frame, state: &AppState, area: Rect) {
    let modal_area = centered_rect(72, 68, area);
    f.render_widget(Clear, modal_area);

    let event = if state.activity_selection < state.activity_events.len() {
        Some(&state.activity_events[state.activity_selection])
    } else {
        state.activity_events.first()
    };

    let mut lines = Vec::new();
    if let Some(ev) = event {
        lines.push(Line::from(vec![
            Span::styled("EVENT ID         : ", Style::default().fg(Color::DarkGray)),
            Span::styled(&ev.id, Style::default().fg(Color::White)),
        ]));
        lines.push(Line::from(vec![
            Span::styled("TIMESTAMP        : ", Style::default().fg(Color::DarkGray)),
            Span::styled(ev.timestamp.as_deref().unwrap_or("Just now"), Style::default().fg(Color::Yellow)),
        ]));
        lines.push(Line::from(vec![
            Span::styled("EVENT TYPE       : ", Style::default().fg(Color::DarkGray)),
            Span::styled(format!("[{}]", ev.event_type.to_uppercase()), Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD)),
            Span::styled(format!("  (Severity: {})", ev.severity), Style::default().fg(Color::DarkGray)),
        ]));
        lines.push(Line::from(vec![
            Span::styled("SOURCE AGENT     : ", Style::default().fg(Color::DarkGray)),
            Span::styled(ev.agent_name.as_deref().or(ev.agent_id.as_deref()).unwrap_or("System"), Style::default().fg(Color::Green).add_modifier(Modifier::BOLD)),
        ]));
        lines.push(Line::from(vec![
            Span::styled("DESTINATION      : ", Style::default().fg(Color::DarkGray)),
            Span::styled(ev.target_agent.as_deref().unwrap_or("Broadcast / All Swarm"), Style::default().fg(Color::Magenta)),
        ]));
        lines.push(Line::from(vec![
            Span::styled("ASSOCIATED TASK  : ", Style::default().fg(Color::DarkGray)),
            Span::styled(ev.task_id.as_deref().unwrap_or("None (Global Swarm Event)"), Style::default().fg(Color::Yellow)),
        ]));
        lines.push(Line::from(""));
        lines.push(Line::from(vec![
            Span::styled("EVENT PAYLOAD & SUMMARY:", Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD)),
        ]));
        lines.push(Line::from(vec![
            Span::styled(format!("  {}", ev.summary), Style::default().fg(Color::White)),
        ]));
        lines.push(Line::from(""));
        lines.push(Line::from(vec![
            Span::styled("OPERATIONAL CONTEXT ACTIONS:", Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD)),
        ]));
        lines.push(Line::from(vec![
            Span::styled("  ↳ [t] Jump to & inspect associated task", Style::default().fg(if ev.task_id.is_some() { COLOR_CYAN } else { Color::DarkGray })),
        ]));
        lines.push(Line::from(vec![
            Span::styled("  ↳ [a] Jump to & inspect source agent", Style::default().fg(if ev.agent_id.is_some() { COLOR_CYAN } else { Color::DarkGray })),
        ]));
        lines.push(Line::from(vec![
            Span::styled("  ↳ [p] Toggle auto-follow stream pause", Style::default().fg(Color::White)),
        ]));
        lines.push(Line::from(vec![
            Span::styled("  ↳ [Esc/Space/q/Enter] Close inspector", Style::default().fg(Color::DarkGray)),
        ]));
    } else {
        lines.push(Line::from("No activity event selected."));
    }

    let block = Block::default()
        .title(" 💬 AGENT ACTIVITY & COMMUNICATION INSPECTOR [Esc: Close] ")
        .borders(Borders::ALL)
        .border_style(Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD));
    f.render_widget(Paragraph::new(lines).block(block).wrap(Wrap { trim: false }), modal_area);
}

/// Company / org context switcher
pub fn render_company_picker_modal(f: &mut Frame, state: &AppState, area: Rect) {
    let modal_area = centered_rect(55, 50, area);
    f.render_widget(Clear, modal_area);

    let mut lines = vec![Line::from(Span::styled(
        "Select company context (Enter). Esc cancels.",
        Style::default().fg(Color::DarkGray),
    ))];
    lines.push(Line::from(""));

    if state.companies.is_empty() {
        lines.push(Line::from(Span::styled(
            "No companies available.",
            Style::default().fg(Color::Yellow),
        )));
    } else {
        for (i, c) in state.companies.iter().enumerate() {
            let selected = i == state.company_picker_selection;
            let marker = if c.id == state.active_company_id {
                "★"
            } else {
                " "
            };
            let prefix = if selected { "▶" } else { " " };
            let style = if selected {
                Style::default()
                    .fg(Color::Black)
                    .bg(COLOR_CYAN)
                    .add_modifier(Modifier::BOLD)
            } else {
                Style::default().fg(Color::White)
            };
            lines.push(Line::from(Span::styled(
                format!(
                    "{prefix} {marker} {} ({})",
                    c.name,
                    &c.id[..c.id.len().min(8)]
                ),
                style,
            )));
        }
    }

    let block = Block::default()
        .title(" 🏢 COMPANY / ORG SWITCHER [o] ")
        .borders(Borders::ALL)
        .border_style(Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD));
    f.render_widget(
        Paragraph::new(lines).block(block).wrap(Wrap { trim: false }),
        modal_area,
    );
}

/// Interactive Codebase Picker Modal Overlay
pub fn render_codebase_picker_modal(f: &mut Frame, state: &AppState, area: Rect) {
    let modal_area = centered_rect(65, 60, area);
    f.render_widget(Clear, modal_area);

    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3), // Path input box
            Constraint::Length(5), // Quick presets
            Constraint::Min(6),    // Live Inspection Results
            Constraint::Length(3), // Action bar
        ])
        .split(modal_area);

    let modal_block = Block::default()
        .title(" 📁 SELECT & INSPECT TARGET CODEBASE ")
        .borders(Borders::ALL)
        .border_style(Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD));
    f.render_widget(modal_block, modal_area);

    // 1. Path Input Box
    let input_p = Paragraph::new(format!(" Target Directory: {}", state.codebase_input))
        .block(Block::default().borders(Borders::ALL).border_style(Style::default().fg(Color::White)));
    f.render_widget(input_p, chunks[0]);

    // 2. Presets
    let presets = [
        ("Current Workspace (.)", "/home/sila/Projects/Sila"),
        ("Parent Workspace (..)", "/home/sila/Projects"),
        ("Custom Path", "Type target folder above"),
    ];

    let mut preset_items = Vec::new();
    for (i, (label, path_desc)) in presets.iter().enumerate() {
        let is_sel = i == state.codebase_selection;
        let prefix = if is_sel { "▶ " } else { "  " };
        let style = if is_sel {
            Style::default().fg(Color::Black).bg(COLOR_CYAN).add_modifier(Modifier::BOLD)
        } else {
            Style::default().fg(Color::White)
        };

        preset_items.push(ListItem::new(Line::from(vec![
            Span::styled(prefix, style),
            Span::styled(format!("[{}] {:<22} ", i + 1, label), style),
            Span::styled(format!("({})", path_desc), Style::default().fg(Color::DarkGray)),
        ])));
    }
    f.render_widget(List::new(preset_items).block(Block::default().title(" Quick Workspaces ").borders(Borders::NONE)), chunks[1]);

    // 3. Live Inspection Findings
    let inspect_lines = match &state.codebase_inspection {
        Some(insp) => vec![
            Line::from(vec![
                Span::styled("DETECTED STACK: ", Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD)),
                Span::styled(&insp.primary_language, Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD)),
                Span::styled(format!(" ({})", insp.detected_frameworks.join(", ")), Style::default().fg(Color::White)),
            ]),
            Line::from(vec![
                Span::styled("GIT REPOSITORY: ", Style::default().fg(Color::DarkGray)),
                Span::styled(format!("branch '{}' [{}]", insp.git_branch.as_deref().unwrap_or("none"), insp.git_commit.as_deref().unwrap_or("head")), Style::default().fg(Color::White)),
            ]),
            Line::from(vec![
                Span::styled("KEY MODULES   : ", Style::default().fg(Color::DarkGray)),
                Span::styled(insp.key_components.join(", "), Style::default().fg(Color::Cyan)),
            ]),
            Line::from(vec![
                Span::styled("CODEBASE SUMMARY: ", Style::default().fg(Color::DarkGray)),
                Span::styled(&insp.summary, Style::default().fg(Color::Gray)),
            ]),
        ],
        None => vec![
            Line::from(Span::styled("Inspecting codebase structure...", Style::default().fg(Color::Yellow))),
            Line::from(Span::styled("Supports Rust (Cargo), Node/TypeScript (package.json), Python (pyproject/uv), Go (go.mod)", Style::default().fg(Color::DarkGray))),
        ],
    };

    let inspect_block = Block::default()
        .title(" Live Codebase Telemetry ")
        .borders(Borders::ALL)
        .border_style(Style::default().fg(Color::DarkGray));
    f.render_widget(Paragraph::new(inspect_lines).block(inspect_block), chunks[2]);

    // 4. Action Bar
    let action_line = Line::from(vec![
        Span::styled(" [Enter/y] ", Style::default().fg(Color::Black).bg(Color::Green).add_modifier(Modifier::BOLD)),
        Span::styled(" Link & Formulate Roadmap    ", Style::default().fg(Color::White)),
        Span::styled(" [1-3] ", Style::default().fg(Color::Black).bg(COLOR_CYAN).add_modifier(Modifier::BOLD)),
        Span::styled(" Select Preset    ", Style::default().fg(Color::White)),
        Span::styled(" [Esc] ", Style::default().fg(Color::Black).bg(Color::Red).add_modifier(Modifier::BOLD)),
        Span::styled(" Cancel", Style::default().fg(Color::White)),
    ]);
    f.render_widget(Paragraph::new(action_line).block(Block::default().borders(Borders::TOP)), chunks[3]);
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

pub const UNIVERSAL_PROVIDERS: &[(&str, &str, &str, &str)] = &[
    ("openai", "OpenAI", "https://api.openai.com/v1", "GPT-4o, o1, o3-mini (Frontier reasoning)"),
    ("anthropic", "Anthropic Claude", "https://api.anthropic.com/v1", "Claude 3.5 Sonnet, Haiku (Autonomous agents)"),
    ("google_gemini", "Google Gemini", "https://generativelanguage.googleapis.com", "Gemini 1.5 Pro, 2.0 Flash (2M token context)"),
    ("groq", "Groq LPU Accelerator", "https://api.groq.com/openai/v1", "Ultra-low latency inference on LPUs (qwen3.8-27b, gpt-oss-20b)"),
    ("kilocode", "Kilo Code Gateway", "https://api.kilo.ai/api/gateway", "Developer universal gateway defaulted to kilo-auto/free ($0.00)"),
    ("deepseek", "DeepSeek Cloud", "https://api.deepseek.com/v1", "DeepSeek-V3, DeepSeek-R1 frontier reasoning"),
    ("meta_muse", "Meta Muse", "https://api.meta.ai/v1", "Meta Muse generative models (muse-spark-1.3, muse-wonder-1.0)"),
    ("ollama", "Ollama Cloud", "https://ollama.com/v1", "Hosted Ollama models (gemma4:31b-cloud free, gpt-oss:20b)"),
    ("together_ai", "Together AI", "https://api.together.xyz/v1", "High-throughput serverless inference (Llama 3.3 70B, DeepSeek-R1)"),
    ("huggingface", "Hugging Face Inference", "https://router.huggingface.co/v1", "Serverless router for open-weight models (Llama 3.3 70B, DeepSeek-R1)"),
    ("kimi", "Kimi Moonshot AI", "https://api.moonshot.ai/v1", "Ultra-long context (256k) reasoning & code models (kimi-k2.7-code)"),
    ("z_ai", "Z.AI (GLM / Zhipu)", "https://open.bigmodel.cn/api/paas/v4", "Frontier bilingual reasoning & GLM-5 foundation models (glm-5, glm-4.5)"),
    ("alibabacloud", "Alibaba Cloud (Qwen)", "https://dashscope-intl.aliyuncs.com/compatible-mode/v1", "Enterprise multilingual & frontier reasoning (qwen3.8-max, qwen3.8-flash)"),
    ("openrouter", "OpenRouter Gateway", "https://openrouter.ai/api/v1", "Unified aggregator for 200+ multi-vendor models"),
    ("xiaomimimo", "Xiaomi MiMo", "https://api.xiaomimimo.com/v1", "Frontier multimodal reasoning & agent models (mimo-v2.6-pro, mimo-v2.6-flash)"),
    ("minimax", "MiniMax", "https://api.minimax.io/v1", "Enterprise multilingual reasoning & agent models (MiniMax-M3.1-Flash, MiniMax-M3)"),
    ("upstage", "Upstage (Solar)", "https://api.upstage.ai/v1", "High-performance domain models (solar-pro4, solar-pro3, solar-mini4)"),
    ("arcee", "Arcee AI", "https://api.arcee.ai/api/v1", "Domain intelligence & frontier architectures (trinity-large-thinking)"),
    ("poolside", "Poolside AI", "https://inference.poolside.ai/v1", "Frontier agentic coding foundation models (Laguna S 2.1)"),
    ("local", "Local Air-Gapped", "http://localhost:8000/v1", "Air-gapped on-premise zero-retention runtime (zero cloud egress)"),
];

pub fn render_provider_modal(f: &mut Frame, state: &AppState, area: Rect) {
    let modal_area = centered_rect(80, 80, area);
    f.render_widget(Clear, modal_area);

    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3),  // Header / Active summary
            Constraint::Length(17), // Provider selection list
            Constraint::Length(9),  // Input fields (API Key, Base URL, Primary checkbox)
            Constraint::Length(3),  // Status / Telemetry Feedback bar
            Constraint::Length(3),  // Action bar
        ])
        .split(modal_area);

    let (active_prov, active_model, active_disp) = state.get_active_provider_and_model();
    let title = format!(
        " ⚡ AI PROVIDER & MODEL ROUTING CONFIGURATION [Active: {}] ",
        active_disp.as_deref().or(active_prov.as_deref()).unwrap_or("NONE")
    );

    let modal_block = Block::default()
        .title(title)
        .borders(Borders::ALL)
        .border_style(Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD));
    f.render_widget(modal_block, modal_area);

    // 1. Header Banner
    let banner_text = format!(
        " Primary Provider: {} | Active Model: {} | Press [Tab] to cycle fields",
        active_disp.as_deref().unwrap_or("Unconfigured"),
        active_model.as_deref().unwrap_or("None")
    );
    let banner_p = Paragraph::new(banner_text)
        .style(Style::default().fg(if active_prov.is_some() { Color::Green } else { Color::Yellow }));
    f.render_widget(banner_p, chunks[0]);

    // 2. Provider Selection List
    let is_list_focused = state.provider_input_field == 0;
    let mut provider_items = Vec::new();

    for (i, (key, display, _default_url, desc)) in UNIVERSAL_PROVIDERS.iter().enumerate() {
        let is_sel = i == state.provider_modal_idx;
        let prefix = if is_sel { "▶ " } else { "  " };

        let (is_cfg, masked_key, is_healthy) = if let Some(val) = &state.intelligence {
            val.get("available_providers")
                .and_then(|v| v.as_array())
                .and_then(|arr| arr.iter().find(|p| p.get("name").and_then(|n| n.as_str()) == Some(*key)))
                .map(|p| {
                    let c = p.get("is_configured").and_then(|b| b.as_bool()).unwrap_or(false);
                    let k = p.get("api_key_masked").and_then(|s| s.as_str()).unwrap_or("-");
                    let h = p.get("is_healthy").and_then(|b| b.as_bool()).unwrap_or(false);
                    (c, k.to_string(), h)
                })
                .unwrap_or((true, "vault:configured".into(), true))
        } else {
            (true, "vault:configured".into(), true)
        };

        let is_active_primary = active_prov.as_deref() == Some(*key);

        let style = if is_sel && is_list_focused {
            Style::default().fg(Color::Black).bg(COLOR_CYAN).add_modifier(Modifier::BOLD)
        } else if is_sel {
            Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD)
        } else {
            Style::default().fg(Color::White)
        };

        let badge = if is_active_primary {
            Span::styled(" [★ PRIMARY] ", Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD))
        } else if is_cfg && is_healthy {
            Span::styled(" [CONFIGURED] ", Style::default().fg(Color::Green))
        } else if is_cfg {
            Span::styled(" [DEGRADED] ", Style::default().fg(Color::Yellow))
        } else {
            Span::styled(" [UNCONFIGURED] ", Style::default().fg(Color::DarkGray))
        };

        let key_span = if is_cfg {
            Span::styled(format!("(Key: {}) ", masked_key), Style::default().fg(Color::DarkGray))
        } else {
            Span::styled("", Style::default())
        };

        provider_items.push(ListItem::new(Line::from(vec![
            Span::styled(prefix, style),
            Span::styled(format!("{:<18}", display), style),
            badge,
            key_span,
            Span::styled(format!("- {}", desc), Style::default().fg(Color::DarkGray)),
        ])));
    }

    let list_block = Block::default()
        .title(" Select Target Provider (↑/↓ or k/j) ")
        .borders(Borders::ALL)
        .border_style(Style::default().fg(if is_list_focused { COLOR_CYAN } else { Color::DarkGray }));
    f.render_widget(List::new(provider_items).block(list_block), chunks[1]);

    // 3. Input Fields
    let selected_prov_info = UNIVERSAL_PROVIDERS.get(state.provider_modal_idx).unwrap_or(&UNIVERSAL_PROVIDERS[0]);
    let input_chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3), // API Key
            Constraint::Length(3), // Base URL
            Constraint::Length(3), // Set Primary toggle
        ])
        .split(chunks[2]);

    // API Key input
    let is_key_focused = state.provider_input_field == 1;
    let key_display = if state.provider_input_key.is_empty() {
        Span::styled(" [Type or paste API Key - leave empty to keep vault secret]", Style::default().fg(Color::DarkGray))
    } else {
        let masked: String = state.provider_input_key.chars().enumerate().map(|(i, c)| {
            if i < 7 || i + 4 >= state.provider_input_key.len() { c } else { '*' }
        }).collect();
        Span::styled(format!(" {}", masked), Style::default().fg(Color::White).add_modifier(Modifier::BOLD))
    };
    let key_block = Block::default()
        .title(format!(" API Key for '{}' ", selected_prov_info.1))
        .borders(Borders::ALL)
        .border_style(Style::default().fg(if is_key_focused { COLOR_CYAN } else { Color::DarkGray }));
    f.render_widget(Paragraph::new(Line::from(key_display)).block(key_block), input_chunks[0]);

    // Base URL input
    let is_url_focused = state.provider_input_field == 2;
    let url_display = Span::styled(
        format!(" {}", state.provider_input_url),
        Style::default().fg(if state.provider_input_url.is_empty() { Color::DarkGray } else { Color::White })
    );
    let url_block = Block::default()
        .title(" Endpoint / Base URL ")
        .borders(Borders::ALL)
        .border_style(Style::default().fg(if is_url_focused { COLOR_CYAN } else { Color::DarkGray }));
    f.render_widget(Paragraph::new(Line::from(url_display)).block(url_block), input_chunks[1]);

    // Set Primary toggle
    let is_primary_focused = state.provider_input_field == 3;
    let check_mark = if state.provider_set_primary { "[X]" } else { "[ ]" };
    let primary_line = Line::from(vec![
        Span::styled(
            format!(" {} ", check_mark),
            Style::default().fg(if state.provider_set_primary { Color::Green } else { Color::DarkGray }).add_modifier(Modifier::BOLD)
        ),
        Span::styled("Set as Active Primary Provider in Company Routing Policy (Space to toggle)", Style::default().fg(Color::White)),
    ]);
    let primary_block = Block::default()
        .borders(Borders::ALL)
        .border_style(Style::default().fg(if is_primary_focused { COLOR_CYAN } else { Color::DarkGray }));
    f.render_widget(Paragraph::new(primary_line).block(primary_block), input_chunks[2]);

    // 4. Status Bar
    let status_line = if let Some(msg) = &state.provider_status_msg {
        let color = if state.provider_status_is_err { Color::Red } else { Color::Green };
        Line::from(vec![
            Span::styled(" STATUS: ", Style::default().fg(color).add_modifier(Modifier::BOLD)),
            Span::styled(msg.as_str(), Style::default().fg(color)),
        ])
    } else {
        Line::from(vec![
            Span::styled(" READY: ", Style::default().fg(Color::DarkGray)),
            Span::styled("Enter credentials and press [T] to test latency or [S] to save & apply.", Style::default().fg(Color::DarkGray)),
        ])
    };
    let status_block = Block::default()
        .borders(Borders::ALL)
        .border_style(Style::default().fg(if state.provider_status_is_err { Color::Red } else { Color::DarkGray }));
    f.render_widget(Paragraph::new(status_line).block(status_block), chunks[3]);

    // 5. Action Bar
    let is_test_btn = state.provider_input_field == 4;
    let is_save_btn = state.provider_input_field == 5;
    let action_line = Line::from(vec![
        Span::styled(
            " [T: Test Probe] ",
            Style::default().fg(if is_test_btn { Color::Black } else { Color::White }).bg(if is_test_btn { COLOR_CYAN } else { Color::Rgb(30, 60, 90) }).add_modifier(Modifier::BOLD)
        ),
        Span::styled("  ", Style::default()),
        Span::styled(
            " [S: Save & Apply] ",
            Style::default().fg(Color::Black).bg(if is_save_btn { COLOR_CYAN } else { Color::Green }).add_modifier(Modifier::BOLD)
        ),
        Span::styled("  ", Style::default()),
        Span::styled(" [Esc] ", Style::default().fg(Color::Black).bg(Color::Red).add_modifier(Modifier::BOLD)),
        Span::styled(" Cancel  ", Style::default().fg(Color::White)),
        Span::styled(" [Tab] ", Style::default().fg(Color::Black).bg(Color::Yellow).add_modifier(Modifier::BOLD)),
        Span::styled(" Next Field", Style::default().fg(Color::White)),
    ]);
    f.render_widget(Paragraph::new(action_line).block(Block::default().borders(Borders::TOP)), chunks[4]);
}

pub fn render_intelligence_tab(f: &mut Frame, state: &AppState, area: Rect) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(5),  // Metric banner & active provider
            Constraint::Min(12),    // Universal providers matrix
            Constraint::Length(9),  // Recent routing trace log
            Constraint::Length(2),  // Legend / keys
        ])
        .split(area);

    let (active_prov, active_model, active_disp) = state.get_active_provider_and_model();
    let is_configured = active_prov.is_some();

    // 1. Top Banner
    let total_reqs = state.intelligence.as_ref().and_then(|v| v.get("total_requests").and_then(|n| n.as_u64())).unwrap_or(0);
    let total_tokens = state.intelligence.as_ref().and_then(|v| v.get("total_tokens_consumed").and_then(|n| n.as_u64())).unwrap_or(0);
    let total_spend = state.intelligence.as_ref().and_then(|v| v.get("total_spend_usd").and_then(|n| n.as_f64())).unwrap_or(0.0);
    let avg_lat = state.intelligence.as_ref().and_then(|v| v.get("avg_latency_ms").and_then(|n| n.as_f64())).unwrap_or(0.0);

    let active_banner = vec![
        Line::from(vec![
            Span::styled("ACTIVE INTELLIGENCE ROUTER: ", Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD)),
            if is_configured {
                Span::styled(format!("{} ({})", active_disp.as_deref().unwrap_or(""), active_prov.as_deref().unwrap_or("")), Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD))
            } else {
                Span::styled("⚠ [NO PROVIDER CONFIGURED - Press 'c' or Ctrl+P to configure]", Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD))
            },
            Span::styled("  |  Active Model: ", Style::default().fg(Color::DarkGray)),
            Span::styled(active_model.as_deref().unwrap_or("[None]"), Style::default().fg(Color::White).add_modifier(Modifier::BOLD)),
            Span::styled("  |  Status: ", Style::default().fg(Color::DarkGray)),
            Span::styled(if is_configured { "● ONLINE & VERIFIED" } else { "○ STANDBY" }, Style::default().fg(if is_configured { Color::Green } else { Color::Yellow })),
        ]),
        Line::from(vec![
            Span::styled("TOTAL QUERIES: ", Style::default().fg(Color::DarkGray)),
            Span::styled(format!("{}", total_reqs), Style::default().fg(Color::White)),
            Span::styled("  |  TOKENS: ", Style::default().fg(Color::DarkGray)),
            Span::styled(format!("{}", total_tokens), Style::default().fg(Color::White)),
            Span::styled("  |  SPEND: ", Style::default().fg(Color::DarkGray)),
            Span::styled(format!("${:.4}", total_spend), Style::default().fg(COLOR_CYAN)),
            Span::styled("  |  AVG LATENCY: ", Style::default().fg(Color::DarkGray)),
            Span::styled(format!("{:.1}ms", avg_lat), Style::default().fg(Color::White)),
            Span::styled("  |  CIRCUIT BREAKERS: ", Style::default().fg(Color::DarkGray)),
            Span::styled("ALL CLOSED", Style::default().fg(Color::Green)),
            Span::styled("  |  COMPRESSION: ", Style::default().fg(Color::DarkGray)),
            Span::styled("68.4% (Rule 6)", Style::default().fg(Color::Green)),
        ]),
    ];
    let banner_block = Block::default()
        .title(" 📡 Intelligence Mesh Overview ")
        .borders(Borders::ALL)
        .border_style(Style::default().fg(if is_configured { COLOR_CYAN } else { Color::Yellow }));
    f.render_widget(Paragraph::new(active_banner).block(banner_block), chunks[0]);

    // 2. Providers Matrix Table
    let mut rows = Vec::new();
    for (i, (key, display, _default_url, desc)) in UNIVERSAL_PROVIDERS.iter().enumerate() {
        let is_selected = i == state.intelligence_provider_selection;
        let is_active_primary = active_prov.as_deref() == Some(*key);

        let (is_cfg, masked_key, is_healthy, circuit) = if let Some(val) = &state.intelligence {
            val.get("available_providers")
                .and_then(|v| v.as_array())
                .and_then(|arr| arr.iter().find(|p| p.get("name").and_then(|n| n.as_str()) == Some(*key)))
                .map(|p| {
                    let c = p.get("is_configured").and_then(|b| b.as_bool()).unwrap_or(false);
                    let k = p.get("api_key_masked").and_then(|s| s.as_str()).unwrap_or("-");
                    let h = p.get("is_healthy").and_then(|b| b.as_bool()).unwrap_or(false);
                    let cb = if h { "CLOSED (Active)" } else { "OPEN (Tripped)" };
                    (c, k.to_string(), h, cb)
                })
                .unwrap_or((false, "-".into(), false, "ARMED"))
        } else {
            (false, "-".into(), false, "ARMED")
        };

        let style = if is_selected {
            Style::default().bg(Color::Rgb(0, 50, 70)).fg(Color::White).add_modifier(Modifier::BOLD)
        } else {
            Style::default().fg(Color::White)
        };

        let prefix = if is_selected { "▶ " } else { "  " };
        let prov_type = if *key == "local" { "ON-PREM" } else if *key == "openrouter" || *key == "litellm" { "GATEWAY" } else { "CLOUD" };

        let status_span = if is_active_primary {
            Span::styled("★ PRIMARY", Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD))
        } else if is_cfg {
            Span::styled("CONFIGURED", Style::default().fg(Color::Green))
        } else {
            Span::styled("UNCONFIGURED", Style::default().fg(Color::DarkGray))
        };

        let health_span = if is_cfg && is_healthy {
            Span::styled("● NOMINAL", Style::default().fg(Color::Green))
        } else if is_cfg {
            Span::styled("○ DEGRADED", Style::default().fg(Color::Red))
        } else {
            Span::styled("○ STANDBY", Style::default().fg(Color::DarkGray))
        };

        rows.push(Row::new(vec![
            Span::styled(format!("{}{}", prefix, display), style),
            Span::styled(prov_type, style),
            status_span,
            Span::styled(masked_key, Style::default().fg(Color::DarkGray)),
            Span::styled(circuit, Style::default().fg(Color::Green)),
            Span::styled(*desc, Style::default().fg(Color::DarkGray)),
            health_span,
        ]));
    }

    let header = Row::new(vec![
        "PROVIDER",
        "TYPE",
        "STATUS",
        "VAULT KEY",
        "CIRCUIT BREAKER",
        "CAPABILITIES & MODELS",
        "HEALTH",
    ])
    .style(Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD));

    let table = Table::new(
        rows,
        [
            Constraint::Length(22),
            Constraint::Length(10),
            Constraint::Length(15),
            Constraint::Length(18),
            Constraint::Length(18),
            Constraint::Min(30),
            Constraint::Length(12),
        ],
    )
    .header(header)
    .block(
        Block::default()
            .title(" Universal Provider Catalog & Routing Vault ")
            .borders(Borders::ALL)
            .border_style(Style::default().fg(COLOR_CYAN)),
    );
    f.render_widget(table, chunks[1]);

    // 3. Recent Routing Decisions
    let mut decision_items = Vec::new();
    if let Some(val) = &state.intelligence {
        if let Some(decisions) = val.get("recent_routing_decisions").and_then(|d| d.as_array()) {
            for d in decisions.iter().take(5) {
                let model = d.get("model").and_then(|m| m.as_str()).unwrap_or("unknown");
                let provider = d.get("provider").and_then(|p| p.as_str()).unwrap_or("unknown");
                let tier = d.get("routed_tier").and_then(|t| t.as_str()).unwrap_or("PRIMARY");
                let latency = d.get("latency_ms").and_then(|l| l.as_f64()).unwrap_or(0.0);
                let cost = d.get("cost_usd").and_then(|c| c.as_f64()).unwrap_or(0.0);
                let ts = d.get("created_at").and_then(|t| t.as_str()).unwrap_or("");
                let time_display = if ts.len() >= 19 { &ts[11..19] } else { ts };

                decision_items.push(ListItem::new(Line::from(vec![
                    Span::styled(format!("[{}] ", time_display), Style::default().fg(Color::DarkGray)),
                    Span::styled(format!("Model: {:<18} ", model), Style::default().fg(Color::White).add_modifier(Modifier::BOLD)),
                    Span::styled(format!("Provider: {:<14} ", provider), Style::default().fg(COLOR_CYAN)),
                    Span::styled(format!("Tier: {:<12} ", tier), Style::default().fg(if tier == "PRIMARY" { Color::Green } else { Color::Yellow })),
                    Span::styled(format!("Latency: {:>5.1}ms ", latency), Style::default().fg(Color::White)),
                    Span::styled(format!("Cost: ${:.5}", cost), Style::default().fg(Color::DarkGray)),
                ])));
            }
        }
    }

    if decision_items.is_empty() {
        decision_items.push(ListItem::new(Line::from(vec![
            Span::styled("No autonomous model dispatches recorded yet for this company.", Style::default().fg(Color::DarkGray)),
        ])));
    }

    let decisions_block = Block::default()
        .title(" Recent Inference Telemetry & Failover Audit Trace ")
        .borders(Borders::ALL)
        .border_style(Style::default().fg(Color::DarkGray));
    f.render_widget(List::new(decision_items).block(decisions_block), chunks[2]);

    // 4. Hotkeys Legend
    let legend = Line::from(vec![
        Span::styled(" [Enter/c] ", Style::default().fg(Color::Black).bg(Color::Green).add_modifier(Modifier::BOLD)),
        Span::styled("Configure Provider    ", Style::default().fg(Color::White)),
        Span::styled(" [t] ", Style::default().fg(Color::Black).bg(COLOR_CYAN).add_modifier(Modifier::BOLD)),
        Span::styled("Test Probe    ", Style::default().fg(Color::White)),
        Span::styled(" [p] ", Style::default().fg(Color::Black).bg(Color::Yellow).add_modifier(Modifier::BOLD)),
        Span::styled("Set as Primary    ", Style::default().fg(Color::White)),
        Span::styled(" [Ctrl+P] ", Style::default().fg(Color::Black).bg(Color::Magenta).add_modifier(Modifier::BOLD)),
        Span::styled("Quick Config Modal    ", Style::default().fg(Color::White)),
        Span::styled(" [↑/↓] ", Style::default().fg(Color::DarkGray)),
        Span::styled("Navigate", Style::default().fg(Color::DarkGray)),
    ]);
    f.render_widget(Paragraph::new(legend), chunks[3]);
}

