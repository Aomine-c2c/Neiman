'use client';

import React from 'react';
import {
  Activity,
  AlertTriangle,
  Bot,
  Brain,
  CheckCircle,
  Clock,
  Cpu,
  Database,
  FileCheck,
  FolderGit2,
  Lock,
  Scale,
  Shield,
  Zap,
} from 'lucide-react';
import type { Agent } from '@/lib/api/agents';
import type { ApprovalRequest, AuditLog, DecisionRecord, Project, ResourceSummary, Task } from '@/lib/api/controlRoom';

interface OperationalPulseCardsProps {
  agents: Agent[];
  projects: Project[];
  tasks: Task[];
  approvals: ApprovalRequest[];
  audits: AuditLog[];
  resources: ResourceSummary;
  decisions: DecisionRecord[];
}

export function OperationalPulseCards({
  agents,
  projects,
  tasks,
  approvals,
  audits,
  resources,
  decisions,
}: OperationalPulseCardsProps) {
  const activeAgents = agents.filter((a) => a.status === 'WORKING').length;
  const availableAgents = agents.filter((a) => a.status === 'AVAILABLE').length;
  const blockedAgents = agents.filter((a) => a.status === 'BLOCKED').length;

  const pendingApprovals = approvals.filter((a) => a.status === 'PENDING').length;
  const runningTasks = tasks.filter((t) => t.status === 'IN_PROGRESS').length;
  const blockedTasks = tasks.filter((t) => t.status === 'BLOCKED').length;
  const activeProjects = projects.filter((p) => p.status === 'ACTIVE').length;
  const pendingDecisions = decisions.filter((d) => d.status === 'PROPOSED' || d.status === 'DELIBERATING').length;
  const budgetIsAvailable = resources.budget_spent_usd !== null && resources.budget_allocated_usd !== null;

  return (
    <div className="space-y-4">
      {/* 5 Executive Mission-Critical Inquiries */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-3.5">
        {/* Q1: What is the company doing? */}
        <div className="rounded-xl border border-border/70 bg-card/60 p-4 relative overflow-hidden group hover:border-primary/40 transition-all">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Execution</span>
            <FolderGit2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-foreground">
            {activeProjects} Active Projects
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {runningTasks} {runningTasks === 1 ? 'task' : 'tasks'} currently in automated execution
          </p>
          <div className={`mt-3 flex items-center gap-1.5 text-[11px] font-medium ${blockedTasks ? 'text-amber-400' : 'text-muted-foreground'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${blockedTasks ? 'bg-amber-400' : 'bg-primary'}`} />
            {blockedTasks ? `${blockedTasks} need attention` : `${runningTasks} running · ${tasks.length} tracked`}
          </div>
        </div>

        {/* Q2: What are agents doing? */}
        <div className="rounded-xl border border-border/70 bg-card/60 p-4 relative overflow-hidden group hover:border-primary/40 transition-all">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Agent Workforce State</span>
            <Bot className="h-4 w-4 text-blue-400" />
          </div>
          <div className="text-xl font-bold text-foreground">
            {agents.length} Total Employees
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-xs">
            <span className="text-green-400">{availableAgents} Ready</span>
            <span className="text-muted-foreground/40">•</span>
            <span className="text-yellow-400">{activeAgents} Working</span>
            <span className="text-muted-foreground/40">•</span>
            <span className="text-red-400">{blockedAgents} Blocked</span>
          </div>
          <div className="mt-3 text-[11px] text-muted-foreground font-mono">
            {agents.length ? `${activeAgents + availableAgents + blockedAgents} employees reporting` : 'No employees configured'}
          </div>
        </div>

        {/* Q3: What requires human attention? */}
        <div className="rounded-xl border border-border/70 bg-card/60 p-4 relative overflow-hidden group hover:border-primary/40 transition-all">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Human In The Loop</span>
            <Shield className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold text-foreground flex items-center gap-2">
            {pendingApprovals} Approvals Pending
            {pendingApprovals > 0 && (
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {blockedTasks} {blockedTasks === 1 ? 'task' : 'tasks'} currently blocked
          </p>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-amber-400 font-medium">
            {pendingApprovals ? 'Human review required' : 'No approvals awaiting review'}
          </div>
        </div>

        {/* Q4: What resources are consumed? */}
        <div className="rounded-xl border border-border/70 bg-card/60 p-4 relative overflow-hidden group hover:border-primary/40 transition-all">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Resource Consumption</span>
            <Zap className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="text-xl font-bold text-foreground">
            {budgetIsAvailable ? `$${resources.budget_spent_usd!.toFixed(2)}` : 'Unavailable'}{' '}
            {budgetIsAvailable && <span className="text-xs text-muted-foreground font-normal">/ ${resources.budget_allocated_usd}</span>}
          </div>
          {budgetIsAvailable && <div className="w-full bg-secondary/80 h-1.5 rounded-full mt-2 overflow-hidden"><div className="bg-primary h-full rounded-full transition-all" style={{ width: `${resources.budget_allocated_usd! > 0 ? Math.min(100, (resources.budget_spent_usd! / resources.budget_allocated_usd!) * 100) : 0}%` }} /></div>}
          <div className="mt-2 text-[11px] text-muted-foreground flex justify-between">
            <span>Tokens: {resources.token_usage_total === null ? '—' : `${(resources.token_usage_total / 1000).toFixed(1)}k`}</span>
            <span>Compute: {resources.compute_used_pct === null ? '—' : `${resources.compute_used_pct}%`}</span>
          </div>
        </div>

        {/* Q5: Decisions & Governance */}
        <div className="rounded-xl border border-border/70 bg-card/60 p-4 relative overflow-hidden group hover:border-primary/40 transition-all">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Deliberation & Decisions</span>
            <Scale className="h-4 w-4 text-purple-400" />
          </div>
          <div className="text-xl font-bold text-foreground">
            {pendingDecisions} In Deliberation
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {decisions.length} Immutable decision records
          </p>
          <div className="mt-3 text-[11px] text-purple-400 font-medium">
            {pendingDecisions ? 'Awaiting a decision' : 'No open deliberations'}
          </div>
        </div>
      </div>
    </div>
  );
}
