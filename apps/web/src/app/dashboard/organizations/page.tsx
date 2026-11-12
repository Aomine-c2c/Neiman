'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NEIMAN_CONFIG } from '@neiman/config';
import {
  Building2,
  Plus,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Globe,
  ChevronRight,
  Users,
  Bot,
  Cpu,
} from 'lucide-react';
import { organizationsApi, CreateCompanyRequest } from '@/lib/api/organizations';
import { useAuthStore } from '@/store/auth';
import { ApiError } from '@/lib/api/client';

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'badge-success',
  INACTIVE: 'badge-warning',
  ARCHIVED: 'badge-default',
  SUSPENDED: 'badge-destructive',
};

export default function OrganizationsPage() {
  const qc = useQueryClient();
  const { setActiveCompany } = useAuthStore();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateCompanyRequest>({
    name: '',
    industry: '',
    description: '',
    mission: '',
  });
  const [formError, setFormError] = useState<string | null>(null);

  // List companies
  const { data: companies = [], isLoading, error } = useQuery({
    queryKey: ['companies'],
    queryFn: () => organizationsApi.list(),
    staleTime: NEIMAN_CONFIG.TELEMETRY.STALE_TIMES.MEDIUM,
  });

  // Create company
  const createMutation = useMutation({
    mutationFn: (body: CreateCompanyRequest) => organizationsApi.create(body),
    onSuccess: (company) => {
      qc.invalidateQueries({ queryKey: ['companies'] });
      setActiveCompany(company);
      setShowCreate(false);
      setForm({ name: '', industry: '', description: '', mission: '' });
      setFormError(null);
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        setFormError(err.message);
      } else {
        setFormError('Failed to create organization. Please try again.');
      }
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormError('Organization name is required.');
      return;
    }
    setFormError(null);
    createMutation.mutate(form);
  };

  const handleSelectCompany = (company: typeof companies[0]) => {
    setActiveCompany(company);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Organizations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your AI-powered companies and their organizational DNA
          </p>
        </div>
        <button
          id="create-organization-btn"
          type="button"
          className="btn btn-primary gap-2"
          onClick={() => setShowCreate(true)}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          New Organization
        </button>
      </div>

      {/* Create form (inline modal) */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-org-title"
        >
          <div className="w-full max-w-lg glass rounded-2xl p-6 ring-1 ring-border shadow-2xl">
            <h2 id="create-org-title" className="text-lg font-semibold text-foreground mb-4">
              Create Organization
            </h2>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label
                  htmlFor="org-name"
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >
                  Name <span className="text-red-400">*</span>
                </label>
                <input
                  id="org-name"
                  type="text"
                  className="input"
                  placeholder="Acme Corp"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>

              <div>
                <label
                  htmlFor="org-industry"
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >
                  Industry
                </label>
                <input
                  id="org-industry"
                  type="text"
                  className="input"
                  placeholder="Technology, Healthcare, Finance…"
                  value={form.industry ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
                />
              </div>

              <div>
                <label
                  htmlFor="org-description"
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >
                  Description
                </label>
                <textarea
                  id="org-description"
                  rows={3}
                  className="input h-auto resize-none"
                  placeholder="What does this organization do?"
                  value={form.description ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>

              <div>
                <label
                  htmlFor="org-mission"
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >
                  Mission
                </label>
                <textarea
                  id="org-mission"
                  rows={2}
                  className="input h-auto resize-none"
                  placeholder="Our mission is to…"
                  value={form.mission ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, mission: e.target.value }))}
                />
              </div>

              {formError && (
                <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400" role="alert">
                  <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {formError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  className="btn btn-outline flex-1"
                  onClick={() => { setShowCreate(false); setFormError(null); }}
                >
                  Cancel
                </button>
                <button
                  id="create-org-submit"
                  type="submit"
                  className="btn btn-primary flex-1"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Creating…
                    </>
                  ) : (
                    'Create Organization'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* States */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Loading organizations" />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-400" role="alert">
          <AlertCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-medium">Failed to load organizations</p>
            <p className="text-sm opacity-80">
              {error instanceof ApiError ? error.message : 'Please check your connection and try again.'}
            </p>
          </div>
        </div>
      )}

      {!isLoading && !error && companies.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border py-20">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary/50">
            <Building2 className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-semibold text-foreground">No organizations yet</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Create your first AI-powered organization to get started.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary gap-2"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Create Organization
          </button>
        </div>
      )}

      {/* Company grid */}
      {companies.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {companies.map((company) => (
            <div
              key={company.id}
              className="group relative rounded-2xl border border-border bg-card p-5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Building2 className="h-5 w-5 text-primary" aria-hidden="true" />
                </div>
                <span className={`badge ${STATUS_STYLES[company.status] ?? 'badge-default'}`}>
                  {company.status}
                </span>
              </div>

              <div className="mt-3">
                <h3 className="font-semibold text-foreground truncate">{company.name}</h3>
                {company.industry && (
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Globe className="h-3 w-3" aria-hidden="true" />
                    {company.industry}
                  </div>
                )}
                {company.description && (
                  <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                    {company.description}
                  </p>
                )}
              </div>

              {/* Stats placeholders */}
              <div className="mt-4 flex items-center gap-4 border-t border-border pt-4">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Bot className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Agents</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Depts</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Cpu className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Resources</span>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className="btn btn-outline flex-1 text-xs h-8 px-3 gap-1.5"
                  onClick={() => handleSelectCompany(company)}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Set Active
                </button>
                <button
                  type="button"
                  className="btn btn-ghost h-8 w-8 p-0"
                  aria-label={`Open ${company.name} details`}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
