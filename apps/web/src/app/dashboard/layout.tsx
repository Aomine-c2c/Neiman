'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  ChevronDown,
  LogOut,
  User,
  Search,
  Command,
  RotateCw,
  GitBranch,
  ShieldAlert,
  Cpu,
  Sliders,
  Menu,
} from 'lucide-react';
import { AuthGuard } from '@/components/AuthGuard';
import { useAuthStore } from '@/store/auth';
import { organizationsApi } from '@/lib/api/organizations';
import { api } from '@/lib/api/client';
import { agentsApi, type Agent } from '@/lib/api/agents';
import { councilsApi } from '@/lib/api/councils';
import { vcsApi } from '@/lib/api/vcs';
import type { Task, ApprovalRequest, ResourceSummary } from '@/lib/api/controlRoom';
import { ctoApi, type ExecutiveThread } from '@/lib/api/cto';
import { CommandPalette } from '@/components/layout/CommandPalette';
import { OrganizationSwitcher } from '@/components/layout/OrganizationSwitcher';
import { NotificationsCenter } from '@/components/layout/NotificationsCenter';
import { ThemeToggle } from '@/components/ThemeToggle';
import { isTauriDesktop, desktopEvents, desktopWindowState } from '@/lib/desktop/tauriBridge';
import { SystemSetupWizard } from '@/components/layout/SystemSetupWizard';
import { UpdateReadyModal } from '@/components/layout/UpdateReadyModal';
import { CockpitDrawer } from '@/components/layout/CockpitDrawer';
import { ResourceCockpitView } from '@/components/layout/ResourceCockpitView';
import { UnifiedCockpitDrawerHub } from '@/components/layout/UnifiedCockpitDrawerHub';
import { SystemUpdateCenterModal } from '@/components/layout/SystemUpdateCenterModal';
import { AppSidebar, type SidebarThreadSummary, type SidebarSquadMember } from '@/components/layout/AppSidebar';
import { GlobalTerminalDrawer } from '@/components/terminal/GlobalTerminalDrawer';
import { NEIMAN_CONFIG } from '@neiman/config';

const VIEW_LABELS: Record<string, string> = {
  dashboard: 'CTO Command',
  councils: 'CTO Command',
  decisions: 'CTO & Councils',
  tasks: 'Tasks & Projects',
  projects: 'Tasks & Projects',
  agents: 'Squad (Agents)',
  departments: 'Squad (Agents)',
  organization: 'Squad (Agents)',
  workflows: 'Workflows & Pipelines',
  simulation: 'Workflows & Pipelines',
  mcp: 'Skills & MCP Hub',
  runtime: 'Execution Runtime',
  memory: 'Memory & Codebase',
  harvester: 'Memory & Codebase',
  git: 'Git & Code Control',
  evolution: 'Evolution & Benchmarks',
  blueprints: 'Blueprints & Templates',
  settings: 'Settings & Models',
  intelligence: 'Settings & Models',
  governance: 'Settings & Models',
  resources: 'Settings & Models',
  approvals: 'Approvals & Gates',
};

function DashboardLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, activeCompany, setActiveCompany, logout } = useAuthStore();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [resourceDrawerOpen, setResourceDrawerOpen] = useState(false);
  const [updateCenterOpen, setUpdateCenterOpen] = useState(false);
  const [setupWizardOpen, setSetupWizardOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyId = activeCompany?.id || '';

  // Live lightweight badge telemetry for sidebar & status bar
  const { data: shellTelemetry } = useQuery({
    queryKey: ['shell-badge-telemetry', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const [agentsRes, tasksRes, approvalsRes, resourcesRes, threadsRes, councilsRes, vcsRes] = await Promise.allSettled([
        agentsApi.list(companyId),
        api.get<Task[]>(`/api/v1/companies/${companyId}/tasks`),
        api.get<ApprovalRequest[]>(`/api/v1/companies/${companyId}/governance/approvals?status=PENDING`),
        api.get<ResourceSummary>(`/api/v1/companies/${companyId}/resources/control-center`),
        ctoApi.getThreads(companyId),
        councilsApi.list(companyId),
        vcsApi.getStatus(companyId),
      ]);

      const agents = agentsRes.status === 'fulfilled' && Array.isArray(agentsRes.value) ? agentsRes.value : [];
      const tasks = tasksRes.status === 'fulfilled' && Array.isArray(tasksRes.value) ? tasksRes.value : [];
      const approvals = approvalsRes.status === 'fulfilled' && Array.isArray(approvalsRes.value) ? approvalsRes.value : [];
      const resources = resourcesRes.status === 'fulfilled' && resourcesRes.value ? resourcesRes.value : null;
      const execThreads: ExecutiveThread[] =
        threadsRes.status === 'fulfilled' && Array.isArray(threadsRes.value) ? threadsRes.value : [];
      const councilsList =
        councilsRes.status === 'fulfilled' && Array.isArray(councilsRes.value) ? councilsRes.value : [];
      const vcsStatus = vcsRes.status === 'fulfilled' && vcsRes.value ? vcsRes.value : null;

      let delibThreads: SidebarThreadSummary[] = [];
      if (councilsList.length > 0) {
        try {
          const delibs = await councilsApi.listDeliberations(companyId, councilsList[0].id);
          if (Array.isArray(delibs)) {
            delibThreads = delibs.slice(0, 5).map((d) => ({
              id: d.id,
              title: d.title,
              kind: 'COUNCIL',
              status: d.status,
            }));
          }
        } catch {
          // ignore
        }
      }

      const resolveFunctionalRole = (a: Agent): string => {
        if (a.role_title) return a.role_title;
        if (typeof a.identity?.title === 'string' && a.identity.title) return a.identity.title;
        if (typeof a.identity?.role === 'string' && a.identity.role) return a.identity.role;
        const slug = String(a.identity?.slug || a.name || '').toLowerCase();
        if (slug.includes('cto')) return 'CTO';
        if (slug.includes('architect')) return 'Architect';
        if (slug.includes('security')) return 'Security';
        if (slug.includes('backend')) return 'Backend';
        if (slug.includes('qa') || slug.includes('test')) return 'QA Lead';
        if (slug.includes('frontend')) return 'Frontend';
        if (slug.includes('devops')) return 'DevOps';
        if (slug.includes('writer') || slug.includes('doc')) return 'Docs';
        return 'Specialist';
      };

      const squadMembers: SidebarSquadMember[] = agents.map((a) => {
        const modelStr =
          typeof a.intelligence_config?.model === 'string'
            ? a.intelligence_config.model
            : typeof a.intelligence_config?.model_identifier === 'string'
            ? a.intelligence_config.model_identifier
            : undefined;
        const activeTask = tasks.find(
          (t) =>
            (t.assigned_agent_id === a.id || t.assigned_agent_name === a.name) &&
            (t.status === 'IN_PROGRESS' || t.status === 'PENDING')
        );
        return {
          id: a.id,
          name: a.name,
          roleTitle: resolveFunctionalRole(a),
          status: a.status || 'AVAILABLE',
          model: modelStr,
          activeTaskTitle: activeTask?.title,
        };
      });

      const seenIds = new Set<string>();
      const sidebarThreads: SidebarThreadSummary[] = [];
      for (const t of execThreads.slice(0, 12)) {
        seenIds.add(t.thread_id);
        sidebarThreads.push({
          id: t.thread_id,
          title: t.subject,
          kind: t.thread_type === 'COUNCIL_DEBATE' ? 'COUNCIL' : t.thread_type === 'AGENT_DIRECT' ? 'AGENT' : 'CTO',
          status: t.status,
        });
      }
      for (const d of delibThreads) {
        if (!seenIds.has(d.id)) {
          sidebarThreads.push(d);
        }
      }

      return {
        agentsWorking: agents.filter((a) => a.status === 'WORKING' || a.status === 'AVAILABLE').length,
        agentsTotal: agents.length,
        tasksActive: tasks.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'PENDING').length,
        approvalsPending: approvals.filter((a) => a.status === 'PENDING').length,
        squadMembers,
        sidebarThreads,
        vcsStatus,
        tokensTotal:
          resources?.token_usage_total !== null && resources?.token_usage_total !== undefined
            ? `${(resources.token_usage_total / 1000).toFixed(1)}k`
            : '0.0k',
        costUsd:
          resources?.intelligence_cost_usd !== null && resources?.intelligence_cost_usd !== undefined
            ? `$${resources.intelligence_cost_usd.toFixed(2)}`
            : '$0.00',
      };
    },
    enabled: !!companyId,
    staleTime: NEIMAN_CONFIG.TELEMETRY.STALE_TIMES.NORMAL,
    refetchInterval: NEIMAN_CONFIG.TELEMETRY.POLLING_INTERVALS.BACKGROUND,
  });

  useEffect(() => {
    if (searchParams.get('update') === 'true') {
      setUpdateCenterOpen(true);
    }
    if (searchParams.get('setup') === 'true' || searchParams.get('reset') === 'true') {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(NEIMAN_CONFIG.STORAGE_KEYS.SETUP_VERSION);
      }
      setActiveCompany(null);
      setSetupWizardOpen(true);
    }
  }, [searchParams, setActiveCompany]);

  // Active drawer synchronized with URL ?drawer=
  const activeDrawerId = searchParams.get('drawer');
  const isCommandRoom = pathname === '/dashboard' || pathname === '/dashboard/councils';

  const handleOpenDrawer = useCallback(
    (drawerId: string, entityId?: string, forceModal = false) => {
      if (isCommandRoom && !forceModal) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('neiman:dock-view', { detail: { view: drawerId.toUpperCase(), entityId } })
          );
        }
        return;
      }
      const params = new URLSearchParams(searchParams.toString());
      params.set('drawer', drawerId);
      if (entityId) {
        params.set('entityId', entityId);
      } else {
        params.delete('entityId');
      }
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [isCommandRoom, pathname, router, searchParams]
  );

  const handleCloseDrawer = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('drawer');
    params.delete('entityId');
    const newQuery = params.toString();
    router.push(newQuery ? `${pathname}?${newQuery}` : pathname, { scroll: false });
  };

  useEffect(() => {
    const onCustomOpenDrawer = (e: Event) => {
      const detail = (e as CustomEvent<{ drawerId?: string; entityId?: string; forceModal?: boolean }>).detail;
      if (detail?.drawerId) {
        handleOpenDrawer(detail.drawerId, detail.entityId, detail.forceModal);
      }
    };
    window.addEventListener('neiman:open-drawer', onCustomOpenDrawer);
    return () => window.removeEventListener('neiman:open-drawer', onCustomOpenDrawer);
  }, [handleOpenDrawer]);

  // Compute readable breadcrumb label for the 7 Core Engineering Views
  const segments = pathname.split('/').filter(Boolean);
  const subKey = segments.length > 1 ? segments[1] : 'dashboard';
  const currentViewLabel = VIEW_LABELS[subKey] || subKey.replace(/-/g, ' ');

  useEffect(() => {
    const isSetupCompleted =
      typeof window !== 'undefined'
        ? localStorage.getItem(NEIMAN_CONFIG.STORAGE_KEYS.SETUP_VERSION) === 'completed'
        : false;

    organizationsApi
      .list()
      .then((companies) => {
        if (!companies || companies.length === 0) {
          setActiveCompany(null);
          setSetupWizardOpen(true);
        } else if (!isSetupCompleted) {
          setActiveCompany(null);
          setSetupWizardOpen(true);
        } else {
          const exists = activeCompany && companies.some((c) => c.id === activeCompany.id);
          if (!exists) {
            setActiveCompany(companies[0]);
          }
        }
      })
      .catch(() => {
        if (!activeCompany || !isSetupCompleted) {
          setActiveCompany(null);
          setSetupWizardOpen(true);
        }
      });
  }, [activeCompany, setActiveCompany]);

  // Global keyboard shortcuts for Command Palette (Cmd/Ctrl+K) and 7 Core Views (1-7)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInteractiveWidget =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.tagName === 'SELECT' ||
          target.tagName === 'BUTTON' ||
          Boolean(target.closest('[role="dialog"], [role="menu"], [role="listbox"], [role="textbox"], [role="combobox"]')));

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
        return;
      }

      const viewMap: Record<string, string> = {
        '1': '/dashboard',
        '2': '/dashboard/councils',
        '3': '/dashboard/tasks',
        '4': '/dashboard/agents',
        '5': '/dashboard/workflows',
        '6': '/dashboard/memory',
        '7': '/dashboard/settings',
        '0': '/dashboard',
      };

      // Alt+1..7 or bare 1..7 when not typing in an input
      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && viewMap[e.key]) {
        e.preventDefault();
        router.push(viewMap[e.key]);
        return;
      }

      if (!isInteractiveWidget && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && viewMap[e.key]) {
        e.preventDefault();
        router.push(viewMap[e.key]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    let unlistenDeepLink: (() => void) | undefined;
    if (isTauriDesktop()) {
      desktopEvents
        .listenDeepLink((url) => {
          try {
            const parsed = new URL(url);
            const targetPath = parsed.pathname || parsed.host;
            if (targetPath) {
              router.push(targetPath.startsWith('/') ? targetPath : `/${targetPath}`);
            }
          } catch {
            const cleanPath = url.replace(/^neiman:\/\//, '/');
            router.push(cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`);
          }
        })
        .then((unsub) => {
          unlistenDeepLink = unsub;
        });

      const handleResizeOrMove = () => {
        desktopWindowState.save({
          width: window.innerWidth,
          height: window.innerHeight,
          x: window.screenX,
          y: window.screenY,
          is_maximized:
            window.outerWidth >= window.screen.availWidth &&
            window.outerHeight >= window.screen.availHeight,
        });
      };
      window.addEventListener('resize', handleResizeOrMove);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('resize', handleResizeOrMove);
        if (unlistenDeepLink) unlistenDeepLink();
      };
    }

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router]);

  const handleLogout = () => {
    logout();
    setSetupWizardOpen(true);
    setShowUserMenu(false);
  };

  const initials = user
    ? `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`.toUpperCase() ||
      user.username[0].toUpperCase()
    : 'U';

  const pendingApprovals = shellTelemetry?.approvalsPending ?? 0;

  return (
    <AuthGuard>
      <div className="dashboard-atmosphere flex h-screen w-full overflow-hidden bg-background text-foreground">
        {/* Left Collapsible Sidebar (Chat Threads, Squad Roster & Utility Dock) */}
        <AppSidebar
          pendingApprovalsCount={pendingApprovals}
          activeAgentsCount={shellTelemetry?.agentsWorking ?? 0}
          activeTasksCount={shellTelemetry?.tasksActive ?? 0}
          threads={shellTelemetry?.sidebarThreads}
          squadMembers={shellTelemetry?.squadMembers}
          activeThreadId={searchParams.get('thread')}
          onOpenDrawer={handleOpenDrawer}
          onOpenApprovals={() => handleOpenDrawer('approvals')}
          onOpenRepoSetup={() => setSetupWizardOpen(true)}
          mobileOpen={mobileSidebarOpen}
          onMobileClose={() => setMobileSidebarOpen(false)}
        />

        {/* Main Application Workspace */}
        <div className="flex flex-1 flex-col min-w-0 h-screen overflow-hidden">
          {/* Clean Slim Topbar */}
          <header className="NEIMAN-topbar sticky top-0 z-30 flex h-12 shrink-0 items-center justify-between px-3 sm:px-4 lg:px-5 gap-2 overflow-hidden">
            {/* Left: Mobile Drawer Trigger + View Title + Connected Repo/Branch Pill */}
            <div className="flex items-center gap-2 min-w-0 overflow-hidden">
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(true)}
                aria-label="Open workspace navigation"
                className="md:hidden min-h-8 min-w-8 flex items-center justify-center rounded-md border border-border bg-secondary/40 text-foreground hover:bg-secondary transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Menu className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-2 text-base min-w-0">
                <h1 className="text-base font-semibold text-foreground truncate">
                  {currentViewLabel}
                </h1>
              </div>

              {activeCompany && (
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      window.dispatchEvent(new CustomEvent('neiman:open-repo-connect'));
                    } else {
                      handleOpenDrawer('git');
                    }
                  }}
                  title={
                    shellTelemetry?.vcsStatus?.repo_path
                      ? `Connected Repo: ${shellTelemetry.vcsStatus.repo_path} (Click to switch/connect repository)`
                      : 'Connect or Switch Project Repository'
                  }
                  aria-label="Connect or Switch Project Repository"
                  className="hidden xl:flex items-center gap-1.5 rounded-md border border-border bg-secondary/40 hover:bg-secondary/80 hover:border-primary/40 px-2.5 py-1 text-xs font-mono text-muted-foreground transition-colors shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <GitBranch className="h-3.5 w-3.5 text-primary" />
                  <span className="text-foreground font-medium truncate max-w-[140px]">
                    {shellTelemetry?.vcsStatus?.repo_name || activeCompany.name}
                  </span>
                  <span className="text-muted-foreground">:</span>
                  <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                    {shellTelemetry?.vcsStatus?.branch || 'main'}
                  </span>
                </button>
              )}
            </div>

            {/* Right: Cmd+K Search, Pending Approvals Quick Pill, Org Switcher, Theme, Notifications, User */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto">
              {/* Cmd+K Search Trigger */}
              <button
                type="button"
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-secondary/40 px-2 sm:px-2.5 min-h-8 text-xs text-muted-foreground hover:border-primary/40 hover:bg-secondary/70 hover:text-foreground transition-all w-auto sm:w-36 xl:w-44 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => setCommandPaletteOpen(true)}
                aria-label="Open command palette"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="hidden sm:inline truncate">Search…</span>
                </div>
                <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded bg-card px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground border border-border shrink-0">
                  <Command className="h-2.5 w-2.5" />K
                </kbd>
              </button>

              {/* Approvals Badge Trigger */}
              {pendingApprovals > 0 && (
                <button
                  type="button"
                  onClick={() => handleOpenDrawer('approvals')}
                  className="hidden md:inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary text-foreground px-2.5 py-1.5 text-xs font-medium hover:bg-secondary/80 transition-colors shrink-0 tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  title="Review Pending Human-in-the-Loop Approvals"
                >
                  <ShieldAlert className="h-3.5 w-3.5" />
                  <span>{pendingApprovals} Pending</span>
                </button>
              )}

              {/* Organization Switcher */}
              <div className="hidden sm:block">
                <OrganizationSwitcher />
              </div>

              {/* Settings & Models Trigger */}
              <button
                type="button"
                onClick={(e) => {
                  if (e.shiftKey) {
                    router.push('/dashboard/settings');
                  } else {
                    handleOpenDrawer('settings');
                  }
                }}
                aria-label="Settings & Models"
                title="Settings & Models (Click for Drawer, Shift+Click for Full Page)"
                className="hidden sm:inline-flex p-2 rounded-lg border border-border/70 bg-secondary/30 text-muted-foreground hover:text-foreground hover:border-foreground/30 hover:bg-secondary/80 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Sliders className="h-4 w-4" />
              </button>

              {/* Theme Toggle (Light / Dark) */}
              <ThemeToggle />

              {/* Notifications */}
              <NotificationsCenter />

              {/* User Menu */}
              <div className="relative">
                <button
                  id="user-menu-trigger"
                  type="button"
                  className="flex items-center gap-1.5 rounded-lg border border-border p-1 sm:px-2 sm:py-1 hover:bg-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => setShowUserMenu((v) => !v)}
                  aria-expanded={showUserMenu}
                  aria-haspopup="true"
                  aria-label="User account menu"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-[11px] font-semibold text-primary-foreground">
                    {initials}
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                </button>

                {showUserMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowUserMenu(false)}
                      aria-hidden="true"
                    />
                    <div className="absolute right-0 top-full mt-1.5 z-50 w-56 rounded-xl border border-border bg-card shadow-lg p-1.5 animate-fade-in">
                      <div className="px-3 py-2 border-b border-border/60">
                        <p className="text-xs font-semibold text-foreground">
                          {user?.first_name ? `${user.first_name} ${user.last_name}` : user?.username || 'Operator'}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">{user?.email}</p>
                      </div>
                      <Link
                        href="/dashboard/settings"
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-foreground hover:bg-secondary transition-colors mt-1"
                        onClick={() => setShowUserMenu(false)}
                      >
                        <User className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                        Settings & Models
                      </Link>
                      <button
                        id="register-company-btn"
                        type="button"
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-primary hover:bg-primary/10 transition-colors"
                        onClick={() => {
                          setShowUserMenu(false);
                          setSetupWizardOpen(true);
                        }}
                      >
                        <Building2 className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                        Connect Repository / Setup
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-foreground hover:bg-secondary transition-colors"
                        onClick={() => {
                          setShowUserMenu(false);
                          setUpdateCenterOpen(true);
                        }}
                      >
                        <RotateCw className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                        System Updates & Build
                      </button>
                      <hr className="my-1 border-border/60" />
                      <button
                        id="logout-button"
                        type="button"
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-secondary transition-colors"
                        onClick={handleLogout}
                      >
                        <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                        Reset Workspace Context
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </header>

          {/* Full-Width Responsive Command Workspace */}
          <main
            id="main-content"
            className={`dashboard-canvas flex-1 flex flex-col min-h-0 overflow-y-auto ${
              isCommandRoom ? 'p-0 overflow-hidden' : 'p-4 lg:p-5'
            }`}
            role="main"
          >
            {children}
          </main>

          {/* Quiet 24px VS Code / Cursor Style Status Bar */}
          <footer
            className="h-6 shrink-0 border-t border-border bg-card px-4 flex items-center justify-between text-[11px] font-mono text-muted-foreground select-none"
            role="contentinfo"
          >
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span>{activeCompany ? activeCompany.name : 'No Repo Connected'}</span>
              </span>
              <span className="hidden sm:inline text-muted-foreground">
                Squad: {shellTelemetry?.agentsWorking ?? 0}/{shellTelemetry?.agentsTotal ?? 0} active
              </span>
              <span className="hidden md:inline text-muted-foreground">
                Tasks: {shellTelemetry?.tasksActive ?? 0} active
              </span>
            </div>

            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setResourceDrawerOpen(true)}
                className="flex items-center gap-1.5 hover:text-foreground transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                title="Inspect Compute & Token Budgets"
              >
                <Cpu className="h-3 w-3 text-primary" />
                <span>Tokens: {shellTelemetry?.tokensTotal ?? '0.0k'}</span>
                <span className="text-muted-foreground">•</span>
                <span>{shellTelemetry?.costUsd ?? '$0.00'}</span>
              </button>
              <button
                type="button"
                onClick={() => setUpdateCenterOpen(true)}
                className="hidden sm:inline hover:text-foreground transition-colors"
              >
                NEIMAN OS v1.1.1
              </button>
            </div>
          </footer>
        </div>

        {/* Single Global Command Palette */}
        <CommandPalette
          isOpen={commandPaletteOpen}
          onClose={() => setCommandPaletteOpen(false)}
          onOpenDrawer={handleOpenDrawer}
          onTriggerSetup={() => {
            setActiveCompany(null);
            setSetupWizardOpen(true);
          }}
        />

        {/* Repository-First Onboarding & Setup Wizard */}
        <SystemSetupWizard
          isOpen={setupWizardOpen}
          onClose={() => {
            setSetupWizardOpen(false);
            if (typeof window !== 'undefined') {
              localStorage.setItem(NEIMAN_CONFIG.STORAGE_KEYS.SETUP_VERSION, 'completed');
            }
          }}
          onCompleted={() => {
            setSetupWizardOpen(false);
            if (typeof window !== 'undefined') {
              localStorage.setItem(NEIMAN_CONFIG.STORAGE_KEYS.SETUP_VERSION, 'completed');
            }
          }}
        />

        {/* System Update Center Modal */}
        <SystemUpdateCenterModal
          isOpen={updateCenterOpen}
          onClose={() => setUpdateCenterOpen(false)}
        />

        {/* Native Auto-Update Prompt */}
        <UpdateReadyModal onOpenUpdateCenter={() => setUpdateCenterOpen(true)} />

        {/* Slide-Over Drawer for Live Resources */}
        <CockpitDrawer
          isOpen={resourceDrawerOpen}
          onClose={() => setResourceDrawerOpen(false)}
          title="Compute, Budgets & Token Quotas"
          subtitle="CGroup Isolation, Token Velocity & Cost Ceilings"
        >
          <ResourceCockpitView />
        </CockpitDrawer>

        {/* Unified Slide-Over Drawer Hub */}
        <UnifiedCockpitDrawerHub
          activeDrawerId={activeDrawerId}
          onClose={handleCloseDrawer}
        />

        {/* Global Bottom Integrated Bash Terminal Dock */}
        <GlobalTerminalDrawer />
      </div>
    </AuthGuard>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-screen items-center justify-center bg-background text-muted-foreground font-sans text-xs">
          Loading NEIMAN Engineering Workspace…
        </div>
      }
    >
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </Suspense>
  );
}
