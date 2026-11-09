/**
 * Model Context Protocol (MCP) API Client
 */

import { api } from './client';

export interface MCPToolSchema {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface MCPServerConfig {
  id: string;
  name: string;
  description: string;
  category:
    | 'research'
    | 'browser'
    | 'crawler'
    | 'generation'
    | 'devops'
    | 'database'
    | 'management'
    | 'observability'
    | 'custom';
  transport: 'stdio' | 'sse' | 'builtin';
  endpoint?: string | null;
  env_keys_required: string[];
  is_enabled: boolean;
  tools: MCPToolSchema[];
}

export interface MCPToolCallRequest {
  server_id: string;
  tool_name: string;
  arguments?: Record<string, unknown>;
}

export interface MCPToolCallResult {
  call_id: string;
  server_id: string;
  tool_name: string;
  status: 'SUCCESS' | 'FAILED' | 'BLOCKED';
  content: Array<{ type: string; text?: string; [key: string]: unknown }>;
  raw_output?: unknown;
  duration_ms: number;
  error_message?: string | null;
}

export interface SkillConfig {
  id: string;
  name: string;
  description: string;
  playbook_path: string;
  category: string;
  compatible_roles: string[];
  required_mcp_servers: string[];
  content_preview?: string | null;
}

export interface PluginBundleConfig {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  is_enabled: boolean;
  department_bindings: string[];
  skills: string[];
  mcp_servers: string[];
  env_keys_required: string[];
}

export const mcpApi = {
  listServers: (companyId: string): Promise<MCPServerConfig[]> =>
    api.get<MCPServerConfig[]>(`/api/v1/companies/${companyId}/mcp/servers`),

  listSkills: (companyId: string): Promise<SkillConfig[]> =>
    api.get<SkillConfig[]>(`/api/v1/companies/${companyId}/mcp/skills`),

  listPlugins: (companyId: string): Promise<PluginBundleConfig[]> =>
    api.get<PluginBundleConfig[]>(`/api/v1/companies/${companyId}/mcp/plugins`),

  togglePlugin: (
    companyId: string,
    pluginId: string,
    isEnabled: boolean
  ): Promise<{ plugin_id: string; is_enabled: boolean }> =>
    api.patch<{ plugin_id: string; is_enabled: boolean }>(
      `/api/v1/companies/${companyId}/mcp/plugins/${pluginId}/toggle`,
      { is_enabled: isEnabled }
    ),

  registerServer: (companyId: string, config: MCPServerConfig): Promise<MCPServerConfig> =>
    api.post<MCPServerConfig>(`/api/v1/companies/${companyId}/mcp/servers`, config),

  toggleServer: (
    companyId: string,
    serverId: string,
    isEnabled: boolean
  ): Promise<{ server_id: string; is_enabled: boolean }> =>
    api.patch<{ server_id: string; is_enabled: boolean }>(
      `/api/v1/companies/${companyId}/mcp/servers/${serverId}/toggle`,
      { is_enabled: isEnabled }
    ),

  callTool: (companyId: string, req: MCPToolCallRequest): Promise<MCPToolCallResult> =>
    api.post<MCPToolCallResult>(`/api/v1/companies/${companyId}/mcp/tools/call`, req),
};
