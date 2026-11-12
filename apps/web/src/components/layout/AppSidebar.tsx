'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MessageSquare,
  Scale,
  GitBranch,
  PanelLeftClose,
  PanelLeftOpen,
  FolderGit2,
  Plus,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Trash2,
  X,
  Check,
  FolderOpen,
  Globe,
  RefreshCw,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { NeimanLogo } from '@/components/ui/NeimanLogo';
import { AgentAvatar } from '@/components/ui/AgentAvatar';
import { FileTreeExplorer } from '@/components/explorer/FileTreeExplorer';
import { AgentContributionGraph } from './AgentContributionGraph';
import { vcsApi, type GitStatusResponse, type DiscoveredWorkspaceItem } from '@/lib/api/vcs';

export interface SidebarThreadSummary {
  id: string;
  title: string;
  kind: 'CTO' | 'COUNCIL' | 'AGENT';
  status?: string;
  createdAt?: string;
}

export interface SidebarSquadMember {
  id: string;
  name: string;
  roleTitle: string;
  status: string;
  model?: string;
  activeTaskTitle?: string;
}

export interface AppSidebarProps {
  pendingApprovalsCount?: number;
  activeAgentsCount?: number;
  activeTasksCount?: number;
  threads?: SidebarThreadSummary[];
  squadMembers?: SidebarSquadMember[];
  activeThreadId?: string | null;
  onSelectThread?: (threadId: string) => void;
  onNewThread?: () => void;
  onMentionAgent?: (agent: SidebarSquadMember) => void;
  onOpenDrawer?: (drawerId: string, entityId?: string) => void;
  onOpenApprovals?: () => void;
  onOpenRepoSetup?: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

const SIDEBAR_STORAGE_KEY = 'neiman_sidebar_collapsed';
const ARCHIVED_THREADS_KEY_PREFIX = 'neiman_archived_threads_';

const DEFAULT_SQUAD_ROSTER: SidebarSquadMember[] = [
  { id: 'cto', name: 'Chief Technology Agent', roleTitle: 'CTO', status: 'WORKING' },
  { id: 'architect', name: 'Systems Architect Agent', roleTitle: 'Architect', status: 'AVAILABLE' },
  { id: 'security', name: 'Cybersecurity Agent', roleTitle: 'Security', status: 'AVAILABLE' },
  { id: 'backend', name: 'Backend Engineering Agent', roleTitle: 'Backend', status: 'WORKING' },
  { id: 'qa', name: 'Quality Assurance Agent', roleTitle: 'QA Lead', status: 'AVAILABLE' },
];

export function AppSidebar({
  pendingApprovalsCount = 0,
  activeAgentsCount = 0,
  activeTasksCount = 0,
  threads = [],
  squadMembers,
  activeThreadId = null,
  onSelectThread,
  onNewThread,
  onMentionAgent,
  onOpenDrawer,
  onOpenApprovals,
  onOpenRepoSetup,
  mobileOpen = false,
  onMobileClose,
}: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { activeCompany } = useAuthStore();
  const companyId = activeCompany?.id || '';
  const [collapsed, setCollapsed] = useState(false);
  const [threadsExpanded, setThreadsExpanded] = useState(true);
  const [explorerExpanded, setExplorerExpanded] = useState(true);
  const [archivedThreadIds, setArchivedThreadIds] = useState<string[]>([]);
  const [selectedHeatmapDate, setSelectedHeatmapDate] = useState<string | null>(null);
  const [repoPopoverOpen, setRepoPopoverOpen] = useState(false);
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [connectMode, setConnectMode] = useState<'local' | 'clone'>('local');
  const [localPathInput, setLocalPathInput] = useState('');
  const [gitUrlInput, setGitUrlInput] = useState('');
  const [branchInput, setBranchInput] = useState('main');
  const [initGitIfMissing, setInitGitIfMissing] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const queryClient = useQueryClient();

  // Fetch live Git VCS Status for Code Explorer
  const { data: gitStatus, isError: gitStatusError, refetch: refetchGitStatus } = useQuery({
    queryKey: ['vcs-status', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      return vcsApi.getStatus(companyId);
    },
    enabled: !!companyId && !collapsed,
    refetchInterval: 10000,
    retry: 1,
  });

  // Fetch discovered local project repositories & branches when switcher/modal opens
  const { data: workspacesData, isLoading: workspacesLoading } = useQuery({
    queryKey: ['vcs-workspaces', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      return vcsApi.listWorkspaces(companyId);
    },
    enabled: !!companyId && (repoPopoverOpen || connectModalOpen),
    retry: 1,
  });

  const { data: branchesData } = useQuery({
    queryKey: ['vcs-branches', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      return vcsApi.getBranches(companyId);
    },
    enabled: !!companyId && repoPopoverOpen,
    retry: 1,
  });

  const invalidateWorkspaceQueries = () => {
    if (!queryClient) return;
    queryClient.invalidateQueries({ queryKey: ['vcs-status', companyId] });
    queryClient.invalidateQueries({ queryKey: ['vcs-workspaces', companyId] });
    queryClient.invalidateQueries({ queryKey: ['vcs-tree', companyId] });
    queryClient.invalidateQueries({ queryKey: ['vcs-branches', companyId] });
    queryClient.invalidateQueries({ queryKey: ['vcs-log', companyId] });
    queryClient.invalidateQueries({ queryKey: ['shell-badge-telemetry', companyId] });
  };

  const connectWorkspaceMutation = useMutation({
    mutationFn: async (payload: {
      path?: string;
      git_url?: string;
      branch?: string;
      init_git_if_missing?: boolean;
    }) => {
      return vcsApi.connectWorkspace(companyId, payload);
    },
    onSuccess: (newStatus) => {
      setConnectError(null);
      setConnectModalOpen(false);
      setRepoPopoverOpen(false);
      invalidateWorkspaceQueries();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('neiman:workspace-switched', {
            detail: { repoName: newStatus.repo_name, repoPath: newStatus.repo_path, branch: newStatus.branch },
          })
        );
      }
    },
    onError: (err: unknown) => {
      setConnectError(err instanceof Error ? err.message : 'Failed to connect project workspace.');
    },
  });

  const checkoutBranchMutation = useMutation({
    mutationFn: async (branchName: string) => {
      return vcsApi.checkoutBranch(companyId, { branch_name: branchName, create_if_missing: false });
    },
    onSuccess: () => {
      invalidateWorkspaceQueries();
    },
  });

  useEffect(() => {
    if ( typeof window === 'undefined' ) return;
    const handleOpenConnectModal = () => {
      setConnectError(null);
      setLocalPathInput(gitStatus?.repo_path || '');
      setBranchInput(gitStatus?.branch || 'main');
      setConnectModalOpen(true);
    };
    window.addEventListener('neiman:open-repo-connect', handleOpenConnectModal);
    return () => window.removeEventListener('neiman:open-repo-connect', handleOpenConnectModal);
  }, [gitStatus?.repo_path, gitStatus?.branch]);

  useEffect(() => {
    if (!companyId) return;
    try {
      const raw = localStorage.getItem(`${ARCHIVED_THREADS_KEY_PREFIX}${companyId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setArchivedThreadIds(parsed.filter((v): v is string => typeof v === 'string'));
      }
    } catch {
      // ignore storage errors
    }
  }, [companyId]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (connectModalOpen) {
        setConnectModalOpen(false);
        return;
      }
      if (repoPopoverOpen) {
        setRepoPopoverOpen(false);
        return;
      }
      if (mobileOpen && onMobileClose) {
        onMobileClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [connectModalOpen, repoPopoverOpen, mobileOpen, onMobileClose]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (saved === 'true') {
        setCollapsed(true);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const handleToggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const triggerDrawer = (drawerId: string, entityId?: string) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('neiman:dock-view', { detail: { view: drawerId.toUpperCase(), entityId } })
      );
    }
    if (onOpenDrawer) {
      onOpenDrawer(drawerId, entityId);
      return;
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('neiman:open-drawer', { detail: { drawerId, entityId } })
      );
    }
  };

  const handleNewChatClick = () => {
    if (onNewThread) {
      onNewThread();
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('neiman:new-chat-thread'));
    }
    if (pathname !== '/dashboard' && pathname !== '/dashboard/councils') {
      router.push('/dashboard');
    }
  };

  const handleThreadClick = (threadId: string) => {
    if (onSelectThread) {
      onSelectThread(threadId);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('neiman:select-thread', { detail: { threadId } })
      );
    }
    if (pathname !== '/dashboard' && pathname !== '/dashboard/councils') {
      router.push(`/dashboard?thread=${encodeURIComponent(threadId)}`);
    } else {
      router.push(`${pathname}?thread=${encodeURIComponent(threadId)}`, { scroll: false });
    }
  };

  const handleAgentClick = (agent: SidebarSquadMember) => {
    if (onMentionAgent) {
      onMentionAgent(agent);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('neiman:mention-agent', { detail: { agent } })
      );
    }
    if (pathname !== '/dashboard' && pathname !== '/dashboard/councils') {
      router.push('/dashboard');
    }
  };

  const handleInsertFileContext = (filePath: string, snippet?: string) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('neiman:insert-chat-context', {
          detail: { filePath, snippet },
        })
      );
    }
  };

  const resolvedSquad =
    squadMembers !== undefined ? squadMembers : DEFAULT_SQUAD_ROSTER;

  const visibleThreads = threads.filter((t) => {
    if (archivedThreadIds.includes(t.id)) return false;
    if (selectedHeatmapDate && t.createdAt) {
      return t.createdAt.slice(0, 10) === selectedHeatmapDate;
    }
    return true;
  });

  const dirtyCount =
    (gitStatus?.staged_files?.length || 0) +
    (gitStatus?.unstaged_files?.length || 0) +
    (gitStatus?.untracked_files?.length || 0);
  const resolvedRepoPath =
    gitStatus?.repo_path ||
    workspacesData?.active_repo_path ||
    '';
  const repoDisplayName =
    gitStatus?.repo_name ||
    workspacesData?.active_repo_name ||
    resolvedRepoPath.split('/').filter(Boolean).pop() ||
    activeCompany?.name ||
    'Workspace';
  const repoBranchLabel = gitStatus?.branch || workspacesData?.active_branch || 'main';
  const shortRepoPath = resolvedRepoPath
    ? resolvedRepoPath.replace(/^\/home\/[^/]+/, '~')
    : 'No local path';
  const repoSyncSubtitle = `git: ${repoBranchLabel} • ${
    dirtyCount > 0 ? `${dirtyCount} dirty` : 'synced'
  }${gitStatus && gitStatus.ahead > 0 ? ` ↑${gitStatus.ahead}` : ''}${
    gitStatus && gitStatus.behind > 0 ? ` ↓${gitStatus.behind}` : ''
  }`;

  const handleOpenConnectDialog = () => {
    setConnectError(null);
    setLocalPathInput(resolvedRepoPath);
    setBranchInput(repoBranchLabel);
    setRepoPopoverOpen(false);
    setConnectModalOpen(true);
  };

  const handleConnectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setConnectError(null);
    if (connectMode === 'local') {
      if (!localPathInput.trim()) {
        setConnectError('Enter a local project directory path.');
        return;
      }
      connectWorkspaceMutation.mutate({
        path: localPathInput.trim(),
        branch: branchInput.trim() || undefined,
        init_git_if_missing: initGitIfMissing,
      });
    } else {
      if (!gitUrlInput.trim()) {
        setConnectError('Enter a remote Git repository URL.');
        return;
      }
      connectWorkspaceMutation.mutate({
        git_url: gitUrlInput.trim(),
        path: localPathInput.trim() || undefined,
        branch: branchInput.trim() || undefined,
      });
    }
  };

  const handleArchiveThread = (e: React.MouseEvent, threadId: string) => {
    e.stopPropagation();
    setArchivedThreadIds((prev) => {
      const next = prev.includes(threadId) ? prev : [...prev, threadId];
      if (companyId) {
        try {
          localStorage.setItem(`${ARCHIVED_THREADS_KEY_PREFIX}${companyId}`, JSON.stringify(next));
        } catch {
          // ignore storage errors
        }
      }
      return next;
    });
    if (activeThreadId === threadId) {
      handleNewChatClick();
    }
  };

  return (
    <>
      {mobileOpen && onMobileClose && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[1px] md:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}
      <aside
        aria-label="Primary Workspace Navigation"
        className={`NEIMAN-sidebar flex-col shrink-0 h-screen select-none transition-all duration-150 border-r border-border bg-card ${
          mobileOpen
            ? 'fixed inset-y-0 left-0 z-50 flex w-72 shadow-xl md:static md:shadow-none'
            : 'hidden md:flex'
        } ${
          collapsed ? 'md:w-14' : 'md:w-72 xl:w-[300px] 2xl:w-[320px]'
        }`}
      >
      {/* Top Brand & Collapse Toggle */}
      <div className="h-12 flex items-center justify-between px-3 border-b border-border shrink-0">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 min-w-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          title="NEIMAN Chat-First Command Room"
        >
          <NeimanLogo size="xs" showWordmark={!collapsed} withGlow={false} />
        </Link>
        <div className="flex items-center gap-1 shrink-0">
          {mobileOpen && onMobileClose && (
            <button
              type="button"
              onClick={onMobileClose}
              aria-label="Close navigation drawer"
              className="md:hidden min-h-7 min-w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={handleToggleCollapse}
            aria-label="Toggle sidebar collapse"
            aria-expanded={!collapsed}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden md:flex min-h-7 min-w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Connected Project & Repository Switcher Card */}
      <div className="relative p-2.5 border-b border-border/70 shrink-0">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              if (collapsed) {
                triggerDrawer('git');
              } else {
                setRepoPopoverOpen((v) => !v);
              }
            }}
            aria-label="Switch or Inspect Connected Repository"
            aria-expanded={repoPopoverOpen}
            title={`Connected Repo: ${resolvedRepoPath} (Click to switch project or branch)`}
            className={`flex-1 flex items-center gap-2.5 rounded-lg border transition-colors text-left min-w-0 ${
              repoPopoverOpen
                ? 'border-primary/50 bg-secondary/80'
                : 'border-border/80 bg-secondary/40 hover:bg-secondary/80 hover:border-primary/30'
            } ${collapsed ? 'justify-center p-2' : 'px-2.5 py-2'}`}
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-secondary text-foreground border border-border">
              <FolderGit2 className="h-4 w-4 text-primary" />
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 min-w-0 truncate">
                    <p
                      className="text-xs font-semibold text-foreground truncate"
                      title={resolvedRepoPath}
                    >
                      {repoDisplayName}
                    </p>
                    <span
                      className="text-[11px] font-mono px-1 py-0.5 rounded bg-secondary text-muted-foreground border border-border/60 truncate max-w-[115px]"
                      title={resolvedRepoPath}
                    >
                      {shortRepoPath}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span
                      className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                        dirtyCount > 0 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      title={dirtyCount > 0 ? `${dirtyCount} uncommitted changes` : 'Working tree clean'}
                    />
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  </div>
                </div>
                <p
                  className="text-[11px] font-mono text-muted-foreground truncate tabular-nums"
                  title={resolvedRepoPath}
                >
                  {repoSyncSubtitle}
                </p>
              </div>
            )}
          </button>

          {!collapsed && (
            <button
              type="button"
              onClick={handleOpenConnectDialog}
              aria-label="Connect or Switch Project Repository"
              title="Connect local project folder or clone Git repository"
              className="p-2 rounded-lg border border-border/80 bg-secondary/30 text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-secondary/70 transition-colors shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Interactive Project & Branch Switcher Popover */}
        {repoPopoverOpen && !collapsed && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setRepoPopoverOpen(false)}
              aria-hidden="true"
            />
            <div
              role="dialog"
              aria-label="Project and Repository Switcher"
              className="absolute left-2.5 right-2.5 top-full mt-1 z-50 rounded-xl border border-border bg-card shadow-2xl p-2.5 space-y-2.5 text-xs"
            >
              {/* Active Project Summary */}
              <div className="rounded-lg border border-border/70 bg-secondary/30 p-2 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    Connected Workspace
                  </span>
                  <span className="text-[10px] font-mono text-emerald-500 font-semibold">
                    ACTIVE
                  </span>
                </div>
                <p className="font-semibold text-foreground truncate">{repoDisplayName}</p>
                <p className="text-[10px] font-mono text-muted-foreground break-all">
                  {resolvedRepoPath}
                </p>
              </div>

              {/* Quick Branch Switcher */}
              {branchesData && branchesData.branches && branchesData.branches.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-1">
                    Active Git Branch
                  </span>
                  <div className="max-h-28 overflow-y-auto space-y-0.5 pr-0.5">
                    {branchesData.branches
                      .filter((b) => !b.is_remote)
                      .map((b) => (
                        <button
                          key={b.name}
                          type="button"
                          disabled={checkoutBranchMutation.isPending}
                          onClick={() => checkoutBranchMutation.mutate(b.name)}
                          className={`w-full flex items-center justify-between gap-2 rounded-md px-2 py-1 text-[11px] font-mono transition-colors ${
                            b.name === repoBranchLabel
                              ? 'bg-primary/15 text-primary font-semibold'
                              : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                          }`}
                        >
                          <span className="flex items-center gap-1.5 truncate">
                            <GitBranch className="h-3 w-3 shrink-0" />
                            <span className="truncate">{b.name}</span>
                          </span>
                          {b.name === repoBranchLabel && <Check className="h-3 w-3 shrink-0" />}
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {/* Discovered Local Projects in ~/Projects */}
              <div className="space-y-1">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    Local Projects on Disk
                  </span>
                  {workspacesLoading && (
                    <RefreshCw className="h-2.5 w-2.5 animate-spin text-muted-foreground" />
                  )}
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1 pr-0.5">
                  {(workspacesData?.discovered_workspaces || []).map((ws: DiscoveredWorkspaceItem) => {
                    const isCurrent = ws.path === resolvedRepoPath;
                    return (
                      <button
                        key={ws.path}
                        type="button"
                        disabled={connectWorkspaceMutation.isPending}
                        onClick={() =>
                          connectWorkspaceMutation.mutate({
                            path: ws.path,
                            init_git_if_missing: true,
                          })
                        }
                        className={`w-full flex items-center justify-between gap-2 rounded-lg border px-2 py-1.5 text-left transition-colors ${
                          isCurrent
                            ? 'border-primary/40 bg-primary/10 text-foreground'
                            : 'border-border/60 bg-secondary/20 hover:bg-secondary/70 text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <FolderOpen className="h-3 w-3 shrink-0 text-primary" />
                            <span className="font-semibold text-[11px] text-foreground truncate">
                              {ws.name}
                            </span>
                            {ws.branch && (
                              <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-secondary text-muted-foreground border border-border/50">
                                {ws.branch}
                              </span>
                            )}
                          </div>
                          <p className="text-[9px] font-mono text-muted-foreground truncate mt-0.5">
                            {ws.path}
                          </p>
                        </div>
                        {isCurrent ? (
                          <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                        ) : (
                          <span className="text-[9px] font-mono text-primary shrink-0">Switch</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-border/70">
                <button
                  type="button"
                  onClick={handleOpenConnectDialog}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
                >
                  <Plus className="h-3 w-3" />
                  <span>Connect Path / URL…</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRepoPopoverOpen(false);
                    triggerDrawer('git');
                  }}
                  className="inline-flex items-center justify-center gap-1 rounded-lg border border-border bg-secondary/50 hover:bg-secondary px-2.5 py-1.5 text-[11px] font-mono text-foreground transition-colors"
                >
                  <GitBranch className="h-3 w-3" />
                  <span>Git VCS</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── 3 VERTICALLY STAGGERED PANELS (Column 1) ── */}
      {collapsed ? (
        // Collapsed Slim View: Icons for quick access
        <div className="flex-1 overflow-y-auto px-1 py-2 space-y-3">
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={handleNewChatClick}
              title="CTO Chat Thread"
              className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              <MessageSquare className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => triggerDrawer('git')}
              title="Git VCS Working Tree"
              className="p-2 rounded-lg bg-secondary text-foreground hover:bg-secondary/80 transition-colors"
            >
              <GitBranch className="h-4 w-4" />
            </button>
            <AgentContributionGraph companyId={companyId} collapsed={true} />
          </div>
          <div className="flex flex-col items-center gap-2 pt-2 border-t border-border/50">
            {resolvedSquad.slice(0, 4).map((agent) => (
              <button
                key={agent.id}
                type="button"
                onClick={() => handleAgentClick(agent)}
                title={`Message @${agent.name}`}
                className="relative"
              >
                <AgentAvatar name={agent.name} roleTitle={agent.roleTitle} size={22} showStatus={false} />
              </button>
            ))}
          </div>
        </div>
      ) : (
        // Expanded Staggered Panels on top of each other (single flex stack, no nested outer scrollbar)
        <div className="flex-1 min-h-0 flex flex-col divide-y divide-border overflow-hidden">
          {/* PANEL 1 [Top]: Agent Contribution Graph (Compact 1-Line Sparkline by default, expandable) */}
          <AgentContributionGraph
            companyId={companyId}
            selectedDate={selectedHeatmapDate}
            onSelectDate={setSelectedHeatmapDate}
          />

          {/* PANEL 2: Conversation Threads & Live Squad Roster */}
          <div
            className={`flex flex-col overflow-hidden bg-card transition-all ${
              threadsExpanded ? (explorerExpanded ? 'max-h-72 shrink-0' : 'flex-1 min-h-0') : 'shrink-0'
            }`}
          >
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/70 bg-secondary/20 shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
                  CTO &amp; Council Threads
                </span>
                {selectedHeatmapDate && (
                  <button
                    type="button"
                    onClick={() => setSelectedHeatmapDate(null)}
                    className="inline-flex items-center gap-0.5 min-h-6 px-1.5 rounded bg-primary/10 text-primary border border-primary/20 text-[10px] font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    title="Clear date filter"
                  >
                    <span>{selectedHeatmapDate.slice(5)}</span>
                    <X className="h-2.5 w-2.5" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
                  {visibleThreads.length > 0 ? visibleThreads.length : 1}
                </span>
                <button
                  type="button"
                  onClick={() => setThreadsExpanded((v) => !v)}
                  aria-label={threadsExpanded ? 'Collapse threads and squad' : 'Expand threads and squad'}
                  className="min-h-6 min-w-6 flex items-center justify-center rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {threadsExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            {threadsExpanded && (
              <div className="flex-1 min-h-0 overflow-y-auto px-2 py-1.5 space-y-2">
                {/* Active Threads */}
                <div className="space-y-0.5">
                  {visibleThreads.length === 0 ? (
                    <button
                      type="button"
                      onClick={handleNewChatClick}
                      className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium bg-primary/10 text-primary transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      title="Direct CTO Architecture Thread"
                    >
                      <MessageSquare className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-[11px]">Direct CTO &amp; Squad Chat</p>
                        <p className="text-[10px] font-mono text-primary truncate">Live Command Room</p>
                      </div>
                    </button>
                  ) : (
                    visibleThreads.map((thr) => {
                      const isSelected = activeThreadId === thr.id;
                      const isDeliberating =
                        thr.status === 'DELIBERATING' || thr.status === 'IN_PROGRESS' || thr.status === 'ACTIVE';
                      return (
                        <div
                          key={thr.id}
                          className={`group flex items-center justify-between gap-1.5 rounded-lg px-2 py-1 text-xs transition-colors ${
                            isSelected
                              ? 'bg-primary/10 text-primary font-semibold'
                              : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handleThreadClick(thr.id)}
                            title={thr.title}
                            className="flex items-center gap-1.5 min-w-0 flex-1 text-left rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {thr.kind === 'COUNCIL' ? (
                              <Scale className="h-3 w-3 shrink-0 text-primary" />
                            ) : (
                              <MessageSquare className="h-3 w-3 shrink-0" />
                            )}
                            <span className="truncate text-[11px]">{thr.title}</span>
                          </button>
                          <div className="flex items-center gap-1 shrink-0">
                            {isDeliberating && (
                              <span
                                className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0"
                                title={`Status: ${thr.status}`}
                              />
                            )}
                            {thr.status && (
                              <span className="text-[11px] font-mono px-1 py-0.5 rounded bg-secondary text-foreground/80 shrink-0">
                                {thr.status}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => handleArchiveThread(e, thr.id)}
                              aria-label={`Archive thread ${thr.title}`}
                              title="Archive thread"
                              className="min-h-6 min-w-6 flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 rounded hover:bg-secondary text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Squad Roster */}
                <div className="space-y-0.5 pt-1.5 border-t border-border/50">
                  <div className="flex items-center justify-between px-1.5 pb-1 gap-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
                      Squad (Agents)
                    </span>
                    <button
                      type="button"
                      onClick={() => triggerDrawer('agents')}
                      className="inline-flex items-center gap-1 min-h-6 px-1 rounded text-[11px] font-mono text-primary hover:underline shrink-0 tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span>{activeAgentsCount || resolvedSquad.length} online</span>
                      <ExternalLink className="h-2.5 w-2.5" />
                    </button>
                  </div>

                  {resolvedSquad.length === 0 ? (
                    <div className="px-2 py-2 text-[11px] text-muted-foreground">
                      No active agents in workspace.
                    </div>
                  ) : resolvedSquad.map((agent) => {
                    const isWorking = agent.status === 'WORKING' || agent.status === 'ACTIVE';
                    const displayName = agent.name.split(' · ')[0].trim();
                    return (
                      <div
                        key={agent.id}
                        className="group relative flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-xs hover:bg-secondary/70 transition-colors"
                      >
                        <button
                          type="button"
                          onClick={() => handleAgentClick(agent)}
                          title={`Message @${agent.name} (${agent.roleTitle}) in Chat`}
                          className="flex items-center gap-1.5 min-w-0 flex-1 text-left rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <div className="relative shrink-0">
                            <AgentAvatar name={agent.name} roleTitle={agent.roleTitle} size={20} showStatus={false} />
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full ring-1 ring-background ${
                                isWorking ? 'bg-emerald-500' : 'bg-muted-foreground/60'
                              }`}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-medium text-foreground truncate group-hover:text-primary transition-colors">
                              {displayName}
                            </p>
                            <div className="flex items-center gap-1 min-w-0">
                              <span className="text-[11px] font-mono text-muted-foreground truncate">
                                @{agent.roleTitle}
                              </span>
                              {agent.model && (
                                <span className="text-[10px] font-mono px-1 py-0 rounded bg-secondary text-foreground/80 border border-border/50 truncate max-w-[110px] shrink-0">
                                  {agent.model}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => triggerDrawer('agents', agent.id)}
                          aria-label={`Inspect ${agent.name}`}
                          className="hidden group-hover:inline-flex group-focus-within:inline-flex focus-visible:inline-flex [@media(hover:none)]:inline-flex items-center min-h-6 px-1.5 rounded text-[11px] font-mono text-muted-foreground hover:text-foreground bg-card/90 border border-border/60 shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                        >
                          Profile
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* PANEL 3: Monorepo Code Explorer (Expanded to fill remaining vertical height) */}
          <div className={`${explorerExpanded ? 'flex-1 min-h-0' : 'shrink-0'} flex flex-col overflow-hidden bg-card`}>
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/70 bg-secondary/20 shrink-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <FolderGit2 className="h-3.5 w-3.5 text-foreground shrink-0" />
                <span className="text-[11px] font-bold text-foreground uppercase tracking-wider truncate">
                  Code Explorer
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-secondary text-foreground border border-border shrink-0">
                  Monorepo
                </span>
                <button
                  type="button"
                  onClick={() => setExplorerExpanded((v) => !v)}
                  aria-label={explorerExpanded ? 'Collapse code explorer' : 'Expand code explorer'}
                  className="min-h-6 min-w-6 flex items-center justify-center rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {explorerExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            {explorerExpanded && gitStatusError && (
              <div className="px-3 py-1.5 border-b border-rose-500/30 bg-rose-500/10 flex items-center justify-between text-[11px] font-mono text-rose-700 dark:text-rose-300">
                <span>Git status unavailable</span>
                <button
                  type="button"
                  onClick={() => refetchGitStatus()}
                  className="underline hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                >
                  Retry
                </button>
              </div>
            )}

            {explorerExpanded && (
              <div className="flex-1 min-h-0 overflow-hidden">
                <FileTreeExplorer
                  companyId={companyId}
                  gitStatus={gitStatus}
                  onInsertToChat={handleInsertFileContext}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dedicated Connect / Switch Project Repository Modal */}
      {connectModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Connect Project or Git Repository"
        >
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl overflow-hidden text-xs">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/20">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary border border-primary/30">
                  <FolderGit2 className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-foreground">
                    Connect Project / Repository
                  </h2>
                  <p className="text-[11px] text-muted-foreground">
                    Bind a local project directory or clone a Git repository into the Command Deck
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConnectModalOpen(false)}
                aria-label="Close modal"
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="flex border-b border-border bg-secondary/10 px-4 pt-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setConnectMode('local');
                  setConnectError(null);
                }}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-colors ${
                  connectMode === 'local'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <FolderOpen className="h-3.5 w-3.5" />
                <span>Local Project Folder</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setConnectMode('clone');
                  setConnectError(null);
                }}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-colors ${
                  connectMode === 'clone'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Globe className="h-3.5 w-3.5" />
                <span>Clone Remote Git URL</span>
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleConnectSubmit} className="p-4 space-y-3.5">
              {connectMode === 'local' ? (
                <>
                  {/* Discovered Local Projects Quick-Pick */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        Discovered Projects on Disk (Click to select)
                      </label>
                      {workspacesLoading && (
                        <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto">
                      {(workspacesData?.discovered_workspaces || []).map((ws: DiscoveredWorkspaceItem) => {
                        const isSelected = localPathInput.trim() === ws.path;
                        return (
                          <button
                            key={ws.path}
                            type="button"
                            onClick={() => {
                              setLocalPathInput(ws.path);
                              if (ws.branch) setBranchInput(ws.branch);
                            }}
                            className={`flex items-center justify-between gap-2 rounded-lg border p-2 text-left transition-colors ${
                              isSelected
                                ? 'border-primary bg-primary/10 text-foreground'
                                : 'border-border/70 bg-secondary/30 hover:bg-secondary/70 text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <FolderGit2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                                <span className="font-semibold text-xs text-foreground truncate">
                                  {ws.name}
                                </span>
                              </div>
                              <p className="text-[10px] font-mono text-muted-foreground truncate mt-0.5">
                                {ws.path}
                              </p>
                            </div>
                            {ws.is_active && (
                              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 shrink-0">
                                Active
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Custom Local Path Input */}
                  <div className="space-y-1">
                    <label
                      htmlFor="neiman-local-repo-path"
                      className="block text-[10px] font-mono uppercase tracking-wider text-muted-foreground"
                    >
                      Local Project Directory Path
                    </label>
                    <input
                      id="neiman-local-repo-path"
                      type="text"
                      value={localPathInput}
                      onChange={(e) => setLocalPathInput(e.target.value)}
                      placeholder="/path/to/workspace"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus:border-primary"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 items-center">
                    <div className="space-y-1">
                      <label
                        htmlFor="neiman-local-repo-branch"
                        className="block text-[10px] font-mono uppercase tracking-wider text-muted-foreground"
                      >
                        Target Branch (Optional)
                      </label>
                      <input
                        id="neiman-local-repo-branch"
                        type="text"
                        value={branchInput}
                        onChange={(e) => setBranchInput(e.target.value)}
                        placeholder="main"
                        className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-mono text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus:border-primary"
                      />
                    </div>
                    <label className="flex items-center gap-2 pt-4 text-xs text-muted-foreground cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={initGitIfMissing}
                        onChange={(e) => setInitGitIfMissing(e.target.checked)}
                        className="rounded border-border"
                      />
                      <span>Initialize git if folder has no .git</span>
                    </label>
                  </div>
                </>
              ) : (
                <>
                  {/* Remote Git URL Input */}
                  <div className="space-y-1">
                    <label
                      htmlFor="neiman-remote-git-url"
                      className="block text-[10px] font-mono uppercase tracking-wider text-muted-foreground"
                    >
                      Remote Git Repository URL (HTTPS or SSH)
                    </label>
                    <input
                      id="neiman-remote-git-url"
                      type="text"
                      value={gitUrlInput}
                      onChange={(e) => setGitUrlInput(e.target.value)}
                      placeholder="https://github.com/org/repo.git"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus:border-primary"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label
                        htmlFor="neiman-clone-dest-path"
                        className="block text-[10px] font-mono uppercase tracking-wider text-muted-foreground"
                      >
                        Destination Folder (Optional)
                      </label>
                      <input
                        id="neiman-clone-dest-path"
                        type="text"
                        value={localPathInput}
                        onChange={(e) => setLocalPathInput(e.target.value)}
                        placeholder="/path/to/my-repo"
                        className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-mono text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus:border-primary"
                      />
                    </div>
                    <div className="space-y-1">
                      <label
                        htmlFor="neiman-clone-branch"
                        className="block text-[10px] font-mono uppercase tracking-wider text-muted-foreground"
                      >
                        Checkout Branch
                      </label>
                      <input
                        id="neiman-clone-branch"
                        type="text"
                        value={branchInput}
                        onChange={(e) => setBranchInput(e.target.value)}
                        placeholder="main"
                        className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-mono text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus:border-primary"
                      />
                    </div>
                  </div>
                </>
              )}

              {connectError && (
                <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-400 font-mono">
                  {connectError}
                </div>
              )}

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
                {onOpenRepoSetup ? (
                  <button
                    type="button"
                    onClick={() => {
                      setConnectModalOpen(false);
                      onOpenRepoSetup();
                    }}
                    className="text-[11px] font-mono text-muted-foreground hover:text-foreground underline"
                  >
                    Launch New AI Company Blueprint Wizard…
                  </button>
                ) : (
                  <span />
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setConnectModalOpen(false)}
                    className="rounded-lg border border-border bg-secondary/50 hover:bg-secondary px-3 py-1.5 text-xs font-medium text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={connectWorkspaceMutation.isPending}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {connectWorkspaceMutation.isPending ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        <span>Connecting…</span>
                      </>
                    ) : (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>Connect Project Workspace</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </aside>
    </>
  );
}
