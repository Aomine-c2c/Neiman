import { render, screen, fireEvent } from '@testing-library/react';
import { OrganizationalGraph } from './OrganizationalGraph';
import type { Agent } from '@/lib/api/agents';
import type { Department, OrgRole } from '@/lib/api/organizations';
import type { Project, Task, AuditLog } from '@/lib/api/controlRoom';

const mockDepartments: Department[] = [
  {
    id: 'dept-eng',
    company_id: 'comp-1',
    name: 'Engineering',
    purpose: 'Build and operate software',
    status: 'ACTIVE',
    parent_id: null,
    manager_id: 'agent-cto',
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  },
];

const mockRoles: OrgRole[] = [
  {
    id: 'role-cto',
    company_id: 'comp-1',
    department_id: 'dept-eng',
    title: 'Chief Technology Officer',
    responsibilities: ['Architecture', 'Governance'],
    capabilities: ['code_review', 'deployment'],
    authority: 'EXECUTIVE',
    required_skills: ['system_design'],
    autonomy_level: 'AUTONOMOUS',
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  },
];

const mockAgents: Agent[] = [
  {
    id: 'agent-cto',
    company_id: 'comp-1',
    department_id: 'dept-eng',
    role_id: 'role-cto',
    manager_agent_id: null,
    name: 'Autonomous CTO Agent',
    identity: { title: 'CTO' },
    responsibilities: ['System architecture'],
    goals: ['Zero downtime'],
    capabilities: ['code_review'],
    permissions: { approval_required: false },
    tools: ['git', 'shell', 'k8s'],
    autonomy: 'AUTONOMOUS',
    status: 'WORKING',
    intelligence_config: { provider: 'anthropic', model: 'claude-sonnet' },
    resource_limits: { daily_budget_usd: 25 },
    resource_usage: { tokens: 15400 },
    performance_metadata: { health: 'NOMINAL' },
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  },
  {
    id: 'agent-sec',
    company_id: 'comp-1',
    department_id: 'dept-eng',
    role_id: 'role-cto',
    manager_agent_id: 'agent-cto',
    name: 'Security Sentinel',
    identity: { title: 'Security Specialist' },
    responsibilities: ['Vulnerability management'],
    goals: ['Audit codebase'],
    capabilities: ['sast', 'dast'],
    permissions: { approval_required: true },
    tools: ['trivy', 'owasp'],
    autonomy: 'SUPERVISED',
    status: 'BLOCKED',
    intelligence_config: { provider: 'google', model: 'gemini-2.5-pro' },
    resource_limits: { daily_budget_usd: 15 },
    resource_usage: { tokens: 8200 },
    performance_metadata: {},
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  },
];

const mockProjects: Project[] = [
  {
    id: 'proj-1',
    company_id: 'comp-1',
    owner_id: 'agent-cto',
    name: 'NEIMAN Operating System Upgrade',
    objective: 'Modernize core architecture',
    status: 'ACTIVE',
    priority: 'HIGH',
    milestones: [],
    deadline: '2026-10-15T00:00:00Z',
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  },
];

const mockTasks: Task[] = [
  {
    id: 'task-1',
    project_id: 'proj-1',
    assigned_agent_id: 'agent-cto',
    title: 'Deploy microkernel containers',
    description: 'Execute container rolling update',
    status: 'IN_PROGRESS',
    priority: 'CRITICAL',
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  },
];

const mockAudits: AuditLog[] = [
  {
    id: 'audit-1',
    company_id: 'comp-1',
    actor_id: 'agent-cto',
    actor_type: 'AGENT',
    action: 'Container cluster health validated',
    target: 'production-east',
    result: 'All pods healthy',
    created_at: '2026-09-01T00:00:00Z',
  },
];

describe('OrganizationalGraph', () => {
  it('shows only the organization root when the API returns no organizational records', () => {
    render(
      <OrganizationalGraph
        companyName="Test organization"
        companyStatus="ACTIVE"
        departments={[]}
        agents={[]}
        projects={[]}
        tasks={[]}
        decisions={[]}
      />,
    );

    expect(screen.getByText('Test organization')).toBeInTheDocument();
    expect(screen.queryByText('Autonomous CTO Agent')).not.toBeInTheDocument();
    expect(screen.queryByText('NEIMAN Operating System Upgrade')).not.toBeInTheDocument();
  });

  it('renders all hierarchy tiers: Company, Department, Role, Agent, Project, Task', () => {
    render(
      <OrganizationalGraph
        companyName="Acme Autonomous Corp"
        companyStatus="ACTIVE"
        departments={mockDepartments}
        roles={mockRoles}
        agents={mockAgents}
        projects={mockProjects}
        tasks={mockTasks}
        audits={mockAudits}
      />,
    );

    expect(screen.getByText('Acme Autonomous Corp')).toBeInTheDocument();
    expect(screen.getAllByText('Engineering').length).toBeGreaterThan(0);
    expect(screen.getByText('Chief Technology Officer')).toBeInTheDocument();
    expect(screen.getByText('Autonomous CTO Agent')).toBeInTheDocument();
    expect(screen.getByText('Security Sentinel')).toBeInTheDocument();
    expect(screen.getByText('NEIMAN Operating System Upgrade')).toBeInTheDocument();
    expect(screen.getByText('Deploy microkernel containers')).toBeInTheDocument();
  });

  it('displays accurate operational status badges for agents', () => {
    render(
      <OrganizationalGraph
        companyName="Acme Autonomous Corp"
        companyStatus="ACTIVE"
        departments={mockDepartments}
        roles={mockRoles}
        agents={mockAgents}
        projects={mockProjects}
        tasks={mockTasks}
      />,
    );

    expect(screen.getByText('WORKING')).toBeInTheDocument();
    expect(screen.getByText('BLOCKED')).toBeInTheDocument();
  });

  it('filters nodes based on search input query', () => {
    render(
      <OrganizationalGraph
        companyName="Acme Autonomous Corp"
        companyStatus="ACTIVE"
        departments={mockDepartments}
        roles={mockRoles}
        agents={mockAgents}
        projects={mockProjects}
        tasks={mockTasks}
      />,
    );

    const searchInput = screen.getByPlaceholderText('Search map...');
    fireEvent.change(searchInput, { target: { value: 'Sentinel' } });

    expect(screen.getByText('Security Sentinel')).toBeInTheDocument();
    expect(screen.queryByText('Autonomous CTO Agent')).not.toBeInTheDocument();
  });

  it('filters nodes based on status dropdown', () => {
    render(
      <OrganizationalGraph
        companyName="Acme Autonomous Corp"
        companyStatus="ACTIVE"
        departments={mockDepartments}
        roles={mockRoles}
        agents={mockAgents}
        projects={mockProjects}
        tasks={mockTasks}
      />,
    );

    const statusSelect = screen.getByLabelText('Filter by Agent Status');
    fireEvent.change(statusSelect, { target: { value: 'BLOCKED' } });

    expect(screen.getByText('Security Sentinel')).toBeInTheDocument();
    expect(screen.queryByText('Autonomous CTO Agent')).not.toBeInTheDocument();
  });

  it('collapses and expands departments on toggle click', () => {
    render(
      <OrganizationalGraph
        companyName="Acme Autonomous Corp"
        companyStatus="ACTIVE"
        departments={mockDepartments}
        roles={mockRoles}
        agents={mockAgents}
        projects={mockProjects}
        tasks={mockTasks}
      />,
    );

    // Initial state: agents visible
    expect(screen.getByText('Autonomous CTO Agent')).toBeInTheDocument();

    // Click Collapse Department
    const collapseBtn = screen.getByRole('button', { name: /Collapse Department/i });
    fireEvent.click(collapseBtn);

    // Agents and subordinate roles in Engineering are hidden
    expect(screen.queryByText('Autonomous CTO Agent')).not.toBeInTheDocument();
    expect(screen.getByText('Expand Department')).toBeInTheDocument();

    // Click Expand Department
    fireEvent.click(screen.getByRole('button', { name: /Expand Department/i }));
    expect(screen.getByText('Autonomous CTO Agent')).toBeInTheDocument();
  });

  it('opens Agent Inspector Panel when agent card is clicked', () => {
    render(
      <OrganizationalGraph
        companyName="Acme Autonomous Corp"
        companyStatus="ACTIVE"
        departments={mockDepartments}
        roles={mockRoles}
        agents={mockAgents}
        projects={mockProjects}
        tasks={mockTasks}
        audits={mockAudits}
      />,
    );

    const agentCard = screen.getByText('Autonomous CTO Agent');
    fireEvent.click(agentCard);

    // Inspector Panel renders identity, role, model, tools, and budget
    expect(screen.getByText('Operational State')).toBeInTheDocument();
    expect(screen.getByText('anthropic')).toBeInTheDocument();
    expect(screen.getByText('claude-sonnet')).toBeInTheDocument();
    expect(screen.getByText(/\$25/)).toBeInTheDocument();
    expect(screen.getByText('15,400 tokens')).toBeInTheDocument();
    expect(screen.getAllByText('Deploy microkernel containers').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Container cluster health validated')).toBeInTheDocument();
    const closeButtons = screen.getAllByRole('button', { name: /Close Inspector/i });
    expect(closeButtons.length).toBeGreaterThanOrEqual(1);

    // Close Inspector
    fireEvent.click(closeButtons[0]);
    expect(screen.queryByText('Operational State')).not.toBeInTheDocument();
  });
});

