'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Building2, ChevronDown, Check, Plus, Globe } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { NEIMAN_CONFIG } from '@neiman/config';
import { organizationsApi } from '@/lib/api/organizations';
import { useAuthStore, NexoraCompany } from '@/store/auth';

export function OrganizationSwitcher() {
  const { activeCompany, setActiveCompany } = useAuthStore();
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: () => organizationsApi.list(),
    staleTime: NEIMAN_CONFIG.TELEMETRY.STALE_TIMES.MEDIUM,
  });

  const handleSelect = (company: NexoraCompany) => {
    setActiveCompany(company);
    qc.invalidateQueries();
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        id="org-switcher-button"
        className="flex items-center gap-2 rounded-lg border border-border/80 bg-secondary/40 px-3 py-1.5 text-xs text-foreground hover:bg-secondary/70 transition-colors"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Switch active organization"
      >
        <Building2 className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
        <span className="max-w-[130px] truncate font-medium">
          {activeCompany ? activeCompany.name : 'Select Company'}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            className="absolute left-0 top-full mt-1.5 z-50 w-64 rounded-lg border border-border bg-card shadow-2xl p-1.5 space-y-1 font-mono"
            role="listbox"
          >
            <div className="px-2.5 py-1 text-[10px] font-bold tracking-wider text-muted-foreground uppercase border-b border-border">
              Organizations ({companies.length})
            </div>

            <div className="max-h-56 overflow-y-auto space-y-0.5">
              {companies.map((comp) => {
                const isSelected = activeCompany?.id === comp.id;
                return (
                  <button
                    key={comp.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors ${
                      isSelected
                        ? 'bg-secondary text-foreground font-bold'
                        : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                    }`}
                    onClick={() => handleSelect(comp)}
                  >
                    <div className="min-w-0 flex items-center gap-2">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-secondary text-primary">
                        <Building2 className="h-3 w-3" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate leading-none">{comp.name}</p>
                        {comp.industry && (
                          <span className="text-[10px] text-muted-foreground truncate block mt-0.5">
                            {comp.industry}
                          </span>
                        )}
                      </div>
                    </div>
                    {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>

            <div className="border-t border-border/60 pt-1">
              <Link
                href="/dashboard/organizations"
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-primary hover:bg-primary/10 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Create or manage organizations</span>
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
