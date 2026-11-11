"""Auth service — JWT tokens, password hashing, user management."""

import uuid
from datetime import UTC, datetime, timedelta

import bcrypt
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession

from nexora.config import get_settings
from nexora.domains.auth.models import User
from nexora.domains.auth.repository import UserRepository
from nexora.domains.auth.schemas import TokenPayload
from nexora.exceptions import ConflictError, UnauthorizedError

settings = get_settings()


def hash_password(plain: str) -> str:
    # Truncate to 72 bytes as per bcrypt specification
    pwd_bytes = plain.encode("utf-8")[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    pwd_bytes = plain.encode("utf-8")[:72]
    return bcrypt.checkpw(pwd_bytes, hashed.encode("utf-8"))


def create_access_token(user_id: uuid.UUID) -> tuple[str, int]:
    """Returns (token, expires_in_seconds)."""
    expire = datetime.now(UTC) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": str(user_id),
        "exp": int(expire.timestamp()),
        "type": "access",
    }
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return token, settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60


def decode_token(token: str) -> TokenPayload:
    try:
        raw = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return TokenPayload(**raw)
    except JWTError:
        raise UnauthorizedError("Invalid or expired token.")


class AuthService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = UserRepository(db)

    async def register(
        self,
        email: str,
        username: str,
        password: str,
        first_name: str = "",
        last_name: str = "",
    ) -> User:
        if await self.repo.get_by_email(email):
            raise ConflictError(f"Email '{email}' is already registered.")
        if await self.repo.get_by_username(username):
            raise ConflictError(f"Username '{username}' is already taken.")

        return await self.repo.create(
            email=email,
            username=username,
            password_hash=hash_password(password),
            first_name=first_name,
            last_name=last_name,
        )

    async def authenticate(self, email: str, password: str) -> User:
        user = await self.repo.get_by_email(email)
        if not user or not verify_password(password, user.password_hash):
            raise UnauthorizedError("Invalid email or password.")
        if not user.is_active:
            raise UnauthorizedError("Account is deactivated.")
        return user

    async def get_current_user(self, token: str) -> User:
        payload = decode_token(token)
        if payload.type != "access":
            raise UnauthorizedError("Invalid token type.")

        user = await self.repo.get_by_id(uuid.UUID(payload.sub))
        if not user or not user.is_active:
            raise UnauthorizedError("User not found or deactivated.")
        return user
