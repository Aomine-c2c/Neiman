/**
 * NEIMAN OS Sandboxed Code Execution Runtime API Client
 */

import { api } from './client';

export interface RuntimeExecutionRecord {
  execution_id: string;
  company_id: string;
  agent_id?: string | null;
  agent_name?: string | null;
  language: string;
  code_snippet: string;
  status: 'SUCCESS' | 'FAILED' | 'TIMED_OUT' | 'FORBIDDEN';
  exit_code: number;
  stdout: string;
  stderr: string;
  duration_ms: number;
  files_created: string[];
  security_checks_passed: boolean;
  violation_reason?: string | null;
  created_at: string;
}

export interface RuntimeExecuteRequest {
  code?: string;
  command?: string;
  language?: 'python' | 'node' | 'bash';
  timeout_seconds?: number;
  agent_id?: string;
  agent_name?: string;
  environment_variables?: Record<string, string>;
}

export interface RuntimeExecuteResult {
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

export interface RuntimeMetrics {
  total_executions: number;
  blocked_violations: number;
  recent_count: number;
  success_rate_pct: number;
  avg_latency_ms: number;
  sandbox_backend: string;
  supported_languages: string[];
}

export const runtimeApi = {
  listExecutions: (
    companyId: string,
    params?: { language?: string; status?: string; limit?: number }
  ): Promise<RuntimeExecutionRecord[]> => {
    const q = new URLSearchParams();
    if (params?.language && params.language !== 'ALL') q.set('language', params.language);
    if (params?.status && params.status !== 'ALL') q.set('status', params.status);
    if (params?.limit) q.set('limit', String(params.limit));
    const suffix = q.toString() ? `?${q.toString()}` : '';
    return api.get<RuntimeExecutionRecord[]>(`/api/v1/companies/${companyId}/runtime/executions${suffix}`);
  },

  executeCode: (
    companyId: string,
    req: RuntimeExecuteRequest
  ): Promise<RuntimeExecuteResult> =>
    api.post<RuntimeExecuteResult>(`/api/v1/companies/${companyId}/runtime/execute`, req),

  getMetrics: (companyId: string): Promise<RuntimeMetrics> =>
    api.get<RuntimeMetrics>(`/api/v1/companies/${companyId}/runtime/metrics`),
};

