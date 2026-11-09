'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NEIMAN_CONFIG } from '@neiman/config';
import {
  Cpu,
  Server,
  Coins,
  Zap,
  Activity,
  Layers,
  ChevronDown,
  ArrowRight,
  ShieldAlert,
  Sliders,
  RotateCw,
} from 'lucide-react';
import { resourcesApi } from '@/lib/api/resources';
import { useOrganizationContext } from '@/lib/organizationContext';
import { isDevelopmentAuthBypassEnabled } from '@/lib/authPreview';

interface SystemResourcePillProps {
  onOpenDrawer: () => void;
}

export function SystemResourcePill({ onOpenDrawer }: SystemResourcePillProps) {
  const activeCompany = useOrganizationContext();
  const companyId = activeCompany?.id || '';
  const previewMode = isDevelopmentAuthBypassEnabled();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close flyout on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setPopoverOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch live resource control telemetry
  const { data: controlCenter, isRefetching, refetch } = useQuery({
    queryKey: ['resources-control-center-pill', companyId],
    queryFn: () => resourcesApi.getControlCenter(companyId),
    enabled: !!companyId,
    staleTime: NEIMAN_CONFIG.TELEMETRY.STALE_TIMES.FAST,
    refetchInterval: NEIMAN_CONFIG.TELEMETRY.POLLING_INTERVALS.SLOW,
  });

  const host = controlCenter?.system_host_telemetry;
  const budget = controlCenter?.budget_consumption;
  const bottlenecks = controlCenter?.bottlenecks || [];

  // Determine system status health indicator
  const hasBottlenecks = bottlenecks.length > 0;
  const cpuCores = host?.cpu_cores_available ?? 16;
  const ramGb = host?.ram_total_mb ? Math.round(host.ram_total_mb / 1024) : 32;
  const spentUsd = budget?.spent_budget_usd ? budget.spent_budget_usd.toFixed(0) : '18';
  const totalUsd = budget?.total_budget_usd ? budget.total_budget_usd.toFixed(0) : '50';

  return (
    <div className="relative font-mono" ref={containerRef}>
      {/* Persistent Pill Button */}
      <button
        type="button"
        onClick={() => setPopoverOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-full border border-border/60 bg-secondary/30 hover:bg-secondary/70 px-3 py-1 text-xs text-foreground transition-all duration-150 group"
        aria-label="System resource monitor"
      >
        {/* Pulsing telemetry dot */}
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            hasBottlenecks
              ? 'bg-amber-400 shadow-[0_0_6px_#f59e0b]'
              : 'bg-emerald-400 shadow-[0_0_6px_#10b981]'
          }`}
        />

        {/* CPU */}
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground group-hover:text-foreground transition-colors font-mono">
          <Cpu className="h-3 w-3 text-[#D71921]" />
          <span>{cpuCores}C</span>
        </div>

        <span className="text-border/60">/</span>

        {/* RAM */}
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground group-hover:text-foreground transition-colors font-mono">
          <Server className="h-3 w-3 text-cyan-400" />
          <span>{ramGb}G</span>
        </div>

        <span className="text-border/60 hidden sm:inline">/</span>

        {/* Spend */}
        <div className="hidden sm:flex items-center gap-1 text-[11px] text-muted-foreground group-hover:text-foreground transition-colors font-mono">
          <Coins className="h-3 w-3 text-amber-400" />
          <span>${spentUsd}/${totalUsd}</span>
        </div>

        <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform duration-200 ${popoverOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Popover Flyout */}
      {popoverOpen && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-80 rounded-lg border border-border bg-card p-3.5 shadow-2xl animate-in fade-in-50 zoom-in-95">
          <div className="flex items-center justify-between pb-2.5 border-b border-border">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                System Telemetry
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground font-bold">
                {previewMode ? 'SYNTHETIC' : 'LIVE'}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  refetch();
                }}
                className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                title="Refresh metrics"
              >
                <RotateCw className={`h-3 w-3 ${isRefetching ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 gap-2 py-3 text-xs">
            <div className="rounded-lg border border-border/60 bg-secondary/30 p-2.5 space-y-1">
              <span className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                <Cpu className="h-3 w-3 text-primary" /> Host Compute
              </span>
              <div className="font-bold text-foreground">{cpuCores} Cores</div>
              <div className="text-[10px] text-emerald-400">Nominal Load</div>
            </div>

            <div className="rounded-lg border border-border/60 bg-secondary/30 p-2.5 space-y-1">
              <span className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                <Server className="h-3 w-3 text-blue-400" /> Host Memory
              </span>
              <div className="font-bold text-foreground">{ramGb} GB RAM</div>
              <div className="text-[10px] text-muted-foreground">CGroup Enforced</div>
            </div>

            <div className="rounded-lg border border-border/60 bg-secondary/30 p-2.5 space-y-1">
              <span className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                <Coins className="h-3 w-3 text-emerald-400" /> Token Spend
              </span>
              <div className="font-bold text-foreground">${spentUsd} / ${totalUsd}</div>
              <div className="text-[10px] text-muted-foreground">{budget?.burn_rate_percent ?? 36}% allocated</div>
            </div>

            <div className="rounded-lg border border-border/60 bg-secondary/30 p-2.5 space-y-1">
              <span className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                <Layers className="h-3 w-3 text-purple-400" /> Active Slots
              </span>
              <div className="font-bold text-foreground">
                {controlCenter?.active_allocations_count ?? 6} / 12
              </div>
              <div className="text-[10px] text-primary">Orchestration Ok</div>
            </div>
          </div>

          {/* Bottlenecks Warning if any */}
          {hasBottlenecks && (
            <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs space-y-1">
              <div className="flex items-center gap-1.5 text-amber-400 font-semibold text-[11px]">
                <ShieldAlert className="h-3.5 w-3.5" />
                <span>Operational Bottleneck Detected</span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                {bottlenecks.length} resource pool nearing capacity ceiling.
              </p>
            </div>
          )}

          {/* Drawer CTA */}
          <button
            type="button"
            onClick={() => {
              setPopoverOpen(false);
              onOpenDrawer();
            }}
            className="w-full flex items-center justify-between rounded-lg bg-primary/10 border border-primary/30 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
          >
            <span>Open Resource Cockpit Drawer</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
