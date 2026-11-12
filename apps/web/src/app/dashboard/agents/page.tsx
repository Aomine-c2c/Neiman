'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NEIMAN_CONFIG } from '@neiman/config';
import {
  Bot,
  Plus,
  Loader2,
  AlertCircle,
  Search,
  Activity,
  Zap,
  Brain,
  Shield,
  ChevronRight,
  Circle,
  Filter,
  Sliders,
  LayoutGrid,
  List,
  Building2,
  Briefcase,
  Users,
  Cpu,
  Layers,
  Sparkles,
  BookOpen,
  FileCode2,
  Network,
  Play,
  Terminal,
  RotateCw,
} from 'lucide-react';
import { agentsApi, CreateAgentRequest, Agent } from '@/lib/api/agents';
import { externalAgentsApi, ExternalAgentConfig, ExternalAgentExecutionTelemetry } from '@/lib/api/externalAgents';
import { blueprintsApi } from '@/lib/api/blueprints';
import { organizationsApi } from '@/lib/api/organizations';
import { useOrganizationContext } from '@/lib/organizationContext';
import { ApiError } from '@/lib/api/client';
import { AgentProfileDrawer } from '@/components/AgentProfileDrawer';
import { AgentOrb } from '@/components/ui/AgentOrb';
import { AgentAvatar } from '@/components/ui/AgentAvatar';

const AUTONOMY_LABELS: Record<string, string> = {
  SUPERVISED: 'Supervised',
  SEMI_AUTONOMOUS: 'Semi-Autonomous',
  AUTONOMOUS: 'Autonomous',
  FULLY_AUTONOMOUS: 'Fully Autonomous',
};

const STATUS_COLORS: Record<string, string> = {
  CREATED: 'text-muted-foreground',
  CONFIGURED: 'text-blue-400',
  AVAILABLE: 'text-emerald-400',
  WORKING: 'text-amber-400',
  BLOCKED: 'text-rose-400',
  PAUSED: 'text-slate-400',
  WAITING: 'text-purple-400',
  OFFLINE: 'text-zinc-500',
  RETIRED: 'text-muted-foreground',
};

const STATUS_BG: Record<string, string> = {
  CREATED: 'bg-muted/50',
  CONFIGURED: 'bg-blue-500/10',
  AVAILABLE: 'bg-emerald-500/10',
  WORKING: 'bg-amber-500/10',
  BLOCKED: 'bg-rose-500/10',
  PAUSED: 'bg-slate-500/10',
  WAITING: 'bg-purple-500/10',
  OFFLINE: 'bg-zinc-800/50',
  RETIRED: 'bg-muted/30',
};

const AUTONOMY_COLORS: Record<string, string> = {
  SUPERVISED: 'badge-default',
  SEMI_AUTONOMOUS: 'badge-primary',
  AUTONOMOUS: 'badge-warning',
  FULLY_AUTONOMOUS: 'badge-destructive',
};

function getAgentIntelligenceLabel(agent: Agent, roleTitle?: string) {
  const intConfig = (agent.intelligence_config || {}) as Record<string, unknown>;
  const lastModel = (intConfig.last_rotated_model as string) || (intConfig.model as string);
  const tier = (intConfig.active_tier as string) || (intConfig.tier as string);

  const role = (roleTitle || agent.name || '').toLowerCase();
  const isFrontier =
    tier?.includes('FRONTIER') ||
    tier?.includes('ARCHITECT') ||
    role.includes('cto') ||
    role.includes('architect') ||
    role.includes('security') ||
    role.includes('database');
  const isFast = tier?.includes('FAST') || tier?.includes('SYNTHESIS') || role.includes('writer');

  const tierName = isFrontier ? 'Frontier Reasoning' : isFast ? 'Fast Throughput' : 'Balanced Core';

  if (lastModel && lastModel !== 'adaptive' && lastModel !== 'claude-sonnet') {
    return {
      tier: tierName,
      modelText: lastModel,
      displayBadge: `${tierName} · ${lastModel}`,
      isRotated: true,
    };
  }

  return {
    tier: tierName,
    modelText: 'Dynamic Multi-Model Fleet',
    displayBadge: `Adaptive · ${tierName}`,
    isRotated: false,
  };
}

function AgentCard({
  agent,
  departmentName,
  roleTitle,
  onSelect,
  onDirective,
  onTogglePause,
  isPausing,
}: {
  agent: Agent;
  departmentName?: string;
  roleTitle?: string;
  onSelect: () => void;
  onDirective?: () => void;
  onTogglePause?: () => void;
  isPausing?: boolean;
}) {
  const statusColor = STATUS_COLORS[agent.status] ?? 'text-muted-foreground';
  const statusBg = STATUS_BG[agent.status] ?? 'bg-muted/50';
  const autonomyClass = AUTONOMY_COLORS[agent.autonomy] ?? 'badge-default';
  const intConfig = (agent.intelligence_config || {}) as { provider?: string; model?: string };
  const intelInfo = getAgentIntelligenceLabel(agent, roleTitle);

  return (
    <div
      onClick={onSelect}
      className={`group rounded-2xl border bg-card p-5 transition-all duration-200 cursor-pointer ${
        agent.status === 'WORKING'
          ? 'border-amber-500/40 hover:border-amber-400 shadow-md shadow-amber-500/5'
          : agent.status === 'BLOCKED'
          ? 'border-rose-500/40 hover:border-rose-400 shadow-md shadow-rose-500/5'
          : 'border-border hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5'
      }`}
    >
      {/* Header with Role Avatar, Thinking Orb & Autonomy Badge */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <AgentAvatar
            name={agent.name}
            roleTitle={roleTitle}
            departmentName={departmentName}
            avatarUrl={agent.identity?.avatar_url as string | undefined}
            status={agent.status}
            size="md"
          />
          <div className="flex flex-col">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              {roleTitle || 'AGENT'}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`text-[10px] font-mono font-bold uppercase tracking-wider ${statusColor}`}>{agent.status}</span>
              <AgentOrb status={agent.status} size={20} />
            </div>
          </div>
        </div>
        <span className={`badge ${autonomyClass}`}>
          {AUTONOMY_LABELS[agent.autonomy] ?? agent.autonomy}
        </span>
      </div>

      {/* Name, Role & Status */}
      <div className="mt-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
            {agent.name}
          </h3>
          <Circle className={`h-2 w-2 fill-current ${statusColor} flex-shrink-0`} aria-hidden="true" />
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
          <span className="truncate">{roleTitle || 'Autonomous Employee'}</span>
          {departmentName && (
            <>
              <span>•</span>
              <span className="text-primary truncate">{departmentName}</span>
            </>
          )}
        </div>
      </div>

      {/* Intelligence & Model Provider Tag */}
      <div className="mt-2.5 flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
        <RotateCw className="h-3 w-3 text-cyan-500 animate-spin-slow shrink-0" />
        <span className="text-cyan-500 font-semibold">{intelInfo.tier}</span>
        <span>·</span>
        <span className="text-foreground truncate">{intelInfo.isRotated ? intelInfo.modelText : 'Adaptive Rotation'}</span>
      </div>

      {/* Mission / Goal / Instructions preview */}
      {agent.goals && agent.goals.length > 0 ? (
        <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
          Mission: {agent.goals[0]}
        </p>
      ) : agent.system_instructions ? (
        <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
          {agent.system_instructions}
        </p>
      ) : null}

      {/* Capabilities Whitelist */}
      {agent.capabilities && agent.capabilities.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {agent.capabilities.slice(0, 3).map((cap) => (
            <span
              key={cap}
              className="inline-flex items-center rounded-md bg-secondary/70 border border-border/50 px-2 py-0.5 text-[10px] font-mono text-muted-foreground"
            >
              {cap}
            </span>
          ))}
          {agent.capabilities.length > 3 && (
            <span className="inline-flex items-center rounded-md bg-secondary/50 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
              +{agent.capabilities.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Footer telemetry and interactive action deck */}
      <div className="mt-4 flex items-center justify-between border-t border-border pt-3.5 text-xs text-muted-foreground font-mono">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1" title="Tasks completed">
            <Activity className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{(agent.performance_metadata as { tasks_completed?: number })?.tasks_completed ?? 0}</span>
          </div>
          <div className="flex items-center gap-1" title="Resource usage">
            <Zap className="h-3.5 w-3.5" aria-hidden="true" />
            <span>${((agent.resource_usage as { total_cost_usd?: number })?.total_cost_usd ?? 0).toFixed(2)}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {onTogglePause && (
            <button
              type="button"
              disabled={isPausing}
              onClick={(e) => {
                e.stopPropagation();
                onTogglePause();
              }}
              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-secondary/80 hover:bg-secondary text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              title={agent.status === 'PAUSED' ? 'Resume agent' : 'Pause agent'}
            >
              {isPausing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : agent.status === 'PAUSED' ? (
                <>
                  <Play className="h-3 w-3 text-emerald-400" />
                  <span>Resume</span>
                </>
              ) : (
                <>
                  <Circle className="h-2 w-2 fill-slate-400 text-slate-400" />
                  <span>Pause</span>
                </>
              )}
            </button>
          )}

          {onDirective && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDirective();
              }}
              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-primary/10 hover:bg-primary/20 text-[11px] font-mono text-primary font-medium transition-colors border border-primary/20"
              title="Dispatch direct ad-hoc directive"
            >
              <Terminal className="h-3 w-3" />
              <span>Directive</span>
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            className="flex items-center gap-0.5 text-muted-foreground hover:text-foreground font-semibold px-1 py-1"
            aria-label={`View ${agent.name} profile`}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AgentsPage() {
  const qc = useQueryClient();
  const activeCompany = useOrganizationContext();
  const companyId = activeCompany?.id;

  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const initialEntityId = searchParams?.get('entityId') || searchParams?.get('agent') || null;
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(initialEntityId);
  const [showCreate, setShowCreate] = useState(false);
  const [createMode, setCreateMode] = useState<'simple' | 'advanced'>('simple');
  const [viewLayout, setViewLayout] = useState<'grid' | 'list' | 'tree'>('grid');
  const [activeDirectoryTab, setActiveDirectoryTab] = useState<'internal' | 'external'>('internal');

  // External Agent Dispatch State
  const [selectedExternalAgentId, setSelectedExternalAgentId] = useState('hermes_agent');
  const [extTaskTitle, setExtTaskTitle] = useState('Verify distributed database synchronization');
  const [extTaskInstructions, setExtTaskInstructions] = useState('Analyze transaction consistency models and verify zero replication lag.');
  const [extResult, setExtResult] = useState<ExternalAgentExecutionTelemetry | null>(null);

  // Direct Directive & Pause/Resume State
  const [directiveAgent, setDirectiveAgent] = useState<Agent | null>(null);
  const [directiveObjective, setDirectiveObjective] = useState('');
  const [directiveTaskId, setDirectiveTaskId] = useState('');
  const [directiveResult, setDirectiveResult] = useState<any | null>(null);
  const [directiveError, setDirectiveError] = useState<string | null>(null);

  // Filter state
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Dual-mode creation form state
  const [form, setForm] = useState<{
    name: string;
    role_id: string;
    department_id: string;
    manager_agent_id: string;
    mission: string;
    autonomy: string;
    preferred_intelligence: string;
    model: string;
    system_instructions: string;
    capabilities: string[];
    tools: string[];
    permissions: {
      approval_required: boolean;
      max_actions_per_task: number;
    };
    daily_budget_usd: number;
    max_tokens_per_call: number;
    memory_scope: string;
    escalation_rule: string;
    evaluation_setting: string;
  }>({
    name: '',
    role_id: '',
    department_id: '',
    manager_agent_id: '',
    mission: '',
    autonomy: 'SUPERVISED',
    preferred_intelligence: 'anthropic',
    model: 'claude-sonnet',
    system_instructions: '',
    capabilities: ['reasoning', 'research'],
    tools: ['file_operations', 'web_search'],
    permissions: { approval_required: true, max_actions_per_task: 10 },
    daily_budget_usd: 10,
    max_tokens_per_call: 8192,
    memory_scope: 'department',
    escalation_rule: 'SUPERVISOR_REVIEW',
    evaluation_setting: 'AUTOMATED_BENCHMARK',
  });

  const [capInput, setCapInput] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [docGenerationMessage, setDocGenerationMessage] = useState<string | null>(null);
  const [isDeployingTeam, setIsDeployingTeam] = useState(false);
  const [deployError, setDeployError] = useState<string | null>(null);

  const handleDeployCodingTeam = async () => {
    try {
      setIsDeployingTeam(true);
      setDeployError(null);
      await blueprintsApi.instantiateBlueprint('software_development_company', {
        company_name: activeCompany?.name,
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['agents', companyId] }),
        qc.invalidateQueries({ queryKey: ['departments', companyId] }),
        qc.invalidateQueries({ queryKey: ['org-roles', companyId] }),
      ]);
    } catch (err) {
      setDeployError(err instanceof ApiError ? err.message : 'Failed to instantiate software development team.');
    } finally {
      setIsDeployingTeam(false);
    }
  };

  // Queries
  const { data: agents = [], isLoading, error } = useQuery({
    queryKey: ['agents', companyId],
    queryFn: () => agentsApi.list(companyId!),
    enabled: !!companyId,
    staleTime: NEIMAN_CONFIG.TELEMETRY.STALE_TIMES.MEDIUM,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments', companyId],
    queryFn: () => organizationsApi.listDepartments(companyId!),
    enabled: !!companyId,
    staleTime: NEIMAN_CONFIG.TELEMETRY.STALE_TIMES.LONG,
  });

  const { data: roles = [] } = useQuery({
    queryKey: ['org-roles', companyId],
    queryFn: () => organizationsApi.listRoles(companyId!),
    enabled: !!companyId,
    staleTime: NEIMAN_CONFIG.TELEMETRY.STALE_TIMES.LONG,
  });

  // Creation mutation
  const createMutation = useMutation({
    mutationFn: (body: CreateAgentRequest) => agentsApi.create(companyId!, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agents', companyId] });
      setShowCreate(false);
      setFormError(null);
      setForm({
        name: '',
        role_id: '',
        department_id: '',
        manager_agent_id: '',
        mission: '',
        autonomy: 'SUPERVISED',
        preferred_intelligence: 'anthropic',
        model: 'claude-sonnet',
        system_instructions: '',
        capabilities: ['reasoning', 'research'],
        tools: ['file_operations', 'web_search'],
        permissions: { approval_required: true, max_actions_per_task: 10 },
        daily_budget_usd: 10,
        max_tokens_per_call: 8192,
        memory_scope: 'department',
        escalation_rule: 'SUPERVISOR_REVIEW',
        evaluation_setting: 'AUTOMATED_BENCHMARK',
      });
    },
    onError: (err) => {
      setFormError(err instanceof ApiError ? err.message : 'Failed to create agent.');
    },
  });

  // Documentation Specialist Agent Trigger Mutation
  const generateDocsMutation = useMutation({
    mutationFn: () => agentsApi.triggerDocGeneration(companyId!),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['agents', companyId] });
      setDocGenerationMessage(
        `Generated ${data.total_tokens_generated} tokens of machine-optimized docs across ${data.sections.length} files.`
      );
      setTimeout(() => setDocGenerationMessage(null), 6000);
    },
    onError: (err: ApiError) => {
      setDocGenerationMessage(`Documentation generation failed: ${err.message || 'Unknown error'}`);
      setTimeout(() => setDocGenerationMessage(null), 6000);
    },
  });

  // External Agents Query
  const { data: externalAgents = [], refetch: refetchExternal } = useQuery({
    queryKey: ['external-agents', companyId],
    queryFn: () => externalAgentsApi.list(companyId!),
    enabled: !!companyId,
    staleTime: NEIMAN_CONFIG.TELEMETRY.STALE_TIMES.MEDIUM,
  });

  // Dispatch External Agent Mutation
  const dispatchExternalMutation = useMutation({
    mutationFn: () =>
      externalAgentsApi.dispatch(companyId!, {
        agent_id: selectedExternalAgentId,
        task_title: extTaskTitle,
        task_instructions: extTaskInstructions,
      }),
    onSuccess: (data) => {
      setExtResult(data);
    },
  });

  // Toggle External Agent Mutation
  const toggleExternalMutation = useMutation({
    mutationFn: ({ agentId, isActive }: { agentId: string; isActive: boolean }) =>
      externalAgentsApi.toggle(companyId!, agentId, isActive),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['external-agents', companyId] });
    },
  });

  // Pause / Resume Mutation
  const pauseResumeMutation = useMutation({
    mutationFn: async ({ agentId, currentStatus }: { agentId: string; currentStatus: string }) => {
      if (!companyId) return;
      const nextStatus = currentStatus === 'PAUSED' ? 'AVAILABLE' : 'PAUSED';
      return agentsApi.transitionStatus(companyId, agentId, nextStatus, 'Operator interactive toggle');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agents', companyId] });
      qc.invalidateQueries({ queryKey: ['departments', companyId] });
    },
  });

  // Direct Directive Mutation
  const executeDirectiveMutation = useMutation({
    mutationFn: async () => {
      if (!companyId || !directiveAgent) throw new Error('Missing agent or organization');
      const tid = directiveTaskId.trim() || `adhoc-dir-${Date.now()}`;
      return agentsApi.executeTask(companyId, directiveAgent.id, {
        task_id: tid,
        input_data: {
          objective: directiveObjective,
          directive_source: 'OPERATOR_CONSOLE',
          timestamp: new Date().toISOString(),
        },
      });
    },
    onSuccess: (data) => {
      setDirectiveResult(data);
      setDirectiveError(null);
      qc.invalidateQueries({ queryKey: ['agents', companyId] });
    },
    onError: (err: Error) => {
      setDirectiveError(err.message || 'Directive execution failed');
      setDirectiveResult(null);
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormError('Agent name is required.');
      return;
    }
    setFormError(null);

    const payload: CreateAgentRequest = {
      name: form.name.trim(),
      role_id: form.role_id || undefined,
      department_id: form.department_id || undefined,
      manager_agent_id: form.manager_agent_id || undefined,
      autonomy: form.autonomy,
      goals: form.mission ? [form.mission] : [],
      intelligence_config: {
        provider: form.preferred_intelligence,
        model: form.model,
      },
      system_instructions: form.system_instructions || undefined,
      capabilities: form.capabilities,
      permissions: form.permissions,
      resource_limits: {
        daily_budget_usd: form.daily_budget_usd,
        max_tokens_per_call: form.max_tokens_per_call,
        memory_scope: form.memory_scope,
        escalation_rule: form.escalation_rule,
        evaluation_setting: form.evaluation_setting,
      },
    };

    createMutation.mutate(payload);
  };

  const addCapability = () => {
    const cap = capInput.trim();
    if (!cap) return;
    setForm((f) => ({ ...f, capabilities: [...f.capabilities, cap] }));
    setCapInput('');
  };

  const removeCapability = (cap: string) => {
    setForm((f) => ({ ...f, capabilities: f.capabilities.filter((c) => c !== cap) }));
  };

  // Filter pipeline
  const filtered = agents.filter((a) => {
    if (departmentFilter !== 'ALL' && a.department_id !== departmentFilter) {
      return false;
    }
    if (statusFilter !== 'ALL' && a.status.toUpperCase() !== statusFilter.toUpperCase()) {
      return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = a.name.toLowerCase().includes(q);
      const matchInst = (a.system_instructions ?? '').toLowerCase().includes(q);
      const matchGoal = (a.goals ?? []).some((g) => g.toLowerCase().includes(q));
      if (!matchName && !matchInst && !matchGoal) return false;
    }
    return true;
  });

  if (!companyId) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border py-20">
        <Shield className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
        <div className="text-center">
          <h3 className="text-lg font-semibold text-foreground">No active organization</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Select an organization first to manage its AI workforce.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 1. DIRECTORY HEADER & PRIMARY ACTION */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-foreground">AI Workforce</h1>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              Autonomous Directory
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Enterprise agents, reporting lines, intelligence configuration, and operational state
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="deploy-coding-team-header-btn"
            type="button"
            className="btn btn-outline shrink-0 gap-2 border-primary/40 text-primary hover:bg-primary/10 text-xs"
            disabled={isDeployingTeam}
            onClick={handleDeployCodingTeam}
            title="Deploy or synchronize the complete 11-agent autonomous software engineering team"
          >
            {isDeployingTeam ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Deploy 11-Agent Coding Team
          </button>

          <button
            id="trigger-doc-agent-btn"
            type="button"
            className="btn btn-outline shrink-0 gap-2 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 text-xs"
            disabled={generateDocsMutation.isPending}
            onClick={() => generateDocsMutation.mutate()}
            title="Trigger DocuForge-Arch to generate and update machine references for coding agents"
          >
            <BookOpen className={`h-4 w-4 ${generateDocsMutation.isPending ? 'animate-spin' : ''}`} aria-hidden="true" />
            {generateDocsMutation.isPending ? 'Generating Docs...' : 'Update Agent Docs'}
          </button>

          <button
            id="create-agent-btn"
            type="button"
            className="btn btn-primary shrink-0 gap-2"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New Agent
          </button>
        </div>
      </div>

      {/* DOCUMENTATION AGENT NOTIFICATION BANNER */}
      {docGenerationMessage && (
        <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-mono flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <FileCode2 className="h-4 w-4 shrink-0" />
            <span>{docGenerationMessage}</span>
          </div>
          <button
            onClick={() => setDocGenerationMessage(null)}
            className="text-xs text-muted-foreground hover:text-foreground font-sans px-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 2. FLEET METRICS COUNTERS */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total Fleet', value: agents.length, color: 'text-foreground', icon: Bot },
          { label: 'Available', value: agents.filter((a) => a.status === 'AVAILABLE').length, color: 'text-emerald-400', icon: Activity },
          { label: 'Working', value: agents.filter((a) => a.status === 'WORKING').length, color: 'text-amber-400', icon: Zap },
          { label: 'Blocked', value: agents.filter((a) => a.status === 'BLOCKED').length, color: 'text-rose-400', icon: Shield },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <Icon className={`h-4 w-4 ${color}`} aria-hidden="true" />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
            <p className={`text-2xl font-bold font-mono mt-1 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* DIRECTORY SWITCHER: INTERNAL WORKFORCE VS EXTERNAL AGENTS */}
      <div className="flex border-b border-border gap-6">
        <button
          type="button"
          onClick={() => setActiveDirectoryTab('internal')}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-colors ${
            activeDirectoryTab === 'internal'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Bot className="h-4 w-4" />
          Internal Workforce ({agents.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveDirectoryTab('external')}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-colors ${
            activeDirectoryTab === 'external'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Network className="h-4 w-4" />
          External Autonomous Agents ({externalAgents.length})
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
            Hermes • Muse • Devin
          </span>
        </button>
      </div>

      {/* 3. SEARCH & DIRECTORY CONTROLS (INTERNAL ONLY) */}
      {activeDirectoryTab === 'internal' && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-border bg-card/60">
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            {/* Search Bar */}
            <div className="relative min-w-[220px] flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <input
                type="search"
                className="input pl-9 text-xs h-9"
                placeholder="Search agents by name, mission, role..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search agents"
              />
            </div>

            {/* Department Filter */}
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              aria-label="Filter by department"
              className="input text-xs h-9 w-auto min-w-[150px]"
            >
              <option value="ALL">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
              className="input text-xs h-9 w-auto min-w-[140px]"
            >
              <option value="ALL">All Statuses</option>
              <option value="AVAILABLE">Available</option>
              <option value="WORKING">Working</option>
              <option value="BLOCKED">Blocked</option>
              <option value="WAITING">Waiting</option>
              <option value="PAUSED">Paused</option>
              <option value="OFFLINE">Offline</option>
            </select>
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-1 border border-border/80 rounded-lg p-0.5 bg-secondary/40">
            <button
              type="button"
              onClick={() => setViewLayout('grid')}
              className={`p-1.5 rounded-md ${
                viewLayout === 'grid' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewLayout('list')}
              className={`p-1.5 rounded-md ${
                viewLayout === 'list' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
              title="List View"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewLayout('tree')}
              className={`p-1.5 rounded-md ${
                viewLayout === 'tree' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Org Hierarchy Tree"
            >
              <Network className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* 4. INTERNAL AGENT DIRECTORY (LOADING / ERROR / EMPTY / LIST / GRID) */}
      {activeDirectoryTab === 'internal' && (
        <>
          {isLoading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Loading agents" />
            </div>
          )}

          {error && (
            <div className="flex items-center gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-rose-400" role="alert">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p>{error instanceof ApiError ? error.message : 'Failed to load agents.'}</p>
            </div>
          )}

          {!isLoading && !error && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border py-20 px-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20">
                <Brain className="h-8 w-8 text-primary" />
              </div>
              <div className="text-center max-w-lg">
                <h3 className="text-lg font-semibold text-foreground">
                  {agents.length === 0 ? 'No Engineering Agents Deployed Yet' : 'No Matching Agents Found'}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {agents.length === 0
                    ? 'Deploy the canonical 11-agent software engineering team (Product Spec, Architecture, Frontend, Backend, Database, Code Review, AppSec, QA, SRE, DevOps, Technical Writer) or construct a bespoke agent.'
                    : 'Try adjusting your search query or filter criteria.'}
                </p>
                {deployError && (
                  <p className="text-xs text-rose-400 mt-2 font-mono">{deployError}</p>
                )}
              </div>
              {agents.length === 0 && (
                <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
                  <button
                    type="button"
                    className="btn btn-primary gap-2"
                    onClick={handleDeployCodingTeam}
                    disabled={isDeployingTeam}
                  >
                    {isDeployingTeam ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    Deploy 11-Agent Coding Team
                  </button>
                  <button type="button" className="btn btn-secondary gap-2" onClick={() => setShowCreate(true)}>
                    <Plus className="h-4 w-4" />
                    Create Custom Agent
                  </button>
                </div>
              )}
            </div>
          )}

          {/* GRID VIEW */}
          {filtered.length > 0 && viewLayout === 'grid' && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((agent) => {
                const dept = departments.find((d) => d.id === agent.department_id);
                const role = roles.find((r) => r.id === agent.role_id);
                return (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    departmentName={dept?.name}
                    roleTitle={role?.title}
                    onSelect={() => setSelectedAgentId(agent.id)}
                    onDirective={() => {
                      setDirectiveAgent(agent);
                      setDirectiveObjective('');
                      setDirectiveTaskId(`adhoc-dir-${agent.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString().slice(-4)}`);
                      setDirectiveResult(null);
                      setDirectiveError(null);
                    }}
                    onTogglePause={() => pauseResumeMutation.mutate({ agentId: agent.id, currentStatus: agent.status })}
                    isPausing={pauseResumeMutation.isPending && pauseResumeMutation.variables?.agentId === agent.id}
                  />
                );
              })}
            </div>
          )}

          {/* LIST VIEW */}
          {filtered.length > 0 && viewLayout === 'list' && (
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-secondary/40 text-muted-foreground uppercase font-mono tracking-wider border-b border-border">
                  <tr>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Role & Dept</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Autonomy</th>
                    <th className="py-3 px-4">Intelligence</th>
                    <th className="py-3 px-4">Resource Cost</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filtered.map((agent) => {
                    const dept = departments.find((d) => d.id === agent.department_id);
                    const role = roles.find((r) => r.id === agent.role_id);
                    const int = (agent.intelligence_config || {}) as { provider?: string; model?: string };
                    return (
                      <tr
                        key={agent.id}
                        onClick={() => setSelectedAgentId(agent.id)}
                        className="hover:bg-secondary/30 cursor-pointer transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <AgentAvatar
                              name={agent.name}
                              roleTitle={role?.title}
                              departmentName={dept?.name}
                              avatarUrl={agent.identity?.avatar_url as string | undefined}
                              status={agent.status}
                              size="sm"
                              showStatus={false}
                            />
                            <div>
                              <p className="font-semibold text-foreground">{agent.name}</p>
                              <p className="text-[10px] text-muted-foreground font-mono">{agent.id.slice(0, 8)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-medium text-foreground">{role?.title || 'Employee'}</p>
                          <p className="text-[11px] text-muted-foreground">{dept?.name || 'Unassigned'}</p>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 font-mono text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_BG[agent.status]} ${STATUS_COLORS[agent.status]}`}>
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            {agent.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px]">
                          {agent.autonomy}
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px]">
                          {(() => {
                            const info = getAgentIntelligenceLabel(agent, role?.title);
                            return (
                              <span className="flex items-center gap-1.5 text-foreground">
                                <RotateCw className="h-3 w-3 text-cyan-500 shrink-0" />
                                <span className="font-semibold text-cyan-500">{info.tier}</span>
                                <span className="text-muted-foreground text-[10px]">({info.isRotated ? info.modelText : 'Adaptive'})</span>
                              </span>
                            );
                          })()}
                        </td>
                        <td className="py-3 px-4 font-mono">
                          ${((agent.resource_usage as { total_cost_usd?: number })?.total_cost_usd ?? 0).toFixed(4)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => pauseResumeMutation.mutate({ agentId: agent.id, currentStatus: agent.status })}
                              disabled={pauseResumeMutation.isPending && pauseResumeMutation.variables?.agentId === agent.id}
                              className="btn btn-ghost h-7 px-2 text-[11px] font-mono"
                              title={agent.status === 'PAUSED' ? 'Resume agent' : 'Pause agent'}
                            >
                              {pauseResumeMutation.isPending && pauseResumeMutation.variables?.agentId === agent.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : agent.status === 'PAUSED' ? (
                                'Resume'
                              ) : (
                                'Pause'
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDirectiveAgent(agent);
                                setDirectiveObjective('');
                                setDirectiveTaskId(`adhoc-dir-${agent.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString().slice(-4)}`);
                                setDirectiveResult(null);
                                setDirectiveError(null);
                              }}
                              className="btn btn-outline h-7 px-2 text-[11px] font-mono text-primary gap-1"
                            >
                              <Terminal className="h-3 w-3" />
                              <span>Directive</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedAgentId(agent.id)}
                              className="btn btn-ghost h-7 px-2 text-xs text-muted-foreground"
                            >
                              Inspect
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ORG HIERARCHY TREE VIEW (Stage 6) */}
          {filtered.length > 0 && viewLayout === 'tree' && (
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <Network className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold text-foreground">
                    Org Reporting Hierarchy
                  </h2>
                </div>
                <span className="text-xs font-mono text-muted-foreground">
                  {filtered.length} Specialists
                </span>
              </div>

              <div className="space-y-4">
                {filtered
                  .filter((a) => !a.manager_agent_id || !filtered.some((m) => m.id === a.manager_agent_id))
                  .map((rootAgent) => {
                    const directReports = filtered.filter((a) => a.manager_agent_id === rootAgent.id);
                    const rootRole = roles.find((r) => r.id === rootAgent.role_id);
                    const rootDept = departments.find((d) => d.id === rootAgent.department_id);
                    const rootInt = (rootAgent.intelligence_config || {}) as { provider?: string; model?: string };

                    return (
                      <div key={rootAgent.id} className="space-y-3">
                        <div
                          onClick={() => setSelectedAgentId(rootAgent.id)}
                          className="flex items-center justify-between rounded-xl border border-primary/40 bg-primary/5 p-4 cursor-pointer hover:border-primary transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <AgentAvatar
                              name={rootAgent.name}
                              roleTitle={rootRole?.title}
                              departmentName={rootDept?.name}
                              avatarUrl={rootAgent.identity?.avatar_url as string | undefined}
                              status={rootAgent.status}
                              size="sm"
                            />
                            <div>
                              <p className="text-sm font-bold text-foreground">{rootAgent.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {rootRole?.title || 'Executive Lead'} • {rootDept?.name || 'Engineering'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-xs font-mono">
                            {(() => {
                              const info = getAgentIntelligenceLabel(rootAgent, rootRole?.title);
                              return (
                                <span className="px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center gap-1 text-[11px]">
                                  <RotateCw className="h-2.5 w-2.5 shrink-0" />
                                  {info.tier}
                                </span>
                              );
                            })()}
                            <span className={`px-2 py-0.5 rounded-full font-bold ${STATUS_BG[rootAgent.status]} ${STATUS_COLORS[rootAgent.status]}`}>
                              {rootAgent.status}
                            </span>
                          </div>
                        </div>

                        {directReports.length > 0 && (
                          <div className="pl-6 border-l-2 border-border ml-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {directReports.map((sub) => {
                              const subRole = roles.find((r) => r.id === sub.role_id);
                              const subDept = departments.find((d) => d.id === sub.department_id);
                              const subInt = (sub.intelligence_config || {}) as { provider?: string; model?: string };
                              return (
                                <div
                                  key={sub.id}
                                  onClick={() => setSelectedAgentId(sub.id)}
                                  className="rounded-lg border border-border bg-secondary/20 p-3 cursor-pointer hover:border-primary/40 transition-colors space-y-1.5"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <AgentAvatar
                                        name={sub.name}
                                        roleTitle={subRole?.title}
                                        departmentName={subDept?.name}
                                        avatarUrl={sub.identity?.avatar_url as string | undefined}
                                        status={sub.status}
                                        size="xs"
                                        showStatus={false}
                                      />
                                      <span className="text-xs font-semibold text-foreground truncate">{sub.name}</span>
                                    </div>
                                    <span className={`text-[10px] font-mono font-bold shrink-0 ${STATUS_COLORS[sub.status]}`}>
                                      {sub.status}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-muted-foreground truncate">
                                    {subRole?.title || 'Specialist'} • {subDept?.name || 'Engineering'}
                                  </p>
                                  <p className="text-[10px] font-mono text-cyan-400 truncate flex items-center gap-1">
                                    <RotateCw className="h-2.5 w-2.5 shrink-0" />
                                    {getAgentIntelligenceLabel(sub, subRole?.title).tier}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </>
      )}

      {/* 5. EXTERNAL AUTONOMOUS AGENTS COCKPIT */}
      {activeDirectoryTab === 'external' && (
        <div className="space-y-6 animate-fade-in">
          {/* External Fleet Overview */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {externalAgents.map((ext) => {
              const isSelected = selectedExternalAgentId === ext.id;
              return (
                <div
                  key={ext.id}
                  onClick={() => setSelectedExternalAgentId(ext.id)}
                  className={`group relative flex flex-col justify-between rounded-2xl border p-5 transition-all cursor-pointer ${
                    isSelected
                      ? 'border-primary bg-primary/5 shadow-md shadow-primary/10'
                      : 'border-border bg-card hover:border-border/80 hover:bg-card/80'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-secondary text-secondary-foreground border border-border">
                        {ext.vendor}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExternalMutation.mutate({
                            agentId: ext.id,
                            isActive: !ext.is_active,
                          });
                        }}
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full border transition-colors ${
                          ext.is_active
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                        }`}
                      >
                        {ext.is_active ? 'ACTIVE' : 'DISABLED'}
                      </button>
                    </div>

                    <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
                      {ext.name}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {ext.description}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-1">
                      {ext.capabilities.map((cap) => (
                        <span
                          key={cap}
                          className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary/60 text-muted-foreground border border-border/50"
                        >
                          {cap}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                    <span>{ext.default_model}</span>
                    <span className="text-primary font-semibold">Select Agent →</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Interactive Mission Dispatch Console */}
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-5 rounded-2xl border border-border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <Play className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-bold text-foreground">Mission Dispatch Console</h3>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                  Target: {selectedExternalAgentId}
                </span>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">
                    Select External Autonomous Agent
                  </label>
                  <select
                    value={selectedExternalAgentId}
                    onChange={(e) => setSelectedExternalAgentId(e.target.value)}
                    className="input text-xs"
                  >
                    {externalAgents.map((ext) => (
                      <option key={ext.id} value={ext.id}>
                        {ext.name} ({ext.vendor})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">
                    Mission / Task Title
                  </label>
                  <input
                    type="text"
                    value={extTaskTitle}
                    onChange={(e) => setExtTaskTitle(e.target.value)}
                    className="input text-xs"
                    placeholder="e.g. Audit authentication security tokens"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">
                    Mission Directives & Instructions
                  </label>
                  <textarea
                    rows={4}
                    value={extTaskInstructions}
                    onChange={(e) => setExtTaskInstructions(e.target.value)}
                    className="input text-xs resize-none"
                    placeholder="Provide specific guidelines, constraints, and success criteria for the autonomous external agent..."
                  />
                </div>

                <button
                  type="button"
                  disabled={dispatchExternalMutation.isPending || !extTaskTitle.trim()}
                  onClick={() => dispatchExternalMutation.mutate()}
                  className="btn btn-primary w-full gap-2 text-xs py-2.5"
                >
                  {dispatchExternalMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Dispatching to {selectedExternalAgentId}...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      Dispatch External Mission
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Execution Telemetry Stream */}
            <div className="lg:col-span-7 rounded-2xl border border-border bg-card p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-emerald-400" />
                    <h3 className="text-sm font-bold text-foreground">External Execution Telemetry</h3>
                  </div>
                  {extResult && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      STATUS: {extResult.status} • {extResult.duration_ms.toFixed(1)}ms
                    </span>
                  )}
                </div>

                {!extResult ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                    <Network className="h-8 w-8 mb-2 opacity-50" />
                    <p className="text-xs">No active execution dispatch.</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Select an external agent and trigger a mission to stream execution telemetry.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Execution Meta */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] font-mono">
                      <div className="p-2 rounded-lg bg-secondary/40 border border-border">
                        <span className="text-muted-foreground block text-[9px]">EXECUTION ID</span>
                        <span className="text-foreground">{extResult.execution_id.slice(0, 16)}...</span>
                      </div>
                      <div className="p-2 rounded-lg bg-secondary/40 border border-border">
                        <span className="text-muted-foreground block text-[9px]">AGENT</span>
                        <span className="text-foreground">{extResult.agent_name}</span>
                      </div>
                      <div className="p-2 rounded-lg bg-secondary/40 border border-border">
                        <span className="text-muted-foreground block text-[9px]">TOKENS CONSUMED</span>
                        <span className="text-emerald-400">{extResult.tokens_consumed} TOKENS</span>
                      </div>
                    </div>

                    {/* Intermediate Steps */}
                    <div>
                      <h4 className="text-[11px] font-mono font-semibold text-muted-foreground uppercase mb-1.5">
                        Execution Steps ({extResult.intermediate_steps.length})
                      </h4>
                      <div className="space-y-1.5">
                        {extResult.intermediate_steps.map((st, idx) => (
                          <div
                            key={idx}
                            className="p-2 rounded-lg bg-secondary/30 border border-border/80 flex items-start gap-2 text-xs"
                          >
                            <span className="text-[10px] font-mono font-bold text-primary mt-0.5">
                              #{(st.step as number) || idx + 1}
                            </span>
                            <div className="flex-1">
                              <span className="font-semibold text-foreground">
                                {String(st.action || 'Execute Action')}
                              </span>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                {String(st.detail || st.details || JSON.stringify(st))}
                              </p>
                            </div>
                            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                              {String(st.status || 'OK')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Output Payload */}
                    <div>
                      <h4 className="text-[11px] font-mono font-semibold text-muted-foreground uppercase mb-1.5">
                        Output Summary
                      </h4>
                      <pre className="p-3 rounded-lg bg-black/40 border border-border text-[11px] font-mono text-foreground overflow-x-auto whitespace-pre-wrap">
                        {extResult.output_result}
                      </pre>
                    </div>

                    {/* Artifacts Created */}
                    {extResult.artifacts_created.length > 0 && (
                      <div>
                        <h4 className="text-[11px] font-mono font-semibold text-muted-foreground uppercase mb-1.5">
                          Generated Artifacts
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {extResult.artifacts_created.map((art) => (
                            <span
                              key={art}
                              className="text-[11px] font-mono px-2 py-1 rounded bg-secondary text-primary border border-border flex items-center gap-1.5"
                            >
                              <FileCode2 className="h-3.5 w-3.5" />
                              {art}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. AGENT PROFILE & OPERATIONS DRAWER */}
      {selectedAgentId && companyId && (
        <AgentProfileDrawer
          companyId={companyId}
          agentId={selectedAgentId}
          allAgents={agents.map((a) => ({ id: a.id, name: a.name }))}
          departments={departments.map((d) => ({ id: d.id, name: d.name }))}
          roles={roles.map((r) => ({ id: r.id, title: r.title }))}
          onClose={() => setSelectedAgentId(null)}
        />
      )}

      {/* DIRECT DIRECTIVE DISPATCH MODAL */}
      {directiveAgent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-label={`Direct Directive to ${directiveAgent.name}`}
          onClick={() => setDirectiveAgent(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <AgentAvatar name={directiveAgent.name} size="sm" />
                <div>
                  <h3 className="font-semibold text-foreground font-mono text-sm">
                    Direct Directive: {directiveAgent.name}
                  </h3>
                  <p className="text-[11px] text-muted-foreground font-mono">
                    Dispatch an ad-hoc operational instruction via autonomous execution engine.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDirectiveAgent(null)}
                className="text-muted-foreground hover:text-foreground p-1 text-sm font-mono"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-mono text-muted-foreground block mb-1">
                  Task Execution Identifier
                </label>
                <input
                  type="text"
                  placeholder={`adhoc-dir-${directiveAgent.id.slice(0, 8)}`}
                  value={directiveTaskId}
                  onChange={(e) => setDirectiveTaskId(e.target.value)}
                  className="input input-sm w-full font-mono text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-mono text-muted-foreground block mb-1">
                  Objective / Directive Prompt <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows={4}
                  placeholder="e.g. Audit all API endpoints in auth service and report unvalidated query parameters..."
                  value={directiveObjective}
                  onChange={(e) => setDirectiveObjective(e.target.value)}
                  className="textarea w-full font-mono text-xs"
                />
              </div>

              {directiveError && (
                <div className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-400 text-xs font-mono">
                  {directiveError}
                </div>
              )}

              {directiveResult && (
                <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs font-mono space-y-1">
                  <div className="font-bold">Execution Status: {directiveResult.status}</div>
                  <div>Tokens: {directiveResult.tokens_consumed ?? 0} | Cost: ${(directiveResult.cost_usd ?? 0).toFixed(4)}</div>
                  {directiveResult.output_data && (
                    <pre className="mt-2 text-[10px] bg-black/40 p-2 rounded max-h-32 overflow-y-auto">
                      {JSON.stringify(directiveResult.output_data, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setDirectiveAgent(null)}
                className="btn btn-ghost btn-sm text-xs"
              >
                Close
              </button>
              <button
                type="button"
                disabled={!directiveObjective.trim() || executeDirectiveMutation.isPending}
                onClick={() => executeDirectiveMutation.mutate()}
                className="btn btn-primary btn-sm text-xs gap-1.5"
              >
                {executeDirectiveMutation.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Executing…
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" />
                    Dispatch Directive
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. DUAL-MODE AGENT CREATION MODAL */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-agent-title"
        >
          <div className="w-full max-w-xl glass rounded-2xl p-6 ring-1 ring-border shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header & Mode Switcher */}
            <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
              <div>
                <h2 id="create-agent-title" className="text-lg font-bold text-foreground">
                  Create Autonomous Agent
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Configure identity, role, mission, and operational guardrails
                </p>
              </div>

              {/* Mode Toggle Buttons */}
              <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
                <button
                  type="button"
                  onClick={() => setCreateMode('simple')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                    createMode === 'simple'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Simple Mode
                </button>
                <button
                  type="button"
                  onClick={() => setCreateMode('advanced')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                    createMode === 'advanced'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Advanced Mode
                </button>
              </div>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              {/* Name */}
              <div>
                <label htmlFor="agent-name" className="mb-1 block text-xs font-medium text-foreground">
                  Agent Identity Name <span className="text-rose-400">*</span>
                </label>
                <input
                  id="agent-name"
                  type="text"
                  className="input text-xs"
                  placeholder="e.g. Lead Architecture Steward"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>

              {/* SIMPLE MODE FIELDS: role, mission, autonomy, preferred intelligence */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="agent-role" className="mb-1 block text-xs font-medium text-foreground">
                    Organizational Role
                  </label>
                  <select
                    id="agent-role"
                    className="input text-xs"
                    value={form.role_id}
                    onChange={(e) => setForm((f) => ({ ...f, role_id: e.target.value }))}
                  >
                    <option value="">Select organizational role…</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="agent-autonomy" className="mb-1 block text-xs font-medium text-foreground">
                    Autonomy Level
                  </label>
                  <select
                    id="agent-autonomy"
                    className="input text-xs font-mono"
                    value={form.autonomy}
                    onChange={(e) => setForm((f) => ({ ...f, autonomy: e.target.value }))}
                  >
                    <option value="SUPERVISED">SUPERVISED — All actions reviewed</option>
                    <option value="SEMI_AUTONOMOUS">SEMI_AUTONOMOUS — Routine tasks automated</option>
                    <option value="AUTONOMOUS">AUTONOMOUS — Autonomous within policy</option>
                    <option value="FULLY_AUTONOMOUS">FULLY_AUTONOMOUS — Adaptive goal pursuit</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="agent-mission" className="mb-1 block text-xs font-medium text-foreground">
                  Current Mission & Objectives
                </label>
                <textarea
                  id="agent-mission"
                  rows={2}
                  className="input text-xs resize-none"
                  placeholder="e.g. Ensure high system availability and coordinate automated microservice deployments"
                  value={form.mission}
                  onChange={(e) => setForm((f) => ({ ...f, mission: e.target.value }))}
                />
              </div>

              {/* Preferred Intelligence Selection */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">
                  Preferred Intelligence Mesh
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'anthropic', label: 'Claude', model: 'claude-sonnet' },
                    { id: 'google', label: 'Gemini', model: 'gemini-2.5-pro' },
                    { id: 'openai', label: 'OpenAI', model: 'gpt-4o' },
                    { id: 'local', label: 'Local', model: 'qwen3-8b' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() =>
                        setForm((f) => ({ ...f, preferred_intelligence: p.id, model: p.model }))
                      }
                      className={`p-2.5 rounded-xl border text-center transition-all ${
                        form.preferred_intelligence === p.id
                          ? 'border-primary bg-primary/10 font-bold shadow-sm'
                          : 'border-border/60 bg-secondary/30 hover:border-border'
                      }`}
                    >
                      <span className="text-xs text-foreground block">{p.label}</span>
                      <span className="text-[10px] font-mono text-muted-foreground block mt-0.5">
                        {p.model}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ADVANCED MODE FIELDS: system instructions, tools, permissions, routing, resource limits, memory scope, escalation rules, evaluation settings */}
              {createMode === 'advanced' && (
                <div className="space-y-4 pt-3 border-t border-border animate-fade-in">
                  <span className="text-[11px] font-mono font-bold tracking-wider text-primary uppercase block">
                    Advanced Operational Controls
                  </span>

                  <div>
                    <label htmlFor="agent-instructions" className="mb-1 block text-xs font-medium text-foreground">
                      System Instructions & Constraints
                    </label>
                    <textarea
                      id="agent-instructions"
                      rows={3}
                      className="input text-xs font-mono resize-none leading-relaxed"
                      placeholder="You are an autonomous engineering steward. Follow security policies, maintain traceability..."
                      value={form.system_instructions}
                      onChange={(e) => setForm((f) => ({ ...f, system_instructions: e.target.value }))}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-foreground">
                        Department Assignment
                      </label>
                      <select
                        className="input text-xs"
                        value={form.department_id}
                        onChange={(e) => setForm((f) => ({ ...f, department_id: e.target.value }))}
                      >
                        <option value="">Select department…</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-foreground">
                        Reporting Manager
                      </label>
                      <select
                        className="input text-xs"
                        value={form.manager_agent_id}
                        onChange={(e) => setForm((f) => ({ ...f, manager_agent_id: e.target.value }))}
                      >
                        <option value="">Executive Direct (No manager)</option>
                        {agents.map((ag) => (
                          <option key={ag.id} value={ag.id}>
                            {ag.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-foreground">
                        Daily Budget (USD)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={form.daily_budget_usd}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, daily_budget_usd: Number(e.target.value) }))
                        }
                        className="input text-xs font-mono"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-foreground">
                        Max Tokens / Call
                      </label>
                      <input
                        type="number"
                        min="1024"
                        value={form.max_tokens_per_call}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, max_tokens_per_call: Number(e.target.value) }))
                        }
                        className="input text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-foreground">
                        Memory Scope
                      </label>
                      <select
                        className="input text-xs font-mono"
                        value={form.memory_scope}
                        onChange={(e) => setForm((f) => ({ ...f, memory_scope: e.target.value }))}
                      >
                        <option value="company">Enterprise</option>
                        <option value="department">Department</option>
                        <option value="agent">Agent Private</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-foreground">
                        Escalation Target
                      </label>
                      <select
                        className="input text-xs font-mono"
                        value={form.escalation_rule}
                        onChange={(e) => setForm((f) => ({ ...f, escalation_rule: e.target.value }))}
                      >
                        <option value="SUPERVISOR_REVIEW">Manager</option>
                        <option value="HUMAN_APPROVAL">Human Review</option>
                        <option value="FAIL_FAST">Fail Fast</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-foreground">
                        Evaluation Setting
                      </label>
                      <select
                        className="input text-xs font-mono"
                        value={form.evaluation_setting}
                        onChange={(e) => setForm((f) => ({ ...f, evaluation_setting: e.target.value }))}
                      >
                        <option value="AUTOMATED_BENCHMARK">Standard</option>
                        <option value="SAMPLING_AUDIT">10% Sample</option>
                        <option value="STRICT_SAFETY">Strict Safety</option>
                      </select>
                    </div>
                  </div>

                  {/* Capabilities Builder */}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-foreground">
                      Capabilities Whitelist
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="input flex-1 text-xs"
                        placeholder="e.g. data_synthesis, code_review"
                        value={capInput}
                        onChange={(e) => setCapInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addCapability();
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-outline shrink-0 text-xs"
                        onClick={addCapability}
                      >
                        Add
                      </button>
                    </div>
                    {form.capabilities.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {form.capabilities.map((cap) => (
                          <button
                            key={cap}
                            type="button"
                            className="flex items-center gap-1 rounded-md bg-primary/10 border border-primary/20 px-2 py-0.5 text-xs text-primary hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
                            onClick={() => removeCapability(cap)}
                            title="Click to remove"
                          >
                            {cap} ×
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {formError && (
                <div className="flex items-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-400" role="alert">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {formError}
                </div>
              )}

              <div className="flex gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  className="btn btn-outline flex-1 text-xs"
                  onClick={() => {
                    setShowCreate(false);
                    setFormError(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  id="create-agent-submit"
                  type="submit"
                  className="btn btn-primary flex-1 text-xs"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating Employee…
                    </>
                  ) : (
                    'Create Agent'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

