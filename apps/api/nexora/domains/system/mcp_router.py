"""
REST API Router for Model Context Protocol (MCP) Server Management & Tool Execution.

Endpoints:
- GET /companies/{company_id}/mcp/servers - List all registered MCP servers & tool schemas
- POST /companies/{company_id}/mcp/servers - Register custom external MCP server (stdio / sse)
- PATCH /companies/{company_id}/mcp/servers/{server_id}/toggle - Enable or disable an MCP server
- POST /companies/{company_id}/mcp/tools/call - Dispatch an MCP tool call through security sandbox
"""

from __future__ import annotations

import re
import uuid
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from nexora.core.mcp import (
    MCPServerConfig,
    MCPToolCallRequest,
    MCPToolCallResult,
    mcp_manager,
)
from nexora.core.permissions import (
    require_admin,
    require_viewer,
)
from nexora.database import get_db
from nexora.domains.auth.models import User
from nexora.domains.auth.router import get_current_user

CurrentUser = Annotated[User, Depends(get_current_user)]
DB = Annotated[AsyncSession, Depends(get_db)]

router = APIRouter(prefix="/companies/{company_id}/mcp", tags=["Model Context Protocol (MCP)"])


class MCPToggleRequest(BaseModel):
    is_enabled: bool


class SkillConfig(BaseModel):
    id: str
    name: str
    description: str
    playbook_path: str
    category: str
    compatible_roles: list[str] = Field(default_factory=list)
    required_mcp_servers: list[str] = Field(default_factory=list)
    content_preview: str | None = None


class PluginBundleConfig(BaseModel):
    id: str
    name: str
    description: str
    category: str
    icon: str
    is_enabled: bool = True
    department_bindings: list[str] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)
    mcp_servers: list[str] = Field(default_factory=list)
    env_keys_required: list[str] = Field(default_factory=list)


class PluginToggleRequest(BaseModel):
    is_enabled: bool


_PLUGIN_BUNDLES: list[PluginBundleConfig] = [
    PluginBundleConfig(
        id="devops_suite",
        name="DevOps & Engineering Autonomous Suite",
        description="Comprehensive engineering toolchain: automated git branch reviews, SQL migration analysis, sandboxed script testing, and TDD enforcement.",
        category="devops",
        icon="GitBranch",
        is_enabled=True,
        department_bindings=["Engineering", "Platform & Infrastructure"],
        skills=["sql-migration-audit", "enforce-tdd", "find-bugs"],
        mcp_servers=["github", "postgres", "runtime"],
        env_keys_required=["GITHUB_TOKEN", "DATABASE_URL"],
    ),
    PluginBundleConfig(
        id="project_suite",
        name="Linear Agile & Sprint Management",
        description="Autonomous backlog triage, story grooming, bidirectional Linear milestone tracking, and rigorous operator requirement alignment.",
        category="management",
        icon="Kanban",
        is_enabled=True,
        department_bindings=["Product & Strategy", "Engineering"],
        skills=["linear-ticket-triage", "grill-me", "zero-filler"],
        mcp_servers=["linear"],
        env_keys_required=["LINEAR_API_KEY"],
    ),
    PluginBundleConfig(
        id="observability_suite",
        name="Sentry Observability & Architecture Health",
        description="Live exception stack trace analysis, automated breadcrumb inspection, regression prevention, and architectural rot detection.",
        category="observability",
        icon="Activity",
        is_enabled=True,
        department_bindings=["Engineering", "Security & Compliance"],
        skills=["catch-arch-rot", "security-best-practices"],
        mcp_servers=["sentry", "runtime"],
        env_keys_required=["SENTRY_AUTH_TOKEN"],
    ),
    PluginBundleConfig(
        id="growth_seo_suite",
        name="Growth & Programmatic SEO Suite",
        description="Search Console index analysis, programmatic landing page synthesis, Schema.org rich snippet generation, and content research.",
        category="growth",
        icon="Flame",
        is_enabled=True,
        department_bindings=["Marketing & Growth", "Product & Strategy"],
        skills=["programmatic-seo", "content-research-writer", "schema"],
        mcp_servers=["google_search_console", "firecrawl", "perplexity"],
        env_keys_required=["GOOGLE_APPLICATION_CREDENTIALS", "FIRECRAWL_API_KEY", "PERPLEXITY_API_KEY"],
    ),
    PluginBundleConfig(
        id="frontend_ux_suite",
        name="Frontend Design & Browser Testing Suite",
        description="Automated UI regression testing with Playwright, Chrome DevTools profiling, and anti-slop design taste system enforcement.",
        category="design",
        icon="Globe",
        is_enabled=True,
        department_bindings=["Engineering", "Design & UX"],
        skills=["frontend-design", "design-taste-frontend", "ui-ux-pro-max", "impeccable"],
        mcp_servers=["playwright", "chrome_devtools"],
        env_keys_required=[],
    ),
]


def _scan_skills() -> list[SkillConfig]:
    skills_dir = Path.cwd() / ".agents" / "skills"
    if not skills_dir.exists():
        skills_dir = Path(__file__).resolve().parents[4] / ".agents" / "skills"

    results: list[SkillConfig] = []
    if not skills_dir.exists():
        return results

    category_map: dict[str, tuple[str, list[str], list[str]]] = {
        "sql-migration-audit": ("database", ["Lead Database Engineer", "Backend Specialist"], ["postgres"]),
        "linear-ticket-triage": ("management", ["Engineering Scrum Master", "Product Manager"], ["linear"]),
        "enforce-tdd": ("engineering", ["Fullstack Engineer", "QA Engineer"], ["runtime"]),
        "find-bugs": ("engineering", ["Security Auditor", "Code Reviewer"], ["github"]),
        "catch-arch-rot": ("architecture", ["Lead System Architect", "Staff Engineer"], ["sentry", "github"]),
        "security-best-practices": ("security", ["Security Auditor", "DevSecOps Engineer"], ["sentry"]),
        "programmatic-seo": ("growth", ["Growth Specialist", "SEO Content Architect"], ["google_search_console"]),
        "content-research-writer": ("content", ["Content Strategist", "Researcher"], ["perplexity"]),
        "schema": ("seo", ["Technical SEO Architect", "Frontend Engineer"], ["google_search_console"]),
        "frontend-design": ("design", ["UI/UX Designer", "Frontend Engineer"], ["playwright", "chrome_devtools"]),
        "design-taste-frontend": ("design", ["Design Director", "Frontend Architect"], ["playwright"]),
        "ui-ux-pro-max": ("design", ["UI Specialist", "Design Systems Engineer"], []),
        "impeccable": ("design", ["Product Designer", "Frontend Craftsman"], []),
        "zero-filler": ("governance", ["Autonomous CTO", "Executive Deliberator"], []),
        "grill-me": ("management", ["Product Discovery Lead", "Architect"], []),
    }

    for skill_path in sorted(skills_dir.iterdir()):
        if skill_path.is_dir() and (skill_path / "SKILL.md").exists():
            skill_id = skill_path.name
            skill_file = skill_path / "SKILL.md"
            try:
                content = skill_file.read_text(encoding="utf-8")
                desc = ""
                name = skill_id.replace("-", " ").title()
                if "description:" in content:
                    match = re.search(r"description:\s*([^\n]+)", content)
                    if match:
                        desc = match.group(1).strip().strip('"\'')
                if not desc:
                    paragraphs = [p.strip() for p in content.split("\n\n") if p.strip() and not p.startswith("#")]
                    desc = paragraphs[0] if paragraphs else f"Operational playbook for {name}"

                cat_info = category_map.get(skill_id, ("general", ["Autonomous Worker"], []))
                preview = "\n".join(content.splitlines()[:30])

                results.append(SkillConfig(
                    id=skill_id,
                    name=name,
                    description=desc[:220],
                    playbook_path=str(skill_file),
                    category=cat_info[0],
                    compatible_roles=cat_info[1],
                    required_mcp_servers=cat_info[2],
                    content_preview=preview,
                ))
            except Exception:
                continue
    return results


@router.get("/servers", response_model=list[MCPServerConfig])
async def list_mcp_servers(
    company_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_viewer()),
):
    """
    List all available MCP servers (Perplexity, Glif, Chrome, Playwright, Firecrawl, custom)
    including their capabilities, transports, and input tool schemas.
    """
    return mcp_manager.list_servers()


@router.post("/servers", response_model=MCPServerConfig, status_code=status.HTTP_201_CREATED)
async def register_mcp_server(
    company_id: uuid.UUID,
    config: MCPServerConfig,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_admin()),
):
    """Register a new custom MCP server into the organizational runtime."""
    return mcp_manager.register_server(config)


@router.patch("/servers/{server_id}/toggle")
async def toggle_mcp_server(
    company_id: uuid.UUID,
    server_id: str,
    req: MCPToggleRequest,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_admin()),
):
    """Enable or disable an MCP server across all organizational agents."""
    success = mcp_manager.toggle_server(server_id, req.is_enabled)
    if not success:
        from nexora.exceptions import NotFoundError

        raise NotFoundError(f"MCP server '{server_id}' not found.")
    return {"server_id": server_id, "is_enabled": req.is_enabled}


@router.post("/tools/call", response_model=MCPToolCallResult)
async def call_mcp_tool(
    company_id: uuid.UUID,
    req: MCPToolCallRequest,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_admin()),
):
    """
    Executes a tool on a registered MCP server.
    Enforces SSRF prevention, parameter validation, and telemetry tracking.
    """
    req.company_id = company_id
    return await mcp_manager.call_tool(req)


@router.get("/skills", response_model=list[SkillConfig])
async def list_installed_skills(
    company_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_viewer()),
):
    """Enumerate all installed procedural agent skills from .agents/skills."""
    return _scan_skills()


@router.get("/plugins", response_model=list[PluginBundleConfig])
async def list_plugin_bundles(
    company_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_viewer()),
):
    """List curated organizational plugins binding Skills, MCP Servers, and department policies."""
    return _PLUGIN_BUNDLES


@router.patch("/plugins/{plugin_id}/toggle")
async def toggle_plugin_bundle(
    company_id: uuid.UUID,
    plugin_id: str,
    req: PluginToggleRequest,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_admin()),
):
    """Enable or disable a plugin bundle organization-wide."""
    for p in _PLUGIN_BUNDLES:
        if p.id == plugin_id:
            p.is_enabled = req.is_enabled
            return {"plugin_id": plugin_id, "is_enabled": req.is_enabled}
    from nexora.exceptions import NotFoundError

    raise NotFoundError(f"Plugin bundle '{plugin_id}' not found.")
