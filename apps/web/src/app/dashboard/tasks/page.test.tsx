import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TasksPage from './page';
import { projectsApi } from '@/lib/api/projects';
import { agentsApi } from '@/lib/api/agents';
import { organizationsApi } from '@/lib/api/organizations';
import { useAuthStore } from '@/store/auth';

jest.mock('@/lib/api/projects', () => ({
  ...jest.requireActual('@/lib/api/projects'),
  projectsApi: {
    list: jest.fn(),
    listTasks: jest.fn(),
    getTask: jest.fn(),
    createTask: jest.fn(),
    updateTask: jest.fn(),
    deleteTask: jest.fn(),
    toggleTaskStatus: jest.fn(),
    updateTaskChecklist: jest.fn(),
  },
}));

jest.mock('@/lib/api/agents', () => ({
  agentsApi: {
    list: jest.fn(),
    executeTask: jest.fn(),
  },
}));

jest.mock('@/lib/api/organizations', () => ({
  organizationsApi: {
    listRoles: jest.fn(),
  },
}));

jest.mock('@/lib/organizationContext', () => ({
  useOrganizationContext: () => mockCompany,
}));

const mockCompany = {
  id: 'comp-neiman-1',
  name: 'NovaForge Technologies',
  slug: 'novaforge',
  status: 'ACTIVE',
  owner_id: 'user-admin',
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
};

const mockProjects = [
  {
    id: 'proj-alpha',
    company_id: 'comp-neiman-1',
    name: 'Sovereign Command Deck',
    objective: 'Build autonomous execution engine and interactive controls',
    status: 'ACTIVE',
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  },
];

const mockTasks = [
  {
    id: 'task-checklist-1',
    company_id: 'comp-neiman-1',
    project_id: 'proj-alpha',
    title: 'Implement Interactive Task Checklist System',
    description: 'Ensure checklists toggle seamlessly across list, checklist, and drawer views',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    assigned_agent_id: 'agent-cto-1',
    dependencies: [],
    checklist: [
      { id: 'step-1', title: 'Design Checklist View Topography', completed: true },
      { id: 'step-2', title: 'Implement Optimistic Status Toggle', completed: false },
    ],
    resource_requirements: {},
    tokens_consumed: 12000,
    cost_usd: 0.035,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  },
  {
    id: 'task-checklist-2',
    company_id: 'comp-neiman-1',
    project_id: 'proj-alpha',
    title: 'Verify Zero-Trust Microkernel Sandbox',
    description: 'Run automated boundary verification suite',
    status: 'COMPLETED',
    priority: 'CRITICAL',
    assigned_agent_id: 'agent-sec-1',
    dependencies: [],
    checklist: [
      { id: 'step-3', title: 'Verify PTY isolation', completed: true },
    ],
    resource_requirements: {},
    tokens_consumed: 16000,
    cost_usd: 0.048,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  },
];

const mockAgents = [
  {
    id: 'agent-cto-1',
    company_id: 'comp-neiman-1',
    name: 'Autonomous CTO',
    autonomy: 'AUTONOMOUS',
    status: 'WORKING',
    intelligence_config: { provider: 'anthropic', model: 'claude-3-7-sonnet' },
  },
  {
    id: 'agent-sec-1',
    company_id: 'comp-neiman-1',
    name: 'Security Sentinel',
    autonomy: 'SUPERVISED',
    status: 'AVAILABLE',
    intelligence_config: { provider: 'google', model: 'gemini-2.5-pro' },
  },
];

function renderTasksPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <TasksPage />
    </QueryClientProvider>
  );
}

describe('Interactive Tasks & Deliverable Checklist Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.getState().setActiveCompany(mockCompany);
    (projectsApi.list as jest.Mock).mockResolvedValue(mockProjects);
    (projectsApi.listTasks as jest.Mock).mockResolvedValue(mockTasks);
    (projectsApi.getTask as jest.Mock).mockResolvedValue(mockTasks[0]);
    (projectsApi.toggleTaskStatus as jest.Mock).mockResolvedValue({
      ...mockTasks[0],
      status: 'COMPLETED',
    });
    (projectsApi.updateTaskChecklist as jest.Mock).mockResolvedValue({
      ...mockTasks[0],
      checklist: [
        { id: 'step-1', title: 'Design Checklist View Topography', completed: true },
        { id: 'step-2', title: 'Implement Optimistic Status Toggle', completed: true },
      ],
    });
    (projectsApi.createTask as jest.Mock).mockResolvedValue({
      id: 'task-new-1',
      company_id: 'comp-neiman-1',
      project_id: 'proj-alpha',
      title: 'New Fast Checklist Deliverable',
      status: 'TODO',
      priority: 'MEDIUM',
      checklist: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    (agentsApi.list as jest.Mock).mockResolvedValue(mockAgents);
    (organizationsApi.listRoles as jest.Mock).mockResolvedValue([]);
  });

  it('renders tasks page and switches to Checklist view mode', async () => {
    renderTasksPage();

    await waitFor(() => {
      expect(screen.getByText(/Tasks & Projects/i)).toBeInTheDocument();
    });

    // Switch to Checklist view
    const checklistTab = screen.getByRole('button', { name: /^checklist$/i });
    fireEvent.click(checklistTab);

    // Verify Checklist View Header & Progress Bar
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 3, name: 'Interactive Task Checklist' })).toBeInTheDocument();
      expect(screen.getByText(/Sprint Deliverables Completion/i)).toBeInTheDocument();
    });
  });

  it('toggles task completion status in Checklist view via checkbox', async () => {
    renderTasksPage();

    // Switch to Checklist view
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^checklist$/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /^checklist$/i }));

    await waitFor(() => {
      expect(screen.getByText('Implement Interactive Task Checklist System')).toBeInTheDocument();
    });

    // Find and click the toggle button for task 1
    const toggleButton = screen.getByLabelText(/Toggle task completion for Implement Interactive Task Checklist System/i);
    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(projectsApi.toggleTaskStatus).toHaveBeenCalledWith(
        'comp-neiman-1',
        'proj-alpha',
        'task-checklist-1',
        'IN_PROGRESS'
      );
    });
  });

  it('interacts with subtask steps: toggles step and adds a new step', async () => {
    renderTasksPage();

    // Switch to Checklist view
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^checklist$/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /^checklist$/i }));

    await waitFor(() => {
      expect(screen.getByText('Implement Interactive Task Checklist System')).toBeInTheDocument();
    });

    // Expand subtasks
    const expandButton = screen.getByLabelText(/Toggle subtasks for Implement Interactive Task Checklist System/i);
    fireEvent.click(expandButton);

    // Verify step 2 is visible and click to toggle it
    await waitFor(() => {
      expect(screen.getByText('Implement Optimistic Status Toggle')).toBeInTheDocument();
    });

    const stepLabel = screen.getByText('Implement Optimistic Status Toggle');
    fireEvent.click(stepLabel);

    await waitFor(() => {
      expect(projectsApi.updateTaskChecklist).toHaveBeenCalled();
    });

    // Add a new subtask step
    const stepInput = screen.getByPlaceholderText(/\+ Add a step/i);
    fireEvent.change(stepInput, { target: { value: 'Write E2E automated test' } });
    fireEvent.keyDown(stepInput, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(projectsApi.updateTaskChecklist).toHaveBeenCalledTimes(2);
    });
  });

  it('creates a new task via rapid inline creator in Checklist view', async () => {
    renderTasksPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^checklist$/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /^checklist$/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Add a new deliverable to this checklist/i)).toBeInTheDocument();
    });

    const taskInput = screen.getByPlaceholderText(/Add a new deliverable to this checklist/i);
    fireEvent.change(taskInput, { target: { value: 'New Fast Checklist Deliverable' } });

    const addButton = screen.getByRole('button', { name: /^add$/i });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(projectsApi.createTask).toHaveBeenCalledWith(
        'comp-neiman-1',
        'proj-alpha',
        expect.objectContaining({
          title: 'New Fast Checklist Deliverable',
          status: 'TODO',
        })
      );
    });
  });

  it('toggles task completion directly from List view', async () => {
    renderTasksPage();

    // Switch to List view
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^list$/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /^list$/i }));

    await waitFor(() => {
      expect(screen.getByText('Implement Interactive Task Checklist System')).toBeInTheDocument();
    });

    const listToggleBtn = screen.getByLabelText(/Toggle task completion for Implement Interactive Task Checklist System/i);
    fireEvent.click(listToggleBtn);

    await waitFor(() => {
      expect(projectsApi.toggleTaskStatus).toHaveBeenCalledWith(
        'comp-neiman-1',
        'proj-alpha',
        'task-checklist-1',
        'IN_PROGRESS'
      );
    });
  });
});
