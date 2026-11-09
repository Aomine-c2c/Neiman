/**
 * NEIMAN Universal Isomorphic API Client
 * Shared across Web, Desktop, and TUI runtimes.
 * Features:
 * - Pure isomorphic HTTP transport
 * - In-flight GET request deduplication
 * - 4-second memory TTL query cache
 * - Automatic mutation invalidation
 * - Fully typed domain API resources
 */

import { getApiBaseUrl, NEIMAN_CONFIG } from '@neiman/config';
import { ApiError } from '@neiman/core';
import type {
  OrganizationCompany,
  Department,
  OrgRole,
  CompanyMember,
  Agent,
  AgentCommunication,
  Project,
  Task,
  Workflow,
  WorkflowExecution,
  ResourcePool,
  ResourceBudget,
  ModelProvider,
  Model,
  ModelRoutingPolicy,
  CompanyConstitution,
  ApprovalRequest,
  MemoryItem,
  DecisionRecord,
  EvolutionProposal,
} from '@neiman/types';
import type { ActivityEvent, ActivityFilterQuery } from '@neiman/events';
import type { LoginCredentials, TokenResponse, NexoraUser } from '@neiman/auth';

// Token injection hook (purely decoupled from React or DOM)
let tokenProvider: (() => string | null) | null = null;

export function configureApiTokenProvider(provider: () => string | null) {
  tokenProvider = provider;
}

// In-flight GET deduplication & memory TTL cache
interface CacheEntry<T = unknown> {
  data: T;
  expiresAt: number;
}

const inflightRequests = new Map<string, Promise<unknown>>();
const queryCache = new Map<string, CacheEntry>();

export function clearApiCache(pathPrefix?: string) {
  if (!pathPrefix) {
    queryCache.clear();
    return;
  }
  queryCache.forEach((_, key) => {
    if (key.includes(pathPrefix)) {
      queryCache.delete(key);
    }
  });
}

export async function universalRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase();
  const token = tokenProvider?.();
  const baseUrl = getApiBaseUrl().replace(/\/$/, '');
  const cacheKey = `${token || 'anon'}:${method}:${path}`;

  if (method === 'GET') {
    const cached = queryCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data as T;
    }
    if (inflightRequests.has(cacheKey)) {
      return inflightRequests.get(cacheKey) as Promise<T>;
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const fetchPromise = (async () => {
    try {
      const res = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers,
      });

      if (!res.ok) {
        let data: unknown = null;
        try {
          data = await res.json();
        } catch {
          data = { detail: res.statusText };
        }
        const errorBody = data as { detail?: string; message?: string } | null;
        const detail = errorBody?.detail ?? errorBody?.message ?? `API Error: ${res.status}`;
        throw new ApiError(res.status, data, detail);
      }

      if (res.status === 204) {
        return null as T;
      }

      const result = (await res.json()) as T;

      if (method === 'GET') {
        queryCache.set(cacheKey, {
          data: result,
          expiresAt: Date.now() + NEIMAN_CONFIG.QUERY_CACHE_TTL_MS,
        });
      } else {
        clearApiCache();
      }

      return result;
    } finally {
      if (method === 'GET') {
        inflightRequests.delete(cacheKey);
      }
    }
  })();

  if (method === 'GET') {
    inflightRequests.set(cacheKey, fetchPromise);
  }

  return fetchPromise;
}

export const universalClient = {
  get: <T>(path: string, options?: RequestInit) =>
    universalRequest<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestInit) =>
    universalRequest<T>(path, {
      ...options,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  patch: <T>(path: string, body?: unknown, options?: RequestInit) =>
    universalRequest<T>(path, {
      ...options,
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(path: string, options?: RequestInit) =>
    universalRequest<T>(path, { ...options, method: 'DELETE' }),
};

// ============================================================================
// TYPED API DOMAIN BINDINGS
// ============================================================================
export const authApiContract = {
  login: (creds: LoginCredentials) =>
    universalClient.post<TokenResponse>('/api/v1/auth/login', creds),
  me: () =>
    universalClient.get<NexoraUser>('/api/v1/auth/me'),
};

export const organizationsApiContract = {
  list: () =>
    universalClient.get<OrganizationCompany[]>('/api/v1/companies/me'),
  get: (id: string) =>
    universalClient.get<OrganizationCompany>(`/api/v1/companies/${id}`),
  listDepartments: (companyId: string) =>
    universalClient.get<Department[]>(`/api/v1/companies/${companyId}/departments`),
  listRoles: (companyId: string) =>
    universalClient.get<OrgRole[]>(`/api/v1/companies/${companyId}/roles`),
  listMembers: (companyId: string) =>
    universalClient.get<CompanyMember[]>(`/api/v1/companies/${companyId}/members`),
};

export const agentsApiContract = {
  list: (companyId: string) =>
    universalClient.get<Agent[]>(`/api/v1/companies/${companyId}/agents`),
  get: (companyId: string, id: string) =>
    universalClient.get<Agent>(`/api/v1/companies/${companyId}/agents/${id}`),
  pause: (companyId: string, id: string) =>
    universalClient.post<Agent>(`/api/v1/companies/${companyId}/agents/${id}/pause`),
  resume: (companyId: string, id: string) =>
    universalClient.post<Agent>(`/api/v1/companies/${companyId}/agents/${id}/resume`),
  listCommunications: (companyId: string, agentId: string) =>
    universalClient.get<AgentCommunication[]>(`/api/v1/companies/${companyId}/agents/${agentId}/communications`),
};

export const projectsApiContract = {
  list: (companyId: string) =>
    universalClient.get<Project[]>(`/api/v1/companies/${companyId}/projects`),
  get: (companyId: string, id: string) =>
    universalClient.get<Project>(`/api/v1/companies/${companyId}/projects/${id}`),
  listTasks: (companyId: string) =>
    universalClient.get<Task[]>(`/api/v1/companies/${companyId}/tasks`),
};

export const workflowsApiContract = {
  list: (companyId: string) =>
    universalClient.get<Workflow[]>(`/api/v1/companies/${companyId}/workflows`),
  get: (companyId: string, id: string) =>
    universalClient.get<Workflow>(`/api/v1/companies/${companyId}/workflows/${id}`),
  listExecutions: (companyId: string) =>
    universalClient.get<WorkflowExecution[]>(`/api/v1/companies/${companyId}/workflows/executions`),
  execute: (companyId: string, id: string, inputPayload: Record<string, unknown> = {}) =>
    universalClient.post<WorkflowExecution>(`/api/v1/companies/${companyId}/workflows/${id}/execute`, {
      input_payload: inputPayload,
    }),
};

export const resourcesApiContract = {
  listPools: (companyId: string) =>
    universalClient.get<ResourcePool[]>(`/api/v1/companies/${companyId}/resources/pools`),
  listBudgets: (companyId: string) =>
    universalClient.get<ResourceBudget[]>(`/api/v1/companies/${companyId}/resources/budgets`),
};

export const intelligenceApiContract = {
  listProviders: (companyId: string) =>
    universalClient.get<ModelProvider[]>(`/api/v1/companies/${companyId}/intelligence/providers`),
  listModels: (companyId: string) =>
    universalClient.get<Model[]>(`/api/v1/companies/${companyId}/intelligence/models`),
  getPolicy: (companyId: string) =>
    universalClient.get<ModelRoutingPolicy>(`/api/v1/companies/${companyId}/intelligence/policy`),
};

export const governanceApiContract = {
  getConstitution: (companyId: string) =>
    universalClient.get<CompanyConstitution>(`/api/v1/companies/${companyId}/constitution`),
  listApprovals: (companyId: string) =>
    universalClient.get<ApprovalRequest[]>(`/api/v1/companies/${companyId}/governance/approvals`),
  resolveApproval: (companyId: string, approvalId: string, approved: boolean, notes?: string) =>
    universalClient.post<ApprovalRequest>(`/api/v1/companies/${companyId}/governance/approvals/${approvalId}/resolve`, {
      status: approved ? 'APPROVED' : 'REJECTED',
      reviewer_notes: notes,
    }),
};

export const memoryApiContract = {
  list: (companyId: string) =>
    universalClient.get<MemoryItem[]>(`/api/v1/companies/${companyId}/memory`),
  listDecisions: (companyId: string) =>
    universalClient.get<DecisionRecord[]>(`/api/v1/companies/${companyId}/decisions`),
};

export const evolutionApiContract = {
  listProposals: (companyId: string) =>
    universalClient.get<EvolutionProposal[]>(`/api/v1/companies/${companyId}/evolution/proposals`),
};

export const activityApiContract = {
  getRecentActivity: (companyId: string, params?: ActivityFilterQuery): Promise<ActivityEvent[]> => {
    const q = new URLSearchParams();
    if (params?.agent) q.append('agent', params.agent);
    if (params?.department) q.append('department', params.department);
    if (params?.project) q.append('project', params.project);
    if (params?.event && params.event !== 'ALL') q.append('event', params.event);
    if (params?.severity && params.severity !== 'ALL') q.append('severity', params.severity);
    if (params?.limit) q.append('limit', params.limit.toString());
    const qs = q.toString();
    return universalClient.get<ActivityEvent[]>(`/api/v1/companies/${companyId}/activity${qs ? `?${qs}` : ''}`);
  },
};
