'use client';

import React from 'react';
import {
  Zap,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ExternalLink,
  Shield,
  Activity,
  Server,
  Sparkles,
} from 'lucide-react';
import type { ModelProviderInfo } from '@/lib/api/controlRoom';

interface IntelligenceProvidersPanelProps {
  providers?: ModelProviderInfo[];
  onOpenDrawer?: (drawerId: string) => void;
  isSimulated?: boolean;
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
}

export function IntelligenceProvidersPanel({
  providers = [],
  onOpenDrawer,
  isSimulated = false,
  isMinimized,
  onToggleMinimize,
}: IntelligenceProvidersPanelProps) {
  // Default provider profiles
  const DEFAULT_PROVIDERS: ModelProviderInfo[] = [
    {
      id: 'p-claude',
      name: 'Anthropic Claude 3.5 Sonnet',
      provider: 'Anthropic',
      status: 'ONLINE',
      active_requests: 14,
      avg_latency_ms: 240,
      total_tokens: 142000,
      cost_usd: 12.8,
    },
    {
      id: 'p-gemini',
      name: 'Google Gemini 1.5 Pro',
      provider: 'Google',
      status: 'ONLINE',
      active_requests: 8,
      avg_latency_ms: 195,
      total_tokens: 88000,
      cost_usd: 5.4,
    },
    {
      id: 'p-gpt4o',
      name: 'OpenAI GPT-4o Omni',
      provider: 'OpenAI',
      status: 'ONLINE',
      active_requests: 6,
      avg_latency_ms: 260,
      total_tokens: 49000,
      cost_usd: 6.2,
    },
    {
      id: 'p-deepseek',
      name: 'DeepSeek-R1 Local Air-Gapped',
      provider: 'Self-Hosted (vLLM)',
      status: 'ONLINE',
      active_requests: 22,
      avg_latency_ms: 42,
      total_tokens: 210000,
      cost_usd: 0.0,
    },
  ];

  const activeProviders = providers.length > 0 ? providers : isSimulated ? DEFAULT_PROVIDERS : [];

  if (isMinimized) {
    return (
      <div className="neiman-panel rounded-lg p-2.5 flex items-center justify-between font-mono text-xs w-72">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-sky-400" />
          <span className="font-bold text-foreground tracking-wider uppercase text-[11px]">Model Providers</span>
          <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
            {activeProviders.filter((p) => p.status === 'ONLINE').length}/{activeProviders.length} ONLINE
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
          <Zap className="h-4 w-4 text-sky-400" />
          <span className="font-bold text-foreground uppercase tracking-widest text-[11px]">
            Intelligence Gateways
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
            {isSimulated ? 'SIMULATED' : 'LIVE GATEWAYS'}
          </span>
          <button
            type="button"
            onClick={() => onOpenDrawer?.('intelligence')}
            className="p-1 rounded text-muted-foreground hover:text-cyan-400 hover:bg-secondary/40 transition-colors"
            title="Open Intelligence Configuration Matrix"
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

      {/* Providers List */}
      <div className="p-2.5 space-y-2 max-h-[260px] overflow-y-auto">
        {activeProviders.length === 0 ? (
          <div className="py-6 flex flex-col items-center justify-center text-center space-y-2">
            <div className="h-9 w-9 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <Zap className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">Zero Gateways Configured</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Connect an AI provider or air-gapped local model to begin routing.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenDrawer?.('intelligence')}
              className="mt-1 px-3 py-1 rounded border border-cyan-500/40 bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25 text-[10px] font-bold"
            >
              Connect Gateway
            </button>
          </div>
        ) : (
          activeProviders.map((prov) => {
          const isOnline = prov.status === 'ONLINE';
          const isDegraded = prov.status === 'DEGRADED';
          const isLocal = prov.provider.includes('Self-Hosted') || prov.name.includes('Local');

          return (
            <div
              key={prov.id}
              className={`p-2 rounded-lg border transition-all ${
                isDegraded
                  ? 'border-amber-500/50 bg-amber-950/20'
                  : 'border-border/30 bg-secondary/20 hover:border-cyan-500/30'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={`h-2 w-2 rounded-full shrink-0 ${
                      isDegraded ? 'bg-amber-400 animate-ping' : isOnline ? 'bg-emerald-400' : 'bg-rose-500'
                    }`}
                  />
                  <span className="font-bold text-foreground truncate text-xs">{prov.name}</span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {isLocal && (
                    <span className="text-[8px] font-bold text-cyan-400 bg-cyan-500/10 px-1 py-0.2 rounded border border-cyan-500/20">
                      AIR-GAPPED
                    </span>
                  )}
                  <span
                    className={`text-[8px] font-bold px-1.5 py-0.2 rounded border uppercase tracking-wider ${
                      isDegraded
                        ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
                        : isOnline
                        ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                        : 'text-rose-400 bg-rose-500/10 border-rose-500/30'
                    }`}
                  >
                    {prov.status}
                  </span>
                </div>
              </div>

              {/* Telemetry row */}
              <div className="grid grid-cols-3 gap-2 text-[9px] text-muted-foreground pt-1 border-t border-border/20">
                <div>
                  <span className="block text-[8px] uppercase text-muted-foreground/70">Latency</span>
                  <span className={`font-bold ${isDegraded ? 'text-amber-400' : 'text-foreground'}`}>
                    {prov.avg_latency_ms ?? 240}ms
                  </span>
                </div>

                <div>
                  <span className="block text-[8px] uppercase text-muted-foreground/70">Inference Load</span>
                  <span className="text-cyan-400 font-bold">{prov.active_requests ?? 0} reqs</span>
                </div>

                <div>
                  <span className="block text-[8px] uppercase text-muted-foreground/70">Cost (USD)</span>
                  <span className="text-foreground font-bold">
                    ${((prov.cost_usd ?? 0)).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Fallback circuit annotation if degraded */}
              {isDegraded && (
                <div className="mt-1.5 p-1 rounded bg-amber-500/10 border border-amber-500/20 text-[9px] text-amber-300 flex items-center gap-1">
                  <RotateCcw className="h-2.5 w-2.5 animate-spin" />
                  <span>Traffic failover: 80% rerouted to Gemini & DeepSeek</span>
                </div>
              )}
            </div>
          );
        }))}
      </div>
    </div>
  );
}
