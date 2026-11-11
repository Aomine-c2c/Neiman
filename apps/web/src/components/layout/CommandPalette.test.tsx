import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { CommandPalette } from './CommandPalette';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

jest.mock('@/store/auth', () => ({
  useAuthStore: () => ({
    user: { id: 'u1', username: 'operator', is_superuser: true },
    activeCompany: { id: 'c1', name: 'Neiman Corp' },
  }),
}));

describe('CommandPalette', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not render when closed', () => {
    const { container } = render(<CommandPalette isOpen={false} onClose={jest.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders and lists command items when open', () => {
    render(<CommandPalette isOpen={true} onClose={jest.fn()} />);
    expect(screen.getByRole('dialog', { name: /Command Palette/i })).toBeInTheDocument();
    expect(screen.getByText('Control Room')).toBeInTheDocument();
    expect(screen.getByText('Departments')).toBeInTheDocument();
    expect(screen.getByText('Simulation Lab')).toBeInTheDocument();
  });

  it('filters command items based on user search query', () => {
    render(<CommandPalette isOpen={true} onClose={jest.fn()} />);
    const input = screen.getByPlaceholderText(/Type a command or query/i);

    fireEvent.change(input, { target: { value: 'Simulation' } });

    expect(screen.getByText('Simulation Lab')).toBeInTheDocument();
    expect(screen.queryByText('Control Room')).not.toBeInTheDocument();
  });

  it('includes live dynamic agents, tasks, and pending approvals in search results when provided', () => {
    render(
      <CommandPalette
        isOpen={true}
        onClose={jest.fn()}
        agents={[
          {
            id: 'ag-1',
            company_id: 'c1',
            name: 'Sentinel-Prime',
            status: 'WORKING',
            autonomy: 'AUTONOMOUS',
            identity: {},
            responsibilities: [],
            goals: [],
            capabilities: [],
            permissions: {},
            tools: [],
            intelligence_config: {},
            resource_limits: {},
            resource_usage: {},
            performance_metadata: {},
            created_at: '',
            updated_at: '',
          },
        ]}
        tasks={[
          {
            id: 't-1',
            title: 'Audit Kernel Enclave',
            status: 'IN_PROGRESS',
            priority: 'HIGH',
            project_id: 'p1',
            created_at: '',
            updated_at: '',
          },
        ]}
        approvals={[
          {
            id: 'ap-1',
            company_id: 'c1',
            action_type: 'DEPLOY_PROD',
            reason: 'Release v2',
            risk_level: 'HIGH',
            status: 'PENDING',
            target_resource: 'cluster-01',
            created_at: '',
          },
        ]}
      />
    );

    const input = screen.getByPlaceholderText(/Type a command or query/i);
    fireEvent.change(input, { target: { value: 'Sentinel-Prime' } });
    expect(screen.getByText(/Inspect Agent: Sentinel-Prime/i)).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'Audit Kernel Enclave' } });
    expect(screen.getByText(/Task: Audit Kernel Enclave/i)).toBeInTheDocument();
  });

  it('triggers onClose when ESC key is pressed', () => {
    const onCloseMock = jest.fn();
    render(<CommandPalette isOpen={true} onClose={onCloseMock} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it('filters and activates visual theme commands', () => {
    render(<CommandPalette isOpen={true} onClose={jest.fn()} />);
    const input = screen.getByPlaceholderText(/Type a command or query/i);

    fireEvent.change(input, { target: { value: 'theme' } });
    expect(screen.getByText('Toggle Visual Theme (Light / Dark Mode)')).toBeInTheDocument();
    expect(screen.getByText('Switch to Dark Mode (Obsidian Cyber-Glow)')).toBeInTheDocument();
    expect(screen.getByText('Switch to Light Mode (Clean Alabaster)')).toBeInTheDocument();
  });
});
