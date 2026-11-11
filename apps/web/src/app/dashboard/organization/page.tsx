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

  const { data: state, isLoading } = useQuery<ControlRoomState>({
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
