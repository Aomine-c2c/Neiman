"""
NEIMAN Skills & Playbooks Pydantic Schemas.
"""

from pydantic import BaseModel, ConfigDict, Field


class SkillResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str
    display_name: str
    description: str | None = None
    category: str = "Engineering"
    bound_roles: list[str] = Field(default_factory=list)
    is_active: bool = True
    path: str
    has_scripts: bool = False
    content_preview: str | None = None


class SkillSyncResponse(BaseModel):
    total_skills_discovered: int
    skills_bound_to_roles: int
    roles_updated: list[str]
    synced_at: str


class SkillImportGitRequest(BaseModel):
    repository_url: str
    branch: str = "main"
    skill_name: str
    bind_role: str | None = None


class SkillCreateCustomRequest(BaseModel):
    skill_name: str
    display_name: str
    category: str = "Engineering"
    content: str
    bind_role: str | None = None


class SkillRoleBindingResponse(BaseModel):
    skill_name: str
    bound_role: str
    status: str = "BOUND"

