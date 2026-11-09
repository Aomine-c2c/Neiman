'use client';

import React from 'react';
import { Zap, ArrowRight, ShieldCheck, Cpu } from 'lucide-react';
import type { ResourceSummary } from '@/lib/api/controlRoom';

interface IntelligenceGatewayMatrixProps {
  resources: ResourceSummary;
  onOpenDrawer?: (drawerId: string) => void;
}

export function IntelligenceGatewayMatrix({ resources, onOpenDrawer }: IntelligenceGatewayMatrixProps) {
  const providers = [
    { name: 'Anthropic Claude 3.5', tier: 'TIER-1 PRIMARY', status: 'NOMINAL', latency: '240ms', cost: '$3.00/M' },
    { name: 'OpenAI GPT-4o', tier: 'TIER-1 REASONING', status: 'NOMINAL', latency: '190ms', cost: '$2.50/M' },
    { name: 'Google Gemini 1.5 Pro', tier: 'TIER-2 CONTEXT', status: 'NOMINAL', latency: '310ms', cost: '$1.25/M' },
    { name: 'DeepSeek-R1 Local', tier: 'TIER-3 AIR-GAPPED', status: 'ACTIVE', latency: '45ms', cost: '$0.00/M' },
  ];

  return (
    <div className="flex flex-col h-full font-mono overflow-hidden">
      {/* Pane Header */}
      <div className="flex items-center justify-between pb-1.5 border-b border-border/40">
        <div className="flex items-center gap-2">
          <Zap className="h-3.5 w-3.5 text-foreground" />
          <span className="text-[10px] uppercase font-bold tracking-wider text-foreground">
            Intelligence Gateway & Circuit Matrix
          </span>
          <span className="text-[8px] px-1 py-0.2 rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-500 font-bold">
            RESILIENT
          </span>
        </div>
        <button
          type="button"
          onClick={() => onOpenDrawer?.('intelligence')}
          className="text-[9px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
        >
          <span>Routers</span>
          <ArrowRight className="h-2.5 w-2.5" />
        </button>
      </div>

      {/* High-Density Circuit Rows */}
      <div className="flex-1 overflow-y-auto max-h-56 divide-y divide-border/40 select-text text-xs">
        {providers.map((p) => (
          <div
            key={p.name}
            onClick={() => onOpenDrawer?.('intelligence')}
            className="flex items-center justify-between p-2 hover:bg-secondary/40 transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-2 truncate pr-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
              <div className="truncate">
                <span className="font-semibold text-foreground block text-[11px] truncate">{p.name}</span>
                <span className="text-[9px] text-muted-foreground">{p.tier}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0 text-right">
              <div>
                <span className="text-[10px] font-bold text-foreground block">{p.latency}</span>
                <span className="text-[9px] text-muted-foreground">{p.cost}</span>
              </div>
              <span className="text-[8px] font-bold px-1.5 py-0.2 rounded border border-border bg-secondary text-muted-foreground">
                {p.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
