use ratatui::{
    layout::{Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, List, ListItem, Paragraph},
    Frame,
};

use crate::{common::OnboardingStep, AppState};

pub fn render_onboarding_wizard(f: &mut Frame, state: &AppState, area: Rect) {
    let wizard_chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(4),
            Constraint::Min(12),
            Constraint::Length(4),
        ])
        .split(area);

    // 1. Stepper Bar
    let (s1, s2, s3, s4) = match state.onboarding_step {
        OnboardingStep::SelectBlueprint => (Color::Cyan, Color::DarkGray, Color::DarkGray, Color::DarkGray),
        OnboardingStep::ConfigureProvider => (Color::Green, Color::Cyan, Color::DarkGray, Color::DarkGray),
        OnboardingStep::SelectProjectMode => (Color::Green, Color::Green, Color::Cyan, Color::DarkGray),
        OnboardingStep::VerifyFindings => (Color::Green, Color::Green, Color::Green, Color::Cyan),
    };

    let stepper_lines = vec![
        Line::from(vec![
            Span::styled(
                "STEP 1: BLUEPRINT",
                Style::default().fg(s1).add_modifier(if state.onboarding_step == OnboardingStep::SelectBlueprint {
                    Modifier::BOLD | Modifier::UNDERLINED
                } else {
                    Modifier::BOLD
                }),
            ),
            Span::styled("  ➔  ", Style::default().fg(Color::DarkGray)),
            Span::styled(
                "STEP 2: PROVIDERS",
                Style::default().fg(s2).add_modifier(if state.onboarding_step == OnboardingStep::ConfigureProvider {
                    Modifier::BOLD | Modifier::UNDERLINED
                } else {
                    Modifier::BOLD
                }),
            ),
            Span::styled("  ➔  ", Style::default().fg(Color::DarkGray)),
            Span::styled(
                "STEP 3: PROJECT LINK",
                Style::default().fg(s3).add_modifier(if state.onboarding_step == OnboardingStep::SelectProjectMode {
                    Modifier::BOLD | Modifier::UNDERLINED
                } else {
                    Modifier::BOLD
                }),
            ),
            Span::styled("  ➔  ", Style::default().fg(Color::DarkGray)),
            Span::styled(
                "STEP 4: ROADMAP VERIFY",
                Style::default().fg(s4).add_modifier(if state.onboarding_step == OnboardingStep::VerifyFindings {
                    Modifier::BOLD | Modifier::UNDERLINED
                } else {
                    Modifier::BOLD
                }),
            ),
        ]),
        Line::from(Span::styled(
            "Configure your autonomous enterprise operations and engineering workspace",
            Style::default().fg(Color::Gray),
        )),
    ];

    let stepper_block = Paragraph::new(stepper_lines).block(
        Block::default()
            .title(" NEIMAN OS :: INTERACTIVE ONBOARDING WIZARD ")
            .borders(Borders::ALL)
            .border_style(Style::default().fg(Color::Cyan)),
    );
    f.render_widget(stepper_block, wizard_chunks[0]);

    // 2. Main Step Content
    match state.onboarding_step {
        OnboardingStep::SelectBlueprint => {
            let options = [
                (
                    "Autonomous Software Company",
                    "Full-stack workforce: Product Manager, Architect, Developers, QA, Security",
                ),
                (
                    "Cyber Defense Operation",
                    "Security swarm: Policy Enforcer, Threat Hunter, Red Team, Auditor",
                ),
                (
                    "Lean Agency Swarm",
                    "Rapid product delivery: Lead Engineer, Full-Stack Developer, Design Specialist",
                ),
            ];

            let mut items = Vec::new();
            items.push(ListItem::new(Line::from(vec![Span::styled(
                "Select an organizational archetype blueprint to bootstrap:",
                Style::default().fg(Color::White).add_modifier(Modifier::BOLD),
            )])));
            items.push(ListItem::new(Line::from("")));

            for (i, (title, desc)) in options.iter().enumerate() {
                let is_sel = i == state.onboarding_selection;
                let prefix = if is_sel { "▶ " } else { "  " };
                let num = format!("[{}] ", i + 1);
                let title_style = if is_sel {
                    Style::default().fg(Color::Green).add_modifier(Modifier::BOLD)
                } else {
                    Style::default().fg(Color::White)
                };
                items.push(ListItem::new(Line::from(vec![
                    Span::styled(prefix, Style::default().fg(Color::Green).add_modifier(Modifier::BOLD)),
                    Span::styled(num, Style::default().fg(Color::Yellow)),
                    Span::styled(*title, title_style),
                ])));
                items.push(ListItem::new(Line::from(vec![
                    Span::raw("      "),
                    Span::styled(*desc, Style::default().fg(Color::DarkGray)),
                ])));
                items.push(ListItem::new(Line::from("")));
            }

            let list = List::new(items).block(
                Block::default()
                    .title(" Step 1: Select Enterprise Blueprint ")
                    .borders(Borders::ALL)
                    .border_style(Style::default().fg(Color::Cyan)),
            );
            f.render_widget(list, wizard_chunks[1]);
        }
        OnboardingStep::ConfigureProvider => {
            let env_openai = std::env::var("OPENAI_API_KEY").is_ok();
            let env_anthropic = std::env::var("ANTHROPIC_API_KEY").is_ok();
            let env_gemini = std::env::var("GEMINI_API_KEY").is_ok();
            let env_groq = std::env::var("GROQ_API_KEY").is_ok();
            let env_openrouter = std::env::var("OPENROUTER_API_KEY").is_ok();

            let auto_detected_label = if env_openai {
                "OpenAI (OPENAI_API_KEY detected)"
            } else if env_anthropic {
                "Anthropic (ANTHROPIC_API_KEY detected)"
            } else if env_gemini {
                "Google Gemini (GEMINI_API_KEY detected)"
            } else if env_groq {
                "Groq (GROQ_API_KEY detected)"
            } else if env_openrouter {
                "OpenRouter (OPENROUTER_API_KEY detected)"
            } else {
                "Local AI Adapter (Ollama / vLLM fallback on localhost:11434)"
            };

            let options = [
                ("Auto-detect Credentials (Recommended)", auto_detected_label),
                ("OpenAI", "Uses OPENAI_API_KEY or api.openai.com for GPT-4o / o1"),
                ("Anthropic", "Uses ANTHROPIC_API_KEY or api.anthropic.com for Claude 3.5 Sonnet"),
                ("Google Gemini", "Uses GEMINI_API_KEY for Gemini 1.5 Pro"),
                ("OpenRouter / Groq", "Uses OPENROUTER_API_KEY or GROQ_API_KEY for open routing"),
                ("Local Ollama / vLLM", "Local air-gapped inference on http://localhost:11434"),
            ];

            let mut items = Vec::new();
            items.push(ListItem::new(Line::from(vec![Span::styled(
                "Select LLM inference and intelligence routing provider:",
                Style::default().fg(Color::White).add_modifier(Modifier::BOLD),
            )])));
            items.push(ListItem::new(Line::from(vec![
                Span::styled("Environment key detection: ", Style::default().fg(Color::DarkGray)),
                Span::styled("OpenAI: ", Style::default().fg(Color::DarkGray)),
                Span::styled(
                    if env_openai { "SET " } else { "NO " },
                    Style::default().fg(if env_openai { Color::Green } else { Color::Red }),
                ),
                Span::styled("| Anthropic: ", Style::default().fg(Color::DarkGray)),
                Span::styled(
                    if env_anthropic { "SET " } else { "NO " },
                    Style::default().fg(if env_anthropic { Color::Green } else { Color::Red }),
                ),
                Span::styled("| Gemini: ", Style::default().fg(Color::DarkGray)),
                Span::styled(
                    if env_gemini { "SET " } else { "NO " },
                    Style::default().fg(if env_gemini { Color::Green } else { Color::Red }),
                ),
                Span::styled("| Local Ollama: ", Style::default().fg(Color::DarkGray)),
                Span::styled("READY", Style::default().fg(Color::Cyan)),
            ])));
            items.push(ListItem::new(Line::from("")));

            for (i, (title, desc)) in options.iter().enumerate() {
                let is_sel = i == state.onboarding_selection;
                let prefix = if is_sel { "▶ " } else { "  " };
                let num = format!("[{}] ", i + 1);
                let title_style = if is_sel {
                    Style::default().fg(Color::Green).add_modifier(Modifier::BOLD)
                } else {
                    Style::default().fg(Color::White)
                };
                items.push(ListItem::new(Line::from(vec![
                    Span::styled(prefix, Style::default().fg(Color::Green).add_modifier(Modifier::BOLD)),
                    Span::styled(num, Style::default().fg(Color::Yellow)),
                    Span::styled(*title, title_style),
                ])));
                items.push(ListItem::new(Line::from(vec![
                    Span::raw("      "),
                    Span::styled(*desc, Style::default().fg(Color::DarkGray)),
                ])));
                items.push(ListItem::new(Line::from("")));
            }

            let list = List::new(items).block(
                Block::default()
                    .title(" Step 2: Configure Model Provider ")
                    .borders(Borders::ALL)
                    .border_style(Style::default().fg(Color::Cyan)),
            );
            f.render_widget(list, wizard_chunks[1]);
        }
        OnboardingStep::SelectProjectMode => {
            let cwd = std::env::current_dir()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_else(|_| ".".to_string());

            let options = [
                (
                    "Scan & Link Current Working Folder",
                    format!(
                        "Inspect '{}', detect languages/manifests, and formulate task DAG",
                        cwd
                    ),
                ),
                (
                    "Create Blank Custom Initiative",
                    "Define a custom project from scratch with new goals".to_string(),
                ),
                (
                    "Use Blueprint Pre-Seeded Projects",
                    "Bootstrap from pre-configured domain projects included in blueprint".to_string(),
                ),
            ];

            let mut items = Vec::new();
            items.push(ListItem::new(Line::from(vec![Span::styled(
                "Choose engineering project workspace link mode:",
                Style::default().fg(Color::White).add_modifier(Modifier::BOLD),
            )])));
            items.push(ListItem::new(Line::from("")));

            for (i, (title, desc)) in options.iter().enumerate() {
                let is_sel = i == state.onboarding_selection;
                let prefix = if is_sel { "▶ " } else { "  " };
                let num = format!("[{}] ", i + 1);
                let title_style = if is_sel {
                    Style::default().fg(Color::Green).add_modifier(Modifier::BOLD)
                } else {
                    Style::default().fg(Color::White)
                };
                items.push(ListItem::new(Line::from(vec![
                    Span::styled(prefix, Style::default().fg(Color::Green).add_modifier(Modifier::BOLD)),
                    Span::styled(num, Style::default().fg(Color::Yellow)),
                    Span::styled(*title, title_style),
                ])));
                items.push(ListItem::new(Line::from(vec![
                    Span::raw("      "),
                    Span::styled(desc, Style::default().fg(Color::DarkGray)),
                ])));
                items.push(ListItem::new(Line::from("")));
            }

            let list = List::new(items).block(
                Block::default()
                    .title(" Step 3: Select Project Setup Mode ")
                    .borders(Borders::ALL)
                    .border_style(Style::default().fg(Color::Cyan)),
            );
            f.render_widget(list, wizard_chunks[1]);
        }
        OnboardingStep::VerifyFindings => {
            let mut items = Vec::new();
            if let Some(insp) = &state.onboarding_inspection {
                items.push(ListItem::new(Line::from(vec![Span::styled(
                    "REPOSITORY INSPECTION FINDINGS",
                    Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD),
                )])));
                items.push(ListItem::new(Line::from(vec![
                    Span::styled("• Path       : ", Style::default().fg(Color::Yellow)),
                    Span::styled(&insp.target_path, Style::default().fg(Color::White)),
                ])));
                items.push(ListItem::new(Line::from(vec![
                    Span::styled("• Repository : ", Style::default().fg(Color::Yellow)),
                    Span::styled(
                        format!(
                            "{} (Branch: {}, Commit: {})",
                            insp.project_name,
                            insp.git_branch.as_deref().unwrap_or("main"),
                            insp.git_commit.as_deref().unwrap_or("HEAD")
                        ),
                        Style::default().fg(Color::White),
                    ),
                ])));
                items.push(ListItem::new(Line::from(vec![
                    Span::styled("• Language   : ", Style::default().fg(Color::Yellow)),
                    Span::styled(
                        format!(
                            "{} | Frameworks: [{}]",
                            insp.primary_language,
                            insp.detected_frameworks.join(", ")
                        ),
                        Style::default().fg(Color::Green),
                    ),
                ])));
                items.push(ListItem::new(Line::from(vec![
                    Span::styled("• Components : ", Style::default().fg(Color::Yellow)),
                    Span::styled(
                        format!("[{}]", insp.key_components.join(", ")),
                        Style::default().fg(Color::White),
                    ),
                ])));
                items.push(ListItem::new(Line::from(vec![
                    Span::styled("• Summary    : ", Style::default().fg(Color::Yellow)),
                    Span::styled(&insp.summary, Style::default().fg(Color::White)),
                ])));
                items.push(ListItem::new(Line::from("")));

                items.push(ListItem::new(Line::from(vec![Span::styled(
                    "AUTONOMOUS CTO ROADMAP TASKS FORMULATED FOR REPOSITORY",
                    Style::default().fg(Color::Green).add_modifier(Modifier::BOLD),
                )])));
                if state.onboarding_generated_tasks.is_empty() {
                    items.push(ListItem::new(Line::from(vec![Span::styled(
                        "  • Initial workspace audit & dependency verification",
                        Style::default().fg(Color::White),
                    )])));
                    items.push(ListItem::new(Line::from(vec![Span::styled(
                        "  • Test harness and coverage validation",
                        Style::default().fg(Color::White),
                    )])));
                    items.push(ListItem::new(Line::from(vec![Span::styled(
                        "  • Autonomous feature delivery pipeline setup",
                        Style::default().fg(Color::White),
                    )])));
                } else {
                    for t in &state.onboarding_generated_tasks {
                        items.push(ListItem::new(Line::from(vec![
                            Span::styled("  • ", Style::default().fg(Color::Green)),
                            Span::styled(t, Style::default().fg(Color::White)),
                        ])));
                    }
                }
            } else {
                items.push(ListItem::new(Line::from("No workspace inspection data available.")));
            }

            let list = List::new(items).block(
                Block::default()
                    .title(" Step 4: Verify Findings & Approve Roadmap ")
                    .borders(Borders::ALL)
                    .border_style(Style::default().fg(Color::Green)),
            );
            f.render_widget(list, wizard_chunks[1]);
        }
    }

    // 3. Status Feedback & Key Hint Box
    let hint_text = match state.onboarding_step {
        OnboardingStep::VerifyFindings => {
            "Press [Enter] or [y] to APPROVE ROADMAP & LAUNCH WORKFORCE. Press [Esc] to exit wizard."
        }
        _ => "Use [↑/↓/j/k] to navigate, [1-9] for quick selection, [Enter/y] to confirm & advance, [Esc] to cancel.",
    };

    let status_paragraph = Paragraph::new(vec![
        Line::from(vec![
            Span::styled("STATUS: ", Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD)),
            Span::styled(&state.onboarding_status_text, Style::default().fg(Color::White)),
        ]),
        Line::from(Span::styled(hint_text, Style::default().fg(Color::Cyan))),
    ])
    .block(
        Block::default()
            .borders(Borders::ALL)
            .border_style(Style::default().fg(Color::DarkGray)),
    );
    f.render_widget(status_paragraph, wizard_chunks[2]);
}
