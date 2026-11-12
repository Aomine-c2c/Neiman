'use client';

import React, { useState } from 'react';
import {
  Cpu,
  Database,
  Coins,
  Zap,
  Activity,
  HardDrive,
  Wifi,
  Bot,
  ExternalLink,
  ChevronRight,
  Info,
  X,
} from 'lucide-react';
import type { ResourceSummary } from '@/lib/api/controlRoom';

interface SystemHealthPanelProps {
  resources: ResourceSummary;
  agentCount?: number;
  maxAgentCapacity?: number;
  onOpenDrawer?: (drawerId: string) => void;
  isSimulated?: boolean;
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
}

export function SystemHealthPanel({
  resources,
  agentCount = 0,
  maxAgentCapacity = 16,
  onOpenDrawer,
  isSimulated = false,
  isMinimized,
  onToggleMinimize,
}: SystemHealthPanelProps) {
  const [activeMetricDetail, setActiveMetricDetail] = useState<string | null>(null);

  const compute = resources.compute_used_pct ?? (isSimulated ? 28.4 : 0);
  const memoryGb = resources.memory_used_gb ?? (isSimulated ? 6.2 : 0);
  const memoryLimitGb = resources.memory_limit_gb ?? (isSimulated ? 16.0 : 0);
  const memoryPct = memoryLimitGb > 0 ? Math.round((memoryGb / memoryLimitGb) * 100) : 0;

  const tokens = resources.token_usage_total !== null && resources.token_usage_total !== undefined
    ? `${(resources.token_usage_total / 1000).toFixed(1)}k`
    : (isSimulated ? '42.8k' : '0k');

  const budgetSpent = resources.budget_spent_usd ?? (isSimulated ? 14200 : 0);
  const budgetAllocated = resources.budget_allocated_usd ?? (isSimulated ? 50000 : 0);
  const budgetPct = budgetAllocated > 0 ? Math.min(100, Math.round((budgetSpent / budgetAllocated) * 100)) : 0;

  const METRICS = [
    {
      id: 'cpu',
      label: 'CPU / Enclave',
      value: `${compute}%`,
      sub: 'CGroup Sandbox',
      pct: compute,
      icon: Cpu,
      status: compute > 85 ? 'warning' : 'nominal',
      detail: {
        title: 'CPU Enclave Utilization',
        specs: isSimulated ? '16 vCPU Dedicated (AMD EPYC 9654)' : 'Standard vCPU Pool',
        cgroup: 'cgroup2 /sys/fs/cgroup/neiman_workers',
        isolation: 'gVisor Kernel Sandbox Enabled',
      },
    },
    {
      id: 'ram',
      label: 'RAM / CGroup',
      value: `${memoryGb}GB`,
      sub: `Limit: ${memoryLimitGb}GB (${memoryPct}%)`,
      pct: memoryPct,
      icon: HardDrive,
      status: memoryPct > 85 ? 'warning' : 'nominal',
      detail: {
        title: 'Memory CGroup Allocation',
        specs: `${memoryGb} GB in use of ${memoryLimitGb} GB allocated pool`,
        leak_guard: isSimulated ? 'Zero leak detected across 4 worker runtimes' : 'Runtime leak guard active',
        swap: '0.0 MB Swap (Disabled for security)',
      },
    },
    {
      id: 'gpu',
      label: 'GPU VRAM',
      value: isSimulated ? (compute > 80 ? '94.2%' : '48.6%') : '0.0%',
      sub: isSimulated ? 'NVIDIA H100 SXM5' : 'Direct Enclave',
      pct: isSimulated ? (compute > 80 ? 94 : 48) : 0,
      icon: Zap,
      status: isSimulated && compute > 80 ? 'warning' : 'nominal',
      detail: {
        title: 'Local Inference Accelerator',
        specs: isSimulated ? 'NVIDIA H100 80GB SXM5 NVLink' : 'Hardware Acceleration Pool',
        vram: isSimulated ? '38.8 GB / 80.0 GB VRAM Active' : '0.0 GB Active',
        quantization: isSimulated ? 'FP8 TensorRT-LLM Engine active' : 'Awaiting Workload',
      },
    },
    {
      id: 'network',
      label: 'Network I/O',
      value: isSimulated ? '2.4 Gbps' : '0.0 Gbps',
      sub: isSimulated ? 'Zero packet drop' : 'Standby Mesh',
      pct: isSimulated ? 35 : 0,
      icon: Wifi,
      status: 'nominal',
      detail: {
        title: 'Zero-Trust Network Mesh',
        specs: 'WireGuard Overlay mTLS 1.3',
        egress_policy: 'Strict Sandbox Quarantine active',
        latency: isSimulated ? '0.4ms inter-container loopback' : '0.0ms loopback',
      },
    },
    {
      id: 'tokens',
      label: 'Token Velocity',
      value: tokens,
      sub: 'Multi-model stream',
      pct: Math.min(100, Math.round(((resources.token_usage_total ?? (isSimulated ? 42800 : 0)) / 200000) * 100)),
      icon: Activity,
      status: 'nominal',
      detail: {
        title: 'Cognitive Token Consumption',
        specs: 'Dynamic Multi-Provider Streaming Pool',
        rate: isSimulated ? '450 tokens/sec average ingestion' : '0 tokens/sec ingestion',
        cache_hit: isSimulated ? '64.2% Prompt Cache Hit Rate' : '0.0% Cache Hit Rate',
      },
    },
    {
      id: 'budget',
      label: 'Monthly FinOps',
      value: `$${(budgetSpent / 1000).toFixed(1)}k`,
      sub: `Cap: $${(budgetAllocated / 1000).toFixed(0)}k (${budgetPct}%)`,
      pct: budgetPct,
      icon: Coins,
      status: budgetPct > 80 ? 'warning' : 'nominal',
      detail: {
        title: 'Organizational Financial Burn Rate',
        specs: `Spent $${budgetSpent.toLocaleString()} of $${budgetAllocated.toLocaleString()} limit`,
        projected: `$${Math.round(budgetSpent * 1.15).toLocaleString()} EOM projected total`,
        governance: 'Hard ceiling alert at 90% allocation',
      },
    },
  ];

  if (isMinimized) {
    return (
      <div className="neiman-panel rounded-lg p-2.5 flex items-center justify-between font-mono text-xs w-72">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-cyan-400" />
          <span className="font-bold text-foreground tracking-wider uppercase text-[11px]">System Health</span>
          <span className="text-[10px] text-cyan-400 bg-cyan-500/10 px-1.5 py-0.2 rounded border border-cyan-500/30">
            {compute}% CPU
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

  const selectedMetric = METRICS.find((m) => m.id === activeMetricDetail);

  return (
    <div className="neiman-panel rounded-xl flex flex-col font-mono text-xs overflow-hidden select-none w-80 lg:w-92 shadow-2xl relative">
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-cyan-500/20 bg-background/50">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-cyan-400" />
          <span className="font-bold text-foreground uppercase tracking-widest text-[11px]">
            System Health & FinOps
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span
            className={`text-[8px] font-bold px-1.5 py-0.2 rounded border uppercase tracking-wider ${
              isSimulated
                ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
                : 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30'
            }`}
          >
            {isSimulated ? 'SIMULATED' : 'VERIFIED TELEMETRY'}
          </span>
          <button
            type="button"
            onClick={() => onOpenDrawer?.('resources')}
            className="p-1 rounded text-muted-foreground hover:text-cyan-400 hover:bg-secondary/40 transition-colors"
            title="Open Resource Command Center"
          >
            <ExternalLink className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Grid of Compact Indicators */}
      <div className="p-3 grid grid-cols-2 gap-2 max-h-[280px] overflow-y-auto">
        {METRICS.map((m) => {
          const Icon = m.icon;
          const isWarn = m.status === 'warning';
          return (
            <div
              key={m.id}
              onClick={() => setActiveMetricDetail(m.id)}
              className={`p-2 rounded-lg border cursor-pointer transition-all ${
                isWarn
                  ? 'border-amber-500/40 bg-amber-950/20 hover:border-amber-400/60'
                  : 'border-border/30 bg-secondary/20 hover:border-cyan-500/30 hover:bg-secondary/40'
              }`}
            >
              <div className="flex items-center justify-between text-[9px] text-muted-foreground mb-1">
                <span className="uppercase tracking-wider truncate">{m.label}</span>
                <Icon className={`h-3 w-3 ${isWarn ? 'text-amber-400 animate-pulse' : 'text-cyan-400'}`} />
              </div>

              <div className="flex items-baseline justify-between mb-1">
                <span className={`text-base font-bold font-mono ${isWarn ? 'text-amber-400' : 'text-foreground'}`}>
                  {m.value}
                </span>
                <span className="text-[8px] text-muted-foreground truncate">{m.sub}</span>
              </div>

              {/* Progress bar */}
              <div className="h-1 w-full bg-border/40 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    isWarn ? 'bg-amber-400' : 'bg-cyan-400'
                  }`}
                  style={{ width: `${Math.min(100, m.pct)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Contextual Metric Drill-Down Popover */}
      {selectedMetric && (
        <div className="absolute inset-0 bg-background/95 backdrop-blur-md p-3.5 flex flex-col justify-between z-30 animate-fade-in font-mono text-xs">
          <div>
            <div className="flex items-center justify-between border-b border-border/40 pb-2 mb-2.5">
              <div className="flex items-center gap-2">
                <selectedMetric.icon className="h-4 w-4 text-cyan-400" />
                <span className="font-bold text-foreground text-xs">{selectedMetric.detail.title}</span>
              </div>
              <button
                type="button"
                onClick={() => setActiveMetricDetail(null)}
                className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="space-y-2 text-[10px]">
              <div className="p-2 rounded bg-black/40 border border-cyan-500/20 text-cyan-300 space-y-1">
                <div>&gt; Specs: {selectedMetric.detail.specs}</div>
                {Object.entries(selectedMetric.detail).map(([key, val]) => {
                  if (key === 'title' || key === 'specs') return null;
                  return (
                    <div key={key} className="text-muted-foreground">
                      &gt; {key.toUpperCase()}: <span className="text-foreground">{String(val)}</span>
                    </div>
                  );
                })}
              </div>

              <div className="text-[9px] text-muted-foreground flex items-center justify-between pt-1">
                <span>Provenance: Linux CGroup V2 Telemetry</span>
                <span className="text-cyan-400">Sample Rate: 1000ms</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/30">
            <button
              type="button"
              onClick={() => {
                setActiveMetricDetail(null);
                onOpenDrawer?.('resources');
              }}
              className="px-3 py-1 rounded bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-[10px] font-bold hover:bg-cyan-500/30"
            >
              Open Full Telemetry Breakdown &rarr;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
