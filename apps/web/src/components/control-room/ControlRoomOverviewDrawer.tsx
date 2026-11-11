'use client';

import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { NEIMAN_CONFIG } from '@neiman/config';
import { useAuthStore } from '@/store/auth';
import { controlRoomApi, type ControlRoomState } from '@/lib/api/controlRoom';
import { ControlRoomDashboard } from './ControlRoomDashboard';
import { useActivityStream } from '@/hooks/useActivityStream';

export function ControlRoomOverviewDrawer() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const { activeCompany } = useAuthStore();
  const companyId = activeCompany?.id;

  const handleOpenDrawer = (drawerId: string, entityId?: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('drawer', drawerId);
    if (entityId) {
      params.set('entityId', entityId);
    } else {
      params.delete('entityId');
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const {
    data: fetchedState,
    isLoading: queryLoading,
    isRefetching,
    refetch,
  } = useQuery<ControlRoomState>({
    queryKey: ['control-room-state', companyId],
    queryFn: () => controlRoomApi.getOperationalState(companyId!),
    enabled: !!companyId,
    staleTime: NEIMAN_CONFIG.TELEMETRY.STALE_TIMES.NORMAL,
    refetchInterval: NEIMAN_CONFIG.TELEMETRY.POLLING_INTERVALS.BACKGROUND,
  });

  const state = fetchedState ?? null;
  const isLoading = queryLoading && !state;

  const live = useActivityStream(companyId, state?.activity ?? []);

  const approvalMutation = useMutation({
    mutationFn: ({ approvalId, decision }: { approvalId: string; decision: 'APPROVED' | 'REJECTED' }) =>
      controlRoomApi.decideApproval(companyId!, approvalId, decision, 'Supervisory human decision from Control Room Overview'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['control-room-state', companyId] });
    },
  });

  if (!companyId || !activeCompany) {
    return (
      <div className="p-8 text-center text-xs text-muted-foreground font-mono">
        No active organization connected.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-xs font-mono text-muted-foreground">
          Synthesizing organization operating picture…
        </p>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <AlertTriangle className="h-6 w-6 text-amber-400" />
        <p className="text-xs text-muted-foreground">Operating picture unavailable</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-secondary"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <ControlRoomDashboard
      companyId={companyId}
      companyName={activeCompany.name}
      companyStatus={activeCompany.status}
      industry={activeCompany.industry}
      state={{
        ...state,
        activity: live.events.length > 0 ? live.events : state.activity,
      }}
      live={{
        connection: live.connection,
        transport: live.transport,
        freshIds: live.freshIds,
      }}
      isRefetching={isRefetching}
      previewMode={false}
      onDecideApproval={(approvalId, decision) =>
        approvalMutation.mutate({ approvalId, decision })
      }
      onOpenDrawer={handleOpenDrawer}
    />
  );
}

export default ControlRoomOverviewDrawer;

