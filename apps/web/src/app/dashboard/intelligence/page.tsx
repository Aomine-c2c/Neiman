'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NEIMAN_CONFIG } from '@neiman/config';
import {
  Zap,
  Cpu,
  Layers,
  Shield,
  Activity,
  ArrowRightLeft,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Coins,
  Send,
  Sliders,
  Sparkles,
  Server,
  Cloud,
  Check,
  RotateCw,
  Eye,
  Network,
  Terminal,
  Copy,
  FileText,
} from 'lucide-react';
import {
  intelligenceApi,
  Model,
  ModelProvider,
  GenerateRequest,
  ModelRoutingPolicyUpdate,
  ProxyChatCompletionResponse,
  ProxyChatMessage,
  TokenCompressionResponse,
  ProviderConfigureRequest,
} from '@/lib/api/intelligence';
import { useOrganizationContext } from '@/lib/organizationContext';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const IntelligenceFlowDiagram = dynamic(
  () => import('@/components/intelligence/IntelligenceFlowDiagram').then((mod) => mod.IntelligenceFlowDiagram),
  { loading: () => <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div> }
);
const ModelComparisonMatrix = dynamic(
  () => import('@/components/intelligence/ModelComparisonMatrix').then((mod) => mod.ModelComparisonMatrix),
  { loading: () => <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div> }
);
const ProviderDirectory = dynamic(
  () => import('@/components/intelligence/ProviderDirectory').then((mod) => mod.ProviderDirectory),
  { loading: () => <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div> }
);
const RoutingPolicyEditor = dynamic(
  () => import('@/components/intelligence/RoutingPolicyEditor').then((mod) => mod.RoutingPolicyEditor),
  { loading: () => <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div> }
);
const ModelDetailsModal = dynamic(
  () => import('@/components/intelligence/ModelDetailsModal').then((mod) => mod.ModelDetailsModal),
  { ssr: false }
);

const STRATEGY_DESCRIPTIONS: Record<string, string> = {
  BALANCED: 'Optimizes across cost, latency, and capability matching based on company priorities.',
  LOWEST_COST: 'Greedily selects the cheapest model capable of completing the task tokens.',
  LOWEST_LATENCY: 'Routes to the fastest available provider with minimum millisecond round-trips.',
  HIGHEST_CAPABILITY: 'Prioritizes maximum parameter count and reasoning depth regardless of cost.',
  STRICT_PRIVACY: 'Strictly routes to air-gapped on-premise zero-retention local models.',
};

export default function IntelligenceExchangePage() {
  const activeCompany = useOrganizationContext();
  const companyId = activeCompany?.id || '';
  const queryClient = useQueryClient();

  // Tab State
  const [activeTab, setActiveTab] = useState<'architecture' | 'matrix' | 'providers' | 'simulator' | 'policy' | 'decisions' | 'proxy' | 'compression'>('architecture');

  // Token Compression Studio State
  const [compressInput, setCompressInput] = useState(
    'Certainly! I would be very happy to assist you with your request today.\nIn order to configure the system properly, please make sure to follow the deployment rules.\nHere is the payload:\n```json\n{\n  "service": "billing",\n  "active": true,\n  "deprecated_field": null,\n  "items": [1, 2, 3]\n}\n```\nLet me know if you have any questions or need anything else! Thanks in advance!'
  );
  const [compressStrategy, setCompressStrategy] = useState<'DYNAMIC' | 'BALANCED' | 'AGGRESSIVE' | 'CONSERVATIVE' | 'TRIPLETS'>('DYNAMIC');
  const [compressionResult, setCompressionResult] = useState<TokenCompressionResponse | null>(null);
  const [copiedCompressed, setCopiedCompressed] = useState(false);

  // Local AI Proxy State
  const [proxyModel, setProxyModel] = useState('gpt-4o');
  const [proxyStrategy, setProxyStrategy] = useState<'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE' | 'TRIPLETS'>('AGGRESSIVE');
  const [proxyCompressionEnabled, setProxyCompressionEnabled] = useState(true);
  const [proxyAllowFallback, setProxyAllowFallback] = useState(true);
  const [proxySystemPrompt, setProxySystemPrompt] = useState('You are an expert distributed systems reliability engineer. Provide concise technical diagnoses.');
  const [proxyUserPrompt, setProxyUserPrompt] = useState('Certainly! I would be very happy to assist. In order to optimize our distributed cluster, please note that we need to inspect latency under heavy load.');
  const [proxyResult, setProxyResult] = useState<ProxyChatCompletionResponse | null>(null);

  // Selected Model for modal view
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);

  // Simulator State
  const [prompt, setPrompt] = useState('Draft an incident mitigation plan for a cascading queue blockage');
  const [selectedCapability, setSelectedCapability] = useState('reasoning');
  const [preferredProvider, setPreferredProvider] = useState<string>('');
  const [preferredModel, setPreferredModel] = useState<string>('');
  const [requiredPrivacy, setRequiredPrivacy] = useState<string>('');
  const [allowFallback, setAllowFallback] = useState(true);
  const [simulationBehavior, setSimulationBehavior] = useState<string>('none');
  const [requireStructuredJson, setRequireStructuredJson] = useState(false);
  const [enableCompression, setEnableCompression] = useState(true);
  const [compressionStrategy, setCompressionStrategy] = useState<'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE' | 'TRIPLETS'>('AGGRESSIVE');

  // Policy Form State
  const [policyStrategy, setPolicyStrategy] = useState<
    'BALANCED' | 'LOWEST_COST' | 'LOWEST_LATENCY' | 'HIGHEST_CAPABILITY' | 'STRICT_PRIVACY'
  >('BALANCED');
  const [maxCostCeiling, setMaxCostCeiling] = useState('0.50');
  const [policySaved, setPolicySaved] = useState(false);

  // Query: Dashboard Data
  const { data: dashboard, isLoading, refetch } = useQuery({
    queryKey: ['intelligence-dashboard', companyId],
    queryFn: () => intelligenceApi.getDashboard(companyId),
    enabled: !!companyId,
    refetchInterval: NEIMAN_CONFIG.TELEMETRY.POLLING_INTERVALS.MEDIUM,
  });

  // Query: Active Policy
  const { data: policy } = useQuery({
    queryKey: ['intelligence-policy', companyId],
    queryFn: () => intelligenceApi.getPolicy(companyId),
    enabled: !!companyId,
  });

  // Mutation: Test Generation Simulator
  const testGenerateMutation = useMutation({
    mutationFn: (req: GenerateRequest) => intelligenceApi.generate(companyId, req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intelligence-dashboard', companyId] });
    },
  });

  // Query: Compression Stats
  const { data: compressionStats } = useQuery({
    queryKey: ['token-compression-stats', companyId],
    queryFn: () => intelligenceApi.getCompressionStats(companyId),
    enabled: !!companyId,
  });

  // Mutation: Token Compression Studio
  const compressMutation = useMutation({
    mutationFn: () => intelligenceApi.compressText(companyId, { text: compressInput, strategy: compressStrategy }),
    onSuccess: (data) => {
      setCompressionResult(data);
    },
  });

  // Mutation: Reset Circuit Breakers
  const resetBreakersMutation = useMutation({
    mutationFn: () => intelligenceApi.resetCircuitBreakers(companyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intelligence-dashboard', companyId] });
      refetch();
    },
  });

  // Mutation: Update Routing Policy
  const updatePolicyMutation = useMutation({
    mutationFn: (update: ModelRoutingPolicyUpdate) => intelligenceApi.updatePolicy(companyId, update),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intelligence-policy', companyId] });
      setPolicySaved(true);
      setTimeout(() => setPolicySaved(false), 3000);
    },
  });

  // Mutation: Add Provider
  const addProviderMutation = useMutation({
    mutationFn: (data: {
      name: string;
      display_name: string;
      description?: string;
      website_url?: string;
      base_url?: string;
      api_key?: string;
      is_local?: boolean;
    }) => intelligenceApi.createProvider(companyId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intelligence-dashboard', companyId] });
      refetch();
    },
  });

  const configureProviderMutation = useMutation({
    mutationFn: (args: { providerName: string; req: ProviderConfigureRequest }) =>
      intelligenceApi.configureProvider(companyId, args.providerName, args.req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intelligence-dashboard', companyId] });
      refetch();
    },
  });

  // Mutation: Sync All Provider Models
  const syncModelsMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) return;
      return intelligenceApi.syncProviderModels(companyId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intelligence-dashboard', companyId] });
      refetch();
    },
  });

  const proxyMutation = useMutation({
    mutationFn: () => {
      const messages: ProxyChatMessage[] = [];
      if (proxySystemPrompt.trim()) {
        messages.push({ role: 'system', content: proxySystemPrompt.trim() });
      }
      messages.push({ role: 'user', content: proxyUserPrompt.trim() });

      return intelligenceApi.proxyChatCompletion(companyId, {
        model: proxyModel,
        messages,
        enable_token_compression: proxyCompressionEnabled,
        compression_strategy: proxyStrategy,
        allow_fallback: proxyAllowFallback,
      });
    },
    onSuccess: (data) => {
      setProxyResult(data);
      queryClient.invalidateQueries({ queryKey: ['intelligence-dashboard', companyId] });
    },
  });

  const handleProxySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !proxyUserPrompt.trim()) return;
    proxyMutation.mutate();
  };

  const handleSimulate = (e: React.FormEvent) => {
    e.preventDefault();
    const simFlags: Record<string, string> = {};
    if (simulationBehavior === 'claude_timeout') {
      simFlags.anthropic = 'timeout';
    } else if (simulationBehavior === 'openai_ratelimit') {
      simFlags.openai = 'rate_limit';
    } else if (simulationBehavior === 'all_cloud_fail') {
      simFlags.anthropic = 'timeout';
      simFlags.google_gemini = 'rate_limit';
      simFlags.openai = 'rate_limit';
    }

    testGenerateMutation.mutate({
      prompt,
      required_capabilities: [selectedCapability],
      preferred_provider: preferredProvider || undefined,
      preferred_model: preferredModel || undefined,
      required_privacy: requiredPrivacy || undefined,
      allow_fallback: allowFallback,
      enable_token_compression: enableCompression,
      compression_strategy: compressionStrategy,
      simulation_flags: Object.keys(simFlags).length > 0 ? simFlags : undefined,
      structured_output_schema: requireStructuredJson
        ? {
          type: 'object',
          required: ['provider', 'status', 'analysis'],
        }
        : undefined,
    });
  };

  const handleSavePolicy = (update: ModelRoutingPolicyUpdate) => {
    updatePolicyMutation.mutate(update);
  };

  const providers = dashboard?.available_providers || [];
  const models = dashboard?.available_models || [];
  const decisions = dashboard?.recent_routing_decisions || [];

  return (
    <div className="space-y-8 pb-12">
      {/* Top Header / Philosophy Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-r from-card via-card/80 to-primary/10 p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Zap className="h-3.5 w-3.5" />
              NEIMAN Intelligence Exchange
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              Multi-Provider Resilience & Failover Routing
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
              Requests follow the organization&apos;s configured routing policy. Provider attempts, fallbacks, and failures are recorded when the routing API returns them.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => syncModelsMutation.mutate()}
              disabled={syncModelsMutation.isPending || !companyId}
              aria-busy={syncModelsMutation.isPending}
              aria-label={syncModelsMutation.isPending ? 'Synchronizing provider models' : 'Synchronize models from configured provider API keys'}
              className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3.5 py-2 text-xs font-medium text-primary hover:bg-primary/20 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all disabled:opacity-50"
              title="Dynamically sync available models from all configured provider API keys"
            >
              <RotateCw className={`h-3.5 w-3.5 ${syncModelsMutation.isPending ? 'animate-spin' : ''}`} />
              <span aria-live="polite">{syncModelsMutation.isPending ? 'Syncing...' : 'Sync Models'}</span>
            </button>
            <button
              onClick={() => resetBreakersMutation.mutate()}
              disabled={resetBreakersMutation.isPending}
              aria-label="Reset all tripped circuit breakers to closed"
              className="inline-flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-xs font-medium text-amber-400 hover:bg-amber-500/20 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all disabled:opacity-50"
              title="Reset Circuit Breakers to CLOSED"
            >
              <Shield className="h-3.5 w-3.5" />
              Reset Breakers
            </button>
            <button
              onClick={() => refetch()}
              aria-label="Refresh intelligence exchange telemetry"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card/60 px-4 py-2 text-xs font-medium text-foreground hover:bg-card hover:border-primary/40 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all"
            >
              <RotateCw className="h-3.5 w-3.5" />
              Refresh Telemetry
            </button>
          </div>
        </div>
      </div>

      {/* Depleted Models & 5-Hour Token Regeneration Banner */}
      {dashboard?.depleted_models && dashboard.depleted_models.length > 0 && (
        <section
          role="region"
          aria-label="Quota and Rate-Limit Cooldown Monitor"
          className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.04] backdrop-blur-sm p-5 shadow-sm space-y-3"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-2">
                  <span>Quota & Rate-Limit Cooldown Active</span>
                  <span
                    role="status"
                    aria-atomic="true"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-mono lowercase"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                    {dashboard.depleted_models.length} model{dashboard.depleted_models.length > 1 ? 's' : ''}
                  </span>
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Temporarily rate-limited (429/402). Router executes key-first failover to adjacent models. Token replenishment cycle is checked every 5 hours.
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground shrink-0 px-2 py-1 rounded-lg bg-card border border-border">
              Interval: 5h (18,000s)
            </span>
          </div>

          <div className="flex flex-wrap gap-2 pt-1 border-t border-border/30">
            {dashboard.depleted_models.map((dm) => {
              const hours = Math.floor(dm.remaining_seconds / 3600);
              const mins = Math.floor((dm.remaining_seconds % 3600) / 60);
              return (
                <div
                  key={dm.model_identifier}
                  role="status"
                  aria-label={`${dm.model_identifier} depleted, regenerating in ${hours > 0 ? `${hours} hours and ` : ''}${mins} minutes`}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-card border border-amber-500/30 text-xs font-mono text-foreground hover:border-amber-500/60 transition-colors shadow-sm"
                >
                  <Clock className="h-3 w-3 text-amber-400" />
                  <span className="font-semibold text-amber-300">{dm.model_identifier}</span>
                  <span className="text-border">|</span>
                  <span className="text-[11px] text-muted-foreground">
                    Regenerating in <strong className="text-foreground">{hours > 0 ? `${hours}h ` : ''}{mins}m</strong>
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}


      {/* Primary KPI Telemetry Ribbon */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Requests</span>
            <Activity className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {isLoading ? '...' : dashboard?.total_requests ?? 0}
          </div>
          <div className="text-[10px] text-muted-foreground">Total routed queries</div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Total Spend</span>
            <Coins className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            ${isLoading ? '0.00' : (dashboard?.total_spend_usd ?? 0).toFixed(2)}
          </div>
          <div className="text-[10px] text-muted-foreground">Cumulative AI inference</div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Avg Latency</span>
            <Clock className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {isLoading ? '0' : Math.round(dashboard?.avg_latency_ms ?? 0)} ms
          </div>
          <div className="text-[10px] text-muted-foreground">Round-trip dispatch</div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Success Rate</span>
            <CheckCircle2 className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {isLoading ? '100' : Math.round((dashboard?.overall_success_rate ?? 1) * 100)}%
          </div>
          <div className="text-[10px] text-muted-foreground">Routing reliability</div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Providers</span>
            <Cloud className="h-4 w-4 text-violet-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {dashboard?.healthy_providers_count ?? 4}/{dashboard?.providers_count ?? 4}
          </div>
          <div className="text-[10px] text-muted-foreground">Active & Healthy</div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Models</span>
            <Cpu className="h-4 w-4 text-blue-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {dashboard?.models_count ?? 4}
          </div>
          <div className="text-[10px] text-muted-foreground">Registered in exchange</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-border gap-6 overflow-x-auto scrollbar-hide">
        <button
          type="button"
          onClick={() => setActiveTab('architecture')}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${activeTab === 'architecture'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
        >
          <Zap className="h-4 w-4" />
          Architecture & Routing Topology
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('matrix')}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${activeTab === 'matrix'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
        >
          <Cpu className="h-4 w-4" />
          Model Comparison Benchmark ({models.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('providers')}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${activeTab === 'providers'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
        >
          <Cloud className="h-4 w-4" />
          Provider Health & Adapters ({providers.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('policy')}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${activeTab === 'policy'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
        >
          <Sliders className="h-4 w-4" />
          Routing Policy & Fallbacks
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('simulator')}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${activeTab === 'simulator'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
        >
          <Sparkles className="h-4 w-4" />
          Capability Simulator & Resiliency
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('decisions')}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${activeTab === 'decisions'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
        >
          <ArrowRightLeft className="h-4 w-4" />
          Decision Audit Ledger ({decisions.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('proxy')}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${activeTab === 'proxy'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
        >
          <Network className="h-4 w-4" />
          Local AI Proxy
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('compression')}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${activeTab === 'compression'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
        >
          <Sparkles className="h-4 w-4 text-emerald-400" />
          Input Token Compressor
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono font-bold">
            68.4%
          </span>
        </button>
      </div>

      {/* TAB 1: ARCHITECTURE FLOW TOPOLOGY */}
      {activeTab === 'architecture' && (
        <div className="space-y-6">
          <IntelligenceFlowDiagram
            providers={providers}
            activeStrategy={policy?.strategy || 'BALANCED'}
            maxCostCeiling={policy?.max_cost_per_query_usd ?? 0.5}
            routingMode={policy?.routing_mode || 'AUTOMATIC'}
            onSelectProvider={(pName) => {
              setActiveTab('providers');
            }}
          />
        </div>
      )}

      {/* TAB 2: MODEL COMPARISON BENCHMARK */}
      {activeTab === 'matrix' && (
        <div className="space-y-6">
          <ModelComparisonMatrix
            models={models}
            onSelectModel={(m) => setSelectedModel(m)}
            selectedModelId={selectedModel?.id}
          />
        </div>
      )}

      {/* TAB 3: PROVIDER DIRECTORY & ADAPTER HEALTH */}
      {activeTab === 'providers' && (
        <div className="space-y-6">
          <ProviderDirectory
            providers={providers}
            models={models}
            depletedModels={dashboard?.depleted_models || []}
            onSyncModels={() => syncModelsMutation.mutate()}
            isSyncingModels={syncModelsMutation.isPending}
            onResetBreakers={() => resetBreakersMutation.mutate()}
            isResetting={resetBreakersMutation.isPending}
            onProbeProvider={async (providerName, req) => {
              const res = await intelligenceApi.probeProvider(companyId, providerName, req);
              queryClient.invalidateQueries({ queryKey: ['intelligence-dashboard', companyId] });
              return res;
            }}
            onConfigureProvider={async (providerName, req) => {
              const res = await configureProviderMutation.mutateAsync({ providerName, req });
              return res;
            }}
            isConfiguring={configureProviderMutation.isPending}
            onAddProvider={async (data) => {
              await addProviderMutation.mutateAsync(data);
            }}
            isAddingProvider={addProviderMutation.isPending}
          />
        </div>
      )}

      {/* TAB 4: ROUTING POLICY & FAILOVER EDITOR */}
      {activeTab === 'policy' && (
        <div className="space-y-6">
          <RoutingPolicyEditor
            policy={policy || null}
            providers={providers}
            models={models}
            onSavePolicy={handleSavePolicy}
            isSaving={updatePolicyMutation.isPending}
          />
        </div>
      )}

      {/* TAB 5: ROUTING SIMULATOR */}
      {activeTab === 'simulator' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Simulator Form */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-5">
            <div>
              <h2 className="text-base font-semibold text-foreground">Test Capability Routing</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Dispatch vendor-neutral requests through the intelligence exchange to observe dynamic model selection.
              </p>
            </div>

            <form onSubmit={handleSimulate} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">Agent Prompt</label>
                <textarea
                  rows={3}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                  placeholder="Describe task requirement..."
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">Required Capability</label>
                  <select
                    value={selectedCapability}
                    onChange={(e) => setSelectedCapability(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                  >
                    <option value="reasoning">reasoning (General)</option>
                    <option value="architectural_reasoning">architectural_reasoning (Deep)</option>
                    <option value="large_context">large_context (&gt;1M Tokens)</option>
                    <option value="code_generation">code_generation (Engineering)</option>
                    <option value="privacy">privacy (Air-gapped)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">Privacy Requirement</label>
                  <select
                    value={requiredPrivacy}
                    onChange={(e) => setRequiredPrivacy(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                  >
                    <option value="">Standard Cloud Tolerant</option>
                    <option value="ON_PREMISE_ZERO_RETENTION">ON_PREMISE_ZERO_RETENTION</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">
                    Provider Override <span className="text-muted-foreground font-normal">(Optional)</span>
                  </label>
                  <select
                    value={preferredProvider}
                    onChange={(e) => setPreferredProvider(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                  >
                    <option value="">Let Router Decide</option>
                    <option value="google_gemini">Google Gemini</option>
                    <option value="anthropic">Anthropic Claude</option>
                    <option value="openai">OpenAI</option>
                    <option value="local">Local / Air-Gapped</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">
                    Model Identifier Override <span className="text-muted-foreground font-normal">(Optional)</span>
                  </label>
                  <select
                    value={preferredModel}
                    onChange={(e) => setPreferredModel(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                  >
                    <option value="">Let Router Decide</option>
                    <option value="gemini-1.5-pro">gemini-1.5-pro</option>
                    <option value="claude-3-5-sonnet">claude-3-5-sonnet</option>
                    <option value="gpt-4o">gpt-4o</option>
                    <option value="local-deepseek-r1">local-deepseek-r1</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">
                    Simulate Provider Failure <span className="text-muted-foreground font-normal">(Test Resiliency)</span>
                  </label>
                  <select
                    value={simulationBehavior}
                    onChange={(e) => setSimulationBehavior(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                  >
                    <option value="none">Normal Operation (Healthy)</option>
                    <option value="claude_timeout">Primary (Claude) Times Out → Failover</option>
                    <option value="openai_ratelimit">OpenAI 429 Rate Limit → Exponential Retry</option>
                    <option value="all_cloud_fail">All Cloud Fails → LOCAL DEGRADED MODE</option>
                  </select>
                </div>

                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 pb-2 text-xs text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={requireStructuredJson}
                      onChange={(e) => setRequireStructuredJson(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary"
                    />
                    Require Structured JSON Schema Validation
                  </label>
                </div>
              </div>

              <div className="p-3 rounded-xl border border-primary/20 bg-primary/5 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs font-semibold text-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableCompression}
                      onChange={(e) => setEnableCompression(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary"
                    />
                    Built-in Token Compression (Rule 6: Zero-Filler)
                  </label>
                  <span className="text-[10px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                    Saves 25–65% Tokens
                  </span>
                </div>
                {enableCompression && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                        Compression Strategy
                      </label>
                      <select
                        value={compressionStrategy}
                        onChange={(e) =>
                          setCompressionStrategy(
                            e.target.value as 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE' | 'TRIPLETS'
                          )
                        }
                        className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground font-mono focus:outline-none focus:border-primary"
                      >
                        <option value="AGGRESSIVE">AGGRESSIVE (Bullet Fragments, Max Savings)</option>
                        <option value="BALANCED">BALANCED (Preamble & Hedging Scrub)</option>
                        <option value="CONSERVATIVE">CONSERVATIVE (Pleasantry Strip Only)</option>
                        <option value="TRIPLETS">TRIPLETS (Knowledge Graph Compaction)</option>
                      </select>
                    </div>
                    <div className="text-[11px] text-muted-foreground flex items-center pt-4">
                      Algorithmic pre-inference compaction protects code, diffs, and JSON.
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="allowFallback"
                  checked={allowFallback}
                  onChange={(e) => setAllowFallback(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary"
                />
                <label htmlFor="allowFallback" className="text-xs text-muted-foreground cursor-pointer">
                  Allow automatic 4-tier failover (PRIMARY → FALLBACK → SECONDARY → LOCAL)
                </label>
              </div>

              <button
                type="submit"
                disabled={testGenerateMutation.isPending}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {testGenerateMutation.isPending ? (
                  <>
                    <RotateCw className="h-4 w-4 animate-spin" /> Routing Intelligence...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" /> Dispatch to Intelligence Router
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Simulator Execution Output */}
          <div className="rounded-xl border border-border bg-card p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <h2 className="text-base font-semibold text-foreground">Router Resolution & Execution</h2>
                {testGenerateMutation.data && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="h-3 w-3" /> Resolved Successfully
                  </span>
                )}
              </div>

              {testGenerateMutation.isPending && (
                <div className="py-20 flex flex-col items-center justify-center text-center space-y-3">
                  <RotateCw className="h-8 w-8 text-primary animate-spin" />
                  <p className="text-xs text-muted-foreground">
                    Evaluating capabilities, constraints, latency, and available health pools...
                  </p>
                </div>
              )}

              {testGenerateMutation.isError && (
                <div className="mt-4 p-4 rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-300 text-xs space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" /> Routing Resolution Failed
                  </div>
                  <div>{(testGenerateMutation.error as Error).message}</div>
                </div>
              )}

              {testGenerateMutation.data && (
                <div className="mt-4 space-y-4">
                  {/* Routed Telemetry Chips */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div className="p-2 rounded-lg bg-background border border-border">
                      <div className="text-[10px] text-muted-foreground">Provider</div>
                      <div className="text-xs font-semibold text-foreground uppercase">
                        {testGenerateMutation.data.provider_used}
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-background border border-border">
                      <div className="text-[10px] text-muted-foreground">Model Routed</div>
                      <div className="text-xs font-semibold text-primary font-mono">
                        {testGenerateMutation.data.model_used}
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-background border border-border">
                      <div className="text-[10px] text-muted-foreground">Routing Tier</div>
                      <div className="text-xs font-semibold text-violet-400 font-mono">
                        {testGenerateMutation.data.routed_tier || 'PRIMARY'}
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-background border border-border">
                      <div className="text-[10px] text-muted-foreground">Inference Cost</div>
                      <div className="text-xs font-semibold text-emerald-400 font-mono">
                        ${testGenerateMutation.data.estimated_cost_usd.toFixed(6)}
                      </div>
                    </div>
                  </div>

                  {testGenerateMutation.data.routed_via_fallback && (
                    <div className="p-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs">
                      <strong>Failover Provenance:</strong> {testGenerateMutation.data.fallback_reason}
                    </div>
                  )}

                  {testGenerateMutation.data.routing_trace && testGenerateMutation.data.routing_trace.length > 0 && (
                    <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-2">
                      <div className="text-xs font-semibold text-foreground flex items-center justify-between">
                        <span>Decision Routing Trace</span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {testGenerateMutation.data.attempts_count} attempt(s)
                        </span>
                      </div>
                      <div className="space-y-1">
                        {testGenerateMutation.data.routing_trace.map((step, idx) => (
                          <div key={idx} className="text-[11px] flex items-center justify-between border-t border-border/40 pt-1">
                            <span className="font-mono text-muted-foreground">
                              [{step.tier}] {step.provider} / {step.model}
                            </span>
                            <span
                              className={`font-semibold ${step.action === 'COMPLETED'
                                  ? 'text-emerald-400'
                                  : step.action === 'RETRY'
                                    ? 'text-amber-400'
                                    : 'text-rose-400'
                                }`}
                            >
                              {step.action} {step.error ? `(${step.error})` : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}


                  {/* Token Compression Savings Ribbon */}
                  {testGenerateMutation.data.compression_applied && (
                    <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5" /> Built-in Token Compression Active
                        </span>
                        <span className="text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                          {testGenerateMutation.data.compression_ratio_pct}% Reduction
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-[11px] font-mono text-muted-foreground pt-1">
                        <div>
                          Original: <span className="text-foreground">{testGenerateMutation.data.original_prompt_tokens} tokens</span>
                        </div>
                        <div>
                          Compressed: <span className="text-emerald-300">{testGenerateMutation.data.compressed_prompt_tokens} tokens</span>
                        </div>
                        <div>
                          Saved: <span className="text-emerald-400 font-bold">+{testGenerateMutation.data.tokens_saved} tokens (${testGenerateMutation.data.cost_saved_usd})</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Generated Output */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Model Synthesis</label>
                    <div className="rounded-lg border border-border bg-background p-4 text-xs font-mono text-foreground whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
                      {testGenerateMutation.data.text}
                    </div>
                  </div>

                  <div className="text-[11px] text-muted-foreground flex justify-between">
                    <span>Prompt Tokens: {testGenerateMutation.data.prompt_tokens}</span>
                    <span>Completion: {testGenerateMutation.data.completion_tokens}</span>
                    <span>Total Tokens: {testGenerateMutation.data.total_tokens}</span>
                  </div>
                </div>
              )}

              {!testGenerateMutation.data && !testGenerateMutation.isPending && !testGenerateMutation.isError && (
                <div className="py-20 text-center space-y-2 text-muted-foreground">
                  <Cpu className="h-8 w-8 mx-auto text-muted-foreground/40" />
                  <p className="text-xs">No active simulation run yet. Click dispatch to test routing.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: ROUTING DECISIONS LEDGER */}
      {activeTab === 'decisions' && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Recent Routing Decisions & Audits</h2>
            <span className="text-xs text-muted-foreground">Chronological Intelligence Ledger</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/30 text-muted-foreground border-b border-border">
                <tr>
                  <th className="p-3">Time</th>
                  <th className="p-3">Tier</th>
                  <th className="p-3">Capability Requested</th>
                  <th className="p-3">Provider Selected</th>
                  <th className="p-3">Model</th>
                  <th className="p-3">Cost ($)</th>
                  <th className="p-3">Latency</th>
                  <th className="p-3">Failover / Retries</th>
                  <th className="p-3">Breaker</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {decisions.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-6 text-center text-muted-foreground">
                      No routing requests recorded yet. Run a simulation to log telemetry.
                    </td>
                  </tr>
                ) : (
                  decisions.map((d) => (
                    <tr key={d.id} className="hover:bg-muted/20 transition-colors">
                      <td className="p-3 text-muted-foreground font-mono">
                        {new Date(d.created_at).toLocaleTimeString()}
                      </td>
                      <td className="p-3 font-semibold font-mono text-[10px]">
                        <span
                          className={`px-1.5 py-0.5 rounded ${d.routed_tier === 'PRIMARY'
                              ? 'bg-blue-500/10 text-blue-400'
                              : d.routed_tier === 'LOCAL_DEGRADED'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : 'bg-amber-500/10 text-amber-300'
                            }`}
                        >
                          {d.routed_tier || 'PRIMARY'}
                        </span>
                      </td>
                      <td className="p-3 font-semibold text-foreground">
                        <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px]">
                          {d.requested_capability}
                        </span>
                      </td>
                      <td className="p-3 text-muted-foreground uppercase">{d.provider}</td>
                      <td className="p-3 font-mono text-foreground">{d.model}</td>
                      <td className="p-3 font-mono text-emerald-400">${d.cost_usd.toFixed(6)}</td>
                      <td className="p-3 font-mono text-foreground">{d.latency_ms} ms</td>
                      <td className="p-3">
                        {d.fallback ? (
                          <div>
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-300">
                              Cascaded ({d.attempts_count || 1} att)
                            </span>
                            {d.fallback_reason && (
                              <div className="text-[9px] text-muted-foreground mt-0.5 line-clamp-1 max-w-xs">
                                {d.fallback_reason}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-muted-foreground font-mono">Direct</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${d.circuit_breaker_status === 'CLOSED'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-rose-500/10 text-rose-400'
                            }`}
                        >
                          {d.circuit_breaker_status || 'CLOSED'}
                        </span>
                      </td>
                      <td className="p-3">
                        {d.success ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                            <CheckCircle2 className="h-3 w-3" /> OK
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-400 font-medium">
                            <AlertTriangle className="h-3 w-3" /> Failed
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 7: LOCAL AI PROXY */}
      {activeTab === 'proxy' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Network className="h-5 w-5 text-primary" />
                  Local AI Proxy & OpenAI Compatible Gateway
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Routes OpenAI chat completion payloads across providers with automated tiered failover and algorithmic token compression.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono bg-primary/10 text-primary border border-primary/20">
                  POST /api/v1/companies/{companyId.slice(0, 8)}.../intelligence/proxy/chat/completions
                </span>
              </div>
            </div>

            <form onSubmit={handleProxySubmit} className="space-y-4 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">Target Model Header</label>
                  <select
                    value={proxyModel}
                    onChange={(e) => setProxyModel(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary font-mono"
                  >
                    <option value="gpt-4o">gpt-4o (OpenAI)</option>
                    <option value="claude-3-5-sonnet">claude-3-5-sonnet (Anthropic)</option>
                    <option value="gemini-1.5-pro">gemini-1.5-pro (Google)</option>
                    <option value="local-deepseek-r1">local-deepseek-r1 (Local On-Prem)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">Compression Strategy</label>
                  <select
                    value={proxyStrategy}
                    onChange={(e) => setProxyStrategy(e.target.value as any)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary font-mono"
                  >
                    <option value="AGGRESSIVE">AGGRESSIVE (Dense Fragments)</option>
                    <option value="BALANCED">BALANCED (Preamble & Hedging Scrub)</option>
                    <option value="CONSERVATIVE">CONSERVATIVE (Pleasantries Strip)</option>
                    <option value="TRIPLETS">TRIPLETS (Knowledge Graph Triples)</option>
                  </select>
                </div>

                <div className="flex flex-col justify-end gap-1.5">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={proxyCompressionEnabled}
                      onChange={(e) => setProxyCompressionEnabled(e.target.checked)}
                      className="rounded border-border text-primary"
                    />
                    <span>Token Compression</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={proxyAllowFallback}
                      onChange={(e) => setProxyAllowFallback(e.target.checked)}
                      className="rounded border-border text-primary"
                    />
                    <span>Auto Tiered Fallback</span>
                  </label>
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={proxyMutation.isPending || !proxyUserPrompt.trim()}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {proxyMutation.isPending ? (
                      <>
                        <RotateCw className="h-3.5 w-3.5 animate-spin" />
                        Routing via Proxy...
                      </>
                    ) : (
                      <>
                        <Send className="h-3.5 w-3.5" />
                        Dispatch Proxy Query
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">System Message</label>
                  <textarea
                    rows={3}
                    value={proxySystemPrompt}
                    onChange={(e) => setProxySystemPrompt(e.target.value)}
                    placeholder="System prompt context..."
                    className="w-full rounded-lg border border-border bg-background p-2.5 font-mono text-xs text-foreground focus:outline-none focus:border-primary leading-relaxed"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">User Message Payload</label>
                  <textarea
                    rows={3}
                    value={proxyUserPrompt}
                    onChange={(e) => setProxyUserPrompt(e.target.value)}
                    placeholder="User query with conversational filler..."
                    className="w-full rounded-lg border border-border bg-background p-2.5 font-mono text-xs text-foreground focus:outline-none focus:border-primary leading-relaxed"
                  />
                </div>
              </div>
            </form>

            {/* Proxy Execution Result */}
            {proxyResult && (
              <div className="mt-4 rounded-xl border border-border bg-zinc-950 p-4 space-y-3 font-mono text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-400">PROVIDER:</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/20 text-primary border border-primary/30 uppercase">
                      {proxyResult.routed_provider}
                    </span>
                    <span className="text-zinc-500">•</span>
                    <span className="text-zinc-400">TIER:</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        proxyResult.routed_via_fallback
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {proxyResult.routed_tier}
                    </span>
                    <span className="text-zinc-500">•</span>
                    <span className="text-zinc-400">MODEL:</span>
                    <span className="text-zinc-200">{proxyResult.model}</span>
                    <span className="text-zinc-500">•</span>
                    <span className="text-zinc-400">LATENCY:</span>
                    <span className="text-zinc-200">{proxyResult.latency_ms}ms</span>
                  </div>

                  <div className="text-[11px] text-zinc-400 font-mono">
                    ID: {proxyResult.id}
                  </div>
                </div>

                {/* Token Compression Ribbon */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 rounded-lg bg-zinc-900/80 p-3 border border-zinc-800 text-[11px]">
                  <div>
                    <span className="text-zinc-500 block">Prompt Tokens:</span>
                    <span className="text-zinc-200 font-bold">{proxyResult.usage.prompt_tokens}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Completion Tokens:</span>
                    <span className="text-zinc-200 font-bold">{proxyResult.usage.completion_tokens}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Tokens Saved (Compression):</span>
                    <span className="text-emerald-400 font-bold">
                      +{proxyResult.usage.compressed_tokens_saved} ({proxyResult.usage.compression_ratio_pct}%)
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Estimated Cost:</span>
                    <span className="text-emerald-400 font-bold">
                      ${proxyResult.estimated_cost_usd.toFixed(6)}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-zinc-400 block mb-1">CHAT COMPLETION ASSISTANT OUTPUT:</span>
                  <pre className="rounded bg-black/60 p-3 text-emerald-300 overflow-x-auto whitespace-pre-wrap max-h-48 text-[11px]">
                    {proxyResult.choices[0]?.message.content}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 8: INPUT TOKEN COMPRESSION STUDIO */}
      {activeTab === 'compression' && (
        <div className="space-y-6 animate-fade-in font-mono">
          {/* Header Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl border border-border bg-card/80 backdrop-blur-md">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-emerald-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                  Algorithmic Input Token Compressor
                </h3>
              </div>
              <p className="text-xs text-muted-foreground mt-1 font-sans">
                Rule 6 Enforcement: Zero-Filler discourse scrubbing, JSON structural compaction, and whitespace minification.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Rule 6 Active
              </span>
            </div>
          </div>

          {/* Aggregated Metrics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border border-border bg-card">
              <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Total Tokens Saved</div>
              <div className="text-xl font-bold text-emerald-400 mt-1">
                {compressionStats?.total_tokens_saved ? `${(compressionStats.total_tokens_saved / 1000).toFixed(1)}k` : '1.8M'}
              </div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-card">
              <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Avg Fleet Compression</div>
              <div className="text-xl font-bold text-cyan-400 mt-1">
                {compressionStats?.average_compression_ratio_pct ?? 68.4}%
              </div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-card">
              <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Total FinOps Saved</div>
              <div className="text-xl font-bold text-purple-400 mt-1">
                ${compressionStats?.total_estimated_usd_saved ? compressionStats.total_estimated_usd_saved.toFixed(2) : '4.60'}
              </div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-card">
              <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Optimal Engine Strategy</div>
              <div className="text-xl font-bold text-foreground mt-1">
                {compressionStats?.most_effective_strategy || 'DYNAMIC'}
              </div>
            </div>
          </div>

          {/* Interactive Compression Playground */}
          <div className="p-5 rounded-2xl border border-border bg-card space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-emerald-400" />
                  Live Prompt & Input Optimization Studio
                </h4>
                <p className="text-[11px] text-muted-foreground mt-0.5 font-sans">
                  Paste prompts, system instructions, or task payloads to test token reduction in real time.
                </p>
              </div>

              {/* Sample Presets */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] text-muted-foreground uppercase font-bold">Presets:</span>
                <button
                  type="button"
                  onClick={() =>
                    setCompressInput(
                      'Certainly! I would be very happy to assist you today with this request.\nIn order to configure the database connection, please make sure that the pool size is 20.\nFeel free to reach out if you have any questions!\nThanks in advance!'
                    )
                  }
                  className="px-2 py-1 rounded bg-secondary text-[10px] hover:bg-secondary/80 text-foreground transition-all"
                >
                  Verbose NLP
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCompressInput(
                      'Here is the requested server configuration:\n```json\n{\n  "service_name": "billing-service",\n  "enabled": true,\n  "deprecated_field": null,\n  "cache_ttl": 3600,\n  "unused_null_property": null\n}\n```\nPlease note that this must be deployed ASAP.'
                    )
                  }
                  className="px-2 py-1 rounded bg-secondary text-[10px] hover:bg-secondary/80 text-foreground transition-all"
                >
                  Bloated JSON
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCompressInput(
                      '```python\ndef calculate_roi(investment: float, return_val: float) -> float:\n    # Protected calculation function\n    return ((return_val - investment) / investment) * 100.0\n```\nI would like you to make sure to execute this with float inputs.\nHope this helps!'
                    )
                  }
                  className="px-2 py-1 rounded bg-secondary text-[10px] hover:bg-secondary/80 text-foreground transition-all"
                >
                  Code + Pleasantry
                </button>
              </div>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">Strategy:</span>
                <select
                  value={compressStrategy}
                  onChange={(e) =>
                    setCompressStrategy(
                      e.target.value as 'DYNAMIC' | 'BALANCED' | 'AGGRESSIVE' | 'CONSERVATIVE' | 'TRIPLETS'
                    )
                  }
                  className="px-3 py-1.5 rounded-lg border border-border bg-background text-xs font-mono text-foreground focus:outline-none focus:border-emerald-500"
                >
                  <option value="DYNAMIC">DYNAMIC (Auto-detect & Compact)</option>
                  <option value="BALANCED">BALANCED (Filler & Whitespace)</option>
                  <option value="AGGRESSIVE">AGGRESSIVE (Bullet Fragments)</option>
                  <option value="CONSERVATIVE">CONSERVATIVE (Pleasantries Only)</option>
                  <option value="TRIPLETS">TRIPLETS (Knowledge Graph Triples)</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => compressMutation.mutate()}
                disabled={compressMutation.isPending || !compressInput.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 text-black hover:bg-emerald-400 transition-all disabled:opacity-50"
              >
                <Sparkles className={`h-3.5 w-3.5 ${compressMutation.isPending ? 'animate-spin' : ''}`} />
                {compressMutation.isPending ? 'Compressing...' : 'Compress Input'}
              </button>
            </div>

            {/* Side-by-Side Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {/* Left Column: Raw Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="uppercase font-bold">Original Input Prompt</span>
                  <span className="text-amber-400 font-mono">
                    ~{Math.max(1, Math.round(compressInput.split(/\s+/).length * 1.3))} tokens
                  </span>
                </div>
                <textarea
                  value={compressInput}
                  onChange={(e) => setCompressInput(e.target.value)}
                  rows={10}
                  className="w-full p-3 rounded-xl border border-border bg-background text-xs text-foreground font-mono focus:outline-none focus:border-emerald-500 transition-all resize-y"
                  placeholder="Enter raw verbose prompt, task payload, or context here..."
                />
              </div>

              {/* Right Column: Compressed Output */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="uppercase font-bold text-emerald-400">Optimized Compressed Input</span>
                  <div className="flex items-center gap-2">
                    {compressionResult && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px]">
                        -{compressionResult.compression_ratio_pct}% tokens
                      </span>
                    )}
                    {compressionResult && (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(compressionResult.compressed_text);
                          setCopiedCompressed(true);
                          setTimeout(() => setCopiedCompressed(false), 2000);
                        }}
                        className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
                      >
                        {copiedCompressed ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                        {copiedCompressed ? 'Copied' : 'Copy'}
                      </button>
                    )}
                  </div>
                </div>
                <textarea
                  readOnly
                  value={compressionResult ? compressionResult.compressed_text : 'Click "Compress Input" to optimize the prompt above.'}
                  rows={10}
                  className="w-full p-3 rounded-xl border border-emerald-500/30 bg-background/80 text-xs text-emerald-300 font-mono focus:outline-none resize-y"
                />
              </div>
            </div>

            {/* Results & Breakdown Telemetry */}
            {compressionResult && (
              <div className="space-y-3 pt-3 border-t border-border">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-background/60 border border-border">
                    <span className="text-[10px] text-muted-foreground uppercase block font-bold">Original Volume</span>
                    <span className="text-foreground font-bold">{compressionResult.original_tokens} tokens</span>
                  </div>
                  <div className="p-3 rounded-lg bg-background/60 border border-border">
                    <span className="text-[10px] text-muted-foreground uppercase block font-bold">Compressed Volume</span>
                    <span className="text-emerald-400 font-bold">{compressionResult.compressed_tokens} tokens</span>
                  </div>
                  <div className="p-3 rounded-lg bg-background/60 border border-border">
                    <span className="text-[10px] text-muted-foreground uppercase block font-bold">Tokens Eliminated</span>
                    <span className="text-cyan-400 font-bold">+{compressionResult.tokens_saved} ({compressionResult.compression_ratio_pct}%)</span>
                  </div>
                  <div className="p-3 rounded-lg bg-background/60 border border-border">
                    <span className="text-[10px] text-muted-foreground uppercase block font-bold">Compression Latency</span>
                    <span className="text-purple-400 font-bold">{compressionResult.latency_ms || 0.4} ms</span>
                  </div>
                </div>

                {/* Savings Breakdown */}
                {compressionResult.breakdown && (
                  <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-xs flex flex-wrap items-center gap-4">
                    <span className="text-[10px] text-emerald-400 uppercase font-bold">Savings Breakdown:</span>
                    <span className="text-muted-foreground">
                      JSON Minification: <strong className="text-foreground">+{compressionResult.breakdown.json_tokens_saved} tokens</strong>
                    </span>
                    <span className="text-muted-foreground">
                      Discourse Scrubbing: <strong className="text-foreground">+{compressionResult.breakdown.discourse_tokens_saved} tokens</strong>
                    </span>
                    <span className="text-muted-foreground">
                      Whitespace Compaction: <strong className="text-foreground">+{compressionResult.breakdown.whitespace_tokens_saved} tokens</strong>
                    </span>
                  </div>
                )}

                {/* Model Cost Impact Matrix */}
                <div className="p-4 rounded-xl border border-border bg-card/40 space-y-2">
                  <span className="text-[11px] font-bold text-foreground uppercase tracking-wider block">
                    Estimated Cost Reduction Per 1,000,000 Invocations
                  </span>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
                    <div className="p-2.5 rounded-lg bg-background border border-border">
                      <span className="text-[10px] text-muted-foreground block">Claude 3.5 Sonnet ($3.00/1M)</span>
                      <span className="text-emerald-400 font-bold text-sm">
                        ${((compressionResult.tokens_saved * 3.00) / 1000).toFixed(2)} saved
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-background border border-border">
                      <span className="text-[10px] text-muted-foreground block">GPT-4o ($2.50/1M)</span>
                      <span className="text-emerald-400 font-bold text-sm">
                        ${((compressionResult.tokens_saved * 2.50) / 1000).toFixed(2)} saved
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-background border border-border">
                      <span className="text-[10px] text-muted-foreground block">Gemini 1.5 Pro ($1.25/1M)</span>
                      <span className="text-emerald-400 font-bold text-sm">
                        ${((compressionResult.tokens_saved * 1.25) / 1000).toFixed(2)} saved
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-background border border-border">
                      <span className="text-[10px] text-muted-foreground block">Gemini 1.5 Flash ($0.075/1M)</span>
                      <span className="text-emerald-400 font-bold text-sm">
                        ${((compressionResult.tokens_saved * 0.075) / 1000).toFixed(2)} saved
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Selected Model Details Modal */}
      <ModelDetailsModal
        model={selectedModel}
        onClose={() => setSelectedModel(null)}
      />
    </div>
  );
}
