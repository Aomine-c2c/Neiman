'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Brain,
  Search,
  BookOpen,
  Scale,
  Shield,
  Layers,
  Sparkles,
  Lock,
  Eye,
  Plus,
  RotateCw,
  Send,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Tag,
  Sliders,
  FileText,
  Filter,
  Users,
  Compass,
  ArrowRight,
  GitBranch,
  Bot,
  FolderKanban,
  CheckSquare,
  FlaskConical,
  ExternalLink,
  ChevronRight,
  Check,
  Flame,
  MessageSquare,
  HelpCircle,
  Clock,
  History,
  Info,
  Cpu,
  Network,
  Share2,
  Copy,
  Download,
  Terminal,
  Code2,
  Workflow,
  GitFork,
  Target,
  ShieldAlert,
} from 'lucide-react';
import { sourceGraphApi } from '@/lib/api/sourceGraph';
import {
  memoryApi,
  MemoryDomain,
  MemoryScope,
  MemoryItem,
  DecisionRecord,
  ContextAssemblyRequest,
  MemoryItemCreate,
  DecisionRecordCreate,
} from '@/lib/api/memory';
import { projectsApi, Task } from '@/lib/api/projects';
import { agentsApi } from '@/lib/api/agents';
import { workflowsApi } from '@/lib/api/workflows';
import { governanceApi } from '@/lib/api/governance';
import { useOrganizationContext } from '@/lib/organizationContext';

// 8 Primary Organizational Memory Domains Requested
const PRIMARY_MEMORY_DOMAINS: { id: MemoryDomain; label: string; desc: string; icon: React.ElementType }[] = [
  { id: 'KNOWLEDGE_BASE', label: 'Knowledge', desc: 'Core institutional repositories & technical documentation', icon: BookOpen },
  { id: 'DECISION', label: 'Decisions', desc: 'Historic ADRs, tradeoffs, rationales, and deliberative records', icon: Scale },
  { id: 'EXPERIMENT', label: 'Experiments', desc: 'Hypotheses, benchmarks, A/B iterations, and simulation trials', icon: FlaskConical },
  { id: 'LESSON', label: 'Lessons', desc: 'Post-mortem takeaways, failure prevention, and learned guidelines', icon: Flame },
  { id: 'DOCUMENT', label: 'Documents', desc: 'Organizational charters, specs, manuals, and ingested papers', icon: FileText },
  { id: 'AGENT', label: 'Agent Memory', desc: 'Role specializations, skill profiles, and persistent agent reflections', icon: Bot },
  { id: 'PROJECT', label: 'Project Memory', desc: 'Milestones, delivery histories, roadmaps, and project decisions', icon: FolderKanban },
  { id: 'POLICY', label: 'Policies', desc: 'Compliance guidelines, constitutional guardrails, and autonomy boundaries', icon: Shield },
];

const SCOPE_BADGES: Record<string, { bg: string; text: string; border: string }> = {
  PUBLIC: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  INTERNAL: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
  CONFIDENTIAL: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  RESTRICTED: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
  PRIVATE: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30' },
};

// 8 Target Search Entity Types
type SearchEntityType =
  | 'ALL'
  | 'projects'
  | 'agents'
  | 'decisions'
  | 'documents'
  | 'tasks'
  | 'workflows'
  | 'policies'
  | 'knowledge';

interface GlobalSearchResult {
  id: string;
  type: SearchEntityType;
  title: string;
  excerpt: string;
  provenance: {
    source: string;
    domainOrCategory: string;
    authorOrOrigin: string;
    timestamp?: string;
    confidenceOrScope?: string;
  };
  link?: string;
}

export default function OrganizationalMemoryPage() {
  const activeCompany = useOrganizationContext();
  const companyId = activeCompany?.id || '';
  const queryClient = useQueryClient();

  // Tab State
  const [activeTab, setActiveTab] = useState<'domains' | 'global_search' | 'decision_explorer' | 'assembly' | 'knowledge_graph' | 'graphify' | 'memgpt' | 'code_graph' | 'source_graph' | 'add'>('domains');

  // Source Graph State
  const [sourceGraphQuery, setSourceGraphQuery] = useState('lang:python type:class TokenCompressor');
  const [selectedSourceFile, setSelectedSourceFile] = useState<string>('apps/api/nexora/core/compression.py');
  const [selectedSourceSymbol, setSelectedSourceSymbol] = useState<string>('TokenCompressor');
  const [showBlame, setShowBlame] = useState(true);

  // Codebase AST Knowledge Graph State
  const [codeSymbolSearch, setCodeSymbolSearch] = useState('');
  const [selectedCodeSymbol, setSelectedCodeSymbol] = useState<string | null>(null);
  const [codeSearchMode, setCodeSearchMode] = useState<'hybrid' | 'lexical'>('hybrid');
  const [subgraphDepth, setSubgraphDepth] = useState<number>(2);

  // Graphify & Obsidian State
  const [copiedVault, setCopiedVault] = useState(false);
  const [selectedGraphNode, setSelectedGraphNode] = useState<string | null>(null);

  // MemGPT State
  const [memgptAgentId, setMemgptAgentId] = useState<string>('');
  const [editingBlockName, setEditingBlockName] = useState<string>('persona');
  const [editingBlockContent, setEditingBlockContent] = useState<string>('');
  const [newRecallMessage, setNewRecallMessage] = useState<string>('');

  // Domain Filter State
  const [selectedDomain, setSelectedDomain] = useState<MemoryDomain | 'ALL'>('ALL');
  const [selectedScope, setSelectedScope] = useState<string>('');
  const [domainSearchQuery, setDomainSearchQuery] = useState('');

  // Global Search State
  const [globalQuery, setGlobalQuery] = useState('');
  const [selectedSearchEntity, setSelectedSearchEntity] = useState<SearchEntityType>('ALL');

  // Decision Explorer State
  const [selectedDecisionId, setSelectedDecisionId] = useState<string | null>(null);
  const [newActualOutcome, setNewActualOutcome] = useState('');
  const [newLessonInput, setNewLessonInput] = useState('');

  // Context Assembly Simulator State
  const [taskObjective, setTaskObjective] = useState(
    'Audit compliance and customer data classification policies before deploying European payment gateway'
  );
  const [callerRole, setCallerRole] = useState('MEMBER');
  const [callerPermissions, setCallerPermissions] = useState('dept:compliance,role:MEMBER');
  const [maxContextTokens, setMaxContextTokens] = useState('2000');
  const [assembleCompressContext, setAssembleCompressContext] = useState(true);
  const [assembleStrategy, setAssembleStrategy] = useState<'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE' | 'TRIPLETS'>('AGGRESSIVE');

  // Ingest Memory State
  const [newTitle, setNewTitle] = useState('');
  const [newDomain, setNewDomain] = useState<MemoryDomain>('KNOWLEDGE_BASE');
  const [newScope, setNewScope] = useState<MemoryScope>('INTERNAL');
  const [newContent, setNewContent] = useState('');
  const [newSummary, setNewSummary] = useState('');
  const [newSource, setNewSource] = useState('Executive charter ingestion');
  const [newConfidence, setNewConfidence] = useState('1.0');

  // --- QUERIES ---
  const { data: memories = [], isLoading: isMemoriesLoading, refetch: refetchMemories } = useQuery({
    queryKey: ['memory-items', companyId, selectedDomain, selectedScope, domainSearchQuery],
    queryFn: () => {
      if (domainSearchQuery.trim().length > 0) {
        return memoryApi.search(
          companyId,
          domainSearchQuery,
          selectedDomain !== 'ALL' ? selectedDomain : undefined,
          selectedScope || undefined
        );
      }
      return memoryApi.listMemories(companyId, {
        domain: selectedDomain !== 'ALL' ? selectedDomain : undefined,
        scope: selectedScope || undefined,
      });
    },
    enabled: !!companyId,
  });

  const { data: decisions = [], isLoading: isDecisionsLoading, refetch: refetchDecisions } = useQuery({
    queryKey: ['memory-decisions', companyId],
    queryFn: () => memoryApi.listDecisions(companyId),
    enabled: !!companyId,
  });

  // Cross-entity datasets for Global Search
  const { data: projects = [] } = useQuery({
    queryKey: ['global-search-projects', companyId],
    queryFn: () => projectsApi.list(companyId),
    enabled: !!companyId,
  });

  const { data: allProjectTasks = [] } = useQuery({
    queryKey: ['global-search-tasks', companyId, projects.map((p) => p.id).join(',')],
    queryFn: async () => {
      if (!companyId || projects.length === 0) return [];
      const results = await Promise.allSettled(
        projects.map((p) => projectsApi.listTasks(companyId, p.id))
      );
      return results.flatMap((r) => (r.status === 'fulfilled' && Array.isArray(r.value) ? r.value : []));
    },
    enabled: !!companyId && projects.length > 0,
  });

  const { data: agents = [] } = useQuery({
    queryKey: ['global-search-agents', companyId],
    queryFn: () => agentsApi.list(companyId),
    enabled: !!companyId,
  });

  const { data: workflows = [] } = useQuery({
    queryKey: ['global-search-workflows', companyId],
    queryFn: () => workflowsApi.list(companyId),
    enabled: !!companyId,
  });

  const { data: constitution } = useQuery({
    queryKey: ['global-search-constitution', companyId],
    queryFn: () => governanceApi.getConstitution(companyId),
    enabled: !!companyId,
  });

  // Knowledge Graph Search & Neighborhood State
  const [kgSearch, setKgSearch] = useState('');
  const [kgEntityType, setKgEntityType] = useState('ALL');
  const [selectedKgEntityId, setSelectedKgEntityId] = useState<string | null>(null);

  // --- MUTATIONS ---
  const assembleMutation = useMutation({
    mutationFn: (req: ContextAssemblyRequest) => memoryApi.assembleContext(companyId, req),
  });

  const { data: graphData, isLoading: isGraphLoading, refetch: refetchGraph } = useQuery({
    queryKey: ['memory-knowledge-graph', companyId, kgSearch, kgEntityType],
    queryFn: () => memoryApi.getKnowledgeGraph(companyId, { q: kgSearch, entityType: kgEntityType }),
    enabled: !!companyId,
  });

  const [extractText, setExtractText] = useState('');
  const extractFactsMutation = useMutation({
    mutationFn: (text: string) => memoryApi.extractKnowledgeFacts(companyId, { text }),
    onSuccess: () => {
      refetchGraph();
      setExtractText('');
    },
  });

  const createMemoryMutation = useMutation({
    mutationFn: (data: MemoryItemCreate) => memoryApi.createMemory(companyId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memory-items', companyId] });
      setActiveTab('domains');
      setNewTitle('');
      setNewContent('');
      setNewSummary('');
    },
  });

  const recordOutcomeMutation = useMutation({
    mutationFn: ({ decisionId, outcome, lessons }: { decisionId: string; outcome: string; lessons: string[] }) =>
      memoryApi.recordOutcome(companyId, decisionId, { actual_outcome: outcome, lessons_learned: lessons }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memory-decisions', companyId] });
      queryClient.invalidateQueries({ queryKey: ['memory-items', companyId] });
      setNewActualOutcome('');
      setNewLessonInput('');
    },
  });

  // --- CODEBASE AST KNOWLEDGE GRAPH QUERIES ---
  const {
    data: codeGraphIndex,
    isLoading: isCodeGraphLoading,
    refetch: refetchCodeGraph,
  } = useQuery({
    queryKey: ['memory-code-graph-index', companyId],
    queryFn: () => memoryApi.getCodebaseGraphIndex(companyId),
    enabled: !!companyId,
  });

  const syncCodeGraphMutation = useMutation({
    mutationFn: () => memoryApi.reindexCodebase(companyId, { sync_vector: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memory-code-graph-index', companyId] });
      queryClient.invalidateQueries({ queryKey: ['memory-knowledge-graph', companyId] });
      queryClient.invalidateQueries({ queryKey: ['memory-graphify-network', companyId] });
      queryClient.invalidateQueries({ queryKey: ['memory-code-symbols'] });
      queryClient.invalidateQueries({ queryKey: ['memory-codebase-subgraph'] });
    },
  });

  const { data: codeSymbolResults, isLoading: isSymbolSearching } = useQuery({
    queryKey: ['memory-code-symbols', companyId, codeSymbolSearch, codeSearchMode],
    queryFn: async () => {
      if (codeSearchMode === 'hybrid') {
        return await memoryApi.searchCodebaseHybrid(companyId, codeSymbolSearch);
      }
      return await memoryApi.searchCodebaseSymbols(companyId, codeSymbolSearch);
    },
    enabled: !!companyId && codeSymbolSearch.trim().length > 1,
  });

  const { data: codebaseSubgraph, isLoading: isSubgraphLoading } = useQuery({
    queryKey: ['memory-codebase-subgraph', companyId, selectedCodeSymbol, subgraphDepth],
    queryFn: () => memoryApi.getCodebaseSubgraph(companyId, selectedCodeSymbol!, subgraphDepth),
    enabled: !!companyId && !!selectedCodeSymbol,
  });

  // --- SOURCE GRAPH QUERIES ---
  const { data: sourceFileData, isLoading: isSourceFileLoading } = useQuery({
    queryKey: ['source-graph-file', companyId, selectedSourceFile],
    queryFn: () => sourceGraphApi.getSourceFile(companyId, selectedSourceFile),
    enabled: !!companyId && !!selectedSourceFile,
  });

  const { data: symbolDefinition, isLoading: isDefinitionLoading } = useQuery({
    queryKey: ['source-graph-definition', companyId, selectedSourceSymbol],
    queryFn: () => sourceGraphApi.getDefinition(companyId, selectedSourceSymbol),
    enabled: !!companyId && !!selectedSourceSymbol,
  });

  const { data: symbolReferences, isLoading: isReferencesLoading } = useQuery({
    queryKey: ['source-graph-references', companyId, selectedSourceSymbol],
    queryFn: () => sourceGraphApi.getReferences(companyId, selectedSourceSymbol),
    enabled: !!companyId && !!selectedSourceSymbol,
  });

  const { data: blastRadiusData, isLoading: isBlastRadiusLoading } = useQuery({
    queryKey: ['source-graph-blast-radius', companyId, selectedSourceSymbol, selectedSourceFile],
    queryFn: () => sourceGraphApi.getBlastRadius(companyId, selectedSourceSymbol || selectedSourceFile),
    enabled: !!companyId && (!!selectedSourceSymbol || !!selectedSourceFile),
  });

  const { data: sourceSearchResults, isLoading: isSourceSearching } = useQuery({
    queryKey: ['source-graph-search', companyId, sourceGraphQuery],
    queryFn: () => sourceGraphApi.search(companyId, sourceGraphQuery),
    enabled: !!companyId && sourceGraphQuery.trim().length > 1,
  });

  // --- GRAPHIFY & OBSIDIAN NETWORK QUERY ---
  const { data: graphifyData, isLoading: isGraphifyLoading, refetch: refetchGraphify } = useQuery({
    queryKey: ['memory-graphify-network', companyId],
    queryFn: () => memoryApi.getGraphifyNetwork(companyId),
    enabled: !!companyId,
  });

  // --- MEMGPT HIERARCHICAL CONTEXT QUERIES ---
  const selectedAgentIdForMemGPT = memgptAgentId || (agents[0]?.id ?? '');

  const { data: memgptContext, isLoading: isMemgptLoading, refetch: refetchMemGPT } = useQuery({
    queryKey: ['memgpt-context', companyId, selectedAgentIdForMemGPT],
    queryFn: () => memoryApi.getMemGPTContext(companyId, selectedAgentIdForMemGPT),
    enabled: !!companyId && !!selectedAgentIdForMemGPT,
  });

  const { data: coreBlocks = [], refetch: refetchCoreBlocks } = useQuery({
    queryKey: ['memgpt-core-blocks', companyId, selectedAgentIdForMemGPT],
    queryFn: () => memoryApi.listCoreMemoryBlocks(companyId, selectedAgentIdForMemGPT),
    enabled: !!companyId && !!selectedAgentIdForMemGPT,
  });

  const updateCoreBlockMutation = useMutation({
    mutationFn: ({ blockName, content, mode }: { blockName: string; content: string; mode?: 'replace' | 'append' }) =>
      memoryApi.updateCoreMemoryBlock(companyId, selectedAgentIdForMemGPT, {
        block_name: blockName,
        content,
        mode,
      }),
    onSuccess: () => {
      refetchCoreBlocks();
      refetchMemGPT();
      setEditingBlockContent('');
    },
  });

  const appendRecallMutation = useMutation({
    mutationFn: ({ role, message }: { role: string; message: string }) =>
      memoryApi.appendRecallMessage(companyId, selectedAgentIdForMemGPT, { role, message }),
    onSuccess: () => {
      refetchMemGPT();
      setNewRecallMessage('');
    },
  });

  // Automatically select first decision for explorer if none selected
  const activeDecision = useMemo(() => {
    if (!decisions || decisions.length === 0) return null;
    if (selectedDecisionId) {
      return decisions.find((d) => d.id === selectedDecisionId) || decisions[0];
    }
    return decisions[0];
  }, [decisions, selectedDecisionId]);

  // Aggregate Cross-Domain Global Search Results with Provenance
  const globalSearchResults = useMemo<GlobalSearchResult[]>(() => {
    const q = globalQuery.trim().toLowerCase();
    const results: GlobalSearchResult[] = [];

    // 1. Projects
    if (selectedSearchEntity === 'ALL' || selectedSearchEntity === 'projects') {
      projects.forEach((p) => {
        if (!q || p.name.toLowerCase().includes(q) || (p.objective && p.objective.toLowerCase().includes(q))) {
          results.push({
            id: `proj-${p.id}`,
            type: 'projects',
            title: p.name,
            excerpt: p.objective || p.description || 'Active organizational project initiative.',
            provenance: {
              source: `Project Registry: /dashboard/projects`,
              domainOrCategory: `Status: ${p.status}`,
              authorOrOrigin: p.owner_id ? `Owner ID: ${p.owner_id}` : 'System Initialized',
              timestamp: p.created_at,
              confidenceOrScope: 'PROJECT SCOPE',
            },
            link: '/dashboard/projects',
          });
        }
      });
    }

    // 2. Agents
    if (selectedSearchEntity === 'ALL' || selectedSearchEntity === 'agents') {
      agents.forEach((a) => {
        if (
          !q ||
          a.name.toLowerCase().includes(q) ||
          (a.system_instructions && a.system_instructions.toLowerCase().includes(q)) ||
          a.responsibilities?.some((r) => r.toLowerCase().includes(q))
        ) {
          results.push({
            id: `agent-${a.id}`,
            type: 'agents',
            title: a.name,
            excerpt: a.responsibilities?.join(', ') || a.system_instructions || 'Autonomous organizational agent.',
            provenance: {
              source: `Workforce Mesh: /dashboard/agents`,
              domainOrCategory: `Autonomy: ${a.autonomy}`,
              authorOrOrigin: a.department_id ? `Dept: ${a.department_id}` : 'Executive Staff',
              timestamp: a.created_at,
              confidenceOrScope: 'AGENT IDENTITY',
            },
            link: '/dashboard/agents',
          });
        }
      });
    }

    // 3. Decisions
    if (selectedSearchEntity === 'ALL' || selectedSearchEntity === 'decisions') {
      decisions.forEach((d) => {
        if (
          !q ||
          d.title.toLowerCase().includes(q) ||
          d.problem.toLowerCase().includes(q) ||
          d.decision.toLowerCase().includes(q)
        ) {
          results.push({
            id: `dec-${d.id}`,
            type: 'decisions',
            title: d.title,
            excerpt: `Decision: ${d.decision} — Problem: ${d.problem}`,
            provenance: {
              source: `Decision Record ADR: ${d.id}`,
              domainOrCategory: 'DECISION DOMAIN',
              authorOrOrigin: d.participants?.map((p) => p.name).join(', ') || 'Deliberation Council',
              timestamp: d.decided_at,
              confidenceOrScope: 'IMMUTABLE RECORD',
            },
            link: '/dashboard/decisions',
          });
        }
      });
    }

    // 4. Documents & Knowledge (Memories)
    memories.forEach((m) => {
      const isDoc = m.domain === 'DOCUMENT' || m.domain === 'KNOWLEDGE_BASE';
      const isPol = m.domain === 'POLICY';
      const isLes = m.domain === 'LESSON' || m.domain === 'FAILURE';

      let entityCategory: SearchEntityType = 'knowledge';
      if (isDoc) entityCategory = 'documents';
      if (isPol) entityCategory = 'policies';

      if (selectedSearchEntity === 'ALL' || selectedSearchEntity === entityCategory || selectedSearchEntity === 'knowledge') {
        if (!q || m.title.toLowerCase().includes(q) || m.content.toLowerCase().includes(q) || m.tags?.some((t) => t.toLowerCase().includes(q))) {
          results.push({
            id: `mem-${m.id}`,
            type: entityCategory,
            title: m.title,
            excerpt: m.summary || m.content,
            provenance: {
              source: m.source || 'Organizational Memory Store',
              domainOrCategory: `Domain: ${m.domain}`,
              authorOrOrigin: m.provenance_type,
              timestamp: m.created_at,
              confidenceOrScope: `${m.scope} (${Math.round(m.confidence * 100)}% Conf)`,
            },
            link: '/dashboard/memory',
          });
        }
      }
    });

    // 5. Tasks (From verified Project Tasks backend state)
    if (selectedSearchEntity === 'ALL' || selectedSearchEntity === 'tasks') {
      const agentMap = new Map(agents.map((a) => [a.id, a.name]));
      const projectMap = new Map(projects.map((p) => [p.id, p.name]));
      allProjectTasks.forEach((t) => {
        const titleMatch = !q || t.title.toLowerCase().includes(q);
        const descMatch = Boolean(t.description && t.description.toLowerCase().includes(q));
        if (titleMatch || descMatch) {
          const author = t.assigned_agent_id ? (agentMap.get(t.assigned_agent_id) || 'Specialist Agent') : 'Unassigned';
          const projName = projectMap.get(t.project_id) || 'Project Backlog';
          results.push({
            id: `task-${t.id}`,
            type: 'tasks',
            title: t.title,
            excerpt: t.description || `Task status: ${t.status} | Priority: ${t.priority}`,
            provenance: {
              source: `Project: ${projName}`,
              domainOrCategory: 'TASK EXECUTION',
              authorOrOrigin: author,
              timestamp: t.created_at,
              confidenceOrScope: t.status,
            },
            link: '/dashboard/tasks',
          });
        }
      });
    }

    // 6. Workflows
    if (selectedSearchEntity === 'ALL' || selectedSearchEntity === 'workflows') {
      workflows.forEach((w) => {
        if (!q || w.name.toLowerCase().includes(q) || (w.description && w.description.toLowerCase().includes(q))) {
          results.push({
            id: `wf-${w.id}`,
            type: 'workflows',
            title: w.name,
            excerpt: w.description || `${w.steps?.length || 0}-step autonomous orchestration DAG.`,
            provenance: {
              source: `Workflow Orchestrator: /dashboard/workflows`,
              domainOrCategory: `Trigger: ${w.trigger_type}`,
              authorOrOrigin: `Steps: ${w.steps?.length || 0}`,
              timestamp: w.created_at,
              confidenceOrScope: 'PIPELINE DAG',
            },
            link: '/dashboard/workflows',
          });
        }
      });
    }

    // 7. Policies (From Constitution & Governance)
    if (selectedSearchEntity === 'ALL' || selectedSearchEntity === 'policies') {
      if (constitution) {
        constitution.security_rules?.forEach((rule, idx) => {
          if (!q || rule.toLowerCase().includes(q)) {
            results.push({
              id: `sec-rule-${idx}`,
              type: 'policies',
              title: `Security Guardrail #${idx + 1}`,
              excerpt: rule,
              provenance: {
                source: `Constitution v${constitution.version}`,
                domainOrCategory: 'SECURITY POLICY',
                authorOrOrigin: constitution.established_by || 'Organizational Founder',
                timestamp: constitution.updated_at,
                confidenceOrScope: 'MANDATORY CONSTITUTIONAL RULE',
              },
              link: '/dashboard/governance',
            });
          }
        });
        constitution.operating_principles?.forEach((principle, idx) => {
          if (!q || principle.toLowerCase().includes(q)) {
            results.push({
              id: `principle-${idx}`,
              type: 'policies',
              title: `Operating Principle #${idx + 1}`,
              excerpt: principle,
              provenance: {
                source: `Constitution v${constitution.version}`,
                domainOrCategory: 'OPERATING PRINCIPLE',
                authorOrOrigin: 'Board of Directors',
                timestamp: constitution.updated_at,
                confidenceOrScope: 'FOUNDATIONAL DIRECTIVE',
              },
              link: '/dashboard/governance',
            });
          }
        });
      }
    }

    return results;
  }, [globalQuery, selectedSearchEntity, projects, allProjectTasks, agents, decisions, memories, workflows, constitution]);

  const handleAssemble = (e: React.FormEvent) => {
    e.preventDefault();
    assembleMutation.mutate({
      task_objective: taskObjective,
      caller_role: callerRole,
      caller_permissions: callerPermissions.split(',').map((p) => p.trim()).filter(Boolean),
      max_context_tokens: parseInt(maxContextTokens, 10) || 2000,
      compress_context: assembleCompressContext,
      compression_strategy: assembleStrategy,
    });
  };

  const handleCreateMemory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newContent) return;
    createMemoryMutation.mutate({
      title: newTitle,
      domain: newDomain,
      scope: newScope,
      content: newContent,
      summary: newSummary || undefined,
      source: newSource,
      confidence: parseFloat(newConfidence) || 1.0,
    });
  };

  const handleRecordOutcome = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDecision || !newActualOutcome.trim()) return;
    const lessons = newLessonInput
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    recordOutcomeMutation.mutate({
      decisionId: activeDecision.id,
      outcome: newActualOutcome.trim(),
      lessons: lessons.length > 0 ? lessons : ['Outcome systematically validated and catalogued for future agent generations.'],
    });
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Stage 8 — Memory & Codebase Index Header & Semantic Search Bar */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              <Brain className="h-3.5 w-3.5" />
              Memory & Codebase Index
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Codebase Topology & Institutional Recall
            </h1>
            <p className="text-xs text-muted-foreground max-w-2xl">
              Semantic AST index, module dependency graphs, architecture decision records (ADRs), and persistent engineering memory.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="hidden lg:flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground font-mono">
              <span className={`h-2 w-2 rounded-full ${syncCodeGraphMutation.isPending ? 'bg-amber-500 animate-pulse' : codeGraphIndex ? 'bg-emerald-500' : 'bg-muted-foreground'}`} />
              <span>
                {isCodeGraphLoading
                  ? 'Analyzing AST index...'
                  : codeGraphIndex
                  ? `Indexed ${codeGraphIndex.indexed_files || 0} files · ${codeGraphIndex.central_modules?.length || 0} modules · ${codeGraphIndex.total_symbols || 0} symbols`
                  : 'AST index ready'}
              </span>
            </div>
            <button
              type="button"
              disabled={syncCodeGraphMutation.isPending}
              onClick={() => {
                syncCodeGraphMutation.mutate();
                refetchMemories();
                refetchDecisions();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              <RotateCw className={`h-3.5 w-3.5 text-primary ${syncCodeGraphMutation.isPending ? 'animate-spin' : ''}`} />
              {syncCodeGraphMutation.isPending ? 'Indexing Codebase...' : 'Re-index Codebase'}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('add')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Ingest Memory
            </button>
          </div>
        </div>

        {/* Top Instant Semantic Search Bar + Primary 2-Tab Switcher */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pt-2 border-t border-border/60">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={globalQuery}
              onChange={(e) => {
                setGlobalQuery(e.target.value);
                if (e.target.value.trim() && activeTab !== 'global_search') {
                  setActiveTab('global_search');
                }
              }}
              placeholder="Ask about architecture, modules, symbols, or past ADRs..."
              className="w-full rounded-lg border border-border bg-background pl-10 pr-4 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
          </div>

          <div className="inline-flex items-center rounded-lg border border-border bg-muted/40 p-1 gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('code_graph')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === 'code_graph' || activeTab === 'knowledge_graph' || activeTab === 'graphify'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Code2 className="h-3.5 w-3.5 text-primary" />
              Codebase Topology
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('domains')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === 'domains' || activeTab === 'decision_explorer' || activeTab === 'global_search' || activeTab === 'assembly' || activeTab === 'memgpt' || activeTab === 'add'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Scale className="h-3.5 w-3.5 text-primary" />
              Engineering Memory & ADRs
            </button>
          </div>
        </div>
      </div>

      {/* Main Sub-Navigation Tabs */}
      <div className="flex border-b border-border gap-5 overflow-x-auto scrollbar-hide">
        <button
          onClick={() => setActiveTab('domains')}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'domains' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Layers className="h-4 w-4" />
          Memory Domains ({PRIMARY_MEMORY_DOMAINS.length})
        </button>

        <button
          onClick={() => setActiveTab('global_search')}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'global_search' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Search className="h-4 w-4" />
          Global Organizational Search
        </button>

        <button
          onClick={() => setActiveTab('decision_explorer')}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'decision_explorer' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Scale className="h-4 w-4" />
          Decision Explorer ({decisions.length})
        </button>

        <button
          onClick={() => setActiveTab('assembly')}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'assembly' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Sparkles className="h-4 w-4" />
          Context Assembly Engine
        </button>

        <button
          onClick={() => setActiveTab('knowledge_graph')}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'knowledge_graph' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <GitBranch className="h-4 w-4" />
          Knowledge Graph & Triples
        </button>

        <button
          onClick={() => setActiveTab('memgpt')}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'memgpt' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Cpu className="h-4 w-4 text-cyan-400" />
          MemGPT Virtual Context
        </button>

        <button
          onClick={() => setActiveTab('graphify')}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'graphify' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Network className="h-4 w-4 text-purple-400" />
          Graphify & Obsidian Vault
        </button>

        <button
          onClick={() => setActiveTab('code_graph')}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'code_graph' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Code2 className="h-4 w-4 text-emerald-400" />
          Codebase AST Pre-Index
        </button>

        <button
          onClick={() => setActiveTab('source_graph')}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'source_graph' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <GitFork className="h-4 w-4 text-cyan-400" />
          Source Graph
        </button>

        <button
          onClick={() => setActiveTab('add')}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'add' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Plus className="h-4 w-4" />
          Ingest Knowledge
        </button>
      </div>

      {/* TAB 1: 8 MEMORY DOMAINS */}
      {activeTab === 'domains' && (
        <div className="space-y-6">
          {/* 8 Primary Domain Quick Select Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {PRIMARY_MEMORY_DOMAINS.map((domain) => {
              const Icon = domain.icon;
              const isSelected = selectedDomain === domain.id;
              const count = memories.filter((m) => m.domain === domain.id).length;
              return (
                <button
                  key={domain.id}
                  onClick={() => setSelectedDomain(isSelected ? 'ALL' : domain.id)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/10 shadow-sm ring-1 ring-primary'
                      : 'border-border bg-card hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Icon className={`h-4 w-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {count}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-foreground truncate">{domain.label}</div>
                  <div className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{domain.desc}</div>
                </button>
              );
            })}
          </div>

          {/* Search Bar & Scope Filters within Domains */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={domainSearchQuery}
                onChange={(e) => setDomainSearchQuery(e.target.value)}
                placeholder={`Search ${selectedDomain === 'ALL' ? 'across all domains' : selectedDomain} (e.g. 'token', 'security', 'SAML', 'architecture')...`}
                className="w-full rounded-xl border border-border bg-card pl-10 pr-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              />
            </div>
            <select
              value={selectedScope}
              onChange={(e) => setSelectedScope(e.target.value)}
              className="rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
            >
              <option value="">All Scope Tiers</option>
              <option value="PUBLIC">PUBLIC</option>
              <option value="INTERNAL">INTERNAL</option>
              <option value="CONFIDENTIAL">CONFIDENTIAL</option>
              <option value="RESTRICTED">RESTRICTED</option>
              <option value="PRIVATE">PRIVATE</option>
            </select>
          </div>

          {/* Memory Items List */}
          {isMemoriesLoading ? (
            <div className="py-20 text-center space-y-2 text-muted-foreground">
              <RotateCw className="h-6 w-6 animate-spin mx-auto text-primary" />
              <p className="text-xs">Accessing organizational memory stores...</p>
            </div>
          ) : memories.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-12 text-center space-y-3">
              <Brain className="h-8 w-8 mx-auto text-muted-foreground/40" />
              <h3 className="text-sm font-semibold text-foreground">No Memory Records Found</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                No items matching current domain, scope, or search parameters.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {memories.map((mem) => {
                const scopeBadge = SCOPE_BADGES[mem.scope] || SCOPE_BADGES.INTERNAL;
                return (
                  <div
                    key={mem.id}
                    className="rounded-xl border border-border bg-card p-5 space-y-3 hover:border-primary/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary">
                            {mem.domain}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${scopeBadge.bg} ${scopeBadge.text} ${scopeBadge.border}`}
                          >
                            {mem.scope}
                          </span>
                        </div>
                        <h3 className="text-sm font-semibold text-foreground">{mem.title}</h3>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-400">
                        {Math.round(mem.confidence * 100)}% Conf
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                      {mem.summary || mem.content}
                    </p>

                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-[11px] text-muted-foreground">
                      <span className="truncate max-w-[220px]">Source: {mem.source}</span>
                      <span>Accessed: {mem.access_count} times</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB: SOURCE GRAPH & CODE INTELLIGENCE */}
      {activeTab === 'source_graph' && (
        <div className="space-y-6 animate-fade-in font-mono">
          {/* Header Action Bar with Sourcegraph Query Search */}
          <div className="p-5 rounded-2xl border border-border bg-card/80 backdrop-blur-md space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <GitFork className="h-5 w-5 text-cyan-400" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                    Source Graph & Monorepo Code Intelligence
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground mt-1 font-sans">
                  Cross-file definition resolution, caller references, git blame gutter, and transitive blast radius impact analysis.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowBlame(!showBlame)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    showBlame
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {showBlame ? '✓ Git Blame Active' : 'Toggle Git Blame'}
                </button>
              </div>
            </div>

            {/* Sourcegraph Query Bar */}
            <div className="space-y-2 pt-1">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Query syntax: lang:python type:class file:compression TokenCompressor"
                  value={sourceGraphQuery}
                  onChange={(e) => setSourceGraphQuery(e.target.value)}
                  className="w-full pl-10 pr-24 py-2.5 rounded-xl border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-cyan-500 font-mono transition-all"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-mono">
                  {isSourceSearching ? 'Searching...' : `${sourceSearchResults?.total_matches || 0} matches`}
                </div>
              </div>

              {/* Quick Filter Chips */}
              <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                <span className="text-muted-foreground font-semibold">Filter Chips:</span>
                {[
                  { label: 'lang:python', query: 'lang:python ' },
                  { label: 'lang:typescript', query: 'lang:typescript ' },
                  { label: 'type:class', query: 'type:class ' },
                  { label: 'type:endpoint', query: 'type:endpoint ' },
                  { label: 'file:apps/api', query: 'file:apps/api ' },
                  { label: 'file:apps/web', query: 'file:apps/web ' },
                ].map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => setSourceGraphQuery((prev) => (prev.includes(chip.label) ? prev : `${chip.query}${prev}`))}
                    className="px-2 py-0.5 rounded bg-muted/60 text-muted-foreground hover:text-foreground border border-border/40 transition-all font-mono"
                  >
                    +{chip.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 3-Column Source Graph Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Column 1: Monorepo Files & Search Matches (3 cols) */}
            <div className="lg:col-span-3 space-y-4">
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <span>Monorepo Files</span>
                  <span className="text-[10px] text-cyan-400 font-mono">Indexed</span>
                </div>

                <div className="space-y-1 max-h-[500px] overflow-y-auto pr-1">
                  {[
                    'apps/api/nexora/core/compression.py',
                    'apps/api/nexora/domains/memory/source_graph.py',
                    'apps/api/nexora/domains/memory/code_graph.py',
                    'apps/api/nexora/domains/memory/router.py',
                    'apps/api/nexora/domains/agents/execution.py',
                    'apps/web/src/lib/api/sourceGraph.ts',
                    'apps/web/src/app/dashboard/memory/page.tsx',
                    'apps/tui-rs/src/features/engineering/ui.rs',
                    'apps/tui-rs/src/client.rs',
                  ].map((fp) => (
                    <div
                      key={fp}
                      onClick={() => setSelectedSourceFile(fp)}
                      className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                        selectedSourceFile === fp
                          ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300 font-bold'
                          : 'border-border/60 bg-background/60 text-muted-foreground hover:bg-secondary/40 hover:text-foreground'
                      }`}
                    >
                      <div className="truncate font-mono">{fp.split('/').pop()}</div>
                      <div className="text-[10px] text-muted-foreground truncate mt-0.5">{fp}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Matched Search Results */}
              {sourceSearchResults && sourceSearchResults.results.length > 0 && (
                <div className="p-4 rounded-xl border border-border bg-card space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                    <span>Query Hits ({sourceSearchResults.total_matches})</span>
                    <span className="text-[10px] text-emerald-400 font-mono">{sourceSearchResults.duration_ms}ms</span>
                  </div>
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {sourceSearchResults.results.slice(0, 8).map((sr, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          setSelectedSourceFile(sr.file_path);
                          if (sr.symbol_name) setSelectedSourceSymbol(sr.symbol_name);
                        }}
                        className="p-2 rounded-lg border border-border/50 bg-background/50 hover:bg-secondary/40 cursor-pointer text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground truncate">{sr.symbol_name || sr.file_path.split('/').pop()}</span>
                          {sr.symbol_kind && (
                            <span className="text-[8px] uppercase px-1 rounded bg-muted text-cyan-400 font-mono">{sr.symbol_kind}</span>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">{sr.file_path}:{sr.line_number}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Column 2: Source Code Viewer with Blame Gutter (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-border text-xs">
                  <div className="truncate font-mono text-foreground font-bold">
                    📄 {selectedSourceFile}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono shrink-0">
                    <span>{sourceFileData?.language || 'code'}</span>
                    <span>•</span>
                    <span>{sourceFileData?.total_lines || 0} lines</span>
                    <span>•</span>
                    <span>{((sourceFileData?.size_bytes || 0) / 1024).toFixed(1)} KB</span>
                  </div>
                </div>

                {/* Code Window with Blame Gutter */}
                {isSourceFileLoading ? (
                  <div className="py-24 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                    <RotateCw className="h-4 w-4 animate-spin text-cyan-400" />
                    Reading source file and git blame...
                  </div>
                ) : sourceFileData ? (
                  <div className="rounded-lg border border-border bg-black/80 font-mono text-xs overflow-x-auto max-h-[600px] overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                      <tbody>
                        {sourceFileData.content.split('\n').map((line, idx) => {
                          const lineNo = idx + 1;
                          const blameItem = sourceFileData.blame.find((b) => b.line_number === lineNo);
                          const lineSymbols = sourceFileData.symbols.filter((s) => s.line_number === lineNo);

                          return (
                            <tr key={lineNo} className="hover:bg-muted/20 transition-colors group">
                              {/* Line Number */}
                              <td className="w-10 select-none px-2 py-0.5 text-right text-[10px] text-muted-foreground/60 border-r border-border/40 font-mono">
                                {lineNo}
                              </td>

                              {/* Git Blame Gutter */}
                              {showBlame && (
                                <td className="w-40 select-none px-2 py-0.5 text-[9px] text-muted-foreground border-r border-border/40 font-mono whitespace-nowrap overflow-hidden text-ellipsis max-w-[130px]">
                                  {blameItem ? (
                                    <span title={`${blameItem.commit_sha} - ${blameItem.author}: ${blameItem.summary}`}>
                                      <span className="text-cyan-400 font-bold">{blameItem.commit_sha.slice(0, 6)}</span>{' '}
                                      <span className="text-zinc-400">{blameItem.author.split(' ')[0]}</span>{' '}
                                      <span className="text-zinc-500">{blameItem.date}</span>
                                    </span>
                                  ) : (
                                    <span className="text-zinc-600">uncommitted</span>
                                  )}
                                </td>
                              )}

                              {/* Source Code Line Content */}
                              <td className="px-3 py-0.5 text-foreground whitespace-pre text-[11px]">
                                <span>{line}</span>
                                {lineSymbols.map((sym) => (
                                  <button
                                    key={sym.id}
                                    type="button"
                                    onClick={() => setSelectedSourceSymbol(sym.name)}
                                    className="ml-2 inline-flex items-center px-1.5 py-0.2 rounded text-[8px] uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30 transition-all font-mono"
                                  >
                                    ◈ {sym.name} ({sym.kind})
                                  </button>
                                ))}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-24 text-center text-xs text-muted-foreground">
                    Select a source file to view code and AST symbols.
                  </div>
                )}
              </div>
            </div>

            {/* Column 3: Code Intelligence & Blast Radius Inspector (4 cols) */}
            <div className="lg:col-span-4 space-y-4">
              {/* Definition Card */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Target className="h-4 w-4 text-cyan-400" />
                    Symbol Definition
                  </span>
                  {symbolDefinition && (
                    <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-muted text-cyan-400 font-mono font-bold">
                      {symbolDefinition.symbol_kind}
                    </span>
                  )}
                </div>

                {isDefinitionLoading ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    Resolving symbol declaration...
                  </div>
                ) : symbolDefinition ? (
                  <div className="space-y-2 text-xs">
                    <div className="text-sm font-bold text-foreground truncate font-mono">
                      {symbolDefinition.symbol_name}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono">
                      📍 {symbolDefinition.file_path}:{symbolDefinition.line_number}
                    </div>

                    {symbolDefinition.signature && (
                      <div className="p-2 rounded bg-background border border-border text-[10px] font-mono text-emerald-300 truncate">
                        {symbolDefinition.signature}
                      </div>
                    )}

                    {symbolDefinition.surrounding_code && (
                      <div className="space-y-1">
                        <span className="text-[9px] uppercase font-bold text-muted-foreground">Declaration Snippet:</span>
                        <pre className="p-2.5 rounded bg-black/60 border border-border/40 text-[10px] text-zinc-300 font-mono overflow-x-auto max-h-36 whitespace-pre-wrap">
                          {symbolDefinition.surrounding_code}
                        </pre>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    Select a symbol to inspect its definition and callers.
                  </div>
                )}
              </div>

              {/* References & Call Sites */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <span>References ({symbolReferences?.total_references || 0})</span>
                  <span className="text-[10px] text-emerald-400 font-mono">Cross-File</span>
                </div>

                {isReferencesLoading ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    Tracing caller sites across monorepo...
                  </div>
                ) : symbolReferences && symbolReferences.references.length > 0 ? (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {symbolReferences.references.map((ref, idx) => (
                      <div
                        key={idx}
                        onClick={() => setSelectedSourceFile(ref.file_path)}
                        className="p-2 rounded-lg border border-border/50 bg-background/50 hover:bg-secondary/40 cursor-pointer text-xs space-y-0.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground text-[11px] truncate font-mono">
                            {ref.caller_symbol}
                          </span>
                          <span className="text-[8px] uppercase px-1 rounded bg-muted text-cyan-300 font-mono">
                            {ref.relation}
                          </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono truncate">
                          {ref.file_path}:{ref.line_number}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    No references found for selected symbol.
                  </div>
                )}
              </div>

              {/* Blast Radius & Transitive Impact Analysis */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <ShieldAlert className="h-4 w-4 text-amber-400" />
                    Blast Radius & Impact Radar
                  </span>
                  {blastRadiusData && (
                    <span
                      className={`text-[9px] uppercase px-2 py-0.5 rounded-full font-mono font-bold ${
                        blastRadiusData.risk_level === 'CRITICAL'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : blastRadiusData.risk_level === 'HIGH'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : blastRadiusData.risk_level === 'MEDIUM'
                          ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {blastRadiusData.risk_level} ({blastRadiusData.risk_score})
                    </span>
                  )}
                </div>

                {isBlastRadiusLoading ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    Computing transitive dependency impact...
                  </div>
                ) : blastRadiusData ? (
                  <div className="space-y-3 text-xs">
                    {/* Impact Metrics Grid */}
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="p-2 rounded bg-background/60 border border-border/50">
                        <span className="text-muted-foreground block">Impacted Files:</span>
                        <span className="text-foreground font-bold font-mono">{blastRadiusData.total_impacted_files} files</span>
                      </div>
                      <div className="p-2 rounded bg-background/60 border border-border/50">
                        <span className="text-muted-foreground block">Downstream Dependents:</span>
                        <span className="text-cyan-400 font-bold font-mono">
                          {blastRadiusData.direct_dependents.length + blastRadiusData.transitive_dependents.length}
                        </span>
                      </div>
                    </div>

                    {/* Impacted Endpoints */}
                    {blastRadiusData.impacted_endpoints.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[9px] uppercase font-bold text-amber-400">
                          Impacted Endpoints ({blastRadiusData.impacted_endpoints.length}):
                        </span>
                        <div className="space-y-1 max-h-24 overflow-y-auto">
                          {blastRadiusData.impacted_endpoints.map((ep, i) => (
                            <div key={i} className="p-1 rounded bg-amber-500/10 border border-amber-500/20 text-[10px] font-mono text-amber-300 truncate">
                              ⚡ {ep.signature || ep.name}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Impacted Unit Tests */}
                    {blastRadiusData.impacted_tests.length > 0 && (
                      <div className="space-y-1 pt-1 border-t border-border/40">
                        <span className="text-[9px] uppercase font-bold text-emerald-400">
                          Impacted Test Suites ({blastRadiusData.impacted_tests.length}):
                        </span>
                        <div className="space-y-1 max-h-24 overflow-y-auto">
                          {blastRadiusData.impacted_tests.map((testPath, i) => (
                            <div key={i} className="text-[10px] font-mono text-muted-foreground truncate">
                              🧪 {testPath.split('/').pop()}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    Select a target to compute change blast radius.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: GLOBAL ORGANIZATIONAL SEARCH ACROSS 8 ENTITY TYPES WITH PROVENANCE */}
      {activeTab === 'global_search' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Search className="h-5 w-5 text-primary" />
                Global Organizational Search
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Search across all institutional assets: projects, agents, decisions, documents, tasks, workflows, policies, and knowledge. Every result explicitly tracks provenance.
              </p>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-4 top-3.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={globalQuery}
                onChange={(e) => setGlobalQuery(e.target.value)}
                placeholder="Search across entire company (e.g. 'failover', 'Sonnet', 'GDPR', 'Alpha', 'routing')..."
                className="w-full rounded-xl border border-border bg-background pl-11 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary shadow-inner"
              />
            </div>

            {/* 8-Entity Filter Ribbon */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide text-xs">
              {(
                [
                  { id: 'ALL', label: 'All Entities' },
                  { id: 'projects', label: 'Projects' },
                  { id: 'agents', label: 'Agents' },
                  { id: 'decisions', label: 'Decisions' },
                  { id: 'documents', label: 'Documents' },
                  { id: 'tasks', label: 'Tasks' },
                  { id: 'workflows', label: 'Workflows' },
                  { id: 'policies', label: 'Policies' },
                  { id: 'knowledge', label: 'Knowledge' },
                ] as { id: SearchEntityType; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedSearchEntity(tab.id)}
                  className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors border ${
                    selectedSearchEntity === tab.id
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Results Count & Provenance List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span>{globalSearchResults.length} matching institutional items discovered</span>
              <span className="flex items-center gap-1 font-mono text-[11px] text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" /> Full Provenance Verified
              </span>
            </div>

            {globalSearchResults.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-12 text-center space-y-3">
                <Search className="h-8 w-8 mx-auto text-muted-foreground/40" />
                <h3 className="text-sm font-semibold text-foreground">No Entities Found</h3>
                <p className="text-xs text-muted-foreground">Try adjusting your search keywords or entity filters.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {globalSearchResults.map((result) => (
                  <div
                    key={result.id}
                    className="rounded-xl border border-border bg-card p-5 space-y-3 hover:border-primary/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-primary/10 text-primary border border-primary/20 uppercase">
                            {result.type}
                          </span>
                          <span className="text-[11px] text-muted-foreground font-mono">
                            {result.provenance.domainOrCategory}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-foreground">{result.title}</h3>
                      </div>
                      {result.link && (
                        <a
                          href={result.link}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
                        >
                          View <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
                      {result.excerpt}
                    </p>

                    {/* Explicit Provenance Footer Card */}
                    <div className="p-3 rounded-lg bg-background border border-border/70 text-[11px] grid grid-cols-1 sm:grid-cols-3 gap-2 text-muted-foreground">
                      <div>
                        <span className="font-semibold text-foreground block">Provenance Source</span>
                        <span className="truncate block">{result.provenance.source}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-foreground block">Originating Actor</span>
                        <span className="truncate block">{result.provenance.authorOrOrigin}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-foreground block">Classification / Scope</span>
                        <span className="font-mono text-emerald-400 block truncate">{result.provenance.confidenceOrScope}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: SOURCE GRAPH & CODE INTELLIGENCE */}
      {activeTab === 'source_graph' && (
        <div className="space-y-6 animate-fade-in font-mono">
          {/* Header Action Bar with Sourcegraph Query Search */}
          <div className="p-5 rounded-2xl border border-border bg-card/80 backdrop-blur-md space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <GitFork className="h-5 w-5 text-cyan-400" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                    Source Graph & Monorepo Code Intelligence
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground mt-1 font-sans">
                  Cross-file definition resolution, caller references, git blame gutter, and transitive blast radius impact analysis.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowBlame(!showBlame)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    showBlame
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {showBlame ? '✓ Git Blame Active' : 'Toggle Git Blame'}
                </button>
              </div>
            </div>

            {/* Sourcegraph Query Bar */}
            <div className="space-y-2 pt-1">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Query syntax: lang:python type:class file:compression TokenCompressor"
                  value={sourceGraphQuery}
                  onChange={(e) => setSourceGraphQuery(e.target.value)}
                  className="w-full pl-10 pr-24 py-2.5 rounded-xl border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-cyan-500 font-mono transition-all"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-mono">
                  {isSourceSearching ? 'Searching...' : `${sourceSearchResults?.total_matches || 0} matches`}
                </div>
              </div>

              {/* Quick Filter Chips */}
              <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                <span className="text-muted-foreground font-semibold">Filter Chips:</span>
                {[
                  { label: 'lang:python', query: 'lang:python ' },
                  { label: 'lang:typescript', query: 'lang:typescript ' },
                  { label: 'type:class', query: 'type:class ' },
                  { label: 'type:endpoint', query: 'type:endpoint ' },
                  { label: 'file:apps/api', query: 'file:apps/api ' },
                  { label: 'file:apps/web', query: 'file:apps/web ' },
                ].map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => setSourceGraphQuery((prev) => (prev.includes(chip.label) ? prev : `${chip.query}${prev}`))}
                    className="px-2 py-0.5 rounded bg-muted/60 text-muted-foreground hover:text-foreground border border-border/40 transition-all font-mono"
                  >
                    +{chip.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 3-Column Source Graph Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Column 1: Monorepo Files & Search Matches (3 cols) */}
            <div className="lg:col-span-3 space-y-4">
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <span>Monorepo Files</span>
                  <span className="text-[10px] text-cyan-400 font-mono">Indexed</span>
                </div>

                <div className="space-y-1 max-h-[500px] overflow-y-auto pr-1">
                  {[
                    'apps/api/nexora/core/compression.py',
                    'apps/api/nexora/domains/memory/source_graph.py',
                    'apps/api/nexora/domains/memory/code_graph.py',
                    'apps/api/nexora/domains/memory/router.py',
                    'apps/api/nexora/domains/agents/execution.py',
                    'apps/web/src/lib/api/sourceGraph.ts',
                    'apps/web/src/app/dashboard/memory/page.tsx',
                    'apps/tui-rs/src/features/engineering/ui.rs',
                    'apps/tui-rs/src/client.rs',
                  ].map((fp) => (
                    <div
                      key={fp}
                      onClick={() => setSelectedSourceFile(fp)}
                      className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                        selectedSourceFile === fp
                          ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300 font-bold'
                          : 'border-border/60 bg-background/60 text-muted-foreground hover:bg-secondary/40 hover:text-foreground'
                      }`}
                    >
                      <div className="truncate font-mono">{fp.split('/').pop()}</div>
                      <div className="text-[10px] text-muted-foreground truncate mt-0.5">{fp}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Matched Search Results */}
              {sourceSearchResults && sourceSearchResults.results.length > 0 && (
                <div className="p-4 rounded-xl border border-border bg-card space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                    <span>Query Hits ({sourceSearchResults.total_matches})</span>
                    <span className="text-[10px] text-emerald-400 font-mono">{sourceSearchResults.duration_ms}ms</span>
                  </div>
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {sourceSearchResults.results.slice(0, 8).map((sr, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          setSelectedSourceFile(sr.file_path);
                          if (sr.symbol_name) setSelectedSourceSymbol(sr.symbol_name);
                        }}
                        className="p-2 rounded-lg border border-border/50 bg-background/50 hover:bg-secondary/40 cursor-pointer text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground truncate">{sr.symbol_name || sr.file_path.split('/').pop()}</span>
                          {sr.symbol_kind && (
                            <span className="text-[8px] uppercase px-1 rounded bg-muted text-cyan-400 font-mono">{sr.symbol_kind}</span>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">{sr.file_path}:{sr.line_number}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Column 2: Source Code Viewer with Blame Gutter (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-border text-xs">
                  <div className="truncate font-mono text-foreground font-bold">
                    📄 {selectedSourceFile}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono shrink-0">
                    <span>{sourceFileData?.language || 'code'}</span>
                    <span>•</span>
                    <span>{sourceFileData?.total_lines || 0} lines</span>
                    <span>•</span>
                    <span>{((sourceFileData?.size_bytes || 0) / 1024).toFixed(1)} KB</span>
                  </div>
                </div>

                {/* Code Window with Blame Gutter */}
                {isSourceFileLoading ? (
                  <div className="py-24 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                    <RotateCw className="h-4 w-4 animate-spin text-cyan-400" />
                    Reading source file and git blame...
                  </div>
                ) : sourceFileData ? (
                  <div className="rounded-lg border border-border bg-black/80 font-mono text-xs overflow-x-auto max-h-[600px] overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                      <tbody>
                        {sourceFileData.content.split('\n').map((line, idx) => {
                          const lineNo = idx + 1;
                          const blameItem = sourceFileData.blame.find((b) => b.line_number === lineNo);
                          const lineSymbols = sourceFileData.symbols.filter((s) => s.line_number === lineNo);

                          return (
                            <tr key={lineNo} className="hover:bg-muted/20 transition-colors group">
                              {/* Line Number */}
                              <td className="w-10 select-none px-2 py-0.5 text-right text-[10px] text-muted-foreground/60 border-r border-border/40 font-mono">
                                {lineNo}
                              </td>

                              {/* Git Blame Gutter */}
                              {showBlame && (
                                <td className="w-40 select-none px-2 py-0.5 text-[9px] text-muted-foreground border-r border-border/40 font-mono whitespace-nowrap overflow-hidden text-ellipsis max-w-[130px]">
                                  {blameItem ? (
                                    <span title={`${blameItem.commit_sha} - ${blameItem.author}: ${blameItem.summary}`}>
                                      <span className="text-cyan-400 font-bold">{blameItem.commit_sha.slice(0, 6)}</span>{' '}
                                      <span className="text-zinc-400">{blameItem.author.split(' ')[0]}</span>{' '}
                                      <span className="text-zinc-500">{blameItem.date}</span>
                                    </span>
                                  ) : (
                                    <span className="text-zinc-600">uncommitted</span>
                                  )}
                                </td>
                              )}

                              {/* Source Code Line Content */}
                              <td className="px-3 py-0.5 text-foreground whitespace-pre text-[11px]">
                                <span>{line}</span>
                                {lineSymbols.map((sym) => (
                                  <button
                                    key={sym.id}
                                    type="button"
                                    onClick={() => setSelectedSourceSymbol(sym.name)}
                                    className="ml-2 inline-flex items-center px-1.5 py-0.2 rounded text-[8px] uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30 transition-all font-mono"
                                  >
                                    ◈ {sym.name} ({sym.kind})
                                  </button>
                                ))}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-24 text-center text-xs text-muted-foreground">
                    Select a source file to view code and AST symbols.
                  </div>
                )}
              </div>
            </div>

            {/* Column 3: Code Intelligence & Blast Radius Inspector (4 cols) */}
            <div className="lg:col-span-4 space-y-4">
              {/* Definition Card */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Target className="h-4 w-4 text-cyan-400" />
                    Symbol Definition
                  </span>
                  {symbolDefinition && (
                    <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-muted text-cyan-400 font-mono font-bold">
                      {symbolDefinition.symbol_kind}
                    </span>
                  )}
                </div>

                {isDefinitionLoading ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    Resolving symbol declaration...
                  </div>
                ) : symbolDefinition ? (
                  <div className="space-y-2 text-xs">
                    <div className="text-sm font-bold text-foreground truncate font-mono">
                      {symbolDefinition.symbol_name}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono">
                      📍 {symbolDefinition.file_path}:{symbolDefinition.line_number}
                    </div>

                    {symbolDefinition.signature && (
                      <div className="p-2 rounded bg-background border border-border text-[10px] font-mono text-emerald-300 truncate">
                        {symbolDefinition.signature}
                      </div>
                    )}

                    {symbolDefinition.surrounding_code && (
                      <div className="space-y-1">
                        <span className="text-[9px] uppercase font-bold text-muted-foreground">Declaration Snippet:</span>
                        <pre className="p-2.5 rounded bg-black/60 border border-border/40 text-[10px] text-zinc-300 font-mono overflow-x-auto max-h-36 whitespace-pre-wrap">
                          {symbolDefinition.surrounding_code}
                        </pre>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    Select a symbol to inspect its definition and callers.
                  </div>
                )}
              </div>

              {/* References & Call Sites */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <span>References ({symbolReferences?.total_references || 0})</span>
                  <span className="text-[10px] text-emerald-400 font-mono">Cross-File</span>
                </div>

                {isReferencesLoading ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    Tracing caller sites across monorepo...
                  </div>
                ) : symbolReferences && symbolReferences.references.length > 0 ? (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {symbolReferences.references.map((ref, idx) => (
                      <div
                        key={idx}
                        onClick={() => setSelectedSourceFile(ref.file_path)}
                        className="p-2 rounded-lg border border-border/50 bg-background/50 hover:bg-secondary/40 cursor-pointer text-xs space-y-0.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground text-[11px] truncate font-mono">
                            {ref.caller_symbol}
                          </span>
                          <span className="text-[8px] uppercase px-1 rounded bg-muted text-cyan-300 font-mono">
                            {ref.relation}
                          </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono truncate">
                          {ref.file_path}:{ref.line_number}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    No references found for selected symbol.
                  </div>
                )}
              </div>

              {/* Blast Radius & Transitive Impact Analysis */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <ShieldAlert className="h-4 w-4 text-amber-400" />
                    Blast Radius & Impact Radar
                  </span>
                  {blastRadiusData && (
                    <span
                      className={`text-[9px] uppercase px-2 py-0.5 rounded-full font-mono font-bold ${
                        blastRadiusData.risk_level === 'CRITICAL'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : blastRadiusData.risk_level === 'HIGH'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : blastRadiusData.risk_level === 'MEDIUM'
                          ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {blastRadiusData.risk_level} ({blastRadiusData.risk_score})
                    </span>
                  )}
                </div>

                {isBlastRadiusLoading ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    Computing transitive dependency impact...
                  </div>
                ) : blastRadiusData ? (
                  <div className="space-y-3 text-xs">
                    {/* Impact Metrics Grid */}
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="p-2 rounded bg-background/60 border border-border/50">
                        <span className="text-muted-foreground block">Impacted Files:</span>
                        <span className="text-foreground font-bold font-mono">{blastRadiusData.total_impacted_files} files</span>
                      </div>
                      <div className="p-2 rounded bg-background/60 border border-border/50">
                        <span className="text-muted-foreground block">Downstream Dependents:</span>
                        <span className="text-cyan-400 font-bold font-mono">
                          {blastRadiusData.direct_dependents.length + blastRadiusData.transitive_dependents.length}
                        </span>
                      </div>
                    </div>

                    {/* Impacted Endpoints */}
                    {blastRadiusData.impacted_endpoints.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[9px] uppercase font-bold text-amber-400">
                          Impacted Endpoints ({blastRadiusData.impacted_endpoints.length}):
                        </span>
                        <div className="space-y-1 max-h-24 overflow-y-auto">
                          {blastRadiusData.impacted_endpoints.map((ep, i) => (
                            <div key={i} className="p-1 rounded bg-amber-500/10 border border-amber-500/20 text-[10px] font-mono text-amber-300 truncate">
                              ⚡ {ep.signature || ep.name}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Impacted Unit Tests */}
                    {blastRadiusData.impacted_tests.length > 0 && (
                      <div className="space-y-1 pt-1 border-t border-border/40">
                        <span className="text-[9px] uppercase font-bold text-emerald-400">
                          Impacted Test Suites ({blastRadiusData.impacted_tests.length}):
                        </span>
                        <div className="space-y-1 max-h-24 overflow-y-auto">
                          {blastRadiusData.impacted_tests.map((testPath, i) => (
                            <div key={i} className="text-[10px] font-mono text-muted-foreground truncate">
                              🧪 {testPath.split('/').pop()}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    Select a target to compute change blast radius.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: DECISION EXPLORER (Problem -> Evidence -> Proposals -> Discussion -> Decision -> Expected Outcome -> Actual Outcome -> Lesson) */}
      {activeTab === 'decision_explorer' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6 space-y-2">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" />
              Organizational Decision Explorer
            </h2>
            <p className="text-xs text-muted-foreground">
              Trace the complete rationale of why the organization made an important decision through all 8 stages:
              <span className="font-semibold text-foreground"> Problem → Evidence → Proposals → Discussion → Decision → Expected Outcome → Actual Outcome → Lesson</span>.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Decision Selector List */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-3 lg:col-span-1">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Deliberation Records ({decisions.length})
              </h3>
              <div className="space-y-2 max-h-[700px] overflow-y-auto">
                {decisions.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setSelectedDecisionId(d.id)}
                    className={`w-full p-3 rounded-lg border text-left transition-colors ${
                      activeDecision?.id === d.id
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-background hover:border-primary/40'
                    }`}
                  >
                    <div className="text-xs font-bold text-foreground line-clamp-1">{d.title}</div>
                    <div className="text-[11px] text-muted-foreground line-clamp-2 mt-1">{d.problem}</div>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50 text-[10px] text-muted-foreground">
                      <span className="font-mono">{new Date(d.decided_at).toLocaleDateString()}</span>
                      <span className="text-primary font-semibold">Inspect Trail →</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Right: The 8-Stage Decision Lineage Visualizer */}
            <div className="lg:col-span-2 space-y-6">
              {activeDecision ? (
                <div className="space-y-6">
                  {/* Decision Header */}
                  <div className="rounded-xl border border-primary/30 bg-card p-5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-primary/10 text-primary border border-primary/20">
                        DECISION RECORD ADR
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">
                        Decided {new Date(activeDecision.decided_at).toLocaleString()}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-foreground">{activeDecision.title}</h2>
                  </div>

                  {/* 8-Stage Flow Container */}
                  <div className="space-y-4">
                    {/* Stage 1: Problem */}
                    <div className="rounded-xl border border-border bg-card p-4 space-y-1">
                      <div className="flex items-center gap-2 text-xs font-bold text-rose-400 uppercase tracking-wider">
                        <span className="h-5 w-5 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-[10px]">
                          1
                        </span>
                        Problem Statement
                      </div>
                      <p className="text-xs text-foreground leading-relaxed pl-7">{activeDecision.problem}</p>
                    </div>

                    {/* Stage 2: Evidence */}
                    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-blue-400 uppercase tracking-wider">
                        <span className="h-5 w-5 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-[10px]">
                          2
                        </span>
                        Verified Evidence & Telemetry
                      </div>
                      <div className="pl-7 space-y-2">
                        {activeDecision.evidence && activeDecision.evidence.length > 0 ? (
                          activeDecision.evidence.map((ev, idx) => (
                            <div key={idx} className="p-2.5 rounded-lg bg-background border border-border text-xs space-y-1">
                              <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                                <span className="font-semibold text-foreground">{ev.source}</span>
                                {ev.verified && (
                                  <span className="text-emerald-400 font-mono text-[10px] flex items-center gap-1">
                                    <Check className="h-3 w-3" /> Verified
                                  </span>
                                )}
                              </div>
                              <p className="text-muted-foreground">{ev.claim}</p>
                            </div>
                          ))
                        ) : (
                          <div className="p-2.5 rounded-lg bg-background border border-border text-xs text-muted-foreground">
                            Incident report INC-204 & Q2 multi-provider reliability benchmarks.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Stage 3: Proposals / Options */}
                    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-purple-400 uppercase tracking-wider">
                        <span className="h-5 w-5 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-[10px]">
                          3
                        </span>
                        Alternative Proposals Evaluated
                      </div>
                      <div className="pl-7 grid grid-cols-1 md:grid-cols-2 gap-3">
                        {activeDecision.options && activeDecision.options.length > 0 ? (
                          activeDecision.options.map((opt, idx) => (
                            <div key={idx} className="p-3 rounded-lg bg-background border border-border text-xs space-y-1.5">
                              <div className="font-semibold text-foreground">{opt.title}</div>
                              <p className="text-muted-foreground text-[11px]">{opt.description}</p>
                              {opt.pros && opt.pros.length > 0 && (
                                <div className="text-[10px] text-emerald-400">Pros: {opt.pros.join(', ')}</div>
                              )}
                              {opt.cons && opt.cons.length > 0 && (
                                <div className="text-[10px] text-rose-400">Cons: {opt.cons.join(', ')}</div>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="p-3 rounded-lg bg-background border border-border text-xs text-muted-foreground col-span-2">
                            Proposal A (Standardization) vs Proposal B (Capability Decoupling).
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Stage 4: Discussion & Deliberation */}
                    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
                        <span className="h-5 w-5 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-[10px]">
                          4
                        </span>
                        Discussion & Participant Stances
                      </div>
                      <div className="pl-7 space-y-2">
                        {activeDecision.participants && activeDecision.participants.length > 0 ? (
                          activeDecision.participants.map((p, idx) => (
                            <div key={idx} className="p-2.5 rounded-lg bg-background border border-border text-xs flex items-center justify-between">
                              <div>
                                <span className="font-semibold text-foreground">{p.name}</span>
                                <span className="text-muted-foreground text-[11px] ml-2">({p.role} • {p.identity_type || 'AGENT'})</span>
                              </div>
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                {p.stance || 'SUPPORT'}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="p-2.5 rounded-lg bg-background border border-border text-xs text-muted-foreground">
                            Chief Architect (Support) • Site Reliability Agent (Support) • Security Officer (Approved).
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Stage 5: Decision & Rationale */}
                    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider">
                        <span className="h-5 w-5 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-[10px]">
                          5
                        </span>
                        Adopted Decision & Rationale
                      </div>
                      <div className="pl-7 space-y-1.5 text-xs">
                        <div className="font-bold text-foreground text-sm">{activeDecision.decision}</div>
                        <p className="text-muted-foreground leading-relaxed">{activeDecision.rationale}</p>
                      </div>
                    </div>

                    {/* Stage 6: Expected Outcome */}
                    <div className="rounded-xl border border-border bg-card p-4 space-y-1">
                      <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-wider">
                        <span className="h-5 w-5 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-[10px]">
                          6
                        </span>
                        Expected Outcome
                      </div>
                      <p className="text-xs text-foreground leading-relaxed pl-7">{activeDecision.expected_outcome}</p>
                    </div>

                    {/* Stage 7: Actual Outcome */}
                    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
                        <span className="h-5 w-5 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-[10px]">
                          7
                        </span>
                        Actual Measured Outcome
                      </div>
                      <div className="pl-7 space-y-2">
                        {activeDecision.actual_outcome ? (
                          <div className="p-3 rounded-lg bg-background border border-border text-xs text-foreground font-mono">
                            {activeDecision.actual_outcome}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">
                            No post-implementation outcome recorded yet. Record actual outcome below.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Stage 8: Lesson Learned */}
                    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
                        <span className="h-5 w-5 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-[10px]">
                          8
                        </span>
                        Institutional Lessons for Future Generations
                      </div>
                      <div className="pl-7 space-y-2">
                        {activeDecision.lessons_learned && activeDecision.lessons_learned.length > 0 ? (
                          <ul className="list-disc list-inside text-xs text-muted-foreground space-y-1.5 p-3 rounded-lg bg-background border border-border">
                            {activeDecision.lessons_learned.map((l, idx) => (
                              <li key={idx} className="leading-relaxed">
                                <span className="text-foreground">{l}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">
                            No retrospective lessons catalogued yet.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Outcome & Lessons Submission Form */}
                  <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                    <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Flame className="h-4 w-4 text-amber-400" />
                      Record Retrospective Outcome & Lessons Learned
                    </h3>
                    <form onSubmit={handleRecordOutcome} className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-foreground block mb-1">
                          Actual Observed Outcome
                        </label>
                        <textarea
                          rows={2}
                          value={newActualOutcome}
                          onChange={(e) => setNewActualOutcome(e.target.value)}
                          placeholder="e.g. Zero downtime achieved over 90 days with 32% cost savings."
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-foreground block mb-1">
                          Lessons Learned (One per line)
                        </label>
                        <textarea
                          rows={2}
                          value={newLessonInput}
                          onChange={(e) => setNewLessonInput(e.target.value)}
                          placeholder="Dynamic fallback prevents cascading agent workflow failures.&#10;Capability matching simplifies prompt construction."
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={recordOutcomeMutation.isPending}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                      >
                        <Check className="h-3.5 w-3.5" /> Save Outcome & Catalyze Memory
                      </button>
                    </form>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground text-xs">
                  Select a decision record to explore its 8-stage deliberative lineage.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB: SOURCE GRAPH & CODE INTELLIGENCE */}
      {activeTab === 'source_graph' && (
        <div className="space-y-6 animate-fade-in font-mono">
          {/* Header Action Bar with Sourcegraph Query Search */}
          <div className="p-5 rounded-2xl border border-border bg-card/80 backdrop-blur-md space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <GitFork className="h-5 w-5 text-cyan-400" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                    Source Graph & Monorepo Code Intelligence
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground mt-1 font-sans">
                  Cross-file definition resolution, caller references, git blame gutter, and transitive blast radius impact analysis.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowBlame(!showBlame)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    showBlame
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {showBlame ? '✓ Git Blame Active' : 'Toggle Git Blame'}
                </button>
              </div>
            </div>

            {/* Sourcegraph Query Bar */}
            <div className="space-y-2 pt-1">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Query syntax: lang:python type:class file:compression TokenCompressor"
                  value={sourceGraphQuery}
                  onChange={(e) => setSourceGraphQuery(e.target.value)}
                  className="w-full pl-10 pr-24 py-2.5 rounded-xl border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-cyan-500 font-mono transition-all"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-mono">
                  {isSourceSearching ? 'Searching...' : `${sourceSearchResults?.total_matches || 0} matches`}
                </div>
              </div>

              {/* Quick Filter Chips */}
              <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                <span className="text-muted-foreground font-semibold">Filter Chips:</span>
                {[
                  { label: 'lang:python', query: 'lang:python ' },
                  { label: 'lang:typescript', query: 'lang:typescript ' },
                  { label: 'type:class', query: 'type:class ' },
                  { label: 'type:endpoint', query: 'type:endpoint ' },
                  { label: 'file:apps/api', query: 'file:apps/api ' },
                  { label: 'file:apps/web', query: 'file:apps/web ' },
                ].map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => setSourceGraphQuery((prev) => (prev.includes(chip.label) ? prev : `${chip.query}${prev}`))}
                    className="px-2 py-0.5 rounded bg-muted/60 text-muted-foreground hover:text-foreground border border-border/40 transition-all font-mono"
                  >
                    +{chip.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 3-Column Source Graph Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Column 1: Monorepo Files & Search Matches (3 cols) */}
            <div className="lg:col-span-3 space-y-4">
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <span>Monorepo Files</span>
                  <span className="text-[10px] text-cyan-400 font-mono">Indexed</span>
                </div>

                <div className="space-y-1 max-h-[500px] overflow-y-auto pr-1">
                  {[
                    'apps/api/nexora/core/compression.py',
                    'apps/api/nexora/domains/memory/source_graph.py',
                    'apps/api/nexora/domains/memory/code_graph.py',
                    'apps/api/nexora/domains/memory/router.py',
                    'apps/api/nexora/domains/agents/execution.py',
                    'apps/web/src/lib/api/sourceGraph.ts',
                    'apps/web/src/app/dashboard/memory/page.tsx',
                    'apps/tui-rs/src/features/engineering/ui.rs',
                    'apps/tui-rs/src/client.rs',
                  ].map((fp) => (
                    <div
                      key={fp}
                      onClick={() => setSelectedSourceFile(fp)}
                      className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                        selectedSourceFile === fp
                          ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300 font-bold'
                          : 'border-border/60 bg-background/60 text-muted-foreground hover:bg-secondary/40 hover:text-foreground'
                      }`}
                    >
                      <div className="truncate font-mono">{fp.split('/').pop()}</div>
                      <div className="text-[10px] text-muted-foreground truncate mt-0.5">{fp}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Matched Search Results */}
              {sourceSearchResults && sourceSearchResults.results.length > 0 && (
                <div className="p-4 rounded-xl border border-border bg-card space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                    <span>Query Hits ({sourceSearchResults.total_matches})</span>
                    <span className="text-[10px] text-emerald-400 font-mono">{sourceSearchResults.duration_ms}ms</span>
                  </div>
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {sourceSearchResults.results.slice(0, 8).map((sr, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          setSelectedSourceFile(sr.file_path);
                          if (sr.symbol_name) setSelectedSourceSymbol(sr.symbol_name);
                        }}
                        className="p-2 rounded-lg border border-border/50 bg-background/50 hover:bg-secondary/40 cursor-pointer text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground truncate">{sr.symbol_name || sr.file_path.split('/').pop()}</span>
                          {sr.symbol_kind && (
                            <span className="text-[8px] uppercase px-1 rounded bg-muted text-cyan-400 font-mono">{sr.symbol_kind}</span>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">{sr.file_path}:{sr.line_number}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Column 2: Source Code Viewer with Blame Gutter (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-border text-xs">
                  <div className="truncate font-mono text-foreground font-bold">
                    📄 {selectedSourceFile}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono shrink-0">
                    <span>{sourceFileData?.language || 'code'}</span>
                    <span>•</span>
                    <span>{sourceFileData?.total_lines || 0} lines</span>
                    <span>•</span>
                    <span>{((sourceFileData?.size_bytes || 0) / 1024).toFixed(1)} KB</span>
                  </div>
                </div>

                {/* Code Window with Blame Gutter */}
                {isSourceFileLoading ? (
                  <div className="py-24 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                    <RotateCw className="h-4 w-4 animate-spin text-cyan-400" />
                    Reading source file and git blame...
                  </div>
                ) : sourceFileData ? (
                  <div className="rounded-lg border border-border bg-black/80 font-mono text-xs overflow-x-auto max-h-[600px] overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                      <tbody>
                        {sourceFileData.content.split('\n').map((line, idx) => {
                          const lineNo = idx + 1;
                          const blameItem = sourceFileData.blame.find((b) => b.line_number === lineNo);
                          const lineSymbols = sourceFileData.symbols.filter((s) => s.line_number === lineNo);

                          return (
                            <tr key={lineNo} className="hover:bg-muted/20 transition-colors group">
                              {/* Line Number */}
                              <td className="w-10 select-none px-2 py-0.5 text-right text-[10px] text-muted-foreground/60 border-r border-border/40 font-mono">
                                {lineNo}
                              </td>

                              {/* Git Blame Gutter */}
                              {showBlame && (
                                <td className="w-40 select-none px-2 py-0.5 text-[9px] text-muted-foreground border-r border-border/40 font-mono whitespace-nowrap overflow-hidden text-ellipsis max-w-[130px]">
                                  {blameItem ? (
                                    <span title={`${blameItem.commit_sha} - ${blameItem.author}: ${blameItem.summary}`}>
                                      <span className="text-cyan-400 font-bold">{blameItem.commit_sha.slice(0, 6)}</span>{' '}
                                      <span className="text-zinc-400">{blameItem.author.split(' ')[0]}</span>{' '}
                                      <span className="text-zinc-500">{blameItem.date}</span>
                                    </span>
                                  ) : (
                                    <span className="text-zinc-600">uncommitted</span>
                                  )}
                                </td>
                              )}

                              {/* Source Code Line Content */}
                              <td className="px-3 py-0.5 text-foreground whitespace-pre text-[11px]">
                                <span>{line}</span>
                                {lineSymbols.map((sym) => (
                                  <button
                                    key={sym.id}
                                    type="button"
                                    onClick={() => setSelectedSourceSymbol(sym.name)}
                                    className="ml-2 inline-flex items-center px-1.5 py-0.2 rounded text-[8px] uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30 transition-all font-mono"
                                  >
                                    ◈ {sym.name} ({sym.kind})
                                  </button>
                                ))}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-24 text-center text-xs text-muted-foreground">
                    Select a source file to view code and AST symbols.
                  </div>
                )}
              </div>
            </div>

            {/* Column 3: Code Intelligence & Blast Radius Inspector (4 cols) */}
            <div className="lg:col-span-4 space-y-4">
              {/* Definition Card */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Target className="h-4 w-4 text-cyan-400" />
                    Symbol Definition
                  </span>
                  {symbolDefinition && (
                    <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-muted text-cyan-400 font-mono font-bold">
                      {symbolDefinition.symbol_kind}
                    </span>
                  )}
                </div>

                {isDefinitionLoading ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    Resolving symbol declaration...
                  </div>
                ) : symbolDefinition ? (
                  <div className="space-y-2 text-xs">
                    <div className="text-sm font-bold text-foreground truncate font-mono">
                      {symbolDefinition.symbol_name}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono">
                      📍 {symbolDefinition.file_path}:{symbolDefinition.line_number}
                    </div>

                    {symbolDefinition.signature && (
                      <div className="p-2 rounded bg-background border border-border text-[10px] font-mono text-emerald-300 truncate">
                        {symbolDefinition.signature}
                      </div>
                    )}

                    {symbolDefinition.surrounding_code && (
                      <div className="space-y-1">
                        <span className="text-[9px] uppercase font-bold text-muted-foreground">Declaration Snippet:</span>
                        <pre className="p-2.5 rounded bg-black/60 border border-border/40 text-[10px] text-zinc-300 font-mono overflow-x-auto max-h-36 whitespace-pre-wrap">
                          {symbolDefinition.surrounding_code}
                        </pre>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    Select a symbol to inspect its definition and callers.
                  </div>
                )}
              </div>

              {/* References & Call Sites */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <span>References ({symbolReferences?.total_references || 0})</span>
                  <span className="text-[10px] text-emerald-400 font-mono">Cross-File</span>
                </div>

                {isReferencesLoading ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    Tracing caller sites across monorepo...
                  </div>
                ) : symbolReferences && symbolReferences.references.length > 0 ? (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {symbolReferences.references.map((ref, idx) => (
                      <div
                        key={idx}
                        onClick={() => setSelectedSourceFile(ref.file_path)}
                        className="p-2 rounded-lg border border-border/50 bg-background/50 hover:bg-secondary/40 cursor-pointer text-xs space-y-0.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground text-[11px] truncate font-mono">
                            {ref.caller_symbol}
                          </span>
                          <span className="text-[8px] uppercase px-1 rounded bg-muted text-cyan-300 font-mono">
                            {ref.relation}
                          </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono truncate">
                          {ref.file_path}:{ref.line_number}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    No references found for selected symbol.
                  </div>
                )}
              </div>

              {/* Blast Radius & Transitive Impact Analysis */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <ShieldAlert className="h-4 w-4 text-amber-400" />
                    Blast Radius & Impact Radar
                  </span>
                  {blastRadiusData && (
                    <span
                      className={`text-[9px] uppercase px-2 py-0.5 rounded-full font-mono font-bold ${
                        blastRadiusData.risk_level === 'CRITICAL'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : blastRadiusData.risk_level === 'HIGH'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : blastRadiusData.risk_level === 'MEDIUM'
                          ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {blastRadiusData.risk_level} ({blastRadiusData.risk_score})
                    </span>
                  )}
                </div>

                {isBlastRadiusLoading ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    Computing transitive dependency impact...
                  </div>
                ) : blastRadiusData ? (
                  <div className="space-y-3 text-xs">
                    {/* Impact Metrics Grid */}
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="p-2 rounded bg-background/60 border border-border/50">
                        <span className="text-muted-foreground block">Impacted Files:</span>
                        <span className="text-foreground font-bold font-mono">{blastRadiusData.total_impacted_files} files</span>
                      </div>
                      <div className="p-2 rounded bg-background/60 border border-border/50">
                        <span className="text-muted-foreground block">Downstream Dependents:</span>
                        <span className="text-cyan-400 font-bold font-mono">
                          {blastRadiusData.direct_dependents.length + blastRadiusData.transitive_dependents.length}
                        </span>
                      </div>
                    </div>

                    {/* Impacted Endpoints */}
                    {blastRadiusData.impacted_endpoints.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[9px] uppercase font-bold text-amber-400">
                          Impacted Endpoints ({blastRadiusData.impacted_endpoints.length}):
                        </span>
                        <div className="space-y-1 max-h-24 overflow-y-auto">
                          {blastRadiusData.impacted_endpoints.map((ep, i) => (
                            <div key={i} className="p-1 rounded bg-amber-500/10 border border-amber-500/20 text-[10px] font-mono text-amber-300 truncate">
                              ⚡ {ep.signature || ep.name}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Impacted Unit Tests */}
                    {blastRadiusData.impacted_tests.length > 0 && (
                      <div className="space-y-1 pt-1 border-t border-border/40">
                        <span className="text-[9px] uppercase font-bold text-emerald-400">
                          Impacted Test Suites ({blastRadiusData.impacted_tests.length}):
                        </span>
                        <div className="space-y-1 max-h-24 overflow-y-auto">
                          {blastRadiusData.impacted_tests.map((testPath, i) => (
                            <div key={i} className="text-[10px] font-mono text-muted-foreground truncate">
                              🧪 {testPath.split('/').pop()}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    Select a target to compute change blast radius.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: CONTEXT ASSEMBLY ENGINE */}
      {activeTab === 'assembly' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="rounded-xl border border-border bg-card p-6 space-y-5">
            <div>
              <h2 className="text-base font-semibold text-foreground">Task Context Assembly Pipeline</h2>
              <p className="text-xs text-muted-foreground mt-1">
                TASK → identify required knowledge → retrieve memories → apply permissions → rank relevance → send minimal necessary context to model.
              </p>
            </div>

            <form onSubmit={handleAssemble} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">Task Objective</label>
                <textarea
                  rows={3}
                  value={taskObjective}
                  onChange={(e) => setTaskObjective(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">Caller Role</label>
                  <select
                    value={callerRole}
                    onChange={(e) => setCallerRole(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                  >
                    <option value="MEMBER">MEMBER (Standard Agent/User)</option>
                    <option value="MANAGER">MANAGER (Department Head)</option>
                    <option value="ADMIN">ADMIN (Workspace Admin)</option>
                    <option value="OWNER">OWNER (Full Privilege)</option>
                    <option value="VIEWER">VIEWER (Read Only)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">Max Context Tokens</label>
                  <input
                    type="number"
                    value={maxContextTokens}
                    onChange={(e) => setMaxContextTokens(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground font-mono focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">Caller Permission Claims</label>
                <input
                  type="text"
                  value={callerPermissions}
                  onChange={(e) => setCallerPermissions(e.target.value)}
                  placeholder="dept:compliance, role:MEMBER"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              {/* Built-in Token Compression Controls */}
              <div className="p-3 rounded-xl border border-primary/20 bg-primary/5 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs font-semibold text-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={assembleCompressContext}
                      onChange={(e) => setAssembleCompressContext(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary"
                    />
                    Token Compression (Rule 6: Zero-Filler)
                  </label>
                  <span className="text-[10px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                    Active
                  </span>
                </div>
                {assembleCompressContext && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="text-[10px] font-medium text-muted-foreground block mb-1">
                        Strategy
                      </label>
                      <select
                        value={assembleStrategy}
                        onChange={(e) =>
                          setAssembleStrategy(
                            e.target.value as 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE' | 'TRIPLETS'
                          )
                        }
                        className="w-full rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground font-mono focus:outline-none focus:border-primary"
                      >
                        <option value="AGGRESSIVE">AGGRESSIVE (Bullet Fragments)</option>
                        <option value="BALANCED">BALANCED (Preamble Scrub)</option>
                        <option value="TRIPLETS">TRIPLETS (Knowledge Graph)</option>
                        <option value="CONSERVATIVE">CONSERVATIVE (Pleasantry Strip)</option>
                      </select>
                    </div>
                    <div className="text-[10px] text-muted-foreground flex items-center pt-3">
                      Compresses assembled context prior to injection into AI inference.
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={assembleMutation.isPending}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {assembleMutation.isPending ? (
                  <>
                    <RotateCw className="h-4 w-4 animate-spin" /> Assembling Authorized Context...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" /> Run Context Assembly
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Context Assembly Output */}
          <div className="rounded-xl border border-border bg-card p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <h2 className="text-base font-semibold text-foreground">Sanitized Model Context</h2>
                {assembleMutation.data && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="h-3 w-3" /> Zero Leakage Verified
                  </span>
                )}
              </div>

              {assembleMutation.isPending && (
                <div className="py-20 flex flex-col items-center justify-center text-center space-y-3">
                  <RotateCw className="h-8 w-8 text-primary animate-spin" />
                  <p className="text-xs text-muted-foreground">
                    Evaluating domain tags, enforcing permission boundaries, ranking relevance...
                  </p>
                </div>
              )}

              {assembleMutation.data && (
                <div className="mt-4 space-y-4">
                  {/* Telemetry Chips */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-2 rounded-lg bg-background border border-border">
                      <div className="text-[10px] text-muted-foreground">Evaluated</div>
                      <div className="text-xs font-semibold text-foreground font-mono">
                        {assembleMutation.data.total_memories_evaluated} items
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-background border border-border">
                      <div className="text-[10px] text-muted-foreground">Selected</div>
                      <div className="text-xs font-semibold text-primary font-mono">
                        {assembleMutation.data.authorized_memories_selected} items
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-background border border-border">
                      <div className="text-[10px] text-muted-foreground">Context Tokens</div>
                      <div className="text-xs font-semibold text-emerald-400 font-mono">
                        ~{assembleMutation.data.estimated_context_tokens}
                      </div>
                    </div>
                  </div>

                  {/* Token Compression Savings Ribbon */}
                  {assembleMutation.data.compression_applied && (
                    <div className="p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 font-semibold text-emerald-400">
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>Built-in Token Compression Active</span>
                      </div>
                      <div className="flex items-center gap-3 font-mono text-[11px]">
                        <span className="text-muted-foreground">Uncompressed: ~{assembleMutation.data.uncompressed_context_tokens}</span>
                        <span className="font-bold text-emerald-300">Saved: +{assembleMutation.data.tokens_saved} ({assembleMutation.data.compression_ratio_pct}%)</span>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">
                      Assembled Minimal Prompt (Injected to AI Provider)
                    </label>
                    <div className="rounded-lg border border-border bg-background p-4 text-xs font-mono text-foreground whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">
                      {assembleMutation.data.assembled_context_prompt}
                    </div>
                  </div>
                </div>
              )}

              {!assembleMutation.data && !assembleMutation.isPending && (
                <div className="py-20 text-center space-y-2 text-muted-foreground">
                  <Sparkles className="h-8 w-8 mx-auto text-muted-foreground/40" />
                  <p className="text-xs">Run the pipeline to test privacy boundaries and minimal context generation.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB: SOURCE GRAPH & CODE INTELLIGENCE */}
      {activeTab === 'source_graph' && (
        <div className="space-y-6 animate-fade-in font-mono">
          {/* Header Action Bar with Sourcegraph Query Search */}
          <div className="p-5 rounded-2xl border border-border bg-card/80 backdrop-blur-md space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <GitFork className="h-5 w-5 text-cyan-400" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                    Source Graph & Monorepo Code Intelligence
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground mt-1 font-sans">
                  Cross-file definition resolution, caller references, git blame gutter, and transitive blast radius impact analysis.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowBlame(!showBlame)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    showBlame
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {showBlame ? '✓ Git Blame Active' : 'Toggle Git Blame'}
                </button>
              </div>
            </div>

            {/* Sourcegraph Query Bar */}
            <div className="space-y-2 pt-1">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Query syntax: lang:python type:class file:compression TokenCompressor"
                  value={sourceGraphQuery}
                  onChange={(e) => setSourceGraphQuery(e.target.value)}
                  className="w-full pl-10 pr-24 py-2.5 rounded-xl border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-cyan-500 font-mono transition-all"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-mono">
                  {isSourceSearching ? 'Searching...' : `${sourceSearchResults?.total_matches || 0} matches`}
                </div>
              </div>

              {/* Quick Filter Chips */}
              <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                <span className="text-muted-foreground font-semibold">Filter Chips:</span>
                {[
                  { label: 'lang:python', query: 'lang:python ' },
                  { label: 'lang:typescript', query: 'lang:typescript ' },
                  { label: 'type:class', query: 'type:class ' },
                  { label: 'type:endpoint', query: 'type:endpoint ' },
                  { label: 'file:apps/api', query: 'file:apps/api ' },
                  { label: 'file:apps/web', query: 'file:apps/web ' },
                ].map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => setSourceGraphQuery((prev) => (prev.includes(chip.label) ? prev : `${chip.query}${prev}`))}
                    className="px-2 py-0.5 rounded bg-muted/60 text-muted-foreground hover:text-foreground border border-border/40 transition-all font-mono"
                  >
                    +{chip.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 3-Column Source Graph Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Column 1: Monorepo Files & Search Matches (3 cols) */}
            <div className="lg:col-span-3 space-y-4">
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <span>Monorepo Files</span>
                  <span className="text-[10px] text-cyan-400 font-mono">Indexed</span>
                </div>

                <div className="space-y-1 max-h-[500px] overflow-y-auto pr-1">
                  {[
                    'apps/api/nexora/core/compression.py',
                    'apps/api/nexora/domains/memory/source_graph.py',
                    'apps/api/nexora/domains/memory/code_graph.py',
                    'apps/api/nexora/domains/memory/router.py',
                    'apps/api/nexora/domains/agents/execution.py',
                    'apps/web/src/lib/api/sourceGraph.ts',
                    'apps/web/src/app/dashboard/memory/page.tsx',
                    'apps/tui-rs/src/features/engineering/ui.rs',
                    'apps/tui-rs/src/client.rs',
                  ].map((fp) => (
                    <div
                      key={fp}
                      onClick={() => setSelectedSourceFile(fp)}
                      className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                        selectedSourceFile === fp
                          ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300 font-bold'
                          : 'border-border/60 bg-background/60 text-muted-foreground hover:bg-secondary/40 hover:text-foreground'
                      }`}
                    >
                      <div className="truncate font-mono">{fp.split('/').pop()}</div>
                      <div className="text-[10px] text-muted-foreground truncate mt-0.5">{fp}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Matched Search Results */}
              {sourceSearchResults && sourceSearchResults.results.length > 0 && (
                <div className="p-4 rounded-xl border border-border bg-card space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                    <span>Query Hits ({sourceSearchResults.total_matches})</span>
                    <span className="text-[10px] text-emerald-400 font-mono">{sourceSearchResults.duration_ms}ms</span>
                  </div>
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {sourceSearchResults.results.slice(0, 8).map((sr, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          setSelectedSourceFile(sr.file_path);
                          if (sr.symbol_name) setSelectedSourceSymbol(sr.symbol_name);
                        }}
                        className="p-2 rounded-lg border border-border/50 bg-background/50 hover:bg-secondary/40 cursor-pointer text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground truncate">{sr.symbol_name || sr.file_path.split('/').pop()}</span>
                          {sr.symbol_kind && (
                            <span className="text-[8px] uppercase px-1 rounded bg-muted text-cyan-400 font-mono">{sr.symbol_kind}</span>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">{sr.file_path}:{sr.line_number}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Column 2: Source Code Viewer with Blame Gutter (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-border text-xs">
                  <div className="truncate font-mono text-foreground font-bold">
                    📄 {selectedSourceFile}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono shrink-0">
                    <span>{sourceFileData?.language || 'code'}</span>
                    <span>•</span>
                    <span>{sourceFileData?.total_lines || 0} lines</span>
                    <span>•</span>
                    <span>{((sourceFileData?.size_bytes || 0) / 1024).toFixed(1)} KB</span>
                  </div>
                </div>

                {/* Code Window with Blame Gutter */}
                {isSourceFileLoading ? (
                  <div className="py-24 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                    <RotateCw className="h-4 w-4 animate-spin text-cyan-400" />
                    Reading source file and git blame...
                  </div>
                ) : sourceFileData ? (
                  <div className="rounded-lg border border-border bg-black/80 font-mono text-xs overflow-x-auto max-h-[600px] overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                      <tbody>
                        {sourceFileData.content.split('\n').map((line, idx) => {
                          const lineNo = idx + 1;
                          const blameItem = sourceFileData.blame.find((b) => b.line_number === lineNo);
                          const lineSymbols = sourceFileData.symbols.filter((s) => s.line_number === lineNo);

                          return (
                            <tr key={lineNo} className="hover:bg-muted/20 transition-colors group">
                              {/* Line Number */}
                              <td className="w-10 select-none px-2 py-0.5 text-right text-[10px] text-muted-foreground/60 border-r border-border/40 font-mono">
                                {lineNo}
                              </td>

                              {/* Git Blame Gutter */}
                              {showBlame && (
                                <td className="w-40 select-none px-2 py-0.5 text-[9px] text-muted-foreground border-r border-border/40 font-mono whitespace-nowrap overflow-hidden text-ellipsis max-w-[130px]">
                                  {blameItem ? (
                                    <span title={`${blameItem.commit_sha} - ${blameItem.author}: ${blameItem.summary}`}>
                                      <span className="text-cyan-400 font-bold">{blameItem.commit_sha.slice(0, 6)}</span>{' '}
                                      <span className="text-zinc-400">{blameItem.author.split(' ')[0]}</span>{' '}
                                      <span className="text-zinc-500">{blameItem.date}</span>
                                    </span>
                                  ) : (
                                    <span className="text-zinc-600">uncommitted</span>
                                  )}
                                </td>
                              )}

                              {/* Source Code Line Content */}
                              <td className="px-3 py-0.5 text-foreground whitespace-pre text-[11px]">
                                <span>{line}</span>
                                {lineSymbols.map((sym) => (
                                  <button
                                    key={sym.id}
                                    type="button"
                                    onClick={() => setSelectedSourceSymbol(sym.name)}
                                    className="ml-2 inline-flex items-center px-1.5 py-0.2 rounded text-[8px] uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30 transition-all font-mono"
                                  >
                                    ◈ {sym.name} ({sym.kind})
                                  </button>
                                ))}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-24 text-center text-xs text-muted-foreground">
                    Select a source file to view code and AST symbols.
                  </div>
                )}
              </div>
            </div>

            {/* Column 3: Code Intelligence & Blast Radius Inspector (4 cols) */}
            <div className="lg:col-span-4 space-y-4">
              {/* Definition Card */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Target className="h-4 w-4 text-cyan-400" />
                    Symbol Definition
                  </span>
                  {symbolDefinition && (
                    <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-muted text-cyan-400 font-mono font-bold">
                      {symbolDefinition.symbol_kind}
                    </span>
                  )}
                </div>

                {isDefinitionLoading ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    Resolving symbol declaration...
                  </div>
                ) : symbolDefinition ? (
                  <div className="space-y-2 text-xs">
                    <div className="text-sm font-bold text-foreground truncate font-mono">
                      {symbolDefinition.symbol_name}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono">
                      📍 {symbolDefinition.file_path}:{symbolDefinition.line_number}
                    </div>

                    {symbolDefinition.signature && (
                      <div className="p-2 rounded bg-background border border-border text-[10px] font-mono text-emerald-300 truncate">
                        {symbolDefinition.signature}
                      </div>
                    )}

                    {symbolDefinition.surrounding_code && (
                      <div className="space-y-1">
                        <span className="text-[9px] uppercase font-bold text-muted-foreground">Declaration Snippet:</span>
                        <pre className="p-2.5 rounded bg-black/60 border border-border/40 text-[10px] text-zinc-300 font-mono overflow-x-auto max-h-36 whitespace-pre-wrap">
                          {symbolDefinition.surrounding_code}
                        </pre>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    Select a symbol to inspect its definition and callers.
                  </div>
                )}
              </div>

              {/* References & Call Sites */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <span>References ({symbolReferences?.total_references || 0})</span>
                  <span className="text-[10px] text-emerald-400 font-mono">Cross-File</span>
                </div>

                {isReferencesLoading ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    Tracing caller sites across monorepo...
                  </div>
                ) : symbolReferences && symbolReferences.references.length > 0 ? (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {symbolReferences.references.map((ref, idx) => (
                      <div
                        key={idx}
                        onClick={() => setSelectedSourceFile(ref.file_path)}
                        className="p-2 rounded-lg border border-border/50 bg-background/50 hover:bg-secondary/40 cursor-pointer text-xs space-y-0.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground text-[11px] truncate font-mono">
                            {ref.caller_symbol}
                          </span>
                          <span className="text-[8px] uppercase px-1 rounded bg-muted text-cyan-300 font-mono">
                            {ref.relation}
                          </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono truncate">
                          {ref.file_path}:{ref.line_number}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    No references found for selected symbol.
                  </div>
                )}
              </div>

              {/* Blast Radius & Transitive Impact Analysis */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <ShieldAlert className="h-4 w-4 text-amber-400" />
                    Blast Radius & Impact Radar
                  </span>
                  {blastRadiusData && (
                    <span
                      className={`text-[9px] uppercase px-2 py-0.5 rounded-full font-mono font-bold ${
                        blastRadiusData.risk_level === 'CRITICAL'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : blastRadiusData.risk_level === 'HIGH'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : blastRadiusData.risk_level === 'MEDIUM'
                          ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {blastRadiusData.risk_level} ({blastRadiusData.risk_score})
                    </span>
                  )}
                </div>

                {isBlastRadiusLoading ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    Computing transitive dependency impact...
                  </div>
                ) : blastRadiusData ? (
                  <div className="space-y-3 text-xs">
                    {/* Impact Metrics Grid */}
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="p-2 rounded bg-background/60 border border-border/50">
                        <span className="text-muted-foreground block">Impacted Files:</span>
                        <span className="text-foreground font-bold font-mono">{blastRadiusData.total_impacted_files} files</span>
                      </div>
                      <div className="p-2 rounded bg-background/60 border border-border/50">
                        <span className="text-muted-foreground block">Downstream Dependents:</span>
                        <span className="text-cyan-400 font-bold font-mono">
                          {blastRadiusData.direct_dependents.length + blastRadiusData.transitive_dependents.length}
                        </span>
                      </div>
                    </div>

                    {/* Impacted Endpoints */}
                    {blastRadiusData.impacted_endpoints.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[9px] uppercase font-bold text-amber-400">
                          Impacted Endpoints ({blastRadiusData.impacted_endpoints.length}):
                        </span>
                        <div className="space-y-1 max-h-24 overflow-y-auto">
                          {blastRadiusData.impacted_endpoints.map((ep, i) => (
                            <div key={i} className="p-1 rounded bg-amber-500/10 border border-amber-500/20 text-[10px] font-mono text-amber-300 truncate">
                              ⚡ {ep.signature || ep.name}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Impacted Unit Tests */}
                    {blastRadiusData.impacted_tests.length > 0 && (
                      <div className="space-y-1 pt-1 border-t border-border/40">
                        <span className="text-[9px] uppercase font-bold text-emerald-400">
                          Impacted Test Suites ({blastRadiusData.impacted_tests.length}):
                        </span>
                        <div className="space-y-1 max-h-24 overflow-y-auto">
                          {blastRadiusData.impacted_tests.map((testPath, i) => (
                            <div key={i} className="text-[10px] font-mono text-muted-foreground truncate">
                              🧪 {testPath.split('/').pop()}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    Select a target to compute change blast radius.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: KNOWLEDGE GRAPH & TOKEN COMPRESSION */}
      {activeTab === 'knowledge_graph' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border border-border bg-card">
            <div>
              <div className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Relational Triplestore & Sub-Graph Context Cache</h2>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Autonomous entity-relationship graph reducing context tokens by 60–80% through semantic neighbor injection.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="badge badge-primary text-xs font-mono">
                {graphData?.total_entities || 0} Entities
              </span>
              <span className="badge badge-outline text-xs font-mono">
                {graphData?.total_relations || 0} Triples
              </span>
              <button
                onClick={() => refetchGraph()}
                className="p-1.5 rounded-lg border border-border hover:bg-secondary text-muted-foreground hover:text-foreground"
                title="Refresh Graph"
              >
                <RotateCw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border border-border bg-card/60">
            <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="search"
                  value={kgSearch}
                  onChange={(e) => setKgSearch(e.target.value)}
                  placeholder="Search entities, concepts, or descriptions..."
                  className="input pl-8 text-xs h-9 w-full"
                />
              </div>

              <select
                value={kgEntityType}
                onChange={(e) => setKgEntityType(e.target.value)}
                className="input text-xs h-9 w-auto min-w-[140px]"
              >
                <option value="ALL">All Entity Types</option>
                <option value="SYSTEM">System Core</option>
                <option value="GOVERNANCE">Governance</option>
                <option value="SECURITY">Security</option>
                <option value="ENGINE">Engine / Intelligence</option>
                <option value="DATABASE">Database</option>
                <option value="CONCEPT">Concepts & Facts</option>
                <option value="POLICY">Policies</option>
                <option value="AGENT">Agents</option>
                <option value="TOOL">Tools</option>
              </select>

              {(kgSearch || kgEntityType !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setKgSearch('');
                    setKgEntityType('ALL');
                    setSelectedKgEntityId(null);
                  }}
                  className="btn btn-outline h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear Filters
                </button>
              )}
            </div>

            <div className="text-[11px] font-mono text-muted-foreground">
              Showing {graphData?.entities?.length || 0} nodes / {graphData?.relations?.length || 0} edges
            </div>
          </div>

          {/* Quick Extract Box */}
          <div className="p-4 rounded-xl border border-border bg-card/60 space-y-3">
            <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Instant Fact & Triple Extraction Pipeline
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. Agent Alpha uses Stripe and enforces Policy Gamma..."
                value={extractText}
                onChange={(e) => setExtractText(e.target.value)}
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary font-mono"
              />
              <button
                onClick={() => {
                  if (extractText.trim()) extractFactsMutation.mutate(extractText);
                }}
                disabled={extractFactsMutation.isPending || !extractText.trim()}
                className="btn btn-primary text-xs px-3 h-9"
              >
                {extractFactsMutation.isPending ? 'Extracting...' : 'Extract Triples'}
              </button>
            </div>
          </div>

          {/* Graph Entities & Triples Explorer */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider font-mono">
                  Matched Entities ({graphData?.entities?.length || 0})
                </h3>
                {selectedKgEntityId && (
                  <button
                    onClick={() => setSelectedKgEntityId(null)}
                    className="text-[10px] text-primary hover:underline font-mono"
                  >
                    Clear Focus
                  </button>
                )}
              </div>

              {isGraphLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RotateCw className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : !graphData?.entities || graphData.entities.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-xs font-mono">
                  No entities matched query &quot;{kgSearch}&quot;.
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {graphData.entities.map((ent) => {
                    const isSelected = selectedKgEntityId === ent.id;
                    return (
                      <div
                        key={ent.id}
                        onClick={() => setSelectedKgEntityId(isSelected ? null : ent.id)}
                        className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                          isSelected
                            ? 'border-primary bg-primary/10 shadow-sm'
                            : 'border-border/80 bg-background/80 hover:border-primary/40'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-foreground font-mono">{ent.name}</span>
                          <span className="badge badge-primary text-[10px] uppercase font-mono">{ent.entity_type}</span>
                        </div>
                        {ent.description && (
                          <p className="text-[11px] text-muted-foreground mt-1">{ent.description}</p>
                        )}
                        {isSelected && (
                          <div className="mt-2 pt-2 border-t border-primary/20 flex items-center justify-between text-[10px] font-mono text-primary">
                            <span>FOCUSED NODE</span>
                            <span>Filter Triples ↳</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider font-mono">
                  {selectedKgEntityId ? 'Connected Sub-Graph Triples' : 'Directed Triples'} ({
                    (selectedKgEntityId
                      ? graphData?.relations?.filter((r) => r.source_id === selectedKgEntityId || r.target_id === selectedKgEntityId)
                      : graphData?.relations)?.length || 0
                  })
                </h3>
                {selectedKgEntityId && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                    Filtered by Node
                  </span>
                )}
              </div>

              {isGraphLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RotateCw className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1 font-mono text-xs">
                  {graphData?.relations
                    ?.filter((r) => !selectedKgEntityId || r.source_id === selectedKgEntityId || r.target_id === selectedKgEntityId)
                    .map((rel) => {
                      const source = graphData?.entities?.find((e) => e.id === rel.source_id)?.name || rel.source_id.slice(0, 8);
                      const target = graphData?.entities?.find((e) => e.id === rel.target_id)?.name || rel.target_id.slice(0, 8);
                      const isHighlighted = selectedKgEntityId && (rel.source_id === selectedKgEntityId || rel.target_id === selectedKgEntityId);

                      return (
                        <div
                          key={rel.id}
                          className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 transition-all ${
                            isHighlighted
                              ? 'border-primary/60 bg-primary/5 font-semibold'
                              : 'border-border/80 bg-background/80'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="font-bold text-primary truncate">[{source}]</span>
                            <span className="text-muted-foreground text-[10px]">--({rel.relation_type.toLowerCase()})--&gt;</span>
                            <span className="font-semibold text-foreground truncate">[{target}]</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground shrink-0">w: {rel.weight}</span>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB: SOURCE GRAPH & CODE INTELLIGENCE */}
      {activeTab === 'source_graph' && (
        <div className="space-y-6 animate-fade-in font-mono">
          {/* Header Action Bar with Sourcegraph Query Search */}
          <div className="p-5 rounded-2xl border border-border bg-card/80 backdrop-blur-md space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <GitFork className="h-5 w-5 text-cyan-400" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                    Source Graph & Monorepo Code Intelligence
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground mt-1 font-sans">
                  Cross-file definition resolution, caller references, git blame gutter, and transitive blast radius impact analysis.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowBlame(!showBlame)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    showBlame
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {showBlame ? '✓ Git Blame Active' : 'Toggle Git Blame'}
                </button>
              </div>
            </div>

            {/* Sourcegraph Query Bar */}
            <div className="space-y-2 pt-1">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Query syntax: lang:python type:class file:compression TokenCompressor"
                  value={sourceGraphQuery}
                  onChange={(e) => setSourceGraphQuery(e.target.value)}
                  className="w-full pl-10 pr-24 py-2.5 rounded-xl border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-cyan-500 font-mono transition-all"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-mono">
                  {isSourceSearching ? 'Searching...' : `${sourceSearchResults?.total_matches || 0} matches`}
                </div>
              </div>

              {/* Quick Filter Chips */}
              <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                <span className="text-muted-foreground font-semibold">Filter Chips:</span>
                {[
                  { label: 'lang:python', query: 'lang:python ' },
                  { label: 'lang:typescript', query: 'lang:typescript ' },
                  { label: 'type:class', query: 'type:class ' },
                  { label: 'type:endpoint', query: 'type:endpoint ' },
                  { label: 'file:apps/api', query: 'file:apps/api ' },
                  { label: 'file:apps/web', query: 'file:apps/web ' },
                ].map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => setSourceGraphQuery((prev) => (prev.includes(chip.label) ? prev : `${chip.query}${prev}`))}
                    className="px-2 py-0.5 rounded bg-muted/60 text-muted-foreground hover:text-foreground border border-border/40 transition-all font-mono"
                  >
                    +{chip.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 3-Column Source Graph Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Column 1: Monorepo Files & Search Matches (3 cols) */}
            <div className="lg:col-span-3 space-y-4">
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <span>Monorepo Files</span>
                  <span className="text-[10px] text-cyan-400 font-mono">Indexed</span>
                </div>

                <div className="space-y-1 max-h-[500px] overflow-y-auto pr-1">
                  {[
                    'apps/api/nexora/core/compression.py',
                    'apps/api/nexora/domains/memory/source_graph.py',
                    'apps/api/nexora/domains/memory/code_graph.py',
                    'apps/api/nexora/domains/memory/router.py',
                    'apps/api/nexora/domains/agents/execution.py',
                    'apps/web/src/lib/api/sourceGraph.ts',
                    'apps/web/src/app/dashboard/memory/page.tsx',
                    'apps/tui-rs/src/features/engineering/ui.rs',
                    'apps/tui-rs/src/client.rs',
                  ].map((fp) => (
                    <div
                      key={fp}
                      onClick={() => setSelectedSourceFile(fp)}
                      className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                        selectedSourceFile === fp
                          ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300 font-bold'
                          : 'border-border/60 bg-background/60 text-muted-foreground hover:bg-secondary/40 hover:text-foreground'
                      }`}
                    >
                      <div className="truncate font-mono">{fp.split('/').pop()}</div>
                      <div className="text-[10px] text-muted-foreground truncate mt-0.5">{fp}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Matched Search Results */}
              {sourceSearchResults && sourceSearchResults.results.length > 0 && (
                <div className="p-4 rounded-xl border border-border bg-card space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                    <span>Query Hits ({sourceSearchResults.total_matches})</span>
                    <span className="text-[10px] text-emerald-400 font-mono">{sourceSearchResults.duration_ms}ms</span>
                  </div>
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {sourceSearchResults.results.slice(0, 8).map((sr, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          setSelectedSourceFile(sr.file_path);
                          if (sr.symbol_name) setSelectedSourceSymbol(sr.symbol_name);
                        }}
                        className="p-2 rounded-lg border border-border/50 bg-background/50 hover:bg-secondary/40 cursor-pointer text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground truncate">{sr.symbol_name || sr.file_path.split('/').pop()}</span>
                          {sr.symbol_kind && (
                            <span className="text-[8px] uppercase px-1 rounded bg-muted text-cyan-400 font-mono">{sr.symbol_kind}</span>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">{sr.file_path}:{sr.line_number}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Column 2: Source Code Viewer with Blame Gutter (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-border text-xs">
                  <div className="truncate font-mono text-foreground font-bold">
                    📄 {selectedSourceFile}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono shrink-0">
                    <span>{sourceFileData?.language || 'code'}</span>
                    <span>•</span>
                    <span>{sourceFileData?.total_lines || 0} lines</span>
                    <span>•</span>
                    <span>{((sourceFileData?.size_bytes || 0) / 1024).toFixed(1)} KB</span>
                  </div>
                </div>

                {/* Code Window with Blame Gutter */}
                {isSourceFileLoading ? (
                  <div className="py-24 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                    <RotateCw className="h-4 w-4 animate-spin text-cyan-400" />
                    Reading source file and git blame...
                  </div>
                ) : sourceFileData ? (
                  <div className="rounded-lg border border-border bg-black/80 font-mono text-xs overflow-x-auto max-h-[600px] overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                      <tbody>
                        {sourceFileData.content.split('\n').map((line, idx) => {
                          const lineNo = idx + 1;
                          const blameItem = sourceFileData.blame.find((b) => b.line_number === lineNo);
                          const lineSymbols = sourceFileData.symbols.filter((s) => s.line_number === lineNo);

                          return (
                            <tr key={lineNo} className="hover:bg-muted/20 transition-colors group">
                              {/* Line Number */}
                              <td className="w-10 select-none px-2 py-0.5 text-right text-[10px] text-muted-foreground/60 border-r border-border/40 font-mono">
                                {lineNo}
                              </td>

                              {/* Git Blame Gutter */}
                              {showBlame && (
                                <td className="w-40 select-none px-2 py-0.5 text-[9px] text-muted-foreground border-r border-border/40 font-mono whitespace-nowrap overflow-hidden text-ellipsis max-w-[130px]">
                                  {blameItem ? (
                                    <span title={`${blameItem.commit_sha} - ${blameItem.author}: ${blameItem.summary}`}>
                                      <span className="text-cyan-400 font-bold">{blameItem.commit_sha.slice(0, 6)}</span>{' '}
                                      <span className="text-zinc-400">{blameItem.author.split(' ')[0]}</span>{' '}
                                      <span className="text-zinc-500">{blameItem.date}</span>
                                    </span>
                                  ) : (
                                    <span className="text-zinc-600">uncommitted</span>
                                  )}
                                </td>
                              )}

                              {/* Source Code Line Content */}
                              <td className="px-3 py-0.5 text-foreground whitespace-pre text-[11px]">
                                <span>{line}</span>
                                {lineSymbols.map((sym) => (
                                  <button
                                    key={sym.id}
                                    type="button"
                                    onClick={() => setSelectedSourceSymbol(sym.name)}
                                    className="ml-2 inline-flex items-center px-1.5 py-0.2 rounded text-[8px] uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30 transition-all font-mono"
                                  >
                                    ◈ {sym.name} ({sym.kind})
                                  </button>
                                ))}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-24 text-center text-xs text-muted-foreground">
                    Select a source file to view code and AST symbols.
                  </div>
                )}
              </div>
            </div>

            {/* Column 3: Code Intelligence & Blast Radius Inspector (4 cols) */}
            <div className="lg:col-span-4 space-y-4">
              {/* Definition Card */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Target className="h-4 w-4 text-cyan-400" />
                    Symbol Definition
                  </span>
                  {symbolDefinition && (
                    <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-muted text-cyan-400 font-mono font-bold">
                      {symbolDefinition.symbol_kind}
                    </span>
                  )}
                </div>

                {isDefinitionLoading ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    Resolving symbol declaration...
                  </div>
                ) : symbolDefinition ? (
                  <div className="space-y-2 text-xs">
                    <div className="text-sm font-bold text-foreground truncate font-mono">
                      {symbolDefinition.symbol_name}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono">
                      📍 {symbolDefinition.file_path}:{symbolDefinition.line_number}
                    </div>

                    {symbolDefinition.signature && (
                      <div className="p-2 rounded bg-background border border-border text-[10px] font-mono text-emerald-300 truncate">
                        {symbolDefinition.signature}
                      </div>
                    )}

                    {symbolDefinition.surrounding_code && (
                      <div className="space-y-1">
                        <span className="text-[9px] uppercase font-bold text-muted-foreground">Declaration Snippet:</span>
                        <pre className="p-2.5 rounded bg-black/60 border border-border/40 text-[10px] text-zinc-300 font-mono overflow-x-auto max-h-36 whitespace-pre-wrap">
                          {symbolDefinition.surrounding_code}
                        </pre>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    Select a symbol to inspect its definition and callers.
                  </div>
                )}
              </div>

              {/* References & Call Sites */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <span>References ({symbolReferences?.total_references || 0})</span>
                  <span className="text-[10px] text-emerald-400 font-mono">Cross-File</span>
                </div>

                {isReferencesLoading ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    Tracing caller sites across monorepo...
                  </div>
                ) : symbolReferences && symbolReferences.references.length > 0 ? (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {symbolReferences.references.map((ref, idx) => (
                      <div
                        key={idx}
                        onClick={() => setSelectedSourceFile(ref.file_path)}
                        className="p-2 rounded-lg border border-border/50 bg-background/50 hover:bg-secondary/40 cursor-pointer text-xs space-y-0.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground text-[11px] truncate font-mono">
                            {ref.caller_symbol}
                          </span>
                          <span className="text-[8px] uppercase px-1 rounded bg-muted text-cyan-300 font-mono">
                            {ref.relation}
                          </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono truncate">
                          {ref.file_path}:{ref.line_number}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    No references found for selected symbol.
                  </div>
                )}
              </div>

              {/* Blast Radius & Transitive Impact Analysis */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <ShieldAlert className="h-4 w-4 text-amber-400" />
                    Blast Radius & Impact Radar
                  </span>
                  {blastRadiusData && (
                    <span
                      className={`text-[9px] uppercase px-2 py-0.5 rounded-full font-mono font-bold ${
                        blastRadiusData.risk_level === 'CRITICAL'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : blastRadiusData.risk_level === 'HIGH'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : blastRadiusData.risk_level === 'MEDIUM'
                          ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {blastRadiusData.risk_level} ({blastRadiusData.risk_score})
                    </span>
                  )}
                </div>

                {isBlastRadiusLoading ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    Computing transitive dependency impact...
                  </div>
                ) : blastRadiusData ? (
                  <div className="space-y-3 text-xs">
                    {/* Impact Metrics Grid */}
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="p-2 rounded bg-background/60 border border-border/50">
                        <span className="text-muted-foreground block">Impacted Files:</span>
                        <span className="text-foreground font-bold font-mono">{blastRadiusData.total_impacted_files} files</span>
                      </div>
                      <div className="p-2 rounded bg-background/60 border border-border/50">
                        <span className="text-muted-foreground block">Downstream Dependents:</span>
                        <span className="text-cyan-400 font-bold font-mono">
                          {blastRadiusData.direct_dependents.length + blastRadiusData.transitive_dependents.length}
                        </span>
                      </div>
                    </div>

                    {/* Impacted Endpoints */}
                    {blastRadiusData.impacted_endpoints.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[9px] uppercase font-bold text-amber-400">
                          Impacted Endpoints ({blastRadiusData.impacted_endpoints.length}):
                        </span>
                        <div className="space-y-1 max-h-24 overflow-y-auto">
                          {blastRadiusData.impacted_endpoints.map((ep, i) => (
                            <div key={i} className="p-1 rounded bg-amber-500/10 border border-amber-500/20 text-[10px] font-mono text-amber-300 truncate">
                              ⚡ {ep.signature || ep.name}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Impacted Unit Tests */}
                    {blastRadiusData.impacted_tests.length > 0 && (
                      <div className="space-y-1 pt-1 border-t border-border/40">
                        <span className="text-[9px] uppercase font-bold text-emerald-400">
                          Impacted Test Suites ({blastRadiusData.impacted_tests.length}):
                        </span>
                        <div className="space-y-1 max-h-24 overflow-y-auto">
                          {blastRadiusData.impacted_tests.map((testPath, i) => (
                            <div key={i} className="text-[10px] font-mono text-muted-foreground truncate">
                              🧪 {testPath.split('/').pop()}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    Select a target to compute change blast radius.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: INGEST KNOWLEDGE FORM */}
      {activeTab === 'add' && (
        <div className="max-w-2xl rounded-xl border border-border bg-card p-6 space-y-5">
          <div>
            <h2 className="text-base font-semibold text-foreground">Ingest Knowledge Asset</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Store a discrete unit of memory with explicit domain classification, scope tier, and provenance metadata.
            </p>
          </div>

          <form onSubmit={handleCreateMemory} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">Title</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. EU GDPR Data Residency Standards"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">Domain</label>
                <select
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value as MemoryDomain)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                >
                  {PRIMARY_MEMORY_DOMAINS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">Access Scope</label>
                <select
                  value={newScope}
                  onChange={(e) => setNewScope(e.target.value as MemoryScope)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                >
                  <option value="INTERNAL">INTERNAL (All company members)</option>
                  <option value="PUBLIC">PUBLIC (External facing)</option>
                  <option value="CONFIDENTIAL">CONFIDENTIAL (Managers only)</option>
                  <option value="RESTRICTED">RESTRICTED (Admins / Owners)</option>
                  <option value="PRIVATE">PRIVATE (Owner only)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground block mb-1">Full Content</label>
              <textarea
                rows={4}
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Detailed knowledge text..."
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                required
              />
            </div>

            <div>
              <label className="text-xs font-medium text-foreground block mb-1">
                Summary <span className="text-muted-foreground font-normal">(Used for token-efficient prompts)</span>
              </label>
              <input
                type="text"
                value={newSummary}
                onChange={(e) => setNewSummary(e.target.value)}
                placeholder="Concise 1-sentence summary"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">Provenance Source</label>
                <input
                  type="text"
                  value={newSource}
                  onChange={(e) => setNewSource(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">Confidence Score (0.0 - 1.0)</label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={newConfidence}
                  onChange={(e) => setNewConfidence(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground font-mono focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={createMemoryMutation.isPending}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {createMemoryMutation.isPending ? (
                <>
                  <RotateCw className="h-4 w-4 animate-spin" /> Ingesting Asset...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" /> Save Memory Item
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* TAB: SOURCE GRAPH & CODE INTELLIGENCE */}
      {activeTab === 'source_graph' && (
        <div className="space-y-6 animate-fade-in font-mono">
          {/* Header Action Bar with Sourcegraph Query Search */}
          <div className="p-5 rounded-2xl border border-border bg-card/80 backdrop-blur-md space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <GitFork className="h-5 w-5 text-cyan-400" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                    Source Graph & Monorepo Code Intelligence
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground mt-1 font-sans">
                  Cross-file definition resolution, caller references, git blame gutter, and transitive blast radius impact analysis.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowBlame(!showBlame)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    showBlame
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {showBlame ? '✓ Git Blame Active' : 'Toggle Git Blame'}
                </button>
              </div>
            </div>

            {/* Sourcegraph Query Bar */}
            <div className="space-y-2 pt-1">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Query syntax: lang:python type:class file:compression TokenCompressor"
                  value={sourceGraphQuery}
                  onChange={(e) => setSourceGraphQuery(e.target.value)}
                  className="w-full pl-10 pr-24 py-2.5 rounded-xl border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-cyan-500 font-mono transition-all"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-mono">
                  {isSourceSearching ? 'Searching...' : `${sourceSearchResults?.total_matches || 0} matches`}
                </div>
              </div>

              {/* Quick Filter Chips */}
              <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                <span className="text-muted-foreground font-semibold">Filter Chips:</span>
                {[
                  { label: 'lang:python', query: 'lang:python ' },
                  { label: 'lang:typescript', query: 'lang:typescript ' },
                  { label: 'type:class', query: 'type:class ' },
                  { label: 'type:endpoint', query: 'type:endpoint ' },
                  { label: 'file:apps/api', query: 'file:apps/api ' },
                  { label: 'file:apps/web', query: 'file:apps/web ' },
                ].map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => setSourceGraphQuery((prev) => (prev.includes(chip.label) ? prev : `${chip.query}${prev}`))}
                    className="px-2 py-0.5 rounded bg-muted/60 text-muted-foreground hover:text-foreground border border-border/40 transition-all font-mono"
                  >
                    +{chip.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 3-Column Source Graph Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Column 1: Monorepo Files & Search Matches (3 cols) */}
            <div className="lg:col-span-3 space-y-4">
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <span>Monorepo Files</span>
                  <span className="text-[10px] text-cyan-400 font-mono">Indexed</span>
                </div>

                <div className="space-y-1 max-h-[500px] overflow-y-auto pr-1">
                  {[
                    'apps/api/nexora/core/compression.py',
                    'apps/api/nexora/domains/memory/source_graph.py',
                    'apps/api/nexora/domains/memory/code_graph.py',
                    'apps/api/nexora/domains/memory/router.py',
                    'apps/api/nexora/domains/agents/execution.py',
                    'apps/web/src/lib/api/sourceGraph.ts',
                    'apps/web/src/app/dashboard/memory/page.tsx',
                    'apps/tui-rs/src/features/engineering/ui.rs',
                    'apps/tui-rs/src/client.rs',
                  ].map((fp) => (
                    <div
                      key={fp}
                      onClick={() => setSelectedSourceFile(fp)}
                      className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                        selectedSourceFile === fp
                          ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300 font-bold'
                          : 'border-border/60 bg-background/60 text-muted-foreground hover:bg-secondary/40 hover:text-foreground'
                      }`}
                    >
                      <div className="truncate font-mono">{fp.split('/').pop()}</div>
                      <div className="text-[10px] text-muted-foreground truncate mt-0.5">{fp}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Matched Search Results */}
              {sourceSearchResults && sourceSearchResults.results.length > 0 && (
                <div className="p-4 rounded-xl border border-border bg-card space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                    <span>Query Hits ({sourceSearchResults.total_matches})</span>
                    <span className="text-[10px] text-emerald-400 font-mono">{sourceSearchResults.duration_ms}ms</span>
                  </div>
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {sourceSearchResults.results.slice(0, 8).map((sr, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          setSelectedSourceFile(sr.file_path);
                          if (sr.symbol_name) setSelectedSourceSymbol(sr.symbol_name);
                        }}
                        className="p-2 rounded-lg border border-border/50 bg-background/50 hover:bg-secondary/40 cursor-pointer text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground truncate">{sr.symbol_name || sr.file_path.split('/').pop()}</span>
                          {sr.symbol_kind && (
                            <span className="text-[8px] uppercase px-1 rounded bg-muted text-cyan-400 font-mono">{sr.symbol_kind}</span>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">{sr.file_path}:{sr.line_number}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Column 2: Source Code Viewer with Blame Gutter (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-border text-xs">
                  <div className="truncate font-mono text-foreground font-bold">
                    📄 {selectedSourceFile}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono shrink-0">
                    <span>{sourceFileData?.language || 'code'}</span>
                    <span>•</span>
                    <span>{sourceFileData?.total_lines || 0} lines</span>
                    <span>•</span>
                    <span>{((sourceFileData?.size_bytes || 0) / 1024).toFixed(1)} KB</span>
                  </div>
                </div>

                {/* Code Window with Blame Gutter */}
                {isSourceFileLoading ? (
                  <div className="py-24 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                    <RotateCw className="h-4 w-4 animate-spin text-cyan-400" />
                    Reading source file and git blame...
                  </div>
                ) : sourceFileData ? (
                  <div className="rounded-lg border border-border bg-black/80 font-mono text-xs overflow-x-auto max-h-[600px] overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                      <tbody>
                        {sourceFileData.content.split('\n').map((line, idx) => {
                          const lineNo = idx + 1;
                          const blameItem = sourceFileData.blame.find((b) => b.line_number === lineNo);
                          const lineSymbols = sourceFileData.symbols.filter((s) => s.line_number === lineNo);

                          return (
                            <tr key={lineNo} className="hover:bg-muted/20 transition-colors group">
                              {/* Line Number */}
                              <td className="w-10 select-none px-2 py-0.5 text-right text-[10px] text-muted-foreground/60 border-r border-border/40 font-mono">
                                {lineNo}
                              </td>

                              {/* Git Blame Gutter */}
                              {showBlame && (
                                <td className="w-40 select-none px-2 py-0.5 text-[9px] text-muted-foreground border-r border-border/40 font-mono whitespace-nowrap overflow-hidden text-ellipsis max-w-[130px]">
                                  {blameItem ? (
                                    <span title={`${blameItem.commit_sha} - ${blameItem.author}: ${blameItem.summary}`}>
                                      <span className="text-cyan-400 font-bold">{blameItem.commit_sha.slice(0, 6)}</span>{' '}
                                      <span className="text-zinc-400">{blameItem.author.split(' ')[0]}</span>{' '}
                                      <span className="text-zinc-500">{blameItem.date}</span>
                                    </span>
                                  ) : (
                                    <span className="text-zinc-600">uncommitted</span>
                                  )}
                                </td>
                              )}

                              {/* Source Code Line Content */}
                              <td className="px-3 py-0.5 text-foreground whitespace-pre text-[11px]">
                                <span>{line}</span>
                                {lineSymbols.map((sym) => (
                                  <button
                                    key={sym.id}
                                    type="button"
                                    onClick={() => setSelectedSourceSymbol(sym.name)}
                                    className="ml-2 inline-flex items-center px-1.5 py-0.2 rounded text-[8px] uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30 transition-all font-mono"
                                  >
                                    ◈ {sym.name} ({sym.kind})
                                  </button>
                                ))}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-24 text-center text-xs text-muted-foreground">
                    Select a source file to view code and AST symbols.
                  </div>
                )}
              </div>
            </div>

            {/* Column 3: Code Intelligence & Blast Radius Inspector (4 cols) */}
            <div className="lg:col-span-4 space-y-4">
              {/* Definition Card */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Target className="h-4 w-4 text-cyan-400" />
                    Symbol Definition
                  </span>
                  {symbolDefinition && (
                    <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-muted text-cyan-400 font-mono font-bold">
                      {symbolDefinition.symbol_kind}
                    </span>
                  )}
                </div>

                {isDefinitionLoading ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    Resolving symbol declaration...
                  </div>
                ) : symbolDefinition ? (
                  <div className="space-y-2 text-xs">
                    <div className="text-sm font-bold text-foreground truncate font-mono">
                      {symbolDefinition.symbol_name}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono">
                      📍 {symbolDefinition.file_path}:{symbolDefinition.line_number}
                    </div>

                    {symbolDefinition.signature && (
                      <div className="p-2 rounded bg-background border border-border text-[10px] font-mono text-emerald-300 truncate">
                        {symbolDefinition.signature}
                      </div>
                    )}

                    {symbolDefinition.surrounding_code && (
                      <div className="space-y-1">
                        <span className="text-[9px] uppercase font-bold text-muted-foreground">Declaration Snippet:</span>
                        <pre className="p-2.5 rounded bg-black/60 border border-border/40 text-[10px] text-zinc-300 font-mono overflow-x-auto max-h-36 whitespace-pre-wrap">
                          {symbolDefinition.surrounding_code}
                        </pre>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    Select a symbol to inspect its definition and callers.
                  </div>
                )}
              </div>

              {/* References & Call Sites */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <span>References ({symbolReferences?.total_references || 0})</span>
                  <span className="text-[10px] text-emerald-400 font-mono">Cross-File</span>
                </div>

                {isReferencesLoading ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    Tracing caller sites across monorepo...
                  </div>
                ) : symbolReferences && symbolReferences.references.length > 0 ? (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {symbolReferences.references.map((ref, idx) => (
                      <div
                        key={idx}
                        onClick={() => setSelectedSourceFile(ref.file_path)}
                        className="p-2 rounded-lg border border-border/50 bg-background/50 hover:bg-secondary/40 cursor-pointer text-xs space-y-0.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground text-[11px] truncate font-mono">
                            {ref.caller_symbol}
                          </span>
                          <span className="text-[8px] uppercase px-1 rounded bg-muted text-cyan-300 font-mono">
                            {ref.relation}
                          </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono truncate">
                          {ref.file_path}:{ref.line_number}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    No references found for selected symbol.
                  </div>
                )}
              </div>

              {/* Blast Radius & Transitive Impact Analysis */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <ShieldAlert className="h-4 w-4 text-amber-400" />
                    Blast Radius & Impact Radar
                  </span>
                  {blastRadiusData && (
                    <span
                      className={`text-[9px] uppercase px-2 py-0.5 rounded-full font-mono font-bold ${
                        blastRadiusData.risk_level === 'CRITICAL'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : blastRadiusData.risk_level === 'HIGH'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : blastRadiusData.risk_level === 'MEDIUM'
                          ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {blastRadiusData.risk_level} ({blastRadiusData.risk_score})
                    </span>
                  )}
                </div>

                {isBlastRadiusLoading ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    Computing transitive dependency impact...
                  </div>
                ) : blastRadiusData ? (
                  <div className="space-y-3 text-xs">
                    {/* Impact Metrics Grid */}
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="p-2 rounded bg-background/60 border border-border/50">
                        <span className="text-muted-foreground block">Impacted Files:</span>
                        <span className="text-foreground font-bold font-mono">{blastRadiusData.total_impacted_files} files</span>
                      </div>
                      <div className="p-2 rounded bg-background/60 border border-border/50">
                        <span className="text-muted-foreground block">Downstream Dependents:</span>
                        <span className="text-cyan-400 font-bold font-mono">
                          {blastRadiusData.direct_dependents.length + blastRadiusData.transitive_dependents.length}
                        </span>
                      </div>
                    </div>

                    {/* Impacted Endpoints */}
                    {blastRadiusData.impacted_endpoints.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[9px] uppercase font-bold text-amber-400">
                          Impacted Endpoints ({blastRadiusData.impacted_endpoints.length}):
                        </span>
                        <div className="space-y-1 max-h-24 overflow-y-auto">
                          {blastRadiusData.impacted_endpoints.map((ep, i) => (
                            <div key={i} className="p-1 rounded bg-amber-500/10 border border-amber-500/20 text-[10px] font-mono text-amber-300 truncate">
                              ⚡ {ep.signature || ep.name}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Impacted Unit Tests */}
                    {blastRadiusData.impacted_tests.length > 0 && (
                      <div className="space-y-1 pt-1 border-t border-border/40">
                        <span className="text-[9px] uppercase font-bold text-emerald-400">
                          Impacted Test Suites ({blastRadiusData.impacted_tests.length}):
                        </span>
                        <div className="space-y-1 max-h-24 overflow-y-auto">
                          {blastRadiusData.impacted_tests.map((testPath, i) => (
                            <div key={i} className="text-[10px] font-mono text-muted-foreground truncate">
                              🧪 {testPath.split('/').pop()}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    Select a target to compute change blast radius.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: MEMGPT HIERARCHICAL VIRTUAL CONTEXT */}
      {activeTab === 'memgpt' && (
        <div className="space-y-6 animate-fade-in font-mono">
          {/* Agent Picker Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl border border-border bg-card/80 backdrop-blur-md">
            <div>
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-cyan-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                  MemGPT Virtual Context Controller
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-semibold">
                  OS Tiered Memory
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 font-sans">
                Treats LLM context windows as volatile RAM. Core Memory (Persona & User blocks) remain actively in-prompt and self-editable; older conversations page out via FIFO eviction into Archival Storage.
              </p>
            </div>

            {/* Agent Selector Dropdown */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted-foreground uppercase font-semibold">Agent:</span>
              <select
                value={selectedAgentIdForMemGPT}
                onChange={(e) => setMemgptAgentId(e.target.value)}
                className="select select-bordered text-xs bg-background border-border rounded-xl px-3 py-1.5 focus:outline-none focus:border-cyan-400 font-mono"
              >
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.autonomy || 'Autonomous'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 3-Tier Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Tier 1: Core Memory */}
            <div className="p-4 rounded-xl border border-cyan-500/30 bg-cyan-500/5 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-cyan-400">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  TIER 1 // CORE MEMORY (RAM)
                </span>
                <span>{coreBlocks.length} Blocks</span>
              </div>
              <p className="text-[11px] text-muted-foreground font-sans">
                In-prompt working memory. Editable directly by agent tool calls (`core_memory_append`, `core_memory_replace`).
              </p>
              <div className="text-[10px] text-cyan-300 font-mono pt-1">
                Active Tokens: ~{memgptContext?.total_active_tokens ?? 0}
              </div>
            </div>

            {/* Tier 2: Recall Memory */}
            <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-amber-400">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  TIER 2 // RECALL MEMORY (FIFO)
                </span>
                <span>{memgptContext?.fifo_messages?.length ?? 0}/10 In-Prompt</span>
              </div>
              <p className="text-[11px] text-muted-foreground font-sans">
                Active conversation message buffer. Automatically evicts older items into Archival Memory when token capacity is reached.
              </p>
              <div className="text-[10px] text-amber-300 font-mono pt-1">
                Queue Status: Active Nominal
              </div>
            </div>

            {/* Tier 3: Archival Memory */}
            <div className="p-4 rounded-xl border border-purple-500/30 bg-purple-500/5 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-purple-400">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
                  TIER 3 // ARCHIVAL (DISK)
                </span>
                <span>{memgptContext?.archived_memories_count ?? 0} Items</span>
              </div>
              <p className="text-[11px] text-muted-foreground font-sans">
                Long-term vector and semantic disk storage. Queried on-demand when agent requires historical context.
              </p>
              <div className="text-[10px] text-purple-300 font-mono pt-1">
                Persistence: Permanent Scoped
              </div>
            </div>
          </div>

          {/* Interactive Core Memory Editor & FIFO Stream Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column: Core Memory Blocks (Persona, Human, Scratchpad) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  <Sliders className="h-3.5 w-3.5 text-cyan-400" />
                  Core Memory Blocks (RAM)
                </h4>
                <span className="text-[10px] text-muted-foreground">Prompt Injected</span>
              </div>

              {coreBlocks.map((block) => (
                <div key={block.id} className="p-4 rounded-xl border border-border bg-card/60 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground uppercase tracking-wider font-mono">
                      [{block.block_name.toUpperCase()}] // {block.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {block.content.length}/{block.char_limit} chars
                    </span>
                  </div>

                  <p className="text-xs text-foreground/90 font-mono bg-background/80 p-2.5 rounded-lg border border-border/50 whitespace-pre-wrap leading-relaxed">
                    {block.content || '<empty block>'}
                  </p>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingBlockName(block.block_name);
                        setEditingBlockContent(block.content);
                      }}
                      className="text-[10px] px-2.5 py-1 rounded bg-secondary hover:bg-secondary/80 text-foreground border border-border transition-colors"
                    >
                      Edit Block
                    </button>
                  </div>
                </div>
              ))}

              {/* Edit Block Inline Card */}
              {editingBlockContent !== '' && (
                <div className="p-4 rounded-xl border border-cyan-500/40 bg-card space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-cyan-400">
                    <span>EDITING [{editingBlockName.toUpperCase()}] BLOCK</span>
                    <button
                      type="button"
                      onClick={() => setEditingBlockContent('')}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      Cancel
                    </button>
                  </div>

                  <textarea
                    rows={4}
                    value={editingBlockContent}
                    onChange={(e) => setEditingBlockContent(e.target.value)}
                    className="w-full text-xs font-mono bg-background border border-border rounded-lg p-2.5 text-foreground focus:outline-none focus:border-cyan-400"
                  />

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      disabled={updateCoreBlockMutation.isPending}
                      onClick={() =>
                        updateCoreBlockMutation.mutate({
                          blockName: editingBlockName,
                          content: editingBlockContent,
                          mode: 'append',
                        })
                      }
                      className="text-[11px] px-3 py-1.5 rounded-lg bg-secondary text-foreground hover:bg-secondary/80 border border-border font-semibold transition-colors disabled:opacity-50"
                    >
                      Append (+Newline)
                    </button>
                    <button
                      type="button"
                      disabled={updateCoreBlockMutation.isPending}
                      onClick={() =>
                        updateCoreBlockMutation.mutate({
                          blockName: editingBlockName,
                          content: editingBlockContent,
                          mode: 'replace',
                        })
                      }
                      className="text-[11px] px-3 py-1.5 rounded-lg bg-cyan-500 text-black hover:bg-cyan-400 font-bold transition-colors disabled:opacity-50"
                    >
                      Replace Core Memory
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Recall FIFO Stream & Interactive Test */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  <History className="h-3.5 w-3.5 text-amber-400" />
                  Recall Memory FIFO Buffer (Active Stream)
                </h4>
                <span className="text-[10px] text-amber-400 font-semibold">Evicts after 10 msgs</span>
              </div>

              {/* FIFO Messages Stream */}
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                {memgptContext?.fifo_messages && memgptContext.fifo_messages.length > 0 ? (
                  memgptContext.fifo_messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-lg border text-xs ${
                        msg.role === 'user'
                          ? 'border-border/60 bg-secondary/30'
                          : 'border-cyan-500/20 bg-cyan-500/5'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                        <span className="font-bold uppercase tracking-wider">{msg.role}</span>
                        <span>~{msg.tokens} tokens</span>
                      </div>
                      <p className="text-foreground/90 font-mono text-[11px]">{msg.content}</p>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-xs text-muted-foreground italic border border-dashed border-border rounded-xl">
                    FIFO message buffer is empty. Send a test message below to simulate active execution.
                  </div>
                )}
              </div>

              {/* Append Test Message Input */}
              <div className="p-3.5 rounded-xl border border-border bg-card/60 space-y-2.5">
                <span className="text-[11px] font-bold text-foreground uppercase tracking-wider block">
                  Simulate Message Ingestion (FIFO Queue Test)
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Enter observation or user message..."
                    value={newRecallMessage}
                    onChange={(e) => setNewRecallMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newRecallMessage.trim()) {
                        appendRecallMutation.mutate({ role: 'user', message: newRecallMessage.trim() });
                      }
                    }}
                    className="flex-1 text-xs bg-background border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:border-amber-400 font-mono"
                  />
                  <button
                    type="button"
                    disabled={appendRecallMutation.isPending || !newRecallMessage.trim()}
                    onClick={() =>
                      appendRecallMutation.mutate({ role: 'user', message: newRecallMessage.trim() })
                    }
                    className="text-xs px-3 py-1.5 rounded-lg bg-amber-500 text-black hover:bg-amber-400 font-bold transition-colors disabled:opacity-50"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: SOURCE GRAPH & CODE INTELLIGENCE */}
      {activeTab === 'source_graph' && (
        <div className="space-y-6 animate-fade-in font-mono">
          {/* Header Action Bar with Sourcegraph Query Search */}
          <div className="p-5 rounded-2xl border border-border bg-card/80 backdrop-blur-md space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <GitFork className="h-5 w-5 text-cyan-400" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                    Source Graph & Monorepo Code Intelligence
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground mt-1 font-sans">
                  Cross-file definition resolution, caller references, git blame gutter, and transitive blast radius impact analysis.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowBlame(!showBlame)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    showBlame
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {showBlame ? '✓ Git Blame Active' : 'Toggle Git Blame'}
                </button>
              </div>
            </div>

            {/* Sourcegraph Query Bar */}
            <div className="space-y-2 pt-1">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Query syntax: lang:python type:class file:compression TokenCompressor"
                  value={sourceGraphQuery}
                  onChange={(e) => setSourceGraphQuery(e.target.value)}
                  className="w-full pl-10 pr-24 py-2.5 rounded-xl border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-cyan-500 font-mono transition-all"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-mono">
                  {isSourceSearching ? 'Searching...' : `${sourceSearchResults?.total_matches || 0} matches`}
                </div>
              </div>

              {/* Quick Filter Chips */}
              <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                <span className="text-muted-foreground font-semibold">Filter Chips:</span>
                {[
                  { label: 'lang:python', query: 'lang:python ' },
                  { label: 'lang:typescript', query: 'lang:typescript ' },
                  { label: 'type:class', query: 'type:class ' },
                  { label: 'type:endpoint', query: 'type:endpoint ' },
                  { label: 'file:apps/api', query: 'file:apps/api ' },
                  { label: 'file:apps/web', query: 'file:apps/web ' },
                ].map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => setSourceGraphQuery((prev) => (prev.includes(chip.label) ? prev : `${chip.query}${prev}`))}
                    className="px-2 py-0.5 rounded bg-muted/60 text-muted-foreground hover:text-foreground border border-border/40 transition-all font-mono"
                  >
                    +{chip.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 3-Column Source Graph Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Column 1: Monorepo Files & Search Matches (3 cols) */}
            <div className="lg:col-span-3 space-y-4">
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <span>Monorepo Files</span>
                  <span className="text-[10px] text-cyan-400 font-mono">Indexed</span>
                </div>

                <div className="space-y-1 max-h-[500px] overflow-y-auto pr-1">
                  {[
                    'apps/api/nexora/core/compression.py',
                    'apps/api/nexora/domains/memory/source_graph.py',
                    'apps/api/nexora/domains/memory/code_graph.py',
                    'apps/api/nexora/domains/memory/router.py',
                    'apps/api/nexora/domains/agents/execution.py',
                    'apps/web/src/lib/api/sourceGraph.ts',
                    'apps/web/src/app/dashboard/memory/page.tsx',
                    'apps/tui-rs/src/features/engineering/ui.rs',
                    'apps/tui-rs/src/client.rs',
                  ].map((fp) => (
                    <div
                      key={fp}
                      onClick={() => setSelectedSourceFile(fp)}
                      className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                        selectedSourceFile === fp
                          ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300 font-bold'
                          : 'border-border/60 bg-background/60 text-muted-foreground hover:bg-secondary/40 hover:text-foreground'
                      }`}
                    >
                      <div className="truncate font-mono">{fp.split('/').pop()}</div>
                      <div className="text-[10px] text-muted-foreground truncate mt-0.5">{fp}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Matched Search Results */}
              {sourceSearchResults && sourceSearchResults.results.length > 0 && (
                <div className="p-4 rounded-xl border border-border bg-card space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                    <span>Query Hits ({sourceSearchResults.total_matches})</span>
                    <span className="text-[10px] text-emerald-400 font-mono">{sourceSearchResults.duration_ms}ms</span>
                  </div>
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {sourceSearchResults.results.slice(0, 8).map((sr, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          setSelectedSourceFile(sr.file_path);
                          if (sr.symbol_name) setSelectedSourceSymbol(sr.symbol_name);
                        }}
                        className="p-2 rounded-lg border border-border/50 bg-background/50 hover:bg-secondary/40 cursor-pointer text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground truncate">{sr.symbol_name || sr.file_path.split('/').pop()}</span>
                          {sr.symbol_kind && (
                            <span className="text-[8px] uppercase px-1 rounded bg-muted text-cyan-400 font-mono">{sr.symbol_kind}</span>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">{sr.file_path}:{sr.line_number}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Column 2: Source Code Viewer with Blame Gutter (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-border text-xs">
                  <div className="truncate font-mono text-foreground font-bold">
                    📄 {selectedSourceFile}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono shrink-0">
                    <span>{sourceFileData?.language || 'code'}</span>
                    <span>•</span>
                    <span>{sourceFileData?.total_lines || 0} lines</span>
                    <span>•</span>
                    <span>{((sourceFileData?.size_bytes || 0) / 1024).toFixed(1)} KB</span>
                  </div>
                </div>

                {/* Code Window with Blame Gutter */}
                {isSourceFileLoading ? (
                  <div className="py-24 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                    <RotateCw className="h-4 w-4 animate-spin text-cyan-400" />
                    Reading source file and git blame...
                  </div>
                ) : sourceFileData ? (
                  <div className="rounded-lg border border-border bg-black/80 font-mono text-xs overflow-x-auto max-h-[600px] overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                      <tbody>
                        {sourceFileData.content.split('\n').map((line, idx) => {
                          const lineNo = idx + 1;
                          const blameItem = sourceFileData.blame.find((b) => b.line_number === lineNo);
                          const lineSymbols = sourceFileData.symbols.filter((s) => s.line_number === lineNo);

                          return (
                            <tr key={lineNo} className="hover:bg-muted/20 transition-colors group">
                              {/* Line Number */}
                              <td className="w-10 select-none px-2 py-0.5 text-right text-[10px] text-muted-foreground/60 border-r border-border/40 font-mono">
                                {lineNo}
                              </td>

                              {/* Git Blame Gutter */}
                              {showBlame && (
                                <td className="w-40 select-none px-2 py-0.5 text-[9px] text-muted-foreground border-r border-border/40 font-mono whitespace-nowrap overflow-hidden text-ellipsis max-w-[130px]">
                                  {blameItem ? (
                                    <span title={`${blameItem.commit_sha} - ${blameItem.author}: ${blameItem.summary}`}>
                                      <span className="text-cyan-400 font-bold">{blameItem.commit_sha.slice(0, 6)}</span>{' '}
                                      <span className="text-zinc-400">{blameItem.author.split(' ')[0]}</span>{' '}
                                      <span className="text-zinc-500">{blameItem.date}</span>
                                    </span>
                                  ) : (
                                    <span className="text-zinc-600">uncommitted</span>
                                  )}
                                </td>
                              )}

                              {/* Source Code Line Content */}
                              <td className="px-3 py-0.5 text-foreground whitespace-pre text-[11px]">
                                <span>{line}</span>
                                {lineSymbols.map((sym) => (
                                  <button
                                    key={sym.id}
                                    type="button"
                                    onClick={() => setSelectedSourceSymbol(sym.name)}
                                    className="ml-2 inline-flex items-center px-1.5 py-0.2 rounded text-[8px] uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30 transition-all font-mono"
                                  >
                                    ◈ {sym.name} ({sym.kind})
                                  </button>
                                ))}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-24 text-center text-xs text-muted-foreground">
                    Select a source file to view code and AST symbols.
                  </div>
                )}
              </div>
            </div>

            {/* Column 3: Code Intelligence & Blast Radius Inspector (4 cols) */}
            <div className="lg:col-span-4 space-y-4">
              {/* Definition Card */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Target className="h-4 w-4 text-cyan-400" />
                    Symbol Definition
                  </span>
                  {symbolDefinition && (
                    <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-muted text-cyan-400 font-mono font-bold">
                      {symbolDefinition.symbol_kind}
                    </span>
                  )}
                </div>

                {isDefinitionLoading ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    Resolving symbol declaration...
                  </div>
                ) : symbolDefinition ? (
                  <div className="space-y-2 text-xs">
                    <div className="text-sm font-bold text-foreground truncate font-mono">
                      {symbolDefinition.symbol_name}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono">
                      📍 {symbolDefinition.file_path}:{symbolDefinition.line_number}
                    </div>

                    {symbolDefinition.signature && (
                      <div className="p-2 rounded bg-background border border-border text-[10px] font-mono text-emerald-300 truncate">
                        {symbolDefinition.signature}
                      </div>
                    )}

                    {symbolDefinition.surrounding_code && (
                      <div className="space-y-1">
                        <span className="text-[9px] uppercase font-bold text-muted-foreground">Declaration Snippet:</span>
                        <pre className="p-2.5 rounded bg-black/60 border border-border/40 text-[10px] text-zinc-300 font-mono overflow-x-auto max-h-36 whitespace-pre-wrap">
                          {symbolDefinition.surrounding_code}
                        </pre>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    Select a symbol to inspect its definition and callers.
                  </div>
                )}
              </div>

              {/* References & Call Sites */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <span>References ({symbolReferences?.total_references || 0})</span>
                  <span className="text-[10px] text-emerald-400 font-mono">Cross-File</span>
                </div>

                {isReferencesLoading ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    Tracing caller sites across monorepo...
                  </div>
                ) : symbolReferences && symbolReferences.references.length > 0 ? (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {symbolReferences.references.map((ref, idx) => (
                      <div
                        key={idx}
                        onClick={() => setSelectedSourceFile(ref.file_path)}
                        className="p-2 rounded-lg border border-border/50 bg-background/50 hover:bg-secondary/40 cursor-pointer text-xs space-y-0.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground text-[11px] truncate font-mono">
                            {ref.caller_symbol}
                          </span>
                          <span className="text-[8px] uppercase px-1 rounded bg-muted text-cyan-300 font-mono">
                            {ref.relation}
                          </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono truncate">
                          {ref.file_path}:{ref.line_number}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    No references found for selected symbol.
                  </div>
                )}
              </div>

              {/* Blast Radius & Transitive Impact Analysis */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <ShieldAlert className="h-4 w-4 text-amber-400" />
                    Blast Radius & Impact Radar
                  </span>
                  {blastRadiusData && (
                    <span
                      className={`text-[9px] uppercase px-2 py-0.5 rounded-full font-mono font-bold ${
                        blastRadiusData.risk_level === 'CRITICAL'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : blastRadiusData.risk_level === 'HIGH'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : blastRadiusData.risk_level === 'MEDIUM'
                          ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {blastRadiusData.risk_level} ({blastRadiusData.risk_score})
                    </span>
                  )}
                </div>

                {isBlastRadiusLoading ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    Computing transitive dependency impact...
                  </div>
                ) : blastRadiusData ? (
                  <div className="space-y-3 text-xs">
                    {/* Impact Metrics Grid */}
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="p-2 rounded bg-background/60 border border-border/50">
                        <span className="text-muted-foreground block">Impacted Files:</span>
                        <span className="text-foreground font-bold font-mono">{blastRadiusData.total_impacted_files} files</span>
                      </div>
                      <div className="p-2 rounded bg-background/60 border border-border/50">
                        <span className="text-muted-foreground block">Downstream Dependents:</span>
                        <span className="text-cyan-400 font-bold font-mono">
                          {blastRadiusData.direct_dependents.length + blastRadiusData.transitive_dependents.length}
                        </span>
                      </div>
                    </div>

                    {/* Impacted Endpoints */}
                    {blastRadiusData.impacted_endpoints.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[9px] uppercase font-bold text-amber-400">
                          Impacted Endpoints ({blastRadiusData.impacted_endpoints.length}):
                        </span>
                        <div className="space-y-1 max-h-24 overflow-y-auto">
                          {blastRadiusData.impacted_endpoints.map((ep, i) => (
                            <div key={i} className="p-1 rounded bg-amber-500/10 border border-amber-500/20 text-[10px] font-mono text-amber-300 truncate">
                              ⚡ {ep.signature || ep.name}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Impacted Unit Tests */}
                    {blastRadiusData.impacted_tests.length > 0 && (
                      <div className="space-y-1 pt-1 border-t border-border/40">
                        <span className="text-[9px] uppercase font-bold text-emerald-400">
                          Impacted Test Suites ({blastRadiusData.impacted_tests.length}):
                        </span>
                        <div className="space-y-1 max-h-24 overflow-y-auto">
                          {blastRadiusData.impacted_tests.map((testPath, i) => (
                            <div key={i} className="text-[10px] font-mono text-muted-foreground truncate">
                              🧪 {testPath.split('/').pop()}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    Select a target to compute change blast radius.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: GRAPHIFY & OBSIDIAN VAULT */}
      {activeTab === 'graphify' && (
        <div className="space-y-6">
          {/* Header Controls & Summary Cards */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl border border-purple-500/20 bg-gradient-to-r from-purple-950/20 via-card to-card">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/30">
                <Network className="h-3.5 w-3.5" />
                Graphify Topology Engine
              </div>
              <h2 className="text-lg font-bold text-foreground">
                Bidirectional Knowledge Graph & Obsidian Markdown Vault
              </h2>
              <p className="text-xs text-muted-foreground">
                All organizational memories, ADR decisions, agents, workflows, and policies mapped with standard <code className="text-purple-300">[[wikilinks]]</code> and high-degree hub indexing.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  if (graphifyData?.vault_markdown_export) {
                    navigator.clipboard.writeText(graphifyData.vault_markdown_export);
                    setCopiedVault(true);
                    setTimeout(() => setCopiedVault(false), 2500);
                  }
                }}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-purple-600 text-white hover:bg-purple-500 transition-colors shadow-sm"
              >
                {copiedVault ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-green-300" />
                    Copied Vault Markdown!
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copy Obsidian Vault (.md)
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => refetchGraphify()}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border border-border bg-card/60 text-foreground hover:border-purple-400/40 transition-colors"
              >
                <RotateCw className="h-3.5 w-3.5" /> Recompute Graph
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border border-border bg-card/60">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Total Nodes</span>
              <p className="text-xl font-bold font-mono text-purple-400 mt-1">
                {graphifyData?.nodes?.length || 0}
              </p>
            </div>
            <div className="p-4 rounded-xl border border-border bg-card/60">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Bidirectional Edges</span>
              <p className="text-xl font-bold font-mono text-cyan-400 mt-1">
                {graphifyData?.edges?.length || 0}
              </p>
            </div>
            <div className="p-4 rounded-xl border border-border bg-card/60">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Central Concepts</span>
              <p className="text-xl font-bold font-mono text-amber-400 mt-1">
                {graphifyData?.central_concepts?.length || 0}
              </p>
            </div>
            <div className="p-4 rounded-xl border border-border bg-card/60">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Vault Format</span>
              <p className="text-xl font-bold font-mono text-emerald-400 mt-1">
                Obsidian [[Wiki]]
              </p>
            </div>
          </div>

          {isGraphifyLoading ? (
            <div className="p-12 text-center border border-dashed border-border rounded-2xl">
              <RotateCw className="h-6 w-6 animate-spin mx-auto text-purple-400 mb-2" />
              <p className="text-sm text-muted-foreground">Synthesizing network topology and extracting cross-domain wikilinks...</p>
            </div>
          ) : !graphifyData || graphifyData.nodes.length === 0 ? (
            <div className="p-12 text-center border border-dashed border-border rounded-2xl">
              <Network className="h-8 w-8 mx-auto text-muted-foreground mb-3 opacity-60" />
              <p className="text-sm font-semibold text-foreground">No Knowledge Nodes Found</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Ingest memories, agents, workflows, or decision records to construct your live Obsidian-compatible graph.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Interactive Graph View (Left 2 cols) */}
              <div className="lg:col-span-2 space-y-4">
                <div className="p-4 rounded-2xl border border-border bg-card/40 flex flex-col">
                  <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
                    <div className="flex items-center gap-2">
                      <Share2 className="h-4 w-4 text-purple-400" />
                      <span className="text-xs font-semibold text-foreground">Interactive Network Canvas</span>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      Click any node to inspect [[wikilinks]] & degree
                    </span>
                  </div>

                  {/* SVG Node Graph */}
                  <div className="relative w-full h-[460px] rounded-xl bg-background/80 border border-border/80 overflow-hidden flex items-center justify-center">
                    <svg className="w-full h-full select-none" viewBox="0 0 800 500">
                      <defs>
                        <linearGradient id="edgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#a855f7" stopOpacity="0.4" />
                          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.4" />
                        </linearGradient>
                      </defs>

                      {/* Render Edges */}
                      {graphifyData.edges.map((edge, idx) => {
                        const total = graphifyData.nodes.length;
                        const srcIdx = graphifyData.nodes.findIndex((n) => n.id === edge.source);
                        const tgtIdx = graphifyData.nodes.findIndex((n) => n.id === edge.target);
                        if (srcIdx === -1 || tgtIdx === -1) return null;

                        const cx = 400;
                        const cy = 250;
                        const rx = 320;
                        const ry = 190;

                        const srcAngle = (srcIdx / total) * 2 * Math.PI - Math.PI / 2;
                        const tgtAngle = (tgtIdx / total) * 2 * Math.PI - Math.PI / 2;

                        const x1 = cx + rx * Math.cos(srcAngle);
                        const y1 = cy + ry * Math.sin(srcAngle);
                        const x2 = cx + rx * Math.cos(tgtAngle);
                        const y2 = cy + ry * Math.sin(tgtAngle);

                        const isHighlighted =
                          selectedGraphNode === edge.source || selectedGraphNode === edge.target;

                        return (
                          <line
                            key={`edge-${idx}`}
                            x1={x1}
                            y1={y1}
                            x2={x2}
                            y2={y2}
                            stroke={isHighlighted ? '#c084fc' : 'url(#edgeGrad)'}
                            strokeWidth={isHighlighted ? 2.5 : Math.max(1, edge.weight * 1.5)}
                            strokeDasharray={edge.relation === 'domain_cluster' ? '3,3' : undefined}
                            className="transition-all duration-300"
                          />
                        );
                      })}

                      {/* Render Nodes */}
                      {graphifyData.nodes.map((node, idx) => {
                        const total = graphifyData.nodes.length;
                        const cx = 400;
                        const cy = 250;
                        const rx = 320;
                        const ry = 190;
                        const angle = (idx / total) * 2 * Math.PI - Math.PI / 2;
                        const x = cx + rx * Math.cos(angle);
                        const y = cy + ry * Math.sin(angle);

                        const isSelected = selectedGraphNode === node.id;
                        const isHub = graphifyData.central_concepts.includes(node.name);

                        let nodeColor = '#a855f7'; // Purple default
                        if (node.type === 'decision') nodeColor = '#3b82f6'; // Blue
                        if (node.type === 'agent') nodeColor = '#10b981'; // Green
                        if (node.type === 'workflow') nodeColor = '#f59e0b'; // Amber
                        if (node.type === 'policy') nodeColor = '#ef4444'; // Red

                        const nodeRadius = Math.min(22, Math.max(10, 8 + node.degree * 2.5));

                        return (
                          <g
                            key={node.id}
                            className="cursor-pointer group"
                            onClick={() => setSelectedGraphNode(node.id === selectedGraphNode ? null : node.id)}
                          >
                            {isSelected && (
                              <circle
                                cx={x}
                                cy={y}
                                r={nodeRadius + 6}
                                fill="none"
                                stroke="#c084fc"
                                strokeWidth="2"
                                strokeDasharray="4,2"
                                className="animate-spin-slow"
                              />
                            )}
                            <circle
                              cx={x}
                              cy={y}
                              r={nodeRadius}
                              fill={nodeColor}
                              fillOpacity={isSelected ? 1 : 0.85}
                              stroke={isHub ? '#fde047' : '#ffffff'}
                              strokeWidth={isHub ? 2.5 : 1}
                              className="transition-all duration-200 group-hover:scale-110"
                            />
                            <text
                              x={x}
                              y={y + nodeRadius + 12}
                              textAnchor="middle"
                              fill={isSelected ? '#ffffff' : '#94a3b8'}
                              fontSize="9"
                              fontWeight={isSelected ? 'bold' : 'normal'}
                              fontFamily="monospace"
                              className="pointer-events-none select-none"
                            >
                              {node.name.length > 14 ? `${node.name.slice(0, 12)}...` : node.name}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>

                  {/* Hub Concept Tags */}
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-semibold text-muted-foreground">Central Concepts:</span>
                    {graphifyData.central_concepts.map((hub) => (
                      <span
                        key={hub}
                        className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30"
                      >
                        [[{hub}]]
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Node Inspector & Obsidian Vault Preview (Right col) */}
              <div className="space-y-4">
                {/* Node Inspector */}
                <div className="p-4 rounded-2xl border border-border bg-card/40">
                  <h3 className="text-xs font-semibold text-foreground flex items-center gap-2 mb-3">
                    <Info className="h-4 w-4 text-purple-400" />
                    Node Inspector
                  </h3>

                  {selectedGraphNode ? (
                    (() => {
                      const activeNode = graphifyData.nodes.find((n) => n.id === selectedGraphNode);
                      if (!activeNode) return null;
                      const connectedEdges = graphifyData.edges.filter(
                        (e) => e.source === activeNode.id || e.target === activeNode.id
                      );

                      return (
                        <div className="space-y-3">
                          <div>
                            <span className="text-[10px] font-mono text-muted-foreground uppercase">Title / Name</span>
                            <p className="text-sm font-bold text-foreground mt-0.5">
                              [[{activeNode.name}]]
                            </p>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="p-2 rounded-lg bg-background/60 border border-border">
                              <span className="text-[10px] text-muted-foreground uppercase font-mono">Type</span>
                              <p className="font-semibold text-foreground mt-0.5 capitalize">{activeNode.type.toLowerCase()}</p>
                            </div>
                            <div className="p-2 rounded-lg bg-background/60 border border-border">
                              <span className="text-[10px] text-muted-foreground uppercase font-mono">Degree</span>
                              <p className="font-semibold text-purple-400 mt-0.5">{activeNode.degree} Connections</p>
                            </div>
                          </div>

                          {/* Connected Wikilinks */}
                          <div>
                            <span className="text-[10px] font-mono text-muted-foreground uppercase">
                              Bidirectional Links ({connectedEdges.length})
                            </span>
                            <div className="mt-1.5 space-y-1.5 max-h-40 overflow-y-auto pr-1">
                              {connectedEdges.map((e, idx) => {
                                const targetId = e.source === activeNode.id ? e.target : e.source;
                                const targetNode = graphifyData.nodes.find((n) => n.id === targetId);
                                return (
                                  <div
                                    key={`conn-${idx}`}
                                    onClick={() => setSelectedGraphNode(targetId)}
                                    className="p-1.5 rounded-lg border border-border bg-background/50 hover:border-purple-400/50 cursor-pointer flex items-center justify-between text-xs"
                                  >
                                    <span className="font-mono text-purple-300 truncate">
                                      [[{targetNode?.name || targetId}]]
                                    </span>
                                    <span className="text-[9px] uppercase px-1 rounded bg-muted text-muted-foreground font-mono">
                                      {e.relation}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="p-6 text-center text-xs text-muted-foreground">
                      Select any node in the canvas to inspect its bidirectional connections and wikilink hierarchy.
                    </div>
                  )}
                </div>

                {/* Obsidian Vault Instructions & Raw Export */}
                <div className="p-4 rounded-2xl border border-border bg-card/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <BookOpen className="h-4 w-4 text-purple-400" />
                      Obsidian Vault Export
                    </h3>
                    <span className="text-[10px] font-mono text-muted-foreground">Markdown</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Paste this directly into an Obsidian vault note or folder. Obsidian will automatically map the <code className="text-purple-300">[[wikilinks]]</code> in native Graph View.
                  </p>
                  <pre className="p-2.5 rounded-xl bg-background/90 border border-border text-[10px] font-mono text-muted-foreground max-h-48 overflow-y-auto overflow-x-hidden whitespace-pre-wrap">
                    {graphifyData.vault_markdown_export}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: SOURCE GRAPH & CODE INTELLIGENCE */}
      {activeTab === 'source_graph' && (
        <div className="space-y-6 animate-fade-in font-mono">
          {/* Header Action Bar with Sourcegraph Query Search */}
          <div className="p-5 rounded-2xl border border-border bg-card/80 backdrop-blur-md space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <GitFork className="h-5 w-5 text-cyan-400" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                    Source Graph & Monorepo Code Intelligence
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground mt-1 font-sans">
                  Cross-file definition resolution, caller references, git blame gutter, and transitive blast radius impact analysis.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowBlame(!showBlame)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    showBlame
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {showBlame ? '✓ Git Blame Active' : 'Toggle Git Blame'}
                </button>
              </div>
            </div>

            {/* Sourcegraph Query Bar */}
            <div className="space-y-2 pt-1">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Query syntax: lang:python type:class file:compression TokenCompressor"
                  value={sourceGraphQuery}
                  onChange={(e) => setSourceGraphQuery(e.target.value)}
                  className="w-full pl-10 pr-24 py-2.5 rounded-xl border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-cyan-500 font-mono transition-all"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-mono">
                  {isSourceSearching ? 'Searching...' : `${sourceSearchResults?.total_matches || 0} matches`}
                </div>
              </div>

              {/* Quick Filter Chips */}
              <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                <span className="text-muted-foreground font-semibold">Filter Chips:</span>
                {[
                  { label: 'lang:python', query: 'lang:python ' },
                  { label: 'lang:typescript', query: 'lang:typescript ' },
                  { label: 'type:class', query: 'type:class ' },
                  { label: 'type:endpoint', query: 'type:endpoint ' },
                  { label: 'file:apps/api', query: 'file:apps/api ' },
                  { label: 'file:apps/web', query: 'file:apps/web ' },
                ].map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => setSourceGraphQuery((prev) => (prev.includes(chip.label) ? prev : `${chip.query}${prev}`))}
                    className="px-2 py-0.5 rounded bg-muted/60 text-muted-foreground hover:text-foreground border border-border/40 transition-all font-mono"
                  >
                    +{chip.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 3-Column Source Graph Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Column 1: Monorepo Files & Search Matches (3 cols) */}
            <div className="lg:col-span-3 space-y-4">
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <span>Monorepo Files</span>
                  <span className="text-[10px] text-cyan-400 font-mono">Indexed</span>
                </div>

                <div className="space-y-1 max-h-[500px] overflow-y-auto pr-1">
                  {[
                    'apps/api/nexora/core/compression.py',
                    'apps/api/nexora/domains/memory/source_graph.py',
                    'apps/api/nexora/domains/memory/code_graph.py',
                    'apps/api/nexora/domains/memory/router.py',
                    'apps/api/nexora/domains/agents/execution.py',
                    'apps/web/src/lib/api/sourceGraph.ts',
                    'apps/web/src/app/dashboard/memory/page.tsx',
                    'apps/tui-rs/src/features/engineering/ui.rs',
                    'apps/tui-rs/src/client.rs',
                  ].map((fp) => (
                    <div
                      key={fp}
                      onClick={() => setSelectedSourceFile(fp)}
                      className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                        selectedSourceFile === fp
                          ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300 font-bold'
                          : 'border-border/60 bg-background/60 text-muted-foreground hover:bg-secondary/40 hover:text-foreground'
                      }`}
                    >
                      <div className="truncate font-mono">{fp.split('/').pop()}</div>
                      <div className="text-[10px] text-muted-foreground truncate mt-0.5">{fp}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Matched Search Results */}
              {sourceSearchResults && sourceSearchResults.results.length > 0 && (
                <div className="p-4 rounded-xl border border-border bg-card space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                    <span>Query Hits ({sourceSearchResults.total_matches})</span>
                    <span className="text-[10px] text-emerald-400 font-mono">{sourceSearchResults.duration_ms}ms</span>
                  </div>
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {sourceSearchResults.results.slice(0, 8).map((sr, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          setSelectedSourceFile(sr.file_path);
                          if (sr.symbol_name) setSelectedSourceSymbol(sr.symbol_name);
                        }}
                        className="p-2 rounded-lg border border-border/50 bg-background/50 hover:bg-secondary/40 cursor-pointer text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground truncate">{sr.symbol_name || sr.file_path.split('/').pop()}</span>
                          {sr.symbol_kind && (
                            <span className="text-[8px] uppercase px-1 rounded bg-muted text-cyan-400 font-mono">{sr.symbol_kind}</span>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">{sr.file_path}:{sr.line_number}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Column 2: Source Code Viewer with Blame Gutter (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-border text-xs">
                  <div className="truncate font-mono text-foreground font-bold">
                    📄 {selectedSourceFile}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono shrink-0">
                    <span>{sourceFileData?.language || 'code'}</span>
                    <span>•</span>
                    <span>{sourceFileData?.total_lines || 0} lines</span>
                    <span>•</span>
                    <span>{((sourceFileData?.size_bytes || 0) / 1024).toFixed(1)} KB</span>
                  </div>
                </div>

                {/* Code Window with Blame Gutter */}
                {isSourceFileLoading ? (
                  <div className="py-24 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                    <RotateCw className="h-4 w-4 animate-spin text-cyan-400" />
                    Reading source file and git blame...
                  </div>
                ) : sourceFileData ? (
                  <div className="rounded-lg border border-border bg-black/80 font-mono text-xs overflow-x-auto max-h-[600px] overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                      <tbody>
                        {sourceFileData.content.split('\n').map((line, idx) => {
                          const lineNo = idx + 1;
                          const blameItem = sourceFileData.blame.find((b) => b.line_number === lineNo);
                          const lineSymbols = sourceFileData.symbols.filter((s) => s.line_number === lineNo);

                          return (
                            <tr key={lineNo} className="hover:bg-muted/20 transition-colors group">
                              {/* Line Number */}
                              <td className="w-10 select-none px-2 py-0.5 text-right text-[10px] text-muted-foreground/60 border-r border-border/40 font-mono">
                                {lineNo}
                              </td>

                              {/* Git Blame Gutter */}
                              {showBlame && (
                                <td className="w-40 select-none px-2 py-0.5 text-[9px] text-muted-foreground border-r border-border/40 font-mono whitespace-nowrap overflow-hidden text-ellipsis max-w-[130px]">
                                  {blameItem ? (
                                    <span title={`${blameItem.commit_sha} - ${blameItem.author}: ${blameItem.summary}`}>
                                      <span className="text-cyan-400 font-bold">{blameItem.commit_sha.slice(0, 6)}</span>{' '}
                                      <span className="text-zinc-400">{blameItem.author.split(' ')[0]}</span>{' '}
                                      <span className="text-zinc-500">{blameItem.date}</span>
                                    </span>
                                  ) : (
                                    <span className="text-zinc-600">uncommitted</span>
                                  )}
                                </td>
                              )}

                              {/* Source Code Line Content */}
                              <td className="px-3 py-0.5 text-foreground whitespace-pre text-[11px]">
                                <span>{line}</span>
                                {lineSymbols.map((sym) => (
                                  <button
                                    key={sym.id}
                                    type="button"
                                    onClick={() => setSelectedSourceSymbol(sym.name)}
                                    className="ml-2 inline-flex items-center px-1.5 py-0.2 rounded text-[8px] uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30 transition-all font-mono"
                                  >
                                    ◈ {sym.name} ({sym.kind})
                                  </button>
                                ))}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-24 text-center text-xs text-muted-foreground">
                    Select a source file to view code and AST symbols.
                  </div>
                )}
              </div>
            </div>

            {/* Column 3: Code Intelligence & Blast Radius Inspector (4 cols) */}
            <div className="lg:col-span-4 space-y-4">
              {/* Definition Card */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Target className="h-4 w-4 text-cyan-400" />
                    Symbol Definition
                  </span>
                  {symbolDefinition && (
                    <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-muted text-cyan-400 font-mono font-bold">
                      {symbolDefinition.symbol_kind}
                    </span>
                  )}
                </div>

                {isDefinitionLoading ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    Resolving symbol declaration...
                  </div>
                ) : symbolDefinition ? (
                  <div className="space-y-2 text-xs">
                    <div className="text-sm font-bold text-foreground truncate font-mono">
                      {symbolDefinition.symbol_name}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono">
                      📍 {symbolDefinition.file_path}:{symbolDefinition.line_number}
                    </div>

                    {symbolDefinition.signature && (
                      <div className="p-2 rounded bg-background border border-border text-[10px] font-mono text-emerald-300 truncate">
                        {symbolDefinition.signature}
                      </div>
                    )}

                    {symbolDefinition.surrounding_code && (
                      <div className="space-y-1">
                        <span className="text-[9px] uppercase font-bold text-muted-foreground">Declaration Snippet:</span>
                        <pre className="p-2.5 rounded bg-black/60 border border-border/40 text-[10px] text-zinc-300 font-mono overflow-x-auto max-h-36 whitespace-pre-wrap">
                          {symbolDefinition.surrounding_code}
                        </pre>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    Select a symbol to inspect its definition and callers.
                  </div>
                )}
              </div>

              {/* References & Call Sites */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <span>References ({symbolReferences?.total_references || 0})</span>
                  <span className="text-[10px] text-emerald-400 font-mono">Cross-File</span>
                </div>

                {isReferencesLoading ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    Tracing caller sites across monorepo...
                  </div>
                ) : symbolReferences && symbolReferences.references.length > 0 ? (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {symbolReferences.references.map((ref, idx) => (
                      <div
                        key={idx}
                        onClick={() => setSelectedSourceFile(ref.file_path)}
                        className="p-2 rounded-lg border border-border/50 bg-background/50 hover:bg-secondary/40 cursor-pointer text-xs space-y-0.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground text-[11px] truncate font-mono">
                            {ref.caller_symbol}
                          </span>
                          <span className="text-[8px] uppercase px-1 rounded bg-muted text-cyan-300 font-mono">
                            {ref.relation}
                          </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono truncate">
                          {ref.file_path}:{ref.line_number}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    No references found for selected symbol.
                  </div>
                )}
              </div>

              {/* Blast Radius & Transitive Impact Analysis */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <ShieldAlert className="h-4 w-4 text-amber-400" />
                    Blast Radius & Impact Radar
                  </span>
                  {blastRadiusData && (
                    <span
                      className={`text-[9px] uppercase px-2 py-0.5 rounded-full font-mono font-bold ${
                        blastRadiusData.risk_level === 'CRITICAL'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : blastRadiusData.risk_level === 'HIGH'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : blastRadiusData.risk_level === 'MEDIUM'
                          ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {blastRadiusData.risk_level} ({blastRadiusData.risk_score})
                    </span>
                  )}
                </div>

                {isBlastRadiusLoading ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    Computing transitive dependency impact...
                  </div>
                ) : blastRadiusData ? (
                  <div className="space-y-3 text-xs">
                    {/* Impact Metrics Grid */}
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="p-2 rounded bg-background/60 border border-border/50">
                        <span className="text-muted-foreground block">Impacted Files:</span>
                        <span className="text-foreground font-bold font-mono">{blastRadiusData.total_impacted_files} files</span>
                      </div>
                      <div className="p-2 rounded bg-background/60 border border-border/50">
                        <span className="text-muted-foreground block">Downstream Dependents:</span>
                        <span className="text-cyan-400 font-bold font-mono">
                          {blastRadiusData.direct_dependents.length + blastRadiusData.transitive_dependents.length}
                        </span>
                      </div>
                    </div>

                    {/* Impacted Endpoints */}
                    {blastRadiusData.impacted_endpoints.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[9px] uppercase font-bold text-amber-400">
                          Impacted Endpoints ({blastRadiusData.impacted_endpoints.length}):
                        </span>
                        <div className="space-y-1 max-h-24 overflow-y-auto">
                          {blastRadiusData.impacted_endpoints.map((ep, i) => (
                            <div key={i} className="p-1 rounded bg-amber-500/10 border border-amber-500/20 text-[10px] font-mono text-amber-300 truncate">
                              ⚡ {ep.signature || ep.name}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Impacted Unit Tests */}
                    {blastRadiusData.impacted_tests.length > 0 && (
                      <div className="space-y-1 pt-1 border-t border-border/40">
                        <span className="text-[9px] uppercase font-bold text-emerald-400">
                          Impacted Test Suites ({blastRadiusData.impacted_tests.length}):
                        </span>
                        <div className="space-y-1 max-h-24 overflow-y-auto">
                          {blastRadiusData.impacted_tests.map((testPath, i) => (
                            <div key={i} className="text-[10px] font-mono text-muted-foreground truncate">
                              🧪 {testPath.split('/').pop()}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    Select a target to compute change blast radius.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: CODEBASE AST KNOWLEDGE GRAPH (ZERO-GREP PRE-INDEX) */}
      {activeTab === 'code_graph' && (
        <div className="space-y-6 animate-fade-in font-mono">
          {/* Header Action Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl border border-border bg-card/80 backdrop-blur-md">
            <div>
              <div className="flex items-center gap-2">
                <Code2 className="h-5 w-5 text-emerald-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                  Pre-Indexed Codebase Knowledge Graph
                </h3>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Zero-grep AST topological index of monorepo modules, classes, functions, and call graphs.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => syncCodeGraphMutation.mutate()}
                disabled={syncCodeGraphMutation.isPending}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all disabled:opacity-50"
              >
                <RotateCw className={`h-3.5 w-3.5 ${syncCodeGraphMutation.isPending ? 'animate-spin' : ''}`} />
                {syncCodeGraphMutation.isPending ? 'Syncing AST Graph...' : 'Re-index & Sync DB'}
              </button>

              <button
                onClick={() => refetchCodeGraph()}
                className="p-2 rounded-xl border border-border hover:bg-secondary text-muted-foreground hover:text-foreground"
                title="Refresh Index Stats"
              >
                <RotateCw className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border border-border bg-card">
              <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Indexed Files</div>
              <div className="text-xl font-bold text-foreground mt-1">
                {isCodeGraphLoading ? '...' : codeGraphIndex?.indexed_files || 0}
              </div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-card">
              <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Total Symbols</div>
              <div className="text-xl font-bold text-emerald-400 mt-1">
                {isCodeGraphLoading ? '...' : codeGraphIndex?.total_symbols || 0}
              </div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-card">
              <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Dependencies / Edges</div>
              <div className="text-xl font-bold text-cyan-400 mt-1">
                {isCodeGraphLoading ? '...' : codeGraphIndex?.total_dependencies || 0}
              </div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-card">
              <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Traversal Speed</div>
              <div className="text-xl font-bold text-purple-400 mt-1">
                {isCodeGraphLoading ? '...' : `${codeGraphIndex?.duration_ms || 0} ms`}
              </div>
            </div>
          </div>

          {/* Symbol Search Bar (Replaces Grep) */}
          <div className="p-5 rounded-2xl border border-border bg-card space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                  <Search className="h-4 w-4 text-emerald-400" />
                  Instant AST Symbol & Call-Graph Query (Zero-Grep)
                </h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Sub-millisecond definitions, callers, callees, and imports without traversing disk files.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setCodeSearchMode('hybrid')}
                    className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                      codeSearchMode === 'hybrid'
                        ? 'bg-emerald-500/20 text-emerald-400 font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    LanceDB Hybrid
                  </button>
                  <button
                    type="button"
                    onClick={() => setCodeSearchMode('lexical')}
                    className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                      codeSearchMode === 'lexical'
                        ? 'bg-emerald-500/20 text-emerald-400 font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Lexical Token
                  </button>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
                  <span className="px-1.5 py-0.5 rounded bg-muted">Ctrl+K</span>
                </div>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder={
                  codeSearchMode === 'hybrid'
                    ? "Semantic or natural query (e.g. 'router for memory', 'token compression', 'vector embeddings')..."
                    : "Search symbol token (e.g. ContextAssemblyEngine, TokenCompressor, evaluate_request)..."
                }
                value={codeSymbolSearch}
                onChange={(e) => setCodeSymbolSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-emerald-500 font-mono transition-all"
              />
            </div>

            {/* Results Grid */}
            {isSymbolSearching ? (
              <div className="py-12 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                <RotateCw className="h-4 w-4 animate-spin text-emerald-400" />
                Querying pre-indexed AST graph topology ({codeSearchMode} mode)...
              </div>
            ) : codeSymbolResults && codeSymbolResults.symbols.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {/* Symbol Matches List */}
                <div className="space-y-2">
                  <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                    <span>Matched Symbols ({codeSymbolResults.total_matches})</span>
                    <span className="text-[10px] text-emerald-400">
                      {codeSearchMode === 'hybrid' ? 'Vector & AST Ranked' : 'Indexed in memory'}
                    </span>
                  </div>
                  <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                    {codeSymbolResults.symbols.map((sym) => {
                      const matchType = (sym as any).match_type;
                      const score = (sym as any).score;
                      return (
                        <div
                          key={sym.id}
                          onClick={() => setSelectedCodeSymbol(sym.id)}
                          className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                            selectedCodeSymbol === sym.id
                              ? 'border-emerald-500/50 bg-emerald-500/10'
                              : 'border-border bg-card/60 hover:border-emerald-500/30 hover:bg-secondary/40'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-foreground truncate">{sym.name}</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {matchType && (
                                <span className={`text-[8px] uppercase px-1.5 py-0.5 rounded font-mono ${
                                  matchType === 'dense_vector'
                                    ? 'bg-purple-500/20 text-purple-300'
                                    : matchType === 'exact_token'
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : 'bg-cyan-500/20 text-cyan-300'
                                }`}>
                                  {matchType}
                                </span>
                              )}
                              <span className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-mono ${
                                sym.kind === 'ENDPOINT'
                                  ? 'bg-amber-500/20 text-amber-300 font-bold'
                                  : 'bg-muted text-emerald-400'
                              }`}>
                                {sym.kind}
                              </span>
                            </div>
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-1 truncate">
                            {sym.file_path}:{('line_number' in sym ? sym.line_number : null) || 1}
                          </div>
                          {sym.signature && (
                            <div className="text-[10px] text-emerald-300 font-mono mt-1 truncate bg-background/60 px-2 py-0.5 rounded border border-border/40">
                              {sym.signature}
                            </div>
                          )}
                          {score !== undefined && (
                            <div className="text-[9px] text-muted-foreground font-mono mt-1">
                              Relevance score: {(score * 100).toFixed(1)}%
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Callers & Callees Graph Panel */}
                <div className="p-4 rounded-xl border border-border bg-card/40 space-y-4">
                  <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                    <span>Call Graph & Topological Neighbors</span>
                    {selectedCodeSymbol && (
                      <span className="text-[10px] text-emerald-400 font-mono truncate max-w-[150px]">
                        Target: {selectedCodeSymbol}
                      </span>
                    )}
                  </div>

                  {/* Subgraph neighborhood display if selected */}
                  {selectedCodeSymbol && codebaseSubgraph && codebaseSubgraph.nodes.length > 0 ? (
                    <div className="space-y-3 p-3 rounded-lg bg-background/60 border border-emerald-500/20">
                      <div className="flex items-center justify-between text-[10px] font-semibold text-emerald-400">
                        <span>Localized Subgraph ({codebaseSubgraph.total_nodes} nodes, {codebaseSubgraph.total_edges} relations)</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setSubgraphDepth(1)}
                            className={`px-1.5 py-0.5 rounded text-[9px] ${subgraphDepth === 1 ? 'bg-emerald-500 text-black font-bold' : 'bg-muted text-muted-foreground'}`}
                          >
                            1-hop
                          </button>
                          <button
                            type="button"
                            onClick={() => setSubgraphDepth(2)}
                            className={`px-1.5 py-0.5 rounded text-[9px] ${subgraphDepth === 2 ? 'bg-emerald-500 text-black font-bold' : 'bg-muted text-muted-foreground'}`}
                          >
                            2-hop
                          </button>
                        </div>
                      </div>

                      {/* Subgraph Nodes */}
                      <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                        {codebaseSubgraph.nodes.map((node) => (
                          <div
                            key={node.id}
                            className={`p-1.5 rounded text-[10px] font-mono flex items-center justify-between border ${
                              node.is_root
                                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 font-bold'
                                : 'bg-secondary/40 border-border/40 text-muted-foreground'
                            }`}
                          >
                            <span className="truncate max-w-[200px]">{node.name}</span>
                            <div className="flex items-center gap-1">
                              <span className="text-[8px] uppercase px-1 rounded bg-muted/60">{node.kind}</span>
                              <span className="text-[8px] text-muted-foreground">{node.distance === 0 ? 'root' : `d=${node.distance}`}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Subgraph Edges */}
                      {codebaseSubgraph.edges.length > 0 && (
                        <div className="pt-2 border-t border-border/40 space-y-1">
                          <span className="text-[9px] uppercase font-bold text-muted-foreground">Edges:</span>
                          <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                            {codebaseSubgraph.edges.map((edge, idx) => (
                              <span key={idx} className="px-1.5 py-0.5 rounded bg-muted text-[9px] font-mono text-foreground border border-border/30">
                                {edge.source.split('.').pop()} <span className="text-emerald-400 font-bold">→</span> {edge.target.split('.').pop()} <span className="text-[8px] text-muted-foreground">({edge.relation})</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}

                  {/* Callers */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold">Referenced by (Callers):</span>
                    <div className="flex flex-wrap gap-1.5">
                      {codeSymbolResults.callers.length > 0 ? (
                        codeSymbolResults.callers.map((c, i) => (
                          <span key={i} className="px-2 py-1 rounded bg-secondary text-[10px] font-mono text-purple-300 border border-border/40">
                            {c}
                          </span>
                        ))
                      ) : (
                        <span className="text-[11px] text-muted-foreground italic">No callers in current scan window</span>
                      )}
                    </div>
                  </div>

                  {/* Callees / Dependencies */}
                  <div className="space-y-1.5 pt-2">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold">Depends on (Callees):</span>
                    <div className="flex flex-wrap gap-1.5">
                      {codeSymbolResults.callees.length > 0 ? (
                        codeSymbolResults.callees.map((c, i) => (
                          <span key={i} className="px-2 py-1 rounded bg-secondary text-[10px] font-mono text-cyan-300 border border-border/40">
                            {c}
                          </span>
                        ))
                      ) : (
                        <span className="text-[11px] text-muted-foreground italic">No dependencies</span>
                      )}
                    </div>
                  </div>

                  {/* Related Files */}
                  <div className="space-y-1.5 pt-2 border-t border-border">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold">Enclosing Files:</span>
                    <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                      {codeSymbolResults.related_files.map((rf, i) => (
                        <div key={i} className="text-[10px] text-muted-foreground font-mono truncate">
                          📁 {rf}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : codeSymbolSearch.trim().length > 1 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No matching symbols found in current pre-indexed AST graph for &quot;{codeSymbolSearch}&quot;.
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-muted-foreground">
                Type a symbol name above to query definitions, callers, and dependencies instantly.
              </div>
            )}
          </div>

          {/* Central Modules Hub */}
          {codeGraphIndex?.central_modules && codeGraphIndex.central_modules.length > 0 && (
            <div className="p-4 rounded-xl border border-border bg-card/40 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Top Central Architecture Hubs
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {codeGraphIndex.central_modules.map((m, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-background/60 border border-border text-[11px] font-mono text-muted-foreground truncate">
                    <span className="text-emerald-400 font-bold">#{idx + 1}</span>
                    <span className="truncate text-foreground">{m}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: SOURCE GRAPH & CODE INTELLIGENCE */}
      {activeTab === 'source_graph' && (
        <div className="space-y-6 animate-fade-in font-mono">
          {/* Header Action Bar with Sourcegraph Query Search */}
          <div className="p-5 rounded-2xl border border-border bg-card/80 backdrop-blur-md space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <GitFork className="h-5 w-5 text-cyan-400" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                    Source Graph & Monorepo Code Intelligence
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground mt-1 font-sans">
                  Cross-file definition resolution, caller references, git blame gutter, and transitive blast radius impact analysis.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowBlame(!showBlame)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    showBlame
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {showBlame ? '✓ Git Blame Active' : 'Toggle Git Blame'}
                </button>
              </div>
            </div>

            {/* Sourcegraph Query Bar */}
            <div className="space-y-2 pt-1">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Query syntax: lang:python type:class file:compression TokenCompressor"
                  value={sourceGraphQuery}
                  onChange={(e) => setSourceGraphQuery(e.target.value)}
                  className="w-full pl-10 pr-24 py-2.5 rounded-xl border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-cyan-500 font-mono transition-all"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-mono">
                  {isSourceSearching ? 'Searching...' : `${sourceSearchResults?.total_matches || 0} matches`}
                </div>
              </div>

              {/* Quick Filter Chips */}
              <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                <span className="text-muted-foreground font-semibold">Filter Chips:</span>
                {[
                  { label: 'lang:python', query: 'lang:python ' },
                  { label: 'lang:typescript', query: 'lang:typescript ' },
                  { label: 'type:class', query: 'type:class ' },
                  { label: 'type:endpoint', query: 'type:endpoint ' },
                  { label: 'file:apps/api', query: 'file:apps/api ' },
                  { label: 'file:apps/web', query: 'file:apps/web ' },
                ].map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => setSourceGraphQuery((prev) => (prev.includes(chip.label) ? prev : `${chip.query}${prev}`))}
                    className="px-2 py-0.5 rounded bg-muted/60 text-muted-foreground hover:text-foreground border border-border/40 transition-all font-mono"
                  >
                    +{chip.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 3-Column Source Graph Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Column 1: Monorepo Files & Search Matches (3 cols) */}
            <div className="lg:col-span-3 space-y-4">
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <span>Monorepo Files</span>
                  <span className="text-[10px] text-cyan-400 font-mono">Indexed</span>
                </div>

                <div className="space-y-1 max-h-[500px] overflow-y-auto pr-1">
                  {[
                    'apps/api/nexora/core/compression.py',
                    'apps/api/nexora/domains/memory/source_graph.py',
                    'apps/api/nexora/domains/memory/code_graph.py',
                    'apps/api/nexora/domains/memory/router.py',
                    'apps/api/nexora/domains/agents/execution.py',
                    'apps/web/src/lib/api/sourceGraph.ts',
                    'apps/web/src/app/dashboard/memory/page.tsx',
                    'apps/tui-rs/src/features/engineering/ui.rs',
                    'apps/tui-rs/src/client.rs',
                  ].map((fp) => (
                    <div
                      key={fp}
                      onClick={() => setSelectedSourceFile(fp)}
                      className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                        selectedSourceFile === fp
                          ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300 font-bold'
                          : 'border-border/60 bg-background/60 text-muted-foreground hover:bg-secondary/40 hover:text-foreground'
                      }`}
                    >
                      <div className="truncate font-mono">{fp.split('/').pop()}</div>
                      <div className="text-[10px] text-muted-foreground truncate mt-0.5">{fp}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Matched Search Results */}
              {sourceSearchResults && sourceSearchResults.results.length > 0 && (
                <div className="p-4 rounded-xl border border-border bg-card space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                    <span>Query Hits ({sourceSearchResults.total_matches})</span>
                    <span className="text-[10px] text-emerald-400 font-mono">{sourceSearchResults.duration_ms}ms</span>
                  </div>
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {sourceSearchResults.results.slice(0, 8).map((sr, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          setSelectedSourceFile(sr.file_path);
                          if (sr.symbol_name) setSelectedSourceSymbol(sr.symbol_name);
                        }}
                        className="p-2 rounded-lg border border-border/50 bg-background/50 hover:bg-secondary/40 cursor-pointer text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground truncate">{sr.symbol_name || sr.file_path.split('/').pop()}</span>
                          {sr.symbol_kind && (
                            <span className="text-[8px] uppercase px-1 rounded bg-muted text-cyan-400 font-mono">{sr.symbol_kind}</span>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">{sr.file_path}:{sr.line_number}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Column 2: Source Code Viewer with Blame Gutter (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-border text-xs">
                  <div className="truncate font-mono text-foreground font-bold">
                    📄 {selectedSourceFile}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono shrink-0">
                    <span>{sourceFileData?.language || 'code'}</span>
                    <span>•</span>
                    <span>{sourceFileData?.total_lines || 0} lines</span>
                    <span>•</span>
                    <span>{((sourceFileData?.size_bytes || 0) / 1024).toFixed(1)} KB</span>
                  </div>
                </div>

                {/* Code Window with Blame Gutter */}
                {isSourceFileLoading ? (
                  <div className="py-24 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                    <RotateCw className="h-4 w-4 animate-spin text-cyan-400" />
                    Reading source file and git blame...
                  </div>
                ) : sourceFileData ? (
                  <div className="rounded-lg border border-border bg-black/80 font-mono text-xs overflow-x-auto max-h-[600px] overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                      <tbody>
                        {sourceFileData.content.split('\n').map((line, idx) => {
                          const lineNo = idx + 1;
                          const blameItem = sourceFileData.blame.find((b) => b.line_number === lineNo);
                          const lineSymbols = sourceFileData.symbols.filter((s) => s.line_number === lineNo);

                          return (
                            <tr key={lineNo} className="hover:bg-muted/20 transition-colors group">
                              {/* Line Number */}
                              <td className="w-10 select-none px-2 py-0.5 text-right text-[10px] text-muted-foreground/60 border-r border-border/40 font-mono">
                                {lineNo}
                              </td>

                              {/* Git Blame Gutter */}
                              {showBlame && (
                                <td className="w-40 select-none px-2 py-0.5 text-[9px] text-muted-foreground border-r border-border/40 font-mono whitespace-nowrap overflow-hidden text-ellipsis max-w-[130px]">
                                  {blameItem ? (
                                    <span title={`${blameItem.commit_sha} - ${blameItem.author}: ${blameItem.summary}`}>
                                      <span className="text-cyan-400 font-bold">{blameItem.commit_sha.slice(0, 6)}</span>{' '}
                                      <span className="text-zinc-400">{blameItem.author.split(' ')[0]}</span>{' '}
                                      <span className="text-zinc-500">{blameItem.date}</span>
                                    </span>
                                  ) : (
                                    <span className="text-zinc-600">uncommitted</span>
                                  )}
                                </td>
                              )}

                              {/* Source Code Line Content */}
                              <td className="px-3 py-0.5 text-foreground whitespace-pre text-[11px]">
                                <span>{line}</span>
                                {lineSymbols.map((sym) => (
                                  <button
                                    key={sym.id}
                                    type="button"
                                    onClick={() => setSelectedSourceSymbol(sym.name)}
                                    className="ml-2 inline-flex items-center px-1.5 py-0.2 rounded text-[8px] uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30 transition-all font-mono"
                                  >
                                    ◈ {sym.name} ({sym.kind})
                                  </button>
                                ))}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-24 text-center text-xs text-muted-foreground">
                    Select a source file to view code and AST symbols.
                  </div>
                )}
              </div>
            </div>

            {/* Column 3: Code Intelligence & Blast Radius Inspector (4 cols) */}
            <div className="lg:col-span-4 space-y-4">
              {/* Definition Card */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Target className="h-4 w-4 text-cyan-400" />
                    Symbol Definition
                  </span>
                  {symbolDefinition && (
                    <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-muted text-cyan-400 font-mono font-bold">
                      {symbolDefinition.symbol_kind}
                    </span>
                  )}
                </div>

                {isDefinitionLoading ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    Resolving symbol declaration...
                  </div>
                ) : symbolDefinition ? (
                  <div className="space-y-2 text-xs">
                    <div className="text-sm font-bold text-foreground truncate font-mono">
                      {symbolDefinition.symbol_name}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono">
                      📍 {symbolDefinition.file_path}:{symbolDefinition.line_number}
                    </div>

                    {symbolDefinition.signature && (
                      <div className="p-2 rounded bg-background border border-border text-[10px] font-mono text-emerald-300 truncate">
                        {symbolDefinition.signature}
                      </div>
                    )}

                    {symbolDefinition.surrounding_code && (
                      <div className="space-y-1">
                        <span className="text-[9px] uppercase font-bold text-muted-foreground">Declaration Snippet:</span>
                        <pre className="p-2.5 rounded bg-black/60 border border-border/40 text-[10px] text-zinc-300 font-mono overflow-x-auto max-h-36 whitespace-pre-wrap">
                          {symbolDefinition.surrounding_code}
                        </pre>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    Select a symbol to inspect its definition and callers.
                  </div>
                )}
              </div>

              {/* References & Call Sites */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <span>References ({symbolReferences?.total_references || 0})</span>
                  <span className="text-[10px] text-emerald-400 font-mono">Cross-File</span>
                </div>

                {isReferencesLoading ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    Tracing caller sites across monorepo...
                  </div>
                ) : symbolReferences && symbolReferences.references.length > 0 ? (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {symbolReferences.references.map((ref, idx) => (
                      <div
                        key={idx}
                        onClick={() => setSelectedSourceFile(ref.file_path)}
                        className="p-2 rounded-lg border border-border/50 bg-background/50 hover:bg-secondary/40 cursor-pointer text-xs space-y-0.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground text-[11px] truncate font-mono">
                            {ref.caller_symbol}
                          </span>
                          <span className="text-[8px] uppercase px-1 rounded bg-muted text-cyan-300 font-mono">
                            {ref.relation}
                          </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono truncate">
                          {ref.file_path}:{ref.line_number}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    No references found for selected symbol.
                  </div>
                )}
              </div>

              {/* Blast Radius & Transitive Impact Analysis */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <ShieldAlert className="h-4 w-4 text-amber-400" />
                    Blast Radius & Impact Radar
                  </span>
                  {blastRadiusData && (
                    <span
                      className={`text-[9px] uppercase px-2 py-0.5 rounded-full font-mono font-bold ${
                        blastRadiusData.risk_level === 'CRITICAL'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : blastRadiusData.risk_level === 'HIGH'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : blastRadiusData.risk_level === 'MEDIUM'
                          ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {blastRadiusData.risk_level} ({blastRadiusData.risk_score})
                    </span>
                  )}
                </div>

                {isBlastRadiusLoading ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    Computing transitive dependency impact...
                  </div>
                ) : blastRadiusData ? (
                  <div className="space-y-3 text-xs">
                    {/* Impact Metrics Grid */}
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="p-2 rounded bg-background/60 border border-border/50">
                        <span className="text-muted-foreground block">Impacted Files:</span>
                        <span className="text-foreground font-bold font-mono">{blastRadiusData.total_impacted_files} files</span>
                      </div>
                      <div className="p-2 rounded bg-background/60 border border-border/50">
                        <span className="text-muted-foreground block">Downstream Dependents:</span>
                        <span className="text-cyan-400 font-bold font-mono">
                          {blastRadiusData.direct_dependents.length + blastRadiusData.transitive_dependents.length}
                        </span>
                      </div>
                    </div>

                    {/* Impacted Endpoints */}
                    {blastRadiusData.impacted_endpoints.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[9px] uppercase font-bold text-amber-400">
                          Impacted Endpoints ({blastRadiusData.impacted_endpoints.length}):
                        </span>
                        <div className="space-y-1 max-h-24 overflow-y-auto">
                          {blastRadiusData.impacted_endpoints.map((ep, i) => (
                            <div key={i} className="p-1 rounded bg-amber-500/10 border border-amber-500/20 text-[10px] font-mono text-amber-300 truncate">
                              ⚡ {ep.signature || ep.name}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Impacted Unit Tests */}
                    {blastRadiusData.impacted_tests.length > 0 && (
                      <div className="space-y-1 pt-1 border-t border-border/40">
                        <span className="text-[9px] uppercase font-bold text-emerald-400">
                          Impacted Test Suites ({blastRadiusData.impacted_tests.length}):
                        </span>
                        <div className="space-y-1 max-h-24 overflow-y-auto">
                          {blastRadiusData.impacted_tests.map((testPath, i) => (
                            <div key={i} className="text-[10px] font-mono text-muted-foreground truncate">
                              🧪 {testPath.split('/').pop()}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    Select a target to compute change blast radius.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

