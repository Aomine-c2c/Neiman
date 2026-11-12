import { api } from './client';

export interface TerminalSession {
  id: string;
  company_id: string;
  user_id?: string;
  title: string;
  working_dir: string;
  created_at: string;
  is_active: boolean;
  pid?: number;
  cols: number;
  rows: number;
}

export interface TerminalExecResult {
  session_id: string;
  command: string;
  exit_code: number;
  stdout: string;
  stderr: string;
  working_dir: string;
  duration_ms: number;
}

export interface TerminalHistoryResult {
  session_id: string;
  history: string[];
  backlog: string;
}

export interface CreateSessionParams {
  title?: string;
  working_dir?: string;
  cols?: number;
  rows?: number;
  initial_command?: string;
  environment_variables?: Record<string, string>;
}

export const terminalApi = {
  async listSessions(companyId: string): Promise<TerminalSession[]> {
    return api.get<TerminalSession[]>(`/api/v1/companies/${companyId}/terminal/sessions`);
  },

  async createSession(companyId: string, params: CreateSessionParams = {}): Promise<TerminalSession> {
    return api.post<TerminalSession>(`/api/v1/companies/${companyId}/terminal/sessions`, params);
  },

  async getSession(companyId: string, sessionId: string): Promise<TerminalSession> {
    return api.get<TerminalSession>(`/api/v1/companies/${companyId}/terminal/sessions/${sessionId}`);
  },

  async deleteSession(companyId: string, sessionId: string): Promise<void> {
    return api.delete<void>(`/api/v1/companies/${companyId}/terminal/sessions/${sessionId}`);
  },

  async execCommand(
    companyId: string,
    sessionId: string,
    command: string,
    timeoutSeconds: number = 30.0
  ): Promise<TerminalExecResult> {
    return api.post<TerminalExecResult>(
      `/api/v1/companies/${companyId}/terminal/sessions/${sessionId}/exec`,
      { command, timeout_seconds: timeoutSeconds }
    );
  },

  async resize(
    companyId: string,
    sessionId: string,
    cols: number,
    rows: number
  ): Promise<{ status: string; cols: number; rows: number }> {
    return api.post<{ status: string; cols: number; rows: number }>(
      `/api/v1/companies/${companyId}/terminal/sessions/${sessionId}/resize`,
      { cols, rows }
    );
  },

  async sendSignal(
    companyId: string,
    sessionId: string,
    signal: 'SIGINT' | 'SIGTERM' | 'SIGKILL' = 'SIGINT'
  ): Promise<{ status: string; signal: string }> {
    return api.post<{ status: string; signal: string }>(
      `/api/v1/companies/${companyId}/terminal/sessions/${sessionId}/signal`,
      { signal }
    );
  },

  async getHistory(companyId: string, sessionId: string): Promise<TerminalHistoryResult> {
    return api.get<TerminalHistoryResult>(
      `/api/v1/companies/${companyId}/terminal/sessions/${sessionId}/history`
    );
  },

  getWebSocketUrl(companyId: string, sessionId?: string): string {
    const isBrowser = typeof window !== 'undefined';
    const protocol = isBrowser && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = isBrowser ? window.location.host : 'localhost:8000';
    const rawHost = process.env.NEXT_PUBLIC_API_URL
      ? process.env.NEXT_PUBLIC_API_URL.replace(/^http/, 'ws').replace(/\/+$/, '')
      : `${protocol}//${host}`;
    const apiBase = rawHost.endsWith('/api/v1') ? rawHost : `${rawHost}/api/v1`;

    if (sessionId) {
      return `${apiBase}/companies/${companyId}/terminal/sessions/${sessionId}/ws`;
    }
    return `${apiBase}/companies/${companyId}/terminal/ws`;
  },
};
