'use client';

import React, { memo } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookmarkPlus,
  Check,
  Code2,
  Copy,
  FileText,
  FolderGit2,
  GitBranch,
  ListTodo,
  Loader2,
  Play,
  RotateCw,
  Scale,
  Sparkles,
} from 'lucide-react';
import { AgentAvatar } from '@/components/ui/AgentAvatar';
import type { CouncilMember, ReviewItem } from '@/lib/api/councils';
import type { CTOProposal } from '@/lib/api/cto';
import type { GitStatusResponse } from '@/lib/api/vcs';
import type { RuntimeExecuteResult } from '@/lib/api/runtime';
import { DIRECTIVE_SUGGESTIONS, type ChatTurn } from './types';

interface ReviewCardProps {
  rev: ReviewItem;
  members: CouncilMember[];
  canMutate: boolean;
  onChallenge: (role: string, proposalSnippet: string) => void;
  onCopy: (text: string) => void;
  onPinMemory: (title: string, content: string) => void;
}

const CouncilReviewCard = memo(function CouncilReviewCard({
  rev,
  members,
  canMutate,
  onChallenge,
  onCopy,
  onPinMemory,
}: ReviewCardProps) {
  const stance = rev.objections.length > 0 ? 'OBJECTS' : 'SUPPORTS';
  const stanceColor =
    stance === 'SUPPORTS'
      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-semibold tabular-nums'
      : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30 font-semibold tabular-nums';
  const memberConfig = members.find((m) => m.role_title === rev.role);
  const modelId = rev.model || memberConfig?.model_identifier || null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2.5 transition-colors hover:border-foreground/20">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <AgentAvatar name={rev.agent_name || rev.role} roleTitle={rev.role} size={26} showStatus={false} />
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <span className="text-xs font-bold text-foreground truncate">{rev.agent_name || rev.role}</span>
            {rev.role && (
              <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-secondary text-muted-foreground border border-border/60">
                @{rev.role}
              </span>
            )}
            {modelId && (
              <span className="text-xs font-mono text-muted-foreground px-1.5 py-0.5 rounded border border-border/60 bg-secondary/40">
                {modelId}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`px-2 py-0.5 rounded text-xs font-mono border ${stanceColor}`}>
            {stance} · {Math.round(rev.confidence * 100)}%
          </span>
          <button
            type="button"
            disabled={!canMutate}
            onClick={() => onChallenge(rev.role || rev.agent_name || 'CTO', rev.proposal.slice(0, 64))}
            title={`Challenge or follow up with @${rev.role || rev.agent_name || 'CTO'}`}
            className="min-h-6 px-2 py-0.5 rounded border border-border bg-secondary/40 text-xs font-mono text-foreground hover:bg-secondary transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Challenge
          </button>
          <button
            type="button"
            onClick={() => onCopy(rev.proposal)}
            title="Copy response body"
            aria-label={`Copy response from ${rev.agent_name || rev.role}`}
            className="min-h-6 min-w-6 flex items-center justify-center p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled={!canMutate}
            onClick={() => onPinMemory(`Council Review: ${rev.role || rev.agent_name}`, rev.proposal)}
            title="Pin insight to Organizational Memory"
            aria-label={`Pin ${rev.role || rev.agent_name} review to Organizational Memory`}
            className="min-h-6 min-w-6 flex items-center justify-center p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <BookmarkPlus className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <p className="text-sm text-foreground leading-relaxed pl-1 max-w-[68ch] [text-wrap:pretty] whitespace-pre-wrap">
        {rev.proposal}
      </p>

      {rev.evidence.length > 0 && (
        <div className="space-y-1 pt-1">
          <span className="text-xs font-mono font-semibold text-muted-foreground">
            Evidence &amp; Artifacts:
          </span>
          <ul className="pl-4 space-y-1 text-xs text-muted-foreground list-disc list-inside [text-wrap:pretty]">
            {rev.evidence.map((pt, i) => (
              <li key={`${pt.slice(0, 24)}-${i}`} className="[text-wrap:pretty]">
                {pt}
              </li>
            ))}
          </ul>
        </div>
      )}

      {rev.risks.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {rev.risks.map((risk, i) => (
            <span
              key={`${risk.slice(0, 24)}-${i}`}
              className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-300"
            >
              <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span>{risk}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
});

interface InlineSpecArtifactCardProps {
  title: string;
  adrStatus: string;
  previewText: string;
  onOpenSpecDrawer: () => void;
}

function InlineSpecArtifactCard({
  title,
  adrStatus,
  previewText,
  onOpenSpecDrawer,
}: InlineSpecArtifactCardProps) {
  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 flex items-start justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <FileText className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
          <span className="text-xs font-mono font-bold text-foreground truncate">{title}</span>
          <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-secondary text-foreground border border-border tabular-nums">
            {adrStatus}
          </span>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{previewText}</p>
      </div>
      <button
        type="button"
        onClick={onOpenSpecDrawer}
        className="min-h-7 shrink-0 inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-mono font-semibold text-primary-foreground hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span>Open Spec &amp; ADR</span>
      </button>
    </div>
  );
}

interface TurnCardProps {
  turn: ChatTurn;
  canMutate: boolean;
  executingCodeId: string | null;
  codeExecutionOutput?: RuntimeExecuteResult;
  gitStatus?: GitStatusResponse | null;
  inlineGitMessage: string;
  onChangeInlineGitMessage: (msg: string) => void;
  isTickPending: boolean;
  isCommitPending: boolean;
  adrStatus: string;
  liveSpecText: string;
  isPromotedTurn: boolean;
  onCopy: (text: string) => void;
  onPromoteToSpec: (body: string, turnId: string) => void;
  onPinMemory: (title: string, body: string) => void;
  onRunAllTasks: () => void;
  onOpenDrawer: (drawerId: string) => void;
  onOpenSpecDrawer: () => void;
  onToggleTask: (taskId: string, currentStatus: string) => void;
  onExecuteSandbox: (turnId: string, language: string, code: string) => void;
  onCommitGit: (message: string) => void;
}

const ChatTurnCard = memo(function ChatTurnCard({
  turn,
  canMutate,
  executingCodeId,
  codeExecutionOutput,
  gitStatus,
  inlineGitMessage,
  onChangeInlineGitMessage,
  isTickPending,
  isCommitPending,
  adrStatus,
  liveSpecText,
  isPromotedTurn,
  onCopy,
  onPromoteToSpec,
  onPinMemory,
  onRunAllTasks,
  onOpenDrawer,
  onOpenSpecDrawer,
  onToggleTask,
  onExecuteSandbox,
  onCommitGit,
}: TurnCardProps) {
  const isError = turn.role === 'Error';
  const isUser = turn.sender === 'Operator';
  const cardSurface = isUser
    ? 'border-border bg-secondary/30'
    : isError
    ? 'border-rose-500/40 bg-rose-500/5'
    : 'border-border bg-card';

  return (
    <div className={`rounded-xl border p-4 space-y-2.5 transition-colors hover:border-foreground/20 ${cardSurface}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          {isUser ? (
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-foreground text-background text-xs font-bold font-mono shrink-0">
              Op
            </div>
          ) : isError ? (
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-rose-500/15 text-rose-700 dark:text-rose-400 text-xs font-bold shrink-0">
              !
            </div>
          ) : (
            <AgentAvatar name={turn.sender} roleTitle={turn.role} size={26} showStatus={false} />
          )}
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <span className="text-xs font-bold text-foreground truncate">{turn.sender}</span>
            <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-secondary text-muted-foreground border border-border/60">
              {turn.role}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {turn.stance && (
            <span
              className={`px-2 py-0.5 rounded text-xs font-mono font-semibold border ${
                turn.stance === 'SYNTHESIZED'
                  ? 'text-primary bg-primary/10 border-primary/30'
                  : 'text-muted-foreground bg-secondary border-border'
              }`}
            >
              {turn.stance}
            </span>
          )}
          <button
            type="button"
            onClick={() => onCopy(turn.body)}
            title="Copy message body"
            aria-label={`Copy message from ${turn.sender}`}
            className="min-h-6 min-w-6 flex items-center justify-center p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          {!isUser && !isError && (
            <>
              <button
                type="button"
                disabled={!canMutate}
                onClick={() => onPromoteToSpec(turn.body, turn.id)}
                title="Promote response to Architecture Specification and open drawer"
                className="min-h-6 px-2 py-0.5 rounded border border-primary/30 bg-primary/10 text-xs font-mono text-primary hover:bg-primary/20 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Promote to Spec
              </button>
              <button
                type="button"
                disabled={!canMutate}
                onClick={() => onPinMemory(turn.sender, turn.body)}
                title="Pin insight to Organizational Memory"
                aria-label={`Pin ${turn.sender} response to Organizational Memory`}
                className="min-h-6 min-w-6 flex items-center justify-center p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <BookmarkPlus className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </div>

      <p
        className={`text-sm leading-relaxed pl-1 max-w-[68ch] [text-wrap:pretty] whitespace-pre-wrap ${
          isError ? 'text-rose-700 dark:text-rose-400 font-mono text-xs' : 'text-foreground'
        }`}
      >
        {turn.body}
      </p>

      {turn.tasks && turn.tasks.length > 0 && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-bold font-mono text-primary flex items-center gap-1.5">
              <ListTodo className="h-3.5 w-3.5" aria-hidden="true" />
              Decomposed Tasks ({turn.tasks.length})
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onRunAllTasks}
                disabled={!canMutate || isTickPending}
                className="min-h-6 inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-primary text-primary-foreground text-xs font-mono font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Play className="h-3 w-3" aria-hidden="true" />
                <span>Run All Tasks</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenDrawer('tasks')}
                className="min-h-6 px-1.5 text-xs font-mono text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              >
                Open Board
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            {turn.tasks.map((t, tidx) => {
              const isDone = t.status === 'DONE' || t.status === 'COMPLETED';
              return (
                <div
                  key={t.id || `${t.title}-${tidx}`}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      type="button"
                      disabled={!canMutate || !t.id}
                      onClick={() => t.id && onToggleTask(t.id, t.status || 'TODO')}
                      aria-label={`Toggle decomposed task: ${t.title}`}
                      className={`min-h-6 min-w-6 flex items-center justify-center rounded border shrink-0 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        isDone ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-border bg-background'
                      }`}
                    >
                      {isDone && <Check className="h-3 w-3 stroke-[3]" aria-hidden="true" />}
                    </button>
                    <span className={`truncate ${isDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                      {t.title}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground shrink-0 tabular-nums">
                    {t.status || 'PENDING'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {turn.codeSnippet && (
        <div className="rounded-xl border border-border bg-secondary/40 dark:bg-zinc-950/90 p-3 space-y-2 font-mono text-xs">
          <div className="flex items-center justify-between border-b border-border pb-2 gap-2">
            <span className="text-xs text-muted-foreground font-bold flex items-center gap-1.5">
              <Code2 className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
              Sandbox Runner ({turn.codeSnippet.language})
            </span>
            <button
              type="button"
              onClick={() => onExecuteSandbox(turn.id, turn.codeSnippet!.language, turn.codeSnippet!.code)}
              disabled={!canMutate || executingCodeId === turn.id}
              className="min-h-7 inline-flex items-center gap-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white px-2.5 py-1 text-xs font-semibold disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {executingCodeId === turn.id ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              ) : (
                <Play className="h-3 w-3" aria-hidden="true" />
              )}
              <span>Run in Sandbox</span>
            </button>
          </div>
          <pre className="p-2.5 rounded bg-background border border-border/60 text-foreground overflow-x-auto text-xs">
            {turn.codeSnippet.code}
          </pre>
          {codeExecutionOutput && (
            <div className="p-2.5 rounded bg-background border border-border space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums">
                <span>Output · Exit {codeExecutionOutput.exit_code}</span>
                <span>{codeExecutionOutput.duration_ms}ms</span>
              </div>
              {codeExecutionOutput.stdout && (
                <pre className="text-emerald-800 dark:text-emerald-300 text-xs whitespace-pre-wrap">
                  {codeExecutionOutput.stdout}
                </pre>
              )}
              {codeExecutionOutput.stderr && (
                <pre className="text-rose-700 dark:text-rose-400 text-xs whitespace-pre-wrap">
                  {codeExecutionOutput.stderr}
                </pre>
              )}
            </div>
          )}
        </div>
      )}

      {turn.isWorkflowLink && (
        <div className="rounded-xl border border-border bg-secondary/30 p-3 flex items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-foreground flex items-center gap-1.5">
            <GitBranch className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
            Workflow Execution DAG
          </span>
          <button
            type="button"
            onClick={() => onOpenDrawer('workflows')}
            className="min-h-6 px-2 text-xs font-mono text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            Open Live DAG View
          </button>
        </div>
      )}

      {turn.isGitCard && (
        <div className="rounded-xl border border-border bg-secondary/30 p-3 space-y-2.5 text-xs font-mono">
          <div className="flex items-center justify-between">
            <span className="font-bold text-foreground flex items-center gap-1.5">
              <FolderGit2 className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              Working Tree Status ({gitStatus?.branch || 'main'})
            </span>
            <button
              type="button"
              onClick={() => onOpenDrawer('git')}
              className="min-h-6 text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-1"
            >
              Open Full VCS
            </button>
          </div>
          <p className="text-muted-foreground text-xs tabular-nums">
            {gitStatus?.unstaged_files?.length || 0} modified, {gitStatus?.untracked_files?.length || 0} untracked files.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={inlineGitMessage}
              onChange={(e) => onChangeInlineGitMessage(e.target.value)}
              aria-label="Inline git commit message"
              className="flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <button
              type="button"
              onClick={() => onCommitGit(inlineGitMessage)}
              disabled={!canMutate || isCommitPending || !inlineGitMessage.trim()}
              className="min-h-7 px-3 py-1 rounded-md bg-emerald-700 hover:bg-emerald-600 text-white font-semibold disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {isCommitPending ? 'Committing…' : 'Commit'}
            </button>
          </div>
        </div>
      )}

      {(turn.stance === 'SYNTHESIZED' || isPromotedTurn) && (
        <InlineSpecArtifactCard
          title="Architecture Specification & ADR"
          adrStatus={adrStatus}
          previewText={liveSpecText || turn.body}
          onOpenSpecDrawer={onOpenSpecDrawer}
        />
      )}
    </div>
  );
});

export interface DiscussionThreadResponseItem {
  respondent: string;
  role?: string;
  replying_to?: string;
  stance?: string;
  argument: string;
}

export interface DiscussionThreadItem {
  id?: string;
  topic: string;
  original_objection: string;
  raised_by: string;
  responses: DiscussionThreadResponseItem[];
  resolved?: boolean;
}

interface CouncilTurnListProps {
  reviews: ReviewItem[];
  discussionThreads?: DiscussionThreadItem[];
  members: CouncilMember[];
  localTurns: ChatTurn[];
  councilsLoading: boolean;
  councilsError: boolean;
  deliberationsError: boolean;
  onRetryQueries: () => void;
  topProposal?: CTOProposal;
  canMutate: boolean;
  isDirectivePending: boolean;
  isStartDelibPending: boolean;
  activeDispatchingPrompt: string | null;
  executingCodeId: string | null;
  codeExecutionOutputs: Record<string, RuntimeExecuteResult>;
  gitStatus?: GitStatusResponse | null;
  inlineGitMessage: string;
  onChangeInlineGitMessage: (msg: string) => void;
  isTickPending: boolean;
  isCommitPending: boolean;
  adrStatus: string;
  liveSpecText: string;
  selectedDelibTitle?: string;
  hasSynthesizedProposal?: boolean;
  promotedTurnId?: string | null;
  onAutoDispatch: (promptText: string, autoTickSwarm?: boolean) => void;
  onDebateProposal: (title: string, rationale?: string) => void;
  onChallenge: (role: string, snippet: string) => void;
  onCopy: (text: string) => void;
  onPromoteToSpec: (body: string, turnId: string) => void;
  onPinMemory: (title: string, body: string) => void;
  onRunAllTasks: () => void;
  onOpenDrawer: (drawerId: string) => void;
  onOpenSpecDrawer: () => void;
  onToggleTask: (taskId: string, currentStatus: string) => void;
  onExecuteSandbox: (turnId: string, language: string, code: string) => void;
  onCommitGit: (message: string) => void;
  chatBottomRef: React.RefObject<HTMLDivElement>;
}

export function CouncilTurnList({
  reviews,
  discussionThreads = [],
  members,
  localTurns,
  councilsLoading,
  councilsError,
  deliberationsError,
  onRetryQueries,
  topProposal,
  canMutate,
  isDirectivePending,
  isStartDelibPending,
  activeDispatchingPrompt,
  executingCodeId,
  codeExecutionOutputs,
  gitStatus,
  inlineGitMessage,
  onChangeInlineGitMessage,
  isTickPending,
  isCommitPending,
  adrStatus,
  liveSpecText,
  selectedDelibTitle,
  hasSynthesizedProposal = false,
  promotedTurnId = null,
  onAutoDispatch,
  onDebateProposal,
  onChallenge,
  onCopy,
  onPromoteToSpec,
  onPinMemory,
  onRunAllTasks,
  onOpenDrawer,
  onOpenSpecDrawer,
  onToggleTask,
  onExecuteSandbox,
  onCommitGit,
  chatBottomRef,
}: CouncilTurnListProps) {
  const hasTurnSpecCard = localTurns.some((t) => t.stance === 'SYNTHESIZED' || t.id === promotedTurnId);
  return (
    <div className="p-4 space-y-3.5 flex-1 overflow-y-auto min-h-0">
      {(councilsError || deliberationsError) && (
        <div
          role="alert"
          className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 flex items-center justify-between gap-2 text-xs text-rose-800 dark:text-rose-300"
        >
          <span className="font-mono">
            Failed to load {councilsError ? 'council registry' : 'council deliberations'}. Check backend connectivity.
          </span>
          <button
            type="button"
            onClick={onRetryQueries}
            className="min-h-7 inline-flex items-center gap-1 rounded-md border border-rose-500/40 bg-background px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
          >
            <RotateCw className="h-3 w-3" aria-hidden="true" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {councilsLoading && reviews.length === 0 && localTurns.length === 0 && (
        <div className="space-y-3" aria-busy="true" aria-label="Loading council deliberations">
          <div className="h-24 rounded-xl border border-border bg-secondary/40 animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="h-24 rounded-xl border border-border bg-secondary/30 animate-pulse" />
            <div className="h-24 rounded-xl border border-border bg-secondary/30 animate-pulse" />
          </div>
        </div>
      )}

      {reviews.length === 0 && localTurns.length === 0 && !councilsLoading ? (
        <div className="py-2 space-y-4">
          {topProposal ? (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                  <span className="text-xs font-mono font-bold text-primary">
                    Active Proposal for Execution
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded text-xs font-mono font-semibold bg-primary/10 text-primary border border-primary/30">
                  {topProposal.category || 'SECURITY PRIORITY'}
                </span>
              </div>

              <div>
                <h3 className="text-sm font-bold text-foreground">{topProposal.title}</h3>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{topProposal.rationale}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() =>
                    onAutoDispatch(`Implement and execute architectural proposal: ${topProposal.title}`, true)
                  }
                  disabled={!canMutate || isDirectivePending}
                  className="min-h-8 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-all shadow-xs disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {isDirectivePending && activeDispatchingPrompt?.includes(topProposal.title) ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Play className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  <span>Decompose &amp; Dispatch to Swarm</span>
                </button>

                <button
                  type="button"
                  onClick={() => onDebateProposal(topProposal.title, topProposal.rationale)}
                  disabled={!canMutate || isStartDelibPending}
                  className="min-h-8 inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary/60 transition-all disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {isStartDelibPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Scale className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  )}
                  <span>Debate with Specialist Council</span>
                </button>
              </div>
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-3 px-1 flex-wrap">
            <div>
              <h3 className="text-xs font-bold text-foreground">Architectural Command Hub</h3>
              <p className="text-xs text-muted-foreground">
                Dispatch engineering directives directly to the CTO and specialist worker swarm.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                onAutoDispatch(
                  'Inspect system architecture, API boundaries, security controls, and test coverage. Synthesize 3 high-priority technical proposals and engineering tasks.',
                  true
                )
              }
              disabled={!canMutate || isDirectivePending}
              className="min-h-7 inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20 transition-all shrink-0 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {isDirectivePending && activeDispatchingPrompt?.includes('Inspect system architecture') ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span>Analyze Codebase &amp; Synthesize Proposals</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            {DIRECTIVE_SUGGESTIONS.map((chip) => {
              const Icon = chip.icon;
              const isRunning = isDirectivePending && activeDispatchingPrompt === chip.prompt;

              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => onAutoDispatch(chip.prompt, true)}
                  disabled={!canMutate || isDirectivePending}
                  className="flex flex-col justify-between p-3 rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-secondary/40 transition-all text-left group shadow-xs disabled:opacity-50 min-h-[92px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="space-y-1 w-full">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-secondary text-primary shrink-0">
                          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                        </div>
                        <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                          {chip.title}
                        </span>
                      </div>
                      <span className={`px-1.5 py-0.5 rounded text-xs font-mono font-semibold border ${chip.badgeColor}`}>
                        {chip.badge}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 pl-7">{chip.description}</p>
                  </div>

                  <div className="flex items-center justify-end gap-1 text-xs font-mono text-muted-foreground group-hover:text-primary pt-2 pl-7">
                    {isRunning ? (
                      <span className="inline-flex items-center gap-1 text-primary">
                        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                        <span>Dispatching…</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5">
                        <span>1-Click Dispatch</span>
                        <ArrowRight className="h-3 w-3" aria-hidden="true" />
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          {reviews.map((rev, idx) => (
            <CouncilReviewCard
              key={`${rev.agent_name || rev.role}-${rev.role}-${idx}`}
              rev={rev}
              members={members}
              canMutate={canMutate}
              onChallenge={onChallenge}
              onCopy={onCopy}
              onPinMemory={onPinMemory}
            />
          ))}

          {discussionThreads.length > 0 && (
            <div className="space-y-2.5 pt-1">
              <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground px-1">
                Agent-to-Agent Discourse &amp; Solomon Directives ({discussionThreads.length})
              </div>
              {discussionThreads.map((thread, tIdx) => (
                <div
                  key={thread.id || `${thread.topic}-${tIdx}`}
                  className="rounded-xl border border-border bg-card/80 p-3.5 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-semibold text-foreground truncate">{thread.topic}</span>
                      <span className="text-[11px] font-mono px-1.5 py-0.5 rounded border border-border bg-secondary text-muted-foreground">
                        Raised by {thread.raised_by}
                      </span>
                    </div>
                    <span
                      className={`text-[11px] font-mono px-2 py-0.5 rounded border ${
                        thread.resolved
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                          : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                      }`}
                    >
                      {thread.resolved ? 'SYNTHESIZED' : 'DEBATING'}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground border-l-2 border-border pl-2.5">
                    {thread.original_objection}
                  </p>

                  <div className="space-y-2 pl-2 border-l border-border/70">
                    {(thread.responses || []).map((resp, rIdx) => {
                      const stance = resp.stance || 'REBUTTAL';
                      const stanceStyle =
                        stance === 'CTO_DIRECTIVE'
                          ? 'border-primary/40 bg-primary/10 text-primary'
                          : stance === 'CONCURS'
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                          : stance === 'ERROR'
                          ? 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400'
                          : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
                      return (
                        <div
                          key={`${resp.respondent}-${rIdx}`}
                          className="rounded-lg border border-border/80 bg-background/70 p-2.5 space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2 min-w-0">
                              <AgentAvatar
                                name={resp.respondent}
                                roleTitle={resp.role}
                                size={22}
                                showStatus={false}
                              />
                              <span className="text-xs font-semibold text-foreground truncate">
                                {resp.respondent}
                              </span>
                              {resp.replying_to && (
                                <span className="text-[11px] font-mono text-muted-foreground">
                                  Replying to @{resp.replying_to}
                                </span>
                              )}
                            </div>
                            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${stanceStyle}`}>
                              {stance}
                            </span>
                          </div>
                          <p className="text-xs text-foreground leading-relaxed">{resp.argument}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {hasSynthesizedProposal && !hasTurnSpecCard && (
            <InlineSpecArtifactCard
              title={selectedDelibTitle || 'Architecture Specification & ADR'}
              adrStatus={adrStatus}
              previewText={liveSpecText}
              onOpenSpecDrawer={onOpenSpecDrawer}
            />
          )}

          {localTurns.map((turn) => (
            <ChatTurnCard
              key={turn.id}
              turn={turn}
              canMutate={canMutate}
              executingCodeId={executingCodeId}
              codeExecutionOutput={codeExecutionOutputs[turn.id]}
              gitStatus={gitStatus}
              inlineGitMessage={inlineGitMessage}
              onChangeInlineGitMessage={onChangeInlineGitMessage}
              isTickPending={isTickPending}
              isCommitPending={isCommitPending}
              adrStatus={adrStatus}
              liveSpecText={liveSpecText}
              isPromotedTurn={promotedTurnId === turn.id}
              onCopy={onCopy}
              onPromoteToSpec={onPromoteToSpec}
              onPinMemory={onPinMemory}
              onRunAllTasks={onRunAllTasks}
              onOpenDrawer={onOpenDrawer}
              onOpenSpecDrawer={onOpenSpecDrawer}
              onToggleTask={onToggleTask}
              onExecuteSandbox={onExecuteSandbox}
              onCommitGit={onCommitGit}
            />
          ))}
        </>
      )}
      <div ref={chatBottomRef} />
    </div>
  );
}
