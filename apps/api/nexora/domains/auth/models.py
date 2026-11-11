from typing import TYPE_CHECKING

from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from nexora.core.base import TimestampMixin, UUIDBase

if TYPE_CHECKING:
    from nexora.domains.organizations.models import Company, CompanyMember


class User(UUIDBase, TimestampMixin):
    """
    Platform-level user identity.
    Users belong to one or more companies via CompanyMember.
    """

    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False, index=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    last_name: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    memberships: Mapped[list["CompanyMember"]] = relationship(  # noqa: F821
        "CompanyMember", back_populates="user", lazy="select"
    )
    owned_companies: Mapped[list["Company"]] = relationship(  # noqa: F821
        "Company", back_populates="owner", lazy="select"
    )

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip() or self.username

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email}>"
