"""Workflow service."""

from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from nexora.core.enums import WorkflowStatus
from nexora.domains.workflows.models import Workflow
from nexora.domains.workflows.repository import WorkflowRepository
from nexora.exceptions import BusinessRuleError, NotFoundError

CANONICAL_PROGRAMMATIC_SEO_WORKFLOW = {
    "name": "The Programmatic SEO Page Factory",
    "description": (
        "Build data-backed pages at scale without thin-content penalties. "
        "programmatic-seo designs the templates and keyword patterns, "
        "Firecrawl pulls the differentiated data each page needs, "
        "content-research-writer fills each page with sourced content, "
        "schema-markup marks it up, your CMS publishes at scale, and "
        "Search Console watches for crawl and indexing issues. "
        "Differentiated data only — thin pages get penalized."
    ),
    "trigger_type": "MANUAL",
    "status": WorkflowStatus.ACTIVE,
    "tools": [
        "firecrawl_scrape_page",
        "firecrawl_crawl_sitemap",
        "sanity_query_groq",
        "sanity_mutate_document",
        "sanity_publish_batch",
        "gsc_inspect_url",
        "gsc_query_search_analytics",
        "gsc_submit_sitemap",
        "gsc_query_crawl_issues",
    ],
    "steps": [
        {
            "id": "step-1-template-design",
            "name": "Template & Keyword Pattern Design",
            "type": "AGENT",
            "config": {
                "agent_name": "SEO Architect Agent",
                "skill": "programmatic-seo",
                "instruction": "Design the data-backed page templates and target keyword hierarchy. Map database attributes to high-intent modifier patterns without generating thin content variations.",
            },
            "next_step_id": "step-2-firecrawl-extract",
            "position": {"x": 60, "y": 140},
        },
        {
            "id": "step-2-firecrawl-extract",
            "name": "Differentiated Data Extraction (Firecrawl)",
            "type": "TOOL",
            "config": {
                "server_id": "firecrawl",
                "tool_name": "firecrawl_scrape_page",
                "parameters": {
                    "url": "https://example.com/target-data-source",
                    "only_main_content": True,
                },
            },
            "next_step_id": "step-3-content-writer",
            "position": {"x": 340, "y": 140},
        },
        {
            "id": "step-3-content-writer",
            "name": "Sourced Content & Narrative Synthesis",
            "type": "AGENT",
            "config": {
                "agent_name": "Content Research Writer Agent",
                "skill": "content-research-writer",
                "instruction": "Synthesize the extracted differentiated dataset into deep, sourced, editorial content for the template. Ground every claim with citations and empirical datapoints.",
            },
            "next_step_id": "step-4-schema-markup",
            "position": {"x": 620, "y": 140},
        },
        {
            "id": "step-4-schema-markup",
            "name": "Schema Markup & Rich Snippet Engineering",
            "type": "AGENT",
            "config": {
                "agent_name": "Schema Markup Engineer",
                "skill": "schema",
                "instruction": "Inject structured JSON-LD data conforming to schema.org (Article, Dataset, WebPage, BreadcrumbList) for maximum search graph fidelity.",
            },
            "next_step_id": "step-5-sanity-publish",
            "position": {"x": 900, "y": 140},
        },
        {
            "id": "step-5-sanity-publish",
            "name": "Scale CMS Publication (Sanity)",
            "type": "TOOL",
            "config": {
                "server_id": "sanity",
                "tool_name": "sanity_mutate_document",
                "parameters": {
                    "operation": "createOrReplace",
                    "document": {
                        "_type": "seoPage",
                        "title": "Programmatic Guide",
                        "slug": {"_type": "slug", "current": "programmatic-guide"},
                    },
                },
            },
            "next_step_id": "step-6-gsc-monitor",
            "position": {"x": 900, "y": 340},
        },
        {
            "id": "step-6-gsc-monitor",
            "name": "Crawl & Indexing Telemetry (Google Search Console)",
            "type": "TOOL",
            "config": {
                "server_id": "google_search_console",
                "tool_name": "gsc_inspect_url",
                "parameters": {
                    "site_url": "https://example.com",
                    "url": "https://example.com/programmatic-guide",
                },
            },
            "position": {"x": 620, "y": 340},
        },
    ],
}


class WorkflowService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = WorkflowRepository(db)

    async def create(self, company_id: uuid.UUID, **kwargs) -> Workflow:
        return await self.repo.create(company_id=company_id, **kwargs)

    async def get(self, workflow_id: uuid.UUID, company_id: uuid.UUID) -> Workflow:
        wf = await self.repo.get_by_id(workflow_id)
        if not wf or wf.company_id != company_id:
            raise NotFoundError(f"Workflow {workflow_id} not found.")
        return wf

    async def list(self, company_id: uuid.UUID) -> list[Workflow]:
        workflows = await self.repo.list_by_company(company_id)
        if not any(wf.name == CANONICAL_PROGRAMMATIC_SEO_WORKFLOW["name"] for wf in workflows):
            created = await self.repo.create(
                company_id=company_id,
                **CANONICAL_PROGRAMMATIC_SEO_WORKFLOW,
            )
            workflows.append(created)
        return workflows

    async def seed_canonical_workflows(self, company_id: uuid.UUID) -> list[Workflow]:
        workflows = await self.repo.list_by_company(company_id)
        seeded = []
        if not any(wf.name == CANONICAL_PROGRAMMATIC_SEO_WORKFLOW["name"] for wf in workflows):
            created = await self.repo.create(
                company_id=company_id,
                **CANONICAL_PROGRAMMATIC_SEO_WORKFLOW,
            )
            seeded.append(created)
        return seeded

    async def update(self, workflow_id: uuid.UUID, company_id: uuid.UUID, **kwargs) -> Workflow:
        wf = await self.get(workflow_id, company_id)
        if wf.status == WorkflowStatus.ARCHIVED:
            raise BusinessRuleError("Cannot update an archived workflow.")
        return await self.repo.update(wf, **kwargs)

    async def activate(self, workflow_id: uuid.UUID, company_id: uuid.UUID) -> Workflow:
        wf = await self.get(workflow_id, company_id)
        if not wf.steps:
            raise BusinessRuleError("Cannot activate a workflow with no steps.")
        return await self.repo.update(wf, status=WorkflowStatus.ACTIVE)

    async def delete(self, workflow_id: uuid.UUID, company_id: uuid.UUID) -> None:
        wf = await self.get(workflow_id, company_id)
        await self.repo.soft_delete(wf)

    # -------------------------------------------------------------
    # WORKFLOW EXECUTION ENGINE METHODS
    # -------------------------------------------------------------
    async def trigger_execution(
        self,
        workflow_id: uuid.UUID,
        company_id: uuid.UUID,
        title: str | None = None,
        input_payload: dict | None = None,
        triggered_by_user_id: uuid.UUID | None = None,
        triggered_by_agent_id: uuid.UUID | None = None,
        max_retries: int = 3,
        timeout_seconds: int = 3600,
    ):
        from nexora.domains.workflows.engine import WorkflowExecutionEngine
        from nexora.domains.workflows.repository import WorkflowExecutionRepository

        engine = WorkflowExecutionEngine(self.db)
        execution = await engine.trigger_workflow(
            workflow_id=workflow_id,
            company_id=company_id,
            title=title,
            input_payload=input_payload,
            triggered_by_user_id=triggered_by_user_id,
            triggered_by_agent_id=triggered_by_agent_id,
            max_retries=max_retries,
            timeout_seconds=timeout_seconds,
        )
        repo = WorkflowExecutionRepository(self.db)
        return await repo.get_execution(execution.id, company_id)

    async def get_execution(self, execution_id: uuid.UUID, company_id: uuid.UUID):
        from nexora.domains.workflows.repository import WorkflowExecutionRepository

        repo = WorkflowExecutionRepository(self.db)
        execution = await repo.get_execution(execution_id, company_id)
        if not execution:
            raise NotFoundError(f"Workflow execution {execution_id} not found.")
        return execution

    async def list_executions(
        self,
        company_id: uuid.UUID,
        workflow_id: uuid.UUID | None = None,
        status: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ):
        from nexora.domains.workflows.repository import WorkflowExecutionRepository

        repo = WorkflowExecutionRepository(self.db)
        return await repo.list_executions(
            company_id=company_id,
            workflow_id=workflow_id,
            status=status,
            limit=limit,
            offset=offset,
        )

    async def resume_execution(self, execution_id: uuid.UUID, company_id: uuid.UUID):
        from nexora.domains.workflows.engine import WorkflowExecutionEngine
        from nexora.domains.workflows.repository import WorkflowExecutionRepository

        execution = await self.get_execution(execution_id, company_id)
        engine = WorkflowExecutionEngine(self.db)
        await engine.resume_or_run_execution(execution)
        repo = WorkflowExecutionRepository(self.db)
        return await repo.get_execution(execution_id, company_id)

    async def cancel_execution(self, execution_id: uuid.UUID, company_id: uuid.UUID):
        from nexora.core.enums import WorkflowExecutionStatus
        from nexora.domains.workflows.repository import WorkflowExecutionRepository

        execution = await self.get_execution(execution_id, company_id)
        execution.status = WorkflowExecutionStatus.CANCELLED
        await self.db.flush()
        repo = WorkflowExecutionRepository(self.db)
        return await repo.get_execution(execution_id, company_id)
