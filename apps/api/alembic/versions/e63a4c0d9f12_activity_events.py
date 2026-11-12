"""Create tenant-scoped persistent activity events."""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "e63a4c0d9f12"
down_revision: str | None = "d14f2e91bfa4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = inspector.get_table_names()

    if "activity_events" not in tables:
        op.create_table(
            "activity_events",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("company_id", sa.String(length=36), nullable=False),
            sa.Column("event_type", sa.String(length=64), nullable=False),
            sa.Column("severity", sa.String(length=16), nullable=False),
            sa.Column("title", sa.String(length=255), nullable=False),
            sa.Column("summary", sa.Text(), nullable=False),
            sa.Column("agent_id", sa.String(length=36), nullable=True),
            sa.Column("agent_name", sa.String(length=255), nullable=True),
            sa.Column("department_id", sa.String(length=36), nullable=True),
            sa.Column("department_name", sa.String(length=255), nullable=True),
            sa.Column("project_id", sa.String(length=36), nullable=True),
            sa.Column("project_name", sa.String(length=255), nullable=True),
            sa.Column("payload", sa.JSON(), nullable=False),
            sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_activity_events_company_id", "activity_events", ["company_id"])
        op.create_index("ix_activity_events_timestamp", "activity_events", ["timestamp"])
        op.create_index(
            "ix_activity_events_company_timestamp",
            "activity_events",
            ["company_id", "timestamp"],
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = inspector.get_table_names()

    if "activity_events" in tables:
        op.drop_index("ix_activity_events_company_timestamp", table_name="activity_events")
        op.drop_index("ix_activity_events_timestamp", table_name="activity_events")
        op.drop_index("ix_activity_events_company_id", table_name="activity_events")
        op.drop_table("activity_events")
