"""User repository — database access layer for auth."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from nexora.domains.auth.models import User


class UserRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(self, user_id: uuid.UUID) -> User | None:
        result = await self.db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> User | None:
        result = await self.db.execute(select(User).where(User.email == email.lower()))
        return result.scalar_one_or_none()

    async def get_by_username(self, username: str) -> User | None:
        result = await self.db.execute(select(User).where(User.username == username.lower()))
        return result.scalar_one_or_none()

    async def create(
        self,
        email: str,
        username: str,
        password_hash: str,
        first_name: str = "",
        last_name: str = "",
        is_superuser: bool = False,
    ) -> User:
        user = User(
            email=email.lower(),
            username=username.lower(),
            password_hash=password_hash,
            first_name=first_name,
            last_name=last_name,
            is_superuser=is_superuser,
        )
        self.db.add(user)
        await self.db.flush()
        await self.db.refresh(user)
        return user

    async def deactivate(self, user: User) -> User:
        user.is_active = False
        await self.db.flush()
        return user
