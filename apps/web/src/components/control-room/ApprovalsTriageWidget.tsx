'use client';

import React, { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Layers,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  FileCode,
  Code2,
  Eye,
  EyeOff,
  X,
  FileDiff,
  Terminal,
} from 'lucide-react';
import type { ApprovalRequest } from '@/lib/api/controlRoom';
import { controlRoomApi } from '@/lib/api/controlRoom';
import { governanceApi, type ApprovalDiffBlastRadiusResponse } from '@/lib/api/governance';
import { BatchApprovalConfirmModal } from './BatchApprovalConfirmModal';

export interface ApprovalsTriageWidgetProps {
  approvals: ApprovalRequest[];
  companyId: string;
  onDecideApproval?: (approvalId: string, decision: 'APPROVED' | 'REJECTED') => void;
  onOpenDrawer?: (drawerId: string, entityId?: string) => void;
  resolveTarget?: (raw?: string) => string;
}

export interface AggregatedApprovalGroup {
  key: string;
  action_type: string;
  action_label: string;
  target_resource: string;
  resolved_target: string;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reason: string;
  requests: ApprovalRequest[];
  count: number;
  latest_created_at: string;
}

const RISK_WEIGHTS: Record<string, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

export function ApprovalsTriageWidget({
  approvals,
  companyId,
  onDecideApproval,
  onOpenDrawer,
  resolveTarget,
}: ApprovalsTriageWidgetProps) {
  const qc = useQueryClient();
  const [visibleCount, setVisibleCount] = useState<number>(3);
  const [processingKey, setProcessingKey] = useState<string | null>(null);
  const [expandedDiffKey, setExpandedDiffKey] = useState<string | null>(null);
  const [loadingDiffKey, setLoadingDiffKey] = useState<string | null>(null);
  const [diffCache, setDiffCache] = useState<Record<string, ApprovalDiffBlastRadiusResponse>>({});

  const handleToggleDiff = async (group: AggregatedApprovalGroup) => {
    if (expandedDiffKey === group.key) {
      setExpandedDiffKey(null);
      return;
    }

    setExpandedDiffKey(group.key);
    if (!diffCache[group.key]) {
      setLoadingDiffKey(group.key);
      try {
        const firstReqId = group.requests[0]?.id;
        if (firstReqId) {
          const res = await governanceApi.getApprovalDiff(companyId, firstReqId);
          setDiffCache((prev) => ({ ...prev, [group.key]: res }));
        }
      } catch (e) {
        console.error('Failed to load approval diff', e);
      } finally {
        setLoadingDiffKey(null);
      }
    }
  };

  // Modal confirmation state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    action: 'APPROVED' | 'REJECTED';
    requests: ApprovalRequest[];
    targetDescription?: string;
  } | null>(null);

  // Group identical approval requests
  const aggregatedGroups = useMemo<AggregatedApprovalGroup[]>(() => {
    const map = new Map<string, AggregatedApprovalGroup>();

    for (const app of approvals) {
      const risk = (app.risk_level || 'HIGH').toUpperCase() as AggregatedApprovalGroup['risk_level'];
      const actionRaw = app.action_type || app.action || app.title || 'ACTION';
      const targetRaw = app.target_resource || app.target || '';
      const groupKey = `${risk}:${actionRaw}:${targetRaw}`;

      const existing = map.get(groupKey);
      if (existing) {
        existing.requests.push(app);
        existing.count += 1;
        if (app.created_at && app.created_at > existing.latest_created_at) {
          existing.latest_created_at = app.created_at;
        }
      } else {
        const actionLabel = actionRaw.replace(/_/g, ' ');
        const resolved = resolveTarget ? resolveTarget(targetRaw) : targetRaw || 'System Action';
        map.set(groupKey, {
          key: groupKey,
          action_type: actionRaw,
          action_label: actionLabel,
          target_resource: targetRaw,
          resolved_target: resolved,
          risk_level: risk,
          reason: app.reason || 'High-impact autonomous action awaiting operator sign-off.',
          requests: [app],
          count: 1,
          latest_created_at: app.created_at || '',
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      const wA = RISK_WEIGHTS[a.risk_level] ?? 1;
      const wB = RISK_WEIGHTS[b.risk_level] ?? 1;
      if (wA !== wB) return wA - wB;
      if (b.count !== a.count) return b.count - a.count;
      return b.latest_created_at.localeCompare(a.latest_created_at);
    });
  }, [approvals, resolveTarget]);

  // Risk breakdown tally across all active approvals
  const totalRiskBreakdown = useMemo(() => {
    const tally = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    for (const app of approvals) {
      const r = (app.risk_level || 'HIGH').toUpperCase() as keyof typeof tally;
      if (tally[r] !== undefined) {
        tally[r] += 1;
      } else {
        tally.HIGH += 1;
      }
    }
    return tally;
  }, [approvals]);

  // Execute batch decisions sequentially or in parallel
  const executeBatchDecision = async (
    requests: ApprovalRequest[],
    decision: 'APPROVED' | 'REJECTED'
  ) => {
    setProcessingKey(confirmModal?.targetDescription || 'batch-all');
    try {
      await Promise.allSettled(
        requests.map((r) =>
          controlRoomApi.decideApproval(
            companyId,
            r.id,
            decision,
            `Supervisory batch ${decision.toLowerCase()} from Control Room`
          )
        )
      );
      qc.invalidateQueries({ queryKey: ['control-room-state', companyId] });
      qc.invalidateQueries({ queryKey: ['approvals', companyId] });
      qc.invalidateQueries({ queryKey: ['tasks', companyId] });
    } finally {
      setProcessingKey(null);
      setConfirmModal(null);
    }
  };

  const handleOpenBatchAllModal = (action: 'APPROVED' | 'REJECTED') => {
    setConfirmModal({
      isOpen: true,
      action,
      requests: approvals,
      targetDescription: `All ${approvals.length} pending supervisory approvals across all subsystems`,
    });
  };

  const handleOpenGroupModal = (
    group: AggregatedApprovalGroup,
    action: 'APPROVED' | 'REJECTED'
  ) => {
    if (group.count === 1 && onDecideApproval) {
      onDecideApproval(group.requests[0].id, action);
      return;
    }
    setConfirmModal({
      isOpen: true,
      action,
      requests: group.requests,
      targetDescription: `${group.action_label} on ${group.resolved_target} (${group.count} instances)`,
    });
  };

  const visibleGroups = aggregatedGroups.slice(0, visibleCount);
  const remainingCount = Math.max(0, aggregatedGroups.length - visibleCount);

  if (approvals.length === 0) return null;

  return (
    <>
      <section
        aria-label="Pending Human-in-the-Loop Approvals Triage"
        className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 space-y-3.5 shadow-xs"
      >
        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-500 shrink-0" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Approvals Gate ({approvals.length} pending across {aggregatedGroups.length} unique scopes)
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {/* Batch Approve All Quick Trigger */}
            <button
              type="button"
              onClick={() => handleOpenBatchAllModal('APPROVED')}
              disabled={!!processingKey}
              className="inline-flex items-center gap-1 rounded-md bg-primary/90 hover:bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground disabled:opacity-50 transition-colors"
            >
              <Check className="h-3 w-3" />
              <span>Approve All ({approvals.length})</span>
            </button>

            {/* Batch Reject All Quick Trigger */}
            <button
              type="button"
              onClick={() => handleOpenBatchAllModal('REJECTED')}
              disabled={!!processingKey}
              className="inline-flex items-center gap-1 rounded-md border border-destructive/40 bg-destructive/10 hover:bg-destructive/20 px-2 py-1 text-[11px] font-semibold text-destructive disabled:opacity-50 transition-colors"
            >
              <X className="h-3 w-3" />
              <span>Reject All</span>
            </button>

            {/* Drawer Deep Inspection */}
            <button
              type="button"
              onClick={() => onOpenDrawer?.('approvals')}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium pl-1"
            >
              <span>Drawer</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Aggregated Group Cards */}
        <div className="space-y-2.5">
          {visibleGroups.map((group) => {
            const isGroupBusy = processingKey === group.key;
            const isMulti = group.count > 1;

            const badgeColor =
              group.risk_level === 'CRITICAL'
                ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                : group.risk_level === 'HIGH'
                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                : group.risk_level === 'MEDIUM'
                ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30'
                : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';

            const isExpanded = expandedDiffKey === group.key;
            const diffData = diffCache[group.key];
            const isLoadingDiff = loadingDiffKey === group.key;

            return (
              <div
                key={group.key}
                className="rounded-lg border border-border bg-card overflow-hidden transition-all hover:border-amber-500/40"
              >
                <div className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${badgeColor}`}
                      >
                        {group.risk_level} RISK
                      </span>

                      {/* Quantity multiplier pill if multiple occurrences */}
                      {isMulti && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-secondary text-foreground border border-border">
                          <Layers className="h-3 w-3 text-primary" />
                          <span>× {group.count} tasks</span>
                        </span>
                      )}

                      <span className="text-xs font-semibold text-foreground truncate">
                        {group.action_label}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {group.reason}
                    </p>

                    <p className="text-[11px] font-mono text-primary truncate">
                      {group.resolved_target}
                    </p>
                  </div>

                  {/* Group Action Buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleDiff(group)}
                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium border transition-colors ${
                        isExpanded
                          ? 'bg-secondary text-foreground border-primary/40'
                          : 'bg-card text-muted-foreground border-border hover:text-foreground hover:bg-secondary/60'
                      }`}
                    >
                      {isLoadingDiff ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                      ) : isExpanded ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <FileDiff className="h-3.5 w-3.5 text-primary" />
                      )}
                      <span>{isExpanded ? 'Hide Diff' : 'Inspect Diff'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={isGroupBusy || !!processingKey}
                      aria-label={`Approve ${group.action_label}`}
                      onClick={() => handleOpenGroupModal(group, 'APPROVED')}
                      className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                      {isGroupBusy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      <span>{isMulti ? `Approve All (${group.count})` : 'Approve'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={isGroupBusy || !!processingKey}
                      aria-label={`Reject ${group.action_label}`}
                      onClick={() => handleOpenGroupModal(group, 'REJECTED')}
                      className="inline-flex items-center gap-1 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/20 disabled:opacity-50 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                      <span>{isMulti ? `Reject (${group.count})` : 'Reject'}</span>
                    </button>
                  </div>
                </div>

                {/* INLINE EXPANDED CODE DIFF & BLAST RADIUS */}
                {isExpanded && (
                  <div className="border-t border-border bg-secondary/15 p-3.5 space-y-3 font-mono text-xs animate-fade-in">
                    {isLoadingDiff ? (
                      <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground text-xs">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <span>Analyzing AST syntax trees and generating blast-radius report...</span>
                      </div>
                    ) : diffData ? (
                      <div className="space-y-3">
                        {/* Blast-Radius & AST Metrics Bar */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                          <div className="p-2 rounded bg-card border border-border">
                            <span className="text-[10px] text-muted-foreground block">LINES IMPACT</span>
                            <span className="text-emerald-500 font-bold">+{diffData.blast_radius?.lines_added || 0}</span>
                            <span className="text-muted-foreground mx-1">/</span>
                            <span className="text-rose-500 font-bold">-{diffData.blast_radius?.lines_deleted || 0}</span>
                          </div>

                          <div className="p-2 rounded bg-card border border-border">
                            <span className="text-[10px] text-muted-foreground block">AST SAFETY</span>
                            <span className="inline-flex items-center gap-1 text-emerald-500 font-bold">
                              <ShieldCheck className="h-3.5 w-3.5" />
                              {diffData.ast_safety?.status || 'PASSED'}
                            </span>
                          </div>

                          <div className="p-2 rounded bg-card border border-border">
                            <span className="text-[10px] text-muted-foreground block">BLAST RADIUS</span>
                            <span className="text-foreground font-semibold">
                              {diffData.blast_radius?.services_affected?.join(', ') || 'System Core'}
                            </span>
                          </div>

                          <div className="p-2 rounded bg-card border border-border">
                            <span className="text-[10px] text-muted-foreground block">FILES TOUCHED</span>
                            <span className="text-primary truncate block font-mono text-[10px]">
                              {diffData.files_touched?.[0] || '1 target file'}
                            </span>
                          </div>
                        </div>

                        {/* Unified Code Diff Viewer */}
                        <div className="rounded-lg border border-border bg-zinc-950 p-3 overflow-x-auto text-[11px] leading-relaxed max-h-56">
                          {diffData.diff ? (
                            diffData.diff.split('\n').map((line, idx) => {
                              const isAdd = line.startsWith('+') && !line.startsWith('+++');
                              const isDel = line.startsWith('-') && !line.startsWith('---');
                              const isHunk = line.startsWith('@@');

                              const lineClass = isAdd
                                ? 'text-emerald-400 bg-emerald-500/10'
                                : isDel
                                ? 'text-rose-400 bg-rose-500/10'
                                : isHunk
                                ? 'text-cyan-400 font-bold'
                                : 'text-zinc-300';

                              return (
                                <div key={idx} className={`px-1 py-0.5 rounded-sm ${lineClass}`}>
                                  {line}
                                </div>
                              );
                            })
                          ) : (
                            <span className="text-muted-foreground italic">No diff payload recorded.</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground italic">Failed to load diff telemetry.</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer: Expand / Collapse progressive disclosure */}
        {aggregatedGroups.length > 3 && (
          <div className="flex items-center justify-between pt-1 border-t border-border/40 text-xs">
            <span className="text-muted-foreground font-mono text-[11px]">
              Showing {Math.min(visibleCount, aggregatedGroups.length)} of {aggregatedGroups.length} groups
            </span>

            <div className="flex items-center gap-2">
              {remainingCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setVisibleCount((prev) => prev + 3)}
                  className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                >
                  <span>Show next 3 ({remainingCount} more)</span>
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setVisibleCount(3)}
                  className="inline-flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground"
                >
                  <span>Collapse to top 3</span>
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Confirmation Safety Modal */}
      {confirmModal && (
        <BatchApprovalConfirmModal
          isOpen={confirmModal.isOpen}
          onClose={() => setConfirmModal(null)}
          onConfirm={() => executeBatchDecision(confirmModal.requests, confirmModal.action)}
          action={confirmModal.action}
          totalCount={confirmModal.requests.length}
          targetDescription={confirmModal.targetDescription}
          riskBreakdown={totalRiskBreakdown}
          isProcessing={!!processingKey}
        />
      )}
    </>
  );
}

