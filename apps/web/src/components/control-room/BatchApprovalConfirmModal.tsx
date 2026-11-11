'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, Check, Loader2, ShieldAlert, X } from 'lucide-react';

export interface BatchApprovalConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  action: 'APPROVED' | 'REJECTED';
  totalCount: number;
  riskBreakdown: {
    CRITICAL: number;
    HIGH: number;
    MEDIUM: number;
    LOW: number;
  };
  isProcessing?: boolean;
  targetDescription?: string;
}

export function BatchApprovalConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  action,
  totalCount,
  riskBreakdown,
  isProcessing = false,
  targetDescription,
}: BatchApprovalConfirmModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isProcessing) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isProcessing, onClose]);

  if (!isOpen) return null;

  const isApproval = action === 'APPROVED';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="batch-confirm-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-fade-in"
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl space-y-4 text-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                isApproval
                  ? 'bg-primary/10 text-primary'
                  : 'bg-destructive/10 text-destructive'
              }`}
            >
              {isApproval ? (
                <ShieldAlert className="h-5 w-5" />
              ) : (
                <AlertTriangle className="h-5 w-5" />
              )}
            </div>
            <div>
              <h2 id="batch-confirm-title" className="text-sm font-semibold text-foreground">
                Confirm Batch {isApproval ? 'Approval' : 'Rejection'}
              </h2>
              <p className="text-xs text-muted-foreground">
                {totalCount} pending {totalCount === 1 ? 'action requires' : 'actions require'} sign-off
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            aria-label="Close dialog"
            className="p-1 rounded-md text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Target Description */}
        {targetDescription && (
          <div className="rounded-lg border border-border bg-secondary/30 p-2.5 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Scope: </span>
            {targetDescription}
          </div>
        )}

        {/* Risk Breakdown Matrix */}
        <div className="space-y-1.5">
          <p className="text-[11px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">
            Risk Tier Distribution
          </p>
          <div className="grid grid-cols-4 gap-2">
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2 text-center">
              <span className="block text-[10px] font-mono font-bold uppercase text-rose-500">
                Critical
              </span>
              <span className="text-base font-bold font-mono text-rose-600 dark:text-rose-400">
                {riskBreakdown.CRITICAL}
              </span>
            </div>
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-center">
              <span className="block text-[10px] font-mono font-bold uppercase text-amber-500">
                High
              </span>
              <span className="text-base font-bold font-mono text-amber-600 dark:text-amber-400">
                {riskBreakdown.HIGH}
              </span>
            </div>
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-2 text-center">
              <span className="block text-[10px] font-mono font-bold uppercase text-blue-500">
                Medium
              </span>
              <span className="text-base font-bold font-mono text-blue-600 dark:text-blue-400">
                {riskBreakdown.MEDIUM}
              </span>
            </div>
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2 text-center">
              <span className="block text-[10px] font-mono font-bold uppercase text-emerald-500">
                Low
              </span>
              <span className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {riskBreakdown.LOW}
              </span>
            </div>
          </div>
        </div>

        {/* Explanatory Warning */}
        <p className="text-xs text-muted-foreground">
          {isApproval
            ? `Authorizing these ${totalCount} action(s) immediately releases execution locks for autonomous worker agents.`
            : `Rejecting these ${totalCount} action(s) halts execution and triggers supervisory escalation.`}
        </p>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm()}
            disabled={isProcessing}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold text-white transition-colors disabled:opacity-50 ${
              isApproval
                ? 'bg-primary hover:bg-primary/90'
                : 'bg-destructive hover:bg-destructive/90'
            }`}
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Processing…</span>
              </>
            ) : isApproval ? (
              <>
                <Check className="h-3.5 w-3.5" />
                <span>Confirm Approve ({totalCount})</span>
              </>
            ) : (
              <>
                <X className="h-3.5 w-3.5" />
                <span>Confirm Reject ({totalCount})</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

