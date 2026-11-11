'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { useAccountContext, useOrganizationContext } from '@/lib/organizationContext';
import { isDevelopmentAuthBypassEnabled } from '@/lib/authPreview';
import { DesktopStatusCard } from '@/components/desktop/DesktopStatusCard';
import { api } from '@/lib/api/client';
import { systemConfigApi } from '@/lib/api/systemUpdates';
import { intelligenceApi, type Model as IntelligenceModel, type ModelProvider } from '@/lib/api/intelligence';
import { NEIMAN_CONFIG, getOllamaBaseUrl } from '@neiman/config';
import { useTheme } from '@/components/ThemeProvider';

// 15 Administration Sections
type AdminSectionKey =
  | 'organization'
  | 'members'
  | 'roles'
  | 'permissions'
  | 'security'
  | 'ai-providers'
  | 'models'
  | 'resources'
  | 'policies'
  | 'integrations'
  | 'notifications'
  | 'appearance'
  | 'audit-logs'
  | 'api'
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
  { key: 'organization', label: 'Organization', icon: Building2, tier: 'simple', requiredRole: 'VIEWER', description: 'General workspace identity, company profile, industry, and mission.' },
  { key: 'members', label: 'Members', icon: Users, tier: 'simple', requiredRole: 'MANAGER', description: 'Workspace roster, team invites, and departmental assignments.' },
  { key: 'roles', label: 'Roles', icon: Shield, tier: 'simple', requiredRole: 'ADMIN', description: 'Organizational hierarchy and role assignments.' },
  { key: 'permissions', label: 'Permissions', icon: Lock, tier: 'advanced', requiredRole: 'SUPERADMIN', dangerous: true, description: 'Granular resource scopes, action capabilities, and role permission matrices.' },
  { key: 'security', label: 'Security', icon: ShieldCheck, tier: 'advanced', requiredRole: 'ADMIN', dangerous: true, description: 'MFA enforcement, session timeout bounds, IP allowlists, and SSO.' },
  { key: 'ai-providers', label: 'AI Providers', icon: Cpu, tier: 'both', requiredRole: 'ADMIN', description: 'Vendor credentials, endpoint gateways, and circuit-breaker telemetry.' },
  { key: 'models', label: 'Models', icon: Zap, tier: 'simple', requiredRole: 'MANAGER', description: 'Allowed model whitelist, default mappings, and temperature guardrails.' },
  { key: 'resources', label: 'Resources', icon: Database, tier: 'simple', requiredRole: 'ADMIN', description: 'Compute limits, token monthly caps, and departmental quota pools.' },
  { key: 'policies', label: 'Policies', icon: FileText, tier: 'both', requiredRole: 'ADMIN', description: 'Constitutional rules, approval requirements, and dissent preservation.' },
  { key: 'integrations', label: 'Integrations', icon: Boxes, tier: 'simple', requiredRole: 'ADMIN', description: 'Webhooks, Slack, GitHub, Datadog, and enterprise service connectors.' },
  { key: 'notifications', label: 'Notifications', icon: Bell, tier: 'simple', requiredRole: 'VIEWER', description: 'Incident alerts, email summaries, sound pings, and delivery rules.' },
  { key: 'appearance', label: 'Appearance', icon: Palette, tier: 'simple', requiredRole: 'VIEWER', description: 'Theme defaults, font scaling, command center accent colors, and density.' },
  { key: 'audit-logs', label: 'Audit Logs', icon: Clock, tier: 'both', requiredRole: 'MANAGER', description: 'Immutable chronological trace of administrative and operational actions.' },
  { key: 'api', label: 'API', icon: Key, tier: 'advanced', requiredRole: 'ADMIN', dangerous: true, description: 'Personal & organization service access tokens and HMAC keys.' },
  { key: 'developer', label: 'Developer Settings', icon: Terminal, tier: 'advanced', requiredRole: 'SUPERADMIN', dangerous: true, description: 'Debug flags, synthetic chaos injections, schema migrations, and engine telemetry.' },
];

// Stage 9 — 5 canonical vertical settings categories grouping the 15 administration sections
type SettingsCategoryKey = 'ai-routing' | 'mcp-tools' | 'governance' | 'compute' | 'workspace';

interface SettingsCategory {
  key: SettingsCategoryKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  sections: AdminSectionKey[];
}

const SETTINGS_CATEGORIES: SettingsCategory[] = [
  { key: 'ai-routing', label: 'AI Providers & Model Routing', icon: Cpu, description: 'Provider credentials, allowed models, default routing.', sections: ['ai-providers', 'models'] },
  { key: 'mcp-tools', label: 'MCP Servers & Tool Integrations', icon: Boxes, description: 'Connectors, webhooks, service tokens.', sections: ['integrations', 'api'] },
  { key: 'governance', label: 'Governance & Safety Gates', icon: ShieldCheck, description: 'Policies, RBAC, security, audit trail.', sections: ['policies', 'permissions', 'roles', 'security', 'audit-logs'] },
  { key: 'compute', label: 'Compute, Budgets & Token Quotas', icon: Database, description: 'Budget ceilings, execution slots, quotas.', sections: ['resources'] },
  { key: 'workspace', label: 'Repository & Workspace General', icon: Building2, description: 'Workspace identity, members, appearance, developer.', sections: ['organization', 'members', 'notifications', 'appearance', 'developer'] },
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

  // Success / save indicator
  const [savedBanner, setSavedBanner] = useState<string | null>(null);

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

  // Sensitive credentials state (masked by default, never shown in plaintext after configuration)
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [revealKeyId, setRevealKeyId] = useState<string | null>(null);

  // Form states
  const [orgName, setOrgName] = useState(activeCompany?.name || 'NEIMAN Autonomous Systems');
  const [orgIndustry, setOrgIndustry] = useState(activeCompany?.industry || 'Enterprise Autonomous AI');
  const [orgMission, setOrgMission] = useState(activeCompany?.mission || 'Orchestrate self-improving agent workforces with transparent human oversight.');
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
      const [modelsData, providersData] = await Promise.all([
        intelligenceApi.listModels(activeCompany.id),
        intelligenceApi.listProviders(activeCompany.id).catch(() => [] as ModelProvider[]),
      ]);
      setDynamicModels(Array.isArray(modelsData) ? modelsData : []);
      setDynamicProviders(Array.isArray(providersData) ? providersData : []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to query registered models';
      setModelsError(msg);
    } finally {
      setModelsLoading(false);
    }
  }, [activeCompany?.id]);

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

  const handleSave = () => {
    setSavedBanner('Settings changes committed and applied successfully.');
    setTimeout(() => setSavedBanner(null), 3500);
  };

  const handleGenerateToken = () => {
    if (!newTokenName.trim()) return;
    const generated = `nm_live_${Math.random().toString(36).substring(2)}${Math.random().toString(36).substring(2)}`;
    const newToken = {
      id: `tok-${Date.now()}`,
      name: newTokenName,
      created: new Date().toISOString().slice(0, 10),
      lastUsed: 'Never',
      maskedSecret: `nm_live_••••••••••••••••••••••••••••${generated.slice(-4)}`,
      scope: 'workforce:write',
    };
    setApiTokens([...apiTokens, newToken]);
    setCreatedSecret(generated);
    setNewTokenName('');
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  return (
    <div className="w-full space-y-5 animate-fade-in pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Sliders className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold text-foreground tracking-tight">
                  Settings & Models
                </h1>
                <span className="rounded-md border border-border bg-muted/50 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">RBAC Protected</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Model routing, tool integrations, safety gates, compute budgets, and workspace configuration.
              </p>
            </div>
          </div>
        </div>

        {/* RBAC Role Simulator & Save Action */}
        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs">
            <span className="text-muted-foreground">Preview role</span>
            <select
              aria-label="Preview role"
              value={simulatedRole}
              onChange={(e) => setSimulatedRole(e.target.value as RBACRole)}
              className="bg-transparent font-mono font-medium text-foreground focus:outline-none cursor-pointer"
            >
              <option value="SUPERADMIN" className="bg-card text-foreground">SUPERADMIN</option>
              <option value="ADMIN" className="bg-card text-foreground">ADMIN</option>
              <option value="MANAGER" className="bg-card text-foreground">MANAGER</option>
              <option value="VIEWER" className="bg-card text-foreground">VIEWER</option>
            </select>
          </label>

          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Save className="h-3.5 w-3.5" />
            Save Changes
          </button>
        </div>
      </div>

      {/* Save Success Alert */}
      {savedBanner && (
        <div role="status" className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{savedBanner}</span>
        </div>
      )}

      {/* Authoritative Security Notice */}
      <div className="p-3 rounded-lg bg-muted/40 border border-border text-xs flex items-center gap-2 text-muted-foreground">
        <Shield className="h-4 w-4 text-primary shrink-0" />
        <span>
          <strong className="text-foreground font-medium">Zero-trust authorization:</strong> hidden controls are ergonomic only — the API enforces role verification and token validity on every mutation.
        </span>
      </div>

      {/* Desktop Runtime & Capability Indicator */}
      <DesktopStatusCard />

      {/* 5-TAB VERTICAL SETTINGS HUB */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-5 items-start">
        {/* Left: Vertical Category Tabs */}
        <div className="space-y-3 lg:sticky lg:top-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              aria-label="Filter settings"
              placeholder="Filter settings…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-border bg-background pl-9 pr-12 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
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
            aria-orientation="vertical"
            className="flex flex-col gap-0.5 rounded-xl border border-border bg-card p-1.5"
            onKeyDown={(e) => {
              if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
              e.preventDefault();
              const idx = SETTINGS_CATEGORIES.findIndex((c) => c.key === activeCategory);
              const delta = e.key === 'ArrowDown' ? 1 : -1;
              const next = SETTINGS_CATEGORIES[(idx + delta + SETTINGS_CATEGORIES.length) % SETTINGS_CATEGORIES.length];
              selectCategory(next.key);
              const el = document.getElementById(`settings-tab-${next.key}`);
              el?.focus();
            }}
          >
            {SETTINGS_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isSelected = activeCategory === cat.key && !searchQuery.trim();
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

              {/* ────────────────── SECTION 1: ORGANIZATION ────────────────── */}
              {activeSection === 'organization' && (
                <div className="space-y-4 text-xs font-mono">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="font-bold text-foreground">ORGANIZATION NAME</label>
                      <input
                        type="text"
                        className="input text-xs"
                        value={orgName}
                        onChange={(e) => setOrgName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-bold text-foreground">INDUSTRY DOMAIN</label>
                      <input
                        type="text"
                        className="input text-xs"
                        value={orgIndustry}
                        onChange={(e) => setOrgIndustry(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground">ORGANIZATIONAL MISSION</label>
                    <textarea
                      rows={3}
                      className="input h-auto text-xs py-2"
                      value={orgMission}
                      onChange={(e) => setOrgMission(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <div className="p-3 rounded-xl bg-secondary/30 border border-border">
                      <span className="text-[10px] text-muted-foreground block">COMPANY ID</span>
                      <span className="font-bold text-foreground">{activeCompany?.id || 'No company selected'}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-secondary/30 border border-border">
                      <span className="text-[10px] text-muted-foreground block">STATUS</span>
                      <span className="font-bold text-foreground">{activeCompany?.status || 'Unknown'}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-secondary/30 border border-border">
                      <span className="text-[10px] text-muted-foreground block">TIER</span>
                      <span className="font-bold text-primary">Company workspace</span>
                    </div>
                  </div>
                </div>
              )}

              {/* ────────────────── SECTION 2: MEMBERS ────────────────── */}
              {activeSection === 'members' && (
                <div className="space-y-4 text-xs font-mono">
                  <div className="flex items-center justify-between pb-2 border-b border-border/50">
                    <span className="text-muted-foreground">Active Roster (4 Operators)</span>
                    <button className="btn btn-outline text-xs h-7 px-2.5 gap-1">
                      <Plus className="h-3 w-3" />
                      Invite Member
                    </button>
                  </div>

                  <div className="divide-y divide-border/40">
                    {[
                      { name: 'Dr. Jane Vance', email: 'jane.vance@neiman.ai', role: 'SUPERADMIN', dept: 'Executive' },
                      { name: 'Marcus Sterling', email: 'marcus.s@neiman.ai', role: 'ADMIN', dept: 'Engineering' },
                      { name: 'Elena Rostova', email: 'elena.r@neiman.ai', role: 'MANAGER', dept: 'Reliability SRE' },
                      { name: 'Tariq Al-Mansoor', email: 'tariq.a@neiman.ai', role: 'VIEWER', dept: 'Security Audit' },
                    ].map((m, i) => (
                      <div key={i} className="py-3 flex items-center justify-between gap-2">
                        <div>
                          <p className="font-bold text-foreground">{m.name}</p>
                          <p className="text-[11px] text-muted-foreground">{m.email} &bull; {m.dept}</p>
                        </div>
                        <span className="badge badge-outline text-[10px] font-mono">{m.role}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ────────────────── SECTION 3: ROLES ────────────────── */}
              {activeSection === 'roles' && (
                <div className="space-y-4 text-xs font-mono">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { role: 'SUPERADMIN', users: 1, desc: 'Full authority including kernel mutations, dangerous keys, and security bypasses.' },
                      { role: 'ADMIN', users: 3, desc: 'Organizational configuration, provider billing, policy enforcement, and audit access.' },
                      { role: 'MANAGER', users: 8, desc: 'Task execution, council deliberations, team workflows, and evaluation reports.' },
                      { role: 'VIEWER', users: 15, desc: 'Read-only telemetry observations, memory search, and metric dashboards.' },
                    ].map((r, i) => (
                      <div key={i} className="p-4 rounded-xl bg-secondary/20 border border-border space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-foreground text-sm">{r.role}</span>
                          <span className="badge badge-secondary text-[10px]">{r.users} Assigned</span>
                        </div>
                        <p className="text-muted-foreground text-[11px]">{r.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ────────────────── SECTION 4: PERMISSIONS ────────────────── */}
              {activeSection === 'permissions' && (
                <div className="space-y-4 text-xs font-mono">
                  <div className="p-3.5 rounded-xl bg-secondary/20 border border-border text-[11px] text-muted-foreground">
                    Granular permission capability matrix mapped across all system domains:
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="border-b border-border/80 text-muted-foreground">
                          <th className="pb-2">DOMAIN / CAPABILITY</th>
                          <th className="pb-2">VIEWER</th>
                          <th className="pb-2">MANAGER</th>
                          <th className="pb-2">ADMIN</th>
                          <th className="pb-2">SUPERADMIN</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {[
                          { cap: 'Read Telemetry & Observations', v: true, m: true, a: true, s: true },
                          { cap: 'Trigger Benchmark Simulations', v: false, m: true, a: true, s: true },
                          { cap: 'Promote Sandbox to Real Org', v: false, m: false, a: true, s: true },
                          { cap: 'Edit API Provider Keys', v: false, m: false, a: true, s: true },
                          { cap: 'Bypass Constitutional Gates', v: false, m: false, a: false, s: true },
                          { cap: 'Execute Instant Hard Rollback', v: false, m: false, a: true, s: true },
                        ].map((row, i) => (
                          <tr key={i}>
                            <td className="py-2.5 font-semibold text-foreground">{row.cap}</td>
                            <td className="py-2.5">{row.v ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <span className="text-muted-foreground/40">—</span>}</td>
                            <td className="py-2.5">{row.m ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <span className="text-muted-foreground/40">—</span>}</td>
                            <td className="py-2.5">{row.a ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <span className="text-muted-foreground/40">—</span>}</td>
                            <td className="py-2.5">{row.s ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <span className="text-muted-foreground/40">—</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ────────────────── SECTION 5: SECURITY ────────────────── */}
              {activeSection === 'security' && (
                <div className="space-y-4 text-xs font-mono">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-secondary/20 border border-border space-y-2">
                      <label className="font-bold text-foreground block">MULTI-FACTOR AUTHENTICATION</label>
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="checkbox"
                          checked={mfaEnforced}
                          onChange={(e) => setMfaEnforced(e.target.checked)}
                          className="accent-primary"
                        />
                        <span>Enforce hardware security key or TOTP on all operators</span>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-secondary/20 border border-border space-y-2">
                      <label className="font-bold text-foreground block">SESSION INACTIVITY TIMEOUT</label>
                      <input
                        type="number"
                        value={sessionTimeoutMin}
                        onChange={(e) => setSessionTimeoutMin(parseInt(e.target.value) || 30)}
                        className="input text-xs"
                      />
                      <span className="text-[10px] text-muted-foreground block">Minutes before mandatory re-authentication.</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground block">ALLOWED IP CIDR RANGES</label>
                    <textarea
                      rows={2}
                      value={ipWhitelist}
                      onChange={(e) => setIpWhitelist(e.target.value)}
                      className="input h-auto text-xs py-2"
                    />
                  </div>
                </div>
              )}

              {/* ────────────────── SECTION 6: AI PROVIDERS ────────────────── */}
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

              {/* ────────────────── SECTION 8: RESOURCES ────────────────── */}
              {activeSection === 'resources' && (
                <div className="space-y-4 text-xs font-mono">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl bg-secondary/20 border border-border space-y-1">
                      <span className="text-muted-foreground block text-[10px]">MONTHLY BUDGET CEILING</span>
                      <span className="text-lg font-bold text-emerald-400">$1,500.00 / mo</span>
                    </div>
                    <div className="p-4 rounded-xl bg-secondary/20 border border-border space-y-1">
                      <span className="text-muted-foreground block text-[10px]">PARALLEL EXECUTION SLOTS</span>
                      <span className="text-lg font-bold text-primary">32 Global Slots</span>
                    </div>
                    <div className="p-4 rounded-xl bg-secondary/20 border border-border space-y-1">
                      <span className="text-muted-foreground block text-[10px]">GPU ACCELERATOR CORE POOL</span>
                      <span className="text-lg font-bold text-cyan-400">16 Dedicated Cores</span>
                    </div>
                  </div>
                </div>
              )}

              {/* ────────────────── SECTION 9: POLICIES ────────────────── */}
              {activeSection === 'policies' && (
                <div className="space-y-4 text-xs font-mono">
                  <div className="space-y-2">
                    {[
                      { rule: 'REQUIRE_HUMAN_APPROVAL_HIGH_RISK', desc: 'Mandates explicit operator sign-off on destructive deployments.' },
                      { rule: 'STRICT_SCHEMA_ADHERENCE', desc: 'Validates synthetic model output before feeding into workflow pipelines.' },
                      { rule: 'IMMUTABLE_AUDIT_LOG_STREAM', desc: 'Guarantees zero-tamper audit records committed to append-only storage.' },
                    ].map((p, i) => (
                      <div key={i} className="p-3 rounded-xl bg-secondary/20 border border-border flex items-center justify-between">
                        <div>
                          <span className="font-bold text-foreground text-xs block">{p.rule}</span>
                          <span className="text-muted-foreground text-[11px]">{p.desc}</span>
                        </div>
                        <span className="badge badge-success text-[10px]">ENFORCED</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ────────────────── SECTION 10: INTEGRATIONS ────────────────── */}
              {activeSection === 'integrations' && (
                <div className="space-y-4 text-xs font-mono">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { name: 'GitHub Enterprise', status: 'Connected', desc: 'PR automation, repository reading, and commit signing.' },
                      { name: 'Slack Alerts Webhook', status: 'Connected', desc: 'High-severity incident alerts and approval pings.' },
                      { name: 'Datadog APM', status: 'Connected', desc: 'Streaming real-time latency and token burn telemetry.' },
                      { name: 'PagerDuty', status: 'Standby', desc: 'Escalation routing for autonomous workflow deadlock.' },
                    ].map((integ, i) => (
                      <div key={i} className="p-4 rounded-xl bg-secondary/20 border border-border space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-foreground text-sm">{integ.name}</span>
                          <span className="badge badge-outline text-[10px] text-emerald-400">{integ.status}</span>
                        </div>
                        <p className="text-muted-foreground text-[11px]">{integ.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ────────────────── SECTION 11: NOTIFICATIONS ────────────────── */}
              {activeSection === 'notifications' && (
                <div className="space-y-4 text-xs font-mono">
                  <div className="space-y-3">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifyOutages}
                        onChange={(e) => setNotifyOutages(e.target.checked)}
                        className="accent-primary"
                      />
                      <span className="text-foreground">Provider Outages & Circuit-Breaker State Transitions</span>
                    </label>

                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifyApprovals}
                        onChange={(e) => setNotifyApprovals(e.target.checked)}
                        className="accent-primary"
                      />
                      <span className="text-foreground">Human Approval Requests Pending Action</span>
                    </label>

                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifyAudit}
                        onChange={(e) => setNotifyAudit(e.target.checked)}
                        className="accent-primary"
                      />
                      <span className="text-foreground">High-Privilege Administrative Actions</span>
                    </label>
                  </div>
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

              {/* ────────────────── SECTION 13: AUDIT LOGS ────────────────── */}
              {activeSection === 'audit-logs' && (
                <div className="space-y-4 text-xs font-mono">
                  <div className="p-3.5 rounded-xl bg-secondary/20 border border-border text-muted-foreground flex justify-between items-center">
                    <span>Immutable Audit Log Ledger (Latest 4 Records)</span>
                    <button className="btn btn-outline text-xs h-7 px-2 font-mono">Export CSV</button>
                  </div>

                  <div className="divide-y divide-border/40">
                    {[
                      { time: '10 mins ago', actor: 'jane.vance@neiman.ai', action: 'CREATE_SIMULATION_SCENARIO', target: 'Simulation B', ip: '10.0.4.12' },
                      { time: '42 mins ago', actor: 'marcus.s@neiman.ai', action: 'ROTATE_AI_PROVIDER_KEY', target: 'Anthropic Cloud', ip: '10.0.1.84' },
                      { time: '2 hours ago', actor: 'system-agent-supervisor', action: 'TRIGGER_CIRCUIT_BREAKER', target: 'OpenAI Gateway', ip: 'internal' },
                      { time: '5 hours ago', actor: 'jane.vance@neiman.ai', action: 'PROMOTE_SIMULATION', target: 'Simulation A', ip: '10.0.4.12' },
                    ].map((entry, i) => (
                      <div key={i} className="py-2.5 flex items-center justify-between text-[11px]">
                        <div>
                          <span className="font-bold text-primary">{entry.action}</span>
                          <span className="text-muted-foreground ml-2">by {entry.actor} on {entry.target}</span>
                        </div>
                        <span className="text-muted-foreground">{entry.time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ────────────────── SECTION 14: API & CREDENTIALS ────────────────── */}
              {activeSection === 'api' && (
                <div className="space-y-4 text-xs font-mono">
                  <div className="p-3.5 rounded-xl bg-secondary/20 border border-border text-muted-foreground">
                    <strong className="text-foreground">One-Time Exposure Rule:</strong> API keys and secrets are generated cryptographically and shown <strong className="text-foreground">ONLY ONCE</strong> upon creation. Afterward, they are stored as one-way salt-hashed digests and can never be retrieved.
                  </div>

                  {/* Create New Token Form */}
                  <div className="p-4 rounded-xl bg-secondary/30 border border-border space-y-3">
                    <span className="font-bold text-foreground block text-sm">Generate Service / Operator Token</span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Token description (e.g. CI/CD Deployment Token)"
                        value={newTokenName}
                        onChange={(e) => setNewTokenName(e.target.value)}
                        className="input text-xs flex-1"
                      />
                      <button
                        type="button"
                        onClick={handleGenerateToken}
                        disabled={!newTokenName.trim()}
                        className="btn btn-primary text-xs h-9 px-3 gap-1 shrink-0"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Generate Token
                      </button>
                    </div>

                    {createdSecret && (
                      <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 space-y-1.5 animate-fade-in">
                        <span className="font-bold text-xs flex items-center gap-1.5 text-emerald-400">
                          <CheckCircle2 className="h-4 w-4" />
                          Token Generated! Copy it now — it will never be displayed again.
                        </span>
                        <div className="flex items-center gap-2 bg-black/40 p-2 rounded border border-emerald-500/40">
                          <code className="text-xs text-foreground font-mono flex-1 break-all">
                            {createdSecret}
                          </code>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(createdSecret, 'new-secret')}
                            className="btn btn-outline text-xs h-7 px-2 gap-1 text-emerald-300"
                          >
                            {copiedKey === 'new-secret' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                            {copiedKey === 'new-secret' ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Existing Tokens List */}
                  <div className="space-y-2">
                    <span className="font-bold text-foreground text-xs uppercase text-muted-foreground block">
                      Active Authorized Service Tokens ({apiTokens.length})
                    </span>
                    <div className="divide-y divide-border/40">
                      {apiTokens.map((t) => (
                        <div key={t.id} className="py-3 flex items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-foreground">{t.name}</span>
                              <span className="badge badge-secondary text-[9px]">{t.scope}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                              <code>{t.maskedSecret}</code>
                              <span>&bull; Created: {t.created}</span>
                              <span>&bull; Last used: {t.lastUsed}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setApiTokens(apiTokens.filter((item) => item.id !== t.id))}
                            className="btn btn-ghost text-xs h-7 px-2 text-rose-400 hover:bg-rose-500/10"
                          >
                            Revoke
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ────────────────── SECTION 15: DEVELOPER SETTINGS ────────────────── */}
              {activeSection === 'developer' && (
                <div className="space-y-4 text-xs font-mono">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-secondary/20 border border-border space-y-2">
                      <label className="font-bold text-foreground block">SYNTHETIC BENCHMARK CHAOS</label>
                      <span className="text-[11px] text-muted-foreground block">
                        Inject random network delays (200-800ms) into simulation lab runs to stress-test circuit breakers.
                      </span>
                      <button className="btn btn-outline text-xs h-7 px-2.5">Enable Chaos Injection</button>
                    </div>

                    <div className="p-4 rounded-xl bg-secondary/20 border border-border space-y-2">
                      <label className="font-bold text-foreground block">DATABASE SCHEMA DRIFT INSPECTION</label>
                      <span className="text-[11px] text-muted-foreground block">
                        Verify Alembic migration revision consistency against active PostgreSQL vector tables.
                      </span>
                      <button className="btn btn-outline text-xs h-7 px-2.5">Run Schema Verify</button>
                    </div>

                    <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 space-y-3 sm:col-span-2">
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
                        Executes the canonical <code className="text-foreground">neiman-setup</code> routine: safely archives current database state, wipes all persistent SQLite databases & vector caches, re-migrates fresh schemas, and redirects into the initial Software Development Company setup wizard.
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

                  <div className="p-4 rounded-xl bg-secondary/10 border border-border space-y-2">
                    <span className="font-bold text-foreground block">KERNEL ENGINE TELEMETRY</span>
                    <pre className="p-3 rounded-lg bg-black/40 border border-border font-mono text-[11px] text-foreground overflow-x-auto">
                      {JSON.stringify(
                        {
                          neiman_engine_version: 'v2.4.0-enterprise',
                          environment: 'production',
                          active_workers: 18,
                          memory_allocated_mb: 412.8,
                          circuit_breaker_registry_state: 'OPTIMAL',
                        },
                        null,
                        2
                      )}
                    </pre>
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
