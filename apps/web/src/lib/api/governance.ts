/**
 * NEIMAN Organizational Governance API Client
 * Manages Company Constitution, Autonomy Matrix (Levels 0-5),
 * Action Evaluations, Approval Gates, Escalations, and Consequential Action Audit Logs.
 */

import { api } from './client';

export type GovernanceRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';
export type EscalationStatus = 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'DISMISSED';

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

export interface CompanyConstitutionUpdate {
  mission?: string;
  values?: string[];
  operating_principles?: string[];
  prohibited_actions?: string[];
  approval_requirements?: string[];
  security_rules?: string[];
  financial_rules?: string[];
  data_rules?: string[];
  autonomy_boundaries?: Record<string, unknown>;
  escalation_rules?: string[];
  amendment_notes?: string;
}

export interface AutonomyConfig {
  id: string;
  company_id: string;
  autonomy_level: number;
  risk_level: GovernanceRiskLevel;
  requires_explicit_approval: boolean;
  department_id?: string | null;
  role_id?: string | null;
  agent_id?: string | null;
  tool_name?: string | null;
  task_type?: string | null;
  action_name?: string | null;
  conditions: Record<string, unknown>;
  rationale?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutonomyConfigCreate {
  autonomy_level: number;
  risk_level?: GovernanceRiskLevel;
  requires_explicit_approval?: boolean;
  department_id?: string;
  role_id?: string;
  agent_id?: string;
  tool_name?: string;
  task_type?: string;
  action_name?: string;
  conditions?: Record<string, unknown>;
  rationale?: string;
}

export interface GovernanceActionEvaluationRequest {
  actor_id?: string;
  actor_name: string;
  actor_type?: string;
  department_id?: string;
  role_id?: string;
  agent_id?: string;
  tool_name?: string;
  task_type?: string;
  action_name: string;
  target: string;
  reason: string;
  payload?: Record<string, unknown>;
  declared_risk_level?: GovernanceRiskLevel;
}

export interface GovernanceActionEvaluationResponse {
  allowed: boolean;
  effective_autonomy_level: number;
  effective_autonomy_label: string;
  requires_approval: boolean;
  is_prohibited: boolean;
  matched_constitution_clause?: string | null;
  matched_config_id?: string | null;
  approval_request_id?: string | null;
  reason: string;
}

export interface ApprovalRequest {
  id: string;
  company_id: string;
  agent_id?: string | null;
  task_id?: string | null;
  title: string;
  action: string;
  target: string;
  risk_level: GovernanceRiskLevel;
  proposed_payload: Record<string, unknown>;
  reason: string;
  status: ApprovalStatus;
  reviewer_user_id?: string | null;
  reviewer_notes?: string | null;
  resolved_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApprovalDecisionUpdate {
  decision: 'APPROVED' | 'REJECTED';
  reviewer_notes?: string;
}

export interface EscalationRecord {
  id: string;
  company_id: string;
  agent_id?: string | null;
  task_id?: string | null;
  reason: string;
  description: string;
  severity: GovernanceRiskLevel;
  status: EscalationStatus;
  context_data: Record<string, unknown>;
  resolution?: string | null;
  resolved_by_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface EscalationRecordCreate {
  agent_id?: string;
  task_id?: string;
  reason: string;
  description: string;
  severity?: GovernanceRiskLevel;
  context_data?: Record<string, unknown>;
}

export interface EscalationResolutionUpdate {
  status: EscalationStatus;
  resolution: string;
}

export interface ApprovalDiffBlastRadiusResponse {
  approval_id: string;
  task_id?: string | null;
  title: string;
  action: string;
  target: string;
  risk_level: string;
  diff: string;
  files_touched: string[];
  ast_safety: {
    status: 'PASSED' | 'VIOLATION';
    is_safe: boolean;
    forbidden_calls_detected: string[];
    forbidden_imports_detected: string[];
    secrets_scrubbed: number;
    path_traversal_safe: boolean;
  };
  blast_radius: {
    tier: string;
    services_affected: string[];
    lines_added: number;
    lines_deleted: number;
    risk_score: number;
  };
}

export interface GovernanceAuditLog {
  id: string;
  company_id: string;
  execution_id?: string | null;
  actor_id?: string | null;
  actor_name: string;
  actor_type: string;
  authority: string;
  action: string;
  target: string;
  reason: string;
  result: string;
  autonomy_level: number;
  risk_level: GovernanceRiskLevel;
  details: Record<string, unknown>;
  created_at: string;
}

export interface SandboxExecutionSpec {
  command?: string;
  code?: string;
  language?: 'bash' | 'python';
  timeout_seconds?: number;
  allowed_directories?: string[];
  allowed_domains?: string[];
  environment_variables?: Record<string, string>;
  workspace_dir?: string;
}

export interface SandboxExecutionResult {
  execution_id: string;
  status: 'SUCCESS' | 'FAILED' | 'TIMED_OUT' | 'FORBIDDEN';
  exit_code: number;
  stdout: string;
  stderr: string;
  duration_ms: number;
  files_created: string[];
  security_checks_passed: boolean;
  violation_reason?: string | null;
}

export const governanceApi = {
  executeInSandbox: (
    companyId: string,
    spec: SandboxExecutionSpec
  ): Promise<SandboxExecutionResult> =>
    api.post<SandboxExecutionResult>(
      `/api/v1/companies/${companyId}/governance/sandbox/run`,
      spec
    ),

  getConstitution: (companyId: string): Promise<CompanyConstitution> =>
    api.get<CompanyConstitution>(`/api/v1/companies/${companyId}/governance/constitution`),

  updateConstitution: (
    companyId: string,
    data: CompanyConstitutionUpdate
  ): Promise<CompanyConstitution> =>
    api.patch<CompanyConstitution>(`/api/v1/companies/${companyId}/governance/constitution`, data),

  listAutonomyConfigs: (companyId: string): Promise<AutonomyConfig[]> =>
    api.get<AutonomyConfig[]>(`/api/v1/companies/${companyId}/governance/autonomy-configs`),

  createAutonomyConfig: (
    companyId: string,
    config: AutonomyConfigCreate
  ): Promise<AutonomyConfig> =>
    api.post<AutonomyConfig>(`/api/v1/companies/${companyId}/governance/autonomy-configs`, config),

  evaluateAction: (
    companyId: string,
    req: GovernanceActionEvaluationRequest
  ): Promise<GovernanceActionEvaluationResponse> =>
    api.post<GovernanceActionEvaluationResponse>(
      `/api/v1/companies/${companyId}/governance/evaluate-action`,
      req
    ),

  listApprovals: (companyId: string, status?: string): Promise<ApprovalRequest[]> => {
    const query = status ? `?status=${status}` : '';
    return api.get<ApprovalRequest[]>(`/api/v1/companies/${companyId}/governance/approvals${query}`);
  },

  decideApproval: (
    companyId: string,
    requestId: string,
    decision: ApprovalDecisionUpdate
  ): Promise<ApprovalRequest> =>
    api.post<ApprovalRequest>(
      `/api/v1/companies/${companyId}/governance/approvals/${requestId}/decision`,
      decision
    ),

  getApprovalDiff: (
    companyId: string,
    requestId: string
  ): Promise<ApprovalDiffBlastRadiusResponse> =>
    api.get<ApprovalDiffBlastRadiusResponse>(
      `/api/v1/companies/${companyId}/governance/approvals/${requestId}/diff`
    ),

  listEscalations: (companyId: string, status?: string): Promise<EscalationRecord[]> => {
    const query = status ? `?status=${status}` : '';
    return api.get<EscalationRecord[]>(`/api/v1/companies/${companyId}/governance/escalations${query}`);
  },

  createEscalation: (
    companyId: string,
    data: EscalationRecordCreate
  ): Promise<EscalationRecord> =>
    api.post<EscalationRecord>(`/api/v1/companies/${companyId}/governance/escalations`, data),

  resolveEscalation: (
    companyId: string,
    escalationId: string,
    data: EscalationResolutionUpdate
  ): Promise<EscalationRecord> =>
    api.post<EscalationRecord>(
      `/api/v1/companies/${companyId}/governance/escalations/${escalationId}/resolve`,
      data
    ),

  queryAudits: (
    companyId: string,
    params?: { action?: string; result?: string; target_q?: string; limit?: number }
  ): Promise<GovernanceAuditLog[]> => {
    const q = new URLSearchParams();
    if (params?.action) q.append('action', params.action);
    if (params?.result) q.append('result', params.result);
    if (params?.target_q) q.append('target_q', params.target_q);
    if (params?.limit) q.append('limit', params.limit.toString());
    const queryStr = q.toString() ? `?${q.toString()}` : '';
    return api.get<GovernanceAuditLog[]>(`/api/v1/companies/${companyId}/governance/audits${queryStr}`);
  },
};

