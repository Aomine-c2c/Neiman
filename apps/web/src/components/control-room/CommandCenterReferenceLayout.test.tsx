import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CommandCenterReferenceLayout } from "./CommandCenterReferenceLayout";
import type { ControlRoomState } from "@/lib/api/controlRoom";
import { DEFAULT_LAYOUT, type LayoutSettings } from "./CanvasLayoutManager";
import { ctoApi } from "@/lib/api/cto";
import { intelligenceApi } from "@/lib/api/intelligence";

jest.mock("@/lib/api/cto", () => ({
  ctoApi: {
    sendDirective: jest.fn(),
    getProposals: jest.fn(),
    decideProposal: jest.fn(),
    triggerTick: jest.fn(),
    toggleSupervisor: jest.fn(),
  },
}));

jest.mock("@/lib/api/intelligence", () => ({
  intelligenceApi: {
    configureProvider: jest.fn(),
  },
}));

const emptyState: ControlRoomState = {
  company_id: "company-1",
  agents: [],
  departments: [],
  roles: [],
  projects: [],
  tasks: [],
  approvals: [],
  audits: [],
  resources: {
    compute_used_pct: null,
    memory_used_gb: null,
    memory_limit_gb: null,
    token_usage_total: null,
    intelligence_cost_usd: null,
    budget_allocated_usd: null,
    budget_spent_usd: null,
  },
  decisions: [],
  policies: [],
  memories: [],
  providers: [],
  activity: [],
  evolutionProposals: [],
  unavailableSections: [],
};

function renderCommandCenter(
  stateOverride: Partial<ControlRoomState> = {},
  layoutOverride?: LayoutSettings,
  onDecideApproval = jest.fn(),
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <CommandCenterReferenceLayout
        companyId="company-1"
        companyName="Neiman Co"
        state={{ ...emptyState, ...stateOverride }}
        connection="CONNECTED"
        transport="WebSocket"
        layout={layoutOverride}
        onDecideApproval={onDecideApproval}
      />
    </QueryClientProvider>,
  );
}

describe("CommandCenterReferenceLayout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(ctoApi.getProposals).mockResolvedValue([]);
  });

  it("renders the live command-center panels and reports unavailable telemetry honestly", () => {
    renderCommandCenter();

    expect(screen.getByText("Swarm workforce (0)")).toBeInTheDocument();
    expect(
      screen.getByText("CTO directives & interaction console"),
    ).toBeInTheDocument();
    expect(screen.getByText("Live audit telemetry")).toBeInTheDocument();
    expect(screen.getByText("No workforce data available")).toBeInTheDocument();
    expect(screen.getAllByText("Unavailable").length).toBeGreaterThan(0);
  });

  it("submits directives and displays the server response in the CTO console", async () => {
    jest.mocked(ctoApi.sendDirective).mockResolvedValue({
      directive_id: "directive-1",
      cto_agent_id: "agent-cto",
      cto_agent_name: "CTO",
      primary_project_id: "project-1",
      tasks_created_count: 1,
      tasks: [],
      summary: "Created one planning task.",
    });
    renderCommandCenter();

    fireEvent.change(
      screen.getByRole("textbox", { name: "Send a CTO directive" }),
      {
        target: { value: "Plan the next release" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "Send directive" }));

    await waitFor(() =>
      expect(ctoApi.sendDirective).toHaveBeenCalledWith("company-1", {
        directive: "Plan the next release",
        priority: "HIGH",
      }),
    );
    expect(
      await screen.findByText("Created one planning task."),
    ).toBeInTheDocument();
    expect(screen.getByText("Plan the next release")).toBeInTheDocument();
  });

  it("executes slash commands (/tick, /approve-all) directly in the CTO console", async () => {
    jest.mocked(ctoApi.triggerTick).mockResolvedValue({
      cycle: 4,
      status: "SUCCESS",
      message: "Completed cycle 4 with 2 tasks",
      executed_tasks: [],
    });

    const onDecideApproval = jest.fn();
    renderCommandCenter(
      {
        approvals: [
          {
            id: "app-1",
            company_id: "company-1",
            action_type: "DEPLOY_PROD",
            reason: "Release hotfix",
            risk_level: "HIGH",
            status: "PENDING",
            target_resource: "prod-k8s",
            created_at: new Date().toISOString(),
          },
        ],
      },
      undefined,
      onDecideApproval,
    );

    const input = screen.getByRole("textbox", { name: "Send a CTO directive" });

    fireEvent.change(input, { target: { value: "/tick" } });
    fireEvent.click(screen.getByRole("button", { name: "Send directive" }));

    await waitFor(() => {
      expect(ctoApi.triggerTick).toHaveBeenCalledWith("company-1");
    });
    expect(
      await screen.findByText(/Completed cycle 4 with 2 tasks/i),
    ).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "/approve-all" } });
    fireEvent.click(screen.getByRole("button", { name: "Send directive" }));

    await waitFor(() => {
      expect(onDecideApproval).toHaveBeenCalledWith("app-1", "APPROVED");
    });
  });

  it("renders proactive CTO proposals and allows inline approval/dismissal", async () => {
    jest.mocked(ctoApi.getProposals).mockResolvedValue([
      {
        id: "prop-42",
        company_id: "company-1",
        cto_agent_id: "agent-cto",
        title: "Add Zero-Grep Indexer Worker",
        category: "ENGINEERING",
        rationale: "Speed up AST symbol resolution",
        impact_assessment: "Reduces token usage by 40%",
        status: "PROPOSED",
        proposed_tasks: [],
        delegated_task_ids: [],
        created_at: new Date().toISOString(),
      },
    ]);
    jest.mocked(ctoApi.decideProposal).mockResolvedValue({
      id: "prop-42",
      company_id: "company-1",
      cto_agent_id: "agent-cto",
      title: "Add Zero-Grep Indexer Worker",
      category: "ENGINEERING",
      rationale: "Speed up AST symbol resolution",
      impact_assessment: "Reduces token usage by 40%",
      status: "APPROVED",
      proposed_tasks: [],
      delegated_task_ids: ["t-100"],
      created_at: new Date().toISOString(),
    });

    renderCommandCenter();

    expect(
      await screen.findByText("Add Zero-Grep Indexer Worker"),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /Approve Proposal Add Zero-Grep Indexer Worker/i }),
    );

    await waitFor(() => {
      expect(ctoApi.decideProposal).toHaveBeenCalledWith(
        "company-1",
        "prop-42",
        { decision: "APPROVED" },
      );
    });
  });

  it("respects LayoutSettings panelVisibility by hiding disabled panels", () => {
    const customLayout: LayoutSettings = {
      ...DEFAULT_LAYOUT,
      panelVisibility: {
        ...DEFAULT_LAYOUT.panelVisibility,
        workforce: false,
        executiveGate: false,
      },
    };

    renderCommandCenter({}, customLayout);

    expect(screen.queryByText(/Swarm workforce/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/CEO approval queue/i)).not.toBeInTheDocument();
    expect(
      screen.getByText("CTO directives & interaction console"),
    ).toBeInTheDocument();
  });

  it("safely renders backend approval records that provide action/target instead of action_type", () => {
    renderCommandCenter({
      approvals: [
        {
          id: "app-backend-raw",
          company_id: "company-1",
          title: "Approval needed for EXECUTE_TASK",
          action: "EXECUTE_TASK",
          target: "Task:47a638fe",
          action_type: undefined as unknown as string,
          target_resource: undefined as unknown as string,
          reason: "High risk execution",
          risk_level: "HIGH",
          status: "PENDING",
          created_at: new Date().toISOString(),
        },
      ],
    });

    expect(screen.getByText("EXECUTE TASK")).toBeInTheDocument();
    expect(screen.getByText("Task:47a638fe")).toBeInTheDocument();
  });

  it("resolves Task:<uuid> targets to human-readable task titles, renders audit trace fallback, shows routing chain, and allows quick provider switching", async () => {
    jest.mocked(intelligenceApi.configureProvider).mockResolvedValue({
      provider_name: "anthropic",
      display_name: "Anthropic Claude",
      is_configured: true,
      is_healthy: true,
      discovered_models_count: 1,
      models: ["claude-3-5-sonnet"],
      message: "Primary set",
    });

    renderCommandCenter({
      activeModel: "gemini-3.5-flash",
      fallbackChain: ["gemini-3.5-flash", "claude-3-5-sonnet", "deepseek-reasoner"],
      tasks: [
        {
          id: "47a638fe-8315-4351-9852-75c251c3a0b7",
          project_id: "proj-1",
          title: "Implement Zero-Grep AST Indexer",
          status: "IN_PROGRESS",
          priority: "HIGH",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      approvals: [
        {
          id: "app-task-linked",
          company_id: "company-1",
          action_type: "EXECUTE_TASK",
          target_resource: "Task:47a638fe-8315-4351-9852-75c251c3a0b7",
          reason: "Assigned task execution",
          risk_level: "HIGH",
          status: "PENDING",
          created_at: new Date().toISOString(),
        },
      ],
      audits: [
        {
          id: "audit-1",
          company_id: "company-1",
          action: "EXECUTE_SANDBOX_TEST",
          result: "ALLOWED",
          reason: "Verified unit suite in isolated container",
          created_at: new Date().toISOString(),
        },
      ],
      providers: [
        {
          id: "p-gemini",
          name: "Google Gemini",
          provider: "google_gemini",
          status: "ONLINE",
          is_configured: true,
          is_primary: true,
          active_requests: null,
          avg_latency_ms: null,
          total_tokens: null,
          cost_usd: null,
        },
        {
          id: "p-claude",
          name: "Anthropic Claude",
          provider: "anthropic",
          status: "ONLINE",
          is_configured: true,
          is_primary: false,
          active_requests: null,
          avg_latency_ms: null,
          total_tokens: null,
          cost_usd: null,
        },
      ],
    });

    // 1. Human-readable task title resolved for Task:<uuid>
    expect(screen.getByText(/Task: Implement Zero-Grep AST Indexer/i)).toBeInTheDocument();

    // 2. Audit trace rendered when decisions are empty
    expect(screen.getByText(/Verified unit suite in isolated container/i)).toBeInTheDocument();

    // 3. Routing chain rendered instead of duplicate provider list
    expect(screen.getByText("gemini-3.5-flash")).toBeInTheDocument();

    // 4. Quick provider switch when clicking Anthropic Claude
    fireEvent.click(screen.getByRole("button", { name: /Set Anthropic Claude as primary provider/i }));
    await waitFor(() => {
      expect(intelligenceApi.configureProvider).toHaveBeenCalledWith(
        "company-1",
        "anthropic",
        expect.objectContaining({ set_as_primary: true }),
      );
    });
  });

  it("renders the Unified IDE-Style Split Dock with collapsible Left Sidebar, Right 3-Tab Inspector, and Inline Domain Workspace switching", () => {
    renderCommandCenter({
      approvals: [
        {
          id: "app-ide-1",
          company_id: "company-1",
          action_type: "DEPLOY_PROD",
          target_resource: "prod-cluster",
          reason: "Production rollout gate",
          risk_level: "HIGH",
          status: "PENDING",
          created_at: new Date().toISOString(),
        },
      ],
      providers: [
        {
          id: "p-gemini",
          name: "Google Gemini",
          provider: "google_gemini",
          status: "ONLINE",
          is_configured: true,
          is_primary: true,
          active_requests: null,
          avg_latency_ms: null,
          total_tokens: null,
          cost_usd: null,
        },
      ],
      memories: [
        {
          id: "mem-1",
          domain: "architecture",
          title: "Zero-Grep AST Specification",
          content: "Use symbol graph",
          scope: "company",
          created_at: new Date().toISOString(),
        },
      ],
    });

    // Left Navigation Rail &Right Inspector Dock toggles exist
    const leftRailToggle = screen.getByRole("button", { name: /Toggle Left Navigation Rail/i });
    const rightDockToggle = screen.getByRole("button", { name: /Toggle Right Inspector Dock/i });
    expect(leftRailToggle).toBeInTheDocument();
    expect(rightDockToggle).toBeInTheDocument();

    // Right 3-Tab Inspector tabs exist (Approvals Gate | AI Router & Resources | Audit & Memory)
    const approvalsTab = screen.getByRole("tab", { name: /Approvals/i });
    const routerTab = screen.getByRole("tab", { name: /Router & Resources/i });
    const auditTab = screen.getByRole("tab", { name: /Audit & Memory/i });
    expect(approvalsTab).toBeInTheDocument();
    expect(routerTab).toBeInTheDocument();
    expect(auditTab).toBeInTheDocument();

    // Clicking Audit & Memory tab switches inspector view to show memories/audit
    fireEvent.click(auditTab);
    expect(screen.getByText("Zero-Grep AST Specification")).toBeInTheDocument();

    // Clicking AI Router & Resources tab shows providers & resources
    fireEvent.click(routerTab);
    expect(screen.getByText(/Google Gemini/i)).toBeInTheDocument();

    // Clicking a domain in the Left Sidebar switches the Center Workspace inline
    const workforceNavBtn = screen.getByRole("button", { name: /Navigate to Workforce domain/i });
    fireEvent.click(workforceNavBtn);
    expect(screen.getByRole("button", { name: /Return to Command Center/i })).toBeInTheDocument();
  });
});
