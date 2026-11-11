'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  RotateCw,
  GitCommit,
  Database,
  Layers,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Terminal,
  Copy,
  Check,
  X,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { systemUpdatesApi, UpdateStatus, UpdateProgress } from '@/lib/api/systemUpdates';
import { NEIMAN_CONFIG } from '@neiman/config';

interface SystemUpdateCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STAGES = [
  { id: 'GIT_CHECK', label: 'Update Reference Check', desc: 'Compare the checkout with cached origin/main; this check does not contact the network or change files' },
];

export function SystemUpdateCenterModal({ isOpen, onClose }: SystemUpdateCenterModalProps) {
  const queryClient = useQueryClient();
  const [showLogs, setShowLogs] = useState(false);
  const [copiedLogs, setCopiedLogs] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Status query (checks commits)
  const { data: status, refetch: refetchStatus, isFetching: isChecking } = useQuery<UpdateStatus>({
    queryKey: ['system-update-status'],
    queryFn: () => systemUpdatesApi.getStatus(),
    enabled: isOpen,
    staleTime: NEIMAN_CONFIG.TELEMETRY.STALE_TIMES.FAST,
  });

  // Progress query (polls frequently while is_updating)
  const { data: progress } = useQuery<UpdateProgress>({
    queryKey: ['system-update-progress'],
    queryFn: () => systemUpdatesApi.getProgress(),
    enabled: isOpen && (status?.is_updating || false),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.is_updating) return 1_000;
      return false;
    },
  });

  const isUpdating = status?.is_updating || progress?.is_updating || false;
  const isComplete = progress?.stage === 'COMPLETE';
  const isFailed = progress?.stage === 'FAILED';
  const needsReviewedDeployment = progress?.stage === 'MANUAL_ACTION_REQUIRED';

  // Trigger mutation
  const triggerMutation = useMutation({
    mutationFn: () => systemUpdatesApi.trigger(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-update-status'] });
      queryClient.invalidateQueries({ queryKey: ['system-update-progress'] });
    },
  });

  // Auto-scroll logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [progress?.log_tail]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isUpdating) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isUpdating, onClose]);

  if (!isOpen) return null;

  const handleCopyLogs = () => {
    const text = progress?.log_tail?.join('\n') || 'No logs recorded';
    navigator.clipboard.writeText(text);
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  const handleApplyUpdate = () => {
    triggerMutation.mutate();
  };

  const handleReload = () => {
    refetchStatus();
  };

  const currentPercent = isComplete ? 100 : progress?.progress_percent || (isUpdating ? 15 : 0);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="update-center-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in font-mono"
    >
      <div className="relative w-full max-w-xl rounded-2xl border border-border/80 bg-card p-6 shadow-2xl text-foreground space-y-6 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 pb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className={`h-2.5 w-2.5 rounded-full ${isUpdating ? 'bg-cyan-400 animate-pulse' : 'bg-[#D71921]'}`} />
            <div>
              <h2 id="update-center-title" className="text-xs font-bold uppercase tracking-widest text-foreground">
                NEIMAN OS // System Update Center
              </h2>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Autonomous Infrastructure Orchestration & Continuous Delivery
              </p>
            </div>
          </div>
          {!isUpdating && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              aria-label="Close update center"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Scrollable Body */}
        <div className="space-y-5 overflow-y-auto pr-1 flex-1">
          {/* Version Snapshot Ribbon */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 rounded-xl bg-secondary/30 border border-border/50 text-[11px]">
            <div>
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground block">Installed Version</span>
              <span className="font-bold text-foreground">v{status?.version || '1.0.2'}</span>
            </div>
            <div>
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground block">Active Commit</span>
              <span className="font-bold text-foreground inline-flex items-center gap-1">
                <GitCommit className="h-3 w-3 text-primary" />
                {status?.current_commit || '...'}
              </span>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground block">Remote Status</span>
              {status?.check_error ? (
                <span className="text-amber-400 font-bold flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Cached origin unavailable
                </span>
              ) : status?.update_available ? (
                <span className="text-amber-400 font-bold flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  {status.commits_behind} commit{status.commits_behind > 1 ? 's' : ''} behind
                </span>
              ) : (
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Up to date
                </span>
              )}
            </div>
          </div>

          {/* Update Available Banner */}
          {status?.update_available && !isUpdating && !isComplete && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5 text-[11px]">
                  <Sparkles className="h-3.5 w-3.5" />
                  Update Available in Cached Ref ({status.remote_commit})
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                  REVIEW REQUIRED
                </span>
              </div>
              <p className="text-[11px] text-foreground/90 leading-relaxed font-sans">
                {status.latest_summary || 'The fetched origin/main revision differs from this checkout.'}
              </p>
              <p className="text-[10px] text-muted-foreground font-sans">
                This screen checks update status only. Applying source changes requires the reviewed deployment process.
              </p>
            </div>
          )}

          {/* Progress Bar */}
          {(isUpdating || isComplete || isFailed || needsReviewedDeployment) && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
        <span className="text-foreground">
                  {progress?.stage_name || (isComplete ? 'Update status checked' : 'Checking update status...')}
                </span>
                <span className="text-primary font-mono">{needsReviewedDeployment ? 'REVIEW' : `${currentPercent}%`}</span>
              </div>
              <div className="w-full bg-secondary/80 h-2 rounded-full overflow-hidden border border-border/60">
                <div
                  className={`h-full transition-all duration-500 ${
                    isFailed ? 'bg-destructive' : needsReviewedDeployment ? 'bg-amber-500' : isComplete ? 'bg-emerald-500' : 'bg-[#D71921]'
                  }`}
                  style={{ width: `${currentPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Stage Timeline */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block">
              Execution Stages
            </span>
            <div className="divide-y divide-border/40 rounded-xl border border-border/60 bg-secondary/10 overflow-hidden">
              {STAGES.map((s, idx) => {
                const stageIndex = idx + 1;
                const activeIndex = progress?.stage_index || (isComplete ? 1 : isUpdating ? 1 : 0);
                const isStepComplete = isComplete || needsReviewedDeployment;
                const isStepActive = isUpdating && activeIndex === stageIndex;

                return (
                  <div key={s.id} className="flex items-start gap-3 p-3 text-xs transition-colors">
                    <div className="mt-0.5 shrink-0">
                      {isStepComplete ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      ) : isStepActive ? (
                        <RotateCw className="h-4 w-4 text-cyan-400 animate-spin" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border border-border bg-muted/40 flex items-center justify-center text-[9px] text-muted-foreground">
                          {stageIndex}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className={`font-bold text-[11px] uppercase tracking-wider ${isStepActive ? 'text-foreground' : isStepComplete ? 'text-foreground/90' : 'text-muted-foreground'}`}>
                          {s.label}
                        </span>
                        <span className="text-[9px] font-mono text-muted-foreground uppercase">
                            {needsReviewedDeployment ? 'REVIEW REQUIRED' : isStepComplete ? 'COMPLETE' : isStepActive ? 'RUNNING' : 'PENDING'}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                        {s.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Expandable Terminal Telemetry Log */}
          <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
            <button
              type="button"
              onClick={() => setShowLogs((v) => !v)}
              className="w-full flex items-center justify-between px-3.5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:bg-secondary/40 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Terminal className="h-3.5 w-3.5" />
                Build Telemetry & System Output ({progress?.log_tail?.length || 0} entries)
              </span>
              {showLogs ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>

            {showLogs && (
              <div className="border-t border-border/60 bg-[#090C12] p-3 space-y-2 relative">
                <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                  <span>~/.local/share/neiman/update.log</span>
                  <button
                    type="button"
                    onClick={handleCopyLogs}
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    {copiedLogs ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedLogs ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <div
                  ref={logContainerRef}
                  className="font-mono text-[10px] text-emerald-400/90 max-h-36 overflow-y-auto space-y-0.5 select-text leading-tight bg-black/40 p-2 rounded border border-border/40"
                >
                  {progress?.log_tail && progress.log_tail.length > 0 ? (
                    progress.log_tail.map((line, i) => (
                      <div key={i} className="whitespace-pre-wrap">{line}</div>
                    ))
                  ) : (
                    <div className="text-muted-foreground italic">No pipeline messages recorded yet.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-border/60 shrink-0">
          <button
            type="button"
            disabled={isChecking || isUpdating}
            onClick={() => refetchStatus()}
            className="text-[10px] uppercase font-bold text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors disabled:opacity-40"
          >
            <RotateCw className={`h-3 w-3 ${isChecking ? 'animate-spin' : ''}`} />
            Check Cached Ref
          </button>

          <div className="flex items-center gap-2">
            {!isUpdating && (
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary px-3 py-1.5 text-xs font-bold uppercase tracking-wider"
              >
                Dismiss
              </button>
            )}

            {isComplete ? (
              <button
                type="button"
                onClick={handleReload}
                className="btn btn-primary px-4 py-1.5 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500"
              >
                <RotateCw className="h-3.5 w-3.5" />
                Refresh Status
              </button>
            ) : status?.update_available ? (
              <button
                type="button"
                disabled={isUpdating || triggerMutation.isPending}
                onClick={handleApplyUpdate}
                className="btn btn-primary px-4 py-1.5 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 disabled:opacity-50"
              >
                {isUpdating ? (
                  <>
                    <RotateCw className="h-3.5 w-3.5 animate-spin" />
                    Applying...
                  </>
                ) : (
                  <>
                    Verify Cached Update
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
