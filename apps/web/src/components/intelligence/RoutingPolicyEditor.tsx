'use client';

import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Shield,
  Clock,
  Coins,
  Cpu,
  Layers,
  Check,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Server,
  Cloud,
} from 'lucide-react';
import {
  ModelRoutingPolicy,
  ModelRoutingPolicyUpdate,
  ModelProvider,
  Model,
  RoutingMode,
} from '@/lib/api/intelligence';

interface RoutingPolicyEditorProps {
  policy: ModelRoutingPolicy | null;
  providers: ModelProvider[];
  models: Model[];
  onSavePolicy: (update: ModelRoutingPolicyUpdate) => void;
  isSaving: boolean;
}

const STRATEGY_DESCRIPTIONS: Record<string, string> = {
  BALANCED: 'Optimizes multi-criteria weighted trade-offs across cost, latency, and capability matching.',
  LOWEST_COST: 'Greedily dispatches to the most cost-effective model qualified for the token envelope.',
  LOWEST_LATENCY: 'Routes queries to the fastest responding provider with lowest measured response time.',
  HIGHEST_CAPABILITY: 'Prioritizes maximum reasoning depth, frontier parameter weights, and complex schemas.',
  STRICT_PRIVACY: 'Strictly restricts routing to on-premise air-gapped zero-retention local models.',
};

export function RoutingPolicyEditor({
  policy,
  providers,
  models,
  onSavePolicy,
  isSaving,
}: RoutingPolicyEditorProps) {
  // Routing Mode: AUTOMATIC | MANUAL | AGENT_PREFERENCE | COMPANY_POLICY
  const [routingMode, setRoutingMode] = useState<RoutingMode>(
    policy?.routing_mode || 'AUTOMATIC'
  );

  const [strategy, setStrategy] = useState<
    'BALANCED' | 'LOWEST_COST' | 'LOWEST_LATENCY' | 'HIGHEST_CAPABILITY' | 'STRICT_PRIVACY'
  >(policy?.strategy || 'BALANCED');

  const [preferredProvider, setPreferredProvider] = useState<string>(
    policy?.preferred_provider || ''
  );
  const [fallbackProvider, setFallbackProvider] = useState<string>(
    policy?.fallback_provider || 'local'
  );

  const [maxCostCeiling, setMaxCostCeiling] = useState<string>(
    String(policy?.max_cost_per_query_usd ?? 0.5)
  );
  const [maxLatencyCeiling, setMaxLatencyCeiling] = useState<string>(
    String(policy?.max_acceptable_latency_ms ?? 5000)
  );

  const [requiredPrivacy, setRequiredPrivacy] = useState<string>(
    policy?.required_privacy_level || ''
  );
  const [requiredCapability, setRequiredCapability] = useState<string>(
    policy?.required_capability || 'reasoning'
  );

  const [fallbackChain, setFallbackChain] = useState<string[]>(
    policy?.fallback_chain?.length
      ? policy.fallback_chain
      : ['claude-3-5-sonnet', 'gemini-1.5-pro', 'gpt-4o', 'local-deepseek-r1']
  );

  // Sync state if policy prop refreshes
  useEffect(() => {
    if (policy) {
      if (policy.routing_mode) setRoutingMode(policy.routing_mode);
      if (policy.strategy) setStrategy(policy.strategy);
      if (policy.preferred_provider) setPreferredProvider(policy.preferred_provider);
      if (policy.fallback_provider) setFallbackProvider(policy.fallback_provider);
      if (policy.max_cost_per_query_usd !== undefined) setMaxCostCeiling(String(policy.max_cost_per_query_usd));
      if (policy.max_acceptable_latency_ms !== undefined) setMaxLatencyCeiling(String(policy.max_acceptable_latency_ms));
      if (policy.required_privacy_level !== undefined) setRequiredPrivacy(policy.required_privacy_level || '');
      if (policy.required_capability !== undefined) setRequiredCapability(policy.required_capability || 'reasoning');
      if (policy.fallback_chain && policy.fallback_chain.length > 0) setFallbackChain(policy.fallback_chain);
    }
  }, [policy]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSavePolicy({
      routing_mode: routingMode,
      strategy,
      preferred_provider: preferredProvider || null,
      fallback_provider: fallbackProvider || null,
      max_cost_per_query_usd: parseFloat(maxCostCeiling) || 0.5,
      max_acceptable_latency_ms: parseFloat(maxLatencyCeiling) || 5000,
      required_privacy_level: requiredPrivacy || null,
      required_capability: requiredCapability || null,
      fallback_chain: fallbackChain,
    });
  };

  const handleMoveChain = (idx: number, dir: 'up' | 'down') => {
    const newIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= fallbackChain.length) return;
    const copy = [...fallbackChain];
    const temp = copy[idx];
    copy[idx] = copy[newIdx];
    copy[newIdx] = temp;
    setFallbackChain(copy);
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6 select-none">
      {/* LEFT: Policy Controls & Mode Selection */}
      <div className="lg:col-span-7 rounded-2xl border border-border bg-card p-6 shadow-xl space-y-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-[11px] font-mono font-bold mb-2">
            <Sliders className="h-3 w-3" />
            ENTERPRISE ROUTING ARBITRATION
          </div>
          <h2 className="text-base font-bold text-foreground">
            Multi-Provider Routing Policy Configuration
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Establish organizational governance rules, budget constraints, latency thresholds, and dispatch semantics.
          </p>
        </div>

        {/* 1. ROUTING MODE SELECTION */}
        <div>
          <label className="block text-xs font-semibold text-foreground mb-2">
            Routing Mode / Authority
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {(
              [
                { mode: 'AUTOMATIC', label: 'Automatic Routing', desc: 'Dynamic Router Algorithmic Choice' },
                { mode: 'MANUAL', label: 'Manual Routing', desc: 'Explicit Fixed Provider Lock' },
                { mode: 'AGENT_PREFERENCE', label: 'Agent Preference', desc: 'Respect Agent Manifest Config' },
                { mode: 'COMPANY_POLICY', label: 'Company Policy', desc: 'Strict Compliance Enforcement' },
              ] as const
            ).map((item) => (
              <button
                key={item.mode}
                type="button"
                onClick={() => setRoutingMode(item.mode)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  routingMode === item.mode
                    ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary/40'
                    : 'border-border/70 bg-secondary/30 text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                }`}
              >
                <div className="text-xs font-bold">{item.label}</div>
                <div className="text-[10px] mt-1 line-clamp-2 leading-tight opacity-80">{item.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 2. OPTIMIZATION STRATEGY */}
        <div>
          <label className="block text-xs font-semibold text-foreground mb-2">
            Optimization Strategy
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {(
              ['BALANCED', 'LOWEST_COST', 'LOWEST_LATENCY', 'HIGHEST_CAPABILITY', 'STRICT_PRIVACY'] as const
            ).map((strat) => (
              <label
                key={strat}
                className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                  strategy === strat
                    ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                    : 'border-border/70 bg-secondary/30 hover:border-border hover:bg-secondary/50'
                }`}
              >
                <input
                  type="radio"
                  name="strategy"
                  value={strat}
                  checked={strategy === strat}
                  onChange={() => setStrategy(strat)}
                  className="mt-0.5 text-primary focus:ring-primary"
                />
                <div>
                  <span className="text-xs font-bold text-foreground block">
                    {strat.replace(/_/g, ' ')}
                  </span>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                    {STRATEGY_DESCRIPTIONS[strat]}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* 3. PREFERRED & FALLBACK PROVIDER */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-border/60">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Preferred Provider <span className="text-muted-foreground font-normal">(Primary Route)</span>
            </label>
            <select
              value={preferredProvider}
              onChange={(e) => setPreferredProvider(e.target.value)}
              className="input text-xs w-full font-mono bg-background"
            >
              <option value="">Router Autonomous Resolution</option>
              {providers.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.display_name} ({p.is_local ? 'Local' : 'Cloud'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Fallback Provider <span className="text-muted-foreground font-normal">(Degraded Emergency)</span>
            </label>
            <select
              value={fallbackProvider}
              onChange={(e) => setFallbackProvider(e.target.value)}
              className="input text-xs w-full font-mono bg-background"
            >
              <option value="local">Local Air-Gapped / DeepSeek R1</option>
              {providers.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.display_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 4. COST & LATENCY CEILINGS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Cost Ceiling per Query ($ USD)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-xs">$</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={maxCostCeiling}
                onChange={(e) => setMaxCostCeiling(e.target.value)}
                className="input text-xs w-full pl-7 font-mono bg-background"
                placeholder="0.50"
              />
            </div>
            <span className="text-[10px] text-muted-foreground mt-1 block">Queries exceeding ceiling trigger lower tier or reject.</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Latency Ceiling SLA (Milliseconds)
            </label>
            <div className="relative">
              <input
                type="number"
                step="100"
                min="200"
                value={maxLatencyCeiling}
                onChange={(e) => setMaxLatencyCeiling(e.target.value)}
                className="input text-xs w-full pr-10 font-mono bg-background"
                placeholder="5000"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-[10px]">ms</span>
            </div>
            <span className="text-[10px] text-muted-foreground mt-1 block">Breaches trip breaker to next fastest fallback.</span>
          </div>
        </div>

        {/* 5. PRIVACY & CAPABILITY REQUIREMENT */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Privacy Requirement
            </label>
            <select
              value={requiredPrivacy}
              onChange={(e) => setRequiredPrivacy(e.target.value)}
              className="input text-xs w-full font-mono bg-background"
            >
              <option value="">Standard Cloud Tolerant</option>
              <option value="ON_PREMISE_ZERO_RETENTION">ON_PREMISE_ZERO_RETENTION</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Capability Requirement
            </label>
            <select
              value={requiredCapability}
              onChange={(e) => setRequiredCapability(e.target.value)}
              className="input text-xs w-full font-mono bg-background"
            >
              <option value="reasoning">reasoning (General)</option>
              <option value="architectural_reasoning">architectural_reasoning (Deep)</option>
              <option value="large_context">large_context (&gt;1M Tokens)</option>
              <option value="code_generation">code_generation (Engineering)</option>
              <option value="privacy">privacy (Zero-Retention)</option>
            </select>
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-4 border-t border-border flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">
            Changes persist to PostgreSQL intelligence domain router.
          </span>
          <button
            type="submit"
            disabled={isSaving}
            className="btn btn-primary text-xs px-5 h-9 font-semibold gap-1.5"
          >
            {isSaving ? 'Saving Policy...' : 'Save Policy Configuration'}
          </button>
        </div>
      </div>

      {/* RIGHT: Fallback Chain Visualizer */}
      <div className="lg:col-span-5 rounded-2xl border border-border bg-card p-6 shadow-xl flex flex-col justify-between space-y-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-[11px] font-mono font-bold mb-2">
            <Layers className="h-3 w-3" />
            SEQUENTIAL FAILOVER CHAIN
          </div>
          <h3 className="text-sm font-bold text-foreground">
            Active Multi-Tier Fallback Chain
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            When upstream providers encounter timeouts, 429 rate limits, or circuit breaker trips, execution cascades down this exact sequence.
          </p>

          <div className="space-y-2.5 mt-5">
            {fallbackChain.map((modelId, idx) => {
              const matchedModel = models.find((m) => m.model_identifier === modelId);
              const isFirst = idx === 0;
              const isLast = idx === fallbackChain.length - 1;

              return (
                <div
                  key={modelId}
                  className="p-3.5 rounded-xl border border-border/80 bg-secondary/30 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="h-6 w-6 rounded-lg bg-primary/10 border border-primary/30 text-primary flex items-center justify-center font-mono font-bold text-xs">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="text-xs font-bold font-mono text-foreground">{modelId}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {isFirst ? 'Primary Target' : `Tier ${idx + 1} Fallback Target`}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={isFirst}
                      onClick={() => handleMoveChain(idx, 'up')}
                      className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 text-xs"
                      title="Move Up"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      disabled={isLast}
                      onClick={() => handleMoveChain(idx, 'down')}
                      className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 text-xs"
                      title="Move Down"
                    >
                      ▼
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Circuit Breaker SLA Summary */}
        <div className="p-4 rounded-xl border border-border/80 bg-muted/20 space-y-2 text-xs">
          <div className="flex items-center gap-2 font-bold text-foreground">
            <Shield className="h-4 w-4 text-primary" />
            Automatic Circuit Breaker SLA
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Adapters track rolling 5xx and timeout errors. If <strong>3 consecutive failures</strong> occur, the circuit breaker moves from <code>CLOSED</code> to <code>OPEN</code>, diverting all organizational traffic to the next tier for <strong>30 seconds</strong> before probe requests evaluate recovery.
          </p>
        </div>
      </div>
    </form>
  );
}
