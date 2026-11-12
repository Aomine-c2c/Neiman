'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback, FormEvent } from 'react';
import dynamic from 'next/dynamic';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Users,
  Check,
  CheckCircle2,
  Loader2,
  Terminal,
  ArrowLeft,
  Maximize2,
  X,
} from 'lucide-react';
import { BashTerminal } from '@/components/terminal/BashTerminal';
import { useOrganizationContext } from '@/lib/organizationContext';
import { useAuthStore } from '@/store/auth';
import {
  councilsApi,
  type AgentCouncil,
  type CouncilDeliberation,
  type ReviewItem,
  type DisagreementRecord,
  type QuorumVotingModel,
  type QuorumResult,
} from '@/lib/api/councils';
import { ctoApi, type CTODirectiveResponse } from '@/lib/api/cto';
import { projectsApi, type TaskStatus } from '@/lib/api/projects';
import { vcsApi } from '@/lib/api/vcs';
import { mcpApi } from '@/lib/api/mcp';
import { memoryApi } from '@/lib/api/memory';
import { sourceGraphApi } from '@/lib/api/sourceGraph';
import { runtimeApi, type RuntimeExecuteResult } from '@/lib/api/runtime';
import { activityApi, type ActivityEvent } from '@/lib/api/activity';
import { CouncilHeaderBar } from '@/components/councils/CouncilHeaderBar';
import { CouncilTurnList, type DiscussionThreadItem } from '@/components/councils/CouncilTurnList';
import { CouncilComposer } from '@/components/councils/CouncilComposer';
import { ArchitectureSpecPanel } from '@/components/councils/ArchitectureSpecPanel';
import { CodeDiffViewerPanel } from '@/components/councils/CodeDiffViewerPanel';
import { TasksChecklistPanel } from '@/components/councils/TasksChecklistPanel';
import { GitWorkingTreePanel } from '@/components/councils/GitWorkingTreePanel';
import {
  DOCKED_DOMAIN_REGISTRY,
  type ChatTurn,
  type ContextAttachment,
  type DockedViewId,
} from '@/components/councils/types';

function DockedLoadingState({ label }: { label: string }) {
  return (
    <div className="flex h-64 w-full flex-col items-center justify-center gap-2 font-mono text-xs text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
      <span className="text-xs">Loading {label}…</span>
    </div>
  );
}

const TasksPage = dynamic(() => import('@/app/dashboard/tasks/page'), {
  loading: () => <DockedLoadingState label="Tasks Execution Matrix" />,
  ssr: false,
});
const OverviewPulsePage = dynamic(() => import('@/components/control-room/ControlRoomOverviewDrawer'), {
  loading: () => <DockedLoadingState label="Live System Pulse & Swarm Activity" />,
  ssr: false,
});
const MemoryPage = dynamic(() => import('@/app/dashboard/memory/page'), {
  loading: () => <DockedLoadingState label="Organizational Memory" />,
  ssr: false,
});
const McpPage = dynamic(() => import('@/app/dashboard/mcp/page'), {
  loading: () => <DockedLoadingState label="Skills, MCP & Plugins Hub" />,
  ssr: false,
});
const WorkflowsPage = dynamic(() => import('@/app/dashboard/workflows/page'), {
  loading: () => <DockedLoadingState label="Autonomous Workflows" />,
  ssr: false,
});
const SettingsPage = dynamic(() => import('@/app/dashboard/settings/page'), {
  loading: () => <DockedLoadingState label="Administration & Settings" />,
  ssr: false,
});
const GitPage = dynamic(() => import('@/app/dashboard/git/page'), {
  loading: () => <DockedLoadingState label="Git & Code Control" />,
  ssr: false,
});
const ApprovalsPage = dynamic(() => import('@/app/dashboard/approvals/page'), {
  loading: () => <DockedLoadingState label="Governance Approvals Gate" />,
  ssr: false,
});

function useSafeRouter() {
  try {
    return useRouter();
  } catch {
    return {
      push: () => {},
      replace: () => {},
      prefetch: () => {},
      back: () => {},
      forward: () => {},
      refresh: () => {},
    };
  }
}

function useSafeSearchParams(): URLSearchParams {
  try {
    const sp = useSearchParams();
    return sp || new URLSearchParams();
  } catch {
    return new URLSearchParams();
  }
}

export default function CouncilsDashboardPage() {
  const qc = useQueryClient();
  const router = useSafeRouter();
  const searchParams = useSafeSearchParams();
  const activeCompany = useOrganizationContext();
  const currentUser = useAuthStore((state) => state.user);
  const canMutate = currentUser ? currentUser.is_active !== false : true;
  const companyId = activeCompany?.id || '';

  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [activeDockedView, setActiveDockedView] = useState<DockedViewId>('DEFAULT');
  const [completedTaskMap, setCompletedTaskMap] = useState<Record<string, boolean>>({});
  const [specDrawerOpen, setSpecDrawerOpen] = useState(false);
  const [promotedTurnId, setPromotedTurnId] = useState<string | null>(null);
  const [tasksExpanded, setTasksExpanded] = useState(true);
  const [gitExpanded, setGitExpanded] = useState(true);

  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalMaximized, setTerminalMaximized] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState<number>(240);
  const [lastTerminalStatus, setLastTerminalStatus] = useState<{
    exitCode: number;
    command: string;
    errorSnippet?: string;
  }>({ exitCode: 0, command: '' });

  const [contextAttachments, setContextAttachments] = useState<ContextAttachment[]>([]);
  const [viewerFile, setViewerFile] = useState<string | null>(null);
  const [viewerMode, setViewerMode] = useState<'code' | 'diff'>('code');
  const [viewerStaged, setViewerStaged] = useState<boolean>(false);
  const [viewerCommitSha, setViewerCommitSha] = useState<string | null>(null);
  const [lineSelectionStart, setLineSelectionStart] = useState<number>(1);
  const [lineSelectionEnd, setLineSelectionEnd] = useState<number>(25);
  const [isEditingSpec, setIsEditingSpec] = useState<boolean>(false);
  const [editedSpecText, setEditedSpecText] = useState<string | null>(null);
  const [previousSpecText, setPreviousSpecText] = useState<string | null>(null);
  const [showSpecDiff, setShowSpecDiff] = useState<boolean>(false);
  const [resolvedDissentTopics, setResolvedDissentTopics] = useState<string[]>([]);
  const [promotedSpecText, setPromotedSpecText] = useState<string | null>(null);

  const [customChecklistTasks, setCustomChecklistTasks] = useState<
    Array<{ title: string; role: string; priority: 'HIGH' | 'MED' }>
  >([]);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [liveTelemetryEvents, setLiveTelemetryEvents] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    if (!companyId || typeof EventSource === 'undefined') return;
    const es = new EventSource(activityApi.getStreamUrl(companyId));
    es.onmessage = (msg) => {
      try {
        const parsed = JSON.parse(msg.data) as ActivityEvent;
        if (!parsed?.id) return;
        setLiveTelemetryEvents((prev) => {
          if (prev.some((item) => item.id === parsed.id)) return prev;
          return [parsed, ...prev].slice(0, 20);
        });
        const kind = parsed.payload?.kind;
        if (kind === 'WORKTREE_MERGED' || kind === 'WORKTREE_BLOCKED') {
          qc.invalidateQueries({ queryKey: ['tasks', companyId] });
          qc.invalidateQueries({ queryKey: ['vcs-status', companyId] });
        }
      } catch {
        // Ignore malformed SSE heartbeats
      }
    };
    return () => {
      es.close();
    };
  }, [companyId, qc]);

  const [selectedCouncil, setSelectedCouncil] = useState<AgentCouncil | null>(null);
  const [selectedDelib, setSelectedDelib] = useState<CouncilDeliberation | null>(null);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(searchParams.get('thread') || null);

  const [votingModel, setVotingModel] = useState<QuorumVotingModel>('WEIGHTED');
  const [quorumResult, setQuorumResult] = useState<QuorumResult | null>(null);
  const [copiedAdr, setCopiedAdr] = useState(false);
  const [pinnedNotice, setPinnedNotice] = useState<string | null>(null);

  const [composerText, setComposerText] = useState('');
  const [isEnhancingPrompt, setIsEnhancingPrompt] = useState(false);
  const [localTurns, setLocalTurns] = useState<ChatTurn[]>([]);
  const [latestDirectivePlan, setLatestDirectivePlan] = useState<CTODirectiveResponse | null>(null);
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [showSkillsPopover, setShowSkillsPopover] = useState(false);
  const [codeExecutionOutputs, setCodeExecutionOutputs] = useState<Record<string, RuntimeExecuteResult>>({});
  const [executingCodeId, setExecutingCodeId] = useState<string | null>(null);
  const [activeDispatchingPrompt, setActiveDispatchingPrompt] = useState<string | null>(null);

  const [inlineGitMessage, setInlineGitMessage] = useState('feat: autonomous architectural iteration');
  const [rightPanelCommitMsg, setRightPanelCommitMsg] = useState('');
  const [isDebatePending, setIsDebatePending] = useState(false);

  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      if (window.matchMedia('(max-width: 1279px)').matches) {
        setRightPanelOpen(false);
      }
    }
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [composerText]);

  const showToast = useCallback((msg: string, duration = 2500) => {
    setPinnedNotice(msg);
    setTimeout(() => setPinnedNotice(null), duration);
  }, []);

  const handleCopyMessage = useCallback(
    (text: string) => {
      navigator.clipboard?.writeText(text);
      showToast('Copied message to clipboard', 2000);
    },
    [showToast]
  );

  const openDrawer = useCallback(
    (drawerId: string, entityId?: string) => {
      const raw = drawerId.toUpperCase();
      if (['TASKS', 'PULSE', 'OVERVIEW', 'MEMORY', 'MCP', 'WORKFLOWS', 'SETTINGS', 'APPROVALS', 'GIT'].includes(raw)) {
        setActiveDockedView(raw === 'OVERVIEW' ? 'PULSE' : (raw as DockedViewId));
        setRightPanelOpen(true);
        return;
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('neiman:open-drawer', { detail: { drawerId, entityId } }));
      }
      const params = new URLSearchParams(searchParams.toString());
      params.set('drawer', drawerId);
      if (entityId) params.set('entityId', entityId);
      else params.delete('entityId');
      router.push(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  useEffect(() => {
    const threadParam = searchParams.get('thread');
    if (threadParam && threadParam !== activeThreadId) {
      setActiveThreadId(threadParam);
    }
  }, [searchParams, activeThreadId]);

  useEffect(() => {
    const handleSelectThreadEvent = (e: Event) => {
      const detail = (e as CustomEvent<{ threadId: string }>).detail;
      if (detail?.threadId) setActiveThreadId(detail.threadId);
    };
    const handleToggleRightPanel = () => setRightPanelOpen((prev) => !prev);
    const handleOpenRightPanel = (e: Event) => {
      const detail = (e as CustomEvent<{ tab?: string }>).detail;
      const raw = (detail?.tab || '').toUpperCase();
      if (['TASKS', 'PULSE', 'OVERVIEW', 'MEMORY', 'MCP', 'WORKFLOWS', 'SETTINGS', 'APPROVALS', 'GIT'].includes(raw)) {
        setActiveDockedView(raw === 'OVERVIEW' ? 'PULSE' : (raw as DockedViewId));
      } else if (raw === 'SPEC' || raw === 'ADR') {
        setActiveDockedView('DEFAULT');
      }
      setRightPanelOpen(true);
    };
    const handleDockView = (e: Event) => {
      const detail = (e as CustomEvent<{ view?: string; drawerId?: string }>).detail;
      const raw = (detail?.view || detail?.drawerId || '').toUpperCase();
      if (raw === 'DEFAULT') {
        setActiveDockedView('DEFAULT');
        setRightPanelOpen(true);
      } else if (['TASKS', 'PULSE', 'OVERVIEW', 'MEMORY', 'MCP', 'WORKFLOWS', 'SETTINGS', 'APPROVALS', 'GIT'].includes(raw)) {
        setActiveDockedView(raw === 'OVERVIEW' ? 'PULSE' : (raw as DockedViewId));
        setRightPanelOpen(true);
      }
    };
    const handleNewChat = () => {
      setActiveThreadId(null);
      setSelectedDelib(null);
      setLocalTurns([]);
      setLatestDirectivePlan(null);
    };
    const handleMentionAgent = (e: Event) => {
      const detail = (e as CustomEvent<{ agent: { name: string; roleTitle: string } }>).detail;
      if (detail?.agent) {
        const tag = `@${detail.agent.roleTitle || detail.agent.name}`;
        setContextAttachments((prev) =>
          prev.some((a) => a.label === tag) ? prev : [...prev, { id: `agent-${Date.now()}`, label: tag }]
        );
        setComposerText((prev) => `${prev ? `${prev} ` : ''}${tag} `);
      }
    };
    const handleInsertChatContext = (e: Event) => {
      const detail = (e as CustomEvent<{ filePath?: string; snippet?: string; promptText?: string }>).detail;
      if (detail?.filePath) {
        setContextAttachments((prev) => [
          ...prev.filter((a) => a.label !== detail.filePath),
          { id: `ctx-${Date.now()}`, label: detail.filePath!, snippet: detail.snippet },
        ]);
        if (detail.promptText) setComposerText(detail.promptText);
      }
    };
    const handleOpenCodeViewer = (e: Event) => {
      const detail = (
        e as CustomEvent<{ filePath?: string; mode?: 'code' | 'diff'; staged?: boolean; commitSha?: string }>
      ).detail;
      if (detail?.filePath || detail?.commitSha) {
        setViewerFile(detail.filePath || null);
        setViewerMode(detail.mode || 'code');
        setViewerStaged(Boolean(detail.staged));
        setViewerCommitSha(detail.commitSha || null);
        setActiveDockedView('DEFAULT');
        setRightPanelOpen(true);
      }
    };
    const handleToggleTerminal = (e: Event) => {
      const detail = (e as CustomEvent<{ open?: boolean }>).detail;
      if (typeof detail?.open === 'boolean') setTerminalOpen(detail.open);
      else setTerminalOpen((prev) => !prev);
    };
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault();
        setTerminalOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setSpecDrawerOpen(false);
      }
    };

    window.addEventListener('neiman:select-thread', handleSelectThreadEvent);
    window.addEventListener('neiman:toggle-right-panel', handleToggleRightPanel);
    window.addEventListener('neiman:open-right-panel', handleOpenRightPanel);
    window.addEventListener('neiman:dock-view', handleDockView);
    window.addEventListener('neiman:new-chat-thread', handleNewChat);
    window.addEventListener('neiman:mention-agent', handleMentionAgent);
    window.addEventListener('neiman:insert-chat-context', handleInsertChatContext);
    window.addEventListener('neiman:open-code-viewer', handleOpenCodeViewer);
    window.addEventListener('neiman:toggle-terminal', handleToggleTerminal);
    window.addEventListener('keydown', handleGlobalKeyDown);

    return () => {
      window.removeEventListener('neiman:select-thread', handleSelectThreadEvent);
      window.removeEventListener('neiman:toggle-right-panel', handleToggleRightPanel);
      window.removeEventListener('neiman:open-right-panel', handleOpenRightPanel);
      window.removeEventListener('neiman:dock-view', handleDockView);
      window.removeEventListener('neiman:new-chat-thread', handleNewChat);
      window.removeEventListener('neiman:mention-agent', handleMentionAgent);
      window.removeEventListener('neiman:insert-chat-context', handleInsertChatContext);
      window.removeEventListener('neiman:open-code-viewer', handleOpenCodeViewer);
      window.removeEventListener('neiman:toggle-terminal', handleToggleTerminal);
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, []);

  const {
    data: councils = [],
    isLoading: councilsLoading,
    isError: councilsError,
    refetch: refetchCouncils,
  } = useQuery({
    queryKey: ['councils', companyId],
    queryFn: () => councilsApi.list(companyId),
    enabled: !!companyId,
  });

  const {
    data: deliberations = [],
    isError: deliberationsError,
    refetch: refetchDeliberations,
  } = useQuery({
    queryKey: ['council-deliberations', companyId, selectedCouncil?.id],
    queryFn: () => councilsApi.listDeliberations(companyId, selectedCouncil!.id),
    enabled: !!companyId && !!selectedCouncil?.id,
  });

  const { data: ctoProposals = [] } = useQuery({
    queryKey: ['cto-proposals', companyId],
    queryFn: () => ctoApi.getProposals(companyId),
    enabled: !!companyId,
  });

  const {
    data: gitStatus,
    isError: gitStatusError,
    refetch: refetchGitStatus,
  } = useQuery({
    queryKey: ['vcs-status-chat', companyId],
    queryFn: () => vcsApi.getStatus(companyId),
    enabled: !!companyId,
    staleTime: 10000,
  });

  const { data: gitCommitLog } = useQuery({
    queryKey: ['vcs-commit-log-chat', companyId],
    queryFn: async () => {
      try {
        return await vcsApi.getCommitLog(companyId, 5);
      } catch {
        return null;
      }
    },
    enabled: !!companyId,
    staleTime: 15000,
  });

  const { data: companyProjects = [] } = useQuery({
    queryKey: ['company-projects-chat', companyId],
    queryFn: async () => {
      try {
        return await projectsApi.list(companyId);
      } catch {
        return [];
      }
    },
    enabled: !!companyId,
    staleTime: 30000,
  });

  const primaryProjectId = companyProjects[0]?.id;

  const { data: companyTasks = [] } = useQuery({
    queryKey: ['company-tasks-chat', companyId, primaryProjectId],
    queryFn: async () => {
      if (!primaryProjectId) return [];
      try {
        return await projectsApi.listTasks(companyId, primaryProjectId);
      } catch {
        return [];
      }
    },
    enabled: !!companyId && !!primaryProjectId,
    staleTime: 15000,
  });

  const { data: mcpServers = [], isLoading: mcpLoading } = useQuery({
    queryKey: ['mcp-servers-chat', companyId],
    queryFn: async () => {
      try {
        return await mcpApi.listServers(companyId);
      } catch {
        return [];
      }
    },
    enabled: !!companyId && showSkillsPopover,
  });

  const { data: activeSkills = [], isLoading: skillsLoading } = useQuery({
    queryKey: ['mcp-skills-chat', companyId],
    queryFn: async () => {
      try {
        return await mcpApi.listSkills(companyId);
      } catch {
        return [];
      }
    },
    enabled: !!companyId && showSkillsPopover,
  });

  const { data: viewerFileData, isLoading: viewerFileLoading } = useQuery({
    queryKey: ['panel6-source-file', companyId, viewerFile],
    queryFn: async () => {
      if (!viewerFile) return null;
      try {
        return await sourceGraphApi.getSourceFile(companyId, viewerFile, 1, 250);
      } catch {
        return null;
      }
    },
    enabled: !!companyId && !!viewerFile && viewerMode === 'code',
  });

  const { data: viewerDiffData, isLoading: viewerDiffLoading } = useQuery({
    queryKey: ['panel6-diff-view', companyId, viewerFile, viewerStaged, viewerCommitSha],
    queryFn: async () => {
      try {
        return await vcsApi.getDiff(companyId, viewerFile || undefined, viewerStaged, viewerCommitSha || undefined);
      } catch {
        return null;
      }
    },
    enabled: !!companyId && Boolean(viewerFile || viewerCommitSha) && (viewerMode === 'diff' || Boolean(viewerCommitSha)),
  });

  useEffect(() => {
    if (councils.length > 0 && !selectedCouncil) setSelectedCouncil(councils[0]);
  }, [councils, selectedCouncil]);

  useEffect(() => {
    if (activeThreadId) {
      const matchedDelib = deliberations.find((d) => d.id === activeThreadId);
      if (matchedDelib) setSelectedDelib(matchedDelib);
    }
  }, [deliberations, activeThreadId]);

  const reviews: ReviewItem[] = selectedDelib?.independent_reviews || [];
  const disagreements: DisagreementRecord[] = selectedDelib?.disagreements_recorded || [];
  const topProposal = ctoProposals[0];

  const baseSynthesizedSpec =
    promotedSpecText ||
    selectedDelib?.synthesis_proposal?.synthesized_decision ||
    (latestDirectivePlan && latestDirectivePlan.intent !== 'CONVERSATION'
      ? latestDirectivePlan.analysis || latestDirectivePlan.summary
      : null) ||
    (topProposal
      ? `${topProposal.title}\n\n${topProposal.rationale}\n\nImpact Assessment:\n${topProposal.impact_assessment}`
      : null) ||
    'No architectural specification synthesized yet. Start a deliberation or send a technical directive to the CTO.';

  const hasSynthesizedSpec = Boolean(
    promotedSpecText ||
      editedSpecText !== null ||
      selectedDelib?.synthesis_proposal?.synthesized_decision ||
      (latestDirectivePlan &&
        latestDirectivePlan.intent !== 'CONVERSATION' &&
        (latestDirectivePlan.analysis || latestDirectivePlan.summary)) ||
      topProposal
  );

  const resolvedMitigationsSuffix =
    resolvedDissentTopics.length > 0
      ? `\n\nAccepted Trade-off Mitigations:\n${disagreements
          .filter((d) => resolvedDissentTopics.includes(d.topic))
          .map((d) => `- [${d.topic}]: ${d.mitigation}`)
          .join('\n')}`
      : '';

  const liveSpecText = editedSpecText !== null ? editedSpecText : `${baseSynthesizedSpec}${resolvedMitigationsSuffix}`;

  const adrStatus = hasSynthesizedSpec
    ? selectedDelib?.status ||
      (latestDirectivePlan &&
      latestDirectivePlan.intent !== 'CONVERSATION' &&
      (latestDirectivePlan.tasks_created_count > 0 || (latestDirectivePlan.tasks && latestDirectivePlan.tasks.length > 0))
        ? 'DIRECTIVE_DISPATCHED'
        : topProposal
        ? 'PROPOSAL_ACTIVE'
        : 'DRAFT')
    : selectedDelib
    ? 'SYNTHESIS_PENDING'
    : 'DRAFT';

  const adrDecision =
    selectedDelib?.synthesis_proposal?.synthesized_decision ||
    promotedSpecText ||
    editedSpecText ||
    (latestDirectivePlan && latestDirectivePlan.intent !== 'CONVERSATION'
      ? latestDirectivePlan.analysis || latestDirectivePlan.summary
      : null) ||
    (topProposal ? `${topProposal.title}: ${topProposal.rationale}` : '');

  const delibMitigations = selectedDelib?.synthesis_proposal?.recommended_mitigations;
  const directiveTaskTitles = useMemo(
    () => latestDirectivePlan?.tasks?.map((t) => t.title) || [],
    [latestDirectivePlan]
  );
  const proposalTaskTitles = useMemo(
    () => (topProposal?.proposed_tasks || []).map((t) => t.title),
    [topProposal]
  );
  const companyTaskTitles = useMemo(() => companyTasks.slice(0, 6).map((t) => t.title), [companyTasks]);

  const actionItems: string[] = useMemo(() => {
    const base =
      delibMitigations && delibMitigations.length > 0
        ? delibMitigations
        : directiveTaskTitles.length > 0
        ? directiveTaskTitles
        : proposalTaskTitles.length > 0
        ? proposalTaskTitles
        : companyTaskTitles;
    const customTitles = customChecklistTasks.map((c) => c.title);
    return Array.from(new Set([...customTitles, ...base]));
  }, [delibMitigations, directiveTaskTitles, proposalTaskTitles, companyTaskTitles, customChecklistTasks]);

  const completedCount = useMemo(() => {
    return actionItems.filter((item) => completedTaskMap[item] === true).length;
  }, [actionItems, completedTaskMap]);

  const createCouncilMutation = useMutation({
    mutationFn: () =>
      councilsApi.create(companyId, {
        name: 'Architecture & Technical Governance Council',
        charter: 'Evaluates cross-cutting system design, multi-model intelligence routing, and reliability tradeoffs.',
        council_type: 'PERMANENT',
      }),
    onSuccess: (council) => {
      qc.invalidateQueries({ queryKey: ['councils', companyId] });
      setSelectedCouncil(council);
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (title: string) => {
      let targetProjectId = primaryProjectId;
      if (!targetProjectId) {
        const createdProject = await projectsApi.create(companyId, {
          name: 'Primary Engineering Workspace',
          description: 'Default workspace project for CTO & Council tasks',
        });
        targetProjectId = createdProject.id;
        qc.invalidateQueries({ queryKey: ['company-projects-chat', companyId] });
      }
      return projectsApi.createTask(companyId, targetProjectId, {
        title,
        status: 'TODO',
        priority: 'HIGH',
      });
    },
    onMutate: () => setTaskError(null),
    onSuccess: (_task, title) => {
      setCustomChecklistTasks((prev) =>
        prev.some((c) => c.title === title) ? prev : [{ title, role: 'Backend', priority: 'HIGH' }, ...prev]
      );
      qc.invalidateQueries({ queryKey: ['company-tasks-chat', companyId] });
      qc.invalidateQueries({ queryKey: ['tasks', companyId] });
    },
    onError: (err: unknown) => {
      setTaskError((err as Error)?.message || 'Failed to create task in workspace');
    },
  });

  const directiveMutation = useMutation({
    mutationFn: (prompt: string) => ctoApi.sendDirective(companyId, { directive: prompt, priority: 'HIGH' }),
    onSuccess: (res, prompt) => {
      const isConversation = res.intent === 'CONVERSATION';
      const replyBody =
        res.analysis ||
        res.summary ||
        (isConversation
          ? 'CTO acknowledged. How can I assist with your architecture or technical directives?'
          : 'Directive accepted — execution tasks decomposed.');
      const codeMatch = replyBody.match(/```([a-z]*)\n([\s\S]*?)```/);
      const isWorkflowPrompt = prompt.startsWith('/workflow') || prompt.startsWith('/pipeline');
      const isGitPrompt = prompt.startsWith('/git') || prompt.startsWith('/commit');

      setLocalTurns((prev) => [
        ...prev,
        { id: `op-${Date.now()}`, sender: 'Operator', role: 'Human Lead', body: prompt },
        {
          id: res.directive_id || `cto-${Date.now()}`,
          sender: res.cto_agent_name || 'Chief Technology Agent',
          role: 'CTO',
          body: replyBody,
          stance: isConversation ? 'CONVERSATION' : 'SYNTHESIZED',
          tasks: res.tasks || [],
          codeSnippet: codeMatch ? { language: codeMatch[1] || 'bash', code: codeMatch[2] } : undefined,
          isWorkflowLink: isWorkflowPrompt,
          isGitCard: isGitPrompt,
        },
      ]);
      setLatestDirectivePlan(res);
      setComposerText('');
      qc.invalidateQueries({ queryKey: ['tasks', companyId] });
      qc.invalidateQueries({ queryKey: ['control-room-state', companyId] });
      qc.invalidateQueries({ queryKey: ['cto-threads', companyId] });
    },
    onError: (err: unknown) => {
      const errorMsg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (err as Error)?.message ||
        'Failed to dispatch directive to CTO agent. Verify backend connectivity and try again.';
      setLocalTurns((prev) => [
        ...prev,
        { id: `err-${Date.now()}`, sender: 'System Sentinel', role: 'Error', body: errorMsg },
      ]);
    },
  });

  const toggleTaskMutation = useMutation({
    mutationFn: ({ taskId, currentStatus }: { taskId: string; currentStatus: string }) => {
      const taskProjectId = companyTasks.find((t) => t.id === taskId)?.project_id || primaryProjectId;
      if (!taskProjectId) {
        return Promise.reject(new Error('No project available for task status update'));
      }
      return projectsApi.toggleTaskStatus(companyId, taskProjectId, taskId, currentStatus as TaskStatus);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', companyId] });
      qc.invalidateQueries({ queryKey: ['company-tasks-chat', companyId] });
      qc.invalidateQueries({ queryKey: ['control-room-state', companyId] });
    },
  });

  const tickMutation = useMutation({
    mutationFn: () => ctoApi.triggerTick(companyId),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['tasks', companyId] });
      qc.invalidateQueries({ queryKey: ['cto-supervisor-status', companyId] });
      showToast(`Cycle #${res.cycle} executed: ${res.status}`, 3000);
    },
  });

  const commitMutation = useMutation({
    mutationFn: (message: string) =>
      vcsApi.createCommit(companyId, { message, author_name: 'NEIMAN Autonomous Agent' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vcs-status-chat', companyId] });
      qc.invalidateQueries({ queryKey: ['vcs-commit-log-chat', companyId] });
      qc.invalidateQueries({ queryKey: ['vcs-status', companyId] });
      showToast('Changes committed to repository.', 3000);
    },
  });

  const stageFileMutation = useMutation({
    mutationFn: (path: string) => vcsApi.stageFiles(companyId, { paths: [path] }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vcs-status-chat', companyId] });
      qc.invalidateQueries({ queryKey: ['vcs-status', companyId] });
      showToast('Staged file in Git working tree', 2000);
    },
  });

  const unstageFileMutation = useMutation({
    mutationFn: (path: string) => vcsApi.unstageFiles(companyId, { paths: [path] }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vcs-status-chat', companyId] });
      qc.invalidateQueries({ queryKey: ['vcs-status', companyId] });
      showToast('Unstaged file from Git index', 2000);
    },
  });

  const ratifyMutation = useMutation({
    mutationFn: (delibId: string) =>
      councilsApi.ratifyDecision(companyId, delibId, {
        decision: adrDecision || 'Ratified architectural consensus.',
        rationale: 'Ratified by explicit operator approval and committed to organizational memory.',
        record_in_memory: true,
      }),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['council-deliberations', companyId, selectedCouncil?.id] });
      qc.invalidateQueries({ queryKey: ['memory-items', companyId] });
      setSelectedDelib(updated);
      showToast('ADR ratified and committed to organizational memory.', 3500);
    },
  });

  const quorumMutation = useMutation({
    mutationFn: (overrideVote?: 'APPROVE' | 'REJECT' | 'VETO' | null) =>
      councilsApi.evaluateQuorum(companyId, selectedCouncil!.id, selectedDelib!.id, {
        voting_model: votingModel,
        override_vote: overrideVote,
      }),
    onSuccess: (result) => {
      setQuorumResult(result);
      qc.invalidateQueries({ queryKey: ['council-deliberations', companyId, selectedCouncil?.id] });
    },
  });

  const handlePinToMemory = useCallback(
    async (title: string, content: string) => {
      if (!canMutate) return;
      try {
        await (memoryApi.createItem || memoryApi.createMemory)(companyId, {
          domain: 'DECISION',
          scope: 'INTERNAL',
          title: `Architectural Insight: ${title.slice(0, 60)}`,
          content,
          provenance_type: 'COUNCIL_RESOLUTION',
          source: 'CTO & Councils Command Chat',
        });
        showToast('Pinned to Organizational Memory successfully.', 3000);
        qc.invalidateQueries({ queryKey: ['memory-items-tab', companyId] });
      } catch {
        showToast('Failed to pin to memory.', 3000);
      }
    },
    [canMutate, companyId, qc, showToast]
  );

  const handleExecuteSandbox = useCallback(
    async (codeId: string, language: string, code: string) => {
      if (!canMutate) return;
      setExecutingCodeId(codeId);
      try {
        const res = await (runtimeApi.execute || runtimeApi.executeCode)(companyId, {
          language: (language as 'python' | 'node' | 'bash') || 'bash',
          code,
          timeout_seconds: 15,
        });
        setCodeExecutionOutputs((prev) => ({ ...prev, [codeId]: res }));
      } catch (err: unknown) {
        setCodeExecutionOutputs((prev) => ({
          ...prev,
          [codeId]: {
            execution_id: `err-${Date.now()}`,
            status: 'FAILED',
            exit_code: 1,
            stdout: '',
            stderr: (err as Error)?.message || 'Runtime execution failed',
            duration_ms: 0,
            files_created: [],
            security_checks_passed: false,
          },
        }));
      } finally {
        setExecutingCodeId(null);
      }
    },
    [canMutate, companyId]
  );

  const handleAutoDispatch = useCallback(
    async (promptText: string, autoTickSwarm = true) => {
      if (!canMutate || !promptText.trim() || !companyId || directiveMutation.isPending) return;
      setActiveDispatchingPrompt(promptText);
      try {
        await directiveMutation.mutateAsync(promptText);
        if (autoTickSwarm) {
          try {
            await ctoApi.triggerTick(companyId);
            qc.invalidateQueries({ queryKey: ['tasks', companyId] });
          } catch {
            // background supervisor cycle notice
          }
        }
      } finally {
        setActiveDispatchingPrompt(null);
      }
    },
    [canMutate, companyId, directiveMutation, qc]
  );

  const handleDebateProposal = useCallback(
    async (proposalTitle: string, proposalRationale?: string) => {
      if (!canMutate) return;
      setIsDebatePending(true);
      try {
        let targetCouncil = selectedCouncil || councils[0];
        if (!targetCouncil) {
          targetCouncil = await createCouncilMutation.mutateAsync();
        }
        if (!targetCouncil) return;
        const delib = await councilsApi.startDeliberation(companyId, targetCouncil.id, {
          title: `Council Deliberation: ${proposalTitle}`,
          problem_statement:
            proposalRationale ||
            `Evaluate architectural, security, and reliability tradeoffs for: ${proposalTitle}`,
          auto_execute_deliberation: true,
        });
        qc.invalidateQueries({ queryKey: ['council-deliberations', companyId, targetCouncil.id] });
        setSelectedCouncil(targetCouncil);
        setSelectedDelib(delib);
        setActiveThreadId(delib.id);
      } catch {
        showToast('Failed to start Council debate deliberation');
      } finally {
        setIsDebatePending(false);
      }
    },
    [canMutate, companyId, councils, createCouncilMutation, qc, selectedCouncil, showToast]
  );

  const handleComposerSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = composerText.trim();
    if (!canMutate || !trimmed || directiveMutation.isPending) return;
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    if (trimmed === '/tick') {
      tickMutation.mutate();
      setComposerText('');
      return;
    }
    const routeMap: Record<string, DockedViewId> = {
      '/task': 'TASKS',
      '/tasks': 'TASKS',
      '/mcp': 'MCP',
      '/memory': 'MEMORY',
      '/workflow': 'WORKFLOWS',
      '/workflows': 'WORKFLOWS',
      '/git': 'GIT',
      '/pulse': 'PULSE',
      '/overview': 'PULSE',
      '/settings': 'SETTINGS',
      '/approvals': 'APPROVALS',
    };
    if (routeMap[trimmed]) {
      setActiveDockedView(routeMap[trimmed]);
      setRightPanelOpen(true);
      setComposerText('');
      return;
    }
    if (trimmed === '/term' || trimmed === '/terminal') {
      setTerminalOpen(true);
      setComposerText('');
      return;
    }

    if (trimmed === '/debate') {
      setComposerText('/debate ');
      textareaRef.current?.focus();
      return;
    }
    if (trimmed.startsWith('/debate ')) {
      const topic = trimmed.slice('/debate '.length).trim();
      if (topic) {
        const debateAttachmentPrefix =
          contextAttachments.length > 0
            ? contextAttachments
                .map((a) => `> Context [${a.label}]${a.snippet ? `\n${a.snippet}` : ''}`)
                .join('\n') + '\n\n'
            : '';
        setComposerText('');
        setContextAttachments([]);
        void handleDebateProposal(topic, `${debateAttachmentPrefix}${topic}`);
      }
      return;
    }

    const attachmentPrefix =
      contextAttachments.length > 0
        ? contextAttachments
            .map((a) => `> Context [${a.label}]${a.snippet ? `\n${a.snippet}` : ''}`)
            .join('\n') + '\n\n'
        : '';

    if (selectedDelib && companyId) {
      setComposerText('');
      councilsApi
        .sendCtoDirective(companyId, selectedDelib.id, trimmed)
        .then((updated) => {
          setSelectedDelib(updated);
          if (selectedCouncil?.id) {
            qc.invalidateQueries({ queryKey: ['councils', companyId, selectedCouncil.id, 'deliberations'] });
          }
          showToast('Solomon (CTO) routed your directive to the council');
        })
        .catch(() => {
          showToast('Failed to send directive to Solomon (CTO)');
        });
      return;
    }

    directiveMutation.mutate(`${attachmentPrefix}${trimmed}`);
    setContextAttachments([]);
  };

  const handleEnhancePrompt = async () => {
    const trimmed = composerText.trim();
    if (!canMutate || !companyId || !trimmed || isEnhancingPrompt) return;
    setIsEnhancingPrompt(true);
    try {
      const ctx = selectedDelib ? `Council: ${selectedDelib.title}` : undefined;
      const res = await ctoApi.enhancePrompt(companyId, trimmed, ctx);
      if (res.enhanced_prompt) {
        setComposerText(res.enhanced_prompt);
        showToast('Prompt enhanced for Solomon (CTO)');
      }
    } catch {
      showToast('Failed to enhance prompt — check active LLM provider');
    } finally {
      setIsEnhancingPrompt(false);
      textareaRef.current?.focus();
    }
  };

  const handleTerminalPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = terminalHeight;
    const onMove = (moveEvent: PointerEvent) => {
      const delta = startY - moveEvent.clientY;
      setTerminalHeight(Math.max(140, Math.min(560, startH + delta)));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  if (!companyId) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <Users className="h-12 w-12 text-muted-foreground mb-3 opacity-60" aria-hidden="true" />
        <h2 className="text-lg font-bold text-foreground">No Repository Connected</h2>
        <p className="text-sm text-muted-foreground">
          Select an active software workspace to consult your CTO &amp; Councils.
        </p>
      </div>
    );
  }

  const technicalRationale =
    selectedDelib?.decision_rationale ||
    (latestDirectivePlan &&
    latestDirectivePlan.intent !== 'CONVERSATION' &&
    (latestDirectivePlan.tasks_created_count > 0 || (latestDirectivePlan.tasks && latestDirectivePlan.tasks.length > 0))
      ? `Autonomous CTO decomposed directive into ${
          latestDirectivePlan.tasks_created_count || latestDirectivePlan.tasks?.length || 0
        } engineering work items.`
      : null) ||
    (topProposal ? `Proactive architectural initiative: ${topProposal.category} priority.` : null);

  const hasActiveDebateOrProposal = Boolean(
    selectedDelib ||
      promotedSpecText ||
      editedSpecText !== null ||
      (latestDirectivePlan && latestDirectivePlan.intent !== 'CONVERSATION') ||
      topProposal
  );

  const displayHeaderStatus = selectedDelib
    ? hasSynthesizedSpec
      ? selectedDelib.status
      : selectedDelib.status === 'RESOLVED'
      ? 'SYNTHESIS_PENDING'
      : selectedDelib.status
    : null;

  return (
    <div className="w-full flex-1 flex flex-col h-full min-h-0 overflow-hidden animate-fade-in">
      {pinnedNotice && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-14 right-6 z-50 rounded-lg border border-primary/40 bg-card px-3.5 py-2 text-xs font-mono text-primary shadow-lg flex items-center gap-2 animate-slide-up"
        >
          <CheckCircle2 className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
          <span>{pinnedNotice}</span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-0 xl:divide-x xl:divide-border items-stretch flex-1 min-h-0 overflow-hidden bg-background relative">
        <div
          className={`flex flex-col h-full min-h-0 gap-0 divide-y divide-border transition-all duration-200 ${
            rightPanelOpen ? 'xl:col-span-8' : 'xl:col-span-12'
          }`}
        >
          <section
            aria-label="Unified CTO and Council Conversation"
            className={`flex flex-col min-h-0 bg-card overflow-hidden transition-all ${
              terminalOpen && terminalMaximized ? 'h-36 shrink-0' : 'flex-1'
            }`}
          >
            <CouncilHeaderBar
              selectedDelib={selectedDelib}
              displayStatus={displayHeaderStatus}
              terminalOpen={terminalOpen}
              rightPanelOpen={rightPanelOpen}
              canMutate={canMutate}
              onToggleTerminal={() => setTerminalOpen((v) => !v)}
              onStartNewChat={() => {
                setActiveThreadId(null);
                setSelectedDelib(null);
                setLocalTurns([]);
                setLatestDirectivePlan(null);
              }}
              onToggleRightPanel={() => setRightPanelOpen((v) => !v)}
            />

            {selectedDelib && (
              <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-border bg-secondary/15 px-3 py-1.5 text-xs font-mono shrink-0 gap-1">
                {[
                  { label: '1. Proposing', done: reviews.length > 0 },
                  { label: '2. Critiquing', done: reviews.length >= 2 },
                  { label: '3. Synthesizing', done: hasSynthesizedSpec },
                  { label: '4. Voting', done: adrStatus === 'RESOLVED' || Boolean(quorumResult) },
                ].map((stepItem) => (
                  <div
                    key={stepItem.label}
                    className={`flex items-center justify-center gap-1 rounded py-0.5 px-1.5 border ${
                      stepItem.done
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold'
                        : 'border-border bg-background/60 text-muted-foreground'
                    }`}
                  >
                    {stepItem.done && <Check className="h-3 w-3 shrink-0" aria-hidden="true" />}
                    <span className="truncate">{stepItem.label}</span>
                  </div>
                ))}
              </div>
            )}

            <CouncilTurnList
              reviews={reviews}
              discussionThreads={(selectedDelib?.discussion_threads as unknown as DiscussionThreadItem[]) || []}
              members={selectedCouncil?.members || []}
              localTurns={localTurns}
              councilsLoading={councilsLoading}
              councilsError={councilsError}
              deliberationsError={deliberationsError}
              onRetryQueries={() => {
                refetchCouncils();
                if (selectedCouncil?.id) refetchDeliberations();
              }}
              topProposal={topProposal}
              canMutate={canMutate}
              isDirectivePending={directiveMutation.isPending}
              isStartDelibPending={isDebatePending || createCouncilMutation.isPending}
              activeDispatchingPrompt={activeDispatchingPrompt}
              executingCodeId={executingCodeId}
              codeExecutionOutputs={codeExecutionOutputs}
              gitStatus={gitStatus}
              inlineGitMessage={inlineGitMessage}
              onChangeInlineGitMessage={setInlineGitMessage}
              isTickPending={tickMutation.isPending}
              isCommitPending={commitMutation.isPending}
              adrStatus={adrStatus}
              liveSpecText={liveSpecText}
              selectedDelibTitle={selectedDelib?.title}
              hasSynthesizedProposal={Boolean(selectedDelib?.synthesis_proposal?.synthesized_decision)}
              promotedTurnId={promotedTurnId}
              onAutoDispatch={handleAutoDispatch}
              onDebateProposal={handleDebateProposal}
              onChallenge={(role, snippet) => {
                setComposerText(`@${role} Challenge regarding "${snippet}...": `);
                textareaRef.current?.focus();
              }}
              onCopy={handleCopyMessage}
              onPromoteToSpec={(body, turnId) => {
                setPreviousSpecText(liveSpecText);
                setPromotedSpecText(body);
                setPromotedTurnId(turnId);
                setEditedSpecText(null);
                setSpecDrawerOpen(true);
                showToast('Promoted response to Architecture Specification');
              }}
              onPinMemory={handlePinToMemory}
              onRunAllTasks={() => {
                tickMutation.mutate();
                setTerminalOpen(true);
              }}
              onOpenDrawer={openDrawer}
              onOpenSpecDrawer={() => setSpecDrawerOpen(true)}
              onToggleTask={(taskId, currentStatus) => toggleTaskMutation.mutate({ taskId, currentStatus })}
              onExecuteSandbox={handleExecuteSandbox}
              onCommitGit={(msg) => commitMutation.mutate(msg)}
              chatBottomRef={chatBottomRef}
            />

            {liveTelemetryEvents.length > 0 && (
              <div
                aria-label="Live Execution Telemetry"
                className="mx-3 mb-1.5 rounded-lg border border-border bg-secondary/20 px-2.5 py-1.5 flex items-center justify-between gap-2 text-[11px]"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span className="font-semibold text-foreground shrink-0">
                    {liveTelemetryEvents[0].agent_name || 'Agent'}
                  </span>
                  <span className="font-mono text-muted-foreground truncate">
                    {liveTelemetryEvents[0].title}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {typeof liveTelemetryEvents[0].payload?.commit_sha === 'string' && (
                    <button
                      type="button"
                      onClick={() => {
                        setViewerCommitSha(String(liveTelemetryEvents[0].payload?.commit_sha));
                        setViewerFile(null);
                        setViewerMode('diff');
                      }}
                      className="px-2 py-0.5 rounded bg-primary/15 text-primary hover:bg-primary/25 font-mono font-semibold transition-colors"
                    >
                      View Commit Diff
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setLiveTelemetryEvents([])}
                    className="text-muted-foreground hover:text-foreground px-1"
                    aria-label="Dismiss live telemetry"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )}

            <CouncilComposer
              composerText={composerText}
              onChangeComposerText={setComposerText}
              onSubmit={handleComposerSubmit}
              textareaRef={textareaRef}
              canMutate={canMutate}
              isSending={directiveMutation.isPending}
              showMentionMenu={showMentionMenu}
              onToggleMentionMenu={setShowMentionMenu}
              showSlashMenu={showSlashMenu}
              onToggleSlashMenu={setShowSlashMenu}
              showSkillsPopover={showSkillsPopover}
              onToggleSkillsPopover={setShowSkillsPopover}
              mcpServers={mcpServers}
              activeSkills={activeSkills}
              skillsLoading={mcpLoading || skillsLoading}
              contextAttachments={contextAttachments}
              onRemoveAttachment={(id) => setContextAttachments((prev) => prev.filter((p) => p.id !== id))}
              onAddSkillAttachment={(name, id) =>
                setContextAttachments((prev) =>
                  prev.some((a) => a.label === `Skill:${name}`)
                    ? prev
                    : [...prev, { id: `sk-${id}`, label: `Skill:${name}` }]
                )
              }
              onQuickDispatch={(cmd) => handleAutoDispatch(cmd)}
              onOpenMcpDrawer={() => openDrawer('mcp')}
              councilMode={Boolean(selectedDelib)}
              onEnhancePrompt={handleEnhancePrompt}
              isEnhancing={isEnhancingPrompt}
            />
          </section>

          {terminalOpen ? (
            <div
              aria-label="Integrated Terminal Dock"
              style={!terminalMaximized ? { height: `${terminalHeight}px` } : undefined}
              className={`flex flex-col min-h-0 bg-card overflow-hidden transition-all relative ${
                terminalMaximized ? 'flex-1 min-h-[360px]' : 'shrink-0'
              }`}
            >
              {!terminalMaximized && (
                <div
                  role="separator"
                  aria-orientation="horizontal"
                  aria-label="Resize terminal height"
                  aria-valuenow={terminalHeight}
                  aria-valuemin={140}
                  aria-valuemax={560}
                  tabIndex={0}
                  onPointerDown={handleTerminalPointerDown}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setTerminalHeight((h) => Math.min(560, h + 24));
                    } else if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setTerminalHeight((h) => Math.max(140, h - 24));
                    }
                  }}
                  title="Drag or press Arrow Up/Down to resize terminal height"
                  className="h-1.5 w-full bg-border hover:bg-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-ns-resize touch-none shrink-0 transition-colors"
                />
              )}
              <BashTerminal
                companyId={companyId}
                isMaximized={terminalMaximized}
                onToggleMaximize={() => setTerminalMaximized((v) => !v)}
                onClose={() => setTerminalOpen(false)}
                onLastExitStatusChange={setLastTerminalStatus}
                onAttachOutputToChat={(label, snippet, autoPrompt) => {
                  setContextAttachments((prev) => [
                    ...prev.filter((a) => a.label !== label),
                    { id: `term-${Date.now()}`, label, snippet: `\`\`\`bash\n${snippet}\n\`\`\`` },
                  ]);
                  if (autoPrompt) setComposerText(autoPrompt);
                }}
                className="h-full border-none rounded-none"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setTerminalOpen(true)}
              aria-label="Open Integrated Bash Terminal"
              title="Open Integrated Bash Terminal (Ctrl+`)"
              className="shrink-0 flex items-center justify-between px-3 py-2 bg-card hover:bg-secondary text-muted-foreground hover:text-foreground text-xs font-mono transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Terminal className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" aria-hidden="true" />
                <span className="font-semibold text-foreground text-xs shrink-0">Terminal Dock</span>
                {lastTerminalStatus.command && (
                  <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                    · $ {lastTerminalStatus.command}
                  </span>
                )}
                <span
                  className={`px-1.5 py-0.5 rounded text-xs font-bold tabular-nums border ${
                    lastTerminalStatus.exitCode === 0
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                      : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30'
                  }`}
                >
                  Exit {lastTerminalStatus.exitCode}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <kbd className="px-1.5 py-0.5 rounded bg-secondary text-xs font-mono text-muted-foreground border border-border">
                  Ctrl+`
                </kbd>
                <span className="text-xs text-primary font-sans font-medium">Open Terminal ↑</span>
              </div>
            </button>
          )}
        </div>

        {rightPanelOpen && (
          <>
            <div
              className="fixed inset-0 top-12 z-30 bg-background/60 backdrop-blur-xs xl:hidden"
              onClick={() => setRightPanelOpen(false)}
              aria-hidden="true"
            />
            <aside
              aria-label="Workspace Tasks, Git, and Code Viewer Pane"
              className="flex fixed inset-y-0 top-12 right-0 z-40 w-[min(100vw,28rem)] border-l border-border shadow-2xl xl:static xl:z-auto xl:w-auto xl:shadow-none xl:border-l-0 xl:col-span-4 flex-col h-[calc(100vh-3rem)] xl:h-full min-h-0 bg-card overflow-hidden divide-y divide-border"
            >
              {activeDockedView !== 'DEFAULT' ? (
                <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-card">
                  <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-3 font-mono bg-secondary/40">
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        type="button"
                        onClick={() => setActiveDockedView('DEFAULT')}
                        aria-label="Return to Tasks & Git"
                        title="Return to Tasks & Git Panels"
                        className="min-h-7 inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-mono font-semibold bg-secondary text-foreground hover:bg-secondary/80 border border-border transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Tasks &amp; Git</span>
                      </button>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 truncate">
                          {DOCKED_DOMAIN_REGISTRY[activeDockedView] && (
                            <span
                              className={`text-xs font-bold ${DOCKED_DOMAIN_REGISTRY[activeDockedView].tagColor}`}
                            >
                              [{DOCKED_DOMAIN_REGISTRY[activeDockedView].tag}]
                            </span>
                          )}
                          <h3 className="text-xs font-bold tracking-tight text-foreground truncate">
                            {DOCKED_DOMAIN_REGISTRY[activeDockedView]?.title || activeDockedView}
                          </h3>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          const key =
                            DOCKED_DOMAIN_REGISTRY[activeDockedView]?.drawerKey ||
                            activeDockedView.toLowerCase();
                          if (typeof window !== 'undefined') {
                            window.dispatchEvent(new CustomEvent('neiman:open-drawer', { detail: { drawerId: key } }));
                          }
                        }}
                        className="min-h-7 min-w-7 flex items-center justify-center p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        title="Expand to Full Slide-over Canvas"
                        aria-label="Expand view to full modal"
                      >
                        <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveDockedView('DEFAULT')}
                        className="min-h-7 min-w-7 flex items-center justify-center p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        title="Close docked view"
                        aria-label="Close docked view"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  {DOCKED_DOMAIN_REGISTRY[activeDockedView]?.subtitle && (
                    <div className="px-3 py-1.5 border-b border-border bg-secondary/15 shrink-0">
                      <p className="text-xs text-muted-foreground font-sans truncate">
                        {DOCKED_DOMAIN_REGISTRY[activeDockedView].subtitle}
                      </p>
                    </div>
                  )}

                  <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 select-text">
                    {activeDockedView === 'TASKS' && <TasksPage />}
                    {(activeDockedView === 'PULSE' || activeDockedView === 'OVERVIEW') && <OverviewPulsePage />}
                    {activeDockedView === 'MEMORY' && <MemoryPage />}
                    {activeDockedView === 'MCP' && <McpPage />}
                    {activeDockedView === 'WORKFLOWS' && <WorkflowsPage />}
                    {activeDockedView === 'SETTINGS' && <SettingsPage />}
                    {activeDockedView === 'APPROVALS' && <ApprovalsPage />}
                    {activeDockedView === 'GIT' && <GitPage />}
                  </div>
                </div>
              ) : (
                <>
                  {Boolean(viewerFile || viewerCommitSha) && (
                    <CodeDiffViewerPanel
                      viewerFile={viewerFile}
                      viewerMode={viewerMode}
                      viewerCommitSha={viewerCommitSha}
                      viewerFileData={viewerFileData}
                      viewerFileLoading={viewerFileLoading}
                      viewerDiffData={viewerDiffData}
                      viewerDiffLoading={viewerDiffLoading}
                      lineSelectionStart={lineSelectionStart}
                      lineSelectionEnd={lineSelectionEnd}
                      onChangeLineStart={setLineSelectionStart}
                      onChangeLineEnd={setLineSelectionEnd}
                      onSetViewerMode={setViewerMode}
                      onClearViewerCommitSha={() => setViewerCommitSha(null)}
                      onAttachLinesToComposer={() => {
                        const lines = (viewerFileData?.content || '')
                          .split('\n')
                          .slice(lineSelectionStart - 1, lineSelectionEnd)
                          .join('\n');
                        const label = `${viewerFile}#L${lineSelectionStart}-L${lineSelectionEnd}`;
                        setContextAttachments((prev) => [
                          ...prev.filter((a) => a.label !== label),
                          {
                            id: `lines-${Date.now()}`,
                            label,
                            snippet: lines ? `\`\`\`${viewerFileData?.language || ''}\n${lines}\n\`\`\`` : undefined,
                          },
                        ]);
                        showToast(`Attached ${label} to Composer`, 2000);
                      }}
                      onCloseViewer={() => {
                        setViewerFile(null);
                        setViewerCommitSha(null);
                      }}
                    />
                  )}

                  <TasksChecklistPanel
                    tasksExpanded={tasksExpanded}
                    onToggleTasksExpanded={() => setTasksExpanded((prev) => !prev)}
                    actionItems={actionItems}
                    completedCount={completedCount}
                    completedTaskMap={completedTaskMap}
                    customChecklistTasks={customChecklistTasks}
                    canMutate={canMutate}
                    isAddingTask={createTaskMutation.isPending}
                    taskError={taskError}
                    onOpenBoardDrawer={() => openDrawer('tasks')}
                    onAddTask={(title) => createTaskMutation.mutate(title)}
                    onToggleTaskItem={(item) => {
                      const isDone = completedTaskMap[item] ?? false;
                      setCompletedTaskMap((prev) => ({ ...prev, [item]: !isDone }));
                      const matchingTask =
                        latestDirectivePlan?.tasks?.find((t) => t.title === item) ||
                        companyTasks.find((t) => t.title === item);
                      if (matchingTask?.id) {
                        toggleTaskMutation.mutate({
                          taskId: matchingTask.id,
                          currentStatus: isDone ? 'DONE' : 'TODO',
                        });
                      }
                    }}
                    onDelegateTask={(role, item) => handleAutoDispatch(`@${role} Execute task: ${item}`, true)}
                  />

                  <GitWorkingTreePanel
                    gitExpanded={gitExpanded}
                    onToggleGitExpanded={() => setGitExpanded((prev) => !prev)}
                    gitStatus={gitStatus}
                    gitStatusError={gitStatusError}
                    onRetryGitStatus={() => refetchGitStatus()}
                    gitCommitLog={gitCommitLog}
                    rightPanelCommitMsg={rightPanelCommitMsg}
                    onChangeCommitMsg={setRightPanelCommitMsg}
                    canMutate={canMutate}
                    isCommitting={commitMutation.isPending}
                    onOpenVcsDrawer={() => openDrawer('git')}
                    onInspectCommit={(sha) => {
                      setViewerCommitSha(sha);
                      setViewerFile(null);
                      setViewerMode('diff');
                    }}
                    onInspectFileDiff={(path, staged) => {
                      setViewerFile(path);
                      setViewerStaged(staged);
                      setViewerCommitSha(null);
                      setViewerMode('diff');
                    }}
                    onStageFile={(path) => stageFileMutation.mutate(path)}
                    onUnstageFile={(path) => unstageFileMutation.mutate(path)}
                    onGenerateAiCommitMsg={() => {
                      const staged = gitStatus?.staged_files?.map((f) => f.path.split('/').pop()) || [];
                      const unstaged = gitStatus?.unstaged_files?.map((f) => f.path.split('/').pop()) || [];
                      const untracked = gitStatus?.untracked_files?.map((p) => p.split('/').pop()) || [];
                      const changed = Array.from(new Set([...staged, ...unstaged, ...untracked])).filter(Boolean);
                      const scope = changed.length > 0 ? changed.slice(0, 2).join(', ') : 'architecture';
                      setRightPanelCommitMsg(
                        changed.length > 0
                          ? `feat(${scope}): update ${changed.length} file${changed.length === 1 ? '' : 's'} per CTO specification`
                          : `chore(repo): verify clean working tree on ${gitStatus?.branch || 'main'}`
                      );
                    }}
                    onCommit={(msg) => commitMutation.mutate(msg)}
                  />
                </>
              )}
            </aside>
          </>
        )}
      </div>

      {specDrawerOpen && (
        <>
          <div
            className="fixed inset-0 top-12 z-40 bg-background/60 backdrop-blur-xs"
            onClick={() => setSpecDrawerOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Architecture Specification and ADR Drawer"
            className="fixed inset-y-0 top-12 right-0 z-50 w-[min(100vw,34rem)] border-l border-border shadow-2xl flex flex-col bg-card overflow-hidden"
          >
            <ArchitectureSpecPanel
              canMutate={canMutate}
              selectedDelib={selectedDelib}
              hasSynthesizedSpec={hasSynthesizedSpec}
              liveSpecText={liveSpecText}
              previousSpecText={previousSpecText}
              isEditingSpec={isEditingSpec}
              editedSpecText={editedSpecText}
              showSpecDiff={showSpecDiff}
              technicalRationale={technicalRationale}
              disagreements={disagreements}
              resolvedDissentTopics={resolvedDissentTopics}
              hasActiveDebateOrProposal={hasActiveDebateOrProposal}
              adrStatus={adrStatus}
              votingModel={votingModel}
              quorumResult={quorumResult}
              copiedAdr={copiedAdr}
              isQuorumPending={quorumMutation.isPending}
              isRatifyPending={ratifyMutation.isPending}
              onExtractTasksFromSpec={() => {
                const lines = liveSpecText
                  .split('\n')
                  .map((l) => l.replace(/^[-*•\d.)\s]+/, '').trim())
                  .filter((l) => l.length > 12 && l.length < 140)
                  .slice(0, 4);
                const extracted =
                  lines.length > 0 ? lines : [`Implement specification: ${liveSpecText.slice(0, 72)}...`];
                extracted.forEach((t) => createTaskMutation.mutate(t));
                setTasksExpanded(true);
                showToast(`Queued ${extracted.length} engineering tasks from Specification`);
              }}
              onToggleEditSpec={() => {
                if (!isEditingSpec && editedSpecText === null) {
                  setPreviousSpecText(liveSpecText);
                  setEditedSpecText(liveSpecText);
                }
                setIsEditingSpec((v) => !v);
              }}
              onChangeEditedSpecText={setEditedSpecText}
              onToggleSpecDiff={() => setShowSpecDiff((v) => !v)}
              onCopyAndPinSpec={async () => {
                await handlePinToMemory(selectedDelib?.title || 'Architecture Specification', liveSpecText);
                navigator.clipboard?.writeText(`# Specification\n\n${liveSpecText}`);
                showToast('Pinned specification to memory & copied Markdown', 3000);
              }}
              onToggleResolveDissent={(topic) => {
                setPreviousSpecText(liveSpecText);
                setResolvedDissentTopics((prev) =>
                  prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
                );
              }}
              onSelectVotingModel={(m) => {
                setVotingModel(m);
                quorumMutation.mutate(null);
              }}
              onCopyAdr={() => {
                const title = selectedDelib?.title || latestDirectivePlan?.directive || 'Architectural Specification';
                const context =
                  selectedDelib?.problem_statement ||
                  latestDirectivePlan?.directive ||
                  'System architecture directive';
                const rationale =
                  selectedDelib?.decision_rationale ||
                  (selectedDelib?.synthesis_proposal?.consensus_points || []).map((c) => `- ${c}`).join('\n') ||
                  technicalRationale ||
                  'Synthesized by autonomous architecture engine.';
                navigator.clipboard?.writeText(
                  `# ADR: ${title}\n\n## Status\n${adrStatus}\n\n## Context\n${context}\n\n## Decision\n${adrDecision}\n\n## Rationale\n${rationale}`
                );
                setCopiedAdr(true);
                setTimeout(() => setCopiedAdr(false), 2000);
              }}
              onRatifySpec={() => ratifyMutation.mutate(selectedDelib?.id || 'default')}
              onCloseDrawer={() => setSpecDrawerOpen(false)}
            />
          </div>
        </>
      )}
    </div>
  );
}
