'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { NEIMAN_CONFIG } from '@neiman/config';
import {
  Bot,
  GitBranch,
  Briefcase,
  Shield,
  Zap,
  Cpu,
  Boxes,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOrganizationContext } from '@/lib/organizationContext';
import { api } from '@/lib/api/client';
import type { Agent } from '@/lib/api/agents';
import type { Task, ApprovalRequest, ResourceSummary } from '@/lib/api/controlRoom';
import type { Workflow } from '@/lib/api/workflows';
import type { MCPServerConfig } from '@/lib/api/mcp';

interface HeaderOperationalBarProps {
  onOpenDrawer?: (drawerId: string) => void;
  activeDrawerId?: string | null;
}

export function HeaderOperationalBar({ onOpenDrawer, activeDrawerId }: HeaderOperationalBarProps) {
  const pathname = usePathname();
  const activeCompany = useOrganizationContext();
  const companyId = activeCompany?.id || '';
  const [hoveredChip, setHoveredChip] = useState<string | null>(null);

  // Live telemetry metrics
  const { data: telemetry } = useQuery({
    queryKey: ['header-operational-telemetry', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const [agentsRes, tasksRes, approvalsRes, workflowsRes, resourcesRes, mcpRes] = await Promise.allSettled([
        api.get<Agent[]>(`/api/v1/companies/${companyId}/agents`),
        api.get<Task[]>(`/api/v1/companies/${companyId}/tasks`),
        api.get<ApprovalRequest[]>(`/api/v1/companies/${companyId}/governance/approvals?status=PENDING`),
        api.get<Workflow[]>(`/api/v1/companies/${companyId}/workflows`),
        api.get<ResourceSummary>(`/api/v1/companies/${companyId}/resources/control-center`),
        api.get<MCPServerConfig[]>(`/api/v1/companies/${companyId}/mcp/servers`),
      ]);

      const agents = agentsRes.status === 'fulfilled' && Array.isArray(agentsRes.value) ? agentsRes.value : [];
      const tasks = tasksRes.status === 'fulfilled' && Array.isArray(tasksRes.value) ? tasksRes.value : [];
      const approvals = approvalsRes.status === 'fulfilled' && Array.isArray(approvalsRes.value) ? approvalsRes.value : [];
      const workflows = workflowsRes.status === 'fulfilled' && Array.isArray(workflowsRes.value) ? workflowsRes.value : [];
      const resources = resourcesRes.status === 'fulfilled' && resourcesRes.value ? resourcesRes.value : null;
      const mcpServers = mcpRes.status === 'fulfilled' && Array.isArray(mcpRes.value) ? mcpRes.value : [];

      const workingAgents = agents.filter((a) => a.status === 'WORKING' || a.status === 'ACTIVE').length;
      const inProgressTasks = tasks.filter((t) => t.status === 'IN_PROGRESS').length;
      const enabledMcpTools = mcpServers
        .filter((s) => s.is_enabled)
        .reduce((acc, s) => acc + (s.tools?.length ?? 0), 0);

      return {
        agentsTotal: agents.length,
        agentsWorking: workingAgents,
        workflowsCount: workflows.length,
        tasksInProgress: inProgressTasks,
        tasksTotal: tasks.length,
        approvalsPending: approvals.length,
        tokensTotal:
          resources?.token_usage_total !== null && resources?.token_usage_total !== undefined
            ? `${(resources.token_usage_total / 1000).toFixed(1)}k`
            : '—',
        cgroupPct: resources?.compute_used_pct !== null && resources?.compute_used_pct !== undefined
          ? `${resources.compute_used_pct}%`
          : '—',
        mcpToolsCount: mcpRes.status === 'fulfilled' ? `${enabledMcpTools} Tools` : '—',
        mcpServerNames: mcpServers.filter((s) => s.is_enabled).map((s) => s.name).join(', ') || 'No active MCP servers',
      };
    },
    enabled: !!companyId,
    staleTime: NEIMAN_CONFIG.TELEMETRY.STALE_TIMES.NORMAL,
    refetchInterval: NEIMAN_CONFIG.TELEMETRY.POLLING_INTERVALS.BACKGROUND,
  });

  const CHIPS = [
    {
      id: 'agents',
      label: 'Swarm',
      shortcut: '1',
      icon: Bot,
      stat: telemetry ? `${telemetry.agentsWorking}/${telemetry.agentsTotal}` : '0/0',
      href: NEIMAN_CONFIG.ROUTES.DASHBOARD.AGENTS,
      color: 'hover:border-emerald-500/60',
      activeColor: 'bg-emerald-500',
      popover: {
        title: 'Autonomous Swarm [Key 1]',
        desc: `${telemetry?.agentsWorking ?? 0} of ${telemetry?.agentsTotal ?? 0} agents actively executing`,
        sub: 'Click to open AI Workforce Matrix',
      },
    },
    {
      id: 'workflows',
      label: 'Workflows',
      shortcut: '3',
      icon: GitBranch,
      stat: `${telemetry?.workflowsCount ?? 0}`,
      href: NEIMAN_CONFIG.ROUTES.DASHBOARD.WORKFLOWS,
      color: 'hover:border-sky-500/60',
      activeColor: 'bg-sky-500',
      popover: {
        title: 'Autonomous Pipelines [Key 3]',
        desc: `${telemetry?.workflowsCount ?? 0} DAG automation workflows registered`,
        sub: 'Click to open Workflows Studio',
      },
    },
    {
      id: 'tasks',
      label: 'Tasks',
      shortcut: '5',
      icon: Briefcase,
      stat: telemetry ? `${telemetry.tasksInProgress}/${telemetry.tasksTotal}` : '0/0',
      href: NEIMAN_CONFIG.ROUTES.DASHBOARD.TASKS,
      color: 'hover:border-violet-500/60',
      activeColor: 'bg-violet-500',
      popover: {
        title: 'Active Worktrees [Key 5]',
        desc: `${telemetry?.tasksInProgress ?? 0} tasks in-progress across ${telemetry?.tasksTotal ?? 0} total`,
        sub: 'Click to inspect Task Matrix',
      },
    },
    {
      id: 'approvals',
      label: 'Sign-Off',
      shortcut: '6',
      icon: Shield,
      stat: `${telemetry?.approvalsPending ?? 0}`,
      href: NEIMAN_CONFIG.ROUTES.DASHBOARD.APPROVALS,
      isAttention: (telemetry?.approvalsPending ?? 0) > 0,
      color: (telemetry?.approvalsPending ?? 0) > 0 ? 'border-primary/60 text-primary' : 'hover:border-border/80',
      activeColor: 'bg-primary',
      popover: {
        title: 'Executive Gate [Key 6]',
        desc:
          (telemetry?.approvalsPending ?? 0) > 0
            ? `${telemetry?.approvalsPending} actions require human executive approval`
            : 'Constitutional safety boundary nominal',
        sub: 'Click to sign-off or reject actions',
      },
    },
    {
      id: 'intelligence',
      label: 'Tokens',
      icon: Zap,
      stat: telemetry?.tokensTotal ?? '—',
      href: NEIMAN_CONFIG.ROUTES.DASHBOARD.INTELLIGENCE,
      color: 'hover:border-amber-500/60',
      activeColor: 'bg-amber-500',
      popover: {
        title: 'Cognitive Velocity',
        desc: `Measured token consumption across configured model providers`,
        sub: 'Click to inspect Model Hub',
      },
    },
    {
      id: 'resources',
      label: 'Compute',
      icon: Cpu,
      stat: telemetry?.cgroupPct ?? '—',
      href: NEIMAN_CONFIG.ROUTES.DASHBOARD.RESOURCES,
      color: 'hover:border-cyan-500/60',
      activeColor: 'bg-cyan-500',
      popover: {
        title: 'Compute Enclave',
        desc: `Live host compute telemetry from resource monitor`,
        sub: 'Click to inspect Resources Console',
      },
    },
    {
      id: 'mcp',
      label: 'MCP',
      icon: Boxes,
      stat: telemetry?.mcpToolsCount ?? '—',
      href: NEIMAN_CONFIG.ROUTES.DASHBOARD.MCP,
      color: 'hover:border-purple-500/60',
      activeColor: 'bg-purple-500',
      popover: {
        title: 'Model Context Protocol',
        desc: telemetry?.mcpServerNames ?? 'Inspect registered MCP servers',
        sub: 'Click to open MCP Tools Gateway',
      },
    },
  ];

  return (
    <nav
      className="hidden xl:flex items-center gap-1 font-mono text-xs select-none"
      aria-label="Mission Control 360 iconic telemetry"
    >
      <div className="h-4 w-px bg-border/60 mx-1" aria-hidden="true" />
      {CHIPS.map((chip) => {
        const Icon = chip.icon;
        const active = activeDrawerId === chip.id || pathname.startsWith(chip.href);

        return (
          <div
            key={chip.id}
            className="relative"
            onMouseEnter={() => setHoveredChip(chip.id)}
            onMouseLeave={() => setHoveredChip(null)}
          >
            <Link
              href={chip.href}
              onClick={(e) => {
                if (onOpenDrawer && chip.id !== 'mcp') {
                  e.preventDefault();
                  onOpenDrawer(chip.id);
                }
              }}
              className={cn(
                'group flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-mono tabular-nums border transition-all duration-150',
                active
                  ? 'bg-foreground text-background shadow-2xs font-semibold border-foreground'
                  : cn(
                      'text-muted-foreground bg-secondary/30 hover:text-foreground border-border/60 backdrop-blur-md',
                      chip.color
                    )
              )}
            >
              <Icon
                className={cn(
                  'h-3 w-3 shrink-0 transition-transform group-hover:scale-105',
                  chip.isAttention && !active ? 'text-primary animate-pulse' : ''
                )}
                aria-hidden="true"
              />
              <span className="font-bold tabular-nums">{chip.stat}</span>
              {chip.shortcut && (
                <kbd className="hidden 2xl:inline-block text-[8px] px-1 rounded bg-background/60 border border-border/60 text-muted-foreground">
                  {chip.shortcut}
                </kbd>
              )}

              {chip.isAttention && (
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-ping" />
              )}
            </Link>

            {/* Micro HUD Popover Card */}
            {hoveredChip === chip.id && (
              <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50 w-56 rounded-lg border border-border bg-card/95 p-2.5 shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={cn('h-1.5 w-1.5 rounded-full', chip.activeColor)} />
                  <p className="text-[10px] font-bold uppercase tracking-wider text-foreground">
                    {chip.popover.title}
                  </p>
                </div>
                <p className="text-[11px] font-sans text-muted-foreground leading-tight">
                  {chip.popover.desc}
                </p>
                <div className="mt-1.5 pt-1 border-t border-border/40 text-[9px] text-primary flex items-center justify-between">
                  <span>{chip.popover.sub}</span>
                  <span className="font-bold">↵</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
