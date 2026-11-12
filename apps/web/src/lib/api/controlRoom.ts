/**
 * NEIMAN Control Room Unified API Client
 * Interfaces for fetching the full organizational state, 15 core domains, and real-time operational answers.
 */

import { api } from './client';
import type { Agent } from './agents';
export type { Agent } from './agents';
import type { Department, OrgRole } from './organizations';
import type { ActivityEvent } from '@neiman/events';
import type { OrganizationalAdaptation } from './evolution';
import type { ResourceControlCenterData } from './resources';
import type { IntelligenceDashboardData, ModelProvider } from './intelligence';
import { isDevelopmentAuthBypassEnabled } from '@/lib/authPreview';
import { getControlRoomPreviewState } from './controlRoomPreview';

export interface Project {
  id: string;
  company_id: string;
  owner_id: string;
  name: string;
  objective: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  milestones: Array<{ title: string; description?: string | null; due_date?: string | null; completed: boolean }>;
  deadline: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  company_id?: string;
  assigned_agent_id?: string;
  assigned_agent_name?: string;
  title: string;
  description?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED';
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  dependencies?: string[];
  checklist?: Array<{ id: string; title: string; completed: boolean; created_at?: string }>;
  resource_requirements?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ApprovalRequest {
  id: string;
  company_id: string;
  agent_id?: string;
  task_id?: string;
  title?: string;
  action?: string;
  target?: string;
  action_type: string;
  target_resource: string;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reason: string;
  details?: Record<string, unknown>;
  proposed_payload?: Record<string, unknown>;
  created_at: string;
}

export function normalizeApprovalRequest(raw: Partial<ApprovalRequest> & { id: string; company_id: string }): ApprovalRequest {
  const actionType =
    (typeof raw.action_type === 'string' && raw.action_type.trim()) ||
    (typeof raw.action === 'string' && raw.action.trim()) ||
    (typeof raw.title === 'string' && raw.title.trim()) ||
    'AUTONOMOUS_ACTION';
  const targetResource =
    (typeof raw.target_resource === 'string' && raw.target_resource.trim()) ||
    (typeof raw.target === 'string' && raw.target.trim()) ||
    'system';
  return {
    id: raw.id,
    company_id: raw.company_id,
    agent_id: raw.agent_id ?? undefined,
    task_id: raw.task_id ?? undefined,
    title: raw.title,
    action: raw.action ?? actionType,
    target: raw.target ?? targetResource,
    action_type: actionType,
    target_resource: targetResource,
    risk_level: raw.risk_level ?? 'HIGH',
    status: raw.status ?? 'PENDING',
    reason: raw.reason ?? 'Requires executive review.',
    details: raw.details ?? raw.proposed_payload,
    proposed_payload: raw.proposed_payload ?? raw.details,
    created_at: raw.created_at ?? new Date().toISOString(),
  };
}

export interface AuditLog {
  id: string;
  company_id: string;
  actor_id?: string;
  actor_type?: string;
  authority_level?: string;
  action: string;
  target?: string;
  reason?: string;
  result?: string;
  autonomy_level?: number;
  created_at: string;
}

export interface ResourceSummary {
  compute_used_pct: number | null;
  memory_used_gb: number | null;
  memory_limit_gb: number | null;
  token_usage_total: number | null;
  intelligence_cost_usd: number | null;
  budget_allocated_usd: number | null;
  budget_spent_usd: number | null;
}

export interface DecisionRecord {
  id: string;
  company_id: string;
  problem: string;
  decision?: string;
  status: 'PROPOSED' | 'DELIBERATING' | 'DECIDED' | 'EXECUTED';
  rationale?: string;
  expected_outcome?: string;
  created_at: string;
}

export interface Policy {
  id: string;
  company_id: string;
  name: string;
  scope: string;
  enforcement_level: string;
  is_active: boolean;
  created_at: string;
}

export interface MemoryItem {
  id: string;
  domain: string;
  title: string;
  content: string;
  scope: string;
  created_at: string;
}

export interface ModelProviderInfo {
  id: string;
  name: string;
  provider: string;
  status: 'ONLINE' | 'DEGRADED' | 'OFFLINE';
  is_configured?: boolean;
  is_primary?: boolean;
  active_requests: number | null;
  avg_latency_ms: number | null;
  total_tokens: number | null;
  cost_usd: number | null;
}

export interface ControlRoomState {
  company_id: string;
  agents: Agent[];
  departments: Department[];
  roles: OrgRole[];
  projects: Project[];
  tasks: Task[];
  approvals: ApprovalRequest[];
  audits: AuditLog[];
  resources: ResourceSummary;
  decisions: DecisionRecord[];
  policies: Policy[];
  memories: MemoryItem[];
  providers: ModelProviderInfo[];
  activeProvider?: string | null;
  activeModel?: string | null;
  fallbackChain?: string[];
  activity: ActivityEvent[];
  evolutionProposals: OrganizationalAdaptation[];
  unavailableSections: string[];
}

export const controlRoomApi = {
  // Aggregate call to load full control room state
  getOperationalState: async (companyId: string): Promise<ControlRoomState> => {
    if (isDevelopmentAuthBypassEnabled() && companyId === 'preview-company-NEIMAN') {
      return getControlRoomPreviewState();
    }

    // Fetch live backend state directly from verified domain APIs
    const [
      agentsRes,
      deptsRes,
      rolesRes,
      projectsRes,
      approvalsRes,
      auditsRes,
      decisionsRes,
      policiesRes,
      resourceRes,
      intelligenceRes,
      memoryRes,
      activityRes,
      evolutionRes,
    ] = await Promise.allSettled([
      api.get<Agent[]>(`/api/v1/companies/${companyId}/agents`),
      api.get<Department[]>(`/api/v1/companies/${companyId}/departments`),
      api.get<OrgRole[]>(`/api/v1/companies/${companyId}/roles`),
      api.get<Project[]>(`/api/v1/companies/${companyId}/projects`),
      api.get<ApprovalRequest[]>(`/api/v1/companies/${companyId}/governance/approvals?status=PENDING`),
      api.get<AuditLog[]>(`/api/v1/companies/${companyId}/governance/audits?limit=25`),
      api.get<DecisionRecord[]>(`/api/v1/companies/${companyId}/decisions`),
      api.get<Policy[]>(`/api/v1/companies/${companyId}/policies`),
      api.get<ResourceControlCenterData>(`/api/v1/companies/${companyId}/resources/control-center`),
      api.get<IntelligenceDashboardData>(`/api/v1/companies/${companyId}/intelligence/dashboard`),
      api.get<MemoryItem[]>(`/api/v1/companies/${companyId}/memory/items?limit=50`),
      api.get<ActivityEvent[]>(`/api/v1/companies/${companyId}/activity?limit=40`),
      api.get<OrganizationalAdaptation[]>(`/api/v1/companies/${companyId}/evolution/adaptations`),
    ]);

    const agents = agentsRes.status === 'fulfilled' ? agentsRes.value : [];
    const departments = deptsRes.status === 'fulfilled' ? deptsRes.value : [];
    const roles = rolesRes.status === 'fulfilled' ? rolesRes.value : [];
    const projects = projectsRes.status === 'fulfilled' ? projectsRes.value : [];
    const approvals = approvalsRes.status === 'fulfilled'
      ? approvalsRes.value.map((raw) => normalizeApprovalRequest(raw))
      : [];
    const audits = auditsRes.status === 'fulfilled' ? auditsRes.value : [];
    const decisions = decisionsRes.status === 'fulfilled' ? decisionsRes.value : [];
    const policies = policiesRes.status === 'fulfilled' ? policiesRes.value : [];

    const resourceData = resourceRes.status === 'fulfilled' ? resourceRes.value : null;
    const computeCap = resourceData?.capacities?.find((c) => c.category === 'COMPUTE');
    const memoryCap = resourceData?.capacities?.find((c) => c.category === 'OPERATIONAL');
    const budgetConsumption = resourceData?.budget_consumption;
    const hostTelemetry = resourceData?.system_host_telemetry;
    const hostCores = hostTelemetry?.cpu_cores_available ?? 0;
    const hostLoad1m = hostTelemetry?.load_average?.[0];
    const fallbackComputePct =
      hostCores > 0 && typeof hostLoad1m === 'number'
        ? Math.min(100, Math.round((hostLoad1m / hostCores) * 100))
        : null;
    const hostRamLimitGb =
      typeof hostTelemetry?.ram_total_mb === 'number' && hostTelemetry.ram_total_mb > 0
        ? Math.round((hostTelemetry.ram_total_mb / 1024) * 10) / 10
        : null;
    const hostRamUsedGb =
      hostRamLimitGb != null
        ? Math.round(
            hostRamLimitGb *
              Math.min(
                0.85,
                Math.max(0.18, (fallbackComputePct ?? 25) / 100),
              ) *
              10,
          ) / 10
        : null;

    const resources: ResourceSummary = {
      compute_used_pct: computeCap ? computeCap.utilization_percentage : fallbackComputePct,
      memory_used_gb: memoryCap ? memoryCap.allocated_capacity : hostRamUsedGb,
      memory_limit_gb: memoryCap ? memoryCap.limited_capacity : hostRamLimitGb,
      token_usage_total: intelligenceRes.status === 'fulfilled' ? intelligenceRes.value.total_tokens_consumed ?? null : null,
      intelligence_cost_usd: intelligenceRes.status === 'fulfilled' ? intelligenceRes.value.total_spend_usd ?? null : null,
      budget_allocated_usd: budgetConsumption?.total_budget_usd ?? null,
      budget_spent_usd: budgetConsumption?.spent_budget_usd ?? null,
    };

    const intelData = intelligenceRes.status === 'fulfilled' ? intelligenceRes.value : null;
    const activeProviderName = intelData?.active_provider ?? null;
    const providers: ModelProviderInfo[] = (intelData?.available_providers ?? [])
      .map((provider: ModelProvider): ModelProviderInfo => {
        const isPrimary = Boolean(activeProviderName && provider.name === activeProviderName);
        const status: ModelProviderInfo['status'] = !provider.is_active
          ? 'OFFLINE'
          : provider.is_healthy
            ? 'ONLINE'
            : 'DEGRADED';
        return {
          id: provider.id,
          name: provider.display_name,
          provider: provider.is_local ? 'local' : provider.name,
          status,
          is_configured: Boolean(provider.is_configured),
          is_primary: isPrimary,
          active_requests: null,
          avg_latency_ms: null,
          total_tokens: null,
          cost_usd: null,
        };
      })
      .sort((a, b) => {
        if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
        if (Boolean(a.is_configured) !== Boolean(b.is_configured)) {
          return a.is_configured ? -1 : 1;
        }
        const rank = (s: ModelProviderInfo['status']) =>
          s === 'ONLINE' ? 0 : s === 'DEGRADED' ? 1 : 2;
        if (rank(a.status) !== rank(b.status)) {
          return rank(a.status) - rank(b.status);
        }
        return a.name.localeCompare(b.name);
      });
    const memories = memoryRes.status === 'fulfilled' ? memoryRes.value : [];
    const activity = activityRes.status === 'fulfilled' ? activityRes.value : [];
    const evolutionProposals = evolutionRes.status === 'fulfilled' ? evolutionRes.value : [];
    const taskResults = await Promise.allSettled(projects.map((project) =>
      api.get<Task[]>(`/api/v1/companies/${companyId}/projects/${project.id}/tasks`),
    ));
    const tasks = taskResults.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
    const unavailableSections = [
      ...(agentsRes.status === 'rejected' ? ['agents'] : []),
      ...(deptsRes.status === 'rejected' ? ['departments'] : []),
      ...(rolesRes.status === 'rejected' ? ['roles'] : []),
      ...(projectsRes.status === 'rejected' ? ['projects'] : []),
      ...(approvalsRes.status === 'rejected' ? ['approvals'] : []),
      ...(auditsRes.status === 'rejected' ? ['audit log'] : []),
      ...(decisionsRes.status === 'rejected' ? ['decisions'] : []),
      ...(policiesRes.status === 'rejected' ? ['policies'] : []),
      ...(resourceRes.status === 'rejected' ? ['resource telemetry'] : []),
      ...(intelligenceRes.status === 'rejected' ? ['provider telemetry'] : []),
      ...(memoryRes.status === 'rejected' ? ['organization memory'] : []),
      ...(activityRes.status === 'rejected' ? ['activity stream'] : []),
      ...(evolutionRes.status === 'rejected' ? ['evolution proposals'] : []),
      ...(taskResults.some((result) => result.status === 'rejected') ? ['some project tasks'] : []),
    ];

    return {
      company_id: companyId,
      agents,
      departments,
      roles,
      projects,
      tasks,
      approvals,
      audits,
      resources,
      decisions,
      policies,
      memories,
      providers,
      activeProvider: activeProviderName,
      activeModel: intelData?.active_model ?? null,
      fallbackChain: intelData?.fallback_chain ?? [],
      activity,
      evolutionProposals,
      unavailableSections,
    };
  },

  decideApproval: async (companyId: string, approvalId: string, decision: 'APPROVED' | 'REJECTED', reason: string) => {
    return api.post(`/api/v1/companies/${companyId}/governance/approvals/${approvalId}/decision`, {
      decision,
      reviewer_notes: reason,
    });
  },
};
