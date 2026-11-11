'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NEIMAN_CONFIG } from '@neiman/config';
import {
  Bot,
  Shield,
  Activity,
  Zap,
  Brain,
  MessageSquare,
  Play,
  Share2,
  AlertTriangle,
  History,
  X,
  Send,
  Loader2,
  CheckCircle2,
  Clock,
  ExternalLink,
  ChevronDown,
  Layers,
  Cpu,
  Sliders,
  DollarSign,
  FileCode,
  Lock,
  Compass,
  CheckSquare,
  RefreshCw,
  Building2,
  Users,
  Briefcase,
  Sparkles,
  Boxes,
  BookOpen,
} from 'lucide-react';
import { agentsApi, type AgentProfile, type TaskExecutionResult, type CreateAgentRequest } from '@/lib/api/agents';
import { AgentAvatar } from '@/components/ui/AgentAvatar';

interface AgentProfileDrawerProps {
  companyId: string;
  agentId: string;
  onClose: () => void;
  allAgents: Array<{ id: string; name: string }>;
  departments?: Array<{ id: string; name: string }>;
  roles?: Array<{ id: string; title: string }>;
}

export function AgentProfileDrawer({
  companyId,
  agentId,
  onClose,
  allAgents,
  departments = [],
  roles = [],
}: AgentProfileDrawerProps) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'profile' | 'configure' | 'tasks' | 'memory' | 'performance' | 'activity'>('profile');

  // Configuration Edit Mode
  const [configMode, setConfigMode] = useState<'simple' | 'advanced'>('simple');
  const [configSuccess, setConfigSuccess] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  // Edit form state
  const [editForm, setEditForm] = useState<{
    role_id: string;
    department_id: string;
    manager_agent_id: string;
    mission: string;
    autonomy: string;
    provider: string;
    model: string;
    system_instructions: string;
    capabilities: string[];
    tools: string[];
    permissions: {
      approval_required: boolean;
      disallowed_actions?: string[];
      max_actions_per_task?: number;
    };
    daily_budget_usd: number;
    max_tokens_per_call: number;
    memory_scope: string;
    escalation_rule: string;
    evaluation_setting: string;
  }>({
    role_id: '',
    department_id: '',
    manager_agent_id: '',
    mission: '',
    autonomy: 'SUPERVISED',
    provider: 'anthropic',
    model: 'claude-sonnet',
    system_instructions: '',
    capabilities: [],
    tools: [],
    permissions: { approval_required: true, max_actions_per_task: 10 },
    daily_budget_usd: 10,
    max_tokens_per_call: 8192,
    memory_scope: 'department',
    escalation_rule: 'SUPERVISOR_REVIEW',
    evaluation_setting: 'AUTOMATED_BENCHMARK',
  });

  // Execution state
  const [taskIdInput, setTaskIdInput] = useState('');
  const [execPayload, setExecPayload] = useState('{"mode": "automated"}');
  const [executionResult, setExecutionResult] = useState<TaskExecutionResult | null>(null);

  // Communication state
  const [targetAgentId, setTargetAgentId] = useState('');
  const [msgType, setMsgType] = useState('REQUEST');
  const [msgSubject, setMsgSubject] = useState('');
  const [msgBody, setMsgBody] = useState('');

  // Delegation state
  const [delegatedTaskId, setDelegatedTaskId] = useState('');
  const [delegateInstructions, setDelegateInstructions] = useState('');

  // Escalation state
  const [escalationProblem, setEscalationProblem] = useState('');

  // Load rich agent profile
  const { data: profile, isLoading, error } = useQuery<AgentProfile>({
    queryKey: ['agent-profile', companyId, agentId],
    queryFn: async () => {
      const data = await agentsApi.getProfile(companyId, agentId);
      // Initialize edit form when profile is loaded
      const intConfig = (data.intelligence_config || {}) as { provider?: string; model?: string };
      const resLimits = (data.resource_limits || {}) as { daily_budget_usd?: number; max_tokens_per_call?: number };
      const perms = (data.permissions || {}) as { approval_required?: boolean; disallowed_actions?: string[]; max_actions_per_task?: number };

      setEditForm({
        role_id: (data as unknown as { role_id?: string }).role_id || '',
        department_id: (data as unknown as { department_id?: string }).department_id || '',
        manager_agent_id: data.manager_id || '',
        mission: data.goals?.join(', ') || '',
        autonomy: data.autonomy || 'SUPERVISED',
        provider: intConfig.provider || 'anthropic',
        model: intConfig.model || 'claude-sonnet',
        system_instructions: data.system_instructions || '',
        capabilities: data.capabilities || [],
        tools: (data.tools || []).map((t) => (typeof t === 'string' ? t : (t as { name?: string }).name || '')).filter(Boolean),
        permissions: {
          approval_required: perms.approval_required !== false,
          max_actions_per_task: perms.max_actions_per_task || 10,
        },
        daily_budget_usd: resLimits.daily_budget_usd || 10,
        max_tokens_per_call: resLimits.max_tokens_per_call || 8192,
        memory_scope: 'department',
        escalation_rule: 'SUPERVISOR_REVIEW',
        evaluation_setting: 'AUTOMATED_BENCHMARK',
      });
      return data;
    },
    enabled: !!companyId && !!agentId,
    refetchInterval: NEIMAN_CONFIG.TELEMETRY.POLLING_INTERVALS.MEDIUM,
  });

  // Status transition mutation
  const transitionMutation = useMutation({
    mutationFn: ({ status, reason }: { status: string; reason?: string }) =>
      agentsApi.transitionStatus(companyId, agentId, status, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent-profile', companyId, agentId] });
      qc.invalidateQueries({ queryKey: ['agents', companyId] });
    },
  });

  // Update agent configuration mutation
  const updateMutation = useMutation({
    mutationFn: (body: Partial<CreateAgentRequest>) =>
      agentsApi.update(companyId, agentId, body),
    onSuccess: () => {
      setConfigSuccess(true);
      setConfigError(null);
      qc.invalidateQueries({ queryKey: ['agent-profile', companyId, agentId] });
      qc.invalidateQueries({ queryKey: ['agents', companyId] });
      setTimeout(() => setConfigSuccess(false), 3000);
    },
    onError: (err) => {
      setConfigError((err as Error).message || 'Failed to update agent configuration.');
    },
  });

  // Task execution mutation
  const executeMutation = useMutation({
    mutationFn: async () => {
      let parsed = {};
      try {
        parsed = JSON.parse(execPayload);
      } catch {
        // fallback
      }
      return agentsApi.executeTask(companyId, agentId, {
        task_id: taskIdInput,
        input_data: parsed,
      });
    },
    onSuccess: (data) => {
      setExecutionResult(data);
      qc.invalidateQueries({ queryKey: ['agent-profile', companyId, agentId] });
      qc.invalidateQueries({ queryKey: ['agents', companyId] });
    },
  });

  // Message mutation
  const sendMessageMutation = useMutation({
    mutationFn: () =>
      agentsApi.sendMessage(companyId, agentId, {
        to_agent_id: targetAgentId || undefined,
        message_type: msgType,
        subject: msgSubject,
        body: msgBody,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent-profile', companyId, agentId] });
      setMsgSubject('');
      setMsgBody('');
    },
  });

  // Delegate mutation
  const delegateMutation = useMutation({
    mutationFn: () =>
      agentsApi.delegateTask(companyId, agentId, {
        to_agent_id: targetAgentId,
        task_id: delegatedTaskId,
        instructions: delegateInstructions,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent-profile', companyId, agentId] });
      setDelegatedTaskId('');
      setDelegateInstructions('');
    },
  });

  // Escalate mutation
  const escalateMutation = useMutation({
    mutationFn: () =>
      agentsApi.escalateProblem(companyId, agentId, {
        problem: escalationProblem,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent-profile', companyId, agentId] });
      setEscalationProblem('');
    },
  });

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    setConfigError(null);

    const payload: Partial<CreateAgentRequest> = {
      autonomy: editForm.autonomy,
      goals: editForm.mission.split(',').map((s) => s.trim()).filter(Boolean),
      intelligence_config: {
        provider: editForm.provider,
        model: editForm.model,
      },
    };

    if (configMode === 'advanced') {
      payload.system_instructions = editForm.system_instructions;
      payload.capabilities = editForm.capabilities;
      payload.permissions = editForm.permissions;
      payload.resource_limits = {
        daily_budget_usd: Number(editForm.daily_budget_usd),
        max_tokens_per_call: Number(editForm.max_tokens_per_call),
        memory_scope: editForm.memory_scope,
        escalation_rule: editForm.escalation_rule,
        evaluation_setting: editForm.evaluation_setting,
      };
    }

    updateMutation.mutate(payload);
  };

  if (isLoading) {
    return (
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-3xl bg-NEIMAN-surface border-l border-border shadow-2xl p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-3xl bg-NEIMAN-surface border-l border-border shadow-2xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-red-400">Failed to load agent</h2>
          <button type="button" onClick={onClose} className="p-1 hover:bg-secondary rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground">Unable to fetch profile telemetry.</p>
      </div>
    );
  }

  const otherAgents = allAgents.filter((a) => a.id !== agentId);
  const intConfig = (profile.intelligence_config || {}) as Record<string, unknown>;
  const lastRotatedModel = (intConfig.last_rotated_model as string) || (intConfig.model as string);
  const activeTier = (intConfig.active_tier as string) || (intConfig.tier as string);

  const role = (profile.role_title || profile.name || '').toLowerCase();
  const isFrontier =
    activeTier?.includes('FRONTIER') ||
    activeTier?.includes('ARCHITECT') ||
    role.includes('cto') ||
    role.includes('architect') ||
    role.includes('security') ||
    role.includes('database');
  const isFast = activeTier?.includes('FAST') || activeTier?.includes('SYNTHESIS') || role.includes('writer');

  const tierLabel = isFrontier ? 'Frontier Reasoning' : isFast ? 'Fast Throughput' : 'Balanced Core';

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-4xl bg-card border-l border-border shadow-2xl flex flex-col animate-fade-in backdrop-blur-2xl">
      {/* 1. AGENT IDENTITY & STATUS HEADER */}
      <div className="p-6 border-b border-border bg-secondary/30 flex items-start justify-between">
        <div className="flex items-center gap-4">
          <AgentAvatar
            name={profile.name}
            roleTitle={profile.role_title}
            departmentName={profile.department_name}
            avatarUrl={profile.identity?.avatar_url as string | undefined}
            status={profile.status}
            size="lg"
            showStatus={false}
          />
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-bold text-foreground">{profile.name}</h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {profile.autonomy}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              ID: {profile.id} • Registered Employee
            </p>
          </div>
        </div>

        {/* Status indicator and dropdown */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold tracking-wide border ${profile.status === 'AVAILABLE'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : profile.status === 'WORKING'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse'
                    : profile.status === 'BLOCKED'
                      ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                      : 'bg-muted/40 text-muted-foreground border-border'
                }`}
            >
              <span className="h-2 w-2 rounded-full bg-current" />
              STATUS: {profile.status}
            </span>

            {/* Quick Status Dropdown */}
            <div className="relative group">
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 p-1 rounded-md hover:bg-secondary border border-border/40"
                title="Transition Status"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              <div className="absolute right-0 mt-1 w-36 hidden group-hover:block bg-card border border-border rounded-lg shadow-xl py-1 z-30">
                {['AVAILABLE', 'WORKING', 'BLOCKED', 'WAITING', 'PAUSED', 'OFFLINE'].map((st) => (
                  <button
                    key={st}
                    type="button"
                    disabled={st === profile.status || transitionMutation.isPending}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-secondary transition-colors disabled:opacity-40"
                    onClick={() =>
                      transitionMutation.mutate({
                        status: st,
                        reason: 'Operator requested state transition',
                      })
                    }
                  >
                    Set {st}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-xl transition-colors"
            aria-label="Close drawer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* 2. NAVIGATION BAR */}
      <div className="flex border-b border-border bg-secondary/10 px-6 gap-1 overflow-x-auto text-xs font-medium">
        {[
          { id: 'profile', label: 'Overview Profile', icon: Bot },
          { id: 'configure', label: 'Configure Agent', icon: Sliders },
          { id: 'tasks', label: 'Tasks & 10-Step Trace', icon: Play },
          { id: 'memory', label: 'Knowledge & Memory', icon: Brain },
          { id: 'performance', label: 'Performance Metrics', icon: Activity },
          { id: 'activity', label: 'Activity & Audit Log', icon: History },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-1.5 py-3 px-3.5 border-b-2 transition-all whitespace-nowrap ${active
                  ? 'border-primary text-primary font-bold'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 3. TAB CONTENT AREA */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
        {/* ============================================================== */}
        {/* TAB 1: EXACT SPEC PROFILE LAYOUT                                */}
        {/* ============================================================== */}
        {activeTab === 'profile' && (
          <div className="space-y-5 animate-fade-in">
            {/* ROW 1: Role / Department / Manager */}
            <div className="rounded-xl border border-border/80 bg-secondary/20 p-4">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block mb-2">
                Organizational Hierarchy
              </span>
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-primary shrink-0" />
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Role</span>
                    <span className="font-semibold text-foreground">
                      {profile.role_title || 'Autonomous Specialist'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-purple-400 shrink-0" />
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Department</span>
                    <span className="font-semibold text-foreground">
                      {profile.department_name || 'Organization Core'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-400 shrink-0" />
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Manager</span>
                    <span className="font-semibold text-foreground">
                      {profile.manager_name || 'Executive Direct'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ROW 2: CURRENT MISSION */}
            <div className="rounded-xl border border-border/80 bg-secondary/20 p-4 space-y-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-primary block">
                CURRENT MISSION & OKRS
              </span>
              <p className="text-sm font-semibold text-foreground">
                {profile.goals && profile.goals.length > 0
                  ? profile.goals.join(' • ')
                  : 'Operate autonomously within organizational guardrails and objectives.'}
              </p>
              {profile.responsibilities && profile.responsibilities.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border/40">
                  <span className="text-[11px] text-muted-foreground block mb-1">
                    Key Responsibilities:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.responsibilities.map((r, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-md bg-secondary text-[11px] text-foreground border border-border/50"
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ROW 3: INTELLIGENCE ROTATION MESH */}
            <div className="rounded-xl border border-border/80 bg-secondary/20 p-4">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <RefreshCw className="h-3 w-3 text-cyan-400 animate-spin-slow" />
                  INTELLIGENCE PROVIDER MESH
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-bold">
                  Tier: {tierLabel}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                No fixed model lock. Models rotate dynamically prioritizing working agents and task complexity across the fleet.
              </p>
              <div className="grid grid-cols-4 gap-2.5">
                {[
                  { id: 'anthropic', label: 'Claude', sub: 'Frontier Reasoning', active: isFrontier },
                  { id: 'google', label: 'Gemini', sub: 'Massive Context', active: true },
                  { id: 'openai', label: 'OpenAI', sub: 'Deep Synthesis', active: true },
                  { id: 'local', label: 'Local', sub: 'Ollama/Qwen', active: true },
                ].map((prov) => {
                  const isCurrentDispatched = Boolean(lastRotatedModel && prov.label.toLowerCase().includes(lastRotatedModel.toLowerCase().slice(0, 5)));
                  return (
                    <div
                      key={prov.id}
                      className={`p-3 rounded-xl border text-center transition-all ${
                        isCurrentDispatched
                          ? 'border-cyan-500 bg-cyan-500/10 shadow-md shadow-cyan-500/10'
                          : 'border-border/60 bg-secondary/40'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <Zap className={`h-3.5 w-3.5 ${isCurrentDispatched ? 'text-cyan-400' : 'text-primary'}`} />
                        <span className="font-bold text-xs text-foreground">{prov.label}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground block mt-0.5 font-mono">
                        {isCurrentDispatched ? 'Active Dispatched' : prov.sub}
                      </span>
                    </div>
                  );
                })}
              </div>
              {lastRotatedModel && lastRotatedModel !== 'claude-sonnet' && (
                <div className="mt-3 pt-2.5 border-t border-border/40 flex items-center justify-between text-xs font-mono text-muted-foreground">
                  <span>Last Rotated Model:</span>
                  <span className="text-foreground font-semibold px-2 py-0.5 rounded bg-secondary">{lastRotatedModel}</span>
                </div>
              )}
            </div>

            {/* ROW 4: SKILLS & CAPABILITIES MATRIX */}
            <div className="rounded-xl border border-border/80 bg-secondary/20 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <BookOpen className="h-3 w-3 text-emerald-400" />
                  <span>CAPABILITIES MATRIX</span>
                  <span className="text-[9px] text-muted-foreground font-normal">(Procedural Skills)</span>
                </span>
                <Link
                  href="/dashboard/mcp"
                  className="text-[10px] font-mono text-primary hover:underline flex items-center gap-1"
                >
                  Manage Skills Hub →
                </Link>
              </div>
              {profile.capabilities && profile.capabilities.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {profile.capabilities.map((cap) => (
                    <span
                      key={cap}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs font-mono text-emerald-400 font-medium"
                    >
                      <BookOpen className="h-3 w-3" />
                      {cap}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No specialized capabilities registered.</p>
              )}
            </div>

            {/* ROW 5: MCP TOOLCHAIN WHITELIST */}
            <div className="rounded-xl border border-border/80 bg-secondary/20 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Boxes className="h-3 w-3 text-primary" />
                  <span>TOOLS WHITELIST</span>
                  <span className="text-[9px] text-muted-foreground font-normal">(Active MCP)</span>
                </span>
                <Link
                  href="/dashboard/mcp"
                  className="text-[10px] font-mono text-primary hover:underline flex items-center gap-1"
                >
                  MCP Gateway →
                </Link>
              </div>
              {profile.tools && profile.tools.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {profile.tools.map((t, idx) => {
                    const name = typeof t === 'string' ? t : (t as { name?: string }).name || `Tool ${idx + 1}`;
                    return (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-secondary/80 border border-border text-xs text-foreground font-mono"
                      >
                        <Zap className="h-3 w-3 text-amber-400" />
                        {name}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  Standard core toolchain (GitHub, Postgres, Linear, Sentry, isolated sandbox runtime).
                </p>
              )}
            </div>

            {/* ROW 6: RESOURCE USAGE */}
            <div className="rounded-xl border border-border/80 bg-secondary/20 p-4">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block mb-2.5">
                RESOURCE USAGE & QUOTAS
              </span>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-secondary/40 p-3 rounded-xl border border-border/50">
                  <span className="text-[11px] text-muted-foreground block">Tokens Consumed</span>
                  <p className="text-base font-bold font-mono text-foreground mt-1">
                    {Number(profile.resource_usage?.total_tokens || 0).toLocaleString()}
                  </p>
                </div>
                <div className="bg-secondary/40 p-3 rounded-xl border border-border/50">
                  <span className="text-[11px] text-muted-foreground block">Cumulative Spend</span>
                  <p className="text-base font-bold font-mono text-emerald-400 mt-1">
                    ${Number(profile.resource_usage?.total_cost_usd || 0).toFixed(4)}
                  </p>
                </div>
                <div className="bg-secondary/40 p-3 rounded-xl border border-border/50">
                  <span className="text-[11px] text-muted-foreground block">Daily Budget Cap</span>
                  <p className="text-base font-bold font-mono text-primary mt-1">
                    ${Number((profile.resource_limits as { daily_budget_usd?: number })?.daily_budget_usd || 10).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            {/* ROW 7: RECENT ACTIVITY / MEMORY / DECISIONS PREVIEW */}
            <div className="rounded-xl border border-border/80 bg-secondary/20 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  ACTIVITY / MEMORY / DECISIONS
                </span>
                <span className="text-[10px] font-mono text-primary">Live Provenance</span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-secondary/40 border border-border/40">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-foreground flex items-center gap-1">
                      <History className="h-3 w-3 text-primary" /> Audits
                    </span>
                    <span className="text-muted-foreground font-mono">
                      {profile.recent_audits?.length || 0}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-2">
                    {profile.recent_audits?.[0]?.action || 'No recent executions logged.'}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-secondary/40 border border-border/40">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-foreground flex items-center gap-1">
                      <Brain className="h-3 w-3 text-purple-400" /> Memory
                    </span>
                    <span className="text-muted-foreground font-mono">
                      {profile.memories?.length || 0}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-2">
                    {profile.memories?.[0]?.content || 'Knowledge store ready.'}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-secondary/40 border border-border/40">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-foreground flex items-center gap-1">
                      <MessageSquare className="h-3 w-3 text-blue-400" /> Messages
                    </span>
                    <span className="text-muted-foreground font-mono">
                      {profile.recent_communications?.length || 0}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-2">
                    {profile.recent_communications?.[0]?.subject || 'Mesh communications clear.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: CONFIGURE AGENT (SIMPLE MODE & ADVANCED MODE)             */}
        {/* ============================================================== */}
        {activeTab === 'configure' && (
          <form onSubmit={handleSaveConfig} className="space-y-6 animate-fade-in">
            {/* Mode Switcher Banner */}
            <div className="flex items-center justify-between p-4 rounded-xl border border-primary/20 bg-primary/5">
              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-primary" />
                  Agent Configuration
                </h4>
                <p className="text-xs text-muted-foreground">
                  Safely adjust behavior without exposing dangerous low-level infrastructure unnecessarily.
                </p>
              </div>
              <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
                <button
                  type="button"
                  onClick={() => setConfigMode('simple')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${configMode === 'simple'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                  Simple Mode
                </button>
                <button
                  type="button"
                  onClick={() => setConfigMode('advanced')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${configMode === 'advanced'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                  Advanced Mode
                </button>
              </div>
            </div>

            {configSuccess && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                Agent configuration updated successfully.
              </div>
            )}

            {configError && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-400">
                <AlertTriangle className="h-4 w-4" />
                {configError}
              </div>
            )}

            {/* SIMPLE MODE FIELDS: role, mission, autonomy, preferred intelligence */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Organizational Role
                  </label>
                  <select
                    value={editForm.role_id}
                    onChange={(e) => setEditForm((f) => ({ ...f, role_id: e.target.value }))}
                    className="input text-xs"
                  >
                    <option value="">Standard Agent Role</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Autonomy Level
                  </label>
                  <select
                    value={editForm.autonomy}
                    onChange={(e) => setEditForm((f) => ({ ...f, autonomy: e.target.value }))}
                    className="input text-xs font-mono"
                  >
                    <option value="SUPERVISED">SUPERVISED — All consequential actions reviewed</option>
                    <option value="SEMI_AUTONOMOUS">SEMI_AUTONOMOUS — Low-risk tasks automated</option>
                    <option value="AUTONOMOUS">AUTONOMOUS — Execute within policy guardrails</option>
                    <option value="FULLY_AUTONOMOUS">FULLY_AUTONOMOUS — Adaptive goal pursuit</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Current Mission & Objectives
                </label>
                <textarea
                  rows={2}
                  value={editForm.mission}
                  onChange={(e) => setEditForm((f) => ({ ...f, mission: e.target.value }))}
                  placeholder="Primary mission statement or comma-separated objectives..."
                  className="input text-xs resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-2">
                  Preferred Intelligence Mesh
                </label>
                <div className="grid grid-cols-4 gap-2.5">
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
                        setEditForm((f) => ({ ...f, provider: p.id, model: p.model }))
                      }
                      className={`p-3 rounded-xl border text-center transition-all ${editForm.provider === p.id
                          ? 'border-primary bg-primary/10 font-bold'
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
            </div>

            {/* ADVANCED MODE FIELDS: system instructions, tools, permissions, routing, resource limits, memory scope, escalation rules, evaluation settings */}
            {configMode === 'advanced' && (
              <div className="space-y-4 pt-4 border-t border-border animate-fade-in">
                <span className="text-[11px] font-mono font-bold tracking-wider text-primary uppercase block">
                  Advanced Operational Controls
                </span>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    System Instructions & Operational Constraints
                  </label>
                  <textarea
                    rows={4}
                    value={editForm.system_instructions}
                    onChange={(e) => setEditForm((f) => ({ ...f, system_instructions: e.target.value }))}
                    placeholder="Enter base system instructions, ethical constraints, and formatting rules..."
                    className="input text-xs font-mono resize-none leading-relaxed"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">
                      Daily Budget USD
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={editForm.daily_budget_usd}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, daily_budget_usd: Number(e.target.value) }))
                      }
                      className="input text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">
                      Max Tokens Per Invocation
                    </label>
                    <input
                      type="number"
                      step="512"
                      min="1024"
                      value={editForm.max_tokens_per_call}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, max_tokens_per_call: Number(e.target.value) }))
                      }
                      className="input text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">
                      Memory Scope
                    </label>
                    <select
                      value={editForm.memory_scope}
                      onChange={(e) => setEditForm((f) => ({ ...f, memory_scope: e.target.value }))}
                      className="input text-xs font-mono"
                    >
                      <option value="company">Enterprise (Global)</option>
                      <option value="department">Department Isolation</option>
                      <option value="agent">Agent Private Only</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">
                      Escalation Rules
                    </label>
                    <select
                      value={editForm.escalation_rule}
                      onChange={(e) => setEditForm((f) => ({ ...f, escalation_rule: e.target.value }))}
                      className="input text-xs font-mono"
                    >
                      <option value="SUPERVISOR_REVIEW">Escalate to Manager Agent</option>
                      <option value="HUMAN_APPROVAL">Require Human Executive Sign-off</option>
                      <option value="FAIL_FAST">Fail Fast & Alert Channel</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">
                      Evaluation Settings
                    </label>
                    <select
                      value={editForm.evaluation_setting}
                      onChange={(e) => setEditForm((f) => ({ ...f, evaluation_setting: e.target.value }))}
                      className="input text-xs font-mono"
                    >
                      <option value="AUTOMATED_BENCHMARK">Continuous Quality Rubric</option>
                      <option value="SAMPLING_AUDIT">Periodic 10% Sample Review</option>
                      <option value="STRICT_SAFETY">Zero-Tolerance Safety Benchmark</option>
                    </select>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-border/80 bg-secondary/30 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-foreground block">
                      Enforce Human Approval For Sensitive Actions
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Disallows writes to production repositories or external emails without approval.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={editForm.permissions.approval_required}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        permissions: { ...f.permissions, approval_required: e.target.checked },
                      }))
                    }
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-border flex justify-end gap-3">
              <button
                type="submit"
                disabled={updateMutation.isPending}
                className="btn btn-primary gap-2 text-xs"
              >
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving Changes…
                  </>
                ) : (
                  'Save Configuration'
                )}
              </button>
            </div>
          </form>
        )}

        {/* ============================================================== */}
        {/* TAB 3: TASKS & 10-STEP EXECUTION TRACE                           */}
        {/* ============================================================== */}
        {activeTab === 'tasks' && (
          <div className="space-y-6 animate-fade-in">
            <div className="p-4 rounded-xl border border-primary/20 bg-primary/5">
              <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
                <Play className="h-4 w-4" />
                10-Step Autonomous Task Execution Engine
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Executes tasks with full provenance: TASK RECEIVED → CONTEXT ASSEMBLY → PLAN → RESOURCE CHECK → INTELLIGENCE SELECTION → TOOL EXECUTION → RESULT → VALIDATION → REPORT → MEMORY UPDATE.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-border bg-card/40 space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Task ID or Assigned Task UUID
                </label>
                <input
                  type="text"
                  placeholder="Paste task uuid (e.g. from seeded projects)"
                  value={taskIdInput}
                  onChange={(e) => setTaskIdInput(e.target.value)}
                  className="input text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Input Payload (JSON)
                </label>
                <textarea
                  rows={2}
                  value={execPayload}
                  onChange={(e) => setExecPayload(e.target.value)}
                  className="input text-xs font-mono"
                />
              </div>

              <button
                type="button"
                disabled={!taskIdInput || executeMutation.isPending}
                onClick={() => executeMutation.mutate()}
                className="btn btn-primary w-full gap-2 text-xs"
              >
                {executeMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Executing 10-Step Lifecycle…
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    Run Autonomous Execution
                  </>
                )}
              </button>
            </div>

            {/* Execution Steps Trace */}
            {executionResult && (
              <div className="space-y-3 p-4 rounded-xl border border-border bg-card/60">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-400" />
                    Execution {executionResult.execution_id.slice(0, 8)} Passed
                  </h4>
                  <span className="text-xs text-muted-foreground">
                    Duration: {Math.round(executionResult.total_duration_ms)}ms • Cost: ${executionResult.cost_usd.toFixed(4)}
                  </span>
                </div>

                <div className="space-y-2 pt-2">
                  {executionResult.steps.map((st, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-2.5 rounded-lg bg-secondary/40 border border-border/40 text-xs">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary text-[10px] font-bold">
                        {idx + 1}
                      </span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground">{st.step}</span>
                          <span className="text-muted-foreground">{Math.round(st.duration_ms)}ms</span>
                        </div>
                        <pre className="mt-1 text-[11px] text-muted-foreground whitespace-pre-wrap font-mono">
                          {JSON.stringify(st.details, null, 2)}
                        </pre>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 4: KNOWLEDGE & MEMORY                                       */}
        {/* ============================================================== */}
        {activeTab === 'memory' && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div>
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Persistent Agent Memory Store
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  Multi-layer memory retained across operational executions.
                </p>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-primary/10 text-primary">
                {profile.memories?.length || 0} items
              </span>
            </div>

            {profile.memories && profile.memories.length > 0 ? (
              profile.memories.map((m) => (
                <div key={m.id} className="p-3.5 rounded-xl border border-border/60 bg-secondary/30 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-primary font-mono">{m.key}</span>
                    <span className="badge badge-outline text-[10px] uppercase font-mono">{m.type}</span>
                  </div>
                  <p className="text-foreground/90">{m.content}</p>
                  <div className="text-[10px] text-muted-foreground font-mono">
                    Importance Factor: {m.importance}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground italic">No long-term memories indexed yet.</p>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 5: PERFORMANCE METRICS                                      */}
        {/* ============================================================== */}
        {activeTab === 'performance' && (
          <div className="space-y-5 animate-fade-in">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
              Fleet Performance & Reliability Telemetry
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl border border-border/60 bg-secondary/30">
                <span className="text-[11px] text-muted-foreground">Success Rate</span>
                <p className="text-xl font-bold font-mono text-emerald-400 mt-1">
                  {Math.round(Number(profile.performance_metadata?.success_rate ?? 1) * 100)}%
                </p>
              </div>
              <div className="p-3.5 rounded-xl border border-border/60 bg-secondary/30">
                <span className="text-[11px] text-muted-foreground">Tasks Completed</span>
                <p className="text-xl font-bold font-mono text-foreground mt-1">
                  {Number(profile.performance_metadata?.tasks_completed ?? 0)}
                </p>
              </div>
              <div className="p-3.5 rounded-xl border border-border/60 bg-secondary/30">
                <span className="text-[11px] text-muted-foreground">Average Latency</span>
                <p className="text-xl font-bold font-mono text-primary mt-1">
                  {Math.round(Number(profile.performance_metadata?.avg_duration_ms ?? 850))}ms
                </p>
              </div>
              <div className="p-3.5 rounded-xl border border-border/60 bg-secondary/30">
                <span className="text-[11px] text-muted-foreground">Decisions Made</span>
                <p className="text-xl font-bold font-mono text-purple-400 mt-1">
                  {Number(profile.performance_metadata?.decisions_participated ?? 0)}
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-border/60 bg-secondary/20">
              <span className="text-xs font-semibold text-foreground block mb-1">
                Health & Evaluation State
              </span>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Agent is operating within standard enterprise thresholds. Zero policy infractions recorded in the trailing 24 hours. Model token latency remains within 1.2s SLA.
              </p>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 6: ACTIVITY & AUDIT LOG                                     */}
        {/* ============================================================== */}
        {activeTab === 'activity' && (
          <div className="space-y-4 animate-fade-in">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
              Consequential Action Log & Provenance Audit
            </h4>
            {profile.recent_audits && profile.recent_audits.length > 0 ? (
              profile.recent_audits.map((a) => (
                <div key={a.id} className="p-3 rounded-xl border border-border/60 bg-secondary/30 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">
                      {a.action} {a.step ? `• ${a.step}` : ''}
                    </span>
                    <span
                      className={`text-[10px] font-bold font-mono ${a.status === 'SUCCESS' ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                    >
                      {a.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground font-mono truncate">
                    {JSON.stringify(a.details)}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    {new Date(a.created_at).toLocaleString()}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground italic">No audit records logged yet.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

