/**
 * NEIMAN Projects & Tasks API Client
 */

import { api } from './client';

export type ProjectStatus = 'PLANNING' | 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TaskStatus = 'BACKLOG' | 'TODO' | 'PENDING' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE' | 'COMPLETED' | 'CANCELLED' | 'BLOCKED';

export interface Milestone {
  title: string;
  description?: string | null;
  due_date?: string | null;
  completed: boolean;
}

export interface Project {
  id: string;
  company_id: string;
  owner_id?: string;
  name: string;
  objective?: string | null;
  description?: string | null;
  priority?: TaskPriority | null;
  status: ProjectStatus;
  milestones?: Milestone[];
  deadline?: string | null;
  start_date?: string | null;
  target_date?: string | null;
  budget?: number | null;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateProjectRequest {
  name: string;
  objective?: string;
  description?: string;
  priority?: TaskPriority;
  status?: ProjectStatus;
  milestones?: Milestone[];
  deadline?: string;
  start_date?: string;
  target_date?: string;
  budget?: number;
  metadata?: Record<string, unknown>;
}

export interface TaskExecutionStep {
  step: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED';
  details?: Record<string, unknown>;
  duration_ms?: number;
}

export interface TaskOutputArtifact {
  id?: string;
  name: string;
  type: string;
  content?: string;
  url?: string;
  size_bytes?: number;
}

export interface TaskChecklistItem {
  id: string;
  title: string;
  completed: boolean;
  created_at?: string;
}

export interface Task {
  id: string;
  company_id: string;
  project_id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigned_agent_id?: string | null;
  assigned_user_id?: string | null;
  dependencies?: string[];
  checklist?: TaskChecklistItem[];
  resource_requirements?: Record<string, unknown>;
  expected_outcome?: string | null;
  due_date?: string | null;
  estimated_tokens?: number | null;
  estimated_cost?: number | null;
  tokens_consumed?: number | null;
  cost_usd?: number | null;
  execution_history?: TaskExecutionStep[];
  outputs?: TaskOutputArtifact[];
  validation_status?: 'NOT_VALIDATED' | 'VALIDATING' | 'PASSED' | 'FAILED';
  validation_details?: Record<string, unknown>;
  approval_request_id?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigned_agent_id?: string;
  assigned_user_id?: string;
  dependencies?: string[];
  checklist?: TaskChecklistItem[];
  resource_requirements?: Record<string, unknown>;
  expected_outcome?: string;
  due_date?: string;
  estimated_tokens?: number;
  estimated_cost?: number;
  metadata?: Record<string, unknown>;
}

export const projectsApi = {
  // Projects
  list: (companyId: string) =>
    api.get<Project[]>(`/api/v1/companies/${companyId}/projects`),

  get: (companyId: string, projectId: string) =>
    api.get<Project>(`/api/v1/companies/${companyId}/projects/${projectId}`),

  create: (companyId: string, body: CreateProjectRequest) =>
    api.post<Project>(`/api/v1/companies/${companyId}/projects`, body),

  update: (companyId: string, projectId: string, body: Partial<CreateProjectRequest>) =>
    api.patch<Project>(`/api/v1/companies/${companyId}/projects/${projectId}`, body),

  delete: (companyId: string, projectId: string) =>
    api.delete<void>(`/api/v1/companies/${companyId}/projects/${projectId}`),

  // Tasks
  listTasks: (companyId: string, projectId: string) =>
    api.get<Task[]>(`/api/v1/companies/${companyId}/projects/${projectId}/tasks`),

  getTask: (companyId: string, projectId: string, taskId: string) =>
    api.get<Task>(`/api/v1/companies/${companyId}/projects/${projectId}/tasks/${taskId}`),

  createTask: (companyId: string, projectId: string, body: CreateTaskRequest) =>
    api.post<Task>(`/api/v1/companies/${companyId}/projects/${projectId}/tasks`, body),

  updateTask: (companyId: string, projectId: string, taskId: string, body: Partial<CreateTaskRequest>) =>
    api.patch<Task>(`/api/v1/companies/${companyId}/projects/${projectId}/tasks/${taskId}`, body),

  deleteTask: (companyId: string, projectId: string, taskId: string) =>
    api.delete<void>(`/api/v1/companies/${companyId}/projects/${projectId}/tasks/${taskId}`),

  toggleTaskStatus: (companyId: string, projectId: string, taskId: string, currentStatus: TaskStatus) => {
    const isDone = currentStatus === 'DONE' || currentStatus === 'COMPLETED';
    const newStatus: TaskStatus = isDone ? 'TODO' : 'COMPLETED';
    return api.patch<Task>(`/api/v1/companies/${companyId}/projects/${projectId}/tasks/${taskId}`, {
      status: newStatus,
    });
  },

  updateTaskChecklist: (
    companyId: string,
    projectId: string,
    taskId: string,
    checklist: TaskChecklistItem[],
    currentResourceReqs: Record<string, unknown> = {}
  ) => {
    return api.patch<Task>(`/api/v1/companies/${companyId}/projects/${projectId}/tasks/${taskId}`, {
      resource_requirements: {
        ...currentResourceReqs,
        checklist,
      },
    });
  },
};
