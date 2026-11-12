'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { NEIMAN_CONFIG } from '@neiman/config';
import { Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useAuthStore } from '@/store/auth';
import { controlRoomApi, type ControlRoomState } from '@/lib/api/controlRoom';

const OrganizationalGraph = dynamic(
  () => import('@/components/OrganizationalGraph').then((mod) => mod.OrganizationalGraph),
  {
    loading: () => (
      <div className="flex flex-col items-center justify-center py-24 gap-3 rounded-2xl border border-border bg-card/40">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-mono text-muted-foreground">Loading Organizational Canvas Engine…</p>
      </div>
    ),
    ssr: false,
  }
);

export default function OrganizationMapPage() {
  const { activeCompany } = useAuthStore();
  const companyId = activeCompany?.id;

  const { data: state, isLoading, isError, error, refetch } = useQuery<ControlRoomState>({
    queryKey: ['control-room-state', companyId],
    queryFn: () => controlRoomApi.getOperationalState(companyId!),
    enabled: !!companyId,
    staleTime: NEIMAN_CONFIG.TELEMETRY.STALE_TIMES.NORMAL,
  });

  if (!activeCompany) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
        <p className="text-sm font-mono">No active organization selected. Please select or create an organization first.</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div role="alert" className="flex flex-col items-center justify-center py-24 gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/5 text-center px-6">
        <p className="text-sm font-semibold text-foreground">Failed to load organizational map</p>
        <p className="text-xs font-mono text-muted-foreground">{(error as Error)?.message || 'Backend telemetry unavailable.'}</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="min-h-8 px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-semibold text-foreground hover:bg-secondary transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (isLoading || !state) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-mono text-muted-foreground">Rendering Organizational Map…</p>
      </div>
    );
  }

  return (
    <div className="w-full animate-fade-in space-y-4">
      <OrganizationalGraph
        companyName={activeCompany.name}
        companyStatus={activeCompany.status}
        departments={state.departments}
        agents={state.agents}
        projects={state.projects}
        tasks={state.tasks}
        decisions={state.decisions}
        roles={state.roles}
        audits={state.audits}
      />
    </div>
  );
}
