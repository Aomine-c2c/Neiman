'use client';

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Play, Pause, FastForward, Sparkles, Loader2 } from 'lucide-react';
import { ctoApi } from '@/lib/api/cto';
import { useOrganizationContext } from '@/lib/organizationContext';
import { NEIMAN_CONFIG } from '@neiman/config';

interface HeaderSupervisorPillProps {
  onOpenDrawer?: (drawerId: string, entityId?: string) => void;
}

export function HeaderSupervisorPill({ onOpenDrawer }: HeaderSupervisorPillProps) {
  const activeCompany = useOrganizationContext();
  const companyId = activeCompany?.id || '';
  const qc = useQueryClient();

  const { data: supervisor, isLoading } = useQuery({
    queryKey: ['supervisor-status', companyId],
    queryFn: () => ctoApi.getSupervisorStatus(companyId),
    enabled: !!companyId,
    refetchInterval: NEIMAN_CONFIG.TELEMETRY.POLLING_INTERVALS.NORMAL,
    staleTime: NEIMAN_CONFIG.TELEMETRY.STALE_TIMES.FAST,
  });

  const { data: proposals = [] } = useQuery({
    queryKey: ['cto-proposals', companyId],
    queryFn: () => ctoApi.getProposals(companyId),
    enabled: !!companyId,
    refetchInterval: NEIMAN_CONFIG.TELEMETRY.POLLING_INTERVALS.MEDIUM,
    staleTime: NEIMAN_CONFIG.TELEMETRY.STALE_TIMES.NORMAL,
  });

  const pendingProposalsCount = proposals.filter((p) => p.status === 'PROPOSED').length;
  const isPlaying = supervisor?.state === 'PLAYING' || supervisor?.is_running === true;
  const cycleCount = supervisor?.active_cycle ?? 0;

  const toggleMutation = useMutation({
    mutationFn: (action: 'PLAY' | 'PAUSE') => ctoApi.toggleSupervisor(companyId, action),
    onSuccess: (data) => {
      qc.setQueryData(['supervisor-status', companyId], data);
      qc.invalidateQueries({ queryKey: ['control-room-state', companyId] });
      qc.invalidateQueries({ queryKey: ['tasks', companyId] });
    },
  });

  const tickMutation = useMutation({
    mutationFn: () => ctoApi.triggerTick(companyId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supervisor-status', companyId] });
      qc.invalidateQueries({ queryKey: ['control-room-state', companyId] });
      qc.invalidateQueries({ queryKey: ['tasks', companyId] });
    },
  });

  if (!companyId) return null;

  return (
    <div
      className="flex items-center gap-1 rounded-md border border-border bg-secondary/40 px-2 py-0.5 font-mono text-[10px] tabular-nums select-none"
      role="group"
      aria-label="Autonomous Supervisor Transport Controls"
    >
      {/* Status Indicator + Cycle Counter */}
      <div className="flex items-center gap-1.5 pr-1.5 border-r border-border/60">
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            isPlaying ? 'bg-foreground' : 'bg-muted-foreground'
          }`}
        />
        <span className="font-bold text-foreground uppercase tracking-wider">
          {isLoading ? 'SYNC' : isPlaying ? 'ACTIVE' : 'PAUSED'}
        </span>
        <span className="text-muted-foreground">
          CYC:{String(cycleCount).padStart(2, '0')}
        </span>
      </div>

      {/* Play / Pause Button */}
      <button
        type="button"
        onClick={() => toggleMutation.mutate(isPlaying ? 'PAUSE' : 'PLAY')}
        disabled={toggleMutation.isPending}
        aria-label={isPlaying ? 'Pause Autonomous Supervisor' : 'Start Autonomous Supervisor'}
        title={isPlaying ? 'Pause Supervisor Loop' : 'Start Supervisor Loop'}
        className="flex items-center justify-center h-5 w-5 rounded text-foreground hover:bg-secondary transition-colors disabled:opacity-40"
      >
        {toggleMutation.isPending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : isPlaying ? (
          <Pause className="h-3 w-3 fill-current" />
        ) : (
          <Play className="h-3 w-3 fill-current" />
        )}
      </button>

      {/* Single Step Tick Button */}
      <button
        type="button"
        onClick={() => tickMutation.mutate()}
        disabled={tickMutation.isPending}
        aria-label="Step Single Supervisor Cycle"
        title="Execute Single Supervisor Tick"
        className="flex items-center justify-center h-5 w-5 rounded text-foreground hover:bg-secondary transition-colors disabled:opacity-40"
      >
        {tickMutation.isPending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <FastForward className="h-3 w-3" />
        )}
      </button>

      {/* Pending CTO Proposals Badge */}
      {pendingProposalsCount > 0 && (
        <button
          type="button"
          onClick={() => onOpenDrawer?.('decisions')}
          className="ml-0.5 flex items-center gap-1 rounded bg-secondary border border-border px-1.5 py-0.5 text-[9px] font-bold text-foreground hover:bg-secondary/80 transition-colors"
          title="Inspect Proactive CTO Proposals"
        >
          <Sparkles className="h-2.5 w-2.5" />
          <span>{pendingProposalsCount} PROP</span>
        </button>
      )}
    </div>
  );
}

