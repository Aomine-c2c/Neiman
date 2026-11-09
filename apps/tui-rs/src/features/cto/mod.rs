pub mod ui;

pub use ui::*;

#[cfg(test)]
mod tests {
    use super::*;
    use crate::AppState;
    use ratatui::{backend::TestBackend, Terminal};

    #[test]
    fn test_render_cto_tab_empty() {
        let backend = TestBackend::new(120, 40);
        let mut terminal = Terminal::new(backend).unwrap();
        let state = AppState::new();

        terminal
            .draw(|f| {
                render_cto_tab(f, &state, f.area());
            })
            .unwrap();

        let buffer = terminal.backend().buffer();
        let buffer_str: String = buffer
            .content()
            .iter()
            .map(|cell| cell.symbol())
            .collect();

        assert!(buffer_str.contains("Autonomous CTO Command"));
        assert!(buffer_str.contains("SUPERVISOR DAEMON"));
        assert!(buffer_str.contains("NO PROACTIVE PROPOSALS IN QUEUE"));
    }

    #[test]
    fn test_cto_inspector_text_empty() {
        let state = AppState::new();
        assert!(inspector_text(&state).is_none());
    }
}
