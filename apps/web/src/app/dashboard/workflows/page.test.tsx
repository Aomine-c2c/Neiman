import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import WorkflowsDashboardPage from './page';
import { workflowsApi } from '@/lib/api/workflows';
import { agentsApi } from '@/lib/api/agents';
import { useAuthStore } from '@/store/auth';

jest.mock('@/lib/api/workflows', () => ({
  workflowsApi: {
    list: jest.fn(),
    get: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    activate: jest.fn(),
    delete: jest.fn(),
    triggerExecution: jest.fn(),
    listExecutions: jest.fn(),
    getExecution: jest.fn(),
    resumeExecution: jest.fn(),
    cancelExecution: jest.fn(),
  },
}));

jest.mock('@/lib/api/agents', () => ({
  agentsApi: {
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

const mockWorkflow = {
  id: 'wf-1',
  company_id: 'comp-1',
  name: 'Software Delivery Pipeline',
  description: 'Autonomous development lifecycle: requirement -> architect -> CTO approval -> deploy',
  trigger_type: 'EVENT',
  trigger_config: { event_name: 'new_requirement_ingested' },
  status: 'ACTIVE',
  steps: [
    { id: 's-1', name: 'Trigger: New Requirement Ingested', type: 'TRIGGER', config: {}, next_step_id: 's-2', position: { x: 80, y: 140 } },
    { id: 's-2', name: 'Product Agent: Synthesize Spec', type: 'AGENT', config: { agent_name: 'Product Agent' }, next_step_id: 's-3', position: { x: 360, y: 140 } },
    { id: 's-3', name: 'Architect Agent: Design Review', type: 'AGENT', config: { agent_name: 'Architect Agent' }, next_step_id: 's-4', position: { x: 640, y: 140 } },
    { id: 's-4', name: 'CTO Executive Sign-off Gate', type: 'APPROVAL', config: { title: 'CTO Sign-off', risk_level: 'CRITICAL' }, position: { x: 920, y: 140 } },
  ],
  agents: ['agent-product', 'agent-architect'],
  tools: [],
  conditions: [],
  approvals: {},
  completion_criteria: {},
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
};

const mockExecutions = [
  {
    id: 'exec-1',
    workflow_id: 'wf-1',
    company_id: 'comp-1',
    title: 'Run 10:42 AM',
    status: 'WAITING_APPROVAL',
    current_step_id: 's-4',
    current_step_name: 'CTO Executive Sign-off Gate',
    current_step_index: 3,
    total_steps: 4,
    tokens_consumed: 24500,
    cost_usd: 0.072,
    duration_ms: 3420,
    input_payload: { requirement: 'Implement User Audit Stream' },
    state_payload: {},
    output_payload: {},
    retries_count: 0,
    max_retries: 3,
    timeout_seconds: 3600,
    step_records: [
      { id: 'sr-1', execution_id: 'exec-1', step_id: 's-1', step_name: 'Trigger', step_type: 'TRIGGER', step_index: 0, status: 'COMPLETED', input_data: {}, output_data: {}, duration_ms: 40, retries_attempted: 0, created_at: '' },
      { id: 'sr-2', execution_id: 'exec-1', step_id: 's-2', step_name: 'Product Agent', step_type: 'AGENT', step_index: 1, status: 'COMPLETED', input_data: {}, output_data: {}, duration_ms: 1200, retries_attempted: 0, created_at: '' },
      { id: 'sr-3', execution_id: 'exec-1', step_id: 's-3', step_name: 'Architect Agent', step_type: 'AGENT', step_index: 2, status: 'COMPLETED', input_data: {}, output_data: {}, duration_ms: 2180, retries_attempted: 0, created_at: '' },
      { id: 'sr-4', execution_id: 'exec-1', step_id: 's-4', step_name: 'CTO Sign-off', step_type: 'APPROVAL', step_index: 3, status: 'WAITING_APPROVAL', input_data: {}, output_data: {}, duration_ms: 0, retries_attempted: 0, created_at: '' },
    ],
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  },
];

const mockAgents = [
  { id: 'agent-product', company_id: 'comp-1', name: 'Product Agent', autonomy: 'AUTONOMOUS', status: 'AVAILABLE', intelligence_config: {} },
  { id: 'agent-architect', company_id: 'comp-1', name: 'Architect Agent', autonomy: 'AUTONOMOUS', status: 'WORKING', intelligence_config: {} },
];

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <WorkflowsDashboardPage />
    </QueryClientProvider>
  );
}

describe('Visual Workflow Editor & Observability Canvas', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.getState().setActiveCompany(mockCompany);
    (workflowsApi.list as jest.Mock).mockResolvedValue([mockWorkflow]);
    (workflowsApi.get as jest.Mock).mockResolvedValue(mockWorkflow);
    (workflowsApi.update as jest.Mock).mockResolvedValue(mockWorkflow);
    (workflowsApi.listExecutions as jest.Mock).mockResolvedValue(mockExecutions);
    (workflowsApi.triggerExecution as jest.Mock).mockResolvedValue(mockExecutions[0]);
    (workflowsApi.resumeExecution as jest.Mock).mockResolvedValue({ ...mockExecutions[0], status: 'COMPLETED' });
    (agentsApi.list as jest.Mock).mockResolvedValue(mockAgents);
  });

  it('renders topbar controls, node palette with 16 nodes, and workflow canvas', async () => {
    renderPage();

    expect(await screen.findByText('Software Delivery Pipeline')).toBeInTheDocument();
    expect(screen.getByText('Canvas Editor')).toBeInTheDocument();
    expect(screen.getByText('Live Observability')).toBeInTheDocument();

    // Node Palette category & items
    expect(screen.getByText('Node Palette')).toBeInTheDocument();
    expect(screen.getByText('16 Nodes')).toBeInTheDocument();
    expect(screen.getByText('Trigger')).toBeInTheDocument();
    expect(screen.getByText('Agent')).toBeInTheDocument();
    expect(screen.getByText('Condition')).toBeInTheDocument();
    expect(screen.getByText('Approval')).toBeInTheDocument();

    // Switch to Step Pipeline Cards mode and verify connected step cards render
    const pipelineCardsBtn = screen.getByRole('button', { name: /Step Pipeline Cards/i });
    fireEvent.click(pipelineCardsBtn);
    expect(screen.getByText('Stage-by-Stage Delivery Pipeline')).toBeInTheDocument();
  });

  it('allows selecting a canvas node and inspecting properties in Properties Inspector', async () => {
    renderPage();

    // Node is rendered on canvas
    const nodeEl = await screen.findByTestId('workflow-node-s-2');
    expect(nodeEl).toBeInTheDocument();

    // Click on node on canvas
    fireEvent.click(nodeEl);

    // Inspector opens with node properties
    await waitFor(() => {
      expect(screen.getByText('Node Properties')).toBeInTheDocument();
      expect(screen.getByText('Autonomous Agent Delegation')).toBeInTheDocument();
    });
    expect(screen.getByText('Assignee Agent')).toBeInTheDocument();
    expect(screen.getByText('Prompt Metaprompt / Instruction')).toBeInTheDocument();
  });

  it('allows adding nodes from palette and updating workflow definition', async () => {
    renderPage();

    expect(await screen.findByText('Software Delivery Pipeline')).toBeInTheDocument();
    expect(await screen.findByText('Node Palette')).toBeInTheDocument();

    // Click to add a Condition node from palette using data-testid
    const conditionPaletteItem = screen.getByTestId('palette-item-CONDITION');
    fireEvent.click(conditionPaletteItem);

    // Condition appears in Inspector
    await waitFor(() => {
      expect(screen.getByText('Conditional Branching Logic')).toBeInTheDocument();
    });

    // Save workflow triggers API update
    const saveBtn = screen.getByRole('button', { name: /Save Workflow/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(workflowsApi.update).toHaveBeenCalled();
    });
  }, 20000);

  it('opens Validation Panel and checks workflow graph topology', async () => {
    renderPage();

    expect(await screen.findByText('Software Delivery Pipeline')).toBeInTheDocument();

    const validationBtn = screen.getByRole('button', { name: /^Validation$/i });
    fireEvent.click(validationBtn);

    expect(screen.getByText('Workflow Graph Validation')).toBeInTheDocument();
  });

  it('switches to Live Observability mode and observes running execution nodes, gates, and resource usage', async () => {
    renderPage();

    expect(await screen.findByText('Live Observability')).toBeInTheDocument();

    // Switch to Observability
    const liveObsBtn = screen.getByRole('button', { name: /Live Observability/i });
    fireEvent.click(liveObsBtn);

    // Observability banner shows live telemetry
    expect(await screen.findByText(/Run 10:42 AM/)).toBeInTheDocument();
    expect(screen.getByText('Tokens:')).toBeInTheDocument();
    expect(screen.getByText('Spend:')).toBeInTheDocument();

    // Canvas highlights nodes with CURRENT, COMPLETED, WAITING
    expect(screen.getByText('CURRENT NODE')).toBeInTheDocument();
    expect(screen.getAllByText('COMPLETED').length).toBeGreaterThan(0);
    expect(screen.getByText('WAITING GATE')).toBeInTheDocument();

    // Resume gate button
    const resumeBtn = screen.getByRole('button', { name: /Resume Gate/i });
    fireEvent.click(resumeBtn);

    await waitFor(() => {
      expect(workflowsApi.resumeExecution).toHaveBeenCalledWith('comp-1', 'exec-1');
    });
  });
});
