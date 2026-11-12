'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckSquare,
  Plus,
  Loader2,
  AlertCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Bot,
  User,
  Filter,
  ArrowRight,
  Coins,
  Kanban,
  List as ListIcon,
  Calendar,
  GitBranch,
  Play,
  RotateCw,
  Search,
  Trash2,
  Check,
  PlusCircle,
  ChevronDown,
  ChevronUp,
  Percent,
  X,
} from 'lucide-react';
import {
  projectsApi,
  Project,
  Task,
  TaskStatus,
  TaskPriority,
  CreateTaskRequest,
  TaskChecklistItem,
} from '@/lib/api/projects';
import { agentsApi, Agent } from '@/lib/api/agents';
import { organizationsApi, OrgRole } from '@/lib/api/organizations';
import { useOrganizationContext } from '@/lib/organizationContext';
import { ApiError } from '@/lib/api/client';
import { TaskDetailsDrawer } from '@/components/TaskDetailsDrawer';
import { AutonomousSupervisorStrip } from '@/components/AutonomousSupervisorStrip';
import { AgentAvatar } from '@/components/ui/AgentAvatar';

const STATUS_ICONS: Record<TaskStatus, { color: string; label: string }> = {
  BACKLOG: { color: 'text-muted-foreground', label: 'Backlog' },
  TODO: { color: 'text-blue-400', label: 'To Do' },
  PENDING: { color: 'text-blue-400', label: 'Pending' },
  IN_PROGRESS: { color: 'text-amber-400', label: 'In Progress' },
  IN_REVIEW: { color: 'text-purple-400', label: 'In Review' },
  DONE: { color: 'text-emerald-400', label: 'Done' },
  COMPLETED: { color: 'text-emerald-400', label: 'Completed' },
  BLOCKED: { color: 'text-rose-400', label: 'Blocked' },
  CANCELLED: { color: 'text-muted-foreground', label: 'Cancelled' },
};

const PRIORITY_BADGES: Record<TaskPriority, string> = {
  LOW: 'border-muted-foreground/30 text-muted-foreground bg-muted/20',
  MEDIUM: 'border-blue-500/30 text-blue-400 bg-blue-500/10',
  HIGH: 'border-amber-500/30 text-amber-400 bg-amber-500/10',
  CRITICAL: 'border-rose-500/30 text-rose-400 bg-rose-500/10',
};

export default function TasksPage() {
  const activeCompany = useOrganizationContext();
  const companyId = activeCompany?.id || '';
  const qc = useQueryClient();

  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [agentFilter, setAgentFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const initialTaskId = searchParams?.get('entityId') || searchParams?.get('task') || null;
  const initialView = searchParams?.get('view');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(initialTaskId);
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null);
  const [executionMessage, setExecutionMessage] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<'list' | 'board' | 'checklist' | 'timeline' | 'graph'>(() => {
    if (initialView && ['list', 'board', 'checklist', 'timeline', 'graph'].includes(initialView)) {
      return initialView as 'list' | 'board' | 'checklist' | 'timeline' | 'graph';
    }
    return 'board';
  });
  const [checklistFilter, setChecklistFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED'>('ALL');
  const [expandedSubtasks, setExpandedSubtasks] = useState<Record<string, boolean>>({});
  const [inlineNewTaskTitle, setInlineNewTaskTitle] = useState('');
  const [inlineNewPriority, setInlineNewPriority] = useState<TaskPriority>('MEDIUM');
  const [inlineNewAgentId, setInlineNewAgentId] = useState<string>('');
  const [newStepTitles, setNewStepTitles] = useState<Record<string, string>>({});

  // Creation state
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateTaskRequest>({
    title: '',
    description: '',
    status: 'TODO',
    priority: 'MEDIUM',
    assigned_agent_id: undefined,
    dependencies: [],
  });
  const [formError, setFormError] = useState<string | null>(null);

  // List projects to select from
  const { data: projects = [] } = useQuery({
    queryKey: ['projects', companyId],
    queryFn: () => projectsApi.list(companyId),
    enabled: !!companyId,
  });

  const activeProjectId = selectedProjectId || (projects.length > 0 ? projects[0].id : '');

  // List tasks for the active project
  const { data: tasks = [], isLoading, error } = useQuery({
    queryKey: ['tasks', companyId, activeProjectId],
    queryFn: () => projectsApi.listTasks(companyId, activeProjectId),
    enabled: !!companyId && !!activeProjectId,
  });

  // List available agents for assignment
  const { data: agents = [] } = useQuery({
    queryKey: ['agents', companyId],
    queryFn: () => agentsApi.list(companyId),
    enabled: !!companyId,
  });

  // List roles for organizational context
  const { data: roles = [] } = useQuery({
    queryKey: ['roles', companyId],
    queryFn: () => organizationsApi.listRoles(companyId),
    enabled: !!companyId,
  });

  const handleDirectExecuteTask = async (task: Task) => {
    if (!task.assigned_agent_id || !activeProjectId) return;
    setRunningTaskId(task.id);
    setExecutionMessage(null);
    try {
      const res = await agentsApi.executeTask(companyId, task.assigned_agent_id, {
        task_id: task.id,
        input_data: {
          objective: task.expected_outcome || task.title,
          description: task.description,
          dependencies: task.dependencies,
        },
      });
      qc.invalidateQueries({ queryKey: ['tasks', companyId, activeProjectId] });
      qc.invalidateQueries({ queryKey: ['control-room-state', companyId] });
      qc.invalidateQueries({ queryKey: ['task-detail', companyId, activeProjectId, task.id] });
      const summaryText = (res.result?.summary as string) || (typeof res.result === 'string' ? res.result : JSON.stringify(res.result || {}));
      setExecutionMessage(`Task executed successfully by agent (${res.final_status}): ${summaryText.slice(0, 100)}...`);
      setSelectedTaskId(task.id);
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : 'Execution failed';
      setExecutionMessage(`Execution error: ${msg}`);
    } finally {
      setRunningTaskId(null);
    }
  };

  // Create task mutation
  const createMutation = useMutation({
    mutationFn: (body: CreateTaskRequest) =>
      projectsApi.createTask(companyId, activeProjectId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', companyId, activeProjectId] });
      setShowCreate(false);
      setForm({
        title: '',
        description: '',
        status: 'TODO',
        priority: 'MEDIUM',
        assigned_agent_id: undefined,
        dependencies: [],
      });
      setFormError(null);
    },
    onError: (err) => {
      setFormError(err instanceof ApiError ? err.message : 'Failed to create task.');
    },
  });

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: (taskIdToDelete: string) =>
      projectsApi.deleteTask(companyId, activeProjectId, taskIdToDelete),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', companyId, activeProjectId] });
      qc.invalidateQueries({ queryKey: ['control-room-state', companyId] });
      if (selectedTaskId) setSelectedTaskId(null);
    },
  });

  // Toggle Task Completion Mutation (Optimistic)
  const toggleTaskMutation = useMutation({
    mutationFn: ({ taskId, currentStatus }: { taskId: string; currentStatus: TaskStatus }) =>
      projectsApi.toggleTaskStatus(companyId, activeProjectId, taskId, currentStatus),
    onMutate: async ({ taskId, currentStatus }) => {
      await qc.cancelQueries({ queryKey: ['tasks', companyId, activeProjectId] });
      const prevTasks = qc.getQueryData<Task[]>(['tasks', companyId, activeProjectId]);
      if (prevTasks) {
        const isDone = currentStatus === 'DONE' || currentStatus === 'COMPLETED';
        const newStatus: TaskStatus = isDone ? 'TODO' : 'COMPLETED';
        qc.setQueryData<Task[]>(
          ['tasks', companyId, activeProjectId],
          prevTasks.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
        );
      }
      return { prevTasks };
    },
    onError: (_err, _vars, context) => {
      if (context?.prevTasks) {
        qc.setQueryData(['tasks', companyId, activeProjectId], context.prevTasks);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['tasks', companyId, activeProjectId] });
      qc.invalidateQueries({ queryKey: ['control-room-state', companyId] });
    },
  });

  // Update Subtask Checklist Mutation
  const updateChecklistMutation = useMutation({
    mutationFn: ({
      taskId,
      checklist,
      resourceRequirements,
    }: {
      taskId: string;
      checklist: TaskChecklistItem[];
      resourceRequirements?: Record<string, unknown>;
    }) =>
      projectsApi.updateTaskChecklist(
        companyId,
        activeProjectId,
        taskId,
        checklist,
        resourceRequirements
      ),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['tasks', companyId, activeProjectId] });
    },
  });

  const handleToggleSubtask = (task: Task, subtaskId: string) => {
    const currentSubtasks: TaskChecklistItem[] =
      (task.resource_requirements?.checklist as TaskChecklistItem[]) || task.checklist || [];
    const updated = currentSubtasks.map((st) =>
      st.id === subtaskId ? { ...st, completed: !st.completed } : st
    );
    updateChecklistMutation.mutate({
      taskId: task.id,
      checklist: updated,
      resourceRequirements: task.resource_requirements,
    });
  };

  const handleAddSubtask = (task: Task) => {
    const title = (newStepTitles[task.id] || '').trim();
    if (!title) return;
    const currentSubtasks: TaskChecklistItem[] =
      (task.resource_requirements?.checklist as TaskChecklistItem[]) || task.checklist || [];
    const newItem: TaskChecklistItem = {
      id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title,
      completed: false,
      created_at: new Date().toISOString(),
    };
    updateChecklistMutation.mutate({
      taskId: task.id,
      checklist: [...currentSubtasks, newItem],
      resourceRequirements: task.resource_requirements,
    });
    setNewStepTitles((prev) => ({ ...prev, [task.id]: '' }));
    setExpandedSubtasks((prev) => ({ ...prev, [task.id]: true }));
  };

  const handleDeleteSubtask = (task: Task, subtaskId: string) => {
    const currentSubtasks: TaskChecklistItem[] =
      (task.resource_requirements?.checklist as TaskChecklistItem[]) || task.checklist || [];
    const updated = currentSubtasks.filter((st) => st.id !== subtaskId);
    updateChecklistMutation.mutate({
      taskId: task.id,
      checklist: updated,
      resourceRequirements: task.resource_requirements,
    });
  };

  const handleInlineTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const title = inlineNewTaskTitle.trim();
    if (!title || !activeProjectId) return;
    createMutation.mutate({
      title,
      priority: inlineNewPriority,
      status: 'TODO',
      assigned_agent_id: inlineNewAgentId || undefined,
    });
    setInlineNewTaskTitle('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setFormError('Task title is required.');
      return;
    }
    if (!activeProjectId) {
      setFormError('A project must be selected to create a task.');
      return;
    }
    createMutation.mutate(form);
  };

  const filteredTasks = tasks.filter((t) => {
    if (statusFilter !== 'ALL') {
      if (statusFilter === 'TODO' && !(t.status === 'TODO' || t.status === 'BACKLOG' || t.status === 'PENDING')) return false;
      else if (statusFilter === 'DONE' && !(t.status === 'DONE' || t.status === 'COMPLETED')) return false;
      else if (statusFilter !== 'TODO' && statusFilter !== 'DONE' && t.status !== statusFilter) return false;
    }
    if (priorityFilter !== 'ALL' && t.priority !== priorityFilter) return false;
    if (agentFilter !== 'ALL' && t.assigned_agent_id !== agentFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchDesc = (t.description || '').toLowerCase().includes(q);
      if (!matchTitle && !matchDesc) return false;
    }
    return true;
  });

  return (
    <div className="w-full space-y-6 animate-fade-in font-sans">
      {/* 1. HEADER (Precision Engineering Dual View) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="h-2 w-2 rounded-full bg-primary" />
            <h1 className="text-lg sm:text-xl font-bold text-foreground tracking-tight">
              Tasks & Projects
            </h1>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              {filteredTasks.length} Tasks
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Track sprint velocity across Kanban Board and List views, or click any task to inspect live agent execution and diffs.
          </p>
        </div>

        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-xs font-semibold hover:bg-primary/90 transition-colors self-start sm:self-auto disabled:opacity-40"
          onClick={() => setShowCreate(true)}
          disabled={!activeProjectId}
        >
          <Plus className="h-4 w-4" />
          <span>New Task</span>
        </button>
      </div>

      {/* AUTONOMOUS SUPERVISOR COCKPIT STRIP */}
      <AutonomousSupervisorStrip
        companyId={companyId}
        onTaskMutated={() => qc.invalidateQueries({ queryKey: ['tasks', companyId] })}
      />

      {/* EXECUTION NOTIFICATION BANNER */}
      {executionMessage && (
        <div className="p-3.5 rounded-xl border border-primary/30 bg-primary/10 text-primary text-xs font-mono flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2 truncate">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span className="truncate">{executionMessage}</span>
          </div>
          <button
            onClick={() => setExecutionMessage(null)}
            className="text-xs text-muted-foreground hover:text-foreground font-sans px-2 shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 2. PROJECT SELECTOR, SEARCH & VIEW MODE SWITCHER */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-[11px] font-bold text-muted-foreground uppercase">Project:</span>
          {projects.length === 0 ? (
            <span className="text-xs text-muted-foreground italic">No projects found</span>
          ) : (
            <select
              className="text-xs font-medium py-1.5 px-3 h-9 bg-secondary/60 rounded-lg border border-border min-w-[200px] text-foreground focus:outline-none focus:border-primary"
              value={activeProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              aria-label="Filter by project"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}

          {/* Search Box */}
          <div className="relative min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 text-xs font-mono h-9 rounded-full bg-secondary/40 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground/40"
            />
          </div>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="text-xs font-mono h-9 px-3 rounded-full bg-secondary/40 border border-border text-foreground focus:outline-none focus:border-foreground/40"
            aria-label="Filter by priority"
          >
            <option value="ALL">All Priorities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          {/* Agent & Role Filter */}
          <select
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
            className="text-xs font-mono h-9 px-3 rounded-full bg-secondary/40 border border-border text-foreground focus:outline-none focus:border-foreground/40 max-w-[200px]"
            aria-label="Filter by agent or role"
          >
            <option value="ALL">All Agents & Roles</option>
            {agents.map((ag) => {
              const role = roles.find((r) => r.id === ag.role_id);
              return (
                <option key={ag.id} value={ag.id}>
                  {ag.name} ({role?.title || ag.autonomy})
                </option>
              );
            })}
          </select>
        </div>

        {/* 5 Interchangeable View Modes */}
        <div className="flex items-center gap-1 border border-border/80 rounded-full p-1 bg-secondary/30">
          {[
            { id: 'board', label: 'Board', icon: Kanban },
            { id: 'list', label: 'List', icon: ListIcon },
            { id: 'checklist', label: 'Checklist', icon: CheckSquare },
            { id: 'timeline', label: 'Timeline', icon: Calendar },
            { id: 'graph', label: 'Graph', icon: GitBranch },
          ].map((v) => {
            const Icon = v.icon;
            const isActive = viewMode === v.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setViewMode(v.id as typeof viewMode)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono transition-all ${
                  isActive
                    ? 'bg-foreground text-background font-semibold shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="h-3 w-3" />
                <span className="uppercase text-[11px]">{v.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. STATUS FILTER PILLS (Nothing OS Capsule Pills) */}
      <div className="flex items-center gap-1.5 overflow-x-auto text-xs pb-1 scrollbar-hide">
        {['ALL', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED'].map((status) => (
          <button
            key={status}
            type="button"
            className={`rounded-full px-3 py-1 text-[11px] font-mono uppercase tracking-wider transition-all ${
              statusFilter === status
                ? 'bg-foreground text-background font-bold shadow-xs'
                : 'bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground border border-border/40'
            }`}
            onClick={() => setStatusFilter(status)}
          >
            {status}
          </button>
        ))}
      </div>

      {/* 4. LOADING & EMPTY STATES */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-400">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm">
            {error instanceof ApiError ? error.message : 'Failed to load project tasks.'}
          </p>
        </div>
      )}

      {!isLoading && !error && filteredTasks.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border py-20">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary/50">
            <CheckSquare className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-semibold text-foreground">No tasks found</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Add tasks to decompose project objectives into discrete agent actions.
            </p>
          </div>
          {activeProjectId && (
            <button
              type="button"
              className="btn btn-primary gap-2"
              onClick={() => setShowCreate(true)}
            >
              <Plus className="h-4 w-4" />
              Add Task
            </button>
          )}
        </div>
      )}

      {/* 5. MULTI-VIEW PRESENTATION */}
      {!isLoading && filteredTasks.length > 0 && (
        <>
          {/* VIEW 1: LIST VIEW (Nothing OS 3.0 Tactile Cards) */}
          {viewMode === 'list' && (
            <div className="space-y-2">
              {filteredTasks.map((t) => {
                const statusConfig = STATUS_ICONS[t.status] || STATUS_ICONS.TODO;
                const priorityClass = PRIORITY_BADGES[t.priority] || PRIORITY_BADGES.MEDIUM;
                const assignedAgent = agents.find((a) => a.id === t.assigned_agent_id);
                const isWorking = t.status === 'IN_PROGRESS';

                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTaskId(t.id)}
                    className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border/70 bg-card/70 hover:bg-card p-3.5 hover:border-foreground/40 cursor-pointer transition-all duration-150 backdrop-blur-sm"
                  >
                    <div className="flex items-start sm:items-center gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTaskMutation.mutate({ taskId: t.id, currentStatus: t.status });
                        }}
                        aria-label={`Toggle task completion for ${t.title}`}
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all cursor-pointer ${
                          t.status === 'DONE' || t.status === 'COMPLETED'
                            ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-500'
                            : 'bg-secondary/80 border-border/60 text-muted-foreground hover:border-primary hover:text-primary'
                        }`}
                      >
                        {t.status === 'DONE' || t.status === 'COMPLETED' ? (
                          <Check className="h-4 w-4 stroke-[3]" />
                        ) : isWorking ? (
                          <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                        ) : (
                          <CheckSquare className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4
                            className={`text-xs sm:text-sm font-bold truncate font-mono ${
                              t.status === 'DONE' || t.status === 'COMPLETED'
                                ? 'line-through text-muted-foreground'
                                : 'text-foreground'
                            }`}
                          >
                            {t.title}
                          </h4>
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.2 text-[9px] font-mono font-bold uppercase tracking-wider ${priorityClass}`}
                          >
                            {t.priority}
                          </span>
                        </div>
                        {t.description && (
                          <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5 font-mono">
                            {t.description}
                          </p>
                        )}
                        {(() => {
                          const subtasks: TaskChecklistItem[] =
                            (t.resource_requirements?.checklist as TaskChecklistItem[]) || t.checklist || [];
                          if (subtasks.length === 0) return null;
                          const completedCount = subtasks.filter((s) => s.completed).length;
                          return (
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                                <CheckSquare className="h-3 w-3 text-emerald-500" />
                                <span>{completedCount}/{subtasks.length} steps</span>
                              </span>
                              <div className="w-16 h-1 rounded-full bg-secondary overflow-hidden border border-border/40">
                                <div
                                  className="h-full bg-emerald-500"
                                  style={{ width: `${(completedCount / subtasks.length) * 100}%` }}
                                />
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0 text-xs font-mono">
                      {assignedAgent ? (
                        <div className="flex items-center gap-1.5 rounded-full bg-secondary/60 border border-border/80 px-2.5 py-0.5 text-foreground">
                          <AgentAvatar
                            name={assignedAgent.name}
                            avatarUrl={assignedAgent.identity?.avatar_url as string | undefined}
                            size={18}
                            showStatus={false}
                          />
                          <span className="font-semibold text-[11px]">{assignedAgent.name}</span>
                          {(() => {
                            const r = roles.find((ro) => ro.id === assignedAgent.role_id);
                            return r ? (
                              <span className="text-[10px] text-muted-foreground">({r.title})</span>
                            ) : null;
                          })()}
                        </div>
                      ) : (
                        <span className="text-muted-foreground/60 italic text-[10px]">Unassigned</span>
                      )}
                      <span className={`px-2 py-0.5 rounded-full border border-border/60 bg-secondary/30 ${statusConfig.color} font-mono text-[9px] uppercase tracking-wider font-bold`}>
                        {t.status}
                      </span>
                      <button
                        type="button"
                        disabled={runningTaskId === t.id || !t.assigned_agent_id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDirectExecuteTask(t);
                        }}
                        className="btn btn-xs btn-outline gap-1 text-primary hover:bg-primary/10 font-mono text-[10px] h-7 px-2.5 rounded-full"
                        title={t.assigned_agent_id ? "Execute task with assigned agent" : "Assign an agent to execute"}
                      >
                        {runningTaskId === t.id ? (
                          <>
                            <RotateCw className="h-3 w-3 animate-spin" />
                            <span>Running...</span>
                          </>
                        ) : (
                          <>
                            <Play className="h-3 w-3 fill-current" />
                            <span>Run</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Delete task "${t.title}" from project?`)) {
                            deleteTaskMutation.mutate(t.id);
                          }
                        }}
                        disabled={deleteTaskMutation.isPending}
                        className="h-7 w-7 rounded-full border border-border/60 hover:border-rose-500/40 hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 flex items-center justify-center transition-colors"
                        title="Delete Task"
                        aria-label={`Delete task ${t.title}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* VIEW 2: BOARD / KANBAN VIEW (Nothing OS 3.0 Grid Matrix) */}
          {viewMode === 'board' && (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {[
                { key: 'TODO', label: 'To Do', color: 'text-blue-400', border: 'border-blue-500/30' },
                { key: 'IN_PROGRESS', label: 'In Progress', color: 'text-amber-400', border: 'border-amber-500/30', pip: 'bg-primary' },
                { key: 'IN_REVIEW', label: 'In Review', color: 'text-purple-400', border: 'border-purple-500/30' },
                { key: 'DONE', label: 'Done', color: 'text-emerald-400', border: 'border-emerald-500/30' },
                { key: 'BLOCKED', label: 'Blocked', color: 'text-rose-400', border: 'border-rose-500/30' },
              ].map((col) => {
                const colTasks = filteredTasks.filter((t) => {
                  if (col.key === 'DONE') return t.status === 'DONE' || t.status === 'COMPLETED';
                  if (col.key === 'TODO') return t.status === 'TODO' || t.status === 'BACKLOG' || t.status === 'PENDING';
                  return t.status === col.key;
                });
                return (
                  <div key={col.key} className="rounded-xl border border-border/70 bg-card/40 p-3 space-y-2.5 backdrop-blur-sm">
                    <div className="flex items-center justify-between pb-2 border-b border-border/50 font-mono">
                      <div className="flex items-center gap-1.5">
                        {col.pip && (
                          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                        )}
                        <span className={`text-[11px] font-bold uppercase tracking-wider ${col.color}`}>
                          {col.label}
                        </span>
                      </div>
                      <span className="text-[9px] font-mono px-2 py-0.2 rounded-full bg-secondary/80 text-foreground border border-border/50">
                        {colTasks.length}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {colTasks.map((t) => {
                        const ag = agents.find((a) => a.id === t.assigned_agent_id);
                        return (
                          <div
                            key={t.id}
                            onClick={() => setSelectedTaskId(t.id)}
                            className="p-3 rounded-lg border border-border/80 bg-card hover:border-primary/40 cursor-pointer transition-all space-y-2 shadow-xs group"
                          >
                            <p className="text-xs font-semibold text-foreground line-clamp-2 font-sans group-hover:text-foreground">
                              {t.title}
                            </p>
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1.5 border-t border-border/40 font-mono">
                              {ag ? (
                                <span className="flex items-center gap-1.5 text-primary truncate max-w-[140px] font-semibold">
                                  <AgentAvatar
                                    name={ag.name}
                                    avatarUrl={ag.identity?.avatar_url as string | undefined}
                                    size={16}
                                    showStatus={false}
                                  />
                                  <span className="truncate">{ag.name}</span>
                                </span>
                              ) : (
                                <span className="italic text-muted-foreground/60">Unassigned</span>
                              )}
                              <div className="flex items-center gap-1.5">
                                <span className="uppercase text-[9px] px-1.5 py-0.2 rounded bg-secondary text-muted-foreground border border-border/40">
                                  {t.priority}
                                </span>
                                <button
                                  type="button"
                                  disabled={runningTaskId === t.id || !t.assigned_agent_id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDirectExecuteTask(t);
                                  }}
                                  className="h-5 px-1.5 rounded bg-primary/10 hover:bg-primary/20 text-primary text-[9px] font-bold flex items-center gap-0.5"
                                  title="Run Task"
                                >
                                  {runningTaskId === t.id ? (
                                    <RotateCw className="h-2.5 w-2.5 animate-spin" />
                                  ) : (
                                    <Play className="h-2.5 w-2.5 fill-current" />
                                  )}
                                  <span>Run</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (window.confirm(`Delete task "${t.title}" from project?`)) {
                                      deleteTaskMutation.mutate(t.id);
                                    }
                                  }}
                                  disabled={deleteTaskMutation.isPending}
                                  className="h-5 w-5 rounded hover:bg-rose-500/10 hover:text-rose-500 text-muted-foreground/60 flex items-center justify-center transition-colors"
                                  title="Delete Task"
                                  aria-label={`Delete task ${t.title}`}
                                >
                                  <Trash2 className="h-2.5 w-2.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* VIEW: INTERACTIVE CHECKLIST VIEW */}
          {viewMode === 'checklist' && (
            <div className="space-y-4 animate-fade-in">
              {/* Checklist Progress Dashboard */}
              <div className="rounded-xl border border-border/80 bg-card p-4 space-y-3 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                        <CheckSquare className="h-4 w-4" />
                      </div>
                      <h3 className="text-sm font-bold text-foreground">
                        Interactive Task Checklist
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        {filteredTasks.filter((t) => t.status === 'DONE' || t.status === 'COMPLETED').length} / {filteredTasks.length} Completed (
                        {filteredTasks.length > 0
                          ? Math.round(
                              (filteredTasks.filter((t) => t.status === 'DONE' || t.status === 'COMPLETED').length /
                                filteredTasks.length) *
                                100
                            )
                          : 0}
                        %)
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Interactive sovereign checklist: check off deliverables, manage subtask steps, and trace completion live.
                    </p>
                  </div>

                  {/* Filter Sub-Tabs */}
                  <div className="inline-flex rounded-lg border border-border/80 p-0.5 bg-secondary/30 text-xs font-mono">
                    {(['ALL', 'ACTIVE', 'COMPLETED'] as const).map((tab) => {
                      const isActive = checklistFilter === tab;
                      return (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => setChecklistFilter(tab)}
                          className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                            isActive
                              ? 'bg-foreground text-background shadow-xs'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {tab}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Progress Bar */}
                {(() => {
                  const completedTotal = filteredTasks.filter(
                    (t) => t.status === 'DONE' || t.status === 'COMPLETED'
                  ).length;
                  const pct = filteredTasks.length > 0 ? Math.round((completedTotal / filteredTasks.length) * 100) : 0;
                  return (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                        <span>Sprint Deliverables Completion</span>
                        <span className="font-bold text-foreground">{pct}%</span>
                      </div>
                      <div className="w-full bg-secondary h-2.5 rounded-full overflow-hidden border border-border/60">
                        <div
                          className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Rapid Inline Task Creator */}
              <form
                onSubmit={handleInlineTaskSubmit}
                className="flex flex-col sm:flex-row items-center gap-2 p-2.5 rounded-xl border border-dashed border-border/80 bg-secondary/15 hover:border-primary/50 transition-colors"
              >
                <div className="flex items-center gap-2 flex-1 w-full">
                  <PlusCircle className="h-4 w-4 text-primary shrink-0 ml-1" />
                  <input
                    type="text"
                    value={inlineNewTaskTitle}
                    onChange={(e) => setInlineNewTaskTitle(e.target.value)}
                    placeholder="Add a new deliverable to this checklist... (press Enter to save)"
                    aria-label="Add a new deliverable to this checklist"
                    className="flex-1 bg-transparent text-xs sm:text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                  <select
                    value={inlineNewPriority}
                    onChange={(e) => setInlineNewPriority(e.target.value as TaskPriority)}
                    className="text-[11px] font-mono h-7 px-2 rounded-lg bg-card border border-border text-foreground focus:outline-none"
                    aria-label="New task priority"
                  >
                    <option value="CRITICAL">Critical</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>

                  <select
                    value={inlineNewAgentId}
                    onChange={(e) => setInlineNewAgentId(e.target.value)}
                    className="text-[11px] font-mono h-7 px-2 rounded-lg bg-card border border-border text-foreground focus:outline-none max-w-[150px]"
                    aria-label="Assign agent"
                  >
                    <option value="">Unassigned</option>
                    {agents.map((ag) => (
                      <option key={ag.id} value={ag.id}>
                        {ag.name}
                      </option>
                    ))}
                  </select>

                  <button
                    type="submit"
                    disabled={!inlineNewTaskTitle.trim() || createMutation.isPending}
                    className="px-3 py-1 rounded-lg bg-primary text-primary-foreground font-semibold text-xs disabled:opacity-40 hover:bg-primary/90 transition-colors shrink-0"
                  >
                    Add
                  </button>
                </div>
              </form>

              {/* Checklist Items List */}
              <div className="space-y-2.5">
                {filteredTasks
                  .filter((t) => {
                    const isDone = t.status === 'DONE' || t.status === 'COMPLETED';
                    if (checklistFilter === 'ACTIVE') return !isDone;
                    if (checklistFilter === 'COMPLETED') return isDone;
                    return true;
                  })
                  .map((t) => {
                    const isDone = t.status === 'DONE' || t.status === 'COMPLETED';
                    const priorityClass = PRIORITY_BADGES[t.priority] || PRIORITY_BADGES.MEDIUM;
                    const assignedAgent = agents.find((a) => a.id === t.assigned_agent_id);
                    const subtasks: TaskChecklistItem[] =
                      (t.resource_requirements?.checklist as TaskChecklistItem[]) || t.checklist || [];
                    const completedSubCount = subtasks.filter((s) => s.completed).length;
                    const isExpanded = expandedSubtasks[t.id] ?? false;

                    return (
                      <div
                        key={t.id}
                        className={`rounded-xl border transition-all duration-150 overflow-hidden shadow-xs ${
                          isDone
                            ? 'bg-card/40 border-border/50 opacity-80'
                            : 'bg-card border-border/80 hover:border-foreground/30'
                        }`}
                      >
                        {/* Primary Task Row */}
                        <div className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                            {/* Interactive Task Checkbox */}
                            <button
                              type="button"
                              onClick={() =>
                                toggleTaskMutation.mutate({ taskId: t.id, currentStatus: t.status })
                              }
                              aria-label={`Toggle task completion for ${t.title}`}
                              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-all cursor-pointer ${
                                isDone
                                  ? 'bg-emerald-500 border-emerald-500 text-white shadow-xs'
                                  : 'bg-secondary/60 border-border hover:border-primary text-transparent'
                              }`}
                            >
                              <Check className={`h-4 w-4 stroke-[3] ${isDone ? 'opacity-100' : 'opacity-0'}`} />
                            </button>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <h4
                                  onClick={() => setSelectedTaskId(t.id)}
                                  className={`text-xs sm:text-sm font-bold font-mono truncate cursor-pointer hover:underline ${
                                    isDone ? 'line-through text-muted-foreground' : 'text-foreground'
                                  }`}
                                >
                                  {t.title}
                                </h4>
                                <span
                                  className={`inline-flex items-center rounded-full border px-2 py-0.2 text-[9px] font-mono font-bold uppercase tracking-wider ${priorityClass}`}
                                >
                                  {t.priority}
                                </span>
                              </div>

                              {t.description && (
                                <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5 font-mono">
                                  {t.description}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Right Meta & Actions */}
                          <div className="flex items-center gap-2 shrink-0 text-xs font-mono justify-end">
                            {/* Subtasks Accordion Toggle */}
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedSubtasks((prev) => ({ ...prev, [t.id]: !isExpanded }))
                              }
                              aria-label={`Toggle subtasks for ${t.title}`}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-secondary/50 hover:bg-secondary border border-border/60 text-muted-foreground hover:text-foreground transition-colors text-[11px]"
                            >
                              <CheckSquare className="h-3 w-3 text-emerald-500" />
                              <span>
                                {subtasks.length > 0
                                  ? `${completedSubCount}/${subtasks.length} steps`
                                  : '+ Add steps'}
                              </span>
                              {isExpanded ? (
                                <ChevronUp className="h-3 w-3" />
                              ) : (
                                <ChevronDown className="h-3 w-3" />
                              )}
                            </button>

                            {/* Assigned Agent */}
                            {assignedAgent ? (
                              <div className="flex items-center gap-1.5 rounded-full bg-secondary/60 border border-border/80 px-2.5 py-0.5 text-foreground">
                                <AgentAvatar
                                  name={assignedAgent.name}
                                  avatarUrl={assignedAgent.identity?.avatar_url as string | undefined}
                                  size={16}
                                  showStatus={false}
                                />
                                <span className="font-semibold text-[11px] truncate max-w-[110px]">
                                  {assignedAgent.name}
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground/60 italic text-[10px]">Unassigned</span>
                            )}

                            {/* Direct Run */}
                            <button
                              type="button"
                              disabled={runningTaskId === t.id || !t.assigned_agent_id}
                              onClick={() => handleDirectExecuteTask(t)}
                              className="btn btn-xs btn-outline gap-1 text-primary hover:bg-primary/10 font-mono text-[10px] h-7 px-2 rounded-lg"
                              title={t.assigned_agent_id ? "Execute task with agent" : "Assign an agent to execute"}
                            >
                              {runningTaskId === t.id ? (
                                <RotateCw className="h-3 w-3 animate-spin" />
                              ) : (
                                <Play className="h-3 w-3 fill-current" />
                              )}
                              <span className="hidden sm:inline">Run</span>
                            </button>

                            {/* Delete */}
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`Delete task "${t.title}" from checklist?`)) {
                                  deleteTaskMutation.mutate(t.id);
                                }
                              }}
                              aria-label={`Delete task ${t.title}`}
                              className="h-7 w-7 rounded-lg border border-border/60 hover:border-rose-500/40 hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 flex items-center justify-center transition-colors"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>

                        {/* Subtasks Expanded Panel */}
                        {isExpanded && (
                          <div className="border-t border-border/60 bg-secondary/15 p-3.5 space-y-2.5">
                            <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                              <span className="font-semibold uppercase tracking-wider flex items-center gap-1.5">
                                <CheckSquare className="h-3.5 w-3.5 text-emerald-500" />
                                Subtask Steps ({subtasks.length})
                              </span>
                              {subtasks.length > 0 && (
                                <span>
                                  {Math.round((completedSubCount / subtasks.length) * 100)}% complete
                                </span>
                              )}
                            </div>

                            {/* Subtask list */}
                            {subtasks.length > 0 ? (
                              <div className="space-y-1.5">
                                {subtasks.map((st) => (
                                  <div
                                    key={st.id}
                                    className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-card border border-border/60 text-xs font-mono"
                                  >
                                    <label className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={st.completed}
                                        onChange={() => handleToggleSubtask(t, st.id)}
                                        className="h-4 w-4 rounded border-border text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                                      />
                                      <span
                                        className={`truncate ${
                                          st.completed ? 'line-through text-muted-foreground' : 'text-foreground font-medium'
                                        }`}
                                      >
                                        {st.title}
                                      </span>
                                    </label>

                                    <button
                                      type="button"
                                      onClick={() => handleDeleteSubtask(t, st.id)}
                                      aria-label={`Remove step ${st.title}`}
                                      className="p-1 rounded text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground italic">
                                No subtask steps yet. Add your first step below.
                              </p>
                            )}

                            {/* Add Subtask Step Input */}
                            <div className="flex items-center gap-2 pt-1">
                              <input
                                type="text"
                                value={newStepTitles[t.id] || ''}
                                onChange={(e) =>
                                  setNewStepTitles((prev) => ({ ...prev, [t.id]: e.target.value }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddSubtask(t);
                                  }
                                }}
                                placeholder="+ Add a step (e.g. 'Write unit tests', 'Verify AST boundaries')... press Enter"
                                aria-label="Add a subtask step"
                                className="flex-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                              />
                              <button
                                type="button"
                                onClick={() => handleAddSubtask(t)}
                                disabled={!(newStepTitles[t.id] || '').trim()}
                                className="px-3 py-1.5 rounded-lg bg-secondary border border-border hover:bg-primary hover:text-primary-foreground text-xs font-mono font-medium disabled:opacity-40 transition-colors"
                              >
                                Add Step
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* VIEW 3: TIMELINE (GANTT) VIEW */}
          {viewMode === 'timeline' && (
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <span className="text-xs font-semibold text-foreground block border-b border-border/60 pb-3">
                Task Execution Timeline & Precedence Schedule
              </span>
              <div className="space-y-3">
                {filteredTasks.map((t, idx) => {
                  const ag = agents.find((a) => a.id === t.assigned_agent_id);
                  return (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTaskId(t.id)}
                      className="flex items-center gap-4 text-xs cursor-pointer hover:opacity-90"
                    >
                      <div className="w-24 text-[11px] font-mono text-muted-foreground shrink-0">
                        {t.due_date ? new Date(t.due_date).toLocaleDateString() : `Step ${idx + 1}`}
                      </div>
                      <div className="flex-1 bg-secondary/50 rounded-lg p-2.5 border border-border/60 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Bot className="h-3.5 w-3.5 text-primary" />
                          <span className="font-semibold text-foreground">{t.title}</span>
                          <span className="text-[10px] text-muted-foreground">({ag?.name || 'Unassigned'})</span>
                        </div>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                          t.status === 'DONE' || t.status === 'COMPLETED'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        }`}>
                          {t.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* VIEW 4: DEPENDENCY GRAPH VIEW */}
          {viewMode === 'graph' && (
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <span className="text-xs font-semibold text-foreground block border-b border-border/60 pb-3">
                Task Dependency & Delegation Graph
              </span>
              <div className="p-6 rounded-xl bg-secondary/20 border border-border/60 flex flex-wrap gap-6 items-center justify-center">
                {filteredTasks.map((t, idx) => {
                  const ag = agents.find((a) => a.id === t.assigned_agent_id);
                  return (
                    <div key={t.id} className="flex items-center gap-4">
                      <div
                        onClick={() => setSelectedTaskId(t.id)}
                        className={`p-3 rounded-xl border bg-card cursor-pointer hover:border-primary transition-all text-xs space-y-1.5 w-52 shadow-sm ${
                          t.status === 'DONE' || t.status === 'COMPLETED'
                            ? 'border-emerald-500/40'
                            : t.status === 'BLOCKED'
                            ? 'border-rose-500/40'
                            : 'border-border'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] font-mono">
                          <span className="text-muted-foreground">Task #{idx + 1}</span>
                          <span className="text-primary">{t.status}</span>
                        </div>
                        <p className="font-semibold text-foreground truncate">{t.title}</p>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground pt-1 border-t border-border/40">
                          <Bot className="h-3 w-3 text-primary" />
                          <span className="truncate">{ag?.name || 'Unassigned'}</span>
                        </div>
                      </div>
                      {idx < filteredTasks.length - 1 && (
                        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* 6. TASK DETAILS DRAWER */}
      {selectedTaskId && activeProjectId && (
        <TaskDetailsDrawer
          companyId={companyId}
          projectId={activeProjectId}
          taskId={selectedTaskId}
          agents={agents}
          allTasks={tasks}
          roles={roles}
          onClose={() => setSelectedTaskId(null)}
        />
      )}

      {/* 7. CREATION MODAL */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md glass rounded-2xl p-6 ring-1 ring-border shadow-2xl">
            <h2 className="text-lg font-semibold text-foreground mb-4">Create New Agent Task</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Task Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  className="input w-full text-xs"
                  placeholder="e.g. Implement zero-trust security audit parser"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Agent Metaprompt & Instructions
                </label>
                <textarea
                  rows={3}
                  className="input w-full text-xs h-auto resize-none"
                  placeholder="Provide precise scope and requirements for the assigned agent..."
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Priority
                  </label>
                  <select
                    className="input w-full text-xs"
                    value={form.priority}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, priority: e.target.value as TaskPriority }))
                    }
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Assignee Agent
                  </label>
                  <select
                    className="input w-full text-xs"
                    value={form.assigned_agent_id ?? ''}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        assigned_agent_id: e.target.value || undefined,
                      }))
                    }
                  >
                    <option value="">Unassigned</option>
                    {agents.map((a) => {
                      const r = roles.find((ro) => ro.id === a.role_id);
                      return (
                        <option key={a.id} value={a.id}>
                          {a.name} ({r?.title || a.autonomy})
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {formError && (
                <p className="text-xs text-red-400 flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {formError}
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  className="btn btn-outline flex-1 text-xs"
                  onClick={() => {
                    setShowCreate(false);
                    setFormError(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary flex-1 text-xs"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? 'Creating...' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
