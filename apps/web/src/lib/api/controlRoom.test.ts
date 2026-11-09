import { invalidateApiCache } from './client';
import { controlRoomApi } from './controlRoom';
import { getControlRoomPreviewState } from './controlRoomPreview';

describe('controlRoomApi.getOperationalState', () => {
  afterEach(() => {
    invalidateApiCache();
    Reflect.deleteProperty(global, 'fetch');
  });

  it('serves only the labeled synthetic fixture in explicit development preview without network access', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalBypass = process.env.NEXT_PUBLIC_NEIMAN_DEV_AUTH_BYPASS;
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'development', configurable: true });
    process.env.NEXT_PUBLIC_NEIMAN_DEV_AUTH_BYPASS = 'true';
    const fetchSpy = jest.fn();
    Object.defineProperty(global, 'fetch', { value: fetchSpy, configurable: true });

    try {
      const result = await controlRoomApi.getOperationalState('preview-company-NEIMAN');

      expect(result).toEqual(getControlRoomPreviewState());
      expect(result.company_id).toBe('preview-company-NEIMAN');
      expect(result.agents).toHaveLength(4);
      expect(result.tasks.map((task) => task.status)).toContain('BLOCKED');
      expect(result.providers.map((provider) => provider.provider)).toEqual(['anthropic', 'google', 'local']);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      if (originalNodeEnv === undefined) Reflect.deleteProperty(process.env, 'NODE_ENV');
      else Object.defineProperty(process.env, 'NODE_ENV', { value: originalNodeEnv, configurable: true });
      if (originalBypass === undefined) Reflect.deleteProperty(process.env, 'NEXT_PUBLIC_NEIMAN_DEV_AUTH_BYPASS');
      else process.env.NEXT_PUBLIC_NEIMAN_DEV_AUTH_BYPASS = originalBypass;
    }
  });

  it('does not fabricate tasks, providers, memories, or resource telemetry when none are returned', async () => {
    const fetchSpy = jest.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path.includes('/resources/control-center')) {
        return { ok: false, status: 503, statusText: 'Unavailable', json: async () => ({ detail: 'Unavailable' }) } as Response;
      }
      if (path.endsWith('/projects')) {
        return { ok: true, status: 200, json: async () => [{ id: 'project-1', title: 'Actual project' }] } as Response;
      }
      return { ok: true, status: 200, json: async () => [] } as Response;
    });
    Object.defineProperty(global, 'fetch', { value: fetchSpy, configurable: true });

    const result = await controlRoomApi.getOperationalState('company-1');

    expect(result.tasks).toEqual([]);
    expect(result.providers).toEqual([]);
    expect(result.memories).toEqual([]);
    expect(result.resources).toEqual({
      compute_used_pct: null,
      memory_used_gb: null,
      memory_limit_gb: null,
      token_usage_total: null,
      intelligence_cost_usd: null,
      budget_allocated_usd: null,
      budget_spent_usd: null,
    });
    expect(result.unavailableSections).toContain('resource telemetry');
    expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('/projects/project-1/tasks'), expect.any(Object));
  });

  it('normalizes backend ApprovalRequestResponse (action/target/title) into action_type/target_resource and posts decision/reviewer_notes', async () => {
    const fetchSpy = jest.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path.includes('/governance/approvals?status=PENDING')) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              id: 'approval-backend-1',
              company_id: 'company-1',
              title: 'Approval needed for EXECUTE_TASK',
              action: 'EXECUTE_TASK',
              target: 'Task:47a638fe',
              risk_level: 'HIGH',
              status: 'PENDING',
              reason: 'Autonomous execution gate',
              proposed_payload: { env: 'prod' },
              created_at: '2026-11-04T20:00:00Z',
            },
          ],
        } as Response;
      }
      if (path.includes('/governance/approvals/approval-backend-1/decision')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: 'approval-backend-1', status: 'APPROVED' }),
        } as Response;
      }
      return { ok: true, status: 200, json: async () => [] } as Response;
    });
    Object.defineProperty(global, 'fetch', { value: fetchSpy, configurable: true });

    const state = await controlRoomApi.getOperationalState('company-1');
    expect(state.approvals).toHaveLength(1);
    expect(state.approvals[0].action_type).toBe('EXECUTE_TASK');
    expect(state.approvals[0].target_resource).toBe('Task:47a638fe');

    await controlRoomApi.decideApproval('company-1', 'approval-backend-1', 'APPROVED', 'Verified safe');
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/companies/company-1/governance/approvals/approval-backend-1/decision'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          decision: 'APPROVED',
          reviewer_notes: 'Verified safe',
        }),
      }),
    );
  });

  it('maps system_host_telemetry into resources and sorts configured/active primary providers first', async () => {
    const fetchSpy = jest.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path.includes('/resources/control-center')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            company_id: 'company-1',
            capacities: [],
            budget_consumption: {
              total_budget_usd: 500,
              spent_budget_usd: 18.5,
            },
            system_host_telemetry: {
              metric_state: 'OBSERVED',
              cpu_cores_available: 8,
              load_average: [2.0, 1.5, 1.2],
              storage_total_gb: 512,
              storage_free_gb: 256,
              ram_total_mb: 16384,
              gpu_detected: false,
            },
          }),
        } as Response;
      }
      if (path.includes('/intelligence/dashboard')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            total_requests: 12,
            total_tokens_consumed: 24500,
            total_spend_usd: 0.42,
            avg_latency_ms: 210,
            overall_success_rate: 1.0,
            providers_count: 3,
            models_count: 5,
            healthy_providers_count: 2,
            active_provider: 'google_gemini',
            active_model: 'gemini-3.5-flash',
            active_provider_display: 'Google Gemini',
            fallback_chain: ['gemini-3.5-flash', 'claude-3-5-sonnet', 'deepseek-reasoner'],
            recent_routing_decisions: [],
            available_providers: [
              {
                id: 'p-unconf',
                name: 'zero_one_ai',
                display_name: '01.AI (Yi)',
                is_configured: false,
                is_local: false,
                is_active: true,
                is_healthy: false,
                consecutive_failures: 0,
                created_at: '2026-11-04T00:00:00Z',
              },
              {
                id: 'p-claude',
                name: 'anthropic',
                display_name: 'Anthropic Claude',
                is_configured: true,
                is_local: false,
                is_active: true,
                is_healthy: true,
                consecutive_failures: 0,
                created_at: '2026-11-04T00:00:00Z',
              },
              {
                id: 'p-gemini',
                name: 'google_gemini',
                display_name: 'Google Gemini',
                is_configured: true,
                is_local: false,
                is_active: true,
                is_healthy: true,
                consecutive_failures: 0,
                created_at: '2026-11-04T00:00:00Z',
              },
            ],
            available_models: [],
          }),
        } as Response;
      }
      return { ok: true, status: 200, json: async () => [] } as Response;
    });
    Object.defineProperty(global, 'fetch', { value: fetchSpy, configurable: true });

    const state = await controlRoomApi.getOperationalState('company-1');
    expect(state.resources.compute_used_pct).toBe(25);
    expect(state.resources.memory_limit_gb).toBe(16);
    expect(state.resources.memory_used_gb).toBeGreaterThan(0);
    expect(state.providers.map((p) => p.provider)).toEqual([
      'google_gemini',
      'anthropic',
      'zero_one_ai',
    ]);
    expect(state.providers[0].is_primary).toBe(true);
    expect(state.providers[0].is_configured).toBe(true);
    expect(state.providers[2].is_configured).toBe(false);
    expect(state.activeModel).toBe('gemini-3.5-flash');
    expect(state.fallbackChain).toEqual(['gemini-3.5-flash', 'claude-3-5-sonnet', 'deepseek-reasoner']);
  });
});
