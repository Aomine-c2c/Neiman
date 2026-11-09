/**
 * NEIMAN Intelligence Exchange API Client
 */

import { api } from './client';

export interface ModelProvider {
  id: string;
  name: string;
  display_name: string;
  description?: string | null;
  website_url?: string | null;
  base_url?: string | null;
  is_configured: boolean;
  api_key_masked?: string | null;
  is_local: boolean;
  is_active: boolean;
  is_healthy: boolean;
  consecutive_failures: number;
  last_health_check_at?: string | null;
  created_at: string;
}

export interface ProviderConfigureRequest {
  api_key?: string;
  base_url?: string;
  auto_discover?: boolean;
  set_as_primary?: boolean;
}

export interface ProviderConfigureResponse {
  provider_name: string;
  display_name: string;
  is_configured: boolean;
  is_healthy: boolean;
  base_url?: string | null;
  api_key_masked?: string | null;
  discovered_models_count: number;
  models: string[];
  message: string;
}

export interface Model {
  id: string;
  provider_id: string;
  model_identifier: string;
  display_name: string;
  description?: string | null;
  capabilities: string[];
  modalities: string[];
  context_capacity: number;
  max_output_tokens?: number;
  supports_tools?: boolean;
  tool_support?: boolean;
  supports_structured_output?: boolean;
  structured_output_support?: boolean;
  input_cost_per_million: number;
  output_cost_per_million: number;
  avg_latency_ms: number;
  availability_rate?: number;
  privacy_classification: string;
  is_active: boolean;
  created_at: string;
}

export type RoutingMode = 'AUTOMATIC' | 'MANUAL' | 'AGENT_PREFERENCE' | 'COMPANY_POLICY';

export interface ModelRoutingPolicy {
  id: string;
  company_id: string;
  name: string;
  description?: string | null;
  routing_mode?: RoutingMode;
  preferred_provider?: string | null;
  fallback_provider?: string | null;
  strategy: 'BALANCED' | 'LOWEST_COST' | 'LOWEST_LATENCY' | 'HIGHEST_CAPABILITY' | 'STRICT_PRIVACY';
  max_cost_per_query_usd: number;
  max_acceptable_latency_ms: number;
  required_privacy_level?: string | null;
  required_capability?: string | null;
  fallback_chain: string[];
  capability_preferences: Record<string, string>;
  is_default: boolean;
  created_at: string;
}

export interface ModelRoutingPolicyUpdate {
  name?: string;
  description?: string;
  routing_mode?: RoutingMode;
  preferred_provider?: string | null;
  fallback_provider?: string | null;
  strategy?: 'BALANCED' | 'LOWEST_COST' | 'LOWEST_LATENCY' | 'HIGHEST_CAPABILITY' | 'STRICT_PRIVACY';
  max_cost_per_query_usd?: number;
  max_acceptable_latency_ms?: number;
  required_privacy_level?: string | null;
  required_capability?: string | null;
  fallback_chain?: string[];
  capability_preferences?: Record<string, string>;
  is_default?: boolean;
}

export interface RoutingDecisionLog {
  id: string;
  requested_capability: string;
  provider: string;
  model: string;
  cost_usd: number;
  latency_ms: number;
  routed_tier?: string;
  fallback: boolean;
  fallback_reason?: string | null;
  attempts_count?: number;
  routing_trace?: Array<{
    tier: string;
    provider: string;
    model: string;
    action: string;
    attempt?: number;
    error?: string;
    reason?: string;
  }>;
  circuit_breaker_status?: string;
  success: boolean;
  created_at: string;
}

export interface DepletedModelStatus {
  model_identifier: string;
  remaining_seconds: number;
  depleted_until_timestamp: number;
  cooldown_duration_seconds: number;
}

export interface IntelligenceDashboardData {
  total_requests: number;
  total_tokens_consumed: number;
  total_spend_usd: number;
  avg_latency_ms: number;
  overall_success_rate: number;
  providers_count: number;
  models_count: number;
  healthy_providers_count: number;
  active_provider?: string | null;
  active_model?: string | null;
  active_provider_display?: string | null;
  fallback_chain?: string[];
  recent_routing_decisions: RoutingDecisionLog[];
  available_providers: ModelProvider[];
  available_models: Model[];
  depleted_models?: DepletedModelStatus[];
}

export interface GenerateRequest {
  prompt: string;
  system_prompt?: string;
  required_capabilities?: string[];
  context_tokens_needed?: number;
  preferred_provider?: string;
  preferred_model?: string;
  allow_fallback?: boolean;
  max_acceptable_cost_usd?: number;
  token_ceiling?: number;
  timeout_seconds?: number;
  required_privacy?: string;
  temperature?: number;
  max_tokens?: number;
  structured_output_schema?: Record<string, unknown>;
  simulation_flags?: Record<string, string>;
  enable_token_compression?: boolean;
  compression_strategy?: 'DYNAMIC' | 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE' | 'TRIPLETS';
}

export interface GenerateResponse {
  text: string;
  model_used: string;
  provider_used: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
  latency_ms: number;
  routed_tier: string;
  routed_via_fallback: boolean;
  fallback_reason?: string | null;
  attempts_count: number;
  routing_trace: Array<{
    tier: string;
    provider: string;
    model: string;
    action: string;
    attempt?: number;
    error?: string;
    reason?: string;
  }>;
  structured_output_validated: boolean;
  circuit_breaker_status: string;
  // Built-in Token Compression Telemetry
  compression_applied?: boolean;
  original_prompt_tokens?: number;
  compressed_prompt_tokens?: number;
  tokens_saved?: number;
  compression_ratio_pct?: number;
  cost_saved_usd?: number;
}

export interface TokenCompressionRequest {
  text: string;
  strategy?: 'DYNAMIC' | 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE' | 'TRIPLETS';
}

export interface TokenCompressionBreakdown {
  filler_tokens_saved: number;
  whitespace_tokens_saved: number;
  json_tokens_saved: number;
  discourse_tokens_saved: number;
}

export interface TokenCompressionResponse {
  original_text: string;
  compressed_text: string;
  original_tokens: number;
  compressed_tokens: number;
  tokens_saved: number;
  compression_ratio_pct: number;
  strategy_used: string;
  breakdown?: TokenCompressionBreakdown;
  estimated_cost_saved_usd: number;
  latency_ms?: number;
  timestamp: string;
}

export interface BatchTokenCompressionRequest {
  texts: string[];
  strategy?: 'DYNAMIC' | 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE' | 'TRIPLETS';
}

export interface BatchTokenCompressionResponse {
  results: TokenCompressionResponse[];
  total_original_tokens: number;
  total_compressed_tokens: number;
  total_tokens_saved: number;
  overall_compression_ratio_pct: number;
  total_cost_saved_usd: number;
  total_latency_ms: number;
  timestamp: string;
}

export interface TokenCompressionStatsResponse {
  total_requests_compressed: number;
  total_tokens_saved: number;
  average_compression_ratio_pct: number;
  total_estimated_usd_saved: number;
  most_effective_strategy: string;
  active_strategies: string[];
}

export interface ProviderProbeRequest {
  simulated_latency_ms?: number;
  simulate_error?: string | null;
}

export interface ProviderProbeResponse {
  provider: string;
  display_name: string;
  is_healthy: boolean;
  latency_ms: number;
  circuit_breaker_status: string;
  consecutive_failures: number;
  message: string;
  timestamp: string;
  // Backward compatibility alias properties if needed
  measured_latency_ms?: number;
  detail?: string;
}

export const intelligenceApi = {
  getDashboard: (companyId: string): Promise<IntelligenceDashboardData> =>
    api.get<IntelligenceDashboardData>(`/api/v1/companies/${companyId}/intelligence/dashboard`),

  getPolicy: (companyId: string): Promise<ModelRoutingPolicy> =>
    api.get<ModelRoutingPolicy>(`/api/v1/companies/${companyId}/intelligence/policy`),

  updatePolicy: (companyId: string, policy: ModelRoutingPolicyUpdate): Promise<ModelRoutingPolicy> =>
    api.put<ModelRoutingPolicy>(`/api/v1/companies/${companyId}/intelligence/policy`, policy),

  listProviders: (companyId: string): Promise<ModelProvider[]> =>
    api.get<ModelProvider[]>(`/api/v1/companies/${companyId}/intelligence/providers`),

  listModels: (companyId: string): Promise<Model[]> =>
    api.get<Model[]>(`/api/v1/companies/${companyId}/intelligence/models`),

  probeProvider: (
    companyId: string,
    providerName: string,
    body?: ProviderProbeRequest
  ): Promise<ProviderProbeResponse> =>
    api.post<ProviderProbeResponse>(
      `/api/v1/companies/${companyId}/intelligence/providers/${providerName}/probe`,
      body || {}
    ),

  configureProvider: (
    companyId: string,
    providerName: string,
    body: ProviderConfigureRequest
  ): Promise<ProviderConfigureResponse> =>
    api.post<ProviderConfigureResponse>(
      `/api/v1/companies/${companyId}/intelligence/providers/${providerName}/configure`,
      body
    ),

  syncProviderModels: (companyId: string) =>
    api.post<{
      total_providers_checked: number;
      synced_providers: Array<{
        provider_name: string;
        display_name: string;
        discovered_count: number;
        added_count: number;
        deactivated_count: number;
        active_models_count: number;
      }>;
      total_models_active: number;
      total_models_soft_deactivated: number;
      total_models_added: number;
      total_agents_auto_bound?: number;
    }>(`/api/v1/companies/${companyId}/intelligence/providers/sync-models`),

  generate: (companyId: string, body: GenerateRequest): Promise<GenerateResponse> =>
    api.post<GenerateResponse>(`/api/v1/companies/${companyId}/intelligence/generate`, body),

  compressText: (
    companyId: string,
    body: TokenCompressionRequest
  ): Promise<TokenCompressionResponse> =>
    api.post<TokenCompressionResponse>(`/api/v1/companies/${companyId}/intelligence/compress`, body),

  compressBatch: (
    companyId: string,
    body: BatchTokenCompressionRequest
  ): Promise<BatchTokenCompressionResponse> =>
    api.post<BatchTokenCompressionResponse>(`/api/v1/companies/${companyId}/intelligence/compress/batch`, body),

  getCompressionStats: (
    companyId: string
  ): Promise<TokenCompressionStatsResponse> =>
    api.get<TokenCompressionStatsResponse>(`/api/v1/companies/${companyId}/intelligence/compress/stats`),

  resetCircuitBreakers: (companyId: string): Promise<{ status: string; message: string }> =>
    api.post<{ status: string; message: string }>(`/api/v1/companies/${companyId}/intelligence/circuit-breakers/reset`, {}),

  createProvider: (companyId: string, body: {
    name: string;
    display_name: string;
    description?: string;
    website_url?: string;
    is_local?: boolean;
  }): Promise<ModelProvider> =>
    api.post<ModelProvider>(`/api/v1/companies/${companyId}/intelligence/providers`, body),

  createModel: (companyId: string, body: {
    provider_id: string;
    model_identifier: string;
    display_name: string;
    description?: string;
    capabilities?: string[];
    modalities?: string[];
    tool_support?: boolean;
    structured_output_support?: boolean;
    context_capacity?: number;
    max_output_tokens?: number;
    input_cost_per_million?: number;
    output_cost_per_million?: number;
    avg_latency_ms?: number;
    availability_rate?: number;
    privacy_classification?: string;
  }): Promise<Model> =>
    api.post<Model>(`/api/v1/companies/${companyId}/intelligence/models`, body),

  proxyChatCompletion: (
    companyId: string,
    body: ProxyChatCompletionRequest
  ): Promise<ProxyChatCompletionResponse> =>
    api.post<ProxyChatCompletionResponse>(
      `/api/v1/companies/${companyId}/intelligence/proxy/chat/completions`,
      body
    ),

  getMeshTelemetry: (companyId: string): Promise<MeshTelemetryResponse> =>
    api.get<MeshTelemetryResponse>(
      `/api/v1/companies/${companyId}/intelligence/mesh-telemetry`
    ),
};

export interface MeshTelemetryResponse {
  providers: Array<{
    id: string;
    name: string;
    is_enabled: boolean;
    is_healthy: boolean;
    latency_ms: number;
    circuit_breaker_state: string;
  }>;
  depleted_cooldowns: Array<{
    model_identifier: string;
    remaining_seconds: number;
    depleted_until_timestamp: number;
    cooldown_duration_seconds: number;
  }>;
  fleet_burn: {
    tokens_per_min: number;
    estimated_hourly_spend_usd: number;
    compression_ratio_pct: number;
    cache_hit_rate_pct: number;
  };
}

export interface ProxyChatMessage {
  role: 'system' | 'user' | 'assistant' | 'function' | 'tool';
  content: string;
  name?: string;
}

export interface ProxyChatCompletionRequest {
  messages: ProxyChatMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  enable_token_compression?: boolean;
  compression_strategy?: 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE' | 'TRIPLETS';
  allow_fallback?: boolean;
  required_capabilities?: string[];
}

export interface ProxyChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: ProxyChatMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    compressed_tokens_saved: number;
    compression_ratio_pct: number;
  };
  routed_provider: string;
  routed_tier: string;
  routed_via_fallback: boolean;
  fallback_attempts: number;
  latency_ms: number;
  estimated_cost_usd: number;
}


