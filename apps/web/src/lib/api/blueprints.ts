/**
 * NEIMAN Company Blueprints & Build My Company API Client
 *
 * Supports:
 * - 10 Core Domain Blueprints (Software, Forex, Marketing, Social Media, Cybersecurity,
 *   Research, E-commerce, Game Studio, IT Services, Education)
 * - CREATE FROM BLUEPRINT
 * - CUSTOMIZE, DUPLICATE, EXPORT, IMPORT, SAVE AS TEMPLATE
 * - BUILD MY COMPANY (Natural language organizational synthesis with risk & cost estimation)
 */

import { api } from './client';

export interface BlueprintCompanyDefinition {
  name: string;
  mission: string;
  vision: string;
  industry: string;
  dna?: Record<string, unknown>;
}

export interface BlueprintDepartment {
  name: string;
  purpose: string;
}

export interface BlueprintRole {
  department_name: string;
  title: string;
  responsibilities: string[];
  capabilities: string[];
  authority?: string;
  autonomy_level?: number;
}

export interface BlueprintAgent {
  name: string;
  role_title: string;
  department_name: string;
  system_instructions: string;
  responsibilities: string[];
  capabilities: string[];
  tools?: Array<Record<string, unknown>>;
  autonomy_level: number;
  intelligence_config?: Record<string, unknown>;
  resource_limits?: Record<string, unknown>;
}

export interface BlueprintWorkflow {
  name: string;
  description: string;
  trigger_type: string;
  steps: Array<Record<string, unknown>>;
}

export interface BlueprintPolicy {
  name: string;
  description: string;
  scope: string;
  rules: Array<Record<string, unknown>>;
  enforcement_level: string;
}

export interface BlueprintConstitution {
  mission: string;
  values: string[];
  operating_principles: string[];
  prohibited_actions: string[];
  approval_requirements: string[];
  security_rules: string[];
  financial_rules: string[];
  data_rules: string[];
  autonomy_boundaries: Record<string, unknown>;
  escalation_rules: string[];
}

export interface CompanyBlueprint {
  id: string;
  key: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  icon: string;
  is_system_template: boolean;
  version: number;
  company_definition: BlueprintCompanyDefinition;
  departments: BlueprintDepartment[];
  roles: BlueprintRole[];
  agents: BlueprintAgent[];
  workflows: BlueprintWorkflow[];
  policies: BlueprintPolicy[];
  constitution: BlueprintConstitution;
  recommended_tools: Array<Record<string, unknown>>;
  intelligence_requirements: Record<string, unknown>;
  resource_policies: Record<string, unknown>;
  kpis: Array<{ metric: string; target: string; frequency?: string }>;
  approval_rules: Array<{ operation: string; required_role: string; risk: string }>;
  default_autonomy: number;
  escalation_rules: Array<{ trigger: string; target_role: string; timeframe_minutes?: number }>;
  estimated_monthly_cost_usd: number;
  metadata_tags: string[];
  created_at: string;
  updated_at: string;
}

export interface CompanyBlueprintCreate {
  key: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  icon?: string;
  company_definition: BlueprintCompanyDefinition;
  departments: BlueprintDepartment[];
  roles: BlueprintRole[];
  agents: BlueprintAgent[];
  workflows: BlueprintWorkflow[];
  policies: BlueprintPolicy[];
  constitution: BlueprintConstitution;
  recommended_tools?: Array<Record<string, unknown>>;
  intelligence_requirements?: Record<string, unknown>;
  resource_policies?: Record<string, unknown>;
  kpis?: Array<Record<string, unknown>>;
  approval_rules?: Array<Record<string, unknown>>;
  default_autonomy?: number;
  escalation_rules?: Array<Record<string, unknown>>;
  estimated_monthly_cost_usd?: number;
  metadata_tags?: string[];
}

export interface CompanyBlueprintUpdate {
  name?: string;
  tagline?: string;
  description?: string;
  category?: string;
  icon?: string;
  company_definition?: Partial<BlueprintCompanyDefinition>;
  departments?: BlueprintDepartment[];
  roles?: BlueprintRole[];
  agents?: BlueprintAgent[];
  workflows?: BlueprintWorkflow[];
  policies?: BlueprintPolicy[];
  constitution?: Partial<BlueprintConstitution>;
  recommended_tools?: Array<Record<string, unknown>>;
  intelligence_requirements?: Record<string, unknown>;
  resource_policies?: Record<string, unknown>;
  kpis?: Array<Record<string, unknown>>;
  approval_rules?: Array<Record<string, unknown>>;
  default_autonomy?: number;
  escalation_rules?: Array<Record<string, unknown>>;
  estimated_monthly_cost_usd?: number;
  metadata_tags?: string[];
}

export interface InstantiateBlueprintRequest {
  company_name?: string;
  industry_override?: string;
  customizations?: Record<string, unknown>;
}

export interface InstantiateBlueprintResponse {
  company_id: string;
  company_name: string;
  slug: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
  company_status: string;
  departments_created: number;
  roles_created: number;
  agents_created: number;
  workflows_created: number;
  policies_created: number;
  projects_created?: number;
  tasks_created?: number;
  constitution_established: boolean;
  status: string;
  message: string;
}

export interface SaveAsTemplateRequest {
  company_id: string;
  template_key: string;
  template_name: string;
  description: string;
  category?: string;
}

export interface BuildMyCompanyRequest {
  description: string;
  target_budget_monthly_usd?: number;
  preferred_autonomy_level?: number;
}

export interface BuildMyCompanyProposal {
  id: string;
  prompt: string;
  status: string; // PROPOSED | SIMULATED | INSTANTIATED | DISCARDED
  proposed_blueprint: {
    name?: string;
    tagline?: string;
    description?: string;
    category?: string;
    default_autonomy?: number;
    company_definition?: BlueprintCompanyDefinition;
    departments?: BlueprintDepartment[];
    roles?: BlueprintRole[];
    agents?: BlueprintAgent[];
    workflows?: BlueprintWorkflow[];
    policies?: BlueprintPolicy[];
    constitution?: BlueprintConstitution;
    [key: string]: unknown;
  };
  estimated_operating_cost: {
    total_monthly_usd: number;
    token_cost_usd?: number;
    compute_cost_usd?: number;
    operational_overhead_usd?: number;
    staffing_ratio?: string;
  };
  risks_identified: Array<{
    category: string;
    description: string;
    mitigation: string;
    severity: string;
  }>;
  generation_stages: {
    user_description: string;
    requirement_analysis: Record<string, unknown>;
    industry_identification: string;
    organizational_design: Record<string, unknown>;
    department_generation: Array<Record<string, unknown>>;
    role_generation: Array<Record<string, unknown>>;
    agent_generation: Array<Record<string, unknown>>;
    workflow_generation: Array<Record<string, unknown>>;
    policy_generation: Array<Record<string, unknown>>;
    resource_model: Record<string, unknown>;
    intelligence_requirements: Record<string, unknown>;
    risk_analysis: Array<Record<string, unknown>>;
  };
  simulation_results?: {
    test_workload_size: number;
    concurrency_level: number;
    simulated_tasks_succeeded: number;
    simulated_tasks_failed: number;
    avg_latency_ms: number;
    estimated_run_cost_usd: number;
    quality_benchmark_pct: number;
    dry_run_disclaimer: string;
  } | null;
  human_approval_requirements: Array<{
    gate: string;
    description: string;
    required_authority: string;
  }>;
  estimated_operational_complexity: string; // LOW | MODERATE | HIGH
  instantiated_company_id?: string | null;
  created_at: string;
}

export const blueprintsApi = {
  /** List all system & custom templates, optionally filter by category */
  listBlueprints: async (category?: string): Promise<CompanyBlueprint[]> => {
    const params = category ? `?category=${encodeURIComponent(category)}` : '';
    return api.get<CompanyBlueprint[]>(`/api/v1/blueprints${params}`);
  },

  /** Inspect full specification of a blueprint */
  getBlueprint: async (idOrKey: string): Promise<CompanyBlueprint> => {
    return api.get<CompanyBlueprint>(`/api/v1/blueprints/${encodeURIComponent(idOrKey)}`);
  },

  /** Create custom blueprint */
  createBlueprint: async (data: CompanyBlueprintCreate): Promise<CompanyBlueprint> => {
    return api.post<CompanyBlueprint>('/api/v1/blueprints', data);
  },

  /** Update/customize blueprint before activation */
  updateBlueprint: async (blueprintId: string, data: CompanyBlueprintUpdate): Promise<CompanyBlueprint> => {
    return api.patch<CompanyBlueprint>(`/api/v1/blueprints/${blueprintId}`, data);
  },

  /** Instantiate blueprint into real operational company */
  instantiateBlueprint: async (
    idOrKey: string,
    req: InstantiateBlueprintRequest = {}
  ): Promise<InstantiateBlueprintResponse> => {
    return api.post<InstantiateBlueprintResponse>(`/api/v1/blueprints/${encodeURIComponent(idOrKey)}/instantiate`, req);
  },

  /** Duplicate blueprint */
  duplicateBlueprint: async (blueprintId: string): Promise<CompanyBlueprint> => {
    return api.post<CompanyBlueprint>(`/api/v1/blueprints/${blueprintId}/duplicate`, {});
  },

  /** Export blueprint specification as JSON */
  exportBlueprint: async (blueprintId: string): Promise<Record<string, unknown>> => {
    return api.get<Record<string, unknown>>(`/api/v1/blueprints/${blueprintId}/export`);
  },

  /** Import blueprint from JSON specification */
  importBlueprint: async (payload: Record<string, unknown>): Promise<CompanyBlueprint> => {
    return api.post<CompanyBlueprint>('/api/v1/blueprints/import', payload);
  },

  /** Save active company as reusable blueprint template */
  saveAsTemplate: async (req: SaveAsTemplateRequest): Promise<CompanyBlueprint> => {
    return api.post<CompanyBlueprint>('/api/v1/blueprints/save-template', req);
  },

  /** BUILD MY COMPANY: Natural language organizational synthesis */
  buildMyCompany: async (req: BuildMyCompanyRequest): Promise<BuildMyCompanyProposal> => {
    return api.post<BuildMyCompanyProposal>('/api/v1/blueprints/build-my-company', req);
  },

  /** Inspect a synthesized proposal */
  getProposal: async (proposalId: string): Promise<BuildMyCompanyProposal> => {
    return api.get<BuildMyCompanyProposal>(`/api/v1/blueprints/build-my-company/${proposalId}`);
  },

  /** Modify proposal (allows user to change everything before review & approval) */
  updateProposal: async (
    proposalId: string,
    data: {
      proposed_blueprint?: Record<string, unknown>;
      target_budget_monthly_usd?: number;
      preferred_autonomy_level?: number;
    }
  ): Promise<BuildMyCompanyProposal> => {
    return api.patch<BuildMyCompanyProposal>(`/api/v1/blueprints/build-my-company/${proposalId}`, data);
  },

  /** SIMULATE: Dry-run benchmark workload against proposal before approval */
  simulateProposal: async (
    proposalId: string,
    data: { test_workload_size?: number; concurrency_level?: number } = {}
  ): Promise<BuildMyCompanyProposal> => {
    return api.post<BuildMyCompanyProposal>(`/api/v1/blueprints/build-my-company/${proposalId}/simulate`, data);
  },

  /** APPROVE & INSTANTIATE: Never silently creates organization without confirmation */
  instantiateProposal: async (
    proposalId: string,
    data: {
      approved_by?: string;
      confirmation_statement?: string;
      custom_company_name?: string;
      customizations?: Record<string, unknown>;
    } = {}
  ): Promise<InstantiateBlueprintResponse> => {
    return api.post<InstantiateBlueprintResponse>(
      `/api/v1/blueprints/build-my-company/${proposalId}/instantiate`,
      data
    );
  },
};

