use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompanyHealthMetrics {
    pub health_score: f64,
    pub uptime_pct: f64,
    pub active_projects: usize,
    pub active_agents: usize,
    pub total_agents: usize,
    pub pending_gates: usize,
    pub tokens_used: u64,
    pub tokens_limit: u64,
    pub spend_usd: f64,
    pub spend_limit_usd: f64,
    pub system_status: String,
}

impl Default for CompanyHealthMetrics {
    fn default() -> Self {
        Self {
            health_score: 98.4,
            uptime_pct: 99.98,
            active_projects: 3,
            active_agents: 13,
            total_agents: 13,
            pending_gates: 1,
            tokens_used: 412_850,
            tokens_limit: 2_000_000,
            spend_usd: 8.26,
            spend_limit_usd: 40.00,
            system_status: "NORMAL_OPERATIONAL".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReleaseGateItem {
    pub id: String,
    pub name: String,
    pub status: String,
    pub risk_level: String,
    pub required_signoff: String,
}

impl ReleaseGateItem {
    pub fn default_fixtures() -> Vec<Self> {
        vec![
            Self {
                id: "GATE-01".into(),
                name: "Unit & Integration Test Suite (54/54 passed)".into(),
                status: "PASSED".into(),
                risk_level: "LOW".into(),
                required_signoff: "QA & Verification Lead".into(),
            },
            Self {
                id: "GATE-02".into(),
                name: "Security Zero-Trust Confinement Probe".into(),
                status: "PASSED".into(),
                risk_level: "CRITICAL".into(),
                required_signoff: "Security & Governance Lead".into(),
            },
            Self {
                id: "GATE-03".into(),
                name: "Four-Eyes Production Deployment Gate".into(),
                status: "PENDING".into(),
                risk_level: "HIGH".into(),
                required_signoff: "CEO (Human Owner) + CTO".into(),
            },
            Self {
                id: "GATE-04".into(),
                name: "Constitutional Policy Invariant Check".into(),
                status: "PASSED".into(),
                risk_level: "MEDIUM".into(),
                required_signoff: "Software Architect".into(),
            },
            Self {
                id: "GATE-05".into(),
                name: "Red-Line Malicious Input / Escape Defense".into(),
                status: "PASSED".into(),
                risk_level: "CRITICAL".into(),
                required_signoff: "Security & Governance Lead".into(),
            },
        ]
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionActivityItem {
    pub id: String,
    pub workflow: String,
    pub current_step: String,
    pub status: String,
    pub progress_pct: u8,
    pub latency_ms: u64,
}

impl ExecutionActivityItem {
    pub fn default_fixtures() -> Vec<Self> {
        vec![
            Self {
                id: "WF-2026-901".into(),
                workflow: "Autonomous Software Delivery Pipeline".into(),
                current_step: "step_4_qa_verification".into(),
                status: "RUNNING".into(),
                progress_pct: 75,
                latency_ms: 320,
            },
            Self {
                id: "WF-2026-899".into(),
                workflow: "Self-Improvement Prompt Adaptation".into(),
                current_step: "step_3_benchmark_eval".into(),
                status: "COMPLETED".into(),
                progress_pct: 100,
                latency_ms: 1850,
            },
            Self {
                id: "WF-2026-898".into(),
                workflow: "Dependency Vulnerability Audit".into(),
                current_step: "step_2_seccomp_confinement".into(),
                status: "COMPLETED".into(),
                progress_pct: 100,
                latency_ms: 410,
            },
            Self {
                id: "WF-2026-895".into(),
                workflow: "Cross-Provider Fallback Routing Test".into(),
                current_step: "step_1_probe_providers".into(),
                status: "COMPLETED".into(),
                progress_pct: 100,
                latency_ms: 610,
            },
        ]
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PositionFixture {
    pub position_code: String,
    pub title: String,
    pub autonomy_level: String,
    pub current_agent: String,
    pub primary_model: String,
    pub status: String,
    pub principles_summary: String,
    pub tool_permissions: Vec<String>,
}

impl PositionFixture {
    pub fn canonical_13_positions() -> Vec<Self> {
        vec![
            Self {
                position_code: "ceo".into(),
                title: "Chief Executive Officer (CEO)".into(),
                autonomy_level: "Human-in-the-Loop".into(),
                current_agent: "human_owner_devine".into(),
                primary_model: "Human Supervised".into(),
                status: "ACTIVE".into(),
                principles_summary: "Ultimate authority, human owner, corporate strategy, executive override.".into(),
                tool_permissions: vec!["*".into()],
            },
            Self {
                position_code: "coo".into(),
                title: "Chief Operating Officer (COO)".into(),
                autonomy_level: "Collaborative".into(),
                current_agent: "agent_coo_ops".into(),
                primary_model: "Google Gemini 2.5 Pro".into(),
                status: "ACTIVE".into(),
                principles_summary: "Operational efficiency, multi-agent coordination, dispatching, bottleneck triage.".into(),
                tool_permissions: vec!["dispatch_task".into(), "reschedule".into(), "view_metrics".into()],
            },
            Self {
                position_code: "cto".into(),
                title: "Chief Technology Officer (CTO)".into(),
                autonomy_level: "Autonomous".into(),
                current_agent: "agent_cto_alex".into(),
                primary_model: "Anthropic Claude 3.7 Sonnet".into(),
                status: "ACTIVE".into(),
                principles_summary: "Technical architecture, system boundaries, code governance, refactoring strategy.".into(),
                tool_permissions: vec!["review_pr".into(), "approve_architecture".into(), "run_sandbox".into()],
            },
            Self {
                position_code: "cpo".into(),
                title: "Chief Product Officer (CPO)".into(),
                autonomy_level: "Collaborative".into(),
                current_agent: "agent_cpo_elena".into(),
                primary_model: "Google Gemini 2.5 Pro".into(),
                status: "ACTIVE".into(),
                principles_summary: "User experience focus, product specs, roadmap prioritization, feature completeness.".into(),
                tool_permissions: vec!["create_prd".into(), "prioritize_backlog".into(), "analyze_feedback".into()],
            },
            Self {
                position_code: "software_architect".into(),
                title: "Software Architect".into(),
                autonomy_level: "Autonomous".into(),
                current_agent: "agent_arch_sophia".into(),
                primary_model: "Anthropic Claude 3.7 Sonnet".into(),
                status: "ACTIVE".into(),
                principles_summary: "System design, ADR maintenance, data model invariants, domain boundary integrity.".into(),
                tool_permissions: vec!["validate_schema".into(), "audit_boundaries".into(), "generate_adr".into()],
            },
            Self {
                position_code: "engineering_lead".into(),
                title: "Engineering Lead".into(),
                autonomy_level: "Autonomous".into(),
                current_agent: "agent_eng_marcus".into(),
                primary_model: "Anthropic Claude 3.7 Sonnet".into(),
                status: "ACTIVE".into(),
                principles_summary: "High-throughput delivery, clean code, strict type safety, zero architectural drift.".into(),
                tool_permissions: vec!["write_code".into(), "run_tests".into(), "create_branch".into()],
            },
            Self {
                position_code: "ui_ux_design_lead".into(),
                title: "UI/UX Design Lead".into(),
                autonomy_level: "Autonomous".into(),
                current_agent: "agent_design_kai".into(),
                primary_model: "Google Gemini 2.5 Flash".into(),
                status: "ACTIVE".into(),
                principles_summary: "Keyboard-first ergonomics, HSL token systems, accessible contrast, rich visual aesthetics.".into(),
                tool_permissions: vec!["generate_tokens".into(), "verify_contrast".into(), "lint_layout".into()],
            },
            Self {
                position_code: "qa_verification_lead".into(),
                title: "QA & Verification Lead".into(),
                autonomy_level: "Autonomous".into(),
                current_agent: "agent_qa_tessa".into(),
                primary_model: "Anthropic Claude 3.7 Sonnet".into(),
                status: "ACTIVE".into(),
                principles_summary: "Strict TDD enforcement, zero regression tolerance, edge case testing, automated assertions.".into(),
                tool_permissions: vec!["run_test_suite".into(), "generate_tests".into(), "assert_coverage".into()],
            },
            Self {
                position_code: "devops_infrastructure_lead".into(),
                title: "DevOps & Infrastructure Lead".into(),
                autonomy_level: "Autonomous".into(),
                current_agent: "agent_devops_dane".into(),
                primary_model: "OpenAI GPT-4o".into(),
                status: "ACTIVE".into(),
                principles_summary: "Containerization, MCP runtime, CI/CD automation, circuit breaker stability, telemetry.".into(),
                tool_permissions: vec!["manage_containers".into(), "mcp_probe".into(), "reset_circuit_breaker".into()],
            },
            Self {
                position_code: "security_governance_lead".into(),
                title: "Security & Governance Lead".into(),
                autonomy_level: "Autonomous".into(),
                current_agent: "agent_sec_valeria".into(),
                primary_model: "Anthropic Claude 3.7 Sonnet".into(),
                status: "ACTIVE".into(),
                principles_summary: "Red line defense, non-root sandbox execution, secret redaction, four-eyes gate enforcement.".into(),
                tool_permissions: vec!["probe_vulnerabilities".into(), "enforce_policy".into(), "halt_execution".into()],
            },
            Self {
                position_code: "research_intelligence_lead".into(),
                title: "Research & Intelligence Lead".into(),
                autonomy_level: "Autonomous".into(),
                current_agent: "agent_research_orion".into(),
                primary_model: "Google Gemini 2.5 Pro".into(),
                status: "ACTIVE".into(),
                principles_summary: "Frontier LLM evaluations, capability benchmarking, routing optimization, prompt design.".into(),
                tool_permissions: vec!["benchmark_model".into(), "evaluate_reasoning".into(), "route_provider".into()],
            },
            Self {
                position_code: "business_growth_lead".into(),
                title: "Business Development & Growth Lead".into(),
                autonomy_level: "Collaborative".into(),
                current_agent: "agent_growth_sora".into(),
                primary_model: "OpenAI GPT-4o".into(),
                status: "ACTIVE".into(),
                principles_summary: "Developer adoption, pilot onboarding, strategic alignment, market feedback loops.".into(),
                tool_permissions: vec!["analyze_traction".into(), "draft_proposals".into(), "track_milestones".into()],
            },
            Self {
                position_code: "evolution_lead".into(),
                title: "Knowledge, Evaluation & Evolution Lead".into(),
                autonomy_level: "Autonomous".into(),
                current_agent: "agent_evo_chronos".into(),
                primary_model: "Anthropic Claude 3.7 Sonnet".into(),
                status: "ACTIVE".into(),
                principles_summary: "Corporate memory consolidation, self-improvement cycles, regression prevention, retros.".into(),
                tool_permissions: vec!["index_memory".into(), "trigger_eval_cycle".into(), "apply_adaptation".into()],
            },
        ]
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirectiveFixture {
    pub id: String,
    pub timestamp: String,
    pub author: String,
    pub title: String,
    pub status: String,
    pub details: String,
}

impl DirectiveFixture {
    pub fn default_fixtures() -> Vec<Self> {
        vec![
            Self {
                id: "DIR-001".into(),
                timestamp: "2026-10-28 06:30 UTC".into(),
                author: "CEO (Human Owner)".into(),
                title: "Build NEIMAN's keyboard-first terminal command center".into(),
                status: "IN_PROGRESS".into(),
                details: "Implement 13 canonical workspaces, universal Ctrl+K palette, and narrow terminal support.".into(),
            },
            Self {
                id: "DIR-002".into(),
                timestamp: "2026-10-28 05:15 UTC".into(),
                author: "CEO (Human Owner)".into(),
                title: "Enforce zero-filler technical communication".into(),
                status: "COMPLETED".into(),
                details: "Strip decorative discourse markers, enforce high-density bullet clauses and exact file references.".into(),
            },
            Self {
                id: "DIR-003".into(),
                timestamp: "2026-10-28 04:00 UTC".into(),
                author: "CEO (Human Owner)".into(),
                title: "Mandate four-eyes review gate for all production releases".into(),
                status: "ACTIVE".into(),
                details: "Enforce policy: production deployments require simultaneous CEO and CTO cryptographic approvals.".into(),
            },
        ]
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryStatsFixture {
    pub total_vectors: usize,
    pub episodic_events: usize,
    pub semantic_documents: usize,
    pub procedural_skills: usize,
    pub cache_hit_rate_pct: f64,
    pub retention_policy_days: u32,
    pub collections: Vec<(String, usize)>,
}

impl Default for MemoryStatsFixture {
    fn default() -> Self {
        Self {
            total_vectors: 14_820,
            episodic_events: 1_240,
            semantic_documents: 85,
            procedural_skills: 13,
            cache_hit_rate_pct: 94.6,
            retention_policy_days: 90,
            collections: vec![
                ("architectural_decisions".into(), 85),
                ("post_mortems_and_evals".into(), 42),
                ("codebase_symbol_index".into(), 12_400),
                ("constitutional_policies".into(), 13),
                ("agent_experience_traces".into(), 2_280),
            ],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GrowthInitiativeFixture {
    pub id: String,
    pub title: String,
    pub target_quarter: String,
    pub progress_pct: u8,
    pub status: String,
    pub owner: String,
}

impl GrowthInitiativeFixture {
    pub fn default_fixtures() -> Vec<Self> {
        vec![
            Self {
                id: "GROWTH-01".into(),
                title: "Enterprise Autonomous Software Node Pilot".into(),
                target_quarter: "Q4 2026".into(),
                progress_pct: 70,
                status: "ON_TRACK".into(),
                owner: "Business Development & Growth Lead".into(),
            },
            Self {
                id: "GROWTH-02".into(),
                title: "Local-First Offline Operator CLI & TUI".into(),
                target_quarter: "Q4 2026".into(),
                progress_pct: 95,
                status: "NEAR_COMPLETION".into(),
                owner: "DevOps & Infrastructure Lead".into(),
            },
            Self {
                id: "GROWTH-03".into(),
                title: "Multi-Model Heterogeneous Provider Failover Network".into(),
                target_quarter: "Q1 2027".into(),
                progress_pct: 45,
                status: "IN_DEVELOPMENT".into(),
                owner: "Research & Intelligence Lead".into(),
            },
        ]
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpServerFixture {
    pub name: String,
    pub transport: String,
    pub status: String,
    pub latency_ms: u64,
    pub tool_count: usize,
}

impl McpServerFixture {
    pub fn default_fixtures() -> Vec<Self> {
        vec![
            Self {
                name: "mcp-git-version-control".into(),
                transport: "stdio (embedded)".into(),
                status: "CONNECTED".into(),
                latency_ms: 2,
                tool_count: 8,
            },
            Self {
                name: "mcp-postgres-memory-store".into(),
                transport: "tcp://localhost:5432".into(),
                status: "CONNECTED".into(),
                latency_ms: 4,
                tool_count: 12,
            },
            Self {
                name: "mcp-bubblewrap-sandbox".into(),
                transport: "unix-domain-socket".into(),
                status: "CONNECTED".into(),
                latency_ms: 1,
                tool_count: 5,
            },
            Self {
                name: "mcp-browser-automation".into(),
                transport: "ws://localhost:9222".into(),
                status: "STANDBY".into(),
                latency_ms: 8,
                tool_count: 14,
            },
        ]
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CircuitBreakerFixture {
    pub provider: String,
    pub state: String,
    pub failure_count: u32,
    pub failure_threshold: u32,
    pub recovery_timeout_sec: u32,
}

impl CircuitBreakerFixture {
    pub fn default_fixtures() -> Vec<Self> {
        vec![
            Self {
                provider: "google_gemini".into(),
                state: "CLOSED (HEALTHY)".into(),
                failure_count: 0,
                failure_threshold: 5,
                recovery_timeout_sec: 30,
            },
            Self {
                provider: "anthropic_claude".into(),
                state: "CLOSED (HEALTHY)".into(),
                failure_count: 0,
                failure_threshold: 5,
                recovery_timeout_sec: 30,
            },
            Self {
                provider: "openai_gpt".into(),
                state: "CLOSED (HEALTHY)".into(),
                failure_count: 0,
                failure_threshold: 5,
                recovery_timeout_sec: 30,
            },
            Self {
                provider: "local_ollama".into(),
                state: "CLOSED (HEALTHY)".into(),
                failure_count: 0,
                failure_threshold: 3,
                recovery_timeout_sec: 15,
            },
        ]
    }
}
