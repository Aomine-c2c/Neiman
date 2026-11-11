"""agent councils and deliberations tables

Revision ID: 0009
Revises: 0008
Create Date: 2026-09-25 16:30:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Agent Councils
    op.create_table(
        "agent_councils",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("company_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("charter", sa.Text(), nullable=False),
        sa.Column("council_type", sa.String(length=50), nullable=False, server_default="PERMANENT"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("synthesis_agent_id", sa.UUID(), nullable=True),
        sa.Column("members", sa.JSON(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["synthesis_agent_id"], ["agents.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_agent_councils_company_id"), "agent_councils", ["company_id"], unique=False
    )

    # 2. Council Deliberations
    op.create_table(
        "council_deliberations",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("council_id", sa.UUID(), nullable=False),
        sa.Column("company_id", sa.UUID(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("problem_statement", sa.Text(), nullable=False),
        sa.Column("context_data", sa.JSON(), nullable=False),
        sa.Column("current_stage", sa.String(length=50), nullable=False, server_default="PROPOSAL"),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="PENDING"),
        sa.Column("proposals", sa.JSON(), nullable=False),
        sa.Column("independent_reviews", sa.JSON(), nullable=False),
        sa.Column("objections", sa.JSON(), nullable=False),
        sa.Column("discussion_threads", sa.JSON(), nullable=False),
        sa.Column("synthesis_proposal", sa.JSON(), nullable=True),
        sa.Column("final_decision", sa.Text(), nullable=True),
        sa.Column("decision_rationale", sa.Text(), nullable=True),
        sa.Column("disagreements_recorded", sa.JSON(), nullable=False),
        sa.Column("decision_id", sa.UUID(), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.ForeignKeyConstraint(["council_id"], ["agent_councils.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["decision_id"], ["decisions.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_council_deliberations_company_id"),
        "council_deliberations",
        ["company_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_council_deliberations_council_id"),
        "council_deliberations",
        ["council_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_council_deliberations_status"), "council_deliberations", ["status"], unique=False
    )


def downgrade() -> None:
    op.drop_table("council_deliberations")
    op.drop_table("agent_councils")
