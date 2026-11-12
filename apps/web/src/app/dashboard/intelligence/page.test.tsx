import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import IntelligenceExchangePage from './page';
import { intelligenceApi } from '@/lib/api/intelligence';
import { useAuthStore } from '@/store/auth';

jest.mock('@/lib/api/intelligence', () => ({
  intelligenceApi: {
    getDashboard: jest.fn(),
    getPolicy: jest.fn(),
    generate: jest.fn(),
    updatePolicy: jest.fn(),
    resetCircuitBreakers: jest.fn(),
    probeProvider: jest.fn(),
  },
}));

const mockCompany = {
  id: 'comp-test-1',
  name: 'Acme Autonomous Corp',
  slug: 'acme-corp',
  status: 'ACTIVE',
  owner_id: 'user-1',
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
};

const mockProviders = [
  {
    id: 'anthropic',
    name: 'anthropic',
    display_name: 'Anthropic Claude',
    description: 'Frontier constitutional reasoning and code synthesis',
    is_local: false,
    is_active: true,
    is_healthy: true,
    is_configured: true,
    consecutive_failures: 0,
    created_at: '2026-09-01T00:00:00Z',
  },
  {
    id: 'google_gemini',
    name: 'google_gemini',
    display_name: 'Google Gemini',
    description: 'High-throughput multimodal token envelope processor',
    is_local: false,
    is_active: true,
    is_healthy: true,
    is_configured: true,
    consecutive_failures: 0,
    created_at: '2026-09-01T00:00:00Z',
  },
  {
    id: 'openai',
    name: 'openai',
    display_name: 'OpenAI',
    description: 'Advanced reasoning and tool dispatch',
    is_local: false,
    is_active: true,
    is_healthy: true,
    is_configured: true,
    consecutive_failures: 0,
    created_at: '2026-09-01T00:00:00Z',
  },
  {
    id: 'local',
    name: 'local',
    display_name: 'Local / Air-Gapped',
    description: 'On-premise zero-retention air-gapped sovereign model',
    is_local: true,
    is_active: true,
    is_healthy: true,
    is_configured: true,
    consecutive_failures: 0,
    created_at: '2026-09-01T00:00:00Z',
  },
];

const mockModels = [
  {
    id: 'm-1',
    provider_id: 'anthropic',
    model_identifier: 'claude-3-5-sonnet',
    display_name: 'Claude 3.5 Sonnet',
    description: 'Exceptional reasoning depth and architectural review',
    capabilities: ['reasoning', 'code_generation', 'architectural_reasoning'],
    modalities: ['text', 'vision'],
    context_capacity: 200000,
    supports_tools: true,
    supports_structured_output: true,
    input_cost_per_million: 3.0,
    output_cost_per_million: 15.0,
    avg_latency_ms: 340,
    availability_rate: 0.998,
    privacy_classification: 'PUBLIC_CLOUD',
    is_active: true,
    created_at: '2026-09-01T00:00:00Z',
  },
  {
    id: 'm-2',
    provider_id: 'google_gemini',
    model_identifier: 'gemini-1.5-pro',
    display_name: 'Gemini 1.5 Pro',
    description: 'Massive 2M context window with fast round-trip latency',
    capabilities: ['large_context', 'reasoning', 'multimodal'],
    modalities: ['text', 'audio', 'vision'],
    context_capacity: 2000000,
    supports_tools: true,
    supports_structured_output: true,
    input_cost_per_million: 1.25,
    output_cost_per_million: 5.0,
    avg_latency_ms: 210,
    availability_rate: 0.999,
    privacy_classification: 'PUBLIC_CLOUD',
    is_active: true,
    created_at: '2026-09-01T00:00:00Z',
  },
  {
    id: 'm-3',
    provider_id: 'local',
    model_identifier: 'local-deepseek-r1',
    display_name: 'DeepSeek R1 (Local Air-Gapped)',
    description: 'Zero data egress, air-gapped sovereign inference',
    capabilities: ['reasoning', 'privacy', 'code_generation'],
    modalities: ['text'],
    context_capacity: 64000,
    supports_tools: true,
    supports_structured_output: true,
    input_cost_per_million: 0.0,
    output_cost_per_million: 0.0,
    avg_latency_ms: 580,
    availability_rate: 1.0,
    privacy_classification: 'ON_PREMISE_ZERO_RETENTION',
    is_active: true,
    created_at: '2026-09-01T00:00:00Z',
  },
];

const mockPolicy = {
  id: 'policy-1',
  company_id: 'comp-test-1',
  name: 'Global Enterprise Routing',
  routing_mode: 'AUTOMATIC',
  strategy: 'BALANCED',
  preferred_provider: 'anthropic',
  fallback_provider: 'local',
  max_cost_per_query_usd: 0.5,
  max_acceptable_latency_ms: 5000,
  required_privacy_level: null,
  required_capability: 'reasoning',
  fallback_chain: ['claude-3-5-sonnet', 'gemini-1.5-pro', 'local-deepseek-r1'],
  capability_preferences: {},
  is_default: true,
  created_at: '2026-09-01T00:00:00Z',
};

const mockDashboard = {
  total_requests: 1240,
  total_tokens_consumed: 4850000,
  total_spend_usd: 14.82,
  avg_latency_ms: 320,
  overall_success_rate: 0.996,
  providers_count: 4,
  models_count: 3,
  healthy_providers_count: 4,
  available_providers: mockProviders,
  available_models: mockModels,
  recent_routing_decisions: [
    {
      id: 'dec-1',
      requested_capability: 'reasoning',
      provider: 'anthropic',
      model: 'claude-3-5-sonnet',
      cost_usd: 0.0045,
      latency_ms: 330,
      routed_tier: 'PRIMARY',
      fallback: false,
      attempts_count: 1,
      circuit_breaker_status: 'CLOSED',
      success: true,
      created_at: '2026-09-30T14:00:00Z',
    },
  ],
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <IntelligenceExchangePage />
    </QueryClientProvider>
  );
}

describe('NEIMAN Intelligence Exchange UI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.getState().setActiveCompany(mockCompany);
    (intelligenceApi.getDashboard as jest.Mock).mockResolvedValue(mockDashboard);
    (intelligenceApi.getPolicy as jest.Mock).mockResolvedValue(mockPolicy);
    (intelligenceApi.updatePolicy as jest.Mock).mockResolvedValue(mockPolicy);
    (intelligenceApi.resetCircuitBreakers as jest.Mock).mockResolvedValue({ status: 'ok' });
  });

  it('renders Intelligence Exchange title and the interactive Architecture Topology Diagram', async () => {
    renderPage();

    expect(await screen.findByText('NEIMAN Intelligence Exchange')).toBeInTheDocument();
    expect(screen.getByText('NEIMAN Intelligence Exchange Architecture')).toBeInTheDocument();
    expect(screen.getByText('NEIMAN ROUTING ENGINE')).toBeInTheDocument();

    // Verify Upstream Providers row in SVG Diagram
    expect(await screen.findByText('Anthropic Claude')).toBeInTheDocument();
    expect(await screen.findByText('Google Gemini')).toBeInTheDocument();
    expect(await screen.findByText('Local / Air-Gapped')).toBeInTheDocument();
  });

  it('renders measurable model comparison matrix with verified latencies, costs, and privacy', async () => {
    renderPage();

    // Switch to Model Comparison Benchmark tab
    const matrixTab = await screen.findByRole('button', { name: /Model Comparison Benchmark/i });
    fireEvent.click(matrixTab);

    // Verify factual header & model rows
    expect(await screen.findByText('Factual Model Capabilities & Measurable Performance Benchmark')).toBeInTheDocument();
    expect(screen.getByText('Claude 3.5 Sonnet')).toBeInTheDocument();
    expect(screen.getByText('Gemini 1.5 Pro')).toBeInTheDocument();
    expect(screen.getByText('DeepSeek R1 (Local Air-Gapped)')).toBeInTheDocument();

    // Verify measurable properties: context, cost, latency, privacy
    expect(screen.getByText('200k')).toBeInTheDocument();
    expect(screen.getByText('$3.00')).toBeInTheDocument();
    expect(screen.getByText('340 ms')).toBeInTheDocument();
    expect(screen.getAllByText('ON_PREMISE_ZERO_RETENTION').length).toBeGreaterThan(0);
  });

  it('allows clicking a model to open the Model Details Modal with complete specification', async () => {
    renderPage();

    const matrixTab = await screen.findByRole('button', { name: /Model Comparison Benchmark/i });
    fireEvent.click(matrixTab);

    // Click on Claude 3.5 Sonnet row
    const claudeText = await screen.findByText('Claude 3.5 Sonnet');
    fireEvent.click(claudeText);

    // Model Details Modal opens
    expect(await screen.findByText('Model Specification & Telemetry')).toBeInTheDocument();
    expect(screen.getByText('Function & Tool Calling Support')).toBeInTheDocument();
    expect(screen.getByText('Strict JSON Schema Validation')).toBeInTheDocument();
  });

  it('displays Provider Health Directory and allows resetting circuit breakers', async () => {
    renderPage();

    const providersTab = await screen.findByRole('button', { name: /Provider Health & Adapters/i });
    fireEvent.click(providersTab);

    expect(await screen.findByText('Universal AI Provider Directory & Key Vault')).toBeInTheDocument();

    const resetBtns = screen.getAllByRole('button', { name: /Reset Breakers/i });
    fireEvent.click(resetBtns[0]);

    await waitFor(() => {
      expect(intelligenceApi.resetCircuitBreakers).toHaveBeenCalled();
    });
  });

  it('renders the Routing Policy Editor supporting Automatic, Manual, Agent Preference, and Company Policy', async () => {
    renderPage();

    const policyTab = await screen.findByRole('button', { name: /Routing Policy & Fallbacks/i });
    fireEvent.click(policyTab);

    expect(await screen.findByText('Multi-Provider Routing Policy Configuration')).toBeInTheDocument();
    expect(screen.getByText('Automatic Routing')).toBeInTheDocument();
    expect(screen.getByText('Manual Routing')).toBeInTheDocument();
    expect(screen.getByText('Agent Preference')).toBeInTheDocument();
    expect(screen.getByText('Company Policy')).toBeInTheDocument();

    // Save policy
    const saveBtn = screen.getByRole('button', { name: /Save Policy Configuration/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(intelligenceApi.updatePolicy).toHaveBeenCalled();
    });
  });

  it('allows live ping probing and fault injection simulation on providers', async () => {
    (intelligenceApi.probeProvider as jest.Mock).mockResolvedValue({
      provider: 'anthropic',
      display_name: 'Anthropic Claude',
      is_healthy: true,
      circuit_breaker_status: 'CLOSED',
      consecutive_failures: 0,
      latency_ms: 142,
      measured_latency_ms: 142,
      message: 'Provider responded successfully (142ms)',
      detail: 'Provider responded successfully (142ms)',
      timestamp: '2026-10-02T10:00:00Z',
    });

    renderPage();

    const providersTab = await screen.findByRole('button', { name: /Provider Health & Adapters/i });
    fireEvent.click(providersTab);

    expect(await screen.findByText('Universal AI Provider Directory & Key Vault')).toBeInTheDocument();

    const probeButtons = screen.getAllByRole('button', { name: /Ping Probe/i });
    expect(probeButtons.length).toBeGreaterThan(0);

    fireEvent.click(probeButtons[0]);

    await waitFor(() => {
      expect(intelligenceApi.probeProvider).toHaveBeenCalledWith(
        mockCompany.id,
        'anthropic',
        undefined
      );
    });

    expect(await screen.findByText('142ms')).toBeInTheDocument();
    expect(screen.getByText('Provider responded successfully (142ms)')).toBeInTheDocument();
  });
});
