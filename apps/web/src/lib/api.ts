import { z } from 'zod';
import { getApiBaseUrl } from '@neiman/config';

export interface ApiClientOptions {
  baseUrl?: string;
  getToken?: () => string | null;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public data: unknown,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function createApiClient(options: ApiClientOptions = {}) {
  const { baseUrl = getApiBaseUrl(), getToken } = options;

  async function request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = getToken?.();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let data: Record<string, unknown> | null = null;
      try {
        data = (await response.json()) as Record<string, unknown>;
      } catch {
        data = { detail: response.statusText };
      }
      throw new ApiError(
        response.status,
        data,
        (typeof data?.detail === 'string' && data.detail) || `API Error: ${response.status}`
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  return {
    get: <T>(path: string) => request<T>(path, { method: 'GET' }),
    post: <T>(path: string, body: unknown) => request<T>(path, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
    patch: <T>(path: string, body: unknown) => request<T>(path, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
    delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  };
}

// Intelligence Exchange Types
export const ModelProviderSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  display_name: z.string(),
  description: z.string().nullable(),
  website_url: z.string().nullable(),
  is_active: z.boolean(),
  is_local: z.boolean(),
  is_healthy: z.boolean(),
  consecutive_failures: z.number(),
  last_health_check_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const ModelSchema = z.object({
  id: z.string().uuid(),
  provider_id: z.string().uuid(),
  model_identifier: z.string(),
  display_name: z.string(),
  description: z.string().nullable(),
  capabilities: z.array(z.string()),
  modalities: z.array(z.string()),
  tool_support: z.boolean(),
  structured_output_support: z.boolean(),
  context_capacity: z.number(),
  max_output_tokens: z.number(),
  input_cost_per_million: z.number(),
  output_cost_per_million: z.number(),
  avg_latency_ms: z.number(),
  availability_rate: z.number(),
  privacy_classification: z.string(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const ModelRequestSchema = z.object({
  prompt: z.string(),
  system_prompt: z.string().optional(),
  required_capabilities: z.array(z.string()).optional(),
  context_tokens_needed: z.number().optional(),
  max_acceptable_cost_usd: z.number().optional(),
  required_privacy: z.string().optional(),
  preferred_model: z.string().optional(),
  allow_fallback: z.boolean().default(true),
});

export const ModelResponsePayloadSchema = z.object({
  text: z.string(),
  model_used: z.string(),
  provider_used: z.string(),
  prompt_tokens: z.number(),
  completion_tokens: z.number(),
  total_tokens: z.number(),
  estimated_cost_usd: z.number(),
  latency_ms: z.number(),
  routed_via_fallback: z.boolean().optional(),
  fallback_reason: z.string().nullable().optional(),
});

export const IntelligenceDashboardSchema = z.object({
  total_requests: z.number(),
  total_tokens_consumed: z.number(),
  total_spend_usd: z.number(),
  avg_latency_ms: z.number(),
  overall_success_rate: z.number(),
  providers_count: z.number(),
  models_count: z.number(),
  healthy_providers_count: z.number(),
  recent_routing_decisions: z.array(z.object({
    id: z.string(),
    requested_capability: z.string().nullable(),
    provider: z.string(),
    model: z.string(),
    cost_usd: z.number(),
    latency_ms: z.number(),
    fallback: z.boolean(),
    fallback_reason: z.string().nullable(),
    success: z.boolean(),
    created_at: z.string(),
  })),
  available_providers: z.array(ModelProviderSchema),
  available_models: z.array(ModelSchema),
});

export type ModelProvider = z.infer<typeof ModelProviderSchema>;
export type Model = z.infer<typeof ModelSchema>;
export type ModelRequest = z.infer<typeof ModelRequestSchema>;
export type ModelResponsePayload = z.infer<typeof ModelResponsePayloadSchema>;
export type IntelligenceDashboard = z.infer<typeof IntelligenceDashboardSchema>;

// Intelligence API
export function createIntelligenceApi(client: ReturnType<typeof createApiClient>) {
  return {
    getDashboard: (companyId: string) => client.get<IntelligenceDashboard>(`/companies/${companyId}/intelligence/dashboard`),
    generate: (companyId: string, body: ModelRequest) => client.post<ModelResponsePayload>(`/companies/${companyId}/intelligence/generate`, body),
    listProviders: (companyId: string) => client.get<ModelProvider[]>(`/companies/${companyId}/intelligence/providers`),
    addProvider: (companyId: string, body: Partial<ModelProvider>) => client.post<ModelProvider>(`/companies/${companyId}/intelligence/providers`, body),
    listModels: (companyId: string) => client.get<Model[]>(`/companies/${companyId}/intelligence/models`),
    addModel: (companyId: string, body: Partial<Model>) => client.post<Model>(`/companies/${companyId}/intelligence/models`, body),
  };
}