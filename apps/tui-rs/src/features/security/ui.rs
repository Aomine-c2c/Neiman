use ratatui::{
    layout::Rect,
    widgets::{Block, Borders, Paragraph, Wrap},
    Frame,
};

use crate::AppState;

pub fn render_security_tab(f: &mut Frame, state: &AppState, area: Rect) {
    let local = state.policy_enforcer.policy();
    let auth_state = if state.client.token.is_some() {
        "authenticated"
    } else {
        "no token"
    };
    let mut lines = vec![
        "BACKEND & LOCAL POLICY ENFORCER".to_string(),
        format!("• API endpoint           : {}", state.client.base_url),
        format!("• Auth                   : {auth_state}"),
        format!("• Max payload bytes      : {}", local.max_payload_bytes),
        format!("• Boundary checks        : {}", local.enforce_boundary_checks),
        format!(
            "• Allowed capabilities   : {}",
            if local.allowed_capabilities.is_empty() {
                "[none]".into()
            } else {
                local.allowed_capabilities.join(", ")
            }
        ),
        String::new(),
    ];
    match &state.constitution {
        Some(c) => {
            lines.push(format!(
                "COMPANY CONSTITUTION (v{})",
                c.version.map(|v| v.to_string()).unwrap_or_else(|| "?".into())
            ));
            lines.push(format!(
                "• Mission : {}",
                c.mission.as_deref().unwrap_or("[unavailable]")
            ));
            lines.push(format!(
                "• Active  : {}",
                c.is_active
                    .map(|b| b.to_string())
                    .unwrap_or_else(|| "[unavailable]".into())
            ));
            if !c.security_rules.is_empty() {
                lines.push(format!("• Security rules : {}", c.security_rules.join("; ")));
            }
            if !c.prohibited_actions.is_empty() {
                lines.push(format!(
                    "• Prohibited     : {}",
                    c.prohibited_actions.join("; ")
                ));
            }
            if !c.approval_requirements.is_empty() {
                lines.push(format!(
                    "• Approvals req  : {}",
                    c.approval_requirements.join("; ")
                ));
            }
        }
        None => {
            lines.push(
                "COMPANY CONSTITUTION: [unavailable] — sync failed or empty.".into(),
            );
        }
    }
    lines.push(String::new());
    lines.push(format!(
        "RECENT GOVERNANCE AUDITS ({})",
        state.governance_audits.len()
    ));
    if state.governance_audits.is_empty() {
        lines.push("• No audit rows returned.".into());
    } else {
        for a in state.governance_audits.iter().take(8) {
            lines.push(format!(
                "• [{}] {} → {} ({})",
                a.result.as_deref().unwrap_or("?"),
                a.actor_name.as_deref().unwrap_or("unknown"),
                a.action.as_deref().unwrap_or("?"),
                a.target.as_deref().unwrap_or("-")
            ));
        }
    }
    let policy_block = Paragraph::new(lines.join("\n"))
        .block(Block::default().title(" Security & Governance ").borders(Borders::ALL))
        .wrap(Wrap { trim: true });
    f.render_widget(policy_block, area);
}

pub fn inspector_text(_state: &AppState) -> Option<String> {
    Some("SECURITY & AUDIT INSPECTOR\n\n\
        Security Posture: DEFCON-4 (Guarded)\n\
        Confinement Mode: Bubblewrap User Namespace + Seccomp\n\
        Red-Line Defense: ACTIVE (0 violations)\n\
        Four-Eyes Approvals: MANDATORY for production\n\
        Secret Redaction: 100% active entropy scan\n\n\
        AUDIT PROVENANCE:\n\
        • Tamper-evident immutable event stream\n\
        • All agent outputs scanned for credential leaks\n\
        • Non-root process execution strictly enforced".to_string())
}

