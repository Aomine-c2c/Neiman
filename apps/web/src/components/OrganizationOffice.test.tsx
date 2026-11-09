import { fireEvent, render, screen } from '@testing-library/react';
import { getControlRoomPreviewState } from '@/lib/api/controlRoomPreview';
import { PREVIEW_COMPANY } from '@/lib/api/controlRoomPreview';
import { OrganizationOffice } from './OrganizationOffice';

describe('OrganizationOffice', () => {
  const state = getControlRoomPreviewState();

  it('separates provider infrastructure from employees and exposes human review as a room', () => {
    render(
      <OrganizationOffice
        companyName={PREVIEW_COMPANY.name}
        departments={state.departments}
        agents={state.agents}
        projects={state.projects}
        tasks={state.tasks}
        approvals={state.approvals}
        providers={state.providers}
        resources={state.resources}
        memoryItems={state.memories.length}
        activePolicies={state.policies.filter((policy) => policy.is_active).length}
        onOpenGraph={jest.fn()}
      />,
    );

    expect(screen.getByText('Models are connected services, not employees.')).toBeInTheDocument();
    expect(screen.getByText('Claude Sonnet')).toBeInTheDocument();
    expect(screen.getByText('Mara Chen')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Select Human Review Suite' }));
    expect(screen.getByText('1 action waiting for human review')).toBeInTheDocument();
    expect(screen.getByText('HUMAN AUTHORITY')).toBeInTheDocument();
  });

  it('lets the operator inspect a room and an employee without changing organization data', () => {
    render(
      <OrganizationOffice
        companyName={PREVIEW_COMPANY.name}
        departments={state.departments}
        agents={state.agents}
        projects={state.projects}
        tasks={state.tasks}
        approvals={state.approvals}
        providers={state.providers}
        resources={state.resources}
        memoryItems={state.memories.length}
        activePolicies={state.policies.filter((policy) => policy.is_active).length}
        onOpenGraph={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Select Intelligence' }));
    expect(screen.getByText('PEOPLE IN THIS ROOM')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Inspect Noah Williams' }));

    expect(screen.getByText('EMPLOYEE FILE')).toBeInTheDocument();
    expect(screen.getAllByText('Evaluation Specialist')).toHaveLength(2);
    expect(screen.getAllByText('local')).toHaveLength(2);
    expect(state.agents.find((agent) => agent.name === 'Noah Williams')?.status).toBe('BLOCKED');
  });

  it('supports keyboard inspection of employees on the floorplan', () => {
    render(
      <OrganizationOffice
        companyName={PREVIEW_COMPANY.name}
        departments={state.departments}
        agents={state.agents}
        projects={state.projects}
        tasks={state.tasks}
        approvals={state.approvals}
        providers={state.providers}
        resources={state.resources}
        memoryItems={state.memories.length}
        activePolicies={state.policies.filter((policy) => policy.is_active).length}
        onOpenGraph={jest.fn()}
      />,
    );

    fireEvent.keyDown(screen.getByRole('button', { name: /Noah Williams, Evaluation Specialist/ }), { key: 'Enter' });
    expect(screen.getByText('EMPLOYEE FILE')).toBeInTheDocument();
  });

  it('uses the configured department records and flags teams outside the illustrated floor', () => {
    const configuredDepartments = [
      { ...state.departments[0], name: 'Studio' },
      { ...state.departments[1], name: 'Trust Lab' },
      { ...state.departments[2], name: 'Finance' },
      { ...state.departments[2], id: 'fourth-department', name: 'Field Research' },
    ];
    const extraAgent = { ...state.agents[0], id: 'unpictured-agent', name: 'Ari Morgan', department_id: 'fourth-department' };

    render(
      <OrganizationOffice
        companyName={PREVIEW_COMPANY.name}
        departments={configuredDepartments}
        agents={[...state.agents, extraAgent]}
        projects={state.projects}
        tasks={state.tasks}
        approvals={state.approvals}
        providers={state.providers}
        resources={state.resources}
        memoryItems={state.memories.length}
        activePolicies={state.policies.filter((policy) => policy.is_active).length}
        onOpenGraph={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Select Trust Lab' }));
    expect(screen.getByRole('heading', { name: 'Trust Lab' })).toBeInTheDocument();
    expect(screen.getByText('1 EMPLOYEES IN OTHER TEAMS · SEE ORGANIZATION DATA')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ari Morgan/ })).not.toBeInTheDocument();
  });
});
