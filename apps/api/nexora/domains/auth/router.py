"""Auth API endpoints: register, login, me."""

import asyncio
import secrets

from fastapi import APIRouter, Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from nexora.config import get_settings
from nexora.database import get_db
from nexora.domains.auth.models import User
from nexora.domains.auth.schemas import TokenResponse, UserLogin, UserRegister, UserResponse
from nexora.domains.auth.service import AuthService, create_access_token
from nexora.exceptions import UnauthorizedError

router = APIRouter(prefix="/auth", tags=["Authentication"])
_bearer = HTTPBearer(auto_error=False)
_desktop_operator_lock = asyncio.Lock()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
):
    """FastAPI dependency: extracts and validates Bearer token, or selects an existing active user only when DISABLE_AUTH is explicitly enabled."""
    settings = get_settings()
    service = AuthService(db)

    if credentials and credentials.credentials:
        try:
            return await service.get_current_user(credentials.credentials)
        except UnauthorizedError:
            if not settings.DISABLE_AUTH:
                raise

    if settings.DISABLE_AUTH:
        # Disabled-auth requests still use a persisted identity for attribution.
        from sqlalchemy import select

        if settings.ENVIRONMENT == "desktop":
            async with _desktop_operator_lock:
                res = await db.execute(
                    select(User).where(User.email == "desktop@localhost").limit(1)
                )
                desktop_operator = res.scalars().first()
                if desktop_operator:
                    desktop_operator.is_active = True
                    desktop_operator.is_superuser = True
                    await db.flush()
                    return desktop_operator
                desktop_operator = await service.register(
                    email="desktop@localhost",
                    username="desktop-operator",
                    password=secrets.token_urlsafe(48),
                    first_name="Local",
                    last_name="Desktop Operator",
                )
                desktop_operator.is_superuser = True
                await db.flush()
                return desktop_operator

        res = await db.execute(select(User).where(User.is_active.is_(True)).limit(1))
        existing_user = res.scalars().first()
        if existing_user:
            return existing_user

        async with _desktop_operator_lock:
            res_recheck = await db.execute(
                select(User).where(User.is_active.is_(True)).limit(1)
            )
            existing = res_recheck.scalars().first()
            if existing:
                return existing
            dev_operator = await service.register(
                email="admin@neiman.ai",
                username="admin",
                password=secrets.token_urlsafe(48),
                first_name="Local",
                last_name="Operator",
            )
            dev_operator.is_superuser = True
            await db.flush()
            return dev_operator

    raise UnauthorizedError("Authentication required.")


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(body: UserRegister, db: AsyncSession = Depends(get_db)):
    """Register a new user account."""
    service = AuthService(db)
    user = await service.register(
        email=body.email,
        username=body.username,
        password=body.password,
        first_name=body.first_name,
        last_name=body.last_name,
    )
    return user


@router.post("/login", response_model=TokenResponse)
async def login(body: UserLogin, db: AsyncSession = Depends(get_db)):
    """Authenticate and receive a JWT access token."""
    service = AuthService(db)
    user = await service.authenticate(body.email, body.password)
    token, expires_in = create_access_token(user.id)
    return TokenResponse(access_token=token, expires_in=expires_in)


@router.get("/me", response_model=UserResponse)
async def me(current_user=Depends(get_current_user)):
    """Return the currently authenticated user's profile."""
    return current_user
