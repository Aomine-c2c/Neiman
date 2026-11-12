/**
 * NEIMAN Universal Realtime Event Schemas & Types
 * Shared across Web, Desktop, and TUI.
 */

export type ActivityEventType =
  | 'agent_started'
  | 'agent_completed'
  | 'task_created'
  | 'task_failed'
  | 'workflow_started'
  | 'workflow_completed'
  | 'approval_requested'
  | 'approval_completed'
  | 'provider_failed'
  | 'provider_switched'
  | 'resource_threshold'
  | 'decision_created'
  | 'evolution_proposed'
  | 'simulation_completed'
  | 'runtime_execution_completed'
  | 'runtime_execution_blocked';

export type ActivitySeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ActivityEvent {
  id: string;
  company_id: string;
  event_type: ActivityEventType;
  severity: ActivitySeverity;
  title: string;
  summary: string;
  agent_id?: string | null;
  agent_name?: string | null;
  department_id?: string | null;
  department_name?: string | null;
  project_id?: string | null;
  project_name?: string | null;
  payload: Record<string, unknown>;
  timestamp: string;
}

export interface ActivityFilterQuery {
  agent?: string;
  department?: string;
  project?: string;
  event?: string;
  severity?: string;
  limit?: number;
}

export const ALL_ACTIVITY_EVENTS: readonly ActivityEventType[] = [
  'agent_started',
  'agent_completed',
  'task_created',
  'task_failed',
  'workflow_started',
  'workflow_completed',
  'approval_requested',
  'approval_completed',
  'provider_failed',
  'provider_switched',
  'resource_threshold',
  'decision_created',
  'evolution_proposed',
  'simulation_completed',
  'runtime_execution_completed',
  'runtime_execution_blocked',
] as const;
