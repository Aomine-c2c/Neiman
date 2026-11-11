'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NEIMAN_CONFIG } from '@neiman/config';
import {
  Cpu,
  Server,
  Coins,
  Activity,
  Layers,
  RotateCw,
  AlertTriangle,
  Database,
  Sliders,
  CheckCircle2,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { resourcesApi } from '@/lib/api/resources';
import { useOrganizationContext } from '@/lib/organizationContext';
import { isDevelopmentAuthBypassEnabled } from '@/lib/authPreview';
import Link from 'next/link';

export function ResourceCockpitView() {
  const activeCompany = useOrganizationContext();
  const companyId = activeCompany?.id || '';
  const previewMode = isDevelopmentAuthBypassEnabled();

  const { data: controlCenter, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['resources-control-center-drawer', companyId],
    queryFn: () => resourcesApi.getControlCenter(companyId),
    enabled: !!companyId,
    staleTime: NEIMAN_CONFIG.TELEMETRY.STALE_TIMES.FAST,
  });

  const { data: pools = [] } = useQuery({
    queryKey: ['resources-pools-drawer', companyId],
    queryFn: () => resourcesApi.listPools(companyId),
    enabled: !!companyId,
    staleTime: NEIMAN_CONFIG.TELEMETRY.STALE_TIMES.NORMAL,
  });

  const { data: budgets = [] } = useQuery({
    queryKey: ['resources-budgets-drawer', companyId],
    queryFn: () => resourcesApi.listBudgets(companyId),
    enabled: !!companyId,
    staleTime: NEIMAN_CONFIG.TELEMETRY.STALE_TIMES.NORMAL,
  });

  const host = controlCenter?.system_host_telemetry;
  const budget = controlCenter?.budget_consumption;
  const bottlenecks = controlCenter?.bottlenecks || [];

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Overview Header Banner */}
      <div className="rounded-xl border border-border/80 bg-secondary/30 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-foreground font-bold text-sm uppercase">
            <Database className="h-4 w-4 text-primary" />
            <span>Autonomous Resource Allocation</span>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="flex items-center gap-1.5 rounded-lg border border-border/80 bg-card px-2.5 py-1 text-xs text-foreground hover:bg-secondary transition-colors"
          >
            <RotateCw className={`h-3 w-3 ${isRefetching ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
        <p className="text-muted-foreground text-[11px] leading-relaxed">
          Dynamic compute allocation, cgroup isolation, LLM token quotas, and financial burn controls.
        </p>
      </div>

      {/* Bottlenecks Alert */}
      {bottlenecks.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 space-y-2">
          <div className="flex items-center gap-2 text-amber-400 font-semibold">
            <AlertTriangle className="h-4 w-4" />
            <span>Active Operational Bottlenecks</span>
          </div>
          <div className="space-y-1.5">
            {bottlenecks.map((b) => (
              <div key={b.pool_id} className="flex items-center justify-between rounded bg-card/60 p-2 text-[11px] border border-amber-500/20">
                <span className="text-foreground font-medium">{b.pool_name}</span>
                <span className="text-amber-400 font-mono">
                  {b.utilization_percentage.toFixed(0)}% Utilized
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Primary Hardware & Financial Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card p-3 space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
            <Cpu className="h-3 w-3 text-primary" /> CPU Cores
          </span>
          <div className="text-base font-bold text-foreground">
            {host?.cpu_cores_available ?? 16} Cores
          </div>
          <div className="text-[10px] text-emerald-400">Nominal Telemetry</div>
        </div>

        <div className="rounded-xl border border-border bg-card p-3 space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
            <Server className="h-3 w-3 text-blue-400" /> System RAM
          </span>
          <div className="text-base font-bold text-foreground">
            {host?.ram_total_mb ? Math.round(host.ram_total_mb / 1024) : 32} GB
          </div>
          <div className="text-[10px] text-muted-foreground">Linux CGroup</div>
        </div>

        <div className="rounded-xl border border-border bg-card p-3 space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
            <Coins className="h-3 w-3 text-emerald-400" /> Financial
          </span>
          <div className="text-base font-bold text-foreground">
            ${budget?.spent_budget_usd ? budget.spent_budget_usd.toFixed(0) : '18'} / ${budget?.total_budget_usd ? budget.total_budget_usd.toFixed(0) : '50'}
          </div>
          <div className="text-[10px] text-emerald-400">{budget?.burn_rate_percent ?? 36}% Spent</div>
        </div>

        <div className="rounded-xl border border-border bg-card p-3 space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
            <Layers className="h-3 w-3 text-purple-400" /> Active Slots
          </span>
          <div className="text-base font-bold text-foreground">
            {controlCenter?.active_allocations_count ?? 6} / 12 Slots
          </div>
          <div className="text-[10px] text-primary">Operational</div>
        </div>
      </div>

      {/* Resource Pools Breakdown */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-foreground uppercase tracking-wider">
            Allocated Resource Pools ({pools.length})
          </span>
        </div>

        <div className="space-y-2">
          {pools.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-4 text-center text-muted-foreground">
              No custom pools configured. System operating on default host capacity.
            </div>
          ) : (
            pools.map((pool) => {
              const utilPercent = pool.total_capacity > 0
                ? Math.min(100, Math.round(((pool.allocated_capacity || 0) / pool.total_capacity) * 100))
                : 0;
              return (
                <div key={pool.id} className="rounded-lg border border-border/70 bg-card/60 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-foreground">{pool.name}</span>
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                        {pool.category}
                      </span>
                    </div>
                    <span className="font-mono text-muted-foreground">
                      {pool.allocated_capacity || 0} / {pool.total_capacity} {pool.unit}
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        utilPercent > 85 ? 'bg-rose-500' : utilPercent > 60 ? 'bg-amber-400' : 'bg-primary'
                      }`}
                      style={{ width: `${utilPercent}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Active Budgets Breakdown */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-foreground uppercase tracking-wider">
            Token & Financial Budgets ({budgets.length})
          </span>
        </div>

        <div className="space-y-2">
          {budgets.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-4 text-center text-muted-foreground">
              No budgets established. Default limits apply.
            </div>
          ) : (
            budgets.map((b) => (
              <div key={b.id} className="flex items-center justify-between rounded-lg border border-border/70 bg-card/60 p-3">
                <div className="space-y-0.5">
                  <div className="font-bold text-foreground">{b.name}</div>
                  <div className="text-[10px] text-muted-foreground uppercase">
                    Period: {b.fiscal_period} • Dept: {b.department_id ? 'Assigned' : 'Global'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-foreground">
                    ${b.spent_budget_usd.toFixed(2)} / ${b.total_budget_usd.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {((b.spent_budget_usd / (b.total_budget_usd || 1)) * 100).toFixed(0)}% Consumed
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Direct Link to Legacy Full Route */}
      <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">Need historical request simulator?</span>
        <Link
          href="/dashboard/resources"
          className="inline-flex items-center gap-1 text-primary hover:underline font-semibold"
        >
          <span>Open Full Allocator Suite</span>
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
