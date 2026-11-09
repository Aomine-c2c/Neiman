'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import { CockpitDrawer } from '@/components/layout/CockpitDrawer';

// Dynamic lazy imports for each domain drawer content to maintain lightning-fast initial load
const AgentsPage = dynamic(() => import('@/app/dashboard/agents/page'), {
  loading: () => <DrawerLoadingState label="AI Workforce Matrix" />,
  ssr: false,
});
const CouncilsPage = dynamic(() => import('@/app/dashboard/councils/page'), {
  loading: () => <DrawerLoadingState label="Agent Councils" />,
  ssr: false,
});
const WorkflowsPage = dynamic(() => import('@/app/dashboard/workflows/page'), {
  loading: () => <DrawerLoadingState label="Autonomous Workflows" />,
  ssr: false,
});
const ProjectsPage = dynamic(() => import('@/app/dashboard/projects/page'), {
  loading: () => <DrawerLoadingState label="Strategic Projects" />,
  ssr: false,
});
const TasksPage = dynamic(() => import('@/app/dashboard/tasks/page'), {
  loading: () => <DrawerLoadingState label="Tasks Execution Matrix" />,
  ssr: false,
});
const ApprovalsPage = dynamic(() => import('@/app/dashboard/approvals/page'), {
  loading: () => <DrawerLoadingState label="Governance Approvals Gate" />,
  ssr: false,
});
const IntelligencePage = dynamic(() => import('@/app/dashboard/intelligence/page'), {
  loading: () => <DrawerLoadingState label="Router & Model Hub" />,
  ssr: false,
});
const MemoryPage = dynamic(() => import('@/app/dashboard/memory/page'), {
  loading: () => <DrawerLoadingState label="Organizational Memory" />,
  ssr: false,
});
const SimulationPage = dynamic(() => import('@/app/dashboard/simulation/page'), {
  loading: () => <DrawerLoadingState label="Simulation Lab" />,
  ssr: false,
});
const EvolutionPage = dynamic(() => import('@/app/dashboard/evolution/page'), {
  loading: () => <DrawerLoadingState label="Evolution Center" />,
  ssr: false,
});
const GovernancePage = dynamic(() => import('@/app/dashboard/governance/page'), {
  loading: () => <DrawerLoadingState label="Constitution & Rules" />,
  ssr: false,
});
const DecisionsPage = dynamic(() => import('@/app/dashboard/decisions/page'), {
  loading: () => <DrawerLoadingState label="Decisions Ledger" />,
  ssr: false,
});
const ResourcesPage = dynamic(() => import('@/app/dashboard/resources/page'), {
  loading: () => <DrawerLoadingState label="Resource Allocation" />,
  ssr: false,
});
const ActivityPage = dynamic(() => import('@/app/dashboard/activity/page'), {
  loading: () => <DrawerLoadingState label="Activity Stream" />,
  ssr: false,
});
const OrganizationsPage = dynamic(() => import('@/app/dashboard/organizations/page'), {
  loading: () => <DrawerLoadingState label="Organizations" />,
  ssr: false,
});
const BlueprintsPage = dynamic(() => import('@/app/dashboard/blueprints/page'), {
  loading: () => <DrawerLoadingState label="Blueprints Studio" />,
  ssr: false,
});
const OrganizationMapPage = dynamic(() => import('@/app/dashboard/organization/page'), {
  loading: () => <DrawerLoadingState label="Org Topology Map" />,
  ssr: false,
});
const SettingsPage = dynamic(() => import('@/app/dashboard/settings/page'), {
  loading: () => <DrawerLoadingState label="Administration & Settings" />,
  ssr: false,
});
const RuntimePage = dynamic(() => import('@/app/dashboard/runtime/page'), {
  loading: () => <DrawerLoadingState label="Execution Runtime" />,
  ssr: false,
});
const McpPage = dynamic(() => import('@/app/dashboard/mcp/page'), {
  loading: () => <DrawerLoadingState label="Skills, MCP & Plugins Hub" />,
  ssr: false,
});

function DrawerLoadingState({ label }: { label: string }) {
  return (
    <div className="flex h-96 w-full flex-col items-center justify-center gap-3 font-mono text-xs text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      <span className="uppercase tracking-widest">INITIALIZING // {label}...</span>
    </div>
  );
}

interface DrawerDomainConfig {
  title: string;
  subtitle: string;
  tag: string;
  tagColor: string;
  fullPageHref: string;
  widthClass: string;
  component: React.ComponentType;
}

const DRAWER_REGISTRY: Record<string, DrawerDomainConfig> = {
  // Operational Topbar
  agents: {
    title: 'AI Workforce Matrix',
    subtitle: 'Manage autonomous agents, skills, autonomy tiers, and execution state',
    tag: 'WORKFORCE',
    tagColor: 'text-primary',
    fullPageHref: '/dashboard/agents',
    widthClass: 'max-w-5xl',
    component: AgentsPage,
  },
  councils: {
    title: 'Agent Councils',
    subtitle: 'Multi-agent consensus, quorum policies, and deliberative voting assemblies',
    tag: 'COUNCILS',
    tagColor: 'text-blue-400',
    fullPageHref: '/dashboard/councils',
    widthClass: 'max-w-4xl',
    component: CouncilsPage,
  },
  workflows: {
    title: 'Autonomous Workflows',
    subtitle: 'Visual execution DAGs, steps, triggers, and automated organizational routines',
    tag: 'WORKFLOWS',
    tagColor: 'text-emerald-400',
    fullPageHref: '/dashboard/workflows',
    widthClass: 'max-w-5xl',
    component: WorkflowsPage,
  },
  projects: {
    title: 'Strategic Projects',
    subtitle: 'High-level strategic initiatives, milestone tracking, and deliverables',
    tag: 'PROJECTS',
    tagColor: 'text-amber-400',
    fullPageHref: '/dashboard/projects',
    widthClass: 'max-w-4xl',
    component: ProjectsPage,
  },
  tasks: {
    title: 'Tasks Execution Matrix',
    subtitle: 'Granular work orders, real-time assignment, dependencies, and proofs of work',
    tag: 'TASKS',
    tagColor: 'text-cyan-400',
    fullPageHref: '/dashboard/tasks',
    widthClass: 'max-w-4xl',
    component: TasksPage,
  },
  approvals: {
    title: 'Governance Approvals Gate',
    subtitle: 'CEO sign-offs, financial expenditure gates, and mission-critical decisions',
    tag: 'APPROVALS',
    tagColor: 'text-primary',
    fullPageHref: '/dashboard/approvals',
    widthClass: 'max-w-3xl',
    component: ApprovalsPage,
  },

  // Intelligence Engines
  intelligence: {
    title: 'Router & Model Engines',
    subtitle: 'Smart provider routing, fallback policies, token economics, and LLM telemetry',
    tag: 'INTEL',
    tagColor: 'text-cyan-400',
    fullPageHref: '/dashboard/intelligence',
    widthClass: 'max-w-4xl',
    component: IntelligencePage,
  },
  memory: {
    title: 'Organizational Memory',
    subtitle: 'Vector semantic store, shared knowledge graph, recall benchmarks, and document index',
    tag: 'INTEL',
    tagColor: 'text-cyan-400',
    fullPageHref: '/dashboard/memory',
    widthClass: 'max-w-4xl',
    component: MemoryPage,
  },
  simulation: {
    title: 'Simulation Lab',
    subtitle: 'Monte Carlo organizational scenarios, stress testing, and counterfactuals',
    tag: 'INTEL',
    tagColor: 'text-cyan-400',
    fullPageHref: '/dashboard/simulation',
    widthClass: 'max-w-5xl',
    component: SimulationPage,
  },
  evolution: {
    title: 'Evolution Center',
    subtitle: 'Adaptive genetic mutation, autonomous organizational restructuring, and fitness',
    tag: 'INTEL',
    tagColor: 'text-cyan-400',
    fullPageHref: '/dashboard/evolution',
    widthClass: 'max-w-4xl',
    component: EvolutionPage,
  },

  // Governance & Ledger
  governance: {
    title: 'Constitution & Rules',
    subtitle: 'Immutable operational constraints, compliance policies, and ethical boundaries',
    tag: 'GOV',
    tagColor: 'text-amber-400',
    fullPageHref: '/dashboard/governance',
    widthClass: 'max-w-4xl',
    component: GovernancePage,
  },
  decisions: {
    title: 'Decisions Ledger',
    subtitle: 'Cryptographic immutable log of executive votes, rationale, and authority chain',
    tag: 'GOV',
    tagColor: 'text-amber-400',
    fullPageHref: '/dashboard/decisions',
    widthClass: 'max-w-4xl',
    component: DecisionsPage,
  },
  resources: {
    title: 'Resource Allocation',
    subtitle: 'Budgets, token pools, compute isolation, and infrastructure telemetry',
    tag: 'GOV',
    tagColor: 'text-amber-400',
    fullPageHref: '/dashboard/resources',
    widthClass: 'max-w-4xl',
    component: ResourcesPage,
  },
  activity: {
    title: 'Activity Stream',
    subtitle: 'Live real-time event feed, agent tool invocations, and system audit logs',
    tag: 'GOV',
    tagColor: 'text-amber-400',
    fullPageHref: '/dashboard/activity',
    widthClass: 'max-w-4xl',
    component: ActivityPage,
  },

  // Topology & Administration
  organizations: {
    title: 'Organizations & Tenants',
    subtitle: 'Multi-tenant boundaries, company switcher, and corporate metadata',
    tag: 'TOPO',
    tagColor: 'text-purple-400',
    fullPageHref: '/dashboard/organizations',
    widthClass: 'max-w-3xl',
    component: OrganizationsPage,
  },
  blueprints: {
    title: 'Blueprints Studio',
    subtitle: 'Reusable organizational templates, predefined workforce structures, and recipes',
    tag: 'TOPO',
    tagColor: 'text-purple-400',
    fullPageHref: '/dashboard/blueprints',
    widthClass: 'max-w-4xl',
    component: BlueprintsPage,
  },
  organization: {
    title: 'Org Topology Map',
    subtitle: 'Interactive hierarchical department tree, reporting chains, and agent roles',
    tag: 'TOPO',
    tagColor: 'text-purple-400',
    fullPageHref: '/dashboard/organization',
    widthClass: 'max-w-5xl',
    component: OrganizationMapPage,
  },
  settings: {
    title: 'Administration & Settings',
    subtitle: 'System preferences, API keys, desktop native settings, and authentication',
    tag: 'TOPO',
    tagColor: 'text-purple-400',
    fullPageHref: '/dashboard/settings',
    widthClass: 'max-w-3xl',
    component: SettingsPage,
  },
  runtime: {
    title: 'Sandboxed Execution Runtime',
    subtitle: 'Kernel-isolated bubblewrap multi-language runner with AST validation and secret scrubbing',
    tag: 'RUNTIME',
    tagColor: 'text-indigo-400',
    fullPageHref: '/dashboard/runtime',
    widthClass: 'max-w-4xl',
    component: RuntimePage,
  },
  mcp: {
    title: 'Skills, MCP & Plugins Hub',
    subtitle: 'Autonomous suites, procedural skill playbooks, and registered MCP tool gateways',
    tag: 'INTEGRATIONS',
    tagColor: 'text-emerald-400',
    fullPageHref: '/dashboard/mcp',
    widthClass: 'max-w-5xl',
    component: McpPage,
  },
  skills: {
    title: 'Skills, MCP & Plugins Hub',
    subtitle: 'Autonomous suites, procedural skill playbooks, and registered MCP tool gateways',
    tag: 'INTEGRATIONS',
    tagColor: 'text-emerald-400',
    fullPageHref: '/dashboard/mcp',
    widthClass: 'max-w-5xl',
    component: McpPage,
  },
};

interface UnifiedCockpitDrawerHubProps {
  activeDrawerId: string | null;
  onClose: () => void;
}

export function UnifiedCockpitDrawerHub({ activeDrawerId, onClose }: UnifiedCockpitDrawerHubProps) {
  if (!activeDrawerId) return null;

  const config = DRAWER_REGISTRY[activeDrawerId];
  if (!config) return null;

  const ContentComponent = config.component;

  return (
    <CockpitDrawer
      isOpen={true}
      onClose={onClose}
      title={config.title}
      subtitle={config.subtitle}
      categoryTag={config.tag}
      categoryColor={config.tagColor}
      fullPageHref={config.fullPageHref}
      widthClass={config.widthClass}
    >
      <ContentComponent />
    </CockpitDrawer>
  );
}
