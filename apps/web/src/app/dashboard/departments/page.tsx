'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  Plus,
  Loader2,
  AlertCircle,
  Building2,
  FolderTree,
  ChevronRight,
  Shield,
  Briefcase,
  UserCheck,
} from 'lucide-react';
import { organizationsApi, Department, OrgRole } from '@/lib/api/organizations';
import { useOrganizationContext } from '@/lib/organizationContext';
import { ApiError } from '@/lib/api/client';

export default function DepartmentsPage() {
  const activeCompany = useOrganizationContext();
  const companyId = activeCompany?.id || '';
  const qc = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', purpose: '', parent_id: '' });
  const [formError, setFormError] = useState<string | null>(null);

  // List departments
  const { data: departments = [], isLoading, error } = useQuery({
    queryKey: ['departments', companyId],
    queryFn: () => organizationsApi.listDepartments(companyId),
    enabled: !!companyId,
  });

  // List roles
  const { data: roles = [] } = useQuery({
    queryKey: ['org-roles', companyId],
    queryFn: () => organizationsApi.listRoles(companyId),
    enabled: !!companyId,
  });

  // Create department mutation
  const createMutation = useMutation({
    mutationFn: (body: { name: string; purpose?: string; parent_id?: string }) =>
      organizationsApi.createDepartment(companyId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['departments', companyId] });
      setShowCreate(false);
      setForm({ name: '', purpose: '', parent_id: '' });
      setFormError(null);
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        setFormError(err.message);
      } else {
        setFormError('Failed to create department.');
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormError('Department name is required.');
      return;
    }
    createMutation.mutate({
      name: form.name.trim(),
      purpose: form.purpose.trim() || undefined,
      parent_id: form.parent_id || undefined,
    });
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Departments & Hierarchy</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Structure your organization into focused functional units and assign roles and agent capabilities.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary gap-2 self-start sm:self-auto"
          onClick={() => setShowCreate(true)}
          disabled={!companyId}
        >
          <Plus className="h-4 w-4" />
          <span>Add Department</span>
        </button>
      </div>

      {/* Creation Modal */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md glass rounded-2xl p-6 ring-1 ring-border shadow-2xl">
            <h2 className="text-lg font-semibold text-foreground mb-4">Create New Department</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Department Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  className="input w-full"
                  placeholder="e.g. Engineering, Product, Security"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Purpose / Mission
                </label>
                <textarea
                  rows={3}
                  className="input w-full h-auto resize-none"
                  placeholder="Defines core responsibilities and deliverables..."
                  value={form.purpose}
                  onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Parent Department (Optional)
                </label>
                <select
                  className="input w-full"
                  value={form.parent_id}
                  onChange={(e) => setForm((f) => ({ ...f, parent_id: e.target.value }))}
                >
                  <option value="">None (Top-Level Department)</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              {formError && (
                <p className="text-xs text-red-400 flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {formError}
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  className="btn btn-outline flex-1"
                  onClick={() => {
                    setShowCreate(false);
                    setFormError(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary flex-1"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Save Department'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-400">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm">
            {error instanceof ApiError ? error.message : 'Failed to load organizational departments.'}
          </p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && departments.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border py-20">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary/50">
            <Users className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-semibold text-foreground">No departments configured</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Add your first department to organize your workforce and assign specialized agents.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary gap-2"
            onClick={() => setShowCreate(true)}
            disabled={!companyId}
          >
            <Plus className="h-4 w-4" />
            Add Department
          </button>
        </div>
      )}

      {/* Departments Grid */}
      {!isLoading && departments.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {departments.map((dept) => {
            const deptRoles = roles.filter((r) => r.department_id === dept.id);
            return (
              <div
                key={dept.id}
                className="rounded-2xl border border-border bg-card p-5 hover:border-primary/40 transition-all space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Users className="h-5 w-5" />
                  </div>
                  <span className="badge badge-primary">{dept.status}</span>
                </div>

                <div>
                  <h3 className="font-semibold text-foreground">{dept.name}</h3>
                  {dept.purpose && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {dept.purpose}
                    </p>
                  )}
                </div>

                <div className="border-t border-border/80 pt-3">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
                    Department Roles ({deptRoles.length})
                  </p>
                  {deptRoles.length === 0 ? (
                    <p className="text-xs text-muted-foreground/60 italic">No roles mapped yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {deptRoles.map((role) => (
                        <span
                          key={role.id}
                          className="inline-flex items-center gap-1 rounded-md bg-secondary/80 px-2 py-0.5 text-[11px] text-foreground"
                        >
                          <Briefcase className="h-3 w-3 text-primary" />
                          {role.title}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
