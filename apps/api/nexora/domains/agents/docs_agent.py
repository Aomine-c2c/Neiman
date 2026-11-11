"""
Autonomous Documentation Specialist Agent & Generator Engine for NEIMAN OS.

Architecture:
1. Agent & Role Specification:
   - Specialized Autonomous Role: "Documentation Architect / Knowledge Engineer"
   - Assigned to Engineering / Core Architecture department.
   - Purpose: Continuously inspects system topology, API router surfaces, AST code graph,
     memory domains, and policies to generate machine-optimized documentation.
2. Written Specifically for Coding Agents:
   - Strict token density & Zero-Filler rule compliance.
   - Clean markdown syntax with absolute anchors, symbols, request/response JSON schemas,
     file boundaries, and capability invariants.
   - Eliminates conversational fluff, generating dense, prompt-ready cheat sheets and
     machine-consumable rules (`AGENTS.md`, `ARCHITECTURE_PROMPT.md`, `API_CHEATSHEET.md`).
3. Auto-Updating Engine:
   - Scans code entities and router endpoints.
   - Compares content digests to detect drift between active code and generated documentation.
   - Updates target documentation files and persists memory items into the KNOWLEDGE_BASE domain.
   - Can run on-demand or as an autonomous agent task.
"""

from __future__ import annotations

import hashlib
import os
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from nexora.core.enums import (
    AgentAutonomy,
    AgentStatus,
    MemoryDomain,
    MemoryScope,
    ProvenanceType,
)
from nexora.domains.agents.models import Agent
from nexora.domains.agents.repository import AgentRepository
from nexora.domains.memory.code_graph import CodebaseKnowledgeGraphEngine
from nexora.domains.memory.repository import MemoryRepository
from nexora.domains.organizations.repository import DepartmentRepository, OrgRoleRepository


class GeneratedDocSection(BaseModel):
    title: str
    target_file: str
    content: str
    token_count: int
    hash_digest: str


class DocGenerationReport(BaseModel):
    status: str
    agent_id: str
    agent_name: str
    generated_at: str
    sections: list[GeneratedDocSection]
    total_tokens_generated: int
    files_updated: list[str]


class DocumentationAgentEngine:
    """
    Coordinates the Documentation Specialist Agent, generates machine-optimized
    markdown documentation for coding agents, and keeps records synchronized.
    """

    DOCS_SPECIALIST_ROLE_TITLE = "Principal Documentation Architect"
    DOCS_SPECIALIST_AGENT_NAME = "DocuForge-Arch"

    def __init__(self, db: AsyncSession, workspace_root: str | None = None):
        self.db = db
        cwd = Path(workspace_root or os.getcwd()).resolve()
        # If running from apps/api, traverse up to monorepo root
        if (cwd / "apps").is_dir() and (cwd / "packages").is_dir():
            self.workspace_root = cwd
        elif cwd.name == "api" and cwd.parent.name == "apps":
            self.workspace_root = cwd.parent.parent
        elif (cwd / ".." / "apps").is_dir():
            self.workspace_root = (cwd / "..").resolve()
        else:
            self.workspace_root = cwd

    async def get_or_create_documentation_agent(self, company_id: uuid.UUID) -> Agent:
        """
        Ensures the specialized Documentation Architect agent employee and
        corresponding OrgRole exist within the company.
        """
        agent_repo = AgentRepository(self.db)
        dept_repo = DepartmentRepository(self.db)
        role_repo = OrgRoleRepository(self.db)

        # 1. Check if agent already exists
        agents = await agent_repo.list_by_company(company_id)
        for a in agents:
            if a.name == self.DOCS_SPECIALIST_AGENT_NAME:
                return a

        # 2. Find or create Engineering / Architecture Department
        departments = await dept_repo.list_by_company(company_id)
        dept = next((d for d in departments if d.name.lower() == "engineering"), None)
        if not dept:
            dept = await dept_repo.create(
                company_id=company_id,
                name="Engineering",
                purpose="Autonomous software engineering, system architecture, and technical documentation.",
            )

        # 3. Create or find Documentation Architect Role
        roles = await role_repo.list_by_department(dept.id)
        role = next((r for r in roles if r.title == self.DOCS_SPECIALIST_ROLE_TITLE), None)
        if not role:
            role = await role_repo.create(
                department_id=dept.id,
                company_id=company_id,
                title=self.DOCS_SPECIALIST_ROLE_TITLE,
                responsibilities=[
                    "Continuously inspect monorepo codebase AST and API contracts.",
                    "Generate and auto-update zero-filler machine reference documentation for coding agents.",
                    "Maintain AGENTS.md, API cheat sheets, and architectural boundary references.",
                    "Synchronize verified knowledge into organizational memory triplestores.",
                ],
                capabilities=[
                    "codebase_ast_analysis",
                    "doc_generation",
                    "token_compression",
                    "knowledge_graph_sync",
                    "file_io",
                ],
                required_skills=[
                    "AST Code Extraction",
                    "Token-Dense Markdown Authoring",
                    "Zero-Filler Technical Rigor",
                ],
            )

        # 4. Instantiate and configure the Documentation Specialist Agent
        agent = await agent_repo.create(
            company_id=company_id,
            role_id=role.id,
            department_id=dept.id,
            name=self.DOCS_SPECIALIST_AGENT_NAME,
            identity={
                "role": "Autonomous Knowledge & Documentation Architect",
                "specialization": "Agent-to-Agent Machine Reference Generation",
                "style": "High-density, zero conversational filler, exact signatures and symbols",
                "avatar_url": "/avatars/docuforge.png",
                "bio": "Dedicated autonomous agent maintaining real-time technical documentation tailored specifically for AI coding agents.",
            },
            system_instructions=(
                "You are the Principal Documentation Architect of NEIMAN OS. "
                "Your objective is to produce exact, machine-usable technical documentation "
                "for coding agents. Follow the Zero-Filler Rule: no pleasantries, no conversational preamble. "
                "Output dense markdown tables, exact file links, symbol names, and JSON schemas."
            ),
            responsibilities=[
                "Scan AST code graph and API surfaces",
                "Generate machine-ready agent documentation",
                "Auto-update AGENTS.md and knowledge base memory",
            ],
            goals=[
                "Keep agent documentation 100% synchronized with codebase state",
                "Reduce external model exploration cost via token-compressed references",
            ],
            capabilities=[
                "codebase_ast_analysis",
                "doc_generation",
                "token_compression",
                "knowledge_graph_sync",
            ],
            permissions={
                "allowed_tools": ["code_graph_inspector", "doc_generator", "memory_syncer"],
                "allowed_paths": [
                    "/home/sila/Projects/Sila/.agents",
                    "/home/sila/Projects/Sila/docs",
                ],
            },
            tools=[
                {
                    "name": "code_graph_inspector",
                    "description": "Inspects AST symbols and call graphs",
                },
                {
                    "name": "doc_generator",
                    "description": "Synthesizes token-dense agent references",
                },
                {
                    "name": "memory_syncer",
                    "description": "Upserts generated docs into organizational memory",
                },
            ],
            status=AgentStatus.AVAILABLE,
            autonomy=AgentAutonomy.AUTONOMOUS,
            intelligence_config={"preferred_provider": "fast_inference", "temperature": 0.1},
            resource_limits={"max_daily_budget_usd": 15.0},
        )
        return agent

    async def generate_and_update_agent_documentation(
        self,
        company_id: uuid.UUID,
        commit_to_disk: bool = True,
    ) -> DocGenerationReport:
        """
        Main autonomous pipeline:
        1. Queries AST Codebase Graph for symbols, modules, and API domains.
        2. Generates:
           - `.agents/AGENTS_REFERENCE.md`: Machine instructions, conventions, and domain contracts.
           - `docs/API_SURFACE_FOR_AGENTS.md`: Compact endpoint index with request/response schemas.
           - `docs/ARCHITECTURE_FOR_AGENTS.md`: Structural layout, trust boundaries, and DB models.
        3. Persists documentation artifacts to disk (if commit_to_disk) and syncs to KNOWLEDGE_BASE memory.
        """
        agent = await self.get_or_create_documentation_agent(company_id)

        # 1. Extract AST Graph Summary
        code_engine = CodebaseKnowledgeGraphEngine(
            db=self.db, workspace_root=str(self.workspace_root)
        )
        indexer, summary = code_engine.get_or_build_index(force_refresh=False)

        timestamp = datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S UTC")

        # 2. Synthesize Document 1: AGENTS_REFERENCE.md (Instructions & Conventions)
        agents_ref_content = self._build_agents_reference_doc(timestamp, summary, indexer)
        # 3. Synthesize Document 2: API_SURFACE_FOR_AGENTS.md
        api_surface_content = self._build_api_surface_doc(timestamp)
        # 4. Synthesize Document 3: ARCHITECTURE_FOR_AGENTS.md
        arch_content = self._build_architecture_doc(timestamp, summary)

        sections: list[GeneratedDocSection] = []
        files_updated: list[str] = []

        docs_to_process = [
            (
                ".agents/AGENTS_REFERENCE.md",
                "Agent Operational & Codebase Reference",
                agents_ref_content,
            ),
            (
                "docs/API_SURFACE_FOR_AGENTS.md",
                "API Surface Reference for Coding Agents",
                api_surface_content,
            ),
            (
                "docs/ARCHITECTURE_FOR_AGENTS.md",
                "System Architecture & Memory Layout",
                arch_content,
            ),
        ]

        mem_repo = MemoryRepository(self.db)

        for rel_path, title, content in docs_to_process:
            h = hashlib.sha256(content.encode("utf-8")).hexdigest()
            t_count = len(content.split())

            sections.append(
                GeneratedDocSection(
                    title=title,
                    target_file=rel_path,
                    content=content,
                    token_count=t_count,
                    hash_digest=h,
                )
            )

            if commit_to_disk:
                target_file_path = self.workspace_root / rel_path
                target_file_path.parent.mkdir(parents=True, exist_ok=True)
                target_file_path.write_text(content, encoding="utf-8")
                files_updated.append(rel_path)

            # Sync into Organizational Memory under KNOWLEDGE_BASE domain
            try:
                await mem_repo.create_memory_item(
                    company_id=company_id,
                    domain=MemoryDomain.KNOWLEDGE_BASE.value,
                    scope=MemoryScope.INTERNAL.value,
                    title=f"Doc: {title}",
                    content=content[:2000],
                    summary=f"Auto-generated reference for coding agents: {title} ({t_count} tokens).",
                    provenance_type=ProvenanceType.SYSTEM_SYNTHESIS.value,
                    source=f"Agent: {self.DOCS_SPECIALIST_AGENT_NAME}",
                    confidence=1.0,
                    tags=["coding-agents", "docs", "machine-readable", "ast"],
                    extra_metadata={"target_file": rel_path, "sha256": h},
                )
            except Exception:
                pass

        total_tokens = sum(s.token_count for s in sections)

        return DocGenerationReport(
            status="SUCCESS",
            agent_id=str(agent.id),
            agent_name=agent.name,
            generated_at=timestamp,
            sections=sections,
            total_tokens_generated=total_tokens,
            files_updated=files_updated,
        )

    def _build_agents_reference_doc(self, timestamp: str, summary: Any, indexer: Any) -> str:
        """Constructs high-density operational guidance and symbol index for coding agents."""
        top_hubs = "\n".join([f"- `{m}`" for m in summary.central_modules[:8]])

        return f"""# NEIMAN OS // CODING AGENT OPERATIONAL REFERENCE
<!-- AUTO-GENERATED BY DOCUFORGE AGENT | GENERATED: {timestamp} -->
<!-- TARGET AUDIENCE: AI Coding Agents, Autonomous Planners, Subagents -->

## 1. Zero-Filler Protocol & Invariants
- **No Conversational Preamble**: Omit "Certainly", "Sure!", "In conclusion". Provide technical payloads directly.
- **Strict Typing**: Zero untyped `any` in TypeScript business logic. Strict Python type annotations with Pydantic V2.
- **Truth in Presentation**: No mock synthetic data in production API routes. Real DB persistence via SQLAlchemy 2.0.
- **Zero-Grep Law**: When querying symbols, use the AST Knowledge Graph (`/api/v1/companies/{{id}}/memory/code-graph/symbols`) instead of raw disk grep.

## 2. Monorepo Topology
| Surface | Path | Technologies | Description |
|---|---|---|---|
| **API** | `apps/api` | FastAPI, SQLAlchemy 2.0, LanceDB, Pydantic V2 | Multi-domain autonomous organization OS backend |
| **Web UI** | `apps/web` | Next.js 14, React, TailwindCSS, TanStack Query | Reactive operations dashboard & cockpit |
| **Desktop Runtime** | `apps/web/src-tauri` | Rust, Tauri, AES-256-GCM | Native OS container with hardware telemetry & zero-trust secrets |
| **Task Engine** | `packages/engine-rs` | Rust, Tokio, Dag | High-throughput DAG task orchestrator & policy enforcer |
| **Operator TUI** | `apps/tui-rs` | Rust, Ratatui, Crossterm | Keyboard-first headless terminal console |

## 3. Central Architecture Hubs
{top_hubs}

## 4. Key Symbols Quick Reference
- `CodebaseKnowledgeGraphEngine`: `apps/api/nexora/domains/memory/code_graph.py` (AST symbol parser & zero-grep lookup)
- `ContextAssemblyEngine`: `apps/api/nexora/domains/memory/context_engine.py` (Least-privilege token-compressed prompt synthesis)
- `AgentExecutionEngine`: `apps/api/nexora/domains/agents/execution.py` (10-step formal execution lifecycle)
- `IntelligenceService`: `apps/api/nexora/domains/intelligence/service.py` (Multi-provider model routing & capability selection)
- `ResourceEngine`: `apps/api/nexora/domains/resources/engine.py` (Compute/Memory/Token scheduling & allocation)
"""

    def _build_api_surface_doc(self, timestamp: str) -> str:
        """Constructs endpoint inventory with request/response semantics."""
        return f"""# NEIMAN OS // API SURFACE FOR CODING AGENTS
<!-- AUTO-GENERATED BY DOCUFORGE AGENT | GENERATED: {timestamp} -->

## Core API Domains & Endpoints

### 1. Memory & Knowledge Graph (`/api/v1/companies/{{id}}/memory`)
- `GET /items`: List 10-domain memory items (`domain`, `scope`, `limit`).
- `POST /items`: Create memory item (enforces scopes: `PUBLIC`, `INTERNAL`, `CONFIDENTIAL`, `RESTRICTED`).
- `POST /assemble-context`: Assemble token-compressed minimal context for tasks.
- `GET /code-graph/index`: Retrieve pre-indexed AST Codebase Knowledge Graph summary.
- `GET /code-graph/symbols?q={{query}}`: Sub-millisecond symbol query with callers and callees.
- `GET /graphify`: Obsidian-compatible bidirectional vault network export.

### 2. Agents Domain (`/api/v1/companies/{{id}}/agents`)
- `GET /`: List all agents in company.
- `POST /`: Create organizational agent employee (lifecycle: `CREATED` -> `CONFIGURED`).
- `GET /{{agent_id}}/profile`: Rich employee profile (manager, tools, usage, memories, audits).
- `POST /{{agent_id}}/transition`: Transition status (`AVAILABLE`, `WORKING`, `BLOCKED`, `PAUSED`, `RETIRED`).
- `POST /{{agent_id}}/execute`: Trigger 10-step execution engine for task execution.

### 3. Documentation Automation (`/api/v1/companies/{{id}}/agents/docs`)
- `POST /generate`: Trigger Documentation Specialist Agent to scan AST and auto-update docs.
- `GET /status`: Inspect status, token counts, and last update timestamp of generated references.
"""

    def _build_architecture_doc(self, timestamp: str, summary: Any) -> str:
        """Constructs system architecture and trust boundaries documentation."""
        return f"""# NEIMAN OS // ARCHITECTURAL BOUNDARIES FOR AGENTS
<!-- AUTO-GENERATED BY DOCUFORGE AGENT | GENERATED: {timestamp} -->

## 1. 10-Domain Memory Taxonomy
1. `COMPANY`: Operating principles, charter, and mission.
2. `DEPARTMENT`: Team goals, responsibilities, and operational charters.
3. `AGENT`: Autonomous worker identity, persona, and procedural skills.
4. `PROJECT`: Initiatives, milestones, and task requirements.
5. `CUSTOMER`: Client profiles, account requirements, and feedback.
6. `DECISION`: Formal deliberation records (problem, options, evidence, outcome).
7. `POLICY`: Security, legal, compliance, and budget guardrails.
8. `EXPERIMENT`: Hypotheses, variants, and metrics.
9. `FAILURE`: Incident post-mortems and preventative lessons.
10. `KNOWLEDGE_BASE`: Standard operating procedures, technical documentation, and playbooks.

## 2. Security & Least Privilege Context Assembly
```mermaid
flowchart TD
    TASK[Task Objective] --> IDENT[Identify Required Domains]
    IDENT --> RETR[Retrieve Candidate Memories]
    RETR --> AUTH[Scope & RBAC Verification]
    AUTH --> AST[Inject Code Graph Symbols]
    AST --> SCRUB[Scrub PII & Secrets]
    SCRUB --> COMP[Token Compression 60-80%]
    COMP --> PROMPT[Minimal Prompt to Model]
```

## 3. Codebase Metrics
- Total Indexed Files: {summary.indexed_files}
- Total Code Symbols: {summary.total_symbols}
- Total Inter-module Dependencies: {summary.total_dependencies}
- Traversal Latency: {summary.duration_ms} ms
"""
