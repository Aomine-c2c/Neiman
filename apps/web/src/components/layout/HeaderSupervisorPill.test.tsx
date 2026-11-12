import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HeaderSupervisorPill } from './HeaderSupervisorPill';
import { ctoApi } from '@/lib/api/cto';

jest.mock('@/lib/api/cto', () => ({
  ctoApi: {
    getSupervisorStatus: jest.fn(),
    getProposals: jest.fn(),
    toggleSupervisor: jest.fn(),
    triggerTick: jest.fn(),
  },
}));

jest.mock('@/lib/organizationContext', () => ({
  useOrganizationContext: () => ({ id: 'company-1', name: 'Neiman Corp' }),
}));

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('HeaderSupervisorPill', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders live supervisor paused status, cycle counter, and pending proposal badge', async () => {
    jest.mocked(ctoApi.getSupervisorStatus).mockResolvedValue({
      company_id: 'company-1',
      is_running: false,
      state: 'PAUSED',
      active_cycle: 7,
      last_tick_at: null,
      pending_tasks_count: 3,
      in_progress_tasks_count: 1,
      completed_tasks_count: 5,
      active_task: null,
      is_daemon_active: false,
      recent_events: [],
    });
    jest.mocked(ctoApi.getProposals).mockResolvedValue([
      {
        id: 'prop-1',
        company_id: 'company-1',
        cto_agent_id: 'cto-1',
        title: 'Refactor Auth Middleware',
        category: 'ARCHITECTURE',
        rationale: 'Reduce latency',
        impact_assessment: 'Low risk',
        status: 'PROPOSED',
        proposed_tasks: [],
        delegated_task_ids: [],
        created_at: new Date().toISOString(),
      },
    ]);

    renderWithClient(<HeaderSupervisorPill />);

    expect(await screen.findByText(/CYC:07/i)).toBeInTheDocument();
    expect(screen.getByText(/PAUSED/i)).toBeInTheDocument();
    expect(screen.getByText(/1 PROP/i)).toBeInTheDocument();
  });

  it('invokes toggleSupervisor(PLAY) when Play button is clicked and triggerTick when Step Tick is clicked', async () => {
    jest.mocked(ctoApi.getSupervisorStatus).mockResolvedValue({
      company_id: 'company-1',
      is_running: false,
      state: 'PAUSED',
      active_cycle: 2,
      last_tick_at: null,
      pending_tasks_count: 1,
      in_progress_tasks_count: 0,
      completed_tasks_count: 0,
      active_task: null,
      is_daemon_active: false,
      recent_events: [],
    });
    jest.mocked(ctoApi.getProposals).mockResolvedValue([]);
    jest.mocked(ctoApi.toggleSupervisor).mockResolvedValue({
      company_id: 'company-1',
      is_running: true,
      state: 'PLAYING',
      active_cycle: 2,
      last_tick_at: null,
      pending_tasks_count: 1,
      in_progress_tasks_count: 1,
      completed_tasks_count: 0,
      active_task: null,
      is_daemon_active: true,
      recent_events: [],
    });
    jest.mocked(ctoApi.triggerTick).mockResolvedValue({
      cycle: 3,
      status: 'SUCCESS',
      message: 'Executed 1 task',
      executed_tasks: [],
    });

    renderWithClient(<HeaderSupervisorPill />);

    const playBtn = await screen.findByRole('button', { name: /Start Autonomous Supervisor/i });
    fireEvent.click(playBtn);

    await waitFor(() => {
      expect(ctoApi.toggleSupervisor).toHaveBeenCalledWith('company-1', 'PLAY');
    });

    const tickBtn = screen.getByRole('button', { name: /Step Single Supervisor Cycle/i });
    fireEvent.click(tickBtn);

    await waitFor(() => {
      expect(ctoApi.triggerTick).toHaveBeenCalledWith('company-1');
    });
  });
});

