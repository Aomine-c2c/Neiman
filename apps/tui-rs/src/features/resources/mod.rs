pub mod model;
pub mod ui;

pub use model::*;
pub use ui::*;

#[cfg(test)]
mod tests {
    use super::*;
    use crate::AppState;
    use chrono::{Duration, Utc};
    use ratatui::{backend::TestBackend, Terminal};

    #[test]
    fn test_metric_freshness_and_stale_detection() {
        let mut metrics = HostMetrics::default();
        assert!(!metrics.is_stale());
        assert_eq!(metrics.provenance(), MetricProvenance::Observed);

        // Make sample 35 seconds old -> STALE
        metrics.sampled_at = Utc::now() - Duration::seconds(35);
        assert!(metrics.is_stale());
        assert_eq!(metrics.provenance(), MetricProvenance::Stale);
    }

    #[test]
    fn test_progress_bar_formatting() {
        let bar_0 = make_progress_bar(0.0, 10);
        assert_eq!(bar_0, "[░░░░░░░░░░] 0.0%");

        let bar_50 = make_progress_bar(50.0, 10);
        assert_eq!(bar_50, "[█████░░░░░] 50.0%");

        let bar_100 = make_progress_bar(100.0, 10);
        assert_eq!(bar_100, "[██████████] 100.0%");
    }

    #[test]
    fn test_provider_telemetry_defaults_and_totals() {
        let state = ResourceTelemetryState::new();
        assert_eq!(state.providers.len(), 4);

        // Total tokens and cost calculation
        let total_tokens = state.total_tokens_consumed();
        assert!(total_tokens > 0);
        let total_cost = state.total_cost_usd();
        assert!(total_cost > 0.0);

        // Check health distinctions
        let gemini = state.providers.iter().find(|p| p.name.contains("Gemini")).unwrap();
        assert!(gemini.verified_healthy);

        let local = state.providers.iter().find(|p| p.name.contains("Local")).unwrap();
        assert!(!local.configured);
        assert!(!local.verified_healthy);
    }

    #[test]
    fn test_render_docked_resource_telemetry_pane() {
        let backend = TestBackend::new(80, 20);
        let mut terminal = Terminal::new(backend).unwrap();
        let mut state = AppState::new();
        state.resource_telemetry_state = ResourceTelemetryState::new();

        terminal
            .draw(|f| {
                render_docked_resource_telemetry_pane(f, &state, f.area());
            })
            .unwrap();

        let buffer = terminal.backend().buffer();
        let content: String = buffer
            .content()
            .iter()
            .map(|cell| cell.symbol())
            .collect();

        assert!(content.contains("RESOURCE & MODEL TELEMETRY"));
        assert!(content.contains("CPU"));
        assert!(content.contains("RAM"));
        assert!(content.contains("FINOPS"));
    }

    #[test]
    fn test_render_resources_tab_with_telemetry() {
        let backend = TestBackend::new(120, 35);
        let mut terminal = Terminal::new(backend).unwrap();
        let mut state = AppState::new();
        state.resource_telemetry_state = ResourceTelemetryState::new();

        terminal
            .draw(|f| {
                render_resources_tab(f, &state, f.area());
            })
            .unwrap();

        let buffer = terminal.backend().buffer();
        let content: String = buffer
            .content()
            .iter()
            .map(|cell| cell.symbol())
            .collect();

        assert!(content.contains("Resource Engine & Model Telemetry"));
        assert!(content.contains("Host Hardware"));
        assert!(content.contains("Model Providers"));
    }
}
