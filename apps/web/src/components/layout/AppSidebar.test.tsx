import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppSidebar } from './AppSidebar';

jest.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}));

jest.mock('@/store/auth', () => ({
  useAuthStore: () => ({
    activeCompany: { id: 'comp-1', name: 'Neiman Software Org', industry: 'Software' },
  }),
}));

describe('AppSidebar — 7 Core Engineering Views', () => {
  it('renders all 7 core engineering navigation views and pending approvals trigger', () => {
    const onOpenApprovals = jest.fn();
    render(
      <AppSidebar
        pendingApprovalsCount={3}
        activeAgentsCount={4}
        activeTasksCount={7}
        onOpenApprovals={onOpenApprovals}
      />
    );

    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('CTO & Councils')).toBeInTheDocument();
    expect(screen.getByText('Tasks & Projects')).toBeInTheDocument();
    expect(screen.getByText('Squad (Agents)')).toBeInTheDocument();
    expect(screen.getByText('Workflows & Pipelines')).toBeInTheDocument();
    expect(screen.getByText('Skills & MCP Hub')).toBeInTheDocument();
    expect(screen.getByText('Execution Runtime')).toBeInTheDocument();
    expect(screen.getByText('Memory & Codebase')).toBeInTheDocument();
    expect(screen.getByText('Settings & Models')).toBeInTheDocument();

    const approvalsBtn = screen.getByRole('button', { name: /Pending Approvals/i });
    expect(approvalsBtn).toBeInTheDocument();
    expect(approvalsBtn).toHaveTextContent('3');

    fireEvent.click(approvalsBtn);
    expect(onOpenApprovals).toHaveBeenCalledTimes(1);
  });

  it('toggles collapsed state when collapse button is clicked', () => {
    render(<AppSidebar pendingApprovalsCount={0} />);
    const toggleBtn = screen.getByRole('button', { name: /Toggle sidebar collapse/i });
    expect(toggleBtn).toBeInTheDocument();
    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
  });
});
