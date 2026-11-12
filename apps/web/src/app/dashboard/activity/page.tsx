'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Bot,
  Layers,
  FolderGit2,
  AlertOctagon,
  AlertTriangle,
  Info,
  CheckCircle2,
  Workflow,
  Cpu,
  ArrowRightLeft,
  Scale,
  Sparkles,
  FlaskConical,
  Wifi,
  WifiOff,
  Search,
  Filter,
  RefreshCw,
  Shield,
  FileCheck,
  Zap,
  SlidersHorizontal,
  ChevronDown,
  Terminal,
  ShieldAlert,
} from 'lucide-react';
import {
  activityApi,
  ActivityEvent,
  ActivityEventType,
  ActivitySeverity,
} from '@/lib/api/activity';
import { useOrganizationContext } from '@/lib/organizationContext';

// All 14 specified event types
const EVENT_TYPES: { id: string; label: string; icon: typeof Activity; group: string }[] = [
  { id: 'ALL', label: 'All Events', icon: Activity, group: 'General' },
  { id: 'agent_started', label: 'agent_started', icon: Bot, group: 'Agent' },
  { id: 'agent_completed', label: 'agent_completed', icon: CheckCircle2, group: 'Agent' },
  { id: 'task_created', label: 'task_created', icon: Activity, group: 'Task' },
  { id: 'task_failed', label: 'task_failed', icon: AlertOctagon, group: 'Task' },
  { id: 'workflow_started', label: 'workflow_started', icon: Workflow, group: 'Workflow' },
  { id: 'workflow_completed', label: 'workflow_completed', icon: CheckCircle2, group: 'Workflow' },
  { id: 'approval_requested', label: 'approval_requested', icon: Shield, group: 'Governance' },
  { id: 'approval_completed', label: 'approval_completed', icon: FileCheck, group: 'Governance' },
  { id: 'provider_failed', label: 'provider_failed', icon: AlertTriangle, group: 'Provider' },
  { id: 'provider_switched', label: 'provider_switched', icon: ArrowRightLeft, group: 'Provider' },
  { id: 'resource_threshold', label: 'resource_threshold', icon: Cpu, group: 'Resource' },
  { id: 'decision_created', label: 'decision_created', icon: Scale, group: 'Governance' },
  { id: 'evolution_proposed', label: 'evolution_proposed', icon: Sparkles, group: 'Evolution' },
  { id: 'simulation_completed', label: 'simulation_completed', icon: FlaskConical, group: 'Simulation' },
  { id: 'runtime_execution_completed', label: 'runtime_execution_completed', icon: Terminal, group: 'Runtime' },
  { id: 'runtime_execution_blocked', label: 'runtime_execution_blocked', icon: ShieldAlert, group: 'Runtime' },
];

const SEVERITIES: { id: string; label: string; bg: string; text: string; border: string }[] = [
  { id: 'ALL', label: 'All Severities', bg: 'bg-secondary', text: 'text-foreground', border: 'border-border' },
  { id: 'CRITICAL', label: 'Critical', bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30' },
  { id: 'HIGH', label: 'High', bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  { id: 'MEDIUM', label: 'Medium', bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  { id: 'LOW', label: 'Low', bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
  { id: 'INFO', label: 'Info', bg: 'bg-zinc-500/10', text: 'text-zinc-400', border: 'border-zinc-500/30' },
];

export default function RealtimeActivityPage() {
  const activeCompany = useOrganizationContext();
  const companyId = activeCompany?.id || '';

  // Filter States
  const [filterAgent, setFilterAgent] = useState<string>('ALL');
  const [filterDepartment, setFilterDepartment] = useState<string>('ALL');
  const [filterProject, setFilterProject] = useState<string>('ALL');
  const [filterEvent, setFilterEvent] = useState<string>('ALL');
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Feed Virtualization / Pagination state
  const [visibleLimit, setVisibleLimit] = useState<number>(30);

  // Realtime Live Stream state
  const [liveEvents, setLiveEvents] = useState<ActivityEvent[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'CONNECTING' | 'CONNECTED' | 'DISCONNECTED'>('CONNECTING');
  const [transportType, setTransportType] = useState<'Polling' | 'Static Preview'>('Polling');

  // Initial HTTP hydration via React Query
  const { data: initialData, refetch, isError, isSuccess } = useQuery({
    queryKey: ['activity-events-initial', companyId],
    queryFn: () => activityApi.getRecentActivity(companyId, { limit: 50 }),
    enabled: !!companyId,
    staleTime: 0,
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  });

  // Merge the authenticated HTTP feed into local state; native browser streams cannot
  // attach the application's Bearer token, so polling preserves tenant authorization.
  useEffect(() => {
    if (initialData) {
      setLiveEvents((previous) => {
        const known = new Set(previous.map((event) => event.id));
        const additions = initialData.filter((event) => !known.has(event.id));
        return additions.length ? [...additions, ...previous].slice(0, 200) : previous;
      });
    }
    setConnectionStatus(isError ? 'DISCONNECTED' : isSuccess ? 'CONNECTED' : 'CONNECTING');
    setTransportType('Polling');
  }, [companyId, initialData, isError, isSuccess]);

  // Extract unique filter lists dynamically from loaded data
  const availableAgents = useMemo(() => {
    const set = new Set<string>();
    liveEvents.forEach((e) => e.agent_name && set.add(e.agent_name));
    return ['ALL', ...Array.from(set)];
  }, [liveEvents]);

  const availableDepartments = useMemo(() => {
    const set = new Set<string>();
    liveEvents.forEach((e) => e.department_name && set.add(e.department_name));
    return ['ALL', ...Array.from(set)];
  }, [liveEvents]);

  const availableProjects = useMemo(() => {
    const set = new Set<string>();
    liveEvents.forEach((e) => e.project_name && set.add(e.project_name));
    return ['ALL', ...Array.from(set)];
  }, [liveEvents]);

  // Apply Active Filters
  const filteredEvents = useMemo(() => {
    return liveEvents.filter((item) => {
      // 1. Agent filter
      if (filterAgent !== 'ALL' && item.agent_name !== filterAgent) return false;
      // 2. Department filter
      if (filterDepartment !== 'ALL' && item.department_name !== filterDepartment) return false;
      // 3. Project filter
      if (filterProject !== 'ALL' && item.project_name !== filterProject) return false;
      // 4. Event filter
      if (filterEvent !== 'ALL' && item.event_type !== filterEvent) return false;
      // 5. Severity filter
      if (filterSeverity !== 'ALL' && item.severity !== filterSeverity) return false;

      // Free text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inTitle = item.title?.toLowerCase().includes(q);
        const inSummary = item.summary?.toLowerCase().includes(q);
        const inActor = item.agent_name?.toLowerCase().includes(q);
        const inDept = item.department_name?.toLowerCase().includes(q);
        const inProj = item.project_name?.toLowerCase().includes(q);
        return inTitle || inSummary || inActor || inDept || inProj;
      }

      return true;
    });
  }, [liveEvents, filterAgent, filterDepartment, filterProject, filterEvent, filterSeverity, searchQuery]);

  // Helper renderers
  const getEventIcon = (eventType: ActivityEventType) => {
    const match = EVENT_TYPES.find((e) => e.id === eventType);
    if (!match) return Activity;
    return match.icon;
  };

  const getSeverityBadge = (sev: ActivitySeverity) => {
    const match = SEVERITIES.find((s) => s.id === sev) || SEVERITIES[5];
    return match;
  };

  return (
    <div className="w-full space-y-6 animate-fade-in pb-12">
      {/* Header with Transport Status Pill */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Realtime Activity Stream</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live event pipeline capturing autonomous agent actions, workflows, approvals, and resilience signals.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Live Socket Transport Indicator */}
          <div className="flex items-center gap-2 rounded-xl bg-card border border-border px-3.5 py-1.5 text-xs font-mono shadow-sm">
            {connectionStatus === 'CONNECTED' ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-emerald-400 font-semibold">{transportType} Live</span>
              </>
            ) : connectionStatus === 'CONNECTING' ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
                <span className="text-amber-400">Connecting...</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3.5 w-3.5 text-rose-400" />
                <span className="text-rose-400">Disconnected</span>
              </>
            )}
          </div>

          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-secondary/50 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* 5 Filter Ribbons: Agent, Department, Project, Event, Severity */}
      <div className="rounded-2xl border border-border bg-card/60 p-4 space-y-4 shadow-sm backdrop-blur-md">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              className="input pl-9 text-xs w-full h-9 bg-secondary/40 border border-border rounded-xl"
              placeholder="Search across title, summary, actor, or payload..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Quick Stats Pill */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
            <span>Showing</span>
            <span className="font-bold text-foreground px-2 py-0.5 rounded-md bg-secondary border border-border">
              {filteredEvents.length} of {liveEvents.length}
            </span>
            <span>events</span>
          </div>
        </div>

        {/* Filter Selectors Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 pt-2 border-t border-border/60">
          {/* 1. AGENT FILTER */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
              <Bot className="h-3.5 w-3.5 text-primary" />
              <span>Agent</span>
            </label>
            <select
              value={filterAgent}
              onChange={(e) => setFilterAgent(e.target.value)}
              className="select w-full h-8 text-xs bg-secondary/40 border border-border rounded-lg"
            >
              {availableAgents.map((ag) => (
                <option key={ag} value={ag}>
                  {ag === 'ALL' ? 'All Agents' : ag}
                </option>
              ))}
            </select>
          </div>

          {/* 2. DEPARTMENT FILTER */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
              <Layers className="h-3.5 w-3.5 text-cyan-400" />
              <span>Department</span>
            </label>
            <select
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              className="select w-full h-8 text-xs bg-secondary/40 border border-border rounded-lg"
            >
              {availableDepartments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept === 'ALL' ? 'All Departments' : dept}
                </option>
              ))}
            </select>
          </div>

          {/* 3. PROJECT FILTER */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
              <FolderGit2 className="h-3.5 w-3.5 text-purple-400" />
              <span>Project</span>
            </label>
            <select
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
              className="select w-full h-8 text-xs bg-secondary/40 border border-border rounded-lg"
            >
              {availableProjects.map((prj) => (
                <option key={prj} value={prj}>
                  {prj === 'ALL' ? 'All Projects' : prj}
                </option>
              ))}
            </select>
          </div>

          {/* 4. EVENT TYPE FILTER */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
              <Activity className="h-3.5 w-3.5 text-emerald-400" />
              <span>Event</span>
            </label>
            <select
              value={filterEvent}
              onChange={(e) => setFilterEvent(e.target.value)}
              className="select w-full h-8 text-xs bg-secondary/40 border border-border rounded-lg"
            >
              {EVENT_TYPES.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.label}
                </option>
              ))}
            </select>
          </div>

          {/* 5. SEVERITY FILTER */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
              <span>Severity</span>
            </label>
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="select w-full h-8 text-xs bg-secondary/40 border border-border rounded-lg"
            >
              {SEVERITIES.map((sev) => (
                <option key={sev.id} value={sev.id}>
                  {sev.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Realtime Stream Feed */}
      {filteredEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border py-20 bg-card/20">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary/50 text-muted-foreground">
            <Activity className="h-8 w-8" />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-semibold text-foreground">No events match active filter</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Try adjusting the agent, department, project, event type, or severity filters.
            </p>
            <button
              onClick={() => {
                setFilterAgent('ALL');
                setFilterDepartment('ALL');
                setFilterProject('ALL');
                setFilterEvent('ALL');
                setFilterSeverity('ALL');
                setSearchQuery('');
              }}
              className="mt-4 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90"
            >
              Reset Filters
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEvents.slice(0, visibleLimit).map((item) => {
            const Icon = getEventIcon(item.event_type);
            const sevBadge = getSeverityBadge(item.severity);

            return (
              <div
                key={item.id}
                className="group relative flex flex-col md:flex-row md:items-start justify-between gap-4 rounded-2xl border border-border bg-card/70 p-4 hover:border-primary/50 hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  {/* Event Type Icon Badge */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary/80 border border-border text-primary group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                    <Icon className="h-5 w-5" />
                  </div>

                  {/* Body Content */}
                  <div className="min-w-0 space-y-1 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{item.title}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-secondary text-primary font-medium border border-border">
                        {item.event_type}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {item.summary}
                    </p>

                    {/* Metadata tags */}
                    <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-muted-foreground">
                      {item.agent_name && (
                        <span className="inline-flex items-center gap-1">
                          <Bot className="h-3 w-3 text-primary" />
                          <span className="text-foreground font-medium">{item.agent_name}</span>
                        </span>
                      )}
                      {item.department_name && (
                        <span className="inline-flex items-center gap-1">
                          <Layers className="h-3 w-3 text-cyan-400" />
                          <span>{item.department_name}</span>
                        </span>
                      )}
                      {item.project_name && (
                        <span className="inline-flex items-center gap-1">
                          <FolderGit2 className="h-3 w-3 text-purple-400" />
                          <span>{item.project_name}</span>
                        </span>
                      )}
                    </div>

                    {/* Payloads Inspector (if available) */}
                    {item.payload && Object.keys(item.payload).length > 0 && (
                      <div className="mt-2 text-[10px] font-mono bg-secondary/30 rounded-lg p-2 border border-border/50 text-muted-foreground max-w-2xl overflow-x-auto">
                        <span className="text-foreground/80 font-semibold">payload: </span>
                        {JSON.stringify(item.payload)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right side Severity & Timestamp */}
                <div className="flex md:flex-col items-center md:items-end justify-between shrink-0 gap-2 text-xs pt-1">
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold font-mono uppercase tracking-wider ${sevBadge.bg} ${sevBadge.text} ${sevBadge.border}`}
                  >
                    {item.severity}
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {new Date(item.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            );
          })}

          {filteredEvents.length > visibleLimit && (
            <div className="pt-2 flex justify-center">
              <button
                type="button"
                onClick={() => setVisibleLimit((prev) => prev + 30)}
                className="px-4 py-2 text-xs font-mono font-medium rounded-xl border border-dashed border-border hover:border-primary/50 text-muted-foreground hover:text-foreground transition-all bg-card/50"
              >
                + Load {Math.min(30, filteredEvents.length - visibleLimit)} more events ({filteredEvents.length - visibleLimit} remaining)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
