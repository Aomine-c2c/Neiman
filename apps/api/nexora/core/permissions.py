"""
NEIMAN Permission System.

Hierarchy: OWNER > ADMIN > MANAGER > MEMBER > VIEWER

Usage in endpoints:
    @router.get(...)
    async def list_agents(
        company_id: UUID,
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
        _: None = Depends(require_company_role(MembershipRole.MEMBER)),
    ):
        ...
"""

import uuid
from collections.abc import Callable

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from nexora.core.enums import MembershipRole
from nexora.database import get_db
from nexora.exceptions import ForbiddenError, UnauthorizedError


def require_company_role(minimum_role: MembershipRole) -> Callable:
    """
    FastAPI dependency factory.
    Returns a dependency that verifies the current user has at least
    `minimum_role` in the given company.

    The endpoint must have `company_id: uuid.UUID` as a path parameter.
    """
    from nexora.domains.auth.router import get_current_user

    async def _check(
        company_id: uuid.UUID,
        current_user=Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> None:
        from nexora.config import get_settings

        settings = get_settings()
        if settings.DISABLE_AUTH or getattr(current_user, "is_superuser", False):
            return

        from nexora.domains.organizations.repository import CompanyMemberRepository

        repo = CompanyMemberRepository(db)
        membership = await repo.get_membership(
            company_id=company_id,
            user_id=current_user.id,
        )

        if membership is None:
            raise ForbiddenError("You are not a member of this company.")

        if not MembershipRole(membership.role).can(minimum_role):
            raise ForbiddenError(
                f"This action requires at least {minimum_role.value} role. "
                f"Your role is {membership.role}."
            )

    return _check


def require_owner() -> Callable:
    return require_company_role(MembershipRole.OWNER)


def require_platform_admin() -> Callable:
    """Require the explicitly bootstrapped platform administrator account."""
    from nexora.domains.auth.router import get_current_user

    async def _check(current_user=Depends(get_current_user)) -> None:
        if not getattr(current_user, "is_superuser", False):
            raise ForbiddenError("This action requires a platform administrator.")

    return _check


def require_admin() -> Callable:
    return require_company_role(MembershipRole.ADMIN)


def require_manager() -> Callable:
    return require_company_role(MembershipRole.MANAGER)


def require_member() -> Callable:
    return require_company_role(MembershipRole.MEMBER)


def require_viewer() -> Callable:
    return require_company_role(MembershipRole.VIEWER)


# Placeholder — replaced by real auth dependency after auth module is written
async def _get_current_user_placeholder():
    raise UnauthorizedError("Auth not configured")
