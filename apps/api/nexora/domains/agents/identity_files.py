"""Load versioned agent identity and operational skill documents."""

from pathlib import Path
from typing import Any

SOUL_ROOT = Path(__file__).parent / "souls"
WORKSPACE_SKILLS_ROOT = Path(__file__).resolve().parents[4] / ".agents" / "skills"


def load_workspace_skill(skill_name: str) -> str | None:
    """Load skill instructions from .agents/skills/<skill_name>/SKILL.md."""
    if not skill_name or ".." in skill_name:
        return None
    cleaned_name = skill_name.strip().lower()
    candidates = [
        WORKSPACE_SKILLS_ROOT / cleaned_name / "SKILL.md",
        WORKSPACE_SKILLS_ROOT / cleaned_name / "skill.md",
        Path.cwd() / ".agents" / "skills" / cleaned_name / "SKILL.md",
    ]
    for cand in candidates:
        if cand.is_file():
            try:
                return cand.read_text(encoding="utf-8")
            except OSError:
                continue
    return None


def load_identity_documents(slug: str) -> tuple[str | None, str | None, str | None, str | None]:
    """Return markdown and source paths for SOUL.md and SKILLS.md, when present."""
    # Slugs originate in the internal blueprint catalog; constrain them to one directory.
    if not slug or Path(slug).name != slug or slug in {".", ".."}:
        return None, None, None, None
    root = SOUL_ROOT.resolve()
    directory = (root / slug).resolve()
    if directory.parent != root:
        return None, None, None, None
    results: list[str | None] = []
    for filename in ("soul.md", "SKILLS.md"):
        try:
            path = (directory / filename).resolve(strict=True)
            path.relative_to(directory)
            if not path.is_file():
                raise OSError("identity document is not a regular file")
            results.extend([path.read_text(encoding="utf-8"), str(path)])
        except OSError:
            results.extend([None, None])
        except ValueError:
            results.extend([None, None])
    return tuple(results)  # type: ignore[return-value]


def get_agent_system_instructions(agent: Any) -> str:
    """Compose trusted system instructions with SOUL/SKILLS documents exactly once."""
    identity = agent.identity if isinstance(agent.identity, dict) else {}
    soul = identity.get("soul_markdown")
    skills = identity.get("skills_markdown")
    slug = identity.get("slug")
    if not slug:
        slug = agent.name.lower().replace(" ", "_")
    if not soul or not skills:
        loaded_soul, _, loaded_skills, _ = load_identity_documents(slug)
        soul = soul or loaded_soul
        skills = skills or loaded_skills

    instructions = agent.system_instructions or f"You are {agent.name}, an organizational agent."
    documents = [
        ("[SOUL_SPECIFICATION]", soul),
        ("[SKILLS_SPECIFICATION]", skills),
    ]

    # Resolve active skills defined on agent or department capabilities
    active_skills_list: list[str] = []
    if hasattr(agent, "capabilities") and isinstance(agent.capabilities, list):
        for cap in agent.capabilities:
            if isinstance(cap, str):
                active_skills_list.append(cap)
    identity_skills = identity.get("active_skills") or []
    if isinstance(identity_skills, list):
        for s in identity_skills:
            if isinstance(s, str) and s not in active_skills_list:
                active_skills_list.append(s)

    for skill_name in active_skills_list:
        content = load_workspace_skill(skill_name)
        if content:
            marker = f"[SKILL:{skill_name.upper().replace('-', '_')}]"
            documents.append((marker, content))

    for marker, document in documents:
        if document and marker not in instructions:
            instructions = f"{instructions}\n\n{marker}\n{document}"
    return instructions
