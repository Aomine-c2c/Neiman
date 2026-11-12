"""Track reserved budgets and observed usage per resource request."""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "f4b8d1a2c963"
down_revision: str | None = "e63a4c0d9f12"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    budget_cols = {col["name"] for col in inspector.get_columns("resource_budgets")}
    request_cols = {col["name"] for col in inspector.get_columns("resource_requests")}

    if "reserved_budget_usd" not in budget_cols:
        op.add_column(
            "resource_budgets",
            sa.Column(
                "reserved_budget_usd", sa.Float(), nullable=False, server_default=sa.text("0")
            ),
        )
    if "reserved_tokens" not in budget_cols:
        op.add_column(
            "resource_budgets",
            sa.Column("reserved_tokens", sa.Integer(), nullable=False, server_default=sa.text("0")),
        )
    if "actual_cost_usd" not in request_cols:
        op.add_column(
            "resource_requests",
            sa.Column("actual_cost_usd", sa.Float(), nullable=False, server_default=sa.text("0")),
        )
    if "actual_tokens" not in request_cols:
        op.add_column(
            "resource_requests",
            sa.Column("actual_tokens", sa.Integer(), nullable=False, server_default=sa.text("0")),
        )
    if "budget_reservation_active" not in request_cols:
        op.add_column(
            "resource_requests",
            sa.Column(
                "budget_reservation_active",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            ),
        )
    if "budget_accounting_managed" not in request_cols:
        op.add_column(
            "resource_requests",
            sa.Column(
                "budget_accounting_managed",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            ),
        )
    if "applicable_budget_ids" not in request_cols:
        op.add_column(
            "resource_requests",
            sa.Column(
                "applicable_budget_ids",
                sa.JSON(),
                nullable=False,
                server_default=sa.text("'[]'"),
            ),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    budget_cols = {col["name"] for col in inspector.get_columns("resource_budgets")}
    request_cols = {col["name"] for col in inspector.get_columns("resource_requests")}

    if "applicable_budget_ids" in request_cols:
        op.drop_column("resource_requests", "applicable_budget_ids")
    if "budget_accounting_managed" in request_cols:
        op.drop_column("resource_requests", "budget_accounting_managed")
    if "budget_reservation_active" in request_cols:
        op.drop_column("resource_requests", "budget_reservation_active")
    if "actual_tokens" in request_cols:
        op.drop_column("resource_requests", "actual_tokens")
    if "actual_cost_usd" in request_cols:
        op.drop_column("resource_requests", "actual_cost_usd")
    if "reserved_tokens" in budget_cols:
        op.drop_column("resource_budgets", "reserved_tokens")
    if "reserved_budget_usd" in budget_cols:
        op.drop_column("resource_budgets", "reserved_budget_usd")
