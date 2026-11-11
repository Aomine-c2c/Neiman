'use client';

import React, { useState } from 'react';
import {
  Bot,
  Play,
  Pause,
  Focus,
  ExternalLink,
  Shield,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  ChevronRight,
  Filter,
} from 'lucide-react';
import type { Agent } from '@/lib/api/agents';

interface WorkforcePanelProps {
  agents: Agent[];
  selectedAgentId?: string | null;
  onSelectAgent: (agentId: string) => void;
  onOpenDrawer?: (drawerId: string) => void;
  onTogglePauseAgent?: (agentId: string) => void;
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
  onClose?: () => void;
}

export function WorkforcePanel({
  agents,
  selectedAgentId,
  onSelectAgent,
  onOpenDrawer,
  onTogglePauseAgent,
  isMinimized,
  onToggleMinimize,
  onClose,
}: WorkforcePanelProps) {
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'BLOCKED' | 'IDLE'>('ALL');

  const filteredAgents = agents.filter((ag) => {
    if (filter === 'ACTIVE') return ag.status === 'WORKING' || ag.status === 'ACTIVE';
    if (filter === 'BLOCKED') return ag.status === 'BLOCKED' || ag.status === 'FAILED';
    if (filter === 'IDLE') return ag.status === 'IDLE' || ag.status === 'WAITING';
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'WORKING':
      case 'ACTIVE':
        return {
          label: 'WORKING',
          dotClass: 'bg-emerald-400 animate-pulse',
          textClass: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
        };
      case 'THINKING':
        return {
          label: 'THINKING',
          dotClass: 'bg-cyan-400 animate-ping',
          textClass: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
        };
      case 'WAITING':
        return {
          label: 'WAITING',
          dotClass: 'bg-amber-400',
          textClass: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
        };
      case 'BLOCKED':
      case 'FAILED':
        return {
          label: status,
          dotClass: 'bg-rose-500 animate-ping',
          textClass: 'text-rose-400 border-rose-500/30 bg-rose-500/10',
        };
      default:
        return {
          label: 'IDLE',
          dotClass: 'bg-zinc-500',
          textClass: 'text-zinc-400 border-zinc-500/30 bg-zinc-500/10',
        };
    }
  };

  const getAssignedModel = (ag: Agent) => {
    const config = ag.intelligence_config as Record<string, unknown> | undefined;
    return (config?.model as string) || (config?.provider as string) || 'Dynamic Intelligence Mesh';
  };

  const getAutonomyLevel = (ag: Agent) => {
    return ag.autonomy || 'AUTONOMOUS';
  };

  const getActiveTask = (ag: Agent) => {
    if (ag.status === 'FAILED') return 'QUARANTINE: CGroup memory violation';
    if (ag.status === 'BLOCKED') return 'Awaiting schema consensus verification';
    if (ag.status === 'WORKING' || ag.status === 'ACTIVE') {
      return (ag.responsibilities?.[0] as string) || 'Distributed multi-agent pipeline synthesis';
    }
    return 'Listening for dispatched orchestrations';
  };

  if (isMinimized) {
    return (
      <div className="neiman-panel rounded-lg p-2.5 flex items-center justify-between font-mono text-xs w-64">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-cyan-400" />
          <span className="font-bold text-foreground tracking-wider uppercase text-[11px]">Workforce</span>
          <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
            {agents.filter((a) => a.status === 'WORKING' || a.status === 'ACTIVE').length}/{agents.length}
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
    <div className="neiman-panel rounded-xl flex flex-col font-mono text-xs overflow-hidden select-none w-80 lg:w-88 max-h-[380px] shadow-2xl">
      {/* Panel Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-cyan-500/20 bg-background/50">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-cyan-400" />
          <span className="font-bold text-foreground uppercase tracking-widest text-[11px]">
            Workforce Swarm
          </span>
          <span className="text-[9px] text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/30">
            {agents.length} AGENTS
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onOpenDrawer?.('agents')}
            className="p-1 rounded text-muted-foreground hover:text-cyan-400 hover:bg-secondary/40 transition-colors"
            title="Open Full Workforce Matrix"
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

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border/30 bg-black/20 text-[9px]">
        {(['ALL', 'ACTIVE', 'BLOCKED', 'IDLE'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setFilter(tab)}
            className={`px-2 py-0.5 rounded transition-colors uppercase ${
              filter === tab
                ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Agents Scrollable List */}
      <div className="flex-1 overflow-y-auto divide-y divide-border/20 p-1 space-y-1">
        {filteredAgents.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground text-[10px]">
            No agents match the current filter.
          </div>
        ) : (
          filteredAgents.map((ag) => {
            const isSelected = ag.id === selectedAgentId;
            const badge = getStatusBadge(ag.status);
            const model = getAssignedModel(ag);
            const autonomy = getAutonomyLevel(ag);
            const task = getActiveTask(ag);

            return (
              <div
                key={ag.id}
                onClick={() => onSelectAgent(ag.id)}
                className={`p-2 rounded-lg cursor-pointer transition-all duration-150 ${
                  isSelected
                    ? 'bg-cyan-500/15 border border-cyan-400/50 shadow-[0_0_12px_rgba(0,242,254,0.15)]'
                    : 'hover:bg-secondary/30 border border-transparent hover:border-cyan-500/20'
                }`}
              >
                <div className="flex items-start justify-between gap-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`h-2 w-2 rounded-full shrink-0 ${badge.dotClass}`} />
                    <span className="font-bold text-foreground text-xs truncate">{ag.name}</span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <span
                      className={`text-[8px] font-bold px-1.5 py-0.2 rounded border uppercase tracking-wider ${badge.textClass}`}
                    >
                      {badge.label}
                    </span>
                  </div>
                </div>

                {/* Subtask info */}
                <p className="mt-1 text-[10px] text-muted-foreground truncate leading-relaxed">
                  &gt; {task}
                </p>

                {/* Telemetry metadata footer */}
                <div className="mt-1.5 flex items-center justify-between text-[9px] text-muted-foreground pt-1 border-t border-border/20">
                  <div className="flex items-center gap-2">
                    <span className="text-cyan-400 font-medium truncate max-w-[110px]">{model}</span>
                    <span className="text-muted-foreground/40">•</span>
                    <span className="uppercase text-[8px] tracking-wider text-muted-foreground">{autonomy}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectAgent(ag.id);
                      }}
                      className="p-1 rounded text-cyan-400 hover:bg-cyan-500/20"
                      title="Focus in Cognitive Core"
                    >
                      <Focus className="h-3 w-3" />
                    </button>
                    {onTogglePauseAgent && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onTogglePauseAgent(ag.id);
                        }}
                        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                        title={ag.status === 'WORKING' ? 'Pause Agent' : 'Resume Agent'}
                      >
                        {ag.status === 'WORKING' ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3 text-emerald-400" />}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
