use serde::{Deserialize, Serialize};

/// The 7 Canonical Gates of the NEIMAN Autonomous QA & Delivery Pipeline
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum QaGateType {
    Build,
    UnitIntegrationTests,
    CodeReview,
    SecurityScan,
    StagingDeployment,
    AcceptanceVerification,
    ProductionRelease,
}

impl QaGateType {
    pub fn all() -> &'static [QaGateType] {
        &[
            QaGateType::Build,
            QaGateType::UnitIntegrationTests,
            QaGateType::CodeReview,
            QaGateType::SecurityScan,
            QaGateType::StagingDeployment,
            QaGateType::AcceptanceVerification,
            QaGateType::ProductionRelease,
        ]
    }

    pub fn label(&self) -> &'static str {
        match self {
            QaGateType::Build => "1. Build & Compile",
            QaGateType::UnitIntegrationTests => "2. Unit & Integration Tests",
            QaGateType::CodeReview => "3. Independent Code Review",
            QaGateType::SecurityScan => "4. Security Audit & Secrets",
            QaGateType::StagingDeployment => "5. Staging Deployment",
            QaGateType::AcceptanceVerification => "6. QA Acceptance Criteria",
            QaGateType::ProductionRelease => "7. Production Release Gate",
        }
    }

    pub fn short_code(&self) -> &'static str {
        match self {
            QaGateType::Build => "BUILD",
            QaGateType::UnitIntegrationTests => "TEST",
            QaGateType::CodeReview => "REVIEW",
            QaGateType::SecurityScan => "SEC",
            QaGateType::StagingDeployment => "STAGE",
            QaGateType::AcceptanceVerification => "QA-AC",
            QaGateType::ProductionRelease => "PROD",
        }
    }
}

/// Status of an individual QA / Release gate
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum GateStatus {
    Passed,
    Running,
    Pending,
    Blocked,
    Failed,
    Skipped,
}

impl GateStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            GateStatus::Passed => "PASSED",
            GateStatus::Running => "RUNNING",
            GateStatus::Pending => "PENDING",
            GateStatus::Blocked => "BLOCKED",
            GateStatus::Failed => "FAILED",
            GateStatus::Skipped => "SKIPPED",
        }
    }

    pub fn symbol(&self) -> &'static str {
        match self {
            GateStatus::Passed => "✓",
            GateStatus::Running => "▶",
            GateStatus::Pending => "⏳",
            GateStatus::Blocked => "⛔",
            GateStatus::Failed => "✗",
            GateStatus::Skipped => "⊘",
        }
    }
}

/// A specific gate inside a delivery pipeline run
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QaGateItem {
    pub gate_type: QaGateType,
    pub name: String,
    pub status: GateStatus,
    pub responsible_agent: String,
    pub associated_task_id: Option<String>,
    pub evidence_summary: String,
    pub evidence_details: Vec<String>,
    pub failure_diagnostic: Option<String>,
    pub is_required: bool,
    pub blocks_release: bool,
}

/// Rollback telemetry record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RollbackRecord {
    pub rolled_back_from_sha: String,
    pub rolled_back_to_sha: String,
    pub reason: String,
    pub environment: String,
    pub timestamp: String,
    pub successful: bool,
}

/// End-to-end delivery pipeline run
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryPipelineRun {
    pub run_id: String,
    pub title: String,
    pub git_branch: String,
    pub commit_sha: String,
    pub target_environment: String,
    pub duration_seconds: f64,
    pub gates: Vec<QaGateItem>,
    pub ceo_signoff: bool,
    pub rollback_record: Option<RollbackRecord>,
}

impl DeliveryPipelineRun {
    /// Strictly verifies whether production release is authorized by backend gates and CEO signoff
    pub fn can_authorize_production_release(&self) -> Result<(), String> {
        for gate in &self.gates {
            if gate.gate_type == QaGateType::ProductionRelease {
                continue;
            }
            if gate.is_required && gate.status != GateStatus::Passed {
                return Err(format!(
                    "Release BLOCKED: Gate '{}' is in status '{}' (Diagnostics: {}).",
                    gate.name,
                    gate.status.as_str(),
                    gate.failure_diagnostic.as_deref().unwrap_or("Pre-requisite check not met")
                ));
            }
        }

        if self.target_environment.eq_ignore_ascii_case("PRODUCTION") && !self.ceo_signoff {
            return Err("Release BLOCKED: Production release requires explicit CEO authorization signoff.".into());
        }

        Ok(())
    }

    pub fn failed_gate_count(&self) -> usize {
        self.gates.iter().filter(|g| g.status == GateStatus::Failed || g.status == GateStatus::Blocked).count()
    }
}

/// QA & Release State Container
#[derive(Debug, Clone, Default)]
pub struct QaReleaseState {
    pub runs: Vec<DeliveryPipelineRun>,
    pub selected_run_idx: usize,
    pub selected_gate_idx: usize,
    pub filter_environment: Option<String>,
}

impl QaReleaseState {
    pub fn new() -> Self {
        let mut state = Self::default();
        state.init_sample_pipeline_runs();
        state
    }

    pub fn current_run(&self) -> Option<&DeliveryPipelineRun> {
        if self.runs.is_empty() {
            None
        } else {
            self.runs.get(self.selected_run_idx.min(self.runs.len() - 1))
        }
    }

    pub fn current_gate(&self) -> Option<&QaGateItem> {
        let run = self.current_run()?;
        if run.gates.is_empty() {
            None
        } else {
            run.gates.get(self.selected_gate_idx.min(run.gates.len() - 1))
        }
    }

    /// Initializes verified reference pipeline runs for audit inspection
    pub fn init_sample_pipeline_runs(&mut self) {
        if !self.runs.is_empty() {
            return;
        }

        // Run 1: Active Production Release with a QA Acceptance Failure blocking release
        let run_blocked = DeliveryPipelineRun {
            run_id: "deliv-901".into(),
            title: "Feature: Multi-Tenant Workspace Boundary Isolation".into(),
            git_branch: "feat/workspace-isolation".into(),
            commit_sha: "a1c9e83".into(),
            target_environment: "PRODUCTION".into(),
            duration_seconds: 142.5,
            ceo_signoff: true,
            rollback_record: None,
            gates: vec![
                QaGateItem {
                    gate_type: QaGateType::Build,
                    name: "Build & Compile".into(),
                    status: GateStatus::Passed,
                    responsible_agent: "CoreEngineerAgent".into(),
                    associated_task_id: Some("task-build-01".into()),
                    evidence_summary: "Zero compilation errors; clean release target".into(),
                    evidence_details: vec![
                        "cargo build --release completed in 14.2s".into(),
                        "Binary digest: sha256:d8a2...31f".into(),
                    ],
                    failure_diagnostic: None,
                    is_required: true,
                    blocks_release: true,
                },
                QaGateItem {
                    gate_type: QaGateType::UnitIntegrationTests,
                    name: "Unit & Integration Tests".into(),
                    status: GateStatus::Passed,
                    responsible_agent: "TestSpecialistAgent".into(),
                    associated_task_id: Some("task-test-01".into()),
                    evidence_summary: "84/84 tests passed across 4 test suites".into(),
                    evidence_details: vec![
                        "apps/api/tests/test_governance.py passed".into(),
                        "apps/tui-rs integration tests passed".into(),
                    ],
                    failure_diagnostic: None,
                    is_required: true,
                    blocks_release: true,
                },
                QaGateItem {
                    gate_type: QaGateType::CodeReview,
                    name: "Independent Code Review".into(),
                    status: GateStatus::Passed,
                    responsible_agent: "LeadArchitectAgent".into(),
                    associated_task_id: Some("task-review-01".into()),
                    evidence_summary: "Architectural invariants verified; zero drift detected".into(),
                    evidence_details: vec![
                        "Verdict: APPROVED".into(),
                        "Diff budget: 182 lines (under 500 line limit)".into(),
                    ],
                    failure_diagnostic: None,
                    is_required: true,
                    blocks_release: true,
                },
                QaGateItem {
                    gate_type: QaGateType::SecurityScan,
                    name: "Security Audit & Secrets".into(),
                    status: GateStatus::Passed,
                    responsible_agent: "SecuritySentinelAgent".into(),
                    associated_task_id: Some("task-sec-01".into()),
                    evidence_summary: "Zero red-line violations; zero leaked secrets".into(),
                    evidence_details: vec![
                        "Secret scanner passed (0 matches)".into(),
                        "Dependency CVE scan: 0 critical vulnerabilities".into(),
                    ],
                    failure_diagnostic: None,
                    is_required: true,
                    blocks_release: true,
                },
                QaGateItem {
                    gate_type: QaGateType::StagingDeployment,
                    name: "Staging Deployment".into(),
                    status: GateStatus::Passed,
                    responsible_agent: "SreGuardAgent".into(),
                    associated_task_id: Some("task-staging-01".into()),
                    evidence_summary: "Deployed to staging-cluster-01; health probe returned HTTP 200".into(),
                    evidence_details: vec![
                        "Staging URL: https://staging.neiman.internal".into(),
                        "Health check /health returned 200 OK".into(),
                    ],
                    failure_diagnostic: None,
                    is_required: true,
                    blocks_release: true,
                },
                QaGateItem {
                    gate_type: QaGateType::AcceptanceVerification,
                    name: "QA Acceptance Criteria".into(),
                    status: GateStatus::Failed,
                    responsible_agent: "QaVerificationAgent".into(),
                    associated_task_id: Some("task-qa-01".into()),
                    evidence_summary: "Acceptance criteria 3/4 passed; latency regression detected".into(),
                    evidence_details: vec![
                        "Criterion 1: Boundary isolation enforced [PASS]".into(),
                        "Criterion 2: Zero cross-tenant data leaks [PASS]".into(),
                        "Criterion 3: p99 response under 50ms [FAIL - 84ms observed]".into(),
                    ],
                    failure_diagnostic: Some("Latency regression: p99 latency 84ms exceeds maximum threshold of 50ms.".into()),
                    is_required: true,
                    blocks_release: true,
                },
                QaGateItem {
                    gate_type: QaGateType::ProductionRelease,
                    name: "Production Release Gate".into(),
                    status: GateStatus::Blocked,
                    responsible_agent: "ExecutiveGovernorAgent".into(),
                    associated_task_id: Some("task-prod-release".into()),
                    evidence_summary: "Release blocked by QA acceptance failure".into(),
                    evidence_details: vec![
                        "Production promotion blocked automatically by policy engine.".into(),
                        "Requires QA verification signoff prior to production deployment.".into(),
                    ],
                    failure_diagnostic: Some("Blocked by upstream gate: QA Acceptance Criteria failed.".into()),
                    is_required: true,
                    blocks_release: true,
                },
            ],
        };

        // Run 2: Completed Production Release with verified rollback tracking
        let run_verified = DeliveryPipelineRun {
            run_id: "deliv-890".into(),
            title: "Release v2.3.9: Performance & Memory Optimization".into(),
            git_branch: "release/v2.3.9".into(),
            commit_sha: "f4b7a12".into(),
            target_environment: "PRODUCTION".into(),
            duration_seconds: 98.4,
            ceo_signoff: true,
            rollback_record: Some(RollbackRecord {
                rolled_back_from_sha: "e3a8901".into(),
                rolled_back_to_sha: "f4b7a12".into(),
                reason: "Prior release candidate e3a8901 experienced memory growth; reverted cleanly.".into(),
                environment: "PRODUCTION".into(),
                timestamp: "2026-10-28T05:20:00Z".into(),
                successful: true,
            }),
            gates: vec![
                QaGateItem {
                    gate_type: QaGateType::Build,
                    name: "Build & Compile".into(),
                    status: GateStatus::Passed,
                    responsible_agent: "CoreEngineerAgent".into(),
                    associated_task_id: None,
                    evidence_summary: "Clean release build".into(),
                    evidence_details: vec!["Release build verified".into()],
                    failure_diagnostic: None,
                    is_required: true,
                    blocks_release: true,
                },
                QaGateItem {
                    gate_type: QaGateType::UnitIntegrationTests,
                    name: "Unit & Integration Tests".into(),
                    status: GateStatus::Passed,
                    responsible_agent: "TestSpecialistAgent".into(),
                    associated_task_id: None,
                    evidence_summary: "100% tests passed".into(),
                    evidence_details: vec!["84 tests passed".into()],
                    failure_diagnostic: None,
                    is_required: true,
                    blocks_release: true,
                },
                QaGateItem {
                    gate_type: QaGateType::CodeReview,
                    name: "Independent Code Review".into(),
                    status: GateStatus::Passed,
                    responsible_agent: "LeadArchitectAgent".into(),
                    associated_task_id: None,
                    evidence_summary: "Approved by architecture lead".into(),
                    evidence_details: vec!["Verdict: APPROVED".into()],
                    failure_diagnostic: None,
                    is_required: true,
                    blocks_release: true,
                },
                QaGateItem {
                    gate_type: QaGateType::SecurityScan,
                    name: "Security Audit & Secrets".into(),
                    status: GateStatus::Passed,
                    responsible_agent: "SecuritySentinelAgent".into(),
                    associated_task_id: None,
                    evidence_summary: "Zero security findings".into(),
                    evidence_details: vec!["0 secrets, 0 CVEs".into()],
                    failure_diagnostic: None,
                    is_required: true,
                    blocks_release: true,
                },
                QaGateItem {
                    gate_type: QaGateType::StagingDeployment,
                    name: "Staging Deployment".into(),
                    status: GateStatus::Passed,
                    responsible_agent: "SreGuardAgent".into(),
                    associated_task_id: None,
                    evidence_summary: "Staging verification passed".into(),
                    evidence_details: vec!["Health check OK".into()],
                    failure_diagnostic: None,
                    is_required: true,
                    blocks_release: true,
                },
                QaGateItem {
                    gate_type: QaGateType::AcceptanceVerification,
                    name: "QA Acceptance Criteria".into(),
                    status: GateStatus::Passed,
                    responsible_agent: "QaVerificationAgent".into(),
                    associated_task_id: None,
                    evidence_summary: "All acceptance criteria verified".into(),
                    evidence_details: vec!["Criteria 1-4 verified".into()],
                    failure_diagnostic: None,
                    is_required: true,
                    blocks_release: true,
                },
                QaGateItem {
                    gate_type: QaGateType::ProductionRelease,
                    name: "Production Release Gate".into(),
                    status: GateStatus::Passed,
                    responsible_agent: "ExecutiveGovernorAgent".into(),
                    associated_task_id: None,
                    evidence_summary: "Production authorized & deployed successfully".into(),
                    evidence_details: vec![
                        "CEO Signoff: Confirmed".into(),
                        "Production cluster updated: k8s-prod-us-east-1".into(),
                    ],
                    failure_diagnostic: None,
                    is_required: true,
                    blocks_release: true,
                },
            ],
        };

        self.runs = vec![run_blocked, run_verified];
    }
}
