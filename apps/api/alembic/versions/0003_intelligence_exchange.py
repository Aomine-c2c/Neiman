"""Intelligence Exchange models: providers, models, routing policies, telemetry

Revision ID: 0003
Revises: 0002
Create Date: 2026-09-25
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ── model_providers ────────────────────────────────────────────────────
    op.create_table(
        "model_providers",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("display_name", sa.String(150), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("website_url", sa.String(255), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("is_local", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("is_healthy", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("consecutive_failures", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_health_check_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_model_providers_name", "model_providers", ["name"], unique=True)

    # ── models ─────────────────────────────────────────────────────────────
    op.create_table(
        "models",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("provider_id", sa.Uuid(), nullable=False),
        sa.Column("model_identifier", sa.String(150), nullable=False),
        sa.Column("display_name", sa.String(150), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("capabilities", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("modalities", sa.JSON(), nullable=False, server_default='["text"]'),
        sa.Column("tool_support", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("structured_output_support", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("context_capacity", sa.Integer(), nullable=False, server_default="128000"),
        sa.Column("max_output_tokens", sa.Integer(), nullable=False, server_default="4096"),
        sa.Column("input_cost_per_million", sa.Float(), nullable=False, server_default="2.5"),
        sa.Column("output_cost_per_million", sa.Float(), nullable=False, server_default="10.0"),
        sa.Column("avg_latency_ms", sa.Float(), nullable=False, server_default="600.0"),
        sa.Column("availability_rate", sa.Float(), nullable=False, server_default="0.999"),
        sa.Column(
            "privacy_classification", sa.String(50), nullable=False, server_default="PUBLIC_CLOUD"
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["provider_id"], ["model_providers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_models_provider_id", "models", ["provider_id"])
    op.create_index("ix_models_model_identifier", "models", ["model_identifier"])

    # ── model_routing_policies ─────────────────────────────────────────────
    op.create_table(
        "model_routing_policies",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("strategy", sa.String(50), nullable=False, server_default="BALANCED"),
        sa.Column("max_cost_per_query_usd", sa.Float(), nullable=False, server_default="0.5"),
        sa.Column("max_acceptable_latency_ms", sa.Float(), nullable=False, server_default="5000.0"),
        sa.Column("required_privacy_level", sa.String(50), nullable=True),
        sa.Column("fallback_chain", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("capability_preferences", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default="0"),
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
    op.create_index(
        "ix_model_routing_policies_company_id", "model_routing_policies", ["company_id"]
    )

    # ── model_request_logs ─────────────────────────────────────────────────
    op.create_table(
        "model_request_logs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("agent_id", sa.Uuid(), nullable=True),
        sa.Column("task_id", sa.Uuid(), nullable=True),
        sa.Column("requested_capability", sa.String(100), nullable=True),
        sa.Column("selected_provider_name", sa.String(100), nullable=False),
        sa.Column("selected_model_identifier", sa.String(150), nullable=False),
        sa.Column("routed_via_fallback", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("fallback_reason", sa.String(255), nullable=True),
        sa.Column("prompt_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("completion_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("estimated_cost_usd", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("latency_ms", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("success", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("error_message", sa.Text(), nullable=True),
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
    op.create_index("ix_model_request_logs_company_id", "model_request_logs", ["company_id"])
    op.create_index("ix_model_request_logs_agent_id", "model_request_logs", ["agent_id"])


def downgrade() -> None:
    op.drop_table("model_request_logs")
    op.drop_table("model_routing_policies")
    op.drop_table("models")
    op.drop_table("model_providers")
