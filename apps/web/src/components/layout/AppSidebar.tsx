'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MessageSquare,
  Scale,
  GitBranch,
  Sliders,
  PanelLeftClose,
  PanelLeftOpen,
  FolderGit2,
  Plus,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { NeimanLogo } from '@/components/ui/NeimanLogo';
import { AgentAvatar } from '@/components/ui/AgentAvatar';
import { FileTreeExplorer } from '@/components/explorer/FileTreeExplorer';
import { AgentContributionGraph } from './AgentContributionGraph';
import { vcsApi, type GitStatusResponse } from '@/lib/api/vcs';

export interface SidebarThreadSummary {
  id: string;
  title: string;
  kind: 'CTO' | 'COUNCIL' | 'AGENT';
  status?: string;
}

export interface SidebarSquadMember {
  id: string;
  name: string;
  roleTitle: string;
  status: string;
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
  onNewCouncilDebate?: () => void;
  onMentionAgent?: (agent: SidebarSquadMember) => void;
  onOpenDrawer?: (drawerId: string, entityId?: string) => void;
  onOpenApprovals?: () => void;
  onOpenRepoSetup?: () => void;
}

const SIDEBAR_STORAGE_KEY = 'neiman_sidebar_collapsed';

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
  onNewCouncilDebate,
  onMentionAgent,
  onOpenDrawer,
  onOpenApprovals,
  onOpenRepoSetup,
}: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { activeCompany } = useAuthStore();
  const companyId = activeCompany?.id || '';
  const [collapsed, setCollapsed] = useState(false);
  const [threadsExpanded, setThreadsExpanded] = useState(true);
  const [explorerExpanded, setExplorerExpanded] = useState(true);

  let queryClient: ReturnType<typeof useQueryClient> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    queryClient = useQueryClient();
  } catch {
    // Graceful fallback for test harnesses without QueryClientProvider
  }

  // Fetch live Git VCS Status for Code Explorer
  const { data: gitStatus } = useQuery({
    queryKey: ['vcs-status', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      try {
        return await vcsApi.getStatus(companyId);
      } catch {
        return null;
      }
    },
    enabled: !!companyId && !collapsed,
    refetchInterval: 10000,
  });

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

  const handleNewDebateClick = () => {
    if (onNewCouncilDebate) {
      onNewCouncilDebate();
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('neiman:new-council-debate'));
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
    squadMembers && squadMembers.length > 0 ? squadMembers : DEFAULT_SQUAD_ROSTER;

  return (
    <aside
      aria-label="Primary Workspace Navigation"
      className={`NEIMAN-sidebar flex flex-col shrink-0 h-screen select-none transition-all duration-150 border-r border-border bg-card ${
        collapsed ? 'w-14' : 'w-72 sm:w-80 xl:w-[320px] 2xl:w-[340px]'
      }`}
    >
      {/* Top Brand & Collapse Toggle */}
      <div className="h-12 flex items-center justify-between px-3 border-b border-border shrink-0">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 min-w-0 focus:outline-none"
          title="NEIMAN Chat-First Command Room"
        >
          <NeimanLogo size="xs" showWordmark={!collapsed} withGlow={false} />
        </Link>
        <button
          type="button"
          onClick={handleToggleCollapse}
          aria-label="Toggle sidebar collapse"
          aria-expanded={!collapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-colors"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Connected Repository Card — Clicking opens Git & Code Control Drawer (?drawer=git) */}
      <div className="p-2.5 border-b border-border/70 shrink-0">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => triggerDrawer('git')}
            aria-label="Open Git & Code Control"
            title="Open Git & Code Control drawer"
            className={`flex-1 flex items-center gap-2.5 rounded-lg border border-border/80 bg-secondary/40 hover:bg-secondary/80 hover:border-primary/30 transition-colors text-left min-w-0 ${
              collapsed ? 'justify-center p-2' : 'px-2.5 py-2'
            }`}
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-secondary text-foreground border border-border">
              <FolderGit2 className="h-4 w-4" />
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-xs font-semibold text-foreground truncate">
                    {activeCompany?.name || 'Connect Repository'}
                  </p>
                  <span className="h-1.5 w-1.5 rounded-full bg-foreground shrink-0" />
                </div>
                <p className="text-[11px] font-mono text-muted-foreground truncate">
                  {activeCompany ? 'git: main • synced' : 'Click to inspect VCS'}
                </p>
              </div>
            )}
          </button>

          {!collapsed && onOpenRepoSetup && (
            <button
              type="button"
              onClick={onOpenRepoSetup}
              aria-label="Switch or Connect Repository"
              title="Switch or connect software repository"
              className="p-2 rounded-lg border border-border/80 bg-secondary/30 text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-colors shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
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
          {/* PANEL 1 [Top]: Agent Contribution Graph (GitHub-Style Calendar Heatmap) */}
          <AgentContributionGraph
            companyId={companyId}
            onSelectAgent={(agentId) => {
              if (agentId) {
                const found = resolvedSquad.find(
                  (a) => a.id === agentId || a.name.toLowerCase().includes(agentId.toLowerCase())
                );
                if (found) handleAgentClick(found);
              }
            }}
          />

          {/* PANEL 2: Conversation Threads & Live Squad Roster */}
          <div
            className={`flex flex-col overflow-hidden bg-card transition-all ${
              threadsExpanded ? (explorerExpanded ? 'max-h-64 shrink-0' : 'flex-1 min-h-0') : 'shrink-0'
            }`}
          >
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/70 bg-secondary/20 shrink-0">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/90">
                CTO &amp; Council Threads
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
                  {threads.length > 0 ? threads.length : 1}
                </span>
                <button
                  type="button"
                  onClick={() => setThreadsExpanded((v) => !v)}
                  aria-label={threadsExpanded ? 'Collapse threads and squad' : 'Expand threads and squad'}
                  className="p-0.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                >
                  {threadsExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
              </div>
            </div>

            {threadsExpanded && (
              <div className="flex-1 min-h-0 overflow-y-auto px-2 py-1.5 space-y-2">
                {/* Active Threads */}
                <div className="space-y-0.5">
                  {threads.length === 0 ? (
                    <button
                      type="button"
                      onClick={handleNewChatClick}
                      className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium bg-primary/10 text-primary transition-colors text-left"
                      title="Direct CTO Architecture Thread"
                    >
                      <MessageSquare className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-[11px]">Direct CTO &amp; Squad Chat</p>
                        <p className="text-[9px] font-mono text-primary/80 truncate">LIVE COMMAND ROOM</p>
                      </div>
                    </button>
                  ) : (
                    threads.map((thr) => {
                      const isSelected = activeThreadId === thr.id;
                      return (
                        <button
                          key={thr.id}
                          type="button"
                          onClick={() => handleThreadClick(thr.id)}
                          title={thr.title}
                          className={`w-full flex items-center justify-between gap-2 rounded-lg px-2 py-1 text-xs transition-colors text-left ${
                            isSelected
                              ? 'bg-primary/10 text-primary font-semibold'
                              : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            {thr.kind === 'COUNCIL' ? (
                              <Scale className="h-3 w-3 shrink-0 text-primary" />
                            ) : (
                              <MessageSquare className="h-3 w-3 shrink-0" />
                            )}
                            <span className="truncate text-[11px]">{thr.title}</span>
                          </div>
                          {thr.status && (
                            <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-secondary text-muted-foreground shrink-0">
                              {thr.status}
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>

                {/* Squad Roster */}
                <div className="space-y-0.5 pt-1.5 border-t border-border/50">
                  <div className="flex items-center justify-between px-1.5 pb-1 gap-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80 truncate">
                      Squad (Agents)
                    </span>
                    <button
                      type="button"
                      onClick={() => triggerDrawer('agents')}
                      className="inline-flex items-center gap-1 text-[10px] font-mono text-primary hover:underline shrink-0 tabular-nums"
                    >
                      <span>{activeAgentsCount || resolvedSquad.length} online</span>
                      <ExternalLink className="h-2.5 w-2.5" />
                    </button>
                  </div>

                  {resolvedSquad.map((agent) => {
                    const isWorking = agent.status === 'WORKING' || agent.status === 'ACTIVE';
                    return (
                      <div
                        key={agent.id}
                        className="group flex items-center justify-between gap-1.5 rounded-lg px-1.5 py-1 text-xs hover:bg-secondary/70 transition-colors"
                      >
                        <button
                          type="button"
                          onClick={() => handleAgentClick(agent)}
                          title={`Message @${agent.name} (${agent.roleTitle}) in Chat`}
                          className="flex items-center gap-1.5 min-w-0 flex-1 text-left"
                        >
                          <div className="relative shrink-0">
                            <AgentAvatar name={agent.name} roleTitle={agent.roleTitle} size={20} showStatus={false} />
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full ring-1 ring-background ${
                                isWorking ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/60'
                              }`}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-medium text-foreground truncate group-hover:text-primary transition-colors">
                              {agent.name}
                            </p>
                            <p className="text-[9px] font-mono text-muted-foreground truncate">@{agent.roleTitle}</p>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => triggerDrawer('agents', agent.id)}
                          aria-label={`Inspect ${agent.name}`}
                          className="opacity-0 group-hover:opacity-100 px-1 py-0.5 rounded text-[9px] font-mono text-muted-foreground hover:text-foreground hover:bg-secondary transition-opacity"
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
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-secondary text-foreground border border-border shrink-0">
                  Monorepo
                </span>
                <button
                  type="button"
                  onClick={() => setExplorerExpanded((v) => !v)}
                  aria-label={explorerExpanded ? 'Collapse code explorer' : 'Expand code explorer'}
                  className="p-0.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                >
                  {explorerExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
              </div>
            </div>

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

      {/* Bottom Dock: Settings Icon */}
      <div
        className={`p-2.5 border-t border-border shrink-0 bg-card flex items-center ${
          collapsed ? 'justify-center' : 'justify-between'
        }`}
      >
        <button
          type="button"
          onClick={(e) => {
            if (e.shiftKey) {
              router.push('/dashboard/settings');
            } else {
              triggerDrawer('settings');
            }
          }}
          aria-label="Settings & Models"
          title="Settings & Models (Click for Drawer, Shift+Click for Full Page)"
          className="p-2 rounded-lg border border-border/70 bg-secondary/30 text-muted-foreground hover:text-foreground hover:border-foreground/30 hover:bg-secondary/80 transition-colors"
        >
          <Sliders className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
