'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, GitBranch, X, RotateCw, Check } from 'lucide-react';
import { BuildMyCompanyProposal } from '@/lib/api/blueprints';

interface ProposalApprovalModalProps {
  proposal: BuildMyCompanyProposal | null;
  isOpen: boolean;
  onClose: () => void;
  onApprove: (payload: {
    approver: string;
    companyName?: string;
    customizations: { local_path?: string; branch?: string };
  }) => void;
  isPending?: boolean;
  defaultCompanyName?: string;
}

export function ProposalApprovalModal({
  proposal,
  isOpen,
  onClose,
  onApprove,
  isPending = false,
  defaultCompanyName,
}: ProposalApprovalModalProps) {
  const [approvalName, setApprovalName] = useState('Founder & Managing Director');
  const [companyName, setCompanyName] = useState('');
  const [repoPath, setRepoPath] = useState('');
  const [branch, setBranch] = useState('');
  const [approvalConfirmed, setApprovalConfirmed] = useState(false);

  useEffect(() => {
    if (proposal) {
      setCompanyName(defaultCompanyName || proposal.proposed_blueprint?.name || '');
      setApprovalConfirmed(false);
    }
  }, [proposal, defaultCompanyName]);

  if (!isOpen || !proposal) return null;

  const handleSubmit = () => {
    onApprove({
      approver: approvalName,
      companyName: companyName.trim() || undefined,
      customizations: {
        ...(repoPath.trim() ? { local_path: repoPath.trim() } : {}),
        ...(repoPath.trim() && branch.trim() ? { branch: branch.trim() } : {}),
      },
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg bg-card border border-border rounded-2xl p-6 ring-1 ring-border shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            <h3 className="text-base font-bold text-foreground">Human Approval & Activation Gate</h3>
          </div>
          <button type="button" onClick={onClose} className="btn btn-ghost h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-1.5">
          <div className="font-bold text-amber-300 flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4" />
            Review before creating records
          </div>
          <p className="text-amber-200/90 leading-relaxed">
            You are authorizing creation of <strong>{proposal.proposed_blueprint?.name}</strong> from this proposal, including
            {proposal.proposed_blueprint?.agents?.length || 0} agent profiles and its configured policies. This does not validate
            provider access or start task execution.
          </p>
        </div>

        <div className="space-y-3 text-xs font-mono">
          <div>
            <label className="font-semibold block mb-1 font-sans">Company Name</label>
            <input
              type="text"
              className="input w-full text-xs"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
          </div>

          <div>
            <label className="font-semibold block mb-1 font-sans">Authorized Approver Name / Role</label>
            <input
              type="text"
              className="input w-full text-xs"
              value={approvalName}
              onChange={(e) => setApprovalName(e.target.value)}
              placeholder="e.g. Founder & Managing Director"
            />
          </div>

          {/* Workspace Repository Linkage */}
          <div className="p-3 rounded-xl border border-border/80 bg-secondary/30 space-y-2 text-xs">
            <label className="text-foreground font-semibold flex items-center gap-1.5 font-sans">
              <GitBranch className="h-3.5 w-3.5 text-[#D71921]" />
              Workspace Repository Linkage
            </label>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                value={repoPath}
                onChange={(e) => setRepoPath(e.target.value)}
                placeholder="Absolute path on the API host"
                className="input col-span-2 text-[11px]"
              />
              <input
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="Branch (optional)"
                title="Branch"
                className="input text-center text-[11px]"
              />
            </div>
          </div>

          <div className="pt-2">
            <label className="flex items-start gap-2.5 cursor-pointer font-sans">
              <input
                type="checkbox"
                checked={approvalConfirmed}
                onChange={(e) => setApprovalConfirmed(e.target.checked)}
                className="mt-0.5 rounded border-border accent-emerald-500"
              />
              <span className="text-xs text-foreground leading-snug">
                I confirm that I have reviewed the mission, generated departments, agents, workflows, policies, risk mitigations,
                and dry-run simulation metrics for this organization.
              </span>
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
          <button type="button" onClick={onClose} className="btn btn-outline text-xs">
            Cancel
          </button>
          <button
            type="button"
            disabled={!approvalConfirmed || !approvalName || isPending}
            onClick={handleSubmit}
            className="btn btn-primary text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
          >
            {isPending ? <RotateCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Authorize & Instantiate Real Company
          </button>
        </div>
      </div>
    </div>
  );
}
