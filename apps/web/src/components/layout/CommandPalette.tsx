'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  Users,
  Bot,
  GitBranch,
  Zap,
  Brain,
  Sparkles,
  Scale,
  Shield,
  Database,
  Settings,
  FolderKanban,
  FlaskConical,
  X,
  ArrowRight,
  Command,
  PlusCircle,
  PauseCircle,
  HelpCircle,
  AlertTriangle,
  Lock,
  Layers,
  Terminal,
  Activity,
  ShieldAlert,
  Code2,
  Globe,
  RotateCw,
  Clock,
  FolderGit2,
  Sun,
  Moon,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { useTheme } from '@/components/ThemeProvider';
import { NEIMAN_CONFIG } from '@neiman/config';
import type { Agent } from '@/lib/api/agents';
import type { Task, ApprovalRequest } from '@/lib/api/controlRoom';

type RBACRole = 'SUPERADMIN' | 'ADMIN' | 'MANAGER' | 'VIEWER';

export interface PaletteCommand {
  id: string;
  title: string;
  category: 'Commands' | 'Navigation' | 'Actions' | 'Inquiries' | 'Simulations';
  description?: string;
  href?: string;
  drawerId?: string;
  entityId?: string;
  icon: React.ComponentType<{ className?: string }>;
  keywords: string[];
  requiredRole?: RBACRole;
  actionType?: 'NAVIGATE' | 'DRAWER_ACTION' | 'SYSTEM_SETUP';
  badge?: string;
}

const ROLE_HIERARCHY: Record<RBACRole, number> = {
  VIEWER: 1,
  MANAGER: 2,
  ADMIN: 3,
  SUPERADMIN: 4,
};

const HISTORY_KEY = NEIMAN_CONFIG.STORAGE_KEYS.COMMAND_HISTORY;
const MAX_HISTORY = NEIMAN_CONFIG.OPERATIONAL_LIMITS.MAX_COMMAND_HISTORY;

function loadHistory(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveHistory(query: string) {
  if (typeof window === 'undefined' || !query.trim()) return;
  try {
    const h = loadHistory().filter((s) => s !== query).slice(0, MAX_HISTORY - 1);
    localStorage.setItem(HISTORY_KEY, JSON.stringify([query, ...h]));
  } catch {
    // ignore
  }
}

export const GLOBAL_COMMANDS: PaletteCommand[] = [
  {
    id: 'cmd-toggle-theme',
    title: 'Toggle Visual Theme (Light / Dark Mode)',
    category: 'Commands',
    description: 'Switch between Light Alabaster Canvas and Dark Obsidian Cyber-Glow',
    icon: Moon,
    keywords: ['theme', 'dark mode', 'light mode', 'appearance', 'toggle theme', 'color', 'obsidian'],
    requiredRole: 'VIEWER',
    actionType: 'DRAWER_ACTION',
    badge: 'Theme',
  },
  {
    id: 'cmd-set-dark-theme',
    title: 'Switch to Dark Mode (Obsidian Cyber-Glow)',
    category: 'Commands',
    description: 'Activate deep obsidian background with luminous telemetry accents',
    icon: Moon,
    keywords: ['dark', 'dark mode', 'night', 'obsidian', 'black', 'theme'],
    requiredRole: 'VIEWER',
    actionType: 'DRAWER_ACTION',
    badge: 'Dark',
  },
  {
    id: 'cmd-set-light-theme',
    title: 'Switch to Light Mode (Clean Alabaster)',
    category: 'Commands',
    description: 'Activate clean alabaster and slate canvas (Official default)',
    icon: Sun,
    keywords: ['light', 'light mode', 'day', 'white', 'alabaster', 'theme'],
    requiredRole: 'VIEWER',
    actionType: 'DRAWER_ACTION',
    badge: 'Light',
  },
  {
    id: 'cmd-toggle-terminal',
    title: 'Toggle Integrated Bash Terminal',
    category: 'Commands',
    description: 'Open or collapse the bottom integrated PTY terminal drawer',
    icon: Terminal,
    keywords: ['terminal', 'bash', 'pty', 'shell', 'cli', 'console', 'integrated terminal', 'cmd'],
    requiredRole: 'VIEWER',
    actionType: 'DRAWER_ACTION',
    badge: 'Ctrl+`',
  },
  {
    id: 'cmd-tasks-checklist',
    title: 'Tasks & Checklist Delivery Deck',
    category: 'Commands',
    description: 'Jump to active tasks with subtask checklist progress tracking',
    href: `${NEIMAN_CONFIG.ROUTES.DASHBOARD.TASKS}?view=checklist`,
    drawerId: 'tasks',
    icon: FolderKanban,
    keywords: ['tasks', 'checklist', 'subtasks', 'deliverables', 'steps', 'progress', 'todo'],
    requiredRole: 'VIEWER',
    actionType: 'NAVIGATE',
    badge: 'Tasks',
  },
  {
    id: 'cmd-neiman-setup',
    title: 'neiman-setup: Reset & Launch Setup Wizard',
    category: 'Commands',
    description: 'Open the NEIMAN OS Setup & Blueprint Instantiation Wizard',
    href: `${NEIMAN_CONFIG.ROUTES.DASHBOARD.HOME}?setup=true`,
    icon: RotateCw,
    keywords: ['neiman-setup', 'setup', 'reset', 'first time setup', 'wizard', 'clean db', 'restart'],
    requiredRole: 'ADMIN',
    actionType: 'SYSTEM_SETUP',
    badge: 'Protocol',
  },
  {
    id: 'cmd-search-agents',
    title: 'Search agents',
    category: 'Commands',
    description: 'Find, filter, and inspect autonomous workforce agents',
    href: NEIMAN_CONFIG.ROUTES.DASHBOARD.AGENTS,
    drawerId: 'agents',
    icon: Bot,
    keywords: ['search agents', 'find agent', 'workforce', 'bot', 'specialist'],
    requiredRole: 'VIEWER',
    actionType: 'NAVIGATE',
    badge: 'Alt+1',
  },
  {
    id: 'cmd-open-project',
    title: 'Open project',
    category: 'Commands',
    description: 'Jump to active initiatives, milestones, and roadmaps',
    href: NEIMAN_CONFIG.ROUTES.DASHBOARD.PROJECTS,
    drawerId: 'projects',
    icon: FolderKanban,
    keywords: ['open project', 'projects', 'initiatives', 'roadmap'],
    requiredRole: 'VIEWER',
    actionType: 'NAVIGATE',
    badge: 'Alt+4',
  },
  {
    id: 'cmd-blueprints-catalog',
    title: 'Browse Company Blueprints & Templates',
    category: 'Commands',
    description: 'Explore organizational blueprints and instantiate ready-to-use companies',
    href: NEIMAN_CONFIG.ROUTES.DASHBOARD.BLUEPRINTS,
    drawerId: 'blueprints',
    icon: Layers,
    keywords: ['blueprints', 'company templates', 'catalog', 'software company', 'instantiate company'],
    requiredRole: 'VIEWER',
    actionType: 'NAVIGATE',
    badge: 'Catalog',
  },
  {
    id: 'cmd-build-my-company',
    title: 'Build My Company: AI Organization Generator',
    category: 'Commands',
    description: 'Generate a complete autonomous organization with custom departments, agents, and workflows',
    href: `${NEIMAN_CONFIG.ROUTES.DASHBOARD.BLUEPRINTS}?tab=build-my-company`,
    icon: Sparkles,
    keywords: ['build my company', 'generate company', 'ai company synthesis', 'proposal', 'custom organization'],
    requiredRole: 'MANAGER',
    actionType: 'NAVIGATE',
    badge: 'AI Gen',
  },
  {
    id: 'cmd-create-task',
    title: 'Create task',
    category: 'Commands',
    description: 'Draft and queue a new autonomous task for agent execution',
    href: `${NEIMAN_CONFIG.ROUTES.DASHBOARD.TASKS}?action=new`,
    drawerId: 'tasks',
    icon: PlusCircle,
    keywords: ['create task', 'new task', 'assign task', 'todo', 'issue'],
    requiredRole: 'MANAGER',
    actionType: 'NAVIGATE',
    badge: 'Alt+5',
  },
  {
    id: 'cmd-pause-agent',
    title: 'Filter active working agents',
    category: 'Commands',
    description: 'Inspect active reasoning agents in the Workforce Matrix',
    href: `${NEIMAN_CONFIG.ROUTES.DASHBOARD.AGENTS}?filter=active`,
    drawerId: 'agents',
    icon: PauseCircle,
    keywords: ['pause agent', 'stop agent', 'active agents', 'working agents'],
    requiredRole: 'MANAGER',
    actionType: 'NAVIGATE',
    badge: 'Control',
  },
  {
    id: 'cmd-view-approvals',
    title: 'View approvals',
    category: 'Commands',
    description: 'Inspect human-in-the-loop approval gate and pending escalations',
    href: NEIMAN_CONFIG.ROUTES.DASHBOARD.APPROVALS,
    drawerId: 'approvals',
    icon: Shield,
    keywords: ['view approvals', 'pending approvals', 'human in the loop', 'review gate', 'sign off'],
    requiredRole: 'MANAGER',
    actionType: 'NAVIGATE',
    badge: 'Alt+6',
  },
  {
    id: 'cmd-inspect-resources',
    title: 'Inspect resources',
    category: 'Commands',
    description: 'Examine CPU, RAM, GPU, tokens, API calls, and FinOps budgets',
    href: NEIMAN_CONFIG.ROUTES.DASHBOARD.RESOURCES,
    drawerId: 'resources',
    icon: Database,
    keywords: ['inspect resources', 'resource command center', 'telemetry', 'gpu', 'tokens', 'budget'],
    requiredRole: 'VIEWER',
    actionType: 'NAVIGATE',
    badge: 'Telemetry',
  },
  {
    id: 'cmd-open-workflow',
    title: 'Open workflow',
    category: 'Commands',
    description: 'Inspect DAG workflow execution pipelines and dependency trees',
    href: NEIMAN_CONFIG.ROUTES.DASHBOARD.WORKFLOWS,
    drawerId: 'workflows',
    icon: GitBranch,
    keywords: ['open workflow', 'workflows', 'dag', 'pipeline', 'execution graph'],
    requiredRole: 'VIEWER',
    actionType: 'NAVIGATE',
    badge: 'Alt+3',
  },
  {
    id: 'cmd-search-memory',
    title: 'Search memory',
    category: 'Commands',
    description: 'Query company vector memory, ADR decisions, and provenance traces',
    href: NEIMAN_CONFIG.ROUTES.DASHBOARD.MEMORY,
    drawerId: 'memory',
    icon: Brain,
    keywords: ['search memory', 'query knowledge', 'organizational memory', 'provenance', 'adrs'],
    requiredRole: 'VIEWER',
    actionType: 'NAVIGATE',
    badge: 'Search',
  },
  {
    id: 'cmd-codebase-graph',
    title: 'Codebase knowledge graph',
    category: 'Commands',
    description: 'Instant AST symbol navigation, call graph, and zero-grep dependency lookup',
    href: `${NEIMAN_CONFIG.ROUTES.DASHBOARD.MEMORY}?tab=code_graph`,
    icon: Code2,
    keywords: ['code graph', 'ast', 'symbols', 'grep', 'pre-index', 'dependencies', 'callers'],
    requiredRole: 'VIEWER',
    actionType: 'NAVIGATE',
    badge: 'AST',
  },
  {
    id: 'cmd-run-simulation',
    title: 'Run simulation',
    category: 'Commands',
    description: 'Trigger synthetic workload stress trial in Simulation Lab',
    href: NEIMAN_CONFIG.ROUTES.DASHBOARD.SIMULATION,
    drawerId: 'simulation',
    icon: FlaskConical,
    keywords: ['run simulation', 'monte carlo', 'simulation lab', 'stress test', 'benchmark'],
    requiredRole: 'MANAGER',
    actionType: 'NAVIGATE',
    badge: 'Lab',
  },
  {
    id: 'cmd-create-decision',
    title: 'Create decision',
    category: 'Commands',
    description: 'Record architectural decision record (ADR) into company ledger',
    href: `${NEIMAN_CONFIG.ROUTES.DASHBOARD.DECISIONS}?action=new`,
    drawerId: 'decisions',
    icon: Scale,
    keywords: ['create decision', 'new adr', 'record decision', 'ledger', 'consensus'],
    requiredRole: 'MANAGER',
    actionType: 'NAVIGATE',
    badge: 'Action',
  },
  {
    id: 'cmd-ask-organization',
    title: 'Ask organization',
    category: 'Commands',
    description: 'Query synthesized organizational knowledge and agent intelligence',
    href: `${NEIMAN_CONFIG.ROUTES.DASHBOARD.MEMORY}?tab=ask`,
    icon: HelpCircle,
    keywords: ['ask organization', 'query neiman', 'semantic inquiry', 'ask company'],
    requiredRole: 'VIEWER',
    actionType: 'NAVIGATE',
    badge: 'AI',
  },
  {
    id: 'cmd-open-settings',
    title: 'Open settings',
    category: 'Commands',
    description: 'Configure workspace identity, AI providers, RBAC, and credentials',
    href: NEIMAN_CONFIG.ROUTES.DASHBOARD.SETTINGS,
    drawerId: 'settings',
    icon: Settings,
    keywords: ['open settings', 'admin', 'configuration', 'api keys', 'rbac', 'security'],
    requiredRole: 'VIEWER',
    actionType: 'NAVIGATE',
    badge: 'Admin',
  },
  {
    id: 'cmd-show-blocked-tasks',
    title: 'Show blocked tasks',
    category: 'Commands',
    description: 'Inspect all execution bottlenecks and stalled autonomous agent sub-tasks',
    href: `${NEIMAN_CONFIG.ROUTES.DASHBOARD.TASKS}?filter=blocked`,
    icon: AlertTriangle,
    keywords: ['show blocked tasks', 'blocked tasks', 'stalled tasks', 'failures', 'blockers'],
    requiredRole: 'VIEWER',
    actionType: 'NAVIGATE',
    badge: 'Query',
  },
  {
    id: 'cmd-show-resource-dept',
    title: 'Show resource consumption by department',
    category: 'Inquiries',
    description: 'Examine CGroup allocation, token velocity, and FinOps breakdown per department',
    href: `${NEIMAN_CONFIG.ROUTES.DASHBOARD.RESOURCES}?tab=departments`,
    icon: Database,
    keywords: ['show resource consumption by department', 'resource consumption', 'department resources', 'department spend'],
    requiredRole: 'VIEWER',
    actionType: 'NAVIGATE',
    badge: 'FinOps',
  },
  {
    id: 'cmd-review-evolution-proposals',
    title: 'Review pending evolution proposals',
    category: 'Commands',
    description: 'Inspect autonomous self-optimization proposals synthesized by Evolution Engine',
    href: `${NEIMAN_CONFIG.ROUTES.DASHBOARD.EVOLUTION}?tab=proposals`,
    drawerId: 'evolution',
    icon: Sparkles,
    keywords: ['review pending evolution proposals', 'evolution proposals', 'pending evolution', 'adaptations', 'evolution'],
    requiredRole: 'VIEWER',
    actionType: 'NAVIGATE',
    badge: 'Evolution',
  },
  {
    id: 'nav-control-room',
    title: 'Control Room',
    category: 'Navigation',
    description: 'Core organizational operating status and workforce metrics',
    href: NEIMAN_CONFIG.ROUTES.DASHBOARD.HOME,
    icon: LayoutDashboard,
    keywords: ['control room', 'overview', 'metrics', 'home', 'control room overview'],
    requiredRole: 'VIEWER',
    actionType: 'NAVIGATE',
    badge: 'Key 0',
  },
  {
    id: 'nav-departments',
    title: 'Departments',
    category: 'Navigation',
    description: 'Autonomous departmental units, rosters, and budgets',
    href: NEIMAN_CONFIG.ROUTES.DASHBOARD.DEPARTMENTS,
    icon: Building2,
    keywords: ['departments', 'org units', 'divisions', 'teams'],
    requiredRole: 'VIEWER',
    actionType: 'NAVIGATE',
  },
  {
    id: 'nav-simulation-lab',
    title: 'Simulation Lab',
    category: 'Navigation',
    description: 'Monte Carlo stress trials, synthetic workloads, and counterfactual testing',
    href: NEIMAN_CONFIG.ROUTES.DASHBOARD.SIMULATION,
    drawerId: 'simulation',
    icon: FlaskConical,
    keywords: ['simulation lab', 'simulations', 'stress test', 'scenario', 'trials'],
    requiredRole: 'VIEWER',
    actionType: 'NAVIGATE',
  },
  {
    id: 'nav-councils',
    title: 'Agent Councils Deliberation',
    category: 'Navigation',
    description: 'Visual multi-agent debate mesh and consensus synthesis',
    href: NEIMAN_CONFIG.ROUTES.DASHBOARD.COUNCILS,
    drawerId: 'councils',
    icon: Users,
    keywords: ['councils', 'architecture council', 'deliberation', 'debate'],
    requiredRole: 'VIEWER',
    actionType: 'NAVIGATE',
    badge: 'Alt+2',
  },
  {
    id: 'nav-evolution',
    title: 'Evolution Center',
    category: 'Navigation',
    description: 'Organizational self-improvement proposals, validations, and rollbacks',
    href: NEIMAN_CONFIG.ROUTES.DASHBOARD.EVOLUTION,
    drawerId: 'evolution',
    icon: Sparkles,
    keywords: ['evolution center', 'self improvement', 'proposals', 'diagnoses', 'lessons'],
    requiredRole: 'VIEWER',
    actionType: 'NAVIGATE',
  },
  {
    id: 'nav-intelligence',
    title: 'Router & Model Hub',
    category: 'Navigation',
    description: 'Smart provider routing, fallback policies, token economics, and LLM telemetry',
    href: NEIMAN_CONFIG.ROUTES.DASHBOARD.INTELLIGENCE,
    drawerId: 'intelligence',
    icon: Zap,
    keywords: ['intelligence', 'models', 'router', 'providers', 'llm', 'gateway'],
    requiredRole: 'VIEWER',
    actionType: 'NAVIGATE',
  },
  {
    id: 'nav-harvester',
    title: 'Open Web Harvester',
    category: 'Navigation',
    description: 'Platform intelligence gathering from GitHub, Reddit, Hacker News, Wikipedia, and web',
    href: NEIMAN_CONFIG.ROUTES.DASHBOARD.HARVESTER,
    icon: Globe,
    keywords: ['open web harvester', 'harvester', 'web scraping', 'gather data', 'github', 'reddit', 'wikipedia'],
    requiredRole: 'VIEWER',
    actionType: 'NAVIGATE',
    badge: 'Tools',
  },
  {
    id: 'nav-git',
    title: 'Git Code Management',
    category: 'Navigation',
    description: 'Branch isolation, atomic staging, unified diff inspection, and DAG commit tracking',
    href: '/dashboard/git',
    icon: FolderGit2,
    keywords: ['git', 'code', 'vcs', 'branches', 'diff', 'commits', 'staging', 'stashes'],
    requiredRole: 'VIEWER',
    actionType: 'NAVIGATE',
    badge: 'Code',
  },
];

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onTriggerSetup?: () => void;
  onOpenDrawer?: (drawerId: string, entityId?: string) => void;
  agents?: Agent[];
  tasks?: Task[];
  approvals?: ApprovalRequest[];
}

export function CommandPalette({
  isOpen,
  onClose,
  onTriggerSetup,
  onOpenDrawer,
  agents = [],
  tasks = [],
  approvals = [],
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeFeedback, setActiveFeedback] = useState<string | null>(null);
  const { setTheme, toggleTheme } = useTheme();
  const router = useRouter();
  const history = useMemo(loadHistory, [isOpen]);

  const { user } = useAuthStore();
  const userRole: RBACRole = user?.is_superuser ? 'SUPERADMIN' : 'ADMIN';

  useEffect(() => {
    setQuery('');
    setSelectedIndex(0);
    setActiveFeedback(null);
  }, [isOpen]);

  const isPermitted = useCallback(
    (cmd: PaletteCommand) => {
      if (!cmd.requiredRole) return true;
      return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[cmd.requiredRole];
    },
    [userRole]
  );

  // Merge live dynamic entities (agents, tasks, pending approvals) with global commands
  const dynamicCommands: PaletteCommand[] = useMemo(() => {
    const dynamicList: PaletteCommand[] = [];

    agents.forEach((ag) => {
      dynamicList.push({
        id: `live-agent-${ag.id}`,
        title: `Inspect Agent: ${ag.name}`,
        category: 'Navigation',
        description: `Status: ${ag.status} · Autonomy: ${ag.autonomy}`,
        href: `${NEIMAN_CONFIG.ROUTES.DASHBOARD.AGENTS}?agent=${ag.id}`,
        drawerId: 'agents',
        entityId: ag.id,
        icon: Bot,
        keywords: [ag.name.toLowerCase(), ag.status.toLowerCase(), 'agent', 'inspect'],
        requiredRole: 'VIEWER',
        actionType: 'DRAWER_ACTION',
        badge: ag.status,
      });
    });

    tasks.forEach((t) => {
      dynamicList.push({
        id: `live-task-${t.id}`,
        title: `Task: ${t.title}`,
        category: 'Navigation',
        description: `Status: ${t.status} · Priority: ${t.priority}`,
        href: `${NEIMAN_CONFIG.ROUTES.DASHBOARD.TASKS}?task=${t.id}`,
        drawerId: 'tasks',
        entityId: t.id,
        icon: Activity,
        keywords: [t.title.toLowerCase(), t.status.toLowerCase(), 'task'],
        requiredRole: 'VIEWER',
        actionType: 'DRAWER_ACTION',
        badge: t.status,
      });
    });

    approvals
      .filter((a) => a.status === 'PENDING')
      .forEach((ap) => {
        const actionType = ap.action_type || ap.action || ap.title || 'AUTONOMOUS_ACTION';
        const reason = ap.reason || 'Requires executive review';
        dynamicList.push({
          id: `live-approval-${ap.id}`,
          title: `Approval Gate: ${actionType.replace(/_/g, ' ')}`,
          category: 'Actions',
          description: `${reason} (${ap.risk_level})`,
          href: NEIMAN_CONFIG.ROUTES.DASHBOARD.APPROVALS,
          drawerId: 'approvals',
          entityId: ap.id,
          icon: ShieldAlert,
          keywords: [actionType.toLowerCase(), reason.toLowerCase(), 'approval', 'pending'],
          requiredRole: 'MANAGER',
          actionType: 'DRAWER_ACTION',
          badge: ap.risk_level,
        });
      });

    return dynamicList;
  }, [agents, tasks, approvals]);

  const filtered = useMemo(() => {
    const allCommands = [...GLOBAL_COMMANDS, ...dynamicCommands];
    if (!query.trim()) return GLOBAL_COMMANDS;
    const q = query.toLowerCase().replace(/^>\s*/, '').trim();

    return allCommands.filter((cmd) => {
      const titleMatch = cmd.title.toLowerCase().includes(q);
      const categoryMatch = cmd.category.toLowerCase().includes(q);
      const descMatch = cmd.description?.toLowerCase().includes(q);
      const keywordMatch = cmd.keywords.some((kw) => kw.toLowerCase().includes(q));
      return titleMatch || categoryMatch || descMatch || keywordMatch;
    });
  }, [query, dynamicCommands]);

  const handleSelect = useCallback(
    (item: PaletteCommand) => {
      if (!isPermitted(item)) {
        setActiveFeedback(`Permission Denied: Command requires ${item.requiredRole} role.`);
        setTimeout(() => setActiveFeedback(null), 3000);
        return;
      }

      saveHistory(query || item.title);

      if (item.id === 'cmd-toggle-theme') {
        onClose();
        toggleTheme();
        return;
      }

      if (item.id === 'cmd-set-dark-theme') {
        onClose();
        setTheme('dark');
        return;
      }

      if (item.id === 'cmd-set-light-theme') {
        onClose();
        setTheme('light');
        return;
      }

      if (item.id === 'cmd-toggle-terminal') {
        onClose();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('neiman:toggle-terminal'));
        }
        return;
      }

      if (item.id === 'cmd-neiman-setup' || item.actionType === 'SYSTEM_SETUP') {
        onClose();
        if (onTriggerSetup) {
          onTriggerSetup();
        } else if (item.href) {
          router.push(item.href);
        }
        return;
      }

      if (item.actionType === 'DRAWER_ACTION' && item.drawerId && onOpenDrawer) {
        onClose();
        onOpenDrawer(item.drawerId, item.entityId);
        return;
      }

      onClose();
      if (item.href) {
        router.push(item.href);
      }
    },
    [isPermitted, onClose, onOpenDrawer, onTriggerSetup, query, router, setTheme, toggleTheme]
  );

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1 < filtered.length ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : filtered.length - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          handleSelect(filtered[selectedIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filtered, selectedIndex, onClose, handleSelect]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 bg-background/75 backdrop-blur-md p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="NEIMAN Global Command Palette"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl border border-border bg-card shadow-2xl overflow-hidden ring-1 ring-border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 border-b border-border/80 px-4 py-3.5 bg-secondary/30">
          <Command className="h-5 w-5 text-primary shrink-0" aria-hidden="true" />
          <input
            type="text"
            className="w-full bg-transparent text-sm font-mono text-foreground placeholder:text-muted-foreground/60 outline-none"
            placeholder="Type a command or query... (e.g. 'Search agents', 'Simulation', 'View approvals')"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
              setActiveFeedback(null);
            }}
            autoFocus
          />
          {query && (
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setQuery('')}
              aria-label="Clear query"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <span className="hidden sm:inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-[10px] font-mono text-muted-foreground border border-border/60">
            ESC
          </span>
        </div>

        {/* Recent History Chips */}
        {!query && history.length > 0 && (
          <div className="px-4 py-2 flex items-center gap-2 border-b border-border/60 bg-secondary/15 overflow-x-auto">
            <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
            {history.slice(0, 5).map((h, i) => (
              <button
                key={`${h}-${i}`}
                type="button"
                onClick={() => setQuery(h)}
                className="shrink-0 px-2 py-0.5 rounded border border-border/60 bg-background text-[10px] text-muted-foreground hover:text-foreground font-mono whitespace-nowrap"
              >
                {h}
              </button>
            ))}
          </div>
        )}

        {/* Feedback / Permission Notice Banner */}
        {activeFeedback && (
          <div className="p-3 bg-primary/10 border-b border-primary/20 text-xs font-mono text-primary flex items-center gap-2 animate-fade-in">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{activeFeedback}</span>
          </div>
        )}

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-xs font-mono text-muted-foreground space-y-2">
              <Terminal className="h-8 w-8 mx-auto opacity-40 text-primary" />
              <p>No matching commands found for &quot;{query}&quot;</p>
              <p className="text-[11px] text-muted-foreground/70">
                Try queries like: <span className="text-primary">Search agents</span>,{' '}
                <span className="text-primary">Show blocked tasks</span>, or{' '}
                <span className="text-primary">Search memory</span>
              </p>
            </div>
          ) : (
            filtered.map((cmd, idx) => {
              const active = idx === selectedIndex;
              const Icon = cmd.icon;
              const permitted = isPermitted(cmd);

              return (
                <button
                  key={cmd.id}
                  type="button"
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-xs transition-colors ${
                    active
                      ? 'bg-primary/10 text-primary border border-primary/30 shadow-xs'
                      : 'text-foreground/90 hover:bg-secondary/60 hover:text-foreground border border-transparent'
                  } ${!permitted ? 'opacity-50' : ''}`}
                  onClick={() => handleSelect(cmd)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-md shrink-0 ${
                        active ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'
                      }`}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold truncate text-foreground font-mono">
                          {cmd.title}
                        </span>
                        {cmd.badge && (
                          <span className="badge badge-default text-[9px] px-1.5 py-0 h-4 font-mono uppercase tabular-nums">
                            {cmd.badge}
                          </span>
                        )}
                      </div>
                      {cmd.description && (
                        <p className="text-[11px] font-sans text-muted-foreground truncate mt-0.5">
                          {cmd.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right Action Indicator & RBAC Lock */}
                  <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground shrink-0">
                    {!permitted ? (
                      <span className="flex items-center gap-1 text-destructive">
                        <Lock className="h-3 w-3" />
                        <span>Requires {cmd.requiredRole}</span>
                      </span>
                    ) : (
                      <div className="flex items-center gap-1 text-muted-foreground/80">
                        <span>Execute</span>
                        <ArrowRight className="h-3 w-3" />
                      </div>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer shortcuts & Role Indicator */}
        <div className="flex items-center justify-between border-t border-border/80 bg-secondary/20 px-4 py-2 text-[10px] font-mono text-muted-foreground">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Execute</span>
            <span>ESC Close</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">ROLE: {userRole}</span>
            <span className="text-primary flex items-center gap-1">
              <Command className="h-3 w-3" />
              <span>NEIMAN Command Layer</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
