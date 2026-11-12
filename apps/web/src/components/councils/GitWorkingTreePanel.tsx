'use client';

import React from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FolderGit2,
  GitBranch,
  Loader2,
  Minus,
  Plus,
  RotateCw,
  Sparkles,
} from 'lucide-react';
import type { GitCommitLogResponse, GitStatusResponse } from '@/lib/api/vcs';

interface GitWorkingTreePanelProps {
  gitExpanded: boolean;
  onToggleGitExpanded: () => void;
  gitStatus?: GitStatusResponse | null;
  gitStatusError: boolean;
  onRetryGitStatus: () => void;
  gitCommitLog?: GitCommitLogResponse | null;
  rightPanelCommitMsg: string;
  onChangeCommitMsg: (msg: string) => void;
  canMutate: boolean;
  isCommitting: boolean;
  onOpenVcsDrawer: () => void;
  onInspectCommit: (sha: string) => void;
  onInspectFileDiff: (path: string, staged: boolean) => void;
  onStageFile: (path: string) => void;
  onUnstageFile: (path: string) => void;
  onGenerateAiCommitMsg: () => void;
  onCommit: (message: string) => void;
}

export function GitWorkingTreePanel({
  gitExpanded,
  onToggleGitExpanded,
  gitStatus,
  gitStatusError,
  onRetryGitStatus,
  gitCommitLog,
  rightPanelCommitMsg,
  onChangeCommitMsg,
  canMutate,
  isCommitting,
  onOpenVcsDrawer,
  onInspectCommit,
  onInspectFileDiff,
  onStageFile,
  onUnstageFile,
  onGenerateAiCommitMsg,
  onCommit,
}: GitWorkingTreePanelProps) {
  const modifiedCount = gitStatus?.unstaged_files?.length || 0;
  const stagedCount = gitStatus?.staged_files?.length || 0;
  const untrackedCount = gitStatus?.untracked_files?.length || 0;

  return (
    <section
      aria-label="Git Working Tree"
      className={`${
        gitExpanded ? 'flex-[3] min-h-0' : 'shrink-0'
      } flex flex-col overflow-hidden bg-card transition-all`}
    >
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border bg-secondary/30 shrink-0 gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <GitBranch className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
          <span className="text-xs font-mono font-bold text-foreground truncate">
            Git Working Tree
          </span>
          <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-secondary text-muted-foreground border border-border/60 shrink-0">
            {gitStatus?.branch || 'main'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onOpenVcsDrawer}
            aria-label="VCS"
            className="min-h-6 px-1.5 text-xs font-mono text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            VCS ↗
          </button>
          <button
            type="button"
            onClick={onToggleGitExpanded}
            title={gitExpanded ? 'Collapse Git Panel' : 'Expand Git Panel'}
            aria-label={gitExpanded ? 'Collapse Git Panel' : 'Expand Git Panel'}
            aria-expanded={gitExpanded}
            className="min-h-6 min-w-6 flex items-center justify-center p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {gitExpanded ? (
              <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {gitExpanded && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="px-3 py-1 flex items-center justify-between text-xs font-mono tabular-nums border-b border-border shrink-0 bg-background/50">
            <span className="text-foreground font-semibold">{modifiedCount} modified</span>
            <span className="text-foreground font-semibold">{stagedCount} staged</span>
            <span className="text-muted-foreground">{untrackedCount} untracked</span>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
            {gitStatusError ? (
              <div role="alert" className="flex items-center justify-between gap-2 rounded border border-rose-500/30 bg-rose-500/10 p-2 text-xs text-rose-800 dark:text-rose-300">
                <span className="font-mono">Failed to fetch Git working tree status.</span>
                <button
                  type="button"
                  onClick={onRetryGitStatus}
                  className="min-h-6 inline-flex items-center gap-1 rounded border border-rose-500/30 bg-background px-2 py-0.5 text-xs font-semibold text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <RotateCw className="h-3 w-3" aria-hidden="true" />
                  <span>Retry</span>
                </button>
              </div>
            ) : !gitStatus || (modifiedCount === 0 && stagedCount === 0 && untrackedCount === 0) ? (
              gitCommitLog?.commits && gitCommitLog.commits.length > 0 ? (
                <div className="space-y-1">
                  <div className="flex items-center px-1 text-xs font-mono text-muted-foreground gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" aria-hidden="true" />
                    <span>Working tree clean · Click commit to inspect diff</span>
                  </div>
                  {gitCommitLog.commits.slice(0, 4).map((c) => (
                    <button
                      key={c.sha}
                      type="button"
                      onClick={() => onInspectCommit(c.sha)}
                      className="w-full min-h-7 flex items-center justify-between gap-2 text-xs font-mono py-1 px-2 rounded bg-secondary/20 hover:bg-secondary/50 border border-border/60 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="truncate text-foreground flex-1" title={c.message}>
                        {c.message}
                      </span>
                      <span className="text-xs text-primary font-semibold shrink-0 tabular-nums">
                        {c.short_sha}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center gap-1.5 py-6 text-center text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-emerald-700 dark:text-emerald-400 shrink-0" aria-hidden="true" />
                  <p className="text-xs font-mono">Working tree clean</p>
                </div>
              )
            ) : (
              <>
                {gitStatus.staged_files.map((f) => (
                  <div
                    key={`staged-${f.path}`}
                    className="flex items-center justify-between gap-2 text-xs font-mono py-1 px-2 rounded border border-border/60 bg-secondary/15 hover:bg-secondary/40"
                  >
                    <span className="truncate text-foreground flex-1" title={f.path}>
                      {f.path}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onInspectFileDiff(f.path, true)}
                        title={`View staged diff for ${f.path}`}
                        className="min-h-6 px-2 py-0.5 rounded bg-secondary text-muted-foreground hover:text-foreground text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        Diff
                      </button>
                      <button
                        type="button"
                        disabled={!canMutate}
                        onClick={() => onUnstageFile(f.path)}
                        aria-label={`Unstage ${f.path}`}
                        title="Unstage file"
                        className="min-h-6 min-w-6 flex items-center justify-center p-1 rounded bg-secondary text-amber-800 dark:text-amber-300 hover:bg-amber-500/20 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Minus className="h-3 w-3" aria-hidden="true" />
                      </button>
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-bold border border-emerald-500/30">
                        STAGED
                      </span>
                    </div>
                  </div>
                ))}

                {gitStatus.unstaged_files.map((f) => (
                  <div
                    key={`unstaged-${f.path}`}
                    className="flex items-center justify-between gap-2 text-xs font-mono py-1 px-2 rounded border border-border/60 bg-secondary/15 hover:bg-secondary/40"
                  >
                    <span className="truncate text-foreground flex-1" title={f.path}>
                      {f.path}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onInspectFileDiff(f.path, false)}
                        title={`View unstaged diff for ${f.path}`}
                        className="min-h-6 px-2 py-0.5 rounded bg-secondary text-muted-foreground hover:text-foreground text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        Diff
                      </button>
                      <button
                        type="button"
                        disabled={!canMutate}
                        onClick={() => onStageFile(f.path)}
                        aria-label={`Stage ${f.path}`}
                        title="Stage file"
                        className="min-h-6 min-w-6 flex items-center justify-center p-1 rounded bg-secondary text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Plus className="h-3 w-3" aria-hidden="true" />
                      </button>
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs font-bold border border-amber-500/30">
                        MOD
                      </span>
                    </div>
                  </div>
                ))}

                {gitStatus.untracked_files.map((p) => (
                  <div
                    key={`untracked-${p}`}
                    className="flex items-center justify-between gap-2 text-xs font-mono py-1 px-2 rounded border border-border/60 bg-secondary/15 hover:bg-secondary/40"
                  >
                    <span className="truncate text-muted-foreground flex-1" title={p}>
                      {p}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={!canMutate}
                        onClick={() => onStageFile(p)}
                        aria-label={`Stage ${p}`}
                        title="Stage untracked file"
                        className="min-h-6 min-w-6 flex items-center justify-center p-1 rounded bg-secondary text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Plus className="h-3 w-3" aria-hidden="true" />
                      </button>
                      <span className="px-1.5 py-0.5 rounded bg-secondary text-muted-foreground text-xs font-bold border border-border">
                        NEW
                      </span>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          <div className="p-2 border-t border-border bg-card shrink-0 flex items-center gap-1.5">
            <button
              type="button"
              disabled={!canMutate}
              onClick={onGenerateAiCommitMsg}
              title="Generate commit message summary from working tree changes"
              aria-label="AI Generate Commit Message"
              className="min-h-7 min-w-7 flex items-center justify-center p-1.5 rounded border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-colors shrink-0 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <input
              type="text"
              value={rightPanelCommitMsg}
              disabled={!canMutate}
              onChange={(e) => onChangeCommitMsg(e.target.value)}
              aria-label="Commit message"
              placeholder="Commit message…"
              className="flex-1 rounded border border-border bg-background px-2.5 py-1 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-mono disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => {
                if (rightPanelCommitMsg.trim()) {
                  onCommit(rightPanelCommitMsg.trim());
                  onChangeCommitMsg('');
                }
              }}
              aria-label="Commit Changes"
              disabled={!canMutate || isCommitting || !rightPanelCommitMsg.trim()}
              className="min-h-7 inline-flex items-center justify-center gap-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 px-3 py-1 text-xs font-semibold transition-colors shadow-xs shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {isCommitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <FolderGit2 className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span>{isCommitting ? 'Committing…' : 'Commit'}</span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
