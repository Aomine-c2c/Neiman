'use client';

import React, { useState } from 'react';
import {
  Activity,
  ShieldAlert,
  GitBranch,
  Bot,
  Zap,
  Cpu,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Filter,
} from 'lucide-react';
import type { ActivityEvent } from '@neiman/events';

interface LiveActivityPanelProps {
  activity: ActivityEvent[];
  onInspectEvent?: (event: ActivityEvent) => void;
  onOpenDrawer?: (drawerId: string) => void;
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
}

export function LiveActivityPanel({
  activity,
  onInspectEvent,
  onOpenDrawer,
  isMinimized,
  onToggleMinimize,
}: LiveActivityPanelProps) {
  const [filter, setFilter] = useState<'ALL' | 'SECURITY' | 'WORKFLOW' | 'ROUTING' | 'AGENT'>('ALL');

  const filteredEvents = activity.filter((ev) => {
    const type = (ev.event_type || '').toLowerCase();
    if (filter === 'SECURITY') return type.includes('security') || type.includes('breach') || type.includes('intercept');
    if (filter === 'WORKFLOW') return type.includes('workflow') || type.includes('dag') || type.includes('task');
    if (filter === 'ROUTING') return type.includes('model') || type.includes('provider') || type.includes('route') || type.includes('degrad');
    if (filter === 'AGENT') return type.includes('agent') || type.includes('swarm');
    return true;
  });

  const getEventIcon = (eventType: string) => {
    const type = eventType.toLowerCase();
    if (type.includes('security') || type.includes('breach')) return <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />;
    if (type.includes('workflow') || type.includes('dag')) return <GitBranch className="h-3.5 w-3.5 text-cyan-400" />;
    if (type.includes('model') || type.includes('provider') || type.includes('route')) return <Zap className="h-3.5 w-3.5 text-sky-400" />;
    if (type.includes('resource') || type.includes('compute')) return <Cpu className="h-3.5 w-3.5 text-amber-400" />;
    if (type.includes('evolution') || type.includes('adapt')) return <Sparkles className="h-3.5 w-3.5 text-violet-400" />;
    return <Bot className="h-3.5 w-3.5 text-emerald-400" />;
  };

  const getSeverityBadge = (ev: ActivityEvent) => {
    const type = (ev.event_type || '').toLowerCase();
    if (type.includes('fail') || type.includes('breach') || type.includes('critical') || type.includes('quarantine')) {
      return { label: 'CRIT', badgeClass: 'text-rose-400 border-rose-500/30 bg-rose-500/10' };
    }
    if (type.includes('warn') || type.includes('degrad') || type.includes('blocked') || type.includes('pressure')) {
      return { label: 'WARN', badgeClass: 'text-amber-400 border-amber-500/30 bg-amber-500/10' };
    }
    if (type.includes('adapt') || type.includes('evolv') || type.includes('route')) {
      return { label: 'INFO', badgeClass: 'text-violet-400 border-violet-500/30 bg-violet-500/10' };
    }
    return { label: 'NOM', badgeClass: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' };
  };

  const formatTimestamp = (ts?: string) => {
    if (!ts) return 'NOW';
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return '16:51:02';
    }
  };

  if (isMinimized) {
    return (
      <div className="neiman-panel rounded-lg p-2.5 flex items-center justify-between font-mono text-xs w-64">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-emerald-400 animate-pulse" />
          <span className="font-bold text-foreground tracking-wider uppercase text-[11px]">Live Activity</span>
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
    <div className="neiman-panel rounded-xl flex flex-col font-mono text-xs overflow-hidden select-none w-80 lg:w-88 max-h-[300px] shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-cyan-500/20 bg-background/50">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-emerald-400 animate-pulse" />
          <span className="font-bold text-foreground uppercase tracking-widest text-[11px]">
            Live Activity Stream
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onOpenDrawer?.('activity')}
            className="p-1 rounded text-muted-foreground hover:text-cyan-400 hover:bg-secondary/40 transition-colors"
            title="Open Complete Telemetry Stream"
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
        {(['ALL', 'SECURITY', 'WORKFLOW', 'ROUTING', 'AGENT'] as const).map((tab) => (
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

      {/* Events List */}
      <div className="flex-1 overflow-y-auto divide-y divide-border/20 p-1 space-y-1">
        {filteredEvents.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground text-[10px]">
            Telemetry channel quiescent. Zero events matching filter.
          </div>
        ) : (
          filteredEvents.slice(0, 15).map((ev) => {
            const sev = getSeverityBadge(ev);
            const icon = getEventIcon(ev.event_type);
            const time = formatTimestamp(ev.timestamp);

            return (
              <div
                key={ev.id}
                onClick={() => onInspectEvent?.(ev)}
                className="p-2 rounded-lg hover:bg-secondary/30 cursor-pointer transition-colors border border-transparent hover:border-cyan-500/20 group"
              >
                <div className="flex items-center justify-between text-[9px] text-muted-foreground mb-1">
                  <div className="flex items-center gap-1.5">
                    {icon}
                    <span className="font-bold text-foreground uppercase truncate max-w-[140px]">
                      {ev.agent_name || ev.department_name || ev.title || 'NEIMAN'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[8px] font-bold px-1 py-0.2 rounded border ${sev.badgeClass}`}>
                      {sev.label}
                    </span>
                    <span className="font-mono text-[9px] text-muted-foreground/70">{time}</span>
                  </div>
                </div>

                <p className="text-[10px] text-foreground/90 truncate leading-relaxed">
                  {ev.summary || ev.title || ev.event_type}
                </p>

                <div className="mt-1 flex items-center justify-between text-[8px] text-muted-foreground">
                  <span className="text-cyan-400/80 font-mono">Trace ID: {ev.id.slice(0, 10)}...</span>
                  <span className="text-cyan-400 group-hover:underline flex items-center gap-0.5">
                    Inspect <ChevronRight className="h-2.5 w-2.5" />
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
