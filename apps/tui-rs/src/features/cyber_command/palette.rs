use ratatui::style::{Color, Modifier, Style};
use ratatui::text::{Line, Span};

/// NEIMAN OS Cyberpunk Command Center palette.
///
/// Spec colors:
///   - Background:  #030B14  (deep void dark blue/black)
///   - Primary:     #00E5FF  (neon cyan)
///   - Success:     #00FF66  (neon green)
///   - Warning:     #FF9900  (vivid orange/yellow)
///   - Danger:      #FF3366  (crimson red)
pub const BG_VOID: Color = Color::Rgb(3, 11, 20);
pub const BG_CARD: Color = Color::Rgb(5, 17, 28);
pub const CYAN: Color = Color::Rgb(0, 229, 255);
pub const CYAN_DIM: Color = Color::Rgb(0, 114, 127);
pub const GREEN: Color = Color::Rgb(0, 255, 102);
pub const GREEN_DIM: Color = Color::Rgb(0, 127, 51);
pub const ORANGE: Color = Color::Rgb(255, 153, 0);
pub const ORANGE_DIM: Color = Color::Rgb(127, 76, 0);
pub const RED: Color = Color::Rgb(255, 51, 102);
pub const RED_DIM: Color = Color::Rgb(127, 25, 51);
pub const TEXT_BRIGHT: Color = Color::Rgb(240, 248, 255);
pub const TEXT_DIM: Color = Color::Rgb(120, 140, 155);
pub const BORDER: Color = Color::Rgb(0, 229, 255);

pub fn status_color(connected: bool) -> Color {
    if connected { GREEN } else { RED }
}

pub fn status_dot(connected: bool) -> &'static str {
    if connected { "●" } else { "○" }
}

pub fn panel_title(text: &str) -> Line<'static> {
    Line::from(vec![
        Span::styled("┤ ", Style::default().fg(CYAN).add_modifier(Modifier::BOLD)),
        Span::styled(text, Style::default().fg(CYAN).add_modifier(Modifier::BOLD)),
        Span::styled(" ├", Style::default().fg(CYAN).add_modifier(Modifier::BOLD)),
    ])
}

pub fn muted(text: &str) -> Line<'static> {
    Line::from(Span::styled(text, Style::default().fg(TEXT_DIM)))
}

pub fn bright(text: &str) -> Line<'static> {
    Line::from(Span::styled(text, Style::default().fg(TEXT_BRIGHT)))
}

pub fn panel_border(focused: bool) -> Style {
    Style::default().fg(if focused { CYAN } else { CYAN_DIM })
}

pub fn cell_style(hovered: bool) -> Style {
    Style::default()
        .fg(TEXT_BRIGHT)
        .bg(if hovered { BG_VOID } else { BG_CARD })
}

pub fn header_style() -> Style {
    Style::default().fg(CYAN).add_modifier(Modifier::BOLD)
}

pub fn success_style() -> Style {
    Style::default().fg(GREEN).add_modifier(Modifier::BOLD)
}

pub fn warning_style() -> Style {
    Style::default().fg(ORANGE).add_modifier(Modifier::BOLD)
}

pub fn danger_style() -> Style {
    Style::default().fg(RED).add_modifier(Modifier::BOLD)
}
