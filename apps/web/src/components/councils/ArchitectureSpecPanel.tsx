'use client';

import React from 'react';
import {
  Check,
  CheckCircle,
  Copy,
  Edit3,
  FileText,
  GitCompare,
  ListTodo,
  Loader2,
  Shield,
  X,
} from 'lucide-react';
import type {
  CouncilDeliberation,
  DisagreementRecord,
  QuorumResult,
  QuorumVotingModel,
} from '@/lib/api/councils';

interface ArchitectureSpecPanelProps {
  canMutate: boolean;
  selectedDelib: CouncilDeliberation | null;
  hasSynthesizedSpec: boolean;
  liveSpecText: string;
  previousSpecText: string | null;
  isEditingSpec: boolean;
  editedSpecText: string | null;
  showSpecDiff: boolean;
  technicalRationale: string | null;
  disagreements: DisagreementRecord[];
  resolvedDissentTopics: string[];
  hasActiveDebateOrProposal: boolean;
  adrStatus: string;
  votingModel: QuorumVotingModel;
  quorumResult: QuorumResult | null;
  copiedAdr: boolean;
  isQuorumPending: boolean;
  isRatifyPending: boolean;
  onExtractTasksFromSpec: () => void;
  onToggleEditSpec: () => void;
  onChangeEditedSpecText: (val: string) => void;
  onToggleSpecDiff: () => void;
  onCopyAndPinSpec: () => void;
  onToggleResolveDissent: (topic: string) => void;
  onSelectVotingModel: (model: QuorumVotingModel) => void;
  onCopyAdr: () => void;
  onRatifySpec: () => void;
  onCloseDrawer: () => void;
}

const VOTING_MODELS: Array<{ id: QuorumVotingModel; label: string }> = [
  { id: 'MAJORITY', label: 'Majority' },
  { id: 'WEIGHTED', label: 'Weighted' },
  { id: 'UNANIMOUS', label: 'Unanimous' },
];

export function ArchitectureSpecPanel({
  canMutate,
  selectedDelib,
  hasSynthesizedSpec,
  liveSpecText,
  previousSpecText,
  isEditingSpec,
  editedSpecText,
  showSpecDiff,
  technicalRationale,
  disagreements,
  resolvedDissentTopics,
  hasActiveDebateOrProposal,
  adrStatus,
  votingModel,
  quorumResult,
  copiedAdr,
  isQuorumPending,
  isRatifyPending,
  onExtractTasksFromSpec,
  onToggleEditSpec,
  onChangeEditedSpecText,
  onToggleSpecDiff,
  onCopyAndPinSpec,
  onToggleResolveDissent,
  onSelectVotingModel,
  onCopyAdr,
  onRatifySpec,
  onCloseDrawer,
}: ArchitectureSpecPanelProps) {
  const effectiveSpecBadge = hasSynthesizedSpec
    ? selectedDelib?.status || 'SYNTHESIZED'
    : selectedDelib
    ? 'SYNTHESIS_PENDING'
    : 'DRAFT';

  const canRatify = canMutate && hasSynthesizedSpec && adrStatus !== 'RESOLVED' && !isRatifyPending;

  return (
    <section
      aria-label="Live Architecture Specification and ADR"
      className="flex-1 min-h-0 flex flex-col overflow-hidden bg-card"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-secondary/30 shrink-0 gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
          <span className="text-xs font-mono font-bold text-foreground truncate">
            Architecture Spec &amp; ADR
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            disabled={!canMutate || !hasSynthesizedSpec}
            onClick={onExtractTasksFromSpec}
            aria-label="Extract Tasks from Specification"
            title="Extract actionable tasks from this specification into Tasks & Checklist"
            className="min-h-6 inline-flex items-center gap-1 px-2 py-0.5 rounded border border-primary/30 bg-primary/10 text-xs font-mono font-semibold text-primary hover:bg-primary/20 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ListTodo className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span>Extract Tasks</span>
          </button>
          <button
            type="button"
            disabled={!canMutate}
            onClick={onToggleEditSpec}
            aria-label={isEditingSpec ? 'Preview Markdown Specification' : 'Edit Specification Inline'}
            title={isEditingSpec ? 'Preview Markdown Specification' : 'Edit Specification Inline'}
            className={`min-h-6 min-w-6 flex items-center justify-center p-1 rounded border transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              isEditingSpec
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-muted-foreground hover:text-foreground'
            }`}
          >
            <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          {previousSpecText && (
            <button
              type="button"
              onClick={onToggleSpecDiff}
              aria-label="Toggle Diff vs. Previous Spec"
              title="Toggle Diff vs. Previous Spec"
              className={`min-h-6 min-w-6 flex items-center justify-center p-1 rounded border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                showSpecDiff
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground'
              }`}
            >
              <GitCompare className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            disabled={!canMutate}
            onClick={onCopyAndPinSpec}
            aria-label="Pin specification to Organizational Memory and copy Markdown"
            title="Pin specification to Organizational Memory & copy Markdown"
            className="min-h-6 min-w-6 flex items-center justify-center p-1 rounded border border-border bg-card text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onCloseDrawer}
            aria-label="Close Architecture Specification drawer"
            title="Close drawer"
            className="min-h-6 min-w-6 flex items-center justify-center p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 p-3 space-y-2.5 overflow-y-auto text-xs">
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-mono font-bold text-foreground">
                    Live Architecture Specification
                  </h3>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-secondary text-foreground border border-border tabular-nums">
                    {effectiveSpecBadge}
                  </span>
                </div>

                {isEditingSpec ? (
                  <textarea
                    rows={7}
                    value={editedSpecText ?? liveSpecText}
                    onChange={(e) => onChangeEditedSpecText(e.target.value)}
                    aria-label="Edit Architecture Specification"
                    className="w-full rounded-lg border border-primary/40 bg-background p-2.5 text-xs font-mono text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                ) : showSpecDiff && previousSpecText ? (
                  <div className="rounded-lg border border-amber-500/40 bg-secondary/20 p-2.5 font-mono text-xs space-y-1">
                    <div className="text-rose-700 dark:text-rose-400 line-through whitespace-pre-wrap">
                      - {previousSpecText}
                    </div>
                    <div className="text-emerald-700 dark:text-emerald-400 whitespace-pre-wrap">
                      + {liveSpecText}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs font-medium text-foreground leading-relaxed [text-wrap:pretty] whitespace-pre-wrap">
                    {liveSpecText}
                  </p>
                )}
              </div>

              {technicalRationale && (
                <div className="rounded-lg border border-border bg-secondary/20 p-2.5 space-y-0.5">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Technical Rationale &amp; Execution
                  </span>
                  <p className="text-xs text-foreground leading-relaxed [text-wrap:pretty]">{technicalRationale}</p>
                </div>
              )}

              {selectedDelib?.synthesis_proposal?.consensus_points &&
                selectedDelib.synthesis_proposal.consensus_points.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-xs font-mono font-semibold text-muted-foreground">
                      Consensus Anchor Points
                    </span>
                    <ul className="space-y-1 pl-3.5 list-disc text-xs text-foreground">
                      {selectedDelib.synthesis_proposal.consensus_points.map((pt, idx) => (
                        <li key={`${pt.slice(0, 24)}-${idx}`}>{pt}</li>
                      ))}
                    </ul>
                  </div>
                )}

              {disagreements.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                    Recorded Dissent &amp; Trade-offs ({disagreements.length})
                  </span>
                  {disagreements.map((d, i) => {
                    const isResolved = resolvedDissentTopics.includes(d.topic);
                    return (
                      <div
                        key={`${d.topic}-${i}`}
                        className={`rounded-lg border p-2 text-xs space-y-1 ${
                          isResolved
                            ? 'border-emerald-500/30 bg-emerald-500/5'
                            : 'border-border bg-secondary/20'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-foreground text-xs">{d.topic}</p>
                          <button
                            type="button"
                            disabled={!canMutate}
                            onClick={() => onToggleResolveDissent(d.topic)}
                            className={`min-h-6 px-2 py-0.5 rounded text-xs font-mono font-medium border transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0 ${
                              isResolved
                                ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                                : 'border-border bg-card text-foreground hover:bg-secondary'
                            }`}
                          >
                            {isResolved ? '✓ Accepted into Spec' : 'Accept Trade-off'}
                          </button>
                        </div>
                        <p className="text-muted-foreground text-xs">{d.mitigation}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

      <div className="px-2.5 py-2 border-t border-border bg-secondary/20 shrink-0 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
          <Shield className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
          <span className="text-xs font-mono font-bold text-foreground truncate">
            Decision Record (ADR) · {adrStatus}
          </span>
          {selectedDelib && (
            <div className="hidden sm:flex items-center gap-1">
              {VOTING_MODELS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  disabled={!canMutate || isQuorumPending}
                  onClick={() => onSelectVotingModel(m.id)}
                  title={`Evaluate ${m.label} quorum vote`}
                  className={`min-h-6 px-2 py-0.5 rounded text-xs font-mono transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    votingModel === m.id
                      ? 'bg-primary/15 text-primary border border-primary/40 font-bold'
                      : 'bg-secondary text-muted-foreground hover:text-foreground border border-transparent'
                  }`}
                >
                  {m.label}
                </button>
              ))}
              {quorumResult && (
                <span className="text-xs font-mono tabular-nums text-emerald-700 dark:text-emerald-400 font-semibold pl-0.5">
                  {quorumResult.total_weight > 0
                    ? Math.round((quorumResult.approve_weight / quorumResult.total_weight) * 100)
                    : 0}
                  %
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onCopyAdr}
            disabled={!hasActiveDebateOrProposal}
            title="Copy formatted ADR Markdown"
            className="min-h-7 inline-flex items-center gap-1 rounded border border-border bg-card px-2 py-1 text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {copiedAdr ? (
              <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            ) : (
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>{copiedAdr ? 'Copied' : 'ADR'}</span>
          </button>

          {adrStatus === 'RESOLVED' ? (
            <div className="min-h-7 inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Ratified &amp; Committed</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={onRatifySpec}
              disabled={!hasActiveDebateOrProposal || !canRatify}
              title={
                !canMutate
                  ? 'Disabled in read-only mode'
                  : !hasSynthesizedSpec
                  ? 'Awaiting synthesized architecture specification before ratification'
                  : 'Ratify Decision Record and commit to Organizational Memory'
              }
              className="min-h-7 inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {isRatifyPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span>{isRatifyPending ? 'Ratifying…' : 'Ratify & Commit Spec'}</span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
