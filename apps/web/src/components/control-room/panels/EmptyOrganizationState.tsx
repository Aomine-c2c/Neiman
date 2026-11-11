'use client';

import React from 'react';
import { Bot, GitFork, Zap, Plus, Sparkles } from 'lucide-react';

interface EmptyOrganizationStateProps {
  onCreateAgent?: () => void;
  onOpenDrawer?: (drawerId: string) => void;
}

export function EmptyOrganizationState({ onCreateAgent, onOpenDrawer }: EmptyOrganizationStateProps) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-6 pointer-events-none">
      {/* Central nucleus — dimmed, waiting */}
      <div className="relative flex items-center justify-center">
        <div className="h-24 w-24 rounded-full border border-cyan-500/20 bg-cyan-500/5 animate-pulse flex items-center justify-center">
          <div className="h-12 w-12 rounded-full border border-cyan-400/30 bg-cyan-500/10 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-cyan-400/60" />
          </div>
        </div>
        {/* Dim orbital rings */}
        <div className="absolute h-36 w-36 rounded-full border border-cyan-500/10 animate-[spin_20s_linear_infinite]" />
        <div className="absolute h-48 w-48 rounded-full border border-cyan-500/6 animate-[spin_30s_linear_infinite_reverse]" />
      </div>

      {/* Label */}
      <div className="text-center pointer-events-auto space-y-1">
        <p className="text-sm font-bold text-foreground tracking-wider uppercase font-mono">Organization Initialized</p>
        <p className="text-xs text-muted-foreground font-mono max-w-xs text-center leading-relaxed">
          The Cognitive Core is ready. Create your first agent to begin autonomous operations.
        </p>
      </div>

      {/* Quick-start actions */}
      <div className="flex items-center gap-2 pointer-events-auto">
        <button
          type="button"
          onClick={onCreateAgent}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-cyan-500/50 bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25 transition-colors text-xs font-bold font-mono"
        >
          <Plus className="h-3.5 w-3.5" />
          Create First Agent
        </button>
        <button
          type="button"
          onClick={() => onOpenDrawer?.('workflows')}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border/40 bg-secondary/30 text-muted-foreground hover:text-foreground transition-colors text-xs font-mono"
        >
          <GitFork className="h-3.5 w-3.5" />
          Import Workflow
        </button>
        <button
          type="button"
          onClick={() => onOpenDrawer?.('intelligence')}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border/40 bg-secondary/30 text-muted-foreground hover:text-foreground transition-colors text-xs font-mono"
        >
          <Zap className="h-3.5 w-3.5" />
          Connect Model
        </button>
      </div>

      {/* Status hint chips */}
      <div className="flex items-center gap-3 text-[9px] font-mono text-muted-foreground pointer-events-none">
        <span className="flex items-center gap-1">
          <Bot className="h-3 w-3" />
          0 agents
        </span>
        <span className="text-border/60">·</span>
        <span className="flex items-center gap-1">
          <GitFork className="h-3 w-3" />
          0 workflows
        </span>
        <span className="text-border/60">·</span>
        <span className="flex items-center gap-1.5 text-cyan-400/60">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400/60 animate-pulse" />
          Core ready
        </span>
      </div>
    </div>
  );
}
