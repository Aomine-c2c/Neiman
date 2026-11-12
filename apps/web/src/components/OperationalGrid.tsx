'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Brain,
  CheckCircle,
  Clock,
  Cpu,
  Database,
  ExternalLink,
  FileCheck,
  FolderGit2,
  Lock,
  Scale,
  Shield,
  Sparkles,
  Zap,
  Building2,
  Activity,
  Layers,
  ChevronRight,
  TrendingUp,
  Flame,
  Check,
  X,
  Sliders,
  DollarSign,
  AlertCircle,
  History,
} from 'lucide-react';
import type { Agent } from '@/lib/api/agents';
import type { Department } from '@/lib/api/organizations';
import type {
  ApprovalRequest,
  AuditLog,
  DecisionRecord,
  MemoryItem,
  ModelProviderInfo,
  Policy,
  Project,
  ResourceSummary,
  Task,
} from '@/lib/api/controlRoom';
import { OrganizationActivityTimeline } from '@/components/OrganizationActivityTimeline';

interface OperationalGridProps {
  companyId: string;
  departments?: Department[];
  agents: Agent[];
  projects: Project[];
  tasks: Task[];
  approvals: ApprovalRequest[];
  audits: AuditLog[];
  resources: ResourceSummary;
  decisions: DecisionRecord[];
  policies: Policy[];
  memories: MemoryItem[];
  providers: ModelProviderInfo[];
  previewMode?: boolean;
  onDecideApproval?: (approvalId: string, decision: 'APPROVED' | 'REJECTED') => void;
}

export function OperationalGrid({
  companyId,
  departments = [],
  agents,
  projects,
  tasks,
  approvals,
  audits,
  resources,
  decisions,
  policies,
  memories,
  providers,
  previewMode = false,
  onDecideApproval,
}: OperationalGridProps) {
  const [filterDomain, setFilterDomain] = useState<'ALL' | 'EXECUTION' | 'GOVERNANCE' | 'RESOURCES'>('ALL');

  // Compute problems/alerts
  const blockedTasks = tasks.filter((t) => t.status === 'BLOCKED');
  const criticalApprovals = approvals.filter((a) => a.risk_level === 'CRITICAL' || a.risk_level === 'HIGH');
  const degradedProviders = providers.filter((p) => p.status !== 'ONLINE');

  return (
    <div className="space-y-6">
      {/* Real-time Incident & Alert Banner if anything is blocked or degraded */}
      {(blockedTasks.length > 0 || criticalApprovals.length > 0 || degradedProviders.length > 0) && (
        <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
              <AlertTriangle className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 font-mono">
                Attn Required: Operational Blockers & Governance Interventions
              </h4>
              <p className="text-xs text-foreground/90 mt-0.5">
                {blockedTasks.length} tasks blocked / awaiting signoff · {criticalApprovals.length} high-risk approval gates active · {degradedProviders.length} providers degraded
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/governance"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-black transition-colors"
            >
              Resolve in Governance
            </Link>
          </div>
        </div>
      )}

      {/* Grid Layout of the 15 Operational Domains */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* ============================================================== */}
        {/* DOMAIN 1: DEPARTMENTS & ORGANIZATIONAL STRUCTURE              */}
        {/* ============================================================== */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4 hover:border-primary/40 transition-colors shadow-sm">
          <div className="flex items-center justify-between pb-2 border-b border-border/60">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-indigo-400" />
              <h3 className="text-sm font-semibold text-foreground">1. Departments</h3>
            </div>
            <Link href="/dashboard/organizations" className="text-xs text-primary hover:underline flex items-center gap-1 font-mono">
              {departments.length} Depts <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="space-y-2.5">
            {departments.slice(0, 4).map((d) => (
              <div key={d.id} className="rounded-xl bg-secondary/30 border border-border/50 p-3 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-foreground">{d.name}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[200px]">{d.purpose}</div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-secondary text-muted-foreground font-bold">
                  {d.status}
                </span>
              </div>
            ))}
            {departments.length === 0 && (
              <div className="text-center py-6 text-xs text-muted-foreground">
                No departments configured yet
              </div>
            )}
          </div>
        </div>

        {/* ============================================================== */}
        {/* DOMAIN 2: AGENT WORKFORCE                                      */}
        {/* ============================================================== */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4 hover:border-primary/40 transition-colors shadow-sm">
          <div className="flex items-center justify-between pb-2 border-b border-border/60">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-blue-400" />
              <h3 className="text-sm font-semibold text-foreground">2. Agent Workforce</h3>
            </div>
            <Link href="/dashboard/agents" className="text-xs text-primary hover:underline flex items-center gap-1 font-mono">
              {agents.length} Agents <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="space-y-2.5">
            {agents.slice(0, 4).map((ag) => (
              <div key={ag.id} className="flex items-center justify-between rounded-xl bg-secondary/30 p-2.5 border border-border/50 hover:border-primary/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-foreground">{ag.name}</h4>
                    <p className="text-[10px] text-muted-foreground font-mono">Autonomy: {ag.autonomy}</p>
                  </div>
                </div>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                  ag.status === 'WORKING' ? 'bg-amber-500/20 text-amber-400' :
                  ag.status === 'BLOCKED' ? 'bg-rose-500/20 text-rose-400' :
                  'bg-emerald-500/20 text-emerald-400'
                }`}>
                  {ag.status}
                </span>
              </div>
            ))}
            {agents.length === 0 && (
              <div className="text-center py-6 text-xs text-muted-foreground">
                No agents configured yet
              </div>
            )}
          </div>
        </div>

        {/* ============================================================== */}
        {/* DOMAIN 3: PROJECTS                                            */}
        {/* ============================================================== */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4 hover:border-primary/40 transition-colors shadow-sm">
          <div className="flex items-center justify-between pb-2 border-b border-border/60">
            <div className="flex items-center gap-2">
              <FolderGit2 className="h-4 w-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-foreground">3. Active Projects</h3>
            </div>
            <span className="text-xs font-mono text-muted-foreground">{projects.length} Total</span>
          </div>

          <div className="space-y-3">
            {projects.slice(0, 3).map((p) => (
              <div key={p.id} className="rounded-xl border border-border/50 bg-secondary/30 p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground truncate max-w-[190px]">{p.name}</span>
                  <span className={`text-[10px] font-mono font-bold ${p.status === 'COMPLETED' || p.status === 'ACTIVE' ? 'text-primary' : p.status === 'ON_HOLD' || p.status === 'CANCELLED' ? 'text-amber-300' : 'text-muted-foreground'}`}>{p.status}</span>
                </div>
                <div className="text-[11px] text-muted-foreground">Priority: {p.priority}</div>
              </div>
            ))}
            {projects.length === 0 && (
              <div className="text-center py-6 text-xs text-muted-foreground">
                No active projects initialized
              </div>
            )}
          </div>
        </div>

        {/* ============================================================== */}
        {/* DOMAIN 4: TASKS (WHAT IS RUNNING / BLOCKED)                    */}
        {/* ============================================================== */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4 hover:border-primary/40 transition-colors shadow-sm">
          <div className="flex items-center justify-between pb-2 border-b border-border/60">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-foreground">4. Tasks Execution</h3>
            </div>
            <span className="text-xs font-mono text-muted-foreground">{tasks.length} Tracked</span>
          </div>

          <div className="space-y-2.5">
            {tasks.slice(0, 4).map((t) => (
              <div key={t.id} className="rounded-xl border border-border/50 bg-secondary/20 p-2.5 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-foreground truncate max-w-[180px]">{t.title}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">Priority: {t.priority}</div>
                </div>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                  t.status === 'IN_PROGRESS' ? 'bg-amber-500/20 text-amber-300' :
                  t.status === 'BLOCKED' ? 'bg-rose-500/20 text-rose-300' :
                  'bg-secondary text-foreground'
                }`}>
                  {t.status}
                </span>
              </div>
            ))}
            {tasks.length === 0 && <p className="py-5 text-center text-xs text-muted-foreground">No tasks reported for these projects.</p>}
          </div>
        </div>

        {/* ============================================================== */}
        {/* DOMAIN 5: RESOURCE UTILIZATION (FINANCIAL & COMPUTE)          */}
        {/* ============================================================== */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4 hover:border-primary/40 transition-colors shadow-sm">
          <div className="flex items-center justify-between pb-2 border-b border-border/60">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-foreground">5. Resource Engine</h3>
            </div>
            <Link href="/dashboard/resources" className="text-xs text-primary hover:underline flex items-center gap-1 font-mono">
              Pools <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="space-y-3">
            <div className="rounded-xl bg-secondary/30 p-3 border border-border/50">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Budget Spent</span>
                <span className="font-mono text-foreground font-bold">{resources.budget_spent_usd === null || resources.budget_allocated_usd === null ? 'Unavailable' : `$${resources.budget_spent_usd.toFixed(2)} / $${resources.budget_allocated_usd}`}</span>
              </div>
              {resources.budget_spent_usd !== null && resources.budget_allocated_usd !== null && <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                <div
                  className="bg-primary h-full rounded-full transition-all"
                  style={{ width: `${resources.budget_allocated_usd > 0 ? Math.min(100, (resources.budget_spent_usd / resources.budget_allocated_usd) * 100) : 0}%` }}
                />
              </div>}
            </div>

            <div className="grid grid-cols-2 gap-2 text-center text-xs">
              <div className="p-2.5 rounded-xl bg-secondary/20 border border-border/40">
                <div className="text-[10px] text-muted-foreground font-mono">Tokens Used</div>
                <div className="font-bold text-foreground mt-0.5">{resources.token_usage_total === null ? '—' : `${(resources.token_usage_total / 1000).toFixed(1)}k`}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-secondary/20 border border-border/40">
                <div className="text-[10px] text-muted-foreground font-mono">Compute Load</div>
                <div className="font-bold text-primary mt-0.5">{resources.compute_used_pct === null ? '—' : `${resources.compute_used_pct}%`}</div>
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* DOMAIN 6: INTELLIGENCE EXCHANGE & MODEL PROVIDERS              */}
        {/* ============================================================== */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4 hover:border-primary/40 transition-colors shadow-sm">
          <div className="flex items-center justify-between pb-2 border-b border-border/60">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-purple-400" />
              <h3 className="text-sm font-semibold text-foreground">6. Intelligence Usage</h3>
            </div>
            <Link href="/dashboard/intelligence" className="text-xs text-primary hover:underline flex items-center gap-1 font-mono">
              Routing <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="space-y-2.5">
            {providers.map((p) => (
              <div key={p.id} className="rounded-xl border border-border/50 bg-secondary/20 p-2.5 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${p.status === 'ONLINE' ? 'bg-primary' : p.status === 'DEGRADED' ? 'bg-amber-400' : 'bg-rose-400'}`} />
                    <span className="text-xs font-semibold text-foreground">{p.name}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                    {p.avg_latency_ms === null ? 'Latency —' : `${p.avg_latency_ms}ms`} · {p.total_tokens === null ? 'Usage —' : `${(p.total_tokens / 1000).toFixed(0)}k tok`}
                  </p>
                </div>
                <div className="text-right">
                  <span className={`text-[10px] font-bold font-mono ${p.status === 'ONLINE' ? 'text-primary' : p.status === 'DEGRADED' ? 'text-amber-300' : 'text-rose-300'}`}>{p.status}</span>
                  <div className="text-xs font-bold text-foreground font-mono">{p.cost_usd === null ? 'Cost —' : `$${p.cost_usd.toFixed(2)}`}</div>
                  <div className="text-[9px] text-muted-foreground">{p.active_requests === null ? 'Activity —' : `${p.active_requests} in-flight`}</div>
                </div>
              </div>
            ))}
            {providers.length === 0 && <p className="py-5 text-center text-xs text-muted-foreground">No provider telemetry returned.</p>}
          </div>
        </div>

        {/* ============================================================== */}
        {/* DOMAIN 7: DECISIONS & DELIBERATION RECORDS                     */}
        {/* ============================================================== */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4 hover:border-primary/40 transition-colors shadow-sm">
          <div className="flex items-center justify-between pb-2 border-b border-border/60">
            <div className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-pink-400" />
              <h3 className="text-sm font-semibold text-foreground">7. Decisions</h3>
            </div>
            <Link href="/dashboard/decisions" className="text-xs text-primary hover:underline flex items-center gap-1 font-mono">
              Audit <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="space-y-2.5">
            {decisions.slice(0, 3).map((dec) => (
              <div key={dec.id} className="rounded-xl border border-border/50 bg-secondary/20 p-3 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground truncate max-w-[190px]">{dec.problem}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary text-primary font-bold">
                    {dec.status}
                  </span>
                </div>
                {dec.decision && (
                  <p className="text-[11px] text-muted-foreground line-clamp-2">{dec.decision}</p>
                )}
              </div>
            ))}
            {decisions.length === 0 && (
              <div className="text-center py-6 text-xs text-muted-foreground">
                No formal decisions recorded
              </div>
            )}
          </div>
        </div>

        {/* ============================================================== */}
        {/* DOMAIN 8: HUMAN APPROVALS GATE                                */}
        {/* ============================================================== */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4 hover:border-primary/40 transition-colors shadow-sm">
          <div className="flex items-center justify-between pb-2 border-b border-border/60">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-foreground">8. Approvals (Human In Loop)</h3>
            </div>
            <span className="badge badge-warning text-[10px] font-mono">{approvals.length} Pending</span>
          </div>

          <div className="space-y-3">
            {approvals.length > 0 ? (
              approvals.map((req) => (
                <div key={req.id} className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">{req.action_type || req.action || req.title || 'AUTONOMOUS_ACTION'}</span>
                    <span className="text-[9px] font-mono font-bold text-amber-400 bg-black/40 px-1.5 py-0.5 rounded border border-amber-500/30">
                      {req.risk_level}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{req.reason}</p>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => onDecideApproval?.(req.id, 'APPROVED')}
                      disabled={!onDecideApproval}
                      title={!onDecideApproval ? 'Read-only synthetic preview' : undefined}
                      className="px-3 py-1 rounded text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white flex-1 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Authorize
                    </button>
                    <button
                      type="button"
                      onClick={() => onDecideApproval?.(req.id, 'REJECTED')}
                      disabled={!onDecideApproval}
                      title={!onDecideApproval ? 'Read-only synthetic preview' : undefined}
                      className="px-3 py-1 rounded text-xs font-semibold bg-secondary hover:bg-secondary/80 text-foreground flex-1 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Deny
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-border/40 bg-secondary/20 p-6 text-center text-xs text-muted-foreground">
                <CheckCircle className="h-6 w-6 text-emerald-400 mx-auto mb-2 opacity-80" />
                Zero actions currently blocked
              </div>
            )}
          </div>
        </div>

        {/* ============================================================== */}
        {/* DOMAIN 9: ORGANIZATIONAL MEMORY & KNOWLEDGE                   */}
        {/* ============================================================== */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4 hover:border-primary/40 transition-colors shadow-sm">
          <div className="flex items-center justify-between pb-2 border-b border-border/60">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-violet-400" />
              <h3 className="text-sm font-semibold text-foreground">9. Company Memory</h3>
            </div>
            <Link href="/dashboard/memory" className="text-xs text-primary hover:underline flex items-center gap-1 font-mono">
              Knowledge <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="space-y-2.5">
            {memories.slice(0, 3).map((m) => (
              <div key={m.id} className="rounded-xl border border-border/50 bg-secondary/20 p-2.5 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">{m.title}</span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300">
                    {m.domain}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-2">{m.content}</p>
              </div>
            ))}
            {memories.length === 0 && (
              <div className="text-center py-6 text-xs text-muted-foreground">
                No organization memories recorded
              </div>
            )}
          </div>
        </div>

        {/* ============================================================== */}
        {/* DOMAIN 10: POLICIES & CONSTITUTIONAL BOUNDARIES               */}
        {/* ============================================================== */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4 hover:border-primary/40 transition-colors shadow-sm">
          <div className="flex items-center justify-between pb-2 border-b border-border/60">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-rose-400" />
              <h3 className="text-sm font-semibold text-foreground">10. Governance Policies</h3>
            </div>
            <Link href="/dashboard/governance" className="text-xs text-primary hover:underline flex items-center gap-1 font-mono">
              Constitution <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="space-y-2.5">
            {policies.slice(0, 3).map((pol) => (
              <div key={pol.id} className="rounded-xl border border-border/50 bg-secondary/20 p-2.5 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-foreground">{pol.name}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Scope: {pol.scope}</div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300">
                  {pol.enforcement_level}
                </span>
              </div>
            ))}
            {policies.length === 0 && (
              <div className="text-center py-6 text-xs text-muted-foreground">
                Constitutional baseline loaded
              </div>
            )}
          </div>
        </div>

        {/* ============================================================== */}
        {/* DOMAIN 11: PERFORMANCE & SLA MONITORING                       */}
        {/* ============================================================== */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4 hover:border-primary/40 transition-colors shadow-sm">
          <div className="flex items-center justify-between pb-2 border-b border-border/60">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-teal-400" />
              <h3 className="text-sm font-semibold text-foreground">11. Performance & SLAs</h3>
            </div>
            {previewMode && <span className="text-[10px] font-mono text-amber-300">SAMPLE METRICS</span>}
          </div>

          {previewMode ? <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center p-2 rounded-lg bg-secondary/30">
              <span className="text-muted-foreground">Task Completion SLA</span>
              <span className="font-mono text-foreground font-bold">98.4% On Schedule</span>
            </div>
            <div className="flex justify-between items-center p-2 rounded-lg bg-secondary/30">
              <span className="text-muted-foreground">Average Deliberation Time</span>
              <span className="font-mono text-cyan-400 font-bold">1.2m</span>
            </div>
            <div className="flex justify-between items-center p-2 rounded-lg bg-secondary/30">
              <span className="text-muted-foreground">Policy Drift Index</span>
              <span className="font-mono text-emerald-400 font-bold">0.00% Zero Drift</span>
            </div>
          </div> : <p className="py-4 text-center text-xs text-muted-foreground">Performance telemetry is not available from the connected organization API.</p>}
        </div>

        {/* ============================================================== */}
        {/* DOMAIN 12: CONSEQUENTIAL AUDIT TIMELINE                       */}
        {/* ============================================================== */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4 hover:border-primary/40 transition-colors shadow-sm">
          <div className="flex items-center justify-between pb-2 border-b border-border/60">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-foreground">12. Activity Timeline</h3>
            </div>
            <Link href="/dashboard/activity" className="text-xs text-primary hover:underline flex items-center gap-1 font-mono">
              Feed <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <OrganizationActivityTimeline audits={audits} maxItems={4} />
        </div>
      </div>
    </div>
  );
}
