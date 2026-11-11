"""
Create the first platform administrator using an explicitly supplied password.
Existing ordinary users are preserved and never elevated by this command.
"""

import asyncio
import os
import uuid

import structlog
from sqlalchemy import select

# Import domain models to resolve all SQLAlchemy relations
import nexora.domains.agents.models  # noqa: F401
import nexora.domains.auth.models  # noqa: F401
import nexora.domains.blueprints.models  # noqa: F401
import nexora.domains.councils.models  # noqa: F401
import nexora.domains.decisions.models  # noqa: F401
import nexora.domains.governance.models  # noqa: F401
import nexora.domains.intelligence.evolution_models  # noqa: F401
import nexora.domains.intelligence.models  # noqa: F401
import nexora.domains.memory.models  # noqa: F401
import nexora.domains.organizations.models  # noqa: F401
import nexora.domains.policies.models  # noqa: F401
import nexora.domains.projects.models  # noqa: F401
import nexora.domains.resources.models  # noqa: F401
import nexora.domains.workflows.models  # noqa: F401
from nexora.database import AsyncSessionLocal
from nexora.domains.auth.models import User
from nexora.domains.auth.service import hash_password

logger = structlog.get_logger(__name__)


async def bootstrap_primary_admin(
    password: str,
    email: str = "admin@neiman.ai",
    username: str = "admin",
    first_name: str = "System",
    last_name: str = "Administrator",
) -> bool:
    async with AsyncSessionLocal() as session:
        existing_admin = await session.execute(
            select(User).where(User.is_superuser.is_(True)).limit(1)
        )
        if existing_admin.scalars().first():
            return False

        conflicting_account = await session.execute(
            select(User).where((User.email == email) | (User.username == username)).limit(1)
        )
        if conflicting_account.scalars().first():
            raise RuntimeError(
                "The requested administrator email or username is already in use. "
                "Choose a different identity; existing accounts are never elevated."
            )

        admin = User(
            id=uuid.uuid4(),
            email=email,
            username=username,
            password_hash=hash_password(password),
            first_name=first_name,
            last_name=last_name,
            is_active=True,
            is_superuser=True,
        )
        session.add(admin)
        await session.commit()
        return True


if __name__ == "__main__":
    password = os.environ.get("NEIMAN_BOOTSTRAP_ADMIN_PASSWORD")
    email = os.environ.get("NEIMAN_BOOTSTRAP_ADMIN_EMAIL", "admin@neiman.ai")
    username = os.environ.get("NEIMAN_BOOTSTRAP_ADMIN_USERNAME", "admin")
    if not password:
        raise SystemExit("Set NEIMAN_BOOTSTRAP_ADMIN_PASSWORD to initialize the first administrator.")
    created = asyncio.run(bootstrap_primary_admin(password=password, email=email, username=username))
    if created:
        print("[+] Primary administrator initialized (admin@neiman.ai).")
    else:
        print("[*] Operator accounts already present. No bootstrap needed.")
