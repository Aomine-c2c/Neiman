'use client';

import React, { useState } from 'react';
import {
  Cloud,
  Server,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Shield,
  RotateCw,
  Zap,
  Terminal,
  Plus,
  Radio,
  ExternalLink,
  Sliders,
  Key,
  Lock,
  Search,
  Sparkles,
  Link as LinkIcon,
} from 'lucide-react';
import {
  ModelProvider,
  Model,
  ProviderProbeRequest,
  ProviderProbeResponse,
  ProviderConfigureRequest,
  ProviderConfigureResponse,
  DepletedModelStatus,
} from '@/lib/api/intelligence';
import { getOllamaBaseUrl, getApiBaseUrl } from '@neiman/config';

interface ProviderDirectoryProps {
  providers: ModelProvider[];
  models: Model[];
  depletedModels?: DepletedModelStatus[];
  onSyncModels?: () => void;
  isSyncingModels?: boolean;
  onResetBreakers?: () => void;
  isResetting?: boolean;
  onProbeProvider?: (providerName: string, req?: ProviderProbeRequest) => Promise<ProviderProbeResponse | void>;
  onConfigureProvider?: (
    providerName: string,
    req: ProviderConfigureRequest
  ) => Promise<ProviderConfigureResponse | void>;
  isConfiguring?: boolean;
  onAddProvider?: (data: {
    name: string;
    display_name: string;
    description?: string;
    website_url?: string;
    base_url?: string;
    api_key?: string;
    is_local?: boolean;
  }) => Promise<void>;
  isAddingProvider?: boolean;
}

export function ProviderDirectory({
  providers,
  models,
  depletedModels = [],
  onSyncModels,
  isSyncingModels,
  onResetBreakers,
  isResetting,
  onProbeProvider,
  onConfigureProvider,
  isConfiguring,
  onAddProvider,
  isAddingProvider,
}: ProviderDirectoryProps) {
  const [probingProvider, setProbingProvider] = useState<string | null>(null);
  const [probeResults, setProbeResults] = useState<Record<string, ProviderProbeResponse>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'CONFIGURED' | 'UNCONFIGURED' | 'LOCAL'>('ALL');

  // Vault / Configure Modal state
  const [configTargetProvider, setConfigTargetProvider] = useState<ModelProvider | null>(null);
  const [configApiKey, setConfigApiKey] = useState('');
  const [configBaseUrl, setConfigBaseUrl] = useState('');
  const [autoDiscover, setAutoDiscover] = useState(true);
  const [configStatusMessage, setConfigStatusMessage] = useState<string | null>(null);

  // Add Custom Provider Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProviderForm, setNewProviderForm] = useState({
    name: '',
    display_name: '',
    description: '',
    website_url: '',
    base_url: '',
    api_key: '',
    is_local: false,
  });

  const handleOpenConfigure = (p: ModelProvider) => {
    setConfigTargetProvider(p);
    setConfigApiKey('');
    setConfigBaseUrl(p.base_url || '');
    setAutoDiscover(true);
    setConfigStatusMessage(null);
  };

  const handleSaveConfiguration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!configTargetProvider || !onConfigureProvider) return;

    try {
      setConfigStatusMessage('Encrypting key and auto-discovering models...');
      const res = await onConfigureProvider(configTargetProvider.name, {
        api_key: configApiKey.trim() || undefined,
        base_url: configBaseUrl.trim() || undefined,
        auto_discover: autoDiscover,
      });
      if (res) {
        setConfigStatusMessage(res.message);
        setTimeout(() => {
          setConfigTargetProvider(null);
        }, 1200);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Configuration failed';
      setConfigStatusMessage(`Error: ${msg}`);
    }
  };

  const handleProbe = async (providerName: string, req?: ProviderProbeRequest) => {
    if (!onProbeProvider) return;
    setProbingProvider(providerName);
    try {
      const res = await onProbeProvider(providerName, req);
      if (res) {
        setProbeResults((prev) => ({ ...prev, [providerName]: res }));
      }
    } finally {
      setProbingProvider(null);
    }
  };

  const filteredProviders = providers.filter((p) => {
    const matchesSearch =
      p.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (filterType === 'CONFIGURED') return p.is_configured;
    if (filterType === 'UNCONFIGURED') return !p.is_configured;
    if (filterType === 'LOCAL') return p.is_local;
    return true;
  });

  const configuredCount = providers.filter((p) => p.is_configured).length;

  return (
    <div className="space-y-6">
      {/* Controls Ribbon */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl border border-border/80 bg-card/70 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Cloud className="h-4 w-4 text-primary" />
              Universal AI Provider Directory & Key Vault
            </h2>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              {configuredCount}/{providers.length} Configured
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Configure external keys or custom endpoint links securely. Keys are stored encrypted with machine salt and never sent to clients.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search box */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search providers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs pl-8 pr-3 py-1.5 h-8 rounded-xl border border-border bg-background/80 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 font-mono w-44 md:w-56"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex rounded-xl border border-border bg-background/60 p-0.5 text-[10px] font-mono">
            <button
              onClick={() => setFilterType('ALL')}
              className={`px-2 py-1 rounded-lg transition-colors ${filterType === 'ALL' ? 'bg-primary text-primary-foreground font-bold' : 'text-muted-foreground hover:text-foreground'}`}
            >
              All ({providers.length})
            </button>
            <button
              onClick={() => setFilterType('CONFIGURED')}
              className={`px-2 py-1 rounded-lg transition-colors ${filterType === 'CONFIGURED' ? 'bg-emerald-500 text-white font-bold' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Configured ({configuredCount})
            </button>
            <button
              onClick={() => setFilterType('UNCONFIGURED')}
              className={`px-2 py-1 rounded-lg transition-colors ${filterType === 'UNCONFIGURED' ? 'bg-amber-500/20 text-amber-400 font-bold' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Available ({providers.length - configuredCount})
            </button>
            <button
              onClick={() => setFilterType('LOCAL')}
              className={`px-2 py-1 rounded-lg transition-colors ${filterType === 'LOCAL' ? 'bg-secondary text-foreground font-bold' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Local
            </button>
          </div>

          {onAddProvider && (
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-mono font-medium text-primary hover:bg-primary/20 transition-colors h-8"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Custom Provider</span>
            </button>
          )}

          {onResetBreakers && (
            <button
              type="button"
              onClick={onResetBreakers}
              disabled={isResetting}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-mono font-medium text-amber-400 hover:bg-amber-500/20 transition-colors h-8 disabled:opacity-50"
            >
              <Shield className="h-3.5 w-3.5" />
              <span>Reset Breakers</span>
            </button>
          )}
        </div>
      </div>

      {/* Grid of Provider Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredProviders.map((p) => {
          const providerModels = models.filter((m) => m.provider_id === p.id || m.model_identifier.includes(p.name));
          const probeResult = probeResults[p.name];
          const isConfigured = p.is_configured;
          const isHealthy = probeResult ? probeResult.is_healthy : (p.is_healthy && p.consecutive_failures === 0);
          const breakerState = probeResult ? probeResult.circuit_breaker_status : (isHealthy ? 'CLOSED' : 'OPEN');
          const consecutiveFailures = probeResult ? probeResult.consecutive_failures : p.consecutive_failures;
          const isCurrentlyProbing = probingProvider === p.name;

          return (
            <div
              key={p.id}
              className={`flex flex-col justify-between rounded-2xl border p-5 bg-card/90 backdrop-blur-md shadow-md space-y-4 transition-all hover:border-primary/40 ${
                isConfigured ? 'border-border' : 'border-dashed border-border/70 opacity-90'
              }`}
            >
              {/* Header */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-secondary text-primary">
                      {p.is_local ? <Server className="h-4 w-4 text-emerald-400" /> : <Cloud className="h-4 w-4 text-primary" />}
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-foreground leading-tight">{p.display_name}</h3>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {p.is_local ? 'Local / Air-Gapped' : 'Cloud API / Gateway'}
                      </span>
                    </div>
                  </div>

                  {/* Configured Status Badge */}
                  {isConfigured ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      <CheckCircle2 className="h-2.5 w-2.5" /> ONLINE
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-secondary/80 text-muted-foreground border border-border">
                      <Key className="h-2.5 w-2.5" /> UNCONFIGURED
                    </span>
                  )}
                </div>

                {/* Description */}
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed h-8">
                  {p.description || 'Enterprise intelligence adapter supporting NEIMAN capabilities.'}
                </p>
              </div>

              {/* Vault / Endpoint details */}
              <div className="p-2.5 rounded-xl bg-secondary/30 border border-border/40 text-[10px] font-mono space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Lock className="h-3 w-3 text-primary/70" /> Key Vault:
                  </span>
                  <span className="font-semibold text-foreground">
                    {p.api_key_masked || (isConfigured && p.is_local ? 'Air-gapped (Local)' : 'None')}
                  </span>
                </div>

                {p.base_url && (
                  <div className="flex items-center justify-between text-muted-foreground truncate" title={p.base_url}>
                    <span className="flex items-center gap-1 shrink-0">
                      <LinkIcon className="h-3 w-3 text-cyan-400" /> Endpoint:
                    </span>
                    <span className="truncate max-w-[140px] text-foreground/80">{p.base_url}</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1 border-t border-border/30">
                  <span className="text-muted-foreground">Models Registered:</span>
                  <span className="font-bold text-foreground">{providerModels.length}</span>
                </div>

                {/* Discovered Models Tag List & Depletion Countdown */}
                {providerModels.length > 0 && (
                  <div className="pt-2 border-t border-border/20 flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                    {providerModels.slice(0, 8).map((m) => {
                      const depletion = depletedModels.find(
                        (dm) => dm.model_identifier.toLowerCase() === m.model_identifier.toLowerCase()
                      );
                      const hours = depletion ? Math.floor(depletion.remaining_seconds / 3600) : 0;
                      const mins = depletion ? Math.floor((depletion.remaining_seconds % 3600) / 60) : 0;

                      if (depletion) {
                        return (
                          <span
                            key={m.id}
                            role="status"
                            aria-label={`${m.model_identifier} depleted, regenerating in ${hours > 0 ? `${hours} hours and ` : ''}${mins} minutes`}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[9px] font-mono font-medium hover:border-amber-500/60 transition-colors shadow-xs"
                            title={`Rate-limited / Quota exhausted. Regenerating in ${hours > 0 ? `${hours}h ` : ''}${mins}m`}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" aria-hidden="true" />
                            <span>{m.model_identifier}</span>
                            <span className="text-amber-400/80 font-bold">({hours > 0 ? `${hours}h ` : ''}{mins}m)</span>
                          </span>
                        );
                      }

                      if (!m.is_active) {
                        return (
                          <span
                            key={m.id}
                            aria-label={`${m.model_identifier} soft-deactivated`}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary/30 text-muted-foreground/50 border border-border/20 text-[9px] font-mono line-through"
                            title="Soft-deactivated (omitted from provider API manifest)"
                          >
                            {m.model_identifier}
                          </span>
                        );
                      }

                      return (
                        <span
                          key={m.id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary/80 text-foreground/80 border border-border/50 text-[9px] font-mono hover:border-primary/40 hover:text-foreground transition-colors"
                        >
                          {m.model_identifier}
                        </span>
                      );
                    })}
                    {providerModels.length > 8 && (
                      <span className="text-[9px] font-mono text-muted-foreground self-center">
                        +{providerModels.length - 8} more
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Probe / Breaker State if Configured */}
              {isConfigured && (
                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                  <div className="bg-secondary/40 p-1.5 rounded-lg border border-border/40 flex items-center justify-between">
                    <span className="text-muted-foreground">Errors:</span>
                    <span className={`font-bold ${consecutiveFailures > 0 ? 'text-rose-400' : 'text-foreground'}`}>
                      {consecutiveFailures}
                    </span>
                  </div>

                  <div className="bg-secondary/40 p-1.5 rounded-lg border border-border/40 flex items-center justify-between">
                    <span className="text-muted-foreground">Breaker:</span>
                    <span className={`font-bold ${breakerState === 'CLOSED' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {breakerState}
                    </span>
                  </div>
                </div>
              )}

              {/* Probing Telemetry Display */}
              {probeResult && (
                <div className="p-2 rounded-xl bg-background/80 border border-border/60 text-[10px] font-mono space-y-1">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-amber-400" /> Latency:
                    </span>
                    <span className="font-bold text-foreground">{probeResult.latency_ms}ms</span>
                  </div>
                  <div className="text-[9px] text-muted-foreground truncate" title={probeResult.message}>
                    {probeResult.message}
                  </div>
                </div>
              )}

              {/* Actions Footer */}
              <div className="space-y-2 pt-2 border-t border-border/40">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleOpenConfigure(p)}
                    className="flex-1 inline-flex items-center justify-center gap-1 text-[11px] font-mono h-7 px-2.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 border border-primary/30 transition-colors font-medium"
                  >
                    <Key className="h-3 w-3" />
                    <span>{isConfigured ? 'Update Key / Link' : 'Configure Key / Link'}</span>
                  </button>

                  {isConfigured && onProbeProvider && (
                    <button
                      type="button"
                      disabled={isCurrentlyProbing}
                      onClick={() => handleProbe(p.name)}
                      aria-label="Ping Probe"
                      title="Send lightweight health check probe"
                      className="inline-flex items-center justify-center gap-1 text-[10px] font-mono h-7 px-2 rounded-lg bg-secondary text-foreground hover:bg-secondary/80 border border-border transition-colors disabled:opacity-50"
                    >
                      {isCurrentlyProbing ? (
                        <RotateCw className="h-3 w-3 animate-spin text-primary" />
                      ) : (
                        <Zap className="h-3 w-3 text-amber-400" />
                      )}
                      <span className="sr-only">Ping Probe</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredProviders.length === 0 && (
        <div className="p-12 text-center rounded-2xl border border-dashed border-border text-muted-foreground space-y-2">
          <Cloud className="h-8 w-8 mx-auto text-muted-foreground/40" />
          <p className="text-sm">No AI providers match your query.</p>
          <button
            onClick={() => { setSearchQuery(''); setFilterType('ALL'); }}
            className="text-xs text-primary underline"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Configure Provider Modal */}
      {configTargetProvider && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Lock className="h-4 w-4 text-primary" />
                  Configure {configTargetProvider.display_name}
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Paste your API key or custom endpoint link. Stored encrypted in the server vault.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfigTargetProvider(null)}
                className="text-muted-foreground hover:text-foreground text-xs font-mono p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveConfiguration} className="space-y-4">
              <div>
                <label className="block text-xs font-mono font-medium text-foreground mb-1 flex items-center justify-between">
                  <span>API Key</span>
                  {configTargetProvider.website_url && (
                    <a
                      href={configTargetProvider.website_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-primary hover:underline inline-flex items-center gap-0.5"
                    >
                      Get Key <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  )}
                </label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="password"
                    placeholder={configTargetProvider.api_key_masked || "Paste API key (e.g. sk-ant-..., sk-or-...)"}
                    value={configApiKey}
                    onChange={(e) => setConfigApiKey(e.target.value)}
                    className="w-full text-xs font-mono pl-9 pr-3 py-2 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Leave blank to retain current vault key.
                </p>
              </div>

              <div>
                <label className="block text-xs font-mono font-medium text-foreground mb-1">
                  Custom Base URL / Proxy Link (Optional)
                </label>
                <div className="relative">
                  <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="url"
                    placeholder={`https://api.openai.com/v1 or ${getOllamaBaseUrl()}`}
                    value={configBaseUrl}
                    onChange={(e) => setConfigBaseUrl(e.target.value)}
                    className="w-full text-xs font-mono pl-9 pr-3 py-2 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 rounded-xl bg-secondary/40 border border-border/50">
                <input
                  type="checkbox"
                  id="auto_discover"
                  checked={autoDiscover}
                  onChange={(e) => setAutoDiscover(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-0"
                />
                <label htmlFor="auto_discover" className="text-xs text-foreground cursor-pointer select-none">
                  <span className="font-semibold">Auto-Discover Available Models</span>
                  <span className="block text-[10px] text-muted-foreground">
                    Query the provider endpoint to automatically register all accessible models.
                  </span>
                </label>
              </div>

              {configStatusMessage && (
                <div className="p-2.5 rounded-xl bg-secondary/80 text-[11px] font-mono text-foreground border border-border">
                  {configStatusMessage}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                <button
                  type="button"
                  onClick={() => setConfigTargetProvider(null)}
                  className="px-4 py-2 text-xs font-mono rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isConfiguring}
                  className="px-4 py-2 text-xs font-mono font-bold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isConfiguring ? <RotateCw className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
                  <span>Save to Encrypted Vault</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Custom Provider Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h3 className="text-sm font-bold text-foreground">Add Custom AI Provider</h3>
                <p className="text-[11px] text-muted-foreground">
                  Connect a private cluster, proxy, or novel vendor node conforming to OpenAI-compatible specs.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-muted-foreground hover:text-foreground text-xs font-mono p-1"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!onAddProvider) return;
                await onAddProvider({
                  name: newProviderForm.name.toLowerCase().replace(/\s+/g, '_'),
                  display_name: newProviderForm.display_name,
                  description: newProviderForm.description || undefined,
                  website_url: newProviderForm.website_url || undefined,
                  base_url: newProviderForm.base_url || undefined,
                  api_key: newProviderForm.api_key || undefined,
                  is_local: newProviderForm.is_local,
                });
                setShowAddModal(false);
                setNewProviderForm({
                  name: '',
                  display_name: '',
                  description: '',
                  website_url: '',
                  base_url: '',
                  api_key: '',
                  is_local: false,
                });
              }}
              className="space-y-3"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono font-medium text-foreground mb-1">
                    Provider ID *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="my_private_cluster"
                    value={newProviderForm.name}
                    onChange={(e) => setNewProviderForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full text-xs font-mono px-3 py-2 rounded-xl border border-border bg-background text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono font-medium text-foreground mb-1">
                    Display Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="My Private Cluster"
                    value={newProviderForm.display_name}
                    onChange={(e) => setNewProviderForm((f) => ({ ...f, display_name: e.target.value }))}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-border bg-background text-foreground"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono font-medium text-foreground mb-1">
                  Base URL / Endpoint
                </label>
                <input
                  type="url"
                  placeholder={`${getApiBaseUrl()}/v1`}
                  value={newProviderForm.base_url}
                  onChange={(e) => setNewProviderForm((f) => ({ ...f, base_url: e.target.value }))}
                  className="w-full text-xs font-mono px-3 py-2 rounded-xl border border-border bg-background text-foreground"
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-medium text-foreground mb-1">
                  API Key (Encrypted in Vault)
                </label>
                <input
                  type="password"
                  placeholder="Optional API key"
                  value={newProviderForm.api_key}
                  onChange={(e) => setNewProviderForm((f) => ({ ...f, api_key: e.target.value }))}
                  className="w-full text-xs font-mono px-3 py-2 rounded-xl border border-border bg-background text-foreground"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="custom_is_local"
                  checked={newProviderForm.is_local}
                  onChange={(e) => setNewProviderForm((f) => ({ ...f, is_local: e.target.checked }))}
                  className="rounded border-border text-primary"
                />
                <label htmlFor="custom_is_local" className="text-xs text-foreground cursor-pointer select-none">
                  Air-Gapped / On-Premise Local Node
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-mono rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddingProvider}
                  className="px-4 py-2 text-xs font-mono font-bold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5"
                >
                  {isAddingProvider ? <RotateCw className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  <span>Register Provider</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
