'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { NEIMAN_CONFIG } from '@neiman/config';
import {
  Activity,
  Command,
  Radio,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOrganizationContext } from '@/lib/organizationContext';
import { api } from '@/lib/api/client';

interface ActivityEvent {
  id: string;
  created_at: string;
  actor_name?: string;
  action: string;
  status?: string;
  domain?: string;
}

interface CockpitFooterDockProps {
  onOpenDrawer?: (drawerId: string) => void;
  activeDrawerId?: string | null;
  onOpenCommandPalette?: () => void;
}

export function CockpitFooterDock({
  onOpenDrawer,
  activeDrawerId,
  onOpenCommandPalette,
}: CockpitFooterDockProps) {
  const activeCompany = useOrganizationContext();
  const companyId = activeCompany?.id || '';

  // Live activity query for recent events
  const { data: recentEvents = [], isError } = useQuery<ActivityEvent[]>({
    queryKey: ['footer-recent-activity', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const res = await api.get<Record<string, unknown>[]>(`/api/v1/companies/${companyId}/activity?limit=5`);
      if (Array.isArray(res)) {
        return res.map((item) => ({
          id: (typeof item.id === 'string' && item.id) || Math.random().toString(),
          created_at: (typeof item.created_at === 'string' && item.created_at) || new Date().toISOString(),
          actor_name:
            (typeof item.actor_name === 'string' && item.actor_name) ||
            (typeof item.agent_name === 'string' && item.agent_name) ||
            'System Engine',
          action:
            (typeof item.action === 'string' && item.action) ||
            (typeof item.description === 'string' && item.description) ||
            (typeof item.title === 'string' && item.title) ||
            (typeof item.summary === 'string' && item.summary) ||
            'Activity event recorded',
          status: (typeof item.status === 'string' && item.status) || 'RECORDED',
          domain: (typeof item.domain === 'string' && item.domain) || 'SYS',
        }));
      }
      return [];
    },
    enabled: !!companyId,
    refetchInterval: NEIMAN_CONFIG.TELEMETRY.POLLING_INTERVALS.MEDIUM,
    staleTime: NEIMAN_CONFIG.TELEMETRY.STALE_TIMES.FAST,
  });

  const latestEvent = recentEvents[0] ?? null;

  const formatEventTime = (isoString?: string) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return '—';
    }
  };

  return (
    <footer
      className="sticky bottom-0 z-30 flex h-9 shrink-0 items-center justify-between border-t border-border/80 bg-background/95 backdrop-blur-xl px-3 lg:px-5 select-none font-mono text-xs tabular-nums"
      role="navigation"
      aria-label="Mission control live activity ticker"
    >
      {/* 1. Left Indicator: Live Radar Stream Status */}
      <div className="flex items-center gap-2.5 shrink-0">
        <button
          type="button"
          onClick={() => onOpenDrawer?.('activity')}
          className="flex items-center gap-2 px-2 py-1 rounded hover:bg-secondary/60 transition-colors group focus:outline-none"
          title="Open Activity Stream"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
          </span>
          <span className="text-[10px] uppercase font-bold tracking-widest text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
            RADAR // STREAM
          </span>
        </button>

        <div className="hidden sm:block h-3.5 w-px bg-border/60" aria-hidden="true" />

        <div className="hidden md:flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase">
          <Radio className={`h-3 w-3 ${isError ? 'text-amber-500' : 'text-emerald-500 animate-pulse'}`} />
          <span className={isError ? 'text-amber-500 font-semibold' : 'text-emerald-500 font-semibold'}>
            {isError ? 'DEGRADED' : companyId ? 'SYNCED' : 'IDLE'}
          </span>
          <span>({recentEvents.length} RECENT)</span>
        </div>
      </div>

      {/* 2. Center: Streaming Activity Event Banner */}
      <div className="flex-1 max-w-3xl mx-3 overflow-hidden">
        <button
          type="button"
          onClick={() => onOpenDrawer?.('activity')}
          className="flex items-center gap-2 w-full text-left truncate px-2.5 py-0.5 rounded hover:bg-secondary/40 transition-colors focus:outline-none group"
        >
          {latestEvent ? (
            <>
              <span className="text-[10px] text-muted-foreground/70 shrink-0 font-mono tabular-nums">
                [{formatEventTime(latestEvent.created_at)}]
              </span>
              <span className="text-[10px] font-bold text-foreground px-1.5 py-0.5 rounded-sm bg-secondary shrink-0 border border-border/50">
                {latestEvent.actor_name}
              </span>
              <span className="text-[11px] font-sans text-muted-foreground truncate group-hover:text-foreground transition-colors">
                {latestEvent.action}
              </span>
            </>
          ) : (
            <span className="text-[11px] text-muted-foreground truncate">
              {companyId ? 'No activity events recorded yet — click to open audit stream' : 'Select or create an organization to stream activity'}
            </span>
          )}
          <ChevronRight className="h-3 w-3 text-muted-foreground/60 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
        </button>
      </div>

      {/* 3. Right: Keyboard Chords & Command Hub Trigger (Cmd+K) */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="hidden xl:flex items-center gap-1.5 text-[10px] text-muted-foreground mr-2">
          <span>KEYS:</span>
          <kbd className="px-1 py-0.2 bg-secondary border border-border/60 rounded text-[9px]">0</kbd>
          <span>HQ</span>
          <kbd className="px-1 py-0.2 bg-secondary border border-border/60 rounded text-[9px]">1-6</kbd>
          <span>DOMAINS</span>
        </div>

        <button
          type="button"
          onClick={() => onOpenDrawer?.('activity')}
          className={cn(
            'hidden lg:flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold transition-all focus:outline-none',
            activeDrawerId === 'activity'
              ? 'bg-foreground text-background shadow-2xs'
              : 'text-muted-foreground hover:bg-secondary hover:text-foreground border border-border/40'
          )}
        >
          <Activity className="h-3 w-3" />
          <span>Stream Log</span>
        </button>

        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-secondary/80 hover:bg-secondary text-foreground border border-border/60 text-[10px] tracking-wider transition-colors shadow-2xs focus:outline-none"
          title="Open Universal Command Hub (Cmd+K)"
        >
          <Command className="h-3 w-3 text-primary" />
          <span className="font-semibold hidden sm:inline">HUB</span>
          <kbd className="hidden sm:inline-block px-1 py-0.2 bg-background border border-border/60 rounded text-[9px] text-muted-foreground">
            ⌘K
          </kbd>
        </button>
      </div>
    </footer>
  );
}
