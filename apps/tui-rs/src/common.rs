use ratatui::layout::Rect;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ActiveTab {
    CommandCenter,
    AgentRoster,
    MissionControl,
    ExecutiveComms,
    EngineeringWorkbench,
    GovernanceApprovals,
    ResourceExchange,
    CompanyMemory,
    EvolutionLab,
    BusinessGrowth,
    SecurityAudit,
    InfrastructureRuntime,
    CompanyConfiguration,
}

impl ActiveTab {
    pub fn all() -> &'static [ActiveTab] {
        &[
            ActiveTab::CommandCenter,
            ActiveTab::AgentRoster,
            ActiveTab::MissionControl,
            ActiveTab::ExecutiveComms,
            ActiveTab::EngineeringWorkbench,
            ActiveTab::GovernanceApprovals,
            ActiveTab::ResourceExchange,
            ActiveTab::CompanyMemory,
            ActiveTab::EvolutionLab,
            ActiveTab::BusinessGrowth,
            ActiveTab::SecurityAudit,
            ActiveTab::InfrastructureRuntime,
            ActiveTab::CompanyConfiguration,
        ]
    }

    pub fn title(&self) -> &'static str {
        match self {
            ActiveTab::CommandCenter => "1: Command Center",
            ActiveTab::AgentRoster => "2: Agent Roster",
            ActiveTab::MissionControl => "3: Mission Control",
            ActiveTab::ExecutiveComms => "4: Executive Comms",
            ActiveTab::EngineeringWorkbench => "5: Engineering Workbench",
            ActiveTab::GovernanceApprovals => "6: Governance & Approvals",
            ActiveTab::ResourceExchange => "7: Resource Exchange",
            ActiveTab::CompanyMemory => "8: Company Memory",
            ActiveTab::EvolutionLab => "9: Evolution Lab",
            ActiveTab::BusinessGrowth => "0: Business & Growth",
            ActiveTab::SecurityAudit => "-: Security & Audit",
            ActiveTab::InfrastructureRuntime => "=: Infrastructure & Runtime",
            ActiveTab::CompanyConfiguration => "\\: Company Config",
        }
    }

    pub fn name(&self) -> &'static str {
        match self {
            ActiveTab::CommandCenter => "Command Center",
            ActiveTab::AgentRoster => "Agent Roster",
            ActiveTab::MissionControl => "Mission Control",
            ActiveTab::ExecutiveComms => "Executive Comms",
            ActiveTab::EngineeringWorkbench => "Engineering Workbench",
            ActiveTab::GovernanceApprovals => "Governance & Approvals",
            ActiveTab::ResourceExchange => "Resource Exchange",
            ActiveTab::CompanyMemory => "Company Memory",
            ActiveTab::EvolutionLab => "Evolution Lab",
            ActiveTab::BusinessGrowth => "Business & Growth",
            ActiveTab::SecurityAudit => "Security & Audit",
            ActiveTab::InfrastructureRuntime => "Infrastructure & Runtime",
            ActiveTab::CompanyConfiguration => "Company Config",
        }
    }

    pub fn shortcut(&self) -> &'static str {
        match self {
            ActiveTab::CommandCenter => "1",
            ActiveTab::AgentRoster => "2",
            ActiveTab::MissionControl => "3",
            ActiveTab::ExecutiveComms => "4",
            ActiveTab::EngineeringWorkbench => "5",
            ActiveTab::GovernanceApprovals => "6",
            ActiveTab::ResourceExchange => "7",
            ActiveTab::CompanyMemory => "8",
            ActiveTab::EvolutionLab => "9",
            ActiveTab::BusinessGrowth => "0",
            ActiveTab::SecurityAudit => "-",
            ActiveTab::InfrastructureRuntime => "=",
            ActiveTab::CompanyConfiguration => "\\",
        }
    }

    pub fn from_index(idx: usize) -> Option<Self> {
        match idx {
            1 => Some(ActiveTab::CommandCenter),
            2 => Some(ActiveTab::AgentRoster),
            3 => Some(ActiveTab::MissionControl),
            4 => Some(ActiveTab::ExecutiveComms),
            5 => Some(ActiveTab::EngineeringWorkbench),
            6 => Some(ActiveTab::GovernanceApprovals),
            7 => Some(ActiveTab::ResourceExchange),
            8 => Some(ActiveTab::CompanyMemory),
            9 => Some(ActiveTab::EvolutionLab),
            10 => Some(ActiveTab::BusinessGrowth),
            11 => Some(ActiveTab::SecurityAudit),
            12 => Some(ActiveTab::InfrastructureRuntime),
            13 => Some(ActiveTab::CompanyConfiguration),
            _ => None,
        }
    }

    pub fn index(&self) -> usize {
        match self {
            ActiveTab::CommandCenter => 1,
            ActiveTab::AgentRoster => 2,
            ActiveTab::MissionControl => 3,
            ActiveTab::ExecutiveComms => 4,
            ActiveTab::EngineeringWorkbench => 5,
            ActiveTab::GovernanceApprovals => 6,
            ActiveTab::ResourceExchange => 7,
            ActiveTab::CompanyMemory => 8,
            ActiveTab::EvolutionLab => 9,
            ActiveTab::BusinessGrowth => 10,
            ActiveTab::SecurityAudit => 11,
            ActiveTab::InfrastructureRuntime => 12,
            ActiveTab::CompanyConfiguration => 13,
        }
    }

    pub fn from_shortcut(c: char) -> Option<Self> {
        match c {
            '1' => Some(ActiveTab::CommandCenter),
            '2' => Some(ActiveTab::AgentRoster),
            '3' => Some(ActiveTab::MissionControl),
            '4' => Some(ActiveTab::ExecutiveComms),
            '5' => Some(ActiveTab::EngineeringWorkbench),
            '6' => Some(ActiveTab::GovernanceApprovals),
            '7' => Some(ActiveTab::ResourceExchange),
            '8' => Some(ActiveTab::CompanyMemory),
            '9' => Some(ActiveTab::EvolutionLab),
            '0' => Some(ActiveTab::BusinessGrowth),
            '-' => Some(ActiveTab::SecurityAudit),
            '=' => Some(ActiveTab::InfrastructureRuntime),
            '\\' => Some(ActiveTab::CompanyConfiguration),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum LayoutFocus {
    NavRail,
    Workspace,
    Inspector,
    CommandBar,
}

impl LayoutFocus {
    pub fn next(&self, has_inspector: bool) -> Self {
        match self {
            LayoutFocus::NavRail => LayoutFocus::Workspace,
            LayoutFocus::Workspace => {
                if has_inspector {
                    LayoutFocus::Inspector
                } else {
                    LayoutFocus::CommandBar
                }
            }
            LayoutFocus::Inspector => LayoutFocus::CommandBar,
            LayoutFocus::CommandBar => LayoutFocus::NavRail,
        }
    }

    pub fn prev(&self, has_inspector: bool) -> Self {
        match self {
            LayoutFocus::NavRail => LayoutFocus::CommandBar,
            LayoutFocus::Workspace => LayoutFocus::NavRail,
            LayoutFocus::Inspector => LayoutFocus::Workspace,
            LayoutFocus::CommandBar => {
                if has_inspector {
                    LayoutFocus::Inspector
                } else {
                    LayoutFocus::Workspace
                }
            }
        }
    }
}

pub fn is_narrow_terminal(area: Rect) -> bool {
    area.width < 100 || area.height < 26
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FocusPane {
    Chat,
    Swarm,
    Tasks,
    Graph,
    Activity,
    Telemetry,
    Engineering,
    Approvals,
    ResourceTelemetry,
    QaRelease,
    DecisionTrace,
    CompanyMemory,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CockpitLayoutConfig {
    pub left_pct: u16,
    pub center_pct: u16,
    pub right_pct: u16,
    pub left_collapsed: bool,
    pub right_collapsed: bool,
    pub docked_pane: FocusPane,
}

impl Default for CockpitLayoutConfig {
    fn default() -> Self {
        Self {
            left_pct: 26,
            center_pct: 48,
            right_pct: 26,
            left_collapsed: false,
            right_collapsed: false,
            docked_pane: FocusPane::Engineering,
        }
    }
}

impl CockpitLayoutConfig {
    pub fn sanitize(&mut self) {
        if self.left_pct < 10 || self.left_pct > 50 {
            self.left_pct = 26;
        }
        if self.right_pct < 10 || self.right_pct > 50 {
            self.right_pct = 26;
        }
        let remaining = 100u16.saturating_sub(self.left_pct).saturating_sub(self.right_pct);
        if remaining < 20 {
            self.left_pct = 26;
            self.right_pct = 26;
            self.center_pct = 48;
        } else {
            self.center_pct = remaining;
        }
    }

    pub fn cycle_docked(&mut self) -> FocusPane {
        self.docked_pane = match self.docked_pane {
            FocusPane::Engineering => FocusPane::Approvals,
            FocusPane::Approvals => FocusPane::ResourceTelemetry,
            FocusPane::ResourceTelemetry => FocusPane::QaRelease,
            FocusPane::QaRelease => FocusPane::DecisionTrace,
            FocusPane::DecisionTrace => FocusPane::CompanyMemory,
            _ => FocusPane::Engineering,
        };
        self.docked_pane
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub struct TaskChecklistEntry {
    pub id: String,
    pub title: String,
    pub completed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TaskViewItem {
    pub id: String,
    pub title: String,
    pub status: String,
    pub priority: String,
    pub project_id: Option<String>,
    pub assigned_agent: String,
    pub dependencies: Vec<String>,
    #[serde(default)]
    pub assigned_agent_id: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub checklist: Vec<TaskChecklistEntry>,
    #[serde(default)]
    pub resource_requirements: Option<serde_json::Value>,
}

impl TaskViewItem {
    pub fn new(
        id: impl Into<String>,
        title: impl Into<String>,
        status: impl Into<String>,
        priority: impl Into<String>,
        project_id: Option<String>,
        assigned_agent: impl Into<String>,
        dependencies: Vec<String>,
    ) -> Self {
        Self {
            id: id.into(),
            title: title.into(),
            status: status.into(),
            priority: priority.into(),
            project_id,
            assigned_agent: assigned_agent.into(),
            dependencies,
            assigned_agent_id: None,
            description: None,
            checklist: Vec::new(),
            resource_requirements: None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ConnectionState {
    Connected,
    Connecting,
    Degraded,
    Offline,
}

impl ConnectionState {
    pub fn as_str(&self) -> &'static str {
        match self {
            ConnectionState::Connected => "CONNECTED",
            ConnectionState::Connecting => "CONNECTING",
            ConnectionState::Degraded => "DEGRADED",
            ConnectionState::Offline => "OFFLINE",
        }
    }

    pub fn is_operational(&self) -> bool {
        matches!(self, ConnectionState::Connected | ConnectionState::Degraded)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ProviderHealthStatus {
    Verified,
    ConfiguredUnverified,
    ProbeFailed,
    NotConfigured,
}

impl ProviderHealthStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            ProviderHealthStatus::Verified => "VERIFIED",
            ProviderHealthStatus::ConfiguredUnverified => "CONFIGURED (UNVERIFIED)",
            ProviderHealthStatus::ProbeFailed => "PROBE FAILED",
            ProviderHealthStatus::NotConfigured => "NOT CONFIGURED",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum OnboardingStep {
    SelectBlueprint,
    ConfigureProvider,
    SelectProjectMode,
    VerifyFindings,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaletteItem {
    pub id: String,
    pub title: String,
    pub category: String,
    pub shortcut: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[derive(Default)]
pub struct CommandPaletteState {
    pub open: bool,
    pub query: String,
    pub selection: usize,
}

/// Safely truncates a UTF-8 string to at most `max_chars` code points without panicking on multi-byte boundaries.
pub fn truncate_str(s: &str, max_chars: usize) -> String {
    if s.chars().count() > max_chars {
        let truncated: String = s.chars().take(max_chars.saturating_sub(1)).collect();
        format!("{}…", truncated)
    } else {
        s.to_string()
    }
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_active_tab_roundtrip() {
        for tab in ActiveTab::all() {
            let idx = tab.index();
            assert_eq!(ActiveTab::from_index(idx), Some(*tab));
        }
    }

    #[test]
    fn test_all_13_workspaces_count() {
        assert_eq!(ActiveTab::all().len(), 13);
    }

    #[test]
    fn test_active_tab_shortcuts() {
        for tab in ActiveTab::all() {
            let shortcut_char = tab.shortcut().chars().next().unwrap();
            assert_eq!(ActiveTab::from_shortcut(shortcut_char), Some(*tab));
        }
    }

    #[test]
    fn test_layout_focus_cycling() {
        let focus = LayoutFocus::NavRail;
        let next = focus.next(true);
        assert_eq!(next, LayoutFocus::Workspace);
        let next = next.next(true);
        assert_eq!(next, LayoutFocus::Inspector);
        let next = next.next(true);
        assert_eq!(next, LayoutFocus::CommandBar);
        let next = next.next(true);
        assert_eq!(next, LayoutFocus::NavRail);

        // Without inspector
        let ws = LayoutFocus::Workspace;
        assert_eq!(ws.next(false), LayoutFocus::CommandBar);
    }

    #[test]
    fn test_is_narrow_terminal() {
        let narrow_width = Rect::new(0, 0, 80, 40);
        let narrow_height = Rect::new(0, 0, 120, 20);
        let full_size = Rect::new(0, 0, 140, 40);

        assert!(is_narrow_terminal(narrow_width));
        assert!(is_narrow_terminal(narrow_height));
        assert!(!is_narrow_terminal(full_size));
    }

    #[test]
    fn test_connection_state_methods() {
        assert_eq!(ConnectionState::Connected.as_str(), "CONNECTED");
        assert_eq!(ConnectionState::Connecting.as_str(), "CONNECTING");
        assert_eq!(ConnectionState::Degraded.as_str(), "DEGRADED");
        assert_eq!(ConnectionState::Offline.as_str(), "OFFLINE");
        assert!(ConnectionState::Connected.is_operational());
        assert!(ConnectionState::Degraded.is_operational());
        assert!(!ConnectionState::Offline.is_operational());
        assert!(!ConnectionState::Connecting.is_operational());
    }

    #[test]
    fn test_onboarding_step_equality() {
        assert_eq!(OnboardingStep::SelectBlueprint, OnboardingStep::SelectBlueprint);
        assert_ne!(OnboardingStep::SelectBlueprint, OnboardingStep::ConfigureProvider);
    }

    #[test]
    fn test_cockpit_layout_config_default_and_sanitize() {
        let mut cfg = CockpitLayoutConfig::default();
        assert_eq!(cfg.left_pct, 26);
        assert_eq!(cfg.center_pct, 48);
        assert_eq!(cfg.right_pct, 26);
        assert!(!cfg.left_collapsed);
        assert!(!cfg.right_collapsed);
        assert_eq!(cfg.docked_pane, FocusPane::Engineering);

        // Test cycle docked
        assert_eq!(cfg.cycle_docked(), FocusPane::Approvals);
        assert_eq!(cfg.cycle_docked(), FocusPane::ResourceTelemetry);
        assert_eq!(cfg.cycle_docked(), FocusPane::QaRelease);
        assert_eq!(cfg.cycle_docked(), FocusPane::DecisionTrace);
        assert_eq!(cfg.cycle_docked(), FocusPane::CompanyMemory);
        assert_eq!(cfg.cycle_docked(), FocusPane::Engineering);

        // Test sanitization on invalid bounds
        cfg.left_pct = 5; // too small (<10)
        cfg.right_pct = 80; // too large (>50)
        cfg.sanitize();
        assert_eq!(cfg.left_pct, 26);
        assert_eq!(cfg.right_pct, 26);
        assert_eq!(cfg.center_pct, 48);

        // Test normal valid bounds
        cfg.left_pct = 20;
        cfg.right_pct = 30;
        cfg.sanitize();
        assert_eq!(cfg.left_pct, 20);
        assert_eq!(cfg.right_pct, 30);
        assert_eq!(cfg.center_pct, 50);
    }

    #[test]
    fn test_truncate_str_utf8_safety() {
        assert_eq!(truncate_str("hello", 10), "hello");
        assert_eq!(truncate_str("hello world", 5), "hell…");
        // Multi-byte UTF-8 emoji should not panic on boundary
        let emoji_str = "🚀🚀🚀🚀🚀🚀🚀🚀";
        assert_eq!(truncate_str(emoji_str, 4), "🚀🚀🚀…");
    }
}
