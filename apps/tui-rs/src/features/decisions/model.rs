use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Epistemic status of a decision trace item
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum EpistemicType {
    ObservedFact,
    ModelExplanation,
    ProposedAction,
    CompletedAction,
}

impl EpistemicType {
    pub fn as_str(&self) -> &'static str {
        match self {
            EpistemicType::ObservedFact => "FACT",
            EpistemicType::ModelExplanation => "EXPLANATION",
            EpistemicType::ProposedAction => "PROPOSAL",
            EpistemicType::CompletedAction => "COMPLETED",
        }
    }

    pub fn symbol(&self) -> &'static str {
        match self {
            EpistemicType::ObservedFact => "◉",
            EpistemicType::ModelExplanation => "◇",
            EpistemicType::ProposedAction => "▷",
            EpistemicType::CompletedAction => "✓",
        }
    }
}

/// Verification result of the decision execution
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum VerificationOutcome {
    Passed,
    Failed,
    Pending,
    Exempt,
}

impl VerificationOutcome {
    pub fn as_str(&self) -> &'static str {
        match self {
            VerificationOutcome::Passed => "PASSED",
            VerificationOutcome::Failed => "FAILED",
            VerificationOutcome::Pending => "PENDING",
            VerificationOutcome::Exempt => "EXEMPT",
        }
    }
}

/// A tool invocation record within a decision trace
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolInvocation {
    pub tool_name: String,
    pub sanitized_arguments: String,
    pub outcome_status: String, // SUCCESS | ERROR | BLOCKED
    pub duration_ms: f64,
}

/// Evidence and retrieved context supporting the decision
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecisionEvidence {
    pub source_type: String, // COMMIT | CODE | TEST | POLICY | RETRIEVED_MEMORY
    pub reference: String,
    pub summary: String,
    pub verified: bool,
}

/// A single immutable audit decision trace record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecisionTraceItem {
    pub id: String,
    pub timestamp: DateTime<Utc>,
    pub actor_name: String,
    pub actor_role: String,
    pub epistemic_type: EpistemicType,
    pub project_name: String,
    pub task_id: Option<String>,
    pub task_objective: String,
    pub summary: String,
    pub evidence: Vec<DecisionEvidence>,
    pub tool_invocations: Vec<ToolInvocation>,
    pub policy_check_result: String, // APPROVED | REJECTED | ESCALATED
    pub verification_outcome: VerificationOutcome,
    pub log_link: Option<String>,
    pub code_diff_link: Option<String>,
    pub test_run_link: Option<String>,
    pub approval_id: Option<String>,
    pub sensitive_redacted: bool,
}

/// State container for the Decision & Audit Trace pane
#[derive(Debug, Clone, Default)]
pub struct DecisionTraceState {
    pub traces: Vec<DecisionTraceItem>,
    pub selected_idx: usize,
    pub filter_query: String,
    pub filter_epistemic: Option<EpistemicType>,
    pub filter_agent: Option<String>,
    pub filter_project: Option<String>,
}

impl DecisionTraceState {
    pub fn new() -> Self {
        let mut state = Self::default();
        state.init_default_traces();
        state
    }

    /// Initializes sample audit decisions grounded in real operations
    pub fn init_default_traces(&mut self) {
        if self.traces.is_empty() {
            let now = Utc::now();
            self.traces = vec![
                DecisionTraceItem {
                    id: "dec-901".into(),
                    timestamp: now - chrono::Duration::minutes(15),
                    actor_name: "CoreEngineerAgent".into(),
                    actor_role: "Lead Systems Engineer".into(),
                    epistemic_type: EpistemicType::CompletedAction,
                    project_name: "Sila".into(),
                    task_id: Some("task-eng-01".into()),
                    task_objective: "Implement zero-cost procfs host telemetry in TUI".into(),
                    summary: "Decided to read /proc/loadavg and /proc/meminfo directly rather than pulling sysinfo crate".into(),
                    evidence: vec![
                        DecisionEvidence {
                            source_type: "CODE".into(),
                            reference: "apps/tui-rs/src/features/resources/model.rs:142".into(),
                            summary: "Zero-dependency procfs implementation complies with binary size limits".into(),
                            verified: true,
                        },
                    ],
                    tool_invocations: vec![
                        ToolInvocation {
                            tool_name: "cargo_test".into(),
                            sanitized_arguments: "--manifest-path apps/tui-rs/Cargo.toml".into(),
                            outcome_status: "SUCCESS".into(),
                            duration_ms: 1040.0,
                        },
                    ],
                    policy_check_result: "APPROVED".into(),
                    verification_outcome: VerificationOutcome::Passed,
                    log_link: Some("apps/tui-rs/logs/resources.log".into()),
                    code_diff_link: Some("git diff HEAD~1".into()),
                    test_run_link: Some("test_metric_freshness_and_stale_detection".into()),
                    approval_id: None,
                    sensitive_redacted: true,
                },
                DecisionTraceItem {
                    id: "dec-902".into(),
                    timestamp: now - chrono::Duration::minutes(35),
                    actor_name: "SecuritySentinelAgent".into(),
                    actor_role: "Autonomous Security Auditor".into(),
                    epistemic_type: EpistemicType::ObservedFact,
                    project_name: "Sila".into(),
                    task_id: Some("task-sec-44".into()),
                    task_objective: "Audit credential storage across client configuration modules".into(),
                    summary: "Observed clean audit trail: zero credentials or API keys logged in plain text".into(),
                    evidence: vec![
                        DecisionEvidence {
                            source_type: "POLICY".into(),
                            reference: ".agents/rules/RULES.md §5".into(),
                            summary: "Credentials stored in vault; audit trail scrubbed of sensitive tokens".into(),
                            verified: true,
                        },
                    ],
                    tool_invocations: vec![
                        ToolInvocation {
                            tool_name: "secret_scanner".into(),
                            sanitized_arguments: "scan --path apps/".into(),
                            outcome_status: "SUCCESS".into(),
                            duration_ms: 320.5,
                        },
                    ],
                    policy_check_result: "APPROVED".into(),
                    verification_outcome: VerificationOutcome::Passed,
                    log_link: Some("security_audit_20261028.log".into()),
                    code_diff_link: None,
                    test_run_link: Some("apps/api/tests/test_governance.py".into()),
                    approval_id: None,
                    sensitive_redacted: true,
                },
                DecisionTraceItem {
                    id: "dec-903".into(),
                    timestamp: now - chrono::Duration::hours(1),
                    actor_name: "ExecutiveGovernorAgent".into(),
                    actor_role: "Release & Compliance Officer".into(),
                    epistemic_type: EpistemicType::ProposedAction,
                    project_name: "Sila".into(),
                    task_id: Some("task-rel-09".into()),
                    task_objective: "Promote release candidate v2.4.0 to production".into(),
                    summary: "Proposed production release blocked: Acceptance criteria regression detected".into(),
                    evidence: vec![
                        DecisionEvidence {
                            source_type: "TEST".into(),
                            reference: "QA Acceptance Criteria".into(),
                            summary: "Latency regression 84ms > 50ms limit; requires CEO signoff".into(),
                            verified: true,
                        },
                    ],
                    tool_invocations: vec![
                        ToolInvocation {
                            tool_name: "delivery_gate_check".into(),
                            sanitized_arguments: "--run-id deliv-901".into(),
                            outcome_status: "BLOCKED".into(),
                            duration_ms: 412.0,
                        },
                    ],
                    policy_check_result: "ESCALATED".into(),
                    verification_outcome: VerificationOutcome::Failed,
                    log_link: Some("release_pipeline_deliv901.log".into()),
                    code_diff_link: Some("commit a1c9e83".into()),
                    test_run_link: Some("qa_acceptance_verification".into()),
                    approval_id: Some("app-901".into()),
                    sensitive_redacted: false,
                },
            ];
        }
    }

    /// Filtered indices matching search query, epistemic type, and project filters
    pub fn filtered_indices(&self) -> Vec<usize> {
        let q = self.filter_query.trim().to_lowercase();
        self.traces
            .iter()
            .enumerate()
            .filter(|(_, item)| {
                if let Some(ep) = self.filter_epistemic {
                    if item.epistemic_type != ep {
                        return false;
                    }
                }
                if let Some(ref proj) = self.filter_project {
                    if !item.project_name.eq_ignore_ascii_case(proj) {
                        return false;
                    }
                }
                if let Some(ref ag) = self.filter_agent {
                    if !item.actor_name.to_lowercase().contains(&ag.to_lowercase()) {
                        return false;
                    }
                }
                if q.is_empty() {
                    return true;
                }
                item.id.to_lowercase().contains(&q)
                    || item.actor_name.to_lowercase().contains(&q)
                    || item.summary.to_lowercase().contains(&q)
                    || item.task_objective.to_lowercase().contains(&q)
                    || item.task_id.as_deref().unwrap_or("").to_lowercase().contains(&q)
            })
            .map(|(i, _)| i)
            .collect()
    }

    pub fn selected_item(&self) -> Option<&DecisionTraceItem> {
        let indices = self.filtered_indices();
        if indices.is_empty() {
            None
        } else {
            let idx = indices[self.selected_idx.min(indices.len() - 1)];
            self.traces.get(idx)
        }
    }
}
