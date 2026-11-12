"""add_cto_proposals_table

Revision ID: c83e1091bfa3
Revises: b71d8820c4a1
Create Date: 2026-10-20 12:10:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c83e1091bfa3"
down_revision: str | None = "a5bfa04c6572"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "cto_proposals",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("cto_agent_id", sa.Uuid(), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("category", sa.String(length=50), nullable=False, server_default="ARCHITECTURE"),
        sa.Column("rationale", sa.Text(), nullable=False),
        sa.Column("impact_assessment", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="PROPOSED"),
        sa.Column("proposed_tasks", sa.JSON(), nullable=False),
        sa.Column("delegated_task_ids", sa.JSON(), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["cto_agent_id"], ["agents.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_cto_proposals_company_id"), "cto_proposals", ["company_id"], unique=False
    )
    op.create_index(
        op.f("ix_cto_proposals_cto_agent_id"), "cto_proposals", ["cto_agent_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_cto_proposals_cto_agent_id"), table_name="cto_proposals")
    op.drop_index(op.f("ix_cto_proposals_company_id"), table_name="cto_proposals")
    op.drop_table("cto_proposals")
