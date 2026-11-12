"""Multi-agent upgrades: hierarchy, memory, communication, execution audits

Revision ID: 0002
Revises: 0001
Create Date: 2026-09-25
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ── Add hierarchy and employee columns to agents ───────────────────────
    with op.batch_alter_table("agents") as batch_op:
        batch_op.add_column(sa.Column("department_id", sa.Uuid(), nullable=True))
        batch_op.add_column(sa.Column("manager_agent_id", sa.Uuid(), nullable=True))
        batch_op.add_column(
            sa.Column("responsibilities", sa.JSON(), nullable=False, server_default="[]")
        )
        batch_op.add_column(sa.Column("goals", sa.JSON(), nullable=False, server_default="[]"))
        batch_op.add_column(sa.Column("tools", sa.JSON(), nullable=False, server_default="[]"))
        batch_op.add_column(
            sa.Column("resource_limits", sa.JSON(), nullable=False, server_default="{}")
        )
        batch_op.add_column(
            sa.Column("resource_usage", sa.JSON(), nullable=False, server_default="{}")
        )
        batch_op.create_foreign_key(
            "fk_agents_department_id", "departments", ["department_id"], ["id"], ondelete="SET NULL"
        )
        batch_op.create_foreign_key(
            "fk_agents_manager_agent_id",
            "agents",
            ["manager_agent_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch_op.create_index("ix_agents_department_id", ["department_id"])
        batch_op.create_index("ix_agents_manager_agent_id", ["manager_agent_id"])

    # ── agent_memories ─────────────────────────────────────────────────────
    op.create_table(
        "agent_memories",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("agent_id", sa.Uuid(), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("memory_type", sa.String(50), nullable=False, server_default="episodic"),
        sa.Column("key", sa.String(255), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("metadata", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("importance", sa.Float(), nullable=False, server_default="1.0"),
        sa.Column("access_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_accessed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["agent_id"], ["agents.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_agent_memories_agent_id", "agent_memories", ["agent_id"])
    op.create_index("ix_agent_memories_company_id", "agent_memories", ["company_id"])
    op.create_index("ix_agent_memories_key", "agent_memories", ["key"])

    # ── agent_communications ───────────────────────────────────────────────
    op.create_table(
        "agent_communications",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("from_agent_id", sa.Uuid(), nullable=False),
        sa.Column("to_agent_id", sa.Uuid(), nullable=True),
        sa.Column("task_id", sa.Uuid(), nullable=True),
        sa.Column("message_type", sa.String(30), nullable=False),
        sa.Column("subject", sa.String(255), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("resolved", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["from_agent_id"], ["agents.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["to_agent_id"], ["agents.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_agent_communications_company_id", "agent_communications", ["company_id"])
    op.create_index(
        "ix_agent_communications_from_agent_id", "agent_communications", ["from_agent_id"]
    )
    op.create_index("ix_agent_communications_to_agent_id", "agent_communications", ["to_agent_id"])

    # ── agent_execution_audits ─────────────────────────────────────────────
    op.create_table(
        "agent_execution_audits",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("agent_id", sa.Uuid(), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("task_id", sa.Uuid(), nullable=True),
        sa.Column("execution_id", sa.Uuid(), nullable=False),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("step", sa.String(50), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="SUCCESS"),
        sa.Column("details", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("tokens_consumed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cost_usd", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("duration_ms", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["agent_id"], ["agents.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_agent_execution_audits_agent_id", "agent_execution_audits", ["agent_id"])
    op.create_index(
        "ix_agent_execution_audits_company_id", "agent_execution_audits", ["company_id"]
    )
    op.create_index(
        "ix_agent_execution_audits_execution_id", "agent_execution_audits", ["execution_id"]
    )


def downgrade() -> None:
    op.drop_table("agent_execution_audits")
    op.drop_table("agent_communications")
    op.drop_table("agent_memories")
    with op.batch_alter_table("agents") as batch_op:
        batch_op.drop_column("resource_usage")
        batch_op.drop_column("resource_limits")
        batch_op.drop_column("tools")
        batch_op.drop_column("goals")
        batch_op.drop_column("responsibilities")
        batch_op.drop_column("manager_agent_id")
        batch_op.drop_column("department_id")
