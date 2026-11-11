'use client';

import React, { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { NEIMAN_CONFIG } from '@neiman/config';
import {
  LayoutDashboard,
  GitBranch,
  Bot,
  Briefcase,
  Zap,
  CheckSquare,
  Shield,
  Layers,
  Activity,
  Cpu,
  Brain,
  Sliders,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Clock,
  Coins,
  CheckCircle2,
  X,
  Users,
  Building2,
  Scale,
  FlaskConical,
  Database,
} from 'lucide-react';

export interface NavModule {
  id: string;
  name: string;
  href: string;
  icon: React.ElementType;
  category: 'core' | 'execution' | 'intelligence' | 'governance';
  badge?: string;
  description: string;
  quickStats?: { label: string; value: string; color?: string }[];
}

export const ALL_NAV_MODULES: NavModule[] = [
  // 1. CORE OPERATING
  {
    id: 'control-room',
    name: 'Control Room',
    href: NEIMAN_CONFIG.ROUTES.DASHBOARD.HOME,
    icon: LayoutDashboard,
    category: 'core',
    description: 'Autonomous company pulse, active missions, and burn rates.',
    quickStats: [
      { label: 'Status', value: 'NOMINAL', color: 'text-emerald-400' },
      { label: 'Health', value: '99.8%', color: 'text-primary' },
    ],
  },
  {
    id: 'organizations',
    name: 'Organizations',
    href: NEIMAN_CONFIG.ROUTES.DASHBOARD.ORGANIZATIONS,
    icon: Building2,
    category: 'core',
    description: 'Corporate entities, legal boundaries, and tenant structures.',
    quickStats: [
      { label: 'Tenant', value: 'Primary Org' },
      { label: 'Status', value: 'ACTIVE' },
    ],
  },
  {
    id: 'organization',
    name: 'Org Map',
    href: NEIMAN_CONFIG.ROUTES.DASHBOARD.ORGANIZATION,
    icon: Layers,
    category: 'core',
    description: 'Interactive company structure, reporting lines, and departments.',
    quickStats: [
      { label: 'Departments', value: '4 Depts' },
      { label: 'Hierarchy', value: 'Direct' },
    ],
  },
  {
    id: 'departments',
    name: 'Departments',
    href: NEIMAN_CONFIG.ROUTES.DASHBOARD.DEPARTMENTS,
    icon: Users,
    category: 'core',
    description: 'Business divisions, departmental budgets, and resource allocation.',
    quickStats: [
      { label: 'Units', value: 'Engineering & Ops' },
      { label: 'Headcount', value: '18 Agents' },
    ],
  },

  // 2. EXECUTION & WORKFORCE
  {
    id: 'agents',
    name: 'AI Workforce',
    href: NEIMAN_CONFIG.ROUTES.DASHBOARD.AGENTS,
    icon: Bot,
    category: 'execution',
    description: 'Autonomous AI workforce directory, missions, tools, and permissions.',
    quickStats: [
      { label: 'Working', value: '6 Agents' },
      { label: 'Autonomy', value: 'HIGH' },
    ],
  },
  {
    id: 'projects',
    name: 'Projects',
    href: NEIMAN_CONFIG.ROUTES.DASHBOARD.PROJECTS,
    icon: Briefcase,
    category: 'execution',
    description: 'Organizational milestones, roadmap tracking, and resource budgets.',
    quickStats: [
      { label: 'Active', value: '3 Projects' },
      { label: 'Velocity', value: '94%' },
    ],
  },
  {
    id: 'tasks',
    name: 'Tasks',
    href: NEIMAN_CONFIG.ROUTES.DASHBOARD.TASKS,
    icon: CheckSquare,
    category: 'execution',
    description: 'Autonomous task queue, agent dispatch, and execution states.',
    quickStats: [
      { label: 'Queue', value: '12 Active' },
      { label: 'Blocked', value: '0 Tasks' },
    ],
  },
  {
    id: 'workflows',
    name: 'Workflows',
    href: NEIMAN_CONFIG.ROUTES.DASHBOARD.WORKFLOWS,
    icon: GitBranch,
    category: 'execution',
    badge: 'Canvas',
    description: 'Visual autonomous pipeline composer & live observability.',
    quickStats: [
      { label: 'Active Pipeline', value: 'Delivery v2' },
      { label: 'Nodes', value: '9 Active' },
    ],
  },

  // 3. INTELLIGENCE & COGNITION
  {
    id: 'intelligence',
    name: 'Intelligence',
    href: NEIMAN_CONFIG.ROUTES.DASHBOARD.INTELLIGENCE,
    icon: Zap,
    category: 'intelligence',
    badge: 'Router',
    description: 'Multi-provider routing engine, model comparison matrix, and circuit breakers.',
    quickStats: [
      { label: 'Providers', value: '4 Online', color: 'text-emerald-400' },
      { label: 'Latency', value: '340ms', color: 'text-amber-400' },
    ],
  },
  {
    id: 'memory',
    name: 'Org Memory',
    href: NEIMAN_CONFIG.ROUTES.DASHBOARD.MEMORY,
    icon: Brain,
    category: 'intelligence',
    description: 'Long-term corporate knowledge repository, vectors, and embeddings.',
    quickStats: [
      { label: 'Chunks', value: '42,900' },
      { label: 'Index', value: 'HNSW Synced' },
    ],
  },
  {
    id: 'evolution',
    name: 'Evolution Lab',
    href: NEIMAN_CONFIG.ROUTES.DASHBOARD.EVOLUTION,
    icon: Sparkles,
    category: 'intelligence',
    description: 'Autonomous self-improvement proposals, architecture mutations, and code refactors.',
    quickStats: [
      { label: 'Proposals', value: '2 Pending' },
      { label: 'Gain', value: '+14% Eff.' },
    ],
  },
  {
    id: 'simulation',
    name: 'Simulation Lab',
    href: NEIMAN_CONFIG.ROUTES.DASHBOARD.SIMULATION,
    icon: FlaskConical,
    category: 'intelligence',
    description: 'Digital twin sandbox, stress tests, and market scenarios.',
    quickStats: [
      { label: 'Scenario', value: 'Latency Surge' },
      { label: 'Resilience', value: '99.4%' },
    ],
  },

  // 4. GOVERNANCE & OVERSIGHT
  {
    id: 'decisions',
    name: 'Decisions',
    href: NEIMAN_CONFIG.ROUTES.DASHBOARD.DECISIONS,
    icon: Scale,
    category: 'governance',
    description: 'Immutable consensus logs, rationale records, and executive deliberations.',
    quickStats: [
      { label: 'Audited', value: '148 Records' },
      { label: 'Consensus', value: 'UNANIMOUS' },
    ],
  },
  {
    id: 'approvals',
    name: 'Approvals',
    href: NEIMAN_CONFIG.ROUTES.DASHBOARD.APPROVALS,
    icon: Shield,
    category: 'governance',
    badge: 'Gate',
    description: 'Executive human sign-offs and constitutional guardrails.',
    quickStats: [
      { label: 'Pending', value: '1 Review', color: 'text-amber-400' },
      { label: 'Tier', value: 'CRITICAL' },
    ],
  },
  {
    id: 'activity',
    name: 'Activity Ledger',
    href: NEIMAN_CONFIG.ROUTES.DASHBOARD.ACTIVITY,
    icon: Activity,
    category: 'governance',
    description: 'Live immutable organizational audit stream and agent telemetry.',
    quickStats: [
      { label: 'Velocity', value: '18 ops/min' },
      { label: 'Audit Trail', value: 'VERIFIED' },
    ],
  },
];

export function HeaderCommandStrip() {
  const pathname = usePathname();
  const router = useRouter();
  const [activePeekId, setActivePeekId] = useState<string | null>(null);

  const activeModule = ALL_NAV_MODULES.find((m) => m.id === activePeekId);

  const handleIconClick = (e: React.MouseEvent, mod: NavModule) => {
    // If Shift, Cmd, Ctrl or Alt is held, navigate immediately
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      router.push(mod.href);
      return;
    }

    // Double-click detection or single click toggles Peek Drawer
    if (activePeekId === mod.id) {
      setActivePeekId(null);
    } else {
      setActivePeekId(mod.id);
    }
  };

  const handleDoubleClick = (mod: NavModule) => {
    setActivePeekId(null);
    router.push(mod.href);
  };

  return (
    <div className="relative flex items-center">
      {/* 1. COMPACT 32PX CONTINUOUS ICON STREAM */}
      <nav
        aria-label="Desktop Module Command Strip"
        className="flex items-center gap-0.5 p-1 rounded-xl bg-secondary/50 border border-border/80 backdrop-blur-md shadow-inner"
      >
        {ALL_NAV_MODULES.map((mod) => {
          const Icon = mod.icon;
          const isActivePath = pathname === mod.href || (mod.href !== '/dashboard' && pathname.startsWith(mod.href));
          const isPeekOpen = activePeekId === mod.id;

          return (
            <div key={mod.id} className="relative group">
              <button
                type="button"
                data-testid={`command-strip-icon-${mod.id}`}
                onClick={(e) => handleIconClick(e, mod)}
                onDoubleClick={() => handleDoubleClick(mod)}
                className={`relative flex items-center justify-center h-8 w-8 rounded-lg transition-all ${
                  isActivePath
                    ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/30 scale-105 font-bold'
                    : isPeekOpen
                    ? 'bg-primary/20 text-primary border border-primary/50'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/80'
                }`}
                title={`${mod.name} (Click for Quick HUD, Double-click to Open Page)`}
                aria-label={mod.name}
              >
                <Icon className="h-4 w-4" />

                {/* Active marker dot */}
                {isActivePath && (
                  <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-2 rounded-full bg-primary-foreground" />
                )}

                {/* Subtle indicator dot */}
                {mod.badge && !isActivePath && (
                  <span className="absolute top-1 right-1 flex h-1.5 w-1.5">
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
                  </span>
                )}
              </button>

              {/* Hover Tooltip */}
              <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 hidden group-hover:block z-50 pointer-events-none animate-fade-in">
                <div className="px-2 py-0.5 rounded-md bg-card/95 border border-border shadow-md backdrop-blur-md text-[10px] font-mono text-foreground whitespace-nowrap">
                  {mod.name}
                </div>
              </div>
            </div>
          );
        })}
      </nav>

      {/* 2. CONTEXTUAL GLASS HUD FLOATING POPOVER (Anchored right below header) */}
      {activeModule && (
        <>
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 z-40 bg-background/20 backdrop-blur-[1px]"
            onClick={() => setActivePeekId(null)}
          />

          {/* Floating Glass HUD Card */}
          <div
            role="dialog"
            aria-label={`${activeModule.name} Quick HUD`}
            className="absolute top-full mt-2.5 left-0 z-50 w-80 rounded-2xl border border-primary/30 bg-card/95 p-4 shadow-2xl backdrop-blur-2xl ring-1 ring-primary/20 animate-in fade-in zoom-in-95 duration-150 select-none"
          >
            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-border/70">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-xs">
                  <activeModule.icon className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    {activeModule.name}
                    {activeModule.badge && (
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                        {activeModule.badge}
                      </span>
                    )}
                  </h4>
                  <p className="text-[10px] text-muted-foreground line-clamp-1">
                    {activeModule.description}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActivePeekId(null)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                title="Close Quick HUD"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Quick Stats Grid */}
            {activeModule.quickStats && (
              <div className="grid grid-cols-2 gap-2 my-3 font-mono text-xs">
                {activeModule.quickStats.map((st, i) => (
                  <div key={i} className="p-2 rounded-xl border border-border/70 bg-secondary/40">
                    <span className="text-[9px] text-muted-foreground block uppercase">
                      {st.label}
                    </span>
                    <strong className={`font-bold ${st.color || 'text-foreground'}`}>
                      {st.value}
                    </strong>
                  </div>
                ))}
              </div>
            )}

            {/* Action Bar */}
            <div className="pt-2.5 border-t border-border/70 flex items-center justify-between gap-2">
              <span className="text-[10px] text-muted-foreground font-mono">
                ⌘+Click to jump
              </span>

              <button
                type="button"
                onClick={() => {
                  router.push(activeModule.href);
                  setActivePeekId(null);
                }}
                className="btn btn-primary text-xs h-7 px-3 gap-1.5 font-bold shadow-sm shadow-primary/20"
              >
                <span>Open Full View</span>
                <ExternalLink className="h-3 w-3" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
