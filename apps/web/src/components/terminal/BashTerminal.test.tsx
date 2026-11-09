import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BashTerminal } from './BashTerminal';
import { terminalApi } from '@/lib/api/terminal';

jest.mock('@/lib/api/terminal', () => ({
  terminalApi: {
    listSessions: jest.fn(),
    createSession: jest.fn(),
    getSession: jest.fn(),
    deleteSession: jest.fn(),
    execCommand: jest.fn(),
    resize: jest.fn(),
    sendSignal: jest.fn(),
    getHistory: jest.fn(),
    getWebSocketUrl: jest.fn(() => 'ws://localhost:8000/api/v1/terminal/ws'),
  },
}));

const mockSessions = [
  {
    id: 'sess-1',
    company_id: 'comp-1',
    title: 'Terminal 1 (bash)',
    working_dir: '/home/devine-general/Projects/Sila',
    created_at: new Date().toISOString(),
    is_active: true,
    pid: 12345,
    cols: 120,
    rows: 34,
  },
  {
    id: 'sess-2',
    company_id: 'comp-1',
    title: 'Terminal 2 (bash)',
    working_dir: '/tmp',
    created_at: new Date().toISOString(),
    is_active: true,
    pid: 12346,
    cols: 120,
    rows: 34,
  },
];

function renderTerminal() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <BashTerminal companyId="comp-1" initialSessionId="sess-1" />
    </QueryClientProvider>
  );
}

describe('BashTerminal — Integrated Bash Terminal Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(terminalApi.listSessions).mockResolvedValue(mockSessions);
    jest.mocked(terminalApi.getHistory).mockResolvedValue({
      session_id: 'sess-1',
      history: ['ls -la', 'git status'],
      backlog: '=== NEIMAN Sovereign Integrated Bash Terminal ===\n',
    });
  });

  it('renders session tabs, quick action bar, and command input', async () => {
    renderTerminal();

    expect(await screen.findByText('Terminal 1 (bash)')).toBeInTheDocument();
    expect(screen.getByText('Terminal 2 (bash)')).toBeInTheDocument();

    // Quick command buttons
    expect(screen.getByText('git status')).toBeInTheDocument();
    expect(screen.getByText('ls -la')).toBeInTheDocument();

    // Terminal command input
    expect(screen.getByPlaceholderText(/Type a bash command/i)).toBeInTheDocument();
  });

  it('executes command when Enter is pressed and displays output', async () => {
    jest.mocked(terminalApi.execCommand).mockResolvedValue({
      session_id: 'sess-1',
      command: 'echo "TEST_OUTPUT"',
      exit_code: 0,
      stdout: 'TEST_OUTPUT\n',
      stderr: '',
      working_dir: '/home/devine-general/Projects/Sila',
      duration_ms: 12.5,
    });

    renderTerminal();

    const input = await screen.findByPlaceholderText(/Type a bash command/i);
    fireEvent.change(input, { target: { value: 'echo "TEST_OUTPUT"' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(terminalApi.execCommand).toHaveBeenCalledWith(
        'comp-1',
        'sess-1',
        'echo "TEST_OUTPUT"'
      );
    });

    expect(await screen.findByText(/TEST_OUTPUT/i)).toBeInTheDocument();
  });

  it('clears output buffer when Clear button is clicked', async () => {
    renderTerminal();

    expect(await screen.findByText(/NEIMAN Sovereign Integrated Bash Terminal/i)).toBeInTheDocument();

    const clearBtn = screen.getByRole('button', { name: /Clear Terminal/i });
    fireEvent.click(clearBtn);

    expect(screen.queryByText(/NEIMAN Sovereign Integrated Bash Terminal/i)).not.toBeInTheDocument();
  });
});

