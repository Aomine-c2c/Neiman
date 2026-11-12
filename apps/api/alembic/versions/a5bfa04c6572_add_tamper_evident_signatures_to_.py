"""add tamper evident signatures to governance audit logs

Revision ID: a5bfa04c6572
Revises: b71d8820c4a1
Create Date: 2026-10-13 15:53:22.833749
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a5bfa04c6572"
down_revision: str | None = "b71d8820c4a1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("governance_audit_logs", schema=None) as batch_op:
        batch_op.add_column(sa.Column("integrity_signature", sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column("previous_signature", sa.String(length=64), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("governance_audit_logs", schema=None) as batch_op:
        batch_op.drop_column("previous_signature")
        batch_op.drop_column("integrity_signature")
