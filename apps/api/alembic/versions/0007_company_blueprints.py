"""company blueprints and generation proposals tables

Revision ID: 0007
Revises: 0006
Create Date: 2026-09-25 16:15:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Company Blueprints
    op.create_table(
        "company_blueprints",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("key", sa.String(length=100), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("tagline", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("category", sa.String(length=100), nullable=False),
        sa.Column("icon", sa.String(length=50), nullable=False, server_default="building"),
        sa.Column("is_system_template", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_by_user_id", sa.UUID(), nullable=True),
        sa.Column("source_company_id", sa.UUID(), nullable=True),
        sa.Column("company_definition", sa.JSON(), nullable=False),
        sa.Column("departments", sa.JSON(), nullable=False),
        sa.Column("roles", sa.JSON(), nullable=False),
        sa.Column("agents", sa.JSON(), nullable=False),
        sa.Column("workflows", sa.JSON(), nullable=False),
        sa.Column("policies", sa.JSON(), nullable=False),
        sa.Column("constitution", sa.JSON(), nullable=False),
        sa.Column("recommended_tools", sa.JSON(), nullable=False),
        sa.Column("intelligence_requirements", sa.JSON(), nullable=False),
        sa.Column("resource_policies", sa.JSON(), nullable=False),
        sa.Column("kpis", sa.JSON(), nullable=False),
        sa.Column("approval_rules", sa.JSON(), nullable=False),
        sa.Column("default_autonomy", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("escalation_rules", sa.JSON(), nullable=False),
        sa.Column("estimated_monthly_cost_usd", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("metadata_tags", sa.JSON(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["source_company_id"], ["companies.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("key"),
    )
    op.create_index(op.f("ix_company_blueprints_key"), "company_blueprints", ["key"], unique=True)
    op.create_index(
        op.f("ix_company_blueprints_category"), "company_blueprints", ["category"], unique=False
    )

    # 2. Blueprint Generation Proposals (Build My Company)
    op.create_table(
        "blueprint_generation_proposals",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="PROPOSED"),
        sa.Column("proposed_blueprint", sa.JSON(), nullable=False),
        sa.Column("estimated_operating_cost", sa.JSON(), nullable=False),
        sa.Column("risks_identified", sa.JSON(), nullable=False),
        sa.Column("missing_capabilities", sa.JSON(), nullable=False),
        sa.Column("instantiated_company_id", sa.UUID(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["instantiated_company_id"], ["companies.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("blueprint_generation_proposals")
    op.drop_table("company_blueprints")
