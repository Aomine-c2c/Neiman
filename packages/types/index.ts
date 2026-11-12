/**
 * NEIMAN Universal Domain Contracts & Models
 * Shared across Next.js Web, Tauri Desktop, and Terminal UI.
 */

// ============================================================================
// 1. ORGANIZATIONS & TEAMS
// ============================================================================
export interface OrganizationalDNA {
  operating_philosophy?: string;
  innovation_level?: string;
  autonomy_level?: string;
  risk_tolerance?: string;
  quality_threshold?: string;
  decision_style?: string;
  communication_style?: string;
  resource_strategy?: string;
}

export interface OrganizationCompany {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  mission?: string | null;
  vision?: string | null;
  industry?: string | null;
  status: string;
  owner_id: string;
  dna?: OrganizationalDNA;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  company_id: string;
  name: string;
  purpose?: string | null;
  status: string;
  parent_id?: string | null;
  manager_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrgRole {
  id: string;
  department_id: string;
  company_id: string;
  title: string;
  responsibilities: string[];
  capabilities: string[];
  authority: string;
  required_skills: string[];
  autonomy_level: string;
  created_at: string;
  updated_at: string;
}

export interface CompanyMember {
  id: string;
  company_id: string;
  user_id: string;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// 2. AGENTS & WORKFORCE
// ============================================================================
export interface AgentIdentity {
  persona?: string;
  avatar_url?: string;
  accent_color?: string;
  motto?: string;
  [key: string]: unknown;
}

export interface Agent {
  id: string;
  company_id: string;
  role_id?: string | null;
  department_id?: string | null;
  manager_agent_id?: string | null;
  name: string;
  identity: AgentIdentity;
  system_instructions?: string | null;
  responsibilities: string[];
  goals: string[];
  capabilities: string[];
  permissions: Record<string, unknown>;
  tools: unknown[];
  autonomy: string;
  status: string;
  intelligence_config: Record<string, unknown>;
  resource_limits: Record<string, unknown>;
  resource_usage: Record<string, unknown>;
  performance_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AgentCommunication {
  id: string;
  company_id: string;
  from_agent_id: string;
  to_agent_id?: string | null;
  task_id?: string | null;
  message_type: string;
  subject: string;
  body: string;
  payload: Record<string, unknown>;
  is_read: boolean;
  resolved: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// 3. PROJECTS & TASKS
// ============================================================================
export type ProjectStatus = 'PLANNING' | 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TaskStatus = 'BACKLOG' | 'TODO' | 'PENDING' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE' | 'COMPLETED' | 'CANCELLED' | 'BLOCKED';

export interface Milestone {
  title: string;
  description?: string | null;
  due_date?: string | null;
  completed: boolean;
}

export interface Project {
  id: string;
  company_id: string;
  owner_id?: string;
  name: string;
  objective?: string | null;
  description?: string | null;
  priority?: TaskPriority | null;
  status: ProjectStatus;
  milestones?: Milestone[];
  deadline?: string | null;
  start_date?: string | null;
  target_date?: string | null;
  budget?: number | null;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  company_id?: string;
  assigned_agent_id?: string | null;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  context_data?: Record<string, unknown>;
  result_data?: Record<string, unknown>;
  parent_task_id?: string | null;
  estimated_complexity?: number | null;
  actual_tokens_consumed?: number | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// 4. WORKFLOWS & EXECUTION
// ============================================================================
export type WorkflowTriggerType = 'MANUAL' | 'SCHEDULE' | 'EVENT' | 'WEBHOOK' | 'AGENT';
export type WorkflowStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
export type WorkflowExecutionStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'WAITING_APPROVAL'
  | 'WAITING_RETRY'
  | 'WAITING_RESOURCE'
  | 'ESCALATED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'TIMED_OUT';

export type WorkflowNodeType =
  | 'TRIGGER'
  | 'AGENT'
  | 'TASK'
  | 'TOOL'
  | 'CONDITION'
  | 'PARALLEL'
  | 'APPROVAL'
  | 'HUMAN_REVIEW'
  | 'RESOURCE_REQUEST'
  | 'MODEL_SELECTION'
  | 'DELAY'
  | 'WEBHOOK'
  | 'ESCALATION'
  | 'VALIDATION'
  | 'SUCCESS'
  | 'FAILURE';

export interface WorkflowNodePosition {
  x: number;
  y: number;
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: WorkflowNodeType | string;
  config: Record<string, unknown>;
  next_step_id?: string;
  next_step_ids?: string[];
  position?: WorkflowNodePosition;
  condition?: {
    expression: string;
    true_step?: string;
    false_step?: string;
  };
}

export interface Workflow {
  id: string;
  company_id: string;
  name: string;
  description?: string | null;
  trigger_type: WorkflowTriggerType;
  trigger_config: Record<string, unknown>;
  steps: WorkflowStep[];
  agents: string[];
  tools: string[];
  conditions: Array<Record<string, unknown>>;
  approvals: Record<string, unknown>;
  completion_criteria: Record<string, unknown>;
  status: WorkflowStatus;
  created_at: string;
  updated_at: string;
}

export interface WorkflowExecution {
  id: string;
  workflow_id: string;
  company_id: string;
  triggered_by_user_id?: string | null;
  triggered_by_agent_id?: string | null;
  title: string;
  status: WorkflowExecutionStatus;
  current_step_id?: string | null;
  current_step_name?: string | null;
  current_step_index: number;
  total_steps: number;
  input_payload: Record<string, unknown>;
  state_payload: Record<string, unknown>;
  output_payload?: Record<string, unknown> | null;
  error_details?: Record<string, unknown> | null;
  retries_count: number;
  max_retries: number;
  timeout_seconds: number;
  duration_ms?: number | null;
  pending_approval_id?: string | null;
  step_records?: Array<Record<string, unknown>>;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// 5. RESOURCES & BUDGETS
// ============================================================================
export type ResourceCategory = 'COMPUTE' | 'INTELLIGENCE' | 'FINANCIAL' | 'OPERATIONAL';
export type ResourcePriority = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW' | 'BACKGROUND';
export type ResourceEvaluationDecision = 'APPROVE' | 'DENY' | 'DEFER' | 'REDUCE' | 'QUEUE';

export interface ResourcePool {
  id: string;
  company_id: string;
  name: string;
  category: ResourceCategory;
  description?: string | null;
  total_capacity: number;
  unit: string;
  allocated_capacity: number;
  observed_usage: number;
  available_capacity: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ResourceBudget {
  id: string;
  company_id: string;
  department_id?: string | null;
  project_id?: string | null;
  name: string;
  fiscal_period: string;
  total_budget_usd: number;
  spent_budget_usd: number;
  remaining_budget_usd: number;
  total_token_allowance: number;
  consumed_tokens: number;
  remaining_tokens: number;
  alert_threshold_percent: number;
  is_exhausted: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// 6. INTELLIGENCE & MODELS
// ============================================================================
export interface ModelProvider {
  id: string;
  name: string;
  display_name: string;
  description?: string | null;
  website_url?: string | null;
  is_local: boolean;
  is_active: boolean;
  is_healthy: boolean;
  consecutive_failures: number;
  created_at: string;
}

export interface Model {
  id: string;
  provider_id: string;
  model_identifier: string;
  display_name: string;
  description?: string | null;
  capabilities: string[];
  modalities: string[];
  context_capacity: number;
  max_output_tokens?: number;
  supports_tools?: boolean;
  supports_structured_output?: boolean;
  input_cost_per_million: number;
  output_cost_per_million: number;
  avg_latency_ms: number;
  availability_rate?: number;
  privacy_classification: string;
  is_active: boolean;
  created_at: string;
}

export interface ModelRoutingPolicy {
  id: string;
  company_id: string;
  name: string;
  description?: string | null;
  routing_mode?: string;
  preferred_provider?: string | null;
  fallback_provider?: string | null;
  strategy: 'BALANCED' | 'LOWEST_COST' | 'LOWEST_LATENCY' | 'HIGHEST_CAPABILITY' | 'STRICT_PRIVACY';
  max_cost_per_query_usd: number;
  max_acceptable_latency_ms: number;
  required_privacy_level?: string | null;
  required_capability?: string | null;
  fallback_chain: string[];
  capability_preferences: Record<string, string>;
  is_default: boolean;
  created_at: string;
}

// ============================================================================
// 7. GOVERNANCE & CONSTITUTION
// ============================================================================
export type GovernanceRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';

export interface CompanyConstitution {
  id: string;
  company_id: string;
  version: number;
  is_active: boolean;
  mission: string;
  values: string[];
  operating_principles: string[];
  prohibited_actions: string[];
  approval_requirements: string[];
  security_rules: string[];
  financial_rules: string[];
  data_rules: string[];
  autonomy_boundaries: Record<string, unknown>;
  escalation_rules: string[];
  established_by?: string | null;
  amendment_notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApprovalRequest {
  id: string;
  company_id: string;
  agent_id?: string | null;
  task_id?: string | null;
  title: string;
  action?: string;
  target?: string;
  risk_level: GovernanceRiskLevel;
  proposed_payload?: Record<string, unknown>;
  reason: string;
  status: ApprovalStatus;
  reviewer_user_id?: string | null;
  reviewer_notes?: string | null;
  resolved_at?: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// 8. MEMORY & DECISIONS
// ============================================================================
export type MemoryDomain =
  | 'COMPANY'
  | 'DEPARTMENT'
  | 'AGENT'
  | 'PROJECT'
  | 'CUSTOMER'
  | 'DECISION'
  | 'POLICY'
  | 'EXPERIMENT'
  | 'FAILURE'
  | 'KNOWLEDGE_BASE'
  | 'DOCUMENT'
  | 'LESSON';

export type MemoryScope = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED' | 'PRIVATE';

export interface MemoryItem {
  id: string;
  company_id: string;
  domain: MemoryDomain;
  scope: MemoryScope;
  title: string;
  content: string;
  summary?: string | null;
  department_id?: string | null;
  agent_id?: string | null;
  project_id?: string | null;
  task_id?: string | null;
  provenance_type: string;
  source: string;
  owner_id?: string | null;
  confidence: number;
  relevance_score: number;
  access_count: number;
  last_accessed_at?: string | null;
  required_permissions: string[];
  retention_policy: string;
  is_archived: boolean;
  tags: string[];
  extra_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DecisionRecord {
  id: string;
  company_id: string;
  title: string;
  problem: string;
  proposals: Array<Record<string, unknown>>;
  evidence: Array<Record<string, unknown>>;
  participants: Array<Record<string, unknown>>;
  decision: string | null;
  rationale: string | null;
  expected_outcome: string | null;
  actual_outcome: string | null;
  status: string;
  decided_at: string | null;
  decided_by_id: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// 9. EVOLUTION & SIMULATION
// ============================================================================
export type AdaptationType =
  | 'CHANGE_AGENT_CONFIG'
  | 'CHANGE_SYSTEM_PROMPT'
  | 'CHANGE_MODEL_PROVIDER'
  | 'CHANGE_MODEL_ROUTING'
  | 'CREATE_SPECIALIZATION'
  | 'CREATE_NEW_AGENT'
  | 'RETIRE_AGENT'
  | 'MODIFY_WORKFLOW'
  | 'MODIFY_RESOURCE_ALLOCATION'
  | 'CREATE_TEMPORARY_DEPARTMENT'
  | 'MODIFY_STRATEGY'
  | 'PROPOSE_POLICY_CHANGES';

export type AdaptationStatus =
  | 'PROPOSED'
  | 'SIMULATING'
  | 'SIMULATED'
  | 'VALIDATED'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'DEPLOYED'
  | 'MONITORING'
  | 'ROLLED_BACK'
  | 'SUCCESSFUL';

export interface EvolutionProposal {
  id: string;
  company_id: string;
  title: string;
  adaptation_type: AdaptationType;
  rationale: string;
  expected_benefits: string[];
  potential_risks: string[];
  status: AdaptationStatus;
  risk_level: GovernanceRiskLevel;
  evidence_metrics?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
