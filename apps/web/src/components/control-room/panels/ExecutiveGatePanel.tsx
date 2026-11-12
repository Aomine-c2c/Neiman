'use client';

import React, { useState } from 'react';
import {
  ShieldAlert,
  Check,
  X,
  ExternalLink,
  AlertTriangle,
  Clock,
  Coins,
  ChevronRight,
  ShieldCheck,
  Eye,
} from 'lucide-react';
import type { ApprovalRequest } from '@/lib/api/controlRoom';

interface ExecutiveGatePanelProps {
  approvals: ApprovalRequest[];
  onDecideApproval?: (approvalId: string, decision: 'APPROVED' | 'REJECTED') => void;
  onOpenDrawer?: (drawerId: string) => void;
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
}

export function ExecutiveGatePanel({
  approvals,
  onDecideApproval,
  onOpenDrawer,
  isMinimized,
  onToggleMinimize,
}: ExecutiveGatePanelProps) {
  const pendingList = approvals.filter((a) => a.status === 'PENDING');
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(pendingList[0] || null);

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case 'CRITICAL':
        return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
      case 'HIGH':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      case 'MEDIUM':
        return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30';
      default:
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    }
  };

  if (isMinimized) {
    return (
      <div className="neiman-panel rounded-lg p-2.5 flex items-center justify-between font-mono text-xs w-72">
        <div className="flex items-center gap-2">
          <ShieldAlert className={`h-4 w-4 ${pendingList.length > 0 ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`} />
          <span className="font-bold text-foreground tracking-wider uppercase text-[11px]">Executive Gate</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded border font-bold ${pendingList.length > 0 ? 'text-rose-400 bg-rose-500/10 border-rose-500/30' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'}`}>
            {pendingList.length} PENDING
          </span>
        </div>
        <button
          type="button"
          onClick={onToggleMinimize}
          className="text-muted-foreground hover:text-foreground text-[10px] uppercase font-bold"
        >
          Expand
        </button>
      </div>
    );
  }

  return (
    <div className="neiman-panel rounded-xl flex flex-col font-mono text-xs overflow-hidden select-none w-80 lg:w-92 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-cyan-500/20 bg-background/50">
        <div className="flex items-center gap-2">
          <ShieldAlert className={`h-4 w-4 ${pendingList.length > 0 ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`} />
          <span className="font-bold text-foreground uppercase tracking-widest text-[11px]">
            Executive Gate
          </span>
          <span
            className={`text-[9px] font-bold px-1.5 py-0.2 rounded border uppercase tracking-wider ${
              pendingList.length > 0
                ? 'text-rose-400 bg-rose-500/10 border-rose-500/30 animate-pulse'
                : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
            }`}
          >
            {pendingList.length > 0 ? `${pendingList.length} ACTION REQ` : 'CLEAR'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onOpenDrawer?.('approvals')}
            className="p-1 rounded text-muted-foreground hover:text-cyan-400 hover:bg-secondary/40 transition-colors"
            title="Open Complete Governance Hub"
          >
            <ExternalLink className="h-3 w-3" />
          </button>
          {onToggleMinimize && (
            <button
              type="button"
              onClick={onToggleMinimize}
              className="px-1 py-0.5 text-[9px] text-muted-foreground hover:text-foreground rounded"
            >
              _
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-3 space-y-2.5 max-h-[290px] overflow-y-auto">
        {pendingList.length === 0 ? (
          <div className="py-6 flex flex-col items-center justify-center text-center space-y-2">
            <div className="h-9 w-9 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">Human-in-the-Loop Nominal</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Zero escalations pending. All agent autonomy boundaries within policy.
              </p>
            </div>
          </div>
        ) : (
          pendingList.map((appr) => {
            const isCritical = appr.risk_level === 'CRITICAL';
            const riskClass = getRiskBadge(appr.risk_level);
            const details = (appr.details || {}) as Record<string, unknown>;

            return (
              <div
                key={appr.id}
                className={`p-2.5 rounded-lg border transition-all ${
                  isCritical
                    ? 'border-rose-500/40 bg-rose-950/20 shadow-[0_0_12px_rgba(244,63,94,0.12)]'
                    : 'border-cyan-500/20 bg-secondary/20 hover:border-cyan-500/40'
                }`}
              >
                {/* Action Type & Risk Pill */}
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="font-bold text-foreground text-xs truncate uppercase">
                    {(appr.action_type || appr.action || appr.title || 'AUTONOMOUS_ACTION').replace(/_/g, ' ')}
                  </span>
                  <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded border uppercase tracking-wider ${riskClass}`}>
                    {appr.risk_level} RISK
                  </span>
                </div>

                {/* Target & Reason */}
                <div className="space-y-1 mb-2">
                  <p className="text-[10px] text-muted-foreground font-mono truncate">
                    Target: <span className="text-cyan-400">{appr.target_resource || appr.target || 'system'}</span>
                  </p>
                  <p className="text-[11px] text-foreground leading-snug">
                    {appr.reason}
                  </p>
                </div>

                {/* Evidence & Projected Impact Box */}
                {Boolean(details.estimated_duration || details.projected_cost || details.risk_assessment) && (
                  <div className="p-2 rounded bg-black/40 border border-border/30 text-[9px] text-muted-foreground space-y-0.5 mb-2.5">
                    {Boolean(details.estimated_duration) && (
                      <div className="flex justify-between">
                        <span>Duration:</span>
                        <span className="text-foreground font-bold">{String(details.estimated_duration)}</span>
                      </div>
                    )}
                    {Boolean(details.projected_cost) && (
                      <div className="flex justify-between">
                        <span>Projected Spend:</span>
                        <span className="text-amber-400 font-bold">{String(details.projected_cost)}</span>
                      </div>
                    )}
                    {Boolean(details.risk_assessment) && (
                      <div className="text-[9px] text-rose-400/90 pt-0.5 truncate">
                        Impact: {String(details.risk_assessment)}
                      </div>
                    )}
                  </div>
                )}

                {/* Approve / Reject Controls */}
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/20">
                  <button
                    type="button"
                    onClick={() => onDecideApproval?.(appr.id, 'REJECTED')}
                    className="px-2.5 py-1 rounded border border-rose-500/40 bg-rose-500/10 text-rose-400 text-[10px] font-bold hover:bg-rose-500/20 transition-colors flex items-center gap-1"
                  >
                    <X className="h-3 w-3" />
                    <span>Reject</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDecideApproval?.(appr.id, 'APPROVED')}
                    className="px-3 py-1 rounded border border-emerald-500/40 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold hover:bg-emerald-500/30 transition-colors flex items-center gap-1 shadow-[0_0_8px_rgba(16,185,129,0.2)]"
                  >
                    <Check className="h-3 w-3" />
                    <span>Approve Escalation</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
