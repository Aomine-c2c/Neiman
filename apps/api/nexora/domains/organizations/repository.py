"""Repositories for the Organizations domain."""

import uuid

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from nexora.core.enums import CompanyStatus, DepartmentStatus, MembershipRole
from nexora.domains.organizations.models import (
    Company,
    CompanyMember,
    Department,
    OrganizationalDNA,
    OrgRole,
)


class CompanyRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(self, company_id: uuid.UUID) -> Company | None:
        result = await self.db.execute(
            select(Company).where(Company.id == company_id, Company.is_deleted.is_(False))
        )
        return result.scalar_one_or_none()

    async def get_by_slug(self, slug: str) -> Company | None:
        result = await self.db.execute(
            select(Company).where(Company.slug == slug, Company.is_deleted.is_(False))
        )
        return result.scalar_one_or_none()

    async def get_with_dna(self, company_id: uuid.UUID) -> Company | None:
        result = await self.db.execute(
            select(Company)
            .options(selectinload(Company.dna))
            .where(Company.id == company_id, Company.is_deleted.is_(False))
        )
        return result.scalar_one_or_none()

    async def list_by_owner(self, owner_id: uuid.UUID) -> list[Company]:
        result = await self.db.execute(
            select(Company).where(Company.owner_id == owner_id, Company.is_deleted.is_(False))
        )
        return list(result.scalars().all())

    async def list_for_user(self, user_id: uuid.UUID) -> list[Company]:
        """All companies the user is a member of."""
        result = await self.db.execute(
            select(Company)
            .join(CompanyMember, CompanyMember.company_id == Company.id)
            .where(
                CompanyMember.user_id == user_id,
                CompanyMember.is_active.is_(True),
                Company.is_deleted.is_(False),
            )
        )
        return list(result.scalars().all())

    async def list_all(self) -> list[Company]:
        """All non-deleted companies ordered by created_at."""
        result = await self.db.execute(
            select(Company).where(Company.is_deleted.is_(False)).order_by(Company.created_at.asc())
        )
        return list(result.scalars().all())

    async def create(
        self,
        name: str,
        slug: str,
        owner_id: uuid.UUID,
        description: str | None = None,
        mission: str | None = None,
        vision: str | None = None,
        industry: str | None = None,
    ) -> Company:
        company = Company(
            name=name,
            slug=slug,
            owner_id=owner_id,
            description=description,
            mission=mission,
            vision=vision,
            industry=industry,
        )
        self.db.add(company)
        await self.db.flush()
        await self.db.refresh(company)
        return company

    async def update(self, company: Company, **kwargs) -> Company:
        for key, value in kwargs.items():
            if hasattr(company, key) and value is not None:
                setattr(company, key, value)
        await self.db.flush()
        await self.db.refresh(company)
        return company

    async def soft_delete(self, company: Company) -> None:
        from datetime import UTC, datetime

        company.is_deleted = True
        company.deleted_at = datetime.now(UTC)
        company.status = CompanyStatus.ARCHIVED
        await self.db.flush()


class DNARepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_company(self, company_id: uuid.UUID) -> OrganizationalDNA | None:
        result = await self.db.execute(
            select(OrganizationalDNA).where(OrganizationalDNA.company_id == company_id)
        )
        return result.scalar_one_or_none()

    async def upsert(self, company_id: uuid.UUID, **kwargs) -> OrganizationalDNA:
        dna = await self.get_by_company(company_id)
        if dna is None:
            dna = OrganizationalDNA(company_id=company_id, **kwargs)
            self.db.add(dna)
        else:
            for key, value in kwargs.items():
                if value is not None:
                    setattr(dna, key, value)
        await self.db.flush()
        await self.db.refresh(dna)
        return dna


class DepartmentRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(self, dept_id: uuid.UUID) -> Department | None:
        result = await self.db.execute(
            select(Department).where(Department.id == dept_id, Department.is_deleted.is_(False))
        )
        return result.scalar_one_or_none()

    async def list_by_company(self, company_id: uuid.UUID) -> list[Department]:
        result = await self.db.execute(
            select(Department)
            .where(Department.company_id == company_id, Department.is_deleted.is_(False))
            .order_by(Department.name)
        )
        return list(result.scalars().all())

    async def create(self, company_id: uuid.UUID, **kwargs) -> Department:
        dept = Department(company_id=company_id, **kwargs)
        self.db.add(dept)
        await self.db.flush()
        await self.db.refresh(dept)
        return dept

    async def update(self, dept: Department, **kwargs) -> Department:
        for key, value in kwargs.items():
            if hasattr(dept, key) and value is not None:
                setattr(dept, key, value)
        await self.db.flush()
        await self.db.refresh(dept)
        return dept

    async def soft_delete(self, dept: Department) -> None:
        from datetime import UTC, datetime

        dept.is_deleted = True
        dept.deleted_at = datetime.now(UTC)
        dept.status = DepartmentStatus.INACTIVE
        await self.db.flush()


class OrgRoleRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(self, role_id: uuid.UUID) -> OrgRole | None:
        result = await self.db.execute(
            select(OrgRole).where(OrgRole.id == role_id, OrgRole.is_deleted.is_(False))
        )
        return result.scalar_one_or_none()

    async def list_by_department(self, dept_id: uuid.UUID) -> list[OrgRole]:
        result = await self.db.execute(
            select(OrgRole)
            .where(OrgRole.department_id == dept_id, OrgRole.is_deleted.is_(False))
            .order_by(OrgRole.title)
        )
        return list(result.scalars().all())

    async def list_by_company(self, company_id: uuid.UUID) -> list[OrgRole]:
        result = await self.db.execute(
            select(OrgRole)
            .where(OrgRole.company_id == company_id, OrgRole.is_deleted.is_(False))
            .order_by(OrgRole.title)
        )
        return list(result.scalars().all())

    async def create(self, department_id: uuid.UUID, company_id: uuid.UUID, **kwargs) -> OrgRole:
        role = OrgRole(department_id=department_id, company_id=company_id, **kwargs)
        self.db.add(role)
        await self.db.flush()
        await self.db.refresh(role)
        return role

    async def update(self, role: OrgRole, **kwargs) -> OrgRole:
        for key, value in kwargs.items():
            if hasattr(role, key) and value is not None:
                setattr(role, key, value)
        await self.db.flush()
        await self.db.refresh(role)
        return role

    async def soft_delete(self, role: OrgRole) -> None:
        from datetime import UTC, datetime

        role.is_deleted = True
        role.deleted_at = datetime.now(UTC)
        await self.db.flush()


class CompanyMemberRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_membership(
        self, company_id: uuid.UUID, user_id: uuid.UUID
    ) -> CompanyMember | None:
        result = await self.db.execute(
            select(CompanyMember).where(
                and_(
                    CompanyMember.company_id == company_id,
                    CompanyMember.user_id == user_id,
                    CompanyMember.is_active.is_(True),
                )
            )
        )
        return result.scalar_one_or_none()

    async def list_by_company(self, company_id: uuid.UUID) -> list[CompanyMember]:
        result = await self.db.execute(
            select(CompanyMember)
            .options(selectinload(CompanyMember.user))
            .where(
                CompanyMember.company_id == company_id,
                CompanyMember.is_active.is_(True),
            )
        )
        return list(result.scalars().all())

    async def add_member(
        self,
        company_id: uuid.UUID,
        user_id: uuid.UUID,
        role: MembershipRole = MembershipRole.MEMBER,
    ) -> CompanyMember:
        member = CompanyMember(company_id=company_id, user_id=user_id, role=role)
        self.db.add(member)
        await self.db.flush()
        await self.db.refresh(member)
        return member

    async def update_role(self, member: CompanyMember, role: MembershipRole) -> CompanyMember:
        member.role = role
        await self.db.flush()
        return member

    async def remove_member(self, member: CompanyMember) -> None:
        member.is_active = False
        await self.db.flush()
