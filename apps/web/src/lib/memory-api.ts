import { z } from 'zod';

// Memory Domain Types
export const MemoryDomainSchema = z.enum([
  'COMPANY',
  'DEPARTMENT',
  'AGENT',
  'PROJECT',
  'CUSTOMER',
  'DECISION',
  'POLICY',
  'EXPERIMENT',
  'FAILURE',
  'KNOWLEDGE_BASE',
]);

export const MemoryScopeSchema = z.enum([
  'PUBLIC',
  'INTERNAL',
  'CONFIDENTIAL',
  'RESTRICTED',
  'PRIVATE',
]);

export const ProvenanceTypeSchema = z.enum([
  'HUMAN_INPUT',
  'AGENT_OUTPUT',
  'WORKFLOW_RESULT',
  'COUNCIL_DELIBERATION',
  'DECISION_RECORD',
  'EXTERNAL_SYNC',
  'INFERRED',
]);

export const RetentionPolicySchema = z.enum([
  'PERMANENT',
  'YEARS_7',
  'YEARS_3',
  'YEARS_1',
  'MONTHS_6',
  'MONTHS_1',
  'DAYS_30',
  'DAYS_7',
  'TEMPORARY',
]);

export const MemoryItemCreateSchema = z.object({
  domain: MemoryDomainSchema,
  scope: MemoryScopeSchema.default('INTERNAL'),
  title: z.string().max(255),
  content: z.string().min(1),
  summary: z.string().optional(),
  department_id: z.string().uuid().optional(),
  agent_id: z.string().uuid().optional(),
  project_id: z.string().uuid().optional(),
  task_id: z.string().uuid().optional(),
  provenance_type: ProvenanceTypeSchema.default('HUMAN_INPUT'),
  source: z.string().max(255).default('user_input'),
  confidence: z.number().min(0).max(1).default(1.0),
  relevance_score: z.number().min(0).default(1.0),
  required_permissions: z.array(z.string()).default([]),
  retention_policy: RetentionPolicySchema.default('PERMANENT'),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).default({}),
});

export const MemoryItemResponseSchema = z.object({
  id: z.string().uuid(),
  company_id: z.string().uuid(),
  domain: z.string(),
  scope: z.string(),
  title: z.string(),
  content: z.string(),
  summary: z.string().nullable(),
  department_id: z.string().uuid().nullable(),
  agent_id: z.string().uuid().nullable(),
  project_id: z.string().uuid().nullable(),
  task_id: z.string().uuid().nullable(),
  provenance_type: z.string(),
  source: z.string(),
  owner_id: z.string().uuid().nullable(),
  confidence: z.number(),
  relevance_score: z.number(),
  access_count: z.number(),
  last_accessed_at: z.string().nullable(),
  required_permissions: z.array(z.string()),
  retention_policy: z.string(),
  is_archived: z.boolean(),
  tags: z.array(z.string()),
  extra_metadata: z.record(z.unknown()),
  created_at: z.string(),
  updated_at: z.string(),
});

// Context Assembly
export const ContextAssemblyRequestSchema = z.object({
  task_objective: z.string().min(3),
  task_id: z.string().uuid().optional(),
  agent_id: z.string().uuid().optional(),
  department_id: z.string().uuid().optional(),
  project_id: z.string().uuid().optional(),
  target_domains: z.array(MemoryDomainSchema).optional(),
  caller_permissions: z.array(z.string()).default([]),
  caller_role: z.string().default('MEMBER'),
  max_context_tokens: z.number().min(100).max(32000).default(4000),
  max_items: z.number().min(1).max(20).default(5),
});

export const AssembledMemorySnippetSchema = z.object({
  memory_id: z.string().uuid(),
  domain: z.string(),
  title: z.string(),
  excerpt: z.string(),
  relevance_score: z.number(),
  confidence: z.number(),
  source: z.string(),
});

export const ContextAssemblyResponseSchema = z.object({
  task_objective: z.string(),
  total_memories_evaluated: z.number(),
  authorized_memories_selected: z.number(),
  estimated_context_tokens: z.number(),
  domains_consulted: z.array(z.string()),
  assembled_context_prompt: z.string(),
  snippets: z.array(AssembledMemorySnippetSchema),
});

// Decision Records
export const OptionConsideredSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  pros: z.array(z.string()).default([]),
  cons: z.array(z.string()).default([]),
  impact_score: z.number().min(1).max(10).default(5),
});

export const EvidenceItemSchema = z.object({
  source: z.string(),
  claim: z.string(),
  verified: z.boolean().default(true),
  url_or_ref: z.string().optional(),
});

export const DecisionParticipantSchema = z.object({
  name: z.string(),
  role: z.string(),
  identity_type: z.enum(['USER', 'AGENT']).default('AGENT'),
  stance: z.enum(['SUPPORT', 'OBJECT', 'NEUTRAL']).default('SUPPORT'),
});

export const DecisionRecordCreateSchema = z.object({
  title: z.string().max(255),
  problem: z.string().min(5),
  options: z.array(OptionConsideredSchema).default([]),
  evidence: z.array(EvidenceItemSchema).default([]),
  participants: z.array(DecisionParticipantSchema).default([]),
  decision: z.string().min(5),
  rationale: z.string().min(5),
  expected_outcome: z.string().min(5),
  actual_outcome: z.string().optional(),
  lessons_learned: z.array(z.string()).default([]),
  decided_by_agent_id: z.string().uuid().optional(),
});

export const DecisionRecordOutcomeUpdateSchema = z.object({
  actual_outcome: z.string().min(5),
  lessons_learned: z.array(z.string()).min(1),
});

export const DecisionRecordResponseSchema = z.object({
  id: z.string().uuid(),
  company_id: z.string().uuid(),
  title: z.string(),
  problem: z.string(),
  options: z.array(z.record(z.unknown())),
  evidence: z.array(z.record(z.unknown())),
  participants: z.array(z.record(z.unknown())),
  decision: z.string(),
  rationale: z.string(),
  expected_outcome: z.string(),
  actual_outcome: z.string().nullable(),
  lessons_learned: z.array(z.string()),
  decided_by_user_id: z.string().uuid().nullable(),
  decided_by_agent_id: z.string().uuid().nullable(),
  memory_item_id: z.string().uuid().nullable(),
  decided_at: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

// Search
export const MemorySearchQuerySchema = z.object({
  query: z.string().min(1),
  domain: MemoryDomainSchema.optional(),
  scope: MemoryScopeSchema.optional(),
  department_id: z.string().uuid().optional(),
  project_id: z.string().uuid().optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().min(1).max(100).default(20),
});

export type MemoryDomain = z.infer<typeof MemoryDomainSchema>;
export type MemoryScope = z.infer<typeof MemoryScopeSchema>;
export type ProvenanceType = z.infer<typeof ProvenanceTypeSchema>;
export type RetentionPolicy = z.infer<typeof RetentionPolicySchema>;
export type MemoryItemCreate = z.infer<typeof MemoryItemCreateSchema>;
export type MemoryItemResponse = z.infer<typeof MemoryItemResponseSchema>;
export type ContextAssemblyRequest = z.infer<typeof ContextAssemblyRequestSchema>;
export type ContextAssemblyResponse = z.infer<typeof ContextAssemblyResponseSchema>;
export type AssembledMemorySnippet = z.infer<typeof AssembledMemorySnippetSchema>;
export type OptionConsidered = z.infer<typeof OptionConsideredSchema>;
export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;
export type DecisionParticipant = z.infer<typeof DecisionParticipantSchema>;
export type DecisionRecordCreate = z.infer<typeof DecisionRecordCreateSchema>;
export type DecisionRecordOutcomeUpdate = z.infer<typeof DecisionRecordOutcomeUpdateSchema>;
export type DecisionRecordResponse = z.infer<typeof DecisionRecordResponseSchema>;
export type MemorySearchQuery = z.infer<typeof MemorySearchQuerySchema>;

// Memory API
export function createMemoryApi(client: ReturnType<typeof import('./api').createApiClient>) {
  return {
    listMemories: (companyId: string, params?: {
      domain?: string;
      scope?: string;
      department_id?: string;
      agent_id?: string;
      project_id?: string;
      limit?: number;
    }) => {
      const search = new URLSearchParams();
      if (params?.domain) search.set('domain', params.domain);
      if (params?.scope) search.set('scope', params.scope);
      if (params?.department_id) search.set('department_id', params.department_id);
      if (params?.agent_id) search.set('agent_id', params.agent_id);
      if (params?.project_id) search.set('project_id', params.project_id);
      if (params?.limit) search.set('limit', params.limit.toString());
      return client.get<MemoryItemResponse[]>(`/companies/${companyId}/memory/items?${search.toString()}`);
    },
    createMemory: (companyId: string, data: MemoryItemCreate) => 
      client.post<MemoryItemResponse>(`/companies/${companyId}/memory/items`, data),
    getMemory: (companyId: string, memoryId: string) => 
      client.get<MemoryItemResponse>(`/companies/${companyId}/memory/items/${memoryId}`),
    searchMemories: (companyId: string, query: string, params?: {
      domain?: string;
      scope?: string;
      limit?: number;
    }) => {
      const search = new URLSearchParams({ q: query });
      if (params?.domain) search.set('domain', params.domain);
      if (params?.scope) search.set('scope', params.scope);
      if (params?.limit) search.set('limit', params.limit.toString());
      return client.get<MemoryItemResponse[]>(`/companies/${companyId}/memory/search?${search.toString()}`);
    },
    assembleContext: (companyId: string, data: ContextAssemblyRequest) => 
      client.post<ContextAssemblyResponse>(`/companies/${companyId}/memory/assemble-context`, data),
    listDecisionRecords: (companyId: string, limit?: number) => {
      const search = new URLSearchParams();
      if (limit) search.set('limit', limit.toString());
      return client.get<DecisionRecordResponse[]>(`/companies/${companyId}/memory/decisions?${search.toString()}`);
    },
    createDecisionRecord: (companyId: string, data: DecisionRecordCreate) => 
      client.post<DecisionRecordResponse>(`/companies/${companyId}/memory/decisions`, data),
    recordDecisionOutcome: (companyId: string, decisionId: string, data: DecisionRecordOutcomeUpdate) => 
      client.post<DecisionRecordResponse>(`/companies/${companyId}/memory/decisions/${decisionId}/outcome`, data),
  };
}