pub mod ui;

pub use ui::*;

#[cfg(test)]
mod tests {
    use super::*;
    use crate::AppState;
    use ratatui::{backend::TestBackend, Terminal};

    #[test]
    fn test_render_security_tab() {
        let backend = TestBackend::new(100, 30);
        let mut terminal = Terminal::new(backend).unwrap();
        let state = AppState::new();

        terminal
            .draw(|f| {
                render_security_tab(f, &state, f.area());
            })
            .unwrap();

        let buffer = terminal.backend().buffer();
        let buffer_str: String = buffer
            .content()
            .iter()
            .map(|cell| cell.symbol())
            .collect();

        assert!(buffer_str.contains("Security & Governance"));
        assert!(buffer_str.contains("BACKEND & LOCAL POLICY ENFORCER"));
        assert!(buffer_str.contains("RECENT GOVERNANCE AUDITS"));
    }
}
