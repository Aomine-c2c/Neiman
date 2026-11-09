import type { ActivityEvent } from '@neiman/events';
import type { NexoraCompany } from '@/store/auth';
import type { ControlRoomState } from './controlRoom';
import type { OrganizationalAdaptation } from './evolution';

/** Synthetic dashboard fixtures for local design review. Never persisted or written to an API. */
export const PREVIEW_COMPANY: NexoraCompany = {
  id: 'preview-company-NEIMAN',
  name: 'Northstar Studio',
  slug: 'northstar-studio-preview',
  description: 'Synthetic organization for local UI preview.',
  mission: 'Make complex work feel clear and human.',
  vision: 'A more thoughtful way to build useful things.',
  industry: 'Product & Research',
  status: 'ACTIVE',
  owner_id: 'preview-human-owner',
  created_at: '2026-09-01T09:00:00.000Z',
  updated_at: '2026-09-30T09:00:00.000Z',
};

const companyId = PREVIEW_COMPANY.id;
const at = '2026-09-30T09:00:00.000Z';
const identity = (title: string) => ({ title, avatar: null });

export const PREVIEW_ACTIVITY: ActivityEvent[] = [
  {
    id: 'preview-activity-analysis',
    company_id: companyId,
    event_type: 'agent_completed',
    severity: 'INFO',
    title: 'completed system analysis',
    summary: 'Architecture Agent completed system analysis.',
    agent_id: 'preview-agent-eli',
    agent_name: 'Architecture Agent',
    department_id: 'preview-dept-intelligence',
    department_name: 'Intelligence',
    project_id: 'preview-project-quality',
    project_name: 'Evidence-first answers',
    payload: {},
    timestamp: '2026-09-30T09:42:00.000Z',
  },
  {
    id: 'preview-activity-concern',
    company_id: companyId,
    event_type: 'task_failed',
    severity: 'HIGH',
    title: 'raised a concern',
    summary: 'Security Agent raised a concern.',
    agent_id: 'preview-agent-noah',
    agent_name: 'Security Agent',
    department_id: 'preview-dept-operations',
    department_name: 'Operations',
    project_id: 'preview-project-quality',
    project_name: 'Evidence-first answers',
    payload: { concern: 'Source coverage blocked evaluation' },
    timestamp: '2026-09-30T09:44:00.000Z',
  },
  {
    id: 'preview-activity-approval-request',
    company_id: companyId,
    event_type: 'approval_requested',
    severity: 'HIGH',
    title: 'requested approval',
    summary: 'CTO Agent requested approval.',
    agent_id: 'preview-agent-mara',
    agent_name: 'CTO Agent',
    department_id: 'preview-dept-product',
    department_name: 'Product Lab',
    project_id: 'preview-project-onboarding',
    project_name: 'A calmer onboarding',
    payload: { action: 'Send onboarding research brief' },
    timestamp: '2026-09-30T09:47:00.000Z',
  },
  {
    id: 'preview-activity-human-gate',
    company_id: companyId,
    event_type: 'approval_requested',
    severity: 'CRITICAL',
    title: 'Human approval required',
    summary: 'Human approval required.',
    agent_id: null,
    agent_name: null,
    department_id: null,
    department_name: null,
    project_id: 'preview-project-onboarding',
    project_name: 'A calmer onboarding',
    payload: { gate: 'external_communication' },
    timestamp: '2026-09-30T09:50:00.000Z',
  },
];

const PREVIEW_EVOLUTION: OrganizationalAdaptation[] = [
  {
    id: 'preview-adaptation-1',
    company_id: companyId,
    title: 'Route research workloads by evidence capability',
    adaptation_type: 'CHANGE_MODEL_ROUTING',
    stage: 'VALIDATE',
    status: 'PENDING_APPROVAL',
    trigger_diagnosis: 'Research tasks used a general route despite stronger long-context capability being available.',
    evidence: [{ sample_size: 48, finding: 'Source coverage improved in evaluation.' }],
    previous_state: { strategy: 'BALANCED' },
    proposed_state: { research: 'google/gemini-2.5-pro' },
    expected_improvement: 'Improve source coverage while keeping spend within the current budget.',
    risk_assessment: 'Low risk; staged routing with rollback available.',
    risk_level: 'LOW',
    simulation_results: { synthetic_runs: 30, latency_reduction_pct: 8, cost_savings_pct: 4, failure_rate_synthetic: 2.1 },
    validation_passed: true,
    snapshot_id: 'preview-snapshot-1',
    approved_by: null,
    deployed_at: null,
    actual_result: {},
    created_at: at,
    updated_at: at,
  },
];

export function getControlRoomPreviewState(): ControlRoomState {
  const departments = [
    { id: 'preview-dept-product', company_id: companyId, name: 'Product Lab', purpose: 'Shape useful, coherent product experiences.', status: 'ACTIVE', parent_id: null, manager_id: 'preview-agent-mara', created_at: at, updated_at: at },
    { id: 'preview-dept-intelligence', company_id: companyId, name: 'Intelligence', purpose: 'Research, synthesis, and model evaluation.', status: 'ACTIVE', parent_id: null, manager_id: 'preview-agent-eli', created_at: at, updated_at: at },
    { id: 'preview-dept-operations', company_id: companyId, name: 'Operations', purpose: 'Keep delivery safe, reliable, and on track.', status: 'ACTIVE', parent_id: null, manager_id: 'preview-agent-sora', created_at: at, updated_at: at },
  ];
  const roles = [
    { id: 'preview-role-lead', company_id: companyId, department_id: 'preview-dept-product', title: 'Product Lead', responsibilities: ['Prioritize outcomes', 'Coordinate delivery'], capabilities: ['planning', 'synthesis'], authority: 'PROPOSE', required_skills: ['product strategy'], autonomy_level: 'SUPERVISED', created_at: at, updated_at: at },
    { id: 'preview-role-researcher', company_id: companyId, department_id: 'preview-dept-intelligence', title: 'Research Analyst', responsibilities: ['Gather evidence', 'Record sources'], capabilities: ['research', 'analysis'], authority: 'PROPOSE', required_skills: ['research'], autonomy_level: 'SUPERVISED', created_at: at, updated_at: at },
    { id: 'preview-role-operator', company_id: companyId, department_id: 'preview-dept-operations', title: 'Operations Steward', responsibilities: ['Monitor delivery', 'Escalate risk'], capabilities: ['monitoring', 'risk review'], authority: 'RECOMMEND', required_skills: ['operations'], autonomy_level: 'SUPERVISED', created_at: at, updated_at: at },
  ];
  const agents = [
    { id: 'preview-agent-mara', company_id: companyId, role_id: 'preview-role-lead', department_id: 'preview-dept-product', manager_agent_id: null, name: 'Mara Chen', identity: identity('Product Lead'), system_instructions: null, responsibilities: ['Coordinate product work'], goals: ['Ship coherent experiences'], capabilities: ['planning', 'synthesis'], permissions: { approval_required: true }, tools: [], autonomy: 'SUPERVISED', status: 'WORKING', intelligence_config: { provider: 'anthropic', model: 'claude-sonnet' }, resource_limits: { daily_budget_usd: 8 }, resource_usage: { tokens: 12400 }, performance_metadata: {}, created_at: at, updated_at: at },
    { id: 'preview-agent-eli', company_id: companyId, role_id: 'preview-role-researcher', department_id: 'preview-dept-intelligence', manager_agent_id: 'preview-agent-mara', name: 'Eli Okafor', identity: identity('Research Analyst'), system_instructions: null, responsibilities: ['Synthesize research'], goals: ['Ground decisions in evidence'], capabilities: ['research', 'analysis'], permissions: { approval_required: true }, tools: [], autonomy: 'SUPERVISED', status: 'WORKING', intelligence_config: { provider: 'google', model: 'gemini-2.5-pro' }, resource_limits: { daily_budget_usd: 5 }, resource_usage: { tokens: 8700 }, performance_metadata: {}, created_at: at, updated_at: at },
    { id: 'preview-agent-sora', company_id: companyId, role_id: 'preview-role-operator', department_id: 'preview-dept-operations', manager_agent_id: 'preview-agent-mara', name: 'Sora Patel', identity: identity('Operations Steward'), system_instructions: null, responsibilities: ['Monitor operational health'], goals: ['Surface blockers early'], capabilities: ['monitoring', 'risk review'], permissions: { approval_required: true }, tools: [], autonomy: 'SUPERVISED', status: 'AVAILABLE', intelligence_config: { provider: 'openai', model: 'gpt-4.1' }, resource_limits: { daily_budget_usd: 4 }, resource_usage: { tokens: 5100 }, performance_metadata: {}, created_at: at, updated_at: at },
    { id: 'preview-agent-noah', company_id: companyId, role_id: 'preview-role-researcher', department_id: 'preview-dept-intelligence', manager_agent_id: 'preview-agent-eli', name: 'Noah Williams', identity: identity('Evaluation Specialist'), system_instructions: null, responsibilities: ['Evaluate model quality'], goals: ['Improve grounded answers'], capabilities: ['evaluation', 'testing'], permissions: { approval_required: true }, tools: [], autonomy: 'SUPERVISED', status: 'BLOCKED', intelligence_config: { provider: 'local', model: 'qwen3-8b' }, resource_limits: { daily_budget_usd: 2 }, resource_usage: { tokens: 3200 }, performance_metadata: {}, created_at: at, updated_at: at },
  ];
  const projects = [
    { id: 'preview-project-onboarding', company_id: companyId, owner_id: 'preview-human-owner', name: 'A calmer onboarding', objective: 'Reduce setup friction without hiding important choices.', status: 'ACTIVE' as const, priority: 'HIGH' as const, milestones: [{ title: 'Map first-run journey', completed: true }, { title: 'Test new setup flow', due_date: '2026-10-04T00:00:00.000Z', completed: false }], deadline: '2026-10-10T00:00:00.000Z', created_at: at, updated_at: at },
    { id: 'preview-project-quality', company_id: companyId, owner_id: 'preview-human-owner', name: 'Evidence-first answers', objective: 'Improve confidence and traceability in research summaries.', status: 'ACTIVE' as const, priority: 'MEDIUM' as const, milestones: [{ title: 'Define quality rubric', completed: true }, { title: 'Run evaluation set', due_date: '2026-10-07T00:00:00.000Z', completed: false }], deadline: '2026-10-14T00:00:00.000Z', created_at: at, updated_at: at },
    { id: 'preview-project-routing', company_id: companyId, owner_id: 'preview-human-owner', name: 'Provider routing study', objective: 'Compare latency, quality, and cost across providers.', status: 'ON_HOLD' as const, priority: 'LOW' as const, milestones: [], deadline: null, created_at: at, updated_at: at },
  ];
  const tasks = [
    { id: 'preview-task-journey', project_id: 'preview-project-onboarding', assigned_agent_id: 'preview-agent-mara', title: 'Review first-run journey', description: 'Identify confusing decisions in the setup flow.', status: 'IN_PROGRESS' as const, priority: 'HIGH' as const, created_at: at, updated_at: at },
    { id: 'preview-task-sources', project_id: 'preview-project-quality', assigned_agent_id: 'preview-agent-eli', title: 'Verify source coverage', description: 'Check citations across the research sample.', status: 'BLOCKED' as const, priority: 'CRITICAL' as const, created_at: at, updated_at: at },
    { id: 'preview-task-evaluation', project_id: 'preview-project-quality', assigned_agent_id: 'preview-agent-noah', title: 'Run answer quality set', status: 'PENDING' as const, priority: 'MEDIUM' as const, created_at: at, updated_at: at },
    { id: 'preview-task-inventory', project_id: 'preview-project-onboarding', assigned_agent_id: 'preview-agent-sora', title: 'Inventory setup requirements', status: 'COMPLETED' as const, priority: 'LOW' as const, created_at: at, updated_at: at },
  ];

  return {
    company_id: companyId,
    agents,
    departments,
    roles,
    projects,
    tasks,
    approvals: [{ id: 'preview-approval-email', company_id: companyId, agent_id: 'preview-agent-mara', task_id: 'preview-task-journey', action_type: 'Send onboarding research brief', target_resource: 'external_email', risk_level: 'HIGH', status: 'PENDING', reason: 'External communication needs a human review before it leaves the organization.', details: { preview: true }, created_at: at }],
    audits: [
      { id: 'preview-audit-1', company_id: companyId, actor_id: 'preview-agent-eli', actor_type: 'AGENT', action: 'Research synthesis completed', target: 'Evidence-first answers', result: 'Recorded with source links', created_at: at },
      { id: 'preview-audit-2', company_id: companyId, actor_id: 'preview-agent-noah', actor_type: 'AGENT', action: 'Evaluation paused', target: 'Answer quality set', reason: 'Waiting for source coverage review', result: 'Escalated for review', created_at: '2026-09-30T08:42:00.000Z' },
    ],
    resources: { compute_used_pct: 38, memory_used_gb: 6.4, memory_limit_gb: 16, token_usage_total: 29400, intelligence_cost_usd: 4.82, budget_allocated_usd: 120, budget_spent_usd: 38.65 },
    decisions: [
      { id: 'preview-decision-1', company_id: companyId, problem: 'How should setup defaults behave?', decision: 'Use recommended defaults and explain each choice.', status: 'DECIDED', rationale: 'People should move quickly while retaining informed control.', expected_outcome: 'Fewer abandoned setups', created_at: at },
      { id: 'preview-decision-2', company_id: companyId, problem: 'What evidence is required for research summaries?', decision: 'Require source links for material claims.', status: 'DELIBERATING', rationale: 'A sample review found inconsistent traceability.', created_at: '2026-09-30T08:40:00.000Z' },
    ],
    policies: [
      { id: 'preview-policy-1', company_id: companyId, name: 'Human review for external actions', scope: 'External communications', enforcement_level: 'REQUIRE_APPROVAL', is_active: true, created_at: at },
      { id: 'preview-policy-2', company_id: companyId, name: 'Source links for research claims', scope: 'Research and synthesis', enforcement_level: 'REQUIRE_EVIDENCE', is_active: true, created_at: at },
    ],
    memories: [
      { id: 'preview-memory-1', domain: 'organization', title: 'How we make decisions', content: 'Prefer reversible experiments, record the evidence, and ask a human before external commitments.', scope: 'company', created_at: at },
      { id: 'preview-memory-2', domain: 'product', title: 'Onboarding principle', content: 'Explain consequential choices in plain language at the moment they matter.', scope: 'department', created_at: at },
    ],
    providers: [
      { id: 'preview-provider-anthropic', name: 'Claude Sonnet', provider: 'anthropic', status: 'ONLINE', active_requests: 2, avg_latency_ms: 1180, total_tokens: 12800, cost_usd: 2.31 },
      { id: 'preview-provider-google', name: 'Gemini 2.5 Pro', provider: 'google', status: 'ONLINE', active_requests: 1, avg_latency_ms: 940, total_tokens: 9300, cost_usd: 1.42 },
      { id: 'preview-provider-local', name: 'Qwen 3 · Local', provider: 'local', status: 'DEGRADED', active_requests: 0, avg_latency_ms: 2210, total_tokens: 7300, cost_usd: 0 },
    ],
    activity: PREVIEW_ACTIVITY,
    evolutionProposals: PREVIEW_EVOLUTION,
    unavailableSections: [],
  };
}
