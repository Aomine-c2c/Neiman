import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CouncilsDashboardPage from './page';
import { councilsApi, type AgentCouncil, type CouncilDeliberation } from '@/lib/api/councils';
import { ctoApi } from '@/lib/api/cto';
import { vcsApi } from '@/lib/api/vcs';
import { useAuthStore } from '@/store/auth';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/dashboard/councils',
}));

jest.mock('@/lib/api/vcs', () => ({
  vcsApi: {
    getStatus: jest.fn(() =>
      Promise.resolve({
        branch: 'main',
        staged_files: [{ path: 'apps/web/src/App.tsx' }],
        unstaged_files: [{ path: 'packages/core/src/index.ts' }],
        untracked_files: ['new-feature.ts'],
      })
    ),
    createCommit: jest.fn(() =>
      Promise.resolve({
        commit_sha: 'abc1234',
        message: 'test commit',
        branch: 'main',
      })
    ),
  },
}));

jest.mock('@/lib/api/councils', () => ({
  councilsApi: {
    list: jest.fn(),
    listDeliberations: jest.fn(),
    create: jest.fn(),
    startDeliberation: jest.fn(),
    ratifyDecision: jest.fn(),
    evaluateQuorum: jest.fn(),
  },
}));

jest.mock('@/lib/api/cto', () => ({
  ctoApi: {
    sendDirective: jest.fn(),
    getProposals: jest.fn(),
    triggerTick: jest.fn(),
  },
}));

const mockCompany = {
  id: 'comp-1',
  name: 'Neiman Software Org',
  slug: 'neiman-software',
  status: 'ACTIVE',
  owner_id: 'u-1',
  created_at: '',
  updated_at: '',
};

const mockCouncil: AgentCouncil = {
  id: 'council-1',
  company_id: 'comp-1',
  name: 'Architecture & Technical Governance Council',
  charter: 'Evaluates system design, multi-model routing, and reliability tradeoffs.',
  is_active: true,
  council_type: 'PERMANENT' as const,
  members: [
    { role_title: 'CTO', agent_name: 'Chief Technology Agent', perspective: 'Architecture', model_identifier: 'claude-sonnet', model_provider: 'anthropic' },
    { role_title: 'Security', agent_name: 'Cybersecurity Agent', perspective: 'Zero-Trust', model_identifier: 'gpt-4o', model_provider: 'openai' },
  ],
  created_at: '',
  updated_at: '',
};

const mockDeliberation: CouncilDeliberation = {
  id: 'delib-1',
  council_id: 'council-1',
  company_id: 'comp-1',
  title: 'Event-Driven Billing Microservice Split',
  problem_statement: 'Should we extract Stripe webhook handling into an isolated worker queue?',
  context_data: {},
  status: 'SYNTHESIZED',
  current_stage: 'SYNTHESIS',
  proposals: [],
  objections: [],
  discussion_threads: [],
  independent_reviews: [
    {
      agent_name: 'Chief Technology Agent',
      role: 'CTO',
      perspective: 'Architecture',
      model: 'claude-sonnet',
      proposal: 'Isolate webhook ingestion behind an idempotent queue to prevent API tail latency.',
      evidence: ['Idempotent event table', 'Retry backoff'],
      risks: ['Queue consumer lag'],
      assumptions: [],
      confidence: 0.92,
      objections: [],
    },
    {
      agent_name: 'Cybersecurity Agent',
      role: 'Security',
      perspective: 'Zero-Trust',
      model: 'gpt-4o',
      proposal: 'Enforce strict HMAC signature verification prior to enqueueing payloads.',
      evidence: ['Raw body HMAC verification'],
      risks: ['Replay attack window'],
      assumptions: [],
      confidence: 0.88,
      objections: ['Replay window must be bounded before rollout'],
    },
  ],
  synthesis_proposal: {
    title: 'Idempotent webhook queue',
    synthesized_decision: 'Adopt an idempotent webhook queue with edge HMAC verification.',
    consensus_points: ['Isolation reduces API tail latency'],
    unresolved_dissent: [],
    recommended_mitigations: [
      'Create webhook_events table with unique event_id constraint',
      'Add Stripe HMAC verification middleware',
    ],
  },
  decision_rationale: 'Balances API reliability with cryptographic replay protection.',
  disagreements_recorded: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockProposal = {
  id: 'prop-1',
  company_id: 'comp-1',
  cto_agent_id: 'agent-1',
  category: 'SECURITY',
  impact_assessment: 'Critical',
  proposed_tasks: [],
  delegated_task_ids: [],
  title: 'AppSec Cryptographic Secret & PII Egress Masking Guardrail',
  rationale: 'Ensure zero API tokens or private user telemetry are transmitted.',
  type: 'ARCHITECTURE',
  priority: 'CRITICAL',
  status: 'PROPOSED' as const,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

function renderCouncilsPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <CouncilsDashboardPage />
    </QueryClientProvider>
  );
}

describe('CouncilsDashboardPage — Stage 4 Unified Conversation + Live Spec/ADR Artifact Pane', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.getState().setActiveCompany(mockCompany);
    jest.mocked(councilsApi.list).mockResolvedValue([mockCouncil]);
    jest.mocked(councilsApi.listDeliberations).mockResolvedValue([mockDeliberation]);
    jest.mocked(ctoApi.getProposals).mockResolvedValue([]);
  });

  it('renders the Unified Conversation thread on the left and the Live Spec/Plan/ADR Artifact Pane on the right', async () => {
    renderCouncilsPage();

    // Wait for deliberation title & agent turns in the conversation thread
    expect(await screen.findByText('Event-Driven Billing Microservice Split', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByText(/Isolate webhook ingestion behind an idempotent queue/i)).toBeInTheDocument();
    expect(screen.getByText(/Enforce strict HMAC signature verification/i)).toBeInTheDocument();

    // Right Pane 3 Vertically Staggered Panels exist: Live Spec, Tasks & Checklist, Decision Record (ADR)
    expect(screen.getByText(/Live Architecture Specification/i)).toBeInTheDocument();
    expect(screen.getByText(/Tasks & Checklist/i)).toBeInTheDocument();
    expect(screen.getByText(/Decision Record \(ADR\)/i)).toBeInTheDocument();

    // Verify action items appear in the Tasks & Checklist staggered panel directly (without tab switching)
    expect(
      screen.getAllByText(/Create webhook_events table with unique event_id constraint/i).length
    ).toBeGreaterThanOrEqual(1);

    // Verify Decision Record text appears in the ADR staggered panel directly
    expect(
      screen.getAllByText(/Adopt an idempotent webhook queue with edge HMAC verification/i).length
    ).toBeGreaterThanOrEqual(1);
  });

  it('handles conversational interactions with CTO without falling back to robotic dispatch text', async () => {
    jest.mocked(councilsApi.listDeliberations).mockResolvedValue([]);
    jest.mocked(ctoApi.sendDirective).mockResolvedValue({
      directive: 'hi',
      cto_agent_name: 'Atlas CTO',
      analysis: 'Hello Operator, system architecture is operating normally. How can I assist?',
      tasks_created_count: 0,
      tasks: [],
      intent: 'CONVERSATION',
    });

    renderCouncilsPage();

    const input = screen.getByRole('textbox', { name: /Send message to CTO and Council/i });
    const sendButton = screen.getByRole('button', { name: /Send/i });

    fireEvent.change(input, { target: { value: 'hi' } });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(ctoApi.sendDirective).toHaveBeenCalledWith('comp-1', {
        directive: 'hi',
        priority: 'HIGH',
      });
    });

    // Conversation thread must display the actual CTO reply, NOT the hardcoded fallback
    expect(
      await screen.findByText(/Hello Operator, system architecture is operating normally/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/Directive accepted — CTO plan dispatched/i)).not.toBeInTheDocument();
  });

  it('updates Live Spec and Tasks when an actionable architectural directive is dispatched', async () => {
    jest.mocked(councilsApi.listDeliberations).mockResolvedValue([]);
    jest.mocked(ctoApi.sendDirective).mockResolvedValue({
      directive: 'Decompose auth service into edge JWT verification',
      cto_agent_name: 'Atlas CTO',
      analysis: 'Decompose auth into edge JWT middleware with distributed Redis revocation cache.',
      tasks_created_count: 2,
      tasks: [
        { id: 't1', title: 'Implement Edge JWT Verification Middleware', priority: 'HIGH' },
        { id: 't2', title: 'Setup Redis Token Blacklist Store', priority: 'HIGH' },
      ],
      intent: 'DIRECTIVE',
    });

    renderCouncilsPage();

    const input = screen.getByRole('textbox', { name: /Send message to CTO and Council/i });
    fireEvent.change(input, { target: { value: 'Decompose auth service into edge JWT verification' } });
    fireEvent.click(screen.getByRole('button', { name: /Send/i }));

    // Verify conversation turn AND Live Spec pane both show the analysis
    const matchingElements = await screen.findAllByText(
      /Decompose auth into edge JWT middleware with distributed Redis revocation cache/i
    );
    expect(matchingElements.length).toBeGreaterThanOrEqual(2);

    // Verify Tasks & Checklist panel updates with extracted tasks directly
    const taskElements1 = await screen.findAllByText(/Implement Edge JWT Verification Middleware/i);
    expect(taskElements1.length).toBeGreaterThanOrEqual(1);
    const taskElements2 = screen.getAllByText(/Setup Redis Token Blacklist Store/i);
    expect(taskElements2.length).toBeGreaterThanOrEqual(1);
  });

  it('renders clear error feedback if CTO directive dispatch fails', async () => {
    jest.mocked(councilsApi.listDeliberations).mockResolvedValue([]);
    jest.mocked(ctoApi.sendDirective).mockRejectedValue(new Error('Intelligence Router timeout'));

    renderCouncilsPage();

    const input = screen.getByRole('textbox', { name: /Send message to CTO and Council/i });
    fireEvent.change(input, { target: { value: 'Test failing directive' } });
    fireEvent.click(screen.getByRole('button', { name: /Send/i }));

    expect(await screen.findByText(/Intelligence Router timeout/i)).toBeInTheDocument();
  });

  it('renders the interactive proposal action card and 4 quick directive chips when no deliberations exist', async () => {
    jest.mocked(councilsApi.listDeliberations).mockResolvedValue([]);
    jest.mocked(ctoApi.getProposals).mockResolvedValue([mockProposal]);

    renderCouncilsPage();

    expect(await screen.findByText(/Active Proposal for Execution/i)).toBeInTheDocument();
    expect(screen.getByText('AppSec Cryptographic Secret & PII Egress Masking Guardrail')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Decompose & Dispatch to Swarm/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Debate with Specialist Council/i })).toBeInTheDocument();

    // 4 directive chips
    expect(screen.getByText('AppSec & Boundary Guardrails')).toBeInTheDocument();
    expect(screen.getByText('High-Availability & Circuit Breakers')).toBeInTheDocument();
    expect(screen.getByText('TDD & Regression Test Automation')).toBeInTheDocument();
    expect(screen.getByText('Schema & Reversible Migrations')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Analyze Codebase & Synthesize Proposals/i })).toBeInTheDocument();
  });

  it('clicking a directive chip immediately dispatches the directive and triggers autonomous supervisor tick', async () => {
    jest.mocked(councilsApi.listDeliberations).mockResolvedValue([]);
    jest.mocked(ctoApi.getProposals).mockResolvedValue([]);
    jest.mocked(ctoApi.sendDirective).mockResolvedValue({
      directive:
        'Audit AST call graphs and implement cryptographic secret and PII egress masking across microservices.',
      cto_agent_name: 'Atlas CTO',
      analysis: 'AST masking pipeline configured across microservice boundaries.',
      tasks_created_count: 2,
      tasks: [],
      intent: 'DIRECTIVE',
    });
    jest.mocked(ctoApi.triggerTick).mockResolvedValue({
      cycle: 1,
      status: 'SUCCESS',
      message: 'Cycle #1 completed',
      executed_tasks: [],
    });

    renderCouncilsPage();

    const chipButton = await screen.findByText('AppSec & Boundary Guardrails');
    fireEvent.click(chipButton);

    await waitFor(() => {
      expect(ctoApi.sendDirective).toHaveBeenCalledWith('comp-1', {
        directive: expect.stringContaining('Audit AST call graphs'),
        priority: 'HIGH',
      });
      expect(ctoApi.triggerTick).toHaveBeenCalledWith('comp-1');
    });

    const elements = await screen.findAllByText(
      /AST masking pipeline configured across microservice boundaries/i
    );
    expect(elements.length).toBeGreaterThanOrEqual(1);
  });

  it('docks domain view directly into Column 3 upon receiving neiman:dock-view event and can return to Spec & ADR', async () => {
    renderCouncilsPage();

    expect(await screen.findByText(/Live Architecture Specification/i)).toBeInTheDocument();
    expect(screen.getByText(/Tasks & Checklist/i)).toBeInTheDocument();
    expect(screen.getByText(/Decision Record \(ADR\)/i)).toBeInTheDocument();

    // Dispatch dock view event for SETTINGS wrapped in act
    act(() => {
      window.dispatchEvent(
        new CustomEvent('neiman:dock-view', { detail: { view: 'SETTINGS' } })
      );
    });

    // Docked header for SETTINGS appears with Spec & ADR back button
    expect(await screen.findByRole('button', { name: /Return to Spec & ADR/i })).toBeInTheDocument();
    expect(screen.getByText('[TOPO]')).toBeInTheDocument();
    expect(screen.getByText(/Administration & Settings/i)).toBeInTheDocument();

    // Click Return to Spec & ADR wrapped in act
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Return to Spec & ADR/i }));
    });

    // Restores default 3 panels
    expect(await screen.findByText(/Live Architecture Specification/i)).toBeInTheDocument();
    expect(screen.getByText(/Tasks & Checklist/i)).toBeInTheDocument();
    expect(screen.getByText(/Decision Record \(ADR\)/i)).toBeInTheDocument();
  });

  it('clicking Board button in Tasks checklist docks Tasks Matrix view into Column 3', async () => {
    renderCouncilsPage();

    expect(await screen.findByText(/Tasks & Checklist/i)).toBeInTheDocument();

    // Click Board button in the checklist header wrapped in act
    const boardBtn = screen.getByRole('button', { name: 'Board' });
    act(() => {
      fireEvent.click(boardBtn);
    });

    // Column 3 switches to docked Tasks Execution Matrix
    expect(await screen.findByRole('button', { name: /Return to Spec & ADR/i })).toBeInTheDocument();
    expect(screen.getByText('[TASKS]')).toBeInTheDocument();
    expect(screen.getByText(/Tasks Execution Matrix/i)).toBeInTheDocument();
  });

  it('renders the integrated Bash terminal below the middle chat column and supports toggling', async () => {
    renderCouncilsPage();

    // The Integrated Terminal dock is present below the chat
    expect(await screen.findByLabelText('Integrated Terminal Dock')).toBeInTheDocument();
    expect(screen.getByLabelText('Integrated Bash Terminal')).toBeInTheDocument();

    // Toggle terminal closed via header button
    const toggleBtn = screen.getByRole('button', { name: /Toggle Integrated Bash Terminal/i });
    act(() => {
      fireEvent.click(toggleBtn);
    });

    // Terminal closes into the collapsed dock bar
    expect(screen.queryByLabelText('Integrated Terminal Dock')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Open Integrated Bash Terminal/i })).toBeInTheDocument();

    // Reopen terminal by clicking the bar
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Open Integrated Bash Terminal/i }));
    });
    expect(await screen.findByLabelText('Integrated Terminal Dock')).toBeInTheDocument();
  });

  it('renders Tasks & Checklist and Git Working Tree side-by-side in Column 3 and supports commit action', async () => {
    renderCouncilsPage();

    // Verify side-by-side headers in Column 3
    expect(await screen.findByText(/Tasks & Checklist/i)).toBeInTheDocument();
    expect(screen.getByText(/Git Working Tree/i)).toBeInTheDocument();

    // Verify Git status chips
    expect(await screen.findByText(/1 modified/i)).toBeInTheDocument();
    expect(screen.getByText(/1 staged/i)).toBeInTheDocument();
    expect(screen.getByText(/1 untracked/i)).toBeInTheDocument();

    // Fill in commit message and submit
    const commitInput = screen.getByPlaceholderText('Commit message…');
    act(() => {
      fireEvent.change(commitInput, { target: { value: 'feat(core): side by side vcs commit' } });
    });

    const commitBtn = screen.getByRole('button', { name: /Commit Changes/i });
    act(() => {
      fireEvent.click(commitBtn);
    });

    await waitFor(() => {
      expect(vcsApi.createCommit).toHaveBeenCalledWith('comp-1', {
        message: 'feat(core): side by side vcs commit',
        author_name: expect.any(String),
      });
    });
  });
});

