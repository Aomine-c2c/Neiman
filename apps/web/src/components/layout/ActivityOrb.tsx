'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NEIMAN_CONFIG } from '@neiman/config';
import {
  Activity,
  Shield,
  Bot,
  Scale,
  GitBranch,
  Clock,
  ExternalLink,
  ChevronRight,
  Radio,
  X,
  Sparkles,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { governanceApi, GovernanceAuditLog } from '@/lib/api/governance';
import { useOrganizationContext } from '@/lib/organizationContext';

export type OrbSystemState = 'NOMINAL' | 'APPROVAL_REQUIRED' | 'REASONING' | 'ALERT';

interface ActivityOrbProps {
  className?: string;
}

export function ActivityOrb({ className = '' }: ActivityOrbProps) {
  const activeCompany = useOrganizationContext();
  const companyId = activeCompany?.id || '';
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'CRITICAL' | 'APPROVAL' | 'AGENT'>('ALL');

  // Query live audits/activities
  const { data: audits = [] } = useQuery({
    queryKey: ['governance-audits-live', companyId],
    queryFn: () => governanceApi.queryAudits(companyId, { limit: NEIMAN_CONFIG.OPERATIONAL_LIMITS.DEFAULT_AUDIT_LIMIT }),
    enabled: !!companyId,
    refetchInterval: NEIMAN_CONFIG.TELEMETRY.POLLING_INTERVALS.RAPID,
  });

  // Derive Orb State
  const hasPendingApproval = audits.some((a) => a.result === 'PENDING' || a.action.toLowerCase().includes('approval'));
  const hasAlert = audits.some((a) => a.result === 'DENIED' || a.result === 'BLOCKED');
  const hasReasoning = audits.some((a) => a.action.toLowerCase().includes('reasoning') || a.action.toLowerCase().includes('spec') || a.action.toLowerCase().includes('review'));

  let systemState: OrbSystemState = 'NOMINAL';
  if (hasAlert) systemState = 'ALERT';
  else if (hasPendingApproval) systemState = 'APPROVAL_REQUIRED';
  else if (hasReasoning) systemState = 'REASONING';

  // State visuals configuration
  const stateConfig = {
    NOMINAL: {
      color: 'from-emerald-400 to-teal-500',
      glow: 'shadow-[0_0_16px_rgba(16,185,129,0.5)]',
      border: 'border-emerald-400/40',
      ring: 'border-emerald-500/20',
      pulseSpeed: 'animate-[pulse_3s_ease-in-out_infinite]',
      label: 'Stream Nominal',
      badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    },
    APPROVAL_REQUIRED: {
      color: 'from-amber-400 to-yellow-500',
      glow: 'shadow-[0_0_20px_rgba(245,158,11,0.7)]',
      border: 'border-amber-400/60',
      ring: 'border-amber-500/30',
      pulseSpeed: 'animate-[pulse_1.2s_ease-in-out_infinite]',
      label: 'Approval Gate Pending',
      badge: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    },
    REASONING: {
      color: 'from-blue-500 to-indigo-600',
      glow: 'shadow-[0_0_18px_rgba(79,70,229,0.5)]',
      border: 'border-indigo-400/50',
      ring: 'border-indigo-500/20',
      pulseSpeed: 'animate-[pulse_2s_ease-in-out_infinite]',
      label: 'Deep Reasoning / Synthesis',
      badge: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
    },
    ALERT: {
      color: 'from-rose-500 to-red-600',
      glow: 'shadow-[0_0_22px_rgba(239,68,68,0.8)]',
      border: 'border-rose-400/70',
      ring: 'border-rose-500/40',
      pulseSpeed: 'animate-[ping_1.5s_cubic-bezier(0,0,0.2,1)_infinite]',
      label: 'Circuit Breaker / Violation',
      badge: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    },
  }[systemState];

  // Latest event for the ticker
  const latestAudit = audits.length > 0 ? audits[0] : null;
  const tickerText = latestAudit
    ? `${new Date(latestAudit.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${latestAudit.actor_name}: ${latestAudit.action}`
    : '09:42 · Architecture Agent completed system analysis';

  // Filtered list for the Radar Drawer
  const filteredAudits = audits.filter((item) => {
    if (activeFilter === 'CRITICAL') return item.result === 'BLOCKED' || item.result === 'DENIED';
    if (activeFilter === 'APPROVAL') return item.result === 'PENDING' || item.action.toLowerCase().includes('approval');
    if (activeFilter === 'AGENT') return item.actor_type === 'AGENT';
    return true;
  });

  return (
    <div className={`relative flex items-center gap-2.5 ${className}`}>
      {/* 1. THE ORGANIC ORB BUTTON */}
      <button
        type="button"
        onClick={() => setIsDrawerOpen(true)}
        className="relative group p-1 rounded-full focus:outline-none focus:ring-1 focus:ring-primary/40 transition-transform hover:scale-105"
        title={`NEIMAN Organic Core: ${stateConfig.label} (Click for Activity Radar)`}
        aria-label="Open System Activity Radar"
      >
        {/* Outer Aura Ring */}
        <span
          className={`absolute -inset-1 rounded-full border ${stateConfig.ring} opacity-70 group-hover:opacity-100 transition-opacity animate-[spin_10s_linear_infinite]`}
        />

        {/* Breathing Halo */}
        <span
          className={`absolute inset-0 rounded-full bg-gradient-to-r ${stateConfig.color} opacity-30 blur-sm ${stateConfig.pulseSpeed}`}
        />

        {/* Inner Solid Luminous Orb */}
        <span
          className={`relative block h-5 w-5 rounded-full bg-gradient-to-br ${stateConfig.color} ${stateConfig.glow} border ${stateConfig.border} transition-all`}
        >
          {/* Internal specular highlight reflection */}
          <span className="absolute top-0.5 left-1 h-1.5 w-1.5 rounded-full bg-white/70 blur-[0.4px]" />
        </span>
      </button>

      {/* 2. AMBIENT ACTIVITY TICKER */}
      <button
        type="button"
        onClick={() => setIsDrawerOpen(true)}
        className="hidden xl:flex items-center gap-2 max-w-[280px] text-left px-2.5 py-1 rounded-full border border-border/60 bg-secondary/30 hover:bg-secondary/60 hover:border-primary/30 transition-all group"
      >
        <Radio className="h-3 w-3 text-primary animate-pulse shrink-0" />
        <span className="text-[11px] font-mono text-muted-foreground group-hover:text-foreground truncate transition-colors">
          {tickerText}
        </span>
      </button>

      {/* 3. ACTIVITY TELEMETRY RADAR FLYOUT DRAWER */}
      {isDrawerOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-50 bg-background/50 backdrop-blur-sm transition-opacity animate-fade-in"
            onClick={() => setIsDrawerOpen(false)}
          />

          {/* Slide-over Drawer Panel */}
          <aside
            role="dialog"
            aria-label="Activity Telemetry Radar"
            className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-card/95 border-l border-primary/20 p-5 shadow-2xl backdrop-blur-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200"
          >
            {/* Header */}
            <div>
              <div className="flex items-center justify-between pb-3.5 border-b border-border/80">
                <div className="flex items-center gap-2.5">
                  <div className={`p-1.5 rounded-xl border ${stateConfig.badge}`}>
                    <Activity className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      Activity Telemetry Radar
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="relative flex h-2 w-2">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${stateConfig.color.replace('from-', 'bg-').split(' ')[0]}`} />
                        <span className={`relative inline-flex rounded-full h-2 w-2 ${stateConfig.color.replace('from-', 'bg-').split(' ')[0]}`} />
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wide">
                        {stateConfig.label}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1.5 my-3.5 overflow-x-auto pb-1 text-[11px] font-mono scrollbar-hide">
                {(['ALL', 'CRITICAL', 'APPROVAL', 'AGENT'] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setActiveFilter(filter)}
                    className={`px-2.5 py-1 rounded-lg border transition-all ${activeFilter === filter
                        ? 'bg-primary text-primary-foreground font-semibold border-primary shadow-xs'
                        : 'bg-secondary/40 text-muted-foreground border-border/60 hover:bg-secondary hover:text-foreground'
                      }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {/* Event Timeline Stream */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-3 scrollbar-thin">
              {filteredAudits.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                  <Activity className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-xs font-semibold">No recent activity detected</p>
                  <span className="text-[10px] opacity-70">Agent telemetries and actions will stream here live.</span>
                </div>
              ) : (
                filteredAudits.map((item) => {
                  const isBlocked = item.result === 'BLOCKED' || item.result === 'DENIED';
                  const isApproval = item.result === 'PENDING';
                  return (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl border border-border/70 bg-secondary/30 hover:bg-secondary/60 hover:border-primary/30 transition-all space-y-1.5 group"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1.5 font-semibold text-foreground">
                          {item.actor_type === 'AGENT' ? (
                            <Bot className="h-3.5 w-3.5 text-primary shrink-0" />
                          ) : (
                            <Shield className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                          )}
                          <span className="truncate max-w-[170px]">{item.actor_name}</span>
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3 opacity-60" />
                          {new Date(item.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>

                      <p className="text-xs text-foreground/90 font-medium leading-relaxed">
                        {item.action}
                      </p>

                      {item.target && (
                        <div className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                          <span className="text-muted-foreground/60">target:</span>
                          <span className="text-foreground/70 bg-card px-1.5 py-0.5 rounded border border-border/50 truncate max-w-[260px]">
                            {item.target}
                          </span>
                        </div>
                      )}

                      <div className="pt-1 flex items-center justify-between text-[10px]">
                        <span
                          className={`px-2 py-0.5 rounded-full font-mono font-semibold border ${isBlocked
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                              : isApproval
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            }`}
                        >
                          {item.result}
                        </span>

                        {isApproval && (
                          <Link
                            href="/dashboard/approvals"
                            onClick={() => setIsDrawerOpen(false)}
                            className="inline-flex items-center gap-1 text-amber-400 font-medium hover:underline"
                          >
                            Resolve <ChevronRight className="h-3 w-3" />
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-border/80 flex items-center justify-between gap-3 shrink-0">
              <Link
                href="/dashboard/activity"
                onClick={() => setIsDrawerOpen(false)}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium"
              >
                <span>Full Audit Stream</span>
                <ExternalLink className="h-3 w-3" />
              </Link>

              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="btn btn-secondary text-xs h-8 px-4"
              >
                Close Radar
              </button>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
