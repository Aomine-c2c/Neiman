'use client';

import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Play, X, GitBranch, CheckCircle2, RotateCw } from 'lucide-react';
import { blueprintsApi, CompanyBlueprint, InstantiateBlueprintResponse } from '@/lib/api/blueprints';
import { systemConfigApi } from '@/lib/api/systemUpdates';

interface BlueprintInstantiationModalProps {
  blueprint: CompanyBlueprint | null;
  onClose: () => void;
  onSuccess: (data: InstantiateBlueprintResponse) => void;
}

export function BlueprintInstantiationModal({
  blueprint,
  onClose,
  onSuccess,
}: BlueprintInstantiationModalProps) {
  const [customCompanyName, setCustomCompanyName] = useState('');
  const [repoPath, setRepoPath] = useState('');
  const [branch, setBranch] = useState('');
  const [autonomy, setAutonomy] = useState(3);
  const [cleanReset, setCleanReset] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (blueprint) {
      setCustomCompanyName(blueprint.name || '');
      setAutonomy(blueprint.default_autonomy || 3);
      setCleanReset(false);
      setResetConfirmation('');
      setErrorMsg(null);
    }
  }, [blueprint]);

  const instantiateMutation = useMutation({
    mutationFn: ({
      idOrKey,
      req,
    }: {
      idOrKey: string;
      req: { company_name?: string; customizations?: Record<string, unknown> };
    }) => blueprintsApi.instantiateBlueprint(idOrKey, req),
    onSuccess: (data) => {
      onSuccess(data);
      onClose();
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Instantiation failed';
      setErrorMsg(msg);
    },
  });

  if (!blueprint) return null;

  const handleActivate = async () => {
    setErrorMsg(null);
    if (branch.trim() && !repoPath.trim()) {
      setErrorMsg('Enter the repository path before specifying a branch.');
      return;
    }
    try {
      if (cleanReset) {
        await systemConfigApi.resetSetup(resetConfirmation.trim());
      }
      const customizations: Record<string, unknown> = { default_autonomy: autonomy };
      if (repoPath.trim()) customizations.local_path = repoPath.trim();
      if (repoPath.trim() && branch.trim()) customizations.branch = branch.trim();
      instantiateMutation.mutate({
        idOrKey: blueprint.key || blueprint.id,
        req: {
          company_name: customCompanyName.trim(),
          customizations,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Clean setup reset failed';
      setErrorMsg(msg);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg bg-card border border-border rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <Play className="h-4 w-4 text-primary fill-current" />
            <h3 className="font-bold text-foreground text-sm">Instantiate {blueprint.name}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-lg"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          This creates a company record and the blueprint&apos;s{' '}
          <strong className="text-foreground">{blueprint.departments?.length || 0} departments</strong>,{' '}
          <strong className="text-foreground">{blueprint.agents?.length || 0} agent profiles</strong>,
          workflows, and governance records. Workers remain paused until an operator starts them; model access must be configured separately.
        </p>

        {errorMsg && (
          <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono">
            [ERROR] {errorMsg}
          </div>
        )}

        <div className="space-y-3.5 text-xs font-mono">
          <div>
            <label className="block text-muted-foreground mb-1 font-sans font-medium">
              Organization Name <span className="text-[#D71921]">*</span>
            </label>
            <input
              type="text"
              value={customCompanyName}
              onChange={(e) => setCustomCompanyName(e.target.value)}
              placeholder="Enter organization name..."
              className="input w-full"
            />
          </div>

          {/* Workspace Repository Linkage */}
          <div className="p-3.5 rounded-xl border border-border/80 bg-secondary/30 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-foreground font-sans font-semibold flex items-center gap-1.5">
                <GitBranch className="h-3.5 w-3.5 text-[#D71921]" />
                Workspace Repository Linkage
              </label>
              <span className="text-[10px] text-muted-foreground">Validated by API on launch</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-2">
                <input
                  type="text"
                  value={repoPath}
                  onChange={(e) => setRepoPath(e.target.value)}
                  placeholder="Absolute path on the API host"
                  className="input w-full text-[11px]"
                />
              </div>
              <div>
                <input
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="Branch (optional)"
                  title="Branch"
                  className="input w-full text-center text-[11px]"
                />
              </div>
            </div>
          </div>

          {/* Autonomy Level */}
          <div>
            <label className="block text-muted-foreground mb-1 font-sans font-medium">
              Initial Operational Autonomy
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { level: 1, label: 'L1: Recommend' },
                { level: 2, label: 'L2: With Approval' },
                { level: 3, label: 'L3: Constrained' },
                { level: 4, label: 'L4: Autonomous' },
                { level: 5, label: 'L5: Adaptive' },
              ].map((al) => (
                <button
                  key={al.level}
                  type="button"
                  onClick={() => setAutonomy(al.level)}
                  className={`p-2 rounded-lg border text-center transition-all ${
                    autonomy === al.level
                      ? 'border-primary bg-primary/10 text-primary font-bold'
                      : 'border-border bg-secondary/20 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {al.label}
                </button>
              ))}
            </div>
          </div>

          {/* Clean Reset Option */}
          <label className="flex items-center gap-2 cursor-pointer pt-1 font-sans text-xs text-foreground">
            <input
              type="checkbox"
              checked={cleanReset}
              onChange={(e) => {
                setCleanReset(e.target.checked);
                if (!e.target.checked) setResetConfirmation('');
              }}
              className="rounded border-border accent-primary"
            />
            <span>Clean Setup: Reset database and replace previous organizations</span>
          </label>
          {cleanReset && (
            <div className="p-2.5 rounded-lg border border-destructive/40 bg-destructive/10 space-y-1.5 text-[10px] text-destructive">
              <p>Type <strong>RESET NEIMAN OPERATIONAL DATA</strong> to confirm clean database reset:</p>
              <input
                type="text"
                value={resetConfirmation}
                onChange={(e) => setResetConfirmation(e.target.value)}
                placeholder="RESET NEIMAN OPERATIONAL DATA"
                className="input w-full text-xs"
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
          <button type="button" onClick={onClose} className="btn btn-outline text-xs">
            Cancel
          </button>
          <button
            type="button"
            disabled={
              instantiateMutation.isPending ||
              !customCompanyName.trim() ||
              (cleanReset && resetConfirmation.trim() !== 'RESET NEIMAN OPERATIONAL DATA')
            }
            onClick={handleActivate}
            className="btn btn-primary text-xs gap-1.5"
          >
            {instantiateMutation.isPending ? (
              <RotateCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            Activate Organization
          </button>
        </div>
      </div>
    </div>
  );
}
