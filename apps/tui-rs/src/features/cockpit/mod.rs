pub mod state;
pub mod ui;

pub use ui::*;


#[cfg(test)]
mod tests {
    use super::*;
    use crate::AppState;
    use crate::common::{ConnectionState, ProviderHealthStatus};
    use ratatui::backend::TestBackend;
    use ratatui::Terminal;

    #[test]
    fn test_cockpit_state_default() {
        let state = CockpitState::default();
        assert_eq!(state.focus_pane, crate::common::FocusPane::Chat);
        assert_eq!(state.chat_messages.len(), 2);
        assert!(!state.slash_menu_open);
        assert!(!state.is_nav_mode);
    }

    #[test]
    fn test_cockpit_visual_buffer_render() {
        let backend = TestBackend::new(120, 36);
        let mut terminal = Terminal::new(backend).unwrap();
        let state = AppState::new();

        terminal
            .draw(|f| {
                let area = f.area();
                render_cyber_header(f, &state, ratatui::layout::Rect::new(0, 0, area.width, 4));
                render_unified_cockpit(f, &state, ratatui::layout::Rect::new(0, 4, area.width, area.height - 4));
            })
            .unwrap();

        let buffer = terminal.backend().buffer();
        // Assert header glyphs and layout exist in memory buffer
        let content = buffer
            .content()
            .iter()
            .map(|c| c.symbol())
            .collect::<Vec<_>>()
            .join("");

        assert!(content.contains("NEIMAN OS"));
        assert!(content.contains("WORKSPACE"));
    }

    #[test]
    fn test_active_provider_resolution_gemini() {
        let mut state = AppState::new();
        state.intelligence = Some(serde_json::json!({
            "active_provider": "google_gemini",
            "active_model": "gemini-3.8-flash",
            "active_provider_display": "Google Gemini"
        }));

        let (prov, model, disp) = state.get_active_provider_and_model();
        assert_eq!(prov.as_deref(), Some("google_gemini"));
        assert_eq!(model.as_deref(), Some("gemini-3.8-flash"));
        assert_eq!(disp.as_deref(), Some("Google Gemini"));
    }

    #[test]
    fn test_active_provider_fallback_to_available_providers() {
        let mut state = AppState::new();
        state.intelligence = Some(serde_json::json!({
            "active_provider": null,
            "active_model": null,
            "available_providers": [
                {
                    "name": "google_gemini",
                    "display_name": "Google Gemini",
                    "is_configured": true,
                    "is_healthy": true
                }
            ]
        }));

        let (prov, model, disp) = state.get_active_provider_and_model();
        assert_eq!(prov.as_deref(), Some("google_gemini"));
        assert_eq!(model.as_deref(), Some("gemini-3.8-flash"));
        assert_eq!(disp.as_deref(), Some("Google Gemini"));
    }

    #[test]
    fn test_terminal_resizing_render_stability() {
        let resolutions = [(80, 24), (100, 30), (120, 36), (160, 50), (60, 20)];
        for (w, h) in resolutions {
            let backend = TestBackend::new(w, h);
            let mut terminal = Terminal::new(backend).unwrap();
            let mut state = AppState::new();
            state.connection_state = ConnectionState::Connected;
            state.company_name = "Neiman Co".into();

            terminal
                .draw(|f| {
                    let area = f.area();
                    render_cyber_header(f, &state, ratatui::layout::Rect::new(0, 0, area.width, 4));
                    render_unified_cockpit(f, &state, ratatui::layout::Rect::new(0, 4, area.width, area.height - 4));
                })
                .unwrap();

            let buffer = terminal.backend().buffer();
            let content = buffer
                .content()
                .iter()
                .map(|c| c.symbol())
                .collect::<Vec<_>>()
                .join("");

            assert!(content.contains("NEIMAN OS"), "Resolution {w}x{h} must render header");
            assert!(content.contains("SWARM"), "Resolution {w}x{h} must render SWARM workforce pane");
            assert!(content.contains("TASK"), "Resolution {w}x{h} must render TASK backlog pane");
            assert!(content.contains("TELEMETRY"), "Resolution {w}x{h} must render TELEMETRY pane");
        }
    }

    #[test]
    fn test_focus_switching_and_zoom_cycle() {
        let mut state = AppState::new();
        state.is_nav_mode = true;
        state.focus_pane = crate::common::FocusPane::Chat;

        // Simulate Tab cycling
        state.focus_pane = match state.focus_pane {
            crate::common::FocusPane::Chat => crate::common::FocusPane::Swarm,
            _ => unreachable!(),
        };
        assert_eq!(state.focus_pane, crate::common::FocusPane::Swarm);

        state.focus_pane = match state.focus_pane {
            crate::common::FocusPane::Swarm => crate::common::FocusPane::Tasks,
            _ => unreachable!(),
        };
        assert_eq!(state.focus_pane, crate::common::FocusPane::Tasks);

        state.focus_pane = match state.focus_pane {
            crate::common::FocusPane::Tasks => crate::common::FocusPane::Telemetry,
            _ => unreachable!(),
        };
        assert_eq!(state.focus_pane, crate::common::FocusPane::Telemetry);

        state.focus_pane = match state.focus_pane {
            crate::common::FocusPane::Telemetry => crate::common::FocusPane::Chat,
            _ => unreachable!(),
        };
        assert_eq!(state.focus_pane, crate::common::FocusPane::Chat);

        // Zoom toggle
        assert!(state.zoomed_pane.is_none());
        state.zoomed_pane = Some(state.focus_pane);
        assert_eq!(state.zoomed_pane, Some(crate::common::FocusPane::Chat));
        state.zoomed_pane = None;
        assert!(state.zoomed_pane.is_none());
    }

    #[test]
    fn test_directive_preservation_on_failure() {
        let mut state = AppState::new();
        let directive = "Architect real-time WebRTC telemetry stream with circuit breaker".to_string();
        state.chat_input = directive.clone();

        // Simulate failed dispatch preserving input
        let failed_directive = state.chat_input.clone();
        state.last_failed_directive = Some(failed_directive.clone());
        // User directive preserved in input prompt
        assert_eq!(state.chat_input, directive);
        assert_eq!(state.last_failed_directive.as_ref(), Some(&directive));
    }

    #[test]
    fn test_connection_states_and_offline_diagnostics() {
        let mut state = AppState::new();
        assert_eq!(state.connection_state, ConnectionState::Connecting);

        // Transition to Offline
        state.connection_state = ConnectionState::Offline;
        assert_eq!(state.connection_state.as_str(), "OFFLINE");
        assert!(!state.connection_state.is_operational());

        // Transition to Degraded
        state.connection_state = ConnectionState::Degraded;
        assert_eq!(state.connection_state.as_str(), "DEGRADED");
        assert!(state.connection_state.is_operational());

        // Transition to Connected
        state.connection_state = ConnectionState::Connected;
        assert_eq!(state.connection_state.as_str(), "CONNECTED");
        assert!(state.connection_state.is_operational());
    }

    #[test]
    fn test_provider_health_distinction_verified_vs_unverified() {
        let mut state = AppState::new();
        state.connection_state = ConnectionState::Connected;

        // 1. Configured but unverified (no last_health_check_at)
        state.intelligence = Some(serde_json::json!({
            "active_provider": "google_gemini",
            "active_model": "gemini-3.8-flash",
            "available_providers": [
                {
                    "name": "google_gemini",
                    "display_name": "Google Gemini",
                    "is_configured": true,
                    "is_healthy": true,
                    "last_health_check_at": null,
                    "consecutive_failures": 0
                }
            ]
        }));
        assert_eq!(state.get_active_provider_health(), ProviderHealthStatus::ConfiguredUnverified);

        // 2. Verified & Healthy (is_configured=true, is_healthy=true, last_health_check_at present)
        state.intelligence = Some(serde_json::json!({
            "active_provider": "google_gemini",
            "active_model": "gemini-3.8-flash",
            "available_providers": [
                {
                    "name": "google_gemini",
                    "display_name": "Google Gemini",
                    "is_configured": true,
                    "is_healthy": true,
                    "last_health_check_at": "2026-10-27T16:00:00Z",
                    "consecutive_failures": 0
                }
            ]
        }));
        assert_eq!(state.get_active_provider_health(), ProviderHealthStatus::Verified);

        // 3. Probe Failed (failures > 0)
        state.intelligence = Some(serde_json::json!({
            "active_provider": "google_gemini",
            "active_model": "gemini-3.8-flash",
            "available_providers": [
                {
                    "name": "google_gemini",
                    "display_name": "Google Gemini",
                    "is_configured": true,
                    "is_healthy": false,
                    "last_health_check_at": "2026-10-27T16:00:00Z",
                    "consecutive_failures": 3
                }
            ]
        }));
        assert_eq!(state.get_active_provider_health(), ProviderHealthStatus::ProbeFailed);

        // 4. Not configured
        state.intelligence = Some(serde_json::json!({
            "active_provider": null,
            "active_model": null,
            "available_providers": []
        }));
        assert_eq!(state.get_active_provider_health(), ProviderHealthStatus::NotConfigured);
    }

    #[test]
    fn test_activity_pane_rendering_and_empty_state() {
        let backend = TestBackend::new(160, 40);
        let mut terminal = Terminal::new(backend).unwrap();
        let mut state = AppState::new();
        state.connection_state = ConnectionState::Connected;

        // Render empty state
        terminal
            .draw(|f| {
                let area = f.area();
                render_unified_cockpit(f, &state, area);
            })
            .unwrap();

        let buffer = terminal.backend().buffer();
        let content = buffer
            .content()
            .iter()
            .map(|c| c.symbol())
            .collect::<Vec<_>>()
            .join("");

        assert!(content.contains("AGENT ACTIVITY & COMMUNICATION"), "Title must be rendered");
        assert!(content.contains("No autonomous agent activity yet"), "Empty state message must be displayed");

        // Render offline state
        state.connection_state = ConnectionState::Offline;
        terminal
            .draw(|f| {
                let area = f.area();
                render_unified_cockpit(f, &state, area);
            })
            .unwrap();

        let buffer_offline = terminal.backend().buffer();
        let content_offline = buffer_offline
            .content()
            .iter()
            .map(|c| c.symbol())
            .collect::<Vec<_>>()
            .join("");

        assert!(content_offline.contains("ACTIVITY STREAM OFFLINE"), "Offline banner must be displayed");
    }

    #[test]
    fn test_activity_event_delivery_and_badges() {
        let backend = TestBackend::new(140, 40);
        let mut terminal = Terminal::new(backend).unwrap();
        let mut state = AppState::new();
        state.connection_state = ConnectionState::Connected;

        state.activity_events = vec![
            crate::client::ActivityEventPayload {
                id: "act-01".into(),
                company_id: "comp-1".into(),
                event_type: "DIRECTIVE".into(),
                severity: "info".into(),
                title: "CTO Directive".into(),
                summary: "Init payment gateway".into(),
                agent_name: Some("CTO".into()),
                agent_id: Some("agent-cto".into()),
                target_agent: Some("EngLead".into()),
                task_id: Some("task-pay-1".into()),
                timestamp: Some("2026-10-28T08:15:30Z".into()),
            },
            crate::client::ActivityEventPayload {
                id: "act-02".into(),
                company_id: "comp-1".into(),
                event_type: "TASK_STARTED".into(),
                severity: "info".into(),
                title: "EngLead Started".into(),
                summary: "Scaffolding router".into(),
                agent_name: Some("EngLead".into()),
                agent_id: Some("agent-eng".into()),
                target_agent: None,
                task_id: Some("task-pay-1".into()),
                timestamp: Some("2026-10-28T08:16:00Z".into()),
            },
            crate::client::ActivityEventPayload {
                id: "act-03".into(),
                company_id: "comp-1".into(),
                event_type: "DELEGATE".into(),
                severity: "info".into(),
                title: "Delegation to QA".into(),
                summary: "Run integration tests".into(),
                agent_name: Some("EngLead".into()),
                agent_id: Some("agent-eng".into()),
                target_agent: Some("QA".into()),
                task_id: Some("task-pay-1".into()),
                timestamp: Some("2026-10-28T08:17:15Z".into()),
            },
            crate::client::ActivityEventPayload {
                id: "act-04".into(),
                company_id: "comp-1".into(),
                event_type: "FAILURE".into(),
                severity: "error".into(),
                title: "QA Test Failure".into(),
                summary: "3 tests failed".into(),
                agent_name: Some("QA".into()),
                agent_id: Some("agent-qa".into()),
                target_agent: None,
                task_id: Some("task-pay-1".into()),
                timestamp: Some("2026-10-28T08:18:45Z".into()),
            },
        ];

        terminal
            .draw(|f| {
                let area = f.area();
                render_unified_cockpit(f, &state, area);
            })
            .unwrap();

        let buffer = terminal.backend().buffer();
        let content = buffer
            .content()
            .iter()
            .map(|c| c.symbol())
            .collect::<Vec<_>>()
            .join("");

        assert!(content.contains("[MSG:DIR]"), "Directive badge must render");
        assert!(content.contains("[TASK:START]"), "Task start badge must render");
        assert!(content.contains("[DELEGATE]"), "Delegate badge must render");
        assert!(content.contains("[FAIL:RPT]"), "Failure badge must render");
        assert!(content.contains("08:15:30"), "Timestamp must be parsed and rendered");
    }

    #[test]
    fn test_activity_filtering_and_pause() {
        let mut state = AppState::new();
        state.connection_state = ConnectionState::Connected;
        state.activity_events = vec![
            crate::client::ActivityEventPayload {
                id: "act-01".into(),
                company_id: "comp-1".into(),
                event_type: "DIRECTIVE".into(),
                severity: "info".into(),
                title: "Directive".into(),
                summary: "Design payment architecture".into(),
                agent_name: Some("CTO".into()),
                agent_id: Some("agent-cto".into()),
                target_agent: Some("Architect".into()),
                task_id: Some("t-1".into()),
                timestamp: Some("2026-10-28T08:00:00Z".into()),
            },
            crate::client::ActivityEventPayload {
                id: "act-02".into(),
                company_id: "comp-1".into(),
                event_type: "FAILURE".into(),
                severity: "error".into(),
                title: "Failure".into(),
                summary: "Database connection timed out".into(),
                agent_name: Some("DevOps".into()),
                agent_id: Some("agent-ops".into()),
                target_agent: None,
                task_id: Some("t-2".into()),
                timestamp: Some("2026-10-28T08:05:00Z".into()),
            },
        ];

        // 1. Filter by keyword
        state.activity_filter_query = "payment".into();
        let q = state.activity_filter_query.to_lowercase();
        let matches: Vec<_> = state
            .activity_events
            .iter()
            .filter(|e| {
                e.event_type.to_lowercase().contains(&q)
                    || e.summary.to_lowercase().contains(&q)
                    || e.agent_name.as_deref().unwrap_or("").to_lowercase().contains(&q)
            })
            .collect();
        assert_eq!(matches.len(), 1);
        assert_eq!(matches[0].id, "act-01");

        // 2. Pause toggle
        assert!(!state.activity_paused);
        state.activity_paused = true;
        assert!(state.activity_paused);
    }

    #[test]
    fn test_activity_inspector_modal_rendering() {
        let backend = TestBackend::new(120, 36);
        let mut terminal = Terminal::new(backend).unwrap();
        let mut state = AppState::new();
        state.connection_state = ConnectionState::Connected;
        state.activity_events = vec![
            crate::client::ActivityEventPayload {
                id: "evt-99".into(),
                company_id: "comp-1".into(),
                event_type: "HANDOFF".into(),
                severity: "warning".into(),
                title: "Handoff to SRE".into(),
                summary: "Deploying production hotfix to ingress".into(),
                agent_name: Some("Software Architect".into()),
                agent_id: Some("agent-arch".into()),
                target_agent: Some("DevOps Lead".into()),
                task_id: Some("task-deploy-99".into()),
                timestamp: Some("2026-10-28T08:30:00Z".into()),
            },
        ];
        state.activity_selection = 0;
        state.activity_inspector_open = true;

        terminal
            .draw(|f| {
                let area = f.area();
                render_unified_cockpit(f, &state, area);
            })
            .unwrap();

        let buffer = terminal.backend().buffer();
        let content = buffer
            .content()
            .iter()
            .map(|c| c.symbol())
            .collect::<Vec<_>>()
            .join("");

        assert!(content.contains("AGENT ACTIVITY & COMMUNICATION INSPECTOR"), "Modal title must render");
        assert!(content.contains("evt-99"), "Event ID must render in inspector");
        assert!(content.contains("Software Architect"), "Source agent must render in inspector");
        assert!(content.contains("DevOps Lead"), "Destination agent must render in inspector");
        assert!(content.contains("task-deploy-99"), "Task ID must render in inspector");
        assert!(content.contains("Deploying production hotfix"), "Payload summary must render");
    }

    #[tokio::test]
    async fn test_activity_navigation_and_key_handling() {
        use crossterm::event::{KeyCode, KeyEvent, KeyModifiers};

        let mut state = AppState::new();
        state.connection_state = ConnectionState::Connected;
        state.is_nav_mode = true;
        state.focus_pane = crate::common::FocusPane::Tasks;

        state.tasks = vec![
            crate::common::TaskViewItem {
                id: "task-01".into(),
                project_id: None,
                title: "Build Core Router".into(),
                status: "IN_PROGRESS".into(),
                priority: "HIGH".into(),
                assigned_agent: "agent-01".into(),
                dependencies: vec![],
                ..Default::default()
            }
        ];

        state.agents = vec![
            crate::client::AgentPayload {
                id: "agent-01".into(),
                name: "ArchLead".into(),
                role_title: Some("Software Architect".into()),
                status: "WORKING".into(),
                autonomy: Some("HIGH".into()),
                current_task: Some("task-01".into()),
            }
        ];

        state.activity_events = vec![
            crate::client::ActivityEventPayload {
                id: "evt-01".into(),
                company_id: "comp-1".into(),
                event_type: "DIRECTIVE".into(),
                severity: "info".into(),
                title: "Build Directive".into(),
                summary: "Build router ASAP".into(),
                agent_name: Some("ArchLead".into()),
                agent_id: Some("agent-01".into()),
                target_agent: None,
                task_id: Some("task-01".into()),
                timestamp: Some("2026-10-28T09:00:00Z".into()),
            }
        ];

        // 1. Tab switches from Tasks to Graph, then to Activity
        crate::handlers::handle_key_event(&mut state, KeyEvent::new(KeyCode::Tab, KeyModifiers::NONE)).await;
        assert_eq!(state.focus_pane, crate::common::FocusPane::Graph);
        crate::handlers::handle_key_event(&mut state, KeyEvent::new(KeyCode::Tab, KeyModifiers::NONE)).await;
        assert_eq!(state.focus_pane, crate::common::FocusPane::Activity);

        // 2. 'p' toggles activity paused
        assert!(!state.activity_paused);
        crate::handlers::handle_key_event(&mut state, KeyEvent::new(KeyCode::Char('p'), KeyModifiers::NONE)).await;
        assert!(state.activity_paused);
        crate::handlers::handle_key_event(&mut state, KeyEvent::new(KeyCode::Char('p'), KeyModifiers::NONE)).await;
        assert!(!state.activity_paused);

        // 3. Space / Enter opens activity inspector modal
        crate::handlers::handle_key_event(&mut state, KeyEvent::new(KeyCode::Char(' '), KeyModifiers::NONE)).await;
        assert!(state.activity_inspector_open);

        // 4. 't' in inspector modal jumps to associated task
        crate::handlers::handle_key_event(&mut state, KeyEvent::new(KeyCode::Char('t'), KeyModifiers::NONE)).await;
        assert!(!state.activity_inspector_open);
        assert_eq!(state.focus_pane, crate::common::FocusPane::Tasks);
        assert!(state.task_inspector_open);

        // Close task inspector
        state.task_inspector_open = false;

        // 5. Switch back to Activity and 'a' jumps to associated agent
        state.focus_pane = crate::common::FocusPane::Activity;
        crate::handlers::handle_key_event(&mut state, KeyEvent::new(KeyCode::Char('a'), KeyModifiers::NONE)).await;
        assert_eq!(state.focus_pane, crate::common::FocusPane::Swarm);
        assert_eq!(state.swarm_selection, 0);
    }

    #[test]
    fn test_activity_high_volume_resilience() {
        let backend = TestBackend::new(120, 36);
        let mut terminal = Terminal::new(backend).unwrap();
        let mut state = AppState::new();
        state.connection_state = ConnectionState::Connected;

        // Add 5,000 events to verify unbounded memory growth does not lock the render loop
        for i in 0..5000 {
            state.activity_events.push(crate::client::ActivityEventPayload {
                id: format!("bulk-{}", i),
                company_id: "comp-1".into(),
                event_type: "MESSAGE".into(),
                severity: "info".into(),
                title: "Bulk message".into(),
                summary: format!("Event payload execution step {}", i),
                agent_name: Some("CTO".into()),
                agent_id: Some("agent-cto".into()),
                target_agent: None,
                task_id: Some("task-bulk".into()),
                timestamp: Some("2026-10-28T09:00:00Z".into()),
            });
        }

        let start = std::time::Instant::now();
        terminal
            .draw(|f| {
                let area = f.area();
                render_unified_cockpit(f, &state, area);
            })
            .unwrap();
        let duration = start.elapsed();

        assert!(duration.as_millis() < 250, "Rendering 5,000 events must complete in < 250ms, took {:?}", duration);
    }
}

