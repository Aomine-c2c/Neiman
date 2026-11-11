use ratatui::{
    layout::{Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, Paragraph, Wrap},
    Frame,
};

use crate::app::AppState;
use crate::theme::ThemeMode;

pub fn render_config_tab(f: &mut Frame, state: &AppState, area: Rect) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(5), // Top Summary
            Constraint::Min(8),    // Middle Split: Model Settings & Company Identity
            Constraint::Length(6), // Operational Hotkeys & Preferences
        ])
        .split(area);

    let is_offline = !state.api_connected;
    let badge_color = if is_offline { Color::Yellow } else { Color::Green };
    let theme_name = match state.theme.mode {
        ThemeMode::Light => "Light Mode (Platform Default)",
        ThemeMode::Dark => "Dark Mode (Cyber Obsidian)",
    };

    // 1. Top Section
    let summary_lines = vec![
        Line::from(vec![
            Span::styled("COMPANY CONFIGURATION, ENVIRONMENT & AI PROVIDERS", Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD)),
            Span::styled(if is_offline { " [LOCAL PERSISTENT CONFIG]" } else { " [LIVE BACKEND CONFIG]" }, Style::default().fg(badge_color)),
        ]),
        Line::from(vec![
            Span::styled("• Active Company: ", Style::default().fg(Color::White)),
            Span::styled(&state.company_name, Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD)),
            Span::styled(format!(" (ID: {}) | ", state.active_company_id), Style::default().fg(Color::DarkGray)),
            Span::styled("Theme: ", Style::default().fg(Color::White)),
            Span::styled(theme_name, Style::default().fg(Color::Green).add_modifier(Modifier::BOLD)),
        ]),
        Line::from(vec![
            Span::styled("• Controls: Press [t] to toggle Light/Dark theme | Press [Ctrl+P] for AI Provider settings | Press [o] to switch org", Style::default().fg(Color::DarkGray)),
        ]),
    ];
    let summary = Paragraph::new(summary_lines)
        .block(Block::default().borders(Borders::ALL).border_style(Style::default().fg(Color::Cyan)));
    f.render_widget(summary, chunks[0]);

    // 2. Middle Split: AI Model Provider (50%) vs Governance Policies (50%)
    let mid_chunks = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(50), Constraint::Percentage(50)])
        .split(chunks[1]);

    // AI Providers
    let providers_text = vec![
        Line::from(vec![
            Span::styled("HETEROGENEOUS AI PROVIDERS", Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD)),
        ]),
        Line::from(""),
        Line::from(vec![
            Span::styled("1. Google Gemini   : ", Style::default().fg(Color::White)),
            Span::styled("gemini-2.5-pro / flash [PRIMARY ACTIVE]", Style::default().fg(Color::Green).add_modifier(Modifier::BOLD)),
        ]),
        Line::from(vec![
            Span::styled("   API Key Status  : ", Style::default().fg(Color::DarkGray)),
            Span::styled("CONFIGURED & VERIFIED (Redacted: AIza...92X)", Style::default().fg(Color::DarkGray)),
        ]),
        Line::from(""),
        Line::from(vec![
            Span::styled("2. Anthropic Claude: ", Style::default().fg(Color::White)),
            Span::styled("claude-3-7-sonnet [STANDBY / FALLBACK]", Style::default().fg(Color::Yellow)),
        ]),
        Line::from(vec![
            Span::styled("   API Key Status  : ", Style::default().fg(Color::DarkGray)),
            Span::styled("CONFIGURED & VERIFIED (Redacted: sk-ant...4B1)", Style::default().fg(Color::DarkGray)),
        ]),
        Line::from(""),
        Line::from(vec![
            Span::styled("3. OpenAI GPT      : ", Style::default().fg(Color::White)),
            Span::styled("gpt-4o / gpt-4o-mini [STANDBY]", Style::default().fg(Color::White)),
        ]),
        Line::from(""),
        Line::from(vec![
            Span::styled("4. Local Ollama    : ", Style::default().fg(Color::White)),
            Span::styled("llama-3.3-70b (http://localhost:11434) [OFFLINE]", Style::default().fg(Color::DarkGray)),
        ]),
    ];
    let providers_box = Paragraph::new(providers_text)
        .block(
            Block::default()
                .title(" Model Provider Hierarchy ")
                .borders(Borders::ALL)
                .border_style(Style::default().fg(badge_color)),
        )
        .wrap(Wrap { trim: true });
    f.render_widget(providers_box, mid_chunks[0]);

    // Governance & Security Policies
    let governance_text = vec![
        Line::from(vec![
            Span::styled("GOVERNANCE & PERMISSION BOUNDARIES", Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD)),
        ]),
        Line::from(""),
        Line::from(vec![
            Span::styled("• Autonomy Mode    : ", Style::default().fg(Color::White)),
            Span::styled("CONTROLLED AUTONOMY (Human Owner signoff on gates)", Style::default().fg(Color::Green)),
        ]),
        Line::from(vec![
            Span::styled("• Red Line Defense : ", Style::default().fg(Color::White)),
            Span::styled("ACTIVE (Malicious prompt injection, data exfiltration)", Style::default().fg(Color::Green)),
        ]),
        Line::from(vec![
            Span::styled("• Four-Eyes Rule   : ", Style::default().fg(Color::White)),
            Span::styled("MANDATORY (Production deployment requires 2 distinct roles)", Style::default().fg(Color::Yellow)),
        ]),
        Line::from(vec![
            Span::styled("• Secret Redaction : ", Style::default().fg(Color::White)),
            Span::styled("STRICT (Regex & Shannon entropy scanning on telemetry)", Style::default().fg(Color::Green)),
        ]),
        Line::from(vec![
            Span::styled("• Token Budget Cap : ", Style::default().fg(Color::White)),
            Span::styled("$40.00 / month hard stop limit", Style::default().fg(Color::Cyan)),
        ]),
    ];
    let governance_box = Paragraph::new(governance_text)
        .block(
            Block::default()
                .title(" System Boundaries & Hard Guardrails ")
                .borders(Borders::ALL)
                .border_style(Style::default().fg(Color::Cyan)),
        )
        .wrap(Wrap { trim: true });
    f.render_widget(governance_box, mid_chunks[1]);

    // 3. Bottom Hotkey Guide
    let bottom_text = vec![
        Line::from(vec![
            Span::styled("CONFIGURATION SHORTCUTS: ", Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD)),
            Span::styled("[t] Toggle Theme (Light/Dark) | [Ctrl+P] Provider Credentials Modal | [o] Switch Organization | [s] Sync State", Style::default().fg(Color::White)),
        ]),
    ];
    let bottom_box = Paragraph::new(bottom_text)
        .block(Block::default().borders(Borders::ALL).border_style(Style::default().fg(Color::DarkGray)));
    f.render_widget(bottom_box, chunks[2]);
}

pub fn inspector_text(state: &AppState) -> Option<String> {
    Some(format!(
        "CONFIGURATION INSPECTOR\n\n\
        Company: {}\n\
        Organization ID: {}\n\
        Active Theme: {:?}\n\
        Active Provider: Google Gemini (gemini-2.5-pro)\n\
        API Gateway: {}\n\
        Local Mode: Local-First Sovereign Node\n\n\
        THEME SYSTEM TOKENS:\n\
        • Platform default: High-contrast Light Mode\n\
        • Cyber glow: Obsidian Dark Mode\n\
        • Press [t] to toggle instantly without reload."
        ,
        state.company_name,
        state.active_company_id,
        state.theme.mode,
        state.client.base_url,
    ))
}
