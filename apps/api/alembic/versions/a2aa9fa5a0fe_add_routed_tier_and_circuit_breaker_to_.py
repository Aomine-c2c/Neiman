"""add_routed_tier_and_circuit_breaker_to_model_request_logs

Revision ID: a2aa9fa5a0fe
Revises: 0009
Create Date: 2026-10-12 13:29:19.857494
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a2aa9fa5a0fe"
down_revision: str | None = "0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "model_request_logs",
        sa.Column("routed_tier", sa.String(50), nullable=False, server_default="PRIMARY"),
    )
    op.add_column(
        "model_request_logs",
        sa.Column("attempts_count", sa.Integer(), nullable=False, server_default="1"),
    )
    op.add_column(
        "model_request_logs",
        sa.Column("routing_trace", sa.JSON(), nullable=False, server_default="[]"),
    )
    op.add_column(
        "model_request_logs",
        sa.Column("circuit_breaker_status", sa.String(50), nullable=False, server_default="CLOSED"),
    )


def downgrade() -> None:
    op.drop_column("model_request_logs", "circuit_breaker_status")
    op.drop_column("model_request_logs", "routing_trace")
    op.drop_column("model_request_logs", "attempts_count")
    op.drop_column("model_request_logs", "routed_tier")
