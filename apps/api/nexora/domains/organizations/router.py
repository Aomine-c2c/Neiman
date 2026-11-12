"""Organization API routers: Company, DNA, Department, OrgRole, Membership."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from nexora.core.permissions import require_admin, require_manager, require_viewer
from nexora.database import get_db
from nexora.domains.auth.models import User
from nexora.domains.auth.router import get_current_user
from nexora.domains.organizations.schemas import (
    CompanyCreate,
    CompanyDetail,
    CompanyResponse,
    CompanyUpdate,
    DepartmentCreate,
    DepartmentResponse,
    DepartmentUpdate,
    DNACreate,
    DNAResponse,
    DNAUpdate,
    MemberInvite,
    MemberResponse,
    MemberRoleUpdate,
    OrgRoleCreate,
    OrgRoleResponse,
    OrgRoleUpdate,
)
from nexora.domains.organizations.service import CompanyService, DepartmentService, OrgRoleService

router = APIRouter(tags=["Organizations"])

CurrentUser = Annotated[User, Depends(get_current_user)]
DB = Annotated[AsyncSession, Depends(get_db)]


# ── Companies ──────────────────────────────────────────────────────────────

company_router = APIRouter(prefix="/companies")


@company_router.post("", response_model=CompanyResponse, status_code=status.HTTP_201_CREATED)
async def create_company(body: CompanyCreate, current_user: CurrentUser, db: DB):
    """Create a new company. The creator becomes the OWNER."""
    svc = CompanyService(db)
    company = await svc.create(owner=current_user, **body.model_dump())
    return company


@company_router.get("", response_model=list[CompanyResponse])
async def list_companies(current_user: CurrentUser, db: DB):
    """List only companies where the current user has an active membership."""
    svc = CompanyService(db)
    return await svc.list_for_user(current_user.id)


@company_router.get("/me", response_model=list[CompanyResponse])
async def my_companies(current_user: CurrentUser, db: DB):
    """List companies where the current user has an active membership."""
    svc = CompanyService(db)
    return await svc.list_for_user(current_user.id)


@company_router.get("/{company_id}", response_model=CompanyDetail)
async def get_company(
    company_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_viewer()),
):
    svc = CompanyService(db)
    return await svc.get_with_dna(company_id)


@company_router.patch("/{company_id}", response_model=CompanyResponse)
async def update_company(
    company_id: uuid.UUID,
    body: CompanyUpdate,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_admin()),
):
    svc = CompanyService(db)
    return await svc.update(company_id, **body.model_dump(exclude_none=True))


@company_router.delete("/{company_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_company(
    company_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_admin()),
):
    svc = CompanyService(db)
    await svc.delete(company_id, current_user.id)


# ── Organizational DNA ─────────────────────────────────────────────────────

dna_router = APIRouter(prefix="/companies/{company_id}/dna")


@dna_router.put("", response_model=DNAResponse)
async def upsert_dna(
    company_id: uuid.UUID,
    body: DNACreate,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_admin()),
):
    """Create or replace the Organizational DNA for a company."""
    svc = CompanyService(db)
    return await svc.set_dna(company_id, **body.model_dump())


@dna_router.patch("", response_model=DNAResponse)
async def update_dna(
    company_id: uuid.UUID,
    body: DNAUpdate,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_admin()),
):
    svc = CompanyService(db)
    return await svc.set_dna(company_id, **body.model_dump(exclude_none=True))


@dna_router.get("", response_model=DNAResponse | None)
async def get_dna(
    company_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_viewer()),
):
    svc = CompanyService(db)
    return await svc.get_dna(company_id)


# ── Departments ────────────────────────────────────────────────────────────

dept_router = APIRouter(prefix="/companies/{company_id}/departments")


@dept_router.post("", response_model=DepartmentResponse, status_code=status.HTTP_201_CREATED)
async def create_department(
    company_id: uuid.UUID,
    body: DepartmentCreate,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_manager()),
):
    svc = DepartmentService(db)
    return await svc.create(company_id=company_id, **body.model_dump())


@dept_router.get("", response_model=list[DepartmentResponse])
async def list_departments(
    company_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_viewer()),
):
    svc = DepartmentService(db)
    return await svc.list(company_id)


@dept_router.get("/{dept_id}", response_model=DepartmentResponse)
async def get_department(
    company_id: uuid.UUID,
    dept_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_viewer()),
):
    svc = DepartmentService(db)
    return await svc.get(dept_id, company_id)


@dept_router.patch("/{dept_id}", response_model=DepartmentResponse)
async def update_department(
    company_id: uuid.UUID,
    dept_id: uuid.UUID,
    body: DepartmentUpdate,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_manager()),
):
    svc = DepartmentService(db)
    return await svc.update(dept_id, company_id, **body.model_dump(exclude_none=True))


@dept_router.delete("/{dept_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_department(
    company_id: uuid.UUID,
    dept_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_admin()),
):
    svc = DepartmentService(db)
    await svc.delete(dept_id, company_id)


# ── Org Roles ──────────────────────────────────────────────────────────────

role_router = APIRouter(prefix="/companies/{company_id}/roles")


@role_router.post(
    "/departments/{dept_id}",
    response_model=OrgRoleResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_role(
    company_id: uuid.UUID,
    dept_id: uuid.UUID,
    body: OrgRoleCreate,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_manager()),
):
    svc = OrgRoleService(db)
    return await svc.create(department_id=dept_id, company_id=company_id, **body.model_dump())


@role_router.get("", response_model=list[OrgRoleResponse])
async def list_roles(
    company_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_viewer()),
):
    svc = OrgRoleService(db)
    return await svc.list_by_company(company_id)


@role_router.get("/{role_id}", response_model=OrgRoleResponse)
async def get_role(
    company_id: uuid.UUID,
    role_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_viewer()),
):
    svc = OrgRoleService(db)
    return await svc.get(role_id, company_id)


@role_router.patch("/{role_id}", response_model=OrgRoleResponse)
async def update_role(
    company_id: uuid.UUID,
    role_id: uuid.UUID,
    body: OrgRoleUpdate,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_manager()),
):
    svc = OrgRoleService(db)
    return await svc.update(role_id, company_id, **body.model_dump(exclude_none=True))


@role_router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role(
    company_id: uuid.UUID,
    role_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_admin()),
):
    svc = OrgRoleService(db)
    await svc.delete(role_id, company_id)


# ── Members ────────────────────────────────────────────────────────────────

member_router = APIRouter(prefix="/companies/{company_id}/members")


@member_router.post("", response_model=MemberResponse, status_code=status.HTTP_201_CREATED)
async def invite_member(
    company_id: uuid.UUID,
    body: MemberInvite,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_admin()),
):
    svc = CompanyService(db)
    return await svc.add_member(
        company_id=company_id,
        user_id=body.user_id,
        role=body.role,
        requesting_user_id=current_user.id,
    )


@member_router.get("", response_model=list[MemberResponse])
async def list_members(
    company_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_viewer()),
):
    from nexora.domains.organizations.repository import CompanyMemberRepository

    repo = CompanyMemberRepository(db)
    return await repo.list_by_company(company_id)


@member_router.patch("/{user_id}", response_model=MemberResponse)
async def update_member_role(
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    body: MemberRoleUpdate,
    current_user: CurrentUser,
    db: DB,
    _: None = Depends(require_admin()),
):
    svc = CompanyService(db)
    return await svc.update_member_role(
        company_id=company_id,
        user_id=user_id,
        new_role=body.role,
        requesting_user_id=current_user.id,
    )


@member_router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
):
    svc = CompanyService(db)
    await svc.remove_member(
        company_id=company_id,
        user_id=user_id,
        requesting_user_id=current_user.id,
    )


router.include_router(company_router)
router.include_router(dna_router)
router.include_router(dept_router)
router.include_router(role_router)
router.include_router(member_router)
