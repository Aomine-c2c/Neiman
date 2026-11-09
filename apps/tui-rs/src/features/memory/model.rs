use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Provenance and verification status of organizational knowledge
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum KnowledgeVerificationStatus {
    Current,
    Stale,
    Disputed,
    Unverified,
}

impl KnowledgeVerificationStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            KnowledgeVerificationStatus::Current => "CURRENT",
            KnowledgeVerificationStatus::Stale => "STALE",
            KnowledgeVerificationStatus::Disputed => "DISPUTED",
            KnowledgeVerificationStatus::Unverified => "UNVERIFIED",
        }
    }

    pub fn badge(&self) -> &'static str {
        match self {
            KnowledgeVerificationStatus::Current => "● CURRENT",
            KnowledgeVerificationStatus::Stale => "▲ STALE (>30d)",
            KnowledgeVerificationStatus::Disputed => "✖ DISPUTED",
            KnowledgeVerificationStatus::Unverified => "○ UNVERIFIED",
        }
    }
}

/// Knowledge Category / Domain
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum KnowledgeCategory {
    TechnicalDoc,
    ResearchFinding,
    AgentSkill,
    ProjectLesson,
    ResolvedIncident,
}

impl KnowledgeCategory {
    pub fn as_str(&self) -> &'static str {
        match self {
            KnowledgeCategory::TechnicalDoc => "TECHNICAL_DOC",
            KnowledgeCategory::ResearchFinding => "RESEARCH",
            KnowledgeCategory::AgentSkill => "AGENT_SKILL",
            KnowledgeCategory::ProjectLesson => "PROJECT_LESSON",
            KnowledgeCategory::ResolvedIncident => "RESOLVED_INCIDENT",
        }
    }

    pub fn label(&self) -> &'static str {
        match self {
            KnowledgeCategory::TechnicalDoc => "Technical Doc",
            KnowledgeCategory::ResearchFinding => "Research Finding",
            KnowledgeCategory::AgentSkill => "Agent Skill",
            KnowledgeCategory::ProjectLesson => "Project Lesson",
            KnowledgeCategory::ResolvedIncident => "Resolved Incident",
        }
    }
}

/// A single typed organizational knowledge record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnowledgeRecord {
    pub id: String,
    pub title: String,
    pub category: KnowledgeCategory,
    pub status: KnowledgeVerificationStatus,
    pub version: String,
    pub author_or_agent: String,
    pub related_project: Option<String>,
    pub summary: String,
    pub full_content: String,
    pub source_reference: String,
    pub usage_locations: Vec<String>,
    pub required_permission: String,
    pub created_at: DateTime<Utc>,
    pub last_verified_at: DateTime<Utc>,
}

/// Pre-indexed Codebase AST Knowledge Graph status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodebaseGraphSummary {
    pub indexed_files: usize,
    pub total_symbols: usize,
    pub total_dependencies: usize,
    pub duration_ms: u64,
    pub central_modules: Vec<String>,
}

impl Default for CodebaseGraphSummary {
    fn default() -> Self {
        Self {
            indexed_files: 42,
            total_symbols: 380,
            total_dependencies: 812,
            duration_ms: 18,
            central_modules: vec![
                "nexora.main".into(),
                "nexora.domains.memory.code_graph".into(),
                "nexora.domains.memory.vector_store".into(),
            ],
        }
    }
}

/// Source Graph Blast Radius & Code Intelligence Summary
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceGraphBlastRadiusSummary {
    pub target: String,
    pub risk_level: String,
    pub risk_score: u32,
    pub total_impacted_files: usize,
    pub impacted_endpoints_count: usize,
    pub impacted_tests_count: usize,
}

impl Default for SourceGraphBlastRadiusSummary {
    fn default() -> Self {
        Self {
            target: "TokenCompressor".into(),
            risk_level: "LOW".into(),
            risk_score: 15,
            total_impacted_files: 3,
            impacted_endpoints_count: 1,
            impacted_tests_count: 2,
        }
    }
}

/// Container for the Company Memory & Intelligence state
#[derive(Debug, Clone, Default)]
pub struct CompanyMemoryState {
    pub records: Vec<KnowledgeRecord>,
    pub selected_idx: usize,
    pub search_query: String,
    pub filter_category: Option<KnowledgeCategory>,
    pub filter_status: Option<KnowledgeVerificationStatus>,
    pub code_graph: CodebaseGraphSummary,
    pub blast_radius: SourceGraphBlastRadiusSummary,
}

impl CompanyMemoryState {
    pub fn new() -> Self {
        let mut state = Self::default();
        state.init_default_records();
        state
    }

    pub fn init_default_records(&mut self) {
        if self.records.is_empty() {
            let now = Utc::now();
            self.records = vec![
                KnowledgeRecord {
                    id: "mem-101".into(),
                    title: "Procfs Zero-Allocation Kernel Metrics Ingestion".into(),
                    category: KnowledgeCategory::TechnicalDoc,
                    status: KnowledgeVerificationStatus::Current,
                    version: "v1.2.0".into(),
                    author_or_agent: "CoreEngineerAgent".into(),
                    related_project: Some("Sila".into()),
                    summary: "Linux /proc interface reading pattern for zero-dependency CPU and memory metrics".into(),
                    full_content: "Procfs parsing via std::fs::read_to_string without heavy external crates avoids crate churn and ensures binary stays under 15MB.".into(),
                    source_reference: "apps/tui-rs/src/features/resources/model.rs".into(),
                    usage_locations: vec![
                        "apps/tui-rs/src/features/resources/model.rs:sample_local_host".into(),
                        "apps/tui-rs/src/features/resources/ui.rs".into(),
                    ],
                    required_permission: "read:telemetry".into(),
                    created_at: now - chrono::Duration::days(12),
                    last_verified_at: now - chrono::Duration::hours(2),
                },
                KnowledgeRecord {
                    id: "mem-102".into(),
                    title: "Skill: Security Boundary & Red-Line Policy Enforcement".into(),
                    category: KnowledgeCategory::AgentSkill,
                    status: KnowledgeVerificationStatus::Current,
                    version: "v2.0.1".into(),
                    author_or_agent: "SecuritySentinelAgent".into(),
                    related_project: Some("NEIMAN OS".into()),
                    summary: "Executable policy gate to reject destructive DDL and unauthenticated access".into(),
                    full_content: "Pre-execution static analysis intercepts agent tool calls matching destructive patterns (DROP, DELETE without WHERE, vault token extraction).".into(),
                    source_reference: ".agents/skills/catch-arch-rot/SKILL.md".into(),
                    usage_locations: vec![
                        "apps/api/nexora/domains/governance/service.py".into(),
                        "apps/tui-rs/src/features/approvals/model.rs".into(),
                    ],
                    required_permission: "admin:governance".into(),
                    created_at: now - chrono::Duration::days(45),
                    last_verified_at: now - chrono::Duration::days(1),
                },
                KnowledgeRecord {
                    id: "mem-103".into(),
                    title: "Post-Mortem: Cross-Tenant Workspace Context Leakage".into(),
                    category: KnowledgeCategory::ResolvedIncident,
                    status: KnowledgeVerificationStatus::Current,
                    version: "v1.0.0".into(),
                    author_or_agent: "LeadArchitectAgent".into(),
                    related_project: Some("Sila".into()),
                    summary: "Resolved incident where agent memory queries lacked tenant isolation boundaries".into(),
                    full_content: "Root cause: global vector search did not enforce tenant_id partition filter. Fixed by scoping pgvector similarity search to active company_id.".into(),
                    source_reference: "docs/postmortems/incident-20261014.md".into(),
                    usage_locations: vec![
                        "apps/api/nexora/domains/memory/service.py:assemble_context_for_task".into(),
                    ],
                    required_permission: "read:security_audits".into(),
                    created_at: now - chrono::Duration::days(14),
                    last_verified_at: now - chrono::Duration::days(3),
                },
                KnowledgeRecord {
                    id: "mem-104".into(),
                    title: "Research: Speculative Token Decoding via vLLM".into(),
                    category: KnowledgeCategory::ResearchFinding,
                    status: KnowledgeVerificationStatus::Stale,
                    version: "v0.8.0-draft".into(),
                    author_or_agent: "AIEngineerAgent".into(),
                    related_project: None,
                    summary: "Experimental speedup measurements for local draft model speculative decoding".into(),
                    full_content: "Draft model speculative decoding achieved 1.8x speedup on 70B models, but memory overhead exceeded 16GB VRAM on test cluster.".into(),
                    source_reference: "research/evals/speculative_decoding_20260901.ipynb".into(),
                    usage_locations: vec![
                        "apps/api/nexora/domains/intelligence/service.py".into(),
                    ],
                    required_permission: "read:research".into(),
                    created_at: now - chrono::Duration::days(58),
                    last_verified_at: now - chrono::Duration::days(38),
                },
                KnowledgeRecord {
                    id: "mem-105".into(),
                    title: "Unverified Draft: Autonomous Microservices Auto-Healing".into(),
                    category: KnowledgeCategory::ProjectLesson,
                    status: KnowledgeVerificationStatus::Unverified,
                    version: "v0.1.0".into(),
                    author_or_agent: "SreGuardAgent".into(),
                    related_project: Some("Infrastructure".into()),
                    summary: "Proposed self-restarting container heuristics based on TCP probe latencies".into(),
                    full_content: "Draft rules for automated rollback triggers when TCP health fails 3 times consecutively. Pending formal chaos test verification.".into(),
                    source_reference: "rfcs/rfc-auto-healing-draft.md".into(),
                    usage_locations: vec![],
                    required_permission: "read:infra".into(),
                    created_at: now - chrono::Duration::days(2),
                    last_verified_at: now - chrono::Duration::days(2),
                },
            ];
        }
    }

    pub fn filtered_indices(&self) -> Vec<usize> {
        let q = self.search_query.trim().to_lowercase();
        self.records
            .iter()
            .enumerate()
            .filter(|(_, rec)| {
                if let Some(cat) = self.filter_category {
                    if rec.category != cat {
                        return false;
                    }
                }
                if let Some(st) = self.filter_status {
                    if rec.status != st {
                        return false;
                    }
                }
                if q.is_empty() {
                    return true;
                }
                rec.id.to_lowercase().contains(&q)
                    || rec.title.to_lowercase().contains(&q)
                    || rec.author_or_agent.to_lowercase().contains(&q)
                    || rec.summary.to_lowercase().contains(&q)
                    || rec.source_reference.to_lowercase().contains(&q)
            })
            .map(|(i, _)| i)
            .collect()
    }

    pub fn selected_record(&self) -> Option<&KnowledgeRecord> {
        let indices = self.filtered_indices();
        if indices.is_empty() {
            None
        } else {
            let idx = indices[self.selected_idx.min(indices.len() - 1)];
            self.records.get(idx)
        }
    }
}
