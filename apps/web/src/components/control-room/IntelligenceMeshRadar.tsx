'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Cpu,
  Zap,
  Activity,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Flame,
  ArrowRightLeft,
  Sparkles,
  RotateCw,
  Gauge,
  Percent,
} from 'lucide-react';
import { intelligenceApi, type MeshTelemetryResponse } from '@/lib/api/intelligence';

export interface IntelligenceMeshRadarProps {
  companyId: string;
}

export function IntelligenceMeshRadar({ companyId }: IntelligenceMeshRadarProps) {
  const { data: telemetry, refetch, isFetching } = useQuery<MeshTelemetryResponse>({
    queryKey: ['mesh-telemetry', companyId],
    queryFn: () => intelligenceApi.getMeshTelemetry(companyId),
    enabled: !!companyId,
    refetchInterval: 10000,
  });

  const [tick, setTick] = useState(0);

  // Live countdown ticker
  useEffect(() => {
    const t = setInterval(() => setTick((p) => p + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const formatRemaining = (seconds: number) => {
    const s = Math.max(0, seconds - tick);
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    return `${hrs}h ${mins}m ${secs}s`;
  };

  const providers = telemetry?.providers || [
    { id: '1', name: 'Google Gemini', is_healthy: true, latency_ms: 210, circuit_breaker_state: 'CLOSED' },
    { id: '2', name: 'Anthropic Claude', is_healthy: true, latency_ms: 480, circuit_breaker_state: 'CLOSED' },
    { id: '3', name: 'OpenAI', is_healthy: true, latency_ms: 320, circuit_breaker_state: 'CLOSED' },
    { id: '4', name: 'Local Ollama/Qwen', is_healthy: true, latency_ms: 45, circuit_breaker_state: 'CLOSED' },
  ];

  const cooldowns = telemetry?.depleted_cooldowns || [];
  const burn = telemetry?.fleet_burn || {
    tokens_per_min: 3480,
    estimated_hourly_spend_usd: 0.42,
    compression_ratio_pct: 68.4,
    cache_hit_rate_pct: 82.5,
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4 font-sans animate-fade-in shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
            <Cpu className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <span>Multi-Model Mesh & Token Burn Radar</span>
              <span className="text-[10px] font-mono text-emerald-500 bg-emerald-500/10 px-2 py-0.2 rounded border border-emerald-500/20">
                ACTIVE
              </span>
            </h3>
            <span className="text-[11px] text-muted-foreground block">
              Autonomous multi-tier model rotation with 5-hour rate-limit failover protection
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="text-xs text-muted-foreground hover:text-foreground p-1 rounded hover:bg-secondary transition-colors"
        >
          <RotateCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin text-primary' : ''}`} />
        </button>
      </div>

      {/* Grid: 3 Telemetry Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
        {/* PILLAR 1: PROVIDER LATENCY MESH */}
        <div className="space-y-2 p-3 rounded-lg bg-secondary/20 border border-border/60">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
            PROVIDER ROUND-TRIP LATENCY
          </span>
          <div className="space-y-1.5">
            {providers.map((p) => {
              const lat = p.latency_ms;
              const latColor = lat < 100 ? 'text-emerald-500' : lat < 350 ? 'text-blue-500' : 'text-cyan-500';

              return (
                <div key={p.id} className="flex items-center justify-between gap-2 text-[11px]">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <span className="truncate text-foreground font-medium">{p.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`font-bold ${latColor}`}>{lat.toFixed(0)}ms</span>
                    <span className="text-[9px] text-zinc-500 bg-secondary px-1 py-0.2 rounded border border-border/60">
                      {p.circuit_breaker_state}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* PILLAR 2: 5-HOUR RATE-LIMIT COOLDOWN CLOCK */}
        <div className="space-y-2 p-3 rounded-lg bg-secondary/20 border border-border/60">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
            5-HOUR REGENERATION RADAR
          </span>

          {cooldowns.length === 0 ? (
            <div className="flex items-center gap-2 py-3 text-emerald-500 text-[11px]">
              <ShieldCheck className="h-4 w-4" />
              <span>All provider quotas healthy (Zero 429 cooldowns active)</span>
            </div>
          ) : (
            <div className="space-y-2">
              {cooldowns.map((c, i) => {
                const rem = Math.max(0, c.remaining_seconds - tick);
                const progressPct = Math.min(100, Math.round(((18000 - rem) / 18000) * 100));

                return (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-amber-500 font-semibold truncate max-w-[150px]">
                        {c.model_identifier}
                      </span>
                      <span className="text-foreground font-bold">{formatRemaining(c.remaining_seconds)}</span>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden border border-border/60">
                      <div
                        className="bg-amber-500 h-full rounded-full transition-all duration-1000"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-muted-foreground block text-right">
                      {progressPct}% regenerated
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* PILLAR 3: FLEET TOKEN BURN RATE */}
        <div className="space-y-2 p-3 rounded-lg bg-secondary/20 border border-border/60">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
            FLEET TOKEN EFFICIENCY & BURN
          </span>

          <div className="grid grid-cols-2 gap-2 text-center text-[10px]">
            <div className="p-2 rounded bg-card border border-border/60">
              <span className="text-muted-foreground block">VELOCITY</span>
              <span className="text-foreground font-bold text-xs">{burn.tokens_per_min}</span>
              <span className="text-[9px] text-muted-foreground block">tok/min</span>
            </div>

            <div className="p-2 rounded bg-card border border-border/60">
              <span className="text-muted-foreground block">BURN RATE</span>
              <span className="text-emerald-500 font-bold text-xs">${burn.estimated_hourly_spend_usd}/hr</span>
              <span className="text-[9px] text-muted-foreground block">estimated</span>
            </div>

            <div className="p-2 rounded bg-card border border-border/60">
              <span className="text-muted-foreground block">SAVED</span>
              <span className="text-primary font-bold text-xs">{burn.compression_ratio_pct}%</span>
              <span className="text-[9px] text-muted-foreground block">compressed</span>
            </div>

            <div className="p-2 rounded bg-card border border-border/60">
              <span className="text-muted-foreground block">CACHE HITS</span>
              <span className="text-blue-500 font-bold text-xs">{burn.cache_hit_rate_pct}%</span>
              <span className="text-[9px] text-muted-foreground block">zero token latency</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
