'use client';

import { CheckCircle2 } from 'lucide-react';
import { InstantiateBlueprintResponse } from '@/lib/api/blueprints';

interface InstantiationSuccessModalProps {
  result: InstantiateBlueprintResponse | null;
  onClose: () => void;
}

export function InstantiationSuccessModal({
  result,
  onClose,
}: InstantiationSuccessModalProps) {
  if (!result) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg bg-card border border-emerald-500/50 rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-bold text-foreground text-base">Company Instantiated Successfully!</h3>
            <p className="text-xs text-muted-foreground">The autonomous organization is now live and initialized.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 py-2 text-xs font-mono">
          <div className="p-2.5 rounded-lg bg-secondary/30 border border-border">
            <span className="text-muted-foreground text-[10px] block">Company Name</span>
            <span className="font-bold text-foreground">{result.company_name}</span>
          </div>
          <div className="p-2.5 rounded-lg bg-secondary/30 border border-border">
            <span className="text-muted-foreground text-[10px] block">Slug Identifier</span>
            <span className="text-primary">{result.slug}</span>
          </div>
          <div className="p-2.5 rounded-lg bg-secondary/30 border border-border">
            <span className="text-muted-foreground text-[10px] block">Departments Created</span>
            <span className="font-bold text-foreground">{result.departments_created}</span>
          </div>
          <div className="p-2.5 rounded-lg bg-secondary/30 border border-border">
            <span className="text-muted-foreground text-[10px] block">Agents Activated</span>
            <span className="font-bold text-foreground">{result.agents_created}</span>
          </div>
        </div>

        <div className="flex justify-end pt-3 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-primary text-xs px-5 py-2 font-medium"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
