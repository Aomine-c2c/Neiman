'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback, FormEvent } from 'react';
import dynamic from 'next/dynamic';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Users,
  Scale,
  Plus,
  CheckCircle,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Sparkles,
  Bot,
  FileText,
  MessageSquare,
  MessageSquarePlus,
  Shield,
  Check,
  Send,
  Copy,
  ListTodo,
  Zap,
  Database,
  TestTube,
  ArrowRight,
  ArrowLeft,
  Play,
  Pause,
  Terminal,
  GitBranch,
  Boxes,
  Code2,
  BookmarkPlus,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Layers,
  PanelRightClose,
  PanelRightOpen,
  PanelLeftClose,
  PanelLeftOpen,
  Kanban,
  Clock,
  Activity,
  FileCode,
  FolderGit2,
  CheckSquare,
  Maximize2,
  RotateCw,
  Lock,
  X,
} from 'lucide-react';
import { BashTerminal } from '@/components/terminal/BashTerminal';
import { useOrganizationContext } from '@/lib/organizationContext';
import { useAuthStore } from '@/store/auth';
import { AgentAvatar } from '@/components/ui/AgentAvatar';
import {
  councilsApi,
  type AgentCouncil,
  type CouncilDeliberation,
  type CouncilMember,
  type ReviewItem,
  type DisagreementRecord,
  type QuorumVotingModel,
  type QuorumResult,
} from '@/lib/api/councils';
import {
  ctoApi,
  type CTODirectiveResponse,
  type ExecutiveThread,
  type ExecutiveThreadMessageItem,
  type SupervisorStatus,
} from '@/lib/api/cto';
import { projectsApi, type Task, type TaskStatus } from '@/lib/api/projects';
import { vcsApi, type GitStatusResponse } from '@/lib/api/vcs';
import { mcpApi, type MCPServerConfig, type SkillConfig, type MCPToolCallResult } from '@/lib/api/mcp';
import { memoryApi, type MemoryItem } from '@/lib/api/memory';
import { sourceGraphApi } from '@/lib/api/sourceGraph';
import { runtimeApi, type RuntimeExecuteResult } from '@/lib/api/runtime';
import { FileTreeExplorer } from '@/components/explorer/FileTreeExplorer';

const CANONICAL_COUNCIL_MEMBERS: CouncilMember[] = [
  {
    role_title: 'CTO',
    agent_name: 'Chief Technology Agent',
    perspective: 'Strategic Feasibility & Business Alignment',
    model_identifier: 'claude-3-5-sonnet',
    model_provider: 'anthropic',
  },
  {
    role_title: 'Architect',
    agent_name: 'Systems Architect Agent',
    perspective: 'Scalability, Modularity & Distributed Systems',
    model_identifier: 'claude-3-5-sonnet',
    model_provider: 'anthropic',
  },
  {
    role_title: 'Security',
    agent_name: 'Cybersecurity Agent',
    perspective: 'Zero-Trust, Attack Vectors & Compliance',
    model_identifier: 'gpt-4o',
    model_provider: 'openai',
  },
  {
    role_title: 'Backend',
    agent_name: 'Backend Engineering Agent',
    perspective: 'Implementation Complexity & Latency Budget',
    model_identifier: 'gemini-2.5-pro',
    model_provider: 'google',
  },
  {
    role_title: 'QA Lead',
    agent_name: 'Quality Assurance Agent',
    perspective: 'Testability, Chaos Tolerance & Edge Cases',
    model_identifier: 'gpt-4o-mini',
    model_provider: 'openai',
  },
];

interface DirectiveSuggestion {
  id: string;
  title: string;
  icon: React.ElementType;
  badge: string;
  badgeColor: string;
  description: string;
  prompt: string;
}

const DIRECTIVE_SUGGESTIONS: DirectiveSuggestion[] = [
  {
    id: 'security',
    title: 'AppSec & Boundary Guardrails',
    icon: Shield,
    badge: 'Security',
    badgeColor: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    description: 'Audit AST call graphs and implement cryptographic secret and PII egress masking across microservices.',
    prompt: 'Audit AST call graphs and implement cryptographic secret and PII egress masking across microservices.',
  },
  {
    id: 'infra',
    title: 'High-Availability & Circuit Breakers',
    icon: Zap,
    badge: 'Infra',
    badgeColor: 'text-sky-500 bg-sky-500/10 border-sky-500/20',
    description: 'Configure low-latency health probes, exponential retries, and circuit-breaker failover across all model providers.',
    prompt: 'Configure low-latency health probes, exponential retries, and circuit-breaker failover across all model providers.',
  },
  {
    id: 'testing',
    title: 'TDD & Regression Test Automation',
    icon: TestTube,
    badge: 'Testing',
    badgeColor: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    description: 'Enforce strict test-driven development (TDD) and scaffold end-to-end regression test suites with 90% coverage threshold.',
    prompt: 'Enforce strict test-driven development (TDD) and scaffold end-to-end regression test suites with 90% coverage threshold.',
  },
  {
    id: 'schema',
    title: 'Schema & Reversible Migrations',
    icon: Database,
    badge: 'Database',
    badgeColor: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
    description: 'Design normalized relational schema migrations with composite indexing, zero downtime, and strict foreign keys.',
    prompt: 'Design normalized relational schema migrations with composite indexing, zero downtime, and strict foreign keys.',
  },
];

export type RightArtifactTab = 'SPEC' | 'TASKS' | 'ADR' | 'MEMORY' | 'PULSE';

export type DockedViewId =
  | 'DEFAULT'
  | 'TASKS'
  | 'PULSE'
  | 'OVERVIEW'
  | 'MEMORY'
  | 'MCP'
  | 'WORKFLOWS'
  | 'SETTINGS'
  | 'APPROVALS'
  | 'GIT';

function DockedLoadingState({ label }: { label: string }) {
  return (
    <div className="flex h-64 w-full flex-col items-center justify-center gap-2 font-mono text-xs text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin text-primary" />
      <span className="uppercase tracking-wider text-[10px]">INITIALIZING // {label}...</span>
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

interface DockedDomainMeta {
  title: string;
  subtitle: string;
  tag: string;
  tagColor: string;
  drawerKey: string;
}

const DOCKED_DOMAIN_REGISTRY: Record<string, DockedDomainMeta> = {
  TASKS: {
    title: 'Tasks Execution Matrix',
    subtitle: 'Granular work orders, real-time assignment, dependencies, and proofs of work',
    tag: 'TASKS',
    tagColor: 'text-cyan-400',
    drawerKey: 'tasks',
  },
  PULSE: {
    title: 'Live System Pulse & Activity Stream',
    subtitle: 'Real-time operational telemetry, swarm reasoning traces, and audit events',
    tag: 'PULSE',
    tagColor: 'text-emerald-400',
    drawerKey: 'overview',
  },
  OVERVIEW: {
    title: 'Live System Pulse & Activity Stream',
    subtitle: 'Real-time operational telemetry, swarm reasoning traces, and audit events',
    tag: 'PULSE',
    tagColor: 'text-emerald-400',
    drawerKey: 'overview',
  },
  MEMORY: {
    title: 'Organizational Memory',
    subtitle: 'Vector semantic store, shared knowledge graph, recall benchmarks, and document index',
    tag: 'INTEL',
    tagColor: 'text-cyan-400',
    drawerKey: 'memory',
  },
  MCP: {
    title: 'Skills, MCP & Plugins Hub',
    subtitle: 'Autonomous suites, procedural skill playbooks, and registered MCP tool gateways',
    tag: 'INTEGRATIONS',
    tagColor: 'text-emerald-400',
    drawerKey: 'mcp',
  },
  WORKFLOWS: {
    title: 'Autonomous Workflows',
    subtitle: 'Visual execution DAGs, steps, triggers, and automated organizational routines',
    tag: 'WORKFLOWS',
    tagColor: 'text-emerald-400',
    drawerKey: 'workflows',
  },
  SETTINGS: {
    title: 'Administration & Settings',
    subtitle: 'System preferences, API keys, desktop native settings, and authentication',
    tag: 'TOPO',
    tagColor: 'text-purple-400',
    drawerKey: 'settings',
  },
  APPROVALS: {
    title: 'Governance Approvals Gate',
    subtitle: 'CEO sign-offs, financial expenditure gates, and mission-critical decisions',
    tag: 'APPROVALS',
    tagColor: 'text-primary',
    drawerKey: 'approvals',
  },
  GIT: {
    title: 'Git & Code Control',
    subtitle: 'Working tree, diff staging, branch topologies, and cryptographic commit history',
    tag: 'VCS',
    tagColor: 'text-emerald-400',
    drawerKey: 'git',
  },
};

interface ChatTurn {
  id: string;
  sender: string;
  role: string;
  body: string;
  stance?: string;
  keyPoints?: string[];
  risks?: string[];
  tasks?: Array<{ id?: string; title: string; status?: string }>;
  codeSnippet?: { language: string; code: string };
  isPipeline?: boolean;
  isGitCard?: boolean;
}

const SQUAD_MENTIONS = [
  { tag: '@CTO', label: 'Chief Technology Agent', role: 'CTO' },
  { tag: '@Council', label: 'Architecture Council', role: 'Governance' },
  { tag: '@Architect', label: 'Systems Architect', role: 'Architect' },
  { tag: '@Security', label: 'Cybersecurity Agent', role: 'Security' },
  { tag: '@Backend', label: 'Backend Engineering', role: 'Backend' },
  { tag: '@QA', label: 'Quality Assurance Lead', role: 'QA Lead' },
];

const SLASH_COMMANDS = [
  { cmd: '/debate', desc: 'Start a formal Council debate deliberation' },
  { cmd: '/task', desc: 'Decompose directive into engineering backlog tasks' },
  { cmd: '/run', desc: 'Run code snippet in isolated sandbox runtime' },
  { cmd: '/workflow', desc: 'Execute autonomous 5-stage engineering pipeline' },
  { cmd: '/git', desc: 'Inspect working tree and commit changes' },
  { cmd: '/mcp', desc: 'Invoke registered MCP tools and active skills' },
  { cmd: '/memory', desc: 'Search organizational memory & AST codebase' },
  { cmd: '/tick', desc: 'Trigger supervisor execution cycle tick' },
];

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

  // Topology: Right Panel open / collapsed (Center Chatroom expands to col-span-12 when collapsed)
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [activeDockedView, setActiveDockedView] = useState<DockedViewId>('DEFAULT');
  const [completedTaskMap, setCompletedTaskMap] = useState<Record<string, boolean>>({});
  const [specExpanded, setSpecExpanded] = useState(true);
  const [tasksExpanded, setTasksExpanded] = useState(true);
  const [gitExpanded, setGitExpanded] = useState(true);

  // Integrated Bash Terminal below middle chatroom
  const [terminalOpen, setTerminalOpen] = useState(true);
  const [terminalMaximized, setTerminalMaximized] = useState(false);

  // Selected council and deliberation
  const [selectedCouncil, setSelectedCouncil] = useState<AgentCouncil | null>(null);
  const [selectedDelib, setSelectedDelib] = useState<CouncilDeliberation | null>(null);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(searchParams.get('thread') || null);

  // Voting and ADR state
  const [votingModel, setVotingModel] = useState<QuorumVotingModel>('WEIGHTED');
  const [quorumResult, setQuorumResult] = useState<QuorumResult | null>(null);
  const [copiedAdr, setCopiedAdr] = useState(false);
  const [pinnedNotice, setPinnedNotice] = useState<string | null>(null);

  // Composer & Conversation state
  const [composerText, setComposerText] = useState('');
  const [localTurns, setLocalTurns] = useState<ChatTurn[]>([]);
  const [latestDirectivePlan, setLatestDirectivePlan] = useState<CTODirectiveResponse | null>(null);
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [showSkillsPopover, setShowSkillsPopover] = useState(false);
  const [codeExecutionOutputs, setCodeExecutionOutputs] = useState<Record<string, RuntimeExecuteResult>>({});
  const [executingCodeId, setExecutingCodeId] = useState<string | null>(null);

  // Inline Git card state
  const [inlineGitMessage, setInlineGitMessage] = useState('feat: autonomous architectural iteration');
  const [rightPanelCommitMsg, setRightPanelCommitMsg] = useState('');

  // Memory search query in right panel
  const [memorySearchQuery, setMemorySearchQuery] = useState('');

  // New Deliberation Modal
  const [showStartDelib, setShowStartDelib] = useState(false);
  const [delibTitle, setDelibTitle] = useState('');
  const [delibProblem, setDelibProblem] = useState('');

  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [composerText]);

  const handleCopyMessage = (text: string) => {
    navigator.clipboard?.writeText(text);
    setPinnedNotice('Copied message to clipboard');
    setTimeout(() => setPinnedNotice(null), 2000);
  };

  const openDrawer = (drawerId: string, entityId?: string) => {
    const raw = drawerId.toUpperCase();
    if (['TASKS', 'PULSE', 'OVERVIEW', 'MEMORY', 'MCP', 'WORKFLOWS', 'SETTINGS', 'APPROVALS', 'GIT'].includes(raw)) {
      setActiveDockedView(raw === 'OVERVIEW' ? 'PULSE' : (raw as DockedViewId));
      setRightPanelOpen(true);
      return;
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('neiman:open-drawer', { detail: { drawerId, entityId } })
      );
    }
    const params = new URLSearchParams(searchParams.toString());
    params.set('drawer', drawerId);
    if (entityId) params.set('entityId', entityId);
    else params.delete('entityId');
    router.push(`?${params.toString()}`, { scroll: false });
  };

  // Sync active thread with URL query ?thread=
  useEffect(() => {
    const threadParam = searchParams.get('thread');
    if (threadParam && threadParam !== activeThreadId) {
      setActiveThreadId(threadParam);
    }
  }, [searchParams, activeThreadId]);

  // Listen to custom window events (from Topbar & AppSidebar)
  useEffect(() => {
    const handleSelectThreadEvent = (e: Event) => {
      const detail = (e as CustomEvent<{ threadId: string }>).detail;
      if (detail?.threadId) {
        setActiveThreadId(detail.threadId);
      }
    };
    const handleToggleRightPanel = () => {
      setRightPanelOpen((prev) => !prev);
    };
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
    const handleNewCouncil = () => {
      setShowStartDelib(true);
    };
    const handleMentionAgent = (e: Event) => {
      const detail = (e as CustomEvent<{ agent: { name: string; roleTitle: string } }>).detail;
      if (detail?.agent) {
        setComposerText((prev) => `${prev ? prev + ' ' : ''}@${detail.agent.name} `);
      }
    };
    const handleInsertChatContext = (e: Event) => {
      const detail = (e as CustomEvent<{ filePath?: string; snippet?: string }>).detail;
      if (detail?.filePath) {
        setComposerText(
          (prev) => `${prev ? prev + '\n' : ''}> Context [${detail.filePath}]:${detail.snippet ? '\n' + detail.snippet : ''}\n`
        );
      }
    };
    const handleToggleTerminal = (e: Event) => {
      const detail = (e as CustomEvent<{ open?: boolean }>).detail;
      if (typeof detail?.open === 'boolean') {
        setTerminalOpen(detail.open);
      } else {
        setTerminalOpen((prev) => !prev);
      }
    };
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault();
        setTerminalOpen((prev) => !prev);
      }
    };

    window.addEventListener('neiman:select-thread', handleSelectThreadEvent);
    window.addEventListener('neiman:toggle-right-panel', handleToggleRightPanel);
    window.addEventListener('neiman:open-right-panel', handleOpenRightPanel);
    window.addEventListener('neiman:dock-view', handleDockView);
    window.addEventListener('neiman:new-chat-thread', handleNewChat);
    window.addEventListener('neiman:new-council-debate', handleNewCouncil);
    window.addEventListener('neiman:mention-agent', handleMentionAgent);
    window.addEventListener('neiman:insert-chat-context', handleInsertChatContext);
    window.addEventListener('neiman:toggle-terminal', handleToggleTerminal);
    window.addEventListener('keydown', handleGlobalKeyDown);

    return () => {
      window.removeEventListener('neiman:select-thread', handleSelectThreadEvent);
      window.removeEventListener('neiman:toggle-right-panel', handleToggleRightPanel);
      window.removeEventListener('neiman:open-right-panel', handleOpenRightPanel);
      window.removeEventListener('neiman:dock-view', handleDockView);
      window.removeEventListener('neiman:new-chat-thread', handleNewChat);
      window.removeEventListener('neiman:new-council-debate', handleNewCouncil);
      window.removeEventListener('neiman:mention-agent', handleMentionAgent);
      window.removeEventListener('neiman:insert-chat-context', handleInsertChatContext);
      window.removeEventListener('neiman:toggle-terminal', handleToggleTerminal);
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, []);

  // 1. Fetch Councils
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

  // 2. Fetch Deliberations for selected council
  const {
    data: deliberations = [],
    isLoading: deliberationsLoading,
    isError: deliberationsError,
    refetch: refetchDeliberations,
  } = useQuery({
    queryKey: ['council-deliberations', companyId, selectedCouncil?.id],
    queryFn: () => councilsApi.listDeliberations(companyId, selectedCouncil!.id),
    enabled: !!companyId && !!selectedCouncil?.id,
  });

  // 2b. Fetch Proactive Architectural Proposals & Initiatives
  const { data: ctoProposals = [] } = useQuery({
    queryKey: ['cto-proposals', companyId],
    queryFn: () => ctoApi.getProposals(companyId),
    enabled: !!companyId,
  });

  // 2c. Fetch Executive Threads
  const { data: executiveThreads = [] } = useQuery({
    queryKey: ['cto-threads', companyId],
    queryFn: async () => {
      try {
        return await ctoApi.getThreads(companyId);
      } catch {
        return [];
      }
    },
    enabled: !!companyId,
  });

  // 2d. Fetch VCS Status & Recent Commit Log (for inline git card & right panel)
  const { data: gitStatus } = useQuery({
    queryKey: ['vcs-status-chat', companyId],
    queryFn: async () => {
      try {
        return await vcsApi.getStatus(companyId);
      } catch {
        return null;
      }
    },
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

  const { data: companyTasks = [] } = useQuery({
    queryKey: ['company-tasks-chat', companyId],
    queryFn: async () => {
      try {
        return await projectsApi.listTasks(companyId, 'primary');
      } catch {
        return [];
      }
    },
    enabled: !!companyId,
    staleTime: 15000,
  });

  // 2e. Fetch MCP Servers & Skills
  const { data: mcpServers = [] } = useQuery({
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

  const { data: activeSkills = [] } = useQuery({
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

  // Auto-select council and deliberation
  useEffect(() => {
    if (councils.length > 0 && !selectedCouncil) {
      setSelectedCouncil(councils[0]);
    }
  }, [councils, selectedCouncil]);

  useEffect(() => {
    if (activeThreadId) {
      const matchedDelib = deliberations.find((d) => d.id === activeThreadId);
      if (matchedDelib) {
        setSelectedDelib(matchedDelib);
      }
    } else if (deliberations.length > 0 && !selectedDelib) {
      setSelectedDelib(deliberations[0]);
    }
  }, [deliberations, selectedDelib, activeThreadId]);

  // Create Canonical Architecture Council
  const createCouncilMutation = useMutation({
    mutationFn: () =>
      councilsApi.create(companyId, {
        name: 'Architecture & Technical Governance Council',
        charter:
          'Evaluates cross-cutting system design, multi-model intelligence routing, and reliability tradeoffs.',
        council_type: 'PERMANENT',
        members: CANONICAL_COUNCIL_MEMBERS,
      }),
    onSuccess: (council) => {
      qc.invalidateQueries({ queryKey: ['councils', companyId] });
      setSelectedCouncil(council);
    },
  });

  // Start Deliberation Run
  const startDelibMutation = useMutation({
    mutationFn: () =>
      councilsApi.startDeliberation(companyId, selectedCouncil!.id, {
        title: delibTitle || 'Architectural Trade-Off Deliberation',
        problem_statement:
          delibProblem ||
          'Evaluate service boundaries, failure modes, and schema migration safety for the next engineering milestone.',
        auto_execute_deliberation: true,
      }),
    onSuccess: (delib) => {
      qc.invalidateQueries({ queryKey: ['council-deliberations', companyId, selectedCouncil?.id] });
      setSelectedDelib(delib);
      setActiveThreadId(delib.id);
      setShowStartDelib(false);
      setDelibTitle('');
      setDelibProblem('');
    },
  });

  const handleStartNewChat = useCallback(() => {
    setActiveThreadId(null);
    setSelectedDelib(null);
    setLocalTurns([]);
    setLatestDirectivePlan(null);
  }, []);

  const handleStartNewCouncil = useCallback(() => {
    if (councils.length === 0) {
      createCouncilMutation.mutate();
    } else {
      setShowStartDelib(true);
    }
  }, [councils.length, createCouncilMutation]);

  // Send Directive to CTO
  const directiveMutation = useMutation({
    mutationFn: (prompt: string) =>
      ctoApi.sendDirective(companyId, {
        directive: prompt,
        priority: 'HIGH',
      }),
    onSuccess: (res, prompt) => {
      const isConversation = res.intent === 'CONVERSATION';
      const replyBody =
        res.analysis ||
        res.summary ||
        (isConversation
          ? 'CTO acknowledged. How can I assist with your architecture or technical directives?'
          : 'Directive accepted — execution tasks decomposed.');

      // Detect code snippets in reply or prompt
      const codeMatch = replyBody.match(/```([a-z]*)\n([\s\S]*?)```/);
      const isWorkflowPrompt = prompt.startsWith('/workflow') || prompt.startsWith('/pipeline');
      const isGitPrompt = prompt.startsWith('/git') || prompt.startsWith('/commit');

      setLocalTurns((prev) => [
        ...prev,
        {
          id: `op-${Date.now()}`,
          sender: 'Operator',
          role: 'Human Lead',
          body: prompt,
        },
        {
          id: res.directive_id || `cto-${Date.now()}`,
          sender: res.cto_agent_name || 'Chief Technology Agent',
          role: 'CTO',
          body: replyBody,
          stance: isConversation ? 'CONVERSATION' : 'SYNTHESIZED',
          tasks: res.tasks || [],
          codeSnippet: codeMatch ? { language: codeMatch[1] || 'bash', code: codeMatch[2] } : undefined,
          isPipeline: isWorkflowPrompt,
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
        {
          id: `err-${Date.now()}`,
          sender: 'System Sentinel',
          role: 'Error',
          body: errorMsg,
        },
      ]);
    },
  });

  // Inline Sandbox Code Execution
  const handleExecuteSandbox = async (codeId: string, language: string, code: string) => {
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
  };

  // Toggle Task Status Mutation
  const toggleTaskMutation = useMutation({
    mutationFn: ({ taskId, currentStatus }: { taskId: string; currentStatus: string }) => {
      const isDone = currentStatus === 'DONE' || currentStatus === 'COMPLETED';
      const newStatus: TaskStatus = isDone ? 'TODO' : 'COMPLETED';
      return projectsApi.toggleTaskStatus(companyId, 'primary', taskId, currentStatus as TaskStatus);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', companyId] });
      qc.invalidateQueries({ queryKey: ['control-room-state', companyId] });
    },
  });

  // Trigger Tick Supervisor Mutation
  const tickMutation = useMutation({
    mutationFn: () => ctoApi.triggerTick(companyId),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['tasks', companyId] });
      qc.invalidateQueries({ queryKey: ['cto-supervisor-status', companyId] });
      setPinnedNotice(`Cycle #${res.cycle} executed: ${res.status}`);
      setTimeout(() => setPinnedNotice(null), 3000);
    },
  });

  // Pin Message to Organizational Memory
  const handlePinToMemory = async (title: string, content: string) => {
    try {
      await (memoryApi.createItem || memoryApi.createMemory)(companyId, {
        domain: 'DECISION',
        scope: 'INTERNAL',
        title: `Architectural Insight: ${title.slice(0, 60)}`,
        content,
        provenance_type: 'COUNCIL_RESOLUTION',
        source: 'CTO & Councils Command Chat',
      });
      setPinnedNotice('Pinned to Organizational Memory successfully.');
      setTimeout(() => setPinnedNotice(null), 3000);
      qc.invalidateQueries({ queryKey: ['memory-items-tab', companyId] });
    } catch {
      setPinnedNotice('Failed to pin to memory.');
      setTimeout(() => setPinnedNotice(null), 3000);
    }
  };

  // 1-Click Commit Mutation for inline Git card
  const commitMutation = useMutation({
    mutationFn: (message: string) =>
      vcsApi.createCommit(companyId, { message, author_name: 'NEIMAN Autonomous Agent' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vcs-status-chat', companyId] });
      setPinnedNotice('Changes committed to branch main.');
      setTimeout(() => setPinnedNotice(null), 3000);
    },
  });

  // Ratify Decision Mutation
  const ratifyMutation = useMutation({
    mutationFn: (delibId: string) =>
      councilsApi.ratifyDecision(companyId, delibId, {
        decision:
          selectedDelib?.synthesis_proposal?.synthesized_decision ||
          adrDecision ||
          'Ratified synthesized architectural consensus with fault-isolated adapters.',
        rationale: 'Ratified by autonomous quorum consensus and committed to organizational memory.',
        record_in_memory: true,
      }),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['council-deliberations', companyId, selectedCouncil?.id] });
      qc.invalidateQueries({ queryKey: ['memory-items', companyId] });
      setSelectedDelib(updated);
      setPinnedNotice('ADR consensus auto-ratified and committed to organizational memory.');
      setTimeout(() => setPinnedNotice(null), 3500);
    },
  });

  // Quorum Evaluation Mutation
  const quorumMutation = useMutation({
    mutationFn: (overrideVote?: 'APPROVE' | 'REJECT' | 'VETO' | null) =>
      councilsApi.evaluateQuorum(companyId, selectedCouncil!.id, selectedDelib!.id, {
        voting_model: votingModel,
        override_vote: overrideVote,
      }),
    onSuccess: (result) => {
      setQuorumResult(result);
      qc.invalidateQueries({ queryKey: ['council-deliberations', companyId, selectedCouncil?.id] });
      // Automated ADR ratification upon quorum consensus
      const isApproved =
        result.status === 'PASSED' ||
        (result.total_weight > 0 && result.approve_weight / result.total_weight >= 0.5);
      if (isApproved && selectedDelib && selectedDelib.status !== 'RESOLVED' && !ratifyMutation.isPending) {
        ratifyMutation.mutate(selectedDelib.id);
      }
    },
  });

  // Automated Quorum & ADR Ratification Pipeline
  useEffect(() => {
    const reviewsCount = selectedDelib?.independent_reviews?.length || 0;
    if (
      selectedCouncil &&
      selectedDelib &&
      selectedDelib.status !== 'RESOLVED' &&
      !quorumMutation.isPending &&
      !ratifyMutation.isPending
    ) {
      // Auto-evaluate quorum when specialist reviews are present and quorum hasn't evaluated yet
      if (reviewsCount >= 2 && !quorumResult) {
        quorumMutation.mutate(null);
      }
    }
  }, [selectedCouncil, selectedDelib, quorumResult, quorumMutation, ratifyMutation]);

  const [activeDispatchingPrompt, setActiveDispatchingPrompt] = useState<string | null>(null);

  const handleAutoDispatch = async (promptText: string, autoTickSwarm = true) => {
    if (!promptText.trim() || !companyId || directiveMutation.isPending) return;
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
  };

  const handleDebateProposal = async (proposalTitle: string, proposalRationale?: string) => {
    let targetCouncil = selectedCouncil;
    if (!targetCouncil && councils.length > 0) {
      targetCouncil = councils[0];
    }
    if (!targetCouncil) {
      try {
        targetCouncil = await createCouncilMutation.mutateAsync();
      } catch {
        return;
      }
    }
    if (!targetCouncil) return;

    try {
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
      // handled
    }
  };

  const handleComposerSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = composerText.trim();
    if (!trimmed || directiveMutation.isPending) return;

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    // Intercept /tick command
    if (trimmed === '/tick') {
      tickMutation.mutate();
      setComposerText('');
      return;
    }

    // Intercept slash navigation commands to dock directly in Column 3
    if (trimmed === '/task' || trimmed === '/tasks') {
      setActiveDockedView('TASKS');
      setRightPanelOpen(true);
      setComposerText('');
      return;
    }
    if (trimmed === '/mcp') {
      setActiveDockedView('MCP');
      setRightPanelOpen(true);
      setComposerText('');
      return;
    }
    if (trimmed === '/memory') {
      setActiveDockedView('MEMORY');
      setRightPanelOpen(true);
      setComposerText('');
      return;
    }
    if (trimmed === '/workflow' || trimmed === '/workflows') {
      setActiveDockedView('WORKFLOWS');
      setRightPanelOpen(true);
      setComposerText('');
      return;
    }
    if (trimmed === '/git') {
      setActiveDockedView('GIT');
      setRightPanelOpen(true);
      setComposerText('');
      return;
    }
    if (trimmed === '/pulse' || trimmed === '/overview') {
      setActiveDockedView('PULSE');
      setRightPanelOpen(true);
      setComposerText('');
      return;
    }
    if (trimmed === '/settings') {
      setActiveDockedView('SETTINGS');
      setRightPanelOpen(true);
      setComposerText('');
      return;
    }
    if (trimmed === '/approvals') {
      setActiveDockedView('APPROVALS');
      setRightPanelOpen(true);
      setComposerText('');
      return;
    }
    if (trimmed === '/term' || trimmed === '/terminal') {
      setTerminalOpen(true);
      setComposerText('');
      return;
    }

    directiveMutation.mutate(trimmed);
  };

  if (!companyId) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <Users className="h-12 w-12 text-muted-foreground mb-3 opacity-60" />
        <h2 className="text-lg font-bold text-foreground">No Repository Connected</h2>
        <p className="text-sm text-muted-foreground">Select an active software workspace to consult your CTO & Councils.</p>
      </div>
    );
  }

  const reviews: ReviewItem[] = selectedDelib?.independent_reviews || [];
  const disagreements: DisagreementRecord[] = selectedDelib?.disagreements_recorded || [];

  const topProposal = ctoProposals[0];
  const delibMitigations = selectedDelib?.synthesis_proposal?.recommended_mitigations;
  const directiveTaskTitles = latestDirectivePlan?.tasks?.map((t) => t.title) || [];
  const proposalTaskTitles = (topProposal?.proposed_tasks || []).map((t) => t.title);
  const companyTaskTitles = companyTasks.slice(0, 6).map((t) => t.title);

  const actionItems: string[] =
    delibMitigations && delibMitigations.length > 0
      ? delibMitigations
      : directiveTaskTitles.length > 0
      ? directiveTaskTitles
      : proposalTaskTitles.length > 0
      ? proposalTaskTitles
      : companyTaskTitles;

  const completedCount = useMemo(() => {
    return actionItems.filter((item) => completedTaskMap[item] === true).length;
  }, [actionItems, completedTaskMap]);

  const liveSpecText =
    selectedDelib?.synthesis_proposal?.synthesized_decision ||
    (latestDirectivePlan && latestDirectivePlan.intent !== 'CONVERSATION'
      ? latestDirectivePlan.analysis || latestDirectivePlan.summary
      : null) ||
    (topProposal
      ? `${topProposal.title}\n\n${topProposal.rationale}\n\nImpact Assessment:\n${topProposal.impact_assessment}`
      : null) ||
    'No architectural specification synthesized yet. Start a deliberation or send a technical directive to the CTO.';

  const technicalRationale =
    selectedDelib?.decision_rationale ||
    (latestDirectivePlan &&
    latestDirectivePlan.intent !== 'CONVERSATION' &&
    (latestDirectivePlan.tasks_created_count > 0 || (latestDirectivePlan.tasks && latestDirectivePlan.tasks.length > 0))
      ? `Autonomous CTO decomposed directive into ${
          latestDirectivePlan.tasks_created_count || latestDirectivePlan.tasks?.length || 0
        } sequential engineering work items mapped across specialized workforce agents.`
      : null) ||
    (topProposal ? `Proactive architectural initiative formulated by Autonomous CTO: ${topProposal.category} priority.` : null);

  const adrStatus =
    selectedDelib?.status ||
    (latestDirectivePlan &&
    latestDirectivePlan.intent !== 'CONVERSATION' &&
    (latestDirectivePlan.tasks_created_count > 0 || (latestDirectivePlan.tasks && latestDirectivePlan.tasks.length > 0))
      ? 'DIRECTIVE_DISPATCHED'
      : topProposal
      ? 'PROPOSAL_ACTIVE'
      : 'DRAFT');

  const adrDecision =
    selectedDelib?.synthesis_proposal?.synthesized_decision ||
    (latestDirectivePlan && latestDirectivePlan.intent !== 'CONVERSATION'
      ? latestDirectivePlan.analysis || latestDirectivePlan.summary
      : null) ||
    (topProposal ? `${topProposal.title}: ${topProposal.rationale}` : 'Awaiting deliberation synthesis or architectural directive');

  const handleCopyAdr = () => {
    const title = selectedDelib?.title || latestDirectivePlan?.directive || 'Architectural Specification';
    const status = adrStatus;
    const context = selectedDelib?.problem_statement || latestDirectivePlan?.directive || 'System architecture directive';
    const decision = adrDecision;
    const rationale =
      selectedDelib?.decision_rationale ||
      (selectedDelib?.synthesis_proposal?.consensus_points || []).map((c) => `- ${c}`).join('\n') ||
      technicalRationale ||
      'Synthesized by autonomous architecture engine.';

    const adrMd = `# ADR: ${title}\n\n## Status\n${status}\n\n## Context\n${context}\n\n## Decision\n${decision}\n\n## Rationale\n${rationale}`;
    navigator.clipboard?.writeText(adrMd);
    setCopiedAdr(true);
    setTimeout(() => setCopiedAdr(false), 2000);
  };

  return (
    <div className="w-full flex-1 flex flex-col h-full min-h-0 overflow-hidden animate-fade-in">
      {/* Pinned Feedback Toast */}
      {pinnedNotice && (
        <div className="fixed top-14 right-6 z-50 rounded-lg border border-primary/40 bg-card px-3.5 py-2 text-xs font-mono text-primary shadow-lg flex items-center gap-2 animate-slide-up">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          <span>{pinnedNotice}</span>
        </div>
      )}

      {/* Main 2-Column Command Workspace Grid: Zero-Gap Edge-to-Edge IDE Topology */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-0 divide-x divide-border dark:divide-white/10 items-stretch flex-1 min-h-0 overflow-hidden bg-background">
        {/* ── 1. CENTER: CHATROOM + INTEGRATED SANDBOX TERMINAL BELOW ── */}
        <div
          className={`flex flex-col h-full min-h-0 gap-0 divide-y divide-border dark:divide-white/10 transition-all duration-200 ${
            rightPanelOpen ? 'xl:col-span-8' : 'col-span-12'
          }`}
        >
          {/* Upper Pane: Unified CTO and Council Conversation */}
          <section
            aria-label="Unified CTO and Council Conversation"
            className={`flex flex-col min-h-0 bg-card dark:bg-[#121215] overflow-hidden transition-all ${
              terminalOpen && terminalMaximized ? 'h-36 shrink-0' : 'flex-1'
            }`}
          >
          {/* Consolidated Command Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-secondary/30 shrink-0 gap-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary text-foreground border border-border shrink-0">
                <Scale className="h-4 w-4" />
              </div>
              <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                <h2 className="text-xs font-bold text-foreground uppercase tracking-wider truncate max-w-[240px] sm:max-w-[340px]">
                  {selectedDelib ? selectedDelib.title : 'Direct CTO & Squad Architecture Thread'}
                </h2>
                {selectedDelib?.status && (
                  <span className="hidden sm:inline-flex px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-secondary text-foreground border border-border">
                    {selectedDelib.status}
                  </span>
                )}
              </div>
            </div>

            {/* Quick Actions & Header Controls */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => handleAutoDispatch('/git')}
                className="text-[10px] font-mono px-2 py-1 rounded border border-border bg-card hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                title="Inspect Git Working Tree"
              >
                /git
              </button>
              <button
                type="button"
                onClick={() => handleAutoDispatch('/workflow')}
                className="text-[10px] font-mono px-2 py-1 rounded border border-border bg-card hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                title="Inspect 5-Stage Autonomous Pipeline"
              >
                /workflow
              </button>
              <button
                type="button"
                onClick={() => setTerminalOpen((v) => !v)}
                className={`text-[10px] font-mono px-2 py-1 rounded border transition-colors flex items-center gap-1 ${
                  terminalOpen
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 font-semibold'
                    : 'border-border bg-card hover:bg-secondary text-muted-foreground hover:text-foreground'
                }`}
                title="Toggle Integrated Bash Terminal (Ctrl+`)"
                aria-label="Toggle Integrated Bash Terminal"
              >
                <Terminal className="h-3 w-3" />
                <span>Terminal</span>
              </button>

              <button
                type="button"
                onClick={handleStartNewChat}
                aria-label="New CTO Chat Thread"
                title="Start New CTO & Squad Chat Thread"
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs shrink-0"
              >
                <MessageSquarePlus className="h-3.5 w-3.5 shrink-0" />
                <span>New Chat</span>
              </button>

              <button
                type="button"
                onClick={handleStartNewCouncil}
                disabled={createCouncilMutation.isPending || startDelibMutation.isPending}
                aria-label="New Council Debate"
                title="Convene Specialist Council Deliberation"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/50 text-foreground px-2.5 py-1 text-xs font-medium hover:bg-secondary transition-colors shrink-0 disabled:opacity-50"
              >
                {createCouncilMutation.isPending || startDelibMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                ) : (
                  <Scale className="h-3.5 w-3.5 text-foreground shrink-0" />
                )}
                <span>Council</span>
              </button>

              {/* Right Panel Toggle Button */}
              <button
                type="button"
                onClick={() => setRightPanelOpen(!rightPanelOpen)}
                aria-label={rightPanelOpen ? 'Collapse Context Panel' : 'Expand Context Panel'}
                title={rightPanelOpen ? 'Collapse Spec & Tasks Panel' : 'Open Spec & Tasks Panel'}
                className="p-1 rounded-md border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0"
              >
                {rightPanelOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4 text-primary" />}
              </button>
            </div>
          </div>

          {/* Conversation Stream */}
          <div className="p-4 space-y-3.5 flex-1 overflow-y-auto min-h-0">
            {reviews.length === 0 && localTurns.length === 0 && !councilsLoading ? (
              <div className="py-2 space-y-4">
                {/* Active Proposal Banner */}
                {topProposal ? (
                  <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3 shadow-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />
                        <span className="text-[11px] font-mono font-bold tracking-wider text-primary uppercase">
                          Active Proposal for Execution
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-primary/10 text-primary border border-primary/20">
                        {topProposal.category || 'SECURITY PRIORITY'}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-foreground">{topProposal.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {topProposal.rationale}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          handleAutoDispatch(`Implement and execute architectural proposal: ${topProposal.title}`, true)
                        }
                        disabled={directiveMutation.isPending}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-all shadow-xs disabled:opacity-50"
                      >
                        {directiveMutation.isPending && activeDispatchingPrompt?.includes(topProposal.title) ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Play className="h-3.5 w-3.5" />
                        )}
                        <span>Decompose &amp; Dispatch to Swarm</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDebateProposal(topProposal.title, topProposal.rationale)}
                        disabled={startDelibMutation.isPending}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary/60 transition-all disabled:opacity-50"
                      >
                        {startDelibMutation.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Scale className="h-3.5 w-3.5 text-primary" />
                        )}
                        <span>Debate with Specialist Council</span>
                      </button>
                    </div>
                  </div>
                ) : null}

                {/* Directive Command Hub Header */}
                <div className="flex items-center justify-between gap-3 px-1">
                  <div>
                    <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                      Architectural Command Hub
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                      Dispatch high-impact engineering directives directly into the autonomous worker swarm.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      handleAutoDispatch(
                        'Inspect system architecture, API boundaries, security controls, and test coverage. Synthesize 3 high-priority technical proposals and engineering tasks.',
                        true
                      )
                    }
                    disabled={directiveMutation.isPending}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20 transition-all shrink-0 disabled:opacity-50"
                  >
                    {directiveMutation.isPending && activeDispatchingPrompt?.includes('Inspect system architecture') ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3" />
                    )}
                    <span>Analyze Codebase &amp; Synthesize Proposals</span>
                  </button>
                </div>

                {/* 4 Categorized Quick-Directive Chips */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  {DIRECTIVE_SUGGESTIONS.map((chip) => {
                    const Icon = chip.icon;
                    const isRunning = directiveMutation.isPending && activeDispatchingPrompt === chip.prompt;

                    return (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => handleAutoDispatch(chip.prompt, true)}
                        disabled={directiveMutation.isPending}
                        className="flex flex-col justify-between p-3 rounded-xl border border-border/80 bg-card hover:border-primary/50 hover:bg-secondary/40 transition-all text-left group shadow-xs disabled:opacity-50 min-h-[92px]"
                      >
                        <div className="space-y-1 w-full">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-secondary text-primary shrink-0 group-hover:scale-105 transition-transform">
                                <Icon className="h-3.5 w-3.5" />
                              </div>
                              <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                                {chip.title}
                              </span>
                            </div>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold border ${chip.badgeColor}`}>
                              {chip.badge}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground line-clamp-2 pl-7">{chip.description}</p>
                        </div>

                        <div className="flex items-center justify-end gap-1 text-[10px] font-mono text-muted-foreground/80 group-hover:text-primary pt-2 pl-7">
                          {isRunning ? (
                            <span className="inline-flex items-center gap-1 text-primary">
                              <Loader2 className="h-2.5 w-2.5 animate-spin" />
                              <span>Dispatching...</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5">
                              <span>1-Click Autonomous Dispatch</span>
                              <ArrowRight className="h-2.5 w-2.5 group-hover:translate-x-0.5 transition-transform" />
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <>
                {/* Council Reviews with Uniform Hairline Cards */}
                {reviews.map((rev, idx) => {
                  const stance = rev.objections.length > 0 ? 'OBJECTS' : 'SUPPORTS';
                  const stanceColor =
                    stance === 'SUPPORTS'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-semibold tabular-nums'
                      : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 font-semibold tabular-nums';
                  const memberConfig = CANONICAL_COUNCIL_MEMBERS.find((m) => m.role_title === rev.role);
                  const modelId = rev.model || memberConfig?.model_identifier || 'claude-3-5-sonnet';

                  return (
                    <div
                      key={`${rev.agent_name}-${idx}`}
                      className="rounded-xl border border-border bg-card dark:bg-[#141414] p-4 space-y-2.5 transition-colors hover:border-foreground/20"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <AgentAvatar name={rev.agent_name || rev.role} roleTitle={rev.role} size={26} showStatus={false} />
                          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                            <span className="text-xs font-bold text-foreground truncate">{rev.agent_name || rev.role}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary text-muted-foreground border border-border/50">
                              @{rev.role}
                            </span>
                            {modelId && (
                              <span className="text-[10px] font-mono text-muted-foreground/80 px-1.5 py-0.5 rounded border border-border/40 bg-secondary/40">
                                {modelId}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${stanceColor}`}>
                            {stance} · {Math.round(rev.confidence * 100)}%
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyMessage(rev.proposal)}
                            title="Copy response body"
                            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePinToMemory(`Council Review: ${rev.role}`, rev.proposal)}
                            title="Pin insight to Organizational Memory"
                            className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                          >
                            <BookmarkPlus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      <p className="text-sm text-foreground leading-relaxed pl-1 whitespace-pre-wrap">{rev.proposal}</p>

                      {rev.evidence.length > 0 && (
                        <div className="space-y-1 pt-1">
                          <span className="text-[10px] font-mono font-semibold uppercase text-muted-foreground">
                            Evidence &amp; Artifacts:
                          </span>
                          <ul className="pl-4 space-y-1 text-xs text-muted-foreground list-disc list-inside">
                            {rev.evidence.map((pt, i) => (
                              <li key={i}>{pt}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {rev.risks.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {rev.risks.map((risk, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400"
                            >
                              <AlertTriangle className="h-3 w-3 shrink-0" />
                              <span>{risk}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Local Dynamic Conversation Turns with Uniform Hairline Cards */}
                {localTurns.map((turn) => {
                  const isError = turn.role === 'Error';
                  const isUser = turn.sender === 'Operator';
                  const cardSurface = isUser
                    ? 'border-border bg-secondary/30'
                    : isError
                    ? 'border-rose-500/30 bg-rose-500/5'
                    : 'border-border bg-card dark:bg-[#141414]';

                  return (
                    <div
                      key={turn.id}
                      className={`rounded-xl border p-4 space-y-2.5 transition-colors hover:border-foreground/20 ${cardSurface}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {isUser ? (
                            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-foreground text-background text-xs font-bold font-mono shrink-0">
                              Op
                            </div>
                          ) : isError ? (
                            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-rose-500/10 text-rose-500 text-xs font-bold shrink-0">
                              !
                            </div>
                          ) : (
                            <AgentAvatar name={turn.sender} roleTitle={turn.role} size={26} showStatus={false} />
                          )}
                          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                            <span className="text-xs font-bold text-foreground truncate">{turn.sender}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary text-muted-foreground border border-border/50">
                              {turn.role}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {turn.stance && (
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${
                                turn.stance === 'SYNTHESIZED'
                                  ? 'text-primary bg-primary/10 border-primary/20'
                                  : 'text-muted-foreground bg-secondary border-border'
                              }`}
                            >
                              {turn.stance}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleCopyMessage(turn.body)}
                            title="Copy message body"
                            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          {!isUser && !isError && (
                            <button
                              type="button"
                              onClick={() => handlePinToMemory(turn.sender, turn.body)}
                              title="Pin this insight to Organizational Memory"
                              className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                            >
                              <BookmarkPlus className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <p
                        className={`text-sm leading-relaxed pl-1 whitespace-pre-wrap ${
                          isError ? 'text-rose-600 dark:text-rose-400 font-mono text-xs' : 'text-foreground'
                        }`}
                      >
                        {turn.body}
                      </p>

                      {/* 1. Inline Task Decomposition Card */}
                      {turn.tasks && turn.tasks.length > 0 && (
                        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold font-mono uppercase tracking-wider text-primary flex items-center gap-1.5">
                              <ListTodo className="h-3.5 w-3.5" />
                              Decomposed Tasks ({turn.tasks.length})
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-foreground animate-pulse shrink-0" />
                                Autonomous Execution
                              </span>
                              <button
                                type="button"
                                onClick={() => openDrawer('tasks')}
                                className="text-[11px] font-mono text-muted-foreground hover:text-foreground"
                              >
                                Open Board
                              </button>
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            {turn.tasks.map((t, tidx) => {
                              const isDone = t.status === 'DONE' || t.status === 'COMPLETED';
                              return (
                                <div
                                  key={t.id || tidx}
                                  className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        t.id &&
                                        toggleTaskMutation.mutate({
                                          taskId: t.id,
                                          currentStatus: t.status || 'TODO',
                                        })
                                      }
                                      className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                                        isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-border'
                                      }`}
                                    >
                                      {isDone && <Check className="h-3 w-3 stroke-[3]" />}
                                    </button>
                                    <span className={`truncate ${isDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                      {t.title}
                                    </span>
                                  </div>
                                  <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                                    {t.status || 'PENDING'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* 2. Inline Code Sandbox Runner Card */}
                      {turn.codeSnippet && (
                        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 space-y-2 font-mono text-xs">
                          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                            <span className="text-[11px] text-zinc-400 uppercase font-bold flex items-center gap-1.5">
                              <Code2 className="h-3.5 w-3.5 text-emerald-400" />
                              Sandbox Runner ({turn.codeSnippet.language})
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                handleExecuteSandbox(turn.id, turn.codeSnippet!.language, turn.codeSnippet!.code)
                              }
                              disabled={executingCodeId === turn.id}
                              className="inline-flex items-center gap-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 text-[11px] font-semibold"
                            >
                              {executingCodeId === turn.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Play className="h-3 w-3" />
                              )}
                              <span>▶ Run in Sandbox</span>
                            </button>
                          </div>
                          <pre className="p-2.5 rounded bg-zinc-900 text-zinc-100 overflow-x-auto text-[11px]">
                            {turn.codeSnippet.code}
                          </pre>
                          {codeExecutionOutputs[turn.id] && (
                            <div className="p-2.5 rounded bg-zinc-900/90 border border-zinc-800 space-y-1">
                              <div className="flex items-center justify-between text-[10px] text-zinc-400">
                                <span>Output · Exit {codeExecutionOutputs[turn.id].exit_code}</span>
                                <span>{codeExecutionOutputs[turn.id].duration_ms}ms</span>
                              </div>
                              {codeExecutionOutputs[turn.id].stdout && (
                                <pre className="text-emerald-300 text-[11px] whitespace-pre-wrap">
                                  {codeExecutionOutputs[turn.id].stdout}
                                </pre>
                              )}
                              {codeExecutionOutputs[turn.id].stderr && (
                                <pre className="text-rose-400 text-[11px] whitespace-pre-wrap">
                                  {codeExecutionOutputs[turn.id].stderr}
                                </pre>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* 3. Inline 5-Stage Autonomous Pipeline Card */}
                      {turn.isPipeline && (
                        <div className="rounded-xl border border-border bg-secondary/30 p-3 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                              <GitBranch className="h-3.5 w-3.5 text-emerald-500" />
                              Autonomous 5-Stage Pipeline
                            </span>
                            <button
                              type="button"
                              onClick={() => openDrawer('workflows')}
                              className="text-[11px] font-mono text-primary hover:underline"
                            >
                              Inspect DAG
                            </button>
                          </div>
                          <div className="grid grid-cols-5 gap-1 text-[10px] font-mono">
                            {[
                              { stage: '1. SPEC', status: 'COMPLETE' },
                              { stage: '2. TDD', status: 'ACTIVE' },
                              { stage: '3. CODE', status: 'QUEUED' },
                              { stage: '4. SEC', status: 'QUEUED' },
                              { stage: '5. RELEASE', status: 'QUEUED' },
                            ].map((st, sidx) => (
                              <div
                                key={sidx}
                                className={`p-1.5 rounded border text-center ${
                                  st.status === 'COMPLETE'
                                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500'
                                    : st.status === 'ACTIVE'
                                    ? 'border-primary/40 bg-primary/10 text-primary font-bold animate-pulse'
                                    : 'border-border/60 bg-card text-muted-foreground'
                                }`}
                              >
                                {st.stage}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 4. Inline Git Working Tree & Commit Card */}
                      {turn.isGitCard && (
                        <div className="rounded-xl border border-border bg-secondary/30 p-3 space-y-2.5 text-xs font-mono">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-foreground flex items-center gap-1.5">
                              <FolderGit2 className="h-3.5 w-3.5 text-primary" />
                              Working Tree Status ({gitStatus?.branch || 'main'})
                            </span>
                            <button
                              type="button"
                              onClick={() => openDrawer('git')}
                              className="text-primary hover:underline"
                            >
                              Open Full VCS
                            </button>
                          </div>
                          <p className="text-muted-foreground text-[11px]">
                            {gitStatus?.unstaged_files?.length || 0} modified, {gitStatus?.untracked_files?.length || 0}{' '}
                            untracked files.
                          </p>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={inlineGitMessage}
                              onChange={(e) => setInlineGitMessage(e.target.value)}
                              className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
                            />
                            <button
                              type="button"
                              onClick={() => commitMutation.mutate(inlineGitMessage)}
                              disabled={commitMutation.isPending}
                              className="px-3 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                            >
                              {commitMutation.isPending ? 'Committing...' : 'Commit'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Rich Chat Composer Bar with Auto-Expanding Textarea */}
          <div className="p-3 border-t border-border/80 dark:border-white/10 bg-secondary/20 dark:bg-[#121215]/95 backdrop-blur-xs space-y-2 shrink-0">
            {/* Popover Menus: Mentions / Slash Commands / Skills */}
            {showMentionMenu && (
              <div className="rounded-lg border border-border bg-card p-2 shadow-lg flex flex-wrap gap-1.5 animate-slide-up">
                {SQUAD_MENTIONS.map((m) => (
                  <button
                    key={m.tag}
                    type="button"
                    onClick={() => {
                      setComposerText((prev) => `${prev ? prev + ' ' : ''}${m.tag} `);
                      setShowMentionMenu(false);
                    }}
                    className="px-2 py-1 rounded-md border border-border hover:border-primary/40 text-xs font-mono text-foreground hover:bg-secondary flex items-center gap-1"
                  >
                    <span className="font-bold text-primary">{m.tag}</span>
                    <span className="text-[10px] text-muted-foreground">({m.role})</span>
                  </button>
                ))}
              </div>
            )}

            {showSlashMenu && (
              <div className="rounded-lg border border-border bg-card p-2 shadow-lg grid grid-cols-2 sm:grid-cols-4 gap-1 animate-slide-up">
                {SLASH_COMMANDS.map((s) => (
                  <button
                    key={s.cmd}
                    type="button"
                    onClick={() => {
                      setComposerText(`${s.cmd} `);
                      setShowSlashMenu(false);
                    }}
                    className="p-1.5 rounded-md text-left text-xs hover:bg-secondary border border-transparent hover:border-border"
                  >
                    <span className="font-bold font-mono text-primary block">{s.cmd}</span>
                    <span className="text-[10px] text-muted-foreground truncate block">{s.desc}</span>
                  </button>
                ))}
              </div>
            )}

            {showSkillsPopover && (
              <div className="rounded-lg border border-border bg-card p-3 shadow-lg space-y-2 animate-slide-up">
                <div className="flex items-center justify-between text-xs font-semibold text-foreground border-b border-border/60 pb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Boxes className="h-3.5 w-3.5 text-primary" />
                    Skills &amp; Registered MCP Gateways
                  </span>
                  <button
                    type="button"
                    onClick={() => openDrawer('mcp')}
                    className="text-[11px] font-mono text-primary hover:underline"
                  >
                    Open Hub (?drawer=mcp)
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {mcpServers.map((s) => (
                    <span
                      key={s.id}
                      className="px-2 py-0.5 rounded text-[10px] font-mono border border-border bg-secondary/50 text-foreground"
                    >
                      MCP: {s.name}
                    </span>
                  ))}
                  {activeSkills.map((sk) => (
                    <button
                      key={sk.id}
                      type="button"
                      onClick={() => {
                        setComposerText((prev) => `${prev} [Skill: ${sk.name}] `);
                        setShowSkillsPopover(false);
                      }}
                      className="px-2 py-0.5 rounded text-[10px] font-mono border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
                    >
                      + {sk.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Chips toolbar */}
            <div className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setShowMentionMenu(!showMentionMenu)}
                  className="px-2 py-1 rounded-md border border-border bg-card hover:bg-secondary text-[11px] font-mono text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <span>@Agent</span>
                  <ChevronDown className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowSlashMenu(!showSlashMenu)}
                  className="px-2 py-1 rounded-md border border-border bg-card hover:bg-secondary text-[11px] font-mono text-muted-foreground hover:text-foreground"
                >
                  /Commands
                </button>
                <button
                  type="button"
                  onClick={() => setShowSkillsPopover(!showSkillsPopover)}
                  className="px-2 py-1 rounded-md border border-border bg-secondary/60 hover:bg-secondary text-[11px] font-mono text-foreground flex items-center gap-1"
                >
                  <Boxes className="h-3 w-3" />
                  <span>+ Skills &amp; MCP</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAutoDispatch('/workflow')}
                  className="hidden sm:inline-flex px-2 py-1 rounded-md border border-border/80 bg-card hover:bg-secondary text-[11px] font-mono text-muted-foreground hover:text-foreground"
                >
                  /workflow
                </button>
                <button
                  type="button"
                  onClick={() => handleAutoDispatch('/git')}
                  className="hidden sm:inline-flex px-2 py-1 rounded-md border border-border/80 bg-card hover:bg-secondary text-[11px] font-mono text-muted-foreground hover:text-foreground"
                >
                  /git
                </button>
              </div>

              <span className="text-[10px] font-mono text-muted-foreground hidden md:inline">
                Shift+Enter for newline · Enter to send
              </span>
            </div>

            {/* Prompt Input Form with Auto-Expanding Textarea */}
            <form onSubmit={handleComposerSubmit} className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                rows={1}
                value={composerText}
                onChange={(e) => setComposerText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleComposerSubmit(e);
                  }
                }}
                placeholder="Ask the CTO, debate with the Council, or send /run, /workflow, /git commands…"
                aria-label="Send message to CTO and Council"
                className="flex-1 resize-none rounded-lg border border-border/80 dark:border-white/10 bg-background dark:bg-[#18181c] px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-zinc-500 font-sans min-h-[38px] max-h-[120px] leading-relaxed transition-colors"
              />
              <button
                type="submit"
                disabled={!composerText.trim() || directiveMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all shadow-xs shrink-0 self-end h-[38px]"
              >
                {directiveMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                <span>Send</span>
              </button>
            </form>
          </div>
        </section>

        {/* BOTTOM: Integrated Bash Terminal below the chat */}
        {terminalOpen ? (
          <div
            aria-label="Integrated Terminal Dock"
            className={`flex flex-col min-h-0 bg-zinc-950 overflow-hidden transition-all ${
              terminalMaximized ? 'flex-1 min-h-[360px]' : 'h-60 sm:h-64 shrink-0'
            }`}
          >
            <BashTerminal
              companyId={companyId}
              isMaximized={terminalMaximized}
              onToggleMaximize={() => setTerminalMaximized((v) => !v)}
              onClose={() => setTerminalOpen(false)}
              className="h-full border-none rounded-none"
            />
          </div>
        ) : (
          /* Collapsed Terminal Dock Bar */
          <button
            type="button"
            onClick={() => setTerminalOpen(true)}
            aria-label="Open Integrated Bash Terminal"
            title="Open Integrated Bash Terminal (Ctrl+`)"
            className="shrink-0 flex items-center justify-between px-3 py-1.5 bg-card dark:bg-[#121215] hover:bg-secondary text-muted-foreground hover:text-foreground text-xs font-mono transition-colors"
          >
            <div className="flex items-center gap-2">
              <Terminal className="h-3.5 w-3.5 text-emerald-400" />
              <span className="font-semibold text-foreground text-[11px]">BASH RUNTIME // TERMINAL DOCK</span>
              <span className="text-[10px] text-muted-foreground hidden sm:inline">· Isolated Sandbox Runner</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-1.5 py-0.5 rounded bg-secondary text-[9px] font-mono text-muted-foreground border border-border dark:border-white/10">
                Ctrl+`
              </kbd>
              <span className="text-[11px] text-primary hover:underline font-sans font-medium">Open Terminal ↑</span>
            </div>
          </button>
        )}
      </div>

        {/* ── 2. RIGHT PANEL: 3 Vertically Staggered Panels on top of each other (NO TABS) OR In-Column Docked Hub ── */}
        {rightPanelOpen && (
          <aside
            aria-label="Live Specification and ADR Artifact Pane"
            className="hidden xl:flex xl:col-span-4 flex-col h-full min-h-0 bg-card dark:bg-[#121215] overflow-hidden divide-y divide-border dark:divide-white/10"
          >
            {activeDockedView !== 'DEFAULT' ? (
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-card dark:bg-[#121215]">
                {/* Flat Industrial Docked Header */}
                <div className="flex h-11 shrink-0 items-center justify-between border-b border-border dark:border-white/10 px-3 font-mono bg-secondary/40 dark:bg-white/[0.03]">
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      type="button"
                      onClick={() => setActiveDockedView('DEFAULT')}
                      aria-label="Return to Spec & ADR"
                      title="Return to Live Architecture Specification & ADR Panels"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono font-semibold bg-secondary text-foreground hover:bg-secondary/80 border border-border dark:border-white/10 transition-colors shrink-0"
                    >
                      <ArrowLeft className="h-3 w-3" />
                      <span>Spec &amp; ADR</span>
                    </button>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 truncate">
                        {DOCKED_DOMAIN_REGISTRY[activeDockedView] && (
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider ${
                              DOCKED_DOMAIN_REGISTRY[activeDockedView].tagColor
                            }`}
                          >
                            [{DOCKED_DOMAIN_REGISTRY[activeDockedView].tag}]
                          </span>
                        )}
                        <h3 className="text-xs font-bold tracking-tight text-foreground uppercase truncate">
                          {DOCKED_DOMAIN_REGISTRY[activeDockedView]?.title || activeDockedView}
                        </h3>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        const key = DOCKED_DOMAIN_REGISTRY[activeDockedView]?.drawerKey || activeDockedView.toLowerCase();
                        if (typeof window !== 'undefined') {
                          window.dispatchEvent(
                            new CustomEvent('neiman:open-drawer', { detail: { drawerId: key } })
                          );
                        }
                      }}
                      className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary dark:hover:bg-white/5 transition-colors"
                      title="Expand to Full Slide-over Canvas ↗"
                      aria-label="Expand view to full modal"
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveDockedView('DEFAULT')}
                      className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary dark:hover:bg-white/5 transition-colors"
                      title="Close docked view (return to Spec & ADR)"
                      aria-label="Close docked view"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Subtitle Telemetry Bar */}
                {DOCKED_DOMAIN_REGISTRY[activeDockedView]?.subtitle && (
                  <div className="px-3 py-1.5 border-b border-border/60 dark:border-white/5 bg-secondary/10 dark:bg-white/[0.01] shrink-0">
                    <p className="text-[10px] text-muted-foreground font-sans truncate">
                      {DOCKED_DOMAIN_REGISTRY[activeDockedView].subtitle}
                    </p>
                  </div>
                )}

                {/* Docked Domain Body */}
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
            {/* PANEL 1 [Top]: Live Architecture Specification (Proportional flex to eliminate dead space) */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-card dark:bg-[#121215]">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border dark:border-white/10 bg-secondary/30 dark:bg-white/[0.03] shrink-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <FileText className="h-4 w-4 text-foreground shrink-0" />
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider truncate">
                    Live Architecture Specification
                  </h3>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary text-foreground border border-border dark:border-white/10 shrink-0 font-semibold">
                  {selectedDelib?.status || 'ACTIVE'}
                </span>
              </div>

              <div className="flex-1 min-h-0 p-3 space-y-2.5 overflow-y-auto text-xs">
                <div className="space-y-1">
                  <span className="text-[10px] font-mono uppercase font-bold text-foreground">
                    Synthesized Architectural Recommendation
                  </span>
                  <p className="text-xs font-medium text-foreground leading-relaxed whitespace-pre-wrap">
                    {liveSpecText}
                  </p>
                </div>

                {technicalRationale && (
                  <div className="rounded-lg border border-border bg-secondary/20 p-2 space-y-0.5">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                      Technical Rationale &amp; Execution
                    </span>
                    <p className="text-[11px] text-foreground leading-relaxed">{technicalRationale}</p>
                  </div>
                )}

                {selectedDelib?.synthesis_proposal?.consensus_points &&
                  selectedDelib.synthesis_proposal.consensus_points.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono uppercase font-semibold text-muted-foreground">
                        Consensus Anchor Points
                      </span>
                      <ul className="space-y-1 pl-3.5 list-disc text-[11px] text-foreground/90">
                        {selectedDelib.synthesis_proposal.consensus_points.map((pt, idx) => (
                          <li key={idx}>{pt}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                {disagreements.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold uppercase text-amber-500">
                      Recorded Dissent &amp; Trade-offs ({disagreements.length})
                    </span>
                    {disagreements.map((d, i) => (
                      <div key={i} className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 text-xs space-y-0.5">
                        <p className="font-semibold text-foreground text-[11px]">{d.topic}</p>
                        <p className="text-muted-foreground text-[10px]">{d.mitigation}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* PANEL 2 [Middle]: 50/50 Side-by-Side Split: [Tasks & Checklist | Git Working Tree] */}
            <div className="shrink-0 max-h-64 grid grid-cols-2 divide-x divide-border dark:divide-white/10 overflow-hidden bg-secondary/10 dark:bg-white/[0.01]">
              {/* Left Column: Tasks & Interactive Checklist */}
              <div className="flex flex-col min-h-0 h-full overflow-hidden bg-card dark:bg-[#121215]">
                <div className="flex items-center justify-between px-2.5 py-2 border-b border-border dark:border-white/10 bg-secondary/30 dark:bg-white/[0.03] shrink-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <ListTodo className="h-3.5 w-3.5 text-foreground shrink-0" />
                    <h3 className="text-[11px] font-bold text-foreground uppercase tracking-wider truncate">
                      Tasks &amp; Checklist
                    </h3>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-secondary text-foreground border border-border dark:border-white/10 font-bold tabular-nums">
                      {completedCount}/{actionItems.length} Done
                    </span>
                    <button
                      type="button"
                      onClick={() => openDrawer('tasks')}
                      className="text-[9px] font-mono text-muted-foreground hover:text-foreground hover:underline"
                    >
                      Board
                    </button>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-1 bg-secondary shrink-0">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{
                      width: `${actionItems.length > 0 ? (completedCount / actionItems.length) * 100 : 0}%`,
                    }}
                  />
                </div>

                {/* Interactive Checklist list */}
                <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
                  {actionItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground space-y-1">
                      <CheckSquare className="h-4 w-4 opacity-40 text-muted-foreground" />
                      <p className="text-[10px] font-mono">No tasks in queue</p>
                    </div>
                  ) : (
                    actionItems.map((item, idx) => {
                      const isDone = completedTaskMap[item] ?? false;
                      const matchingTask = latestDirectivePlan?.tasks?.find((t) => t.title === item);

                      return (
                        <div
                          key={idx}
                          onClick={() => {
                            setCompletedTaskMap((prev) => ({ ...prev, [item]: !isDone }));
                            if (matchingTask?.id) {
                              toggleTaskMutation.mutate({
                                taskId: matchingTask.id,
                                currentStatus: isDone ? 'DONE' : 'TODO',
                              });
                            }
                          }}
                          className={`flex items-start gap-1.5 p-1.5 rounded border transition-all cursor-pointer text-xs select-none ${
                            isDone
                              ? 'border-border dark:border-white/5 bg-secondary/30 text-muted-foreground'
                              : 'border-border dark:border-white/10 bg-card dark:bg-[#121215] hover:border-primary/40 text-foreground'
                          }`}
                        >
                          <button
                            type="button"
                            aria-label={`Toggle task: ${item}`}
                            className={`h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                              isDone
                                ? 'bg-primary border-primary text-primary-foreground'
                                : 'border-border dark:border-white/10 bg-background'
                            }`}
                          >
                            {isDone && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className={`text-[11px] leading-tight ${isDone ? 'line-through text-muted-foreground' : 'font-medium'}`}>
                              {item}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Sticky Checklist Footer */}
                <div className="p-1.5 border-t border-border dark:border-white/10 bg-card dark:bg-[#121215] shrink-0 flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-foreground shrink-0 animate-pulse" />
                    <span>Autonomous Loop</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => openDrawer('tasks')}
                    className="text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Board ↗
                  </button>
                </div>
              </div>

              {/* Right Column: Git Working Tree */}
              <div className="flex flex-col min-h-0 h-full overflow-hidden bg-card dark:bg-[#121215]">
                <div className="flex items-center justify-between px-2.5 py-2 border-b border-border dark:border-white/10 bg-secondary/30 dark:bg-white/[0.03] shrink-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <GitBranch className="h-3.5 w-3.5 text-foreground shrink-0" />
                    <h3 className="text-[11px] font-bold text-foreground uppercase tracking-wider truncate">
                      Git Working Tree
                    </h3>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-secondary text-foreground border border-border dark:border-white/10 font-bold truncate max-w-[80px]">
                      {gitStatus?.branch || 'main'}
                    </span>
                    <button
                      type="button"
                      onClick={() => openDrawer('git')}
                      className="text-[9px] font-mono text-muted-foreground hover:text-foreground hover:underline"
                    >
                      VCS
                    </button>
                  </div>
                </div>

                {/* Status Chips */}
                <div className="px-2 py-1 flex items-center justify-between text-[9px] font-mono tabular-nums border-b border-border/60 dark:border-white/5 shrink-0 bg-background/50">
                  <span className="text-foreground font-semibold">{gitStatus?.unstaged_files?.length || 0} modified</span>
                  <span className="text-foreground font-semibold">{gitStatus?.staged_files?.length || 0} staged</span>
                  <span className="text-muted-foreground">{gitStatus?.untracked_files?.length || 0} untracked</span>
                </div>

                {/* Changed Files or Recent Commits List */}
                <div className="flex-1 min-h-0 overflow-y-auto p-1.5 space-y-0.5">
                  {!gitStatus ||
                  (gitStatus.unstaged_files.length === 0 &&
                    gitStatus.staged_files.length === 0 &&
                    gitStatus.untracked_files.length === 0) ? (
                    gitCommitLog?.commits && gitCommitLog.commits.length > 0 ? (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between px-1 text-[9px] font-mono text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                            <span>Tree clean · Latest commits</span>
                          </span>
                        </div>
                        {gitCommitLog.commits.slice(0, 3).map((c) => (
                          <div
                            key={c.sha}
                            className="flex items-center justify-between gap-1 text-[9px] font-mono py-0.5 px-1 rounded bg-secondary/20 border border-border/50"
                          >
                            <span className="truncate text-foreground flex-1" title={c.message}>
                              {c.message}
                            </span>
                            <span className="text-[8px] text-muted-foreground shrink-0 tabular-nums">
                              {c.short_sha}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-1.5 py-3 text-center text-muted-foreground">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        <p className="text-[10px] font-mono">Working tree clean</p>
                      </div>
                    )
                  ) : (
                    <>
                      {gitStatus.staged_files.map((f, i) => (
                        <div
                          key={`staged-${i}`}
                          className="flex items-center justify-between gap-1 text-[9px] font-mono py-0.5 px-1 rounded hover:bg-secondary/40"
                        >
                          <span className="truncate text-foreground max-w-[90px]" title={f.path}>
                            {f.path.split('/').pop()}
                          </span>
                          <span className="px-1 rounded bg-secondary text-foreground text-[8px] font-bold border border-border dark:border-white/10">
                            STAGED
                          </span>
                        </div>
                      ))}
                      {gitStatus.unstaged_files.map((f, i) => (
                        <div
                          key={`unstaged-${i}`}
                          className="flex items-center justify-between gap-1 text-[9px] font-mono py-0.5 px-1 rounded hover:bg-secondary/40"
                        >
                          <span className="truncate text-foreground max-w-[90px]" title={f.path}>
                            {f.path.split('/').pop()}
                          </span>
                          <span className="px-1 rounded bg-secondary text-foreground text-[8px] font-bold border border-border dark:border-white/10">
                            MOD
                          </span>
                        </div>
                      ))}
                      {gitStatus.untracked_files.map((p, i) => (
                        <div
                          key={`untracked-${i}`}
                          className="flex items-center justify-between gap-1 text-[9px] font-mono py-0.5 px-1 rounded hover:bg-secondary/40"
                        >
                          <span className="truncate text-muted-foreground max-w-[90px]" title={p}>
                            {p.split('/').pop()}
                          </span>
                          <span className="px-1 rounded bg-secondary text-muted-foreground text-[8px] font-bold border border-border dark:border-white/10">
                            NEW
                          </span>
                        </div>
                      ))}
                    </>
                  )}
                </div>

                {/* Inline Quick Commit Form */}
                <div className="p-1.5 border-t border-border dark:border-white/10 bg-card dark:bg-[#121215] shrink-0 space-y-1">
                  <input
                    type="text"
                    value={rightPanelCommitMsg}
                    onChange={(e) => setRightPanelCommitMsg(e.target.value)}
                    placeholder="Commit message…"
                    className="w-full rounded border border-border dark:border-white/10 bg-background dark:bg-[#18181c] px-2 py-0.5 text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-zinc-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (rightPanelCommitMsg.trim()) {
                        commitMutation.mutate(rightPanelCommitMsg.trim());
                        setRightPanelCommitMsg('');
                      }
                    }}
                    disabled={commitMutation.isPending || !rightPanelCommitMsg.trim()}
                    className="w-full inline-flex items-center justify-center gap-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 py-0.5 text-[10px] font-semibold transition-colors shadow-xs"
                  >
                    {commitMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <FolderGit2 className="h-3 w-3" />
                    )}
                    <span>{commitMutation.isPending ? 'Committing…' : 'Commit Changes'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* PANEL 3 [Bottom]: ADR / Decision Record & Quorum */}
            <div className="shrink-0 flex flex-col overflow-hidden bg-card">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-secondary/30 shrink-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Shield className="h-4 w-4 text-foreground shrink-0" />
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider truncate">
                    Decision Record (ADR)
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={handleCopyAdr}
                  className="inline-flex items-center gap-1 rounded border border-border bg-secondary/40 px-2 py-0.5 text-[10px] font-medium text-foreground hover:bg-secondary"
                >
                  {copiedAdr ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedAdr ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <div className="p-2.5 space-y-2 text-xs">
                <div className="rounded-lg border border-border bg-secondary/20 p-2 space-y-1 font-mono">
                  <div>
                    <span className="text-muted-foreground text-[10px]">STATUS: </span>
                    <span className="text-foreground font-bold text-[10px]">{adrStatus}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[10px]">DECISION: </span>
                    <span className="text-foreground font-sans text-xs">{adrDecision}</span>
                  </div>
                </div>

                {selectedDelib && (
                  <div className="space-y-1.5 pt-1 border-t border-border">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-medium text-muted-foreground">Quorum</span>
                      <div className="flex items-center gap-1">
                        {(['MAJORITY', 'WEIGHTED', 'UNANIMOUS'] as QuorumVotingModel[]).map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setVotingModel(m)}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-mono ${
                              votingModel === m
                                ? 'bg-primary text-primary-foreground font-bold'
                                : 'bg-secondary text-muted-foreground'
                            }`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => quorumMutation.mutate(null)}
                      disabled={quorumMutation.isPending}
                      className="w-full rounded border border-border bg-secondary/50 hover:bg-secondary py-1 text-[11px] font-semibold text-foreground transition-colors"
                    >
                      Evaluate Council Quorum Vote
                    </button>
                    {quorumResult && (
                      <div className="rounded border border-primary/30 bg-primary/5 p-1.5 text-xs flex items-center justify-between">
                        <span className="font-semibold text-foreground text-[10px]">Outcome: {quorumResult.status}</span>
                        <span className="font-mono tabular-nums text-primary text-[10px]">
                          {quorumResult.total_weight > 0
                            ? Math.round((quorumResult.approve_weight / quorumResult.total_weight) * 100)
                            : 0}
                          % approval
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ADR Footer: Autonomous Ratification Telemetry & Manual Override */}
              <div className="p-2 border-t border-border bg-card shrink-0 space-y-1">
                {adrStatus === 'RESOLVED' ? (
                  <div className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 py-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                    <span>ADR Ratified &amp; Committed to Memory</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => ratifyMutation.mutate(selectedDelib?.id || 'default')}
                    disabled={ratifyMutation.isPending}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs"
                  >
                    {ratifyMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <CheckCircle className="h-3 w-3" />
                    )}
                    <span>
                      {ratifyMutation.isPending
                        ? 'Ratifying & Ingesting to Memory…'
                        : quorumResult?.status === 'PASSED'
                        ? 'Auto-Ratifying Spec & ADR…'
                        : 'Ratify Spec & Commit ADR'}
                    </span>
                  </button>
                )}
                <p className="text-[9px] font-mono text-muted-foreground text-center">
                  Autonomous consensus: auto-commits to memory when quorum passes
                </p>
              </div>
            </div>
          </>
        )}
      </aside>
    )}
  </div>

      {/* Modal: Start New Council Deliberation */}
      {showStartDelib && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-foreground">Start Architecture Deliberation</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Topic / Decision Title</label>
                <input
                  type="text"
                  value={delibTitle}
                  onChange={(e) => setDelibTitle(e.target.value)}
                  placeholder="e.g. Event-Driven Billing Microservice Split"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Architectural Problem Statement &amp; Constraints
                </label>
                <textarea
                  rows={4}
                  value={delibProblem}
                  onChange={(e) => setDelibProblem(e.target.value)}
                  placeholder="Describe the engineering trade-offs, performance constraints, or security concerns for the Council to evaluate…"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowStartDelib(false)}
                className="px-3.5 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => startDelibMutation.mutate()}
                disabled={startDelibMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
              >
                {startDelibMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Convene Council</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
