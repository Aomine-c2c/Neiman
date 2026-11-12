import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AgentsPage from './page';
import { agentsApi } from '@/lib/api/agents';
import { organizationsApi } from '@/lib/api/organizations';
import { useAuthStore } from '@/store/auth';

jest.mock('@/lib/api/agents', () => ({
  agentsApi: {
    list: jest.fn(),
    create: jest.fn(),
    getProfile: jest.fn(),
    update: jest.fn(),
    transitionStatus: jest.fn(),
    executeTask: jest.fn(),
    sendMessage: jest.fn(),
    delegateTask: jest.fn(),
    escalateProblem: jest.fn(),
  },
}));

jest.mock('@/lib/api/organizations', () => ({
  organizationsApi: {
    listDepartments: jest.fn(),
    listRoles: jest.fn(),
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

const mockAgents = [
  {
    id: 'agent-1',
    company_id: 'comp-1',
    department_id: 'dept-1',
    role_id: 'role-1',
    manager_agent_id: null,
    name: 'Lead Architect',
    identity: { title: 'Principal Architect' },
    responsibilities: ['System architecture', 'Decisions'],
    goals: ['High availability', 'Clean abstractions'],
    capabilities: ['system_design', 'code_review'],
    permissions: { max_approval_threshold_usd: 1000, autonomous_deployment: true },
    tools: ['git', 'terminal', 'compiler'],
    autonomy: 'AUTONOMOUS',
    status: 'WORKING',
    intelligence_config: { provider: 'anthropic', model: 'claude-3-5-sonnet' },
    resource_limits: { daily_budget_usd: 50, max_token_limit_per_task: 128000 },
    resource_usage: { total_cost_usd: 12.5, tokens: 45000 },
    performance_metadata: { avg_task_duration_seconds: 142, success_rate_pct: 98, tasks_completed: 42 },
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  },
  {
    id: 'agent-2',
    company_id: 'comp-1',
    department_id: 'dept-1',
    role_id: 'role-2',
    manager_agent_id: 'agent-1',
    name: 'Security Sentinel',
    identity: { title: 'SecOps Sentinel' },
    responsibilities: ['Vulnerability auditing'],
    goals: ['Zero vulnerabilities in production'],
    capabilities: ['static_analysis', 'audit_logging'],
    permissions: { max_approval_threshold_usd: 100, autonomous_deployment: false },
    tools: ['trivy', 'git-leaks'],
    autonomy: 'SUPERVISED',
    status: 'BLOCKED',
    intelligence_config: { provider: 'google', model: 'gemini-2.5-pro' },
    resource_limits: { daily_budget_usd: 20, max_token_limit_per_task: 64000 },
    resource_usage: { total_cost_usd: 3.2, tokens: 12000 },
    performance_metadata: { avg_task_duration_seconds: 65, success_rate_pct: 95, tasks_completed: 18 },
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  },
];

const mockDepartments = [
  {
    id: 'dept-1',
    company_id: 'comp-1',
    name: 'Core Engineering',
    purpose: 'Core platform development',
    status: 'ACTIVE',
    parent_id: null,
    manager_id: 'agent-1',
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  },
];

const mockRoles = [
  {
    id: 'role-1',
    company_id: 'comp-1',
    department_id: 'dept-1',
    title: 'Chief Technology Officer',
    responsibilities: ['Architecture'],
    capabilities: ['system_design'],
    authority: 'EXECUTIVE',
    required_skills: ['system_architecture'],
    autonomy_level: 'AUTONOMOUS',
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  },
];

const mockDetailedProfile = {
  id: 'agent-1',
  name: 'Lead Architect',
  status: 'WORKING',
  autonomy: 'AUTONOMOUS',
  role_title: 'Chief Technology Officer',
  department_name: 'Core Engineering',
  manager_name: 'Executive Direct',
  goals: ['High availability', 'Clean abstractions'],
  responsibilities: ['System architecture', 'Decisions'],
  intelligence_config: { provider: 'anthropic', model: 'claude-3-5-sonnet' },
  capabilities: ['system_design', 'code_review'],
  tools: ['git', 'terminal', 'compiler'],
  resource_limits: { daily_budget_usd: 50 },
  resource_usage: { total_tokens: 45000, total_cost_usd: 12.5 },
  performance_metadata: { avg_duration_sec: 142, success_rate: 98 },
  recent_audits: [{ id: 'aud-1', action: 'Microkernel cluster upgraded' }],
  memories: [{ id: 'mem-1', content: 'Distributed consensus verified' }],
  recent_communications: [{ id: 'msg-1', subject: 'Architecture review ping' }],
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AgentsPage />
    </QueryClientProvider>
  );
}

describe('AI Workforce Directory & Profile Interface', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.getState().setActiveCompany(mockCompany);
    (agentsApi.list as jest.Mock).mockResolvedValue(mockAgents);
    (agentsApi.getProfile as jest.Mock).mockResolvedValue(mockDetailedProfile);
    (agentsApi.create as jest.Mock).mockResolvedValue({
      id: 'agent-3',
      name: 'New Autonomous Agent',
      status: 'AVAILABLE',
      autonomy: 'AUTONOMOUS',
      goals: ['Telemetry monitor'],
      capabilities: ['monitoring'],
      intelligence_config: { provider: 'openai', model: 'gpt-4o' },
    });
    (agentsApi.update as jest.Mock).mockResolvedValue(mockDetailedProfile);
    (organizationsApi.listDepartments as jest.Mock).mockResolvedValue(mockDepartments);
    (organizationsApi.listRoles as jest.Mock).mockResolvedValue(mockRoles);
  });

  it('renders directory heading, statistics counters, and agent cards', async () => {
    renderPage();

    expect(await screen.findByText('Lead Architect')).toBeInTheDocument();
    expect(screen.getByText('Security Sentinel')).toBeInTheDocument();

    // Check fleet telemetry counters
    expect(screen.getByText('Total Fleet')).toBeInTheDocument();
    expect(screen.getByText('Available', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('Working', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('Blocked', { selector: 'span' })).toBeInTheDocument();
  });

  it('filters agents by search query and status filter', async () => {
    renderPage();

    expect(await screen.findByText('Lead Architect')).toBeInTheDocument();

    // Search query
    const searchInput = screen.getByPlaceholderText('Search agents by name, mission, role...');
    fireEvent.change(searchInput, { target: { value: 'Sentinel' } });

    expect(screen.getByText('Security Sentinel')).toBeInTheDocument();
    expect(screen.queryByText('Lead Architect')).not.toBeInTheDocument();

    // Reset search
    fireEvent.change(searchInput, { target: { value: '' } });
    expect(screen.getByText('Lead Architect')).toBeInTheDocument();

    // Filter by status dropdown
    const statusSelect = screen.getByLabelText('Filter by status');
    fireEvent.change(statusSelect, { target: { value: 'BLOCKED' } });

    expect(screen.getByText('Security Sentinel')).toBeInTheDocument();
    expect(screen.queryByText('Lead Architect')).not.toBeInTheDocument();
  });

  it('switches between Card Grid and Table List views', async () => {
    renderPage();

    expect(await screen.findByText('Lead Architect')).toBeInTheDocument();

    const listViewBtn = screen.getByTitle('List View');
    fireEvent.click(listViewBtn);

    // In Table List view, table headers are visible
    expect(screen.getByRole('columnheader', { name: 'Employee' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Role & Dept' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Intelligence' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Resource Cost' })).toBeInTheDocument();

    const gridViewBtn = screen.getByTitle('Grid View');
    fireEvent.click(gridViewBtn);
    expect(screen.getByText('Lead Architect')).toBeInTheDocument();

    const treeViewBtn = screen.getByTitle('Org Hierarchy Tree');
    fireEvent.click(treeViewBtn);
    expect(screen.getByText('Org Reporting Hierarchy')).toBeInTheDocument();
  });

  it('opens Agent Profile Drawer with the required 7-row layout structure', async () => {
    renderPage();

    expect(await screen.findByText('Lead Architect')).toBeInTheDocument();

    // Click on Lead Architect to open drawer
    const agentCard = screen.getByText('Lead Architect');
    fireEvent.click(agentCard);

    // 1. Agent Identity & STATUS: WORKING
    expect(await screen.findByText('STATUS: WORKING')).toBeInTheDocument();

    // 2. Role / Department / Manager
    expect(screen.getByText('Organizational Hierarchy')).toBeInTheDocument();
    expect(screen.getByText('Role')).toBeInTheDocument();
    expect(screen.getByText('Department')).toBeInTheDocument();
    expect(screen.getByText('Manager')).toBeInTheDocument();

    // 3. CURRENT MISSION
    expect(screen.getByText('CURRENT MISSION & OKRS')).toBeInTheDocument();

    // 4. Intelligence Mesh (Claude, Gemini, OpenAI, Local)
    expect(screen.getByText('INTELLIGENCE PROVIDER MESH')).toBeInTheDocument();
    expect(screen.getByText('Claude')).toBeInTheDocument();
    expect(screen.getByText('Gemini')).toBeInTheDocument();
    expect(screen.getByText('OpenAI')).toBeInTheDocument();
    expect(screen.getByText('Local')).toBeInTheDocument();

    // 5. CAPABILITIES
    expect(screen.getByText('CAPABILITIES MATRIX')).toBeInTheDocument();

    // 6. TOOLS
    expect(screen.getByText('TOOLS WHITELIST')).toBeInTheDocument();

    // 7. RESOURCE USAGE
    expect(screen.getByText('RESOURCE USAGE & QUOTAS')).toBeInTheDocument();

    // 8. ACTIVITY / MEMORY / DECISIONS
    expect(screen.getByText('ACTIVITY / MEMORY / DECISIONS')).toBeInTheDocument();
  });

  it('allows switching to Configure Agent tab and toggles between Simple and Advanced modes', async () => {
    renderPage();

    expect(await screen.findByText('Lead Architect')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Lead Architect'));

    // Switch to Configure tab in Drawer
    const configTab = await screen.findByRole('button', { name: /Configure Agent/i });
    fireEvent.click(configTab);

    // Simple Mode is active by default
    expect(screen.getByText('Agent Configuration')).toBeInTheDocument();
    expect(screen.getByText('Organizational Role')).toBeInTheDocument();
    expect(screen.getByText('Current Mission & Objectives')).toBeInTheDocument();
    expect(screen.getByText('Preferred Intelligence Mesh')).toBeInTheDocument();

    // Toggle to Advanced Mode
    const advancedToggle = screen.getByRole('button', { name: /Advanced Mode/i });
    fireEvent.click(advancedToggle);

    // Advanced fields become accessible
    expect(screen.getByText('Advanced Operational Controls')).toBeInTheDocument();
    expect(screen.getByText('System Instructions & Operational Constraints')).toBeInTheDocument();
    expect(screen.getByText('Daily Budget USD')).toBeInTheDocument();
    expect(screen.getByText('Max Tokens Per Invocation')).toBeInTheDocument();
    expect(screen.getByText('Memory Scope')).toBeInTheDocument();
    expect(screen.getByText('Escalation Rules')).toBeInTheDocument();
    expect(screen.getByText('Evaluation Settings')).toBeInTheDocument();
  });

  it('opens Agent Creation modal and supports both Simple Mode and Advanced Mode creation', async () => {
    renderPage();

    expect(await screen.findByText('Lead Architect')).toBeInTheDocument();

    // Open creation modal
    const deployBtn = screen.getByRole('button', { name: /New Agent/i });
    fireEvent.click(deployBtn);

    expect(screen.getByText('Create Autonomous Agent')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Simple Mode' })).toBeInTheDocument();

    // Switch to Advanced Mode in modal
    const advBtn = screen.getByRole('button', { name: 'Advanced Mode' });
    fireEvent.click(advBtn);

    expect(screen.getByText('Advanced Operational Controls')).toBeInTheDocument();
    expect(screen.getByText('System Instructions & Constraints')).toBeInTheDocument();
    expect(screen.getByText('Reporting Manager')).toBeInTheDocument();
    expect(screen.getByText('Daily Budget (USD)')).toBeInTheDocument();
    expect(screen.getByText('Memory Scope')).toBeInTheDocument();

    // Fill form and submit
    const nameInput = screen.getByPlaceholderText('e.g. Lead Architecture Steward');
    fireEvent.change(nameInput, { target: { value: 'New Autonomous Agent' } });

    const createSubmitBtn = screen.getByRole('button', { name: /Create Agent/i });
    fireEvent.click(createSubmitBtn);

    await waitFor(() => {
      expect(agentsApi.create).toHaveBeenCalled();
    });
  });
});
