import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CouncilsDashboardPage from './page';
import { councilsApi, type AgentCouncil, type CouncilDeliberation } from '@/lib/api/councils';
import { ctoApi } from '@/lib/api/cto';
import { useAuthStore } from '@/store/auth';

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
    expect(await screen.findByText('Event-Driven Billing Microservice Split')).toBeInTheDocument();
    expect(screen.getByText(/Isolate webhook ingestion behind an idempotent queue/i)).toBeInTheDocument();
    expect(screen.getByText(/Enforce strict HMAC signature verification/i)).toBeInTheDocument();

    // Right Pane Artifact Tabs exist: Live Spec & Architecture | Task Breakdown | Decision Record (ADR)
    expect(screen.getByRole('tab', { name: /Live Spec & Architecture/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Task Breakdown/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Decision Record \(ADR\)/i })).toBeInTheDocument();

    // Switch to Task Breakdown tab and verify action items appear
    fireEvent.click(screen.getByRole('tab', { name: /Task Breakdown/i }));
    expect(
      screen.getByText(/Create webhook_events table with unique event_id constraint/i)
    ).toBeInTheDocument();

    // Switch to Decision Record (ADR) tab
    fireEvent.click(screen.getByRole('tab', { name: /Decision Record \(ADR\)/i }));
    expect(
      screen.getByText(/Adopt an idempotent webhook queue with edge HMAC verification/i)
    ).toBeInTheDocument();
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

    // Verify Tasks tab updates with extracted tasks
    fireEvent.click(screen.getByRole('tab', { name: /Task Breakdown/i }));
    expect(await screen.findByText(/Implement Edge JWT Verification Middleware/i)).toBeInTheDocument();
    expect(screen.getByText(/Setup Redis Token Blacklist Store/i)).toBeInTheDocument();
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
});

