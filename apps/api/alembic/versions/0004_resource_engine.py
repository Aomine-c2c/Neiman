"""Resource Engine models: pools, budgets, requests, allocations, usage records

Revision ID: 0004
Revises: 0003
Create Date: 2026-09-25
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ── resource_pools ─────────────────────────────────────────────────────
    op.create_table(
        "resource_pools",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("total_capacity", sa.Float(), nullable=False),
        sa.Column("unit", sa.String(50), nullable=False),
        sa.Column("allocated_capacity", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("observed_usage", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_resource_pools_company_id", "resource_pools", ["company_id"])
    op.create_index("ix_resource_pools_category", "resource_pools", ["category"])

    # ── resource_budgets ───────────────────────────────────────────────────
    op.create_table(
        "resource_budgets",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("department_id", sa.Uuid(), nullable=True),
        sa.Column("project_id", sa.Uuid(), nullable=True),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("fiscal_period", sa.String(50), nullable=False, server_default="MONTHLY"),
        sa.Column("total_budget_usd", sa.Float(), nullable=False),
        sa.Column("spent_budget_usd", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("total_token_allowance", sa.Integer(), nullable=False, server_default="10000000"),
        sa.Column("consumed_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("alert_threshold_percent", sa.Float(), nullable=False, server_default="80.0"),
        sa.Column("is_exhausted", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["department_id"], ["departments.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_resource_budgets_company_id", "resource_budgets", ["company_id"])
    op.create_index("ix_resource_budgets_department_id", "resource_budgets", ["department_id"])
    op.create_index("ix_resource_budgets_project_id", "resource_budgets", ["project_id"])

    # ── resource_requests ──────────────────────────────────────────────────
    op.create_table(
        "resource_requests",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("agent_id", sa.Uuid(), nullable=True),
        sa.Column("task_id", sa.Uuid(), nullable=True),
        sa.Column("priority", sa.String(50), nullable=False, server_default="NORMAL"),
        sa.Column("justification", sa.Text(), nullable=False),
        sa.Column("requested_compute", sa.JSON(), nullable=False),
        sa.Column("requested_intelligence", sa.JSON(), nullable=False),
        sa.Column("requested_operational", sa.JSON(), nullable=False),
        sa.Column("decision", sa.String(50), nullable=True),
        sa.Column("decision_reason", sa.Text(), nullable=True),
        sa.Column("evaluated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["agent_id"], ["agents.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_resource_requests_company_id", "resource_requests", ["company_id"])
    op.create_index("ix_resource_requests_agent_id", "resource_requests", ["agent_id"])
    op.create_index("ix_resource_requests_task_id", "resource_requests", ["task_id"])

    # ── resource_allocations ───────────────────────────────────────────────
    op.create_table(
        "resource_allocations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("pool_id", sa.Uuid(), nullable=False),
        sa.Column("request_id", sa.Uuid(), nullable=False),
        sa.Column("allocated_amount", sa.Float(), nullable=False),
        sa.Column("unit", sa.String(50), nullable=False),
        sa.Column("status", sa.String(50), nullable=False, server_default="ACTIVE"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("released_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["pool_id"], ["resource_pools.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["request_id"], ["resource_requests.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_resource_allocations_company_id", "resource_allocations", ["company_id"])
    op.create_index("ix_resource_allocations_pool_id", "resource_allocations", ["pool_id"])
    op.create_index("ix_resource_allocations_request_id", "resource_allocations", ["request_id"])

    # ── resource_usage_records ─────────────────────────────────────────────
    op.create_table(
        "resource_usage_records",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("allocation_id", sa.Uuid(), nullable=False),
        sa.Column("agent_id", sa.Uuid(), nullable=True),
        sa.Column("task_id", sa.Uuid(), nullable=True),
        sa.Column("metric_state", sa.String(50), nullable=False, server_default="OBSERVED"),
        sa.Column("resource_type", sa.String(50), nullable=False),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column("unit", sa.String(50), nullable=False),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["allocation_id"], ["resource_allocations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["agent_id"], ["agents.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_resource_usage_records_company_id", "resource_usage_records", ["company_id"]
    )
    op.create_index(
        "ix_resource_usage_records_allocation_id", "resource_usage_records", ["allocation_id"]
    )
    op.create_index("ix_resource_usage_records_agent_id", "resource_usage_records", ["agent_id"])
    op.create_index("ix_resource_usage_records_task_id", "resource_usage_records", ["task_id"])


def downgrade() -> None:
    op.drop_table("resource_usage_records")
    op.drop_table("resource_allocations")
    op.drop_table("resource_requests")
    op.drop_table("resource_budgets")
    op.drop_table("resource_pools")
