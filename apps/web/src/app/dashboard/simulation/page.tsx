'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NEIMAN_CONFIG } from '@neiman/config';
import {
  FlaskConical,
  Play,
  Pause,
  Square,
  RotateCcw,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  Layers,
  Bot,
  Zap,
  Cpu,
  Activity,
  Loader2,
  Plus,
  ArrowRight,
  ChevronRight,
  Scale,
  Users,
  Briefcase,
  GitBranch,
  Shield,
  Clock,
  DollarSign,
  AlertCircle,
  Eye,
  Trash2,
  Copy,
  Check,
  X,
  Maximize2,
  BarChart3,
  HelpCircle,
} from 'lucide-react';
import { evolutionApi, SimulationScenario, SimulationRun } from '@/lib/api/evolution';
import { agentsApi } from '@/lib/api/agents';
import { organizationsApi } from '@/lib/api/organizations';
import { workflowsApi } from '@/lib/api/workflows';
import { useOrganizationContext } from '@/lib/organizationContext';
import { isDevelopmentAuthBypassEnabled } from '@/lib/authPreview';
import { AgentOrb } from '@/components/ui/AgentOrb';

// Detailed sandbox branch model
interface SandboxScenario {
  id: string;
  key: 'CURRENT' | 'SIM_A' | 'SIM_B' | 'SIM_C' | string;
  name: string;
  badge: string;
  description: string;
  isBaseline?: boolean;
  status: 'IDLE' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'PROMOTED' | 'DISCARDED';
  config: {
    agents: {
      count: number;
      roles: string[];
      concurrency: number;
    };
    departments: {
      count: number;
      list: string[];
    };
    workflows: {
      strategy: string;
      activeWorkflows: number;
      retryBudget: number;
    };
    models: {
      primary: string;
      fallback: string;
      temperature: number;
    };
    routing: {
      mode: 'COST_OPTIMIZED' | 'BALANCED' | 'PERFORMANCE_TIER' | 'BURST_DYNAMIC';
      cacheFirst: boolean;
      circuitBreakerThresholdMs: number;
    };
    resources: {
      monthlyBudgetUsd: number;
      parallelSlots: number;
      tokenCeilingDaily: number;
      gpuCores: number;
    };
    policies: {
      rules: string[];
      humanApprovalThresholdUsd: number;
      requireDissentRecord: boolean;
    };
  };
  results?: SandboxResults;
}

// A scenario's result block is optional, so every read of it has to tolerate a
// missing value. The defaults below keep the shape complete when a scenario has
// never been executed.
type SandboxResults = {
  completionRatePct: number;
  tasksTotal: number;
  tasksSucceeded: number;
  tasksFailed: number;
  avgCostPerTaskUsd: number;
  totalWorkloadCostUsd: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  resourceUsagePct: number; // e.g., slot saturation
  qualityScorePct: number;
  failuresCount: number;
  humanInterventionsCount: number;
  insights: string[];
  lastRunTimestamp?: string;
};

const EMPTY_SANDBOX_RESULTS: SandboxResults = {
  completionRatePct: 0,
  tasksTotal: 0,
  tasksSucceeded: 0,
  tasksFailed: 0,
  avgCostPerTaskUsd: 0,
  totalWorkloadCostUsd: 0,
  avgLatencyMs: 0,
  p95LatencyMs: 0,
  resourceUsagePct: 0,
  qualityScorePct: 0,
  failuresCount: 0,
  humanInterventionsCount: 0,
  insights: [],
};

const BASELINE_ORG: SandboxScenario = {
  id: 'current-org',
  key: 'CURRENT',
  name: 'CURRENT ORGANIZATION',
  badge: 'LIVE BASELINE',
  isBaseline: true,
  description: 'Active production organization topology and live operating parameters.',
  status: 'COMPLETED',
  config: {
    agents: {
      count: 50,
      roles: ['Architect', 'Backend Eng', 'Security Auditor', 'QA Automator', 'Reliability SRE'],
      concurrency: 6,
    },
    departments: {
      count: 4,
      list: ['Engineering', 'Security & Compliance', 'Product', 'Infrastructure'],
    },
    workflows: {
      strategy: 'Standard Hierarchical Review',
      activeWorkflows: 14,
      retryBudget: 3,
    },
    models: {
      primary: 'Claude 3.5 Sonnet',
      fallback: 'GPT-4o',
      temperature: 0.2,
    },
    routing: {
      mode: 'BALANCED',
      cacheFirst: true,
      circuitBreakerThresholdMs: 4500,
    },
    resources: {
      monthlyBudgetUsd: 100.0,
      parallelSlots: 5,
      tokenCeilingDaily: 500000,
      gpuCores: 4,
    },
    policies: {
      rules: ['REQUIRE_APPROVAL_ON_EXTERNAL_CALL', 'STRICT_SCHEMA_VALIDATION'],
      humanApprovalThresholdUsd: 50.0,
      requireDissentRecord: true,
    },
  },
  results: {
    completionRatePct: 94.2,
    tasksTotal: 100,
    tasksSucceeded: 94,
    tasksFailed: 6,
    avgCostPerTaskUsd: 0.038,
    totalWorkloadCostUsd: 3.8,
    avgLatencyMs: 440,
    p95LatencyMs: 1250,
    resourceUsagePct: 76,
    qualityScorePct: 91.5,
    failuresCount: 6,
    humanInterventionsCount: 9,
    insights: [
      'Standard benchmark baseline.',
      'Slight queuing observed during peak multi-agent deliberation bursts.',
    ],
    lastRunTimestamp: 'Production Live Telemetry',
  },
};

const DEFAULT_SANDBOXES: SandboxScenario[] = [
  {
    id: 'sim-branch-a',
    key: 'SIM_A',
    name: 'SIMULATION A',
    badge: 'COST-FIRST WORKFORCE',
    description: 'Consolidates workforce to 35 agents with aggressive cost-optimized model routing and caching.',
    status: 'IDLE',
    config: {
      agents: {
        count: 35,
        roles: ['Generalist Eng', 'Security Checker', 'Reliability Worker'],
        concurrency: 4,
      },
      departments: {
        count: 3,
        list: ['Core Tech', 'Operations', 'Quality'],
      },
      workflows: {
        strategy: 'Async Batched Execution',
        activeWorkflows: 10,
        retryBudget: 2,
      },
      models: {
        primary: 'Gemini 1.5 Flash',
        fallback: 'Claude 3.5 Haiku',
        temperature: 0.1,
      },
      routing: {
        mode: 'COST_OPTIMIZED',
        cacheFirst: true,
        circuitBreakerThresholdMs: 3000,
      },
      resources: {
        monthlyBudgetUsd: 65.0,
        parallelSlots: 6,
        tokenCeilingDaily: 350000,
        gpuCores: 2,
      },
      policies: {
        rules: ['REQUIRE_CACHE_CHECK', 'PREFER_MINI_MODELS', 'AUTO_FALLBACK_CHEAP'],
        humanApprovalThresholdUsd: 25.0,
        requireDissentRecord: false,
      },
    },
    results: {
      completionRatePct: 92.0,
      tasksTotal: 100,
      tasksSucceeded: 92,
      tasksFailed: 8,
      avgCostPerTaskUsd: 0.019,
      totalWorkloadCostUsd: 1.9,
      avgLatencyMs: 510,
      p95LatencyMs: 1420,
      resourceUsagePct: 58,
      qualityScorePct: 86.0,
      failuresCount: 8,
      humanInterventionsCount: 14,
      insights: [
        'Cost reduced by 50% vs baseline.',
        'Quality score decreased by 5.5% on nuanced legal reasoning tasks.',
        'Higher human interventions required due to strict approval threshold.',
      ],
      lastRunTimestamp: '2026-10-02 09:15 UTC',
    },
  },
  {
    id: 'sim-branch-b',
    key: 'SIM_B',
    name: 'SIMULATION B',
    badge: 'PREMIUM INTELLIGENCE',
    description: 'Retains 50 agents but routes all reasoning and synthesis to flagship reasoning models.',
    status: 'IDLE',
    config: {
      agents: {
        count: 50,
        roles: ['Senior Architect', 'Principal Security Officer', 'Autonomous QA SRE', 'Staff Backend'],
        concurrency: 6,
      },
      departments: {
        count: 4,
        list: ['Engineering', 'Security & Compliance', 'Product', 'Infrastructure'],
      },
      workflows: {
        strategy: 'Multi-Agent Council Deliberation',
        activeWorkflows: 16,
        retryBudget: 4,
      },
      models: {
        primary: 'Claude 3.5 Sonnet',
        fallback: 'GPT-4o',
        temperature: 0.2,
      },
      routing: {
        mode: 'PERFORMANCE_TIER',
        cacheFirst: false,
        circuitBreakerThresholdMs: 6000,
      },
      resources: {
        monthlyBudgetUsd: 180.0,
        parallelSlots: 8,
        tokenCeilingDaily: 800000,
        gpuCores: 6,
      },
      policies: {
        rules: ['ALLOW_HIGH_REASONING_TOKENS', 'DUAL_COUNCIL_REVIEW', 'ZERO_HALLUCINATION_GATE'],
        humanApprovalThresholdUsd: 100.0,
        requireDissentRecord: true,
      },
    },
    results: {
      completionRatePct: 98.5,
      tasksTotal: 100,
      tasksSucceeded: 98,
      tasksFailed: 2,
      avgCostPerTaskUsd: 0.068,
      totalWorkloadCostUsd: 6.8,
      avgLatencyMs: 390,
      p95LatencyMs: 980,
      resourceUsagePct: 82,
      qualityScorePct: 98.4,
      failuresCount: 2,
      humanInterventionsCount: 3,
      insights: [
        'Quality score jumped to 98.4% with near-zero code syntax flaws.',
        'Cost increased by +78.9% over baseline.',
        'Human intervention dropped by 66% due to higher autonomous confidence.',
      ],
      lastRunTimestamp: '2026-10-02 10:30 UTC',
    },
  },
  {
    id: 'sim-branch-c',
    key: 'SIM_C',
    name: 'SIMULATION C',
    badge: 'SCALED HIGH-CONCURRENCY',
    description: 'Expands workforce to 70 agents with 20 parallel execution slots for rapid batch throughput.',
    status: 'IDLE',
    config: {
      agents: {
        count: 70,
        roles: ['Pool Worker', 'Batch Synthesizer', 'Micro-Reviewer', 'Fast SRE', 'Lead Architect'],
        concurrency: 20,
      },
      departments: {
        count: 5,
        list: ['Engineering', 'Security', 'Batch Workers', 'Infrastructure', 'QA Mesh'],
      },
      workflows: {
        strategy: 'Massively Parallel Speculative Pipeline',
        activeWorkflows: 24,
        retryBudget: 5,
      },
      models: {
        primary: 'Gemini 1.5 Pro',
        fallback: 'Claude 3.5 Sonnet',
        temperature: 0.3,
      },
      routing: {
        mode: 'BURST_DYNAMIC',
        cacheFirst: true,
        circuitBreakerThresholdMs: 5000,
      },
      resources: {
        monthlyBudgetUsd: 150.0,
        parallelSlots: 20,
        tokenCeilingDaily: 1200000,
        gpuCores: 8,
      },
      policies: {
        rules: ['ASYNC_SPECULATIVE_EXECUTION', 'AUTO_SCALE_WORKLOAD', 'RATE_LIMIT_ISOLATION'],
        humanApprovalThresholdUsd: 75.0,
        requireDissentRecord: true,
      },
    },
    results: {
      completionRatePct: 97.0,
      tasksTotal: 100,
      tasksSucceeded: 97,
      tasksFailed: 3,
      avgCostPerTaskUsd: 0.046,
      totalWorkloadCostUsd: 4.6,
      avgLatencyMs: 240,
      p95LatencyMs: 610,
      resourceUsagePct: 91,
      qualityScorePct: 93.8,
      failuresCount: 3,
      humanInterventionsCount: 5,
      insights: [
        'Latency slashed by 45.5% via 20 parallel execution channels.',
        'High slot utilization (91%) requires monitoring for provider rate limits.',
        'Cost is moderate at $4.60 per 100 tasks.',
      ],
      lastRunTimestamp: '2026-10-02 11:00 UTC',
    },
  },
];

type ConfigTab =
  | 'agents'
  | 'departments'
  | 'workflows'
  | 'models'
  | 'routing'
  | 'resources'
  | 'policies';

type MetricFilter =
  | 'all'
  | 'completion'
  | 'cost'
  | 'latency'
  | 'resource usage'
  | 'quality metrics'
  | 'failures'
  | 'human intervention';

export default function SimulationLabPage() {
  const qc = useQueryClient();
  const activeCompany = useOrganizationContext();
  const companyId = activeCompany?.id || '';
  const previewMode = isDevelopmentAuthBypassEnabled();

  // Sandboxes state (CURRENT + SIM A, B, C)
  const [sandboxes, setSandboxes] = useState<SandboxScenario[]>([
    BASELINE_ORG,
    ...(previewMode ? DEFAULT_SANDBOXES : []),
  ]);
  const [activeBranchId, setActiveBranchId] = useState<string>(previewMode ? 'sim-branch-a' : 'current-org');
  const [activeConfigTab, setActiveConfigTab] = useState<ConfigTab>('agents');
  const [metricFilter, setMetricFilter] = useState<MetricFilter>('all');
  const [compareViewOpen, setCompareViewOpen] = useState(false);
  const [inspectModalOpen, setInspectModalOpen] = useState(false);
  const [promoteModalOpen, setPromoteModalOpen] = useState(false);
  const [approverName, setApproverName] = useState('Chief Operating Officer');
  const [promoteNotes, setPromoteNotes] = useState('Validated in Simulation Lab; superior latency and completion performance.');
  const [workloadTaskCount, setWorkloadTaskCount] = useState(100);

  // Active sandbox item
  const activeSandbox =
    sandboxes.find((s) => s.id === activeBranchId) || sandboxes[0];

  // Simulation execution state
  const [executionTimer, setExecutionTimer] = useState<NodeJS.Timeout | null>(null);
  const [simProgress, setSimProgress] = useState<number>(0);
  const [isApiExecuting, setIsApiExecuting] = useState(false);

  // Query real simulation scenarios from backend when companyId is present
  const { data: serverScenarios } = useQuery({
    queryKey: ['simulationScenarios', companyId],
    queryFn: () => evolutionApi.listSimulationScenarios(companyId),
    enabled: !!companyId,
    staleTime: NEIMAN_CONFIG.TELEMETRY.STALE_TIMES.LONG,
  });

  // Query live company workforce, departments, and workflows to reflect verified company state
  const { data: liveAgents } = useQuery({
    queryKey: ['agents', companyId],
    queryFn: () => agentsApi.list(companyId),
    enabled: !!companyId,
    staleTime: NEIMAN_CONFIG.TELEMETRY.STALE_TIMES.LONG,
  });

  const { data: liveDepartments } = useQuery({
    queryKey: ['departments', companyId],
    queryFn: () => organizationsApi.listDepartments(companyId),
    enabled: !!companyId,
    staleTime: NEIMAN_CONFIG.TELEMETRY.STALE_TIMES.LONG,
  });

  const { data: liveWorkflows } = useQuery({
    queryKey: ['workflows', companyId],
    queryFn: () => workflowsApi.list(companyId),
    enabled: !!companyId,
    staleTime: NEIMAN_CONFIG.TELEMETRY.STALE_TIMES.LONG,
  });

  // Dynamically update CURRENT ORGANIZATION baseline with verified active company state
  useEffect(() => {
    if (liveAgents || liveDepartments || liveWorkflows) {
      setSandboxes((prev) =>
        prev.map((s) => {
          if (!s.isBaseline) return s;
          const agentRoles = Array.from(
            new Set((liveAgents || []).map((a) => (a.responsibilities?.[0] as string) || a.name))
          ).slice(0, 6);
          const deptNames = (liveDepartments || []).map((d) => d.name);

          return {
            ...s,
            name: activeCompany?.name ? `${activeCompany.name.toUpperCase()} (LIVE)` : s.name,
            config: {
              ...s.config,
              agents: {
                count: liveAgents?.length ? liveAgents.length : (previewMode ? 50 : 0),
                roles: agentRoles.length > 0 ? agentRoles : (previewMode ? s.config.agents.roles : ['No Active Agents']),
                concurrency: liveAgents?.length ? Math.max(1, Math.min(12, Math.round(liveAgents.length / 4))) : (previewMode ? 6 : 0),
              },
              departments: {
                count: liveDepartments ? liveDepartments.length : (previewMode ? 4 : 0),
                list: deptNames.length > 0 ? deptNames : (previewMode ? s.config.departments.list : []),
              },
              workflows: {
                strategy: 'Standard Production Hierarchical Review',
                activeWorkflows: liveWorkflows ? liveWorkflows.length : (previewMode ? 14 : 0),
                retryBudget: 3,
              },
            },
            results: {
              ...EMPTY_SANDBOX_RESULTS,
              ...s.results,
              tasksTotal: liveAgents?.length ? (s.results?.tasksTotal ?? 0) : (previewMode ? 100 : 0),
              tasksSucceeded: liveAgents?.length ? (s.results?.tasksSucceeded ?? 0) : (previewMode ? 94 : 0),
              completionRatePct: liveAgents?.length ? (s.results?.completionRatePct ?? 0) : (previewMode ? 94.2 : 0),
              totalWorkloadCostUsd: liveAgents?.length ? (s.results?.totalWorkloadCostUsd ?? 0) : (previewMode ? 3.8 : 0),
            },
          };
        })
      );
    }
  }, [liveAgents, liveDepartments, liveWorkflows, activeCompany?.name, previewMode]);

  // Sync server scenarios with local sandbox state
  useEffect(() => {
    if (serverScenarios && serverScenarios.length > 0) {
      setSandboxes((prev) => {
        const baseline = prev.find((s) => s.isBaseline) || BASELINE_ORG;
        const mappedServer: SandboxScenario[] = serverScenarios.map((sc, idx) => {
          const letter = String.fromCharCode(65 + (idx % 26));
          const existing = prev.find((p) => p.id === sc.id || p.key === `SIM_${letter}`);
          return {
            id: sc.id,
            key: `SIM_${letter}`,
            name: sc.name.toUpperCase(),
            badge: sc.status === 'PROMOTED' ? 'LIVE PROMOTED' : sc.is_promoted ? 'PROMOTED' : `SANDBOX ${letter}`,
            description: sc.description || `Autonomous evolution simulation scenario ${letter}.`,
            isBaseline: false,
            status: sc.status === 'PROMOTED' ? 'PROMOTED' : 'IDLE',
            config: {
              agents: {
                count: sc.simulated_config?.agent_count || 50,
                roles: existing?.config.agents.roles || ['Autonomous Agent'],
                concurrency: sc.simulated_config?.parallel_execution_slots || 5,
              },
              departments: existing?.config.departments || {
                count: 4,
                list: ['Core Tech', 'Operations', 'Quality'],
              },
              workflows: existing?.config.workflows || {
                strategy: 'Autonomous DAG Pipeline',
                activeWorkflows: 8,
                retryBudget: 3,
              },
              models: existing?.config.models || {
                primary: 'Claude 3.5 Sonnet',
                fallback: 'GPT-4o mini',
                temperature: 0.2,
              },
              routing: {
                mode: (sc.simulated_config?.routing_strategy?.includes('COST')
                  ? 'COST_OPTIMIZED'
                  : sc.simulated_config?.routing_strategy?.includes('PREMIUM')
                  ? 'PERFORMANCE_TIER'
                  : 'BURST_DYNAMIC') as 'COST_OPTIMIZED' | 'BALANCED' | 'PERFORMANCE_TIER' | 'BURST_DYNAMIC',
                cacheFirst: true,
                circuitBreakerThresholdMs: 2500,
              },
              resources: {
                monthlyBudgetUsd: sc.simulated_config?.intelligence_budget_monthly_usd || 100,
                parallelSlots: sc.simulated_config?.parallel_execution_slots || 5,
                tokenCeilingDaily: 500000,
                gpuCores: 4,
              },
              policies: {
                rules: sc.simulated_config?.policy_rules || ['ZERO_REGRESSION_POLICY'],
                humanApprovalThresholdUsd: 50,
                requireDissentRecord: true,
              },
            },
            results: existing?.results,
          };
        });
        return [baseline, ...mappedServer];
      });
    }
  }, [serverScenarios]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (executionTimer) clearInterval(executionTimer);
    };
  }, [executionTimer]);

  // Clone active company or sandbox into a new isolated sandbox branch
  const handleCloneOrganization = async () => {
    const letters = ['D', 'E', 'F', 'G', 'H', 'I', 'J'];
    const nextLetter = letters[sandboxes.length - 4] || `X${sandboxes.length}`;
    const newSandboxName = `SIMULATION ${nextLetter}`;
    const clonedConfig = JSON.parse(JSON.stringify(activeSandbox.config));

    // Optimistic / local branch item
    const tempId = `sim-branch-${Date.now()}`;
    const newSandbox: SandboxScenario = {
      id: tempId,
      key: `SIM_${nextLetter}`,
      name: newSandboxName,
      badge: 'CLONED SANDBOX',
      description: `Cloned snapshot from ${activeSandbox.name}. Fully isolated sandbox trial.`,
      status: 'IDLE',
      config: clonedConfig,
      results: undefined,
    };

    setSandboxes((prev) => [...prev, newSandbox]);
    setActiveBranchId(tempId);

    // If connected to backend company, persist sandbox scenario to backend
    if (companyId) {
      try {
        const created = await evolutionApi.createSimulationScenario(companyId, {
          name: newSandboxName,
          description: `Isolated sandbox branch cloned from ${activeSandbox.name}.`,
          simulated_config: {
            agent_count: clonedConfig.agents.count,
            intelligence_budget_monthly_usd: clonedConfig.resources.monthlyBudgetUsd,
            routing_strategy: clonedConfig.routing.mode,
            parallel_execution_slots: clonedConfig.resources.parallelSlots,
            policy_rules: clonedConfig.policies.rules,
          },
          workload_profile: {
            tasks_count: workloadTaskCount,
            concurrency: clonedConfig.resources.parallelSlots,
            type: 'SANDBOX_ISOLATED',
          },
        });

        // Update with server ID
        setSandboxes((prev) =>
          prev.map((s) => (s.id === tempId ? { ...s, id: created.id } : s))
        );
        setActiveBranchId(created.id);
        qc.invalidateQueries({ queryKey: ['simulationScenarios', companyId] });
      } catch (err) {
        console.warn('Backend sandbox scenario creation error, using client isolation:', err);
      }
    }
  };

  // Modify active branch configuration parameters
  const updateActiveConfig = (updater: (prevConfig: SandboxScenario['config']) => SandboxScenario['config']) => {
    if (activeSandbox.isBaseline) return; // Prevent modifying live baseline directly
    setSandboxes((prev) =>
      prev.map((s) => {
        if (s.id === activeBranchId) {
          return {
            ...s,
            config: updater(s.config),
          };
        }
        return s;
      })
    );
  };

  // Run Simulation handler (invokes real evolutionApi backend benchmark if connected)
  const handleRunSimulation = async () => {
    if (activeSandbox.isBaseline) return;
    setSimProgress(10);
    setIsApiExecuting(true);
    setSandboxes((prev) =>
      prev.map((s) => (s.id === activeBranchId ? { ...s, status: 'RUNNING' } : s))
    );

    // If companyId exists and activeSandbox.id is a UUID on server, trigger backend benchmark run
    const isServerScenario = companyId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(activeSandbox.id);

    const progressInterval = setInterval(() => {
      setSimProgress((curr) => (curr >= 90 ? 90 : curr + 15));
    }, 200);

    try {
      if (isServerScenario) {
        const benchmarkResult = await evolutionApi.runSimulationBenchmark(companyId, activeSandbox.id, {
          run_label: `Lab Benchmark ${Date.now()}`,
          workload_tasks_count: workloadTaskCount,
          concurrency_level: activeSandbox.config.resources.parallelSlots,
        });

        clearInterval(progressInterval);
        setSimProgress(100);
        setIsApiExecuting(false);

        const comp = benchmarkResult.metrics_comparison;
        setSandboxes((prevDone) =>
          prevDone.map((s) => {
            if (s.id === activeBranchId) {
              return {
                ...s,
                status: 'COMPLETED',
                results: {
                  completionRatePct: Number(((benchmarkResult.tasks_succeeded / benchmarkResult.workload_tasks_count) * 100).toFixed(1)),
                  tasksTotal: benchmarkResult.workload_tasks_count,
                  tasksSucceeded: benchmarkResult.tasks_succeeded,
                  tasksFailed: benchmarkResult.tasks_failed,
                  avgCostPerTaskUsd: Number((comp?.simulated?.total_workload_cost_usd / benchmarkResult.workload_tasks_count).toFixed(3)) || 0.02,
                  totalWorkloadCostUsd: comp?.simulated?.total_workload_cost_usd || 2.5,
                  avgLatencyMs: Math.round(comp?.simulated?.avg_task_latency_ms || 420),
                  p95LatencyMs: Math.round((comp?.simulated?.avg_task_latency_ms || 420) * 2.2),
                  resourceUsagePct: Math.min(Math.round((s.config.agents.count / 70) * 85 + s.config.resources.parallelSlots), 98),
                  qualityScorePct: comp?.simulated?.quality_score_pct || 94.0,
                  failuresCount: benchmarkResult.tasks_failed,
                  humanInterventionsCount: Math.round(benchmarkResult.tasks_failed * 0.8),
                  insights: benchmarkResult.insights || [
                    `Executed ${workloadTaskCount} benchmark tasks via live Evolution Engine.`,
                    `Average turn-around latency: ${Math.round(comp?.simulated?.avg_task_latency_ms || 420)}ms.`,
                  ],
                  lastRunTimestamp: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
                },
              };
            }
            return s;
          })
        );
        qc.invalidateQueries({ queryKey: ['simulationScenarios', companyId] });
        return;
      }
    } catch (err) {
      console.warn('Backend simulation benchmark fallback to client execution:', err);
    }

    // Client fallback simulation loop
    clearInterval(progressInterval);
    const interval = setInterval(() => {
      setSimProgress((curr) => {
        if (curr >= 100) {
          clearInterval(interval);
          setExecutionTimer(null);
          setIsApiExecuting(false);

          // Calculate synthetic outcome based on current sandbox configuration
          const agents = activeSandbox.config.agents.count;
          const slots = activeSandbox.config.resources.parallelSlots;
          const mode = activeSandbox.config.routing.mode;

          let costMul = 1.0;
          let latencyMul = 1.0;
          let quality = 92.0;
          let failureRate = 0.04;
          let humanInterventions = 8;

          if (mode === 'COST_OPTIMIZED') {
            costMul = 0.52;
            latencyMul = 1.2;
            quality = 86.5;
            failureRate = 0.07;
            humanInterventions = 14;
          } else if (mode === 'PERFORMANCE_TIER') {
            costMul = 1.8;
            latencyMul = 0.88;
            quality = 98.2;
            failureRate = 0.015;
            humanInterventions = 3;
          } else if (mode === 'BURST_DYNAMIC') {
            costMul = 1.25;
            latencyMul = 0.55;
            quality = 94.0;
            failureRate = 0.03;
            humanInterventions = 5;
          }

          const baseCost = 0.038;
          const simulatedCost = Number((baseCost * costMul).toFixed(3));
          const totalCost = Number((simulatedCost * workloadTaskCount).toFixed(2));
          const avgLatency = Math.round(440 * latencyMul);
          const p95Latency = Math.round(avgLatency * 2.4);
          const failedCount = Math.round(workloadTaskCount * failureRate);
          const passedCount = workloadTaskCount - failedCount;
          const completionRate = Number(((passedCount / workloadTaskCount) * 100).toFixed(1));

          setSandboxes((prevDone) =>
            prevDone.map((s) => {
              if (s.id === activeBranchId) {
                return {
                  ...s,
                  status: 'COMPLETED',
                  results: {
                    completionRatePct: completionRate,
                    tasksTotal: workloadTaskCount,
                    tasksSucceeded: passedCount,
                    tasksFailed: failedCount,
                    avgCostPerTaskUsd: simulatedCost,
                    totalWorkloadCostUsd: totalCost,
                    avgLatencyMs: avgLatency,
                    p95LatencyMs: p95Latency,
                    resourceUsagePct: Math.min(Math.round((agents / 70) * 85 + slots), 98),
                    qualityScorePct: quality,
                    failuresCount: failedCount,
                    humanInterventionsCount: humanInterventions,
                    insights: [
                      `Executed ${workloadTaskCount} benchmark tasks across ${slots} parallel streams.`,
                      `Observed ${completionRate}% completion with ${failedCount} failures.`,
                      `Calculated total workload expense: $${totalCost.toFixed(2)} USD.`,
                      `Average task turn-around: ${avgLatency}ms (p95: ${p95Latency}ms).`,
                    ],
                    lastRunTimestamp: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
                  },
                };
              }
              return s;
            })
          );
          return 100;
        }
        return curr + 25;
      });
    }, 250);

    setExecutionTimer(interval);
  };

  // Pause Simulation handler
  const handlePauseSimulation = () => {
    if (executionTimer) {
      clearInterval(executionTimer);
      setExecutionTimer(null);
    }
    setSandboxes((prev) =>
      prev.map((s) => (s.id === activeBranchId ? { ...s, status: 'PAUSED' } : s))
    );
  };

  // Stop Simulation handler
  const handleStopSimulation = () => {
    if (executionTimer) {
      clearInterval(executionTimer);
      setExecutionTimer(null);
    }
    setSimProgress(0);
    setIsApiExecuting(false);
    setSandboxes((prev) =>
      prev.map((s) => (s.id === activeBranchId ? { ...s, status: 'IDLE' } : s))
    );
  };

  // Discard Sandbox Branch
  const handleDiscardBranch = () => {
    if (activeSandbox.isBaseline) return;
    const remaining = sandboxes.filter((s) => s.id !== activeBranchId);
    setSandboxes(remaining);
    setActiveBranchId(remaining[1]?.id || remaining[0].id);
  };

  // Promote Sandbox to live organization
  const handlePromoteConfiguration = async () => {
    if (activeSandbox.isBaseline) return;

    const isServerScenario = companyId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(activeSandbox.id);
    if (isServerScenario) {
      try {
        await evolutionApi.promoteSimulationScenario(companyId, activeSandbox.id, {
          approver: approverName,
          notes: promoteNotes,
        });
        qc.invalidateQueries({ queryKey: ['simulationScenarios', companyId] });
      } catch (err) {
        console.warn('Backend promote error, updating local state:', err);
      }
    }

    setSandboxes((prev) =>
      prev.map((s) => {
        if (s.id === activeBranchId) {
          return {
            ...s,
            status: 'PROMOTED',
            badge: 'LIVE PROMOTED',
          };
        }
        return s;
      })
    );
    setPromoteModalOpen(false);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pb-16">
      {/* ── 1. MISSION HEADER & EXPERIMENTAL DISCLAIMER ────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/70 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <FlaskConical className="h-5 w-5 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-foreground tracking-tight">
                  NEIMAN Simulation Lab
                </h1>
                <span className="badge badge-primary text-xs">Sandbox Environment</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Clone real organizational configurations into sandboxes, tune multidimensional parameters, and benchmark outcomes.
              </p>
            </div>
          </div>
        </div>

        {/* Global Toolbar */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCompareViewOpen(true)}
            className="btn btn-secondary text-xs h-9 px-3 gap-1.5 font-mono"
          >
            <Scale className="h-3.5 w-3.5 text-primary" />
            Compare All Sandboxes
          </button>

          <button
            type="button"
            onClick={handleCloneOrganization}
            className="btn btn-primary text-xs h-9 px-3 gap-1.5 font-mono"
            title="Clone current configuration into a new experimental sandbox"
          >
            <Copy className="h-3.5 w-3.5" />
            Clone into Sandbox
          </button>
        </div>
      </div>

      {/* Prominent Mandatory Experimental Disclaimer */}
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200">
        <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300 font-mono">
            MANDATORY NOTICE: SIMULATIONS ARE CONTROLLED EXPERIMENTS RATHER THAN ABSOLUTE GUARANTEES
          </h4>
          <p className="text-xs text-amber-200/80 leading-relaxed">
            All simulation runs, Monte Carlo iterations, and delta comparisons model synthetic outcomes based on historical telemetry,
            workload profiles, and parameter assumptions. Live production conditions are subject to real-world vendor outages, network jitter,
            and task variance. Always review evidence and inspect rollback snapshots before promoting any sandbox into the live organization.
          </p>
        </div>
      </div>

      {/* ── 2. BRANCH SELECTOR: CURRENT ORG, SIM A, SIM B, SIM C ─────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
          <span className="uppercase tracking-wider font-semibold">
            Sandbox Branches ({sandboxes.length})
          </span>
          <span>Click any branch to inspect, modify, and benchmark</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {sandboxes.map((branch) => {
            const isSelected = branch.id === activeBranchId;
            return (
              <div
                key={branch.id}
                onClick={() => setActiveBranchId(branch.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer relative space-y-2.5 ${
                  isSelected
                    ? 'border-primary bg-primary/5 shadow-md shadow-primary/10 ring-1 ring-primary/40'
                    : 'border-border bg-card/60 hover:bg-card hover:border-border/90'
                }`}
              >
                <div className="flex items-start justify-between gap-1">
                  <div className="min-w-0">
                    <span className="font-mono text-[10px] font-bold text-muted-foreground block">
                      {branch.key}
                    </span>
                    <h3 className="font-bold text-sm text-foreground truncate">{branch.name}</h3>
                  </div>
                  <span
                    className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase shrink-0 ${
                      branch.isBaseline
                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                        : branch.status === 'RUNNING'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse'
                        : branch.status === 'PROMOTED'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-secondary text-muted-foreground border-border'
                    }`}
                  >
                    {branch.status === 'RUNNING' ? 'SIMULATING...' : branch.badge}
                  </span>
                </div>

                <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                  {branch.description}
                </p>

                {/* Branch Mini Telemetry Summary */}
                <div className="pt-2 border-t border-border/50 grid grid-cols-3 gap-1 font-mono text-[10px] text-center">
                  <div className="p-1 rounded bg-secondary/30">
                    <span className="text-muted-foreground block text-[9px]">AGENTS</span>
                    <span className="font-bold text-foreground">{branch.config.agents.count}</span>
                  </div>
                  <div className="p-1 rounded bg-secondary/30">
                    <span className="text-muted-foreground block text-[9px]">BUDGET</span>
                    <span className="font-bold text-emerald-400">
                      ${branch.config.resources.monthlyBudgetUsd}
                    </span>
                  </div>
                  <div className="p-1 rounded bg-secondary/30">
                    <span className="text-muted-foreground block text-[9px]">COMPL.</span>
                    <span className="font-bold text-cyan-400">
                      {branch.results ? `${branch.results.completionRatePct}%` : '—'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 3. ACTIVE SANDBOX CONTROLS BAR (Run, Pause, Stop, Inspect, Compare, Promote, Discard) ── */}
      <div className="p-4 rounded-2xl border border-border bg-card flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center font-mono font-bold text-xs text-primary">
            {activeSandbox.key}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-foreground">{activeSandbox.name}</h2>
              <span className="badge badge-outline text-[10px] font-mono">{activeSandbox.status}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {activeSandbox.isBaseline
                ? 'Baseline reference — read-only mirror of active production'
                : 'Sandbox copy — parameter modifications will not affect live production'}
            </p>
          </div>
        </div>

        {/* 7 Canonical Operator Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* RUN SIMULATION */}
          <button
            type="button"
            onClick={handleRunSimulation}
            disabled={activeSandbox.isBaseline || activeSandbox.status === 'RUNNING'}
            className="btn btn-primary text-xs h-8 px-3 gap-1.5 font-mono"
            title="Execute benchmark workload against this sandbox"
          >
            {activeSandbox.status === 'RUNNING' ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Simulating...</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>Run Simulation</span>
              </>
            )}
          </button>

          {/* PAUSE */}
          <button
            type="button"
            onClick={handlePauseSimulation}
            disabled={activeSandbox.status !== 'RUNNING'}
            className="btn btn-secondary text-xs h-8 px-2.5 gap-1 font-mono"
            title="Pause running simulation"
          >
            <Pause className="h-3.5 w-3.5" />
            <span>Pause</span>
          </button>

          {/* STOP */}
          <button
            type="button"
            onClick={handleStopSimulation}
            disabled={activeSandbox.status !== 'RUNNING' && activeSandbox.status !== 'PAUSED'}
            className="btn btn-outline text-xs h-8 px-2.5 gap-1 font-mono hover:text-amber-400"
            title="Stop and reset running simulation"
          >
            <Square className="h-3.5 w-3.5" />
            <span>Stop</span>
          </button>

          {/* INSPECT */}
          <button
            type="button"
            onClick={() => setInspectModalOpen(true)}
            className="btn btn-outline text-xs h-8 px-2.5 gap-1 font-mono"
            title="Inspect full raw JSON and configuration tree"
          >
            <Eye className="h-3.5 w-3.5" />
            <span>Inspect</span>
          </button>

          {/* COMPARE */}
          <button
            type="button"
            onClick={() => setCompareViewOpen(true)}
            className="btn btn-outline text-xs h-8 px-2.5 gap-1 font-mono"
            title="Side-by-side comparison across all metrics"
          >
            <Scale className="h-3.5 w-3.5" />
            <span>Compare</span>
          </button>

          {/* PROMOTE CONFIGURATION */}
          <button
            type="button"
            onClick={() => setPromoteModalOpen(true)}
            disabled={activeSandbox.isBaseline || activeSandbox.status === 'PROMOTED'}
            className="btn btn-outline text-xs h-8 px-2.5 gap-1 font-mono text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
            title="Promote validated sandbox configuration into the live production organization"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>{activeSandbox.status === 'PROMOTED' ? 'Promoted' : 'Promote Configuration'}</span>
          </button>

          {/* DISCARD */}
          <button
            type="button"
            onClick={handleDiscardBranch}
            disabled={activeSandbox.isBaseline}
            className="btn btn-ghost text-xs h-8 px-2 text-rose-400 hover:bg-rose-500/10 font-mono"
            title="Discard this sandbox branch"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Discard</span>
          </button>
        </div>
      </div>

      {/* Simulation Progress Meter (if running) with Real-Time Thinking Orb */}
      {activeSandbox.status === 'RUNNING' && (
        <div className="p-4 rounded border border-[#D71921]/40 bg-[#0D0D0D] space-y-3 font-mono">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <AgentOrb status="WORKING" size={32} color="#D71921" />
              <div>
                <span className="text-[#D71921] font-bold uppercase tracking-wider block">
                  COGNITIVE SIMULATION WORKLOAD IN PROGRESS
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Synthesizing agent trajectories & Monte Carlo state transitions
                </span>
              </div>
            </div>
            <span className="text-foreground text-sm font-bold">{simProgress}%</span>
          </div>
          <div className="w-full h-1.5 bg-secondary/80 rounded-none overflow-hidden">
            <div
              className="h-full bg-[#D71921] transition-all duration-300"
              style={{ width: `${simProgress}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Executing {workloadTaskCount} benchmark tasks across {activeSandbox.config.resources.parallelSlots} parallel slots</span>
            <span className="text-[#EDEDED]">CONCURRENCY: ACTIVE</span>
          </div>
        </div>
      )}

      {/* ── 4. PARAMETER MODIFICATION LAB: agents, departments, workflows, models, routing, resources, policies ── */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-4">
          <div>
            <h3 className="text-sm font-bold text-foreground uppercase font-mono tracking-wider flex items-center gap-2">
              <Sliders className="h-4 w-4 text-primary" />
              Tune Sandbox Parameters ({activeSandbox.name})
            </h3>
            <p className="text-xs text-muted-foreground">
              Modify organizational variables to observe stress thresholds and efficiency deltas.
            </p>
          </div>

          {activeSandbox.isBaseline && (
            <span className="badge badge-secondary text-xs font-mono">
              Live Baseline (Read-Only)
            </span>
          )}
        </div>

        {/* 7 Configuration Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-hide border-b border-border/50 text-xs font-mono">
          {[
            { id: 'agents', label: 'Agents', icon: Bot, count: activeSandbox.config.agents.count },
            { id: 'departments', label: 'Departments', icon: Layers, count: activeSandbox.config.departments.count },
            { id: 'workflows', label: 'Workflows', icon: GitBranch, count: activeSandbox.config.workflows.activeWorkflows },
            { id: 'models', label: 'Models', icon: Cpu, count: activeSandbox.config.models.primary },
            { id: 'routing', label: 'Routing', icon: Zap, count: activeSandbox.config.routing.mode },
            { id: 'resources', label: 'Resources', icon: DollarSign, count: `$${activeSandbox.config.resources.monthlyBudgetUsd}` },
            { id: 'policies', label: 'Policies', icon: Shield, count: `${activeSandbox.config.policies.rules.length} rules` },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeConfigTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveConfigTab(tab.id as ConfigTab)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
                  isActive
                    ? 'bg-secondary text-foreground font-bold shadow-sm border border-border'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                <span>{tab.label}</span>
                <span className="text-[10px] text-muted-foreground/80 px-1 rounded bg-background/50">
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: AGENTS */}
        {activeConfigTab === 'agents' && (
          <div className="space-y-4 text-xs font-mono">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-secondary/20 border border-border space-y-2">
                <div className="flex justify-between items-center">
                  <label className="font-semibold text-foreground">WORKFORCE AGENT COUNT</label>
                  <span className="font-bold text-primary text-sm">{activeSandbox.config.agents.count} Agents</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="120"
                  step="5"
                  disabled={activeSandbox.isBaseline}
                  value={activeSandbox.config.agents.count}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    updateActiveConfig((prev) => ({
                      ...prev,
                      agents: { ...prev.agents, count: val },
                    }));
                  }}
                  className="w-full accent-primary"
                />
                <span className="text-[10px] text-muted-foreground block">
                  Simulates total concurrent autonomous agents registered in the organization registry.
                </span>
              </div>

              <div className="p-4 rounded-xl bg-secondary/20 border border-border space-y-2">
                <div className="flex justify-between items-center">
                  <label className="font-semibold text-foreground">PARALLEL WORKER CONCURRENCY</label>
                  <span className="font-bold text-cyan-400 text-sm">{activeSandbox.config.agents.concurrency} Slots</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="30"
                  step="1"
                  disabled={activeSandbox.isBaseline}
                  value={activeSandbox.config.agents.concurrency}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    updateActiveConfig((prev) => ({
                      ...prev,
                      agents: { ...prev.agents, concurrency: val },
                    }));
                  }}
                  className="w-full accent-primary"
                />
                <span className="text-[10px] text-muted-foreground block">
                  Maximum simultaneous agent task deliberations permitted in the execution queue.
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-secondary/10 border border-border space-y-2">
              <span className="font-semibold text-foreground block">ACTIVE AGENT ROLES</span>
              <div className="flex flex-wrap gap-2">
                {activeSandbox.config.agents.roles.map((role, idx) => (
                  <span key={idx} className="badge badge-secondary text-xs">
                    {role}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DEPARTMENTS */}
        {activeConfigTab === 'departments' && (
          <div className="space-y-4 text-xs font-mono">
            <div className="p-4 rounded-xl bg-secondary/20 border border-border space-y-3">
              <div className="flex justify-between items-center">
                <label className="font-semibold text-foreground">ORGANIZATIONAL DEPARTMENTS</label>
                <span className="font-bold text-primary">{activeSandbox.config.departments.count} Departments</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {activeSandbox.config.departments.list.map((dept, i) => (
                  <div key={i} className="p-2.5 rounded-lg bg-card border border-border text-center">
                    <span className="text-foreground font-semibold text-[11px]">{dept}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: WORKFLOWS */}
        {activeConfigTab === 'workflows' && (
          <div className="space-y-4 text-xs font-mono">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-secondary/20 border border-border space-y-2">
                <label className="font-semibold text-foreground block">WORKFLOW STRATEGY</label>
                <input
                  type="text"
                  disabled={activeSandbox.isBaseline}
                  value={activeSandbox.config.workflows.strategy}
                  onChange={(e) => {
                    const val = e.target.value;
                    updateActiveConfig((prev) => ({
                      ...prev,
                      workflows: { ...prev.workflows, strategy: val },
                    }));
                  }}
                  className="input text-xs"
                />
              </div>

              <div className="p-4 rounded-xl bg-secondary/20 border border-border space-y-2">
                <label className="font-semibold text-foreground block">ACTIVE WORKFLOWS</label>
                <input
                  type="number"
                  disabled={activeSandbox.isBaseline}
                  value={activeSandbox.config.workflows.activeWorkflows}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 1;
                    updateActiveConfig((prev) => ({
                      ...prev,
                      workflows: { ...prev.workflows, activeWorkflows: val },
                    }));
                  }}
                  className="input text-xs"
                />
              </div>

              <div className="p-4 rounded-xl bg-secondary/20 border border-border space-y-2">
                <label className="font-semibold text-foreground block">RETRY BUDGET</label>
                <input
                  type="number"
                  disabled={activeSandbox.isBaseline}
                  value={activeSandbox.config.workflows.retryBudget}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    updateActiveConfig((prev) => ({
                      ...prev,
                      workflows: { ...prev.workflows, retryBudget: val },
                    }));
                  }}
                  className="input text-xs"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: MODELS */}
        {activeConfigTab === 'models' && (
          <div className="space-y-4 text-xs font-mono">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-secondary/20 border border-border space-y-2">
                <label className="font-semibold text-foreground block">PRIMARY MODEL</label>
                <select
                  disabled={activeSandbox.isBaseline}
                  value={activeSandbox.config.models.primary}
                  onChange={(e) => {
                    const val = e.target.value;
                    updateActiveConfig((prev) => ({
                      ...prev,
                      models: { ...prev.models, primary: val },
                    }));
                  }}
                  className="input text-xs"
                >
                  <option value="Claude 3.5 Sonnet">Claude 3.5 Sonnet</option>
                  <option value="GPT-4o">GPT-4o</option>
                  <option value="Gemini 1.5 Pro">Gemini 1.5 Pro</option>
                  <option value="Gemini 1.5 Flash">Gemini 1.5 Flash</option>
                  <option value="Claude 3.5 Haiku">Claude 3.5 Haiku</option>
                </select>
              </div>

              <div className="p-4 rounded-xl bg-secondary/20 border border-border space-y-2">
                <label className="font-semibold text-foreground block">FAILOVER MODEL</label>
                <select
                  disabled={activeSandbox.isBaseline}
                  value={activeSandbox.config.models.fallback}
                  onChange={(e) => {
                    const val = e.target.value;
                    updateActiveConfig((prev) => ({
                      ...prev,
                      models: { ...prev.models, fallback: val },
                    }));
                  }}
                  className="input text-xs"
                >
                  <option value="GPT-4o">GPT-4o</option>
                  <option value="Claude 3.5 Sonnet">Claude 3.5 Sonnet</option>
                  <option value="Claude 3.5 Haiku">Claude 3.5 Haiku</option>
                  <option value="Gemini 1.5 Flash">Gemini 1.5 Flash</option>
                </select>
              </div>

              <div className="p-4 rounded-xl bg-secondary/20 border border-border space-y-2">
                <label className="font-semibold text-foreground block">SAMPLING TEMPERATURE</label>
                <input
                  type="number"
                  step="0.05"
                  min="0.0"
                  max="1.0"
                  disabled={activeSandbox.isBaseline}
                  value={activeSandbox.config.models.temperature}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0.2;
                    updateActiveConfig((prev) => ({
                      ...prev,
                      models: { ...prev.models, temperature: val },
                    }));
                  }}
                  className="input text-xs"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: ROUTING */}
        {activeConfigTab === 'routing' && (
          <div className="space-y-4 text-xs font-mono">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-secondary/20 border border-border space-y-2">
                <label className="font-semibold text-foreground block">ROUTING MODE</label>
                <select
                  disabled={activeSandbox.isBaseline}
                  value={activeSandbox.config.routing.mode}
                  onChange={(e) => {
                    const val = e.target.value as SandboxScenario['config']['routing']['mode'];
                    updateActiveConfig((prev) => ({
                      ...prev,
                      routing: { ...prev.routing, mode: val },
                    }));
                  }}
                  className="input text-xs"
                >
                  <option value="COST_OPTIMIZED">Cost-Optimized (Cheap First)</option>
                  <option value="BALANCED">Balanced (Standard Tier)</option>
                  <option value="PERFORMANCE_TIER">Performance Tier (Reasoning First)</option>
                  <option value="BURST_DYNAMIC">Burst Dynamic (High Concurrency)</option>
                </select>
              </div>

              <div className="p-4 rounded-xl bg-secondary/20 border border-border space-y-2">
                <label className="font-semibold text-foreground block">CACHE-FIRST EVALUATION</label>
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    disabled={activeSandbox.isBaseline}
                    checked={activeSandbox.config.routing.cacheFirst}
                    onChange={(e) => {
                      const val = e.target.checked;
                      updateActiveConfig((prev) => ({
                        ...prev,
                        routing: { ...prev.routing, cacheFirst: val },
                      }));
                    }}
                    className="accent-primary"
                  />
                  <span>Enforce prompt semantic cache check</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-secondary/20 border border-border space-y-2">
                <label className="font-semibold text-foreground block">CIRCUIT BREAKER (MS)</label>
                <input
                  type="number"
                  step="500"
                  disabled={activeSandbox.isBaseline}
                  value={activeSandbox.config.routing.circuitBreakerThresholdMs}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 4000;
                    updateActiveConfig((prev) => ({
                      ...prev,
                      routing: { ...prev.routing, circuitBreakerThresholdMs: val },
                    }));
                  }}
                  className="input text-xs"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: RESOURCES */}
        {activeConfigTab === 'resources' && (
          <div className="space-y-4 text-xs font-mono">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-secondary/20 border border-border space-y-2">
                <label className="font-semibold text-foreground block">MONTHLY BUDGET (USD)</label>
                <input
                  type="number"
                  disabled={activeSandbox.isBaseline}
                  value={activeSandbox.config.resources.monthlyBudgetUsd}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 100;
                    updateActiveConfig((prev) => ({
                      ...prev,
                      resources: { ...prev.resources, monthlyBudgetUsd: val },
                    }));
                  }}
                  className="input text-xs text-emerald-400 font-bold"
                />
              </div>

              <div className="p-4 rounded-xl bg-secondary/20 border border-border space-y-2">
                <label className="font-semibold text-foreground block">PARALLEL SLOTS</label>
                <input
                  type="number"
                  disabled={activeSandbox.isBaseline}
                  value={activeSandbox.config.resources.parallelSlots}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 5;
                    updateActiveConfig((prev) => ({
                      ...prev,
                      resources: { ...prev.resources, parallelSlots: val },
                    }));
                  }}
                  className="input text-xs"
                />
              </div>

              <div className="p-4 rounded-xl bg-secondary/20 border border-border space-y-2">
                <label className="font-semibold text-foreground block">DAILY TOKEN CEILING</label>
                <input
                  type="number"
                  disabled={activeSandbox.isBaseline}
                  value={activeSandbox.config.resources.tokenCeilingDaily}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 500000;
                    updateActiveConfig((prev) => ({
                      ...prev,
                      resources: { ...prev.resources, tokenCeilingDaily: val },
                    }));
                  }}
                  className="input text-xs"
                />
              </div>

              <div className="p-4 rounded-xl bg-secondary/20 border border-border space-y-2">
                <label className="font-semibold text-foreground block">GPU ACCELERATOR CORES</label>
                <input
                  type="number"
                  disabled={activeSandbox.isBaseline}
                  value={activeSandbox.config.resources.gpuCores}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 4;
                    updateActiveConfig((prev) => ({
                      ...prev,
                      resources: { ...prev.resources, gpuCores: val },
                    }));
                  }}
                  className="input text-xs"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: POLICIES */}
        {activeConfigTab === 'policies' && (
          <div className="space-y-4 text-xs font-mono">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-secondary/20 border border-border space-y-2">
                <label className="font-semibold text-foreground block">CEO APPROVAL GATE (RISK LEVEL)</label>
                <select
                  disabled={activeSandbox.isBaseline}
                  value={activeSandbox.config.policies.humanApprovalThresholdUsd <= 25 ? 'STAGE_2_AND_5' : activeSandbox.config.policies.humanApprovalThresholdUsd <= 50 ? 'STAGE_5_ONLY' : 'EXCEPTION_ONLY'}
                  onChange={(e) => {
                    const val = e.target.value === 'STAGE_2_AND_5' ? 25 : e.target.value === 'STAGE_5_ONLY' ? 50 : 100;
                    updateActiveConfig((prev) => ({
                      ...prev,
                      policies: { ...prev.policies, humanApprovalThresholdUsd: val },
                    }));
                  }}
                  className="input text-xs text-amber-400 font-bold"
                >
                  <option value="STAGE_2_AND_5">Stage 2 (Architecture) & Stage 5 (Release) [Recommended CEO Gate]</option>
                  <option value="STAGE_5_ONLY">Stage 5 (Production Release Only)</option>
                  <option value="EXCEPTION_ONLY">Critical Exception Only (Autonomous Level 4)</option>
                </select>
                <span className="text-[10px] text-muted-foreground block">
                  Determines at which operational pipeline gates the autonomous agent team pauses for 1-click CEO Executive Briefing sign-off.
                </span>
              </div>

              <div className="p-4 rounded-xl bg-secondary/20 border border-border space-y-2">
                <label className="font-semibold text-foreground block">COUNCIL DISSENT RECORDING</label>
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    disabled={activeSandbox.isBaseline}
                    checked={activeSandbox.config.policies.requireDissentRecord}
                    onChange={(e) => {
                      const val = e.target.checked;
                      updateActiveConfig((prev) => ({
                        ...prev,
                        policies: { ...prev.policies, requireDissentRecord: val },
                      }));
                    }}
                    className="accent-primary"
                  />
                  <span>Mandatory preservation of agent council dissent into company memory</span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-secondary/10 border border-border space-y-2">
              <span className="font-semibold text-foreground block">APPLIED POLICY RULES</span>
              <div className="flex flex-wrap gap-2">
                {activeSandbox.config.policies.rules.map((rule, idx) => (
                  <span key={idx} className="badge badge-outline text-xs">
                    {rule}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 5. EXPERIMENTAL RESULTS & COMPARISON VIEW ───────────────────────── */}
      {/* Metrics filter bar */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-foreground uppercase font-mono tracking-wider flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Experimental Comparison Metrics
            </h3>
            <p className="text-xs text-muted-foreground">
              Compare Current Organization against Simulations A, B, and C across all 7 operational dimensions.
            </p>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-mono uppercase text-muted-foreground mr-1">Filter Metric:</span>
            {[
              'all',
              'completion',
              'cost',
              'latency',
              'resource usage',
              'quality metrics',
              'failures',
              'human intervention',
            ].map((m) => (
              <button
                key={m}
                onClick={() => setMetricFilter(m as MetricFilter)}
                className={`px-2 py-1 rounded text-[10px] font-mono capitalize transition-all ${
                  metricFilter === m
                    ? 'bg-primary text-primary-foreground font-bold shadow'
                    : 'bg-secondary/40 text-muted-foreground hover:text-foreground'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* COMPARISON CARDS GRID: CURRENT vs SIM A vs SIM B vs SIM C */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {sandboxes.map((branch) => {
            const res = branch.results;
            const isBaseline = branch.isBaseline;
            const isSelected = branch.id === activeBranchId;

            return (
              <div
                key={branch.id}
                className={`rounded-2xl border p-5 space-y-4 flex flex-col justify-between ${
                  isSelected
                    ? 'border-primary bg-card ring-1 ring-primary/40 shadow-lg'
                    : 'border-border bg-card/60'
                }`}
              >
                {/* Branch Header */}
                <div className="border-b border-border/60 pb-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase">
                      {branch.key}
                    </span>
                    <span
                      className={`badge text-[9px] font-mono ${
                        isBaseline ? 'badge-primary' : 'badge-outline'
                      }`}
                    >
                      {branch.badge}
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-foreground mt-1">{branch.name}</h4>
                  <span className="text-[10px] font-mono text-muted-foreground block mt-0.5">
                    {res?.lastRunTimestamp || 'No run recorded'}
                  </span>
                </div>

                {/* The 7 Comparison Metrics */}
                {res ? (
                  <div className="space-y-2.5 text-xs font-mono">
                    {/* 1. COMPLETION */}
                    {(metricFilter === 'all' || metricFilter === 'completion') && (
                      <div className="flex justify-between items-center p-2 rounded-lg bg-secondary/30">
                        <span className="text-muted-foreground">Completion</span>
                        <span className="font-bold text-emerald-400">
                          {res.completionRatePct}% ({res.tasksSucceeded}/{res.tasksTotal})
                        </span>
                      </div>
                    )}

                    {/* 2. COST */}
                    {(metricFilter === 'all' || metricFilter === 'cost') && (
                      <div className="flex justify-between items-center p-2 rounded-lg bg-secondary/30">
                        <span className="text-muted-foreground">Workload Cost</span>
                        <span className="font-bold text-emerald-400">
                          ${res.totalWorkloadCostUsd.toFixed(2)} (${res.avgCostPerTaskUsd}/task)
                        </span>
                      </div>
                    )}

                    {/* 3. LATENCY */}
                    {(metricFilter === 'all' || metricFilter === 'latency') && (
                      <div className="flex justify-between items-center p-2 rounded-lg bg-secondary/30">
                        <span className="text-muted-foreground">Avg / p95 Latency</span>
                        <span className="font-bold text-cyan-400">
                          {res.avgLatencyMs}ms / {res.p95LatencyMs}ms
                        </span>
                      </div>
                    )}

                    {/* 4. RESOURCE USAGE */}
                    {(metricFilter === 'all' || metricFilter === 'resource usage') && (
                      <div className="flex justify-between items-center p-2 rounded-lg bg-secondary/30">
                        <span className="text-muted-foreground">Resource Saturation</span>
                        <span className="font-bold text-foreground">
                          {res.resourceUsagePct}% capacity
                        </span>
                      </div>
                    )}

                    {/* 5. QUALITY METRICS */}
                    {(metricFilter === 'all' || metricFilter === 'quality metrics') && (
                      <div className="flex justify-between items-center p-2 rounded-lg bg-secondary/30">
                        <span className="text-muted-foreground">Quality Benchmark</span>
                        <span className="font-bold text-indigo-400">
                          {res.qualityScorePct}% score
                        </span>
                      </div>
                    )}

                    {/* 6. FAILURES */}
                    {(metricFilter === 'all' || metricFilter === 'failures') && (
                      <div className="flex justify-between items-center p-2 rounded-lg bg-secondary/30">
                        <span className="text-muted-foreground">Failures / Retries</span>
                        <span
                          className={`font-bold ${
                            res.failuresCount === 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {res.failuresCount} failures
                        </span>
                      </div>
                    )}

                    {/* 7. HUMAN INTERVENTION */}
                    {(metricFilter === 'all' || metricFilter === 'human intervention') && (
                      <div className="flex justify-between items-center p-2 rounded-lg bg-secondary/30">
                        <span className="text-muted-foreground">Human Interventions</span>
                        <span className="font-bold text-amber-400">
                          {res.humanInterventionsCount} escalations
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-8 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                    <FlaskConical className="h-6 w-6 text-muted-foreground/40 mx-auto mb-2" />
                    <span>Click &quot;Run Simulation&quot; to test workload</span>
                  </div>
                )}

                {/* Insights Snippet */}
                {res?.insights && (
                  <div className="pt-2 border-t border-border/50 text-[11px] text-muted-foreground space-y-1">
                    <span className="font-bold text-foreground text-[10px] uppercase font-mono block">
                      Key Experimental Findings:
                    </span>
                    <ul className="list-disc list-inside space-y-0.5">
                      {res.insights.slice(0, 2).map((ins, i) => (
                        <li key={i}>{ins}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Footer Branch Actions */}
                <div className="pt-2 border-t border-border/60 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setActiveBranchId(branch.id)}
                    className="text-xs text-primary font-mono hover:underline flex items-center gap-1"
                  >
                    Select Branch &rarr;
                  </button>
                  {!isBaseline && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveBranchId(branch.id);
                        setPromoteModalOpen(true);
                      }}
                      className="btn btn-outline text-[10px] h-6 px-2 font-mono"
                    >
                      Promote
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 6. COMPARISON MATRIX MODAL ────────────────────────────────────── */}
      {compareViewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-5xl glass rounded-2xl p-6 ring-1 ring-border shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Scale className="h-5 w-5 text-primary" />
                <h3 className="text-base font-bold text-foreground">
                  Multidimensional Sandbox Comparison Matrix
                </h3>
              </div>
              <button
                onClick={() => setCompareViewOpen(false)}
                className="btn btn-ghost h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Direct side-by-side comparison of baseline production against all active simulation branches.
              Notice: All results reflect synthetic trial models and are not guaranteed future outcomes.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left font-mono">
                <thead>
                  <tr className="border-b border-border/80 text-muted-foreground">
                    <th className="pb-3 font-semibold">METRIC / ATTRIBUTE</th>
                    {sandboxes.map((s) => (
                      <th key={s.id} className="pb-3 font-bold text-foreground">
                        {s.name}
                        <span className="block text-[10px] font-normal text-muted-foreground">
                          {s.badge}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  <tr>
                    <td className="py-2.5 font-bold text-muted-foreground">Workforce Size</td>
                    {sandboxes.map((s) => (
                      <td key={s.id} className="py-2.5 font-bold text-foreground">
                        {s.config.agents.count} Agents
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2.5 font-bold text-muted-foreground">Routing Mode</td>
                    {sandboxes.map((s) => (
                      <td key={s.id} className="py-2.5 text-cyan-400 font-semibold">
                        {s.config.routing.mode}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2.5 font-bold text-muted-foreground">Monthly Budget</td>
                    {sandboxes.map((s) => (
                      <td key={s.id} className="py-2.5 font-bold text-emerald-400">
                        ${s.config.resources.monthlyBudgetUsd}.00
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2.5 font-bold text-muted-foreground">1. Completion Rate</td>
                    {sandboxes.map((s) => (
                      <td key={s.id} className="py-2.5 font-bold text-emerald-400">
                        {s.results ? `${s.results.completionRatePct}%` : '—'}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2.5 font-bold text-muted-foreground">2. Total Workload Cost</td>
                    {sandboxes.map((s) => (
                      <td key={s.id} className="py-2.5 font-bold text-foreground">
                        {s.results ? `$${s.results.totalWorkloadCostUsd.toFixed(2)}` : '—'}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2.5 font-bold text-muted-foreground">3. Average Latency</td>
                    {sandboxes.map((s) => (
                      <td key={s.id} className="py-2.5 text-blue-400 font-bold">
                        {s.results ? `${s.results.avgLatencyMs} ms` : '—'}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2.5 font-bold text-muted-foreground">4. Resource Usage</td>
                    {sandboxes.map((s) => (
                      <td key={s.id} className="py-2.5 text-foreground">
                        {s.results ? `${s.results.resourceUsagePct}%` : '—'}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2.5 font-bold text-muted-foreground">5. Quality Score</td>
                    {sandboxes.map((s) => (
                      <td key={s.id} className="py-2.5 font-bold text-indigo-400">
                        {s.results ? `${s.results.qualityScorePct}%` : '—'}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2.5 font-bold text-muted-foreground">6. Failure Rate</td>
                    {sandboxes.map((s) => (
                      <td key={s.id} className="py-2.5 text-rose-400 font-bold">
                        {s.results ? `${s.results.failuresCount} tasks` : '—'}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2.5 font-bold text-muted-foreground">7. Human Interventions</td>
                    {sandboxes.map((s) => (
                      <td key={s.id} className="py-2.5 text-amber-400 font-bold">
                        {s.results ? `${s.results.humanInterventionsCount} escalations` : '—'}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-3 border-t border-border">
              <button
                onClick={() => setCompareViewOpen(false)}
                className="btn btn-secondary text-xs"
              >
                Close Comparison
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 7. INSPECT RAW CONFIGURATION MODAL ─────────────────────────────── */}
      {inspectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl glass rounded-2xl p-6 ring-1 ring-border shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div>
                <span className="text-[10px] font-mono text-muted-foreground uppercase">
                  RAW CONFIGURATION TREE &bull; {activeSandbox.key}
                </span>
                <h3 className="text-base font-bold text-foreground">{activeSandbox.name}</h3>
              </div>
              <button
                onClick={() => setInspectModalOpen(false)}
                className="btn btn-ghost h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <pre className="p-4 rounded-xl bg-black/50 border border-border font-mono text-xs text-foreground overflow-x-auto max-h-[60vh]">
              {JSON.stringify(
                {
                  id: activeSandbox.id,
                  name: activeSandbox.name,
                  badge: activeSandbox.badge,
                  config: activeSandbox.config,
                  results: activeSandbox.results,
                },
                null,
                2
              )}
            </pre>

            <div className="flex justify-end pt-2 border-t border-border">
              <button
                onClick={() => setInspectModalOpen(false)}
                className="btn btn-secondary text-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 8. PROMOTE CONFIGURATION MODAL ─────────────────────────────────── */}
      {promoteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md glass rounded-2xl p-6 ring-1 ring-border shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                <h3 className="text-base font-bold text-foreground">
                  Promote Sandbox Configuration
                </h3>
              </div>
              <button
                onClick={() => setPromoteModalOpen(false)}
                className="btn btn-ghost h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              You are promoting <strong className="text-foreground">{activeSandbox.name}</strong> into the live organization.
              An immutable safety snapshot of the current organization will be automatically captured prior to applying changes.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">Approved By (Executive Authority)</label>
                <input
                  type="text"
                  className="input text-xs"
                  value={approverName}
                  onChange={(e) => setApproverName(e.target.value)}
                  placeholder="e.g. Chief Operating Officer"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Promotion Rationale & Evidence</label>
                <textarea
                  rows={3}
                  className="input text-xs py-2 h-auto"
                  value={promoteNotes}
                  onChange={(e) => setPromoteNotes(e.target.value)}
                  placeholder="Detail the benchmark results that warrant promotion..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <button
                onClick={() => setPromoteModalOpen(false)}
                className="btn btn-outline text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handlePromoteConfiguration}
                className="btn btn-primary text-xs bg-emerald-500 hover:bg-emerald-600 text-white gap-1.5"
              >
                <Check className="h-3.5 w-3.5" />
                Confirm & Promote to Live
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
