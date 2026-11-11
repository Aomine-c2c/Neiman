pub mod ui;

pub use ui::*;

#[cfg(test)]
mod tests {
    use super::*;
    use crate::AppState;
    use ratatui::{backend::TestBackend, Terminal};

    #[test]
    fn test_render_onboarding_wizard_step1() {
        let backend = TestBackend::new(120, 40);
        let mut terminal = Terminal::new(backend).unwrap();
        let state = AppState::new();

        terminal
            .draw(|f| {
                render_onboarding_wizard(f, &state, f.area());
            })
            .unwrap();

        let buffer = terminal.backend().buffer();
        let buffer_str: String = buffer
            .content()
            .iter()
            .map(|cell| cell.symbol())
            .collect();

        assert!(buffer_str.contains("INTERACTIVE ONBOARDING WIZARD"));
        assert!(buffer_str.contains("STEP 1: BLUEPRINT"));
        assert!(buffer_str.contains("Autonomous Software Company"));
    }
}
