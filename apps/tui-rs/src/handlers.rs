use crossterm::event::{KeyCode, KeyEvent, KeyModifiers, MouseButton, MouseEvent, MouseEventKind};

use crate::app::AppState;
use crate::common::{ActiveTab, FocusPane, OnboardingStep};
use crate::features::cockpit::{self, SlashCommand, SLASH_COMMANDS};

/// Handles key events dispatched from the main event loop.
/// Returns `true` if the event loop should exit (e.g. Quit), `false` to continue running.
pub async fn handle_key_event(state: &mut AppState, key: KeyEvent) -> bool {
    if state.is_command_mode {
        match key.code {
            KeyCode::Esc => {
                state.is_command_mode = false;
                state.command_input.clear();
            }
            KeyCode::Enter => {
                let cmd = state.command_input.clone();
                state.is_command_mode = false;
                state.command_input.clear();
                state.execute_command(&cmd);
            }
            KeyCode::Backspace => {
                state.command_input.pop();
            }
            KeyCode::Char(c) => {
                state.command_input.push(c);
            }
            _ => {}
        }
        return false;
    }

    if state.is_entering_directive {
        match key.code {
            KeyCode::Esc => {
                state.is_entering_directive = false;
                state.directive_input.clear();
            }
            KeyCode::Enter => {
                state.submit_directive().await;
            }
            KeyCode::Backspace => {
                state.directive_input.pop();
            }
            KeyCode::Char(c) => {
                state.directive_input.push(c);
            }
            _ => {}
        }
        return false;
    }

    if state.is_filtering {
        match key.code {
            KeyCode::Esc => {
                state.is_filtering = false;
                state.filter_query.clear();
            }
            KeyCode::Enter => {
                state.is_filtering = false;
            }
            KeyCode::Backspace => {
                state.filter_query.pop();
            }
            KeyCode::Char(c) => {
                state.filter_query.push(c);
            }
            _ => {}
        }
        return false;
    }

    if state.is_onboarding {
        match key.code {
            KeyCode::Esc => {
                state.is_onboarding = false;
                state.status_message = "Onboarding Wizard cancelled.".to_string();
                state.logs.push("[SETUP] Onboarding Wizard closed by operator.".into());
            }
            KeyCode::Up | KeyCode::Char('k') => {
                state.onboarding_selection = state.onboarding_selection.saturating_sub(1);
            }
            KeyCode::Down | KeyCode::Char('j') => {
                let max_opts = match state.onboarding_step {
                    OnboardingStep::SelectBlueprint => 2,
                    OnboardingStep::ConfigureProvider => 5,
                    OnboardingStep::SelectProjectMode => 2,
                    OnboardingStep::VerifyFindings => 0,
                };
                if state.onboarding_selection < max_opts {
                    state.onboarding_selection += 1;
                }
            }
            KeyCode::Char('1') => state.onboarding_selection = 0,
            KeyCode::Char('2') => state.onboarding_selection = 1,
            KeyCode::Char('3') => state.onboarding_selection = 2,
            KeyCode::Char('4') => state.onboarding_selection = 3,
            KeyCode::Char('5') => state.onboarding_selection = 4,
            KeyCode::Char('6') => state.onboarding_selection = 5,
            KeyCode::Enter | KeyCode::Char('y') => {
                state.advance_onboarding().await;
            }
            _ => {}
        }
        return false;
    }

    // Global hotkey: Ctrl+C to terminate
    if key.modifiers.contains(KeyModifiers::CONTROL) && (key.code == KeyCode::Char('c') || key.code == KeyCode::Char('C')) {
        return true;
    }

    // Global hotkey: Ctrl+K opens/closes Universal Command Palette Modal
    if key.modifiers.contains(KeyModifiers::CONTROL) && (key.code == KeyCode::Char('k') || key.code == KeyCode::Char('K')) {
        state.palette_open = !state.palette_open;
        state.palette_query.clear();
        state.palette_selection = 0;
        return false;
    }

    // Command Palette Modal Navigation
    if state.palette_open {
        match key.code {
            KeyCode::Esc => {
                state.palette_open = false;
                state.palette_query.clear();
                state.palette_selection = 0;
            }
            KeyCode::Up | KeyCode::Char('k') if key.modifiers.contains(KeyModifiers::CONTROL) || key.code == KeyCode::Up => {
                state.palette_selection = state.palette_selection.saturating_sub(1);
            }
            KeyCode::Down | KeyCode::Char('j') if key.modifiers.contains(KeyModifiers::CONTROL) || key.code == KeyCode::Down => {
                let count = state.get_palette_items().len();
                if count > 0 && state.palette_selection + 1 < count {
                    state.palette_selection += 1;
                }
            }
            KeyCode::Enter => {
                let items = state.get_palette_items();
                if let Some(item) = items.get(state.palette_selection).cloned() {
                    state.execute_palette_action(&item);
                }
            }
            KeyCode::Backspace => {
                state.palette_query.pop();
                state.palette_selection = 0;
            }
            KeyCode::Char(c) => {
                state.palette_query.push(c);
                state.palette_selection = 0;
            }
            _ => {}
        }
        return false;
    }

    // Contextual Help Modal (? or F1)
    if state.help_modal_open {
        if key.code == KeyCode::Esc || key.code == KeyCode::Char('?') || key.code == KeyCode::F(1) {
            state.help_modal_open = false;
        }
        return false;
    }

    // Global hotkey: Ctrl+P opens/closes AI Model & Provider Configuration Modal
    if key.modifiers.contains(KeyModifiers::CONTROL) && (key.code == KeyCode::Char('p') || key.code == KeyCode::Char('P')) {
        state.provider_modal_open = !state.provider_modal_open;
        if state.provider_modal_open {
            state.init_provider_modal();
        }
        return false;
    }

    // Global hotkey: Ctrl+O opens/closes Codebase & Repository Modal
    if key.modifiers.contains(KeyModifiers::CONTROL) && (key.code == KeyCode::Char('o') || key.code == KeyCode::Char('O')) {
        state.codebase_modal_open = !state.codebase_modal_open;
        return false;
    }

    // Approval Confirmation Modal Interaction
    if state.approval_queue_state.confirmation_modal_open {
        if state.approval_queue_state.feedback_input_active {
            match key.code {
                KeyCode::Esc => {
                    state.approval_queue_state.cancel_pending_decision();
                    state.status_message = "Reviewer feedback cancelled.".into();
                }
                KeyCode::Backspace => {
                    state.approval_queue_state.feedback_input.pop();
                }
                KeyCode::Enter => {
                    let notes = state.approval_queue_state.feedback_input.clone();
                    state.confirm_pending_approval(Some(notes)).await;
                }
                KeyCode::Char(c) => {
                    state.approval_queue_state.feedback_input.push(c);
                }
                _ => {}
            }
        } else {
            match key.code {
                KeyCode::Esc | KeyCode::Char('n') | KeyCode::Char('N') => {
                    state.approval_queue_state.cancel_pending_decision();
                    state.status_message = "Consequential action aborted.".into();
                }
                KeyCode::Enter | KeyCode::Char('y') | KeyCode::Char('Y') => {
                    state.confirm_pending_approval(None).await;
                }
                _ => {}
            }
        }
        return false;
    }

    // Company / org switcher
    if state.company_picker_open {
        match key.code {
            KeyCode::Esc => {
                state.company_picker_open = false;
            }
            KeyCode::Up | KeyCode::Char('k') => {
                state.company_picker_selection = state.company_picker_selection.saturating_sub(1);
            }
            KeyCode::Down | KeyCode::Char('j') => {
                if !state.companies.is_empty() {
                    state.company_picker_selection = (state.company_picker_selection + 1).min(state.companies.len() - 1);
                }
            }
            KeyCode::Enter | KeyCode::Char('y') => {
                if let Some(c) = state.companies.get(state.company_picker_selection).cloned() {
                    state.select_company(&c.id);
                    state.sync_backend_state().await;
                }
            }
            _ => {}
        }
        return false;
    }

    // Provider Configuration Modal Interaction
    if state.provider_modal_open {
        match key.code {
            KeyCode::Esc => {
                state.provider_modal_open = false;
            }
            KeyCode::Tab => {
                state.provider_input_field = (state.provider_input_field + 1) % 6;
            }
            KeyCode::BackTab => {
                if state.provider_input_field == 0 {
                    state.provider_input_field = 5;
                } else {
                    state.provider_input_field -= 1;
                }
            }
            KeyCode::Up | KeyCode::Char('k') if state.provider_input_field == 0 => {
                state.provider_modal_idx = state.provider_modal_idx.saturating_sub(1);
                state.refresh_provider_modal_inputs();
            }
            KeyCode::Down | KeyCode::Char('j') if state.provider_input_field == 0 => {
                if state.provider_modal_idx + 1 < cockpit::UNIVERSAL_PROVIDERS.len() {
                    state.provider_modal_idx += 1;
                }
                state.refresh_provider_modal_inputs();
            }
            KeyCode::Char('t') | KeyCode::Char('T') if state.provider_input_field != 1 && state.provider_input_field != 2 => {
                state.test_probe_selected_provider().await;
            }
            KeyCode::Char('s') | KeyCode::Char('S') if state.provider_input_field != 1 && state.provider_input_field != 2 => {
                state.save_and_apply_provider().await;
            }
            KeyCode::Char(' ') => {
                if state.provider_input_field == 3 {
                    state.provider_set_primary = !state.provider_set_primary;
                } else if state.provider_input_field == 4 {
                    state.test_probe_selected_provider().await;
                } else if state.provider_input_field == 5 {
                    state.save_and_apply_provider().await;
                }
            }
            KeyCode::Enter => {
                match state.provider_input_field {
                    0 => state.provider_input_field = 1,
                    1 => state.provider_input_field = 2,
                    2 => state.provider_input_field = 3,
                    3 => state.provider_set_primary = !state.provider_set_primary,
                    4 => state.test_probe_selected_provider().await,
                    5 => state.save_and_apply_provider().await,
                    _ => {}
                }
            }
            KeyCode::Backspace => {
                if state.provider_input_field == 1 {
                    state.provider_input_key.pop();
                } else if state.provider_input_field == 2 {
                    state.provider_input_url.pop();
                }
            }
            KeyCode::Char(c) => {
                if state.provider_input_field == 1 {
                    state.provider_input_key.push(c);
                } else if state.provider_input_field == 2 {
                    state.provider_input_url.push(c);
                }
            }
            _ => {}
        }
        return false;
    }

    // Infrastructure & Runtime Center Interaction
    if state.active_tab == ActiveTab::InfrastructureRuntime && !state.is_onboarding {
        match key.code {
            KeyCode::Up | KeyCode::Char('k') => {
                state.intelligence_provider_selection = state.intelligence_provider_selection.saturating_sub(1);
            }
            KeyCode::Down | KeyCode::Char('j') => {
                if state.intelligence_provider_selection + 1 < cockpit::UNIVERSAL_PROVIDERS.len() {
                    state.intelligence_provider_selection += 1;
                }
            }
            KeyCode::Enter | KeyCode::Char('c') | KeyCode::Char('C') => {
                state.provider_modal_open = true;
                state.provider_modal_idx = state.intelligence_provider_selection;
                state.provider_input_field = 1;
                state.refresh_provider_modal_inputs();
            }
            KeyCode::Char('t') | KeyCode::Char('T') => {
                state.provider_modal_idx = state.intelligence_provider_selection;
                state.test_probe_selected_provider().await;
            }
            KeyCode::Char('p') | KeyCode::Char('P') => {
                state.provider_modal_idx = state.intelligence_provider_selection;
                let presets = ["openai", "anthropic", "google_gemini", "openrouter", "groq", "local", "litellm"];
                let p_name = presets.get(state.provider_modal_idx).unwrap_or(&"openai");
                if !state.active_company_id.is_empty() {
                    state.status_message = format!("Promoting '{}' to primary provider in routing policy...", p_name);
                    match state.client.configure_provider(&state.active_company_id, p_name, None, None).await {
                        Ok(_) => {
                            state.status_message = format!("Provider '{}' promoted to primary routing tier.", p_name);
                            state.logs.push(format!("[ROUTING POLICY] '{}' set as primary.", p_name));
                            state.sync_backend_state().await;
                        }
                        Err(e) => {
                            state.status_message = format!("Failed to promote '{}': {}", p_name, e);
                        }
                    }
                }
            }
            KeyCode::Char('r') | KeyCode::Char('R') | KeyCode::Char('s') | KeyCode::Char('S') => {
                state.sync_backend_state().await;
            }
            KeyCode::Char('1') => { state.active_tab = ActiveTab::CommandCenter; state.selected_index = 0; }
            KeyCode::Char('2') => { state.active_tab = ActiveTab::AgentRoster; state.selected_index = 0; }
            KeyCode::Char('3') => { state.active_tab = ActiveTab::MissionControl; state.selected_index = 0; }
            KeyCode::Char('4') => { state.active_tab = ActiveTab::ExecutiveComms; state.selected_index = 0; }
            KeyCode::Char('5') => { state.active_tab = ActiveTab::EngineeringWorkbench; state.selected_index = 0; }
            KeyCode::Char('6') => { state.active_tab = ActiveTab::GovernanceApprovals; state.selected_index = 0; }
            KeyCode::Char('7') => { state.active_tab = ActiveTab::ResourceExchange; state.selected_index = 0; }
            KeyCode::Char('8') => { state.active_tab = ActiveTab::CompanyMemory; state.selected_index = 0; }
            KeyCode::Char('9') => { state.active_tab = ActiveTab::EvolutionLab; state.selected_index = 0; }
            KeyCode::Char('0') => { state.active_tab = ActiveTab::BusinessGrowth; state.selected_index = 0; }
            KeyCode::Char('-') => { state.active_tab = ActiveTab::SecurityAudit; state.selected_index = 0; }
            KeyCode::Char('=') => { state.active_tab = ActiveTab::InfrastructureRuntime; state.selected_index = 0; }
            KeyCode::Char('\\') => { state.active_tab = ActiveTab::CompanyConfiguration; state.selected_index = 0; }
            KeyCode::Tab => {
                state.layout_focus = state.layout_focus.next(true);
            }
            KeyCode::Char('q') | KeyCode::Esc => {
                state.active_tab = ActiveTab::CommandCenter;
            }
            _ => {}
        }
        return false;
    }

    if state.active_tab == ActiveTab::CommandCenter && !state.is_onboarding {
        if state.codebase_modal_open {
            match key.code {
                KeyCode::Esc => {
                    state.codebase_modal_open = false;
                }
                KeyCode::Char('1') => {
                    state.codebase_selection = 0;
                    state.codebase_input = ".".to_string();
                }
                KeyCode::Char('2') => {
                    state.codebase_selection = 1;
                    state.codebase_input = "..".to_string();
                }
                KeyCode::Char('3') => {
                    state.codebase_selection = 2;
                }
                KeyCode::Up | KeyCode::Char('k') => {
                    state.codebase_selection = state.codebase_selection.saturating_sub(1);
                }
                KeyCode::Down | KeyCode::Char('j') => {
                    if state.codebase_selection < 2 {
                        state.codebase_selection += 1;
                    }
                }
                KeyCode::Backspace => {
                    state.codebase_input.pop();
                }
                KeyCode::Enter | KeyCode::Char('y') => {
                    state.confirm_codebase_modal().await;
                }
                KeyCode::Char(c) => {
                    state.codebase_input.push(c);
                }
                _ => {}
            }
            return false;
        }

        if state.agent_inspector_open {
            if state.is_dispatching_directive {
                match key.code {
                    KeyCode::Enter => {
                        if let Some(agent) = state.selected_agent.clone() {
                            let dir = state.dispatch_directive_input.trim().to_string();
                            if !dir.is_empty() {
                                state.is_dispatching_directive = false;
                                state.agent_inspector_open = false;
                                state.dispatch_direct_agent_directive(&agent, &dir).await;
                            }
                        }
                    }
                    KeyCode::Esc => {
                        state.is_dispatching_directive = false;
                    }
                    KeyCode::Backspace => {
                        state.dispatch_directive_input.pop();
                    }
                    KeyCode::Char(c) => {
                        state.dispatch_directive_input.push(c);
                    }
                    _ => {}
                }
            } else {
                match key.code {
                    KeyCode::Char('d') => {
                        state.is_dispatching_directive = true;
                        state.dispatch_directive_input.clear();
                    }
                    KeyCode::Char('t') => {
                        state.toggle_agent_status().await;
                    }
                    KeyCode::Esc | KeyCode::Char(' ') | KeyCode::Char('q') | KeyCode::Enter => {
                        state.agent_inspector_open = false;
                    }
                    _ => {}
                }
            }
            return false;
        }

        if state.task_inspector_open {
            match key.code {
                KeyCode::Char('x') | KeyCode::Char('X') | KeyCode::Char(' ') => {
                    state.toggle_selected_task().await;
                }
                KeyCode::Char('c') | KeyCode::Char('C') => {
                    state.toggle_selected_subtask().await;
                }
                KeyCode::Char('e') | KeyCode::Char('E') => {
                    state.execute_selected_task().await;
                }
                KeyCode::Up | KeyCode::Char('k') => {
                    state.task_inspector_subtask_selection = state.task_inspector_subtask_selection.saturating_sub(1);
                }
                KeyCode::Down | KeyCode::Char('j') => {
                    state.task_inspector_subtask_selection += 1;
                }
                KeyCode::Esc | KeyCode::Char('q') | KeyCode::Enter => {
                    state.task_inspector_open = false;
                }
                _ => {}
            }
            return false;
        }

        if state.activity_inspector_open {
            match key.code {
                KeyCode::Esc | KeyCode::Char(' ') | KeyCode::Char('q') | KeyCode::Enter => {
                    state.activity_inspector_open = false;
                }
                KeyCode::Char('p') | KeyCode::Char('P') => {
                    state.activity_paused = !state.activity_paused;
                    state.status_message = if state.activity_paused {
                        "Agent Activity feed PAUSED.".into()
                    } else {
                        "Agent Activity feed RESUMED.".into()
                    };
                }
                KeyCode::Char('t') | KeyCode::Char('T') => {
                    if let Some(ev) = state.activity_events.get(state.activity_selection) {
                        if let Some(tid) = &ev.task_id {
                            if let Some(idx) = state.tasks.iter().position(|t| &t.id == tid) {
                                state.task_selection = idx;
                                state.selected_task = state.tasks.get(idx).cloned();
                                state.task_inspector_subtask_selection = 0;
                            }
                            state.focus_pane = FocusPane::Tasks;
                            state.activity_inspector_open = false;
                            state.task_inspector_open = true;
                        }
                    }
                }
                KeyCode::Char('a') | KeyCode::Char('A') => {
                    if let Some(ev) = state.activity_events.get(state.activity_selection) {
                        let target_aid = ev.agent_name.as_deref().or(ev.agent_id.as_deref());
                        if let Some(aid) = target_aid {
                            if let Some(idx) = state.agents.iter().position(|a| a.name == aid || a.id == aid) {
                                state.focus_pane = FocusPane::Swarm;
                                state.swarm_selection = idx;
                                if let Some(agent) = state.agents.get(idx).cloned() {
                                    state.activity_inspector_open = false;
                                    state.open_agent_inspector(agent).await;
                                    return false;
                                }
                            }
                            state.focus_pane = FocusPane::Swarm;
                            state.activity_inspector_open = false;
                        }
                    }
                }
                _ => {}
            }
            return false;
        }

        if state.is_nav_mode {
            match key.code {
                KeyCode::Tab => {
                    state.focus_pane = match state.focus_pane {
                        FocusPane::Chat => FocusPane::Swarm,
                        FocusPane::Swarm => FocusPane::Tasks,
                        FocusPane::Tasks => FocusPane::Graph,
                        FocusPane::Graph => FocusPane::Activity,
                        FocusPane::Activity => FocusPane::Telemetry,
                        FocusPane::Telemetry => FocusPane::Engineering,
                        FocusPane::Engineering => FocusPane::Approvals,
                        FocusPane::Approvals => FocusPane::ResourceTelemetry,
                        FocusPane::ResourceTelemetry => FocusPane::QaRelease,
                        FocusPane::QaRelease => FocusPane::DecisionTrace,
                        FocusPane::DecisionTrace => FocusPane::CompanyMemory,
                        FocusPane::CompanyMemory => FocusPane::Chat,
                    };
                }
                KeyCode::BackTab => {
                    state.focus_pane = match state.focus_pane {
                        FocusPane::Chat => FocusPane::CompanyMemory,
                        FocusPane::CompanyMemory => FocusPane::DecisionTrace,
                        FocusPane::DecisionTrace => FocusPane::QaRelease,
                        FocusPane::QaRelease => FocusPane::ResourceTelemetry,
                        FocusPane::ResourceTelemetry => FocusPane::Approvals,
                        FocusPane::Approvals => FocusPane::Engineering,
                        FocusPane::Engineering => FocusPane::Telemetry,
                        FocusPane::Telemetry => FocusPane::Activity,
                        FocusPane::Activity => FocusPane::Graph,
                        FocusPane::Graph => FocusPane::Tasks,
                        FocusPane::Tasks => FocusPane::Swarm,
                        FocusPane::Swarm => FocusPane::Chat,
                    };
                }
                KeyCode::Char('i') => {
                    state.is_nav_mode = false;
                }
                KeyCode::Char('z') => {
                    state.zoomed_pane = if state.zoomed_pane.is_some() { None } else { Some(state.focus_pane) };
                }
                KeyCode::Char('x') | KeyCode::Char('X') => {
                    if state.focus_pane == FocusPane::Tasks {
                        state.toggle_selected_task().await;
                    } else {
                        // Reset to original default 3-column cockpit layout
                        state.zoomed_pane = None;
                        state.focus_pane = FocusPane::Chat;
                        state.layout_config = crate::common::CockpitLayoutConfig::default();
                        state.save_layout_config();
                        state.status_message = "Layout reset to default 3-column command cockpit.".into();
                    }
                }
                KeyCode::Char('d') | KeyCode::Char('D') => {
                    let next_dock = state.layout_config.cycle_docked();
                    state.save_layout_config();
                    state.status_message = format!("Docked pane switched to: {:?}", next_dock);
                }
                KeyCode::Char('<') => {
                    if state.layout_config.left_pct > 12 {
                        state.layout_config.left_pct -= 2;
                        state.layout_config.sanitize();
                        state.save_layout_config();
                        state.status_message = format!(
                            "Left column resized: {}% (Center: {}%)",
                            state.layout_config.left_pct, state.layout_config.center_pct
                        );
                    }
                }
                KeyCode::Char('>') => {
                    if state.layout_config.left_pct < 45 {
                        state.layout_config.left_pct += 2;
                        state.layout_config.sanitize();
                        state.save_layout_config();
                        state.status_message = format!(
                            "Left column resized: {}% (Center: {}%)",
                            state.layout_config.left_pct, state.layout_config.center_pct
                        );
                    }
                }
                KeyCode::Char('{') => {
                    if state.layout_config.right_pct > 12 {
                        state.layout_config.right_pct -= 2;
                        state.layout_config.sanitize();
                        state.save_layout_config();
                        state.status_message = format!(
                            "Right column resized: {}% (Center: {}%)",
                            state.layout_config.right_pct, state.layout_config.center_pct
                        );
                    }
                }
                KeyCode::Char('}') => {
                    if state.layout_config.right_pct < 45 {
                        state.layout_config.right_pct += 2;
                        state.layout_config.sanitize();
                        state.save_layout_config();
                        state.status_message = format!(
                            "Right column resized: {}% (Center: {}%)",
                            state.layout_config.right_pct, state.layout_config.center_pct
                        );
                    }
                }
                KeyCode::Char('y') => {
                    state.handle_approval_cmd("", true).await;
                }
                KeyCode::Char('n') => {
                    state.handle_approval_cmd("", false).await;
                }
                KeyCode::Char('r') | KeyCode::Char('R') => {
                    if state.focus_pane == FocusPane::Engineering {
                        state.refresh_engineering_state().await;
                        state.status_message = "Engineering execution state & repository refreshed.".into();
                    } else if state.focus_pane == FocusPane::Graph {
                        state.rebuild_mission_graph();
                        state.status_message = "Mission & dependency graph topology refreshed.".into();
                    } else if state.focus_pane == FocusPane::ResourceTelemetry {
                        state.resource_telemetry_state.sample_local_host();
                        if let Some(res) = &state.resources {
                            state.resource_telemetry_state.update_from_backend(res);
                        }
                        state.status_message = "Host and model provider telemetry refreshed.".into();
                    } else if state.focus_pane == FocusPane::QaRelease {
                        state.qa_release_state = crate::features::delivery::QaReleaseState::new();
                        state.status_message = "QA & release pipeline gates refreshed.".into();
                    } else if state.focus_pane == FocusPane::DecisionTrace {
                        state.decision_trace_state = crate::features::decisions::DecisionTraceState::new();
                        state.status_message = "Decision & audit trace records refreshed.".into();
                    } else if state.focus_pane == FocusPane::CompanyMemory {
                        state.company_memory_state = crate::features::memory::CompanyMemoryState::new();
                        state.status_message = "Company memory & intelligence records refreshed.".into();
                    }
                }
                KeyCode::PageUp | KeyCode::Char('[') => {
                    if state.focus_pane == FocusPane::Engineering {
                        state.engineering_state.diff_scroll = state.engineering_state.diff_scroll.saturating_sub(6);
                    } else {
                        state.layout_config.left_collapsed = !state.layout_config.left_collapsed;
                        state.save_layout_config();
                        state.status_message = if state.layout_config.left_collapsed {
                            "Left column collapsed (Press [ to restore).".into()
                        } else {
                            "Left column restored.".into()
                        };
                    }
                }
                KeyCode::PageDown | KeyCode::Char(']') => {
                    if state.focus_pane == FocusPane::Engineering {
                        state.engineering_state.diff_scroll = state.engineering_state.diff_scroll.saturating_add(6);
                    } else {
                        state.layout_config.right_collapsed = !state.layout_config.right_collapsed;
                        state.save_layout_config();
                        state.status_message = if state.layout_config.right_collapsed {
                            "Right column collapsed (Press ] to restore).".into()
                        } else {
                            "Right column restored.".into()
                        };
                    }
                }
                KeyCode::Char('s') | KeyCode::Char('S') => {
                    if state.focus_pane == FocusPane::Engineering {
                        state.engineering_state.active_section = state.engineering_state.active_section.next();
                    } else if state.focus_pane == FocusPane::Graph {
                        state.mission_graph_state.filter_status = match state.mission_graph_state.filter_status {
                            None => Some(crate::features::mission_graph::GraphNodeStatus::Ready),
                            Some(crate::features::mission_graph::GraphNodeStatus::Ready) => Some(crate::features::mission_graph::GraphNodeStatus::InProgress),
                            Some(crate::features::mission_graph::GraphNodeStatus::InProgress) => Some(crate::features::mission_graph::GraphNodeStatus::Waiting),
                            Some(crate::features::mission_graph::GraphNodeStatus::Waiting) => Some(crate::features::mission_graph::GraphNodeStatus::Blocked),
                            Some(crate::features::mission_graph::GraphNodeStatus::Blocked) => Some(crate::features::mission_graph::GraphNodeStatus::Failed),
                            Some(crate::features::mission_graph::GraphNodeStatus::Failed) => Some(crate::features::mission_graph::GraphNodeStatus::Done),
                            _ => None,
                        };
                        state.status_message = format!("Graph status filter: {}", state.mission_graph_state.filter_status.map(|s| s.as_str()).unwrap_or("ALL"));
                        state.mission_graph_state.selected_idx = 0;
                    } else if state.focus_pane == FocusPane::Approvals {
                        state.approval_queue_state.filter_status = match state.approval_queue_state.filter_status {
                            None => Some(crate::features::approvals::ApprovalStatusEnum::Pending),
                            Some(crate::features::approvals::ApprovalStatusEnum::Pending) => Some(crate::features::approvals::ApprovalStatusEnum::Approved),
                            Some(crate::features::approvals::ApprovalStatusEnum::Approved) => Some(crate::features::approvals::ApprovalStatusEnum::Rejected),
                            Some(crate::features::approvals::ApprovalStatusEnum::Rejected) => Some(crate::features::approvals::ApprovalStatusEnum::ChangesRequested),
                            Some(crate::features::approvals::ApprovalStatusEnum::ChangesRequested) => Some(crate::features::approvals::ApprovalStatusEnum::Expired),
                            _ => None,
                        };
                        state.status_message = format!("Approval queue status filter: {}", state.approval_queue_state.filter_status.map(|s| s.as_str()).unwrap_or("ALL"));
                        state.approval_queue_state.selected_index = 0;
                    }
                }
                KeyCode::Char('p') | KeyCode::Char('P') => {
                    if state.focus_pane == FocusPane::Activity {
                        state.activity_paused = !state.activity_paused;
                        state.status_message = if state.activity_paused {
                            "Agent Activity feed PAUSED.".into()
                        } else {
                            "Agent Activity feed RESUMED.".into()
                        };
                    } else if state.focus_pane == FocusPane::Graph {
                        let project_names: Vec<String> = state.projects.iter().map(|p| p.name.clone()).collect();
                        if project_names.is_empty() {
                            state.status_message = "No projects to filter by.".into();
                        } else {
                            let next_p = match &state.mission_graph_state.filter_project {
                                None => Some(project_names[0].clone()),
                                Some(curr) => {
                                    if let Some(pos) = project_names.iter().position(|p| p == curr) {
                                        if pos + 1 < project_names.len() {
                                            Some(project_names[pos + 1].clone())
                                        } else {
                                            None
                                        }
                                    } else {
                                        None
                                    }
                                }
                            };
                            state.status_message = format!("Graph project filter: {}", next_p.as_deref().unwrap_or("ALL"));
                            state.mission_graph_state.filter_project = next_p;
                            state.mission_graph_state.selected_idx = 0;
                        }
                    }
                }
                KeyCode::Char('t') | KeyCode::Char('T') => {
                    if state.focus_pane == FocusPane::Activity {
                        if let Some(ev) = state.activity_events.get(state.activity_selection) {
                            if let Some(tid) = &ev.task_id {
                                if let Some(idx) = state.tasks.iter().position(|t| &t.id == tid) {
                                    state.task_selection = idx;
                                    state.selected_task = state.tasks.get(idx).cloned();
                                    state.task_inspector_subtask_selection = 0;
                                }
                                state.focus_pane = FocusPane::Tasks;
                                state.task_inspector_open = true;
                            }
                        }
                    } else if state.focus_pane == FocusPane::Engineering {
                        let target_task_id = state.engineering_state.test_report.as_ref()
                            .and_then(|rep| rep.failure_diagnostics.first())
                            .and_then(|diag| diag.related_task_id.clone())
                            .or_else(|| state.engineering_state.current_task_id.clone());
                        if let Some(tid) = target_task_id {
                            if let Some(idx) = state.tasks.iter().position(|t| t.id == tid) {
                                state.task_selection = idx;
                                state.selected_task = state.tasks.get(idx).cloned();
                                state.task_inspector_subtask_selection = 0;
                            }
                            state.focus_pane = FocusPane::Tasks;
                            state.task_inspector_open = true;
                            state.status_message = format!("Navigated to linked engineering task {}.", tid);
                        }
                    }
                }
                KeyCode::Char('a') | KeyCode::Char('A') => {
                    if state.focus_pane == FocusPane::Activity {
                        if let Some(ev) = state.activity_events.get(state.activity_selection) {
                            let target_aid = ev.agent_name.as_deref().or(ev.agent_id.as_deref());
                            if let Some(aid) = target_aid {
                                if let Some(idx) = state.agents.iter().position(|a| a.name == aid || a.id == aid) {
                                    state.focus_pane = FocusPane::Swarm;
                                    state.swarm_selection = idx;
                                    if let Some(agent) = state.agents.get(idx).cloned() {
                                        state.open_agent_inspector(agent).await;
                                        return false;
                                    }
                                }
                                state.focus_pane = FocusPane::Swarm;
                            }
                        }
                    } else if state.focus_pane == FocusPane::Graph {
                        if let Some(node) = state.mission_graph_state.selected_node() {
                            let agent_name = node.assigned_agent.clone();
                            if let Some(idx) = state.agents.iter().position(|a| a.name == agent_name) {
                                state.focus_pane = FocusPane::Swarm;
                                state.swarm_selection = idx;
                                if let Some(agent) = state.agents.get(idx).cloned() {
                                    state.open_agent_inspector(agent).await;
                                    return false;
                                }
                            }
                            state.focus_pane = FocusPane::Swarm;
                        }
                    } else if state.focus_pane == FocusPane::Approvals {
                        state.request_approval_decision(crate::features::approvals::ApprovalStatusEnum::Approved).await;
                    }
                }
                KeyCode::Char('c') | KeyCode::Char('C') => {
                    if state.focus_pane == FocusPane::Approvals {
                        state.approval_queue_state.filter_category = match state.approval_queue_state.filter_category {
                            None => Some(crate::features::approvals::ApprovalCategory::ProductionRelease),
                            Some(crate::features::approvals::ApprovalCategory::ProductionRelease) => Some(crate::features::approvals::ApprovalCategory::DestructiveOperation),
                            Some(crate::features::approvals::ApprovalCategory::DestructiveOperation) => Some(crate::features::approvals::ApprovalCategory::DatabaseMigration),
                            Some(crate::features::approvals::ApprovalCategory::DatabaseMigration) => Some(crate::features::approvals::ApprovalCategory::ExternalCommitment),
                            Some(crate::features::approvals::ApprovalCategory::ExternalCommitment) => Some(crate::features::approvals::ApprovalCategory::SecurityPolicyChange),
                            Some(crate::features::approvals::ApprovalCategory::SecurityPolicyChange) => Some(crate::features::approvals::ApprovalCategory::ResourceBudgetIncrease),
                            Some(crate::features::approvals::ApprovalCategory::ResourceBudgetIncrease) => Some(crate::features::approvals::ApprovalCategory::SensitiveData),
                            _ => None,
                        };
                        state.status_message = format!("Approval category filter: {}", state.approval_queue_state.filter_category.map(|c| c.label()).unwrap_or("ALL"));
                        state.approval_queue_state.selected_index = 0;
                    } else if state.focus_pane == FocusPane::CompanyMemory {
                        state.company_memory_state.filter_category = match state.company_memory_state.filter_category {
                            None => Some(crate::features::memory::KnowledgeCategory::TechnicalDoc),
                            Some(crate::features::memory::KnowledgeCategory::TechnicalDoc) => Some(crate::features::memory::KnowledgeCategory::AgentSkill),
                            Some(crate::features::memory::KnowledgeCategory::AgentSkill) => Some(crate::features::memory::KnowledgeCategory::ResolvedIncident),
                            Some(crate::features::memory::KnowledgeCategory::ResolvedIncident) => Some(crate::features::memory::KnowledgeCategory::ResearchFinding),
                            Some(crate::features::memory::KnowledgeCategory::ResearchFinding) => Some(crate::features::memory::KnowledgeCategory::ProjectLesson),
                            _ => None,
                        };
                        state.status_message = format!("Memory category filter: {}", state.company_memory_state.filter_category.map(|c| c.label()).unwrap_or("ALL"));
                        state.company_memory_state.selected_idx = 0;
                    }
                }
                KeyCode::Char('e') | KeyCode::Char('E') => {
                    if state.focus_pane == FocusPane::Graph {
                        state.focus_pane = FocusPane::Engineering;
                        state.status_message = "Navigated to Engineering Execution pane.".into();
                    } else if state.focus_pane == FocusPane::DecisionTrace {
                        state.decision_trace_state.filter_epistemic = match state.decision_trace_state.filter_epistemic {
                            None => Some(crate::features::decisions::EpistemicType::ObservedFact),
                            Some(crate::features::decisions::EpistemicType::ObservedFact) => Some(crate::features::decisions::EpistemicType::ModelExplanation),
                            Some(crate::features::decisions::EpistemicType::ModelExplanation) => Some(crate::features::decisions::EpistemicType::ProposedAction),
                            Some(crate::features::decisions::EpistemicType::ProposedAction) => Some(crate::features::decisions::EpistemicType::CompletedAction),
                            _ => None,
                        };
                        state.status_message = format!("Decision epistemic filter: {}", state.decision_trace_state.filter_epistemic.map(|e| e.as_str()).unwrap_or("ALL"));
                        state.decision_trace_state.selected_idx = 0;
                    }
                }
                KeyCode::Char(' ') => {
                    if state.focus_pane == FocusPane::Tasks {
                        state.toggle_selected_task().await;
                    } else {
                        match state.focus_pane {
                            FocusPane::Swarm => {
                                if let Some(agent) = state.agents.get(state.swarm_selection).cloned() {
                                    state.open_agent_inspector(agent).await;
                                }
                            }
                            FocusPane::Activity => {
                                if !state.activity_events.is_empty() {
                                    state.activity_inspector_open = true;
                                }
                            }
                            FocusPane::Graph => {
                                if let Some(node) = state.mission_graph_state.selected_node() {
                                    let node_id = node.id.clone();
                                    if let Some(pos) = state.tasks.iter().position(|t| t.id == node_id) {
                                        state.task_selection = pos;
                                        state.selected_task = state.tasks.get(pos).cloned();
                                        state.task_inspector_subtask_selection = 0;
                                        state.task_inspector_open = true;
                                    } else {
                                        state.zoomed_pane = if state.zoomed_pane == Some(FocusPane::Graph) { None } else { Some(FocusPane::Graph) };
                                    }
                                } else {
                                    state.zoomed_pane = if state.zoomed_pane == Some(FocusPane::Graph) { None } else { Some(FocusPane::Graph) };
                                }
                            }
                            FocusPane::Engineering => {
                                state.zoomed_pane = if state.zoomed_pane == Some(FocusPane::Engineering) { None } else { Some(FocusPane::Engineering) };
                            }
                            FocusPane::Approvals => {
                                state.zoomed_pane = if state.zoomed_pane == Some(FocusPane::Approvals) { None } else { Some(FocusPane::Approvals) };
                            }
                            FocusPane::ResourceTelemetry => {
                                state.zoomed_pane = if state.zoomed_pane == Some(FocusPane::ResourceTelemetry) { None } else { Some(FocusPane::ResourceTelemetry) };
                            }
                            FocusPane::QaRelease => {
                                state.zoomed_pane = if state.zoomed_pane == Some(FocusPane::QaRelease) { None } else { Some(FocusPane::QaRelease) };
                            }
                            FocusPane::DecisionTrace => {
                                state.zoomed_pane = if state.zoomed_pane == Some(FocusPane::DecisionTrace) { None } else { Some(FocusPane::DecisionTrace) };
                            }
                            FocusPane::CompanyMemory => {
                                state.zoomed_pane = if state.zoomed_pane == Some(FocusPane::CompanyMemory) { None } else { Some(FocusPane::CompanyMemory) };
                            }
                            _ => {}
                        }
                    }
                }
                KeyCode::Enter => {
                    match state.focus_pane {
                        FocusPane::Swarm => {
                            if let Some(agent) = state.agents.get(state.swarm_selection).cloned() {
                                state.open_agent_inspector(agent).await;
                            }
                        }
                        FocusPane::Tasks => {
                            if !state.tasks.is_empty() {
                                state.selected_task = state.tasks.get(state.task_selection).cloned();
                                state.task_inspector_subtask_selection = 0;
                                state.task_inspector_open = true;
                            }
                        }
                        FocusPane::Graph => {
                            if let Some(node) = state.mission_graph_state.selected_node() {
                                let node_id = node.id.clone();
                                if let Some(pos) = state.tasks.iter().position(|t| t.id == node_id) {
                                    state.task_selection = pos;
                                    state.selected_task = state.tasks.get(pos).cloned();
                                    state.task_inspector_subtask_selection = 0;
                                    state.task_inspector_open = true;
                                } else {
                                    state.zoomed_pane = if state.zoomed_pane == Some(FocusPane::Graph) { None } else { Some(FocusPane::Graph) };
                                }
                            } else {
                                state.zoomed_pane = if state.zoomed_pane == Some(FocusPane::Graph) { None } else { Some(FocusPane::Graph) };
                            }
                        }
                        FocusPane::Activity => {
                            if !state.activity_events.is_empty() {
                                state.activity_inspector_open = true;
                            }
                        }
                        FocusPane::Engineering => {
                            state.zoomed_pane = if state.zoomed_pane == Some(FocusPane::Engineering) { None } else { Some(FocusPane::Engineering) };
                        }
                        FocusPane::Chat => {
                            state.is_nav_mode = false;
                        }
                        FocusPane::Approvals => {
                            state.zoomed_pane = if state.zoomed_pane == Some(FocusPane::Approvals) { None } else { Some(FocusPane::Approvals) };
                        }
                        FocusPane::ResourceTelemetry => {
                            state.zoomed_pane = if state.zoomed_pane == Some(FocusPane::ResourceTelemetry) { None } else { Some(FocusPane::ResourceTelemetry) };
                        }
                        FocusPane::QaRelease => {
                            state.zoomed_pane = if state.zoomed_pane == Some(FocusPane::QaRelease) { None } else { Some(FocusPane::QaRelease) };
                        }
                        FocusPane::DecisionTrace => {
                            state.zoomed_pane = if state.zoomed_pane == Some(FocusPane::DecisionTrace) { None } else { Some(FocusPane::DecisionTrace) };
                        }
                        FocusPane::CompanyMemory => {
                            state.zoomed_pane = if state.zoomed_pane == Some(FocusPane::CompanyMemory) { None } else { Some(FocusPane::CompanyMemory) };
                        }
                        FocusPane::Telemetry => {}
                    }
                }
                KeyCode::Up | KeyCode::Char('k') => {
                    match state.focus_pane {
                        FocusPane::Approvals => {
                            state.approval_queue_state.selected_index = state.approval_queue_state.selected_index.saturating_sub(1);
                        }
                        FocusPane::QaRelease => {
                            state.qa_release_state.selected_gate_idx = state.qa_release_state.selected_gate_idx.saturating_sub(1);
                        }
                        FocusPane::ResourceTelemetry => {
                            state.resource_telemetry_state.selected_row = state.resource_telemetry_state.selected_row.saturating_sub(1);
                        }
                        FocusPane::DecisionTrace => {
                            state.decision_trace_state.selected_idx = state.decision_trace_state.selected_idx.saturating_sub(1);
                        }
                        FocusPane::CompanyMemory => {
                            state.company_memory_state.selected_idx = state.company_memory_state.selected_idx.saturating_sub(1);
                        }
                        FocusPane::Swarm => state.swarm_selection = state.swarm_selection.saturating_sub(1),
                        FocusPane::Tasks => state.task_selection = state.task_selection.saturating_sub(1),
                        FocusPane::Graph => {
                            state.mission_graph_state.selected_idx = state.mission_graph_state.selected_idx.saturating_sub(1);
                        }
                        FocusPane::Activity => state.activity_selection = state.activity_selection.saturating_sub(1),
                        FocusPane::Engineering => {
                            state.engineering_state.selected_file_idx = state.engineering_state.selected_file_idx.saturating_sub(1);
                            state.refresh_selected_file_diff().await;
                        }
                        FocusPane::Telemetry => state.log_selection = state.log_selection.saturating_sub(1),
                        FocusPane::Chat => state.chat_scroll = state.chat_scroll.saturating_add(1),
                    }
                }
                KeyCode::Down | KeyCode::Char('j') => {
                    match state.focus_pane {
                        FocusPane::Swarm => {
                            if !state.agents.is_empty() {
                                state.swarm_selection = (state.swarm_selection + 1).min(state.agents.len().saturating_sub(1));
                            }
                        }
                        FocusPane::Tasks => {
                            if !state.tasks.is_empty() {
                                state.task_selection = (state.task_selection + 1).min(state.tasks.len().saturating_sub(1));
                            }
                        }
                        FocusPane::Graph => {
                            let count = state.mission_graph_state.filtered_indices().len();
                            if count > 0 {
                                state.mission_graph_state.selected_idx = (state.mission_graph_state.selected_idx + 1).min(count - 1);
                            }
                        }
                        FocusPane::Approvals => {
                            let count = state.approval_queue_state.filtered_indices().len();
                            if count > 0 {
                                state.approval_queue_state.selected_index = (state.approval_queue_state.selected_index + 1).min(count - 1);
                            }
                        }
                        FocusPane::QaRelease => {
                            let count = state.qa_release_state.current_run().map(|r| r.gates.len()).unwrap_or(0);
                            if count > 0 {
                                state.qa_release_state.selected_gate_idx = (state.qa_release_state.selected_gate_idx + 1).min(count - 1);
                            }
                        }
                        FocusPane::ResourceTelemetry => {
                            let count = state.resource_telemetry_state.attributions.len();
                            if count > 0 {
                                state.resource_telemetry_state.selected_row = (state.resource_telemetry_state.selected_row + 1).min(count - 1);
                            }
                        }
                        FocusPane::DecisionTrace => {
                            let count = state.decision_trace_state.filtered_indices().len();
                            if count > 0 {
                                state.decision_trace_state.selected_idx = (state.decision_trace_state.selected_idx + 1).min(count - 1);
                            }
                        }
                        FocusPane::CompanyMemory => {
                            let count = state.company_memory_state.filtered_indices().len();
                            if count > 0 {
                                state.company_memory_state.selected_idx = (state.company_memory_state.selected_idx + 1).min(count - 1);
                            }
                        }
                        FocusPane::Activity => {
                            if !state.activity_events.is_empty() {
                                state.activity_selection = (state.activity_selection + 1).min(state.activity_events.len().saturating_sub(1));
                            }
                        }
                        FocusPane::Engineering => {
                            if !state.engineering_state.files_changed.is_empty() {
                                state.engineering_state.selected_file_idx = (state.engineering_state.selected_file_idx + 1).min(state.engineering_state.files_changed.len().saturating_sub(1));
                                state.refresh_selected_file_diff().await;
                            }
                        }
                        FocusPane::Telemetry => {
                            if !state.logs.is_empty() {
                                state.log_selection = (state.log_selection + 1).min(state.logs.len().saturating_sub(1));
                            }
                        }
                        FocusPane::Chat => {
                            state.chat_scroll = state.chat_scroll.saturating_sub(1);
                        }
                    }
                }
                KeyCode::Char('1') => { state.active_tab = ActiveTab::CommandCenter; }
                KeyCode::Char('2') => { state.active_tab = ActiveTab::AgentRoster; }
                KeyCode::Char('3') => { state.active_tab = ActiveTab::MissionControl; }
                KeyCode::Char('4') => { state.active_tab = ActiveTab::ExecutiveComms; }
                KeyCode::Char('5') => { state.active_tab = ActiveTab::EngineeringWorkbench; }
                KeyCode::Char('6') => { state.active_tab = ActiveTab::GovernanceApprovals; }
                KeyCode::Char('7') => { state.active_tab = ActiveTab::ResourceExchange; }
                KeyCode::Char('8') => { state.active_tab = ActiveTab::CompanyMemory; }
                KeyCode::Char('9') => { state.active_tab = ActiveTab::EvolutionLab; }
                KeyCode::Char('0') => { state.active_tab = ActiveTab::BusinessGrowth; }
                KeyCode::Char('-') => { state.active_tab = ActiveTab::SecurityAudit; }
                KeyCode::Char('=') => { state.active_tab = ActiveTab::InfrastructureRuntime; }
                KeyCode::Char('\\') => { state.active_tab = ActiveTab::CompanyConfiguration; }
                KeyCode::Char('o') => {
                    state.company_picker_open = true;
                    state.company_picker_selection = state
                        .companies
                        .iter()
                        .position(|c| c.id == state.active_company_id)
                        .unwrap_or(0);
                }
                KeyCode::Char('?') | KeyCode::F(1) => {
                    state.help_modal_open = true;
                }
                KeyCode::Esc | KeyCode::Char('q') => {
                    state.is_nav_mode = false;
                }
                _ => {}
            }
            return false;
        }

        // Prompt Mode (Active only when menu is open or chat input is non-empty)
        if state.agent_menu_open || state.slash_menu_open || !state.chat_input.is_empty() {
            match key.code {
                KeyCode::Esc => {
                    state.chat_input.clear();
                    state.slash_menu_open = false;
                    state.agent_menu_open = false;
                    state.is_nav_mode = true;
                }
                KeyCode::Char('c') if key.modifiers.contains(KeyModifiers::CONTROL) => {
                    return true;
                }
                KeyCode::Char('o') if key.modifiers.contains(KeyModifiers::CONTROL) => {
                    state.codebase_modal_open = true;
                }
                KeyCode::Enter => {
                    if state.agent_menu_open {
                        let filter_txt = state.chat_input.trim_start_matches('@').to_lowercase();
                        let matches: Vec<&crate::client::AgentPayload> = state.agents
                            .iter()
                            .filter(|a| {
                                a.name.to_lowercase().starts_with(&filter_txt)
                                    || a.role_title.as_deref().unwrap_or("").to_lowercase().contains(&filter_txt)
                                    || filter_txt.is_empty()
                            })
                            .collect();
                        if let Some(agent) = matches.get(state.agent_menu_selection) {
                            state.chat_input = format!("@{} ", agent.name);
                            state.agent_menu_open = false;
                        } else {
                            state.send_chat_message().await;
                        }
                    } else if state.slash_menu_open {
                        let filter_txt = state.chat_input.trim_start_matches('/').to_lowercase();
                        let matches: Vec<&SlashCommand> = SLASH_COMMANDS
                            .iter()
                            .filter(|c| c.name.starts_with(&filter_txt) || filter_txt.is_empty())
                            .collect();
                        if let Some(cmd) = matches.get(state.slash_menu_selection) {
                            state.chat_input = format!("/{} ", cmd.name);
                            state.slash_menu_open = false;
                        } else {
                            state.send_chat_message().await;
                        }
                    } else {
                        state.send_chat_message().await;
                    }
                }
                KeyCode::Tab => {
                    if state.agent_menu_open {
                        let filter_txt = state.chat_input.trim_start_matches('@').to_lowercase();
                        let matches: Vec<&crate::client::AgentPayload> = state.agents
                            .iter()
                            .filter(|a| {
                                a.name.to_lowercase().starts_with(&filter_txt)
                                    || a.role_title.as_deref().unwrap_or("").to_lowercase().contains(&filter_txt)
                                    || filter_txt.is_empty()
                            })
                            .collect();
                        if let Some(agent) = matches.get(state.agent_menu_selection) {
                            state.chat_input = format!("@{} ", agent.name);
                            state.agent_menu_open = false;
                        }
                    } else if state.slash_menu_open {
                        let filter_txt = state.chat_input.trim_start_matches('/').to_lowercase();
                        let matches: Vec<&SlashCommand> = SLASH_COMMANDS
                            .iter()
                            .filter(|c| c.name.starts_with(&filter_txt) || filter_txt.is_empty())
                            .collect();
                        if let Some(cmd) = matches.get(state.slash_menu_selection) {
                            state.chat_input = format!("/{} ", cmd.name);
                            state.slash_menu_open = false;
                        }
                    } else {
                        state.is_nav_mode = true;
                    }
                }
                KeyCode::Backspace => {
                    state.chat_input.pop();
                    if !state.chat_input.starts_with('/') {
                        state.slash_menu_open = false;
                    }
                    if !state.chat_input.starts_with('@') {
                        state.agent_menu_open = false;
                    }
                }
                KeyCode::Up => {
                    if state.agent_menu_open {
                        state.agent_menu_selection = state.agent_menu_selection.saturating_sub(1);
                    } else if state.slash_menu_open {
                        state.slash_menu_selection = state.slash_menu_selection.saturating_sub(1);
                    } else {
                        state.chat_scroll = state.chat_scroll.saturating_add(1);
                    }
                }
                KeyCode::Down => {
                    if state.agent_menu_open {
                        state.agent_menu_selection = (state.agent_menu_selection + 1).min(state.agents.len().saturating_sub(1));
                    } else if state.slash_menu_open {
                        state.slash_menu_selection = (state.slash_menu_selection + 1).min(SLASH_COMMANDS.len().saturating_sub(1));
                    } else {
                        state.chat_scroll = state.chat_scroll.saturating_sub(1);
                    }
                }
                KeyCode::Char(c) => {
                    state.chat_input.push(c);
                }
                _ => {}
            }
            return false;
        }
    }

    match key.code {
        KeyCode::Char('q') | KeyCode::Esc => true,
        KeyCode::Char('S') => {
            state.start_onboarding();
            false
        }
        KeyCode::Char('+') => {
            state.is_command_mode = true;
            state.command_input = "task create ".to_string();
            false
        }
        KeyCode::Char(':') => {
            state.is_command_mode = true;
            state.command_input.clear();
            false
        }
        KeyCode::Char('1') => { state.active_tab = ActiveTab::CommandCenter; state.selected_index = 0; false }
        KeyCode::Char('2') => { state.active_tab = ActiveTab::AgentRoster; state.selected_index = 0; false }
        KeyCode::Char('3') => { state.active_tab = ActiveTab::MissionControl; state.selected_index = 0; false }
        KeyCode::Char('4') => { state.active_tab = ActiveTab::ExecutiveComms; state.selected_index = 0; false }
        KeyCode::Char('5') => { state.active_tab = ActiveTab::EngineeringWorkbench; state.selected_index = 0; false }
        KeyCode::Char('6') => { state.active_tab = ActiveTab::GovernanceApprovals; state.selected_index = 0; false }
        KeyCode::Char('7') => { state.active_tab = ActiveTab::ResourceExchange; state.selected_index = 0; false }
        KeyCode::Char('8') => { state.active_tab = ActiveTab::CompanyMemory; state.selected_index = 0; false }
        KeyCode::Char('9') => { state.active_tab = ActiveTab::EvolutionLab; state.selected_index = 0; false }
        KeyCode::Char('0') => { state.active_tab = ActiveTab::BusinessGrowth; state.selected_index = 0; false }
        KeyCode::Char('-') => { state.active_tab = ActiveTab::SecurityAudit; state.selected_index = 0; false }
        KeyCode::Char('=') => { state.active_tab = ActiveTab::InfrastructureRuntime; state.selected_index = 0; false }
        KeyCode::Char('\\') => { state.active_tab = ActiveTab::CompanyConfiguration; state.selected_index = 0; false }
        KeyCode::Tab => {
            state.layout_focus = state.layout_focus.next(true);
            false
        }
        KeyCode::BackTab => {
            state.layout_focus = state.layout_focus.prev(true);
            false
        }
        KeyCode::Down | KeyCode::Char('j') => {
            state.selected_index = state.selected_index.saturating_add(1);
            false
        }
        KeyCode::Up | KeyCode::Char('k') => {
            state.selected_index = state.selected_index.saturating_sub(1);
            false
        }
        KeyCode::Char('?') | KeyCode::F(1) => {
            state.help_modal_open = true;
            false
        }
        KeyCode::Char('d') | KeyCode::Char('D') => {
            state.is_entering_directive = true;
            state.directive_input.clear();
            false
        }
        KeyCode::Char('t') | KeyCode::Char('T') => {
            state.theme.toggle();
            state.status_message = format!("Theme toggled to {:?}", state.theme.mode);
            false
        }
        KeyCode::Char('o') => {
            state.company_picker_open = true;
            state.company_picker_selection = state
                .companies
                .iter()
                .position(|c| c.id == state.active_company_id)
                .unwrap_or(0);
            false
        }
        KeyCode::Char('a') | KeyCode::Char('A') => {
            if state.active_tab == ActiveTab::EngineeringWorkbench {
                state.approve_selected_proposal().await;
            } else if state.active_tab == ActiveTab::EvolutionLab {
                state.approve_selected_adaptation().await;
            } else if state.active_tab == ActiveTab::MissionControl {
                state.assign_selected_task().await;
            } else {
                state.approve_selected().await;
            }
            false
        }
        KeyCode::Char('m') => {
            if state.active_tab == ActiveTab::EvolutionLab {
                state.simulate_selected_adaptation().await;
            }
            false
        }
        KeyCode::Char('b') => {
            if state.active_tab == ActiveTab::EvolutionLab {
                state.rollback_selected_adaptation().await;
            }
            false
        }
        KeyCode::Enter => {
            if state.active_tab == ActiveTab::MissionControl {
                state.assign_selected_task().await;
            } else if state.active_tab == ActiveTab::EngineeringWorkbench {
                state.is_entering_directive = true;
                state.directive_input.clear();
            }
            false
        }
        KeyCode::Char('r') => {
            state.reject_selected().await;
            false
        }
        KeyCode::Char('p') => {
            state.toggle_pause_agent().await;
            false
        }
        KeyCode::Char('c') => {
            state.reset_circuit_breakers().await;
            false
        }
        KeyCode::Char('s') => {
            state.sync_backend_state().await;
            false
        }
        KeyCode::Char('x') => {
            if state.active_tab == ActiveTab::EngineeringWorkbench {
                state.dismiss_selected_proposal().await;
            } else {
                state.run_executable_tasks().await;
            }
            false
        }
        KeyCode::Char(' ') => {
            if state.active_tab == ActiveTab::EngineeringWorkbench {
                state.toggle_supervisor().await;
            } else {
                state.run_executable_tasks().await;
            }
            false
        }
        KeyCode::Char('/') => {
            state.is_filtering = true;
            state.filter_query.clear();
            false
        }
        _ => false,
    }
}

/// Handles mouse interactions (scrolling, clicking panes, toggling navigation).
pub async fn handle_mouse_event(state: &mut AppState, mouse: MouseEvent) -> bool {
    match mouse.kind {
        MouseEventKind::ScrollUp => {
            if state.task_inspector_open {
                state.task_inspector_subtask_selection = state.task_inspector_subtask_selection.saturating_sub(1);
            } else {
                match state.focus_pane {
                    FocusPane::Tasks => {
                        state.task_selection = state.task_selection.saturating_sub(1);
                    }
                    FocusPane::Swarm => {
                        state.swarm_selection = state.swarm_selection.saturating_sub(1);
                    }
                    FocusPane::Activity => {
                        state.activity_selection = state.activity_selection.saturating_sub(1);
                    }
                    FocusPane::Chat => {
                        state.chat_scroll = state.chat_scroll.saturating_sub(1);
                    }
                    FocusPane::Approvals => {
                        state.approval_queue_state.selected_index = state.approval_queue_state.selected_index.saturating_sub(1);
                    }
                    FocusPane::Engineering => {
                        state.engineering_state.diff_scroll = state.engineering_state.diff_scroll.saturating_sub(1);
                    }
                    FocusPane::ResourceTelemetry => {
                        state.resource_telemetry_state.selected_row = state.resource_telemetry_state.selected_row.saturating_sub(1);
                    }
                    FocusPane::QaRelease => {
                        state.qa_release_state.selected_gate_idx = state.qa_release_state.selected_gate_idx.saturating_sub(1);
                    }
                    FocusPane::DecisionTrace => {
                        state.decision_trace_state.selected_idx = state.decision_trace_state.selected_idx.saturating_sub(1);
                    }
                    FocusPane::CompanyMemory => {
                        state.company_memory_state.selected_idx = state.company_memory_state.selected_idx.saturating_sub(1);
                    }
                    FocusPane::Graph => {
                        state.mission_graph_state.selected_idx = state.mission_graph_state.selected_idx.saturating_sub(1);
                    }
                    _ => {}
                }
            }
        }
        MouseEventKind::ScrollDown => {
            if state.task_inspector_open {
                state.task_inspector_subtask_selection += 1;
            } else {
                match state.focus_pane {
                    FocusPane::Tasks => {
                        if !state.tasks.is_empty() {
                            state.task_selection = (state.task_selection + 1).min(state.tasks.len() - 1);
                        }
                    }
                    FocusPane::Swarm => {
                        if !state.agents.is_empty() {
                            state.swarm_selection = (state.swarm_selection + 1).min(state.agents.len() - 1);
                        }
                    }
                    FocusPane::Activity => {
                        if !state.activity_events.is_empty() {
                            state.activity_selection = (state.activity_selection + 1).min(state.activity_events.len() - 1);
                        }
                    }
                    FocusPane::Chat => {
                        state.chat_scroll += 1;
                    }
                    FocusPane::Approvals => {
                        if !state.approval_queue_state.items.is_empty() {
                            state.approval_queue_state.selected_index = (state.approval_queue_state.selected_index + 1).min(state.approval_queue_state.items.len() - 1);
                        }
                    }
                    FocusPane::Engineering => {
                        state.engineering_state.diff_scroll = state.engineering_state.diff_scroll.saturating_add(1);
                    }
                    FocusPane::ResourceTelemetry => {
                        state.resource_telemetry_state.selected_row += 1;
                    }
                    FocusPane::QaRelease => {
                        state.qa_release_state.selected_gate_idx += 1;
                    }
                    FocusPane::DecisionTrace => {
                        state.decision_trace_state.selected_idx += 1;
                    }
                    FocusPane::CompanyMemory => {
                        state.company_memory_state.selected_idx += 1;
                    }
                    FocusPane::Graph => {
                        state.mission_graph_state.selected_idx += 1;
                    }
                    _ => {}
                }
            }
        }
        MouseEventKind::Down(MouseButton::Left) if mouse.row < 4 => {
            // Header click toggles navigation / prompt mode
            state.is_nav_mode = !state.is_nav_mode;
        }
        _ => {}
    }
    false
}
