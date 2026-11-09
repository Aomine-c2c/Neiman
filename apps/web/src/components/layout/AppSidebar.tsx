'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  MessageSquareCode,
  Kanban,
  Users,
  GitBranch,
  Database,
  Sliders,
  ShieldAlert,
  PanelLeftClose,
  PanelLeftOpen,
  FolderGit2,
  Plus,
  Terminal,
  Boxes,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { NeimanLogo } from '@/components/ui/NeimanLogo';

export interface AppSidebarProps {
  pendingApprovalsCount?: number;
  activeAgentsCount?: number;
  activeTasksCount?: number;
  onOpenApprovals?: () => void;
  onOpenRepoSetup?: () => void;
}

export interface CoreNavItem {
  id: string;
  label: string;
  href: string;
  shortcut: string;
  icon: React.ComponentType<{ className?: string }>;
  matchPaths: string[];
  badge?: number;
}

const SIDEBAR_STORAGE_KEY = 'neiman_sidebar_collapsed';

export function AppSidebar({
  pendingApprovalsCount = 0,
  activeAgentsCount = 0,
  activeTasksCount = 0,
  onOpenApprovals,
  onOpenRepoSetup,
}: AppSidebarProps) {
  const pathname = usePathname();
  const { activeCompany } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);

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

  const navItems: CoreNavItem[] = [
    {
      id: 'overview',
      label: 'Overview',
      href: '/dashboard',
      shortcut: '1',
      icon: LayoutDashboard,
      matchPaths: ['/dashboard'],
    },
    {
      id: 'councils',
      label: 'CTO & Councils',
      href: '/dashboard/councils',
      shortcut: '2',
      icon: MessageSquareCode,
      matchPaths: ['/dashboard/councils', '/dashboard/decisions'],
    },
    {
      id: 'tasks',
      label: 'Tasks & Projects',
      href: '/dashboard/tasks',
      shortcut: '3',
      icon: Kanban,
      matchPaths: ['/dashboard/tasks', '/dashboard/projects'],
      badge: activeTasksCount > 0 ? activeTasksCount : undefined,
    },
    {
      id: 'squad',
      label: 'Squad (Agents)',
      href: '/dashboard/agents',
      shortcut: '4',
      icon: Users,
      matchPaths: ['/dashboard/agents', '/dashboard/departments', '/dashboard/organization'],
      badge: activeAgentsCount > 0 ? activeAgentsCount : undefined,
    },
    {
      id: 'workflows',
      label: 'Workflows & Pipelines',
      href: '/dashboard/workflows',
      shortcut: '5',
      icon: GitBranch,
      matchPaths: ['/dashboard/workflows', '/dashboard/simulation'],
    },
    {
      id: 'mcp',
      label: 'Skills & MCP Hub',
      href: '/dashboard/mcp',
      shortcut: '6',
      icon: Boxes,
      matchPaths: ['/dashboard/mcp'],
    },
    {
      id: 'runtime',
      label: 'Execution Runtime',
      href: '/dashboard/runtime',
      shortcut: '7',
      icon: Terminal,
      matchPaths: ['/dashboard/runtime'],
    },
    {
      id: 'memory',
      label: 'Memory & Codebase',
      href: '/dashboard/memory',
      shortcut: '8',
      icon: Database,
      matchPaths: ['/dashboard/memory', '/dashboard/harvester'],
    },
    {
      id: 'git',
      label: 'Git & Code Control',
      href: '/dashboard/git',
      shortcut: 'G',
      icon: FolderGit2,
      matchPaths: ['/dashboard/git'],
    },
    {
      id: 'settings',
      label: 'Settings & Models',
      href: '/dashboard/settings',
      shortcut: '9',
      icon: Sliders,
      matchPaths: [
        '/dashboard/settings',
        '/dashboard/intelligence',
        '/dashboard/governance',
        '/dashboard/resources',
      ],
    },
  ];

  const isItemActive = (item: CoreNavItem) => {
    if (item.href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return item.matchPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  };

  return (
    <aside
      aria-label="Primary Workspace Navigation"
      className={`NEIMAN-sidebar flex flex-col shrink-0 h-screen select-none transition-all duration-150 ${
        collapsed ? 'w-14' : 'w-60'
      }`}
    >
      {/* Top Brand & Active Repo / Workspace Switcher */}
      <div className="h-12 flex items-center justify-between px-3 border-b border-border shrink-0">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 min-w-0 focus:outline-none"
          title="NEIMAN Engineering Workspace"
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

      {/* Connected Repository / Active Software Org Card */}
      <div className="p-2.5 border-b border-border/70 shrink-0">
        <button
          type="button"
          onClick={onOpenRepoSetup}
          title="Switch or connect software repository"
          className={`w-full flex items-center gap-2.5 rounded-lg border border-border/80 bg-secondary/40 hover:bg-secondary/80 hover:border-primary/30 transition-colors text-left ${
            collapsed ? 'justify-center p-2' : 'px-2.5 py-2'
          }`}
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary border border-primary/20">
            <FolderGit2 className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <p className="text-xs font-semibold text-foreground truncate">
                  {activeCompany?.name || 'Connect Repository'}
                </p>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
              </div>
              <p className="text-[11px] font-mono text-muted-foreground truncate">
                {activeCompany ? 'git: main • synced' : 'Click to initialize'}
              </p>
            </div>
          )}
        </button>
      </div>

      {/* 7 Core Engineering Views */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
        {!collapsed && (
          <div className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            Engineering Suite
          </div>
        )}
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isItemActive(item);
          return (
            <Link
              key={item.id}
              href={item.href}
              title={collapsed ? `${item.label} [${item.shortcut}]` : undefined}
              className={`group flex items-center justify-between rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors ${
                active
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground'
              } ${collapsed ? 'justify-center' : ''}`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon
                  className={`h-4 w-4 shrink-0 transition-colors ${
                    active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                  }`}
                />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </div>

              {!collapsed && (
                <div className="flex items-center gap-1.5 shrink-0">
                  {item.badge !== undefined && (
                    <span
                      className={`px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded-full ${
                        active
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-muted-foreground'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                  <kbd className="hidden group-hover:inline-block text-[10px] font-mono text-muted-foreground/70 px-1 rounded bg-secondary/60">
                    {item.shortcut}
                  </kbd>
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Human-in-the-Loop Approvals Gate Trigger + Connect New Repo */}
      <div className="p-2.5 border-t border-border space-y-1.5 shrink-0">
        <button
          type="button"
          onClick={onOpenApprovals}
          aria-label="Pending Approvals"
          title="Review Human-in-the-Loop Approvals"
          className={`w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium border transition-colors ${
            pendingApprovalsCount > 0
              ? 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/15'
              : 'border-border bg-secondary/30 text-muted-foreground hover:text-foreground hover:bg-secondary/60'
          } ${collapsed ? 'justify-center' : ''}`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="truncate">Approvals & Gates</span>}
          </div>
          {!collapsed && (
            <span
              className={`px-1.5 py-0.5 text-[10px] font-mono font-bold rounded-full ${
                pendingApprovalsCount > 0
                  ? 'bg-amber-500 text-white'
                  : 'bg-secondary text-muted-foreground'
              }`}
            >
              {pendingApprovalsCount}
            </span>
          )}
        </button>

        {!collapsed && onOpenRepoSetup && (
          <button
            type="button"
            onClick={onOpenRepoSetup}
            className="w-full flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Connect Repository
          </button>
        )}
      </div>
    </aside>
  );
}

