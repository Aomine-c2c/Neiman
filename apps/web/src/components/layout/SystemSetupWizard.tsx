'use client';

import React, { useState, useEffect } from 'react';
import {
  Code,
  Play,
  RotateCw,
  Cpu,
  ArrowRight,
  Server,
  AlertCircle,
  Check,
  GitBranch,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { blueprintsApi, type CompanyBlueprint } from '@/lib/api/blueprints';
import { systemConfigApi, type ProviderKeyStatus, type ProviderKeyUpdate } from '@/lib/api/systemUpdates';
import { useAuthStore } from '@/store/auth';
import { NEIMAN_CONFIG, getOllamaBaseUrl } from '@neiman/config';
import { NeimanLogo } from '@/components/ui/NeimanLogo';

interface SystemSetupWizardProps {
  onCompleted?: () => void;
  isOpen: boolean;
  onClose?: () => void;
}

type PrimaryProviderId =
  | 'gemini'
  | 'claude'
  | 'openai'
  | 'ollama'
  | 'openrouter'
  | 'groq'
  | 'deepseek'
  | 'mistral'
  | 'xai'
  | 'cerebras'
  | 'together_ai'
  | 'cohere';

interface ProviderCardDef {
  id: PrimaryProviderId;
  name: string;
  model: string;
  desc: string;
  tier: 'primary' | 'extended';
  updateField: keyof ProviderKeyUpdate;
  statusField: keyof ProviderKeyStatus;
}

const PROVIDER_DEFS: ProviderCardDef[] = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    model: 'Google Gemini API',
    desc: 'Cloud model provider',
    tier: 'primary',
    updateField: 'gemini_api_key',
    statusField: 'gemini_configured',
  },
  {
    id: 'claude',
    name: 'Anthropic Claude',
    model: 'Anthropic API',
    desc: 'Cloud model provider',
    tier: 'primary',
    updateField: 'anthropic_api_key',
    statusField: 'anthropic_configured',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    model: 'OpenAI API',
    desc: 'Cloud model provider',
    tier: 'primary',
    updateField: 'openai_api_key',
    statusField: 'openai_configured',
  },
  {
    id: 'ollama',
    name: 'Local Ollama',
    model: 'Ollama endpoint',
    desc: 'Local model server; must be installed and running',
    tier: 'primary',
    updateField: 'ollama_host',
    statusField: 'ollama_host',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    model: 'Unified Gateway',
    desc: 'Multi-model routing gateway',
    tier: 'extended',
    updateField: 'openrouter_api_key',
    statusField: 'openrouter_configured',
  },
  {
    id: 'groq',
    name: 'Groq LPU',
    model: 'Ultra-low latency',
    desc: 'High-speed LPU inference',
    tier: 'extended',
    updateField: 'groq_api_key',
    statusField: 'groq_configured',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    model: 'DeepSeek R1 / V3',
    desc: 'Reasoning & coding specialist',
    tier: 'extended',
    updateField: 'deepseek_api_key',
    statusField: 'deepseek_configured',
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    model: 'Codestral / Large',
    desc: 'European frontier models',
    tier: 'extended',
    updateField: 'mistral_api_key',
    statusField: 'mistral_configured',
  },
  {
    id: 'xai',
    name: 'xAI Grok',
    model: 'Grok API',
    desc: 'Frontier reasoning model',
    tier: 'extended',
    updateField: 'xai_api_key',
    statusField: 'xai_configured',
  },
  {
    id: 'cerebras',
    name: 'Cerebras',
    model: 'Wafer-Scale Engine',
    desc: 'High-speed token generation',
    tier: 'extended',
    updateField: 'cerebras_api_key',
    statusField: 'cerebras_configured',
  },
  {
    id: 'together_ai',
    name: 'Together AI',
    model: 'Open-weights cloud',
    desc: 'Hosted open-source models',
    tier: 'extended',
    updateField: 'together_ai_api_key',
    statusField: 'together_ai_configured',
  },
  {
    id: 'cohere',
    name: 'Cohere',
    model: 'Command R+',
    desc: 'Enterprise RAG & synthesis',
    tier: 'extended',
    updateField: 'cohere_api_key',
    statusField: 'cohere_configured',
  },
];

export function SystemSetupWizard({ onCompleted, isOpen, onClose }: SystemSetupWizardProps) {
  const [step, setStep] = useState<'welcome' | 'providers' | 'configure'>('welcome');
  const [selectedProvider, setSelectedProvider] = useState<PrimaryProviderId>('gemini');
  const [showExtendedProviders, setShowExtendedProviders] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [ollamaUrl, setOllamaUrl] = useState(getOllamaBaseUrl());
  const [providerTestStatus, setProviderTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [providerTestMsg, setProviderTestMsg] = useState<string | null>(null);
  const [providerSaving, setProviderSaving] = useState(false);
  const [providerSaveError, setProviderSaveError] = useState<string | null>(null);
  const [providerStatus, setProviderStatus] = useState<ProviderKeyStatus | null>(null);
  const [providerLoadError, setProviderLoadError] = useState<string | null>(null);

  // Blueprints Catalog State
  const [blueprints, setBlueprints] = useState<CompanyBlueprint[]>([]);
  const [selectedBlueprintKey, setSelectedBlueprintKey] = useState<string>('software_development_company');
  const [blueprintLoadError, setBlueprintLoadError] = useState<string | null>(null);

  // Company & Repository Configuration
  const [companyName, setCompanyName] = useState('');
  const [repoMode, setRepoMode] = useState<'local' | 'git' | 'recent'>('local');
  const [repoPath, setRepoPath] = useState('');
  const [repoBranch, setRepoBranch] = useState('main');
  const [cleanReset, setCleanReset] = useState(false);
  const [resetConfirmationPhrase, setResetConfirmationPhrase] = useState('');
  const [autonomyLevel, setAutonomyLevel] = useState<'L1' | 'L2' | 'L3'>('L2');
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const { setActiveCompany } = useAuthStore();

  const activeProviderDef = PROVIDER_DEFS.find((p) => p.id === selectedProvider) ?? PROVIDER_DEFS[0];
  const selectedProviderConfigured = providerStatus
    ? Boolean(providerStatus[activeProviderDef.statusField])
    : false;

  const activeBlueprint =
    blueprints.find((bp) => bp.key === selectedBlueprintKey) ?? blueprints[0] ?? null;
  const blueprintAgents = activeBlueprint?.agents ?? [];

  useEffect(() => {
    if (isOpen) {
      setProviderLoadError(null);
      systemConfigApi
        .getProviderKeys()
        .then((res) => {
          setProviderStatus(res);
          if (res.gemini_configured) setSelectedProvider('gemini');
          else if (res.anthropic_configured) setSelectedProvider('claude');
          else if (res.openai_configured) setSelectedProvider('openai');
          if (res.ollama_host) setOllamaUrl(res.ollama_host);
        })
        .catch((error: unknown) => {
          setProviderLoadError(error instanceof Error ? error.message : 'Could not read provider configuration.');
        });
      setBlueprintLoadError(null);
      blueprintsApi
        .listBlueprints()
        .then((list) => {
          setBlueprints(list);
          if (list.length > 0) {
            setSelectedBlueprintKey((prev) =>
              list.some((item) => item.key === prev) ? prev : list[0].key
            );
          }
        })
        .catch((error: unknown) => {
          setBlueprints([]);
          setBlueprintLoadError(error instanceof Error ? error.message : 'Could not load the company blueprints.');
        });
    }
  }, [isOpen]);

  const finishSetupWithCompany = (company: {
    id: string;
    name: string;
    slug: string;
    status: string;
    owner_id: string;
    created_at: string;
    updated_at: string;
  }) => {
    setActiveCompany(company);
    if (typeof window !== 'undefined') {
      localStorage.setItem(NEIMAN_CONFIG.STORAGE_KEYS.SETUP_VERSION, 'completed');
    }
    queryClient.invalidateQueries({ queryKey: ['organizations'] });
    queryClient.invalidateQueries({ queryKey: ['companies'] });
    queryClient.invalidateQueries({ queryKey: ['control-room-summary'] });
    queryClient.invalidateQueries({ queryKey: ['control-room-state'] });
    queryClient.invalidateQueries({ queryKey: ['agents'] });
    queryClient.invalidateQueries({ queryKey: ['projects'] });
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    if (onCompleted) onCompleted();
    if (onClose) onClose();
  };

  const instantiateMutation = useMutation({
    mutationFn: ({ key, name, customizations }: { key: string; name?: string; customizations?: Record<string, unknown> }) =>
      blueprintsApi.instantiateBlueprint(key, { company_name: name, customizations }),
    onSuccess: (data) => {
      setLaunchError(null);
      if (data && data.company_id) {
        finishSetupWithCompany({
          id: data.company_id,
          name: data.company_name,
          slug: data.slug,
          status: data.company_status,
          owner_id: data.owner_id,
          created_at: data.created_at,
          updated_at: data.updated_at,
        });
      }
    },
    onError: (err: unknown) => {
      const errorObj = err && typeof err === 'object' ? (err as Record<string, unknown>) : null;
      const msg =
        errorObj?.message ||
        errorObj?.detail ||
        'Failed to instantiate blueprint company. Ensure backend API is operational.';
      setLaunchError(String(msg));
    },
    onSettled: () => {
      setIsLaunching(false);
    },
  });

  const handleTestOllama = async () => {
    setProviderTestStatus('testing');
    setProviderTestMsg('Saving the endpoint and checking the local Ollama daemon...');
    try {
      const savedHost = ollamaUrl.trim();
      if (!savedHost) {
        setProviderTestStatus('failed');
        setProviderTestMsg('Enter an Ollama endpoint before checking it.');
        return;
      }
      setProviderStatus(await systemConfigApi.updateProviderKeys({ ollama_host: savedHost }));
      const res = await systemConfigApi.getExtendedHealth();
      const ollama = res.providers?.ollama;
      if (ollama && ollama.status === 'reachable' && (ollama.available_models?.length ?? 0) > 0) {
        setProviderTestStatus('success');
        const count = ollama.available_models?.length || 0;
        setProviderTestMsg(`Connected! Found ${count} local models available.`);
      } else if (ollama?.status === 'reachable') {
        setProviderTestStatus('failed');
        setProviderTestMsg('Ollama responded, but it reports no installed models. Install a model before using it.');
      } else {
        setProviderTestStatus('failed');
        setProviderTestMsg('Ollama is unreachable at given URL. Ensure `ollama serve` is active.');
      }
    } catch (error: unknown) {
      setProviderTestStatus('failed');
      setProviderTestMsg(error instanceof Error ? error.message : 'Unable to save or reach the Ollama endpoint.');
    }
  };

  const handleSaveProvider = async () => {
    setProviderSaving(true);
    try {
      const updates: ProviderKeyUpdate = {};
      if (selectedProvider === 'ollama' && ollamaUrl.trim()) {
        updates.ollama_host = ollamaUrl.trim();
      } else if (apiKey.trim()) {
        updates[activeProviderDef.updateField] = apiKey.trim();
      }

      if (Object.keys(updates).length > 0) {
        setProviderStatus(await systemConfigApi.updateProviderKeys(updates));
      }
      setProviderSaveError(null);
      setStep('configure');
    } catch (error: unknown) {
      setProviderSaveError(error instanceof Error ? error.message : 'Provider configuration could not be saved.');
    } finally {
      setProviderSaving(false);
    }
  };

  const handleLaunchSoftwareCompany = async () => {
    const customName = companyName.trim();
    if (!customName) {
      setLaunchError('Enter a company name before creating it.');
      return;
    }
    if (repoBranch.trim() && repoBranch.trim() !== 'main' && !repoPath.trim()) {
      setLaunchError('Enter the repository path before specifying a branch.');
      return;
    }
    if (cleanReset && resetConfirmationPhrase.trim() !== 'RESET NEIMAN OPERATIONAL DATA') {
      setLaunchError('Type RESET NEIMAN OPERATIONAL DATA to confirm the database reset.');
      return;
    }
    setIsLaunching(true);
    setLaunchError(null);
    try {
      if (cleanReset) {
        const resetResult = await systemConfigApi.resetSetup(resetConfirmationPhrase.trim());
        if (resetResult.warnings?.length) {
          throw new Error(`Reset completed with warnings: ${resetResult.warnings.join(' ')}`);
        }
      }
      const customizations: Record<string, unknown> = {
        autonomy_level: autonomyLevel === 'L3' ? 3 : autonomyLevel === 'L2' ? 2 : 1,
      };
      if (repoPath.trim()) customizations.local_path = repoPath.trim();
      if (repoPath.trim() && repoBranch.trim()) customizations.branch = repoBranch.trim();
      instantiateMutation.mutate({
        key: activeBlueprint?.key || selectedBlueprintKey || 'software_development_company',
        name: customName,
        customizations,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Clean database reset failed before instantiation';
      setLaunchError(msg);
      setIsLaunching(false);
    }
  };

  if (!isOpen) return null;

  const visibleProviders = showExtendedProviders
    ? PROVIDER_DEFS
    : PROVIDER_DEFS.filter((p) => p.tier === 'primary');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 backdrop-blur-md p-4 animate-fade-in overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="setup-wizard-title"
    >
      <div className="w-full max-w-4xl rounded-xl border border-border bg-card shadow-2xl p-6 sm:p-8 space-y-6 text-card-foreground relative ring-1 ring-border my-8">
        {/* Step indicator header */}
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl border border-primary/30 bg-primary/10 flex items-center justify-center p-1.5">
              <NeimanLogo size="sm" showWordmark={false} withGlow={true} />
            </div>
            <div>
              <h2
                id="setup-wizard-title"
                className="text-sm font-mono font-bold text-foreground uppercase tracking-widest flex items-center gap-2"
              >
                <span className="h-2 w-2 rounded-full bg-primary" />
                NEIMAN OS SETUP PROTOCOL
              </h2>
              <p className="text-[11px] font-sans text-muted-foreground mt-0.5">
                Create a company from a blueprint, then connect the services and repository you actually use.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 font-mono text-[10px]">
            <span
              className={`px-2 py-0.5 rounded border uppercase tracking-wider ${
                step === 'welcome'
                  ? 'bg-foreground text-background border-foreground font-bold'
                  : 'bg-secondary text-muted-foreground border-border'
              }`}
            >
              01/OVERVIEW
            </span>
            <span className="text-muted-foreground/40 font-mono">/</span>
            <span
              className={`px-2 py-0.5 rounded border uppercase tracking-wider ${
                step === 'providers'
                  ? 'bg-foreground text-background border-foreground font-bold'
                  : 'bg-secondary text-muted-foreground border-border'
              }`}
            >
              02/AI PROVIDER
            </span>
            <span className="text-muted-foreground/40 font-mono">/</span>
            <span
              className={`px-2 py-0.5 rounded border uppercase tracking-wider ${
                step === 'configure'
                  ? 'bg-foreground text-background border-foreground font-bold'
                  : 'bg-secondary text-muted-foreground border-border'
              }`}
            >
              03/LAUNCH COMPANY
            </span>
          </div>
        </div>

        {/* ── STEP 1: WELCOME & PRINCIPLES ── */}
        {step === 'welcome' && (
          <div className="space-y-6 animate-fade-in font-mono">
            <div className="p-4 rounded-lg border border-border bg-secondary/30 text-xs space-y-2">
              <span className="font-bold text-primary text-xs flex items-center gap-2 uppercase tracking-widest">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                WHAT THIS SETUP ACTUALLY DOES
              </span>
              <p className="text-muted-foreground font-sans text-[11px] leading-relaxed">
                Setup creates company, agent, project, and task records from a template. It does not provision people,
                validate model access, inspect repository contents, or run CI for you.
              </p>
            </div>

            {/* Coding Pipeline Overview */}
            <div className="p-4 rounded-xl border border-border bg-secondary/20 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-foreground">
                <div className="flex items-center gap-2">
                  <Code className="h-4 w-4 text-primary" />
                  <span>Example software delivery workflow</span>
                </div>
                <span className="text-[10px] text-muted-foreground font-mono">BLUEPRINT WORKFLOW</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-[10px] font-mono">
                <div className="p-2.5 rounded bg-background border border-border space-y-1">
                  <span className="text-primary font-bold block">STAGE 1</span>
                  <span className="text-foreground font-semibold block">Spec & PRD</span>
                  <p className="text-muted-foreground font-sans text-[10px]">Spec completeness & user stories</p>
                </div>
                <div className="p-2.5 rounded bg-background border border-border space-y-1">
                  <span className="text-indigo-500 font-bold block">STAGE 2</span>
                  <span className="text-foreground font-semibold block">Architecture ADR</span>
                  <p className="text-muted-foreground font-sans text-[10px]">Interface contracts & CEO approval</p>
                </div>
                <div className="p-2.5 rounded bg-background border border-border space-y-1">
                  <span className="text-blue-500 font-bold block">STAGE 3</span>
                  <span className="text-foreground font-semibold block">Git Worktrees</span>
                  <p className="text-muted-foreground font-sans text-[10px]">Isolated branch sandboxes</p>
                </div>
                <div className="p-2.5 rounded bg-background border border-border space-y-1">
                  <span className="text-emerald-500 font-bold block">STAGE 4</span>
                  <span className="text-foreground font-semibold block">Parallel Coding</span>
                  <p className="text-muted-foreground font-sans text-[10px]">Frontend, Backend, DB & Review</p>
                </div>
                <div className="p-2.5 rounded bg-background border border-border space-y-1">
                  <span className="text-purple-500 font-bold block">STAGE 5</span>
                  <span className="text-foreground font-semibold block">TDD & Release</span>
                  <p className="text-muted-foreground font-sans text-[10px]">Testing and release depend on your tools</p>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg border border-border bg-secondary/10 text-xs font-sans text-muted-foreground">
              Access and permissions depend on this installation&apos;s authentication settings.
            </div>

            <div className="flex justify-end pt-4 border-t border-border">
              <button
                type="button"
                onClick={() => setStep('providers')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-all"
              >
                <span>Continue: Link AI Models</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: LINK AI PROVIDER ── */}
        {step === 'providers' && (
          <div className="space-y-6 animate-fade-in font-mono">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-foreground">Connect an AI provider (optional)</h3>
                <p className="text-xs font-sans text-muted-foreground mt-0.5">
                  A saved key only confirms that a credential exists. Provider access is verified when a real request is made.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowExtendedProviders((v) => !v)}
                className="flex items-center gap-1 text-[10px] font-mono text-primary hover:underline shrink-0"
              >
                <span>{showExtendedProviders ? 'Show Core Providers' : 'More Cloud Providers (12)'}</span>
                {showExtendedProviders ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
            </div>

            {providerLoadError && (
              <div role="alert" className="rounded border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-500">
                Could not read saved provider settings: {providerLoadError}
              </div>
            )}
            {providerSaveError && (
              <div role="alert" className="rounded border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                Provider settings were not saved: {providerSaveError}
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {visibleProviders.map((prov) => {
                const isSelected = selectedProvider === prov.id;
                const isConfigured = providerStatus ? Boolean(providerStatus[prov.statusField]) : false;
                const badge = providerStatus
                  ? prov.id === 'ollama'
                    ? isConfigured
                      ? 'Endpoint saved'
                      : 'Not configured'
                    : isConfigured
                    ? 'Key configured'
                    : 'No key'
                  : 'Status unknown';

                return (
                  <button
                    key={prov.id}
                    type="button"
                    onClick={() => {
                      setSelectedProvider(prov.id);
                      setApiKey('');
                      setProviderTestStatus('idle');
                      setProviderTestMsg(null);
                    }}
                    className={`flex flex-col text-left p-3 rounded-lg border transition-all text-xs ${
                      isSelected
                        ? 'border-primary bg-primary/10 ring-1 ring-primary'
                        : 'border-border bg-secondary/20 hover:bg-secondary/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5 gap-1">
                      <span className="font-bold text-foreground truncate">{prov.name}</span>
                      <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-secondary text-primary font-semibold shrink-0">
                        {badge}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground mb-0.5">{prov.model}</span>
                    <span className="text-[10px] font-sans text-muted-foreground leading-tight">{prov.desc}</span>
                  </button>
                );
              })}
            </div>

            {/* Provider credentials configuration */}
            <div className="p-4 rounded-lg bg-secondary/30 border border-border space-y-3 text-xs">
              {selectedProvider === 'ollama' ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="font-medium text-foreground">Local Ollama Endpoint URL</label>
                    <button
                      type="button"
                      onClick={handleTestOllama}
                      disabled={providerTestStatus === 'testing'}
                      className="flex items-center gap-1.5 text-[10px] font-mono text-primary hover:underline"
                    >
                      {providerTestStatus === 'testing' ? (
                        <RotateCw className="h-3 w-3 animate-spin" />
                      ) : (
                        <Server className="h-3 w-3" />
                      )}
                      Test Connection
                    </button>
                  </div>
                  <input
                    type="text"
                    value={ollamaUrl}
                    onChange={(e) => setOllamaUrl(e.target.value)}
                    placeholder={NEIMAN_CONFIG.NETWORK.DEFAULT_OLLAMA_URL}
                    className="w-full bg-secondary/60 border border-border rounded px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
                  />
                  {providerTestMsg && (
                    <div
                      className={`text-[11px] font-mono flex items-center gap-1.5 ${
                        providerTestStatus === 'success' ? 'text-emerald-500' : 'text-destructive'
                      }`}
                    >
                      {providerTestStatus === 'success' ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5" />
                      )}
                      <span>{providerTestMsg}</span>
                    </div>
                  )}
                  <span className="text-[10px] font-sans text-muted-foreground block">
                    Requests go to the configured endpoint. Use a local address if the model must stay on this machine.
                  </span>
                </div>
              ) : (
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-medium text-foreground">{activeProviderDef.name} API Key</label>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {!providerStatus
                        ? 'Provider configuration is unknown; this screen cannot confirm credentials.'
                        : selectedProviderConfigured
                        ? 'A credential is configured; this screen does not verify access.'
                        : 'No credential configured; model requests will be unavailable.'}
                    </span>
                  </div>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Paste a provider API key"
                    className="w-full bg-secondary/60 border border-border rounded px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
                  />
                  <span className="text-[10px] font-sans text-muted-foreground mt-1 block">
                    Keys are saved in local API configuration and an encrypted provider record. Access is not validated here.
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border">
              <button
                type="button"
                onClick={() => setStep('welcome')}
                className="px-4 py-2 rounded text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Back
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStep('configure')}
                  className="px-4 py-2 rounded text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  Continue without provider (AI execution unavailable)
                </button>
                <button
                  type="button"
                  disabled={
                    providerSaving ||
                    (selectedProvider === 'ollama'
                      ? providerTestStatus !== 'success'
                      : !apiKey.trim() && !selectedProviderConfigured)
                  }
                  onClick={handleSaveProvider}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-all"
                >
                  {providerSaving ? (
                    <>
                      <RotateCw className="h-4 w-4 animate-spin" />
                      <span>Saving Key...</span>
                    </>
                  ) : (
                    <>
                      <span>Save Provider & Continue</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 3: SELECT BLUEPRINT, CONFIGURE & LAUNCH COMPANY ── */}
        {step === 'configure' && (
          <div className="space-y-5 animate-fade-in font-mono">
            <div>
              <h3 className="text-sm font-bold text-foreground">Create a company from a blueprint</h3>
              <p className="text-xs font-sans text-muted-foreground mt-0.5">
                Select an organizational blueprint template below. Task execution stays paused until you start the supervisor.
              </p>
            </div>

            {launchError && (
              <div className="p-3 rounded border border-destructive/40 bg-destructive/10 text-xs font-mono text-destructive flex items-center justify-between">
                <span>[ERROR] {launchError}</span>
                <button
                  type="button"
                  onClick={() => setLaunchError(null)}
                  className="text-[10px] uppercase font-bold underline hover:no-underline"
                >
                  DISMISS
                </button>
              </div>
            )}

            {/* Blueprint Catalog Selector */}
            {blueprints.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-foreground uppercase tracking-widest flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-primary" />
                  SELECT ORGANIZATIONAL BLUEPRINT ({blueprints.length})
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-40 overflow-y-auto pr-1">
                  {blueprints.map((bp) => {
                    const active = bp.key === (activeBlueprint?.key ?? selectedBlueprintKey);
                    return (
                      <button
                        key={bp.id || bp.key}
                        type="button"
                        onClick={() => setSelectedBlueprintKey(bp.key)}
                        className={`text-left p-2.5 rounded-lg border transition-all ${
                          active
                            ? 'border-primary bg-primary/10 ring-1 ring-primary'
                            : 'border-border bg-secondary/20 hover:bg-secondary/40'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-bold text-foreground truncate">{bp.name}</span>
                          <span className="text-[8px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground uppercase shrink-0">
                            {bp.category}
                          </span>
                        </div>
                        <p className="text-[10px] font-sans text-muted-foreground line-clamp-2 mt-1">
                          {bp.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Company Parameters */}
            <div className="p-4 rounded-xl border border-border bg-secondary/20 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Company Name <span className="text-primary">*</span>
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Acme Software"
                    className="w-full bg-background border border-border rounded px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  />
                  <span className="text-[10px] font-sans text-muted-foreground mt-0.5 block">
                    Used as the company name in this installation.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Coding Autonomy Level</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: 'L1', label: 'L1 Centralized', desc: 'Blueprint delegation level 1' },
                      { id: 'L2', label: 'L2 Guided', desc: 'Blueprint delegation level 2' },
                      { id: 'L3', label: 'L3 Balanced', desc: 'Blueprint delegation level 3' },
                    ].map((lvl) => (
                      <button
                        key={lvl.id}
                        type="button"
                        onClick={() => setAutonomyLevel(lvl.id as 'L1' | 'L2' | 'L3')}
                        className={`p-2 rounded border text-left text-[10px] transition-all ${
                          autonomyLevel === lvl.id
                            ? 'border-primary bg-primary/10 ring-1 ring-primary font-bold'
                            : 'border-border bg-background hover:bg-secondary/40 text-muted-foreground'
                        }`}
                      >
                        <span className="text-foreground block">{lvl.label}</span>
                        <span className="text-[9px] font-sans block text-muted-foreground leading-tight">{lvl.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Repository & Codebase Connection (Local Directory / Git URL / Recent Workspaces) */}
              <div className="p-3.5 rounded-xl border border-border/80 bg-background/60 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <GitBranch className="h-3.5 w-3.5 text-primary" />
                    Connect Repository / Codebase
                  </label>
                  <div className="inline-flex rounded-lg border border-border bg-secondary/50 p-0.5 text-[11px] font-sans">
                    <button
                      type="button"
                      onClick={() => setRepoMode('local')}
                      className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                        repoMode === 'local'
                          ? 'bg-card text-foreground shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Local Directory
                    </button>
                    <button
                      type="button"
                      onClick={() => setRepoMode('git')}
                      className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                        repoMode === 'git'
                          ? 'bg-card text-foreground shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Git Repository URL
                    </button>
                    <button
                      type="button"
                      onClick={() => setRepoMode('recent')}
                      className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                        repoMode === 'recent'
                          ? 'bg-card text-foreground shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Recent Workspaces
                    </button>
                  </div>
                </div>

                {repoMode === 'recent' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      { name: 'Sila / NEIMAN Monorepo', path: '/home/devine-general/Projects/Sila', stack: 'Next.js • FastAPI • Tauri' },
                      { name: 'Current Host Workspace', path: './', stack: 'TypeScript • Python • Git' },
                    ].map((ws) => (
                      <button
                        key={ws.path}
                        type="button"
                        onClick={() => {
                          setRepoPath(ws.path);
                          if (!companyName.trim()) setCompanyName(ws.name);
                          setRepoMode('local');
                        }}
                        className="flex flex-col text-left p-2.5 rounded-lg border border-border bg-card hover:border-primary/40 transition-colors"
                      >
                        <span className="text-xs font-semibold text-foreground">{ws.name}</span>
                        <span className="text-[11px] font-mono text-muted-foreground truncate">{ws.path}</span>
                        <span className="text-[10px] text-primary mt-1">{ws.stack}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="sm:col-span-2">
                      <input
                        type="text"
                        value={repoPath}
                        onChange={(e) => setRepoPath(e.target.value)}
                        placeholder={
                          repoMode === 'git'
                            ? 'https://github.com/org/repository.git or git@github.com:org/repo.git'
                            : 'Absolute path on disk (e.g. /home/dev/project)'
                        }
                        className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        value={repoBranch}
                        onChange={(e) => setRepoBranch(e.target.value)}
                        placeholder="Branch (e.g. main)"
                        title="Branch"
                        className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs font-mono text-center text-foreground focus:outline-none focus:border-primary"
                      />
                    </div>
                  </div>
                )}

                {/* Detected Architecture & Stack Summary Pill Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-[11px] font-sans">
                  <div className="flex items-center gap-2">
                    <Code className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="font-semibold text-foreground">Architecture & Stack Summary:</span>
                    <span className="text-muted-foreground">
                      TypeScript • Next.js • Python FastAPI • Automated QA Squad ({blueprintAgents.length} Specialists Ready)
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-primary font-semibold uppercase">1-Click Squad Launch</span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-[11px] text-foreground">
                    <input
                      type="checkbox"
                      checked={cleanReset}
                      onChange={(e) => {
                        setCleanReset(e.target.checked);
                        if (!e.target.checked) setResetConfirmationPhrase('');
                      }}
                      className="rounded border-border accent-primary"
                    />
                    <span>Reset existing operational data before creating the company</span>
                  </label>
                </div>
                {cleanReset && (
                  <div
                    role="alert"
                    className="rounded border border-destructive/40 bg-destructive/10 p-3 space-y-2 text-[10px] leading-relaxed text-destructive"
                  >
                    <p>
                      This permanently resets operational databases, vector memory, and setup state. A verified database
                      backup is created first. Type <strong>RESET NEIMAN OPERATIONAL DATA</strong> below to confirm:
                    </p>
                    <input
                      type="text"
                      value={resetConfirmationPhrase}
                      onChange={(e) => setResetConfirmationPhrase(e.target.value)}
                      placeholder="RESET NEIMAN OPERATIONAL DATA"
                      aria-label="Confirmation phrase for database reset"
                      className="w-full bg-background border border-destructive/50 rounded px-2.5 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:border-destructive"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Blueprint agent role definitions */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground uppercase tracking-widest flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-primary" />
                  AGENT ROLE DEFINITIONS ({blueprintAgents.length})
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">Records are created on launch</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 max-h-[220px] overflow-y-auto pr-1">
                {blueprintAgents.map((ag) => (
                  <div
                    key={`${ag.name}-${ag.role_title}`}
                    className="p-3 rounded-lg border border-border bg-secondary/15 space-y-1.5 hover:border-primary/50 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Cpu className="h-4 w-4 text-primary" />
                        <span className="font-bold text-foreground text-[11px]">{ag.name}</span>
                      </div>
                      <span className="text-[8px] font-mono px-1 py-0.5 rounded bg-secondary text-muted-foreground uppercase">
                        {ag.role_title}
                      </span>
                    </div>
                    <p className="text-[10px] font-sans text-muted-foreground line-clamp-2 leading-tight">
                      {ag.responsibilities?.slice(0, 2).join(' · ') ||
                        ag.capabilities?.slice(0, 2).join(' · ') ||
                        'No responsibility details are defined in this blueprint.'}
                    </p>
                  </div>
                ))}
              </div>
              {blueprintLoadError && (
                <p role="alert" className="text-xs text-amber-500">
                  Blueprint roster unavailable: {blueprintLoadError}
                </p>
              )}
              {!blueprintLoadError && blueprintAgents.length === 0 && (
                <p className="text-xs text-muted-foreground">No agent roles were returned by the blueprint API.</p>
              )}
            </div>

            {/* Launch CTA */}
            <div className="pt-2">
              <button
                type="button"
                disabled={
                  isLaunching ||
                  !companyName.trim() ||
                  (cleanReset && resetConfirmationPhrase.trim() !== 'RESET NEIMAN OPERATIONAL DATA')
                }
                onClick={handleLaunchSoftwareCompany}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md disabled:opacity-50 transition-all tracking-wider uppercase"
              >
                {isLaunching ? (
                  <>
                    <RotateCw className="h-4 w-4 animate-spin" />
                    <span>Provisioning Company & Agents...</span>
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 fill-current" />
                    <span>Create Company from Blueprint</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setStep('providers')}
                className="px-4 py-2 rounded text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Back to Models
              </button>
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    localStorage.setItem(NEIMAN_CONFIG.STORAGE_KEYS.SETUP_VERSION, 'completed');
                  }
                  if (onClose) onClose();
                }}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Explore Workspace Manually
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
