"""organizational governance tables

Revision ID: 0006_governance_layer
Revises: 0005_organizational_memory
Create Date: 2026-09-25 16:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Company Constitutions
    op.create_table(
        "company_constitutions",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("company_id", sa.UUID(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("mission", sa.Text(), nullable=False),
        sa.Column("values", sa.JSON(), nullable=False),
        sa.Column("operating_principles", sa.JSON(), nullable=False),
        sa.Column("prohibited_actions", sa.JSON(), nullable=False),
        sa.Column("approval_requirements", sa.JSON(), nullable=False),
        sa.Column("security_rules", sa.JSON(), nullable=False),
        sa.Column("financial_rules", sa.JSON(), nullable=False),
        sa.Column("data_rules", sa.JSON(), nullable=False),
        sa.Column("autonomy_boundaries", sa.JSON(), nullable=False),
        sa.Column("escalation_rules", sa.JSON(), nullable=False),
        sa.Column("established_by", sa.UUID(), nullable=True),
        sa.Column("amendment_notes", sa.Text(), nullable=True),
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
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["established_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("company_id"),
    )
    op.create_index(
        op.f("ix_company_constitutions_company_id"),
        "company_constitutions",
        ["company_id"],
        unique=True,
    )

    # 2. Autonomy Configs
    op.create_table(
        "autonomy_configs",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("company_id", sa.UUID(), nullable=False),
        sa.Column("department_id", sa.UUID(), nullable=True),
        sa.Column("role_id", sa.UUID(), nullable=True),
        sa.Column("agent_id", sa.UUID(), nullable=True),
        sa.Column("tool_name", sa.String(length=100), nullable=True),
        sa.Column("task_type", sa.String(length=100), nullable=True),
        sa.Column("action_name", sa.String(length=100), nullable=True),
        sa.Column("autonomy_level", sa.Integer(), nullable=False, server_default="2"),
        sa.Column("risk_level", sa.String(length=50), nullable=False, server_default="MEDIUM"),
        sa.Column(
            "requires_explicit_approval", sa.Boolean(), nullable=False, server_default="true"
        ),
        sa.Column("conditions", sa.JSON(), nullable=False),
        sa.Column("rationale", sa.Text(), nullable=True),
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
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["department_id"], ["departments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["role_id"], ["org_roles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["agent_id"], ["agents.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_autonomy_configs_company_id"), "autonomy_configs", ["company_id"], unique=False
    )
    op.create_index(
        op.f("ix_autonomy_configs_tool_name"), "autonomy_configs", ["tool_name"], unique=False
    )
    op.create_index(
        op.f("ix_autonomy_configs_task_type"), "autonomy_configs", ["task_type"], unique=False
    )
    op.create_index(
        op.f("ix_autonomy_configs_action_name"), "autonomy_configs", ["action_name"], unique=False
    )

    # 3. Approval Requests
    op.create_table(
        "approval_requests",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("company_id", sa.UUID(), nullable=False),
        sa.Column("agent_id", sa.UUID(), nullable=True),
        sa.Column("task_id", sa.UUID(), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("target", sa.String(length=255), nullable=False),
        sa.Column("risk_level", sa.String(length=50), nullable=False, server_default="HIGH"),
        sa.Column("proposed_payload", sa.JSON(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="PENDING"),
        sa.Column("reviewer_user_id", sa.UUID(), nullable=True),
        sa.Column("reviewer_notes", sa.Text(), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["agent_id"], ["agents.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["reviewer_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_approval_requests_company_id"), "approval_requests", ["company_id"], unique=False
    )
    op.create_index(
        op.f("ix_approval_requests_status"), "approval_requests", ["status"], unique=False
    )

    # 4. Escalation Records
    op.create_table(
        "escalation_records",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("company_id", sa.UUID(), nullable=False),
        sa.Column("agent_id", sa.UUID(), nullable=True),
        sa.Column("task_id", sa.UUID(), nullable=True),
        sa.Column("reason", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("severity", sa.String(length=50), nullable=False, server_default="HIGH"),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="OPEN"),
        sa.Column("context_data", sa.JSON(), nullable=False),
        sa.Column("resolution", sa.Text(), nullable=True),
        sa.Column("resolved_by_id", sa.UUID(), nullable=True),
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
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["agent_id"], ["agents.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["resolved_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_escalation_records_company_id"), "escalation_records", ["company_id"], unique=False
    )

    # 5. Governance Audit Logs (Consequential Actions)
    op.create_table(
        "governance_audit_logs",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("company_id", sa.UUID(), nullable=False),
        sa.Column("execution_id", sa.UUID(), nullable=True),
        sa.Column("actor_id", sa.UUID(), nullable=True),
        sa.Column("actor_name", sa.String(length=255), nullable=False),
        sa.Column("actor_type", sa.String(length=50), nullable=False, server_default="AGENT"),
        sa.Column("authority", sa.String(length=255), nullable=False),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("target", sa.String(length=255), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("result", sa.String(length=50), nullable=False),
        sa.Column("autonomy_level", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("risk_level", sa.String(length=50), nullable=False, server_default="LOW"),
        sa.Column("details", sa.JSON(), nullable=False),
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
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_governance_audit_logs_company_id"),
        "governance_audit_logs",
        ["company_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_governance_audit_logs_action"), "governance_audit_logs", ["action"], unique=False
    )
    op.create_index(
        op.f("ix_governance_audit_logs_target"), "governance_audit_logs", ["target"], unique=False
    )
    op.create_index(
        op.f("ix_governance_audit_logs_result"), "governance_audit_logs", ["result"], unique=False
    )


def downgrade() -> None:
    op.drop_table("governance_audit_logs")
    op.drop_table("escalation_records")
    op.drop_table("approval_requests")
    op.drop_table("autonomy_configs")
    op.drop_table("company_constitutions")
