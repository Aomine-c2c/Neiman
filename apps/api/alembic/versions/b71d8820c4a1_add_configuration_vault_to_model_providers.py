"""add_configuration_vault_to_model_providers

Revision ID: b71d8820c4a1
Revises: a2aa9fa5a0fe
Create Date: 2026-10-13 12:24:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b71d8820c4a1"
down_revision: str | None = "a2aa9fa5a0fe"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("model_providers", sa.Column("base_url", sa.String(500), nullable=True))
    op.add_column("model_providers", sa.Column("api_key_encrypted", sa.Text(), nullable=True))
    op.add_column(
        "model_providers",
        sa.Column("is_configured", sa.Boolean(), nullable=False, server_default=sa.text("0")),
    )


def downgrade() -> None:
    op.drop_column("model_providers", "is_configured")
    op.drop_column("model_providers", "api_key_encrypted")
    op.drop_column("model_providers", "base_url")
