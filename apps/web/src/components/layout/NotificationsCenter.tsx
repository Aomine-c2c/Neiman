'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bell, ShieldAlert, CheckCircle, ArrowRight, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { NEIMAN_CONFIG } from '@neiman/config';
import { useOrganizationContext } from '@/lib/organizationContext';
import { governanceApi } from '@/lib/api/governance';

export function NotificationsCenter() {
  const [open, setOpen] = useState(false);
  const activeCompany = useOrganizationContext();
  const companyId = activeCompany?.id || '';

  const { data: pendingApprovals = [] } = useQuery({
    queryKey: ['pending-approvals-count', companyId],
    queryFn: () => governanceApi.listApprovals(companyId, 'PENDING'),
    enabled: !!companyId,
    refetchInterval: NEIMAN_CONFIG.TELEMETRY.POLLING_INTERVALS.BACKGROUND,
  });

  const count = pendingApprovals.length;

  return (
    <div className="relative">
      <button
        type="button"
        id="notifications-button"
        className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-border/80 bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label="View notifications and pending approvals"
      >
        <Bell className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-black animate-pulse">
            {count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute right-0 top-full mt-1.5 z-50 w-80 rounded-lg border border-border bg-card shadow-2xl p-3 space-y-2 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-border pb-2 px-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-foreground">Alerts & Gates</span>
                {count > 0 && (
                  <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.2 text-[9px] font-bold text-amber-500">
                    {count} PENDING
                  </span>
                )}
              </div>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-1.5">
              {pendingApprovals.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                  <CheckCircle className="h-6 w-6 text-emerald-400/80" />
                  <span>All governance gates clear. No pending human reviews.</span>
                </div>
              ) : (
                pendingApprovals.map((req) => (
                  <div
                    key={req.id}
                    className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-2.5 space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-medium text-amber-300">
                        <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                        {req.action}
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {req.risk_level}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2">
                      {req.reason || 'Supervisory executive approval required before autonomous execution.'}
                    </p>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-border/60 pt-2">
              <Link
                href="/dashboard/approvals"
                onClick={() => setOpen(false)}
                className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2 text-xs font-medium text-foreground hover:bg-secondary transition-colors"
              >
                <span>View all governance queues</span>
                <ArrowRight className="h-3.5 w-3.5 text-primary" />
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
