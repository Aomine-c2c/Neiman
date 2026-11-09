import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProjectsPage from './page';
import { projectsApi } from '@/lib/api/projects';
import { agentsApi } from '@/lib/api/agents';
import { governanceApi } from '@/lib/api/governance';
import { decisionsApi } from '@/lib/api/decisions';
import { useAuthStore } from '@/store/auth';

jest.mock('@/lib/api/projects', () => ({
  projectsApi: {
    list: jest.fn(),
    get: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    listTasks: jest.fn(),
    getTask: jest.fn(),
    createTask: jest.fn(),
    updateTask: jest.fn(),
    deleteTask: jest.fn(),
  },
}));

jest.mock('@/lib/api/agents', () => ({
  agentsApi: {
    list: jest.fn(),
    executeTask: jest.fn(),
  },
}));

jest.mock('@/lib/api/governance', () => ({
  governanceApi: {
    queryAudits: jest.fn(),
  },
}));

jest.mock('@/lib/api/decisions', () => ({
  decisionsApi: {
    list: jest.fn(),
  },
}));

const mockCompany = {
  id: 'comp-1',
  name: 'Acme Autonomous Corp',
  slug: 'acme-corp',
  status: 'ACTIVE',
  owner_id: 'user-1',
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
};

const mockProjects = [
  {
    id: 'proj-1',
    company_id: 'comp-1',
    name: 'NEIMAN Operating System Upgrade',
    objective: 'Modernize core microkernel and autonomous agent boundaries',
    status: 'ACTIVE',
    budget: 1500,
    milestones: [
      { title: 'Container Isolation', completed: true },
      { title: 'Zero-trust Runtime', due_date: '2026-10-15', completed: false },
    ],
    deadline: '2026-10-31T00:00:00Z',
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  },
];

const mockTasks = [
  {
    id: 'task-1',
    company_id: 'comp-1',
    project_id: 'proj-1',
    title: 'Deploy container isolation sandbox',
    description: 'Verify namespace separation across all agent runtimes',
    status: 'IN_PROGRESS',
    priority: 'CRITICAL',
    assigned_agent_id: 'agent-cto',
    dependencies: [],
    tokens_consumed: 18400,
    cost_usd: 0.054,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  },
  {
    id: 'task-2',
    company_id: 'comp-1',
    project_id: 'proj-1',
    title: 'Audit cryptographic credentials',
    description: 'Verify HSM secret envelope',
    status: 'DONE',
    priority: 'HIGH',
    assigned_agent_id: 'agent-sec',
    dependencies: ['task-1'],
    tokens_consumed: 9200,
    cost_usd: 0.027,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  },
];

const mockAgents = [
  {
    id: 'agent-cto',
    company_id: 'comp-1',
    name: 'Autonomous CTO',
    autonomy: 'AUTONOMOUS',
    status: 'WORKING',
    intelligence_config: { provider: 'anthropic', model: 'claude-sonnet' },
  },
  {
    id: 'agent-sec',
    company_id: 'comp-1',
    name: 'Security Sentinel',
    autonomy: 'SUPERVISED',
    status: 'AVAILABLE',
    intelligence_config: { provider: 'google', model: 'gemini-2.5-pro' },
  },
];

const mockAudits = [
  {
    id: 'aud-1',
    company_id: 'comp-1',
    action: 'Container isolation verified',
    target: 'sandbox-east',
    result: 'SUCCESS',
    actor_name: 'Autonomous CTO',
    created_at: '2026-09-01T00:00:00Z',
  },
];

const mockDecisions = [
  {
    id: 'dec-1',
    company_id: 'comp-1',
    title: 'Adopt Qwen3 for Local Fallbacks',
    problem: 'Reduce cloud latency on routine evaluations',
    status: 'DECIDED',
    created_at: '2026-09-01T00:00:00Z',
  },
];

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ProjectsPage />
    </QueryClientProvider>
  );
}

describe('Projects & Task Management Experience', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.getState().setActiveCompany(mockCompany);
    (projectsApi.list as jest.Mock).mockResolvedValue(mockProjects);
    (projectsApi.listTasks as jest.Mock).mockResolvedValue(mockTasks);
    (projectsApi.getTask as jest.Mock).mockResolvedValue(mockTasks[0]);
    (agentsApi.list as jest.Mock).mockResolvedValue(mockAgents);
    (governanceApi.queryAudits as jest.Mock).mockResolvedValue(mockAudits);
    (decisionsApi.list as jest.Mock).mockResolvedValue(mockDecisions);
  });

  it('renders project overview, objective, KPIs, and progress', async () => {
    renderPage();

    expect(await screen.findByText('NEIMAN Operating System Upgrade')).toBeInTheDocument();
    expect(screen.getByText('Modernize core microkernel and autonomous agent boundaries')).toBeInTheDocument();

    // Check KPIs
    expect(screen.getByText('Task Progress')).toBeInTheDocument();
    expect(screen.getByText('Milestones')).toBeInTheDocument();
    expect(screen.getByText('Resource Spend')).toBeInTheDocument();
    expect(screen.getByText('Blocked Tasks')).toBeInTheDocument();
  });

  it('supports 4 interchangeable multi-views: List, Board, Timeline, and Dependency Graph', async () => {
    renderPage();

    expect(await screen.findByText('Deploy container isolation sandbox')).toBeInTheDocument();

    // Board View
    const boardBtn = screen.getByRole('button', { name: /Board/i });
    fireEvent.click(boardBtn);
    expect(screen.getByText('To Do')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('In Review')).toBeInTheDocument();

    // Timeline View
    const timelineBtn = screen.getByRole('button', { name: /Timeline/i });
    fireEvent.click(timelineBtn);
    expect(screen.getByText('Project Timeline & Milestones')).toBeInTheDocument();
    expect(screen.getByText('Container Isolation')).toBeInTheDocument();

    // Dependency Graph View
    const graphBtn = screen.getByRole('button', { name: /Dependency Graph/i });
    fireEvent.click(graphBtn);
    expect(screen.getByText('Task Precedence Topology')).toBeInTheDocument();

    // List View
    const listBtn = screen.getByRole('button', { name: /List/i });
    fireEvent.click(listBtn);
    expect(screen.getByText('Executing Agent')).toBeInTheDocument();
  });

  it('switches between project sub-tabs: Milestones, Agent Assignments, Activity, Resources', async () => {
    renderPage();

    expect(await screen.findByText('NEIMAN Operating System Upgrade')).toBeInTheDocument();

    // Milestones Tab
    const milestonesTab = screen.getByRole('button', { name: /Milestones/i });
    fireEvent.click(milestonesTab);
    expect(screen.getByText('Key Project Deliverables & Milestones')).toBeInTheDocument();
    expect(screen.getByText('Container Isolation')).toBeInTheDocument();

    // Agent Assignments Tab
    const agentsTab = screen.getByRole('button', { name: /Agent Assignments/i });
    fireEvent.click(agentsTab);
    expect(screen.getByText('Autonomous CTO')).toBeInTheDocument();

    // Project Activity Tab
    const activityTab = screen.getByRole('button', { name: /Project Activity/i });
    fireEvent.click(activityTab);
    expect(screen.getByText('Container isolation verified')).toBeInTheDocument();

    // Project Resources Tab
    const resourcesTab = screen.getByRole('button', { name: /Project Resources/i });
    fireEvent.click(resourcesTab);
    expect(screen.getByText('Total Tokens Consumed')).toBeInTheDocument();
    expect(screen.getByText('Total Resource Spend')).toBeInTheDocument();
    expect(screen.getByText('Adopt Qwen3 for Local Fallbacks')).toBeInTheDocument();
  });

  it('opens TaskDetailsDrawer showing agent execution provenance, dependencies, outputs, and validation', async () => {
    renderPage();

    expect(await screen.findByText('Deploy container isolation sandbox')).toBeInTheDocument();

    // Click task to open drawer
    const taskCard = screen.getByText('Deploy container isolation sandbox');
    fireEvent.click(taskCard);

    // 1. Agent execution provenance
    expect(await screen.findByText('Executed By Autonomous Agent:')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Trigger Agent Run/i })).toBeInTheDocument();

    // 2. Primary Objective & Dependencies
    expect(screen.getByText('PRIMARY OBJECTIVE & EXPECTED OUTCOME')).toBeInTheDocument();
    expect(screen.getByText('RESOURCE TELEMETRY CONSUMPTION')).toBeInTheDocument();

    // 3. Workflow & Trace tab
    const workflowTab = screen.getByRole('button', { name: /Workflow & Trace/i });
    fireEvent.click(workflowTab);
    expect(screen.getByText('Autonomous Agent Execution Trace')).toBeInTheDocument();

    // 4. Outputs & Artifacts tab
    const outputsTab = screen.getByRole('button', { name: /Outputs & Artifacts/i });
    fireEvent.click(outputsTab);
    expect(screen.getByText('Intermediate Agent Outputs & Deliverables')).toBeInTheDocument();

    // 5. Quality & Validation tab
    const validationTab = screen.getByRole('button', { name: /Quality & Validation/i });
    fireEvent.click(validationTab);
    expect(screen.getByText(/Validation Status:/i)).toBeInTheDocument();

    // 6. Human Approvals tab
    const approvalsTab = screen.getByRole('button', { name: /Human Approvals/i });
    fireEvent.click(approvalsTab);
    expect(screen.getByText(/Human-in-the-Loop Sign-off/i)).toBeInTheDocument();
  });
});
