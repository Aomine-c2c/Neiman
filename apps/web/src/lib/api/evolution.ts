/**
 * NEIMAN Organizational Performance & Evolution Engine API Client
 */

import { api } from './client';

export type PerformanceDimension =
  | 'COMPANY'
  | 'DEPARTMENT'
  | 'PROJECT'
  | 'WORKFLOW'
  | 'ROLE'
  | 'AGENT'
  | 'MODEL_PROVIDER'
  | 'TASK';

export type AdaptationType =
  | 'CHANGE_AGENT_CONFIG'
  | 'CHANGE_SYSTEM_PROMPT'
  | 'CHANGE_MODEL_PROVIDER'
  | 'CHANGE_MODEL_ROUTING'
  | 'CREATE_SPECIALIZATION'
  | 'CREATE_NEW_AGENT'
  | 'RETIRE_AGENT'
  | 'MODIFY_WORKFLOW'
  | 'MODIFY_RESOURCE_ALLOCATION'
  | 'CREATE_TEMPORARY_DEPARTMENT'
  | 'MODIFY_STRATEGY'
  | 'PROPOSE_POLICY_CHANGES';

export type AdaptationStage =
  | 'OBSERVE'
  | 'DIAGNOSE'
  | 'PROPOSE'
  | 'SIMULATE'
  | 'EVALUATE'
  | 'VALIDATE'
  | 'APPROVE'
  | 'DEPLOY'
  | 'MONITOR'
  | 'ROLLBACK';

export type AdaptationStatus =
  | 'PROPOSED'
  | 'SIMULATING'
  | 'SIMULATED'
  | 'VALIDATED'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'DEPLOYED'
  | 'MONITORING'
  | 'ROLLED_BACK'
  | 'SUCCESSFUL';

export interface PerformanceMetric {
  id: string;
  company_id: string;
  dimension: PerformanceDimension;
  target_id: string;
  target_name: string;
  metric_name: string;
  actual_value: number;
  expected_value?: number | null;
  unit: string;
  sample_size: number;
  evidence: Record<string, unknown>;
  notes?: string | null;
  created_at: string;
}

export interface CustomKPI {
  id: string;
  company_id: string;
  name: string;
  description?: string | null;
  industry?: string | null;
  dimension: PerformanceDimension;
  metric_key: string;
  target_benchmark: number;
  warning_threshold?: number | null;
  unit: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DimensionPerformanceSummary {
  dimension: PerformanceDimension;
  completion_rate_pct: number;
  failure_rate_pct: number;
  avg_cycle_time_ms: number;
  resource_efficiency_score: number;
  cost_usd: number;
  rework_count: number;
  quality_score: number;
  human_interventions: number;
  escalation_frequency: number;
  provider_reliability_pct: number;
  task_success_rate_pct: number;
  observations_count: number;
}

export interface PerformanceSummaryResponse {
  company_id: string;
  dimensions: Record<string, DimensionPerformanceSummary>;
  overall_health: string;
  active_bottlenecks: Array<{
    dimension: string;
    target: string;
    issue: string;
    severity: string;
  }>;
}

export interface OrganizationalSnapshot {
  id: string;
  company_id: string;
  name: string;
  reason: string;
  snapshot_data: Record<string, unknown>;
  version: number;
  created_at: string;
}

export interface OrganizationalAdaptation {
  id: string;
  company_id: string;
  title: string;
  adaptation_type: AdaptationType;
  stage: AdaptationStage;
  status: AdaptationStatus;
  trigger_diagnosis: string;
  evidence: Array<Record<string, unknown>>;
  previous_state: Record<string, unknown>;
  proposed_state: Record<string, unknown>;
  expected_improvement: string;
  risk_assessment: string;
  risk_level: string;
  simulation_results: Record<string, unknown>;
  validation_passed: boolean;
  snapshot_id?: string | null;
  approved_by?: string | null;
  deployed_at?: string | null;
  actual_result: Record<string, unknown>;
  rollback_reason?: string | null;
  learning_notes?: string | null;
  created_at: string;
  updated_at: string;
}

export const evolutionApi = {
  // ── Performance Metrics & KPIs ──────────────────────────────────────────
  getSummary: (companyId: string) =>
    api.get<PerformanceSummaryResponse>(`/api/v1/companies/${companyId}/performance/summary`),

  listMetrics: (companyId: string, dimension?: PerformanceDimension) => {
    const q = dimension ? `?dimension=${dimension}` : '';
    return api.get<PerformanceMetric[]>(`/api/v1/companies/${companyId}/performance/metrics${q}`);
  },

  recordMetric: (companyId: string, data: Partial<PerformanceMetric> & Record<string, unknown>) =>
    api.post<PerformanceMetric>(`/api/v1/companies/${companyId}/performance/metrics`, data),

  listKPIs: (companyId: string) =>
    api.get<CustomKPI[]>(`/api/v1/companies/${companyId}/performance/kpis`),

  createKPI: (companyId: string, data: Partial<CustomKPI> & Record<string, unknown>) =>
    api.post<CustomKPI>(`/api/v1/companies/${companyId}/performance/kpis`, data),

  // ── Evolution Engine & Lab ─────────────────────────────────────────────
  listSnapshots: (companyId: string) =>
    api.get<OrganizationalSnapshot[]>(`/api/v1/companies/${companyId}/evolution/snapshots`),

  createSnapshot: (companyId: string, name: string, reason: string) =>
    api.post<OrganizationalSnapshot>(
      `/api/v1/companies/${companyId}/evolution/snapshots?name=${encodeURIComponent(name)}&reason=${encodeURIComponent(reason)}`,
      {}
    ),

  listAdaptations: (companyId: string) =>
    api.get<OrganizationalAdaptation[]>(`/api/v1/companies/${companyId}/evolution/adaptations`),

  getAdaptation: (companyId: string, adaptationId: string) =>
    api.get<OrganizationalAdaptation>(`/api/v1/companies/${companyId}/evolution/adaptations/${adaptationId}`),

  proposeAdaptation: (companyId: string, data: Partial<OrganizationalAdaptation> & Record<string, unknown>) =>
    api.post<OrganizationalAdaptation>(`/api/v1/companies/${companyId}/evolution/propose`, data),

  simulateInLab: (
    companyId: string,
    adaptationId: string,
    data: { synthetic_task_count?: number; stress_multiplier?: number } = {}
  ) =>
    api.post<OrganizationalAdaptation>(
      `/api/v1/companies/${companyId}/evolution/adaptations/${adaptationId}/simulate`,
      data
    ),

  approveAndDeploy: (companyId: string, adaptationId: string, reviewerNotes: string = 'Approved for deployment') =>
    api.post<OrganizationalAdaptation>(
      `/api/v1/companies/${companyId}/evolution/adaptations/${adaptationId}/approve`,
      { reviewer_notes: reviewerNotes }
    ),

  rollback: (companyId: string, adaptationId: string, rollbackReason: string, learningNotes: string) =>
    api.post<OrganizationalAdaptation>(
      `/api/v1/companies/${companyId}/evolution/adaptations/${adaptationId}/rollback`,
      { rollback_reason: rollbackReason, learning_notes: learningNotes }
    ),

  // ── NEIMAN Simulation Lab ──────────────────────────────────────────────
  listSimulationScenarios: (companyId: string) =>
    api.get<SimulationScenario[]>(`/api/v1/companies/${companyId}/simulation/scenarios`),

  getSimulationScenario: (companyId: string, scenarioId: string) =>
    api.get<SimulationScenario>(`/api/v1/companies/${companyId}/simulation/scenarios/${scenarioId}`),

  createSimulationScenario: (
    companyId: string,
    data: {
      name: string;
      description?: string;
      simulated_config: Record<string, unknown>;
      workload_profile?: Record<string, unknown>;
    }
  ) =>
    api.post<SimulationScenario>(`/api/v1/companies/${companyId}/simulation/scenarios`, data),

  runSimulationBenchmark: (
    companyId: string,
    scenarioId: string,
    data: { run_label?: string; workload_tasks_count?: number; concurrency_level?: number } = {}
  ) =>
    api.post<SimulationRun>(`/api/v1/companies/${companyId}/simulation/scenarios/${scenarioId}/run`, data),

  promoteSimulationScenario: (
    companyId: string,
    scenarioId: string,
    data: { approver?: string; notes?: string } = {}
  ) =>
    api.post<SimulationScenario>(`/api/v1/companies/${companyId}/simulation/scenarios/${scenarioId}/promote`, data),
};

export interface SimulationScenario {
  id: string;
  company_id: string;
  name: string;
  description?: string | null;
  is_active: boolean;
  baseline_config: {
    agent_count: number;
    intelligence_budget_monthly_usd: number;
    routing_strategy: string;
    parallel_execution_slots?: number;
    agents_summary?: Array<{ name: string; role: string; model_tier?: string }>;
  };
  simulated_config: {
    agent_count: number;
    intelligence_budget_monthly_usd: number;
    routing_strategy: string;
    parallel_execution_slots?: number;
    policy_rules?: string[];
    [key: string]: unknown;
  };
  workload_profile: {
    tasks_count: number;
    concurrency: number;
    type?: string;
    [key: string]: unknown;
  };
  status: string; // DRAFT | EVALUATED | PROMOTED
  is_promoted: boolean;
  promoted_at?: string | null;
  promoted_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SimulationRun {
  id: string;
  scenario_id: string;
  company_id: string;
  run_label: string;
  workload_tasks_count: number;
  tasks_succeeded: number;
  tasks_failed: number;
  duration_ms: floatNumber;
  metrics_comparison: {
    workload_profile: {
      tasks_count: number;
      concurrency: number;
      routing_strategy: string;
    };
    baseline: {
      agent_count: number;
      monthly_budget_usd: number;
      total_workload_cost_usd: number;
      avg_task_latency_ms: number;
      failure_rate_pct: number;
      quality_score_pct: number;
      estimated_monthly_run_rate_usd: number;
    };
    simulated: {
      agent_count: number;
      monthly_budget_usd: number;
      total_workload_cost_usd: number;
      avg_task_latency_ms: number;
      failure_rate_pct: number;
      quality_score_pct: number;
      estimated_monthly_run_rate_usd: number;
    };
    deltas: {
      cost_delta_pct: number;
      latency_delta_pct: number;
      quality_delta_pct: number;
      failure_rate_delta_pct: number;
    };
  };
  experimental_disclaimer: string;
  insights: string[];
  created_at: string;
}

type floatNumber = number;

