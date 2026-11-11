'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  GitBranch,
  GitCommit,
  GitFork,
  GitPullRequest,
  Check,
  Plus,
  Minus,
  Trash2,
  RefreshCw,
  FolderGit2,
  ArrowUpRight,
  ArrowDownLeft,
  FileCode,
  FileDiff,
  Layers,
  AlertTriangle,
  Copy,
  ChevronRight,
  ShieldCheck,
  Bot,
  User,
  Sparkles,
  Rocket,
  Lock,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import {
  vcsApi,
  GitFileChangeStatus,
  GitCommitLogItem,
  CreateBranchRequest,
  CheckoutBranchRequest,
  CreateCommitRequest,
  ReleaseSyncRequest,
  ReleaseSyncResponse,
} from '@/lib/api/vcs';
import { useAuthStore } from '@/store/auth';

const CONVENTIONAL_TYPES = [
  { prefix: 'feat: ', label: 'feat', desc: 'A new feature', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' },
  { prefix: 'fix: ', label: 'fix', desc: 'A bug fix', color: 'bg-amber-500/10 text-amber-500 border-amber-500/30' },
  { prefix: 'refactor: ', label: 'refactor', desc: 'Code restructure without behavior change', color: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/30' },
  { prefix: 'test: ', label: 'test', desc: 'Adding or updating tests', color: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/30' },
  { prefix: 'docs: ', label: 'docs', desc: 'Documentation updates', color: 'bg-blue-500/10 text-blue-500 border-blue-500/30' },
  { prefix: 'chore: ', label: 'chore', desc: 'Tooling, deps, configs', color: 'bg-slate-500/10 text-slate-400 border-slate-500/30' },
];

export default function GitManagementPage() {
  const { user, activeCompany } = useAuthStore();
  const companyId = activeCompany?.id || (user as { company_id?: string })?.company_id || 'c1000000-0000-0000-0000-000000000001';
  const queryClient = useQueryClient();

  // Selected file and commit diff state
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedIsStaged, setSelectedIsStaged] = useState<boolean>(false);
  const [selectedCommitSha, setSelectedCommitSha] = useState<string | null>(null);

  // Commit composer state
  const [commitMessage, setCommitMessage] = useState('');
  const [includeAgentCoAuthor, setIncludeAgentCoAuthor] = useState(true);

  // Modals & Panels
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [isReleaseModalOpen, setIsReleaseModalOpen] = useState(false);
  const [releaseTag, setReleaseTag] = useState('v1.0.2');
  const [releaseDryRun, setReleaseDryRun] = useState(true);
  const [releaseResult, setReleaseResult] = useState<ReleaseSyncResponse | null>(null);
  const [rightTab, setRightTab] = useState<'log' | 'stashes' | 'conflicts'>('log');
  const [stashMessage, setStashMessage] = useState('');
  const [copiedSha, setCopiedSha] = useState<string | null>(null);

  // 1. Working Tree Status Query
  const {
    data: statusData,
    isLoading: isStatusLoading,
    error: statusError,
    refetch: refetchStatus,
  } = useQuery({
    queryKey: ['vcs-status', companyId],
    queryFn: () => vcsApi.getStatus(companyId),
    refetchInterval: 8000,
  });

  // 2. Branches Query
  const { data: branchesData, isLoading: isBranchesLoading } = useQuery({
    queryKey: ['vcs-branches', companyId],
    queryFn: () => vcsApi.getBranches(companyId),
  });

  // 2b. Remotes Query (Two-Repository Setup)
  const { data: remotesData, isLoading: isRemotesLoading } = useQuery({
    queryKey: ['vcs-remotes', companyId],
    queryFn: () => vcsApi.getRemotes(companyId),
  });

  // 3. Commit Log Query
  const { data: logData, isLoading: isLogLoading } = useQuery({
    queryKey: ['vcs-log', companyId],
    queryFn: () => vcsApi.getCommitLog(companyId, 40),
  });

  // 4. Stashes Query
  const { data: stashData, isLoading: isStashesLoading } = useQuery({
    queryKey: ['vcs-stashes', companyId],
    queryFn: () => vcsApi.getStashes(companyId),
  });

  // 5. Conflicts Query
  const { data: conflictData } = useQuery({
    queryKey: ['vcs-conflicts', companyId],
    queryFn: () => vcsApi.checkConflicts(companyId),
  });

  // 6. Diff Query
  const { data: diffData, isLoading: isDiffLoading } = useQuery({
    queryKey: ['vcs-diff', companyId, selectedFile, selectedIsStaged, selectedCommitSha],
    queryFn: () =>
      vcsApi.getDiff(
        companyId,
        selectedFile || undefined,
        selectedIsStaged,
        selectedCommitSha || undefined
      ),
    enabled: !!companyId,
  });

  // Invalidate queries helper
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['vcs-status', companyId] });
    queryClient.invalidateQueries({ queryKey: ['vcs-branches', companyId] });
    queryClient.invalidateQueries({ queryKey: ['vcs-log', companyId] });
    queryClient.invalidateQueries({ queryKey: ['vcs-stashes', companyId] });
    queryClient.invalidateQueries({ queryKey: ['vcs-diff', companyId] });
    queryClient.invalidateQueries({ queryKey: ['vcs-conflicts', companyId] });
    queryClient.invalidateQueries({ queryKey: ['vcs-remotes', companyId] });
  };

  const releaseMutation = useMutation({
    mutationFn: (req: ReleaseSyncRequest) => vcsApi.syncRelease(companyId, req),
    onSuccess: (data) => {
      setReleaseResult(data);
      invalidateAll();
    },
  });

  // Mutations
  const stageMutation = useMutation({
    mutationFn: (req: { paths?: string[]; stage_all?: boolean }) =>
      vcsApi.stageFiles(companyId, req),
    onSuccess: () => invalidateAll(),
  });

  const unstageMutation = useMutation({
    mutationFn: (req: { paths?: string[]; unstage_all?: boolean }) =>
      vcsApi.unstageFiles(companyId, req),
    onSuccess: () => invalidateAll(),
  });

  const discardMutation = useMutation({
    mutationFn: (req: { paths?: string[]; discard_all?: boolean }) =>
      vcsApi.discardFiles(companyId, req),
    onSuccess: () => {
      setSelectedFile(null);
      invalidateAll();
    },
  });

  const commitMutation = useMutation({
    mutationFn: (req: CreateCommitRequest) => vcsApi.createCommit(companyId, req),
    onSuccess: () => {
      setCommitMessage('');
      invalidateAll();
    },
  });

  const branchMutation = useMutation({
    mutationFn: (req: CreateBranchRequest) => vcsApi.createBranch(companyId, req),
    onSuccess: () => {
      setIsBranchModalOpen(false);
      setNewBranchName('');
      invalidateAll();
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: (req: CheckoutBranchRequest) => vcsApi.checkoutBranch(companyId, req),
    onSuccess: () => invalidateAll(),
  });

  const createStashMutation = useMutation({
    mutationFn: (msg?: string) => vcsApi.createStash(companyId, { message: msg }),
    onSuccess: () => {
      setStashMessage('');
      invalidateAll();
    },
  });

  const popStashMutation = useMutation({
    mutationFn: (index: number) => vcsApi.popStash(companyId, index),
    onSuccess: () => invalidateAll(),
  });

  const dropStashMutation = useMutation({
    mutationFn: (index: number) => vcsApi.dropStash(companyId, index),
    onSuccess: () => invalidateAll(),
  });

  const handleCommitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commitMessage.trim()) return;

    let finalMessage = commitMessage.trim();
    if (includeAgentCoAuthor) {
      finalMessage += '\n\nCo-authored-by: NEIMAN Autonomous Agent <agent@neiman.ai>';
    }

    commitMutation.mutate({ message: finalMessage });
  };

  const handleCopySha = (sha: string) => {
    navigator.clipboard.writeText(sha);
    setCopiedSha(sha);
    setTimeout(() => setCopiedSha(null), 2000);
  };

  const stagedCount = statusData?.staged_files.length || 0;
  const unstagedCount = (statusData?.unstaged_files.length || 0) + (statusData?.untracked_files.length || 0);

  // Memoized diff lines to prevent expensive re-splitting of up to 2MB diff text on every render
  const diffLines = useMemo(() => {
    if (!diffData?.diff) return [];
    return diffData.diff.split('\n');
  }, [diffData?.diff]);

  // Memoized local branches list
  const localBranches = useMemo(() => {
    return branchesData?.branches.filter((b) => !b.is_remote) || [];
  }, [branchesData?.branches]);

  return (
    <div className="space-y-6">
      {/* ── TOP HEADER / REPOSITORY BAR ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl border border-border bg-card/80 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary">
            <FolderGit2 className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">Git Code Management</h1>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-semibold">
                NEIMAN VCS Engine
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Production Git-style branch isolation, atomic staging, unified diff inspection, and DAG commit tracking.
            </p>
          </div>
        </div>

        {/* Branch Switcher & Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Active Branch Pill */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border bg-background/80 font-mono text-xs">
            <GitBranch className="h-4 w-4 text-primary" />
            <span className="font-semibold text-foreground">
              {statusData?.branch || 'Loading...'}
            </span>
            {statusData?.upstream && (
              <span className="text-[10px] text-muted-foreground hidden sm:inline">
                → {statusData.upstream}
              </span>
            )}
            {(statusData?.ahead ?? 0) > 0 && (
              <span className="flex items-center text-[10px] text-emerald-400 font-bold">
                <ArrowUpRight className="h-3 w-3" />
                {statusData?.ahead}
              </span>
            )}
            {(statusData?.behind ?? 0) > 0 && (
              <span className="flex items-center text-[10px] text-amber-400 font-bold">
                <ArrowDownLeft className="h-3 w-3" />
                {statusData?.behind}
              </span>
            )}
          </div>

          {/* Branch Select */}
          <select
            aria-label="Switch branch"
            value={statusData?.branch || ''}
            onChange={(e) => {
              if (e.target.value && e.target.value !== statusData?.branch) {
                checkoutMutation.mutate({ branch_name: e.target.value });
              }
            }}
            disabled={checkoutMutation.isPending || isBranchesLoading}
            className="px-2.5 py-1.5 rounded-xl border border-border bg-background text-xs font-mono font-medium focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {localBranches.map((b) => (
              <option key={b.name} value={b.name}>
                {b.name} {b.is_current ? '(current)' : ''}
              </option>
            ))}
          </select>

          {/* Promote to Official Release Button */}
          <button
            onClick={() => {
              setIsReleaseModalOpen(true);
              setReleaseResult(null);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition-colors shadow-sm"
          >
            <Rocket className="h-3.5 w-3.5" />
            Promote Release
          </button>

          {/* New Branch Button */}
          <button
            onClick={() => setIsBranchModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-accent text-xs font-semibold transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            New Branch
          </button>

          {/* Refresh Button */}
          <button
            onClick={() => invalidateAll()}
            className="p-2 rounded-xl border border-border bg-card hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title="Refresh repository telemetry"
          >
            <RefreshCw className={`h-4 w-4 ${isStatusLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── TWO-REPOSITORY TOPOLOGY BANNER ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
        {/* Private Repo Card */}
        <div className="p-3 rounded-xl border border-border/80 bg-card/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5 truncate">
            <div className="p-1.5 rounded-lg bg-slate-500/10 text-slate-400 border border-slate-500/20">
              <Lock className="h-3.5 w-3.5" />
            </div>
            <div className="truncate">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                Private Development Remote (origin)
              </span>
              <span className="text-foreground truncate text-[11px] block">
                {remotesData?.remotes.find((r) => r.is_private)?.url || 'https://github.com/Aomine-c2c/Sila.git'}
              </span>
            </div>
          </div>
          <span className="text-[9px] uppercase px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/20 font-bold shrink-0">
            Internal Dev
          </span>
        </div>

        {/* Official Release Repo Card */}
        <div className="p-3 rounded-xl border border-cyan-500/30 bg-cyan-500/5 flex items-center justify-between">
          <div className="flex items-center gap-2.5 truncate">
            <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Rocket className="h-3.5 w-3.5" />
            </div>
            <div className="truncate">
              <span className="text-[10px] uppercase font-bold text-cyan-400 block">
                Official Production Release Remote (official)
              </span>
              <span className="text-foreground truncate text-[11px] block">
                {remotesData?.official_url || 'https://github.com/Aomine-c2c/Neiman.git'}
              </span>
            </div>
          </div>
          <span className="text-[9px] uppercase px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold shrink-0">
            Public Official
          </span>
        </div>
      </div>

      {/* ── CREATE BRANCH MODAL ── */}
      {isBranchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md p-6 rounded-2xl border border-border bg-card shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-primary" />
                Create New Git Branch
              </h3>
              <button
                onClick={() => setIsBranchModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              New branches branch off current HEAD (<code>{statusData?.branch}</code>).
            </p>
            <input
              type="text"
              placeholder="e.g. feature/vcs-staging-workflow"
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsBranchModalOpen(false)}
                className="px-3 py-1.5 rounded-xl border border-border text-xs text-muted-foreground hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!newBranchName.trim() || branchMutation.isPending}
                onClick={() => branchMutation.mutate({ branch_name: newBranchName, checkout: true })}
                className="px-4 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {branchMutation.isPending ? 'Creating...' : 'Create & Checkout'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PROMOTE TO OFFICIAL RELEASE MODAL ── */}
      {isReleaseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-lg p-6 rounded-2xl border border-cyan-500/30 bg-card shadow-2xl space-y-4 font-mono">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
                <Rocket className="h-4 w-4 text-cyan-400" />
                Promote Release to Official Repository
              </h3>
              <button
                onClick={() => setIsReleaseModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Promote audited release commits from private development to{' '}
              <span className="text-cyan-400 font-bold">https://github.com/Aomine-c2c/Neiman.git</span> with pre-flight secret scrubbing.
            </p>

            {/* Release Parameters Form */}
            <div className="space-y-3 pt-2 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] uppercase text-muted-foreground block mb-1">
                    Target Remote
                  </label>
                  <input
                    type="text"
                    disabled
                    value="official"
                    className="w-full px-2.5 py-1.5 rounded-xl border border-border bg-background/50 text-muted-foreground text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase text-muted-foreground block mb-1">
                    Release Tag
                  </label>
                  <input
                    type="text"
                    placeholder="v0.2.0"
                    value={releaseTag}
                    onChange={(e) => setReleaseTag(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-border bg-background text-xs font-mono focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Dry-run Toggle */}
              <label className="flex items-center gap-2 cursor-pointer p-2.5 rounded-xl border border-border/80 bg-background/60 select-none">
                <input
                  type="checkbox"
                  checked={releaseDryRun}
                  onChange={(e) => setReleaseDryRun(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-0"
                />
                <div>
                  <span className="text-xs font-semibold text-foreground block">
                    Preflight Dry-Run Simulation (Recommended)
                  </span>
                  <span className="text-[10px] text-muted-foreground block">
                    Validates credentials, air-gap secret scrubbing, and network handshake without pushing code.
                  </span>
                </div>
              </label>

              {/* Execution Results Ledger */}
              {releaseResult && (
                <div className="space-y-2 p-3 rounded-xl border border-border/80 bg-background/80 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1.5">
                      {releaseResult.success ? (
                        <Check className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-rose-400" />
                      )}
                      {releaseResult.message}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 font-mono">
                      {releaseResult.commit_sha.substring(0, 7)}
                    </span>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-border/60 max-h-48 overflow-y-auto">
                    {releaseResult.preflight_checks.map((chk, i) => (
                      <div key={i} className="text-[11px] p-1.5 rounded bg-card/60 border border-border/40">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground">{chk.check}</span>
                          <span
                            className={`text-[9px] uppercase font-bold px-1.5 py-0.2 rounded ${
                              chk.status === 'PASSED'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : chk.status.includes('DRY')
                                ? 'bg-cyan-500/10 text-cyan-400'
                                : 'bg-amber-500/10 text-amber-400'
                            }`}
                          >
                            {chk.status}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{chk.details}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsReleaseModalOpen(false)}
                className="px-3 py-1.5 rounded-xl border border-border text-xs text-muted-foreground hover:bg-accent"
              >
                Close
              </button>
              <button
                type="button"
                disabled={releaseMutation.isPending}
                onClick={() =>
                  releaseMutation.mutate({
                    target_remote: 'official',
                    remote_url: 'https://github.com/Aomine-c2c/Neiman.git',
                    source_branch: 'main',
                    target_branch: 'main',
                    tag: releaseTag || undefined,
                    dry_run: releaseDryRun,
                    skip_tests: true,
                  })
                }
                className="px-4 py-1.5 rounded-xl bg-cyan-500 text-black text-xs font-bold hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
              >
                <Rocket className="h-3.5 w-3.5" />
                {releaseMutation.isPending ? 'Simulating Release...' : releaseDryRun ? 'Run Pre-flight Audit' : 'Execute Official Release Push'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 3-COLUMN WORKBENCH TOPOLOGY ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ── LEFT COLUMN: STAGING & COMMIT CONSOLE (4 cols) ── */}
        <div className="lg:col-span-4 space-y-5">
          {/* Working Tree Changes Box */}
          <div className="p-4 rounded-2xl border border-border bg-card space-y-4">
            {/* Staged Section Header */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <Check className="h-4 w-4 text-emerald-400" />
                Staged Changes ({stagedCount})
              </span>
              {stagedCount > 0 && (
                <button
                  onClick={() => unstageMutation.mutate({ unstage_all: true })}
                  disabled={unstageMutation.isPending}
                  className="text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:underline"
                >
                  Unstage All
                </button>
              )}
            </div>

            {/* Staged Files List */}
            {stagedCount === 0 ? (
              <div className="py-4 text-center border border-dashed border-border/60 rounded-xl text-xs text-muted-foreground">
                No files staged for commit.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {statusData?.staged_files.map((file) => (
                  <div
                    key={`staged-${file.path}`}
                    onClick={() => {
                      setSelectedFile(file.path);
                      setSelectedIsStaged(true);
                      setSelectedCommitSha(null);
                    }}
                    className={`flex items-center justify-between p-2 rounded-xl text-xs font-mono cursor-pointer transition-colors border ${
                      selectedFile === file.path && selectedIsStaged
                        ? 'border-primary/50 bg-primary/10'
                        : 'border-transparent hover:bg-accent/60'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        {file.status}
                      </span>
                      <span className="truncate text-foreground text-[11px]">{file.path}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-emerald-400">+{file.additions}</span>
                      <span className="text-[10px] text-rose-400">-{file.deletions}</span>
                      <button
                        title="Unstage file"
                        onClick={(e) => {
                          e.stopPropagation();
                          unstageMutation.mutate({ paths: [file.path] });
                        }}
                        className="p-1 rounded hover:bg-card text-muted-foreground hover:text-foreground"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Unstaged & Untracked Section Header */}
            <div className="pt-2 border-t border-border/60 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <FileCode className="h-4 w-4 text-amber-400" />
                Changes ({unstagedCount})
              </span>
              {unstagedCount > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => stageMutation.mutate({ stage_all: true })}
                    disabled={stageMutation.isPending}
                    className="text-[11px] font-semibold text-primary hover:underline"
                  >
                    Stage All
                  </button>
                  <button
                    onClick={() => discardMutation.mutate({ discard_all: true })}
                    disabled={discardMutation.isPending}
                    className="text-[11px] font-semibold text-rose-400 hover:underline"
                  >
                    Discard All
                  </button>
                </div>
              )}
            </div>

            {/* Unstaged / Untracked List */}
            {unstagedCount === 0 ? (
              <div className="py-4 text-center border border-dashed border-border/60 rounded-xl text-xs text-muted-foreground flex items-center justify-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                Working tree clean.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {/* Unstaged files */}
                {statusData?.unstaged_files.map((file) => (
                  <div
                    key={`unstaged-${file.path}`}
                    onClick={() => {
                      setSelectedFile(file.path);
                      setSelectedIsStaged(false);
                      setSelectedCommitSha(null);
                    }}
                    className={`flex items-center justify-between p-2 rounded-xl text-xs font-mono cursor-pointer transition-colors border ${
                      selectedFile === file.path && !selectedIsStaged && !selectedCommitSha
                        ? 'border-primary/50 bg-primary/10'
                        : 'border-transparent hover:bg-accent/60'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        {file.status}
                      </span>
                      <span className="truncate text-foreground text-[11px]">{file.path}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] text-emerald-400">+{file.additions}</span>
                      <span className="text-[10px] text-rose-400">-{file.deletions}</span>
                      <button
                        title="Stage file"
                        onClick={(e) => {
                          e.stopPropagation();
                          stageMutation.mutate({ paths: [file.path] });
                        }}
                        className="p-1 rounded hover:bg-card text-muted-foreground hover:text-primary"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                      <button
                        title="Discard changes"
                        onClick={(e) => {
                          e.stopPropagation();
                          discardMutation.mutate({ paths: [file.path] });
                        }}
                        className="p-1 rounded hover:bg-card text-muted-foreground hover:text-rose-400"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Untracked files */}
                {statusData?.untracked_files.map((path) => (
                  <div
                    key={`untracked-${path}`}
                    onClick={() => {
                      setSelectedFile(path);
                      setSelectedIsStaged(false);
                      setSelectedCommitSha(null);
                    }}
                    className={`flex items-center justify-between p-2 rounded-xl text-xs font-mono cursor-pointer transition-colors border ${
                      selectedFile === path && !selectedIsStaged && !selectedCommitSha
                        ? 'border-primary/50 bg-primary/10'
                        : 'border-transparent hover:bg-accent/60'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">
                        ??
                      </span>
                      <span className="truncate text-foreground text-[11px]">{path}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        title="Stage untracked file"
                        onClick={(e) => {
                          e.stopPropagation();
                          stageMutation.mutate({ paths: [path] });
                        }}
                        className="p-1 rounded hover:bg-card text-muted-foreground hover:text-primary"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Commit Composer Card */}
          <form onSubmit={handleCommitSubmit} className="p-4 rounded-2xl border border-border bg-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <GitCommit className="h-4 w-4 text-primary" />
                Commit Staged Changes
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">
                {stagedCount} files ready
              </span>
            </div>

            {/* Conventional Commit Type Helpers */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {CONVENTIONAL_TYPES.map((t) => (
                <button
                  key={t.label}
                  type="button"
                  onClick={() => {
                    if (commitMessage.startsWith(t.prefix)) {
                      setCommitMessage(commitMessage.substring(t.prefix.length));
                    } else {
                      // Strip any other conventional prefix
                      const stripped = commitMessage.replace(/^[a-z]+:\s*/, '');
                      setCommitMessage(`${t.prefix}${stripped}`);
                    }
                  }}
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-lg border transition-colors ${
                    commitMessage.startsWith(t.prefix)
                      ? `${t.color} font-bold ring-1 ring-primary`
                      : 'border-border/60 bg-background/50 text-muted-foreground hover:text-foreground'
                  }`}
                  title={t.desc}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Commit Message Textarea */}
            <textarea
              rows={3}
              placeholder="Commit message (e.g., feat(vcs): add atomic staging and unified diff inspector)"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-border bg-background text-xs font-mono resize-none focus:outline-none focus:ring-1 focus:ring-primary"
            />

            {/* Autonomous Agent Co-author Toggle */}
            <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground select-none">
              <input
                type="checkbox"
                checked={includeAgentCoAuthor}
                onChange={(e) => setIncludeAgentCoAuthor(e.target.checked)}
                className="rounded border-border text-primary focus:ring-0"
              />
              <span className="flex items-center gap-1">
                <Bot className="h-3.5 w-3.5 text-cyan-400" />
                Co-authored by NEIMAN Autonomous Agent
              </span>
            </label>

            {/* Commit Action Button */}
            <button
              type="submit"
              disabled={stagedCount === 0 || !commitMessage.trim() || commitMutation.isPending}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:opacity-95 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            >
              <GitCommit className="h-3.5 w-3.5" />
              {commitMutation.isPending
                ? 'Committing...'
                : `Commit to ${statusData?.branch || 'HEAD'}`}
            </button>
          </form>
        </div>

        {/* ── MIDDLE COLUMN: UNIFIED DIFF VIEWER (5 cols) ── */}
        <div className="lg:col-span-5 p-4 rounded-2xl border border-border bg-card space-y-3 font-mono">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-2 truncate">
              <FileDiff className="h-4 w-4 text-cyan-400 shrink-0" />
              <div className="truncate">
                <span className="text-xs font-bold text-foreground truncate block">
                  {selectedCommitSha
                    ? `Commit Diff: ${selectedCommitSha.substring(0, 7)}`
                    : selectedFile || 'Working Tree Diff'}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {selectedIsStaged ? 'Index (Staged)' : selectedCommitSha ? 'Commit Snapshot' : 'Working Directory'}
                </span>
              </div>
            </div>

            {diffData && (
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                  +{diffData.additions}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold">
                  -{diffData.deletions}
                </span>
              </div>
            )}
          </div>

          {/* Diff Content Box */}
          {isDiffLoading ? (
            <div className="py-24 text-center text-xs text-muted-foreground animate-pulse">
              Generating unified diff telemetry...
            </div>
          ) : !diffData || !diffData.diff.trim() ? (
            <div className="py-24 text-center text-xs text-muted-foreground border border-dashed border-border/60 rounded-xl space-y-1">
              <div>No changes to display in selected scope.</div>
              <div className="text-[10px] text-muted-foreground/80">
                Select a modified file on the left or a commit on the right.
              </div>
            </div>
          ) : (
            <div className="max-h-[580px] overflow-x-auto overflow-y-auto rounded-xl bg-background/80 border border-border/60 p-3 text-[11px] leading-relaxed font-mono">
              <pre className="m-0">
                {diffLines.map((line, idx) => {
                  let lineClass = 'text-muted-foreground/80';
                  if (line.startsWith('@@')) {
                    lineClass = 'text-cyan-400 font-bold bg-cyan-500/10 px-1 rounded block';
                  } else if (line.startsWith('+') && !line.startsWith('+++')) {
                    lineClass = 'text-emerald-400 bg-emerald-500/10 px-1 rounded block';
                  } else if (line.startsWith('-') && !line.startsWith('---')) {
                    lineClass = 'text-rose-400 bg-rose-500/10 px-1 rounded block';
                  } else if (line.startsWith('diff --git') || line.startsWith('index ')) {
                    lineClass = 'text-amber-400 font-bold block pt-2';
                  }
                  return (
                    <span key={idx} className={lineClass}>
                      {line}
                    </span>
                  );
                })}
              </pre>
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN: COMMIT GRAPH, STASHES & CONFLICTS (3 cols) ── */}
        <div className="lg:col-span-3 space-y-4">
          {/* Tabs Selector */}
          <div className="flex rounded-xl border border-border bg-card p-1 text-xs font-semibold">
            <button
              onClick={() => setRightTab('log')}
              className={`flex-1 py-1.5 rounded-lg transition-colors text-center ${
                rightTab === 'log' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Commit Log
            </button>
            <button
              onClick={() => setRightTab('stashes')}
              className={`flex-1 py-1.5 rounded-lg transition-colors text-center relative ${
                rightTab === 'stashes' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Stashes
              {(stashData?.total ?? 0) > 0 && (
                <span className="ml-1 px-1 rounded-full bg-cyan-400/20 text-cyan-300 text-[9px] font-mono">
                  {stashData?.total}
                </span>
              )}
            </button>
            <button
              onClick={() => setRightTab('conflicts')}
              className={`flex-1 py-1.5 rounded-lg transition-colors text-center ${
                rightTab === 'conflicts' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Conflicts
              {conflictData?.has_conflicts && (
                <span className="ml-1 text-amber-400">●</span>
              )}
            </button>
          </div>

          {/* TAB 1: COMMIT LOG & DAG */}
          {rightTab === 'log' && (
            <div className="p-4 rounded-2xl border border-border bg-card space-y-3 font-mono">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <GitFork className="h-4 w-4 text-cyan-400" />
                  Commit Graph ({logData?.total_commits || 0})
                </span>
              </div>

              {isLogLoading ? (
                <div className="py-12 text-center text-xs text-muted-foreground animate-pulse">
                  Loading commit history...
                </div>
              ) : !logData?.commits.length ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No commits recorded on this branch.
                </div>
              ) : (
                <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1">
                  {logData.commits.map((commit) => (
                    <div
                      key={commit.sha}
                      onClick={() => {
                        setSelectedCommitSha(commit.sha);
                        setSelectedFile(null);
                      }}
                      className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                        selectedCommitSha === commit.sha
                          ? 'border-primary bg-primary/10'
                          : 'border-border/60 hover:bg-accent/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-cyan-400 font-bold">{commit.graph_symbol}</span>
                          <span className="font-bold text-foreground truncate max-w-[150px]">
                            {commit.message}
                          </span>
                        </div>
                        <button
                          title="Copy SHA"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopySha(commit.sha);
                          }}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-background border border-border text-muted-foreground hover:text-foreground shrink-0 flex items-center gap-1"
                        >
                          {copiedSha === commit.sha ? <Check className="h-2.5 w-2.5 text-emerald-400" /> : <Copy className="h-2.5 w-2.5" />}
                          {commit.short_sha}
                        </button>
                      </div>

                      <div className="flex items-center justify-between mt-1 text-[10px] text-muted-foreground">
                        <span className="truncate">{commit.author}</span>
                        <span>{commit.date.split(' ')[0]}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: STASHES */}
          {rightTab === 'stashes' && (
            <div className="p-4 rounded-2xl border border-border bg-card space-y-3 font-mono">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-amber-400" />
                Git Stashes ({stashData?.total || 0})
              </span>

              {/* Create Stash Form */}
              <div className="space-y-2 pt-1 border-t border-border/60">
                <input
                  type="text"
                  placeholder="Stash label (optional)"
                  value={stashMessage}
                  onChange={(e) => setStashMessage(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-border bg-background text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  type="button"
                  disabled={createStashMutation.isPending}
                  onClick={() => createStashMutation.mutate(stashMessage)}
                  className="w-full py-1.5 rounded-xl border border-border bg-card hover:bg-accent text-xs font-semibold text-foreground transition-colors"
                >
                  {createStashMutation.isPending ? 'Stashing...' : 'Push Working Tree to Stash'}
                </button>
              </div>

              {/* Stashes List */}
              {isStashesLoading ? (
                <div className="py-8 text-center text-xs text-muted-foreground animate-pulse">
                  Querying stashes...
                </div>
              ) : !stashData?.stashes.length ? (
                <div className="py-8 text-center text-xs text-muted-foreground border border-dashed border-border/60 rounded-xl">
                  No stashes saved.
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {stashData.stashes.map((stash) => (
                    <div
                      key={stash.selector}
                      className="p-2.5 rounded-xl border border-border/60 bg-background/50 space-y-1.5 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-foreground text-[11px] truncate">
                          {stash.selector}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{stash.date.split(' ')[0]}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">{stash.message}</p>
                      <div className="flex items-center justify-end gap-1.5 pt-1">
                        <button
                          onClick={() => popStashMutation.mutate(stash.index)}
                          className="text-[10px] font-semibold px-2 py-0.5 rounded bg-primary text-primary-foreground hover:opacity-90"
                        >
                          Pop
                        </button>
                        <button
                          onClick={() => dropStashMutation.mutate(stash.index)}
                          className="text-[10px] font-semibold px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20"
                        >
                          Drop
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CONFLICT GUARD */}
          {rightTab === 'conflicts' && (
            <div className="p-4 rounded-2xl border border-border bg-card space-y-3 font-mono">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-rose-400" />
                Merge Conflict Guard
              </span>

              {conflictData?.has_conflicts ? (
                <div className="space-y-2">
                  <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                    ⚠️ {conflictData.conflicted_files.length} conflicted file(s) require resolution before commit!
                  </div>
                  {conflictData.conflicted_files.map((file) => (
                    <div
                      key={file.path}
                      className="p-2 rounded-xl border border-border bg-background/60 text-xs flex items-center justify-between"
                    >
                      <span className="truncate text-[11px]">{file.path}</span>
                      <span className="text-[10px] font-bold text-rose-400">
                        {file.conflict_markers_count} markers
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-muted-foreground border border-dashed border-border/60 rounded-xl space-y-1">
                  <ShieldCheck className="h-5 w-5 text-emerald-400 mx-auto" />
                  <div className="text-foreground font-semibold">Zero Merge Conflicts</div>
                  <div className="text-[10px]">Index and working tree conflict-free.</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
