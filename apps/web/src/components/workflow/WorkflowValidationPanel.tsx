'use client';

import React from 'react';
import { AlertCircle, CheckCircle2, AlertTriangle, ShieldCheck, X } from 'lucide-react';
import { WorkflowStep } from '@/lib/api/workflows';

export interface WorkflowValidationIssue {
  id: string;
  stepId?: string;
  type: 'ERROR' | 'WARNING';
  message: string;
  suggestion?: string;
}

interface WorkflowValidationPanelProps {
  steps: WorkflowStep[];
  onSelectStep: (stepId: string) => void;
  onClose: () => void;
}

export function WorkflowValidationPanel({
  steps,
  onSelectStep,
  onClose,
}: WorkflowValidationPanelProps) {
  // Compute graph validation rules
  const issues: WorkflowValidationIssue[] = React.useMemo(() => {
    const list: WorkflowValidationIssue[] = [];

    if (steps.length === 0) {
      list.push({
        id: 'no-steps',
        type: 'ERROR',
        message: 'Workflow has no steps defined. Add a Trigger node from the palette to begin.',
      });
      return list;
    }

    // Rule 1: Must have at least one Trigger node
    const hasTrigger = steps.some((s) => s.type === 'TRIGGER' || s.type === 'WEBHOOK');
    if (!hasTrigger) {
      list.push({
        id: 'missing-trigger',
        type: 'ERROR',
        message: 'Missing entrypoint trigger. Add a Trigger or Webhook node.',
        suggestion: 'Place a Trigger node as the workflow entrypoint.',
      });
    }

    // Rule 2: Check for orphaned / dangling nodes
    const targetedStepIds = new Set<string>();
    steps.forEach((s) => {
      if (s.next_step_id) targetedStepIds.add(s.next_step_id);
      if (s.condition?.true_step) targetedStepIds.add(s.condition.true_step);
      if (s.condition?.false_step) targetedStepIds.add(s.condition.false_step);
    });

    steps.forEach((s) => {
      // If it's not a trigger and no node targets it, it is orphaned
      if (s.type !== 'TRIGGER' && s.type !== 'WEBHOOK' && !targetedStepIds.has(s.id)) {
        list.push({
          id: `orphan-${s.id}`,
          stepId: s.id,
          type: 'WARNING',
          message: `Node "${s.name}" is not reachable from any preceding step.`,
          suggestion: 'Connect a previous node to this step.',
        });
      }

      // Check condition nodes for missing branches
      if (s.type === 'CONDITION') {
        if (!s.condition?.true_step || !s.condition?.false_step) {
          list.push({
            id: `cond-missing-${s.id}`,
            stepId: s.id,
            type: 'WARNING',
            message: `Condition "${s.name}" has unrouted TRUE or FALSE branches.`,
            suggestion: 'Set both True and False successor steps in Properties Inspector.',
          });
        }
      }
    });

    return list;
  }, [steps]);

  const errors = issues.filter((i) => i.type === 'ERROR');
  const warnings = issues.filter((i) => i.type === 'WARNING');
  const isValid = errors.length === 0;

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-xl space-y-3 animate-fade-in text-xs">
      <div className="flex items-center justify-between pb-2 border-b border-border/60">
        <div className="flex items-center gap-2">
          {isValid ? (
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
          ) : (
            <AlertCircle className="h-4 w-4 text-rose-400" />
          )}
          <span className="font-bold text-foreground">Workflow Graph Validation</span>
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
              isValid
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
            }`}
          >
            {errors.length} Errors • {warnings.length} Warnings
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
        {issues.length === 0 ? (
          <div className="flex items-center gap-2 text-emerald-400 p-2 rounded-lg bg-emerald-500/5 font-mono text-[11px]">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Workflow definition is topologically valid and ready for execution.</span>
          </div>
        ) : (
          issues.map((issue) => (
            <div
              key={issue.id}
              onClick={() => issue.stepId && onSelectStep(issue.stepId)}
              className={`p-2.5 rounded-lg border text-xs flex items-start gap-2.5 cursor-pointer transition-colors ${
                issue.type === 'ERROR'
                  ? 'border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/10'
                  : 'border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10'
              }`}
            >
              {issue.type === 'ERROR' ? (
                <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 space-y-0.5">
                <p className="font-semibold text-foreground">{issue.message}</p>
                {issue.suggestion && (
                  <p className="text-[11px] text-muted-foreground">{issue.suggestion}</p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
