/**
 * External Autonomous Agents API Client
 */

import { api } from './client';

export interface ExternalAgentConfig {
  id: string;
  name: string;
  vendor: string;
  description: string;
  endpoint_type: 'webhook' | 'grpc' | 'builtin_adapter' | 'openai_tool_agent';
  endpoint_url?: string | null;
  auth_header_name?: string | null;
  capabilities: string[];
  system_prompt: string;
  is_active: boolean;
  default_model: string;
}

export interface ExternalAgentDispatchSpec {
  agent_id: string;
  task_title: string;
  task_instructions: string;
  context_data?: Record<string, unknown>;
  timeout_seconds?: number;
}

export interface ExternalAgentExecutionTelemetry {
  execution_id: string;
  agent_id: string;
  agent_name: string;
  status: 'COMPLETED' | 'FAILED' | 'BLOCKED';
  output_result: string;
  artifacts_created: string[];
  intermediate_steps: Array<Record<string, unknown>>;
  duration_ms: number;
  tokens_consumed: number;
  error_message?: string | null;
}

export const externalAgentsApi = {
  list: (companyId: string): Promise<ExternalAgentConfig[]> =>
    api.get<ExternalAgentConfig[]>(`/api/v1/companies/${companyId}/external-agents`),

  register: (companyId: string, config: ExternalAgentConfig): Promise<ExternalAgentConfig> =>
    api.post<ExternalAgentConfig>(`/api/v1/companies/${companyId}/external-agents`, config),

  toggle: (
    companyId: string,
    agentId: string,
    isActive: boolean
  ): Promise<{ agent_id: string; is_active: boolean }> =>
    api.patch<{ agent_id: string; is_active: boolean }>(
      `/api/v1/companies/${companyId}/external-agents/${agentId}/toggle`,
      { is_active: isActive }
    ),

  dispatch: (
    companyId: string,
    spec: ExternalAgentDispatchSpec
  ): Promise<ExternalAgentExecutionTelemetry> =>
    api.post<ExternalAgentExecutionTelemetry>(
      `/api/v1/companies/${companyId}/external-agents/dispatch`,
      spec
    ),
};
