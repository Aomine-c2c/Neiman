'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Play,
  Pause,
  FastForward,
  Cpu,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Activity,
  Send,
  Loader2,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import {
  ctoApi,
  SupervisorStatus,
  CTOProposal,
  CTODirectiveRequest,
} from '@/lib/api/cto';

interface AutonomousSupervisorStripProps {
  companyId: string;
  onTaskMutated?: () => void;
}

export function AutonomousSupervisorStrip({
  companyId,
  onTaskMutated,
}: AutonomousSupervisorStripProps) {
  const qc = useQueryClient();
  const [showDirectiveModal, setShowDirectiveModal] = useState(false);
  const [showProposalsModal, setShowProposalsModal] = useState(false);
  const [directiveText, setDirectiveText] = useState('');
  const [directivePriority, setDirectivePriority] = useState<
    'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  >('HIGH');
  const [actionError, setActionError] = useState<string | null>(null);

  // 1. Fetch Supervisor Status (polls every 3s to reflect live continuous autonomy)
  const {
    data: supervisor,
    isLoading: isLoadingSupervisor,
    error: supervisorError,
    refetch: refetchSupervisor,
  } = useQuery({
    queryKey: ['supervisor-status', companyId],
    queryFn: () => ctoApi.getSupervisorStatus(companyId),
    enabled: !!companyId,
    refetchInterval: 3000,
  });

  // 2. Fetch Proactive Proposals
  const { data: proposals = [], refetch: refetchProposals } = useQuery({
    queryKey: ['cto-proposals', companyId],
    queryFn: () => ctoApi.getProposals(companyId),
    enabled: !!companyId,
    refetchInterval: 5000,
  });

  const pendingProposals = proposals.filter((p) => p.status === 'PROPOSED');

  // Toggle Mutation
  const toggleMutation = useMutation({
    mutationFn: (action: 'PLAY' | 'PAUSE' | 'TICK') =>
      ctoApi.toggleSupervisor(companyId, action),
    onSuccess: (data) => {
      setActionError(null);
      qc.setQueryData(['supervisor-status', companyId], data);
      qc.invalidateQueries({ queryKey: ['tasks', companyId] });
      onTaskMutated?.();
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to toggle supervisor state.';
      setActionError(msg);
    },
  });

  // Tick Mutation
  const tickMutation = useMutation({
    mutationFn: () => ctoApi.triggerTick(companyId),
    onSuccess: () => {
      setActionError(null);
      qc.invalidateQueries({ queryKey: ['supervisor-status', companyId] });
      qc.invalidateQueries({ queryKey: ['tasks', companyId] });
      onTaskMutated?.();
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to trigger single cycle tick.';
      setActionError(msg);
    },
  });

  // Directive Mutation
  const directiveMutation = useMutation({
    mutationFn: (req: CTODirectiveRequest) => ctoApi.sendDirective(companyId, req),
    onSuccess: () => {
      setActionError(null);
      setDirectiveText('');
      setShowDirectiveModal(false);
      qc.invalidateQueries({ queryKey: ['supervisor-status', companyId] });
      qc.invalidateQueries({ queryKey: ['tasks', companyId] });
      qc.invalidateQueries({ queryKey: ['projects', companyId] });
      onTaskMutated?.();
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to submit directive to CTO agent.';
      setActionError(msg);
    },
  });

  // Proposal Decision Mutation
  const decideMutation = useMutation({
    mutationFn: ({
      proposalId,
      decision,
    }: {
      proposalId: string;
      decision: 'APPROVED' | 'DISMISSED';
    }) => ctoApi.decideProposal(companyId, proposalId, { decision }),
    onSuccess: () => {
      setActionError(null);
      qc.invalidateQueries({ queryKey: ['cto-proposals', companyId] });
      qc.invalidateQueries({ queryKey: ['supervisor-status', companyId] });
      qc.invalidateQueries({ queryKey: ['tasks', companyId] });
      onTaskMutated?.();
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to decide proposal.';
      setActionError(msg);
    },
  });

  if (!companyId) return null;

  const isPlaying = supervisor?.state === 'PLAYING' && supervisor?.is_running;
  const isExecuting = !!supervisor?.active_task;

  return (
    <div className="w-full flex flex-col gap-2.5">
      {/* ERROR NOTICE IF ANY */}
      {actionError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400 text-xs font-mono"
        >
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button
            onClick={() => setActionError(null)}
            className="text-muted-foreground hover:text-foreground text-[11px] px-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* AUTONOMOUS SUPERVISOR COCKPIT STRIP */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl border border-border/80 bg-card/80 backdrop-blur-md shadow-sm">
        {/* Left: Autonomy Status Indicator & Cycle Metrics */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              {isPlaying ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
              )}
            </span>
            <div className="flex flex-col">
              <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Cpu className="h-3.5 w-3.5 text-primary" />
                <span>
                  {isPlaying ? 'Autonomous Loop Active' : 'Autonomous Loop Paused'}
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full border border-border bg-secondary/60 text-muted-foreground">
                  Cycle #{supervisor?.active_cycle ?? 0}
                </span>
              </span>
              <span className="text-[11px] text-muted-foreground font-mono flex items-center gap-2">
                <span>Pending: {supervisor?.pending_tasks_count ?? 0}</span>
                <span>•</span>
                <span className="text-emerald-500 font-semibold">
                  Done: {supervisor?.completed_tasks_count ?? 0}
                </span>
                {supervisor?.last_tick_at && (
                  <>
                    <span>•</span>
                    <span className="text-[10px]">
                      Last tick:{' '}
                      {new Date(supervisor.last_tick_at).toLocaleTimeString()}
                    </span>
                  </>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Center: What the agent is currently working on */}
        <div className="flex-1 min-w-[240px] max-w-md hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border/60 bg-secondary/30">
          <Activity
            className={`h-4 w-4 shrink-0 ${
              isExecuting ? 'text-primary animate-pulse' : 'text-muted-foreground'
            }`}
          />
          <div className="flex flex-col truncate">
            <span className="text-[10px] uppercase font-mono text-muted-foreground font-semibold">
              {isExecuting ? 'Currently Executing:' : 'Operational Status:'}
            </span>
            <span className="text-xs font-mono font-medium truncate text-foreground">
              {isExecuting ? (
                <span>
                  <strong className="text-primary font-bold">
                    {supervisor?.active_task?.agent_name}:
                  </strong>{' '}
                  {supervisor?.active_task?.title}
                </span>
              ) : (
                <span className="text-muted-foreground italic">
                  Workforce idle — awaiting unblocked tasks or directive.
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Right: Controls & Modals */}
        <div className="flex items-center gap-2">
          {/* Proactive Proposals Button */}
          <button
            type="button"
            onClick={() => setShowProposalsModal(true)}
            className="relative flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold border border-purple-500/30 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors"
            title="View Proactive CTO Engineering Proposals"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Proposals</span>
            {pendingProposals.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-purple-500 text-white font-bold">
                {pendingProposals.length}
              </span>
            )}
          </button>

          {/* CTO Directive Modal Trigger */}
          <button
            type="button"
            onClick={() => setShowDirectiveModal(true)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold border border-border bg-secondary/60 hover:bg-secondary text-foreground transition-colors"
            title="Issue Directive to Autonomous CTO"
          >
            <Send className="h-3.5 w-3.5 text-primary" />
            <span>CTO Directive</span>
          </button>

          {/* Manual Cycle Tick Button */}
          <button
            type="button"
            onClick={() => tickMutation.mutate()}
            disabled={tickMutation.isPending}
            className="flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold border border-border bg-secondary/60 hover:bg-secondary text-foreground transition-colors disabled:opacity-50"
            title="Advance Single Autonomous Cycle Tick"
          >
            {tickMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FastForward className="h-3.5 w-3.5 text-blue-400" />
            )}
            <span className="hidden sm:inline">Tick</span>
          </button>

          {/* Play/Pause Supervisor Button */}
          <button
            type="button"
            onClick={() =>
              toggleMutation.mutate(isPlaying ? 'PAUSE' : 'PLAY')
            }
            disabled={toggleMutation.isPending}
            className={`flex items-center gap-1.5 h-8 px-3.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all shadow-sm ${
              isPlaying
                ? 'bg-amber-500/20 border border-amber-500/40 text-amber-400 hover:bg-amber-500/30'
                : 'bg-emerald-500 text-white hover:bg-emerald-600'
            }`}
            title={isPlaying ? 'Pause Autonomous Daemon' : 'Resume Autonomous Daemon'}
          >
            {toggleMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : isPlaying ? (
              <>
                <Pause className="h-3.5 w-3.5 fill-current" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>Play</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* CTO DIRECTIVE MODAL */}
      {showDirectiveModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in"
        >
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="h-5 w-5 text-primary" />
                <h3 className="text-base font-bold text-foreground">
                  Issue Executive Directive to CTO
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDirectiveModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Submit high-level business or engineering requirements. The CTO agent
              decomposes objectives into dependency-linked implementation tasks and
              dispatches them across the workforce.
            </p>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-foreground">
                Directive Objective:
              </label>
              <textarea
                value={directiveText}
                onChange={(e) => setDirectiveText(e.target.value)}
                rows={3}
                placeholder="e.g. Implement JWT authentication token rotation with Redis and add integration tests"
                className="w-full text-xs font-mono p-3 rounded-xl border border-border bg-secondary/40 text-foreground focus:outline-none focus:border-primary"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground">Priority:</span>
                <select
                  value={directivePriority}
                  onChange={(e) =>
                    setDirectivePriority(
                      e.target.value as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
                    )
                  }
                  className="text-xs font-mono py-1 px-2.5 rounded-full border border-border bg-secondary text-foreground"
                >
                  <option value="CRITICAL">Critical</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowDirectiveModal(false)}
                  className="px-3 py-1.5 rounded-full border border-border text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!directiveText.trim() || directiveMutation.isPending}
                  onClick={() =>
                    directiveMutation.mutate({
                      directive: directiveText.trim(),
                      priority: directivePriority,
                    })
                  }
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold disabled:opacity-50"
                >
                  {directiveMutation.isPending && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  )}
                  <span>Dispatch Directive</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PROACTIVE PROPOSALS MODAL */}
      {showProposalsModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in"
        >
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-400" />
                <h3 className="text-base font-bold text-foreground">
                  Proactive Engineering Initiatives
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowProposalsModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Formulated autonomously by the CTO Agent to improve system resilience,
              architecture, and performance without waiting for operator commands.
            </p>

            {pendingProposals.length === 0 ? (
              <div className="p-8 text-center rounded-xl border border-dashed border-border flex flex-col items-center justify-center gap-2">
                <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                <span className="text-xs text-muted-foreground font-mono">
                  No pending proposals. All initiatives have been decided.
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {pendingProposals.map((prop) => (
                  <div
                    key={prop.id}
                    className="p-4 rounded-xl border border-border bg-secondary/20 flex flex-col gap-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground">
                        {prop.title}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-400 uppercase font-semibold">
                        {prop.category}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground font-sans">
                      {prop.rationale}
                    </p>

                    <div className="text-[11px] font-mono text-muted-foreground bg-secondary/50 p-2 rounded-lg">
                      <strong>Impact:</strong> {prop.impact_assessment}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {prop.proposed_tasks.length} task(s) to delegate
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={decideMutation.isPending}
                          onClick={() =>
                            decideMutation.mutate({
                              proposalId: prop.id,
                              decision: 'DISMISSED',
                            })
                          }
                          className="px-3 py-1 rounded-full border border-border text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                        >
                          Dismiss
                        </button>
                        <button
                          type="button"
                          disabled={decideMutation.isPending}
                          onClick={() =>
                            decideMutation.mutate({
                              proposalId: prop.id,
                              decision: 'APPROVED',
                            })
                          }
                          className="px-3 py-1 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition-colors flex items-center gap-1"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Approve & Delegate</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
