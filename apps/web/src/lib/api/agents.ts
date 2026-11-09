/**
 * NEIMAN Agents API
 */

import { api } from './client';

export interface Agent {
  id: string;
  company_id: string;
  role_id?: string | null;
  department_id?: string | null;
  manager_agent_id?: string | null;
  name: string;
  identity: Record<string, unknown>;
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

export interface CreateAgentRequest {
  name: string;
  system_instructions?: string;
  responsibilities?: string[];
  goals?: string[];
  capabilities?: string[];
  autonomy?: string;
  role_id?: string;
  department_id?: string;
  manager_agent_id?: string;
  intelligence_config?: Record<string, unknown>;
  resource_limits?: Record<string, unknown>;
  permissions?: Record<string, unknown>;
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

export interface AgentProfile {
  id: string;
  company_id: string;
  name: string;
  status: string;
  autonomy: string;
  role_title?: string | null;
  department_name?: string | null;
  manager_name?: string | null;
  manager_id?: string | null;
  identity: Record<string, unknown>;
  system_instructions?: string | null;
  responsibilities: string[];
  goals: string[];
  capabilities: string[];
  permissions: Record<string, unknown>;
  tools: Array<Record<string, unknown> | string>;
  intelligence_config: Record<string, unknown>;
  resource_limits: Record<string, unknown>;
  resource_usage: Record<string, unknown>;
  performance_metadata: Record<string, unknown>;
  current_task?: Record<string, unknown> | null;
  recent_communications: Array<{
    id: string;
    type: string;
    subject: string;
    from_agent_id: string;
    to_agent_id?: string | null;
    created_at: string;
  }>;
  recent_decisions: Array<Record<string, unknown>>;
  recent_audits: Array<{
    id: string;
    action: string;
    step?: string | null;
    status: string;
    created_at: string;
    details: Record<string, unknown>;
  }>;
  memories: Array<{
    id: string;
    type: string;
    key: string;
    content: string;
    importance: number;
  }>;
}

export interface TaskExecutionResult {
  execution_id: string;
  task_id: string;
  agent_id: string;
  final_status: string;
  steps: Array<{
    step: string;
    status: string;
    details: Record<string, unknown>;
    duration_ms: number;
  }>;
  result: Record<string, unknown>;
  tokens_consumed: number;
  cost_usd: number;
  total_duration_ms: number;
}

export const agentsApi = {
  list: (companyId: string) =>
    api.get<Agent[]>(`/api/v1/companies/${companyId}/agents`),

  get: (companyId: string, agentId: string) =>
    api.get<Agent>(`/api/v1/companies/${companyId}/agents/${agentId}`),

  getProfile: (companyId: string, agentId: string) =>
    api.get<AgentProfile>(`/api/v1/companies/${companyId}/agents/${agentId}/profile`),

  create: (companyId: string, body: CreateAgentRequest) =>
    api.post<Agent>(`/api/v1/companies/${companyId}/agents`, body),

  update: (companyId: string, agentId: string, body: Partial<CreateAgentRequest> & { status?: string }) =>
    api.patch<Agent>(`/api/v1/companies/${companyId}/agents/${agentId}`, body),

  transitionStatus: (companyId: string, agentId: string, status: string, reason?: string) =>
    api.post<Agent>(`/api/v1/companies/${companyId}/agents/${agentId}/transition`, { status, reason }),

  delete: (companyId: string, agentId: string) =>
    api.delete<void>(`/api/v1/companies/${companyId}/agents/${agentId}`),

  // Execution Engine
  executeTask: (
    companyId: string,
    agentId: string,
    body: { task_id: string; input_data?: Record<string, unknown>; override_model?: string }
  ) =>
    api.post<TaskExecutionResult>(
      `/api/v1/companies/${companyId}/agents/${agentId}/execute`,
      body
    ),

  // Audit Logs
  listAudits: (companyId: string, agentId: string) =>
    api.get<Array<{
      id: string;
      agent_id: string;
      action: string;
      step?: string | null;
      status: string;
      details: Record<string, unknown>;
      tokens_consumed: number;
      cost_usd: number;
      duration_ms: number;
      created_at: string;
    }>>(`/api/v1/companies/${companyId}/agents/${agentId}/audits`),

  // Communications & Collaboration
  listCommunications: (companyId: string, agentId: string) =>
    api.get<AgentCommunication[]>(
      `/api/v1/companies/${companyId}/agents/${agentId}/communications`
    ),

  sendMessage: (
    companyId: string,
    agentId: string,
    body: {
      to_agent_id?: string | null;
      message_type: string;
      subject: string;
      body: string;
      task_id?: string | null;
      payload?: Record<string, unknown>;
    }
  ) =>
    api.post<AgentCommunication>(
      `/api/v1/companies/${companyId}/agents/${agentId}/messages`,
      body
    ),

  delegateTask: (
    companyId: string,
    agentId: string,
    params: { to_agent_id: string; task_id: string; instructions?: string }
  ) =>
    api.post<AgentCommunication>(
      `/api/v1/companies/${companyId}/agents/${agentId}/delegate?to_agent_id=${params.to_agent_id}&task_id=${params.task_id}&instructions=${encodeURIComponent(params.instructions || 'Execute delegated task')}`
    ),

  escalateProblem: (
    companyId: string,
    agentId: string,
    params: { problem: string; task_id?: string | null }
  ) => {
    const qs = new URLSearchParams({ problem: params.problem });
    if (params.task_id) qs.set('task_id', params.task_id);
    return api.post<AgentCommunication>(
      `/api/v1/companies/${companyId}/agents/${agentId}/escalate?${qs.toString()}`
    );
  },

  // Memories
  listMemories: (companyId: string, agentId: string, memoryType?: string) => {
    const qs = memoryType ? `?memory_type=${encodeURIComponent(memoryType)}` : '';
    return api.get<Array<{
      id: string;
      agent_id: string;
      memory_type: string;
      key: string;
      content: string;
      metadata: Record<string, unknown>;
      importance: number;
      access_count: number;
      created_at: string;
    }>>(`/api/v1/companies/${companyId}/agents/${agentId}/memories${qs}`);
  },

  addMemory: (
    companyId: string,
    agentId: string,
    body: { memory_type?: string; key: string; content: string; metadata?: Record<string, unknown>; importance?: number }
  ) =>
    api.post(
      `/api/v1/companies/${companyId}/agents/${agentId}/memories`,
      body
    ),

  // Documentation Specialist Agent
  triggerDocGeneration: (companyId: string, commitToDisk: boolean = true) =>
    api.post<DocGenerationReport>(
      `/api/v1/companies/${companyId}/agents/docs/generate?commit_to_disk=${commitToDisk}`
    ),
};

export interface DocGenerationReport {
  status: string;
  agent_id: string;
  agent_name: string;
  generated_at: string;
  sections: Array<{
    title: string;
    target_file: string;
    content: string;
    token_count: number;
    hash_digest: string;
  }>;
  total_tokens_generated: number;
  files_updated: string[];
}


