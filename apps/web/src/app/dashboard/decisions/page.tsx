'use client';

import { useId, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle, Check, CircleDot, Clock3, FileText, Loader2, Plus, Scale, Search,
  X,
} from 'lucide-react';
import { ApiError } from '@/lib/api/client';
import { decisionsApi, DecisionRecord, DecisionStatus } from '@/lib/api/decisions';
import { useOrganizationContext } from '@/lib/organizationContext';

const STATUS_STYLE: Record<DecisionStatus, string> = {
  OPEN: 'border-sky-500/20 bg-sky-500/10 text-sky-300',
  IN_REVIEW: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
  DECIDED: 'border-violet-500/20 bg-violet-500/10 text-violet-300',
  IMPLEMENTED: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
  EVALUATED: 'border-teal-500/20 bg-teal-500/10 text-teal-300',
};

type DialogMode = 'create' | 'resolve' | 'outcome';

export default function DecisionsPage() {
  const company = useOrganizationContext();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | DecisionStatus>('ALL');
  const [dialog, setDialog] = useState<{ mode: DialogMode; decision?: DecisionRecord } | null>(null);
  const [form, setForm] = useState({ title: '', problem: '', decision: '', rationale: '', expected: '', actual: '' });
  const [formError, setFormError] = useState<string | null>(null);

  const queryKey = ['decisions', company?.id];
  const { data = [], isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: () => decisionsApi.list(company!.id),
    enabled: !!company?.id,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey });
  const createMutation = useMutation({
    mutationFn: () => decisionsApi.create(company!.id, {
      title: form.title.trim(),
      problem: form.problem.trim(),
      expected_outcome: form.expected.trim() || undefined,
    }),
    onSuccess: () => { refresh(); closeDialog(); },
    onError: (err) => setFormError(errorMessage(err)),
  });
  const resolveMutation = useMutation({
    mutationFn: () => decisionsApi.resolve(company!.id, dialog!.decision!.id, {
      decision: form.decision.trim(),
      rationale: form.rationale.trim(),
      expected_outcome: form.expected.trim() || undefined,
    }),
    onSuccess: () => { refresh(); closeDialog(); },
    onError: (err) => setFormError(errorMessage(err)),
  });
  const outcomeMutation = useMutation({
    mutationFn: () => decisionsApi.recordOutcome(company!.id, dialog!.decision!.id, form.actual.trim()),
    onSuccess: () => { refresh(); closeDialog(); },
    onError: (err) => setFormError(errorMessage(err)),
  });
  const isSaving = createMutation.isPending || resolveMutation.isPending || outcomeMutation.isPending;

  function closeDialog() {
    setDialog(null);
    setFormError(null);
    setForm({ title: '', problem: '', decision: '', rationale: '', expected: '', actual: '' });
  }

  function openDialog(mode: DialogMode, decision?: DecisionRecord) {
    setFormError(null);
    setForm({
      title: decision?.title ?? '',
      problem: decision?.problem ?? '',
      decision: decision?.decision ?? '',
      rationale: decision?.rationale ?? '',
      expected: decision?.expected_outcome ?? '',
      actual: decision?.actual_outcome ?? '',
    });
    setDialog({ mode, decision });
  }

  function submitForm(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (dialog?.mode === 'create') {
      if (form.title.trim().length < 2 || form.problem.trim().length < 10) {
        setFormError('Add a title and describe the problem in at least 10 characters.');
        return;
      }
      createMutation.mutate();
    } else if (dialog?.mode === 'resolve') {
      if (form.decision.trim().length < 10 || form.rationale.trim().length < 10) {
        setFormError('Decision and rationale must each contain at least 10 characters.');
        return;
      }
      resolveMutation.mutate();
    } else if (dialog?.mode === 'outcome') {
      if (form.actual.trim().length < 10) {
        setFormError('Describe the actual outcome in at least 10 characters.');
        return;
      }
      outcomeMutation.mutate();
    }
  }

  const filtered = useMemo(() => data.filter((item) => {
    const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;
    const text = `${item.title} ${item.problem} ${item.decision ?? ''}`.toLowerCase();
    return matchesStatus && text.includes(search.toLowerCase());
  }), [data, search, statusFilter]);

  if (!company) {
    return <EmptyPanel title="Select an organization" message="Choose or create an organization before viewing its decision records." />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-primary">
            <Scale className="h-4 w-4" aria-hidden="true" /> Organizational memory
          </div>
          <h1 className="text-2xl font-bold text-foreground">Decision records</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Keep the problem, options, rationale, and measured outcome together so the organization can learn from its choices.
          </p>
        </div>
        <button type="button" className="btn btn-primary gap-2" onClick={() => openDialog('create')}>
          <Plus className="h-4 w-4" aria-hidden="true" /> New decision
        </button>
      </header>

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Decision summary">
        <SummaryCard label="Total records" value={data.length} icon={<FileText className="h-4 w-4" />} />
        <SummaryCard label="Awaiting decision" value={data.filter((d) => d.status === 'OPEN' || d.status === 'IN_REVIEW').length} icon={<Clock3 className="h-4 w-4" />} />
        <SummaryCard label="Evaluated" value={data.filter((d) => d.status === 'EVALUATED').length} icon={<Check className="h-4 w-4" />} />
      </section>

      <section className="glass rounded-xl p-4" aria-label="Decision records">
        <div className="mb-4 flex flex-col gap-3 md:flex-row">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <span className="sr-only">Search decisions</span>
            <input className="input w-full pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search decisions…" />
          </label>
          <label className="sr-only" htmlFor="decision-status">Filter by status</label>
          <select id="decision-status" className="input md:w-52" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'ALL' | DecisionStatus)}>
            <option value="ALL">All statuses</option>
            <option value="OPEN">Open</option>
            <option value="IN_REVIEW">In review</option>
            <option value="DECIDED">Decided</option>
            <option value="IMPLEMENTED">Implemented</option>
            <option value="EVALUATED">Evaluated</option>
          </select>
        </div>

        {isLoading && <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="Loading decisions" /></div>}
        {error && <ErrorPanel message={errorMessage(error)} onRetry={() => refetch()} />}
        {!isLoading && !error && data.length === 0 && (
          <EmptyPanel title="No decisions recorded yet" message="Start a record when the organization faces a consequential choice. Add the rationale now and evaluate the real outcome later." />
        )}
        {!isLoading && !error && data.length > 0 && filtered.length === 0 && (
          <EmptyPanel title="No matching decisions" message="Try another search or status filter." />
        )}
        <div className="space-y-3">
          {filtered.map((decision) => (
            <DecisionCard key={decision.id} decision={decision} onResolve={() => openDialog('resolve', decision)} onOutcome={() => openDialog('outcome', decision)} />
          ))}
        </div>
      </section>

      {dialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDialog(); }}>
          <section className="my-auto w-full max-w-2xl rounded-2xl border border-border bg-NEIMAN-surface p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="decision-dialog-title">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id="decision-dialog-title" className="text-lg font-semibold text-foreground">
                  {dialog.mode === 'create' ? 'Open a decision record' : dialog.mode === 'resolve' ? 'Record the decision' : 'Evaluate the outcome'}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">{dialog.mode === 'create' ? 'Capture the question before the organization commits.' : dialog.decision?.title}</p>
              </div>
              <button type="button" className="rounded-lg p-2 text-muted-foreground hover:bg-secondary" aria-label="Close dialog" onClick={closeDialog}><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={submitForm} className="space-y-4">
              {dialog.mode === 'create' ? <>
                <Field label="Title" value={form.title} onChange={(value) => setForm((current) => ({ ...current, title: value }))} maxLength={255} required />
                <TextField label="Problem" help="Describe the decision to be made." value={form.problem} onChange={(value) => setForm((current) => ({ ...current, problem: value }))} required />
                <TextField label="Expected outcome" value={form.expected} onChange={(value) => setForm((current) => ({ ...current, expected: value }))} />
              </> : dialog.mode === 'resolve' ? <>
                <TextField label="Decision made" value={form.decision} onChange={(value) => setForm((current) => ({ ...current, decision: value }))} required />
                <TextField label="Rationale" value={form.rationale} onChange={(value) => setForm((current) => ({ ...current, rationale: value }))} required />
                <TextField label="Expected outcome" value={form.expected} onChange={(value) => setForm((current) => ({ ...current, expected: value }))} />
              </> : <TextField label="Actual outcome" help="Record what happened after implementation." value={form.actual} onChange={(value) => setForm((current) => ({ ...current, actual: value }))} required />}

              {formError && <p className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300" role="alert"><AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />{formError}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" className="btn btn-outline" onClick={closeDialog} disabled={isSaving}>Cancel</button>
                <button type="submit" className="btn btn-primary gap-2" disabled={isSaving}>
                  {isSaving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  {dialog.mode === 'create' ? 'Create record' : dialog.mode === 'resolve' ? 'Save decision' : 'Save outcome'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

function DecisionCard({ decision, onResolve, onOutcome }: { decision: DecisionRecord; onResolve: () => void; onOutcome: () => void }) {
  const status = decision.status in STATUS_STYLE ? decision.status : 'OPEN';
  return (
    <article className="rounded-xl border border-border bg-card/50 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-foreground">{decision.title}</h3>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_STYLE[status]}`}>
              <CircleDot className="mr-1 inline h-3 w-3" aria-hidden="true" />{status.replace('_', ' ')}
            </span>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{decision.problem}</p>
        </div>
        <time className="shrink-0 text-xs text-muted-foreground" dateTime={decision.created_at}>{new Date(decision.created_at).toLocaleDateString()}</time>
      </div>
      {(decision.decision || decision.rationale || decision.expected_outcome || decision.actual_outcome) && (
        <dl className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
          {decision.decision && <Detail label="Decision" value={decision.decision} />}
          {decision.rationale && <Detail label="Rationale" value={decision.rationale} />}
          {decision.expected_outcome && <Detail label="Expected outcome" value={decision.expected_outcome} />}
          {decision.actual_outcome && <Detail label="Actual outcome" value={decision.actual_outcome} />}
        </dl>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {(decision.status === 'OPEN' || decision.status === 'IN_REVIEW') && <button type="button" className="btn btn-outline btn-sm" onClick={onResolve}>Record decision</button>}
        {(decision.status === 'DECIDED' || decision.status === 'IMPLEMENTED') && <button type="button" className="btn btn-outline btn-sm" onClick={onOutcome}>Evaluate outcome</button>}
      </div>
    </article>
  );
}

function SummaryCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return <div className="glass rounded-xl p-4"><div className="flex items-center justify-between text-muted-foreground"><span className="text-xs">{label}</span>{icon}</div><p className="mt-2 text-2xl font-bold text-foreground">{value}</p></div>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt><dd className="mt-1 whitespace-pre-wrap text-sm text-foreground">{value}</dd></div>;
}

function Field({ label, value, onChange, maxLength, required }: { label: string; value: string; onChange: (value: string) => void; maxLength?: number; required?: boolean }) {
  return <label className="block space-y-1.5 text-sm"><span className="font-medium text-foreground">{label}</span><input className="input w-full" value={value} onChange={(event) => onChange(event.target.value)} maxLength={maxLength} required={required} /></label>;
}

function TextField({ label, value, onChange, help, required }: { label: string; value: string; onChange: (value: string) => void; help?: string; required?: boolean }) {
  const id = useId();
  const helpId = `${id}-help`;
  return <div className="space-y-1.5 text-sm"><label htmlFor={id} className="font-medium text-foreground">{label}</label>{help && <p id={helpId} className="text-xs text-muted-foreground">{help}</p>}<textarea id={id} aria-describedby={help ? helpId : undefined} className="input min-h-24 w-full resize-y" value={value} onChange={(event) => onChange(event.target.value)} required={required} /></div>;
}

function EmptyPanel({ title, message }: { title: string; message: string }) {
  return <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-12 text-center"><FileText className="mb-3 h-8 w-8 text-muted-foreground" aria-hidden="true" /><h2 className="font-medium text-foreground">{title}</h2><p className="mt-1 max-w-md text-sm text-muted-foreground">{message}</p></div>;
}

function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="mb-4 flex flex-col gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200 sm:flex-row sm:items-center sm:justify-between" role="alert"><span className="flex items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />{message}</span><button type="button" className="btn btn-outline btn-sm self-start" onClick={onRetry}>Retry</button></div>;
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const data = error.data as { detail?: string; message?: string } | null;
    return data?.detail ?? data?.message ?? error.message;
  }
  return 'Something went wrong. Please try again.';
}
