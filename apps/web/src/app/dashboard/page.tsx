'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { NEIMAN_CONFIG } from '@neiman/config';
import { AlertTriangle, Building2, Loader2, Plus } from 'lucide-react';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth';
import { organizationsApi } from '@/lib/api/organizations';
import CouncilsDashboardPage from '@/app/dashboard/councils/page';

export default function DashboardMainPage() {
  const { activeCompany, user, setActiveCompany } = useAuthStore();
  const companyId = activeCompany?.id;

  // Load companies if none active
  const { data: companies = [], isLoading: companiesLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: () => organizationsApi.list(),
    enabled: !companyId,
    staleTime: NEIMAN_CONFIG.TELEMETRY.STALE_TIMES.MEDIUM,
  });

  // Automatically activate first available organization if none selected
  React.useEffect(() => {
    if (!companyId && companies.length > 0) {
      setActiveCompany(companies[0]);
    }
  }, [companyId, companies, setActiveCompany]);

  // Loading companies
  if (!companyId && companiesLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
        <p className="text-sm font-mono text-muted-foreground">
          Synthesizing organization operating picture…
        </p>
      </div>
    );
  }

  // Empty state: no company selected yet
  if (!companyId) {
    return (
      <div className="animate-fade-in space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Welcome{user?.first_name ? `, ${user.first_name}` : ''}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            NEIMAN — Autonomous Organization OS
          </p>
        </div>

        {companies.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-6 rounded-2xl border border-dashed border-border py-24">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
              <Building2 className="h-10 w-10 text-primary" aria-hidden="true" />
            </div>
            <div className="text-center max-w-sm">
              <h2 className="text-xl font-semibold text-foreground">
                Create your first organization
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Build an AI-powered company with departments, agents, workflows, and governance — all in one place.
              </p>
            </div>
            <Link
              href="/dashboard/organizations"
              id="create-first-company-btn"
              className="btn btn-primary gap-2"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create Organization
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-400" aria-hidden="true" />
              <div>
                <p className="font-medium text-amber-300">No active organization selected</p>
                <p className="text-sm text-amber-400/80 mt-0.5">
                  Go to{' '}
                  <Link href="/dashboard/organizations" className="underline hover:text-amber-300">
                    Organizations
                  </Link>{' '}
                  and click &quot;Set Active&quot; on a company.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Primary Chat-First Unified Command Room (renders CouncilsDashboardPage)
  return <CouncilsDashboardPage />;
}
