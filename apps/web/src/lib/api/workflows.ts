/**
 * NEIMAN Workflows API Client
 * Enterprise-grade multi-step orchestration across organizational agents, tools, conditions, and human gates.
 */

import { api } from './client';

export type WorkflowTriggerType = 'MANUAL' | 'SCHEDULE' | 'EVENT' | 'WEBHOOK' | 'AGENT';
export type WorkflowStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
export type WorkflowExecutionStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'WAITING_APPROVAL'
  | 'WAITING_RETRY'
  | 'WAITING_RESOURCE'
  | 'ESCALATED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'TIMED_OUT';

export type WorkflowNodeType =
  | 'TRIGGER'
  | 'AGENT'
  | 'TASK'
  | 'TOOL'
  | 'CONDITION'
  | 'PARALLEL'
  | 'APPROVAL'
  | 'HUMAN_REVIEW'
  | 'RESOURCE_REQUEST'
  | 'MODEL_SELECTION'
  | 'DELAY'
  | 'WEBHOOK'
  | 'ESCALATION'
  | 'VALIDATION'
  | 'SUCCESS'
  | 'FAILURE';

export interface WorkflowNodePosition {
  x: number;
  y: number;
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: WorkflowNodeType | string;
  config: Record<string, unknown>;
  next_step_id?: string;
  next_step_ids?: string[]; // for parallel splits
  position?: WorkflowNodePosition;
  condition?: {
    expression: string;
    true_step?: string;
    false_step?: string;
  };
}

export interface Workflow {
  id: string;
  company_id: string;
  name: string;
  description?: string | null;
  trigger_type: WorkflowTriggerType;
  trigger_config: Record<string, unknown>;
  steps: WorkflowStep[];
  agents: string[];
  tools: string[];
  conditions: unknown[];
  approvals: Record<string, unknown>;
  completion_criteria: Record<string, unknown>;
  status: WorkflowStatus;
  version?: number;
  created_at: string;
  updated_at: string;
}

export interface CreateWorkflowRequest {
  name: string;
  description?: string;
  trigger_type?: WorkflowTriggerType;
  trigger_config?: Record<string, unknown>;
  steps?: WorkflowStep[];
  agents?: string[];
  tools?: string[];
  conditions?: unknown[];
  approvals?: Record<string, unknown>;
  completion_criteria?: Record<string, unknown>;
}

export interface WorkflowExecutionStepRecord {
  id: string;
  execution_id: string;
  step_id: string;
  step_name: string;
  step_type: string;
  step_index: number;
  agent_id?: string | null;
  agent_name?: string | null;
  tool_name?: string | null;
  status: WorkflowExecutionStatus;
  input_data: Record<string, unknown>;
  output_data: Record<string, unknown>;
  error_message?: string | null;
  retries_attempted: number;
  duration_ms: number;
  created_at: string;
}

export interface WorkflowExecution {
  id: string;
  workflow_id: string;
  company_id: string;
  triggered_by_user_id?: string | null;
  triggered_by_agent_id?: string | null;
  title: string;
  status: WorkflowExecutionStatus;
  current_step_id?: string | null;
  current_step_name?: string | null;
  current_step_index: number;
  total_steps: number;
  input_payload: Record<string, unknown>;
  state_payload: Record<string, unknown>;
  output_payload: Record<string, unknown>;
  error_message?: string | null;
  retries_count: number;
  max_retries: number;
  timeout_seconds: number;
  duration_ms: number;
  tokens_consumed?: number;
  cost_usd?: number;
  pending_approval_id?: string | null;
  pending_escalation_id?: string | null;
  step_records: WorkflowExecutionStepRecord[];
  created_at: string;
  updated_at: string;
}

export const workflowsApi = {
  list: (companyId: string) =>
    api.get<Workflow[]>(`/api/v1/companies/${companyId}/workflows`),

  get: (companyId: string, workflowId: string) =>
    api.get<Workflow>(`/api/v1/companies/${companyId}/workflows/${workflowId}`),

  create: (companyId: string, body: CreateWorkflowRequest) =>
    api.post<Workflow>(`/api/v1/companies/${companyId}/workflows`, body),

  update: (companyId: string, workflowId: string, body: Partial<CreateWorkflowRequest>) =>
    api.patch<Workflow>(`/api/v1/companies/${companyId}/workflows/${workflowId}`, body),

  activate: (companyId: string, workflowId: string) =>
    api.post<Workflow>(`/api/v1/companies/${companyId}/workflows/${workflowId}/activate`),

  delete: (companyId: string, workflowId: string) =>
    api.delete<void>(`/api/v1/companies/${companyId}/workflows/${workflowId}`),

  triggerExecution: (
    companyId: string,
    workflowId: string,
    body: {
      title?: string;
      input_payload?: Record<string, unknown>;
      max_retries?: number;
      timeout_seconds?: number;
    } = {}
  ) =>
    api.post<WorkflowExecution>(
      `/api/v1/companies/${companyId}/workflows/${workflowId}/execute`,
      body
    ),

  listExecutions: (companyId: string, workflowId: string) =>
    api.get<WorkflowExecution[]>(
      `/api/v1/companies/${companyId}/workflows/${workflowId}/executions`
    ),

  getExecution: (companyId: string, executionId: string) =>
    api.get<WorkflowExecution>(
      `/api/v1/companies/${companyId}/workflows/executions/${executionId}`
    ),

  resumeExecution: (companyId: string, executionId: string) =>
    api.post<WorkflowExecution>(
      `/api/v1/companies/${companyId}/workflows/executions/${executionId}/resume`
    ),

  cancelExecution: (companyId: string, executionId: string) =>
    api.post<WorkflowExecution>(
      `/api/v1/companies/${companyId}/workflows/executions/${executionId}/cancel`
    ),
};
