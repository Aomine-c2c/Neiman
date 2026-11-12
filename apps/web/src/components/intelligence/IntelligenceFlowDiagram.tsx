'use client';

import React from 'react';
import {
  Cloud,
  Server,
  Zap,
  Cpu,
  Bot,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { ModelProvider } from '@/lib/api/intelligence';

interface IntelligenceFlowDiagramProps {
  providers: ModelProvider[];
  activeStrategy: string;
  maxCostCeiling: number;
  routingMode: string;
  activeAgents?: Array<{ id: string; name: string; role: string; current_task?: string }>;
  isSimulating?: boolean;
  selectedProvider?: string | null;
  onSelectProvider?: (providerId: string) => void;
}

export function IntelligenceFlowDiagram({
  providers,
  activeStrategy,
  maxCostCeiling,
  routingMode,
  activeAgents = [
    { id: 'agent-1', name: 'Product Agent', role: 'Spec Generation', current_task: 'Drafting ADR' },
    { id: 'agent-2', name: 'Architect Agent', role: 'System Design', current_task: 'Evaluating Schema' },
    { id: 'agent-3', name: 'Security Sentinel', role: 'Audit & Compliance', current_task: 'SAST Audit' },
  ],
  isSimulating = false,
  selectedProvider,
  onSelectProvider,
}: IntelligenceFlowDiagramProps) {
  // Use live verified backend providers
  const displayProviders = providers;


  return (
    <div className="relative rounded-2xl border border-primary/30 bg-card/85 p-6 backdrop-blur-xl shadow-2xl overflow-hidden select-none">
      {/* Ambient background glow grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: 'radial-gradient(rgba(59, 130, 246, 0.25) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Header Badge */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-border/60">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10 border border-primary/30 text-primary">
            <Zap className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-primary font-bold">
              Autonomous Mesh Routing Topology
            </span>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              NEIMAN Intelligence Exchange Architecture
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="px-2.5 py-1 rounded-lg border border-border bg-secondary/50 text-muted-foreground">
            Mode: <strong className="text-foreground">{routingMode}</strong>
          </span>
          <span className="px-2.5 py-1 rounded-lg border border-primary/30 bg-primary/10 text-primary">
            Strategy: <strong className="uppercase">{activeStrategy.replace('_', ' ')}</strong>
          </span>
        </div>
      </div>

      {/* ASCII Architectural Routing Blueprint */}
      <div className="mb-6 p-4 rounded-xl border border-border/80 bg-background/90 font-mono text-xs overflow-x-auto shadow-inner">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/60 text-muted-foreground text-[10px]">
          <span className="flex items-center gap-1.5 uppercase font-bold text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-ping" />
            Architectural Routing Schematic
          </span>
          <span className="tracking-widest opacity-80">MULTI-PROVIDER ARBITRATION</span>
        </div>
        <pre className="text-foreground/90 font-bold leading-relaxed text-[11px] select-text">
{`                        AUTOMATIC TIERED FALLBACK CASCADE

   [TIER 1: PRIMARY]            [TIER 2: FALLBACK]           [TIER 3: SECONDARY]          [TIER 4: LOCAL DEGRADED]
 ┌──────────────────────┐    ┌──────────────────────┐    ┌──────────────────────┐    ┌──────────────────────┐
 │ Claude 3.5 Sonnet    │───►│ Gemini 1.5 Pro       │───►│ OpenAI GPT-4o        │───►│ DeepSeek-R1 (Local)  │
 │ (Reasoning/Arch)     │ 429│ (Large Context / Fast)│ TO │ (General Dispatch)   │ ERR│ (Zero-Retention Net) │
 └──────────────────────┘    └──────────────────────┘    └──────────────────────┘    └──────────────────────┘
            │                           │                           │                           │
            └───────────────────────────┴─────────────┬─────────────┴───────────────────────────┘
                                                      ▼
                                       NEIMAN ROUTING CIRCUIT BREAKER
                                                      │
                                        ┌─────────────┴─────────────┐
                                        ▼                           ▼
                             Dispatched Task Output        Permanent Audit Trace`}
        </pre>
      </div>

      {/* 1. UPSTREAM PROVIDERS ROW */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
        {displayProviders.map((p) => {
          const isSelected = selectedProvider === p.name || selectedProvider === p.id;
          const isHealthy = p.is_healthy && p.consecutive_failures === 0;

          return (
            <div
              key={p.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelectProvider?.(p.name)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelectProvider?.(p.name)}
              className={`
                group p-4 rounded-xl border transition-all cursor-pointer relative overflow-hidden
                ${isSelected
                  ? 'border-primary ring-2 ring-primary/40 bg-primary/10'
                  : 'border-border/80 bg-secondary/40 hover:bg-secondary/70 hover:border-primary/50'
                }
              `}
            >
              {/* Top Accent Line */}
              <div
                className={`absolute top-0 left-0 right-0 h-1 ${!isHealthy
                    ? 'bg-rose-500'
                    : p.is_local
                      ? 'bg-emerald-500'
                      : p.name.includes('gemini')
                        ? 'bg-blue-500'
                        : p.name.includes('anthropic')
                          ? 'bg-amber-500'
                          : 'bg-emerald-400'
                  }`}
              />

              <div className="flex items-center justify-between mb-2">
                <span className="p-1.5 rounded-lg bg-background/80 border border-border/60 text-foreground">
                  {p.is_local ? <Server className="h-4 w-4 text-emerald-400" /> : <Cloud className="h-4 w-4 text-primary" />}
                </span>
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${isHealthy
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/15 text-rose-400 border border-rose-500/30 animate-pulse'
                    }`}
                >
                  {isHealthy ? (
                    <>
                      <CheckCircle2 className="h-2.5 w-2.5" /> ONLINE
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-2.5 w-2.5" /> DEGRADED
                    </>
                  )}
                </span>
              </div>

              <h3 className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                {p.display_name}
              </h3>
              <div className="mt-1 text-[10px] font-mono text-muted-foreground flex items-center justify-between">
                <span>{p.is_local ? 'Local Air-Gapped' : 'Public Cloud'}</span>
                <span>Failures: {p.consecutive_failures}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* SVG CONNECTOR SECTION 1: PROVIDERS -> ROUTING ENGINE */}
      <div className="relative h-16 w-full my-1 overflow-hidden pointer-events-none">
        <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 800 64">
          <defs>
            <linearGradient id="grad-pulse" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#818cf8" stopOpacity="0.4" />
            </linearGradient>
          </defs>

          {/* Lines from 4 provider columns merging into center */}
          <path d="M 100 0 C 100 40, 400 20, 400 64" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
          <path d="M 300 0 C 300 40, 400 20, 400 64" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
          <path d="M 500 0 C 500 40, 400 20, 400 64" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
          <path d="M 700 0 C 700 40, 400 20, 400 64" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />

          {/* Active Flow Animation Line */}
          <path
            d="M 100 0 C 100 40, 400 20, 400 64 M 300 0 C 300 40, 400 20, 400 64 M 500 0 C 500 40, 400 20, 400 64 M 700 0 C 700 40, 400 20, 400 64"
            fill="none"
            stroke="url(#grad-pulse)"
            strokeWidth="2.5"
            strokeDasharray="6 8"
            className="animate-[dash_1.5s_linear_infinite]"
          />
        </svg>
      </div>

      {/* 2. CENTRAL ROUTING ENGINE HUB */}
      <div className="max-w-md mx-auto relative z-10">
        <div className="p-4 rounded-2xl border-2 border-primary/50 bg-gradient-to-b from-card via-card/95 to-primary/10 shadow-2xl backdrop-blur-md text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/40 bg-primary/10 text-primary text-xs font-mono font-bold">
            <Cpu className="h-3.5 w-3.5" />
            NEIMAN ROUTING ENGINE
          </div>

          <p className="text-xs text-muted-foreground px-4">
            Evaluates measured latencies, token envelopes, and privacy classifications with automatic 4-tier circuit breaker cascades.
          </p>

          <div className="pt-2 border-t border-border/60 flex items-center justify-around text-[11px] font-mono">
            <div>
              <span className="text-muted-foreground block text-[9px] uppercase">Cost Ceiling</span>
              <strong className="text-emerald-400 font-bold">${maxCostCeiling.toFixed(2)}</strong>
            </div>
            <div className="h-6 w-px bg-border/60" />
            <div>
              <span className="text-muted-foreground block text-[9px] uppercase">Cascade Tiers</span>
              <strong className="text-primary font-bold">4 Chains</strong>
            </div>
            <div className="h-6 w-px bg-border/60" />
            <div>
              <span className="text-muted-foreground block text-[9px] uppercase">Telemetry</span>
              <strong className="text-amber-400 font-bold">Closed Breakers</strong>
            </div>
          </div>
        </div>
      </div>

      {/* SVG CONNECTOR SECTION 2: ROUTING ENGINE -> DOWNSTREAM AGENTS */}
      <div className="relative h-16 w-full my-1 overflow-hidden pointer-events-none">
        <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 800 64">
          {/* Fan-out lines from center into 3 agent columns */}
          <path d="M 400 0 C 400 40, 160 20, 160 64" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
          <path d="M 400 0 C 400 40, 400 20, 400 64" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
          <path d="M 400 0 C 400 40, 640 20, 640 64" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />

          {/* Animated particle flow */}
          <path
            d="M 400 0 C 400 40, 160 20, 160 64 M 400 0 C 400 40, 400 20, 400 64 M 400 0 C 400 40, 640 20, 640 64"
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="2.5"
            strokeDasharray="6 8"
            className="animate-[dash_1.5s_linear_infinite]"
          />
        </svg>
      </div>

      {/* 3. DOWNSTREAM ORGANIZATIONAL AGENTS ROW */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative z-10">
        {activeAgents.map((agent) => (
          <div
            key={agent.id}
            className="p-3.5 rounded-xl border border-border/80 bg-secondary/30 backdrop-blur-md space-y-2 hover:border-primary/40 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                  <Bot className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-foreground">{agent.name}</h4>
                  <span className="text-[10px] font-mono text-muted-foreground">{agent.role}</span>
                </div>
              </div>
              <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                ACTIVE
              </span>
            </div>

            <div className="text-[11px] font-mono bg-background/60 p-2 rounded-lg border border-border/40 flex items-center justify-between">
              <span className="text-muted-foreground truncate">Mission: {agent.current_task || 'Idle'}</span>
              <span className="text-primary shrink-0">→ Live</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
