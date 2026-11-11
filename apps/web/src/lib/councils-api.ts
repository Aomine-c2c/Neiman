import { z } from 'zod';

// Council Types
export const CouncilTypeSchema = z.enum([
  'STRATEGIC',
  'ARCHITECTURAL',
  'OPERATIONAL',
  'CRISIS',
  'INNOVATION',
  'GOVERNANCE',
  'CUSTOM',
]);

export const DeliberationStageSchema = z.enum([
  'PROPOSAL',
  'INDEPENDENT_REVIEW',
  'OBJECTIONS',
  'DISCUSSION',
  'SYNTHESIS',
  'DECIDED',
  'ARCHIVED',
]);

// Council
export const AgentCouncilCreateSchema = z.object({
  name: z.string().min(1).max(255),
  charter: z.string().min(10),
  council_type: CouncilTypeSchema,
  synthesis_agent_id: z.string().uuid().optional(),
  members: z.array(z.object({
    agent_id: z.string().uuid(),
    role: z.string(),
    weight: z.number().min(0).max(1).default(1.0),
    can_propose: z.boolean().default(true),
    can_object: z.boolean().default(true),
    can_synthesize: z.boolean().default(false),
  })).min(2),
});

export const AgentCouncilResponseSchema = z.object({
  id: z.string().uuid(),
  company_id: z.string().uuid(),
  name: z.string(),
  charter: z.string(),
  council_type: z.string(),
  synthesis_agent_id: z.string().uuid().nullable(),
  members: z.array(z.object({
    agent_id: z.string().uuid(),
    role: z.string(),
    weight: z.number(),
    can_propose: z.boolean(),
    can_object: z.boolean(),
    can_synthesize: z.boolean(),
  })),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

// Deliberation
export const DeliberationCreateSchema = z.object({
  title: z.string().min(5).max(255),
  problem_statement: z.string().min(10),
  context_data: z.record(z.unknown()).default({}),
  initial_proposals: z.array(z.object({
    author_agent_id: z.string().uuid(),
    title: z.string(),
    content: z.string(),
    supporting_evidence: z.array(z.string()).default([]),
  })).default([]),
  auto_execute_deliberation: z.boolean().default(false),
});

export const CouncilDeliberationResponseSchema = z.object({
  id: z.string().uuid(),
  council_id: z.string().uuid(),
  company_id: z.string().uuid(),
  title: z.string(),
  problem_statement: z.string(),
  context_data: z.record(z.unknown()),
  stage: z.string(),
  initial_proposals: z.array(z.object({
    author_agent_id: z.string().uuid(),
    title: z.string(),
    content: z.string(),
    supporting_evidence: z.array(z.string()),
  })),
  reviews: z.array(z.object({
    reviewer_agent_id: z.string().uuid(),
    proposal_id: z.string().uuid(),
    assessment: z.string(),
    concerns: z.array(z.string()).default([]),
    recommendation: z.enum(['SUPPORT', 'MODIFY', 'REJECT']).default('SUPPORT'),
  })).default([]),
  objections: z.array(z.object({
    objector_agent_id: z.string().uuid(),
    target_proposal_id: z.string().uuid(),
    objection: z.string(),
    severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
    status: z.enum(['OPEN', 'ADDRESSED', 'WITHDRAWN', 'OVERRULED']),
    resolution: z.string().nullable(),
  })).default([]),
  discussion_threads: z.array(z.object({
    id: z.string().uuid(),
    topic: z.string(),
    messages: z.array(z.object({
      author_agent_id: z.string().uuid(),
      content: z.string(),
      created_at: z.string(),
    })),
  })).default([]),
  synthesis: z.object({
    synthesizer_agent_id: z.string().uuid(),
    synthesized_proposal: z.string(),
    rationale: z.string(),
    dissenting_opinions: z.array(z.object({
      agent_id: z.string().uuid(),
      objection: z.string(),
    })).default([]),
    confidence: z.number().min(0).max(1),
  }).nullable(),
  decision: z.object({
    decision_text: z.string(),
    rationale: z.string(),
    decided_by_user_id: z.string().uuid().nullable(),
    decided_at: z.string().nullable(),
    recorded_in_memory: z.boolean(),
  }).nullable(),
  auto_execute: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  completed_at: z.string().nullable(),
});

export const DeliberationDecisionRequestSchema = z.object({
  decision: z.string().min(5),
  rationale: z.string().min(5),
  record_in_memory: z.boolean().default(true),
});

export type CouncilType = z.infer<typeof CouncilTypeSchema>;
export type DeliberationStage = z.infer<typeof DeliberationStageSchema>;
export type AgentCouncilCreate = z.infer<typeof AgentCouncilCreateSchema>;
export type AgentCouncilResponse = z.infer<typeof AgentCouncilResponseSchema>;
export type DeliberationCreate = z.infer<typeof DeliberationCreateSchema>;
export type CouncilDeliberationResponse = z.infer<typeof CouncilDeliberationResponseSchema>;
export type DeliberationDecisionRequest = z.infer<typeof DeliberationDecisionRequestSchema>;

// Councils API
export function createCouncilsApi(client: ReturnType<typeof import('./api').createApiClient>) {
  return {
    createCouncil: (companyId: string, data: AgentCouncilCreate) => 
      client.post<AgentCouncilResponse>(`/companies/${companyId}/councils`, data),
    listCouncils: (companyId: string) => 
      client.get<AgentCouncilResponse[]>(`/companies/${companyId}/councils`),
    getCouncil: (companyId: string, councilId: string) => 
      client.get<AgentCouncilResponse>(`/companies/${companyId}/councils/${councilId}`),
    startDeliberation: (companyId: string, councilId: string, data: DeliberationCreate) => 
      client.post<CouncilDeliberationResponse>(`/companies/${companyId}/councils/${councilId}/deliberations`, data),
    getDeliberation: (companyId: string, deliberationId: string) => 
      client.get<CouncilDeliberationResponse>(`/companies/${companyId}/councils/deliberations/${deliberationId}`),
    listDeliberations: (companyId: string, councilId: string, limit?: number, offset?: number) => {
      const search = new URLSearchParams();
      if (limit) search.set('limit', limit.toString());
      if (offset) search.set('offset', offset.toString());
      return client.get<CouncilDeliberationResponse[]>(`/companies/${companyId}/councils/${councilId}/deliberations?${search.toString()}`);
    },
    ratifyDecision: (companyId: string, deliberationId: string, data: DeliberationDecisionRequest) => 
      client.post<CouncilDeliberationResponse>(`/companies/${companyId}/councils/deliberations/${deliberationId}/decide`, data),
  };
}