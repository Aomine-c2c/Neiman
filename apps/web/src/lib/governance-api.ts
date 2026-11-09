import { z } from 'zod';

// Governance Types
export const AutonomyLevelSchema = z.enum([
  'OBSERVE',      // 0 - Observe only, no action
  'RECOMMEND',    // 1 - Can recommend actions
  'APPROVAL',     // 2 - Requires approval before execution
  'POLICY',       // 3 - Governed by policy rules
  'AUTONOMOUS',   // 4 - Fully autonomous within scope
  'ADAPTIVE',     // 5 - Self-governing with learning
]);

export const ActionResultSchema = z.enum([
  'ALLOWED',
  'PROHIBITED',
  'REQUIRES_APPROVAL',
]);

export const ApprovalStatusSchema = z.enum([
  'PENDING',
  'APPROVED',
  'REJECTED',
  'ESCALATED',
  'EXPIRED',
]);

export const EscalationStatusSchema = z.enum([
  'OPEN',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
]);

// Constitution
export const CompanyConstitutionResponseSchema = z.object({
  id: z.string().uuid(),
  company_id: z.string().uuid(),
  charter: z.string(),
  rules: z.string(),
  boundaries: z.string(),
  principles: z.string(),
  version: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const CompanyConstitutionUpdateSchema = z.object({
  charter: z.string().optional(),
  rules: z.string().optional(),
  boundaries: z.string().optional(),
  principles: z.string().optional(),
});

// Autonomy Configuration
export const AutonomyConfigCreateSchema = z.object({
  scope_type: z.enum(['COMPANY', 'DEPARTMENT', 'ROLE', 'AGENT', 'TOOL', 'ACTION']),
  scope_id: z.string().uuid().optional(),
  autonomy_level: AutonomyLevelSchema,
  allowed_actions: z.array(z.string()).default([]),
  prohibited_actions: z.array(z.string()).default([]),
  requires_approval_for: z.array(z.string()).default([]),
  policy_rules: z.record(z.unknown()).default({}),
  is_active: z.boolean().default(true),
  priority: z.number().default(0),
});

export const AutonomyConfigResponseSchema = z.object({
  id: z.string().uuid(),
  company_id: z.string().uuid(),
  scope_type: z.string(),
  scope_id: z.string().uuid().nullable(),
  autonomy_level: z.string(),
  allowed_actions: z.array(z.string()),
  prohibited_actions: z.array(z.string()),
  requires_approval_for: z.array(z.string()),
  policy_rules: z.record(z.unknown()),
  is_active: z.boolean(),
  priority: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});

// Action Evaluation
export const GovernanceActionEvaluationRequestSchema = z.object({
  actor_id: z.string().uuid(),
  actor_type: z.enum(['USER', 'AGENT', 'WORKFLOW', 'COUNCIL']),
  action: z.string(),
  target: z.string().optional(),
  context: z.record(z.unknown()).default({}),
  department_id: z.string().uuid().optional(),
  agent_id: z.string().uuid().optional(),
});

export const GovernanceActionEvaluationResponseSchema = z.object({
  result: ActionResultSchema,
  autonomy_level: z.string(),
  matched_config_id: z.string().uuid().nullable(),
  reason: z.string(),
  requires_approval: z.boolean(),
  approval_request_id: z.string().uuid().nullable(),
  blocked_reason: z.string().nullable(),
});

// Approvals
export const ApprovalDecisionUpdateSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  comments: z.string().optional(),
});

export const ApprovalRequestResponseSchema = z.object({
  id: z.string().uuid(),
  company_id: z.string().uuid(),
  requester_id: z.string().uuid(),
  requester_type: z.string(),
  action: z.string(),
  target: z.string().nullable(),
  context: z.record(z.unknown()),
  status: z.string(),
  required_approvers: z.array(z.string()),
  decisions: z.array(z.record(z.unknown())).default([]),
  created_at: z.string(),
  updated_at: z.string(),
  decided_at: z.string().nullable(),
  decided_by: z.string().uuid().nullable(),
});

// Escalations
export const EscalationRecordCreateSchema = z.object({
  source_type: z.enum(['AGENT', 'WORKFLOW', 'COUNCIL', 'HUMAN']),
  source_id: z.string().uuid(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  title: z.string().max(255),
  description: z.string(),
  related_action: z.string().optional(),
  related_approval_id: z.string().uuid().nullable(),
});

export const EscalationResolutionUpdateSchema = z.object({
  resolution: z.string(),
  status: z.enum(['RESOLVED', 'CLOSED']),
});

export const EscalationRecordResponseSchema = z.object({
  id: z.string().uuid(),
  company_id: z.string().uuid(),
  source_type: z.string(),
  source_id: z.string().uuid(),
  severity: z.string(),
  title: z.string(),
  description: z.string(),
  related_action: z.string().nullable(),
  related_approval_id: z.string().uuid().nullable(),
  status: z.string(),
  resolved_by: z.string().uuid().nullable(),
  resolution: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  resolved_at: z.string().nullable(),
});

// Audit Logs
export const GovernanceAuditLogCreateSchema = z.object({
  actor_id: z.string().uuid(),
  actor_type: z.enum(['USER', 'AGENT', 'WORKFLOW', 'COUNCIL']),
  action: z.string(),
  target: z.string().nullable(),
  reason: z.string().nullable(),
  result: z.string(),
  autonomy_level: z.string(),
  context: z.record(z.unknown()).default({}),
  department_id: z.string().uuid().nullable(),
  agent_id: z.string().uuid().nullable(),
});

export const GovernanceAuditLogResponseSchema = z.object({
  id: z.string().uuid(),
  company_id: z.string().uuid(),
  actor_id: z.string().uuid(),
  actor_type: z.string(),
  action: z.string(),
  target: z.string().nullable(),
  reason: z.string().nullable(),
  result: z.string(),
  autonomy_level: z.string(),
  context: z.record(z.unknown()),
  department_id: z.string().uuid().nullable(),
  agent_id: z.string().uuid().nullable(),
  created_at: z.string(),
});

export type AutonomyLevel = z.infer<typeof AutonomyLevelSchema>;
export type ActionResult = z.infer<typeof ActionResultSchema>;
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;
export type EscalationStatus = z.infer<typeof EscalationStatusSchema>;
export type CompanyConstitutionResponse = z.infer<typeof CompanyConstitutionResponseSchema>;
export type CompanyConstitutionUpdate = z.infer<typeof CompanyConstitutionUpdateSchema>;
export type AutonomyConfigCreate = z.infer<typeof AutonomyConfigCreateSchema>;
export type AutonomyConfigResponse = z.infer<typeof AutonomyConfigResponseSchema>;
export type GovernanceActionEvaluationRequest = z.infer<typeof GovernanceActionEvaluationRequestSchema>;
export type GovernanceActionEvaluationResponse = z.infer<typeof GovernanceActionEvaluationResponseSchema>;
export type ApprovalDecisionUpdate = z.infer<typeof ApprovalDecisionUpdateSchema>;
export type ApprovalRequestResponse = z.infer<typeof ApprovalRequestResponseSchema>;
export type EscalationRecordCreate = z.infer<typeof EscalationRecordCreateSchema>;
export type EscalationResolutionUpdate = z.infer<typeof EscalationResolutionUpdateSchema>;
export type EscalationRecordResponse = z.infer<typeof EscalationRecordResponseSchema>;
export type GovernanceAuditLogCreate = z.infer<typeof GovernanceAuditLogCreateSchema>;
export type GovernanceAuditLogResponse = z.infer<typeof GovernanceAuditLogResponseSchema>;

// Governance API
export function createGovernanceApi(client: ReturnType<typeof import('./api').createApiClient>) {
  return {
    getConstitution: (companyId: string) => 
      client.get<CompanyConstitutionResponse>(`/companies/${companyId}/governance/constitution`),
    updateConstitution: (companyId: string, data: CompanyConstitutionUpdate) => 
      client.patch<CompanyConstitutionResponse>(`/companies/${companyId}/governance/constitution`, data),
    listAutonomyConfigs: (companyId: string) => 
      client.get<AutonomyConfigResponse[]>(`/companies/${companyId}/governance/autonomy-configs`),
    createAutonomyConfig: (companyId: string, data: AutonomyConfigCreate) => 
      client.post<AutonomyConfigResponse>(`/companies/${companyId}/governance/autonomy-configs`, data),
    evaluateAction: (companyId: string, data: GovernanceActionEvaluationRequest) => 
      client.post<GovernanceActionEvaluationResponse>(`/companies/${companyId}/governance/evaluate-action`, data),
    listApprovals: (companyId: string, status?: string) => {
      const search = new URLSearchParams();
      if (status) search.set('status', status);
      return client.get<ApprovalRequestResponse[]>(`/companies/${companyId}/governance/approvals?${search.toString()}`);
    },
    decideApproval: (companyId: string, requestId: string, data: ApprovalDecisionUpdate) => 
      client.post<ApprovalRequestResponse>(`/companies/${companyId}/governance/approvals/${requestId}/decision`, data),
    listEscalations: (companyId: string, status?: string) => {
      const search = new URLSearchParams();
      if (status) search.set('status', status);
      return client.get<EscalationRecordResponse[]>(`/companies/${companyId}/governance/escalations?${search.toString()}`);
    },
    createEscalation: (companyId: string, data: EscalationRecordCreate) => 
      client.post<EscalationRecordResponse>(`/companies/${companyId}/governance/escalations`, data),
    resolveEscalation: (companyId: string, escalationId: string, data: EscalationResolutionUpdate) => 
      client.post<EscalationRecordResponse>(`/companies/${companyId}/governance/escalations/${escalationId}/resolve`, data),
    queryAudits: (companyId: string, params?: {
      actor_id?: string;
      action?: string;
      result?: string;
      target_q?: string;
      limit?: number;
    }) => {
      const search = new URLSearchParams();
      if (params?.actor_id) search.set('actor_id', params.actor_id);
      if (params?.action) search.set('action', params.action);
      if (params?.result) search.set('result', params.result);
      if (params?.target_q) search.set('target_q', params.target_q);
      if (params?.limit) search.set('limit', params.limit.toString());
      return client.get<GovernanceAuditLogResponse[]>(`/companies/${companyId}/governance/audits?${search.toString()}`);
    },
    recordAudit: (companyId: string, data: GovernanceAuditLogCreate) => 
      client.post<GovernanceAuditLogResponse>(`/companies/${companyId}/governance/audits`, data),
  };
}