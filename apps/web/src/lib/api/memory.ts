/**
 * NEIMAN Organizational Memory API Client
 * Manages 10 memory domains, contextual assembly, permissions, and decision records.
 */

import { api } from './client';

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
export type ProvenanceType = 'HUMAN_INPUT' | 'AGENT_OBSERVATION' | 'SYSTEM_EVENT' | 'DOCUMENT_INGESTION' | 'COUNCIL_RESOLUTION';
export type RetentionPolicy = 'PERMANENT' | 'ONE_YEAR' | 'NINETY_DAYS' | 'THIRTY_DAYS' | 'EPHEMERAL';

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
  provenance_type: ProvenanceType;
  source: string;
  owner_id?: string | null;
  confidence: number;
  relevance_score: number;
  access_count: number;
  last_accessed_at?: string | null;
  required_permissions: string[];
  retention_policy: RetentionPolicy;
  is_archived: boolean;
  tags: string[];
  extra_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface MemoryItemCreate {
  domain: MemoryDomain;
  scope?: MemoryScope;
  title: string;
  content: string;
  summary?: string;
  department_id?: string;
  agent_id?: string;
  project_id?: string;
  task_id?: string;
  provenance_type?: ProvenanceType;
  source?: string;
  confidence?: number;
  relevance_score?: number;
  required_permissions?: string[];
  retention_policy?: RetentionPolicy;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface AssembledMemorySnippet {
  memory_id: string;
  domain: string;
  title: string;
  excerpt: string;
  relevance_score: number;
  confidence: number;
  source: string;
}

export interface ContextAssemblyRequest {
  task_objective: string;
  task_id?: string;
  agent_id?: string;
  department_id?: string;
  project_id?: string;
  target_domains?: MemoryDomain[];
  caller_permissions?: string[];
  caller_role?: string;
  max_context_tokens?: number;
  max_items?: number;
  compress_context?: boolean;
  compression_strategy?: 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE' | 'TRIPLETS';
}

export interface ContextAssemblyResponse {
  task_objective: string;
  total_memories_evaluated: number;
  authorized_memories_selected: number;
  estimated_context_tokens: number;
  domains_consulted: string[];
  assembled_context_prompt: string;
  snippets: AssembledMemorySnippet[];
  // Token Compression Telemetry
  compression_applied?: boolean;
  uncompressed_context_tokens?: number;
  tokens_saved?: number;
  compression_ratio_pct?: number;
}

export interface OptionConsidered {
  id?: string;
  title: string;
  description: string;
  pros?: string[];
  cons?: string[];
  impact_score?: number;
}

export interface EvidenceItem {
  source: string;
  claim: string;
  verified?: boolean;
  url_or_ref?: string;
}

export interface DecisionParticipant {
  name: string;
  role: string;
  identity_type?: 'USER' | 'AGENT';
  stance?: 'SUPPORT' | 'OBJECT' | 'NEUTRAL';
}

export interface DecisionRecord {
  id: string;
  company_id: string;
  title: string;
  problem: string;
  options: OptionConsidered[];
  evidence: EvidenceItem[];
  participants: DecisionParticipant[];
  decision: string;
  rationale: string;
  expected_outcome: string;
  actual_outcome?: string | null;
  lessons_learned: string[];
  decided_by_user_id?: string | null;
  decided_by_agent_id?: string | null;
  memory_item_id?: string | null;
  decided_at: string;
  created_at: string;
  updated_at: string;
}

export interface DecisionRecordCreate {
  title: string;
  problem: string;
  options?: OptionConsidered[];
  evidence?: EvidenceItem[];
  participants?: DecisionParticipant[];
  decision: string;
  rationale: string;
  expected_outcome: string;
  actual_outcome?: string;
  lessons_learned?: string[];
  decided_by_agent_id?: string;
}

export interface DecisionOutcomeUpdate {
  actual_outcome: string;
  lessons_learned: string[];
}

export const memoryApi = {
  listMemories: (
    companyId: string,
    params?: { domain?: string; scope?: string; limit?: number }
  ): Promise<MemoryItem[]> => {
    const q = new URLSearchParams();
    if (params?.domain) q.append('domain', params.domain);
    if (params?.scope) q.append('scope', params.scope);
    if (params?.limit) q.append('limit', params.limit.toString());
    const queryStr = q.toString() ? `?${q.toString()}` : '';
    return api.get<MemoryItem[]>(`/api/v1/companies/${companyId}/memory/items${queryStr}`);
  },

  createMemory: (companyId: string, item: MemoryItemCreate): Promise<MemoryItem> =>
    api.post<MemoryItem>(`/api/v1/companies/${companyId}/memory/items`, item),

  getMemory: (companyId: string, memoryId: string): Promise<MemoryItem> =>
    api.get<MemoryItem>(`/api/v1/companies/${companyId}/memory/items/${memoryId}`),

  search: (
    companyId: string,
    query: string,
    domain?: string,
    scope?: string
  ): Promise<MemoryItem[]> => {
    const q = new URLSearchParams({ q: query });
    if (domain) q.append('domain', domain);
    if (scope) q.append('scope', scope);
    return api.get<MemoryItem[]>(`/api/v1/companies/${companyId}/memory/search?${q.toString()}`);
  },

  assembleContext: (
    companyId: string,
    req: ContextAssemblyRequest
  ): Promise<ContextAssemblyResponse> =>
    api.post<ContextAssemblyResponse>(`/api/v1/companies/${companyId}/memory/assemble-context`, req),

  listDecisions: (companyId: string, limit: number = 50): Promise<DecisionRecord[]> =>
    api.get<DecisionRecord[]>(`/api/v1/companies/${companyId}/memory/decisions?limit=${limit}`),

  createDecision: (companyId: string, decision: DecisionRecordCreate): Promise<DecisionRecord> =>
    api.post<DecisionRecord>(`/api/v1/companies/${companyId}/memory/decisions`, decision),

  recordOutcome: (
    companyId: string,
    decisionId: string,
    outcome: DecisionOutcomeUpdate
  ): Promise<DecisionRecord> =>
    api.post<DecisionRecord>(`/api/v1/companies/${companyId}/memory/decisions/${decisionId}/outcome`, outcome),

  getKnowledgeGraph: (
    companyId: string,
    params?: { limit?: number; q?: string; entityType?: string }
  ): Promise<{
    entities: Array<{
      id: string;
      name: string;
      entity_type: string;
      description?: string;
      properties: Record<string, unknown>;
    }>;
    relations: Array<{
      id: string;
      source_id: string;
      target_id: string;
      relation_type: string;
      weight: number;
      provenance?: string;
    }>;
    total_entities: number;
    total_relations: number;
    query?: string | null;
    entity_type?: string | null;
  }> => {
    const qParams = new URLSearchParams();
    if (params?.limit) qParams.append('limit', String(params.limit));
    if (params?.q?.trim()) qParams.append('q', params.q.trim());
    if (params?.entityType && params.entityType !== 'ALL') qParams.append('entity_type', params.entityType);
    const queryStr = qParams.toString() ? `?${qParams.toString()}` : '';
    return api.get(`/api/v1/companies/${companyId}/memory/graph${queryStr}`);
  },

  extractKnowledgeFacts: (
    companyId: string,
    payload: { text: string; provenance?: string }
  ): Promise<{ status: string; facts_extracted: number }> =>
    api.post(`/api/v1/companies/${companyId}/memory/graph/extract`, payload),

  // ==========================================
  // MEMGPT HIERARCHICAL VIRTUAL MEMORY
  // ==========================================

  getMemGPTContext: (
    companyId: string,
    agentId: string
  ): Promise<MemGPTPromptContext> =>
    api.get<MemGPTPromptContext>(`/api/v1/companies/${companyId}/memory/agents/${agentId}/memgpt`),

  listCoreMemoryBlocks: (
    companyId: string,
    agentId: string
  ): Promise<CoreMemoryBlock[]> =>
    api.get<CoreMemoryBlock[]>(`/api/v1/companies/${companyId}/memory/agents/${agentId}/memgpt/blocks`),

  updateCoreMemoryBlock: (
    companyId: string,
    agentId: string,
    payload: { block_name: string; content: string; mode?: 'replace' | 'append' }
  ): Promise<CoreMemoryBlock> =>
    api.post<CoreMemoryBlock>(`/api/v1/companies/${companyId}/memory/agents/${agentId}/memgpt/blocks`, payload),

  appendRecallMessage: (
    companyId: string,
    agentId: string,
    payload: { role: string; message: string }
  ): Promise<{ status: string; log_id: string; is_evicted: boolean; estimated_tokens: number }> =>
    api.post(`/api/v1/companies/${companyId}/memory/agents/${agentId}/memgpt/recall`, payload),

  // ==========================================
  // GRAPHIFY & OBSIDIAN BIDIRECTIONAL GRAPH
  // ==========================================

  getGraphifyNetwork: (
    companyId: string
  ): Promise<GraphifyNetworkResponse> =>
    api.get<GraphifyNetworkResponse>(`/api/v1/companies/${companyId}/memory/graphify`),

  // ==========================================
  // CODEBASE AST KNOWLEDGE GRAPH (ZERO-GREP)
  // ==========================================

  getCodebaseGraphIndex: (
    companyId: string,
    params?: { force_refresh?: boolean; sync_db?: boolean }
  ): Promise<CodebaseGraphIndexSummary> => {
    const q = new URLSearchParams();
    if (params?.force_refresh) q.append('force_refresh', 'true');
    if (params?.sync_db) q.append('sync_db', 'true');
    const queryStr = q.toString() ? `?${q.toString()}` : '';
    return api.get<CodebaseGraphIndexSummary>(`/api/v1/companies/${companyId}/memory/code-graph/index${queryStr}`);
  },

  searchCodebaseSymbols: (
    companyId: string,
    query: string,
    limit: number = 25
  ): Promise<SymbolSearchResponse> =>
    api.get<SymbolSearchResponse>(
      `/api/v1/companies/${companyId}/memory/code-graph/symbols?q=${encodeURIComponent(query)}&limit=${limit}`
    ),

  reindexCodebase: (
    companyId: string,
    params?: { max_files?: number; sync_vector?: boolean }
  ): Promise<CodebaseGraphIndexSummary> => {
    const q = new URLSearchParams();
    if (params?.max_files) q.append('max_files', params.max_files.toString());
    if (params?.sync_vector !== undefined) q.append('sync_vector', params.sync_vector.toString());
    const queryStr = q.toString() ? `?${q.toString()}` : '';
    return api.post<CodebaseGraphIndexSummary>(
      `/api/v1/companies/${companyId}/memory/code-graph/reindex${queryStr}`,
      {}
    );
  },

  searchCodebaseHybrid: (
    companyId: string,
    query: string,
    limit: number = 25
  ): Promise<HybridSearchResponse> =>
    api.get<HybridSearchResponse>(
      `/api/v1/companies/${companyId}/memory/code-graph/hybrid?q=${encodeURIComponent(query)}&limit=${limit}`
    ),

  getCodebaseSubgraph: (
    companyId: string,
    symbolId: string,
    depth: number = 2
  ): Promise<CodebaseSubgraphResponse> =>
    api.get<CodebaseSubgraphResponse>(
      `/api/v1/companies/${companyId}/memory/code-graph/subgraph?symbol_id=${encodeURIComponent(symbolId)}&depth=${depth}`
    ),
};

export interface CoreMemoryBlock {
  id: string;
  agent_id: string;
  block_name: string;
  label: string;
  content: string;
  char_limit: number;
  is_read_only: boolean;
  updated_at: string;
}

export interface MemGPTPromptContext {
  agent_id: string;
  persona_block: string;
  human_block: string;
  scratchpad_block?: string | null;
  fifo_messages: Array<{
    role: string;
    content: string;
    tokens: number;
  }>;
  total_active_tokens: number;
  archived_memories_count: number;
}

export interface GraphifyNode {
  id: string;
  name: string;
  type: string;
  description?: string | null;
  degree: number;
  in_links: string[];
  out_links: string[];
}

export interface GraphifyEdge {
  source: string;
  target: string;
  relation: string;
  weight: number;
  provenance?: string | null;
}

export interface GraphifyNetworkResponse {
  nodes: GraphifyNode[];
  edges: GraphifyEdge[];
  total_nodes: number;
  total_edges: number;
  central_concepts: string[];
  vault_markdown_export: string;
}

export interface CodeSymbolNode {
  id: string;
  name: string;
  kind: 'MODULE' | 'CLASS' | 'FUNCTION' | 'METHOD' | 'INTERFACE' | 'ENDPOINT' | string;
  file_path: string;
  line_number?: number | null;
  docstring?: string | null;
  signature?: string | null;
  incoming_refs: string[];
  outgoing_refs: string[];
}

export interface CodebaseGraphIndexSummary {
  indexed_files: number;
  total_symbols: number;
  total_dependencies: number;
  files_by_language: Record<string, number>;
  symbols_by_kind: Record<string, number>;
  duration_ms: number;
  indexed_at: string;
  central_modules: string[];
}

export interface SymbolSearchResponse {
  query: string;
  total_matches: number;
  symbols: CodeSymbolNode[];
  callers: string[];
  callees: string[];
  related_files: string[];
}

export interface HybridSymbolMatch {
  id: string;
  name: string;
  kind: string;
  file_path: string;
  line_number?: number | null;
  signature?: string | null;
  docstring?: string | null;
  score: number;
  match_type: 'dense_vector' | 'exact_token' | 'topological_neighbor';
  callers: string[];
  callees: string[];
}

export interface HybridSearchResponse {
  query: string;
  total_matches: number;
  symbols: HybridSymbolMatch[];
  callers: string[];
  callees: string[];
  related_files: string[];
}

export interface SubgraphNode {
  id: string;
  name: string;
  kind: string;
  file_path: string;
  signature?: string | null;
  docstring?: string | null;
  is_root: boolean;
  distance: number;
}

export interface SubgraphEdge {
  source: string;
  target: string;
  relation: string;
}

export interface CodebaseSubgraphResponse {
  root_symbol_id: string;
  depth: number;
  nodes: SubgraphNode[];
  edges: SubgraphEdge[];
  total_nodes: number;
  total_edges: number;
}




