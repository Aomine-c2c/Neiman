"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Bot,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  Circle,
  Clock3,
  Cpu,
  Database,
  ExternalLink,
  FlaskConical,
  GitBranch,
  LayoutDashboard,
  ListTodo,
  LoaderCircle,
  PanelBottom,
  PanelLeft,
  PanelRight,
  Radio,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
  X,
} from "lucide-react";
import type {
  ActivityConnection,
  ActivityTransport,
} from "@/hooks/useActivityStream";
import type { ControlRoomState } from "@/lib/api/controlRoom";
import { ctoApi, type CTOProposal } from "@/lib/api/cto";
import { intelligenceApi } from "@/lib/api/intelligence";
import {
  DEFAULT_LAYOUT,
  type LayoutSettings,
} from "@/components/control-room/CanvasLayoutManager";

interface CommandCenterReferenceLayoutProps {
  companyId: string;
  companyName: string;
  state: ControlRoomState;
  connection: ActivityConnection;
  transport: ActivityTransport;
  layout?: LayoutSettings;
  onOpenDrawer?: (drawerId: string, entityId?: string) => void;
  onDecideApproval?: (
    approvalId: string,
    decision: "APPROVED" | "REJECTED",
  ) => void;
}

interface DirectiveMessage {
  id: string;
  sender: "OPERATOR" | "CTO";
  body: string;
  timestamp: string;
}

type DomainId =
  | "command"
  | "workforce"
  | "tasks"
  | "workflows"
  | "intelligence"
  | "governance"
  | "memory"
  | "simulation"
  | "settings";

type RightInspectorTab = "all" | "approvals" | "router" | "audit";

const SLASH_COMMANDS = [
  { cmd: "/tick", label: "Execute single supervisor cycle" },
  { cmd: "/play", label: "Start autonomous supervisor loop" },
  { cmd: "/pause", label: "Pause autonomous supervisor loop" },
  { cmd: "/approve-all", label: "Approve all pending CEO gates" },
  { cmd: "/simulate", label: "Open Simulation Lab" },
  { cmd: "/assign", label: "Open Task Execution Matrix" },
];

function Panel({
  title,
  children,
  action,
  className = "",
  minimized = false,
  pinned = false,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  minimized?: boolean;
  pinned?: boolean;
}) {
  return (
    <section
      className={`command-panel ${pinned ? "is-pinned" : ""} ${className}`}
    >
      <header className="command-panel__header">
        <span className="command-panel__title">
          <Circle size={8} />
          {title}
        </span>
        {action}
      </header>
      {!minimized && <div className="command-panel__body">{children}</div>}
    </section>
  );
}

function shortTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function statusClass(status: string): string {
  if (["ACTIVE", "WORKING", "COMPLETED", "ONLINE", "APPROVED"].includes(status))
    return "is-good";
  if (["BLOCKED", "FAILED", "OFFLINE", "CRITICAL", "REJECTED"].includes(status))
    return "is-bad";
  if (
    ["IN_PROGRESS", "PENDING", "DEGRADED", "WAITING", "ON_HOLD"].includes(
      status,
    )
  )
    return "is-warn";
  return "is-muted";
}

function valueOrUnavailable(
  value: number | null | undefined,
  suffix = "",
): string {
  return value === null || value === undefined
    ? "Unavailable"
    : `${value}${suffix}`;
}

export function CommandCenterReferenceLayout({
  companyId,
  companyName,
  state,
  connection,
  transport,
  layout = DEFAULT_LAYOUT,
  onOpenDrawer,
  onDecideApproval,
}: CommandCenterReferenceLayoutProps) {
  const queryClient = useQueryClient();
  const [directive, setDirective] = useState("");
  const [messages, setMessages] = useState<DirectiveMessage[]>([]);
  const [directiveError, setDirectiveError] = useState<string | null>(null);

  // Unified IDE Split-Dock State
  const [leftRailCollapsed, setLeftRailCollapsed] = useState(false);
  const [rightDockCollapsed, setRightDockCollapsed] = useState(false);
  const [lowerGraphCollapsed, setLowerGraphCollapsed] = useState(false);
  const [activeDomain, setActiveDomain] = useState<DomainId>("command");
  const [activeRightTab, setActiveRightTab] =
    useState<RightInspectorTab>("all");

  const vis = layout.panelVisibility ?? DEFAULT_LAYOUT.panelVisibility;
  const min = layout.minimizedPanels ?? {};
  const pin = layout.pinnedPanels ?? {};

  // Fetch proactive CTO proposals
  const { data: ctoProposals = [] } = useQuery<CTOProposal[]>({
    queryKey: ["cto-proposals", companyId],
    queryFn: () => ctoApi.getProposals(companyId),
    enabled: !!companyId,
  });

  const pendingProposals = ctoProposals.filter((p) => p.status === "PROPOSED");

  const proposalDecisionMutation = useMutation({
    mutationFn: ({
      proposalId,
      decision,
    }: {
      proposalId: string;
      decision: "APPROVED" | "DISMISSED";
    }) => ctoApi.decideProposal(companyId, proposalId, { decision }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["cto-proposals", companyId] });
      queryClient.invalidateQueries({
        queryKey: ["control-room-state", companyId],
      });
      const timestamp = new Date().toISOString();
      setMessages((current) => [
        ...current,
        {
          id: `prop-${updated.id}-${Date.now()}`,
          sender: "CTO",
          body: `Proposal "${updated.title}" ${updated.status}.`,
          timestamp,
        },
      ]);
    },
  });

  const directiveMutation = useMutation({
    mutationFn: (text: string) =>
      ctoApi.sendDirective(companyId, { directive: text, priority: "HIGH" }),
    onSuccess: (response, text) => {
      const timestamp = new Date().toISOString();
      const msgId =
        response.directive_id ||
        `dir-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const ctoReply =
        response.summary ||
        response.analysis ||
        `Processed directive (${response.tasks_created_count} task(s) delegated).`;
      setMessages((current) => [
        ...current,
        {
          id: `${msgId}-operator`,
          sender: "OPERATOR",
          body: text,
          timestamp,
        },
        {
          id: `${msgId}-cto`,
          sender: "CTO",
          body: ctoReply,
          timestamp,
        },
      ]);
      setDirective("");
      setDirectiveError(null);
      queryClient.invalidateQueries({
        queryKey: ["control-room-state", companyId],
      });
      queryClient.invalidateQueries({
        queryKey: ["supervisor-status", companyId],
      });
    },
    onError: (error: unknown) => {
      setDirectiveError(
        error instanceof Error
          ? error.message
          : "The directive could not be submitted.",
      );
    },
  });

  const providerSwitchMutation = useMutation({
    mutationFn: ({ provider }: { provider: string; displayName: string }) =>
      intelligenceApi.configureProvider(companyId, provider, {
        set_as_primary: true,
      }),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({
        queryKey: ["control-room-state", companyId],
      });
      const timestamp = new Date().toISOString();
      setMessages((current) => [
        ...current,
        {
          id: `prov-${vars.provider}-${Date.now()}`,
          sender: "CTO",
          body: `Primary provider switched to ${vars.displayName}.`,
          timestamp,
        },
      ]);
    },
  });

  const pendingApprovals = state.approvals.filter(
    (approval) => approval.status === "PENDING",
  );
  const resolveTargetLabel = (rawTarget: string): string => {
    if (rawTarget.startsWith("Task:")) {
      const taskId = rawTarget.slice("Task:".length).trim();
      const matchedTask =
        state.tasks.find((t) => t.id === taskId) ||
        state.tasks.find((t) => t.id.startsWith(taskId));
      if (matchedTask) {
        return `Task: ${matchedTask.title}`;
      }
    }
    return rawTarget;
  };
  const activeProject =
    state.projects.find((project) => project.status === "ACTIVE") ??
    state.projects[0];
  const activeProjectTasks = activeProject
    ? state.tasks.filter((task) => task.project_id === activeProject.id)
    : [];
  const completedTasks = activeProjectTasks.filter(
    (task) => task.status === "COMPLETED",
  ).length;
  const projectProgress = activeProjectTasks.length
    ? Math.round((completedTasks / activeProjectTasks.length) * 100)
    : 0;
  const cpu = state.resources.compute_used_pct;
  const ram = state.resources.memory_limit_gb
    ? Math.round(
        ((state.resources.memory_used_gb ?? 0) /
          state.resources.memory_limit_gb) *
          100,
      )
    : null;

  const appendLog = (operatorText: string, ctoReply: string) => {
    const timestamp = new Date().toISOString();
    const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setMessages((current) => [
      ...current,
      { id: `${uid}-op`, sender: "OPERATOR", body: operatorText, timestamp },
      { id: `${uid}-cto`, sender: "CTO", body: ctoReply, timestamp },
    ]);
  };

  const executeSlashCommand = async (raw: string): Promise<boolean> => {
    const cmd = raw.toLowerCase().trim();
    if (cmd === "/tick") {
      try {
        const res = await ctoApi.triggerTick(companyId);
        appendLog(
          raw,
          res.message || `Supervisor cycle ${res.cycle} executed (${res.status}).`,
        );
        queryClient.invalidateQueries({
          queryKey: ["supervisor-status", companyId],
        });
        queryClient.invalidateQueries({
          queryKey: ["control-room-state", companyId],
        });
      } catch (err) {
        setDirectiveError(
          err instanceof Error ? err.message : "Tick execution failed.",
        );
      }
      setDirective("");
      return true;
    }

    if (cmd === "/play" || cmd === "/pause") {
      const action = cmd === "/play" ? "PLAY" : "PAUSE";
      try {
        const res = await ctoApi.toggleSupervisor(companyId, action);
        appendLog(
          raw,
          `Supervisor state set to ${res.state} (Cycle ${res.active_cycle}).`,
        );
        queryClient.invalidateQueries({
          queryKey: ["supervisor-status", companyId],
        });
      } catch (err) {
        setDirectiveError(
          err instanceof Error ? err.message : "Supervisor toggle failed.",
        );
      }
      setDirective("");
      return true;
    }

    if (cmd === "/approve-all") {
      if (pendingApprovals.length === 0) {
        appendLog(raw, "Zero pending approval requests in queue.");
      } else {
        pendingApprovals.forEach((ap) => onDecideApproval?.(ap.id, "APPROVED"));
        appendLog(
          raw,
          `Approved ${pendingApprovals.length} pending governance gate(s).`,
        );
      }
      setDirective("");
      return true;
    }

    if (cmd === "/simulate") {
      setActiveDomain("simulation");
      onOpenDrawer?.("simulation");
      appendLog(raw, "Opened Simulation Lab workspace.");
      setDirective("");
      return true;
    }

    if (cmd.startsWith("/assign")) {
      setActiveDomain("tasks");
      onOpenDrawer?.("tasks");
      appendLog(raw, "Opened Task Execution Matrix.");
      setDirective("");
      return true;
    }

    return false;
  };

  const submitDirective = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = directive.trim();
    if (!trimmed || directiveMutation.isPending) return;
    if (trimmed.startsWith("/")) {
      const handled = await executeSlashCommand(trimmed);
      if (handled) return;
    }
    directiveMutation.mutate(trimmed);
  };

  const domainNavItems: Array<{
    id: DomainId;
    label: string;
    ariaLabel: string;
    icon: React.ReactNode;
    badge?: number;
  }> = [
    {
      id: "command",
      label: "Command Center",
      ariaLabel: "Navigate to Command Center domain",
      icon: <LayoutDashboard size={12} />,
      badge: pendingProposals.length || undefined,
    },
    {
      id: "workforce",
      label: "Workforce",
      ariaLabel: "Navigate to Workforce domain",
      icon: <Users size={12} />,
      badge: state.agents.length,
    },
    {
      id: "tasks",
      label: "Tasks & DAG",
      ariaLabel: "Navigate to Tasks domain",
      icon: <ListTodo size={12} />,
      badge: state.tasks.length,
    },
    {
      id: "workflows",
      label: "Workflows",
      ariaLabel: "Navigate to Workflows domain",
      icon: <Workflow size={12} />,
      badge: state.projects.length,
    },
    {
      id: "intelligence",
      label: "Intelligence",
      ariaLabel: "Navigate to Intelligence domain",
      icon: <Sparkles size={12} />,
      badge: state.providers.filter((p) => p.is_configured).length,
    },
    {
      id: "governance",
      label: "Governance",
      ariaLabel: "Navigate to Governance domain",
      icon: <ShieldCheck size={12} />,
      badge: pendingApprovals.length,
    },
    {
      id: "memory",
      label: "Memory",
      ariaLabel: "Navigate to Memory domain",
      icon: <Database size={12} />,
      badge: state.memories.length,
    },
    {
      id: "simulation",
      label: "Simulation",
      ariaLabel: "Navigate to Simulation domain",
      icon: <FlaskConical size={12} />,
    },
    {
      id: "settings",
      label: "Settings",
      ariaLabel: "Navigate to Settings domain",
      icon: <Settings size={12} />,
    },
  ];

  const showApprovalsPanel =
    (activeRightTab === "all" || activeRightTab === "approvals") &&
    vis.executiveGate;
  const showRouterPanels =
    activeRightTab === "all" || activeRightTab === "router";
  const showAuditPanels =
    activeRightTab === "all" || activeRightTab === "audit";

  return (
    <div
      className={`command-center-reference ${
        layout.density === "expanded" ? "is-expanded" : ""
      } ${leftRailCollapsed ? "is-left-collapsed" : ""} ${
        rightDockCollapsed ? "is-right-collapsed" : ""
      }`}
      aria-label={`${companyName} command center`}
    >
      {/* Unified IDE Split-Dock Workspace Toolbar */}
      <div className="command-ide-toolbar">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Toggle Left Navigation Rail"
            aria-pressed={!leftRailCollapsed}
            onClick={() => setLeftRailCollapsed((v) => !v)}
            className={`command-dock-btn ${!leftRailCollapsed ? "is-active" : ""}`}
            title="Toggle Left Navigation Rail"
          >
            <PanelLeft size={13} />
            <span>Sidebar</span>
          </button>

          <span className="text-muted-foreground/50">|</span>

          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
            <span className="text-primary">WORKSPACE:</span>
            <span className="text-foreground">
              {domainNavItems.find((d) => d.id === activeDomain)?.label ??
                "Command Center"}
            </span>
          </div>

          {activeDomain !== "command" && (
            <button
              type="button"
              aria-label="Return to Command Center"
              onClick={() => setActiveDomain("command")}
              className="command-dock-btn is-accent ml-2"
            >
              <ArrowLeft size={11} />
              <span>Return to Command Center</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {activeDomain === "command" && (
            <button
              type="button"
              aria-label="Toggle Lower Execution Pane"
              aria-pressed={!lowerGraphCollapsed}
              onClick={() => setLowerGraphCollapsed((v) => !v)}
              className={`command-dock-btn ${!lowerGraphCollapsed ? "is-active" : ""}`}
              title="Toggle Lower Mission & Execution Split Pane"
            >
              <PanelBottom size={13} />
              <span className="hidden sm:inline">Execution Split</span>
            </button>
          )}

          <button
            type="button"
            aria-label="Toggle Right Inspector Dock"
            aria-pressed={!rightDockCollapsed}
            onClick={() => setRightDockCollapsed((v) => !v)}
            className={`command-dock-btn ${!rightDockCollapsed ? "is-active" : ""}`}
            title="Toggle Right 3-Tab Inspector Dock"
          >
            <PanelRight size={13} />
            <span>Inspector</span>
          </button>
        </div>
      </div>

      {/* LEFT NAVIGATION RAIL (Segmented: Top Domains + Bottom Live Tree) */}
      {!leftRailCollapsed && (
        <aside className="command-left-stack">
          <Panel
            title="Workspace domains"
            className="command-domain-nav"
            action={
              <span className="text-[9px] text-muted-foreground font-mono">
                IDE DOCK
              </span>
            }
          >
            <nav
              aria-label="Domain navigation"
              className="grid grid-cols-1 gap-0.5 overflow-y-auto"
            >
              {domainNavItems.map((item) => {
                const isActive = activeDomain === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-label={item.ariaLabel}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => setActiveDomain(item.id)}
                    className={`command-domain-btn ${isActive ? "is-active" : ""}`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      {item.icon}
                      <span className="truncate">{item.label}</span>
                    </span>
                    {item.badge !== undefined && (
                      <span
                        className={`command-domain-badge ${
                          item.id === "governance" && item.badge > 0
                            ? "is-bad"
                            : ""
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </Panel>

          {vis.workforce && (
            <Panel
              title={`Swarm workforce (${state.agents.length})`}
              className="command-workforce"
              minimized={min.workforce}
              pinned={pin.workforce}
              action={
                <button
                  type="button"
                  className="command-link"
                  onClick={() => setActiveDomain("workforce")}
                >
                  VIEW <ChevronRight size={12} />
                </button>
              }
            >
              <div className="command-table-head command-agent-row">
                <span>POS</span>
                <span>AGENT</span>
                <span>STATUS</span>
                <span>TASK</span>
              </div>
              <div className="command-scroll">
                {state.agents.length ? (
                  state.agents.map((agent, index) => {
                    const currentTask = state.tasks.find(
                      (task) =>
                        task.assigned_agent_id === agent.id &&
                        task.status === "IN_PROGRESS",
                    );
                    return (
                      <button
                        key={agent.id}
                        className="command-agent-row command-list-row"
                        onClick={() => onOpenDrawer?.("agents", agent.id)}
                      >
                        <span className="command-position">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="command-ellipsis">{agent.name}</span>
                        <span
                          className={`command-state ${statusClass(agent.status)}`}
                        >
                          <i />
                          {agent.status.replace("_", " ")}
                        </span>
                        <span className="command-ellipsis command-task-name">
                          {currentTask?.title ?? "—"}
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <EmptyLine label="No workforce data available" />
                )}
              </div>
            </Panel>
          )}

          {vis.timeline && (
            <Panel
              title={`Task backlog (${state.tasks.length})`}
              className="command-backlog"
              minimized={min.timeline}
              pinned={pin.timeline}
              action={
                <button
                  className="command-link"
                  onClick={() => onOpenDrawer?.("tasks")}
                >
                  OPEN <ChevronRight size={12} />
                </button>
              }
            >
              <div className="command-scroll">
                {state.projects.length ? (
                  state.projects.map((project) => {
                    const tasks = state.tasks.filter(
                      (task) => task.project_id === project.id,
                    );
                    const done = tasks.filter(
                      (task) => task.status === "COMPLETED",
                    ).length;
                    const blocked = tasks.filter(
                      (task) => task.status === "BLOCKED",
                    ).length;
                    return (
                      <div key={project.id} className="command-project-row">
                        <div className="command-project-heading">
                          <BriefcaseBusiness size={12} />
                          <span className="command-ellipsis">{project.name}</span>
                          <b className={statusClass(project.status)}>
                            {project.status.replace("_", " ")}
                          </b>
                        </div>
                        <div className="command-progress">
                          <span
                            style={{
                              width: `${tasks.length ? Math.round((done / tasks.length) * 100) : 0}%`,
                            }}
                          />
                        </div>
                        <div className="command-project-meta">
                          <span>
                            {done}/{tasks.length} complete
                          </span>
                          <span className={blocked ? "is-bad" : "is-muted"}>
                            {blocked} blocked
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <EmptyLine label="No projects available" />
                )}
              </div>
            </Panel>
          )}

          {vis.activity && (
            <Panel
              title={`Agent activity (${state.activity.length})`}
              className="command-activity"
              minimized={min.activity}
              pinned={pin.activity}
              action={
                <button
                  className="command-link"
                  onClick={() => onOpenDrawer?.("activity")}
                >
                  STREAM <ChevronRight size={12} />
                </button>
              }
            >
              <div className="command-scroll">
                {state.activity.slice(0, 5).map((event) => (
                  <button
                    key={event.id}
                    className="command-activity-row"
                    onClick={() => onOpenDrawer?.("activity", event.id)}
                  >
                    <time>{shortTime(event.timestamp)}</time>
                    <span className="command-ellipsis">
                      {event.title || event.event_type}
                    </span>
                    <b>{event.agent_name || event.project_name || "SYSTEM"}</b>
                  </button>
                ))}
                {!state.activity.length && (
                  <EmptyLine label="Waiting for activity events" />
                )}
              </div>
            </Panel>
          )}
        </aside>
      )}

      {/* CENTER WORKSPACE (Full-Height Inline Domain Surface or Split CTO + DAG Command View) */}
      <main
        className={`command-center-stack ${
          activeDomain !== "command" || lowerGraphCollapsed
            ? "is-single-pane"
            : ""
        }`}
      >
        {activeDomain === "command" ? (
          <>
            <Panel
              title="CTO directives & interaction console"
              className="command-chat"
              action={
                <span className="command-live">
                  <Radio size={11} /> LIVE
                </span>
              }
            >
              <div className="command-chat-history" aria-live="polite">
                {!messages.length && !pendingProposals.length && (
                  <div className="command-chat-empty">
                    <Bot size={22} />
                    <div>
                      <strong>Autonomous CTO</strong>
                      <p>
                        Send an operational directive or type a slash command (
                        <code>/tick</code>, <code>/approve-all</code>,{" "}
                        <code>/simulate</code>, <code>/assign</code>).
                      </p>
                    </div>
                  </div>
                )}

                {/* Proactive CTO Proposals Inline Cards */}
                {pendingProposals.length > 0 && (
                  <div className="mb-3 space-y-2">
                    {pendingProposals.slice(0, 3).map((proposal) => (
                      <article
                        key={proposal.id}
                        className="command-approval-card"
                        aria-label={`CTO Proposal: ${proposal.title}`}
                      >
                        <div>
                          <b className="flex items-center gap-1">
                            <Sparkles size={10} />
                            {proposal.title}
                          </b>
                          <span className="command-risk is-warn">
                            {proposal.category}
                          </span>
                        </div>
                        <p>{proposal.rationale}</p>
                        <small>{proposal.impact_assessment}</small>
                        <footer>
                          <button
                            type="button"
                            aria-label={`Approve Proposal ${proposal.title}`}
                            disabled={proposalDecisionMutation.isPending}
                            onClick={() =>
                              proposalDecisionMutation.mutate({
                                proposalId: proposal.id,
                                decision: "APPROVED",
                              })
                            }
                          >
                            <Check size={12} /> Approve
                          </button>
                          <button
                            type="button"
                            aria-label={`Dismiss Proposal ${proposal.title}`}
                            disabled={proposalDecisionMutation.isPending}
                            onClick={() =>
                              proposalDecisionMutation.mutate({
                                proposalId: proposal.id,
                                decision: "DISMISSED",
                              })
                            }
                          >
                            <X size={12} /> Dismiss
                          </button>
                        </footer>
                      </article>
                    ))}
                  </div>
                )}

                {messages.map((message) => (
                  <article
                    key={message.id}
                    className={`command-message command-message--${message.sender.toLowerCase()}`}
                  >
                    <div className="command-message-meta">
                      <b>{message.sender === "OPERATOR" ? "YOU" : "CTO"}</b>
                      <time>{shortTime(message.timestamp)}</time>
                    </div>
                    <p>{message.body}</p>
                  </article>
                ))}
                {directiveMutation.isPending && (
                  <div className="command-message-pending">
                    <LoaderCircle size={13} /> CTO is processing the directive…
                  </div>
                )}
                {directiveError && (
                  <div className="command-error" role="alert">
                    <AlertTriangle size={13} />
                    {directiveError}
                  </div>
                )}
              </div>

              {/* Quick Slash Command Chips */}
              <div className="px-2 pb-1.5 flex items-center gap-1 overflow-x-auto scrollbar-hide">
                {SLASH_COMMANDS.map((sc) => (
                  <button
                    key={sc.cmd}
                    type="button"
                    onClick={() => setDirective(sc.cmd)}
                    title={sc.label}
                    className="px-1.5 py-0.5 rounded border border-border/60 bg-secondary/40 hover:bg-secondary text-[9px] font-mono text-muted-foreground hover:text-foreground shrink-0 transition-colors"
                  >
                    {sc.cmd}
                  </button>
                ))}
              </div>

              <form className="command-input-row" onSubmit={submitDirective}>
                <input
                  aria-label="Send a CTO directive"
                  value={directive}
                  onChange={(event) => setDirective(event.target.value)}
                  placeholder="Type a directive or /tick, /approve-all, /simulate…"
                  disabled={directiveMutation.isPending}
                />
                <span>Enter to send</span>
                <button
                  aria-label="Send directive"
                  type="submit"
                  disabled={!directive.trim() || directiveMutation.isPending}
                >
                  <Send size={14} />
                </button>
              </form>
            </Panel>

            {!lowerGraphCollapsed && (
              <div className="command-center-lower">
                <Panel
                  title="Mission & dependency graph"
                  className="command-mission"
                  action={
                    <button
                      className="command-link"
                      onClick={() => onOpenDrawer?.("workflows")}
                    >
                      DETAILS <ChevronRight size={12} />
                    </button>
                  }
                >
                  <div className="command-mission-summary">
                    {activeProject ? (
                      <>
                        <b>{activeProject.name}</b>
                        <span>{activeProjectTasks.length} linked tasks</span>
                      </>
                    ) : (
                      <EmptyLine label="No project graph to display" />
                    )}
                  </div>
                  {activeProjectTasks.length > 0 && (
                    <div className="command-task-graph">
                      {activeProjectTasks.slice(0, 6).map((task, index) => (
                        <div key={task.id} className="command-graph-task">
                          <span
                            className={`command-graph-node ${statusClass(task.status)}`}
                          />
                          <div>
                            <b>{task.title}</b>
                            <span className={statusClass(task.status)}>
                              {task.status.replace("_", " ")}
                            </span>
                          </div>
                          {index <
                            Math.min(activeProjectTasks.length, 6) - 1 && (
                            <i className="command-graph-link" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>

                <Panel
                  title="Engineering execution"
                  className="command-engineering"
                  action={
                    <button
                      className="command-link"
                      onClick={() => onOpenDrawer?.("projects")}
                    >
                      PROJECTS <ChevronRight size={12} />
                    </button>
                  }
                >
                  {activeProject ? (
                    <>
                      <div className="command-project-heading">
                        <GitBranch size={13} />
                        <span className="command-ellipsis">
                          {activeProject.name}
                        </span>
                        <b className={statusClass(activeProject.status)}>
                          {activeProject.status}
                        </b>
                      </div>
                      <div className="command-progress command-progress--large">
                        <span style={{ width: `${projectProgress}%` }} />
                      </div>
                      <div className="command-project-meta">
                        <span>
                          {completedTasks} of {activeProjectTasks.length} tasks
                          complete
                        </span>
                        <span>{projectProgress}%</span>
                      </div>
                      <div className="command-metrics-row">
                        <span>
                          Active{" "}
                          <b>
                            {
                              activeProjectTasks.filter(
                                (task) => task.status === "IN_PROGRESS",
                              ).length
                            }
                          </b>
                        </span>
                        <span>
                          Blocked{" "}
                          <b className="is-bad">
                            {
                              activeProjectTasks.filter(
                                (task) => task.status === "BLOCKED",
                              ).length
                            }
                          </b>
                        </span>
                        <span>
                          Queued{" "}
                          <b>
                            {
                              activeProjectTasks.filter(
                                (task) => task.status === "PENDING",
                              ).length
                            }
                          </b>
                        </span>
                      </div>
                      <button
                        className="command-full-link"
                        onClick={() =>
                          onOpenDrawer?.("projects", activeProject.id)
                        }
                      >
                        Open project workbench <ChevronRight size={13} />
                      </button>
                    </>
                  ) : (
                    <EmptyLine label="No active project selected" />
                  )}
                </Panel>
              </div>
            )}
          </>
        ) : (
          /* INLINE DOMAIN WORKSPACE VIEW */
          <Panel
            title={`${
              domainNavItems.find((d) => d.id === activeDomain)?.label ??
              activeDomain
            } Workspace`}
            className="h-full"
            action={
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="command-link"
                  onClick={() =>
                    onOpenDrawer?.(
                      activeDomain === "workforce"
                        ? "agents"
                        : activeDomain === "governance"
                          ? "approvals"
                          : activeDomain,
                    )
                  }
                >
                  DEEP INSPECTOR <ExternalLink size={11} />
                </button>
              </div>
            }
          >
            <div className="command-scroll space-y-3 p-1">
              {activeDomain === "workforce" && (
                <div className="space-y-2">
                  <div className="command-table-head command-agent-row">
                    <span>POS</span>
                    <span>AGENT</span>
                    <span>STATUS</span>
                    <span>ASSIGNED TASK</span>
                  </div>
                  {state.agents.length ? (
                    state.agents.map((agent, index) => {
                      const currentTask = state.tasks.find(
                        (t) =>
                          t.assigned_agent_id === agent.id &&
                          t.status === "IN_PROGRESS",
                      );
                      return (
                        <button
                          key={agent.id}
                          className="command-agent-row command-list-row py-1.5"
                          onClick={() => onOpenDrawer?.("agents", agent.id)}
                        >
                          <span className="command-position">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <span className="font-semibold">{agent.name}</span>
                          <span
                            className={`command-state ${statusClass(agent.status)}`}
                          >
                            <i />
                            {agent.status.replace("_", " ")}
                          </span>
                          <span className="command-ellipsis command-task-name">
                            {currentTask?.title ?? "Idle / Ready for dispatch"}
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    <EmptyLine label="No workforce agents registered." />
                  )}
                </div>
              )}

              {activeDomain === "tasks" && (
                <div className="space-y-2">
                  {state.tasks.length ? (
                    state.tasks.map((task) => (
                      <div key={task.id} className="command-approval-card">
                        <div>
                          <b>{task.title}</b>
                          <span
                            className={`command-risk ${statusClass(task.status)}`}
                          >
                            {task.status}
                          </span>
                        </div>
                        <small>Priority: {task.priority}</small>
                      </div>
                    ))
                  ) : (
                    <EmptyLine label="No tasks in current backlog." />
                  )}
                </div>
              )}

              {activeDomain === "workflows" && (
                <div className="space-y-2">
                  {state.projects.length ? (
                    state.projects.map((project) => (
                      <div key={project.id} className="command-approval-card">
                        <div>
                          <b>{project.name}</b>
                          <span
                            className={`command-risk ${statusClass(project.status)}`}
                          >
                            {project.status}
                          </span>
                        </div>
                        <p>
                          {
                            state.tasks.filter(
                              (t) => t.project_id === project.id,
                            ).length
                          }{" "}
                          tasks in execution graph
                        </p>
                      </div>
                    ))
                  ) : (
                    <EmptyLine label="No active workflows or projects." />
                  )}
                </div>
              )}

              {activeDomain === "intelligence" && (
                <div className="space-y-2">
                  {state.providers.map((provider) => (
                    <div key={provider.id} className="command-approval-card">
                      <div>
                        <b>
                          {provider.name} {provider.is_primary ? "★ PRIMARY" : ""}
                        </b>
                        <span
                          className={`command-risk ${statusClass(provider.status)}`}
                        >
                          {provider.status}
                        </span>
                      </div>
                      <small>Provider ID: {provider.provider}</small>
                      <footer>
                        <button
                          type="button"
                          onClick={() =>
                            providerSwitchMutation.mutate({
                              provider: provider.provider,
                              displayName: provider.name,
                            })
                          }
                        >
                          <Check size={12} /> Set Primary
                        </button>
                      </footer>
                    </div>
                  ))}
                </div>
              )}

              {activeDomain === "governance" && (
                <div className="space-y-2">
                  {pendingApprovals.length ? (
                    pendingApprovals.map((approval) => (
                      <article
                        key={approval.id}
                        className="command-approval-card"
                      >
                        <div>
                          <b>
                            {(
                              approval.action_type ||
                              approval.action ||
                              "AUTONOMOUS_ACTION"
                            ).replaceAll("_", " ")}
                          </b>
                          <span
                            className={`command-risk ${statusClass(approval.risk_level)}`}
                          >
                            {approval.risk_level}
                          </span>
                        </div>
                        <p>{approval.reason}</p>
                        <small>
                          {resolveTargetLabel(
                            approval.target_resource ||
                              approval.target ||
                              "system",
                          )}
                        </small>
                        <footer>
                          <button
                            type="button"
                            onClick={() =>
                              onDecideApproval?.(approval.id, "APPROVED")
                            }
                          >
                            <Check size={12} /> Approve
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onDecideApproval?.(approval.id, "REJECTED")
                            }
                          >
                            <X size={12} /> Reject
                          </button>
                        </footer>
                      </article>
                    ))
                  ) : (
                    <EmptyLine label="Zero pending governance approvals." />
                  )}
                </div>
              )}

              {activeDomain === "memory" && (
                <div className="space-y-2">
                  {state.memories.length ? (
                    state.memories.map((memory) => (
                      <div key={memory.id} className="command-approval-card">
                        <div>
                          <b>{memory.title}</b>
                          <span className="command-risk is-good">
                            {memory.domain}
                          </span>
                        </div>
                        <p>{memory.content}</p>
                      </div>
                    ))
                  ) : (
                    <EmptyLine label="No semantic company memories indexed." />
                  )}
                </div>
              )}

              {(activeDomain === "simulation" ||
                activeDomain === "settings") && (
                <div className="command-approval-card">
                  <div>
                    <b>{activeDomain.toUpperCase()} CONTROL SURFACE</b>
                    <span className="command-risk is-good">READY</span>
                  </div>
                  <p>
                    Interactive {activeDomain} configuration and sandboxed
                    routines are active for {companyName}.
                  </p>
                  <footer>
                    <button
                      type="button"
                      onClick={() => onOpenDrawer?.(activeDomain)}
                    >
                      Open Full {activeDomain} Workbench
                    </button>
                  </footer>
                </div>
              )}
            </div>
          </Panel>
        )}
      </main>

      {/* RIGHT 3-TAB CONTEXT INSPECTOR DOCK */}
      {!rightDockCollapsed && (
        <aside className="command-right-stack">
          {/* 3-Tab Segmented Inspector Header */}
          <div
            role="tablist"
            aria-label="Right Context Inspector Tabs"
            className="command-inspector-tabs"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeRightTab === "approvals"}
              onClick={() =>
                setActiveRightTab((cur) =>
                  cur === "approvals" ? "all" : "approvals",
                )
              }
              className={`command-inspector-tab ${
                activeRightTab === "approvals" ? "is-active" : ""
              }`}
            >
              <span>Approvals</span>
              <b
                className={
                  pendingApprovals.length > 0 ? "is-bad" : "is-muted"
                }
              >
                {pendingApprovals.length}
              </b>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeRightTab === "router"}
              onClick={() =>
                setActiveRightTab((cur) =>
                  cur === "router" ? "all" : "router",
                )
              }
              className={`command-inspector-tab ${
                activeRightTab === "router" ? "is-active" : ""
              }`}
            >
              <span>Router &amp; Resources</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeRightTab === "audit"}
              onClick={() =>
                setActiveRightTab((cur) => (cur === "audit" ? "all" : "audit"))
              }
              className={`command-inspector-tab ${
                activeRightTab === "audit" ? "is-active" : ""
              }`}
            >
              <span>Audit &amp; Memory</span>
            </button>
          </div>

          <div className="command-inspector-body">
            {/* TAB 1: APPROVALS GATE */}
            {showApprovalsPanel && (
              <Panel
                title={`CEO approval queue (${pendingApprovals.length})`}
                className="command-approvals"
                minimized={min.executiveGate}
                pinned={pin.executiveGate}
                action={
                  <div className="flex items-center gap-1.5">
                    {pendingApprovals.length > 1 && (
                      <button
                        type="button"
                        className="command-link"
                        title="Approve all pending governance gates"
                        onClick={() =>
                          pendingApprovals.forEach((ap) =>
                            onDecideApproval?.(ap.id, "APPROVED"),
                          )
                        }
                      >
                        APPROVE ALL
                      </button>
                    )}
                    <button
                      className="command-link"
                      onClick={() => onOpenDrawer?.("approvals")}
                    >
                      QUEUE <ChevronRight size={12} />
                    </button>
                  </div>
                }
              >
                <div className="command-scroll">
                  {pendingApprovals.length ? (
                    pendingApprovals.slice(0, 4).map((approval) => {
                      const actionLabel = (
                        approval.action_type ||
                        approval.action ||
                        approval.title ||
                        "AUTONOMOUS_ACTION"
                      ).replaceAll("_", " ");
                      const rawTarget =
                        approval.target_resource ||
                        approval.target ||
                        "system";
                      const targetLabel = resolveTargetLabel(rawTarget);
                      return (
                        <article
                          key={approval.id}
                          className="command-approval-card"
                        >
                          <div>
                            <b>{actionLabel}</b>
                            <span
                              className={`command-risk ${statusClass(approval.risk_level)}`}
                            >
                              {approval.risk_level}
                            </span>
                          </div>
                          <p>{approval.reason}</p>
                          <small>{targetLabel}</small>
                          <footer>
                            <button
                              type="button"
                              onClick={() =>
                                onDecideApproval?.(approval.id, "APPROVED")
                              }
                            >
                              <Check size={12} /> Approve
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onDecideApproval?.(approval.id, "REJECTED")
                              }
                            >
                              <X size={12} /> Reject
                            </button>
                          </footer>
                        </article>
                      );
                    })
                  ) : (
                    <EmptyLine label="No approvals awaiting review" />
                  )}
                </div>
              </Panel>
            )}

            {/* TAB 2: AI ROUTER & RESOURCES */}
            {showRouterPanels && vis.systemHealth && (
              <Panel
                title="System & provider health"
                className="command-health"
                minimized={min.systemHealth}
                pinned={pin.systemHealth}
                action={
                  <button
                    className="command-link"
                    onClick={() => onOpenDrawer?.("intelligence")}
                  >
                    DETAILS <ChevronRight size={12} />
                  </button>
                }
              >
                <div className="command-health-grid">
                  <div className="command-provider-list">
                    <strong>MODEL PROVIDERS</strong>
                    {state.providers.slice(0, 5).map((provider) => (
                      <button
                        key={provider.id}
                        type="button"
                        aria-label={`Set ${provider.name} as primary provider`}
                        disabled={providerSwitchMutation.isPending}
                        onClick={() =>
                          providerSwitchMutation.mutate({
                            provider: provider.provider,
                            displayName: provider.name,
                          })
                        }
                        className="command-provider-row text-left w-full"
                        title={
                          provider.is_primary
                            ? `${provider.name} (Primary Active)`
                            : `Click to set ${provider.name} as primary provider`
                        }
                      >
                        <span
                          className={`command-provider-dot ${statusClass(provider.status)}`}
                        />
                        <span className="command-ellipsis">
                          {provider.name}
                          {provider.is_primary ? " ★" : ""}
                        </span>
                        <b className={statusClass(provider.status)}>
                          {provider.is_primary ? "PRIMARY" : provider.status}
                        </b>
                      </button>
                    ))}
                    {!state.providers.length && (
                      <EmptyLine label="No provider status available" />
                    )}
                  </div>
                  <div className="command-resource-list">
                    <strong>SYSTEM RESOURCES</strong>
                    <Metric
                      label="CPU"
                      value={valueOrUnavailable(cpu, "%")}
                      percent={cpu}
                    />
                    <Metric
                      label="RAM"
                      value={valueOrUnavailable(ram, "%")}
                      percent={ram}
                    />
                    <Metric
                      label="TOKENS"
                      value={
                        state.resources.token_usage_total == null
                          ? "Unavailable"
                          : state.resources.token_usage_total.toLocaleString()
                      }
                    />
                    <Metric
                      label="SPEND"
                      value={
                        state.resources.intelligence_cost_usd == null
                          ? "Unavailable"
                          : `$${state.resources.intelligence_cost_usd.toFixed(2)}`
                      }
                    />
                  </div>
                </div>
              </Panel>
            )}

            {showRouterPanels && vis.intelligence && (
              <Panel
                title="Resource & model telemetry"
                className="command-resource"
                minimized={min.intelligence}
                pinned={pin.intelligence}
                action={
                  <button
                    className="command-link"
                    onClick={() => onOpenDrawer?.("resources")}
                  >
                    RESOURCES <ChevronRight size={12} />
                  </button>
                }
              >
                <div className="command-resource-summary">
                  <div>
                    <Cpu size={13} />
                    <span>Compute</span>
                    <b>{valueOrUnavailable(cpu, "%")}</b>
                  </div>
                  <div>
                    <Database size={13} />
                    <span>Memory</span>
                    <b>
                      {state.resources.memory_used_gb == null
                        ? "Unavailable"
                        : `${state.resources.memory_used_gb} GB`}
                    </b>
                  </div>
                  <div>
                    <Clock3 size={13} />
                    <span>Tokens used</span>
                    <b>
                      {state.resources.token_usage_total?.toLocaleString() ??
                        "Unavailable"}
                    </b>
                  </div>
                  <div>
                    <Activity size={13} />
                    <span>Budget spent</span>
                    <b>
                      {state.resources.budget_spent_usd == null
                        ? "Unavailable"
                        : `$${state.resources.budget_spent_usd.toFixed(2)}`}
                    </b>
                  </div>
                </div>
                <strong className="command-subheading">
                  ACTIVE ROUTING &amp; FAILOVER CHAIN
                </strong>
                {(state.fallbackChain && state.fallbackChain.length > 0
                  ? state.fallbackChain
                  : [
                      state.activeModel ||
                        state.providers.find((p) => p.is_primary)?.provider ||
                        state.providers[0]?.provider ||
                        "gemini-3.5-flash",
                      ...state.providers.slice(1, 4).map((p) => p.provider),
                    ]
                )
                  .slice(0, 4)
                  .map((chainModel, idx) => (
                    <div
                      className="command-provider-mini"
                      key={`${chainModel}-${idx}`}
                    >
                      <i
                        className={`command-provider-dot ${idx === 0 ? "is-good" : "is-warn"}`}
                      />
                      <span className="command-ellipsis">{chainModel}</span>
                      <b className={idx === 0 ? "is-good" : "is-muted"}>
                        {idx === 0 ? "PRIMARY" : `FALLBACK #${idx}`}
                      </b>
                    </div>
                  ))}
              </Panel>
            )}

            {/* TAB 3: AUDIT & MEMORY */}
            {showAuditPanels && vis.activity && (
              <Panel
                title="Live audit telemetry"
                className="command-audit"
                minimized={min.activity}
                action={
                  <span
                    className={`command-live ${connection === "CONNECTED" ? "" : "is-warn"}`}
                  >
                    <Activity size={11} />{" "}
                    {connection === "CONNECTED" ? "LIVE" : connection}
                  </span>
                }
              >
                <div className="command-transport">
                  <span
                    className={
                      connection === "CONNECTED" ? "is-good" : "is-warn"
                    }
                  >
                    ●
                  </span>{" "}
                  {transport} stream
                </div>
                <div className="command-table-head command-audit-row">
                  <span>TIME</span>
                  <span>EVENT</span>
                  <span>SOURCE</span>
                  <span>DETAILS</span>
                </div>
                <div className="command-scroll">
                  {state.activity.slice(0, 8).map((event) => (
                    <button
                      key={event.id}
                      className="command-audit-row command-list-row"
                      onClick={() => onOpenDrawer?.("activity", event.id)}
                    >
                      <time>{shortTime(event.timestamp)}</time>
                      <span className="command-ellipsis">
                        {(event.event_type || "EVENT").replaceAll("_", " ")}
                      </span>
                      <b>
                        {event.agent_name || event.project_name || "SYSTEM"}
                      </b>
                      <span className="command-ellipsis">
                        {event.summary || event.title}
                      </span>
                    </button>
                  ))}
                  {!state.activity.length && (
                    <EmptyLine label="No live activity events available" />
                  )}
                </div>
              </Panel>
            )}

            {showAuditPanels && (
              <div className="command-right-final">
                <Panel
                  title="Decision & audit trace"
                  className="command-decisions"
                  action={
                    <button
                      className="command-link"
                      onClick={() => onOpenDrawer?.("decisions")}
                    >
                      ALL <ChevronRight size={12} />
                    </button>
                  }
                >
                  {state.decisions.length > 0
                    ? state.decisions.slice(0, 4).map((decision) => (
                        <button
                          className="command-decision-row"
                          key={decision.id}
                          onClick={() =>
                            onOpenDrawer?.("decisions", decision.id)
                          }
                        >
                          <time>{shortTime(decision.created_at)}</time>
                          <b>{decision.status}</b>
                          <span>{decision.decision || decision.problem}</span>
                        </button>
                      ))
                    : state.audits.slice(0, 4).map((audit) => (
                        <button
                          className="command-decision-row"
                          key={audit.id}
                          onClick={() => onOpenDrawer?.("decisions", audit.id)}
                        >
                          <time>{shortTime(audit.created_at)}</time>
                          <b>{(audit.result || audit.action).slice(0, 12)}</b>
                          <span>
                            {audit.reason || audit.target || audit.action}
                          </span>
                        </button>
                      ))}
                  {!state.decisions.length && !state.audits.length && (
                    <EmptyLine label="No decisions recorded" />
                  )}
                </Panel>
                <Panel
                  title="Company memory & intelligence"
                  className="command-memory"
                  action={
                    <button
                      className="command-link"
                      onClick={() => onOpenDrawer?.("memory")}
                    >
                      SEARCH <ChevronRight size={12} />
                    </button>
                  }
                >
                  {state.memories.slice(0, 4).map((memory) => (
                    <button
                      className="command-memory-row"
                      key={memory.id}
                      onClick={() => onOpenDrawer?.("memory", memory.id)}
                    >
                      <span className="command-memory-icon">M</span>
                      <span className="command-ellipsis">{memory.title}</span>
                      <time>{shortTime(memory.created_at)}</time>
                    </button>
                  ))}
                  {!state.memories.length && (
                    <EmptyLine label="No company memories available" />
                  )}
                </Panel>
              </div>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  percent,
}: {
  label: string;
  value: string;
  percent?: number | null;
}) {
  return (
    <div className="command-metric">
      <span>{label}</span>
      {percent != null && (
        <i>
          <b style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
        </i>
      )}
      <strong>{value}</strong>
    </div>
  );
}

function EmptyLine({ label }: { label: string }) {
  return <p className="command-empty">{label}</p>;
}
