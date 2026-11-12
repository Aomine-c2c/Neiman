'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Building2,
  Users,
  Shield,
  Key,
  Lock,
  Cpu,
  Zap,
  Cloud,
  Database,
  FileText,
  Boxes,
  Bell,
  Palette,
  Clock,
  Terminal,
  Code,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  Copy,
  Check,
  Plus,
  Trash2,
  Save,
  RotateCw,
  LogOut,
  UserRound,
  ShieldCheck,
  ChevronRight,
  Info,
  Filter,
  Sparkles,
  Search,
  Layers,
  Sun,
  Moon,
  Monitor,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { useAccountContext, useOrganizationContext } from '@/lib/organizationContext';
import { isDevelopmentAuthBypassEnabled } from '@/lib/authPreview';
import { DesktopStatusCard } from '@/components/desktop/DesktopStatusCard';
import { api } from '@/lib/api/client';
import { systemConfigApi } from '@/lib/api/systemUpdates';
import {
  intelligenceApi,
  type Model as IntelligenceModel,
  type ModelProvider,
  type ModelRoutingPolicy,
} from '@/lib/api/intelligence';
import { agentsApi, type Agent as WorkforceAgent } from '@/lib/api/agents';
import { NEIMAN_CONFIG, getOllamaBaseUrl } from '@neiman/config';
import { useTheme } from '@/components/ThemeProvider';

// 15 Administration Sections
type AdminSectionKey =
  | 'organization'
  | 'ai-providers'
  | 'models'
  | 'appearance'
  | 'developer';

type SettingsTier = 'simple' | 'advanced';

import { type RBACRole, hasRoleAccess } from '@neiman/permissions';
export type { RBACRole };

interface SectionMeta {
  key: AdminSectionKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tier: 'simple' | 'advanced' | 'both';
  requiredRole: RBACRole;
  dangerous?: boolean;
  description: string;
}

const SECTIONS: SectionMeta[] = [
  { key: 'ai-providers', label: 'AI Providers', icon: Cpu, tier: 'both', requiredRole: 'ADMIN', description: 'Vendor credentials, endpoint gateways, and circuit-breaker telemetry.' },
  { key: 'models', label: 'Models', icon: Zap, tier: 'simple', requiredRole: 'MANAGER', description: 'Allowed model whitelist, default mappings, and temperature guardrails.' },
  { key: 'organization', label: 'Workspace', icon: Building2, tier: 'simple', requiredRole: 'VIEWER', description: 'Active workspace identity, repository ID, and operational status.' },
  { key: 'appearance', label: 'Appearance', icon: Palette, tier: 'simple', requiredRole: 'VIEWER', description: 'Theme defaults, font scaling, command center accent colors, and density.' },
  { key: 'developer', label: 'Developer Settings', icon: Terminal, tier: 'advanced', requiredRole: 'SUPERADMIN', dangerous: true, description: 'Desktop runtime status, RBAC role preview, and system reset.' },
];

type SettingsCategoryKey = 'ai-routing' | 'workspace' | 'developer';

interface SettingsCategory {
  key: SettingsCategoryKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  sections: AdminSectionKey[];
}

const SETTINGS_CATEGORIES: SettingsCategory[] = [
  { key: 'ai-routing', label: 'AI Providers & Models', icon: Cpu, description: 'Provider credentials, allowed models, default routing.', sections: ['ai-providers', 'models'] },
  { key: 'workspace', label: 'Workspace & Appearance', icon: Building2, description: 'Active workspace identity, theme, typography, and density.', sections: ['organization', 'appearance'] },
  { key: 'developer', label: 'Developer & Runtime', icon: Terminal, description: 'Desktop runtime status, RBAC role preview, and neiman-setup.', sections: ['developer'] },
];

const categoryForSection = (key: AdminSectionKey): SettingsCategoryKey =>
  SETTINGS_CATEGORIES.find((c) => c.sections.includes(key))?.key ?? 'workspace';

export default function AdminSettingsPage() {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const { user } = useAccountContext();
  const activeCompany = useOrganizationContext();
  const previewMode = isDevelopmentAuthBypassEnabled();

  // Current active administration section
  const [activeSection, setActiveSection] = useState<AdminSectionKey>('ai-providers');
  const [activeCategory, setActiveCategory] = useState<SettingsCategoryKey>('ai-routing');

  const selectCategory = (key: SettingsCategoryKey) => {
    const category = SETTINGS_CATEGORIES.find((c) => c.key === key);
    if (!category) return;
    setActiveCategory(key);
    setActiveSection(category.sections[0]);
  };

  const selectSection = (key: AdminSectionKey) => {
    setActiveSection(key);
    setActiveCategory(categoryForSection(key));
  };

  // Simulated RBAC role selector for testing
  const [simulatedRole, setSimulatedRole] = useState<RBACRole>('SUPERADMIN');

  // Container-responsive layout detection for docked / narrow drawer vs full page
  const containerRef = useRef<HTMLDivElement>(null);
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      setIsCompact(el.clientWidth > 0 && el.clientWidth < 760);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Setup reset state
  const [isResettingSetup, setIsResettingSetup] = useState(false);
  const [setupResetConfirmPhrase, setSetupResetConfirmPhrase] = useState('');
  const [setupResetFeedback, setSetupResetFeedback] = useState<string | null>(null);

  const handleTriggerNeimanSetup = async () => {
    if (setupResetConfirmPhrase.trim() !== 'RESET NEIMAN OPERATIONAL DATA') {
      setSetupResetFeedback('Type RESET NEIMAN OPERATIONAL DATA to confirm the system reset.');
      return;
    }
    setIsResettingSetup(true);
    setSetupResetFeedback('Resetting operational state via neiman-setup protocol...');
    try {
      await systemConfigApi.resetSetup(setupResetConfirmPhrase.trim());
      if (typeof window !== 'undefined') {
        localStorage.removeItem(NEIMAN_CONFIG.STORAGE_KEYS.SETUP_VERSION);
      }
      setSetupResetFeedback('Reset complete! Launching setup wizard...');
      setTimeout(() => {
        window.location.href = '/dashboard?setup=true';
      }, 700);
    } catch (err: unknown) {
      const errorObj = err && typeof err === 'object' ? (err as Record<string, unknown>) : null;
      setSetupResetFeedback(
        `Error triggering setup reset: ${String(errorObj?.message || errorObj?.detail || err)}`
      );
      setIsResettingSetup(false);
    }
  };

  const { theme: currentTheme, setTheme: setAppTheme, resolvedTheme } = useTheme();
  const [defaultTheme, setDefaultTheme] = useState(currentTheme);
  const [density, setDensity] = useState('comfortable');

  useEffect(() => {
    setDefaultTheme(currentTheme);
  }, [currentTheme]);

  // Provider key state — loaded from /api/v1/system/provider-keys
  // Provider key state — loaded from /api/v1/system/provider-keys
  interface ProviderKeyStatus {
    openai_configured: boolean;
    anthropic_configured: boolean;
    gemini_configured: boolean;
    groq_configured?: boolean;
    openrouter_configured?: boolean;
    mistral_configured?: boolean;
    deepseek_configured?: boolean;
    cerebras_configured?: boolean;
    together_ai_configured?: boolean;
    cohere_configured?: boolean;
    xai_configured?: boolean;
    kilo_configured?: boolean;
    meta_configured?: boolean;
    ollama_configured?: boolean;
    ollama_host: string;
    openai_fingerprint: string | null;
    anthropic_fingerprint: string | null;
    gemini_fingerprint: string | null;
    groq_fingerprint?: string | null;
    openrouter_fingerprint?: string | null;
    mistral_fingerprint?: string | null;
    deepseek_fingerprint?: string | null;
    cerebras_fingerprint?: string | null;
    together_ai_fingerprint?: string | null;
    cohere_fingerprint?: string | null;
    xai_fingerprint?: string | null;
    kilo_fingerprint?: string | null;
    meta_fingerprint?: string | null;
    ollama_fingerprint?: string | null;
  }
  const [providerStatus, setProviderStatus] = useState<ProviderKeyStatus | null>(null);
  const [providerLoading, setProviderLoading] = useState(true);
  const [providerSaving, setProviderSaving] = useState(false);
  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [groqKey, setGroqKey] = useState('');
  const [openrouterKey, setOpenrouterKey] = useState('');
  const [mistralKey, setMistralKey] = useState('');
  const [deepseekKey, setDeepseekKey] = useState('');
  const [cerebrasKey, setCerebrasKey] = useState('');
  const [togetherAiKey, setTogetherAiKey] = useState('');
  const [cohereKey, setCohereKey] = useState('');
  const [xaiKey, setXaiKey] = useState('');
  const [kiloKey, setKiloKey] = useState('');
  const [metaKey, setMetaKey] = useState('');
  const [ollamaKey, setOllamaKey] = useState('');
  const [showOpenai, setShowOpenai] = useState(false);
  const [showAnthropic, setShowAnthropic] = useState(false);
  const [showGemini, setShowGemini] = useState(false);
  const [showGroq, setShowGroq] = useState(false);
  const [showOpenrouter, setShowOpenrouter] = useState(false);
  const [showMistral, setShowMistral] = useState(false);
  const [showDeepseek, setShowDeepseek] = useState(false);
  const [showCerebras, setShowCerebras] = useState(false);
  const [showTogetherAi, setShowTogetherAi] = useState(false);
  const [showCohere, setShowCohere] = useState(false);
  const [showXai, setShowXai] = useState(false);
  const [showKilo, setShowKilo] = useState(false);
  const [showMeta, setShowMeta] = useState(false);
  const [showOllama, setShowOllama] = useState(false);
  const [providerSaveResult, setProviderSaveResult] = useState<string | null>(null);

  const loadProviderStatus = useCallback(async () => {
    try {
      const data = await api.get<ProviderKeyStatus>('/api/v1/system/provider-keys');
      setProviderStatus(data);
    } catch {
      // silently fail — API may not be running
    } finally {
      setProviderLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProviderStatus();
  }, [loadProviderStatus]);

  const handleSaveProviderKeys = async () => {
    setProviderSaving(true);
    setProviderSaveResult(null);
    try {
      const body: Record<string, string> = {};
      if (openaiKey) body.openai_api_key = openaiKey;
      if (anthropicKey) body.anthropic_api_key = anthropicKey;
      if (geminiKey) body.gemini_api_key = geminiKey;
      if (groqKey) body.groq_api_key = groqKey;
      if (openrouterKey) body.openrouter_api_key = openrouterKey;
      if (mistralKey) body.mistral_api_key = mistralKey;
      if (deepseekKey) body.deepseek_api_key = deepseekKey;
      if (cerebrasKey) body.cerebras_api_key = cerebrasKey;
      if (togetherAiKey) body.together_ai_api_key = togetherAiKey;
      if (cohereKey) body.cohere_api_key = cohereKey;
      if (xaiKey) body.xai_api_key = xaiKey;
      if (kiloKey) body.kilo_api_key = kiloKey;
      if (metaKey) body.meta_api_key = metaKey;
      if (ollamaKey) body.ollama_api_key = ollamaKey;

      const data = await api.patch<ProviderKeyStatus>('/api/v1/system/provider-keys', body);
      setProviderStatus(data);
      setOpenaiKey('');
      setAnthropicKey('');
      setGeminiKey('');
      setGroqKey('');
      setOpenrouterKey('');
      setMistralKey('');
      setDeepseekKey('');
      setCerebrasKey('');
      setTogetherAiKey('');
      setCohereKey('');
      setXaiKey('');
      setKiloKey('');
      setMetaKey('');
      setOllamaKey('');
      setProviderSaveResult('✓ Provider keys saved and applied.');
      setTimeout(() => setProviderSaveResult(null), 4000);
    } catch {
      setProviderSaveResult('⚠ API unreachable.');
    } finally {
      setProviderSaving(false);
    }
  };

  // Dynamic Models State (Zero Hardcoded Models)
  const [dynamicModels, setDynamicModels] = useState<IntelligenceModel[]>([]);
  const [dynamicProviders, setDynamicProviders] = useState<ModelProvider[]>([]);
  const [workforceAgents, setWorkforceAgents] = useState<WorkforceAgent[]>([]);
  const [updatingAgentId, setUpdatingAgentId] = useState<string | null>(null);
  const [agentModelFeedback, setAgentModelFeedback] = useState<string | null>(null);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [modelsSyncing, setModelsSyncing] = useState(false);
  const [modelsSyncResult, setModelsSyncResult] = useState<string | null>(null);
  const [modelFilterQuery, setModelFilterQuery] = useState('');
  const [showAddModelModal, setShowAddModelModal] = useState(false);
  const [newModelIdentifier, setNewModelIdentifier] = useState('');
  const [newModelDisplayName, setNewModelDisplayName] = useState('');
  const [newModelProviderId, setNewModelProviderId] = useState('');
  const [newModelContextCapacity, setNewModelContextCapacity] = useState(131072);
  const [newModelCapabilities, setNewModelCapabilities] = useState('text,code,tools');
  const [newModelInputCost, setNewModelInputCost] = useState(0.5);
  const [newModelOutputCost, setNewModelOutputCost] = useState(1.5);
  const [addingModel, setAddingModel] = useState(false);

  const loadDynamicModels = useCallback(async () => {
    if (!activeCompany?.id) return;
    setModelsLoading(true);
    setModelsError(null);
    try {
      const [modelsData, providersData, policyData, agentsData] = await Promise.all([
        intelligenceApi.listModels(activeCompany.id),
        intelligenceApi.listProviders(activeCompany.id).catch(() => [] as ModelProvider[]),
        intelligenceApi.getPolicy(activeCompany.id).catch(() => null),
        agentsApi.list(activeCompany.id).catch(() => [] as WorkforceAgent[]),
      ]);
      setDynamicModels(Array.isArray(modelsData) ? modelsData : []);
      setDynamicProviders(Array.isArray(providersData) ? providersData : []);
      const sortedAgents = (Array.isArray(agentsData) ? agentsData : []).slice().sort((a, b) => {
        const isActive = (st: string) => ['WORKING', 'RUNNING', 'ACTIVE', 'BUSY'].includes(st.toUpperCase());
        const pa = isActive(a.status) ? 0 : 1;
        const pb = isActive(b.status) ? 0 : 1;
        return pa !== pb ? pa - pb : a.name.localeCompare(b.name);
      });
      setWorkforceAgents(sortedAgents);
      if (policyData) {
        setRoutingStrategy(policyData.strategy);
        setFallbackChain(Array.isArray(policyData.fallback_chain) ? policyData.fallback_chain : []);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to query registered models';
      setModelsError(msg);
    } finally {
      setModelsLoading(false);
    }
  }, [activeCompany?.id]);

  const [routingStrategy, setRoutingStrategy] = useState<ModelRoutingPolicy['strategy']>('BALANCED');
  const [fallbackChain, setFallbackChain] = useState<string[]>([]);
  const [policySaving, setPolicySaving] = useState(false);
  const [policyFeedback, setPolicyFeedback] = useState<string | null>(null);
  const [modelToAddToChain, setModelToAddToChain] = useState('');

  const moveChainItem = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= fallbackChain.length) return;
    setFallbackChain((prev) => {
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  };

  const removeChainItem = (modelId: string) => {
    setFallbackChain((prev) => prev.filter((id) => id !== modelId));
  };

  const addChainItem = (modelId: string) => {
    if (!modelId || fallbackChain.includes(modelId)) return;
    setFallbackChain((prev) => [...prev, modelId]);
    setModelToAddToChain('');
  };

  const handleAgentModelChange = async (agent: WorkforceAgent, nextModel: string) => {
    if (!activeCompany?.id) return;
    setUpdatingAgentId(agent.id);
    setAgentModelFeedback(null);
    try {
      const nextIntel = { ...(agent.intelligence_config || {}) };
      if (nextModel) nextIntel.model = nextModel;
      else delete nextIntel.model;
      const updated = await agentsApi.update(activeCompany.id, agent.id, {
        intelligence_config: nextIntel,
      });
      setWorkforceAgents((prev) => prev.map((a) => (a.id === agent.id ? updated : a)));
      setAgentModelFeedback(`Updated ${agent.name} → ${nextModel || 'Auto (Fallback Chain)'}`);
    } catch (err: unknown) {
      setAgentModelFeedback(
        `Failed to update ${agent.name}: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    } finally {
      setUpdatingAgentId(null);
    }
  };

  const handleSaveRoutingPolicy = async () => {
    if (!activeCompany?.id) return;
    setPolicySaving(true);
    setPolicyFeedback(null);
    try {
      const updated = await intelligenceApi.updatePolicy(activeCompany.id, {
        strategy: routingStrategy,
        fallback_chain: fallbackChain,
      });
      setRoutingStrategy(updated.strategy);
      setFallbackChain(Array.isArray(updated.fallback_chain) ? updated.fallback_chain : []);
      setPolicyFeedback('Model usage order and routing strategy saved.');
    } catch (err: unknown) {
      setPolicyFeedback(
        `Failed to save routing order: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    } finally {
      setPolicySaving(false);
    }
  };

  useEffect(() => {
    if (activeSection === 'models') {
      loadDynamicModels();
    }
  }, [activeSection, loadDynamicModels]);

  const handleSyncModels = async () => {
    if (!activeCompany?.id) return;
    setModelsSyncing(true);
    setModelsSyncResult(null);
    try {
      const res = await intelligenceApi.syncProviderModels(activeCompany.id);
      setModelsSyncResult(
        `Dynamic sync complete: ${res.total_models_active} active models across ${res.total_providers_checked} configured providers (${res.total_models_added} added, ${res.total_models_soft_deactivated} deactivated).`
      );
      await loadDynamicModels();
    } catch (err: unknown) {
      setModelsSyncResult(
        `Sync failed: ${err instanceof Error ? err.message : 'Could not query provider /v1/models endpoints'}`
      );
    } finally {
      setModelsSyncing(false);
    }
  };

  const handleRegisterCustomModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompany?.id || !newModelIdentifier.trim() || !newModelDisplayName.trim()) return;
    setAddingModel(true);
    try {
      const provId = newModelProviderId || dynamicProviders[0]?.id;
      if (!provId) {
        throw new Error('Configure at least one provider before registering models');
      }
      await api.post(`/api/v1/companies/${activeCompany.id}/intelligence/models`, {
        provider_id: provId,
        model_identifier: newModelIdentifier.trim(),
        display_name: newModelDisplayName.trim(),
        context_capacity: Number(newModelContextCapacity) || 131072,
        capabilities: newModelCapabilities.split(',').map((s) => s.trim()).filter(Boolean),
        input_cost_per_million: Number(newModelInputCost) || 0,
        output_cost_per_million: Number(newModelOutputCost) || 0,
        avg_latency_ms: 180,
        privacy_classification: 'COMMERCIAL_CLOUD',
        is_active: true,
      });
      setShowAddModelModal(false);
      setNewModelIdentifier('');
      setNewModelDisplayName('');
      await loadDynamicModels();
    } catch (err: unknown) {
      alert(`Failed to register model: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setAddingModel(false);
    }
  };

  const providerMap = useMemo(() => {
    return new Map(dynamicProviders.map((p) => [p.id, p]));
  }, [dynamicProviders]);

  const filteredDynamicModels = useMemo(() => {
    if (!modelFilterQuery.trim()) return dynamicModels;
    const q = modelFilterQuery.toLowerCase();
    return dynamicModels.filter((m) =>
      m.display_name.toLowerCase().includes(q) ||
      m.model_identifier.toLowerCase().includes(q) ||
      (m.capabilities && m.capabilities.some((c) => c.toLowerCase().includes(q))) ||
      (providerMap.get(m.provider_id)?.display_name.toLowerCase().includes(q))
    );
  }, [dynamicModels, modelFilterQuery, providerMap]);

  // API Tokens state
  const [apiTokens, setApiTokens] = useState([
    { id: 'tok-prod-cli', name: 'CLI Operator Token', created: '2026-09-15', lastUsed: '12 mins ago', maskedSecret: 'nm_live_••••••••••••••••••••••••••••94b2', scope: 'admin:full' },
    { id: 'tok-ci-worker', name: 'CI/CD Pipeline Service Account', created: '2026-09-20', lastUsed: '2 hours ago', maskedSecret: 'nm_live_••••••••••••••••••••••••••••10a8', scope: 'workforce:deploy' },
  ]);

  const [newTokenName, setNewTokenName] = useState('');
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  // Notification states
  const [notifyOutages, setNotifyOutages] = useState(true);
  const [notifyApprovals, setNotifyApprovals] = useState(true);
  const [notifyAudit, setNotifyAudit] = useState(false);
  const [notifyEmailDigest, setNotifyEmailDigest] = useState('daily');

  // Security states
  const [mfaEnforced, setMfaEnforced] = useState(true);
  const [sessionTimeoutMin, setSessionTimeoutMin] = useState(60);
  const [ipWhitelist, setIpWhitelist] = useState('10.0.0.0/8\n192.168.1.0/24');

  const hasAccess = (requiredRole: RBACRole) => {
    return hasRoleAccess(simulatedRole, requiredRole);
  };

  // Direct unified section list without nested tier tab confusion
  const [searchQuery, setSearchQuery] = useState('');
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) {
      const category = SETTINGS_CATEGORIES.find((c) => c.key === activeCategory) ?? SETTINGS_CATEGORIES[0];
      return category.sections
        .map((key) => SECTIONS.find((s) => s.key === key))
        .filter((s): s is SectionMeta => Boolean(s));
    }
    const q = searchQuery.toLowerCase();
    return SECTIONS.filter(
      (s) => s.label.toLowerCase().includes(q) || s.key.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
    );
  }, [searchQuery, activeCategory]);

  const currentSectionMeta = SECTIONS.find((s) => s.key === activeSection) || SECTIONS[0];

  return (
    <div ref={containerRef} className="w-full space-y-4 animate-fade-in pb-12">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Sliders className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-semibold text-foreground tracking-tight truncate">
              Settings &amp; Models
            </h1>
            {!isCompact && (
              <p className="text-xs text-muted-foreground truncate">
                AI provider credentials, model routing, workspace identity, appearance, and developer runtime.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 5-TAB CONTAINER-RESPONSIVE SETTINGS HUB */}
      <div className={isCompact ? 'space-y-3' : 'grid grid-cols-[260px_minmax(0,1fr)] gap-5 items-start'}>
        {/* Category Navigation: Horizontal pills when docked/compact, vertical rail when wide */}
        <div className={isCompact ? 'space-y-2' : 'space-y-3 sticky top-4'}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              aria-label="Filter settings"
              placeholder="Filter settings…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-border bg-background pl-9 pr-12 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>

          <div
            role="tablist"
            aria-label="Settings categories"
            aria-orientation={isCompact ? 'horizontal' : 'vertical'}
            className={
              isCompact
                ? 'flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none'
                : 'flex flex-col gap-0.5 rounded-xl border border-border bg-card p-1.5'
            }
            onKeyDown={(e) => {
              const prevKey = isCompact ? 'ArrowLeft' : 'ArrowUp';
              const nextKey = isCompact ? 'ArrowRight' : 'ArrowDown';
              if (e.key !== prevKey && e.key !== nextKey) return;
              e.preventDefault();
              const idx = SETTINGS_CATEGORIES.findIndex((c) => c.key === activeCategory);
              const delta = e.key === nextKey ? 1 : -1;
              const next = SETTINGS_CATEGORIES[(idx + delta + SETTINGS_CATEGORIES.length) % SETTINGS_CATEGORIES.length];
              selectCategory(next.key);
              const el = document.getElementById(`settings-tab-${next.key}`);
              el?.focus();
            }}
          >
            {SETTINGS_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isSelected = activeCategory === cat.key && !searchQuery.trim();
              if (isCompact) {
                return (
                  <button
                    key={cat.key}
                    id={`settings-tab-${cat.key}`}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    aria-controls="settings-category-panel"
                    tabIndex={activeCategory === cat.key ? 0 : -1}
                    onClick={() => {
                      setSearchQuery('');
                      selectCategory(cat.key);
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                      isSelected
                        ? 'border-primary/40 bg-primary/10 text-foreground font-semibold'
                        : 'border-border bg-card text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                    }`}
                  >
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span>{cat.label.split(' & ')[0]}</span>
                  </button>
                );
              }
              return (
                <button
                  key={cat.key}
                  id={`settings-tab-${cat.key}`}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  aria-controls="settings-category-panel"
                  tabIndex={activeCategory === cat.key ? 0 : -1}
                  onClick={() => {
                    setSearchQuery('');
                    selectCategory(cat.key);
                  }}
                  className={`group flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                    isSelected ? 'bg-primary/10 text-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                  }`}
                >
                  <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${isSelected ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`} />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium leading-tight">{cat.label}</span>
                    <span className="block text-[11px] text-muted-foreground leading-snug mt-0.5">{cat.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Active Category Panel */}
        <div id="settings-category-panel" role="tabpanel" aria-labelledby={`settings-tab-${activeCategory}`} className="space-y-4 min-w-0">
          {/* Sub-section pills scoped to active category (or search results across all) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            {filteredSections.length === 0 ? (
              <span className="text-xs text-muted-foreground px-1">No settings match “{searchQuery}”.</span>
            ) : (
              filteredSections.map((sec) => {
                const Icon = sec.icon;
                const isSelected = activeSection === sec.key;
                const permitted = hasAccess(sec.requiredRole);
                return (
                  <button
                    key={sec.key}
                    type="button"
                    onClick={() => selectSection(sec.key)}
                    aria-pressed={isSelected}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs whitespace-nowrap transition-colors shrink-0 border ${
                      isSelected
                        ? 'bg-foreground text-background border-foreground font-medium'
                        : 'bg-background text-muted-foreground border-border hover:text-foreground hover:bg-muted/60'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{sec.label}</span>
                    {!permitted && <Lock className="h-3 w-3 opacity-60" aria-label="Restricted" />}
                  </button>
                );
              })
            )}
          </div>

        {/* RBAC PERMISSION CHECK */}
        {!hasAccess(currentSectionMeta.requiredRole) ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-8 text-center space-y-3">
            <Lock className="h-10 w-10 text-rose-500 mx-auto" />
            <h3 className="text-base font-semibold text-foreground">Access Restricted by RBAC</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              You do not have permission to view or modify <strong className="text-foreground">{currentSectionMeta.label}</strong>.
              This section requires <span className="font-mono rounded border border-border px-1">{currentSectionMeta.requiredRole}</span> privileges.
              Switch the preview role above to inspect.
            </p>
          </div>
        ) : (
            <div className="rounded-xl border border-border bg-card p-5 space-y-5">
              {/* Section Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <currentSectionMeta.icon className="h-4 w-4 text-primary" />
                    <h2 className="text-base font-semibold text-foreground">{currentSectionMeta.label}</h2>
                    {currentSectionMeta.dangerous && (
                      <span className="rounded-md bg-destructive/10 text-destructive px-1.5 py-0.5 text-[10px] font-medium">
                        High privilege
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {currentSectionMeta.description}
                  </p>
                </div>

                <span className="font-mono text-[11px] text-muted-foreground">
                  role ≥ {currentSectionMeta.requiredRole}
                </span>
              </div>

              {/* DANGEROUS SETTINGS WARNING (If Applicable) */}
              {currentSectionMeta.dangerous && (
                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                  <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <strong className="font-bold">Dangerous Configuration Zone:</strong>
                    <p className="text-rose-200/80 text-[11px]">
                      Modifications in this category immediately alter system security, identity scopes, or engine infrastructure.
                      All changes are recorded immutably in the organizational Audit Log.
                    </p>
                  </div>
                </div>
              )}

              {/* ────────────────── SECTION 1: WORKSPACE ────────────────── */}
              {activeSection === 'organization' && (
                <div className="space-y-4 text-xs font-mono">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-secondary/30 border border-border">
                      <span className="text-[10px] text-muted-foreground block">WORKSPACE NAME</span>
                      <span className="font-bold text-foreground">{activeCompany?.name || 'No company selected'}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-secondary/30 border border-border">
                      <span className="text-[10px] text-muted-foreground block">COMPANY ID</span>
                      <span className="font-bold text-foreground break-all">{activeCompany?.id || 'No company selected'}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-secondary/30 border border-border">
                      <span className="text-[10px] text-muted-foreground block">INDUSTRY</span>
                      <span className="font-bold text-foreground">{activeCompany?.industry || 'Software Engineering'}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-secondary/30 border border-border">
                      <span className="text-[10px] text-muted-foreground block">STATUS</span>
                      <span className="font-bold text-foreground">{activeCompany?.status || 'Unknown'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* ────────────────── SECTION 2: AI PROVIDERS ────────────────── */}
              {activeSection === 'ai-providers' && (
                <div className="space-y-5 text-xs font-mono">
                  <div className="p-3.5 rounded-xl bg-secondary/20 border border-border text-muted-foreground">
                    <strong className="text-foreground">Credential Security:</strong> Credentials are saved in the local API environment and encrypted provider configuration store. The API returns configuration status only; inference requests send credentials only to the selected provider.
                  </div>

                  {providerLoading ? (
                    <div className="flex items-center gap-2 text-muted-foreground py-4">
                      <span className="animate-spin">⟳</span> Loading provider status…
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* OpenAI */}
                      <div className="p-4 rounded-xl bg-secondary/10 border border-border space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Cpu className="h-4 w-4 text-emerald-400" />
                            <span className="font-bold text-foreground text-sm">OpenAI</span>
                            <span className={`badge text-[10px] ${providerStatus?.openai_configured ? 'badge-success' : 'badge-secondary'}`}>
                              {providerStatus?.openai_configured ? 'Configured' : 'Not configured'}
                            </span>
                          </div>
                          <code className="text-primary text-[11px]">{providerStatus?.openai_fingerprint || 'Not configured'}</code>
                        </div>
                        <div className="flex gap-2 items-center">
                          <div className="relative flex-1">
                            <input
                              type={showOpenai ? 'text' : 'password'}
                              value={openaiKey}
                              onChange={(e) => setOpenaiKey(e.target.value)}
                              placeholder="sk-..."
                              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 pr-8"
                            />
                            <button type="button" onClick={() => setShowOpenai(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                              {showOpenai ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Anthropic */}
                      <div className="p-4 rounded-xl bg-secondary/10 border border-border space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Zap className="h-4 w-4 text-violet-400" />
                            <span className="font-bold text-foreground text-sm">Anthropic (Claude)</span>
                            <span className={`badge text-[10px] ${providerStatus?.anthropic_configured ? 'badge-success' : 'badge-outline text-amber-400 border-amber-500/30'}`}>
                              {providerStatus?.anthropic_configured ? 'CONFIGURED' : 'NOT SET'}
                            </span>
                          </div>
                          {providerStatus?.anthropic_configured && (
                            <code className="text-primary text-[11px]">{providerStatus.anthropic_fingerprint}</code>
                          )}
                        </div>
                        <div className="flex gap-2 items-center">
                          <div className="relative flex-1">
                            <input
                              type={showAnthropic ? 'text' : 'password'}
                              value={anthropicKey}
                              onChange={(e) => setAnthropicKey(e.target.value)}
                              placeholder={providerStatus?.anthropic_configured ? 'Enter new key to rotate…' : 'sk-ant-...'}
                              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 pr-8"
                            />
                            <button type="button" onClick={() => setShowAnthropic(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                              {showAnthropic ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Gemini */}
                      <div className="p-4 rounded-xl bg-secondary/10 border border-border space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-cyan-400" />
                            <span className="font-bold text-foreground text-sm">Google Gemini</span>
                            <span className={`badge text-[10px] ${providerStatus?.gemini_configured ? 'badge-success' : 'badge-secondary'}`}>
                              {providerStatus?.gemini_configured ? 'Configured' : 'Not configured'}
                            </span>
                          </div>
                          <code className="text-primary text-[11px]">{providerStatus?.gemini_fingerprint || 'Not configured'}</code>
                        </div>
                        <div className="flex gap-2 items-center">
                          <div className="relative flex-1">
                            <input
                              type={showGemini ? 'text' : 'password'}
                              value={geminiKey}
                              onChange={(e) => setGeminiKey(e.target.value)}
                              placeholder="AIza..."
                              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 pr-8"
                            />
                            <button type="button" onClick={() => setShowGemini(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                              {showGemini ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Groq LPU Accelerator */}
                      <div className="p-4 rounded-xl bg-secondary/10 border border-border space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Zap className="h-4 w-4 text-emerald-400" />
                            <span className="font-bold text-foreground text-sm">Groq LPU Accelerator</span>
                            <span className={`badge text-[10px] ${providerStatus?.groq_configured ? 'badge-success' : 'badge-secondary'}`}>
                              {providerStatus?.groq_configured ? 'Configured' : 'Not configured'}
                            </span>
                          </div>
                          <code className="text-primary text-[11px]">{providerStatus?.groq_fingerprint || 'Not configured'}</code>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Ultra-low latency inference on LPUs (<span className="font-mono text-emerald-300">qwen/qwen3.8-27b</span>, <span className="font-mono text-emerald-300">openai/gpt-oss-20b</span>, <span className="font-mono text-emerald-300">llama-3.3-70b</span>).
                        </p>
                        <div className="flex gap-2 items-center">
                          <div className="relative flex-1">
                            <input
                              type={showGroq ? 'text' : 'password'}
                              value={groqKey}
                              onChange={(e) => setGroqKey(e.target.value)}
                              placeholder="gsk_..."
                              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 pr-8"
                            />
                            <button type="button" onClick={() => setShowGroq(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                              {showGroq ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* OpenRouter Gateway */}
                      <div className="p-4 rounded-xl bg-secondary/10 border border-border space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Cpu className="h-4 w-4 text-blue-400" />
                            <span className="font-bold text-foreground text-sm">OpenRouter Gateway</span>
                            <span className={`badge text-[10px] ${providerStatus?.openrouter_configured ? 'badge-success' : 'badge-outline text-amber-400 border-amber-500/30'}`}>
                              {providerStatus?.openrouter_configured ? 'CONFIGURED' : 'NOT SET'}
                            </span>
                          </div>
                          {providerStatus?.openrouter_configured && (
                            <code className="text-primary text-[11px]">{providerStatus.openrouter_fingerprint}</code>
                          )}
                        </div>
                        <div className="flex gap-2 items-center">
                          <div className="relative flex-1">
                            <input
                              type={showOpenrouter ? 'text' : 'password'}
                              value={openrouterKey}
                              onChange={(e) => setOpenrouterKey(e.target.value)}
                              placeholder="sk-or-v1-..."
                              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 pr-8"
                            />
                            <button type="button" onClick={() => setShowOpenrouter(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                              {showOpenrouter ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* DeepSeek Cloud */}
                      <div className="p-4 rounded-xl bg-secondary/10 border border-border space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Database className="h-4 w-4 text-indigo-400" />
                            <span className="font-bold text-foreground text-sm">DeepSeek Cloud</span>
                            <span className={`badge text-[10px] ${providerStatus?.deepseek_configured ? 'badge-success' : 'badge-secondary'}`}>
                              {providerStatus?.deepseek_configured ? 'Configured' : 'Not configured'}
                            </span>
                          </div>
                          <code className="text-primary text-[11px]">{providerStatus?.deepseek_fingerprint || 'Not configured'}</code>
                        </div>
                        <div className="flex gap-2 items-center">
                          <div className="relative flex-1">
                            <input
                              type={showDeepseek ? 'text' : 'password'}
                              value={deepseekKey}
                              onChange={(e) => setDeepseekKey(e.target.value)}
                              placeholder="sk-..."
                              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 pr-8"
                            />
                            <button type="button" onClick={() => setShowDeepseek(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                              {showDeepseek ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Mistral AI */}
                      <div className="p-4 rounded-xl bg-secondary/10 border border-border space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Layers className="h-4 w-4 text-rose-400" />
                            <span className="font-bold text-foreground text-sm">Mistral AI</span>
                            <span className={`badge text-[10px] ${providerStatus?.mistral_configured ? 'badge-success' : 'badge-outline text-amber-400 border-amber-500/30'}`}>
                              {providerStatus?.mistral_configured ? 'CONFIGURED' : 'NOT SET'}
                            </span>
                          </div>
                          {providerStatus?.mistral_configured && (
                            <code className="text-primary text-[11px]">{providerStatus.mistral_fingerprint}</code>
                          )}
                        </div>
                        <div className="flex gap-2 items-center">
                          <div className="relative flex-1">
                            <input
                              type={showMistral ? 'text' : 'password'}
                              value={mistralKey}
                              onChange={(e) => setMistralKey(e.target.value)}
                              placeholder="mistral key..."
                              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 pr-8"
                            />
                            <button type="button" onClick={() => setShowMistral(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                              {showMistral ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Cerebras */}
                      <div className="p-4 rounded-xl bg-secondary/10 border border-border space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Cpu className="h-4 w-4 text-teal-400" />
                            <span className="font-bold text-foreground text-sm">Cerebras Wafer-Scale Inference</span>
                            <span className={`badge text-[10px] ${providerStatus?.cerebras_configured ? 'badge-success' : 'badge-outline text-amber-400 border-amber-500/30'}`}>
                              {providerStatus?.cerebras_configured ? 'CONFIGURED' : 'NOT SET'}
                            </span>
                          </div>
                          {providerStatus?.cerebras_configured && (
                            <code className="text-primary text-[11px]">{providerStatus.cerebras_fingerprint}</code>
                          )}
                        </div>
                        <div className="flex gap-2 items-center">
                          <div className="relative flex-1">
                            <input
                              type={showCerebras ? 'text' : 'password'}
                              value={cerebrasKey}
                              onChange={(e) => setCerebrasKey(e.target.value)}
                              placeholder="csk-..."
                              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 pr-8"
                            />
                            <button type="button" onClick={() => setShowCerebras(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                              {showCerebras ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Kilo Code Gateway */}
                      <div className="p-4 rounded-xl bg-secondary/10 border border-border space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Code className="h-4 w-4 text-purple-400" />
                            <span className="font-bold text-foreground text-sm">Kilo Code Gateway</span>
                            <span className={`badge text-[10px] ${providerStatus?.kilo_configured ? 'badge-success' : 'badge-secondary'}`}>
                              {providerStatus?.kilo_configured ? 'Configured' : 'Not configured'}
                            </span>
                          </div>
                          <code className="text-primary text-[11px]">{providerStatus?.kilo_fingerprint || 'Not configured'}</code>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Developer universal AI gateway defaulted to <span className="font-mono text-purple-300">kilo-auto/free</span> zero-cost intelligent routing.
                        </p>
                        <div className="flex gap-2 items-center">
                          <div className="relative flex-1">
                            <input
                              type={showKilo ? 'text' : 'password'}
                              value={kiloKey}
                              onChange={(e) => setKiloKey(e.target.value)}
                              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 pr-8"
                            />
                            <button type="button" onClick={() => setShowKilo(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                              {showKilo ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Meta Muse Generative */}
                      <div className="p-4 rounded-xl bg-secondary/10 border border-border space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-cyan-400" />
                            <span className="font-bold text-foreground text-sm">Meta Muse</span>
                            <span className={`badge text-[10px] ${providerStatus?.meta_configured ? 'badge-success' : 'badge-secondary'}`}>
                              {providerStatus?.meta_configured ? 'Configured' : 'Not configured'}
                            </span>
                          </div>
                          <code className="text-primary text-[11px]">{providerStatus?.meta_fingerprint || 'Not configured'}</code>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Next-generation intelligence powered by <span className="font-mono text-cyan-300">muse-spark-1.3</span> and <span className="font-mono text-cyan-300">muse-wonder-1.0</span>.
                        </p>
                        <div className="flex gap-2 items-center">
                          <div className="relative flex-1">
                            <input
                              type={showMeta ? 'text' : 'password'}
                              value={metaKey}
                              onChange={(e) => setMetaKey(e.target.value)}
                              placeholder="LLM_..."
                              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 pr-8"
                            />
                            <button type="button" onClick={() => setShowMeta(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                              {showMeta ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Ollama Cloud */}
                      <div className="p-4 rounded-xl bg-secondary/10 border border-border space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Cloud className="h-4 w-4 text-emerald-400" />
                            <span className="font-bold text-foreground text-sm">Ollama Cloud</span>
                            <span className={`badge text-[10px] ${providerStatus?.ollama_configured ? 'badge-success' : 'badge-secondary'}`}>
                              {providerStatus?.ollama_configured ? 'Configured' : 'Not configured'}
                            </span>
                          </div>
                          <code className="text-primary text-[11px]">{providerStatus?.ollama_fingerprint || 'Not configured'}</code>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Hosted frontier & open weights (<span className="font-mono text-emerald-300">gemma4:31b-cloud</span> free plan, <span className="font-mono text-emerald-300">gpt-oss:20b</span>, <span className="font-mono text-emerald-300">mistral-large-3</span>).
                        </p>
                        <div className="flex gap-2 items-center">
                          <div className="relative flex-1">
                            <input
                              type={showOllama ? 'text' : 'password'}
                              value={ollamaKey}
                              onChange={(e) => setOllamaKey(e.target.value)}
                              placeholder="ollama api key..."
                              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 pr-8"
                            />
                            <button type="button" onClick={() => setShowOllama(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                              {showOllama ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Local Air-Gapped Mode */}
                      <div className="p-4 rounded-xl bg-secondary/10 border border-border space-y-3">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-emerald-400" />
                          <span className="font-bold text-foreground text-sm">Local Air-Gapped Engine</span>
                          <span className="badge badge-success text-[10px]">ZERO CLOUD EGRESS</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          On-premise zero-retention local runtime. Fully isolated from external cloud providers with zero Ollama dependency.
                        </p>
                      </div>

                      {/* Save Button */}
                      <div className="flex items-center justify-between pt-2">
                        {providerSaveResult && (
                          <span className={`text-xs font-mono ${providerSaveResult.startsWith('✓') ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {providerSaveResult}
                          </span>
                        )}
                        <button
                          id="save-provider-keys-btn"
                          type="button"
                          onClick={handleSaveProviderKeys}
                          disabled={providerSaving}
                          className="ml-auto btn btn-primary text-xs h-8 px-4 font-mono flex items-center gap-2 disabled:opacity-50"
                        >
                          {providerSaving ? <RotateCw className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                          {providerSaving ? 'Saving…' : 'Apply Provider Keys'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ────────────────── SECTION 7: MODELS (DYNAMIC DISCOVERY & WHITELIST) ────────────────── */}
              {activeSection === 'models' && (
                <div className="space-y-4 font-mono text-xs">
                  {/* Action & Filter Toolbar */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pb-2 border-b border-border/50">
                    <div className="relative flex-1 max-w-sm">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <input
                        type="text"
                        value={modelFilterQuery}
                        onChange={(e) => setModelFilterQuery(e.target.value)}
                        placeholder="Filter discovered models... (e.g. claude, gpt, llama)"
                        className="w-full rounded-md border border-border bg-background pl-8 pr-3 py-1.5 text-xs font-mono focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                      />
                      {modelFilterQuery && (
                        <button
                          type="button"
                          onClick={() => setModelFilterQuery('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-[10px]"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] text-muted-foreground px-2 py-1 rounded bg-secondary/30 border border-border/40">
                        {filteredDynamicModels.length} / {dynamicModels.length} Models
                      </span>
                      <button
                        type="button"
                        onClick={handleSyncModels}
                        disabled={modelsSyncing}
                        className="btn btn-outline text-xs h-7 px-2.5 gap-1.5 font-mono disabled:opacity-50"
                        title="Query /v1/models across all configured provider keys"
                      >
                        <RotateCw className={`h-3 w-3 ${modelsSyncing ? 'animate-spin' : ''}`} />
                        <span>{modelsSyncing ? 'Syncing...' : 'Sync Provider Models'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAddModelModal((v) => !v)}
                        className="btn btn-primary text-xs h-7 px-2.5 gap-1.5 font-mono"
                      >
                        <Plus className="h-3 w-3" />
                        <span>Register Model</span>
                      </button>
                    </div>
                  </div>

                  {/* Sync Feedback Banner */}
                  {modelsSyncResult && (
                    <div
                      className={`p-3 rounded-lg border text-xs flex items-center justify-between gap-2 ${
                        modelsSyncResult.startsWith('Dynamic sync complete')
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                          : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {modelsSyncResult.startsWith('Dynamic sync complete') ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                        )}
                        <span>{modelsSyncResult}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setModelsSyncResult(null)}
                        className="text-muted-foreground hover:text-foreground text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {/* Model Usage & Fallback Order */}
                  <div className="p-4 rounded-xl bg-secondary/20 border border-border space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2.5">
                      <div>
                        <h3 className="text-xs font-bold text-foreground">Model Usage &amp; Fallback Order</h3>
                        <p className="text-[11px] text-muted-foreground">
                          Models are tried top-to-bottom on rate-limits or provider errors.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <label className="flex items-center gap-1.5 text-[11px]">
                          <span className="text-muted-foreground">Strategy</span>
                          <select
                            aria-label="Routing strategy"
                            value={routingStrategy}
                            onChange={(e) => setRoutingStrategy(e.target.value as ModelRoutingPolicy['strategy'])}
                            className="rounded-md border border-border bg-background px-2 py-1 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
                          >
                            <option value="BALANCED">BALANCED</option>
                            <option value="HIGHEST_CAPABILITY">HIGHEST_CAPABILITY</option>
                            <option value="LOWEST_COST">LOWEST_COST</option>
                            <option value="LOWEST_LATENCY">LOWEST_LATENCY</option>
                            <option value="STRICT_PRIVACY">STRICT_PRIVACY</option>
                          </select>
                        </label>
                        <button
                          type="button"
                          onClick={handleSaveRoutingPolicy}
                          disabled={policySaving || !activeCompany?.id}
                          className="btn btn-primary text-xs h-7 px-2.5 gap-1 font-mono disabled:opacity-50"
                        >
                          <Save className="h-3 w-3" />
                          <span>{policySaving ? 'Saving…' : 'Save Order'}</span>
                        </button>
                      </div>
                    </div>

                    {policyFeedback && (
                      <div
                        role="status"
                        className={`p-2.5 rounded-lg border text-xs ${
                          policyFeedback.startsWith('Failed')
                            ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        }`}
                      >
                        {policyFeedback}
                      </div>
                    )}

                    {fallbackChain.length === 0 ? (
                      <div className="p-3 rounded-lg border border-dashed border-border text-[11px] text-muted-foreground">
                        No explicit fallback order configured. Add models below to enforce priority order.
                      </div>
                    ) : (
                      <ol className="space-y-1.5">
                        {fallbackChain.map((modelId, idx) => (
                          <li
                            key={modelId}
                            className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-primary text-[11px] font-bold shrink-0 tabular-nums">
                                {idx + 1}
                              </span>
                              <span className="truncate font-semibold text-foreground">{modelId}</span>
                              {idx === 0 && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 shrink-0">
                                  PRIMARY
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => moveChainItem(idx, -1)}
                                disabled={idx === 0}
                                aria-label={`Move ${modelId} up`}
                                title="Move up"
                                className="min-h-6 min-w-6 flex items-center justify-center rounded border border-border bg-card text-muted-foreground hover:text-foreground disabled:opacity-30"
                              >
                                <ArrowUp className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveChainItem(idx, 1)}
                                disabled={idx === fallbackChain.length - 1}
                                aria-label={`Move ${modelId} down`}
                                title="Move down"
                                className="min-h-6 min-w-6 flex items-center justify-center rounded border border-border bg-card text-muted-foreground hover:text-foreground disabled:opacity-30"
                              >
                                <ArrowDown className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeChainItem(modelId)}
                                aria-label={`Remove ${modelId} from order`}
                                title="Remove from order"
                                className="min-h-6 min-w-6 flex items-center justify-center rounded border border-border bg-card text-muted-foreground hover:text-rose-400"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      <select
                        aria-label="Select model to add to order"
                        value={modelToAddToChain}
                        onChange={(e) => setModelToAddToChain(e.target.value)}
                        className="flex-1 min-w-0 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
                      >
                        <option value="">Select an active model to add to priority order…</option>
                        {dynamicModels
                          .filter((m) => m.is_active && !fallbackChain.includes(m.model_identifier))
                          .map((m) => (
                            <option key={m.id} value={m.model_identifier}>
                              {m.model_identifier} ({m.display_name})
                            </option>
                          ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => addChainItem(modelToAddToChain)}
                        disabled={!modelToAddToChain}
                        className="btn btn-outline text-xs h-7 px-2.5 gap-1 shrink-0 disabled:opacity-40"
                      >
                        <Plus className="h-3 w-3" />
                        <span>Add</span>
                      </button>
                    </div>
                  </div>

                  {/* All Agents Model Assignments */}
                  <div className="p-4 rounded-xl bg-secondary/20 border border-border space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2">
                      <div>
                        <h3 className="text-xs font-bold text-foreground">
                          All Agents Model Assignments ({workforceAgents.length})
                        </h3>
                        <p className="text-[11px] text-muted-foreground">
                          Ordered with active/working agents first. Assign a specific model or leave on Auto (Fallback Chain).
                        </p>
                      </div>
                    </div>

                    {agentModelFeedback && (
                      <div
                        role="status"
                        className={`p-2.5 rounded-lg border text-xs ${
                          agentModelFeedback.startsWith('Failed')
                            ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        }`}
                      >
                        {agentModelFeedback}
                      </div>
                    )}

                    {workforceAgents.length === 0 ? (
                      <div className="p-3 rounded-lg border border-dashed border-border text-[11px] text-muted-foreground">
                        No agents found in this workspace.
                      </div>
                    ) : (
                      <div className="divide-y divide-border/50 max-h-72 overflow-y-auto pr-1">
                        {workforceAgents.map((agent, idx) => {
                          const assignedModel =
                            typeof agent.intelligence_config?.model === 'string'
                              ? agent.intelligence_config.model
                              : '';
                          const isWorking = ['WORKING', 'RUNNING', 'ACTIVE', 'BUSY'].includes(
                            (agent.status || '').toUpperCase()
                          );
                          return (
                            <div
                              key={agent.id}
                              className="py-2 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2"
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <span className="text-[11px] text-muted-foreground tabular-nums w-5 shrink-0">
                                  {idx + 1}.
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="font-semibold text-foreground truncate">{agent.name}</span>
                                    <span
                                      className={`text-[10px] px-1.5 py-0 rounded border shrink-0 ${
                                        isWorking
                                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
                                          : 'border-border bg-secondary text-muted-foreground'
                                      }`}
                                    >
                                      {agent.status}
                                    </span>
                                  </div>
                                  {agent.role_title && (
                                    <span className="text-[11px] text-muted-foreground truncate block">
                                      @{agent.role_title}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <select
                                aria-label={`Model for ${agent.name}`}
                                value={assignedModel}
                                disabled={updatingAgentId === agent.id}
                                onChange={(e) => handleAgentModelChange(agent, e.target.value)}
                                className="w-full sm:w-56 rounded-md border border-border bg-background px-2 py-1 text-xs font-mono text-foreground focus:outline-none focus:border-primary disabled:opacity-50 shrink-0"
                              >
                                <option value="">Auto (Fallback Chain)</option>
                                {dynamicModels
                                  .filter((m) => m.is_active)
                                  .map((m) => (
                                    <option key={m.id} value={m.model_identifier}>
                                      {m.model_identifier}
                                    </option>
                                  ))}
                                {assignedModel &&
                                  !dynamicModels.some((m) => m.model_identifier === assignedModel && m.is_active) && (
                                    <option value={assignedModel}>{assignedModel} (current)</option>
                                  )}
                              </select>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Register Custom Model Form Drawer */}
                  {showAddModelModal && (
                    <form
                      onSubmit={handleRegisterCustomModel}
                      className="p-4 rounded-xl bg-secondary/30 border border-primary/30 space-y-3"
                    >
                      <div className="flex items-center justify-between border-b border-border/40 pb-2">
                        <span className="font-bold text-foreground text-xs flex items-center gap-1.5">
                          <Plus className="h-3.5 w-3.5 text-primary" />
                          Register Custom / Self-Hosted Model Specification
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowAddModelModal(false)}
                          className="text-muted-foreground hover:text-foreground text-xs"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="text-[10px] text-muted-foreground uppercase block mb-1">
                            Model Identifier (API slug) *
                          </label>
                          <input
                            type="text"
                            required
                            value={newModelIdentifier}
                            onChange={(e) => setNewModelIdentifier(e.target.value)}
                            placeholder="e.g. meta-llama/Llama-3.3-70B-Instruct"
                            className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground uppercase block mb-1">
                            Display Name *
                          </label>
                          <input
                            type="text"
                            required
                            value={newModelDisplayName}
                            onChange={(e) => setNewModelDisplayName(e.target.value)}
                            placeholder="e.g. Llama 3.3 70B Instruct"
                            className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground uppercase block mb-1">
                            Provider Specification
                          </label>
                          <select
                            value={newModelProviderId}
                            onChange={(e) => setNewModelProviderId(e.target.value)}
                            className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs font-mono"
                          >
                            {dynamicProviders.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.display_name} ({p.name})
                              </option>
                            ))}
                            {dynamicProviders.length === 0 && (
                              <option value="">Default Universal Provider</option>
                            )}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground uppercase block mb-1">
                            Context Capacity (Tokens)
                          </label>
                          <input
                            type="number"
                            value={newModelContextCapacity}
                            onChange={(e) => setNewModelContextCapacity(Number(e.target.value))}
                            className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground uppercase block mb-1">
                            Capabilities (comma-delimited)
                          </label>
                          <input
                            type="text"
                            value={newModelCapabilities}
                            onChange={(e) => setNewModelCapabilities(e.target.value)}
                            placeholder="text, code, tools, vision"
                            className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs font-mono"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-muted-foreground uppercase block mb-1">
                              Input $/M Tokens
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={newModelInputCost}
                              onChange={(e) => setNewModelInputCost(Number(e.target.value))}
                              className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs font-mono"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground uppercase block mb-1">
                              Output $/M Tokens
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={newModelOutputCost}
                              onChange={(e) => setNewModelOutputCost(Number(e.target.value))}
                              className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs font-mono"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setShowAddModelModal(false)}
                          className="btn btn-outline text-xs h-7 px-3 font-mono"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={addingModel}
                          className="btn btn-primary text-xs h-7 px-3 font-mono disabled:opacity-50"
                        >
                          {addingModel ? 'Registering...' : 'Whitelist & Save Model'}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Loading State */}
                  {modelsLoading && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div
                          key={i}
                          className="p-4 rounded-xl bg-secondary/10 border border-border animate-pulse space-y-2.5"
                        >
                          <div className="h-4 bg-secondary/50 rounded w-3/4" />
                          <div className="h-3 bg-secondary/40 rounded w-1/2" />
                          <div className="h-2 bg-secondary/30 rounded w-full" />
                          <div className="flex gap-2 pt-2">
                            <div className="h-4 bg-secondary/40 rounded w-12" />
                            <div className="h-4 bg-secondary/40 rounded w-16" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Error State */}
                  {!modelsLoading && modelsError && (
                    <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 space-y-2">
                      <div className="flex items-center gap-2 font-bold">
                        <AlertTriangle className="h-4 w-4" />
                        <span>Failed to Query Intelligence Mesh Models</span>
                      </div>
                      <p className="text-xs text-rose-200/80">{modelsError}</p>
                      <button
                        type="button"
                        onClick={loadDynamicModels}
                        className="btn btn-outline border-rose-500/40 text-rose-300 hover:bg-rose-500/20 text-xs h-7 px-3 mt-1 font-mono"
                      >
                        Retry Query
                      </button>
                    </div>
                  )}

                  {/* Empty State */}
                  {!modelsLoading && !modelsError && dynamicModels.length === 0 && (
                    <div className="p-8 rounded-xl bg-secondary/10 border border-dashed border-border text-center space-y-3">
                      <Zap className="h-8 w-8 text-muted-foreground mx-auto" />
                      <div className="space-y-1">
                        <p className="font-semibold text-foreground text-sm">
                          Zero Models Discovered in Active Mesh
                        </p>
                        <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                          NEIMAN OS does not use hardcoded models. Configure vendor API credentials in the{' '}
                          <button
                            type="button"
                            onClick={() => setActiveSection('ai-providers')}
                            className="text-primary underline hover:text-primary/80"
                          >
                            AI Providers
                          </button>{' '}
                          tab, then run dynamic sync to query live provider endpoints, or register a custom model specification.
                        </p>
                      </div>
                      <div className="flex justify-center gap-2 pt-2">
                        <button
                          type="button"
                          onClick={handleSyncModels}
                          disabled={modelsSyncing}
                          className="btn btn-primary text-xs h-8 px-4 font-mono gap-1.5"
                        >
                          <RotateCw className={`h-3.5 w-3.5 ${modelsSyncing ? 'animate-spin' : ''}`} />
                          <span>{modelsSyncing ? 'Querying...' : 'Sync Provider Models Now'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowAddModelModal(true)}
                          className="btn btn-outline text-xs h-8 px-4 font-mono gap-1.5"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>Register Custom Model</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Zero Search Matches State */}
                  {!modelsLoading && !modelsError && dynamicModels.length > 0 && filteredDynamicModels.length === 0 && (
                    <div className="p-6 rounded-xl bg-secondary/10 border border-border text-center text-xs text-muted-foreground space-y-1">
                      <p className="font-medium text-foreground">No models match &ldquo;{modelFilterQuery}&rdquo;</p>
                      <p>Try searching for a different capability tag, vendor name, or slug.</p>
                      <button
                        type="button"
                        onClick={() => setModelFilterQuery('')}
                        className="text-primary underline text-xs mt-2"
                      >
                        Clear search filter
                      </button>
                    </div>
                  )}

                  {/* Dynamic Models Grid */}
                  {!modelsLoading && !modelsError && filteredDynamicModels.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {filteredDynamicModels.map((m) => {
                        const prov = providerMap.get(m.provider_id);
                        const contextK = Math.round(m.context_capacity / 1024);
                        return (
                          <div
                            key={m.id}
                            className="p-3.5 rounded-xl bg-secondary/20 border border-border hover:border-border/80 transition-all space-y-2.5 flex flex-col justify-between"
                          >
                            <div className="space-y-1">
                              <div className="flex items-start justify-between gap-1.5">
                                <span className="font-bold text-foreground text-sm truncate" title={m.display_name}>
                                  {m.display_name}
                                </span>
                                <span
                                  className={`badge badge-outline text-[9px] shrink-0 ${
                                    m.is_active
                                      ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/5'
                                      : 'text-zinc-500 border-zinc-500/30'
                                  }`}
                                >
                                  {m.is_active ? 'ALLOWED' : 'DISABLED'}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-muted-foreground font-mono truncate" title={m.model_identifier}>
                                  {m.model_identifier}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 pt-0.5">
                                <span className="badge badge-secondary text-[9px] font-sans font-medium">
                                  {prov?.display_name || prov?.name || 'Universal Provider'}
                                </span>
                                <span className="badge badge-outline text-[9px] text-cyan-400 border-cyan-500/30">
                                  {contextK >= 1000 ? `${(contextK / 1000).toFixed(1)}M` : `${contextK}K`} ctx
                                </span>
                              </div>
                            </div>

                            {/* Capabilities Chips */}
                            {m.capabilities && m.capabilities.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {m.capabilities.map((cap, cIdx) => (
                                  <span
                                    key={cIdx}
                                    className="px-1.5 py-0.5 rounded bg-background border border-border/60 text-[9px] text-muted-foreground"
                                  >
                                    {cap}
                                  </span>
                                ))}
                                {m.supports_tools && (
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-[9px] text-emerald-400">
                                    tools
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Metrics & Pricing Footer */}
                            <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                              <span>
                                {m.avg_latency_ms ? `${m.avg_latency_ms}ms` : '180ms'} avg
                              </span>
                              <span>
                                ${m.input_cost_per_million.toFixed(2)} / ${m.output_cost_per_million.toFixed(2)} M
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ────────────────── SECTION 12: APPEARANCE ────────────────── */}
              {activeSection === 'appearance' && (
                <div className="space-y-6 text-xs font-mono">
                  {/* Theme Mode Selector Cards */}
                  <div>
                    <label className="font-bold text-foreground block uppercase tracking-wider mb-2">
                      OPERATIONAL THEME SELECTION
                    </label>
                    <p className="text-muted-foreground mb-4">
                      Choose between the official high-contrast Alabaster Light Mode, the sleek obsidian Cyber-Glow Dark Mode, or synchronize with host OS preferences.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                      {/* 1. Light Mode Card */}
                      <button
                        type="button"
                        onClick={() => {
                          setDefaultTheme('light');
                          setAppTheme('light');
                        }}
                        className={`flex flex-col p-4 rounded-xl border text-left transition-all cursor-pointer ${
                          defaultTheme === 'light'
                            ? 'border-primary bg-primary/10 shadow-xs ring-1 ring-primary'
                            : 'border-border bg-card/60 hover:border-primary/40 hover:bg-secondary/40'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Sun className="h-4 w-4 text-amber-500" />
                            <span className="font-bold text-foreground">Light Mode</span>
                          </div>
                          {defaultTheme === 'light' && (
                            <Check className="h-3.5 w-3.5 text-primary" />
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-snug">
                          Clean Alabaster &amp; Slate Canvas. Canonical official default for daylight and high-visibility ops.
                        </p>
                        <span className="mt-3 inline-block self-start text-[9px] font-bold px-1.5 py-0.5 rounded bg-secondary text-foreground border border-border">
                          Official Default
                        </span>
                      </button>

                      {/* 2. Dark Mode Card */}
                      <button
                        type="button"
                        onClick={() => {
                          setDefaultTheme('dark');
                          setAppTheme('dark');
                        }}
                        className={`flex flex-col p-4 rounded-xl border text-left transition-all cursor-pointer ${
                          defaultTheme === 'dark'
                            ? 'border-primary bg-primary/10 shadow-xs ring-1 ring-primary'
                            : 'border-border bg-card/60 hover:border-primary/40 hover:bg-secondary/40'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Moon className="h-4 w-4 text-primary" />
                            <span className="font-bold text-foreground">Dark Mode</span>
                          </div>
                          {defaultTheme === 'dark' && (
                            <Check className="h-3.5 w-3.5 text-primary" />
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-snug">
                          Sleek Obsidian &amp; Deep Carbon Surface with cyber-glow telemetry and reduced eye fatigue.
                        </p>
                        <span className="mt-3 inline-block self-start text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                          Cyber Obsidian
                        </span>
                      </button>

                      {/* 3. System Sync Card */}
                      <button
                        type="button"
                        onClick={() => {
                          setDefaultTheme('system');
                          setAppTheme('system');
                        }}
                        className={`flex flex-col p-4 rounded-xl border text-left transition-all cursor-pointer ${
                          defaultTheme === 'system'
                            ? 'border-primary bg-primary/10 shadow-xs ring-1 ring-primary'
                            : 'border-border bg-card/60 hover:border-primary/40 hover:bg-secondary/40'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Monitor className="h-4 w-4 text-muted-foreground" />
                            <span className="font-bold text-foreground">System Sync</span>
                          </div>
                          {defaultTheme === 'system' && (
                            <Check className="h-3.5 w-3.5 text-primary" />
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-snug">
                          Dynamically mirrors host operating system or browser color scheme preferences.
                        </p>
                        <span className="mt-3 inline-block self-start text-[9px] font-bold px-1.5 py-0.5 rounded bg-secondary text-muted-foreground border border-border">
                          Active: {resolvedTheme.toUpperCase()}
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="p-4 rounded-xl bg-secondary/20 border border-border space-y-2">
                      <label className="font-bold text-foreground block">THEME SELECTION FALLBACK</label>
                      <select
                        value={defaultTheme}
                        onChange={(e) => {
                          const next = e.target.value as 'light' | 'dark' | 'system';
                          setDefaultTheme(next);
                          setAppTheme(next);
                        }}
                        className="input text-xs"
                      >
                        <option value="light">Light Mode (Official Default)</option>
                        <option value="dark">Dark Mode (Obsidian Cyber-Glow)</option>
                        <option value="system">System Synchronized</option>
                      </select>
                    </div>

                    <div className="p-4 rounded-xl bg-secondary/20 border border-border space-y-2">
                      <label className="font-bold text-foreground block">UI DENSITY</label>
                      <select
                        value={density}
                        onChange={(e) => setDensity(e.target.value)}
                        className="input text-xs"
                      >
                        <option value="comfortable">Comfortable</option>
                        <option value="compact">Compact (High Information Density)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* ────────────────── SECTION 15: DEVELOPER SETTINGS ────────────────── */}
              {activeSection === 'developer' && (
                <div className="space-y-4 text-xs font-mono">
                  <DesktopStatusCard />

                  <div className="p-4 rounded-xl bg-secondary/20 border border-border flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <label className="font-bold text-foreground block">RBAC ROLE SIMULATOR</label>
                      <span className="text-[11px] text-muted-foreground block">
                        Preview UI permissions for another role (API still enforces real token privileges).
                      </span>
                    </div>
                    <select
                      aria-label="Preview role"
                      value={simulatedRole}
                      onChange={(e) => setSimulatedRole(e.target.value as RBACRole)}
                      className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-mono font-medium text-foreground focus:outline-none cursor-pointer"
                    >
                      <option value="SUPERADMIN" className="bg-card text-foreground">SUPERADMIN</option>
                      <option value="ADMIN" className="bg-card text-foreground">ADMIN</option>
                      <option value="MANAGER" className="bg-card text-foreground">MANAGER</option>
                      <option value="VIEWER" className="bg-card text-foreground">VIEWER</option>
                    </select>
                  </div>

                  <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-destructive flex items-center gap-2">
                        <RotateCw className={`h-4 w-4 ${isResettingSetup ? 'animate-spin' : ''}`} />
                        SYSTEM SETUP TRIGGER (neiman-setup)
                      </label>
                      <span className="badge badge-error text-[10px] uppercase font-mono tracking-wider">
                        DANGER / OVERWRITE ALL
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Executes the canonical <code className="text-foreground">neiman-setup</code> routine: safely archives current database state, wipes all persistent SQLite databases &amp; vector caches, re-migrates fresh schemas, and redirects into the initial Software Development Company setup wizard.
                    </p>
                    {setupResetFeedback && (
                      <div className="p-2.5 rounded bg-secondary/40 border border-border text-foreground text-[11px]">
                        {setupResetFeedback}
                      </div>
                    )}
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={setupResetConfirmPhrase}
                        onChange={(e) => setSetupResetConfirmPhrase(e.target.value)}
                        placeholder="Type RESET NEIMAN OPERATIONAL DATA to confirm"
                        className="input w-full max-w-md text-xs font-mono"
                      />
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={handleTriggerNeimanSetup}
                          disabled={isResettingSetup || setupResetConfirmPhrase.trim() !== 'RESET NEIMAN OPERATIONAL DATA'}
                          className="btn btn-destructive text-xs h-8 px-3 gap-1.5 font-bold"
                        >
                          <RotateCw className={`h-3.5 w-3.5 ${isResettingSetup ? 'animate-spin' : ''}`} />
                          {isResettingSetup ? 'Resetting System State...' : 'Trigger neiman-setup (Reset All)'}
                        </button>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          CLI alternative: <code className="text-foreground">neiman-setup</code>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
