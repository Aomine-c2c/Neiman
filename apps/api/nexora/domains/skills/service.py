"""
NEIMAN Procedural Skills & Playbooks Service Layer.
Manages disk-based skills in .agents/skills/, frontmatter parsing,
role-specific playbook bindings, git cloning, and custom skill generation.
"""

from datetime import datetime, timezone
from pathlib import Path
import re
import shutil
import subprocess
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from nexora.core.security import ToolSandbox
from nexora.domains.agents.models import Agent
from nexora.domains.skills.schemas import (
    SkillCreateCustomRequest,
    SkillImportGitRequest,
    SkillResponse,
    SkillSyncResponse,
)

ROLE_SKILL_MAP: dict[str, list[str]] = {
    "Autonomous CTO Agent": [
        "linear-ticket-triage",
        "docker-containerization",
        "kubernetes-ops",
        "zero-filler",
        "brag",
    ],
    "Lead System Architect": [
        "catch-arch-rot",
        "schema",
        "nextjs-app-router",
        "fastapi-backend-suite",
        "frontend-design",
    ],
    "Lead Database Engineer": [
        "sql-migration-audit",
        "performance-profiling",
        "terraform-iac",
    ],
    "DevSecOps Sentinel": [
        "security-best-practices",
        "devsecops-sentinel",
        "secret-scanner-mitigation",
    ],
    "QA Automation Agent": [
        "enforce-tdd",
        "find-bugs",
        "memory-leak-detection",
    ],
    "UI/UX Design Director": [
        "ui-ux-pro-max",
        "impeccable",
        "design-taste-frontend",
        "algorithmic-art",
    ],
    "Mobile & Multi-Platform Specialist": [
        "ios-design-guidelines",
        "android-design-guidelines",
        "macos-design-guidelines",
        "ipados-design-guidelines",
        "tvos-design-guidelines",
        "visionos-design-guidelines",
        "watchos-design-guidelines",
        "web-design-guidelines",
    ],
    "Growth & Content Strategist": [
        "content-research-writer",
        "programmatic-seo",
        "brainstorming",
        "grill-me",
        "openai-docs",
        "find-skills",
    ],
}


def _get_skills_dir() -> Path:
    """Finds the .agents/skills directory relative to the repository root."""
    cwd = Path.cwd()
    candidates = [
        cwd / ".agents" / "skills",
        cwd.parent / ".agents" / "skills",
        cwd.parent.parent / ".agents" / "skills",
        Path("/home/devine-general/Projects/Sila/.agents/skills"),
    ]
    for c in candidates:
        if c.is_dir():
            return c
    fallback = cwd / ".agents" / "skills"
    fallback.mkdir(parents=True, exist_ok=True)
    return fallback


def _categorize_skill(name: str) -> str:
    security = {"devsecops-sentinel", "secret-scanner-mitigation", "security-best-practices"}
    cloud_infra = {"docker-containerization", "kubernetes-ops", "terraform-iac"}
    db_perf = {"sql-migration-audit", "performance-profiling", "memory-leak-detection", "schema"}
    fullstack = {"catch-arch-rot", "nextjs-app-router", "fastapi-backend-suite", "enforce-tdd", "find-bugs", "frontend-design"}
    design = {
        "ui-ux-pro-max", "impeccable", "design-taste-frontend", "algorithmic-art",
        "ios-design-guidelines", "android-design-guidelines", "macos-design-guidelines",
        "ipados-design-guidelines", "tvos-design-guidelines", "visionos-design-guidelines",
        "watchos-design-guidelines", "web-design-guidelines",
    }
    if name in security:
        return "DevSecOps & Security"
    if name in cloud_infra:
        return "Cloud & Infrastructure"
    if name in db_perf:
        return "Database & Performance"
    if name in fullstack:
        return "Architecture & Full-Stack"
    if name in design:
        return "Design & Experience"
    return "Operations & Strategy"


class SkillsService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.skills_dir = _get_skills_dir()

    def _parse_skill_file(self, skill_folder: Path) -> SkillResponse | None:
        skill_file = skill_folder / "SKILL.md"
        if not skill_file.is_file():
            return None

        raw = skill_file.read_text(encoding="utf-8", errors="replace")
        name = skill_folder.name
        description = None

        # Parse YAML frontmatter if present
        if raw.startswith("---"):
            parts = raw.split("---", 2)
            if len(parts) >= 3:
                frontmatter = parts[1]
                for line in frontmatter.splitlines():
                    if line.startswith("name:"):
                        name = line.replace("name:", "").strip()
                    elif line.startswith("description:"):
                        description = line.replace("description:", "").strip()

        # Find roles bound to this skill
        bound_roles: list[str] = []
        for role_name, skills in ROLE_SKILL_MAP.items():
            if name in skills or skill_folder.name in skills:
                bound_roles.append(role_name)

        has_scripts = (skill_folder / "scripts").is_dir()
        display_name = name.replace("-", " ").title()

        return SkillResponse(
            name=name,
            display_name=display_name,
            description=description or f"Procedural engineering skill playbook for {display_name}.",
            category=_categorize_skill(name),
            bound_roles=bound_roles,
            is_active=True,
            path=str(skill_file),
            has_scripts=has_scripts,
            content_preview=raw[:600],
        )

    async def list_skills(self) -> list[SkillResponse]:
        skills: list[SkillResponse] = []
        if not self.skills_dir.is_dir():
            return skills

        for entry in sorted(self.skills_dir.iterdir()):
            if entry.is_dir():
                parsed = self._parse_skill_file(entry)
                if parsed:
                    skills.append(parsed)
        return skills

    async def sync_disk_skills_to_squad(self, company_id: uuid.UUID) -> SkillSyncResponse:
        skills = await self.list_skills()
        skill_names_by_role: dict[str, list[str]] = {}
        for s in skills:
            for r in s.bound_roles:
                skill_names_by_role.setdefault(r, []).append(s.name)

        # Update agents in company with their assigned playbooks
        result = await self.db.execute(select(Agent).where(Agent.company_id == company_id))
        agents = list(result.scalars().all())

        roles_updated: set[str] = set()
        skills_bound_count = 0

        for agent in agents:
            # Match by agent name or identity role
            matched_role = None
            for role_name in ROLE_SKILL_MAP:
                if role_name.lower() in agent.name.lower() or (
                    agent.identity and role_name.lower() in str(agent.identity).lower()
                ):
                    matched_role = role_name
                    break

            if matched_role and matched_role in skill_names_by_role:
                assigned_skills = skill_names_by_role[matched_role]
                # Merge into agent capabilities without duplicates
                current_caps = list(agent.capabilities or [])
                for sk in assigned_skills:
                    cap_tag = f"skill:{sk}"
                    if cap_tag not in current_caps:
                        current_caps.append(cap_tag)
                agent.capabilities = current_caps

                # Update identity record
                identity = dict(agent.identity or {})
                identity["bound_skills"] = assigned_skills
                agent.identity = identity

                roles_updated.add(matched_role)
                skills_bound_count += len(assigned_skills)

        await self.db.commit()

        return SkillSyncResponse(
            total_skills_discovered=len(skills),
            skills_bound_to_roles=skills_bound_count,
            roles_updated=sorted(roles_updated),
            synced_at=datetime.now(timezone.utc).isoformat(),
        )

    async def import_git_skill(self, req: SkillImportGitRequest) -> SkillResponse:
        clean_name = re.sub(r"[^a-zA-Z0-9_-]", "", req.skill_name.strip().lower())
        if not clean_name:
            raise ValueError("Invalid skill_name slug")

        # SSRF and endpoint validation
        await ToolSandbox.validate_provider_endpoint_async(req.repository_url, allow_loopback=False, allow_private=False)

        target_dir = self.skills_dir / clean_name
        if target_dir.exists():
            shutil.rmtree(target_dir, ignore_errors=True)
        target_dir.mkdir(parents=True, exist_ok=True)

        # Execute safe shallow clone with timeout
        cmd = ["git", "clone", "--depth", "1", "-b", req.branch, req.repository_url, str(target_dir)]
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if proc.returncode != 0:
            # If clone fails, check if repository had subdirectory or failed network
            shutil.rmtree(target_dir, ignore_errors=True)
            raise ValueError(f"Git clone failed: {proc.stderr[:200]}")

        # If repo doesn't contain SKILL.md, synthesize standard wrapper
        skill_file = target_dir / "SKILL.md"
        if not skill_file.is_file():
            skill_file.write_text(
                f"---\nname: {clean_name}\ndescription: Imported git skill from {req.repository_url}\n---\n\n# {clean_name}\n\nImported git skill playbook.\n",
                encoding="utf-8",
            )

        # If a bind_role was requested, register into ROLE_SKILL_MAP
        if req.bind_role:
            ROLE_SKILL_MAP.setdefault(req.bind_role, []).append(clean_name)

        parsed = self._parse_skill_file(target_dir)
        if not parsed:
            raise ValueError("Failed to parse imported skill file")
        return parsed

    async def create_custom_skill(self, req: SkillCreateCustomRequest) -> SkillResponse:
        clean_name = re.sub(r"[^a-zA-Z0-9_-]", "", req.skill_name.strip().lower())
        if not clean_name:
            raise ValueError("Invalid skill_name slug")

        target_dir = self.skills_dir / clean_name
        target_dir.mkdir(parents=True, exist_ok=True)
        skill_file = target_dir / "SKILL.md"

        content = req.content
        if not content.startswith("---"):
            header = f"---\nname: {clean_name}\ndescription: {req.display_name}\n---\n\n"
            content = header + content

        skill_file.write_text(content, encoding="utf-8")

        if req.bind_role:
            ROLE_SKILL_MAP.setdefault(req.bind_role, []).append(clean_name)

        parsed = self._parse_skill_file(target_dir)
        if not parsed:
            raise ValueError("Failed to parse created skill file")
        return parsed

