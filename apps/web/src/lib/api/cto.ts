/**
 * Autonomous CTO & Continuous Development Lifecycle Supervisor API Client
 */

import { api } from './client';

export interface CTOStatus {
  cto_agent_id: string;
  cto_agent_name: string;
  cto_status: string;
  total_agents: number;
  available_agents: number;
  working_agents: number;
  primary_project_id?: string;
  active_proposals_count: number;
  backlog_tasks_count: number;
  recent_events: Array<{
    timestamp: string;
    event_type: string;
    message: string;
    task_id?: string;
  }>;
}

export interface CTODirectiveRequest {
  directive: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface CTODirectiveResponse {
  directive_id?: string;
  directive?: string;
  cto_agent_id?: string;
  cto_agent_name: string;
  primary_project_id?: string;
  tasks_created_count: number;
  tasks: Array<{
    id: string;
    title: string;
    assigned_agent_name?: string;
    priority: string;
    status?: string;
    dependencies?: string[];
  }>;
  summary?: string;
  analysis?: string;
  intent?: string;
}

export interface CTOProposedTask {
  title: string;
  description: string;
  assigned_role: string;
  priority: string;
  dependencies?: string[];
}

export interface CTOProposal {
  id: string;
  company_id: string;
  cto_agent_id: string;
  title: string;
  category: string;
  rationale: string;
  impact_assessment: string;
  status: 'PROPOSED' | 'APPROVED' | 'DISMISSED';
  proposed_tasks: CTOProposedTask[];
  delegated_task_ids: string[];
  operator_notes?: string;
  created_at: string;
  decided_at?: string;
}

export interface CTOProposalDecisionRequest {
  decision: 'APPROVED' | 'DISMISSED';
  notes?: string;
}

export interface ActiveTaskTelemetry {
  id: string;
  title: string;
  agent_name: string;
  started_at: string;
}

export interface SupervisorStatus {
  company_id: string;
  is_running: boolean;
  state: 'PLAYING' | 'PAUSED';
  active_cycle: number;
  last_tick_at: string | null;
  pending_tasks_count: number;
  in_progress_tasks_count: number;
  completed_tasks_count: number;
  active_task?: ActiveTaskTelemetry | null;
  is_daemon_active: boolean;
  recent_events: Array<{
    timestamp: string;
    event_type: string;
    message: string;
    task_id?: string;
  }>;
}

export interface CycleResult {
  cycle: number;
  status: 'SUCCESS' | 'IDLE' | 'BLOCKED' | 'PAUSED' | 'ERROR';
  message: string;
  executed_tasks: Array<{
    task_id: string;
    title: string;
    agent: string;
    duration_ms: number;
    steps: number;
  }>;
}

export const ctoApi = {
  getStatus: (companyId: string): Promise<CTOStatus> =>
    api.get<CTOStatus>(`/api/v1/companies/${companyId}/cto/status`),

  sendDirective: (companyId: string, req: CTODirectiveRequest): Promise<CTODirectiveResponse> =>
    api.post<CTODirectiveResponse>(`/api/v1/companies/${companyId}/cto/directive`, req),

  getProposals: (companyId: string): Promise<CTOProposal[]> =>
    api.get<CTOProposal[]>(`/api/v1/companies/${companyId}/cto/proposals`),

  decideProposal: (
    companyId: string,
    proposalId: string,
    req: CTOProposalDecisionRequest
  ): Promise<CTOProposal> =>
    api.post<CTOProposal>(
      `/api/v1/companies/${companyId}/cto/proposals/${proposalId}/decide`,
      req
    ),

  getSupervisorStatus: (companyId: string): Promise<SupervisorStatus> =>
    api.get<SupervisorStatus>(`/api/v1/companies/${companyId}/cto/supervisor/status`),

  toggleSupervisor: (
    companyId: string,
    action: 'PLAY' | 'PAUSE' | 'TICK'
  ): Promise<SupervisorStatus> =>
    api.post<SupervisorStatus>(`/api/v1/companies/${companyId}/cto/supervisor/toggle`, {
      action,
    }),

  triggerTick: (companyId: string): Promise<CycleResult> =>
    api.post<CycleResult>(`/api/v1/companies/${companyId}/cto/supervisor/tick`),

  getAgentTelemetry: (companyId: string, agentId: string): Promise<unknown[]> =>
    api.get<unknown[]>(`/api/v1/companies/${companyId}/cto/telemetry/${agentId}`),
};
