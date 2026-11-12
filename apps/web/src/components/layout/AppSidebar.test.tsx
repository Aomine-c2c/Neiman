import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppSidebar, type AppSidebarProps } from './AppSidebar';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({
    push: mockPush,
  }),
}));

jest.mock('@/store/auth', () => ({
  useAuthStore: () => ({
    activeCompany: { id: 'comp-1', name: 'Neiman Software Org', industry: 'Software' },
  }),
}));

function renderSidebar(props: Partial<AppSidebarProps> = {}) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={qc}>
      <AppSidebar {...props} />
    </QueryClientProvider>
  );
}

describe('AppSidebar — Chat-First Sidebar & Bottom Settings Dock', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders connected repo card, squad roster, and bottom settings icon', () => {
    const onOpenDrawer = jest.fn();
    renderSidebar({
      pendingApprovalsCount: 3,
      activeAgentsCount: 4,
      activeTasksCount: 7,
      onOpenDrawer,
    });

    // Repo card
    expect(screen.getByText('Neiman Software Org')).toBeInTheDocument();
    expect(screen.getByText(/git: main • synced/i)).toBeInTheDocument();

    // Primary Action Bar moved from sidebar to central Chat Column header
    expect(screen.queryByRole('button', { name: /New CTO Chat Thread/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /New Council Debate/i })).not.toBeInTheDocument();

    // Squad Roster
    expect(screen.getByText('Squad (Agents)')).toBeInTheDocument();
    expect(screen.getByText('Chief Technology Agent')).toBeInTheDocument();

    // Domain drawer triggers remain decoupled from sidebar navigation dock
    expect(screen.queryByRole('button', { name: /Pending Approvals/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Tasks & Projects/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Workflows & Pipelines/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Skills & MCP Hub/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Memory & Codebase/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Overview & System Pulse/i })).not.toBeInTheDocument();

    // Clicking a squad member dispatches neiman:mention-agent without crashing
    const mentionSpy = jest.fn();
    window.addEventListener('neiman:mention-agent', mentionSpy);
    fireEvent.click(screen.getByText('Chief Technology Agent'));
    expect(mentionSpy).toHaveBeenCalled();
    window.removeEventListener('neiman:mention-agent', mentionSpy);
  });

  it('toggles collapsed state when collapse button is clicked', () => {
    renderSidebar({ pendingApprovalsCount: 0 });
    const toggleBtn = screen.getByRole('button', { name: /Toggle sidebar collapse/i });
    expect(toggleBtn).toBeInTheDocument();
    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
  });

  it('supports mobile drawer Escape close callback when open', () => {
    const onMobileClose = jest.fn();
    renderSidebar({ mobileOpen: true, onMobileClose });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onMobileClose).toHaveBeenCalled();
  });
});
