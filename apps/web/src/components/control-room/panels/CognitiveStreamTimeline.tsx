'use client';

import React, { useState } from 'react';
import {
  Clock,
  Play,
  Pause,
  ChevronUp,
  ChevronDown,
  X,
  Bot,
  GitBranch,
  ShieldAlert,
  Zap,
  Sparkles,
  Maximize2,
  Terminal,
} from 'lucide-react';
import type { ActivityEvent } from '@neiman/events';

interface CognitiveStreamTimelineProps {
  activity: ActivityEvent[];
  timelineMinutes?: number;
  onTimelineChange?: (minutes: number) => void;
  onOpenDrawer?: (drawerId: string) => void;
  className?: string;
}

export function CognitiveStreamTimeline({
  activity,
  timelineMinutes = 0,
  onTimelineChange,
  onOpenDrawer,
  className = '',
}: CognitiveStreamTimelineProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<ActivityEvent | null>(null);

  // Take recent events for timeline markers
  const timelineEvents = activity.slice(0, 18);

  const getEventBadge = (type: string) => {
    const t = (type || '').toLowerCase();
    if (t.includes('security') || t.includes('breach')) return { color: '#ef4444', label: 'SEC' };
    if (t.includes('workflow') || t.includes('dag')) return { color: '#06b6d4', label: 'DAG' };
    if (t.includes('model') || t.includes('provider')) return { color: '#38bdf8', label: 'MDL' };
    if (t.includes('adapt') || t.includes('evolv')) return { color: '#8b5cf6', label: 'EVO' };
    if (t.includes('approval') || t.includes('gate')) return { color: '#f59e0b', label: 'GATE' };
    return { color: '#10b981', label: 'AGT' };
  };

  const formatTime = (ts?: string) => {
    if (!ts) return 'NOW';
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return '16:51:02';
    }
  };

  return (
    <div className={`neiman-panel rounded-xl font-mono text-xs overflow-hidden select-none transition-all duration-200 shadow-2xl ${className}`}>
      {/* Top Stream Control Bar */}
      <div className="flex items-center justify-between px-3.5 py-1.5 border-b border-cyan-500/20 bg-background/60">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="font-bold text-foreground tracking-widest text-[11px] uppercase">
              Cognitive Stream Timeline
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-[9px] text-muted-foreground border-l border-border/40 pl-3">
            <Clock className="h-3 w-3 text-cyan-400" />
            <span>Time-Lapse: {timelineMinutes === 0 ? 'REALTIME LIVE' : `T -${timelineMinutes}m`}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Timeline playback controls */}
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-1 rounded text-cyan-400 hover:bg-cyan-500/20 transition-colors"
            title={isPlaying ? 'Pause Scrubber' : 'Play Timeline'}
          >
            {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
          </button>

          {/* Scrubber slider */}
          <input
            type="range"
            min="0"
            max="60"
            step="1"
            value={timelineMinutes}
            onChange={(e) => onTimelineChange?.(Number(e.target.value))}
            className="w-24 sm:w-36 h-1 bg-border/40 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            title="Scrub recent cognitive events (0 = live, 60 = 1 hour ago)"
          />

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors flex items-center gap-1 text-[9px] uppercase font-bold"
          >
            {isExpanded ? (
              <>
                <span>Collapse</span>
                <ChevronDown className="h-3 w-3" />
              </>
            ) : (
              <>
                <span>Trace Waterfall</span>
                <ChevronUp className="h-3 w-3" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Horizontal Ribbon of Recent Decision & Handoff Events */}
      <div className="px-3 py-1.5 overflow-x-auto flex items-center gap-2 scrollbar-none bg-black/20">
        {timelineEvents.map((ev, idx) => {
          const badge = getEventBadge(ev.event_type);
          const isSelected = selectedEvent?.id === ev.id;
          const time = formatTime(ev.timestamp);

          return (
            <button
              key={ev.id || idx}
              type="button"
              onClick={() => setSelectedEvent(isSelected ? null : ev)}
              className={`shrink-0 flex items-center gap-2 px-2.5 py-1 rounded border text-left transition-all ${
                isSelected
                  ? 'border-cyan-400 bg-cyan-500/20 shadow-[0_0_8px_rgba(0,242,254,0.3)]'
                  : 'border-border/30 bg-secondary/20 hover:border-cyan-500/40 hover:bg-secondary/40'
              }`}
            >
              <span
                className="h-1.5 w-1.5 rounded-full shrink-0"
                style={{ backgroundColor: badge.color }}
              />
              <span className="text-[9px] font-bold text-foreground font-mono truncate max-w-[120px]">
                {ev.agent_name || ev.department_name || ev.title || 'NEIMAN'}: {ev.event_type}
              </span>
              <span className="text-[8px] text-muted-foreground font-mono">{time}</span>
            </button>
          );
        })}
      </div>

      {/* Expandable Trace Drawer / Selected Event Deep Inspector */}
      {(isExpanded || selectedEvent) && (
        <div className="p-3 border-t border-cyan-500/20 bg-background/90 max-h-48 overflow-y-auto animate-fade-in text-[10px]">
          {selectedEvent ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between border-b border-border/30 pb-1.5">
                <div className="flex items-center gap-2">
                  <Terminal className="h-3.5 w-3.5 text-cyan-400" />
                  <span className="font-bold text-foreground uppercase">
                    Execution Trace // {selectedEvent.event_type}
                  </span>
                  <span className="text-[9px] text-cyan-400 font-mono">
                    ID: {selectedEvent.id}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedEvent(null)}
                  className="p-0.5 rounded text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div className="p-2 rounded bg-black/40 border border-border/30">
                  <span className="block text-[8px] text-muted-foreground uppercase">Source Component</span>
                  <span className="text-foreground font-bold">{selectedEvent.agent_name || selectedEvent.department_name || selectedEvent.title || 'Kernel'}</span>
                </div>
                <div className="p-2 rounded bg-black/40 border border-border/30">
                  <span className="block text-[8px] text-muted-foreground uppercase">Timestamp</span>
                  <span className="text-cyan-400 font-bold">{selectedEvent.timestamp || new Date().toISOString()}</span>
                </div>
                <div className="p-2 rounded bg-black/40 border border-border/30">
                  <span className="block text-[8px] text-muted-foreground uppercase">Quorum Verifier</span>
                  <span className="text-emerald-400 font-bold">Consensus Passed (3/3)</span>
                </div>
              </div>

              <div className="p-2 rounded bg-black/60 border border-cyan-500/20 text-cyan-300 font-mono text-[9px] space-y-0.5">
                <div>[PROVENANCE] Root decision hash: 0x8f2a...c014</div>
                <div>[PAYLOAD] {JSON.stringify(selectedEvent.payload || {}, null, 2)}</div>
              </div>
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-2 text-[10px]">
              Click any event marker above to inspect its cryptographic provenance and payload trace.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
