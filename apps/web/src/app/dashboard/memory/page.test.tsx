import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import MemoryPage from './page';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@/lib/api', () => ({
  memoryApi: {
    listItems: jest.fn().mockResolvedValue([]),
    createItem: jest.fn(),
    assembleContext: jest.fn(),
  },
  decisionApi: {
    list: jest.fn().mockResolvedValue([]),
    recordOutcome: jest.fn(),
  },
  projectApi: {
    list: jest.fn().mockResolvedValue([]),
  },
  agentApi: {
    list: jest.fn().mockResolvedValue([]),
  },
  workflowApi: {
    list: jest.fn().mockResolvedValue([]),
  },
  governanceApi: {
    getConstitution: jest.fn().mockResolvedValue(null),
  },
}));

describe('MemoryPage (Stage 8 — Memory & Codebase Index)', () => {
  it('renders Semantic Search Bar, Re-index Codebase action, and Primary 2-Tab switcher (Codebase Topology & Engineering Memory & ADRs)', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryPage />
      </QueryClientProvider>
    );

    expect(screen.getByPlaceholderText(/Ask about architecture, modules, symbols, or past ADRs/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Re-index Codebase/i })).toBeInTheDocument();

    const topologyTab = screen.getByRole('button', { name: /Codebase Topology/i });
    const memoryAdrTab = screen.getByRole('button', { name: /Engineering Memory & ADRs/i });

    expect(topologyTab).toBeInTheDocument();
    expect(memoryAdrTab).toBeInTheDocument();

    fireEvent.click(topologyTab);
    expect(screen.getByText(/Codebase AST Pre-Index/i)).toBeInTheDocument();
  });
});

