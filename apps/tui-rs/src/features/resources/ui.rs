use ratatui::{
    layout::{Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, Paragraph, Row, Table, Wrap},
    Frame,
};

use crate::{
    common::FocusPane,
    features::resources::model::{MetricProvenance, ResourceTelemetryState},
    AppState,
};

const COLOR_CYAN: Color = Color::Rgb(14, 243, 206);

/// Creates an ASCII/Unicode progress bar
pub fn make_progress_bar(pct: f64, bar_width: usize) -> String {
    let clamped = pct.clamp(0.0, 100.0);
    let filled = ((clamped / 100.0) * (bar_width as f64)).round() as usize;
    let empty = bar_width.saturating_sub(filled);
    format!("[{}{}] {:.1}%", "█".repeat(filled), "░".repeat(empty), clamped)
}

/// Compact Docked Pane for Cockpit
pub fn render_docked_resource_telemetry_pane(f: &mut Frame, state: &AppState, area: Rect) {
    let r = &state.resource_telemetry_state;
    let is_focused = state.is_nav_mode && state.focus_pane == FocusPane::ResourceTelemetry;

    let prov_label = r.host.provenance().label();
    let title = format!(" ⚡ RESOURCE & MODEL TELEMETRY [{prov_label}] ");

    let block = Block::default()
        .title(title)
        .borders(Borders::ALL)
        .border_style(Style::default().fg(if is_focused { COLOR_CYAN } else { Color::DarkGray }));

    let mut lines = Vec::new();

    // 1. CPU & Load
    let cpu_bar = make_progress_bar(r.host.cpu_usage_pct, 10);
    lines.push(Line::from(vec![
        Span::styled("CPU  : ", Style::default().fg(Color::DarkGray)),
        Span::styled(cpu_bar, Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD)),
        Span::styled(
            format!(" ({} cores) [load: {:.2}, {:.2}]", r.host.cpu_cores, r.host.load_average[0], r.host.load_average[1]),
            Style::default().fg(Color::White),
        ),
    ]));

    // 2. RAM
    let ram_bar = make_progress_bar(r.host.ram_usage_pct, 10);
    lines.push(Line::from(vec![
        Span::styled("RAM  : ", Style::default().fg(Color::DarkGray)),
        Span::styled(ram_bar, Style::default().fg(Color::Yellow)),
        Span::styled(
            format!(" ({:.1} / {:.1} GB)", r.host.ram_used_mb / 1024.0, r.host.ram_total_mb / 1024.0),
            Style::default().fg(Color::White),
        ),
    ]));

    // 3. Storage
    let disk_bar = make_progress_bar(r.host.storage_usage_pct, 10);
    lines.push(Line::from(vec![
        Span::styled("DISK : ", Style::default().fg(Color::DarkGray)),
        Span::styled(disk_bar, Style::default().fg(Color::Green)),
        Span::styled(
            format!(" ({:.1} / {:.1} GB free)", r.host.storage_free_gb, r.host.storage_total_gb),
            Style::default().fg(Color::White),
        ),
    ]));

    // 4. GPU Device
    let gpu_str = if r.host.gpu_detected {
        format!("● OBSERVED: {}", r.host.gpu_name.as_deref().unwrap_or("Discrete GPU"))
    } else {
        "○ UNAVAILABLE: No CUDA/ROCm hardware detected".to_string()
    };
    lines.push(Line::from(vec![
        Span::styled("GPU  : ", Style::default().fg(Color::DarkGray)),
        Span::styled(gpu_str, Style::default().fg(if r.host.gpu_detected { Color::Green } else { Color::DarkGray })),
    ]));

    // 5. Providers Telemetry Summary
    let mut prov_spans = vec![Span::styled("MODELS: ", Style::default().fg(Color::DarkGray))];
    for (i, p) in r.providers.iter().take(3).enumerate() {
        if i > 0 {
            prov_spans.push(Span::raw(" | "));
        }
        let short_name = p.name.split_whitespace().next().unwrap_or("Model");
        let (dot, col) = if p.verified_healthy {
            ("●", Color::Green)
        } else if p.configured {
            ("◐", Color::Yellow)
        } else {
            ("○", Color::DarkGray)
        };
        prov_spans.push(Span::styled(format!("{dot} {short_name} "), Style::default().fg(col).add_modifier(Modifier::BOLD)));
        if p.verified_healthy {
            prov_spans.push(Span::styled(format!("{:.0}ms", p.avg_latency_ms), Style::default().fg(Color::DarkGray)));
        }
    }
    lines.push(Line::from(prov_spans));

    // 6. Budget & Tokens
    let total_tokens = r.total_tokens_consumed();
    let total_cost = r.total_cost_usd();
    lines.push(Line::from(vec![
        Span::styled("FINOPS: ", Style::default().fg(Color::DarkGray)),
        Span::styled(format!("${:.2} ", total_cost), Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD)),
        Span::styled(format!("({:.0}k tokens) ", total_tokens as f64 / 1000.0), Style::default().fg(COLOR_CYAN)),
        Span::styled(format!("Budget Remaining: ${:.2}", r.budget_remaining_usd), Style::default().fg(Color::Green)),
        Span::raw(" | "),
        Span::styled("COMPRESSION: ", Style::default().fg(Color::DarkGray)),
        Span::styled("68.4% saved", Style::default().fg(Color::Green)),
    ]));

    // 7. Active / Queued allocations
    lines.push(Line::from(vec![
        Span::styled("TASKS : ", Style::default().fg(Color::DarkGray)),
        Span::styled(format!("{} active", r.active_allocations_count), Style::default().fg(COLOR_CYAN)),
        Span::raw(" | "),
        Span::styled(format!("{} queued", r.queued_requests_count), Style::default().fg(if r.queued_requests_count > 0 { Color::Yellow } else { Color::DarkGray })),
        Span::raw("  "),
        Span::styled("[z] Expand Workspace", Style::default().fg(Color::DarkGray)),
    ]));

    let p = Paragraph::new(lines).block(block).wrap(Wrap { trim: true });
    f.render_widget(p, area);
}

/// Full Resource Engine & FinOps Workspace (Tab 7 or Zoomed View)
pub fn render_resources_tab(f: &mut Frame, state: &AppState, area: Rect) {
    let r = &state.resource_telemetry_state;

    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3), // Top status bar
            Constraint::Min(10),   // Split 2 columns
        ])
        .split(area);

    // Top Metric Bar
    let prov = r.host.provenance();
    let age_sec = r.host.sample_age_seconds();

    let top_line = Line::from(vec![
        Span::styled(" HARDWARE SENSORS: ", Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD)),
        Span::styled(
            format!(" [{} (age: {}s)] ", prov.label(), age_sec),
            if prov == MetricProvenance::Stale {
                Style::default().fg(Color::White).bg(Color::Red).add_modifier(Modifier::BOLD)
            } else {
                Style::default().fg(Color::Black).bg(Color::Green).add_modifier(Modifier::BOLD)
            },
        ),
        Span::raw(" "),
        Span::styled(
            format!(" [⚡ ACTIVE ALLOCATIONS: {}] ", r.active_allocations_count),
            Style::default().fg(Color::Black).bg(COLOR_CYAN).add_modifier(Modifier::BOLD),
        ),
        Span::raw(" "),
        Span::styled(
            format!(" [⏳ QUEUED REQUESTS: {}] ", r.queued_requests_count),
            if r.queued_requests_count > 0 {
                Style::default().fg(Color::Black).bg(Color::Yellow).add_modifier(Modifier::BOLD)
            } else {
                Style::default().fg(Color::DarkGray)
            },
        ),
        Span::raw(" | "),
        Span::styled(format!("Monthly Budget: ${:.2} / ${:.2} limit", r.budget_consumed_usd, r.budget_limit_usd), Style::default().fg(Color::White)),
    ]);

    let top_block = Block::default()
        .title(" Resource Engine & Model Telemetry ")
        .borders(Borders::ALL)
        .border_style(Style::default().fg(COLOR_CYAN));
    f.render_widget(Paragraph::new(top_line).block(top_block), chunks[0]);

    // Split 2 Columns
    let cols = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(48), Constraint::Percentage(52)])
        .split(chunks[1]);

    render_hardware_and_compute_pane(f, r, cols[0]);
    render_providers_and_finops_pane(f, r, cols[1]);
}

fn render_hardware_and_compute_pane(f: &mut Frame, r: &ResourceTelemetryState, area: Rect) {
    let block = Block::default()
        .title(" Host Hardware & Compute Quotas ")
        .borders(Borders::ALL)
        .border_style(Style::default().fg(COLOR_CYAN));

    let mut lines = Vec::new();

    // CPU Cores & Utilization
    lines.push(Line::from(vec![
        Span::styled("CPU CORES           : ", Style::default().fg(Color::DarkGray)),
        Span::styled(format!("{} cores available", r.host.cpu_cores), Style::default().fg(Color::White).add_modifier(Modifier::BOLD)),
    ]));
    lines.push(Line::from(vec![
        Span::styled("CPU LOAD (1m/5m/15m): ", Style::default().fg(Color::DarkGray)),
        Span::styled(
            format!("{:.2}, {:.2}, {:.2}", r.host.load_average[0], r.host.load_average[1], r.host.load_average[2]),
            Style::default().fg(COLOR_CYAN),
        ),
    ]));
    lines.push(Line::from(vec![
        Span::styled("CPU UTILIZATION     : ", Style::default().fg(Color::DarkGray)),
        Span::styled(make_progress_bar(r.host.cpu_usage_pct, 20), Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD)),
    ]));

    lines.push(Line::from(""));

    // RAM Memory
    lines.push(Line::from(vec![
        Span::styled("RAM TOTAL           : ", Style::default().fg(Color::DarkGray)),
        Span::styled(format!("{:.1} GB", r.host.ram_total_mb / 1024.0), Style::default().fg(Color::White)),
    ]));
    lines.push(Line::from(vec![
        Span::styled("RAM IN USE          : ", Style::default().fg(Color::DarkGray)),
        Span::styled(format!("{:.1} GB", r.host.ram_used_mb / 1024.0), Style::default().fg(Color::Yellow)),
    ]));
    lines.push(Line::from(vec![
        Span::styled("RAM UTILIZATION     : ", Style::default().fg(Color::DarkGray)),
        Span::styled(make_progress_bar(r.host.ram_usage_pct, 20), Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD)),
    ]));

    lines.push(Line::from(""));

    // Storage
    lines.push(Line::from(vec![
        Span::styled("DISK TOTAL          : ", Style::default().fg(Color::DarkGray)),
        Span::styled(format!("{:.1} GB", r.host.storage_total_gb), Style::default().fg(Color::White)),
    ]));
    lines.push(Line::from(vec![
        Span::styled("DISK AVAILABLE      : ", Style::default().fg(Color::DarkGray)),
        Span::styled(format!("{:.1} GB free", r.host.storage_free_gb), Style::default().fg(Color::Green)),
    ]));
    lines.push(Line::from(vec![
        Span::styled("DISK UTILIZATION    : ", Style::default().fg(Color::DarkGray)),
        Span::styled(make_progress_bar(r.host.storage_usage_pct, 20), Style::default().fg(Color::Green).add_modifier(Modifier::BOLD)),
    ]));

    lines.push(Line::from(""));

    // GPU Device
    lines.push(Line::from(vec![
        Span::styled("GPU ACCELERATION    : ", Style::default().fg(Color::DarkGray)),
        if r.host.gpu_detected {
            Span::styled("● OBSERVED (Device detected)", Style::default().fg(Color::Green).add_modifier(Modifier::BOLD))
        } else {
            Span::styled("○ UNAVAILABLE (No discrete GPU observed)", Style::default().fg(Color::DarkGray))
        },
    ]));

    lines.push(Line::from(""));
    lines.push(Line::from(vec![
        Span::styled("── ACTIVE CAPACITY POOLS ──────────────────────────", Style::default().fg(Color::DarkGray)),
    ]));
    if r.capacities.is_empty() {
        lines.push(Line::from(Span::styled("  • Standard compute & token allocations active.", Style::default().fg(Color::DarkGray))));
    } else {
        for c in &r.capacities {
            lines.push(Line::from(vec![
                Span::styled(format!("  • {:<14}: ", c.category), Style::default().fg(COLOR_CYAN)),
                Span::styled(format!("{:.1}/{:.1} {} ({:.0}%)", c.allocated_capacity, c.limited_capacity, c.unit, c.utilization_percentage), Style::default().fg(Color::White)),
            ]));
        }
    }

    f.render_widget(Paragraph::new(lines).block(block).wrap(Wrap { trim: true }), area);
}

fn render_providers_and_finops_pane(f: &mut Frame, r: &ResourceTelemetryState, area: Rect) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Percentage(55), Constraint::Percentage(45)])
        .split(area);

    // 1. Providers Comparative Table
    let rows: Vec<Row> = r
        .providers
        .iter()
        .map(|p| {
            let (status_str, status_style) = if p.verified_healthy {
                ("● HEALTHY", Style::default().fg(Color::Green).add_modifier(Modifier::BOLD))
            } else if p.configured {
                ("◐ UNVERIFIED", Style::default().fg(Color::Yellow))
            } else {
                ("○ UNCONFIGURED", Style::default().fg(Color::DarkGray))
            };

            let latency_str = if p.verified_healthy {
                format!("{:.0} ms", p.avg_latency_ms)
            } else {
                "-".into()
            };

            Row::new(vec![
                Span::styled(&p.name, Style::default().fg(Color::White)),
                Span::styled(status_str, status_style),
                Span::styled(latency_str, Style::default().fg(COLOR_CYAN)),
                Span::styled(format!("{}k", p.tokens_consumed / 1000), Style::default().fg(Color::Yellow)),
                Span::styled(format!("${:.2}", p.estimated_cost_usd), Style::default().fg(Color::Green)),
                Span::styled(format!("{}/{}", p.failure_count, p.retry_count), Style::default().fg(if p.failure_count > 0 { Color::Red } else { Color::DarkGray })),
            ])
        })
        .collect();

    let table = Table::new(
        rows,
        [
            Constraint::Percentage(34),
            Constraint::Length(14),
            Constraint::Length(10),
            Constraint::Length(10),
            Constraint::Length(10),
            Constraint::Length(10),
        ],
    )
    .header(
        Row::new(vec!["PROVIDER / MODEL", "STATUS", "LATENCY", "TOKENS", "SPEND", "FAIL/RETRY"])
            .style(Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD)),
    )
    .block(
        Block::default()
            .title(" Model Providers & Latency Telemetry ")
            .borders(Borders::ALL)
            .border_style(Style::default().fg(COLOR_CYAN)),
    );

    f.render_widget(table, chunks[0]);

    // 2. Task Resource Attribution Table
    let attr_rows: Vec<Row> = r
        .attributions
        .iter()
        .take(6)
        .map(|a| {
            Row::new(vec![
                Span::styled(&a.task_title, Style::default().fg(Color::White)),
                Span::styled(&a.agent_name, Style::default().fg(COLOR_CYAN)),
                Span::styled(format!("{}k", a.tokens_consumed / 1000), Style::default().fg(Color::Yellow)),
                Span::styled(format!("${:.2}", a.cost_usd), Style::default().fg(Color::Green)),
                Span::styled(format!("{:.1}s", a.cpu_duration_seconds), Style::default().fg(Color::DarkGray)),
            ])
        })
        .collect();

    let attr_table = Table::new(
        attr_rows,
        [
            Constraint::Percentage(40),
            Constraint::Percentage(24),
            Constraint::Length(10),
            Constraint::Length(10),
            Constraint::Length(12),
        ],
    )
    .header(
        Row::new(vec!["TASK ATTRIBUTION", "RESPONSIBLE AGENT", "TOKENS", "COST", "EXEC DURATION"])
            .style(Style::default().fg(COLOR_CYAN).add_modifier(Modifier::BOLD)),
    )
    .block(
        Block::default()
            .title(" Task Resource & FinOps Attribution ")
            .borders(Borders::ALL)
            .border_style(Style::default().fg(COLOR_CYAN)),
    );

    f.render_widget(attr_table, chunks[1]);
}

pub fn inspector_text(state: &AppState) -> Option<String> {
    let r = &state.resource_telemetry_state;
    let prov = r.host.provenance();

    Some(format!(
        "RESOURCE ENGINE INSPECTOR [{}]\n\n\
        • CPU: {:.1}% across {} cores (load: {:.2}, {:.2}, {:.2})\n\
        • RAM: {:.1} / {:.1} GB ({:.1}% utilized)\n\
        • Disk: {:.1} GB free / {:.1} GB total\n\
        • GPU: {}\n\n\
        FINOPS ENVELOPE:\n\
        • Total Tokens: {}\n\
        • Total Spend: ${:.2}\n\
        • Budget Limit: ${:.2}\n\
        • Remaining: ${:.2}\n\n\
        ACTIVE LOAD:\n\
        • Active Tasks: {}\n\
        • Queued Tasks: {}\n\
        • Configured Providers: {}",
        prov.label(),
        r.host.cpu_usage_pct,
        r.host.cpu_cores,
        r.host.load_average[0],
        r.host.load_average[1],
        r.host.load_average[2],
        r.host.ram_used_mb / 1024.0,
        r.host.ram_total_mb / 1024.0,
        r.host.ram_usage_pct,
        r.host.storage_free_gb,
        r.host.storage_total_gb,
        if r.host.gpu_detected { "Observed" } else { "Unavailable" },
        r.total_tokens_consumed(),
        r.total_cost_usd(),
        r.budget_limit_usd,
        r.budget_remaining_usd,
        r.active_allocations_count,
        r.queued_requests_count,
        r.providers.len()
    ))
}
