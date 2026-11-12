//! Asynchronous API Client for NEIMAN OS Backend (`/api/v1`)
//! Connects native Rust operator node to live FastAPI endpoints.
//! ZERO SYNTHETIC / MOCK FALLBACK DATA — Strict truth-in-presentation.

use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::time::Duration;

pub const DEFAULT_API_URL: &str = "http://127.0.0.1:8000/api/v1";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompanyInfo {
    pub id: String,
    pub name: String,
    pub mission: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentPayload {
    pub id: String,
    pub name: String,
    pub role_title: Option<String>,
    pub status: String,
    pub autonomy: Option<String>,
    pub current_task: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectPayload {
    pub id: String,
    pub name: String,
    pub objective: Option<String>,
    pub status: Option<String>,
    pub priority: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TaskPayload {
    pub id: String,
    pub project_id: Option<String>,
    pub title: String,
    pub status: String,
    pub priority: Option<String>,
    pub assigned_agent_id: Option<String>,
    #[serde(default)]
    pub dependencies: Vec<Value>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub resource_requirements: Option<Value>,
    #[serde(default)]
    pub checklist: Option<Vec<Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ApprovalPayload {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub action: Option<String>,
    #[serde(default)]
    pub target: Option<String>,
    pub risk_level: Option<String>,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub agent_id: Option<String>,
    #[serde(default)]
    pub agent_name: Option<String>,
    #[serde(default)]
    pub agent_role: Option<String>,
    #[serde(default)]
    pub project_id: Option<String>,
    #[serde(default)]
    pub project_name: Option<String>,
    #[serde(default)]
    pub task_id: Option<String>,
    pub status: String,
    pub reason: Option<String>,
    #[serde(default)]
    pub proposed_payload: Option<serde_json::Value>,
    #[serde(default)]
    pub action_fingerprint: Option<String>,
    #[serde(default)]
    pub expires_at: Option<String>,
    #[serde(default)]
    pub reviewer_user_id: Option<String>,
    #[serde(default)]
    pub reviewer_notes: Option<String>,
    #[serde(default)]
    pub resolved_at: Option<String>,
    #[serde(default)]
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityEventPayload {
    pub id: String,
    pub company_id: String,
    pub event_type: String,
    #[serde(default = "default_severity")]
    pub severity: String,
    pub title: String,
    pub summary: String,
    pub agent_name: Option<String>,
    pub agent_id: Option<String>,
    pub target_agent: Option<String>,
    pub task_id: Option<String>,
    pub timestamp: Option<String>,
}

fn default_severity() -> String {
    "INFO".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CapacityItemPayload {
    pub category: String,
    pub unit: String,
    pub limited_capacity: f64,
    pub allocated_capacity: f64,
    pub available_capacity: f64,
    pub observed_usage: f64,
    pub utilization_percentage: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ExpensiveTaskPayload {
    pub task_id: Option<String>,
    pub task_title: String,
    pub agent_name: Option<String>,
    pub cost_usd: f64,
    pub tokens_consumed: i64,
    pub cpu_duration_seconds: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProviderUsagePayload {
    pub provider_name: String,
    pub total_tokens: i64,
    pub total_cost_usd: f64,
    pub request_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DeliveryReportPayload {
    pub run_id: String,
    pub title: String,
    pub current_stage: String,
    pub target_environment: String,
    pub final_verdict: String,
    pub release_authorized: bool,
    pub duration_seconds: f64,
    #[serde(default)]
    pub stages_completed: Vec<String>,
    #[serde(default)]
    pub artifacts: HashMap<String, Value>,
    #[serde(default)]
    pub failures_diagnostics: Vec<Value>,
    #[serde(default)]
    pub rollback_record: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ResourceControlCenterPayload {
    pub active_allocations_count: Option<usize>,
    pub queued_requests_count: Option<usize>,
    pub budget_consumption: Option<Value>,
    pub system_host_telemetry: Option<Value>,
    #[serde(default)]
    pub capacities: Vec<CapacityItemPayload>,
    #[serde(default)]
    pub expensive_tasks: Vec<ExpensiveTaskPayload>,
    #[serde(default)]
    pub provider_usage: Vec<ProviderUsagePayload>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[allow(dead_code)]
pub struct ModelInfoPayload {
    pub id: String,
    pub name: String,
    pub display_name: Option<String>,
    pub is_healthy: Option<bool>,
    pub circuit_breaker_status: Option<String>,
    pub avg_latency_ms: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct EvolutionAdaptationPayload {
    pub id: String,
    pub title: String,
    pub stage: Option<String>,
    pub status: String,
    pub trigger_diagnosis: Option<String>,
    pub expected_improvement: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ConstitutionPayload {
    pub id: Option<String>,
    pub version: Option<i64>,
    pub is_active: Option<bool>,
    pub mission: Option<String>,
    #[serde(default)]
    pub values: Vec<String>,
    #[serde(default)]
    pub operating_principles: Vec<String>,
    #[serde(default)]
    pub prohibited_actions: Vec<String>,
    #[serde(default)]
    pub approval_requirements: Vec<String>,
    #[serde(default)]
    pub security_rules: Vec<String>,
    #[serde(default)]
    pub financial_rules: Vec<String>,
    #[serde(default)]
    pub data_rules: Vec<String>,
    #[serde(default)]
    pub escalation_rules: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GovernanceAuditPayload {
    pub id: String,
    pub actor_name: Option<String>,
    pub actor_type: Option<String>,
    pub authority: Option<String>,
    pub action: Option<String>,
    pub target: Option<String>,
    pub reason: Option<String>,
    pub result: Option<String>,
    pub risk_level: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SourceGraphBlastRadiusPayload {
    pub target: String,
    pub risk_level: String,
    pub risk_score: u32,
    pub total_impacted_files: usize,
    #[serde(default)]
    pub direct_dependents: Vec<Value>,
    #[serde(default)]
    pub transitive_dependents: Vec<Value>,
    #[serde(default)]
    pub impacted_endpoints: Vec<Value>,
    #[serde(default)]
    pub impacted_tests: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SourceGraphDefinitionPayload {
    pub symbol: String,
    pub file_path: Option<String>,
    pub line_number: Option<usize>,
    pub signature: Option<String>,
    pub docstring: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GitStatusPayload {
    pub branch: String,
    pub upstream: Option<String>,
    pub ahead: usize,
    pub behind: usize,
    pub is_clean: bool,
    #[serde(default)]
    pub staged_files: Vec<Value>,
    #[serde(default)]
    pub unstaged_files: Vec<Value>,
    #[serde(default)]
    pub untracked_files: Vec<String>,
    #[serde(default)]
    pub stashes_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GitRemoteItemPayload {
    pub name: String,
    pub url: String,
    pub is_official: bool,
    pub is_private: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GitRemotesPayload {
    pub remotes: Vec<GitRemoteItemPayload>,
    pub official_configured: bool,
    pub official_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ReleaseSyncPayload {
    pub success: bool,
    pub target_remote: String,
    pub remote_url: String,
    pub source_branch: String,
    pub target_branch: String,
    pub release_tag: Option<String>,
    pub commit_sha: String,
    pub short_sha: String,
    pub dry_run: bool,
    pub message: String,
    #[serde(default)]
    pub preflight_checks: Vec<Value>,
}

impl TaskPayload {
    pub fn dependency_ids(&self) -> Vec<String> {
        self.dependencies
            .iter()
            .filter_map(|d| {
                d.as_str()
                    .map(|s| s.to_string())
                    .or_else(|| d.as_u64().map(|n| n.to_string()))
            })
            .collect()
    }
}

#[derive(Clone)]
pub struct NeimanClient {
    client: Client,
    pub base_url: String,
    pub token: Option<String>,
    pub active_company_id: Option<String>,
}

impl NeimanClient {
    pub fn new(base_url: Option<&str>) -> Self {
        let base_url = base_url
            .map(|s| s.to_string())
            .or_else(|| std::env::var("NEIMAN_API_URL").ok())
            .unwrap_or_else(|| DEFAULT_API_URL.to_string())
            .trim_end_matches('/')
            .to_string();

        let token = std::env::var("NEIMAN_TOKEN").ok();

        let client = Client::builder()
            .timeout(Duration::from_millis(2500))
            .build()
            .unwrap_or_else(|_| Client::new());

        Self {
            client,
            base_url,
            token,
            active_company_id: None,
        }
    }

    pub async fn login(&mut self, email: &str, password: &str) -> bool {
        let url = format!("{}/auth/login", self.base_url);
        let body = serde_json::json!({
            "email": email,
            "password": password
        });

        match self.client.post(&url).json(&body).send().await {
            Ok(resp) if resp.status().is_success() => {
                if let Ok(data) = resp.json::<Value>().await {
                    if let Some(tok) = data.get("access_token").and_then(|t| t.as_str()) {
                        self.token = Some(tok.to_string());
                        return true;
                    }
                }
            }
            _ => {}
        }
        false
    }

    fn auth_header(&self) -> Option<String> {
        self.token.as_ref().map(|t| format!("Bearer {}", t))
    }

    pub async fn check_health(&self) -> Result<serde_json::Value, String> {
        let url = format!("{}/health", self.base_url);
        let req = self.client.get(&url).timeout(Duration::from_millis(1500));
        match req.send().await {
            Ok(resp) if resp.status().is_success() => {
                resp.json::<Value>().await.map_err(|e| format!("Health schema parse error: {e}"))
            }
            Ok(resp) => {
                let root_health = self.base_url.trim_end_matches("/api/v1").to_string() + "/health";
                if let Ok(resp2) = self.client.get(&root_health).timeout(Duration::from_millis(1200)).send().await {
                    if resp2.status().is_success() {
                        return resp2.json::<Value>().await.map_err(|e| format!("Health schema parse error: {e}"));
                    }
                }
                Err(format!("Health check failed with HTTP {}", resp.status()))
            }
            Err(e) => {
                let root_health = self.base_url.trim_end_matches("/api/v1").to_string() + "/health";
                if let Ok(resp2) = self.client.get(&root_health).timeout(Duration::from_millis(1200)).send().await {
                    if resp2.status().is_success() {
                        return resp2.json::<Value>().await.map_err(|e| format!("Health schema parse error: {e}"));
                    }
                }
                Err(format!("Backend unreachable at {}: {}", self.base_url, e))
            }
        }
    }

    pub async fn fetch_companies(&mut self) -> Result<Vec<CompanyInfo>, String> {
        // First try /companies/me
        let url = format!("{}/companies/me", self.base_url);
        let mut req = self.client.get(&url);
        if let Some(auth) = self.auth_header() {
            req = req.header("Authorization", auth);
        }

        let mut me_was_ok = false;
        if let Ok(resp) = req.send().await {
            if resp.status().is_success() {
                me_was_ok = true;
                if let Ok(companies) = resp.json::<Vec<CompanyInfo>>().await {
                    if !companies.is_empty() {
                        if self.active_company_id.is_none() {
                            if let Some(first) = companies.first() {
                                self.active_company_id = Some(first.id.clone());
                            }
                        }
                        return Ok(companies);
                    }
                }
            }
        }

        // Fallback try /companies
        let url_all = format!("{}/companies", self.base_url);
        let mut req_all = self.client.get(&url_all);
        if let Some(auth) = self.auth_header() {
            req_all = req_all.header("Authorization", auth);
        }

        match req_all.send().await {
            Ok(resp) if resp.status().is_success() => {
                let companies = resp.json::<Vec<CompanyInfo>>().await.map_err(|e| e.to_string())?;
                if self.active_company_id.is_none() {
                    if let Some(first) = companies.first() {
                        self.active_company_id = Some(first.id.clone());
                    }
                }
                Ok(companies)
            }
            Ok(resp) if resp.status() == reqwest::StatusCode::UNAUTHORIZED => {
                let email = std::env::var("NEIMAN_EMAIL").unwrap_or_else(|_| "admin@neiman.ai".into());
                let password = std::env::var("NEIMAN_PASSWORD").unwrap_or_else(|_| "neiman-local".into());
                if self.login(&email, &password).await {
                    let mut retry_req = self.client.get(&url_all);
                    if let Some(auth) = self.auth_header() {
                        retry_req = retry_req.header("Authorization", auth);
                    }
                    if let Ok(resp_retry) = retry_req.send().await {
                        if resp_retry.status().is_success() {
                            let companies = resp_retry.json::<Vec<CompanyInfo>>().await.map_err(|e| e.to_string())?;
                            if self.active_company_id.is_none() {
                                if let Some(first) = companies.first() {
                                    self.active_company_id = Some(first.id.clone());
                                }
                            }
                            return Ok(companies);
                        }
                    }
                }
                Err("Authentication required (HTTP 401). Set NEIMAN_TOKEN or verify credentials.".into())
            }
            Ok(_resp) if me_was_ok => {
                // If /companies/me succeeded with 0 companies, return empty list cleanly
                Ok(Vec::new())
            }
            Ok(resp) => Err(format!("Backend HTTP error: status {}", resp.status())),
            Err(_) if me_was_ok => Ok(Vec::new()),
            Err(e) => Err(format!("Unreachable API at {}: {}", self.base_url, e)),
        }
    }

    pub async fn fetch_agents(&self, company_id: &str) -> Result<Vec<AgentPayload>, String> {
        let url = format!("{}/companies/{}/agents", self.base_url, company_id);
        let mut req = self.client.get(&url);
        if let Some(auth) = self.auth_header() {
            req = req.header("Authorization", auth);
        }

        match req.send().await {
            Ok(resp) if resp.status().is_success() => {
                resp.json::<Vec<AgentPayload>>().await.map_err(|e| e.to_string())
            }
            Ok(resp) => Err(format!("HTTP {}", resp.status())),
            Err(e) => Err(e.to_string()),
        }
    }

    pub async fn fetch_approvals(&self, company_id: &str) -> Result<Vec<ApprovalPayload>, String> {
        let url = format!("{}/companies/{}/governance/approvals", self.base_url, company_id);
        let mut req = self.client.get(&url);
        if let Some(auth) = self.auth_header() {
            req = req.header("Authorization", auth);
        }

        match req.send().await {
            Ok(resp) if resp.status().is_success() => {
                resp.json::<Vec<ApprovalPayload>>().await.map_err(|e| e.to_string())
            }
            Ok(resp) => Err(format!("HTTP {}", resp.status())),
            Err(e) => Err(e.to_string()),
        }
    }

    pub async fn fetch_projects(&self, company_id: &str) -> Result<Vec<ProjectPayload>, String> {
        let url = format!("{}/companies/{}/projects", self.base_url, company_id);
        let mut req = self.client.get(&url);
        if let Some(auth) = self.auth_header() {
            req = req.header("Authorization", auth);
        }

        match req.send().await {
            Ok(resp) if resp.status().is_success() => {
                resp.json::<Vec<ProjectPayload>>().await.map_err(|e| e.to_string())
            }
            Ok(resp) => Err(format!("HTTP {}", resp.status())),
            Err(e) => Err(e.to_string()),
        }
    }

    pub async fn create_project(
        &self,
        company_id: &str,
        name: &str,
        objective: Option<&str>,
    ) -> Result<ProjectPayload, String> {
        let url = format!("{}/companies/{}/projects", self.base_url, company_id);
        let body = serde_json::json!({
            "name": name,
            "objective": objective
        });
        let mut req = self.client.post(&url).json(&body);
        if let Some(auth) = self.auth_header() {
            req = req.header("Authorization", auth);
        }

        match req.send().await {
            Ok(resp) if resp.status().is_success() => {
                resp.json::<ProjectPayload>().await.map_err(|e| e.to_string())
            }
            Ok(resp) => Err(format!("Failed with HTTP {}", resp.status())),
            Err(e) => Err(e.to_string()),
        }
    }

    pub async fn assign_task(
        &self,
        company_id: &str,
        project_id: &str,
        task_id: &str,
        agent_id: &str,
    ) -> Result<TaskPayload, String> {
        let url = format!(
            "{}/companies/{}/projects/{}/tasks/{}",
            self.base_url, company_id, project_id, task_id
        );
        let body = serde_json::json!({
            "assigned_agent_id": agent_id
        });
        let mut req = self.client.patch(&url).json(&body);
        if let Some(auth) = self.auth_header() {
            req = req.header("Authorization", auth);
        }

        match req.send().await {
            Ok(resp) if resp.status().is_success() => {
                resp.json::<TaskPayload>().await.map_err(|e| e.to_string())
            }
            Ok(resp) => Err(format!("Failed with HTTP {}", resp.status())),
            Err(e) => Err(e.to_string()),
        }
    }

    pub async fn update_task_status(
        &self,
        company_id: &str,
        project_id: &str,
        task_id: &str,
        status: &str,
    ) -> Result<TaskPayload, String> {
        let url = format!(
            "{}/companies/{}/projects/{}/tasks/{}",
            self.base_url, company_id, project_id, task_id
        );
        let body = serde_json::json!({
            "status": status
        });
        let mut req = self.client.patch(&url).json(&body);
        if let Some(auth) = self.auth_header() {
            req = req.header("Authorization", auth);
        }

        match req.send().await {
            Ok(resp) if resp.status().is_success() => {
                resp.json::<TaskPayload>().await.map_err(|e| e.to_string())
            }
            Ok(resp) => Err(format!("Failed with HTTP {}", resp.status())),
            Err(e) => Err(e.to_string()),
        }
    }

    pub async fn update_task_checklist(
        &self,
        company_id: &str,
        project_id: &str,
        task_id: &str,
        checklist: &[Value],
        mut resource_requirements: Value,
    ) -> Result<TaskPayload, String> {
        if !resource_requirements.is_object() {
            resource_requirements = serde_json::json!({});
        }
        resource_requirements["checklist"] = serde_json::json!(checklist);

        let url = format!(
            "{}/companies/{}/projects/{}/tasks/{}",
            self.base_url, company_id, project_id, task_id
        );
        let body = serde_json::json!({
            "resource_requirements": resource_requirements
        });
        let mut req = self.client.patch(&url).json(&body);
        if let Some(auth) = self.auth_header() {
            req = req.header("Authorization", auth);
        }

        match req.send().await {
            Ok(resp) if resp.status().is_success() => {
                resp.json::<TaskPayload>().await.map_err(|e| e.to_string())
            }
            Ok(resp) => Err(format!("Failed with HTTP {}", resp.status())),
            Err(e) => Err(e.to_string()),
        }
    }

    pub async fn fetch_project_tasks(
        &self,
        company_id: &str,
        project_id: &str,
    ) -> Result<Vec<TaskPayload>, String> {
        let url = format!("{}/companies/{}/projects/{}/tasks", self.base_url, company_id, project_id);
        let mut req = self.client.get(&url);
        if let Some(auth) = self.auth_header() {
            req = req.header("Authorization", auth);
        }

        match req.send().await {
            Ok(resp) if resp.status().is_success() => {
                resp.json::<Vec<TaskPayload>>().await.map_err(|e| e.to_string())
            }
            Ok(resp) => Err(format!("HTTP {}", resp.status())),
            Err(e) => Err(e.to_string()),
        }
    }

    #[allow(dead_code)]
    pub async fn fetch_all_tasks(&self, company_id: &str) -> Result<Vec<TaskPayload>, String> {
        let projects = self.fetch_projects(company_id).await?;
        let mut all_tasks = Vec::new();

        for proj in projects {
            if let Ok(tasks) = self.fetch_project_tasks(company_id, &proj.id).await {
                all_tasks.extend(tasks);
            }
        }

        Ok(all_tasks)
    }

    pub async fn fetch_recent_activity(
        &self,
        company_id: &str,
        limit: usize,
    ) -> Result<Vec<ActivityEventPayload>, String> {
        let url = format!("{}/companies/{}/activity?limit={}", self.base_url, company_id, limit);
        let mut req = self.client.get(&url);
        if let Some(auth) = self.auth_header() {
            req = req.header("Authorization", auth);
        }

        match req.send().await {
            Ok(resp) if resp.status().is_success() => {
                resp.json::<Vec<ActivityEventPayload>>().await.map_err(|e| e.to_string())
            }
            Ok(resp) => Err(format!("HTTP {}", resp.status())),
            Err(e) => Err(e.to_string()),
        }
    }

    pub async fn decide_approval(
        &self,
        company_id: &str,
        request_id: &str,
        decision: &str,
        reason: &str,
    ) -> Result<bool, String> {
        let url = format!(
            "{}/companies/{}/governance/approvals/{}/decision",
            self.base_url, company_id, request_id
        );
        let body = serde_json::json!({
            "decision": decision,
            "reviewer_notes": reason
        });
        let mut req = self.client.post(&url).json(&body);
        if let Some(auth) = self.auth_header() {
            req = req.header("Authorization", auth);
        }

        match req.send().await {
            Ok(resp) if resp.status().is_success() => Ok(true),
            Ok(resp) => Err(format!("Failed with HTTP {}", resp.status())),
            Err(e) => Err(e.to_string()),
        }
    }

    pub async fn transition_agent(
        &self,
        company_id: &str,
        agent_id: &str,
        status: &str,
        reason: &str,
    ) -> Result<bool, String> {
        let url = format!(
            "{}/companies/{}/agents/{}/transition",
            self.base_url, company_id, agent_id
        );
        let body = serde_json::json!({
            "status": status,
            "reason": reason
        });
        let mut req = self.client.post(&url).json(&body);
        if let Some(auth) = self.auth_header() {
            req = req.header("Authorization", auth);
        }

        match req.send().await {
            Ok(resp) if resp.status().is_success() => Ok(true),
            Ok(resp) => Err(format!("Failed with HTTP {}", resp.status())),
            Err(e) => Err(e.to_string()),
        }
    }

    pub async fn reset_circuit_breakers(&self, company_id: &str) -> Result<bool, String> {
        let url = format!(
            "{}/companies/{}/intelligence/circuit-breakers/reset",
            self.base_url, company_id
        );
        let mut req = self.client.post(&url);
        if let Some(auth) = self.auth_header() {
            req = req.header("Authorization", auth);
        }

        match req.send().await {
            Ok(resp) if resp.status().is_success() => Ok(true),
            Ok(resp) => Err(format!("Failed with HTTP {}", resp.status())),
            Err(e) => Err(e.to_string()),
        }
    }

    pub async fn fetch_resources(&self, company_id: &str) -> Result<ResourceControlCenterPayload, String> {
        let url = format!("{}/companies/{}/resources/control-center", self.base_url, company_id);
        let mut req = self.client.get(&url);
        if let Some(auth) = self.auth_header() {
            req = req.header("Authorization", auth);
        }
        match req.send().await {
            Ok(resp) if resp.status().is_success() => {
                resp.json::<ResourceControlCenterPayload>().await.map_err(|e| e.to_string())
            }
            Ok(resp) => Err(format!("HTTP {}", resp.status())),
            Err(e) => Err(e.to_string()),
        }
    }

    pub async fn fetch_intelligence_dashboard(&self, company_id: &str) -> Result<Value, String> {
        let url = format!("{}/companies/{}/intelligence/dashboard", self.base_url, company_id);
        let mut req = self.client.get(&url);
        if let Some(auth) = self.auth_header() {
            req = req.header("Authorization", auth);
        }
        match req.send().await {
            Ok(resp) if resp.status().is_success() => {
                resp.json::<Value>().await.map_err(|e| e.to_string())
            }
            Ok(resp) => Err(format!("HTTP {}", resp.status())),
            Err(e) => Err(e.to_string()),
        }
    }

    pub async fn fetch_evolution_adaptations(&self, company_id: &str) -> Result<Vec<EvolutionAdaptationPayload>, String> {
        let url = format!("{}/companies/{}/evolution/adaptations", self.base_url, company_id);
        let mut req = self.client.get(&url);
        if let Some(auth) = self.auth_header() {
            req = req.header("Authorization", auth);
        }
        match req.send().await {
            Ok(resp) if resp.status().is_success() => {
                resp.json::<Vec<EvolutionAdaptationPayload>>().await.map_err(|e| e.to_string())
            }
            Ok(resp) => Err(format!("HTTP {}", resp.status())),
            Err(e) => Err(e.to_string()),
        }
    }

    pub async fn fetch_delivery_report(&self, run_id: &str) -> Result<DeliveryReportPayload, String> {
        let url = format!("{}/delivery/runs/{}/report", self.base_url, run_id);
        let mut req = self.client.get(&url);
        if let Some(auth) = self.auth_header() {
            req = req.header("Authorization", auth);
        }
        match req.send().await {
            Ok(resp) if resp.status().is_success() => {
                resp.json::<DeliveryReportPayload>().await.map_err(|e| e.to_string())
            }
            Ok(resp) => Err(format!("HTTP {}", resp.status())),
            Err(e) => Err(e.to_string()),
        }
    }

    pub async fn trigger_delivery_run(
        &self,
        title: &str,
        raw_request: &str,
        target_env: &str,
        ceo_approved: bool,
    ) -> Result<DeliveryReportPayload, String> {
        let url = format!("{}/delivery/runs", self.base_url);
        let body = serde_json::json!({
            "title": title,
            "raw_request": raw_request,
            "target_environment": target_env,
            "ceo_approved": ceo_approved
        });
        let mut req = self.client.post(&url).json(&body);
        if let Some(auth) = self.auth_header() {
            req = req.header("Authorization", auth);
        }
        match req.send().await {
            Ok(resp) if resp.status().is_success() => {
                resp.json::<DeliveryReportPayload>().await.map_err(|e| e.to_string())
            }
            Ok(resp) => Err(format!("HTTP {}", resp.status())),
            Err(e) => Err(e.to_string()),
        }
    }

    pub async fn simulate_adaptation(
        &self,
        company_id: &str,
        adaptation_id: &str,
    ) -> Result<EvolutionAdaptationPayload, String> {
        let url = format!(
            "{}/companies/{}/evolution/adaptations/{}/simulate",
            self.base_url, company_id, adaptation_id
        );
        let body = serde_json::json!({
            "synthetic_task_count": 20,
            "stress_multiplier": 1.5
        });
        let mut req = self.client.post(&url).json(&body);
        if let Some(auth) = self.auth_header() {
            req = req.header("Authorization", auth);
        }
        match req.send().await {
            Ok(resp) if resp.status().is_success() => {
                resp.json::<EvolutionAdaptationPayload>().await.map_err(|e| e.to_string())
            }
            Ok(resp) => Err(format!("Simulate failed HTTP {}", resp.status())),
            Err(e) => Err(e.to_string()),
        }
    }

    pub async fn approve_adaptation(
        &self,
        company_id: &str,
        adaptation_id: &str,
        notes: &str,
    ) -> Result<EvolutionAdaptationPayload, String> {
        let url = format!(
            "{}/companies/{}/evolution/adaptations/{}/approve",
            self.base_url, company_id, adaptation_id
        );
        let body = serde_json::json!({ "reviewer_notes": notes });
        let mut req = self.client.post(&url).json(&body);
        if let Some(auth) = self.auth_header() {
            req = req.header("Authorization", auth);
        }
        match req.send().await {
            Ok(resp) if resp.status().is_success() => {
                resp.json::<EvolutionAdaptationPayload>().await.map_err(|e| e.to_string())
            }
            Ok(resp) => Err(format!("Approve failed HTTP {}", resp.status())),
            Err(e) => Err(e.to_string()),
        }
    }

    pub async fn rollback_adaptation(
        &self,
        company_id: &str,
        adaptation_id: &str,
        reason: &str,
        learning_notes: &str,
    ) -> Result<EvolutionAdaptationPayload, String> {
        let url = format!(
            "{}/companies/{}/evolution/adaptations/{}/rollback",
            self.base_url, company_id, adaptation_id
        );
        let body = serde_json::json!({
            "rollback_reason": reason,
            "learning_notes": learning_notes
        });
        let mut req = self.client.post(&url).json(&body);
        if let Some(auth) = self.auth_header() {
            req = req.header("Authorization", auth);
        }
        match req.send().await {
            Ok(resp) if resp.status().is_success() => {
                resp.json::<EvolutionAdaptationPayload>().await.map_err(|e| e.to_string())
            }
            Ok(resp) => Err(format!("Rollback failed HTTP {}", resp.status())),
            Err(e) => Err(e.to_string()),
        }
    }

    pub async fn fetch_constitution(
        &self,
        company_id: &str,
    ) -> Result<ConstitutionPayload, String> {
        let url = format!(
            "{}/companies/{}/governance/constitution",
            self.base_url, company_id
        );
        let mut req = self.client.get(&url);
        if let Some(auth) = self.auth_header() {
            req = req.header("Authorization", auth);
        }
        match req.send().await {
            Ok(resp) if resp.status().is_success() => {
                resp.json::<ConstitutionPayload>().await.map_err(|e| e.to_string())
            }
            Ok(resp) => Err(format!("HTTP {}", resp.status())),
            Err(e) => Err(e.to_string()),
        }
    }

    pub async fn fetch_governance_audits(
        &self,
        company_id: &str,
        limit: usize,
    ) -> Result<Vec<GovernanceAuditPayload>, String> {
        let url = format!(
            "{}/companies/{}/governance/audits?limit={}",
            self.base_url, company_id, limit
        );
        let mut req = self.client.get(&url);
        if let Some(auth) = self.auth_header() {
            req = req.header("Authorization", auth);
        }
        match req.send().await {
            Ok(resp) if resp.status().is_success() => {
                resp.json::<Vec<GovernanceAuditPayload>>()
                    .await
                    .map_err(|e| e.to_string())
            }
            Ok(resp) => Err(format!("HTTP {}", resp.status())),
            Err(e) => Err(e.to_string()),
        }
    }

    pub async fn fetch_cto_status(&self, company_id: &str) -> Result<CTOStatusPayload, String> {
        let url = format!("{}/companies/{}/cto/status", self.base_url, company_id);
        let mut req = self.client.get(&url);
        if let Some(auth) = self.auth_header() {
            req = req.header("Authorization", auth);
        }
        match req.send().await {
            Ok(resp) if resp.status().is_success() => {
                resp.json::<CTOStatusPayload>().await.map_err(|e| e.to_string())
            }
            Ok(resp) => Err(format!("HTTP {}", resp.status())),
            Err(e) => Err(e.to_string()),
        }
    }

    pub async fn fetch_cto_proposals(&self, company_id: &str) -> Result<Vec<CTOProposalPayload>, String> {
        let url = format!("{}/companies/{}/cto/proposals", self.base_url, company_id);
        let mut req = self.client.get(&url);
        if let Some(auth) = self.auth_header() {
            req = req.header("Authorization", auth);
        }
        match req.send().await {
            Ok(resp) if resp.status().is_success() => {
                resp.json::<Vec<CTOProposalPayload>>().await.map_err(|e| e.to_string())
            }
            Ok(resp) => Err(format!("HTTP {}", resp.status())),
            Err(e) => Err(e.to_string()),
        }
    }

    pub async fn send_cto_directive(&self, company_id: &str, directive: &str) -> Result<Value, String> {
        let url = format!("{}/companies/{}/cto/directive", self.base_url, company_id);
        let payload = serde_json::json!({
            "directive": directive,
            "priority": "HIGH"
        });
        let mut req = self.client.post(&url).json(&payload);
        if let Some(auth) = self.auth_header() {
            req = req.header("Authorization", auth);
        }
        match req.send().await {
            Ok(resp) if resp.status().is_success() => {
                resp.json::<Value>().await.map_err(|e| e.to_string())
            }
            Ok(resp) => Err(format!("HTTP {}", resp.status())),
            Err(e) => Err(e.to_string()),
        }
    }

    pub async fn decide_cto_proposal(&self, company_id: &str, proposal_id: &str, decision: &str) -> Result<CTOProposalPayload, String> {
        let url = format!("{}/companies/{}/cto/proposals/{}/decide", self.base_url, company_id, proposal_id);
        let payload = serde_json::json!({
            "decision": decision,
            "notes": "Decided via NEIMAN native operator TUI"
        });
        let mut req = self.client.post(&url).json(&payload);
        if let Some(auth) = self.auth_header() {
            req = req.header("Authorization", auth);
        }
        match req.send().await {
            Ok(resp) if resp.status().is_success() => {
                resp.json::<CTOProposalPayload>().await.map_err(|e| e.to_string())
            }
            Ok(resp) => Err(format!("HTTP {}", resp.status())),
            Err(e) => Err(e.to_string()),
        }
    }

    pub async fn fetch_supervisor_status(&self, company_id: &str) -> Result<SupervisorStatusPayload, String> {
        let url = format!("{}/companies/{}/cto/supervisor/status", self.base_url, company_id);
        let mut req = self.client.get(&url);
        if let Some(auth) = self.auth_header() {
            req = req.header("Authorization", auth);
        }
        match req.send().await {
            Ok(resp) if resp.status().is_success() => {
                resp.json::<SupervisorStatusPayload>().await.map_err(|e| e.to_string())
            }
            Ok(resp) => Err(format!("HTTP {}", resp.status())),
            Err(e) => Err(e.to_string()),
        }
    }

    pub async fn toggle_supervisor(&self, company_id: &str, action: &str) -> Result<SupervisorStatusPayload, String> {
        let url = format!("{}/companies/{}/cto/supervisor/toggle", self.base_url, company_id);
        let payload = serde_json::json!({ "action": action });
        let mut req = self.client.post(&url).json(&payload);
        if let Some(auth) = self.auth_header() {
            req = req.header("Authorization", auth);
        }
        match req.send().await {
            Ok(resp) if resp.status().is_success() => {
                resp.json::<SupervisorStatusPayload>().await.map_err(|e| e.to_string())
            }
            Ok(resp) => Err(format!("HTTP {}", resp.status())),
            Err(e) => Err(e.to_string()),
        }
    }

    pub async fn trigger_supervisor_tick(&self, company_id: &str) -> Result<Value, String> {
        let url = format!("{}/companies/{}/cto/supervisor/tick", self.base_url, company_id);
        let mut req = self.client.post(&url);
        if let Some(auth) = self.auth_header() {
            req = req.header("Authorization", auth);
        }
        match req.send().await {
            Ok(resp) if resp.status().is_success() => {
                resp.json::<Value>().await.map_err(|e| e.to_string())
            }
            Ok(resp) => Err(format!("HTTP {}", resp.status())),
            Err(e) => Err(e.to_string()),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CTOStatusPayload {
    pub company_id: String,
    pub cto_agent_id: String,
    pub cto_agent_name: String,
    pub total_agents: usize,
    pub working_agents: usize,
    pub pending_proposals_count: usize,
    pub active_tasks_count: usize,
    pub completed_tasks_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CTOProposalPayload {
    pub id: String,
    pub title: String,
    pub category: String,
    pub rationale: String,
    pub impact_assessment: String,
    pub status: String,
    #[serde(default)]
    pub proposed_tasks: Vec<Value>,
    #[serde(default)]
    pub delegated_task_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SupervisorStatusPayload {
    pub company_id: String,
    pub is_running: bool,
    pub state: String,
    pub active_cycle: usize,
    pub last_tick_at: Option<String>,
    pub pending_tasks_count: usize,
    pub in_progress_tasks_count: usize,
    pub completed_tasks_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct WorkspaceInspectionPayload {
    pub target_path: String,
    pub is_existing_codebase: bool,
    pub project_name: String,
    pub primary_language: String,
    #[serde(default)]
    pub detected_frameworks: Vec<String>,
    pub git_remote: Option<String>,
    pub git_branch: Option<String>,
    pub git_commit: Option<String>,
    pub summary: String,
    #[serde(default)]
    pub key_components: Vec<String>,
    #[serde(default)]
    pub suggested_initiatives: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CTODirectiveResultPayload {
    pub directive: String,
    pub cto_agent_name: String,
    pub analysis: String,
    pub tasks_created_count: usize,
    #[serde(default)]
    pub tasks: Vec<Value>,
    #[serde(default)]
    pub intent: Option<String>,
}

impl NeimanClient {
    pub async fn instantiate_blueprint(
        &self,
        blueprint_key: &str,
        company_name: &str,
    ) -> Result<String, String> {
        let url = format!("{}/blueprints/{}/instantiate", self.base_url, blueprint_key);
        let body = serde_json::json!({
            "company_name": company_name
        });
        let mut req = self.client.post(&url).json(&body);
        if let Some(auth) = self.auth_header() {
            req = req.header("Authorization", auth);
        }

        match req.send().await {
            Ok(resp) if resp.status().is_success() => {
                let v: Value = resp.json().await.map_err(|e| e.to_string())?;
                let comp_id = v["company_id"]
                    .as_str()
                    .or_else(|| v["company"]["id"].as_str())
                    .or_else(|| v["id"].as_str())
                    .unwrap_or("")
                    .to_string();
                if comp_id.is_empty() {
                    Err("Failed to parse created company ID".into())
                } else {
                    Ok(comp_id)
                }
            }
            Ok(resp) => Err(format!("Instantiate failed with HTTP {}", resp.status())),
            Err(e) => Err(e.to_string()),
        }
    }

    pub async fn inspect_workspace(
        &self,
        company_id: &str,
        path: &str,
    ) -> Result<WorkspaceInspectionPayload, String> {
        let url = format!("{}/companies/{}/projects/inspect", self.base_url, company_id);
        let body = serde_json::json!({ "path": path });
        let mut req = self.client.post(&url).json(&body);
        if let Some(auth) = self.auth_header() {
            req = req.header("Authorization", auth);
        }

        match req.send().await {
            Ok(resp) if resp.status().is_success() => {
                resp.json::<WorkspaceInspectionPayload>().await.map_err(|e| e.to_string())
            }
            Ok(resp) => Err(format!("Inspection failed with HTTP {}", resp.status())),
            Err(e) => Err(e.to_string()),
        }
    }

    pub async fn create_task(
        &self,
        company_id: &str,
        project_id: &str,
        title: &str,
        priority: &str,
    ) -> Result<TaskPayload, String> {
        let url = format!("{}/companies/{}/projects/{}/tasks", self.base_url, company_id, project_id);
        let body = serde_json::json!({
            "title": title,
            "priority": priority
        });
        let mut req = self.client.post(&url).json(&body);
        if let Some(auth) = self.auth_header() {
            req = req.header("Authorization", auth);
        }

        match req.send().await {
            Ok(resp) if resp.status().is_success() => {
                resp.json::<TaskPayload>().await.map_err(|e| e.to_string())
            }
            Ok(resp) => Err(format!("Failed to create task: HTTP {}", resp.status())),
            Err(e) => Err(e.to_string()),
        }
    }

    pub async fn post_cto_directive(
        &self,
        company_id: &str,
        directive: &str,
        project_id: Option<&str>,
    ) -> Result<CTODirectiveResultPayload, String> {
        let url = format!("{}/companies/{}/cto/directive", self.base_url, company_id);
        let valid_uuid = project_id.filter(|&id| uuid::Uuid::parse_str(id).is_ok());

        let mut body = serde_json::json!({
            "directive": directive,
            "priority": "HIGH",
        });
        if let Some(uid) = valid_uuid {
            body["project_id"] = serde_json::Value::String(uid.to_string());
        }

        let mut req = self.client.post(&url).json(&body);
        if let Some(auth) = self.auth_header() {
            req = req.header("Authorization", auth);
        }

        match req.send().await {
            Ok(resp) if resp.status().is_success() => {
                resp.json::<CTODirectiveResultPayload>().await.map_err(|e| e.to_string())
            }
            Ok(resp) => {
                let status = resp.status();
                let err_msg = resp.text().await.unwrap_or_default();
                if let Ok(json_err) = serde_json::from_str::<serde_json::Value>(&err_msg) {
                    if let Some(detail) = json_err.get("detail") {
                        if let Some(arr) = detail.as_array() {
                            let msgs: Vec<String> = arr
                                .iter()
                                .filter_map(|d| d.get("msg").and_then(|m| m.as_str()).map(|s| s.to_string()))
                                .collect();
                            if !msgs.is_empty() {
                                return Err(format!("Directive validation error (HTTP {status}): {}", msgs.join("; ")));
                            }
                        } else if let Some(s) = detail.as_str() {
                            return Err(format!("Directive error (HTTP {status}): {s}"));
                        }
                    }
                }
                Err(format!("Directive failed with HTTP {status}: {err_msg}"))
            }
            Err(e) => Err(e.to_string()),
        }
    }

    pub async fn configure_provider(
        &self,
        company_id: &str,
        provider_name: &str,
        api_key: Option<&str>,
        base_url: Option<&str>,
    ) -> Result<ProviderConfigureResult, String> {
        let url = format!("{}/companies/{}/intelligence/providers/{}/configure", self.base_url, company_id, provider_name);
        let mut body = serde_json::Map::new();
        if let Some(k) = api_key {
            body.insert("api_key".into(), serde_json::Value::String(k.into()));
        }
        if let Some(u) = base_url {
            body.insert("base_url".into(), serde_json::Value::String(u.into()));
        }
        body.insert("auto_discover".into(), serde_json::Value::Bool(true));
        body.insert("set_as_primary".into(), serde_json::Value::Bool(true));

        let mut req = self.client.post(&url).json(&body);
        if let Some(auth) = self.auth_header() {
            req = req.header("Authorization", auth);
        }

        match req.send().await {
            Ok(resp) if resp.status().is_success() => {
                resp.json::<ProviderConfigureResult>().await.map_err(|e| e.to_string())
            }
            Ok(resp) => Err(format!("Configure provider failed: HTTP {}", resp.status())),
            Err(e) => Err(e.to_string()),
        }
    }

    pub async fn probe_provider(
        &self,
        company_id: &str,
        provider_name: &str,
    ) -> Result<ProviderProbeResult, String> {
        let url = format!("{}/companies/{}/intelligence/providers/{}/probe", self.base_url, company_id, provider_name);
        let body = serde_json::json!({ "timeout_seconds": 5.0 });
        let mut req = self.client.post(&url).json(&body);
        if let Some(auth) = self.auth_header() {
            req = req.header("Authorization", auth);
        }

        match req.send().await {
            Ok(resp) if resp.status().is_success() => {
                resp.json::<ProviderProbeResult>().await.map_err(|e| e.to_string())
            }
            Ok(resp) => Err(format!("Provider probe failed: HTTP {}", resp.status())),
            Err(e) => Err(e.to_string()),
        }
    }

    pub async fn fetch_agent_profile(
        &self,
        company_id: &str,
        agent_id: &str,
    ) -> Result<AgentProfilePayload, String> {
        let url = format!("{}/companies/{}/agents/{}/profile", self.base_url, company_id, agent_id);
        let mut req = self.client.get(&url);
        if let Some(auth) = self.auth_header() {
            req = req.header("Authorization", auth);
        }

        match req.send().await {
            Ok(resp) if resp.status().is_success() => {
                resp.json::<AgentProfilePayload>().await.map_err(|e| e.to_string())
            }
            Ok(resp) => Err(format!("Failed to fetch agent profile: HTTP {}", resp.status())),
            Err(e) => Err(e.to_string()),
        }
    }

    pub async fn create_assigned_task(
        &self,
        company_id: &str,
        project_id: &str,
        agent_id: &str,
        title: &str,
        priority: &str,
    ) -> Result<TaskPayload, String> {
        let url = format!("{}/companies/{}/projects/{}/tasks", self.base_url, company_id, project_id);
        let mut body = serde_json::json!({
            "title": title,
            "priority": priority
        });
        if uuid::Uuid::parse_str(agent_id).is_ok() {
            body["assigned_agent_id"] = serde_json::json!(agent_id);
        }
        let mut req = self.client.post(&url).json(&body);
        if let Some(auth) = self.auth_header() {
            req = req.header("Authorization", auth);
        }

        match req.send().await {
            Ok(resp) if resp.status().is_success() => {
                resp.json::<TaskPayload>().await.map_err(|e| e.to_string())
            }
            Ok(resp) => Err(format!("Failed to create assigned task: HTTP {}", resp.status())),
            Err(e) => Err(e.to_string()),
        }
    }

    pub async fn execute_agent_task(
        &self,
        company_id: &str,
        agent_id: &str,
        task_id: &str,
        input_data: serde_json::Value,
    ) -> Result<TaskExecutionResultPayload, String> {
        let url = format!("{}/companies/{}/agents/{}/execute", self.base_url, company_id, agent_id);
        let body = serde_json::json!({
            "task_id": task_id,
            "input_data": input_data
        });
        let mut req = self.client.post(&url).json(&body);
        if let Some(auth) = self.auth_header() {
            req = req.header("Authorization", auth);
        }

        match req.send().await {
            Ok(resp) if resp.status().is_success() => {
                resp.json::<TaskExecutionResultPayload>().await.map_err(|e| e.to_string())
            }
            Ok(resp) => Err(format!("Task execution failed: HTTP {}", resp.status())),
            Err(e) => Err(e.to_string()),
        }
    }

    pub async fn transition_agent_status(
        &self,
        company_id: &str,
        agent_id: &str,
        status: &str,
        reason: Option<&str>,
    ) -> Result<AgentPayload, String> {
        let url = format!("{}/companies/{}/agents/{}/transition", self.base_url, company_id, agent_id);
        let body = serde_json::json!({
            "status": status,
            "reason": reason.unwrap_or("Manual status transition from operator cockpit")
        });
        let mut req = self.client.post(&url).json(&body);
        if let Some(auth) = self.auth_header() {
            req = req.header("Authorization", auth);
        }

        match req.send().await {
            Ok(resp) if resp.status().is_success() => {
                resp.json::<AgentPayload>().await.map_err(|e| e.to_string())
            }
            Ok(resp) => Err(format!("Transition agent status failed: HTTP {}", resp.status())),
            Err(e) => Err(e.to_string()),
        }
    }

    pub async fn fetch_source_graph_blast_radius(
        &self,
        company_id: &str,
        target: &str,
    ) -> Result<SourceGraphBlastRadiusPayload, String> {
        let url = format!("{}/companies/{}/memory/source-graph/blast-radius?target={}", self.base_url, company_id, target);
        let mut req = self.client.get(&url);
        if let Some(auth) = self.auth_header() {
            req = req.header("Authorization", auth);
        }

        match req.send().await {
            Ok(resp) if resp.status().is_success() => {
                resp.json::<SourceGraphBlastRadiusPayload>().await.map_err(|e| e.to_string())
            }
            Ok(resp) => Err(format!("Source graph blast radius query failed: HTTP {}", resp.status())),
            Err(e) => Err(e.to_string()),
        }
    }

    pub async fn fetch_source_graph_definition(
        &self,
        company_id: &str,
        symbol: &str,
    ) -> Result<SourceGraphDefinitionPayload, String> {
        let url = format!("{}/companies/{}/memory/source-graph/definition?symbol={}", self.base_url, company_id, symbol);
        let mut req = self.client.get(&url);
        if let Some(auth) = self.auth_header() {
            req = req.header("Authorization", auth);
        }

        match req.send().await {
            Ok(resp) if resp.status().is_success() => {
                resp.json::<SourceGraphDefinitionPayload>().await.map_err(|e| e.to_string())
            }
            Ok(resp) => Err(format!("Source graph definition query failed: HTTP {}", resp.status())),
            Err(e) => Err(e.to_string()),
        }
    }

    pub async fn fetch_vcs_status(&self, company_id: &str) -> Result<GitStatusPayload, String> {
        let url = format!("{}/companies/{}/vcs/status", self.base_url, company_id);
        let mut req = self.client.get(&url);
        if let Some(auth) = self.auth_header() {
            req = req.header("Authorization", auth);
        }

        match req.send().await {
            Ok(resp) if resp.status().is_success() => {
                resp.json::<GitStatusPayload>().await.map_err(|e| e.to_string())
            }
            Ok(resp) => Err(format!("VCS status query failed: HTTP {}", resp.status())),
            Err(e) => Err(e.to_string()),
        }
    }

    pub async fn stage_vcs_files(
        &self,
        company_id: &str,
        paths: &[&str],
        stage_all: bool,
    ) -> Result<GitStatusPayload, String> {
        let url = format!("{}/companies/{}/vcs/stage", self.base_url, company_id);
        let body = serde_json::json!({
            "paths": paths,
            "stage_all": stage_all
        });
        let mut req = self.client.post(&url).json(&body);
        if let Some(auth) = self.auth_header() {
            req = req.header("Authorization", auth);
        }

        match req.send().await {
            Ok(resp) if resp.status().is_success() => {
                resp.json::<GitStatusPayload>().await.map_err(|e| e.to_string())
            }
            Ok(resp) => Err(format!("Stage files failed: HTTP {}", resp.status())),
            Err(e) => Err(e.to_string()),
        }
    }

    pub async fn create_vcs_commit(
        &self,
        company_id: &str,
        message: &str,
        author_name: Option<&str>,
        author_email: Option<&str>,
    ) -> Result<Value, String> {
        let url = format!("{}/companies/{}/vcs/commit", self.base_url, company_id);
        let body = serde_json::json!({
            "message": message,
            "author_name": author_name,
            "author_email": author_email,
            "amend": false
        });
        let mut req = self.client.post(&url).json(&body);
        if let Some(auth) = self.auth_header() {
            req = req.header("Authorization", auth);
        }

        match req.send().await {
            Ok(resp) if resp.status().is_success() => {
                resp.json::<Value>().await.map_err(|e| e.to_string())
            }
            Ok(resp) => Err(format!("Create commit failed: HTTP {}", resp.status())),
            Err(e) => Err(e.to_string()),
        }
    }

    pub async fn fetch_vcs_remotes(&self, company_id: &str) -> Result<GitRemotesPayload, String> {
        let url = format!("{}/companies/{}/vcs/remotes", self.base_url, company_id);
        let mut req = self.client.get(&url);
        if let Some(auth) = self.auth_header() {
            req = req.header("Authorization", auth);
        }

        match req.send().await {
            Ok(resp) if resp.status().is_success() => {
                resp.json::<GitRemotesPayload>().await.map_err(|e| e.to_string())
            }
            Ok(resp) => Err(format!("Fetch VCS remotes failed: HTTP {}", resp.status())),
            Err(e) => Err(e.to_string()),
        }
    }

    pub async fn trigger_release_sync(
        &self,
        company_id: &str,
        target_remote: &str,
        target_branch: &str,
        release_tag: Option<&str>,
        dry_run: bool,
    ) -> Result<ReleaseSyncPayload, String> {
        let url = format!("{}/companies/{}/vcs/release/sync", self.base_url, company_id);
        let body = serde_json::json!({
            "target_remote": target_remote,
            "target_branch": target_branch,
            "release_tag": release_tag,
            "dry_run": dry_run,
            "skip_tests": false
        });
        let mut req = self.client.post(&url).json(&body);
        if let Some(auth) = self.auth_header() {
            req = req.header("Authorization", auth);
        }

        match req.send().await {
            Ok(resp) if resp.status().is_success() => {
                resp.json::<ReleaseSyncPayload>().await.map_err(|e| e.to_string())
            }
            Ok(resp) => Err(format!("Release sync failed: HTTP {}", resp.status())),
            Err(e) => Err(e.to_string()),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderConfigureResult {
    pub provider_name: String,
    pub display_name: String,
    pub is_configured: bool,
    pub is_healthy: bool,
    #[serde(default)]
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderProbeResult {
    pub provider: String,
    pub display_name: String,
    pub is_healthy: bool,
    #[serde(default)]
    pub latency_ms: f64,
    #[serde(default)]
    pub circuit_breaker_status: String,
    #[serde(default)]
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AgentProfilePayload {
    pub id: String,
    pub company_id: String,
    pub name: String,
    pub status: String,
    pub autonomy: Option<String>,
    pub role_title: Option<String>,
    pub department_name: Option<String>,
    pub manager_name: Option<String>,
    pub manager_id: Option<String>,
    #[serde(default)]
    pub identity: Value,
    pub system_instructions: Option<String>,
    #[serde(default)]
    pub responsibilities: Vec<String>,
    #[serde(default)]
    pub goals: Vec<String>,
    #[serde(default)]
    pub capabilities: Vec<String>,
    #[serde(default)]
    pub permissions: Value,
    #[serde(default)]
    pub tools: Vec<Value>,
    #[serde(default)]
    pub intelligence_config: Value,
    #[serde(default)]
    pub resource_limits: Value,
    #[serde(default)]
    pub resource_usage: Value,
    #[serde(default)]
    pub performance_metadata: Value,
    pub current_task: Option<Value>,
    #[serde(default)]
    pub recent_communications: Vec<Value>,
    #[serde(default)]
    pub recent_decisions: Vec<Value>,
    #[serde(default)]
    pub recent_audits: Vec<Value>,
    #[serde(default)]
    pub memories: Vec<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ExecutionStepRecordPayload {
    pub step: String,
    pub status: String,
    #[serde(default)]
    pub details: Value,
    #[serde(default)]
    pub duration_ms: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TaskExecutionResultPayload {
    pub execution_id: String,
    pub task_id: String,
    pub agent_id: String,
    pub status: String,
    #[serde(default)]
    pub steps: Vec<ExecutionStepRecordPayload>,
    #[serde(default)]
    pub output_data: Value,
    #[serde(default)]
    pub tokens_consumed: u64,
    #[serde(default)]
    pub cost_usd: f64,
    #[serde(default)]
    pub total_duration_ms: f64,
    pub error_message: Option<String>,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_client_fetch_companies() {
        let mut client = NeimanClient::new(Some("http://127.0.0.1:8000/api/v1"));
        assert_eq!(client.base_url, "http://127.0.0.1:8000/api/v1");

        // Test JSON schema parsing contract
        let sample_json = r#"[{"id":"c1000000-0000-0000-0000-000000000001","name":"Neiman Autonomous Systems","slug":"neiman-systems"}]"#;
        let parsed: Result<Vec<CompanyInfo>, _> = serde_json::from_str(sample_json);
        assert!(parsed.is_ok());
        let companies = parsed.unwrap();
        assert_eq!(companies.len(), 1);
        assert_eq!(companies[0].name, "Neiman Autonomous Systems");

        // If live backend is reachable, verify live endpoint contract
        if let Ok(live_result) = client.fetch_companies().await {
            if !live_result.is_empty() {
                assert!(!live_result[0].id.is_empty());
            }
        }
    }

    #[test]
    fn test_agent_profile_payload_schema() {
        let sample_json = r#"{
            "id": "a1000000-0000-0000-0000-000000000001",
            "company_id": "c1000000-0000-0000-0000-000000000001",
            "name": "Sentinel-Sec",
            "status": "AVAILABLE",
            "autonomy": "SUPERVISED",
            "role_title": "Security Lead",
            "department_name": "Security & Compliance",
            "identity": { "tone": "vigilant" },
            "system_instructions": "Audit codebase for OWASP vulnerabilities.",
            "responsibilities": ["Vulnerability scanning", "Compliance audits"],
            "goals": ["Zero unmitigated CVEs"],
            "capabilities": ["AST Static Analysis", "Secret Scanning"],
            "permissions": {},
            "tools": [{"name": "ast_scanner"}],
            "intelligence_config": {},
            "resource_limits": {},
            "resource_usage": {},
            "performance_metadata": {},
            "recent_audits": [{"action": "TASK_EXECUTE", "status": "SUCCEEDED"}]
        }"#;

        let parsed: Result<AgentProfilePayload, _> = serde_json::from_str(sample_json);
        assert!(parsed.is_ok(), "Failed to parse agent profile: {:?}", parsed.err());
        let profile = parsed.unwrap();
        assert_eq!(profile.name, "Sentinel-Sec");
        assert_eq!(profile.role_title.as_deref(), Some("Security Lead"));
        assert_eq!(profile.capabilities.len(), 2);
        assert_eq!(profile.recent_audits.len(), 1);
    }

    #[test]
    fn test_task_execution_result_payload_schema() {
        let sample_json = r#"{
            "execution_id": "e1000000-0000-0000-0000-000000000001",
            "task_id": "t1000000-0000-0000-0000-000000000001",
            "agent_id": "a1000000-0000-0000-0000-000000000001",
            "status": "SUCCEEDED",
            "steps": [
                {
                    "step": "INITIALIZE",
                    "status": "SUCCEEDED",
                    "details": {},
                    "duration_ms": 14.2
                },
                {
                    "step": "EXECUTE",
                    "status": "SUCCEEDED",
                    "details": { "findings": "No security breaches detected." },
                    "duration_ms": 120.5
                }
            ],
            "output_data": { "report": "Security check completed cleanly." },
            "tokens_consumed": 350,
            "cost_usd": 0.002,
            "total_duration_ms": 134.7
        }"#;

        let parsed: Result<TaskExecutionResultPayload, _> = serde_json::from_str(sample_json);
        assert!(parsed.is_ok(), "Failed to parse execution result: {:?}", parsed.err());
        let res = parsed.unwrap();
        assert_eq!(res.status, "SUCCEEDED");
        assert_eq!(res.steps.len(), 2);
        assert_eq!(res.steps[1].step, "EXECUTE");
        assert_eq!(res.total_duration_ms, 134.7);
    }

    #[test]
    fn test_intelligence_dashboard_active_provider_schema() {
        let sample_json = r#"{
            "company_id": "c1000000-0000-0000-0000-000000000001",
            "active_provider": "anthropic",
            "active_model": "claude-3-5-sonnet-20241022",
            "active_provider_display": "Anthropic Claude",
            "primary_model": "claude-3-5-sonnet-20241022",
            "fallback_models": ["gpt-4o"],
            "total_calls_today": 42,
            "total_tokens_today": 12800,
            "spend_today_usd": 0.048,
            "average_latency_ms": 320.5,
            "routing_policy": "COST_OPTIMIZED",
            "providers": [
                {
                    "id": "p1000000-0000-0000-0000-000000000001",
                    "name": "anthropic",
                    "display_name": "Anthropic Claude",
                    "provider_type": "CLOUD",
                    "is_configured": true,
                    "is_healthy": true,
                    "consecutive_failures": 0,
                    "models": ["claude-3-5-sonnet-20241022"],
                    "has_key": true,
                    "circuit_breaker": "CLOSED"
                }
            ],
            "recent_routings": []
        }"#;

        let parsed: Result<Value, _> = serde_json::from_str(sample_json);
        assert!(parsed.is_ok(), "Failed to parse dashboard: {:?}", parsed.err());
        let d = parsed.unwrap();
        assert_eq!(d.get("active_provider").and_then(|v| v.as_str()), Some("anthropic"));
        assert_eq!(d.get("active_model").and_then(|v| v.as_str()), Some("claude-3-5-sonnet-20241022"));
        assert_eq!(d.get("active_provider_display").and_then(|v| v.as_str()), Some("Anthropic Claude"));
        assert_eq!(d["providers"].as_array().map(|a| a.len()), Some(1));
        assert_eq!(d["providers"][0]["is_configured"].as_bool(), Some(true));
        assert_eq!(d["providers"][0]["is_healthy"].as_bool(), Some(true));
    }

    #[test]
    fn test_provider_configure_response_schema() {
        let sample_json = r#"{
            "provider_name": "openai",
            "display_name": "OpenAI",
            "is_configured": true,
            "is_healthy": true,
            "message": "Configured successfully."
        }"#;

        let parsed: Result<ProviderConfigureResult, _> = serde_json::from_str(sample_json);
        assert!(parsed.is_ok(), "Failed to parse configure response: {:?}", parsed.err());
        let c = parsed.unwrap();
        assert_eq!(c.provider_name, "openai");
        assert!(c.is_configured);
        assert!(c.is_healthy);
    }

    #[test]
    fn test_task_payload_dependencies_roundtrip() {
        let sample_json = r#"{
            "id": "t1000000-0000-0000-0000-000000000001",
            "project_id": "p1000000-0000-0000-0000-000000000001",
            "title": "Wire DAG edges",
            "status": "PENDING",
            "priority": "HIGH",
            "assigned_agent_id": null,
            "dependencies": [
                "t1000000-0000-0000-0000-000000000002",
                "t1000000-0000-0000-0000-000000000003"
            ]
        }"#;

        let parsed: TaskPayload =
            serde_json::from_str(sample_json).expect("task with dependencies must parse");
        assert_eq!(parsed.dependency_ids().len(), 2);
        assert_eq!(
            parsed.dependency_ids()[0],
            "t1000000-0000-0000-0000-000000000002"
        );

        let bare = r#"{
            "id": "t2",
            "title": "No deps field",
            "status": "PENDING"
        }"#;
        let bare_task: TaskPayload = serde_json::from_str(bare).expect("deps default empty");
        assert!(bare_task.dependency_ids().is_empty());
    }

    #[test]
    fn test_source_graph_blast_radius_schema() {
        let sample_json = r#"{
            "target": "TokenCompressor",
            "risk_level": "LOW",
            "risk_score": 15,
            "total_impacted_files": 3,
            "direct_dependents": ["nexora.domains.intelligence.service"],
            "transitive_dependents": ["nexora.domains.intelligence.router"],
            "impacted_endpoints": [{"name": "compress_prompt", "signature": "compress_prompt()"}],
            "impacted_tests": ["tests/test_token_compression.py"]
        }"#;

        let parsed: Result<SourceGraphBlastRadiusPayload, _> = serde_json::from_str(sample_json);
        assert!(parsed.is_ok(), "Failed to parse blast radius: {:?}", parsed.err());
        let res = parsed.unwrap();
        assert_eq!(res.target, "TokenCompressor");
        assert_eq!(res.risk_level, "LOW");
        assert_eq!(res.risk_score, 15);
        assert_eq!(res.total_impacted_files, 3);
        assert_eq!(res.impacted_tests.len(), 1);
        assert_eq!(res.impacted_tests[0], "tests/test_token_compression.py");
    }

    #[test]
    fn test_vcs_status_payload_schema() {
        let sample_json = r#"{
            "branch": "main",
            "upstream": "origin/main",
            "ahead": 2,
            "behind": 0,
            "is_clean": false,
            "staged_files": [
                {
                    "path": "apps/api/nexora/domains/vcs/service.py",
                    "status": "M",
                    "staged": true,
                    "additions": 100,
                    "deletions": 5
                }
            ],
            "unstaged_files": [],
            "untracked_files": ["tests/temp.py"],
            "stashes_count": 1
        }"#;

        let parsed: Result<GitStatusPayload, _> = serde_json::from_str(sample_json);
        assert!(parsed.is_ok(), "Failed to parse VCS status payload: {:?}", parsed.err());
        let res = parsed.unwrap();
        assert_eq!(res.branch, "main");
        assert_eq!(res.upstream.as_deref(), Some("origin/main"));
        assert_eq!(res.ahead, 2);
        assert_eq!(res.behind, 0);
        assert!(!res.is_clean);
        assert_eq!(res.staged_files.len(), 1);
        assert_eq!(res.untracked_files.len(), 1);
        assert_eq!(res.stashes_count, 1);
    }

    #[test]
    fn test_remotes_and_release_sync_payload_schema() {
        let remotes_json = r#"{
            "remotes": [
                {
                    "name": "origin",
                    "url": "https://github.com/Aomine-c2c/Sila.git",
                    "is_official": false,
                    "is_private": true
                },
                {
                    "name": "official",
                    "url": "https://github.com/Aomine-c2c/Neiman.git",
                    "is_official": true,
                    "is_private": false
                }
            ],
            "official_configured": true,
            "official_url": "https://github.com/Aomine-c2c/Neiman.git"
        }"#;

        let parsed_remotes: Result<GitRemotesPayload, _> = serde_json::from_str(remotes_json);
        assert!(parsed_remotes.is_ok(), "Failed to parse VCS remotes: {:?}", parsed_remotes.err());
        let remotes = parsed_remotes.unwrap();
        assert_eq!(remotes.remotes.len(), 2);
        assert!(remotes.official_configured);
        assert_eq!(remotes.official_url.as_deref(), Some("https://github.com/Aomine-c2c/Neiman.git"));

        let sync_json = r#"{
            "success": true,
            "target_remote": "official",
            "remote_url": "https://github.com/Aomine-c2c/Neiman.git",
            "source_branch": "main",
            "target_branch": "main",
            "release_tag": "v1.0.0",
            "commit_sha": "abc123def456",
            "short_sha": "abc123d",
            "dry_run": true,
            "message": "Release sync simulated successfully",
            "preflight_checks": [
                {
                    "name": "official_remote_verification",
                    "passed": true,
                    "detail": "Remote verified"
                }
            ]
        }"#;

        let parsed_sync: Result<ReleaseSyncPayload, _> = serde_json::from_str(sync_json);
        assert!(parsed_sync.is_ok(), "Failed to parse ReleaseSyncPayload: {:?}", parsed_sync.err());
        let sync = parsed_sync.unwrap();
        assert!(sync.success);
        assert!(sync.dry_run);
        assert_eq!(sync.target_remote, "official");
        assert_eq!(sync.release_tag.as_deref(), Some("v1.0.0"));
        assert_eq!(sync.preflight_checks.len(), 1);
    }
}



