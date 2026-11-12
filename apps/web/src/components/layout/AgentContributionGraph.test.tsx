import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AgentContributionGraph } from './AgentContributionGraph';

function renderComponent(props = {}) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={qc}>
      <AgentContributionGraph companyId="comp-1" {...props} />
    </QueryClientProvider>
  );
}

describe('AgentContributionGraph — GitHub-Style Heatmap', () => {
  it('renders Agent Contributions title, total contributions badge, and streak', () => {
    renderComponent();

    expect(screen.getByText(/Agent Contributions/i)).toBeInTheDocument();
    expect(screen.getByText(/total/i)).toBeInTheDocument();
    expect(screen.getByText(/streak/i)).toBeInTheDocument();
  });

  it('renders agent filter chips when expanded and allows filtering by agent', () => {
    const onSelectAgent = jest.fn();
    renderComponent({ onSelectAgent, defaultExpanded: true });

    expect(screen.getByRole('button', { name: /All Agents/i })).toBeInTheDocument();
    const architectBtn = screen.getByRole('button', { name: /Architect/i });
    expect(architectBtn).toBeInTheDocument();

    fireEvent.click(architectBtn);
    expect(onSelectAgent).toHaveBeenCalledWith('architect');
  });

  it('toggles collapse and expand when header toggle is clicked', () => {
    renderComponent({ defaultExpanded: false });

    const expandBtn = screen.getByRole('button', { name: /Expand contribution graph/i });
    expect(expandBtn).toBeInTheDocument();

    fireEvent.click(expandBtn);
    expect(screen.getByRole('button', { name: /Collapse contribution graph/i })).toBeInTheDocument();
    expect(screen.getByText(/All Agents/i)).toBeInTheDocument();
  });

  it('renders compact icon trigger in collapsed mode', () => {
    renderComponent({ collapsed: true });

    expect(screen.getByTitle(/Agent Contribution Graph/i)).toBeInTheDocument();
    expect(screen.queryByText(/Agent Contributions/i)).not.toBeInTheDocument();
  });
});

