use ratatui::{
    layout::{Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, List, ListItem, Paragraph, Wrap},
    Frame,
};

use crate::AppState;
use crate::common::FocusPane;
use super::git::EngineeringSection;

pub const COLOR_CYAN: Color = Color::Rgb(14, 243, 206);
pub const COLOR_BG_CARD: Color = Color::Rgb(0, 35, 35);

/// Docked presentation of the Engineering Execution Pane (participates in 3-column Cockpit)
pub fn render_engineering_execution_docked_pane(f: &mut Frame, state: &AppState, area: Rect) {
    let is_focused = state.is_nav_mode && state.focus_pane == FocusPane::Engineering;
    let eng = &state.engineering_state;

    let mut lines = Vec::new();

    if !eng.is_git_available {
        lines.push(Line::from(vec![
            Span::styled("○ GIT INTEGRATION UNAVAILABLE", Style::default().fg(Color::Red).add_modifier(Modifier::BOLD)),
        ]));
        let err_msg = eng.git_error.as_deref().unwrap_or("No Git repository linked.");
        lines.push(Line::from(vec![
            Span::styled(err_msg, Style::default().fg(Color::DarkGray)),
        ]));
        lines.push(Line::from(vec![
            Span::styled("Press [Ctrl+O] to link active codebase.", Style::default().fg(COLOR_CYAN)),
        ]));
    } else {
        // Line 1: Repo & Branch
        let branch_color = if eng.current_branch == "main" || eng.current_branch == "master" {
            Color::Green
        } else {
            Color::Yellow
        };
        lines.push(Line::from(vec![
            Span::styled("⎇ REPO: ", Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD)),
            Span::styled(&eng.repo_name, Style::default().fg(Color::White).add_modifier(Modifier::BOLD)),
            Span::styled(" @ ", Style::default().fg(Color::DarkGray)),
            Span::styled(format!("[{}]", eng.current_branch), Style::default().fg(branch_color).add_modifier(Modifier::BOLD)),
        ]));

        // Line 2: Working Tree State & Change Counts
        let (tree_color, tree_badge) = if eng.files_changed.is_empty() {
            (Color::Green, "● CLEAN")
        } else {
            (Color::Yellow, "◐ MODIFIED")
        };
        let total_adds: usize = eng.files_changed.iter().map(|f| f.additions).sum();
        let total_dels: usize = eng.files_changed.iter().map(|f| f.deletions).sum();

        lines.push(Line::from(vec![
            Span::styled("  Tree: ", Style::default().fg(Color::DarkGray)),
            Span::styled(format!("{} ", tree_badge), Style::default().fg(tree_color).add_modifier(Modifier::BOLD)),
            Span::styled(format!("({} files: ", eng.files_changed.len()), Style::default().fg(Color::DarkGray)),
            Span::styled(format!("+{}", total_adds), Style::default().fg(Color::Green)),
            Span::styled(" / ", Style::default().fg(Color::DarkGray)),
            Span::styled(format!("-{}", total_dels), Style::default().fg(Color::Red)),
            Span::styled(")", Style::default().fg(Color::DarkGray)),
        ]));

        // Line 3: Active Implementation Task & Worker
        let task_disp = if let Some(t_title) = &eng.current_task_title {
            let short = crate::common::truncate_str(t_title, 18);
            format!("Task: {}", short)
        } else if let Some(t) = state.tasks.iter().find(|t| t.status == "IN_PROGRESS" || t.status == "WORKING") {
            let short = crate::common::truncate_str(&t.title, 18);
            format!("Task: {}", short)
        } else {
            "Task: [Idle / Ready]".to_string()
        };

        let agent_disp = if let Some(a_name) = &eng.assigned_agent {
            format!(" -> @{}", a_name)
        } else if let Some(t) = state.tasks.iter().find(|t| t.status == "IN_PROGRESS") {
            format!(" -> @{}", t.assigned_agent)
        } else {
            String::new()
        };

        lines.push(Line::from(vec![
            Span::styled(format!("  ↳ {}", task_disp), Style::default().fg(Color::White)),
            Span::styled(agent_disp, Style::default().fg(COLOR_CYAN)),
        ]));

        // Line 4: Build & Test Status
        let (test_badge, test_color) = if let Some(report) = &eng.test_report {
            match report.status.as_str() {
                "PASSED" => (format!("✓ VERIFIED ({} passed)", report.passed), Color::Green),
                "FAILED" => (format!("✗ FAILED ({}/{} failed)", report.failed, report.total), Color::Red),
                "RUNNING" => ("⠋ EXECUTING SUITE...".to_string(), COLOR_CYAN),
                _ => ("○ NO RUNS ON RECORD".to_string(), Color::DarkGray),
            }
        } else {
            ("○ NO RUNS ON RECORD".to_string(), Color::DarkGray)
        };

        lines.push(Line::from(vec![
            Span::styled("  Verification: ", Style::default().fg(Color::DarkGray)),
            Span::styled(test_badge, Style::default().fg(test_color).add_modifier(Modifier::BOLD)),
        ]));

        // Line 5: Last Verified & Controls Hint
        let last_ts = eng.test_report.as_ref()
            .and_then(|r| r.last_verified_at.as_deref())
            .unwrap_or("Never");
        lines.push(Line::from(vec![
            Span::styled(format!("  Checked: {} ", last_ts), Style::default().fg(Color::DarkGray)),
            Span::styled("[Space: Diff] [z: Zoom]", Style::default().fg(COLOR_CYAN)),
        ]));
    }

    let title = if area.width < 25 {
        " ⚙ ENG ".to_string()
    } else {
        match state.connection_state {
            crate::common::ConnectionState::Connected => " ⚙ ENGINEERING EXECUTION ".to_string(),
            crate::common::ConnectionState::Connecting => " ⚙ ENGINEERING EXECUTION [CONNECTING...] ".to_string(),
            crate::common::ConnectionState::Degraded => " ⚙ ENGINEERING EXECUTION [DEGRADED] ".to_string(),
            crate::common::ConnectionState::Offline => " ⚙ ENGINEERING EXECUTION [OFFLINE] ".to_string(),
        }
    };

    let block = Block::default()
        .title(title)
        .borders(Borders::ALL)
        .border_style(Style::default().fg(if is_focused { COLOR_CYAN } else { Color::DarkGray }));

    f.render_widget(Paragraph::new(lines).block(block).wrap(Wrap { trim: false }), area);
}

/// Full Split-Pane Engineering Workbench (used for Tab 5 and when zoomed/maximized)
pub fn render_engineering_workbench_tab(f: &mut Frame, state: &AppState, area: Rect) {
    let _eng = &state.engineering_state;

    // Split: Header (3 lines) + Body (Rest)
    let main_layout = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Length(3), Constraint::Min(10)])
        .split(area);

    // 1. Top Header: Repository & Lifecycle Summary Bar
    render_engineering_header_bar(f, state, main_layout[0]);

    // 2. Body: Split into Left Column (File list + Commits/PRs) and Right Column (Diff Viewer + Tests)
    let body_columns = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(35), Constraint::Percentage(65)])
        .split(main_layout[1]);

    // Left Column split: File Changes (60%) + Recent Commits & PRs (40%)
    let left_chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Percentage(60), Constraint::Percentage(40)])
        .split(body_columns[0]);

    render_file_change_list(f, state, left_chunks[0]);
    render_commits_and_reviews(f, state, left_chunks[1]);

    // Right Column split: Unified Diff Viewer (60%) + Build/Test Activity (40%)
    let right_chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Percentage(60), Constraint::Percentage(40)])
        .split(body_columns[1]);

    render_diff_viewer(f, state, right_chunks[0]);
    render_test_activity(f, state, right_chunks[1]);
}

/// Top Header: Lifecycle summary bar
fn render_engineering_header_bar(f: &mut Frame, state: &AppState, area: Rect) {
    let eng = &state.engineering_state;
    let is_focused = state.is_nav_mode && state.focus_pane == FocusPane::Engineering;

    let branch_badge = Span::styled(
        format!(" ⎇ {} ", eng.current_branch),
        Style::default().fg(Color::Black).bg(Color::Green).add_modifier(Modifier::BOLD),
    );

    let tree_badge = if eng.files_changed.is_empty() {
        Span::styled(" [TREE: CLEAN] ", Style::default().fg(Color::Green).add_modifier(Modifier::BOLD))
    } else {
        Span::styled(format!(" [TREE: {} MODIFIED] ", eng.files_changed.len()), Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD))
    };

    let test_badge = if let Some(report) = &eng.test_report {
        if report.failed > 0 {
            Span::styled(format!(" [TESTS: ✗ {}/{} FAILED] ", report.failed, report.total), Style::default().fg(Color::White).bg(Color::Red).add_modifier(Modifier::BOLD))
        } else if report.passed > 0 {
            Span::styled(format!(" [TESTS: ✓ {}/{} PASSED] ", report.passed, report.total), Style::default().fg(Color::Black).bg(Color::Green).add_modifier(Modifier::BOLD))
        } else {
            Span::styled(" [TESTS: IDLE] ", Style::default().fg(Color::DarkGray))
        }
    } else {
        Span::styled(" [TESTS: NO RECORD] ", Style::default().fg(Color::DarkGray))
    };

    let sec_badge = if let Some(sec) = &eng.security_scan {
        if sec.status == "BLOCKED" || !sec.red_line_violations.is_empty() {
            Span::styled(" [SEC: BLOCKED ✗] ", Style::default().fg(Color::White).bg(Color::Red).add_modifier(Modifier::BOLD))
        } else {
            Span::styled(" [SEC: VERIFIED ●] ", Style::default().fg(Color::Black).bg(Color::Green).add_modifier(Modifier::BOLD))
        }
    } else {
        Span::styled(" [SEC: PENDING] ", Style::default().fg(Color::DarkGray))
    };

    let line = Line::from(vec![
        Span::styled(" 🛠 REPO: ", Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD)),
        Span::styled(format!("{} ", eng.repo_name), Style::default().fg(Color::White).add_modifier(Modifier::BOLD)),
        branch_badge,
        Span::raw(" "),
        tree_badge,
        Span::raw(" "),
        test_badge,
        Span::raw(" "),
        sec_badge,
        Span::raw("  "),
        Span::styled("[Tab: Section] [j/k: Select/Scroll] [t: Jump Task] [r: Refresh] [Esc: Back]", Style::default().fg(Color::DarkGray)),
    ]);

    let block = Block::default()
        .borders(Borders::ALL)
        .border_style(Style::default().fg(if is_focused { COLOR_CYAN } else { Color::DarkGray }));

    f.render_widget(Paragraph::new(line).block(block), area);
}

/// Left-Upper: File-change list with additions/deletions and selector
fn render_file_change_list(f: &mut Frame, state: &AppState, area: Rect) {
    let eng = &state.engineering_state;
    let is_section_focused = eng.active_section == EngineeringSection::Files;

    let mut items = Vec::new();

    if !eng.is_git_available {
        items.push(ListItem::new(Line::from(vec![
            Span::styled("○ Git repository unavailable.", Style::default().fg(Color::Red)),
        ])));
        items.push(ListItem::new(Line::from(vec![
            Span::styled("Ensure target directory is a Git workspace.", Style::default().fg(Color::DarkGray)),
        ])));
    } else if eng.files_changed.is_empty() {
        items.push(ListItem::new(Line::from(vec![
            Span::styled("✓ Working tree clean.", Style::default().fg(Color::Green)),
        ])));
        items.push(ListItem::new(Line::from(vec![
            Span::styled("No uncommitted changes in current branch.", Style::default().fg(Color::DarkGray)),
        ])));
    } else {
        for (i, file) in eng.files_changed.iter().enumerate() {
            let is_sel = i == eng.selected_file_idx;
            let pointer = if is_sel { "▶ " } else { "  " };

            let (status_badge, status_color) = match file.status.as_str() {
                "M" => ("[M]", Color::Yellow),
                "A" => ("[A]", Color::Green),
                "D" => ("[D]", Color::Red),
                "R" => ("[R]", Color::Blue),
                "??" => ("[?]", Color::Magenta),
                _ => ("[·]", Color::White),
            };

            let short_path = if file.path.len() > 26 {
                format!("…{}", &file.path[file.path.len() - 24..])
            } else {
                file.path.clone()
            };

            let line = Line::from(vec![
                Span::styled(pointer, Style::default().fg(if is_sel { COLOR_CYAN } else { Color::DarkGray })),
                Span::styled(format!("{} ", status_badge), Style::default().fg(status_color).add_modifier(Modifier::BOLD)),
                Span::styled(format!("{:<26} ", short_path), Style::default().fg(if is_sel { Color::White } else { Color::Gray })),
                Span::styled(format!("+{}", file.additions), Style::default().fg(Color::Green)),
                Span::styled(" ", Style::default()),
                Span::styled(format!("-{}", file.deletions), Style::default().fg(Color::Red)),
            ]);

            items.push(ListItem::new(line));
        }
    }

    let title = format!(" 📁 MODIFIED FILES ({}) ", eng.files_changed.len());
    let block = Block::default()
        .title(title)
        .borders(Borders::ALL)
        .border_style(Style::default().fg(if is_section_focused { COLOR_CYAN } else { Color::DarkGray }));

    f.render_widget(List::new(items).block(block), area);
}

/// Left-Lower: Recent commits, Pull Requests & Code Review
fn render_commits_and_reviews(f: &mut Frame, state: &AppState, area: Rect) {
    let eng = &state.engineering_state;
    let is_section_focused = eng.active_section == EngineeringSection::Commits;

    let mut lines = Vec::new();

    // 1. Recent Commits
    lines.push(Line::from(vec![
        Span::styled("RECENT COMMITS:", Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD)),
    ]));

    if eng.recent_commits.is_empty() {
        lines.push(Line::from(vec![
            Span::styled("  • No commits found on record.", Style::default().fg(Color::DarkGray)),
        ]));
    } else {
        for c in eng.recent_commits.iter().take(4) {
            let short_msg = crate::common::truncate_str(&c.message, 28);
            lines.push(Line::from(vec![
                Span::styled(format!("  {} ", c.sha), Style::default().fg(COLOR_CYAN)),
                Span::styled(short_msg, Style::default().fg(Color::White)),
                Span::styled(format!(" ({})", c.author), Style::default().fg(Color::DarkGray)),
            ]));
        }
    }

    // 2. Pull Requests & Code Review Status
    lines.push(Line::from(""));
    lines.push(Line::from(vec![
        Span::styled("PULL REQUESTS & CODE REVIEW:", Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD)),
    ]));

    if eng.pull_requests.is_empty() {
        lines.push(Line::from(vec![
            Span::styled("  • No active PRs. Working on direct feature branch.", Style::default().fg(Color::DarkGray)),
        ]));
    } else {
        for pr in eng.pull_requests.iter().take(2) {
            let (rev_badge, rev_color) = match pr.review_status.as_str() {
                "APPROVED" => ("[REVIEW: APPROVED]", Color::Green),
                "CHANGES_REQUESTED" => ("[CHANGES REQUESTED]", Color::Red),
                _ => ("[IN REVIEW]", Color::Yellow),
            };
            lines.push(Line::from(vec![
                Span::styled(format!("  PR #{}: ", pr.id), Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD)),
                Span::styled(format!("{} ", pr.title), Style::default().fg(Color::White)),
                Span::styled(rev_badge, Style::default().fg(rev_color).add_modifier(Modifier::BOLD)),
            ]));
        }
    }

    let block = Block::default()
        .title(" 🔀 COMMITS & CODE REVIEW ")
        .borders(Borders::ALL)
        .border_style(Style::default().fg(if is_section_focused { COLOR_CYAN } else { Color::DarkGray }));

    f.render_widget(Paragraph::new(lines).block(block).wrap(Wrap { trim: false }), area);
}

/// Right-Upper: Unified Diff Viewer with Syntax Highlighting and Scrolling
fn render_diff_viewer(f: &mut Frame, state: &AppState, area: Rect) {
    let eng = &state.engineering_state;
    let is_section_focused = eng.active_section == EngineeringSection::Diff;

    let selected_file = eng.files_changed.get(eng.selected_file_idx);

    let mut lines = Vec::new();

    if let Some(file) = selected_file {
        if file.diff_content.is_empty() {
            lines.push(Line::from(vec![
                Span::styled("No unified diff available for this file.", Style::default().fg(Color::DarkGray)),
            ]));
            lines.push(Line::from(vec![
                Span::styled("File may be newly added or untracked. Press [Space] to refresh.", Style::default().fg(COLOR_CYAN)),
            ]));
        } else {
            // Apply diff syntax highlighting
            for (idx, diff_line) in file.diff_content.lines().skip(eng.diff_scroll).take(area.height.saturating_sub(2) as usize).enumerate() {
                let line_num = eng.diff_scroll + idx + 1;
                let gutter = format!("{:>3} │ ", line_num);

                let styled_line = if diff_line.starts_with('+') && !diff_line.starts_with("+++") {
                    Line::from(vec![
                        Span::styled(gutter, Style::default().fg(Color::DarkGray)),
                        Span::styled(diff_line, Style::default().fg(Color::Green)),
                    ])
                } else if diff_line.starts_with('-') && !diff_line.starts_with("---") {
                    Line::from(vec![
                        Span::styled(gutter, Style::default().fg(Color::DarkGray)),
                        Span::styled(diff_line, Style::default().fg(Color::Red)),
                    ])
                } else if diff_line.starts_with("@@") {
                    Line::from(vec![
                        Span::styled(gutter, Style::default().fg(Color::DarkGray)),
                        Span::styled(diff_line, Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD)),
                    ])
                } else if diff_line.starts_with("diff --git") || diff_line.starts_with("index ") || diff_line.starts_with("---") || diff_line.starts_with("+++") {
                    Line::from(vec![
                        Span::styled(gutter, Style::default().fg(Color::DarkGray)),
                        Span::styled(diff_line, Style::default().fg(Color::DarkGray).add_modifier(Modifier::ITALIC)),
                    ])
                } else {
                    Line::from(vec![
                        Span::styled(gutter, Style::default().fg(Color::DarkGray)),
                        Span::styled(diff_line, Style::default().fg(Color::Gray)),
                    ])
                };

                lines.push(styled_line);
            }
        }
    } else {
        lines.push(Line::from(vec![
            Span::styled("Select a file from the change list to inspect unified diff.", Style::default().fg(Color::DarkGray)),
        ]));
    }

    let file_label = selected_file
        .map(|f| format!(": {} (+{}/-{})", f.path, f.additions, f.deletions))
        .unwrap_or_default();

    let title = format!(" 📄 UNIFIED DIFF VIEWER{} [Scroll: j/k, PgUp/PgDn] ", file_label);
    let block = Block::default()
        .title(title)
        .borders(Borders::ALL)
        .border_style(Style::default().fg(if is_section_focused { COLOR_CYAN } else { Color::DarkGray }));

    f.render_widget(Paragraph::new(lines).block(block), area);
}

/// Right-Lower: Build & Test Activity with real failure diagnostics & task linking
fn render_test_activity(f: &mut Frame, state: &AppState, area: Rect) {
    let eng = &state.engineering_state;
    let is_section_focused = eng.active_section == EngineeringSection::Tests;

    let mut lines = Vec::new();

    if let Some(report) = &eng.test_report {
        let (status_badge, status_color) = match report.status.as_str() {
            "PASSED" => ("✓ TEST SUITE PASSED", Color::Green),
            "FAILED" => ("✗ VERIFICATION CHECKS FAILED", Color::Red),
            "RUNNING" => ("⠋ TEST EXECUTION IN PROGRESS...", COLOR_CYAN),
            _ => ("○ TEST SUITE IDLE", Color::DarkGray),
        };

        let cov_str = report.coverage_pct
            .map(|c| format!("{:.1}%", c))
            .unwrap_or_else(|| "N/A".to_string());

        lines.push(Line::from(vec![
            Span::styled(format!("{}  ", status_badge), Style::default().fg(status_color).add_modifier(Modifier::BOLD)),
            Span::styled(format!("Suite: {} | Latency: {}ms | Coverage: {}", report.suite_name, report.execution_latency_ms, cov_str), Style::default().fg(Color::DarkGray)),
        ]));

        lines.push(Line::from(vec![
            Span::styled(format!("Total: {}  ", report.total), Style::default().fg(Color::White)),
            Span::styled(format!("Passed: {}  ", report.passed), Style::default().fg(Color::Green)),
            Span::styled(format!("Failed: {}  ", report.failed), Style::default().fg(if report.failed > 0 { Color::Red } else { Color::DarkGray })),
            Span::styled(format!("Skipped: {}", report.skipped), Style::default().fg(Color::DarkGray)),
        ]));

        lines.push(Line::from(""));

        // If failures exist, display diagnostic output and action link
        if report.failed > 0 && !report.failure_diagnostics.is_empty() {
            lines.push(Line::from(vec![
                Span::styled("FAILURES & DIAGNOSTIC EVIDENCE:", Style::default().fg(Color::Red).add_modifier(Modifier::BOLD)),
            ]));

            for diag in report.failure_diagnostics.iter().take(2) {
                let loc = match (&diag.file_path, diag.line_number) {
                    (Some(fp), Some(ln)) => format!(" @ {}:{}", fp, ln),
                    (Some(fp), None) => format!(" @ {}", fp),
                    _ => String::new(),
                };

                lines.push(Line::from(vec![
                    Span::styled("  ✗ ", Style::default().fg(Color::Red).add_modifier(Modifier::BOLD)),
                    Span::styled(&diag.test_name, Style::default().fg(Color::White).add_modifier(Modifier::BOLD)),
                    Span::styled(loc, Style::default().fg(Color::DarkGray)),
                ]));

                lines.push(Line::from(vec![
                    Span::styled(format!("    ↳ Error: {}", diag.error_message), Style::default().fg(Color::Yellow)),
                ]));

                if let Some(t_id) = &diag.related_task_id {
                    lines.push(Line::from(vec![
                        Span::styled(format!("    ↳ [t] Navigate to Task [{}]", t_id), Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD)),
                    ]));
                }
            }
        } else if report.failed > 0 {
            lines.push(Line::from(vec![
                Span::styled("Raw Diagnostic Output:", Style::default().fg(Color::Red)),
            ]));
            for l in report.raw_output.lines().take(3) {
                lines.push(Line::from(vec![
                    Span::styled(format!("  {}", l), Style::default().fg(Color::Yellow)),
                ]));
            }
        } else {
            lines.push(Line::from(vec![
                Span::styled("✓ All verification criteria satisfied. Architecture invariants preserved.", Style::default().fg(Color::Green)),
            ]));
            lines.push(Line::from(vec![
                Span::styled("Ready for QA acceptance and release gating.", Style::default().fg(Color::DarkGray)),
            ]));
        }
    } else {
        lines.push(Line::from(vec![
            Span::styled("○ No automated test execution on record for active workspace.", Style::default().fg(Color::DarkGray)),
        ]));
        lines.push(Line::from(vec![
            Span::styled("Press [t] or run /test to trigger verification harness.", Style::default().fg(COLOR_CYAN)),
        ]));
    }

    let block = Block::default()
        .title(" 🧪 BUILD & TEST ACTIVITY [Real Execution Grounded] ")
        .borders(Borders::ALL)
        .border_style(Style::default().fg(if is_section_focused { COLOR_CYAN } else { Color::DarkGray }));

    f.render_widget(Paragraph::new(lines).block(block).wrap(Wrap { trim: false }), area);
}
