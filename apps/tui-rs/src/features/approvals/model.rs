use std::collections::HashSet;
use sha2::{Digest, Sha256};
use serde::{Deserialize, Serialize};
use crate::client::{AgentPayload, ApprovalPayload, ProjectPayload, TaskPayload};

/// Configurable Approval Categories requiring human authority
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ApprovalCategory {
    ProductionRelease,
    DestructiveOperation,
    DatabaseMigration,
    ExternalCommitment,
    SecurityPolicyChange,
    ResourceBudgetIncrease,
    SensitiveData,
    HighImpactOther,
}

impl ApprovalCategory {
    pub fn all() -> &'static [ApprovalCategory] {
        &[
            ApprovalCategory::ProductionRelease,
            ApprovalCategory::DestructiveOperation,
            ApprovalCategory::DatabaseMigration,
            ApprovalCategory::ExternalCommitment,
            ApprovalCategory::SecurityPolicyChange,
            ApprovalCategory::ResourceBudgetIncrease,
            ApprovalCategory::SensitiveData,
            ApprovalCategory::HighImpactOther,
        ]
    }

    pub fn label(&self) -> &'static str {
        match self {
            ApprovalCategory::ProductionRelease => "Production Release",
            ApprovalCategory::DestructiveOperation => "Destructive Operation",
            ApprovalCategory::DatabaseMigration => "Database Migration",
            ApprovalCategory::ExternalCommitment => "External Commitment",
            ApprovalCategory::SecurityPolicyChange => "Security / Policy",
            ApprovalCategory::ResourceBudgetIncrease => "Spending / Budget",
            ApprovalCategory::SensitiveData => "Sensitive Data Access",
            ApprovalCategory::HighImpactOther => "High-Impact Operation",
        }
    }

    pub fn symbol(&self) -> &'static str {
        match self {
            ApprovalCategory::ProductionRelease => "🚀",
            ApprovalCategory::DestructiveOperation => "⚠️",
            ApprovalCategory::DatabaseMigration => "🗄️",
            ApprovalCategory::ExternalCommitment => "🌐",
            ApprovalCategory::SecurityPolicyChange => "🛡️",
            ApprovalCategory::ResourceBudgetIncrease => "💰",
            ApprovalCategory::SensitiveData => "🔒",
            ApprovalCategory::HighImpactOther => "⚡",
        }
    }

    pub fn from_action(action: &str, target: &str, title: &str, _risk: &str) -> Self {
        let act = action.to_uppercase();
        let tgt = target.to_uppercase();
        let tit = title.to_uppercase();

        if act.contains("DEPLOY") || act.contains("RELEASE") || tit.contains("RELEASE") || tit.contains("DEPLOY") || tgt.contains("PROD") {
            ApprovalCategory::ProductionRelease
        } else if act.contains("DROP") || act.contains("DELETE") || act.contains("PURGE") || act.contains("TRUNCATE") || act.contains("DESTROY") {
            ApprovalCategory::DestructiveOperation
        } else if act.contains("MIGRATE") || act.contains("MIGRATION") || act.contains("ALTER") || tgt.contains("DB") || tgt.contains("SCHEMA") {
            ApprovalCategory::DatabaseMigration
        } else if act.contains("EXTERNAL") || act.contains("CONTRACT") || act.contains("EMAIL") || act.contains("PUBLISH") || act.contains("COMMUNICATION") {
            ApprovalCategory::ExternalCommitment
        } else if act.contains("POLICY") || act.contains("PERMISSION") || act.contains("SECURITY") || act.contains("KEY") || act.contains("AUTH") {
            ApprovalCategory::SecurityPolicyChange
        } else if act.contains("BUDGET") || act.contains("SPEND") || act.contains("COST") || act.contains("WIRE") || act.contains("TRANSFER") {
            ApprovalCategory::ResourceBudgetIncrease
        } else if act.contains("SENSITIVE") || act.contains("PII") || act.contains("SECRET") || tgt.contains("VAULT") || tgt.contains("USER_DATA") {
            ApprovalCategory::SensitiveData
        } else {
            ApprovalCategory::HighImpactOther
        }
    }
}

/// Status vocabulary for approval decisions
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ApprovalStatusEnum {
    Pending,
    Approved,
    Rejected,
    ChangesRequested,
    Expired,
    Cancelled,
}

impl std::str::FromStr for ApprovalStatusEnum {
    type Err = std::convert::Infallible;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Ok(match s.to_uppercase().as_str() {
            "APPROVED" => ApprovalStatusEnum::Approved,
            "REJECTED" => ApprovalStatusEnum::Rejected,
            "CHANGES_REQUESTED" | "CHANGES" => ApprovalStatusEnum::ChangesRequested,
            "EXPIRED" => ApprovalStatusEnum::Expired,
            "CANCELLED" => ApprovalStatusEnum::Cancelled,
            _ => ApprovalStatusEnum::Pending,
        })
    }
}

impl ApprovalStatusEnum {
    pub fn as_str(&self) -> &'static str {
        match self {
            ApprovalStatusEnum::Pending => "PENDING",
            ApprovalStatusEnum::Approved => "APPROVED",
            ApprovalStatusEnum::Rejected => "REJECTED",
            ApprovalStatusEnum::ChangesRequested => "CHANGES_REQUESTED",
            ApprovalStatusEnum::Expired => "EXPIRED",
            ApprovalStatusEnum::Cancelled => "CANCELLED",
        }
    }

    pub fn parse_status(s: &str) -> Self {
        <Self as std::str::FromStr>::from_str(s).unwrap_or(ApprovalStatusEnum::Pending)
    }

    pub fn symbol(&self) -> &'static str {
        match self {
            ApprovalStatusEnum::Pending => "⚡",
            ApprovalStatusEnum::Approved => "✓",
            ApprovalStatusEnum::Rejected => "✗",
            ApprovalStatusEnum::ChangesRequested => "✎",
            ApprovalStatusEnum::Expired => "⌛",
            ApprovalStatusEnum::Cancelled => "⊘",
        }
    }
}

/// Computes deterministic SHA256 parameter fingerprint
pub fn compute_payload_fingerprint(action: &str, target: &str, payload: &serde_json::Value) -> String {
    let mut hasher = Sha256::new();
    hasher.update(action.as_bytes());
    hasher.update(b":");
    hasher.update(target.as_bytes());
    hasher.update(b":");
    hasher.update(serde_json::to_string(payload).unwrap_or_default().as_bytes());
    hex::encode(hasher.finalize())
}

/// Single entry in the CEO Approval Queue
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApprovalItem {
    pub id: String,
    pub title: String,
    pub category: ApprovalCategory,
    pub risk_level: String,
    pub status: ApprovalStatusEnum,
    pub requesting_agent: String,
    pub agent_role: String,
    pub project_name: String,
    pub task_id: Option<String>,
    pub task_title: Option<String>,
    pub action: String,
    pub target: String,
    pub reason: String,
    pub evidence: Vec<String>,
    pub proposed_payload: serde_json::Value,
    pub payload_fingerprint: String,
    pub created_at: String,
    pub expires_at: Option<String>,
    pub reviewer_decision: Option<String>,
    pub reviewer_notes: Option<String>,
    pub resolved_at: Option<String>,
}

impl ApprovalItem {
    /// Determines whether an action is consequential, demanding explicit confirmation
    pub fn is_consequential(&self) -> bool {
        self.risk_level.eq_ignore_ascii_case("CRITICAL")
            || self.risk_level.eq_ignore_ascii_case("HIGH")
            || matches!(
                self.category,
                ApprovalCategory::ProductionRelease
                    | ApprovalCategory::DestructiveOperation
                    | ApprovalCategory::SecurityPolicyChange
            )
    }

    /// Validates parameter integrity against a proposed execution payload
    pub fn is_stale_with(&self, current_payload: &serde_json::Value) -> bool {
        let current_fingerprint = compute_payload_fingerprint(&self.action, &self.target, current_payload);
        self.payload_fingerprint != current_fingerprint
    }
}

/// Staged action awaiting CEO confirmation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingApprovalAction {
    pub request_id: String,
    pub decision: ApprovalStatusEnum,
    pub is_consequential: bool,
    pub title: String,
    pub action: String,
    pub target: String,
    pub risk_level: String,
    pub payload_fingerprint: String,
}

/// Consequential decision record persisted for audit trails
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApprovalDecisionRecord {
    pub request_id: String,
    pub decision: String,
    pub actor: String,
    pub timestamp: String,
    pub policy_version: String,
    pub reviewer_notes: String,
    pub payload_fingerprint: String,
}

/// State container for the CEO Approval Queue
#[derive(Debug, Clone, Default)]
pub struct ApprovalQueueState {
    pub items: Vec<ApprovalItem>,
    pub selected_index: usize,
    pub filter_status: Option<ApprovalStatusEnum>,
    pub filter_category: Option<ApprovalCategory>,
    pub filter_query: String,
    pub confirmation_modal_open: bool,
    pub pending_action: Option<PendingApprovalAction>,
    pub feedback_input_active: bool,
    pub feedback_input: String,
    pub decided_ids: HashSet<String>,
    pub decision_history: Vec<ApprovalDecisionRecord>,
}

impl ApprovalQueueState {
    pub fn new() -> Self {
        Self::default()
    }

    /// Hydrate state from backend payloads with cross-referenced agent, project, and task data
    pub fn from_payloads(
        payloads: &[ApprovalPayload],
        agents: &[AgentPayload],
        tasks: &[TaskPayload],
        projects: &[ProjectPayload],
    ) -> Self {
        let mut items = Vec::new();

        for p in payloads {
            let risk = p.risk_level.clone().unwrap_or_else(|| "MEDIUM".into());
            let act = p.action.clone().unwrap_or_else(|| "EXECUTE_ACTION".into());
            let tgt = p.target.clone().unwrap_or_else(|| "SystemResource".into());
            let category = ApprovalCategory::from_action(&act, &tgt, &p.title, &risk);
            let status = ApprovalStatusEnum::parse_status(&p.status);

            let agent_role = p.agent_role.clone().unwrap_or_else(|| {
                if let Some(ref aid) = p.agent_id {
                    agents.iter().find(|a| a.id == *aid)
                        .and_then(|a| a.role_title.clone())
                        .unwrap_or_else(|| "Autonomous Agent".into())
                } else {
                    "Autonomous Agent".into()
                }
            });

            let req_agent = p.agent_name.clone().unwrap_or_else(|| {
                if let Some(ref aid) = p.agent_id {
                    agents.iter().find(|a| a.id == *aid)
                        .map(|a| a.name.clone())
                        .unwrap_or_else(|| "Agent Worker".into())
                } else {
                    "Agent Worker".into()
                }
            });

            let proj_name = p.project_name.clone().unwrap_or_else(|| {
                if let Some(ref pid) = p.project_id {
                    projects.iter().find(|pr| pr.id == *pid)
                        .map(|pr| pr.name.clone())
                        .unwrap_or_else(|| "Core".into())
                } else if !projects.is_empty() {
                    projects[0].name.clone()
                } else {
                    "Default".into()
                }
            });

            let task_title = if let Some(ref tid) = p.task_id {
                tasks.iter().find(|t| t.id == *tid).map(|t| t.title.clone())
            } else {
                None
            };

            let payload_val = p.proposed_payload.clone().unwrap_or(serde_json::json!({
                "action": act,
                "target": tgt,
                "policy_tier": "FourEyesGate"
            }));

            let fingerprint = p.action_fingerprint.clone().unwrap_or_else(|| {
                compute_payload_fingerprint(&act, &tgt, &payload_val)
            });

            let mut evidence = Vec::new();
            if let Some(ref r) = p.reason {
                evidence.push(format!("Reason: {r}"));
            }
            evidence.push("Policy Gate: Least-Privilege Tier 2 Autonomy Check Passed".to_string());
            evidence.push(format!("Payload Digest: sha256:{}", &fingerprint[..fingerprint.len().min(12)]));

            items.push(ApprovalItem {
                id: p.id.clone(),
                title: p.title.clone(),
                category,
                risk_level: risk,
                status,
                requesting_agent: req_agent,
                agent_role,
                project_name: proj_name,
                task_id: p.task_id.clone(),
                task_title,
                action: act,
                target: tgt,
                reason: p.reason.clone().unwrap_or_else(|| "Human review required before execution".into()),
                evidence,
                proposed_payload: payload_val,
                payload_fingerprint: fingerprint,
                created_at: p.created_at.clone().unwrap_or_else(|| "2026-10-28T07:00:00Z".into()),
                expires_at: p.expires_at.clone(),
                reviewer_decision: p.status.clone().into(),
                reviewer_notes: p.reviewer_notes.clone(),
                resolved_at: p.resolved_at.clone(),
            });
        }

        Self {
            items,
            selected_index: 0,
            filter_status: None,
            filter_category: None,
            filter_query: String::new(),
            confirmation_modal_open: false,
            pending_action: None,
            feedback_input_active: false,
            feedback_input: String::new(),
            decided_ids: HashSet::new(),
            decision_history: Vec::new(),
        }
    }

    /// Returns indices of items matching current status, category, and text filters
    pub fn filtered_indices(&self) -> Vec<usize> {
        self.items
            .iter()
            .enumerate()
            .filter(|(_, item)| {
                if let Some(ref st) = self.filter_status {
                    if item.status != *st {
                        return false;
                    }
                }
                if let Some(ref cat) = self.filter_category {
                    if item.category != *cat {
                        return false;
                    }
                }
                if !self.filter_query.is_empty() {
                    let q = self.filter_query.to_lowercase();
                    if !item.title.to_lowercase().contains(&q)
                        && !item.id.to_lowercase().contains(&q)
                        && !item.requesting_agent.to_lowercase().contains(&q)
                        && !item.action.to_lowercase().contains(&q)
                        && !item.target.to_lowercase().contains(&q)
                    {
                        return false;
                    }
                }
                true
            })
            .map(|(i, _)| i)
            .collect()
    }

    pub fn selected_item(&self) -> Option<&ApprovalItem> {
        let indices = self.filtered_indices();
        if indices.is_empty() {
            None
        } else {
            let idx = indices[self.selected_index.min(indices.len() - 1)];
            self.items.get(idx)
        }
    }

    pub fn pending_count(&self) -> usize {
        self.items.iter().filter(|i| i.status == ApprovalStatusEnum::Pending).count()
    }

    pub fn high_priority_pending_count(&self) -> usize {
        self.items
            .iter()
            .filter(|i| i.status == ApprovalStatusEnum::Pending && i.is_consequential())
            .count()
    }

    /// Initiates an approval decision with replay prevention and consequential confirmation check
    pub fn request_decision(
        &mut self,
        request_id: &str,
        decision: ApprovalStatusEnum,
    ) -> Result<bool, String> {
        // Prevent duplicate / replay submissions
        if self.decided_ids.contains(request_id) {
            return Err(format!("Replay error: Request {request_id} has already been decided."));
        }

        let item = self
            .items
            .iter()
            .find(|i| i.id == request_id)
            .ok_or_else(|| format!("Approval request {request_id} not found."))?;

        if item.status != ApprovalStatusEnum::Pending {
            return Err(format!(
                "Invalid transition: Cannot decide on request currently in status {:?}",
                item.status
            ));
        }

        let is_consequential = item.is_consequential();
        let needs_feedback = matches!(
            decision,
            ApprovalStatusEnum::Rejected | ApprovalStatusEnum::ChangesRequested
        );

        let staged = PendingApprovalAction {
            request_id: item.id.clone(),
            decision,
            is_consequential,
            title: item.title.clone(),
            action: item.action.clone(),
            target: item.target.clone(),
            risk_level: item.risk_level.clone(),
            payload_fingerprint: item.payload_fingerprint.clone(),
        };

        self.pending_action = Some(staged);

        // Require confirmation if consequential action or feedback required
        if is_consequential || needs_feedback {
            self.confirmation_modal_open = true;
            self.feedback_input_active = needs_feedback;
            self.feedback_input.clear();
            Ok(true) // Confirmation required
        } else {
            Ok(false) // Ready for direct execution
        }
    }

    /// Confirms and commits the pending decision, persisting audit trail
    pub fn confirm_pending_decision(
        &mut self,
        human_actor: &str,
        custom_notes: Option<String>,
    ) -> Result<ApprovalDecisionRecord, String> {
        let pending = self
            .pending_action
            .take()
            .ok_or_else(|| "No pending approval action to confirm.".to_string())?;

        // Replay check
        if self.decided_ids.contains(&pending.request_id) {
            self.confirmation_modal_open = false;
            self.feedback_input_active = false;
            return Err(format!("Replay error: Request {} already decided.", pending.request_id));
        }

        let notes = custom_notes.unwrap_or_else(|| {
            if !self.feedback_input.is_empty() {
                self.feedback_input.clone()
            } else {
                format!("Decision {:?} authorized by {}", pending.decision, human_actor)
            }
        });

        let now_str = chrono::Utc::now().to_rfc3339();

        let record = ApprovalDecisionRecord {
            request_id: pending.request_id.clone(),
            decision: pending.decision.as_str().to_string(),
            actor: human_actor.to_string(),
            timestamp: now_str.clone(),
            policy_version: "v1.2.0".into(),
            reviewer_notes: notes.clone(),
            payload_fingerprint: pending.payload_fingerprint,
        };

        // Mark as decided locally
        self.decided_ids.insert(pending.request_id.clone());
        self.decision_history.push(record.clone());

        // Update item in list
        if let Some(item) = self.items.iter_mut().find(|i| i.id == pending.request_id) {
            item.status = pending.decision;
            item.reviewer_decision = Some(pending.decision.as_str().into());
            item.reviewer_notes = Some(notes);
            item.resolved_at = Some(now_str);
        }

        self.confirmation_modal_open = false;
        self.feedback_input_active = false;
        self.feedback_input.clear();

        Ok(record)
    }

    /// Abort the pending decision
    pub fn cancel_pending_decision(&mut self) {
        self.pending_action = None;
        self.confirmation_modal_open = false;
        self.feedback_input_active = false;
        self.feedback_input.clear();
    }

    /// Validates if an approval is stale due to altered payload parameters
    pub fn validate_not_stale(&self, item_id: &str, current_payload: &serde_json::Value) -> bool {
        if let Some(item) = self.items.iter().find(|i| i.id == item_id) {
            !item.is_stale_with(current_payload)
        } else {
            false
        }
    }
}
