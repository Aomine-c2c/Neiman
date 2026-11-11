"""Organization service — business logic for company, dept, role, membership."""

import re
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from nexora.core.enums import MembershipRole
from nexora.domains.auth.models import User
from nexora.domains.organizations.models import (
    Company,
    CompanyMember,
    Department,
    OrganizationalDNA,
    OrgRole,
)
from nexora.domains.organizations.repository import (
    CompanyMemberRepository,
    CompanyRepository,
    DepartmentRepository,
    DNARepository,
    OrgRoleRepository,
)
from nexora.exceptions import BusinessRuleError, ConflictError, ForbiddenError, NotFoundError


def _slugify(text: str) -> str:
    slug = text.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_-]+", "-", slug)
    return re.sub(r"^-+|-+$", "", slug)[:100]


async def _ensure_unique_slug(repo: CompanyRepository, base: str) -> str:
    slug = _slugify(base)
    candidate = slug
    counter = 1
    while await repo.get_by_slug(candidate):
        candidate = f"{slug}-{counter}"
        counter += 1
    return candidate


class CompanyService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = CompanyRepository(db)
        self.member_repo = CompanyMemberRepository(db)
        self.dna_repo = DNARepository(db)

    async def create(self, owner: User, **kwargs) -> Company:
        slug = await _ensure_unique_slug(self.repo, kwargs["name"])
        company = await self.repo.create(
            name=kwargs["name"],
            slug=slug,
            owner_id=owner.id,
            description=kwargs.get("description"),
            mission=kwargs.get("mission"),
            vision=kwargs.get("vision"),
            industry=kwargs.get("industry"),
        )
        # Auto-add owner as OWNER member
        await self.member_repo.add_member(
            company_id=company.id,
            user_id=owner.id,
            role=MembershipRole.OWNER,
        )
        return company

    async def get(self, company_id: uuid.UUID) -> Company:
        company = await self.repo.get_by_id(company_id)
        if not company:
            raise NotFoundError(f"Company {company_id} not found.")
        return company

    async def get_with_dna(self, company_id: uuid.UUID) -> Company:
        company = await self.repo.get_with_dna(company_id)
        if not company:
            raise NotFoundError(f"Company {company_id} not found.")
        return company

    async def list_for_user(self, user_id: uuid.UUID) -> list[Company]:
        return await self.repo.list_for_user(user_id)

    async def list_all(self) -> list[Company]:
        return await self.repo.list_all()

    async def update(self, company_id: uuid.UUID, **kwargs) -> Company:
        company = await self.get(company_id)
        await self.repo.update(company, **kwargs)
        return company

    async def delete(self, company_id: uuid.UUID, requesting_user_id: uuid.UUID) -> None:
        company = await self.get(company_id)
        if company.owner_id != requesting_user_id:
            raise ForbiddenError("Only the company owner can delete the company.")
        await self.repo.soft_delete(company)

    async def set_dna(self, company_id: uuid.UUID, **dna_kwargs) -> OrganizationalDNA:
        await self.get(company_id)  # ensure company exists
        return await self.dna_repo.upsert(company_id, **dna_kwargs)

    async def get_dna(self, company_id: uuid.UUID) -> OrganizationalDNA | None:
        return await self.dna_repo.get_by_company(company_id)

    async def add_member(
        self,
        company_id: uuid.UUID,
        user_id: uuid.UUID,
        role: MembershipRole,
        requesting_user_id: uuid.UUID,
    ) -> CompanyMember:
        # Check requester is at least ADMIN
        membership = await self.member_repo.get_membership(company_id, requesting_user_id)
        if not membership or not MembershipRole(membership.role).can(MembershipRole.ADMIN):
            raise ForbiddenError("Only Admins or Owners can invite members.")

        existing = await self.member_repo.get_membership(company_id, user_id)
        if existing:
            raise ConflictError("User is already a member of this company.")

        # Cannot assign OWNER role via invite
        if role == MembershipRole.OWNER:
            raise BusinessRuleError(
                "Cannot assign OWNER role via invite. Transfer ownership instead."
            )

        return await self.member_repo.add_member(company_id, user_id, role)

    async def update_member_role(
        self,
        company_id: uuid.UUID,
        user_id: uuid.UUID,
        new_role: MembershipRole,
        requesting_user_id: uuid.UUID,
    ) -> CompanyMember:
        if new_role == MembershipRole.OWNER:
            raise BusinessRuleError("Cannot assign OWNER role this way. Use ownership transfer.")

        requester = await self.member_repo.get_membership(company_id, requesting_user_id)
        if not requester or not MembershipRole(requester.role).can(MembershipRole.ADMIN):
            raise ForbiddenError("Only Admins or Owners can change member roles.")

        member = await self.member_repo.get_membership(company_id, user_id)
        if not member:
            raise NotFoundError("User is not a member of this company.")

        return await self.member_repo.update_role(member, new_role)

    async def remove_member(
        self,
        company_id: uuid.UUID,
        user_id: uuid.UUID,
        requesting_user_id: uuid.UUID,
    ) -> None:
        company = await self.get(company_id)
        if user_id == company.owner_id:
            raise BusinessRuleError("Cannot remove the company owner.")

        requester = await self.member_repo.get_membership(company_id, requesting_user_id)
        if not requester or not MembershipRole(requester.role).can(MembershipRole.ADMIN):
            # Allow self-removal
            if user_id != requesting_user_id:
                raise ForbiddenError("Only Admins or Owners can remove members.")

        member = await self.member_repo.get_membership(company_id, user_id)
        if not member:
            raise NotFoundError("User is not a member of this company.")

        await self.member_repo.remove_member(member)


class DepartmentService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = DepartmentRepository(db)

    async def create(self, company_id: uuid.UUID, **kwargs) -> Department:
        # Validate parent belongs to same company
        if kwargs.get("parent_id"):
            parent = await self.repo.get_by_id(kwargs["parent_id"])
            if not parent or parent.company_id != company_id:
                raise BusinessRuleError("Parent department must belong to the same company.")

        return await self.repo.create(company_id=company_id, **kwargs)

    async def get(self, dept_id: uuid.UUID, company_id: uuid.UUID) -> Department:
        dept = await self.repo.get_by_id(dept_id)
        if not dept or dept.company_id != company_id:
            raise NotFoundError(f"Department {dept_id} not found.")
        return dept

    async def list(self, company_id: uuid.UUID) -> list[Department]:
        return await self.repo.list_by_company(company_id)

    async def update(self, dept_id: uuid.UUID, company_id: uuid.UUID, **kwargs) -> Department:
        dept = await self.get(dept_id, company_id)
        if kwargs.get("parent_id") == dept_id:
            raise BusinessRuleError("A department cannot be its own parent.")
        return await self.repo.update(dept, **kwargs)

    async def delete(self, dept_id: uuid.UUID, company_id: uuid.UUID) -> None:
        dept = await self.get(dept_id, company_id)
        await self.repo.soft_delete(dept)


class OrgRoleService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = OrgRoleRepository(db)
        self.dept_repo = DepartmentRepository(db)

    async def create(self, department_id: uuid.UUID, company_id: uuid.UUID, **kwargs) -> OrgRole:
        dept = await self.dept_repo.get_by_id(department_id)
        if not dept or dept.company_id != company_id:
            raise BusinessRuleError("Department must belong to the same company.")
        return await self.repo.create(department_id=department_id, company_id=company_id, **kwargs)

    async def get(self, role_id: uuid.UUID, company_id: uuid.UUID) -> OrgRole:
        role = await self.repo.get_by_id(role_id)
        if not role or role.company_id != company_id:
            raise NotFoundError(f"Role {role_id} not found.")
        return role

    async def list_by_department(
        self, department_id: uuid.UUID, company_id: uuid.UUID
    ) -> list[OrgRole]:
        dept = await self.dept_repo.get_by_id(department_id)
        if not dept or dept.company_id != company_id:
            raise NotFoundError("Department not found.")
        return await self.repo.list_by_department(department_id)

    async def list_by_company(self, company_id: uuid.UUID) -> list[OrgRole]:
        return await self.repo.list_by_company(company_id)

    async def update(self, role_id: uuid.UUID, company_id: uuid.UUID, **kwargs) -> OrgRole:
        role = await self.get(role_id, company_id)
        return await self.repo.update(role, **kwargs)

    async def delete(self, role_id: uuid.UUID, company_id: uuid.UUID) -> None:
        role = await self.get(role_id, company_id)
        await self.repo.soft_delete(role)
