#[cfg(test)]
mod tests {
    use crossterm::event::{KeyCode, KeyEvent, KeyModifiers};
    use ratatui::backend::TestBackend;
    use ratatui::Terminal;

    use crate::app::AppState;
    use crate::common::{ActiveTab, ConnectionState, LayoutFocus};
    use crate::handlers::handle_key_event;
    use crate::theme::ThemeMode;
    use crate::ui::render_app;

    #[test]
    fn test_13_canonical_workspaces_navigation() {
        let all_tabs = ActiveTab::all();
        assert_eq!(all_tabs.len(), 13);

        let mut state = AppState::new();

        for tab in all_tabs {
            state.active_tab = *tab;
            let idx = tab.index();
            assert_eq!(ActiveTab::from_index(idx), Some(*tab));

            let shortcut_char = tab.shortcut().chars().next().unwrap();
            assert_eq!(ActiveTab::from_shortcut(shortcut_char), Some(*tab));

            assert!(!tab.title().is_empty());
            assert!(!tab.name().is_empty());
        }
    }

    #[tokio::test]
    async fn test_command_palette_ctrl_k_toggle_and_search() {
        let mut state = AppState::new();
        assert!(!state.palette_open);

        // 1. Press Ctrl+K to open
        let ctrl_k = KeyEvent::new(KeyCode::Char('k'), KeyModifiers::CONTROL);
        let exit = handle_key_event(&mut state, ctrl_k).await;
        assert!(!exit);
        assert!(state.palette_open);
        assert_eq!(state.palette_selection, 0);

        // 2. Type "memory" into palette query
        for c in "memory".chars() {
            let key = KeyEvent::new(KeyCode::Char(c), KeyModifiers::NONE);
            handle_key_event(&mut state, key).await;
        }
        assert_eq!(state.palette_query, "memory");

        let items = state.get_palette_items();
        assert!(!items.is_empty());
        assert!(items.iter().any(|i| i.id == "ws_company_memory"));

        // 3. Press Enter to execute selected item
        let enter_key = KeyEvent::new(KeyCode::Enter, KeyModifiers::NONE);
        handle_key_event(&mut state, enter_key).await;

        assert!(!state.palette_open);
        assert_eq!(state.active_tab, ActiveTab::CompanyMemory);

        // 4. Reopen and close with Esc
        handle_key_event(&mut state, ctrl_k).await;
        assert!(state.palette_open);

        let esc_key = KeyEvent::new(KeyCode::Esc, KeyModifiers::NONE);
        handle_key_event(&mut state, esc_key).await;
        assert!(!state.palette_open);
    }

    #[tokio::test]
    async fn test_contextual_help_modal_toggle() {
        let mut state = AppState::new();
        assert!(!state.help_modal_open);

        // Press ? to open help modal
        let question_key = KeyEvent::new(KeyCode::Char('?'), KeyModifiers::NONE);
        handle_key_event(&mut state, question_key).await;
        assert!(state.help_modal_open);

        // Press Esc to dismiss
        let esc_key = KeyEvent::new(KeyCode::Esc, KeyModifiers::NONE);
        handle_key_event(&mut state, esc_key).await;
        assert!(!state.help_modal_open);
    }

    #[tokio::test]
    async fn test_keyboard_navigation_and_focus_cycling() {
        let mut state = AppState::new();
        state.layout_focus = LayoutFocus::NavRail;

        // Tab cycles: NavRail -> Workspace -> Inspector -> CommandBar -> NavRail
        let tab_key = KeyEvent::new(KeyCode::Tab, KeyModifiers::NONE);
        handle_key_event(&mut state, tab_key).await;
        assert_eq!(state.layout_focus, LayoutFocus::Workspace);

        handle_key_event(&mut state, tab_key).await;
        assert_eq!(state.layout_focus, LayoutFocus::Inspector);

        handle_key_event(&mut state, tab_key).await;
        assert_eq!(state.layout_focus, LayoutFocus::CommandBar);

        handle_key_event(&mut state, tab_key).await;
        assert_eq!(state.layout_focus, LayoutFocus::NavRail);

        // BackTab cycles in reverse
        let backtab_key = KeyEvent::new(KeyCode::BackTab, KeyModifiers::NONE);
        handle_key_event(&mut state, backtab_key).await;
        assert_eq!(state.layout_focus, LayoutFocus::CommandBar);
    }

    #[tokio::test]
    async fn test_theme_toggle_via_key_and_palette() {
        let mut state = AppState::new();
        assert_eq!(state.theme.mode, ThemeMode::Dark);

        // 1. Press 't' to toggle to Light Mode
        let t_key = KeyEvent::new(KeyCode::Char('t'), KeyModifiers::NONE);
        handle_key_event(&mut state, t_key).await;
        assert_eq!(state.theme.mode, ThemeMode::Light);

        // 2. Press 't' again to return to Dark Mode
        handle_key_event(&mut state, t_key).await;
        assert_eq!(state.theme.mode, ThemeMode::Dark);
    }

    #[tokio::test]
    async fn test_workspace_direct_shortcut_keys() {
        let mut state = AppState::new();

        let shortcut_mappings = [
            ('1', ActiveTab::CommandCenter),
            ('2', ActiveTab::AgentRoster),
            ('3', ActiveTab::MissionControl),
            ('4', ActiveTab::ExecutiveComms),
            ('5', ActiveTab::EngineeringWorkbench),
            ('6', ActiveTab::GovernanceApprovals),
            ('7', ActiveTab::ResourceExchange),
            ('8', ActiveTab::CompanyMemory),
            ('9', ActiveTab::EvolutionLab),
            ('0', ActiveTab::BusinessGrowth),
            ('-', ActiveTab::SecurityAudit),
            ('=', ActiveTab::InfrastructureRuntime),
            ('\\', ActiveTab::CompanyConfiguration),
        ];

        for (ch, expected_tab) in shortcut_mappings {
            let key = KeyEvent::new(KeyCode::Char(ch), KeyModifiers::NONE);
            handle_key_event(&mut state, key).await;
            assert_eq!(state.active_tab, expected_tab);
        }
    }

    #[tokio::test]
    async fn test_operational_action_handlers() {
        let mut state = AppState::new();

        // 1. Directive entry mode
        let d_key = KeyEvent::new(KeyCode::Char('d'), KeyModifiers::NONE);
        handle_key_event(&mut state, d_key).await;
        assert!(state.is_entering_directive);

        let esc_key = KeyEvent::new(KeyCode::Esc, KeyModifiers::NONE);
        handle_key_event(&mut state, esc_key).await;
        assert!(!state.is_entering_directive);

        // 2. Filter mode
        let slash_key = KeyEvent::new(KeyCode::Char('/'), KeyModifiers::NONE);
        handle_key_event(&mut state, slash_key).await;
        assert!(state.is_filtering);

        handle_key_event(&mut state, esc_key).await;
        assert!(!state.is_filtering);

        // 3. Command mode
        let colon_key = KeyEvent::new(KeyCode::Char(':'), KeyModifiers::NONE);
        handle_key_event(&mut state, colon_key).await;
        assert!(state.is_command_mode);

        handle_key_event(&mut state, esc_key).await;
        assert!(!state.is_command_mode);

        // 4. Circuit breaker reset
        let c_key = KeyEvent::new(KeyCode::Char('c'), KeyModifiers::NONE);
        handle_key_event(&mut state, c_key).await;
        assert!(state.logs.iter().any(|l| l.contains("circuit breakers reset") || l.contains("CIRCUIT_BREAKER")));
    }

    #[test]
    fn test_rendering_narrow_terminal_dimensions() {
        let small_dimensions = [(60, 20), (70, 22), (80, 24), (50, 15), (90, 22)];

        for (w, h) in small_dimensions {
            let backend = TestBackend::new(w, h);
            let mut terminal = Terminal::new(backend).unwrap();
            let mut state = AppState::new();
            state.company_name = "Neiman OS Narrow".into();
            state.connection_state = ConnectionState::Offline;

            // Must not panic on any narrow dimension
            let result = terminal.draw(|f| {
                render_app(f, &state);
            });
            assert!(result.is_ok(), "render_app failed on dimension {}x{}", w, h);

            let buffer = terminal.backend().buffer();
            let content = buffer
                .content()
                .iter()
                .map(|c| c.symbol())
                .collect::<Vec<_>>()
                .join("");

            assert!(content.contains("NEIMAN OS"), "Narrow dimension {}x{} missing header", w, h);
        }
    }

    #[test]
    fn test_rendering_all_13_workspaces_in_terminal_buffer() {
        let backend = TestBackend::new(140, 45);
        let mut terminal = Terminal::new(backend).unwrap();
        let mut state = AppState::new();
        state.company_name = "NEIMAN Command Center".into();
        state.connection_state = ConnectionState::Connected;

        for tab in ActiveTab::all() {
            state.active_tab = *tab;

            terminal
                .draw(|f| {
                    render_app(f, &state);
                })
                .unwrap();

            let buffer = terminal.backend().buffer();
            let content = buffer
                .content()
                .iter()
                .map(|c| c.symbol())
                .collect::<Vec<_>>()
                .join("");

            // Top status bar keywords
            assert!(content.contains("NEIMAN OS"));
            assert!(content.contains("LIVE CONNECTED"));

            // Check workspace-specific visual indicators
            match tab {
                ActiveTab::CommandCenter => {
                    assert!(content.contains("0 POSITIONS"));
                    assert!(content.contains("CTO DIRECTIVES"));
                    assert!(content.contains("LIVE AUDIT TELEMETRY"));
                }
                ActiveTab::AgentRoster => {
                    assert!(content.contains("Agent Roster") || content.contains("Workforce"));
                }
                ActiveTab::MissionControl => {
                    assert!(content.contains("Mission Control") || content.contains("Tasks"));
                }
                ActiveTab::ExecutiveComms => {
                    assert!(content.contains("EXECUTIVE COMMUNICATIONS") || content.contains("CEO DIRECTIVES"));
                }
                ActiveTab::EngineeringWorkbench => {
                    assert!(content.contains("CTO") || content.contains("Workbench") || content.contains("Engineering"));
                }
                ActiveTab::GovernanceApprovals => {
                    assert!(content.contains("Governance") || content.contains("Approvals"));
                }
                ActiveTab::ResourceExchange => {
                    assert!(content.contains("Resource") || content.contains("FinOps"));
                }
                ActiveTab::CompanyMemory => {
                    assert!(content.contains("COMPANY MEMORY") || content.contains("Vector Collections"));
                }
                ActiveTab::EvolutionLab => {
                    assert!(content.contains("Evolution") || content.contains("Adaptation"));
                }
                ActiveTab::BusinessGrowth => {
                    assert!(content.contains("GROWTH") || content.contains("Milestones") || content.contains("OKRs"));
                }
                ActiveTab::SecurityAudit => {
                    assert!(content.contains("Security") || content.contains("Governance"));
                }
                ActiveTab::InfrastructureRuntime => {
                    assert!(content.contains("INFRASTRUCTURE") || content.contains("MCP"));
                }
                ActiveTab::CompanyConfiguration => {
                    assert!(content.contains("CONFIGURATION") || content.contains("AI PROVIDERS"));
                }
            }
        }
    }

    #[test]
    fn test_command_hub_string_execution() {
        let mut state = AppState::new();

        state.execute_command("roster");
        assert_eq!(state.active_tab, ActiveTab::AgentRoster);

        state.execute_command("mission");
        assert_eq!(state.active_tab, ActiveTab::MissionControl);

        state.execute_command("executive");
        assert_eq!(state.active_tab, ActiveTab::ExecutiveComms);

        state.execute_command("workbench");
        assert_eq!(state.active_tab, ActiveTab::EngineeringWorkbench);

        state.execute_command("approvals");
        assert_eq!(state.active_tab, ActiveTab::GovernanceApprovals);

        state.execute_command("exchange");
        assert_eq!(state.active_tab, ActiveTab::ResourceExchange);

        state.execute_command("memory");
        assert_eq!(state.active_tab, ActiveTab::CompanyMemory);

        state.execute_command("evolution");
        assert_eq!(state.active_tab, ActiveTab::EvolutionLab);

        state.execute_command("growth");
        assert_eq!(state.active_tab, ActiveTab::BusinessGrowth);

        state.execute_command("security");
        assert_eq!(state.active_tab, ActiveTab::SecurityAudit);

        state.execute_command("infrastructure");
        assert_eq!(state.active_tab, ActiveTab::InfrastructureRuntime);

        state.execute_command("config");
        assert_eq!(state.active_tab, ActiveTab::CompanyConfiguration);

        state.execute_command("status");
        assert_eq!(state.active_tab, ActiveTab::CommandCenter);
    }

    #[tokio::test]
    async fn test_task_and_subtask_interactive_toggle() {
        use crate::common::{FocusPane, TaskChecklistEntry, TaskViewItem};

        let mut state = AppState::new();
        state.tasks = vec![
            TaskViewItem {
                id: "task-feat-interactive".into(),
                title: "Deploy Interactive Task Deck".into(),
                status: "TODO".into(),
                checklist: vec![
                    TaskChecklistEntry {
                        id: "step-1".into(),
                        title: "Build bidirectional API mutation".into(),
                        completed: false,
                    },
                    TaskChecklistEntry {
                        id: "step-2".into(),
                        title: "Verify tactile keyboard shortcuts".into(),
                        completed: true,
                    },
                ],
                ..Default::default()
            },
        ];
        state.task_selection = 0;
        state.focus_pane = FocusPane::Tasks;

        // 1. Toggle task status: TODO -> COMPLETED
        state.toggle_selected_task().await;
        assert_eq!(state.tasks[0].status, "COMPLETED");

        // 2. Toggle task status: COMPLETED -> TODO
        state.toggle_selected_task().await;
        assert_eq!(state.tasks[0].status, "TODO");

        // 3. Inspect task & toggle subtask checklist
        state.selected_task = Some(state.tasks[0].clone());
        state.task_inspector_open = true;
        state.task_inspector_subtask_selection = 0;

        assert!(!state.tasks[0].checklist[0].completed);
        state.toggle_selected_subtask().await;
        assert!(state.tasks[0].checklist[0].completed);
        assert!(state.selected_task.as_ref().unwrap().checklist[0].completed);

        // Toggle back
        state.toggle_selected_subtask().await;
        assert!(!state.tasks[0].checklist[0].completed);
    }

    #[tokio::test]
    async fn test_mouse_scroll_and_header_interaction() {
        use crossterm::event::{MouseButton, MouseEvent, MouseEventKind};
        use crate::common::FocusPane;
        use crate::handlers::handle_mouse_event;

        let mut state = AppState::new();
        state.focus_pane = FocusPane::Tasks;
        state.tasks = vec![
            Default::default(),
            Default::default(),
            Default::default(),
        ];
        state.task_selection = 0;

        // Scroll down
        let scroll_down = MouseEvent {
            kind: MouseEventKind::ScrollDown,
            column: 10,
            row: 10,
            modifiers: KeyModifiers::NONE,
        };
        handle_mouse_event(&mut state, scroll_down).await;
        assert_eq!(state.task_selection, 1);

        // Scroll up
        let scroll_up = MouseEvent {
            kind: MouseEventKind::ScrollUp,
            column: 10,
            row: 10,
            modifiers: KeyModifiers::NONE,
        };
        handle_mouse_event(&mut state, scroll_up).await;
        assert_eq!(state.task_selection, 0);

        // Header click toggles navigation mode
        let prev_mode = state.is_nav_mode;
        let header_click = MouseEvent {
            kind: MouseEventKind::Down(MouseButton::Left),
            column: 5,
            row: 1,
            modifiers: KeyModifiers::NONE,
        };
        handle_mouse_event(&mut state, header_click).await;
        assert_ne!(state.is_nav_mode, prev_mode);
    }

    #[test]
    fn test_render_task_inspector_with_checklist() {
        use ratatui::layout::Rect;
        use crate::common::{TaskChecklistEntry, TaskViewItem};
        use crate::features::cockpit::ui::render_task_inspector_modal;

        let mut state = AppState::new();
        state.task_inspector_open = true;
        state.selected_task = Some(TaskViewItem {
            id: "task-inspector-test".into(),
            title: "Security Hardening Task".into(),
            status: "IN_PROGRESS".into(),
            checklist: vec![
                TaskChecklistEntry {
                    id: "chk-1".into(),
                    title: "Encrypt tokens with XOR cipher".into(),
                    completed: true,
                },
                TaskChecklistEntry {
                    id: "chk-2".into(),
                    title: "Audit boundary gates".into(),
                    completed: false,
                },
            ],
            ..Default::default()
        });

        let backend = TestBackend::new(120, 40);
        let mut terminal = Terminal::new(backend).unwrap();

        terminal.draw(|f| {
            render_task_inspector_modal(f, &state, Rect::new(0, 0, 120, 40));
        }).unwrap();

        let buffer = terminal.backend().buffer().clone();
        let content: String = buffer.content().iter().map(|c| c.symbol()).collect();
        assert!(content.contains("DELIVERABLE SUBTASK CHECKLIST"));
        assert!(content.contains("Encrypt tokens with XOR cipher"));
        assert!(content.contains("Audit boundary gates"));
    }
}
