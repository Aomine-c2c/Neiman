'use client';

import React from 'react';
import { Zap, ArrowRight } from 'lucide-react';
import type { Agent } from '@/lib/api/agents';
import type { Task } from '@/lib/api/controlRoom';

interface SwarmTopologyCanvasProps {
  agents: Agent[];
  tasks: Task[];
  onOpenDrawer?: (drawerId: string) => void;
}

export function SwarmTopologyCanvas({ agents, tasks, onOpenDrawer }: SwarmTopologyCanvasProps) {
  const activeAgents = agents.filter((a) => a.status === 'WORKING' || a.status === 'ACTIVE');
  const workingCount = activeAgents.length;
  const inProgressTasks = tasks.filter((t) => t.status === 'IN_PROGRESS');

  return (
    <div className="flex flex-col gap-2 p-2.5 rounded-lg border border-border bg-card/90 font-mono w-full shadow-2xs">
      {/* Header */}
      <div className="flex items-center justify-between pb-1.5 border-b border-border">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span className="text-[10px] uppercase font-bold tracking-wider text-foreground">
            Swarm Topology
          </span>
        </div>
        <button
          type="button"
          onClick={() => onOpenDrawer?.('agents')}
          className="text-[9px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition-colors"
        >
          <span>Matrix</span>
          <ArrowRight className="h-2.5 w-2.5" />
        </button>
      </div>

      {/* Industrial Stark Wiring Box */}
      <div className="relative h-20 w-full rounded border border-border/80 bg-background/60 p-2 overflow-hidden flex items-center justify-between">
        {/* Flat Minimalist Waveform Grid Lines */}
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 40">
            <line x1="0" y1="20" x2="100" y2="20" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" />
            <line x1="25" y1="0" x2="25" y2="40" stroke="currentColor" strokeWidth="0.5" />
            <line x1="75" y1="0" x2="75" y2="40" stroke="currentColor" strokeWidth="0.5" />
          </svg>
        </div>

        {/* Central Core Dispatcher Node */}
        <div className="relative z-10 flex flex-col items-center">
          <div className="h-7 w-7 rounded border border-primary/60 bg-primary/10 flex items-center justify-center">
            <Zap className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="text-[8px] text-muted-foreground mt-0.5 font-bold">CORE</span>
        </div>

        {/* Connected Agent Nodes */}
        <div className="relative z-10 flex flex-col gap-1 flex-1 max-w-[150px] ml-2.5">
          {agents.length > 0 ? (
            agents.slice(0, 3).map((agent) => (
              <div
                key={agent.id}
                onClick={() => onOpenDrawer?.('agents')}
                className="flex items-center justify-between px-1.5 py-0.5 rounded border border-border bg-secondary/50 text-[9px] hover:border-foreground/40 cursor-pointer transition-colors"
              >
                <span className="truncate max-w-[85px] font-medium text-foreground">
                  {agent.name.split(' ')[0]}
                </span>
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    agent.status === 'WORKING' || agent.status === 'ACTIVE'
                      ? 'bg-emerald-500'
                      : 'bg-muted-foreground/30'
                  }`}
                />
              </div>
            ))
          ) : (
            <span className="text-[9px] text-muted-foreground">No agents registered</span>
          )}
        </div>
      </div>

      {/* High-Density Telemetry Ticker */}
      <div className="grid grid-cols-2 gap-1.5 pt-0.5 text-[10px]">
        <div className="p-1.5 rounded border border-border/60 bg-secondary/30">
          <span className="text-[8px] text-muted-foreground block uppercase font-bold">Active Sync</span>
          <span className="font-bold text-foreground text-xs">{workingCount}/{agents.length}</span>
        </div>
        <div className="p-1.5 rounded border border-border/60 bg-secondary/30">
          <span className="text-[8px] text-muted-foreground block uppercase font-bold">Running Tasks</span>
          <span className="font-bold text-foreground text-xs">{inProgressTasks.length} Live</span>
        </div>
      </div>
    </div>
  );
}
