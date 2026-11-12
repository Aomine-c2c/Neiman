use crate::client::{AgentPayload, AgentProfilePayload, WorkspaceInspectionPayload};
use crate::common::{FocusPane, TaskViewItem};

#[derive(Debug, Clone, PartialEq)]
pub enum ChatSender {
    User,
    CTO,
    System,
    Agent { name: String, role: String },
}

#[derive(Debug, Clone)]
pub struct ChatMessage {
    pub sender: ChatSender,
    pub text: String,
    pub timestamp: String,
    pub approval_id: Option<String>,
    pub approval_title: Option<String>,
    pub approval_status: Option<String>,
    pub is_decision_card: bool,
}

#[derive(Debug, Clone)]
pub struct SlashCommand {
    pub name: &'static str,
    pub syntax: &'static str,
    pub description: &'static str,
}

pub const SLASH_COMMANDS: &[SlashCommand] = &[
    SlashCommand {
        name: "codebase",
        syntax: "/codebase [path]",
        description: "Select, link and inspect target codebase repository",
    },
    SlashCommand {
        name: "approve",
        syntax: "/approve <id>",
        description: "Ratify pending human governance gate",
    },
    SlashCommand {
        name: "reject",
        syntax: "/reject <id>",
        description: "Reject or block pending governance gate",
    },
    SlashCommand {
        name: "task",
        syntax: "/task <title>",
        description: "Create and assign an engineering task to swarm",
    },
    SlashCommand {
        name: "filter",
        syntax: "/filter <query>",
        description: "Filter agent activity & communication stream by keyword, agent or task",
    },
    SlashCommand {
        name: "pause",
        syntax: "/pause",
        description: "Pause or resume agent activity live stream (shortcut: p)",
    },
    SlashCommand {
        name: "provider",
        syntax: "/provider [name] [key] [url]",
        description: "Configure AI providers, API keys, and model routing (or press Ctrl+P)",
    },
    SlashCommand {
        name: "blueprint",
        syntax: "/blueprint <slug>",
        description: "Instantiate enterprise archetype blueprint",
    },
    SlashCommand {
        name: "roadmap",
        syntax: "/roadmap",
        description: "Request CTO to formulate project roadmap",
    },
    SlashCommand {
        name: "status",
        syntax: "/status",
        description: "Display full organizational health telemetry",
    },
    SlashCommand {
        name: "theme",
        syntax: "/theme",
        description: "Toggle between Light Mode and Obsidian Dark Mode",
    },
    SlashCommand {
        name: "clear",
        syntax: "/clear",
        description: "Clear current chat history transcript",
    },
    SlashCommand {
        name: "help",
        syntax: "/help",
        description: "List all available slash commands and keybindings",
    },
];

#[derive(Debug, Clone)]
pub struct CockpitState {
    pub chat_messages: Vec<ChatMessage>,
    pub chat_input: String,
    pub chat_scroll: usize,
    pub slash_menu_open: bool,
    pub slash_menu_selection: usize,
    pub focus_pane: FocusPane,
    pub codebase_modal_open: bool,
    pub codebase_input: String,
    pub codebase_selection: usize,
    pub codebase_inspection: Option<WorkspaceInspectionPayload>,
    pub active_codebase_path: String,
    pub active_codebase_branch: String,
    pub active_codebase_stack: String,
    pub is_nav_mode: bool,
    pub zoomed_pane: Option<FocusPane>,
    pub swarm_selection: usize,
    pub task_selection: usize,
    pub log_selection: usize,
    pub agent_inspector_open: bool,
    pub task_inspector_open: bool,
    pub selected_agent: Option<AgentPayload>,
    pub selected_task: Option<TaskViewItem>,
    pub agent_menu_open: bool,
    pub agent_menu_selection: usize,
    pub inspected_agent_profile: Option<AgentProfilePayload>,
    pub is_dispatching_directive: bool,
    pub dispatch_directive_input: String,

    // AI Provider Configuration Modal & Management
    pub provider_modal_open: bool,
    pub provider_modal_idx: usize,
    pub provider_input_key: String,
    pub provider_input_url: String,
    pub provider_input_field: usize,
    pub provider_set_primary: bool,
    pub provider_status_msg: Option<String>,
    pub provider_status_is_err: bool,
    pub intelligence_provider_selection: usize,
}

impl Default for CockpitState {
    fn default() -> Self {
        Self {
            chat_messages: vec![
                ChatMessage {
                    sender: ChatSender::System,
                    text: "NEIMAN OS :: Unified Autonomous Operator Cockpit online.".into(),
                    timestamp: chrono::Local::now().format("%H:%M:%S").to_string(),
                    approval_id: None,
                    approval_title: None,
                    approval_status: None,
                    is_decision_card: false,
                },
                ChatMessage {
                    sender: ChatSender::CTO,
                    text: "Greetings, Executive. I am your Autonomous CTO. I oversee the engineering swarm, task delegation, and roadmap delivery. Give me any directive or press '/' for commands.".into(),
                    timestamp: chrono::Local::now().format("%H:%M:%S").to_string(),
                    approval_id: None,
                    approval_title: None,
                    approval_status: None,
                    is_decision_card: false,
                },
            ],
            chat_input: String::new(),
            chat_scroll: 0,
            slash_menu_open: false,
            slash_menu_selection: 0,
            focus_pane: FocusPane::Chat,
            codebase_modal_open: false,
            codebase_input: ".".to_string(),
            codebase_selection: 0,
            codebase_inspection: None,
            active_codebase_path: ".".to_string(),
            active_codebase_branch: "main".to_string(),
            active_codebase_stack: "Detecting...".to_string(),
            is_nav_mode: false,
            zoomed_pane: None,
            swarm_selection: 0,
            task_selection: 0,
            log_selection: 0,
            agent_inspector_open: false,
            task_inspector_open: false,
            selected_agent: None,
            selected_task: None,
            agent_menu_open: false,
            agent_menu_selection: 0,
            inspected_agent_profile: None,
            is_dispatching_directive: false,
            dispatch_directive_input: String::new(),
            provider_modal_open: false,
            provider_modal_idx: 0,
            provider_input_key: String::new(),
            provider_input_url: String::new(),
            provider_input_field: 0,
            provider_set_primary: false,
            provider_status_msg: None,
            provider_status_is_err: false,
            intelligence_provider_selection: 0,
        }
    }
}
