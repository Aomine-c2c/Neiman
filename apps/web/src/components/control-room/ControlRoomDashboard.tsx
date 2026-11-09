'use client';

import React, { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Sparkles,
  CheckCircle2,
  ShieldAlert,
  Bot,
  Kanban,
  Activity,
  ArrowRight,
  Send,
  Loader2,
  Check,
  X,
  GitBranch,
  Cpu,
  MessageSquareCode,
  Clock,
  AlertTriangle,
  Boxes,
  GitFork,
  CheckSquare,
} from 'lucide-react';
import type { ControlRoomState } from '@/lib/api/controlRoom';
import type { ActivityConnection, ActivityTransport } from '@/hooks/useActivityStream';
import { ctoApi, type CTODirectiveResponse } from '@/lib/api/cto';
import { projectsApi, type TaskChecklistItem, type TaskStatus } from '@/lib/api/projects';
import { ApprovalsTriageWidget } from './ApprovalsTriageWidget';
import { SwarmReasoningStream } from './SwarmReasoningStream';
import { TaskDependencyDAG } from './TaskDependencyDAG';
import { IntelligenceMeshRadar } from './IntelligenceMeshRadar';

interface ControlRoomDashboardProps {
  companyId?: string;
  companyName: string;
  companyStatus?: string;
  industry?: string | null;
  state: ControlRoomState;
  live: {
    connection: ActivityConnection;
    transport: ActivityTransport;
    freshIds: Set<string>;
  };
  isRefetching?: boolean;
  previewMode?: boolean;
  onDecideApproval?: (approvalId: string, decision: 'APPROVED' | 'REJECTED') => void;
  onOpenDrawer?: (drawerId: string, entityId?: string) => void;
}

export function ControlRoomDashboard({
  companyId,
  companyName,
  state,
  live,
  onDecideApproval,
  onOpenDrawer,
}: ControlRoomDashboardProps) {
  const router = useRouter();
  const qc = useQueryClient();
  const resolvedCompanyId = companyId ?? state.company_id;

  // Top Directive Prompt Bar State
  const [directiveText, setDirectiveText] = useState('');
  const [planPreview, setPlanPreview] = useState<CTODirectiveResponse | null>(null);
  const [dispatchedNotice, setDispatchedNotice] = useState<string | null>(null);
  const [rightRailView, setRightRailView] = useState<'SWARM' | 'EVENTS'>('EVENTS');
  const [workViewMode, setWorkViewMode] = useState<'LIST' | 'DAG'>('LIST');
  const [activityFilter, setActivityFilter] = useState<'ALL' | 'CODE' | 'DECISIONS' | 'ALERTS'>('ALL');
  const [showMeshRadar, setShowMeshRadar] = useState(false);

  // Proactive CTO Proposals query
  const { data: proposals = [] } = useQuery({
    queryKey: ['cto-proposals', resolvedCompanyId],
    queryFn: () => ctoApi.getProposals(resolvedCompanyId),
    enabled: !!resolvedCompanyId,
  });

  // Submit directive to CTO
  const directiveMutation = useMutation({
    mutationFn: (goal: string) =>
      ctoApi.sendDirective(resolvedCompanyId, {
        directive: goal,
        priority: 'HIGH',
      }),
    onSuccess: (res) => {
      setPlanPreview(res);
      setDispatchedNotice(null);
      qc.invalidateQueries({ queryKey: ['control-room-state', resolvedCompanyId] });
      qc.invalidateQueries({ queryKey: ['tasks', resolvedCompanyId] });
    },
  });

  // Proposal decision mutation
  const proposalMutation = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'APPROVED' | 'DISMISSED' }) =>
      ctoApi.decideProposal(resolvedCompanyId, id, { decision }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cto-proposals', resolvedCompanyId] });
      qc.invalidateQueries({ queryKey: ['control-room-state', resolvedCompanyId] });
    },
  });

  const handleDirectiveSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = directiveText.trim();
    if (!trimmed || directiveMutation.isPending) return;
    directiveMutation.mutate(trimmed);
  };

  const handleApproveAndDispatchPlan = () => {
    if (!planPreview) return;
    setDispatchedNotice(
      `Dispatched ${planPreview.tasks?.length || planPreview.tasks_created_count || 1} tasks to the engineering squad.`
    );
    setPlanPreview(null);
    setDirectiveText('');
    qc.invalidateQueries({ queryKey: ['control-room-state', resolvedCompanyId] });
    qc.invalidateQueries({ queryKey: ['tasks', resolvedCompanyId] });
  };

  // Interactive Task Toggle Mutation
  const toggleTaskMutation = useMutation({
    mutationFn: ({
      taskCompanyId,
      projectId,
      taskId,
      currentStatus,
    }: {
      taskCompanyId: string;
      projectId: string;
      taskId: string;
      currentStatus: string;
    }) =>
      projectsApi.toggleTaskStatus(taskCompanyId, projectId, taskId, currentStatus as TaskStatus),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['control-room-state'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  // Metrics Calculation
  const activeTasks = state.tasks.filter(
    (t) => t.status === 'IN_PROGRESS' || t.status === 'PENDING' || t.status === 'BLOCKED'
  );
  const inProgressTasks = state.tasks.filter((t) => t.status === 'IN_PROGRESS');
  const workingAgents = state.agents.filter(
    (a) => a.status === 'WORKING' || a.status === 'AVAILABLE'
  );
  const pendingApprovals = state.approvals.filter((a) => a.status === 'PENDING');
  const onlineProviders = state.providers.filter((p) => p.status === 'ONLINE' || p.is_configured);
  const primaryProvider =
    state.providers.find((p) => p.is_primary) || onlineProviders[0] || state.providers[0];

  const agentMap = new Map(state.agents.map((a) => [a.id, a]));
  const taskMap = new Map(state.tasks.map((t) => [t.id, t]));

  const resolveApprovalTarget = (raw?: string) => {
    if (!raw) return 'Repository Action';
    if (raw.startsWith('Task:')) {
      const idPart = raw.replace('Task:', '').trim();
      const matched =
        taskMap.get(idPart) ||
        state.tasks.find((t) => t.id.startsWith(idPart));
      if (matched) return `Task: ${matched.title}`;
    }
    return raw;
  };

  const filteredActivity = state.activity.filter((ev) => {
    if (activityFilter === 'ALL') return true;
    const domain = (ev.event_type || '').toUpperCase();
    if (activityFilter === 'CODE') return domain.includes('ENG') || domain.includes('TASK') || domain.includes('WORK');
    if (activityFilter === 'DECISIONS') return domain.includes('DECISION') || domain.includes('COUNCIL') || domain.includes('GOV');
    if (activityFilter === 'ALERTS') return ev.severity === 'CRITICAL' || ev.severity === 'HIGH';
    return true;
  });

  const pendingProposals = proposals.filter((p) => p.status === 'PROPOSED');

  return (
    <div className="max-w-7xl mx-auto w-full space-y-6 pb-8 animate-fade-in">
      {/* ── 1. UNIFIED COMMAND DECK TOP STRIP: DIRECTIVE + METRICS + TELEMETRY ── */}
      <section
        aria-label="Executive Directive & Pulse Command"
        className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-xs divide-y divide-border/60"
      >
        {/* Directive input & live controls */}
        <div className="p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20 shrink-0">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <h1 className="text-sm font-semibold text-foreground tracking-tight flex items-center gap-2">
                  <span>{companyName} — Engineering Command</span>
                </h1>
                <p className="text-xs text-muted-foreground">
                  Give your AI CTO & specialist squad a feature specification, architectural refactor, or bug to resolve.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground shrink-0">
              <Link
                href="/dashboard/mcp"
                className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-primary hover:bg-primary/20 transition-colors font-sans font-medium text-xs"
              >
                <Boxes className="h-3.5 w-3.5" />
                <span>Skills & MCP Hub</span>
              </Link>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-border/80 bg-secondary/40 px-2.5 py-1 text-foreground font-mono text-xs">
                <Cpu className="h-3.5 w-3.5 text-primary" />
                <span>{state.activeModel || primaryProvider?.name || 'Auto Model Router'}</span>
              </span>
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-md border border-border/80 bg-secondary/40 px-2.5 py-1 text-foreground font-mono text-xs">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    live.connection === 'CONNECTED' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                  }`}
                />
                <span>{live.connection}</span>
              </span>
            </div>
          </div>

          <form onSubmit={handleDirectiveSubmit} className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="text"
              value={directiveText}
              onChange={(e) => setDirectiveText(e.target.value)}
              placeholder="Give your engineering team a goal... (e.g. 'Build Stripe webhook billing pipeline with unit tests')"
              aria-label="Give your engineering team a goal"
              className="flex-1 rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all font-sans"
            />
            <button
              type="submit"
              disabled={!directiveText.trim() || directiveMutation.isPending}
              aria-label="Synthesize Plan"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all shrink-0 shadow-xs"
            >
              {directiveMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Synthesizing Plan…</span>
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  <span>Synthesize Plan</span>
                </>
              )}
            </button>
          </form>

          {dispatchedNotice && (
            <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs text-emerald-700 dark:text-emerald-300">
              <span className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {dispatchedNotice}
              </span>
              <button
                type="button"
                onClick={() => setDispatchedNotice(null)}
                className="text-xs underline hover:no-underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Inline CTO Plan Preview Card */}
          {planPreview && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3 animate-fade-in">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-primary text-primary-foreground uppercase">
                      CTO Plan Preview
                    </span>
                    <span className="text-xs font-semibold text-foreground">
                      {planPreview.cto_agent_name || 'AI Chief Technology Officer'}
                    </span>
                  </div>
                  <p className="text-sm text-foreground mt-1.5 font-medium">
                    {planPreview.summary}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPlanPreview(null)}
                  aria-label="Dismiss plan preview"
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {planPreview.tasks && planPreview.tasks.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Proposed Engineering Tasks ({planPreview.tasks.length})
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {planPreview.tasks.map((t) => {
                      const assignedName = t.assigned_agent_name;
                      return (
                        <div
                          key={t.id}
                          className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate">{t.title}</p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {assignedName ? `Assigned: ${assignedName}` : 'Auto-routed specialist'}
                            </p>
                          </div>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-secondary text-muted-foreground shrink-0">
                            {t.priority || 'HIGH'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => router.push('/dashboard/councils')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-foreground hover:bg-secondary transition-colors"
                >
                  <MessageSquareCode className="h-3.5 w-3.5 text-primary" />
                  <span>Discuss in CTO View</span>
                </button>
                <button
                  type="button"
                  onClick={handleApproveAndDispatchPlan}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Approve & Dispatch</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Integrated Pulse Metrics Row */}
        <div
          aria-label="Executive Pulse Metrics"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border/60 bg-secondary/10"
        >
          {/* Card 1: Active Tasks */}
          <Link
            href="/dashboard/tasks"
            className="p-3.5 sm:p-4 hover:bg-secondary/30 transition-colors group flex flex-col justify-between"
          >
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium text-foreground/80">Active Tasks</span>
              <Kanban className="h-4 w-4 text-primary group-hover:scale-105 transition-transform" />
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
                {activeTasks.length}
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                {inProgressTasks.length} in progress
              </span>
            </div>
          </Link>

          {/* Card 2: Working Agents */}
          <Link
            href="/dashboard/agents"
            className="p-3.5 sm:p-4 hover:bg-secondary/30 transition-colors group flex flex-col justify-between"
          >
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium text-foreground/80">Working Agents</span>
              <Bot className="h-4 w-4 text-emerald-500 group-hover:scale-105 transition-transform" />
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
                {workingAgents.length}
                <span className="text-sm font-normal text-muted-foreground">/{state.agents.length}</span>
              </span>
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                Squad ready
              </span>
            </div>
          </Link>

          {/* Card 3: Pending Approvals */}
          <button
            type="button"
            onClick={() => onOpenDrawer?.('approvals')}
            className="text-left p-3.5 sm:p-4 hover:bg-secondary/30 transition-colors group flex flex-col justify-between cursor-pointer"
          >
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium text-foreground/80">Pending Approvals</span>
              <ShieldAlert
                className={`h-4 w-4 transition-transform group-hover:scale-105 ${
                  pendingApprovals.length > 0 ? 'text-amber-500' : 'text-muted-foreground'
                }`}
              />
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
                {pendingApprovals.length}
              </span>
              <span
                className={`text-xs ${
                  pendingApprovals.length > 0
                    ? 'text-amber-600 dark:text-amber-400 font-semibold'
                    : 'text-muted-foreground'
                }`}
              >
                {pendingApprovals.length > 0 ? 'Requires sign-off' : 'All clear'}
              </span>
            </div>
          </button>

          {/* Card 4: Repo Health & Model Mesh */}
          <div className="p-3.5 sm:p-4 hover:bg-secondary/30 transition-colors flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium text-foreground/80">Repo Health</span>
              <button
                type="button"
                onClick={() => setShowMeshRadar(!showMeshRadar)}
                aria-label={showMeshRadar ? 'Hide Intelligence Radar' : 'Show Intelligence Radar'}
                className="inline-flex items-center gap-1 text-[11px] font-mono text-primary hover:underline cursor-pointer"
              >
                <Cpu className="h-3 w-3" />
                <span>{showMeshRadar ? 'Hide Radar' : 'Telemetry'}</span>
              </button>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold font-mono tracking-tight text-emerald-600 dark:text-emerald-400">
                Synced
              </span>
              <span className="text-xs font-mono text-muted-foreground">
                {onlineProviders.length} LLMs · $0.42/hr
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── INTELLIGENCE MESH & 5-HOUR COOLDOWN RADAR (Collapsible) ── */}
      {showMeshRadar && (
        <div className="transition-all duration-200">
          <IntelligenceMeshRadar companyId={resolvedCompanyId} />
        </div>
      )}

      {/* ── 3. TWO-COLUMN MAIN WORKSPACE SPLIT ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN (7 cols): Pending Approvals + Active Work in Progress */}
        <div className="lg:col-span-7 space-y-6">
          {/* Approvals Triage Deck */}
          {pendingApprovals.length > 0 && (
            <ApprovalsTriageWidget
              approvals={pendingApprovals}
              companyId={resolvedCompanyId}
              onDecideApproval={onDecideApproval}
              onOpenDrawer={onOpenDrawer}
              resolveTarget={resolveApprovalTarget}
            />
          )}

          {/* Proactive CTO Architectural Proposals (if any) */}
          {pendingProposals.length > 0 && (
            <section className="rounded-xl border border-primary/30 bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  CTO Architectural Proposals ({pendingProposals.length})
                </h2>
              </div>
              <div className="space-y-2">
                {pendingProposals.map((prop) => (
                  <div
                    key={prop.id}
                    className="rounded-lg border border-border bg-secondary/20 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground">{prop.title}</p>
                      <p className="text-xs text-muted-foreground">{prop.rationale}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        aria-label={`Approve Proposal ${prop.title}`}
                        onClick={() => proposalMutation.mutate({ id: prop.id, decision: 'APPROVED' })}
                        className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => proposalMutation.mutate({ id: prop.id, decision: 'DISMISSED' })}
                        className="px-2.5 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Active Work in Progress */}
          <section
            aria-label="Active Work in Progress"
            className="rounded-xl border border-border bg-card overflow-hidden"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-border bg-secondary/15">
              <div className="flex items-center gap-2">
                <Kanban className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">
                  Active Work in Progress
                </h2>
                <span className="px-2 py-0.5 text-[11px] font-mono rounded-full bg-secondary text-muted-foreground">
                  {activeTasks.length}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="inline-flex rounded-lg border border-border p-0.5 bg-background">
                  <button
                    type="button"
                    onClick={() => setWorkViewMode('LIST')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                      workViewMode === 'LIST'
                        ? 'bg-secondary text-foreground font-semibold shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    List
                  </button>
                  <button
                    type="button"
                    onClick={() => setWorkViewMode('DAG')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors ${
                      workViewMode === 'DAG'
                        ? 'bg-secondary text-foreground font-semibold shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <GitFork className="h-3 w-3 text-primary" />
                    <span>DAG Topology</span>
                  </button>
                </div>

                <Link
                  href="/dashboard/tasks?view=checklist"
                  className="inline-flex items-center gap-1 text-xs font-mono font-medium text-muted-foreground hover:text-foreground"
                >
                  <CheckSquare className="h-3.5 w-3.5" />
                  <span>Checklist</span>
                </Link>
                <Link
                  href="/dashboard/tasks"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <span>Board</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            {workViewMode === 'DAG' ? (
              <div className="p-4">
                <TaskDependencyDAG
                  tasks={state.tasks || []}
                  agents={state.agents || []}
                  onSelectTask={(id) => router.push(`/dashboard/tasks?task=${id}`)}
                />
              </div>
            ) : (
              <div className="divide-y divide-border">
                {activeTasks.length === 0 ? (
                  <div className="p-8 text-center space-y-2">
                    <p className="text-sm font-medium text-foreground">No active engineering tasks</p>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto">
                      Use the Directive Bar above to assign a new feature or bug fix to your AI CTO, or create a task directly on the board.
                    </p>
                  </div>
                ) : (
                  activeTasks.slice(0, 8).map((task) => {
                    const agent = task.assigned_agent_id ? agentMap.get(task.assigned_agent_id) : null;
                    const isWorking = task.status === 'IN_PROGRESS';
                    const isComplete = (task.status as string) === 'COMPLETED' || (task.status as string) === 'DONE';
                    const taskChecklist: TaskChecklistItem[] =
                      (task.checklist && task.checklist.length > 0)
                        ? task.checklist
                        : ((task.resource_requirements as Record<string, unknown> | undefined)?.checklist as TaskChecklistItem[]) || [];
                    const completedSteps = taskChecklist.filter((c) => c.completed).length;

                    return (
                      <div
                        key={task.id}
                        onClick={() => router.push(`/dashboard/tasks?task=${task.id}`)}
                        className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-secondary/40 transition-colors cursor-pointer group"
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleTaskMutation.mutate({
                                  taskCompanyId: task.company_id || resolvedCompanyId,
                                  projectId: task.project_id,
                                  taskId: task.id,
                                  currentStatus: task.status,
                                });
                              }}
                              aria-label={`Mark task ${task.title} as ${isComplete ? 'incomplete' : 'complete'}`}
                              className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                                isComplete
                                  ? 'bg-emerald-500 border-emerald-500 text-white'
                                  : isWorking
                                  ? 'border-amber-500 hover:border-emerald-500 bg-amber-500/10'
                                  : 'border-border/80 hover:border-[#D71921] bg-secondary/50'
                              }`}
                            >
                              {isComplete && <Check className="h-3 w-3 stroke-[3]" />}
                            </button>
                            <p className={`text-sm font-medium truncate ${isComplete ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                              {task.title}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground pl-6">
                            <span className="font-mono text-[11px]">{task.status.replace(/_/g, ' ')}</span>
                            <span>•</span>
                            <span>
                              {agent ? `Assigned to ${agent.name}` : 'Unassigned'}
                            </span>
                            {taskChecklist.length > 0 && (
                              <>
                                <span>•</span>
                                <span className="font-mono text-[11px] text-emerald-500">
                                  {completedSteps}/{taskChecklist.length} steps
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono border border-border bg-secondary/50 text-muted-foreground">
                            {task.priority}
                          </span>
                          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </section>
        </div>

        {/* RIGHT COLUMN (5 cols): Live Swarm Stream & Team Activity */}
        <div className="lg:col-span-5 space-y-6">
          <section
            aria-label="Live Swarm & Team Activity"
            className="rounded-xl border border-border bg-card overflow-hidden"
          >
            {/* Right Rail Top View Switcher */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-secondary/20">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setRightRailView('SWARM')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                    rightRailView === 'SWARM'
                      ? 'bg-card text-foreground shadow-sm border border-border'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Bot className="h-3.5 w-3.5 text-primary" />
                  <span>Swarm Stream</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRightRailView('EVENTS')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                    rightRailView === 'EVENTS'
                      ? 'bg-card text-foreground shadow-sm border border-border'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Activity className="h-3.5 w-3.5 text-blue-400" />
                  <span>Live Team Activity</span>
                </button>
              </div>

              {rightRailView === 'EVENTS' && (
                <div className="flex items-center gap-1 text-[11px]">
                  {(['ALL', 'CODE', 'DECISIONS', 'ALERTS'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActivityFilter(tab)}
                      className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                        activityFilter === tab
                          ? 'bg-primary/10 text-primary font-semibold'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* TAB CONTENT */}
            {rightRailView === 'SWARM' ? (
              <div className="p-4">
                <SwarmReasoningStream
                  agents={state.agents || []}
                  tasks={state.tasks || []}
                  companyId={resolvedCompanyId}
                />
              </div>
            ) : (
              <div className="divide-y divide-border max-h-[480px] overflow-y-auto">
                {filteredActivity.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground">
                    No recent activity events matching this filter.
                  </div>
                ) : (
                  filteredActivity.slice(0, 15).map((ev) => {
                    const isAlert =
                      ev.severity === 'CRITICAL' || ev.severity === 'HIGH';
                    return (
                      <div key={ev.id} className="px-4 py-3 space-y-1 hover:bg-secondary/30 transition-colors">
                        <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                          <span className="font-mono font-semibold text-primary uppercase">
                            {ev.event_type || 'SYSTEM'}
                          </span>
                          <span className="flex items-center gap-1 font-mono">
                            <Clock className="h-3 w-3" />
                            {ev.timestamp
                              ? new Date(ev.timestamp).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : 'just now'}
                          </span>
                        </div>
                        <p className="text-xs font-medium text-foreground flex items-start gap-1.5">
                          {isAlert && <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />}
                          <span>{ev.title}</span>
                        </p>
                        {ev.summary && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{ev.summary}</p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
