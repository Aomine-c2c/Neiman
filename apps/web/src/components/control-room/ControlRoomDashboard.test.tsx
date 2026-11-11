import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ControlRoomDashboard } from './ControlRoomDashboard';
import type { ControlRoomState } from '@/lib/api/controlRoom';
import { ctoApi } from '@/lib/api/cto';
import { projectsApi } from '@/lib/api/projects';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

jest.mock('@/lib/api/projects', () => ({
  projectsApi: {
    toggleTaskStatus: jest.fn(),
  },
}));

jest.mock('@/lib/api/cto', () => ({
  ctoApi: {
    sendDirective: jest.fn(),
    getProposals: jest.fn(),
    decideProposal: jest.fn(),
  },
}));

const mockState: ControlRoomState = {
  company_id: 'comp-1',
  agents: [
    {
      id: 'ag-1',
      company_id: 'comp-1',
      name: 'Atlas Architect',
      status: 'WORKING',
      autonomy: 'AUTONOMOUS',
      identity: { title: 'Lead Systems Architect' },
      responsibilities: [],
      goals: [],
      capabilities: [],
      permissions: {},
      tools: [],
      intelligence_config: { provider: 'anthropic', model: 'claude-3-5-sonnet' },
      resource_limits: {},
      resource_usage: {},
      performance_metadata: {},
      created_at: '',
      updated_at: '',
    },
  ],
  departments: [],
  roles: [],
  projects: [],
  tasks: [
    {
      id: 'task-1',
      project_id: 'proj-1',
      title: 'Refactor Auth Middleware & JWT Validation',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      assigned_agent_id: 'ag-1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
  approvals: [
    {
      id: 'app-1',
      company_id: 'comp-1',
      action_type: 'DEPLOY_MIGRATION',
      reason: 'Apply production schema migration v4',
      risk_level: 'HIGH',
      status: 'PENDING',
      target_resource: 'db-primary',
      created_at: new Date().toISOString(),
    },
  ],
  audits: [],
  resources: {
    compute_used_pct: 42,
    memory_used_gb: 3.2,
    memory_limit_gb: 16,
    token_usage_total: 128400,
    intelligence_cost_usd: 1.85,
    budget_allocated_usd: 100,
    budget_spent_usd: 1.85,
  },
  decisions: [],
  policies: [],
  memories: [],
  providers: [
    {
      id: 'prov-1',
      name: 'Anthropic Claude',
      provider: 'anthropic',
      status: 'ONLINE',
      is_configured: true,
      is_primary: true,
      active_requests: 1,
      avg_latency_ms: 420,
      total_tokens: 128400,
      cost_usd: 1.85,
    },
  ],
  activity: [
    {
      id: 'act-1',
      company_id: 'co-1',
      event_type: 'task_created' as const,
      title: 'Atlas Architect updated apps/api/auth.py',
      summary: 'Engineering change applied.',
      severity: 'INFO' as const,
      payload: {},
      timestamp: new Date().toISOString(),
    },
  ],
  evolutionProposals: [],
  unavailableSections: [],
};

function renderOverview(onDecideApproval = jest.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ControlRoomDashboard
        companyId="comp-1"
        companyName="Neiman Engineering"
        state={mockState}
        live={{
          connection: 'CONNECTED',
          transport: 'WebSocket',
          freshIds: new Set(),
        }}
        onDecideApproval={onDecideApproval}
      />
    </QueryClientProvider>
  );
}

describe('ControlRoomDashboard — Stage 3 Overview (Executive Pulse + Directive Bar)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(ctoApi.getProposals).mockResolvedValue([]);
  });

  it('renders the top Directive Bar, 4 Executive Pulse metric cards, Pending Approval card, Active Work in Progress, and Live Team Activity', () => {
    const onDecide = jest.fn();
    renderOverview(onDecide);

    // Top Directive Bar
    expect(
      screen.getByPlaceholderText(/Give your engineering team a goal/i)
    ).toBeInTheDocument();

    // 4 Executive Metric Cards
    expect(screen.getByText('Active Tasks')).toBeInTheDocument();
    expect(screen.getByText('Working Agents')).toBeInTheDocument();
    expect(screen.getByText('Pending Approvals')).toBeInTheDocument();
    expect(screen.getByText('Repo Health')).toBeInTheDocument();

    // Left Column: Pending Approval Action Card & Active Work in Progress
    expect(screen.getByText('Apply production schema migration v4')).toBeInTheDocument();
    expect(screen.getAllByText('Refactor Auth Middleware & JWT Validation')[0]).toBeInTheDocument();

    // Right Column: Live Team Activity Stream
    expect(screen.getByText('Live Team Activity')).toBeInTheDocument();
    expect(screen.getByText('Atlas Architect updated apps/api/auth.py')).toBeInTheDocument();

    // Clicking Approve on inline approval card triggers onDecideApproval
    fireEvent.click(screen.getByRole('button', { name: /Approve DEPLOY/i }));
    expect(onDecide).toHaveBeenCalledWith('app-1', 'APPROVED');
  });

  it('generates an Inline CTO Plan Preview Card with Approve & Dispatch and Discuss in CTO View when a goal is submitted', async () => {
    jest.mocked(ctoApi.sendDirective).mockResolvedValue({
      directive_id: 'dir-99',
      cto_agent_id: 'cto-1',
      cto_agent_name: 'Chief Technology Officer',
      primary_project_id: 'proj-1',
      tasks_created_count: 2,
      tasks: [
        {
          id: 't-new-1',
          title: 'Design Billing Webhook Schema',
          status: 'PENDING',
          priority: 'HIGH',
          assigned_agent_name: 'Atlas Architect',
        },
        {
          id: 't-new-2',
          title: 'Implement Stripe Signature Verification',
          status: 'PENDING',
          priority: 'HIGH',
          assigned_agent_name: 'Atlas Architect',
        },
      ],
      summary: 'Synthesized 2 tasks for the Stripe webhook billing pipeline.',
    });

    renderOverview();

    const input = screen.getByPlaceholderText(/Give your engineering team a goal/i);
    fireEvent.change(input, { target: { value: 'Build Stripe billing webhook pipeline' } });
    fireEvent.click(screen.getByRole('button', { name: /Synthesize Plan/i }));

    await waitFor(() => {
      expect(ctoApi.sendDirective).toHaveBeenCalledWith('comp-1', {
        directive: 'Build Stripe billing webhook pipeline',
        priority: 'HIGH',
      });
    });

    // Inline CTO Plan Preview Card appears with tasks and action buttons
    expect(
      await screen.findByText('Synthesized 2 tasks for the Stripe webhook billing pipeline.')
    ).toBeInTheDocument();
    expect(screen.getByText('Design Billing Webhook Schema')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Approve & Dispatch/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Discuss in CTO View/i })).toBeInTheDocument();
  });

  it('toggles task completion via interactive checkbox in active tasks list', async () => {
    (projectsApi.toggleTaskStatus as jest.Mock).mockResolvedValue({
      ...mockState.tasks[0],
      status: 'COMPLETED',
    });

    renderOverview();

    const toggleBtn = screen.getByLabelText(/Mark task Refactor Auth Middleware & JWT Validation as complete/i);
    fireEvent.click(toggleBtn);

    await waitFor(() => {
      expect(projectsApi.toggleTaskStatus).toHaveBeenCalledWith(
        'comp-1',
        'proj-1',
        'task-1',
        'IN_PROGRESS'
      );
    });
  });
});

