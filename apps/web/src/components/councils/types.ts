import React from 'react';
import { Shield, Zap, TestTube, Database } from 'lucide-react';

export interface DirectiveSuggestion {
  id: string;
  title: string;
  icon: React.ElementType;
  badge: string;
  badgeColor: string;
  description: string;
  prompt: string;
}

export const DIRECTIVE_SUGGESTIONS: DirectiveSuggestion[] = [
  {
    id: 'security',
    title: 'AppSec & Boundary Guardrails',
    icon: Shield,
    badge: 'Security',
    badgeColor: 'text-amber-800 dark:text-amber-300 bg-amber-500/10 border-amber-500/30',
    description:
      'Audit AST call graphs and implement cryptographic secret and PII egress masking across microservices.',
    prompt:
      'Audit AST call graphs and implement cryptographic secret and PII egress masking across microservices.',
  },
  {
    id: 'infra',
    title: 'High-Availability & Circuit Breakers',
    icon: Zap,
    badge: 'Infra',
    badgeColor: 'text-sky-800 dark:text-sky-300 bg-sky-500/10 border-sky-500/30',
    description:
      'Configure low-latency health probes, exponential retries, and circuit-breaker failover across all model providers.',
    prompt:
      'Configure low-latency health probes, exponential retries, and circuit-breaker failover across all model providers.',
  },
  {
    id: 'testing',
    title: 'TDD & Regression Test Automation',
    icon: TestTube,
    badge: 'Testing',
    badgeColor: 'text-emerald-800 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
    description:
      'Enforce strict test-driven development (TDD) and scaffold end-to-end regression test suites with 90% coverage threshold.',
    prompt:
      'Enforce strict test-driven development (TDD) and scaffold end-to-end regression test suites with 90% coverage threshold.',
  },
  {
    id: 'schema',
    title: 'Schema & Reversible Migrations',
    icon: Database,
    badge: 'Database',
    badgeColor: 'text-teal-800 dark:text-teal-300 bg-teal-500/10 border-teal-500/30',
    description:
      'Design normalized relational schema migrations with composite indexing, zero downtime, and strict foreign keys.',
    prompt:
      'Design normalized relational schema migrations with composite indexing, zero downtime, and strict foreign keys.',
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

export interface DockedDomainMeta {
  title: string;
  subtitle: string;
  tag: string;
  tagColor: string;
  drawerKey: string;
}

export const DOCKED_DOMAIN_REGISTRY: Record<string, DockedDomainMeta> = {
  TASKS: {
    title: 'Tasks Execution Matrix',
    subtitle: 'Granular work orders, real-time assignment, dependencies, and proofs of work',
    tag: 'TASKS',
    tagColor: 'text-sky-700 dark:text-sky-400',
    drawerKey: 'tasks',
  },
  PULSE: {
    title: 'Live System Pulse & Activity Stream',
    subtitle: 'Real-time operational telemetry, swarm reasoning traces, and audit events',
    tag: 'PULSE',
    tagColor: 'text-emerald-700 dark:text-emerald-400',
    drawerKey: 'overview',
  },
  OVERVIEW: {
    title: 'Live System Pulse & Activity Stream',
    subtitle: 'Real-time operational telemetry, swarm reasoning traces, and audit events',
    tag: 'PULSE',
    tagColor: 'text-emerald-700 dark:text-emerald-400',
    drawerKey: 'overview',
  },
  MEMORY: {
    title: 'Organizational Memory',
    subtitle: 'Vector semantic store, shared knowledge graph, recall benchmarks, and document index',
    tag: 'INTEL',
    tagColor: 'text-sky-700 dark:text-sky-400',
    drawerKey: 'memory',
  },
  MCP: {
    title: 'Skills, MCP & Plugins Hub',
    subtitle: 'Autonomous suites, procedural skill playbooks, and registered MCP tool gateways',
    tag: 'INTEGRATIONS',
    tagColor: 'text-emerald-700 dark:text-emerald-400',
    drawerKey: 'mcp',
  },
  WORKFLOWS: {
    title: 'Autonomous Workflows',
    subtitle: 'Visual execution DAGs, steps, triggers, and automated organizational routines',
    tag: 'WORKFLOWS',
    tagColor: 'text-emerald-700 dark:text-emerald-400',
    drawerKey: 'workflows',
  },
  SETTINGS: {
    title: 'Administration & Settings',
    subtitle: 'System preferences, API keys, desktop native settings, and authentication',
    tag: 'TOPO',
    tagColor: 'text-teal-700 dark:text-teal-400',
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
    tagColor: 'text-emerald-700 dark:text-emerald-400',
    drawerKey: 'git',
  },
};

export interface ChatTurn {
  id: string;
  sender: string;
  role: string;
  body: string;
  stance?: string;
  keyPoints?: string[];
  risks?: string[];
  tasks?: Array<{ id?: string; title: string; status?: string }>;
  codeSnippet?: { language: string; code: string };
  isWorkflowLink?: boolean;
  isGitCard?: boolean;
}

export interface ContextAttachment {
  id: string;
  label: string;
  snippet?: string;
}

export const SQUAD_MENTIONS = [
  { tag: '@CTO', label: 'Chief Technology Agent', role: 'CTO' },
  { tag: '@Council', label: 'Architecture Council', role: 'Governance' },
  { tag: '@Architect', label: 'Systems Architect', role: 'Architect' },
  { tag: '@Security', label: 'Cybersecurity Agent', role: 'Security' },
  { tag: '@Backend', label: 'Backend Engineering', role: 'Backend' },
  { tag: '@QA', label: 'Quality Assurance Lead', role: 'QA Lead' },
];

export const SLASH_COMMANDS = [
  { cmd: '/debate', desc: 'Start a formal Council debate deliberation' },
  { cmd: '/task', desc: 'Open Tasks Execution Matrix' },
  { cmd: '/run', desc: 'Execute bash or code command in sandbox' },
  { cmd: '/workflow', desc: 'Open Autonomous Workflows DAG view' },
  { cmd: '/git', desc: 'Inspect working tree and commit changes' },
  { cmd: '/mcp', desc: 'Open registered MCP tools & skills hub' },
  { cmd: '/memory', desc: 'Search organizational memory & codebase' },
  { cmd: '/tick', desc: 'Trigger supervisor execution cycle tick' },
];
