'use client';

import React, { useState } from 'react';
import { Terminal, ChevronDown, ChevronUp, Play, Scale, Pause } from 'lucide-react';
import type { ActivityEvent } from '@neiman/events';

interface LowerTelemetryWaterfallProps {
  activity: ActivityEvent[];
  onOpenDrawer?: (drawerId: string) => void;
}

export function LowerTelemetryWaterfall({ activity, onOpenDrawer }: LowerTelemetryWaterfallProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'TELEMETRY' | 'OPERATOR'>('TELEMETRY');
  const [operatorNotice, setOperatorNotice] = useState<string | null>(null);

  const handleAction = (msg: string) => {
    setOperatorNotice(msg);
    setTimeout(() => setOperatorNotice(null), 3000);
  };

  return (
    <div className="w-full max-w-4xl px-2 font-mono transition-all duration-200">
      <div className="rounded border border-border/40 bg-card/60 backdrop-blur-md overflow-hidden">
        {/* Dock Header Bar */}
        <div className="flex items-center justify-between px-3 py-1 bg-secondary/30 border-b border-border/30 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              <Terminal className="h-3.5 w-3.5 text-foreground" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-foreground">
                Telemetry Waterfall
              </span>
            </div>

            <div className="flex items-center gap-1 bg-background/90 p-0.5 rounded border border-border text-[9px]">
              <button
                type="button"
                onClick={() => setActiveTab('TELEMETRY')}
                className={`px-2 py-0.5 rounded font-semibold transition-colors ${
                  activeTab === 'TELEMETRY'
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                EVENTS
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('OPERATOR')}
                className={`px-2 py-0.5 rounded font-semibold transition-colors ${
                  activeTab === 'OPERATOR'
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                ACTIONS
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {operatorNotice && (
              <span className="text-[9px] text-emerald-500 font-semibold uppercase tracking-wider">
                [{operatorNotice}]
              </span>
            )}
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              aria-label={isExpanded ? 'Collapse telemetry drawer' : 'Expand telemetry drawer'}
            >
              {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
            </button>
          </div>
        </div>

        {/* Tab 1: Live Event Stream Waterfall */}
        {activeTab === 'TELEMETRY' && (
          <div className={`p-2 space-y-1 transition-all overflow-y-auto ${isExpanded ? 'max-h-40' : 'max-h-14'}`}>
            {activity.length > 0 ? (
              activity.slice(0, isExpanded ? 8 : 2).map((event, idx) => (
                <div
                  key={event.id || idx}
                  className="flex items-center justify-between text-[10px] px-2 py-0.5 rounded border border-border/50 bg-secondary/20 hover:border-border transition-colors"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span className="text-muted-foreground font-mono text-[9px]">
                      {event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : 'LIVE'}
                    </span>
                    <span className="text-foreground truncate max-w-[280px] sm:max-w-md font-medium">
                      {event.summary || ('action' in event && typeof (event as Record<string, unknown>).action === 'string' ? (event as Record<string, unknown>).action as string : 'Agent state change')}
                    </span>
                  </div>
                  <span className="text-[8px] uppercase font-mono px-1 py-0.2 rounded border border-border bg-secondary text-muted-foreground ml-2">
                    {event.event_type || 'SYSTEM'}
                  </span>
                </div>
              ))
            ) : (
              <div className="flex items-center justify-between text-[10px] px-2 py-1 text-muted-foreground italic">
                <span>Synchronized with autonomous event stream...</span>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Quick-Action Operator Bar */}
        {activeTab === 'OPERATOR' && (
          <div className="p-2 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  onOpenDrawer?.('tasks');
                  handleAction('Task Dispatcher');
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-border bg-secondary/60 hover:bg-secondary text-foreground text-[10px] font-semibold transition-colors"
              >
                <Play className="h-3 w-3" />
                <span>Dispatch Task</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onOpenDrawer?.('councils');
                  handleAction('Emergency Council');
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-border bg-secondary/60 hover:bg-secondary text-foreground text-[10px] font-semibold transition-colors"
              >
                <Scale className="h-3 w-3" />
                <span>Convene Council</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  handleAction('Global Pause Active');
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 text-[10px] font-semibold transition-colors"
              >
                <Pause className="h-3 w-3" />
                <span>Global Hold</span>
              </button>
            </div>

            <span className="text-[9px] text-muted-foreground font-mono">
              <kbd className="px-1 py-0.2 rounded border border-border bg-secondary">Ctrl+K</kbd> Hub
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
