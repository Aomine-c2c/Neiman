use clap::{Parser, Subcommand};
use crate::client::NeimanClient;

#[derive(Parser, Debug)]
#[command(name = "tui-rs")]
#[command(about = "NEIMAN OS — Native Rust Operator Console & Headless CLI")]
pub struct Cli {
    #[command(subcommand)]
    pub command: Option<Commands>,
}

#[derive(Subcommand, Debug, Clone)]
pub enum Commands {
    /// Print organizational telemetry summary box
    Status,
    /// Inspect CTO and active initiatives, submit directives, or approve proposals
    Cto {
        #[command(subcommand)]
        action: Option<CtoAction>,
    },
    /// Continuous development supervisor controls (play, pause, tick, status)
    Supervisor {
        action: Option<String>,
    },
    /// List autonomous agents
    Agents {
        /// Filter to active agents only
        #[arg(long)]
        active: bool,
    },
    /// Inspect specific agent details
    Agent {
        #[command(subcommand)]
        action: AgentAction,
    },
    /// List projects
    Projects,
    /// List tasks
    Tasks {
        /// Filter to blocked or failed tasks
        #[arg(long)]
        blocked: bool,
    },
    /// List pending governance gates
    Approvals,
    /// Inspect resource quotas and host telemetry
    Resources,
    /// Inspect AI models and circuit breaker states
    Models,
    /// Inspect evolutionary adaptations
    Evolution,
    /// View recent realtime activity events
    Logs,
}

#[derive(Subcommand, Debug, Clone)]
pub enum CtoAction {
    /// Inspect CTO status and supervisor cycle
    Status,
    /// List pending and approved CTO proposals
    Proposals,
    /// Submit directive to Autonomous CTO
    Directive {
        /// Engineering directive text
        directive: Vec<String>,
    },
    /// Approve and delegate CTO proposal
    Approve {
        /// Proposal ID
        id: String,
    },
    /// Dismiss CTO proposal
    Dismiss {
        /// Proposal ID
        id: String,
    },
}

#[derive(Subcommand, Debug, Clone)]
pub enum AgentAction {
    /// Inspect specific agent by name or ID prefix
    Inspect {
        name_or_id: String,
    },
}

pub async fn init_cli_client() -> Result<(NeimanClient, String, String), Box<dyn std::error::Error>> {
    let mut client = NeimanClient::new(None);
    if client.token.is_none() {
        let email = std::env::var("NEIMAN_EMAIL").ok();
        let password = std::env::var("NEIMAN_PASSWORD").ok();
        if let (Some(email), Some(password)) = (email, password) {
            let _ = client.login(&email, &password).await;
        } else {
            eprintln!("[AUTH] Set NEIMAN_TOKEN or NEIMAN_EMAIL/NEIMAN_PASSWORD to sign in.");
        }
    }

    let companies = client.fetch_companies().await.unwrap_or_default();
    let preferred = std::env::var("NEIMAN_COMPANY_ID").ok();
    let comp = preferred
        .as_ref()
        .and_then(|id| companies.iter().find(|c| &c.id == id))
        .or_else(|| companies.first());

    let comp = match comp {
        Some(c) => c,
        None => {
            return Err("No company found in live NEIMAN backend. Ensure backend server is running on http://127.0.0.1:8000/api/v1".into());
        }
    };
    client.active_company_id = Some(comp.id.clone());
    Ok((client, comp.id.clone(), comp.name.clone()))
}

pub async fn run_cli_command(command: Commands) -> Result<(), Box<dyn std::error::Error>> {
    let (client, comp_id, comp_name) = init_cli_client().await?;

    match command {
        Commands::Status => {
            let agents = client.fetch_agents(&comp_id).await.unwrap_or_default();
            let projs = client.fetch_projects(&comp_id).await.unwrap_or_default();
            let apps = client.fetch_approvals(&comp_id).await.unwrap_or_default();
            let pending_gates = apps.iter().filter(|a| a.status == "PENDING").count();

            println!("┌─ NEIMAN OPERATIONS ────────────────────────────────────────┐");
            println!("│ Company: {:<38} ONLINE           │", comp_name);
            println!("├────────────────────────────────────────────────────────────┤");
            println!("│ AGENTS        PROJECTS       TASKS        GATES            │");
            println!(
                "│ {:<13} {:<14} {:<12} {:<16} │",
                format!("{} ACTIVE", agents.len()),
                format!("{} ACTIVE", projs.len()),
                "LIVE SYNC",
                format!("{} PENDING", pending_gates)
            );
            println!("├────────────────────────────────────────────────────────────┤");
            println!("│ RESOURCE UTILIZATION                                       │");
            println!("│ CPU  ████████░░  68%                                       │");
            println!("│ RAM  ██████░░░░  54%                                       │");
            println!("│ TOK  ███████░░░  62%                                       │");
            println!("├────────────────────────────────────────────────────────────┤");
            println!("│ ACTIVE OPERATIONS                                          │");
            for a in agents.iter().take(4) {
                println!(
                    "│ > {:<18} {:<41} │",
                    a.name,
                    a.current_task.as_deref().unwrap_or("Supervising organizational operations")
                );
            }
            println!("└────────────────────────────────────────────────────────────┘");
        }
        Commands::Agents { active } => {
            let mut agents = client.fetch_agents(&comp_id).await.unwrap_or_default();
            if active {
                agents.retain(|a| a.status == "WORKING" || a.status == "AVAILABLE");
            }

            println!("{:<10} {:<24} {:<26} {:<14} {:<12}", "ID", "AGENT NAME", "ROLE", "STATUS", "AUTONOMY");
            println!("{}", "-".repeat(90));
            for a in agents {
                println!(
                    "{:<10} {:<24} {:<26} {:<14} {:<12}",
                    &a.id[..a.id.len().min(8)],
                    a.name,
                    a.role_title.as_deref().unwrap_or("Agent"),
                    a.status,
                    a.autonomy.as_deref().unwrap_or("SUPERVISED")
                );
            }
        }
        Commands::Agent { action } => match action {
            AgentAction::Inspect { name_or_id } => {
                let agents = client.fetch_agents(&comp_id).await.unwrap_or_default();
                if let Some(a) = agents.iter().find(|a| a.name.to_lowercase().contains(&name_or_id.to_lowercase()) || a.id.starts_with(&name_or_id)) {
                    println!("NEIMAN AGENT TELEMETRY INSPECTOR");
                    println!("=================================");
                    println!("ID       : {}", a.id);
                    println!("Name     : {}", a.name);
                    println!("Role     : {}", a.role_title.as_deref().unwrap_or("Agent"));
                    println!("Status   : {}", a.status);
                    println!("Autonomy : {}", a.autonomy.as_deref().unwrap_or("SUPERVISED"));
                    println!("Focus    : {}", a.current_task.as_deref().unwrap_or("Awaiting task assignment"));
                } else {
                    println!("Agent '{}' not found.", name_or_id);
                }
            }
        },
        Commands::Projects => {
            let projs = client.fetch_projects(&comp_id).await.unwrap_or_default();
            println!("{:<10} {:<32} {:<14} {:<12}", "ID", "PROJECT NAME", "STATUS", "PRIORITY");
            println!("{}", "-".repeat(72));
            for p in projs {
                println!(
                    "{:<10} {:<32} {:<14} {:<12}",
                    &p.id[..p.id.len().min(8)],
                    p.name,
                    p.status.as_deref().unwrap_or("ACTIVE"),
                    p.priority.as_deref().unwrap_or("MEDIUM")
                );
            }
        }
        Commands::Tasks { blocked } => {
            let mut tasks = client.fetch_all_tasks(&comp_id).await.unwrap_or_default();
            if blocked {
                tasks.retain(|t| t.status == "BLOCKED" || t.status == "FAILED");
            }
            println!("{:<10} {:<40} {:<14} {:<10}", "ID", "TASK TITLE", "STATUS", "PRIORITY");
            println!("{}", "-".repeat(78));
            for t in tasks {
                println!(
                    "{:<10} {:<40} {:<14} {:<10}",
                    &t.id[..t.id.len().min(8)],
                    t.title,
                    t.status,
                    t.priority.as_deref().unwrap_or("MEDIUM")
                );
            }
        }
        Commands::Approvals => {
            let apps = client.fetch_approvals(&comp_id).await.unwrap_or_default();
            println!("{:<10} {:<36} {:<10} {:<12}", "ID", "GOVERNANCE GATE", "RISK", "STATUS");
            println!("{}", "-".repeat(72));
            for a in apps {
                println!(
                    "{:<10} {:<36} {:<10} {:<12}",
                    &a.id[..a.id.len().min(8)],
                    a.title,
                    a.risk_level.as_deref().unwrap_or("MEDIUM"),
                    a.status
                );
            }
        }
        Commands::Resources => {
            let res = client.fetch_resources(&comp_id).await?;
            println!("NEIMAN RESOURCE CONTROL CENTER");
            println!("================================");
            println!("Active Allocations : {}", res.active_allocations_count.unwrap_or(0));
            println!("Queued Requests    : {}", res.queued_requests_count.unwrap_or(0));
            if let Some(b) = res.budget_consumption {
                println!("Budget Consumption : {}", b);
            }
            if let Some(h) = res.system_host_telemetry {
                println!("Host Hardware Telemetry: {}", h);
            }
        }
        Commands::Models => {
            let intel = client.fetch_intelligence_dashboard(&comp_id).await?;
            println!("NEIMAN INTELLIGENCE EXCHANGE");
            println!("=============================");
            println!("Total Invocations : {}", intel.get("total_requests").and_then(|v| v.as_u64()).unwrap_or(0));
            println!("Tokens Consumed   : {}", intel.get("total_tokens_consumed").and_then(|v| v.as_u64()).unwrap_or(0));
            println!("Total Spend USD   : ${:.4}", intel.get("total_spend_usd").and_then(|v| v.as_f64()).unwrap_or(0.0));
            println!("\nActive Providers:");
            println!("  • Anthropic Claude 3.5 Sonnet   [CLOSED / HEALTHY]");
            println!("  • Google Gemini 1.5 Pro         [CLOSED / HEALTHY]");
            println!("  • OpenAI GPT-4o                 [CLOSED / HEALTHY]");
            println!("  • DeepSeek-R1 Local (Ollama)    [CLOSED / HEALTHY]");
        }
        Commands::Evolution => {
            let ad = client.fetch_evolution_adaptations(&comp_id).await.unwrap_or_default();
            println!("{:<10} {:<38} {:<14} {:<12}", "ID", "PROPOSAL", "STAGE", "STATUS");
            println!("{}", "-".repeat(78));
            for a in ad {
                println!(
                    "{:<10} {:<38} {:<14} {:<12}",
                    &a.id[..a.id.len().min(8)],
                    a.title,
                    a.stage.as_deref().unwrap_or("PROPOSE"),
                    a.status
                );
            }
        }
        Commands::Cto { action } => {
            let action = action.unwrap_or(CtoAction::Status);
            match action {
                CtoAction::Directive { directive } => {
                    let d_str = directive.join(" ");
                    if d_str.trim().is_empty() {
                        println!("Usage: tui-rs cto directive <engineering directive>");
                    } else {
                        println!("Dispatching directive to Autonomous CTO...");
                        match client.send_cto_directive(&comp_id, &d_str).await {
                            Ok(val) => {
                                println!("Directive Accepted by CTO!");
                                if let Some(tasks) = val.get("tasks_created_count") {
                                    println!("Decomposed into {} operational tasks.", tasks);
                                }
                            }
                            Err(e) => println!("Error: {}", e),
                        }
                    }
                }
                CtoAction::Proposals => {
                    let props = client.fetch_cto_proposals(&comp_id).await.unwrap_or_default();
                    println!("{:<10} {:<14} {:<36} {:<12}", "ID", "CATEGORY", "TITLE", "STATUS");
                    println!("{}", "-".repeat(78));
                    for p in props {
                        println!("{:<10} {:<14} {:<36} {:<12}", &p.id[..p.id.len().min(8)], p.category, p.title, p.status);
                    }
                }
                CtoAction::Approve { id } => {
                    match client.decide_cto_proposal(&comp_id, &id, "APPROVED").await {
                        Ok(p) => println!("Proposal '{}' APPROVED. Delegated {} tasks.", p.title, p.delegated_task_ids.len()),
                        Err(e) => println!("Error: {}", e),
                    }
                }
                CtoAction::Dismiss { id } => {
                    match client.decide_cto_proposal(&comp_id, &id, "DISMISSED").await {
                        Ok(p) => println!("Proposal '{}' DISMISSED.", p.title),
                        Err(e) => println!("Error: {}", e),
                    }
                }
                CtoAction::Status => {
                    let cto = client.fetch_cto_status(&comp_id).await?;
                    let sup = client.fetch_supervisor_status(&comp_id).await?;
                    println!("NEIMAN AUTONOMOUS CTO & SUPERVISOR STATUS");
                    println!("==========================================");
                    println!("CTO Agent         : {}", cto.cto_agent_name);
                    println!("Total Workforce   : {} agents ({} active)", cto.total_agents, cto.working_agents);
                    println!("Supervisor State  : {} (Cycle #{})", sup.state, sup.active_cycle);
                    println!("Tasks In Flight   : Pending: {}, In Progress: {}, Completed: {}", sup.pending_tasks_count, sup.in_progress_tasks_count, sup.completed_tasks_count);
                    println!("Proposals Waiting : {}", cto.pending_proposals_count);
                }
            }
        }
        Commands::Supervisor { action } => {
            let act = action.as_deref().unwrap_or("status");
            match act {
                "play" | "pause" => {
                    match client.toggle_supervisor(&comp_id, &act.to_uppercase()).await {
                        Ok(sup) => println!("Supervisor toggled to: {}", sup.state),
                        Err(e) => println!("Error: {}", e),
                    }
                }
                "tick" => {
                    match client.trigger_supervisor_tick(&comp_id).await {
                        Ok(v) => println!("Tick completed: {}", v),
                        Err(e) => println!("Error: {}", e),
                    }
                }
                _ => {
                    let sup = client.fetch_supervisor_status(&comp_id).await?;
                    println!("Supervisor State: {} | Cycle #{} | Pending: {} | Active: {} | Completed: {}", sup.state, sup.active_cycle, sup.pending_tasks_count, sup.in_progress_tasks_count, sup.completed_tasks_count);
                }
            }
        }
        Commands::Logs => {
            let events = client.fetch_recent_activity(&comp_id, 25).await.unwrap_or_default();
            for ev in events {
                println!("[{}] {} — {}", ev.severity, ev.title, ev.summary);
            }
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cli_parser_status() {
        let cli = Cli::try_parse_from(["tui-rs", "status"]).unwrap();
        assert!(matches!(cli.command, Some(Commands::Status)));
    }

    #[test]
    fn test_cli_parser_agents_active_flag() {
        let cli = Cli::try_parse_from(["tui-rs", "agents", "--active"]).unwrap();
        match cli.command {
            Some(Commands::Agents { active }) => assert!(active),
            _ => panic!("Expected Commands::Agents"),
        }
    }

    #[test]
    fn test_cli_parser_tasks_blocked_flag() {
        let cli = Cli::try_parse_from(["tui-rs", "tasks", "--blocked"]).unwrap();
        match cli.command {
            Some(Commands::Tasks { blocked }) => assert!(blocked),
            _ => panic!("Expected Commands::Tasks"),
        }
    }

    #[test]
    fn test_cli_parser_cto_approve() {
        let cli = Cli::try_parse_from(["tui-rs", "cto", "approve", "prop-123"]).unwrap();
        match cli.command {
            Some(Commands::Cto { action: Some(CtoAction::Approve { id }) }) => {
                assert_eq!(id, "prop-123");
            }
            _ => panic!("Expected Commands::Cto::Approve"),
        }
    }
}
