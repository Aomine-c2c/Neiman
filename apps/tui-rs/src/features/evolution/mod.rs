pub mod ui;

pub use ui::*;

#[cfg(test)]
mod tests {
    use super::*;
    use crate::AppState;
    use ratatui::{backend::TestBackend, Terminal};

    #[test]
    fn test_render_evolution_tab_empty() {
        let backend = TestBackend::new(100, 30);
        let mut terminal = Terminal::new(backend).unwrap();
        let state = AppState::new();

        terminal
            .draw(|f| {
                render_evolution_tab(f, &state, f.area());
            })
            .unwrap();

        let buffer = terminal.backend().buffer();
        let buffer_str: String = buffer
            .content()
            .iter()
            .map(|cell| cell.symbol())
            .collect();

        assert!(buffer_str.contains("Evolution Engine"));
        assert!(buffer_str.contains("No adaptations returned"));
    }

    #[test]
    fn test_evolution_inspector_text_empty() {
        let state = AppState::new();
        assert!(inspector_text(&state).is_none());
    }
}
