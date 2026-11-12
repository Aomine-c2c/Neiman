'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  FlaskConical,
  CheckCircle2,
  X,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Cpu,
  Zap,
  ArrowUpRight,
} from 'lucide-react';
import type { OrganizationalAdaptation } from '@/lib/api/evolution';

interface EvolutionEnginePanelProps {
  proposals?: OrganizationalAdaptation[];
  onOpenDrawer?: (drawerId: string) => void;
  onValidateProposal?: (proposalId: string) => void;
  onPromoteProposal?: (proposalId: string) => void;
  isSimulated?: boolean;
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
  onClose?: () => void;
}

export function EvolutionEnginePanel({
  proposals = [],
  onOpenDrawer,
  onValidateProposal,
  onPromoteProposal,
  isSimulated = false,
  isMinimized,
  onToggleMinimize,
  onClose,
}: EvolutionEnginePanelProps) {
  const [selectedProposal, setSelectedProposal] = useState<OrganizationalAdaptation | null>(null);

  // Default simulated adaptation proposals if none available
  const DEFAULT_PROPOSALS: OrganizationalAdaptation[] = [
    {
      id: 'adapt-01',
      company_id: 'default',
      title: 'Speculative Prompt Template Distillation',
      adaptation_type: 'CHANGE_MODEL_ROUTING',
      stage: 'PROPOSE',
      status: 'PROPOSED',
      trigger_diagnosis: 'Speculative decoding and prompt template caching cut latency by 24% and reduce token spend by $3,200.',
      evidence: [{ latency_ms: 840, target: 220 }],
      previous_state: { mode: 'Direct Inference' },
      proposed_state: { mode: 'Distilled Caching' },
      expected_improvement: '+24% Speed, -18% Token Cost',
      risk_assessment: 'Negligible cache invalidation risk',
      risk_level: 'LOW',
      simulation_results: { speed_gain: 24 },
      validation_passed: true,
      actual_result: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'adapt-02',
      company_id: 'default',
      title: 'Decoupled Security Boundary Verification',
      adaptation_type: 'MODIFY_WORKFLOW',
      stage: 'VALIDATE',
      status: 'VALIDATED',
      trigger_diagnosis: 'Decoupling security boundary audit from static analysis allows concurrent execution, saving 3.2m per pipeline run.',
      evidence: [{ pipeline_duration_s: 320, optimized_s: 180 }],
      previous_state: { pipeline: 'Serial Execution' },
      proposed_state: { pipeline: 'Concurrent DAG' },
      expected_improvement: '-40% Pipeline Latency',
      risk_assessment: 'Isolated sandbox verification',
      risk_level: 'LOW',
      simulation_results: { latency_reduction_pct: 40 },
      validation_passed: true,
      actual_result: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const activeProposals = proposals.length > 0 ? proposals : isSimulated ? DEFAULT_PROPOSALS : [];

  if (isMinimized) {
    return (
      <div className="neiman-panel rounded-lg p-2.5 flex items-center justify-between font-mono text-xs w-72">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-400 animate-pulse" />
          <span className="font-bold text-foreground tracking-wider uppercase text-[11px]">Evolution Engine</span>
          <span className="text-[10px] text-violet-400 bg-violet-500/10 px-1.5 py-0.2 rounded border border-violet-500/30">
            {activeProposals.length} PROPOSALS
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
    <div className="neiman-panel rounded-xl flex flex-col font-mono text-xs overflow-hidden select-none w-80 lg:w-92 shadow-2xl relative">
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-cyan-500/20 bg-background/50">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-400 animate-pulse" />
          <span className="font-bold text-foreground uppercase tracking-widest text-[11px]">
            Evolution Engine
          </span>
          <span className="text-[9px] text-violet-400 bg-violet-500/10 px-1.5 py-0.2 rounded border border-violet-500/30 font-bold">
            {activeProposals.length} DETECTED
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onOpenDrawer?.('evolution')}
            className="p-1 rounded text-muted-foreground hover:text-cyan-400 hover:bg-secondary/40 transition-colors"
            title="Open Complete Evolution Lab"
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
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-1 py-0.5 text-[9px] text-muted-foreground hover:text-foreground rounded"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Subheader metrics */}
      <div className="px-3.5 py-1.5 border-b border-border/20 bg-black/20 flex items-center justify-between text-[9px] text-muted-foreground">
        <span>Autonomous Proposals: {activeProposals.length}</span>
        <span className="text-emerald-400 flex items-center gap-1">
          <TrendingUp className="h-2.5 w-2.5" />
          <span>Avg Gain: {activeProposals.length > 0 ? '+24.0%' : '0.0%'}</span>
        </span>
      </div>

      {/* Proposals List */}
      <div className="p-2.5 space-y-2 max-h-[260px] overflow-y-auto">
        {activeProposals.length === 0 ? (
          <div className="py-6 flex flex-col items-center justify-center text-center space-y-2">
            <div className="h-9 w-9 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">Zero Active Mutations</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Organizational blueprint operating within optimal parameters.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenDrawer?.('evolution')}
              className="mt-1 px-3 py-1 rounded border border-violet-500/40 bg-violet-500/15 text-violet-300 hover:bg-violet-500/25 text-[10px] font-bold"
            >
              Explore Lab
            </button>
          </div>
        ) : (
          activeProposals.map((prop) => (
          <div
            key={prop.id}
            className="p-2.5 rounded-lg border border-violet-500/30 bg-violet-950/15 hover:border-violet-400/60 transition-all space-y-1.5"
          >
            <div className="flex items-center justify-between gap-1.5">
              <span className="font-bold text-foreground text-xs uppercase truncate">
                {prop.title || prop.adaptation_type.replace(/_/g, ' ')}
              </span>
              <span className="text-[8px] font-bold text-violet-400 bg-violet-500/10 border border-violet-500/30 px-1.5 py-0.2 rounded uppercase">
                {prop.status}
              </span>
            </div>

            <p className="text-[10px] text-muted-foreground leading-snug">
              {prop.trigger_diagnosis}
            </p>

            <div className="flex items-center justify-between pt-1 border-t border-border/20 text-[9px]">
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <ArrowUpRight className="h-3 w-3" />
                {prop.expected_improvement || '+18% Throughput'}
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onValidateProposal?.(prop.id)}
                  className="px-2 py-0.5 rounded border border-border bg-secondary/30 text-[9px] font-bold text-foreground hover:bg-secondary/60 transition-colors"
                >
                  Trial
                </button>
                <button
                  type="button"
                  onClick={() => onPromoteProposal?.(prop.id)}
                  className="px-2 py-0.5 rounded border border-violet-500/40 bg-violet-500/20 text-[9px] font-bold text-violet-300 hover:bg-violet-500/30 transition-colors"
                >
                  Ratify
                </button>
              </div>
            </div>
          </div>
        )))}
      </div>
    </div>
  );
}
