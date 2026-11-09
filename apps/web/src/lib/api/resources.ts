/**
 * NEIMAN Resource Engine API Client
 * Manages compute, intelligence, financial, and operational resource pools,
 * budgets, evaluation requests, allocations, and control center telemetry.
 */

import { api } from './client';

export type ResourceCategory = 'COMPUTE' | 'INTELLIGENCE' | 'FINANCIAL' | 'OPERATIONAL';
export type ResourcePriority = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW' | 'BACKGROUND';
export type ResourceEvaluationDecision = 'APPROVE' | 'DENY' | 'DEFER' | 'REDUCE' | 'QUEUE';
export type MetricState = 'OBSERVED' | 'ESTIMATED' | 'ALLOCATED' | 'LIMITED' | 'AVAILABLE';

export interface ResourcePool {
  id: string;
  company_id: string;
  name: string;
  category: ResourceCategory;
  description?: string | null;
  total_capacity: number;
  unit: string;
  allocated_capacity: number;
  observed_usage: number;
  available_capacity: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ResourcePoolCreate {
  name: string;
  category: ResourceCategory;
  description?: string;
  total_capacity: number;
  unit: string;
}

export interface ResourceBudget {
  id: string;
  company_id: string;
  department_id?: string | null;
  project_id?: string | null;
  name: string;
  fiscal_period: string;
  total_budget_usd: number;
  spent_budget_usd: number;
  reserved_budget_usd: number;
  remaining_budget_usd: number;
  total_token_allowance: number;
  consumed_tokens: number;
  reserved_tokens: number;
  remaining_tokens: number;
  alert_threshold_percent: number;
  is_exhausted: boolean;
  created_at: string;
  updated_at: string;
}

export interface ResourceBudgetCreate {
  name: string;
  department_id?: string;
  project_id?: string;
  fiscal_period?: string;
  total_budget_usd: number;
  total_token_allowance?: number;
  alert_threshold_percent?: number;
}

export interface RequestedComputeSpec {
  cpu_cores: number;
  ram_gb: number;
  gpu_required?: boolean;
  gpu_count?: number;
  storage_gb?: number;
  network_mbps?: number;
}

export interface RequestedIntelligenceSpec {
  tokens: number;
  api_requests?: number;
  max_inference_cost_usd: number;
  preferred_model?: string;
  fallback_allowed?: boolean;
}

export interface RequestedOperationalSpec {
  runtime_minutes: number;
  slots_needed: number;
  requires_human_approval?: boolean;
}

export interface ResourceRequestCreate {
  agent_id?: string;
  task_id?: string;
  priority: ResourcePriority;
  justification: string;
  requested_compute: RequestedComputeSpec;
  requested_intelligence: RequestedIntelligenceSpec;
  requested_operational: RequestedOperationalSpec;
  applicable_budget_ids: string[];
  expected_value_score?: number;
}

export interface ResourceEvaluationResult {
  decision: ResourceEvaluationDecision;
  decision_reason: string;
  adjusted_compute?: Partial<RequestedComputeSpec>;
  adjusted_intelligence?: Partial<RequestedIntelligenceSpec>;
  adjusted_operational?: Partial<RequestedOperationalSpec>;
  allocated_pool_ids: string[];
  queue_position?: number | null;
  suggested_defer_seconds?: number | null;
}

export interface ResourceRequestResponse {
  id: string;
  company_id: string;
  agent_id?: string | null;
  task_id?: string | null;
  priority: ResourcePriority;
  justification: string;
  requested_compute: RequestedComputeSpec;
  requested_intelligence: RequestedIntelligenceSpec;
  requested_operational: RequestedOperationalSpec;
  decision?: ResourceEvaluationDecision | null;
  decision_reason?: string | null;
  evaluated_at?: string | null;
  actual_cost_usd: number;
  actual_tokens: number;
  created_at: string;
  updated_at: string;
}

export interface ResourceAllocation {
  id: string;
  company_id: string;
  pool_id: string;
  request_id: string;
  allocated_amount: number;
  unit: string;
  status: 'ACTIVE' | 'RELEASED' | 'REVOKED' | 'EXPIRED';
  expires_at?: string | null;
  released_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CapacityOverviewItem {
  category: string;
  unit: string;
  limited_capacity: number;
  allocated_capacity: number;
  available_capacity: number;
  observed_usage: number;
  utilization_percentage: number;
}

export interface ExpensiveTaskSummary {
  task_id?: string | null;
  task_title: string;
  agent_name?: string | null;
  cost_usd: number;
  tokens_consumed: number;
  cpu_duration_seconds: number;
}

export interface ResourceBottleneckItem {
  pool_id: string;
  pool_name: string;
  category: string;
  utilization_percentage: number;
  queued_requests_count: number;
  severity: 'NORMAL' | 'HIGH' | 'CRITICAL';
  recommendation: string;
}

export interface ProviderUsageMetric {
  provider_name: string;
  total_tokens: number;
  total_cost_usd: number;
  request_count: number;
}

export interface ResourceControlCenterData {
  company_id: string;
  generated_at: string;
  capacities: CapacityOverviewItem[];
  budget_consumption: {
    total_budget_usd: number;
    spent_budget_usd: number;
    reserved_budget_usd: number;
    remaining_budget_usd: number;
    total_token_allowance: number;
    consumed_tokens: number;
    reserved_tokens: number;
    remaining_tokens: number;
    burn_rate_percent: number;
    budgets_count: number;
  };
  active_allocations_count: number;
  queued_requests_count: number;
  bottlenecks: ResourceBottleneckItem[];
  expensive_tasks: ExpensiveTaskSummary[];
  provider_usage: ProviderUsageMetric[];
  system_host_telemetry: {
    metric_state: string;
    cpu_cores_available: number;
    load_average: number[];
    storage_total_gb: number;
    storage_free_gb: number;
    ram_total_mb: number | null;
    gpu_detected: boolean;
  };
}

export const resourcesApi = {
  getControlCenter: (companyId: string): Promise<ResourceControlCenterData> =>
    api.get<ResourceControlCenterData>(`/api/v1/companies/${companyId}/resources/control-center`),

  listPools: (companyId: string, category?: ResourceCategory): Promise<ResourcePool[]> => {
    const query = category ? `?category=${category}` : '';
    return api.get<ResourcePool[]>(`/api/v1/companies/${companyId}/resources/pools${query}`);
  },

  createPool: (companyId: string, pool: ResourcePoolCreate): Promise<ResourcePool> =>
    api.post<ResourcePool>(`/api/v1/companies/${companyId}/resources/pools`, pool),

  listBudgets: (companyId: string): Promise<ResourceBudget[]> =>
    api.get<ResourceBudget[]>(`/api/v1/companies/${companyId}/resources/budgets`),

  createBudget: (companyId: string, budget: ResourceBudgetCreate): Promise<ResourceBudget> =>
    api.post<ResourceBudget>(`/api/v1/companies/${companyId}/resources/budgets`, budget),

  listRequests: (companyId: string, decision?: string): Promise<ResourceRequestResponse[]> => {
    const query = decision ? `?decision=${decision}` : '';
    return api.get<ResourceRequestResponse[]>(`/api/v1/companies/${companyId}/resources/requests${query}`);
  },

  submitRequest: (
    companyId: string,
    req: ResourceRequestCreate
  ): Promise<{ request: ResourceRequestResponse; evaluation: ResourceEvaluationResult }> =>
    api.post<{ request: ResourceRequestResponse; evaluation: ResourceEvaluationResult }>(
      `/api/v1/companies/${companyId}/resources/requests`,
      req
    ),

  listAllocations: (companyId: string, status?: string): Promise<ResourceAllocation[]> => {
    const query = status ? `?status=${status}` : '';
    return api.get<ResourceAllocation[]>(`/api/v1/companies/${companyId}/resources/allocations${query}`);
  },

  releaseAllocation: (companyId: string, allocationId: string): Promise<ResourceAllocation> =>
    api.post<ResourceAllocation>(`/api/v1/companies/${companyId}/resources/allocations/${allocationId}/release`, {
      reason: 'User manual release from control center',
    }),
};
