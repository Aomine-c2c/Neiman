import { PREVIEW_COMPANY } from './controlRoomPreview';
import { getControlRoomPreviewState } from './controlRoomPreview';

const companyId = PREVIEW_COMPANY.id;
const now = '2026-09-30T09:00:00.000Z';
const state = getControlRoomPreviewState();

const memories = [
  { id: 'preview-memory-1', company_id: companyId, domain: 'COMPANY', scope: 'INTERNAL', title: 'How we make decisions', content: 'Prefer reversible experiments, record the evidence, and ask a human before external commitments.', summary: 'Evidence first; human approval for consequential external actions.', provenance_type: 'HUMAN_INPUT', source: 'Founder operating principles', confidence: 0.98, relevance_score: 0.94, access_count: 24, last_accessed_at: now, required_permissions: [], retention_policy: 'PERMANENT', is_archived: false, tags: ['governance', 'principles'], extra_metadata: {}, created_at: now, updated_at: now },
  { id: 'preview-memory-2', company_id: companyId, domain: 'PROJECT', scope: 'INTERNAL', title: 'Onboarding principle', content: 'Explain consequential choices in plain language at the moment they matter.', summary: 'Clarity at the moment of choice.', project_id: 'preview-project-onboarding', provenance_type: 'COUNCIL_RESOLUTION', source: 'Product council, September', confidence: 0.91, relevance_score: 0.87, access_count: 12, last_accessed_at: now, required_permissions: [], retention_policy: 'ONE_YEAR', is_archived: false, tags: ['product', 'onboarding'], extra_metadata: {}, created_at: now, updated_at: now },
  { id: 'preview-memory-3', company_id: companyId, domain: 'POLICY', scope: 'CONFIDENTIAL', title: 'Research source standard', content: 'Claims that can change a product decision need a traceable source and a confidence note.', summary: 'Link material claims to evidence.', provenance_type: 'AGENT_OBSERVATION', source: 'Quality review', confidence: 0.88, relevance_score: 0.82, access_count: 7, last_accessed_at: now, required_permissions: ['policy:read'], retention_policy: 'ONE_YEAR', is_archived: false, tags: ['research', 'quality'], extra_metadata: {}, created_at: now, updated_at: now },
];

const decisions = [
  { id: 'preview-decision-1', company_id: companyId, title: 'Make setup defaults explainable', problem: 'How can onboarding feel fast while preserving informed choice?', proposals: [{ title: 'Recommended defaults', owner: 'Mara Chen' }, { title: 'Start from a blank slate', owner: 'Eli Okafor' }], evidence: [{ source: 'First-run interviews', claim: 'People want a quick path and a way to inspect consequential choices.', verified: true }], participants: [{ name: 'Mara Chen', role: 'Product Lead', identity_type: 'AGENT' }, { name: 'Alex Morgan', role: 'Human owner', identity_type: 'USER' }], decision: 'Use recommended defaults and explain each choice.', rationale: 'People should move quickly while retaining informed control.', expected_outcome: 'Reduce setup abandonment while preserving user confidence.', actual_outcome: null, status: 'DECIDED', decided_at: now, decided_by_id: 'preview-human-owner', created_at: now, updated_at: now },
  { id: 'preview-decision-2', company_id: companyId, title: 'Set an evidence bar for research', problem: 'What evidence should a research summary include before it informs a decision?', proposals: [{ title: 'Sources for material claims', owner: 'Eli Okafor' }, { title: 'Citations on every sentence', owner: 'Noah Williams' }], evidence: [{ source: 'Evaluation set · 48 summaries', claim: 'Source links made reviews faster and exposed two unsupported claims.', verified: true }], participants: [{ name: 'Eli Okafor', role: 'Research Analyst', identity_type: 'AGENT' }, { name: 'Noah Williams', role: 'Evaluation Specialist', identity_type: 'AGENT' }], decision: null, rationale: null, expected_outcome: 'Increase traceability without overwhelming readers.', actual_outcome: null, status: 'IN_REVIEW', decided_at: null, decided_by_id: null, created_at: '2026-09-30T08:40:00.000Z', updated_at: now },
  { id: 'preview-decision-3', company_id: companyId, title: 'Keep provider routing reversible', problem: 'How should the organization introduce a new intelligence provider?', proposals: [{ title: 'Shadow evaluation first', owner: 'Sora Patel' }], evidence: [{ source: 'Provider evaluation plan', claim: 'Shadow runs reveal quality and latency before routing live tasks.', verified: true }], participants: [{ name: 'Sora Patel', role: 'Operations Steward', identity_type: 'AGENT' }], decision: 'Run a shadow evaluation before promotion.', rationale: 'Validate quality and privacy constraints against a fixed workload.', expected_outcome: 'A safe, evidence-backed routing change.', actual_outcome: 'Shadow evaluation completed; no live route changed.', status: 'EVALUATED', decided_at: now, decided_by_id: 'preview-human-owner', created_at: now, updated_at: now },
];
const memoryDecisions = decisions.filter((decision) => decision.decision).map((decision) => ({ id: decision.id, company_id: companyId, title: decision.title, problem: decision.problem, options: decision.proposals.map((proposal) => ({ title: String(proposal.title), description: String(proposal.owner), pros: [], cons: [] })), evidence: decision.evidence.map((evidence) => ({ source: String(evidence.source), claim: String(evidence.claim), verified: Boolean(evidence.verified) })), participants: decision.participants.map((person) => ({ name: String(person.name), role: String(person.role), identity_type: person.identity_type ?? 'AGENT', stance: 'SUPPORT' })), decision: decision.decision ?? '', rationale: decision.rationale ?? '', expected_outcome: decision.expected_outcome ?? '', actual_outcome: decision.actual_outcome, lessons_learned: [], decided_by_user_id: 'preview-human-owner', decided_at: decision.decided_at ?? now, created_at: decision.created_at, updated_at: decision.updated_at }));

const workflows = [
  { id: 'preview-workflow-research', company_id: companyId, name: 'Research brief with review', description: 'Gather evidence, draft a concise brief, and ask a human before sending.', trigger_type: 'MANUAL', trigger_config: {}, steps: [{ id: 'step-research', name: 'Gather source evidence', type: 'AGENT', config: { agent_id: 'preview-agent-eli' }, next_step_id: 'step-synthesis' }, { id: 'step-synthesis', name: 'Draft research brief', type: 'AGENT', config: { agent_id: 'preview-agent-mara' }, next_step_id: 'step-approval' }, { id: 'step-approval', name: 'Human review', type: 'APPROVAL', config: { required: true } }], agents: ['preview-agent-eli', 'preview-agent-mara'], tools: ['web_search'], conditions: [], approvals: { external_communication: true }, completion_criteria: {}, status: 'ACTIVE', created_at: now, updated_at: now },
  { id: 'preview-workflow-quality', company_id: companyId, name: 'Answer quality review', description: 'Evaluate a sample, record gaps, and return findings to the research team.', trigger_type: 'SCHEDULE', trigger_config: { cadence: 'weekly' }, steps: [{ id: 'step-sample', name: 'Select evaluation sample', type: 'TOOL', config: {} }, { id: 'step-score', name: 'Score evidence coverage', type: 'AGENT', config: { agent_id: 'preview-agent-noah' } }], agents: ['preview-agent-noah'], tools: [], conditions: [], approvals: {}, completion_criteria: {}, status: 'ACTIVE', created_at: now, updated_at: now },
];

const workflowExecutions = [{ id: 'preview-exec-1', workflow_id: workflows[0].id, company_id: companyId, triggered_by_user_id: 'preview-human-owner', title: 'Onboarding research brief', status: 'WAITING_APPROVAL', current_step_id: 'step-approval', current_step_name: 'Human review', current_step_index: 2, total_steps: 3, input_payload: { project: 'A calmer onboarding' }, state_payload: {}, output_payload: { source_count: 12, draft_ready: true }, retries_count: 0, max_retries: 2, timeout_seconds: 600, duration_ms: 84200, pending_approval_id: 'preview-approval-email', step_records: [{ id: 'preview-step-record-1', execution_id: 'preview-exec-1', step_id: 'step-research', step_name: 'Gather source evidence', step_type: 'AGENT', step_index: 0, agent_id: 'preview-agent-eli', agent_name: 'Eli Okafor', status: 'COMPLETED', input_data: {}, output_data: { sources: 12 }, retries_attempted: 0, duration_ms: 40300, created_at: now }, { id: 'preview-step-record-2', execution_id: 'preview-exec-1', step_id: 'step-synthesis', step_name: 'Draft research brief', step_type: 'AGENT', step_index: 1, agent_id: 'preview-agent-mara', agent_name: 'Mara Chen', status: 'COMPLETED', input_data: {}, output_data: { draft: 'ready' }, retries_attempted: 0, duration_ms: 43900, created_at: now }], created_at: now, updated_at: now }];

const councils = [{ id: 'preview-council-product', company_id: companyId, name: 'Product & Evidence Council', charter: 'Bring product, research, and operations perspectives together before consequential choices.', council_type: 'PERMANENT', is_active: true, synthesis_agent_id: 'preview-agent-mara', members: [{ role_title: 'Product Lead', agent_name: 'Mara Chen', perspective: 'User value and coherent delivery', model_identifier: 'claude-sonnet', model_provider: 'anthropic', agent_id: 'preview-agent-mara' }, { role_title: 'Research Analyst', agent_name: 'Eli Okafor', perspective: 'Evidence quality and uncertainty', model_identifier: 'gemini-2.5-pro', model_provider: 'google', agent_id: 'preview-agent-eli' }, { role_title: 'Operations Steward', agent_name: 'Sora Patel', perspective: 'Operational risk and reversibility', model_identifier: 'gpt-4.1', model_provider: 'openai', agent_id: 'preview-agent-sora' }], created_at: now, updated_at: now }];

const deliberations = [{ id: 'preview-delib-1', council_id: councils[0].id, company_id: companyId, title: 'Evidence bar for research summaries', problem_statement: 'What evidence is enough to make a research summary decision-ready?', context_data: { evaluation_sample: 48 }, current_stage: 'SYNTHESIS', status: 'DELIBERATING', proposals: [], independent_reviews: [{ agent_name: 'Eli Okafor', role: 'Research Analyst', perspective: 'Material claims need traceable sources.', model: 'Gemini 2.5 Pro', proposal: 'Require a source link and confidence note for claims that change a decision.', evidence: ['48-summary evaluation set'], risks: ['Extra drafting time'], assumptions: ['Reviewers can inspect linked sources'], confidence: 0.89, objections: [] }, { agent_name: 'Sora Patel', role: 'Operations Steward', perspective: 'Keep the standard proportional to risk.', model: 'GPT-4.1', proposal: 'Apply the requirement to material claims, not every sentence.', evidence: ['Review time fell in sourced samples'], risks: ['Edge cases need judgment'], assumptions: [], confidence: 0.84, objections: ['Need an escalation path for inaccessible sources'] }], objections: [], discussion_threads: [], synthesis_proposal: { title: 'Traceable material claims', synthesized_decision: 'Require sources for material claims and preserve uncertainty notes.', consensus_points: ['Traceability improves review', 'Scope should remain proportional'], unresolved_dissent: ['How to handle inaccessible primary sources'], recommended_mitigations: ['Allow a documented alternate source with lower confidence'] }, disagreements_recorded: [{ topic: 'Citation scope', dissenting_agents: ['Eli Okafor', 'Sora Patel'], dissenting_models: ['Gemini 2.5 Pro', 'GPT-4.1'], argument: 'A link on every claim maximizes auditability.', counter_argument: 'Over-citation adds noise and slows synthesis.', mitigation: 'Apply the source rule to material claims and label uncertainty.' }], created_at: now, updated_at: now }];

const governanceAudits = state.audits.map((entry) => ({ ...entry, actor_name: entry.actor_id === 'preview-agent-eli' ? 'Eli Okafor' : 'Noah Williams', actor_type: 'AGENT', authority: 'SUPERVISED', risk_level: 'MEDIUM', details: {} }));
const approvals = [{ id: 'preview-approval-email', company_id: companyId, agent_id: 'preview-agent-mara', task_id: 'preview-task-journey', title: 'Send onboarding research brief', action: 'SEND_EXTERNAL_MESSAGE', target: 'Product research mailing list', risk_level: 'HIGH', proposed_payload: { recipient_count: 4, includes_external_research: true }, reason: 'External communication needs a human review before it leaves the organization.', status: 'PENDING', reviewer_user_id: null, reviewer_notes: null, resolved_at: null, created_at: now, updated_at: now }];

const providers = [
  { id: 'preview-provider-anthropic', name: 'anthropic', display_name: 'Anthropic', description: 'Frontier reasoning and synthesis', website_url: 'https://www.anthropic.com', is_local: false, is_active: true, is_healthy: true, consecutive_failures: 0, created_at: now },
  { id: 'preview-provider-google', name: 'google', display_name: 'Google AI', description: 'Multimodal and long-context intelligence', website_url: 'https://ai.google.dev', is_local: false, is_active: true, is_healthy: true, consecutive_failures: 0, created_at: now },
  { id: 'preview-provider-openai', name: 'openai', display_name: 'OpenAI', description: 'General-purpose reasoning', website_url: 'https://platform.openai.com', is_local: false, is_active: true, is_healthy: true, consecutive_failures: 0, created_at: now },
  { id: 'preview-provider-local', name: 'ollama', display_name: 'Local models', description: 'Private, on-device workloads', website_url: null, is_local: true, is_active: true, is_healthy: false, consecutive_failures: 2, created_at: now },
];
const models = [
  { id: 'preview-model-claude', provider_id: providers[0].id, model_identifier: 'claude-sonnet', display_name: 'Claude Sonnet', capabilities: ['reasoning', 'writing', 'analysis'], modalities: ['text'], context_capacity: 200000, supports_tools: true, supports_structured_output: true, input_cost_per_million: 3, output_cost_per_million: 15, avg_latency_ms: 1180, privacy_classification: 'STANDARD', is_active: true, created_at: now },
  { id: 'preview-model-gemini', provider_id: providers[1].id, model_identifier: 'gemini-2.5-pro', display_name: 'Gemini 2.5 Pro', capabilities: ['reasoning', 'research', 'long_context'], modalities: ['text', 'image'], context_capacity: 1000000, supports_tools: true, supports_structured_output: true, input_cost_per_million: 1.25, output_cost_per_million: 10, avg_latency_ms: 940, privacy_classification: 'STANDARD', is_active: true, created_at: now },
  { id: 'preview-model-gpt', provider_id: providers[2].id, model_identifier: 'gpt-4.1', display_name: 'GPT-4.1', capabilities: ['reasoning', 'coding', 'analysis'], modalities: ['text', 'image'], context_capacity: 1000000, supports_tools: true, supports_structured_output: true, input_cost_per_million: 2, output_cost_per_million: 8, avg_latency_ms: 1030, privacy_classification: 'STANDARD', is_active: true, created_at: now },
  { id: 'preview-model-local', provider_id: providers[3].id, model_identifier: 'qwen3-8b', display_name: 'Qwen 3 · Local', capabilities: ['summarization', 'classification'], modalities: ['text'], context_capacity: 32000, supports_tools: true, supports_structured_output: true, input_cost_per_million: 0, output_cost_per_million: 0, avg_latency_ms: 2210, privacy_classification: 'LOCAL_ONLY', is_active: true, created_at: now },
];
const routingPolicy = { id: 'preview-routing-policy', company_id: companyId, name: 'Balanced · evidence first', description: 'Route by capability, privacy, reliability, latency, and cost.', strategy: 'BALANCED', max_cost_per_query_usd: 0.2, max_acceptable_latency_ms: 5000, required_privacy_level: 'STANDARD', fallback_chain: ['anthropic/claude-sonnet', 'google/gemini-2.5-pro', 'local/qwen3-8b'], capability_preferences: { research: 'google/gemini-2.5-pro', writing: 'anthropic/claude-sonnet', private: 'local/qwen3-8b' }, is_default: true, created_at: now };
const intelligenceDashboard = { total_requests: 1842, total_tokens_consumed: 2940000, total_spend_usd: 38.65, avg_latency_ms: 1120, overall_success_rate: 0.987, providers_count: 4, models_count: 4, healthy_providers_count: 3, recent_routing_decisions: [{ id: 'preview-route-1', requested_capability: 'research', provider: 'google', model: 'gemini-2.5-pro', cost_usd: 0.024, latency_ms: 940, routed_tier: 'PRIMARY', fallback: false, attempts_count: 1, circuit_breaker_status: 'CLOSED', success: true, created_at: now }, { id: 'preview-route-2', requested_capability: 'private summarization', provider: 'local', model: 'qwen3-8b', cost_usd: 0, latency_ms: 2210, routed_tier: 'PRIVACY', fallback: true, fallback_reason: 'Local-only data policy', attempts_count: 1, circuit_breaker_status: 'CLOSED', success: true, created_at: '2026-09-30T08:45:00.000Z' }], available_providers: providers, available_models: models };

const constitution = { id: 'preview-constitution-v1', company_id: companyId, version: 3, is_active: true, mission: PREVIEW_COMPANY.mission, values: ['Clarity', 'Evidence', 'Reversibility', 'Human agency'], operating_principles: ['Prefer reversible experiments.', 'Make uncertainty visible.', 'Keep people in control of consequential actions.'], prohibited_actions: ['Send external communications without approval.', 'Change organizational structure without validated review.'], approval_requirements: ['External communication', 'Financial commitment', 'Organization-wide policy change'], security_rules: ['Use least privilege.', 'Do not expose confidential memory outside its scope.'], financial_rules: ['Keep spend within approved project budgets.'], data_rules: ['Respect data classification and retention rules.'], autonomy_boundaries: { default_level: 2, maximum_without_review: 3 }, escalation_rules: ['Escalate policy conflicts to a human owner.'], established_by: 'preview-human-owner', amendment_notes: 'Reviewed with the Product & Evidence Council.', created_at: now, updated_at: now };

const autonomyConfigs = [{ id: 'preview-autonomy-1', company_id: companyId, autonomy_level: 2, risk_level: 'MEDIUM', requires_explicit_approval: true, department_id: 'preview-dept-product', action_name: 'external_communication', conditions: { recipients: 'outside organization' }, rationale: 'Human review protects context and reputation.', created_at: now, updated_at: now }, { id: 'preview-autonomy-2', company_id: companyId, autonomy_level: 1, risk_level: 'LOW', requires_explicit_approval: false, department_id: 'preview-dept-intelligence', task_type: 'internal_research', conditions: {}, rationale: 'Internal source gathering is reversible and auditable.', created_at: now, updated_at: now }];
const escalations = [{ id: 'preview-escalation-1', company_id: companyId, agent_id: 'preview-agent-noah', task_id: 'preview-task-sources', reason: 'Evidence source is inaccessible', description: 'One primary source is behind an access wall; alternate evidence is needed before scoring.', severity: 'MEDIUM', status: 'OPEN', context_data: { source: 'industry report' }, resolution: null, created_at: now, updated_at: now }];

const resources = {
  control: { company_id: companyId, generated_at: now, capacities: [{ category: 'COMPUTE', unit: 'cores', limited_capacity: 24, allocated_capacity: 9, available_capacity: 15, observed_usage: 7, utilization_percentage: 38 }, { category: 'INTELLIGENCE', unit: 'tokens/min', limited_capacity: 120000, allocated_capacity: 42000, available_capacity: 78000, observed_usage: 29400, utilization_percentage: 35 }, { category: 'OPERATIONAL', unit: 'concurrent slots', limited_capacity: 16, allocated_capacity: 6, available_capacity: 10, observed_usage: 4, utilization_percentage: 25 }], budget_consumption: { total_budget_usd: 120, spent_budget_usd: 38.65, remaining_budget_usd: 81.35, burn_rate_percent: 32.2, budgets_count: 2 }, active_allocations_count: 4, queued_requests_count: 1, bottlenecks: [{ pool_id: 'preview-pool-local', pool_name: 'Local inference pool', category: 'INTELLIGENCE', utilization_percentage: 82, queued_requests_count: 1, severity: 'HIGH', recommendation: 'Route non-private low-latency work to a healthy provider while local capacity recovers.' }], expensive_tasks: [{ task_id: 'preview-task-journey', task_title: 'Review first-run journey', agent_name: 'Mara Chen', cost_usd: 1.47, tokens_consumed: 12400, cpu_duration_seconds: 18 }], provider_usage: [{ provider: 'anthropic', total_cost_usd: 2.31, total_tokens: 12800, request_count: 18 }, { provider: 'google', total_cost_usd: 1.42, total_tokens: 9300, request_count: 12 }, { provider: 'local', total_cost_usd: 0, total_tokens: 7300, request_count: 9 }], system_host_telemetry: { metric_state: 'ESTIMATED', cpu_cores_available: 15, load_average: [1.08, 0.92, 0.77], storage_total_gb: 512, storage_free_gb: 328, ram_total_mb: 16384, gpu_detected: false } },
  pools: [{ id: 'preview-pool-compute', company_id: companyId, name: 'Shared compute', category: 'COMPUTE', description: 'General orchestration and evaluation capacity.', total_capacity: 24, unit: 'vCPU cores', allocated_capacity: 9, observed_usage: 7, available_capacity: 15, is_active: true, created_at: now, updated_at: now }, { id: 'preview-pool-local', company_id: companyId, name: 'Local inference pool', category: 'INTELLIGENCE', description: 'Private workloads on local models.', total_capacity: 120000, unit: 'tokens/min', allocated_capacity: 98000, observed_usage: 98400, available_capacity: 21600, is_active: true, created_at: now, updated_at: now }, { id: 'preview-pool-slots', company_id: companyId, name: 'Human review slots', category: 'OPERATIONAL', description: 'Weekly review capacity for consequential actions.', total_capacity: 16, unit: 'slots', allocated_capacity: 6, observed_usage: 4, available_capacity: 10, is_active: true, created_at: now, updated_at: now }],
  budgets: [{ id: 'preview-budget-product', company_id: companyId, department_id: 'preview-dept-product', name: 'Product Lab · September', fiscal_period: '2026-09', total_budget_usd: 70, spent_budget_usd: 24.8, remaining_budget_usd: 45.2, total_token_allowance: 2000000, consumed_tokens: 1480000, remaining_tokens: 520000, alert_threshold_percent: 80, is_exhausted: false, created_at: now, updated_at: now }, { id: 'preview-budget-research', company_id: companyId, department_id: 'preview-dept-intelligence', name: 'Intelligence · September', fiscal_period: '2026-09', total_budget_usd: 50, spent_budget_usd: 13.85, remaining_budget_usd: 36.15, total_token_allowance: 1500000, consumed_tokens: 960000, remaining_tokens: 540000, alert_threshold_percent: 80, is_exhausted: false, created_at: now, updated_at: now }],
  requests: [{ id: 'preview-resource-request', company_id: companyId, agent_id: 'preview-agent-noah', task_id: 'preview-task-evaluation', priority: 'NORMAL', justification: 'Run a representative answer-quality evaluation set.', requested_compute: { cpu_cores: 2, ram_gb: 4 }, requested_intelligence: { tokens: 120000, api_requests: 20, max_inference_cost_usd: 3, preferred_model: 'qwen3-8b', fallback_allowed: false }, requested_operational: { runtime_minutes: 45, slots_needed: 1, requires_human_approval: false }, decision: 'QUEUE', decision_reason: 'Local inference pool is temporarily above its utilization threshold.', evaluated_at: now, created_at: now, updated_at: now }],
};

const kpis = [{ id: 'preview-kpi-completion', company_id: companyId, name: 'Decision-ready completion', description: 'Tasks completed with evidence and a clear next step.', dimension: 'TASK', metric_key: 'decision_ready_pct', target_benchmark: 92, warning_threshold: 80, unit: '%', is_active: true, created_at: now, updated_at: now }];
const summary = { company_id: companyId, dimensions: { COMPANY: { dimension: 'COMPANY', completion_rate_pct: 91, failure_rate_pct: 2.1, avg_cycle_time_ms: 2640000, resource_efficiency_score: 84, cost_usd: 38.65, rework_count: 4, quality_score: 92, human_interventions: 7, escalation_frequency: 3.2, provider_reliability_pct: 98.7, task_success_rate_pct: 94, observations_count: 184 }, AGENT: { dimension: 'AGENT', completion_rate_pct: 88, failure_rate_pct: 3.4, avg_cycle_time_ms: 1820000, resource_efficiency_score: 81, cost_usd: 38.65, rework_count: 6, quality_score: 90, human_interventions: 7, escalation_frequency: 4.1, provider_reliability_pct: 98.7, task_success_rate_pct: 91, observations_count: 86 }, WORKFLOW: { dimension: 'WORKFLOW', completion_rate_pct: 94, failure_rate_pct: 1.8, avg_cycle_time_ms: 1260000, resource_efficiency_score: 87, cost_usd: 21.2, rework_count: 2, quality_score: 93, human_interventions: 4, escalation_frequency: 1.7, provider_reliability_pct: 98.7, task_success_rate_pct: 96, observations_count: 48 } }, overall_health: 'HEALTHY_WITH_REVIEW', active_bottlenecks: [{ dimension: 'MODEL_PROVIDER', target: 'Local inference pool', issue: 'Queue pressure is elevated during evaluation runs.', severity: 'MEDIUM' }] };
const adaptations = [{ id: 'preview-adaptation-1', company_id: companyId, title: 'Route research workloads by evidence capability', adaptation_type: 'CHANGE_MODEL_ROUTING', stage: 'VALIDATE', status: 'PENDING_APPROVAL', trigger_diagnosis: 'Research tasks used a general route despite stronger long-context capability being available.', evidence: [{ sample_size: 48, finding: 'Source coverage improved in evaluation.' }], previous_state: { strategy: 'BALANCED' }, proposed_state: { research: 'google/gemini-2.5-pro' }, expected_improvement: 'Improve source coverage while keeping spend within the current budget.', risk_assessment: 'Low risk; staged routing with rollback available.', risk_level: 'LOW', simulation_results: { synthetic_runs: 30, latency_reduction_pct: 8, cost_savings_pct: 4, failure_rate_synthetic: 2.1 }, validation_passed: true, snapshot_id: 'preview-snapshot-1', approved_by: null, deployed_at: null, actual_result: {}, created_at: now, updated_at: now }];
const snapshots = [{ id: 'preview-snapshot-1', company_id: companyId, name: 'Routing baseline · v3', reason: 'Captured before proposed research-route adjustment.', snapshot_data: { agents: 4, providers: 4, policy_version: 3 }, version: 3, created_at: '2026-09-29T14:00:00.000Z' }];
const scenarios = [{ id: 'preview-scenario-balanced', company_id: companyId, name: 'Evidence-first routing', description: 'Test a capability-aware route while retaining privacy and budget limits.', is_active: true, baseline_config: { agent_count: 4, intelligence_budget_monthly_usd: 120, routing_strategy: 'BALANCED', parallel_execution_slots: 6, agents_summary: [{ name: 'Mara Chen', role: 'Product Lead', model_tier: 'frontier' }] }, simulated_config: { agent_count: 4, intelligence_budget_monthly_usd: 120, routing_strategy: 'CAPABILITY_AWARE', parallel_execution_slots: 6, policy_rules: ['Keep private inputs local', 'Require approval for external actions'] }, workload_profile: { tasks_count: 120, concurrency: 5, type: 'MIXED_RESEARCH_AND_SYNTHESIS' }, status: 'EVALUATED', is_promoted: false, created_at: now, updated_at: now }];

const blueprintCatalog = ['Product research studio', 'Responsible commerce', 'Secure software lab'].map((name, index) => ({
  id: `preview-blueprint-${index + 1}`, key: ['product-research-studio', 'responsible-commerce', 'secure-software-lab'][index], name, tagline: ['Evidence-led product teams', 'Human-centered digital retail', 'Security-first engineering'][index], description: ['A compact research and product organization that turns evidence into clear, testable decisions.', 'A commerce organization designed around customer trust, careful operations, and measurable growth.', 'An engineering studio with security review, quality gates, and controlled delivery.'][index], category: ['Technology', 'Commerce & Retail', 'Information Security'][index], icon: ['🔎', '🛍️', '🛡️'][index], is_system_template: true, version: 2, company_definition: { name, mission: 'Build useful products with evidence, care, and human judgment.', vision: 'A durable organization that learns without losing accountability.', industry: ['Product & Research', 'Commerce', 'Software & Security'][index], dna: { operating_philosophy: 'Human-centered and evidence-led' } }, departments: [{ name: 'Product Lab', purpose: 'Shape the product and validate outcomes.' }, { name: 'Intelligence', purpose: 'Research and synthesize evidence.' }], roles: [{ department_name: 'Product Lab', title: 'Product Lead', responsibilities: ['Prioritize outcomes'], capabilities: ['planning'], authority: 'PROPOSE', autonomy_level: 2 }], agents: [{ name: 'Research Analyst', role_title: 'Research Analyst', department_name: 'Intelligence', system_instructions: 'Use traceable evidence and state uncertainty.', responsibilities: ['Research'], capabilities: ['analysis'], autonomy_level: 2 }], workflows: [{ name: 'Evidence brief', description: 'Gather sources and request human review.', trigger_type: 'MANUAL', steps: [] }], policies: [{ name: 'Human review for external action', description: 'Require review before external communications.', scope: 'External actions', rules: [], enforcement_level: 'REQUIRE_APPROVAL' }], constitution: { mission: 'Build useful products with evidence and care.', values: ['Clarity', 'Evidence', 'Human agency'], operating_principles: ['Prefer reversible experiments'], prohibited_actions: ['External action without review'], approval_requirements: ['External communication'], security_rules: ['Least privilege'], financial_rules: ['Stay within approved budget'], data_rules: ['Respect scope'], autonomy_boundaries: {}, escalation_rules: ['Escalate consequential uncertainty'] }, recommended_tools: [{ name: 'Research workspace' }], intelligence_requirements: { reasoning: 'frontier', local_private: true }, resource_policies: { monthly_budget_usd: 120 }, kpis: [{ metric: 'Decision-ready completion', target: '92%', frequency: 'weekly' }], approval_rules: [{ operation: 'External communication', required_role: 'Human owner', risk: 'HIGH' }], default_autonomy: 2, escalation_rules: [{ trigger: 'Policy conflict', target_role: 'Human owner', timeframe_minutes: 30 }], estimated_monthly_cost_usd: [120, 180, 240][index], metadata_tags: [['research', 'product', 'evidence'], ['commerce', 'trust', 'operations'], ['security', 'software', 'quality']][index], created_at: now, updated_at: now,
}));

const buildProposal = { id: 'preview-proposal-1', prompt: 'Create an evidence-led product studio for useful tools in Southern Africa.', status: 'SIMULATED', proposed_blueprint: { name: 'Mosaic Product Studio', default_autonomy: 2, company_definition: { mission: 'Turn local insight into useful, trustworthy software.', vision: 'Make practical technology easier to adopt.', industry: 'Product & Research' }, departments: [{ name: 'Product Lab' }, { name: 'Field Research' }, { name: 'Operations & Trust' }], agents: [{ name: 'Product Lead' }, { name: 'Research Analyst' }, { name: 'Operations Steward' }] }, estimated_operating_cost: { total_monthly_usd: 185, token_cost_usd: 82, compute_cost_usd: 36, operational_overhead_usd: 67, staffing_ratio: '1 human owner · 5 specialized agents' }, risks_identified: [{ category: 'Evidence quality', description: 'Local context may be underrepresented in broad provider knowledge.', mitigation: 'Prioritize primary and locally grounded sources.', severity: 'MEDIUM' }], generation_stages: { user_description: 'Create an evidence-led product studio.', requirement_analysis: {}, industry_identification: 'Product & Research', organizational_design: {}, department_generation: [], role_generation: [], agent_generation: [], workflow_generation: [], policy_generation: [], resource_model: {}, intelligence_requirements: {}, risk_analysis: [] }, simulation_results: { test_workload_size: 30, concurrency_level: 5, simulated_tasks_succeeded: 28, simulated_tasks_failed: 2, avg_latency_ms: 1350, estimated_run_cost_usd: 1.84, quality_benchmark_pct: 91, dry_run_disclaimer: 'Synthetic simulation only. No organization was created.' }, human_approval_requirements: [{ gate: 'Organization instantiation', description: 'Review mission, autonomy, and resource allocation.', required_authority: 'Human owner' }], estimated_operational_complexity: 'MODERATE', instantiated_company_id: null, created_at: now };

/** Returns an explicit preview fixture or undefined for a route that has no fixture yet. */
export function getPreviewApiResponse(path: string): unknown | undefined {
  const pathname = path.split('?')[0];
  if (pathname === '/api/v1/companies/me') return [PREVIEW_COMPANY];
  if (pathname === '/blueprints') return blueprintCatalog;
  if (pathname.startsWith('/blueprints/')) {
    if (pathname.endsWith('/export')) return blueprintCatalog[0];
    if (pathname.includes('/build-my-company/')) return buildProposal;
    return blueprintCatalog.find((blueprint) => pathname.endsWith(blueprint.id) || pathname.endsWith(blueprint.key)) ?? blueprintCatalog[0];
  }
  const route = pathname.replace(/^\/api\/v1\/companies\/[^/]+\/?/, '');
  if (/^companies\/[^/]+$/.test(pathname.replace(/^\/api\/v1\//, ''))) return PREVIEW_COMPANY;
  if (route === 'agents') return state.agents;
  if (/^agents\/[^/]+\/profile$/.test(route)) {
    const agentId = route.split('/')[1];
    const agent = state.agents.find((item) => item.id === agentId) ?? state.agents[0];
    return { ...agent, role_title: agent.identity.title, department_name: state.departments.find((department) => department.id === agent.department_id)?.name ?? null, manager_name: state.agents.find((item) => item.id === agent.manager_agent_id)?.name ?? null, current_task: state.tasks.find((task) => task.assigned_agent_id === agent.id && task.status === 'IN_PROGRESS') ?? null, recent_communications: [], recent_decisions: [], recent_audits: [], memories: [] };
  }
  if (/^agents\/[^/]+\/audits$/.test(route)) return governanceAudits;
  if (/^agents\/[^/]+\/(communications|memories)$/.test(route)) return [];
  if (/^agents\/[^/]+$/.test(route)) return state.agents.find((agent) => route.endsWith(agent.id)) ?? state.agents[0];
  if (route === 'departments') return state.departments;
  if (route === 'roles') return state.roles;
  if (route === 'members') return [{ id: 'preview-member-owner', company_id: companyId, user_id: 'preview-human-owner', role: 'OWNER', is_active: true, created_at: now, updated_at: now }];
  if (route === 'projects') return state.projects;
  if (/^projects\/[^/]+\/tasks$/.test(route)) return state.tasks.filter((task) => task.project_id === route.split('/')[1]);
  if (route === 'governance/constitution') return constitution;
  if (route === 'governance/autonomy-configs') return autonomyConfigs;
  if (route.startsWith('governance/approvals')) return approvals;
  if (route.startsWith('governance/escalations')) return escalations;
  if (route.startsWith('governance/audits')) return governanceAudits;
  if (route === 'governance/evaluate-action') return { allowed: false, effective_autonomy_level: 2, effective_autonomy_label: 'Supervised', requires_approval: true, is_prohibited: false, matched_constitution_clause: 'External communication requires human review', matched_config_id: autonomyConfigs[0].id, approval_request_id: approvals[0].id, reason: 'Synthetic preview: consequential actions require a human review.' };
  if (route === 'decisions') return decisions;
  if (route === 'workflows') return workflows;
  if (/^workflows\/[^/]+\/executions$/.test(route)) return workflowExecutions;
  if (/^workflows\/executions\/[^/]+$/.test(route)) return workflowExecutions[0];
  if (/^workflows\/[^/]+$/.test(route)) return workflows.find((workflow) => route.endsWith(workflow.id)) ?? workflows[0];
  if (route === 'councils') return councils;
  if (/^councils\/[^/]+\/deliberations$/.test(route)) return deliberations;
  if (/^councils\/deliberations\/[^/]+$/.test(route)) return deliberations[0];
  if (/^councils\/[^/]+$/.test(route)) return councils[0];
  if (route === 'intelligence/dashboard') return intelligenceDashboard;
  if (route === 'intelligence/policy') return routingPolicy;
  if (route === 'intelligence/providers') return providers;
  if (route === 'intelligence/models') return models;
  if (route === 'resources/control-center') return resources.control;
  if (route.startsWith('resources/pools')) return resources.pools;
  if (route.startsWith('resources/budgets')) return resources.budgets;
  if (route.startsWith('resources/requests')) return resources.requests;
  if (route.startsWith('resources/allocations')) return [{ id: 'preview-allocation-1', company_id: companyId, pool_id: 'preview-pool-compute', request_id: 'preview-resource-request', allocated_amount: 2, unit: 'vCPU cores', status: 'ACTIVE', expires_at: '2026-10-01T09:00:00.000Z', created_at: now, updated_at: now }];
  if (/^memory\/items\/[^/]+$/.test(route)) return memories.find((memory) => route.endsWith(memory.id)) ?? memories[0];
  if (/^memory\/items$/.test(route) || route.startsWith('memory/search')) {
    const query = path.split('?')[1] ?? '';
    const params = new URLSearchParams(query);
    const search = params.get('q')?.toLowerCase();
    const domain = params.get('domain');
    const scope = params.get('scope');
    return memories.filter((memory) => (!search || `${memory.title} ${memory.content} ${memory.summary}`.toLowerCase().includes(search)) && (!domain || memory.domain === domain) && (!scope || memory.scope === scope));
  }
  if (route.startsWith('memory/decisions')) return memoryDecisions;
  if (route === 'performance/summary') return summary;
  if (route === 'performance/metrics') return Object.entries(summary.dimensions).map(([dimension, metric]) => ({ id: `preview-metric-${dimension.toLowerCase()}`, company_id: companyId, dimension, target_id: companyId, target_name: dimension === 'COMPANY' ? PREVIEW_COMPANY.name : dimension, metric_name: 'task_success_rate', actual_value: metric.task_success_rate_pct, expected_value: 92, unit: '%', sample_size: metric.observations_count, evidence: { source: 'Synthetic preview fixture' }, notes: 'Illustrative sample metric; not live telemetry.', created_at: now }));
  if (route === 'performance/kpis') return kpis;
  if (route === 'evolution/snapshots') return snapshots;
  if (route === 'evolution/adaptations') return adaptations;
  if (/^evolution\/adaptations\/[^/]+$/.test(route)) return adaptations[0];
  if (route === 'simulation/scenarios') return scenarios;
  if (/^simulation\/scenarios\/[^/]+$/.test(route)) return scenarios[0];
  if (route.startsWith('activity')) {
    return [
      {
        id: 'ev-seed-1',
        company_id: companyId,
        event_type: 'agent_started',
        severity: 'INFO',
        title: 'Sentinel Security Agent activated',
        summary: 'Agent started autonomous perimeter vulnerability sweep across production VPC.',
        agent_id: 'preview-agent-sora',
        agent_name: 'Sentinel Agent',
        department_id: 'preview-dept-product',
        department_name: 'Security Operations',
        project_id: 'preview-project-onboarding',
        project_name: 'Infrastructure Hardening',
        payload: { mode: 'autonomous', tools: ['vuln_scanner'] },
        timestamp: now,
      },
      {
        id: 'ev-seed-2',
        company_id: companyId,
        event_type: 'task_created',
        severity: 'LOW',
        title: 'Audit trail compaction scheduled',
        summary: 'Task created to compress cryptographic HMAC audit logs older than 30 days.',
        agent_id: 'preview-agent-eli',
        agent_name: 'Governance Guardian',
        department_id: 'preview-dept-product',
        department_name: 'Governance & Compliance',
        project_id: 'preview-project-onboarding',
        project_name: 'Zero-Trust Audit Vault',
        payload: { target_records: 14200 },
        timestamp: now,
      },
      {
        id: 'ev-seed-3',
        company_id: companyId,
        event_type: 'workflow_started',
        severity: 'INFO',
        title: 'Workflow "Core CI/CD" kicked off',
        summary: 'Multi-agent deployment verification workflow started with 4 parallel test runners.',
        agent_id: 'preview-agent-mara',
        agent_name: 'Nexus Deployer',
        department_id: 'preview-dept-product',
        department_name: 'Engineering Core',
        project_id: 'preview-project-onboarding',
        project_name: 'NextGen Core Engine',
        payload: { stages: ['lint', 'test', 'canary'] },
        timestamp: now,
      },
      {
        id: 'ev-seed-4',
        company_id: companyId,
        event_type: 'provider_failed',
        severity: 'HIGH',
        title: 'Primary Model Provider API connection timeout',
        summary: 'Provider Anthropic returned 504 Gateway Timeout on claude-3-5-sonnet endpoint.',
        agent_id: 'preview-agent-eli',
        agent_name: 'Research Analyst',
        department_id: 'preview-dept-intelligence',
        department_name: 'Intelligence & Research',
        project_id: 'preview-project-onboarding',
        project_name: 'A calmer onboarding',
        payload: { provider: 'anthropic', status_code: 504 },
        timestamp: now,
      },
      {
        id: 'ev-seed-5',
        company_id: companyId,
        event_type: 'provider_switched',
        severity: 'MEDIUM',
        title: 'Circuit Breaker redirected model traffic',
        summary: 'Autonomous failover switched default synthesis tier from Anthropic to Google Gemini.',
        agent_id: 'preview-agent-sora',
        agent_name: 'Failover Orchestrator',
        department_id: 'preview-dept-intelligence',
        department_name: 'Infrastructure',
        project_id: 'preview-project-onboarding',
        project_name: 'A calmer onboarding',
        payload: { from: 'anthropic', to: 'google' },
        timestamp: now,
      },
      {
        id: 'ev-seed-6',
        company_id: companyId,
        event_type: 'resource_threshold',
        severity: 'HIGH',
        title: 'Intelligence Token Pool exceeded 85% capacity',
        summary: 'Hourly inference token allocation reached 86.4% utilization threshold.',
        agent_id: 'preview-agent-noah',
        agent_name: 'Resource Controller',
        department_id: 'preview-dept-intelligence',
        department_name: 'Intelligence & Research',
        project_id: 'preview-project-onboarding',
        project_name: 'A calmer onboarding',
        payload: { utilization: 0.864 },
        timestamp: now,
      },
      {
        id: 'ev-seed-7',
        company_id: companyId,
        event_type: 'approval_requested',
        severity: 'CRITICAL',
        title: 'Human-in-the-loop review required: Outbound API Key Rotation',
        summary: 'Agent requested approval to cycle production API secret keys.',
        agent_id: 'preview-agent-sora',
        agent_name: 'Sentinel Agent',
        department_id: 'preview-dept-product',
        department_name: 'Security Operations',
        project_id: 'preview-project-onboarding',
        project_name: 'Zero-Trust Audit Vault',
        payload: { action: 'ROTATE_KEYS', risk: 'CRITICAL' },
        timestamp: now,
      },
      {
        id: 'ev-seed-8',
        company_id: companyId,
        event_type: 'approval_completed',
        severity: 'INFO',
        title: 'Approval Granted: Financial transaction batch #482',
        summary: 'Marcus Sterling approved operational GPU spot instance expansion batch.',
        agent_id: 'preview-agent-mara',
        agent_name: 'Fiscal Auditor',
        department_id: 'preview-dept-product',
        department_name: 'Finance & Planning',
        project_id: 'preview-project-onboarding',
        project_name: 'Compute Optimization',
        payload: { status: 'APPROVED', amount: 420 },
        timestamp: now,
      },
      {
        id: 'ev-seed-9',
        company_id: companyId,
        event_type: 'task_failed',
        severity: 'HIGH',
        title: 'Synthetic benchmark query exceeded timeout',
        summary: 'Task "Vector Search Stress Test" aborted after exceeding 30000ms SLA.',
        agent_id: 'preview-agent-noah',
        agent_name: 'Reliability QA Agent',
        department_id: 'preview-dept-product',
        department_name: 'Engineering Core',
        project_id: 'preview-project-onboarding',
        project_name: 'NextGen Core Engine',
        payload: { error: 'QueryTimeoutError' },
        timestamp: now,
      },
      {
        id: 'ev-seed-10',
        company_id: companyId,
        event_type: 'decision_created',
        severity: 'INFO',
        title: 'Council ratified: Zero-Trust Model Routing Protocol',
        summary: 'Architecture Council approved fallback chain: Anthropic -> Google -> Local.',
        agent_id: 'preview-agent-mara',
        agent_name: 'Chief Architect',
        department_id: 'preview-dept-product',
        department_name: 'Executive Council',
        project_id: 'preview-project-onboarding',
        project_name: 'A calmer onboarding',
        payload: { unanimous: true },
        timestamp: now,
      },
      {
        id: 'ev-seed-11',
        company_id: companyId,
        event_type: 'evolution_proposed',
        severity: 'MEDIUM',
        title: 'Self-Improvement: Add Dedicated API Reliability Agent',
        summary: 'Evolution Engine detected repeated provider dropouts and proposed autonomous recovery agent.',
        agent_id: 'preview-agent-eli',
        agent_name: 'Evolution Engine',
        department_id: 'preview-dept-intelligence',
        department_name: 'Intelligence & Research',
        project_id: 'preview-project-onboarding',
        project_name: 'Autonomous Evolution',
        payload: { risk: 'LOW' },
        timestamp: now,
      },
      {
        id: 'ev-seed-12',
        company_id: companyId,
        event_type: 'simulation_completed',
        severity: 'INFO',
        title: 'Monte Carlo Sandbox Experiment completed',
        summary: 'Simulation Lab finished 10,000 synthetic task executions.',
        agent_id: 'preview-agent-sora',
        agent_name: 'Simulation Sandbox',
        department_id: 'preview-dept-intelligence',
        department_name: 'Intelligence & Research',
        project_id: 'preview-project-onboarding',
        project_name: 'Autonomous Evolution',
        payload: { iterations: 10000 },
        timestamp: now,
      },
      {
        id: 'ev-seed-13',
        company_id: companyId,
        event_type: 'workflow_completed',
        severity: 'INFO',
        title: 'Workflow "Quarterly Compliance Verification" completed',
        summary: 'Automated verification workflow confirmed all 42 agents conform to constitutional level 3 autonomy.',
        agent_id: 'preview-agent-eli',
        agent_name: 'Governance Guardian',
        department_id: 'preview-dept-product',
        department_name: 'Governance & Compliance',
        project_id: 'preview-project-onboarding',
        project_name: 'Zero-Trust Audit Vault',
        payload: { checks_passed: 42 },
        timestamp: now,
      },
      {
        id: 'ev-seed-14',
        company_id: companyId,
        event_type: 'agent_completed',
        severity: 'INFO',
        title: 'Sentinel Security Agent completed scheduled sweep',
        summary: 'Agent finalized vulnerability sweep: 0 critical vulnerabilities found.',
        agent_id: 'preview-agent-sora',
        agent_name: 'Sentinel Agent',
        department_id: 'preview-dept-product',
        department_name: 'Security Operations',
        project_id: 'preview-project-onboarding',
        project_name: 'Infrastructure Hardening',
        payload: { status: 'CLEAN' },
        timestamp: now,
      },
    ];
  }
  return undefined;
}
