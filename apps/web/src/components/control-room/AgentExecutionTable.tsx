'use client';

import React from 'react';
import { Bot, ArrowRight, Activity, Terminal } from 'lucide-react';
import type { Agent } from '@/lib/api/agents';
import { AgentAvatar } from '@/components/ui/AgentAvatar';

interface AgentExecutionTableProps {
  agents: Agent[];
  onOpenDrawer?: (drawerId: string) => void;
}

// Rows rendered by the table. Live agents carry the full `Agent` shape; the
// placeholder rows only carry the columns the table actually displays, so the
// shared type is a narrowed subset instead of a structurally different object.
type DisplayAgent = Pick<Agent, 'id' | 'name' | 'role_id' | 'status' | 'autonomy'> & {
  identity?: Record<string, unknown>;
};

export function AgentExecutionTable({ agents, onOpenDrawer }: AgentExecutionTableProps) {
  const displayAgents: DisplayAgent[] = agents.length > 0 ? agents : [
    { id: '1', name: 'Chief Architect Agent', role_id: 'Systems', status: 'WORKING', autonomy: 'AUTONOMOUS' },
    { id: '2', name: 'Security Sentinel', role_id: 'SecOps', status: 'WORKING', autonomy: 'SEMI_AUTONOMOUS' },
    { id: '3', name: 'Backend Pipeline Agent', role_id: 'Engineering', status: 'ACTIVE', autonomy: 'AUTONOMOUS' },
    { id: '4', name: 'Autonomous QA Agent', role_id: 'Quality', status: 'AVAILABLE', autonomy: 'SUPERVISED' },
  ];

  return (
    <div className="flex flex-col h-full font-mono overflow-hidden">
      {/* Pane Header */}
      <div className="flex items-center justify-between pb-1.5 border-b border-border/40">
        <div className="flex items-center gap-2">
          <Bot className="h-3.5 w-3.5 text-foreground" />
          <span className="text-[10px] uppercase font-bold tracking-wider text-foreground">
            Live Workforce & Sub-Task Execution
          </span>
          <span className="text-[9px] px-1.5 py-0.2 rounded border border-border bg-secondary text-muted-foreground">
            {agents.filter((a) => a.status === 'WORKING' || a.status === 'ACTIVE').length} Active
          </span>
        </div>
        <button
          type="button"
          onClick={() => onOpenDrawer?.('agents')}
          className="text-[9px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
        >
          <span>Matrix</span>
          <ArrowRight className="h-2.5 w-2.5" />
        </button>
      </div>

      {/* High-Density Data Table */}
      <div className="flex-1 overflow-x-auto overflow-y-auto max-h-56 select-text text-xs">
        <table className="w-full text-left border-collapse text-[11px]">
          <thead>
            <tr className="border-b border-border/80 text-[9px] uppercase tracking-wider text-muted-foreground bg-secondary/10">
              <th className="py-1.5 px-3 font-semibold">Agent</th>
              <th className="py-1.5 px-2 font-semibold">Status</th>
              <th className="py-1.5 px-2 font-semibold">Autonomy</th>
              <th className="py-1.5 px-3 font-semibold text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40 font-mono">
            {displayAgents.map((agent) => (
              <tr
                key={agent.id}
                onClick={() => onOpenDrawer?.('agents')}
                className="hover:bg-secondary/40 transition-colors cursor-pointer group"
              >
                <td className="py-1.5 px-3 flex items-center gap-2">
                  <AgentAvatar
                    name={agent.name}
                    status={agent.status}
                    avatarUrl={agent.identity?.avatar_url as string | undefined}
                    size={16}
                    showStatus={false}
                  />
                  <div className="truncate max-w-[130px]">
                    <span className="font-semibold text-foreground block truncate">{agent.name}</span>
                    <span className="text-[9px] text-muted-foreground">{agent.role_id || 'Core Swarm'}</span>
                  </div>
                </td>

                <td className="py-1.5 px-2">
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold ${
                      agent.status === 'WORKING' || agent.status === 'ACTIVE'
                        ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30'
                        : 'bg-muted/40 text-muted-foreground border border-border'
                    }`}
                  >
                    <span
                      className={`h-1 w-1 rounded-full ${
                        agent.status === 'WORKING' || agent.status === 'ACTIVE'
                          ? 'bg-emerald-500 animate-pulse'
                          : 'bg-muted-foreground'
                      }`}
                    />
                    {agent.status}
                  </span>
                </td>

                <td className="py-1.5 px-2 text-[9px] text-muted-foreground">
                  {agent.autonomy || 'AUTONOMOUS'}
                </td>

                <td className="py-1.5 px-3 text-right">
                  <span className="text-[9px] text-muted-foreground group-hover:text-foreground underline">
                    Inspect
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
