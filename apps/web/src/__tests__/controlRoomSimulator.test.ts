import {
  SCENARIO_DEFINITIONS,
  applyScenarioToState,
  type OperationalScenarioKey,
} from '@/components/control-room/ScenarioSimulator';
import {
  ROLE_PRESETS,
  DEFAULT_LAYOUT,
} from '@/components/control-room/CanvasLayoutManager';
import { GLOBAL_COMMANDS } from '@/components/layout/CommandPalette';
import type { ControlRoomState } from '@/lib/api/controlRoom';

describe('NEIMAN Control Room Operational Scenarios', () => {
  const mockBaseState: ControlRoomState = {
    company_id: 'test_co',
    agents: [
      {
        id: 'agent-atlas',
        company_id: 'test_co',
        name: 'Atlas (Chief Architect)',
        status: 'WORKING',
        autonomy: 'AUTONOMOUS',
        identity: {},
        responsibilities: ['Architecture deliberation'],
        goals: ['Maintain 99.9% uptime'],
        capabilities: ['Code synthesis'],
        permissions: {},
        tools: [],
        intelligence_config: { model: 'Claude 3.5 Sonnet' },
        resource_limits: {},
        resource_usage: {},
        performance_metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'agent-sentinel',
        company_id: 'test_co',
        name: 'Sentinel (Security Lead)',
        status: 'ACTIVE',
        autonomy: 'AUTONOMOUS',
        identity: {},
        responsibilities: ['Perimeter inspection'],
        goals: ['Zero breach tolerance'],
        capabilities: ['Network isolation'],
        permissions: {},
        tools: [],
        intelligence_config: { model: 'Gemini 1.5 Pro' },
        resource_limits: {},
        resource_usage: {},
        performance_metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    departments: [],
    roles: [],
    projects: [],
    tasks: [
      { id: 't1', project_id: 'p1', title: 'Task Alpha', status: 'IN_PROGRESS', priority: 'HIGH', created_at: '', updated_at: '' },
      { id: 't2', project_id: 'p1', title: 'Task Beta', status: 'PENDING', priority: 'MEDIUM', created_at: '', updated_at: '' },
    ],
    approvals: [],
    audits: [],
    resources: {
      compute_used_pct: 28.4,
      memory_used_gb: 4.8,
      memory_limit_gb: 16.0,
      token_usage_total: 42800,
      intelligence_cost_usd: 14200,
      budget_allocated_usd: 50000,
      budget_spent_usd: 14200,
    },
    decisions: [],
    policies: [],
    memories: [],
    providers: [
      { id: 'p1', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', status: 'ONLINE', active_requests: 4, avg_latency_ms: 240, total_tokens: 42000, cost_usd: 12 },
    ],
    activity: [],
    evolutionProposals: [],
    unavailableSections: [],
  };

  test('defines all 11 real operational interface scenarios', () => {
    const requiredScenarios: OperationalScenarioKey[] = [
      'NORMAL_OPERATIONS',
      'HIGH_ACTIVITY',
      'PROVIDER_DEGRADATION',
      'AGENT_FAILURE',
      'BLOCKED_WORKFLOW',
      'RESOURCE_PRESSURE',
      'PENDING_APPROVAL',
      'SECURITY_INCIDENT',
      'EVOLUTION_PROPOSAL',
      'EMPTY_ORGANIZATION',
      'RECONNECTING_OFFLINE',
    ];

    expect(Object.keys(SCENARIO_DEFINITIONS)).toHaveLength(11);
    requiredScenarios.forEach((sc) => {
      expect(SCENARIO_DEFINITIONS[sc]).toBeDefined();
      expect(SCENARIO_DEFINITIONS[sc].cognitionStatus).toBeTruthy();
    });
  });

  test('applies PROVIDER_DEGRADATION scenario with circuit breaker rerouting', () => {
    const res = applyScenarioToState(mockBaseState, 'PROVIDER_DEGRADATION');
    expect(res.isSimulated).toBe(true);
    expect(res.definition.alertBanner?.title).toContain('GATEWAY DEGRADATION');
    const claude = res.state.providers.find((p) => p.name.includes('Claude'));
    expect(claude?.status).toBe('DEGRADED');
    expect(res.state.activity[0].event_type).toBe('provider_switched');
  });

  test('applies AGENT_FAILURE scenario and isolates worker', () => {
    const res = applyScenarioToState(mockBaseState, 'AGENT_FAILURE');
    expect(res.state.agents[0].status).toBe('FAILED');
    expect(res.definition.severity).toBe('critical');
    expect(res.state.activity[0].event_type).toBe('task_failed');
  });

  test('applies SECURITY_INCIDENT scenario with threat quarantine alert', () => {
    const res = applyScenarioToState(mockBaseState, 'SECURITY_INCIDENT');
    expect(res.definition.alertBanner?.title).toContain('SECURITY PERIMETER BREACH');
    expect(res.state.activity[0].title).toContain('Sentinel');
  });

  test('applies EVOLUTION_PROPOSAL scenario with synthesized adaptation', () => {
    const res = applyScenarioToState(mockBaseState, 'EVOLUTION_PROPOSAL');
    expect(res.state.evolutionProposals.length).toBeGreaterThan(0);
    expect(res.state.evolutionProposals[0].adaptation_type).toBe('CHANGE_MODEL_ROUTING');
    expect(res.state.activity[0].event_type).toBe('evolution_proposed');
  });
});

describe('NEIMAN Canvas Layout Manager Presets', () => {
  test('provides all 4 core role presets', () => {
    expect(ROLE_PRESETS.FOUNDER).toBeDefined();
    expect(ROLE_PRESETS.ENGINEERING).toBeDefined();
    expect(ROLE_PRESETS.SECURITY).toBeDefined();
    expect(ROLE_PRESETS.OPERATIONS).toBeDefined();
  });

  test('configures appropriate visibility per role', () => {
    expect(ROLE_PRESETS.FOUNDER.visibility.executiveGate).toBe(true);
    expect(ROLE_PRESETS.ENGINEERING.visibility.activity).toBe(true);
    expect(ROLE_PRESETS.SECURITY.visibility.executiveGate).toBe(true);
    expect(ROLE_PRESETS.OPERATIONS.visibility.systemHealth).toBe(true);
  });
});

describe('NEIMAN Command Hub Queries', () => {
  test('contains only verified navigation and operational drawer actions without fake hardcoded query strings', () => {
    expect(GLOBAL_COMMANDS.length).toBeGreaterThanOrEqual(8);
    expect(GLOBAL_COMMANDS.some((cmd) => cmd.id === 'cmd-neiman-setup')).toBe(true);
    expect(GLOBAL_COMMANDS.some((cmd) => cmd.id === 'cmd-search-agents')).toBe(true);
    expect(GLOBAL_COMMANDS.some((cmd) => cmd.id === 'cmd-create-task')).toBe(true);
    expect(GLOBAL_COMMANDS.some((cmd) => cmd.id === 'cmd-view-approvals')).toBe(true);
    expect(GLOBAL_COMMANDS.some((cmd) => cmd.title === 'Inspect Atlas')).toBe(false);
    expect(GLOBAL_COMMANDS.some((cmd) => cmd.title === 'Move this task to Gemini')).toBe(false);
  });
});
