import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DecisionsPage from './page';
import { decisionsApi, DecisionRecord } from '@/lib/api/decisions';
import { useAuthStore } from '@/store/auth';

jest.mock('@/lib/api/decisions', () => ({
  decisionsApi: {
    list: jest.fn(),
    create: jest.fn(),
    resolve: jest.fn(),
    recordOutcome: jest.fn(),
  },
}));

const company = {
  id: 'company-1', name: 'Nexora Test Co', slug: 'NEIMAN-test-co', status: 'ACTIVE',
  owner_id: 'user-1', created_at: '', updated_at: '',
};

const record: DecisionRecord = {
  id: 'decision-1', company_id: company.id, title: 'Select a provider',
  problem: 'Which provider should handle high-context analysis?', proposals: [], evidence: [],
  participants: [], decision: null, rationale: null, expected_outcome: 'Reduce review time',
  actual_outcome: null, status: 'OPEN', decided_at: null, decided_by_id: null,
  created_at: '2026-09-30T10:00:00Z', updated_at: '2026-09-30T10:00:00Z',
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><DecisionsPage /></QueryClientProvider>);
}

describe('DecisionsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.getState().setActiveCompany(company);
    jest.mocked(decisionsApi.list).mockResolvedValue([]);
  });

  it('loads and filters live decision records by status and search text', async () => {
    jest.mocked(decisionsApi.list).mockResolvedValue([record]);
    renderPage();

    expect(await screen.findByText('Select a provider')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Filter by status'), { target: { value: 'EVALUATED' } });
    expect(screen.getByText('No matching decisions')).toBeInTheDocument();
  });

  it('creates a decision record with the entered problem statement', async () => {
    jest.mocked(decisionsApi.create).mockResolvedValue(record);
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'New decision' }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Select a provider' } });
    fireEvent.change(screen.getByLabelText('Problem'), { target: { value: 'Which provider should handle high-context analysis?' } });
    fireEvent.change(screen.getByLabelText('Expected outcome'), { target: { value: 'Reduce review time' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create record' }));

    await waitFor(() => expect(decisionsApi.create).toHaveBeenCalledWith(company.id, {
      title: 'Select a provider',
      problem: 'Which provider should handle high-context analysis?',
      expected_outcome: 'Reduce review time',
    }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
