use ratatui::style::{Color, Modifier, Style};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ThemeMode {
    Light,
    Dark,
}

#[derive(Debug, Clone)]
pub struct Theme {
    pub mode: ThemeMode,
    pub primary: Color,
    pub primary_dim: Color,
    pub secondary: Color,
    pub bg: Color,
    pub card_bg: Color,
    pub border: Color,
    pub border_focus: Color,
    pub text_primary: Color,
    pub text_secondary: Color,
    pub text_muted: Color,
    pub success: Color,
    pub warning: Color,
    pub error: Color,
    pub accent: Color,
}

impl Default for Theme {
    fn default() -> Self {
        // Rule 3: Cyber Obsidian Glow as default
        Self::dark()
    }
}

impl Theme {
    pub fn light() -> Self {
        Self {
            mode: ThemeMode::Light,
            primary: Color::Rgb(0, 102, 204),
            primary_dim: Color::Rgb(210, 230, 255),
            secondary: Color::Rgb(80, 85, 95),
            bg: Color::Rgb(248, 249, 250),
            card_bg: Color::Rgb(255, 255, 255),
            border: Color::Rgb(205, 210, 220),
            border_focus: Color::Rgb(0, 102, 204),
            text_primary: Color::Rgb(20, 25, 35),
            text_secondary: Color::Rgb(75, 80, 90),
            text_muted: Color::Rgb(125, 130, 140),
            success: Color::Rgb(16, 140, 70),
            warning: Color::Rgb(180, 110, 0),
            error: Color::Rgb(215, 25, 33),
            accent: Color::Rgb(215, 25, 33),
        }
    }

    pub fn dark() -> Self {
        Self {
            mode: ThemeMode::Dark,
            primary: Color::Rgb(14, 243, 206),       // Cyber Neon Cyan #0EF3CE
            primary_dim: Color::Rgb(0, 45, 55),
            secondary: Color::Rgb(100, 200, 220),
            bg: Color::Rgb(2, 11, 18),              // Deep Obsidian #020B12
            card_bg: Color::Rgb(4, 20, 28),
            border: Color::Rgb(0, 140, 160),         // Cyan border
            border_focus: Color::Rgb(14, 243, 206),   // Active glowing cyan
            text_primary: Color::Rgb(235, 250, 255),
            text_secondary: Color::Rgb(120, 190, 210),
            text_muted: Color::Rgb(60, 120, 140),
            success: Color::Rgb(20, 240, 150),       // Neon Green
            warning: Color::Rgb(255, 185, 30),       // Amber
            error: Color::Rgb(255, 60, 80),          // Neon Red
            accent: Color::Rgb(14, 243, 206),
        }
    }

    pub fn toggle(&mut self) {
        *self = match self.mode {
            ThemeMode::Light => Self::dark(),
            ThemeMode::Dark => Self::light(),
        };
    }

    pub fn title_style(&self) -> Style {
        Style::default().fg(self.primary).add_modifier(Modifier::BOLD)
    }

    pub fn border_style(&self, focused: bool) -> Style {
        if focused {
            Style::default().fg(self.border_focus).add_modifier(Modifier::BOLD)
        } else {
            Style::default().fg(self.border)
        }
    }

    pub fn text_style(&self) -> Style {
        Style::default().fg(self.text_primary)
    }

    pub fn muted_style(&self) -> Style {
        Style::default().fg(self.text_muted)
    }

    pub fn card_style(&self) -> Style {
        Style::default().bg(self.card_bg).fg(self.text_primary)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_theme_default_is_dark() {
        let theme = Theme::default();
        assert_eq!(theme.mode, ThemeMode::Dark);
    }

    #[test]
    fn test_theme_toggle() {
        let mut theme = Theme::default();
        assert_eq!(theme.mode, ThemeMode::Dark);
        theme.toggle();
        assert_eq!(theme.mode, ThemeMode::Light);
        theme.toggle();
        assert_eq!(theme.mode, ThemeMode::Dark);
    }
}
