'use client';

import React, { useState, useMemo, useRef } from 'react';
import {
  Building2,
  Users,
  Bot,
  FolderGit2,
  CheckSquare,
  Scale,
  FileSearch,
  ChevronRight,
  ChevronDown,
  ZoomIn,
  ZoomOut,
  X,
  Shield,
  Zap,
  Search,
  ArrowRight,
  Cpu,
  Briefcase,
} from 'lucide-react';
import type { Agent } from '@/lib/api/agents';
import type { Department, OrgRole } from '@/lib/api/organizations';
import type { Project, Task, DecisionRecord, AuditLog } from '@/lib/api/controlRoom';

export interface GraphNode {
  id: string;
  type: 'company' | 'department' | 'role' | 'agent' | 'project' | 'task' | 'decision' | 'evidence';
  title: string;
  subtitle?: string;
  status?: string;
  data: Record<string, unknown>;
  parentId?: string;
  departmentId?: string;
  roleId?: string;
  managerId?: string;
  projectId?: string;
  agentId?: string;
}

export type AgentOperationalStatus =
  | 'AVAILABLE'
  | 'WORKING'
  | 'BLOCKED'
  | 'WAITING'
  | 'PAUSED'
  | 'OFFLINE';

interface OrganizationalGraphProps {
  companyName: string;
  companyStatus?: string;
  departments: Department[];
  agents: Agent[];
  projects: Project[];
  tasks: Task[];
  decisions?: DecisionRecord[];
  roles?: OrgRole[];
  audits?: AuditLog[];
}

export function OrganizationalGraph({
  companyName,
  companyStatus,
  departments,
  agents,
  projects,
  tasks,
  decisions = [],
  roles = [],
  audits = [],
}: OrganizationalGraphProps) {
  // Canvas viewport state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  // Search & Filter controls state
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Hierarchy toggle state: collapsed departments
  const [collapsedDepts, setCollapsedDepts] = useState<Set<string>>(new Set());

  // Selection & Inspector state
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  // Virtualization / Pagination for large node counts
  const [maxNodesPerColumn, setMaxNodesPerColumn] = useState<number>(30);

  const toggleDeptCollapse = (deptId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedDepts((prev) => {
      const next = new Set(prev);
      if (next.has(deptId)) {
        next.delete(deptId);
      } else {
        next.add(deptId);
      }
      return next;
    });
  };

  // Build the unified organizational graph nodes & relationships
  const { allNodes, edges } = useMemo(() => {
    const nList: GraphNode[] = [];
    const eList: { from: string; to: string; label?: string }[] = [];

    const rootId = 'root-company';
    nList.push({
      id: rootId,
      type: 'company',
      title: companyName || 'NEIMAN Enterprise',
      subtitle: 'Autonomous Organization Root',
      status: companyStatus || 'ACTIVE',
      data: { name: companyName, status: companyStatus },
    });

    // 1. DEPARTMENTS
    departments.forEach((dept) => {
      const deptNodeId = `dept-${dept.id}`;
      nList.push({
        id: deptNodeId,
        type: 'department',
        title: dept.name,
        subtitle: dept.purpose ?? 'Functional Department',
        status: dept.status,
        parentId: rootId,
        departmentId: dept.id,
        managerId: dept.manager_id ?? undefined,
        data: dept as unknown as Record<string, unknown>,
      });
      eList.push({ from: rootId, to: deptNodeId, label: 'Department' });
    });

    const departmentIds = new Set(departments.map((d) => d.id));

    // 2. ROLES
    roles.forEach((role) => {
      const roleNodeId = `role-${role.id}`;
      const parentId = departmentIds.has(role.department_id) ? `dept-${role.department_id}` : rootId;
      nList.push({
        id: roleNodeId,
        type: 'role',
        title: role.title,
        subtitle: `Authority: ${role.authority || 'STANDARD'}`,
        status: role.autonomy_level || 'SUPERVISED',
        parentId,
        departmentId: role.department_id,
        data: role as unknown as Record<string, unknown>,
      });
      eList.push({ from: parentId, to: roleNodeId, label: 'Role' });
    });

    const roleIds = new Set(roles.map((r) => r.id));

    // 3. AGENTS
    agents.forEach((agent) => {
      const agentNodeId = `agent-${agent.id}`;
      // Determine parent: Role node if exists, else Department, else Root
      let parentId = rootId;
      if (agent.role_id && roleIds.has(agent.role_id)) {
        parentId = `role-${agent.role_id}`;
      } else if (agent.department_id && departmentIds.has(agent.department_id)) {
        parentId = `dept-${agent.department_id}`;
      }

      const intelligence = agent.intelligence_config as { provider?: string; model?: string } | undefined;
      const subtitle = intelligence?.model
        ? `${intelligence.provider ?? 'AI'} · ${intelligence.model}`
        : ((agent.identity as { title?: string })?.title ?? 'Autonomous Agent');

      nList.push({
        id: agentNodeId,
        type: 'agent',
        title: agent.name,
        subtitle,
        status: agent.status,
        parentId,
        departmentId: agent.department_id ?? undefined,
        roleId: agent.role_id ?? undefined,
        managerId: agent.manager_agent_id ?? undefined,
        data: agent as unknown as Record<string, unknown>,
      });
      eList.push({ from: parentId, to: agentNodeId, label: 'Employee' });

      // Add reporting line edge if manager exists
      if (agent.manager_agent_id) {
        eList.push({
          from: `agent-${agent.manager_agent_id}`,
          to: agentNodeId,
          label: 'Reports To',
        });
      }
    });

    // 4. PROJECTS
    const agentIds = new Set(agents.map((a) => a.id));
    projects.forEach((proj) => {
      const projNodeId = `project-${proj.id}`;
      const parentId = proj.owner_id && agentIds.has(proj.owner_id) ? `agent-${proj.owner_id}` : rootId;
      nList.push({
        id: projNodeId,
        type: 'project',
        title: proj.name,
        subtitle: proj.objective ?? `Priority: ${proj.priority}`,
        status: proj.status,
        parentId,
        projectId: proj.id,
        data: proj as unknown as Record<string, unknown>,
      });
      eList.push({ from: parentId, to: projNodeId, label: 'Initiative' });
    });

    // 5. TASKS
    const projectIds = new Set(projects.map((p) => p.id));
    tasks.forEach((task) => {
      const taskNodeId = `task-${task.id}`;
      const parentId = projectIds.has(task.project_id) ? `project-${task.project_id}` : rootId;
      nList.push({
        id: taskNodeId,
        type: 'task',
        title: task.title,
        subtitle: task.description ?? `Priority: ${task.priority}`,
        status: task.status,
        parentId,
        projectId: task.project_id,
        agentId: task.assigned_agent_id ?? undefined,
        data: task as unknown as Record<string, unknown>,
      });
      eList.push({ from: parentId, to: taskNodeId, label: 'Work Item' });

      if (task.assigned_agent_id) {
        eList.push({
          from: `agent-${task.assigned_agent_id}`,
          to: taskNodeId,
          label: 'Assigned',
        });
      }
    });

    // 6. DECISIONS
    decisions.forEach((decision) => {
      const decisionNodeId = `decision-${decision.id}`;
      nList.push({
        id: decisionNodeId,
        type: 'decision',
        title: decision.problem,
        subtitle: decision.decision ?? 'Decision record',
        status: decision.status,
        parentId: rootId,
        data: decision as unknown as Record<string, unknown>,
      });
      eList.push({ from: rootId, to: decisionNodeId, label: 'Governance' });
    });

    return { allNodes: nList, edges: eList };
  }, [companyName, companyStatus, departments, agents, projects, tasks, decisions, roles]);

  // Filtering nodes according to search, department filter, status filter, and collapse state
  const visibleNodes = useMemo(() => {
    return allNodes.filter((node) => {
      // 1. Department collapse logic
      if (node.departmentId && collapsedDepts.has(node.departmentId)) {
        // Hide subordinate roles, agents, or tasks belonging to this collapsed department
        if (node.type !== 'department') {
          return false;
        }
      }

      // 2. Department selector filter
      if (departmentFilter !== 'ALL') {
        if (node.type === 'department' && node.departmentId !== departmentFilter) {
          return false;
        }
        if (node.departmentId && node.departmentId !== departmentFilter) {
          return false;
        }
      }

      // 3. Agent status filter
      if (statusFilter !== 'ALL') {
        if (node.type === 'agent') {
          const s = (node.status || '').toUpperCase();
          if (s !== statusFilter.toUpperCase()) {
            return false;
          }
        }
      }

      // 4. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = node.title.toLowerCase().includes(q);
        const matchesSubtitle = node.subtitle?.toLowerCase().includes(q) ?? false;
        const matchesStatus = node.status?.toLowerCase().includes(q) ?? false;
        if (!matchesTitle && !matchesSubtitle && !matchesStatus) {
          return false;
        }
      }

      return true;
    });
  }, [allNodes, collapsedDepts, departmentFilter, statusFilter, searchQuery]);

  // Group nodes by visual hierarchy columns
  const columns = useMemo(() => {
    const colOrder: { type: GraphNode['type']; label: string; desc: string }[] = [
      { type: 'company', label: 'COMPANY', desc: 'Enterprise Root' },
      { type: 'department', label: 'DEPARTMENTS', desc: 'Functional Units' },
      { type: 'role', label: 'ROLES', desc: 'Organizational Roles' },
      { type: 'agent', label: 'AGENTS', desc: 'Autonomous Workforce' },
      { type: 'project', label: 'PROJECTS', desc: 'Active Initiatives' },
      { type: 'task', label: 'TASKS', desc: 'Operational Work' },
    ];

    // If decisions exist, provide a 7th column for governance
    if (decisions.length > 0) {
      colOrder.push({ type: 'decision', label: 'DECISIONS', desc: 'Deliberation Records' });
    }

    return colOrder.map((col) => ({
      ...col,
      items: visibleNodes.filter((n) => n.type === col.type),
      totalItems: allNodes.filter((n) => n.type === col.type).length,
    }));
  }, [visibleNodes, allNodes, decisions]);

  // Visual state helpers for Agent Status
  const getAgentStatusStyle = (status?: string) => {
    const s = (status || 'AVAILABLE').toUpperCase();
    switch (s) {
      case 'WORKING':
        return {
          badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse',
          dot: 'bg-amber-400',
          border: 'border-amber-500/50 hover:border-amber-400',
          glow: 'shadow-[0_0_12px_rgba(245,158,11,0.2)]',
          label: 'WORKING',
        };
      case 'BLOCKED':
        return {
          badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
          dot: 'bg-rose-500',
          border: 'border-rose-500/60 hover:border-rose-400',
          glow: 'shadow-[0_0_15px_rgba(244,63,94,0.3)]',
          label: 'BLOCKED',
        };
      case 'WAITING':
        return {
          badge: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
          dot: 'bg-purple-400',
          border: 'border-purple-500/50 hover:border-purple-400',
          glow: 'shadow-[0_0_12px_rgba(168,85,247,0.2)]',
          label: 'WAITING',
        };
      case 'PAUSED':
        return {
          badge: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
          dot: 'bg-slate-400',
          border: 'border-slate-600 hover:border-slate-500',
          glow: '',
          label: 'PAUSED',
        };
      case 'OFFLINE':
        return {
          badge: 'bg-zinc-800 text-zinc-400 border-zinc-700',
          dot: 'bg-zinc-500',
          border: 'border-zinc-800 hover:border-zinc-700 opacity-60',
          glow: '',
          label: 'OFFLINE',
        };
      case 'AVAILABLE':
      default:
        return {
          badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          dot: 'bg-emerald-400',
          border: 'border-emerald-500/50 hover:border-emerald-400',
          glow: 'shadow-[0_0_12px_rgba(16,185,129,0.2)]',
          label: 'AVAILABLE',
        };
    }
  };

  const getNodeIcon = (type: GraphNode['type']) => {
    switch (type) {
      case 'company':
        return Building2;
      case 'department':
        return Users;
      case 'role':
        return Briefcase;
      case 'agent':
        return Bot;
      case 'project':
        return FolderGit2;
      case 'task':
        return CheckSquare;
      case 'decision':
        return Scale;
      case 'evidence':
        return FileSearch;
    }
  };

  const getNodeBaseColor = (type: GraphNode['type']) => {
    switch (type) {
      case 'company':
        return 'text-cyan-400 border-cyan-500/40 bg-cyan-950/20';
      case 'department':
        return 'text-purple-400 border-purple-500/40 bg-purple-950/20';
      case 'role':
        return 'text-indigo-400 border-indigo-500/40 bg-indigo-950/20';
      case 'agent':
        return 'text-blue-400 border-blue-500/40 bg-blue-950/20';
      case 'project':
        return 'text-emerald-400 border-emerald-500/40 bg-emerald-950/20';
      case 'task':
        return 'text-amber-400 border-amber-500/40 bg-amber-950/20';
      case 'decision':
        return 'text-rose-400 border-rose-500/40 bg-rose-950/20';
      case 'evidence':
        return 'text-teal-400 border-teal-500/40 bg-teal-950/20';
    }
  };

  // Drag-to-pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, input, select, .inspector-panel')) {
      return;
    }
    setIsPanning(true);
    setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({
      x: e.clientX - startPan.x,
      y: e.clientY - startPan.y,
    });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Selected agent details calculation for Inspector Panel
  const selectedAgentData = useMemo(() => {
    if (!selectedNode || selectedNode.type !== 'agent') return null;
    const agent = selectedNode.data as unknown as Agent;

    const dept = departments.find((d) => d.id === agent.department_id);
    const role = roles.find((r) => r.id === agent.role_id);
    const manager = agents.find((a) => a.id === agent.manager_agent_id);
    const directReports = agents.filter((a) => a.manager_agent_id === agent.id);

    // Current tasks assigned to this agent
    const assignedTasks = tasks.filter((t) => t.assigned_agent_id === agent.id);
    const activeTask = assignedTasks.find((t) => t.status === 'IN_PROGRESS') ?? assignedTasks[0];

    // Current project: either project associated with active task or owned project
    const activeProject = activeTask
      ? projects.find((p) => p.id === activeTask.project_id)
      : projects.find((p) => p.owner_id === agent.id);

    // Intelligence configuration
    const intConfig = (agent.intelligence_config || {}) as {
      provider?: string;
      model?: string;
      temperature?: number;
      max_tokens?: number;
    };

    // Tools & Permissions
    const tools = Array.isArray(agent.tools) ? agent.tools : [];
    const permissions = agent.permissions || {};

    // Resource limits & usage
    const resourceUsage = (agent.resource_usage || {}) as {
      tokens?: number;
      cost_usd?: number;
      compute_minutes?: number;
    };
    const resourceLimits = (agent.resource_limits || {}) as {
      daily_budget_usd?: number;
      token_limit?: number;
    };

    // Recent activity audits
    const agentAudits = audits.filter((a) => a.actor_id === agent.id || a.actor_type === agent.name);

    return {
      agent,
      dept,
      role,
      manager,
      directReports,
      activeTask,
      assignedTasks,
      activeProject,
      intConfig,
      tools,
      permissions,
      resourceUsage,
      resourceLimits,
      agentAudits,
    };
  }, [selectedNode, departments, roles, agents, tasks, projects, audits]);

  return (
    <div
      className="relative rounded-2xl border border-border bg-card/60 backdrop-blur-xl overflow-hidden flex flex-col h-[760px] shadow-2xl"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* 1. TOP CONTROL & FILTER BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 py-3.5 bg-secondary/30 backdrop-blur-md z-10">
        {/* Left: Title & Live counts */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/20 text-primary border border-primary/30 shadow-inner">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-foreground tracking-wide">
                NEIMAN Organization Map
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                Interactive Telemetry
              </span>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <span>{visibleNodes.length} visible nodes</span>
              <span>·</span>
              <span className="text-emerald-400 font-medium">
                {agents.filter((a) => a.status === 'WORKING').length} working
              </span>
              <span>·</span>
              <span className="text-rose-400 font-medium">
                {agents.filter((a) => a.status === 'BLOCKED').length} blocked
              </span>
            </p>
          </div>
        </div>

        {/* Center: Search and Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search map..."
              aria-label="Search map"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 pr-7 text-xs bg-background/80 border border-border/80 rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-44 focus:w-60 transition-all placeholder:text-muted-foreground/60"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Department Filter */}
          <div className="flex items-center gap-1.5">
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              aria-label="Filter by Department"
              className="h-8 px-2.5 text-xs bg-background/80 border border-border/80 rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by Agent Status"
              className="h-8 px-2.5 text-xs bg-background/80 border border-border/80 rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Statuses</option>
              <option value="AVAILABLE">Available</option>
              <option value="WORKING">Working</option>
              <option value="BLOCKED">Blocked</option>
              <option value="WAITING">Waiting</option>
              <option value="PAUSED">Paused</option>
              <option value="OFFLINE">Offline</option>
            </select>
          </div>
        </div>

        {/* Right: Zoom & Reset Controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.1).toFixed(1))))}
            className="btn btn-ghost h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            title="Zoom Out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="text-xs font-mono text-muted-foreground w-12 text-center select-none">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(1.5, Number((z + 0.1).toFixed(1))))}
            className="btn btn-ghost h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            title="Zoom In"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            className="btn btn-ghost h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground border border-border/40"
            title="Reset Pan & Zoom"
          >
            Reset
          </button>
        </div>
      </div>

      {/* 2. MAIN INTERACTIVE CANVAS AREA */}
      <div
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        className={`flex-1 overflow-auto p-8 relative scrollbar-thin select-none ${isPanning ? 'cursor-grabbing' : 'cursor-grab'
          }`}
        style={{
          backgroundImage: `
            radial-gradient(circle at 1px 1px, hsl(var(--primary) / 0.12) 1px, transparent 0)
          `,
          backgroundSize: '28px 28px',
        }}
      >
        <div
          className="flex gap-12 min-w-max items-start transition-transform duration-75 origin-top-left pb-16"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          {columns.map((col, cIdx) => (
            <div key={col.type} className="flex flex-col gap-3.5 w-64 shrink-0">
              {/* Column Header */}
              <div className="flex items-center justify-between pb-2.5 border-b border-border/60">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-mono font-bold tracking-wider text-muted-foreground">
                    {col.label}
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground/60">
                    ({col.items.length})
                  </span>
                </div>
                <span className="text-[9px] uppercase font-mono text-muted-foreground/50">
                  Tier {cIdx + 1}
                </span>
              </div>

              {/* Column Nodes */}
              <div className="flex flex-col gap-3">
                {col.items.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/60 p-4 text-center">
                    <p className="text-xs text-muted-foreground/60 italic">No {col.label.toLowerCase()}</p>
                  </div>
                ) : (
                  col.items.slice(0, maxNodesPerColumn).map((node) => {
                    const Icon = getNodeIcon(node.type);
                    const isSelected = selectedNode?.id === node.id;
                    const isDept = node.type === 'department';
                    const isAgent = node.type === 'agent';
                    const isCollapsed = isDept && node.departmentId && collapsedDepts.has(node.departmentId);

                    // Dynamic styling depending on node type
                    let cardBorder = 'border-border/60 hover:border-primary/40';
                    let cardBg = 'bg-card/70';
                    let glowEffect = '';

                    if (isAgent) {
                      const agentStatusStyle = getAgentStatusStyle(node.status);
                      cardBorder = agentStatusStyle.border;
                      glowEffect = agentStatusStyle.glow;
                    } else {
                      cardBg = getNodeBaseColor(node.type);
                    }

                    return (
                      <div
                        key={node.id}
                        onClick={() => setSelectedNode(node)}
                        className={`
                          relative group rounded-xl border p-3.5 cursor-pointer transition-all duration-200
                          ${cardBg} ${cardBorder} ${glowEffect}
                          ${isSelected
                            ? 'ring-2 ring-primary shadow-xl shadow-primary/20 scale-[1.02] bg-primary/10'
                            : 'hover:shadow-md'
                          }
                        `}
                      >
                        {/* Node Card Top Row */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="h-6 w-6 rounded-md bg-secondary/80 flex items-center justify-center shrink-0 border border-border/50">
                              <Icon className="h-3.5 w-3.5 shrink-0" />
                            </div>
                            <h4 className="text-xs font-semibold truncate leading-tight text-foreground">
                              {node.title}
                            </h4>
                          </div>

                          {/* Status Badge */}
                          {isAgent ? (
                            <span
                              className={`text-[9px] uppercase font-mono px-1.5 py-0.5 rounded border shrink-0 flex items-center gap-1 ${getAgentStatusStyle(node.status).badge
                                }`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${getAgentStatusStyle(node.status).dot
                                  }`}
                              />
                              {getAgentStatusStyle(node.status).label}
                            </span>
                          ) : node.status ? (
                            <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-black/40 border border-current/20 shrink-0">
                              {node.status}
                            </span>
                          ) : null}
                        </div>

                        {/* Subtitle / Model / Purpose */}
                        {node.subtitle && (
                          <p className="mt-2 text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                            {node.subtitle}
                          </p>
                        )}

                        {/* Department Expand/Collapse Button */}
                        {isDept && node.departmentId && (
                          <div className="mt-3 pt-2 border-t border-border/40 flex items-center justify-between">
                            <button
                              type="button"
                              onClick={(e) => toggleDeptCollapse(node.departmentId!, e)}
                              className="text-[10px] font-mono flex items-center gap-1 text-primary hover:underline"
                            >
                              {isCollapsed ? (
                                <>
                                  <ChevronRight className="h-3 w-3" />
                                  <span>Expand Department</span>
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="h-3 w-3" />
                                  <span>Collapse Department</span>
                                </>
                              )}
                            </button>
                            <span className="text-[9px] font-mono text-muted-foreground">
                              {
                                agents.filter((a) => a.department_id === node.departmentId)
                                  .length
                              }{' '}
                              agents
                            </span>
                          </div>
                        )}

                        {/* Agent Telemetry Footer Snippet */}
                        {isAgent && (
                          <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                            <span>
                              {node.managerId
                                ? `Mgr: ${agents.find((a) => a.id === node.managerId)?.name?.split(
                                  ' '
                                )[0] ?? 'Lead'
                                }`
                                : 'Org Lead'}
                            </span>
                            <span className="text-primary font-medium group-hover:underline flex items-center gap-0.5">
                              Inspect <ArrowRight className="h-2.5 w-2.5" />
                            </span>
                          </div>
                        )}

                        {/* Task Progress or Priority Badge */}
                        {node.type === 'task' && (
                          <div className="mt-2 pt-1.5 border-t border-border/30 flex items-center justify-between text-[10px] font-mono">
                            <span className="text-muted-foreground">
                              {node.agentId
                                ? `Assignee: ${agents.find((a) => a.id === node.agentId)?.name?.split(
                                  ' '
                                )[0] ?? 'Agent'
                                }`
                                : 'Unassigned'}
                            </span>
                          </div>
                        )}

                        {/* Visual Right Chevron for Next Hierarchy Level */}
                        {cIdx < columns.length - 1 && (
                          <div className="absolute -right-3 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-secondary/90 border border-border flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors z-10 shadow">
                            <ChevronRight className="h-3 w-3" />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
                {col.items.length > maxNodesPerColumn && (
                  <button
                    type="button"
                    onClick={() => setMaxNodesPerColumn((prev) => prev + 30)}
                    className="py-2 px-3 text-[11px] font-mono rounded-lg border border-dashed border-border hover:border-primary/50 text-muted-foreground hover:text-foreground text-center transition-colors bg-secondary/20"
                  >
                    + Show {col.items.length - maxNodesPerColumn} more {col.label.toLowerCase()}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. OPERATIONAL AGENT INSPECTOR PANEL */}
      {selectedAgentData && (
        <div className="inspector-panel absolute top-0 right-0 bottom-0 w-84 sm:w-[420px] border-l border-border bg-card/95 backdrop-blur-2xl p-6 shadow-2xl z-30 flex flex-col animate-in slide-in-from-right duration-200 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-border">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-8 w-8 rounded-lg bg-primary/20 text-primary border border-primary/30 flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-foreground truncate">
                  {selectedAgentData.agent.name}
                </h3>
                <p className="text-[10px] font-mono text-muted-foreground truncate">
                  ID: {selectedAgentData.agent.id}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedNode(null)}
              className="btn btn-ghost h-8 w-8 p-0 text-muted-foreground hover:text-foreground rounded-lg"
              title="Close Inspector"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1 scrollbar-thin">
            {/* Status & Operational Mode */}
            <div className="flex items-center justify-between rounded-xl bg-secondary/40 p-3 border border-border/50">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block">
                  Operational State
                </span>
                <span
                  className={`mt-1 inline-flex items-center gap-1.5 text-xs font-bold font-mono px-2 py-0.5 rounded border ${getAgentStatusStyle(selectedAgentData.agent.status).badge
                    }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${getAgentStatusStyle(selectedAgentData.agent.status).dot
                      }`}
                  />
                  {selectedAgentData.agent.status}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block">
                  Autonomy Level
                </span>
                <span className="text-xs font-mono font-semibold text-primary">
                  {selectedAgentData.agent.autonomy || 'SUPERVISED'}
                </span>
              </div>
            </div>

            {/* Department & Role Hierarchy */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block">
                Organizational Hierarchy
              </span>
              <div className="rounded-xl border border-border/60 bg-secondary/20 p-3 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" /> Department:
                  </span>
                  <span className="font-semibold text-foreground">
                    {selectedAgentData.dept?.name ?? 'Unassigned'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Briefcase className="h-3.5 w-3.5" /> Role:
                  </span>
                  <span className="font-semibold text-foreground">
                    {selectedAgentData.role?.title ?? 'AI Employee'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Bot className="h-3.5 w-3.5" /> Manager:
                  </span>
                  <span className="font-semibold text-foreground">
                    {selectedAgentData.manager ? (
                      <button
                        type="button"
                        onClick={() => {
                          const mNode = allNodes.find(
                            (n) => n.id === `agent-${selectedAgentData.manager!.id}`
                          );
                          if (mNode) setSelectedNode(mNode);
                        }}
                        className="text-primary hover:underline"
                      >
                        {selectedAgentData.manager.name}
                      </button>
                    ) : (
                      'Organization Head'
                    )}
                  </span>
                </div>
                {selectedAgentData.directReports.length > 0 && (
                  <div className="flex justify-between items-center pt-1 border-t border-border/40">
                    <span className="text-muted-foreground">Direct Reports:</span>
                    <span className="font-mono text-primary">
                      {selectedAgentData.directReports.length} agent(s)
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Current Active Work: Task & Project */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block">
                Active Operational Work
              </span>
              <div className="rounded-xl border border-border/60 bg-secondary/20 p-3 space-y-2.5 text-xs">
                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <CheckSquare className="h-3 w-3" /> Current Task
                    </span>
                    {selectedAgentData.activeTask && (
                      <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                        {selectedAgentData.activeTask.priority}
                      </span>
                    )}
                  </div>
                  <p className="font-semibold text-foreground">
                    {selectedAgentData.activeTask?.title ?? 'No task currently assigned'}
                  </p>
                  {selectedAgentData.activeTask?.description && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {selectedAgentData.activeTask.description}
                    </p>
                  )}
                </div>

                <div className="pt-2 border-t border-border/40">
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <FolderGit2 className="h-3 w-3" /> Current Project
                    </span>
                    {selectedAgentData.activeProject && (
                      <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                        {selectedAgentData.activeProject.status}
                      </span>
                    )}
                  </div>
                  <p className="font-semibold text-foreground">
                    {selectedAgentData.activeProject?.name ?? 'No active project'}
                  </p>
                </div>
              </div>
            </div>

            {/* Intelligence Provider & Model */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block">
                Intelligence Mesh & Model
              </span>
              <div className="rounded-xl border border-border/60 bg-secondary/20 p-3 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5 text-amber-400" /> Provider:
                  </span>
                  <span className="font-mono font-semibold uppercase text-foreground">
                    {selectedAgentData.intConfig.provider ?? 'anthropic'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Cpu className="h-3.5 w-3.5 text-cyan-400" /> Model:
                  </span>
                  <span className="font-mono font-semibold text-primary">
                    {selectedAgentData.intConfig.model ?? 'Adaptive Rotation'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5 text-amber-400" /> Dispatch:
                  </span>
                  <span className="font-mono font-semibold text-cyan-400">
                    {(selectedAgentData.intConfig as Record<string, unknown>).last_rotated_model as string || 'Adaptive Multi-Model'}
                  </span>
                </div>
              </div>
            </div>

            {/* Tools & Permissions Matrix */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block">
                Registered Tools & Permissions
              </span>
              <div className="rounded-xl border border-border/60 bg-secondary/20 p-3 text-xs space-y-2">
                <div>
                  <span className="text-[11px] text-muted-foreground block mb-1">
                    Available Tools:
                  </span>
                  {selectedAgentData.tools.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedAgentData.tools.map((t, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md bg-secondary/80 border border-border text-[10px] font-mono text-foreground"
                        >
                          {typeof t === 'string' ? t : (t as { name?: string }).name ?? `Tool ${idx + 1}`}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground italic">
                      Standard core toolchain (file, web search, reasoning)
                    </p>
                  )}
                </div>

                <div className="pt-2 border-t border-border/40 flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Shield className="h-3 w-3" /> Approval Required:
                  </span>
                  <span className="font-mono font-semibold text-foreground">
                    {selectedAgentData.permissions.approval_required !== false ? 'YES' : 'NO'}
                  </span>
                </div>
              </div>
            </div>

            {/* Resource Usage & Telemetry */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block">
                Resource Usage & Telemetry
              </span>
              <div className="rounded-xl border border-border/60 bg-secondary/20 p-3 text-xs space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Daily Budget:</span>
                  <span className="font-mono font-medium text-foreground">
                    ${selectedAgentData.resourceLimits.daily_budget_usd ?? '10.00'} / day
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Tokens Consumed:</span>
                  <span className="font-mono font-medium text-foreground">
                    {(selectedAgentData.resourceUsage.tokens ?? 0).toLocaleString()} tokens
                  </span>
                </div>
              </div>
            </div>

            {/* Recent Activity Log */}
            {selectedAgentData.agentAudits.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block">
                  Recent Activity Stream
                </span>
                <div className="rounded-xl border border-border/60 bg-secondary/20 p-3 space-y-2 text-xs">
                  {selectedAgentData.agentAudits.slice(0, 3).map((audit) => (
                    <div key={audit.id} className="pb-1.5 border-b border-border/30 last:border-b-0">
                      <p className="font-medium text-foreground">{audit.action}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {audit.result || audit.reason || audit.target || 'Logged action'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-border mt-auto">
            <button
              type="button"
              onClick={() => setSelectedNode(null)}
              className="btn btn-outline w-full text-xs"
            >
              Close Inspector
            </button>
          </div>
        </div>
      )}

      {/* 4. GENERIC NODE INSPECTOR DRAWER (For non-agent nodes) */}
      {selectedNode && selectedNode.type !== 'agent' && (
        <div className="inspector-panel absolute top-0 right-0 bottom-0 w-80 sm:w-96 border-l border-border bg-card/95 backdrop-blur-2xl p-6 shadow-2xl z-30 flex flex-col animate-in slide-in-from-right duration-200">
          <div className="flex items-center justify-between pb-4 border-b border-border">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                {selectedNode.type}
              </span>
              <span className="text-xs font-mono text-muted-foreground">Detail View</span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedNode(null)}
              className="btn btn-ghost h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-5 space-y-4">
            <div>
              <h3 className="text-base font-bold text-foreground">{selectedNode.title}</h3>
              {selectedNode.subtitle && (
                <p className="text-xs text-muted-foreground mt-1">{selectedNode.subtitle}</p>
              )}
            </div>

            {selectedNode.status && (
              <div className="flex items-center justify-between rounded-lg bg-secondary/40 p-3">
                <span className="text-xs text-muted-foreground">Lifecycle State</span>
                <span className="text-xs font-semibold text-primary">{selectedNode.status}</span>
              </div>
            )}

            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Node Attributes
              </h4>
              <div className="rounded-xl border border-border/60 bg-secondary/20 p-3 space-y-2 text-xs">
                {Object.entries(selectedNode.data)
                  .slice(0, 8)
                  .map(([key, val]) => (
                    <div key={key} className="flex justify-between items-start gap-2">
                      <span className="font-mono text-muted-foreground/70 shrink-0">{key}:</span>
                      <span className="font-medium text-foreground text-right truncate">
                        {typeof val === 'object' ? JSON.stringify(val) : String(val ?? '—')}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setSelectedNode(null)}
                className="btn btn-outline w-full text-xs"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

