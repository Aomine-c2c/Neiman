"""add_evolution_and_memory_tables

Revision ID: d14f2e91bfa4
Revises: c83e1091bfa3
Create Date: 2026-10-20 14:30:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "d14f2e91bfa4"
down_revision: str | None = "c83e1091bfa3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. custom_kpi_definitions
    op.create_table(
        "custom_kpi_definitions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("industry", sa.String(length=100), nullable=True),
        sa.Column("dimension", sa.String(length=50), nullable=False),
        sa.Column("metric_key", sa.String(length=100), nullable=False),
        sa.Column("target_benchmark", sa.Float(), nullable=False),
        sa.Column("warning_threshold", sa.Float(), nullable=True),
        sa.Column("unit", sa.String(length=50), nullable=False, server_default="%"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_custom_kpi_definitions_company_id"),
        "custom_kpi_definitions",
        ["company_id"],
        unique=False,
    )

    # 2. organizational_snapshots
    op.create_table(
        "organizational_snapshots",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("snapshot_data", sa.JSON(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_organizational_snapshots_company_id"),
        "organizational_snapshots",
        ["company_id"],
        unique=False,
    )

    # 3. performance_metric_records
    op.create_table(
        "performance_metric_records",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("dimension", sa.String(length=50), nullable=False),
        sa.Column("target_id", sa.String(length=255), nullable=False),
        sa.Column("target_name", sa.String(length=255), nullable=False),
        sa.Column("metric_name", sa.String(length=100), nullable=False),
        sa.Column("actual_value", sa.Float(), nullable=False),
        sa.Column("expected_value", sa.Float(), nullable=True),
        sa.Column("unit", sa.String(length=50), nullable=False, server_default="ratio"),
        sa.Column("sample_size", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("evidence", sa.JSON(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_performance_metric_records_company_id"),
        "performance_metric_records",
        ["company_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_performance_metric_records_dimension"),
        "performance_metric_records",
        ["dimension"],
        unique=False,
    )
    op.create_index(
        op.f("ix_performance_metric_records_metric_name"),
        "performance_metric_records",
        ["metric_name"],
        unique=False,
    )
    op.create_index(
        op.f("ix_performance_metric_records_target_id"),
        "performance_metric_records",
        ["target_id"],
        unique=False,
    )

    # 4. organizational_adaptations
    op.create_table(
        "organizational_adaptations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("adaptation_type", sa.String(length=50), nullable=False),
        sa.Column("stage", sa.String(length=50), nullable=False, server_default="PROPOSE"),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="PROPOSED"),
        sa.Column("trigger_diagnosis", sa.Text(), nullable=False),
        sa.Column("evidence", sa.JSON(), nullable=False),
        sa.Column("previous_state", sa.JSON(), nullable=False),
        sa.Column("proposed_state", sa.JSON(), nullable=False),
        sa.Column("expected_improvement", sa.Text(), nullable=False),
        sa.Column("risk_assessment", sa.Text(), nullable=False),
        sa.Column("risk_level", sa.String(length=50), nullable=False, server_default="MEDIUM"),
        sa.Column("simulation_results", sa.JSON(), nullable=False),
        sa.Column("validation_passed", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("snapshot_id", sa.Uuid(), nullable=True),
        sa.Column("approved_by", sa.String(length=255), nullable=True),
        sa.Column("deployed_at", sa.String(length=50), nullable=True),
        sa.Column("actual_result", sa.JSON(), nullable=False),
        sa.Column("rollback_reason", sa.Text(), nullable=True),
        sa.Column("learning_notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["snapshot_id"], ["organizational_snapshots.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_organizational_adaptations_company_id"),
        "organizational_adaptations",
        ["company_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_organizational_adaptations_status"),
        "organizational_adaptations",
        ["status"],
        unique=False,
    )

    # 5. simulation_scenarios
    op.create_table(
        "simulation_scenarios",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("baseline_config", sa.JSON(), nullable=False),
        sa.Column("simulated_config", sa.JSON(), nullable=False),
        sa.Column("workload_profile", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="DRAFT"),
        sa.Column("is_promoted", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("promoted_at", sa.String(length=50), nullable=True),
        sa.Column("promoted_by", sa.String(length=255), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_simulation_scenarios_company_id"),
        "simulation_scenarios",
        ["company_id"],
        unique=False,
    )

    # 6. simulation_runs
    op.create_table(
        "simulation_runs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("scenario_id", sa.Uuid(), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("run_label", sa.String(length=255), nullable=False),
        sa.Column("workload_tasks_count", sa.Integer(), nullable=False, server_default="50"),
        sa.Column("tasks_succeeded", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("tasks_failed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("duration_ms", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("metrics_comparison", sa.JSON(), nullable=False),
        sa.Column("experimental_disclaimer", sa.Text(), nullable=False),
        sa.Column("insights", sa.JSON(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["scenario_id"], ["simulation_scenarios.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_simulation_runs_company_id"), "simulation_runs", ["company_id"], unique=False
    )
    op.create_index(
        op.f("ix_simulation_runs_scenario_id"), "simulation_runs", ["scenario_id"], unique=False
    )

    # 7. knowledge_entities
    op.create_table(
        "knowledge_entities",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("entity_type", sa.String(length=50), nullable=False, server_default="CONCEPT"),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("properties", sa.JSON(), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_knowledge_entities_company_id"), "knowledge_entities", ["company_id"], unique=False
    )
    op.create_index(
        op.f("ix_knowledge_entities_name"), "knowledge_entities", ["name"], unique=False
    )
    op.create_index(
        op.f("ix_knowledge_entities_entity_type"),
        "knowledge_entities",
        ["entity_type"],
        unique=False,
    )

    # 8. knowledge_relations
    op.create_table(
        "knowledge_relations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("source_id", sa.Uuid(), nullable=False),
        sa.Column("target_id", sa.Uuid(), nullable=False),
        sa.Column("relation_type", sa.String(length=100), nullable=False),
        sa.Column("weight", sa.Float(), nullable=False, server_default="1.0"),
        sa.Column("provenance", sa.String(length=255), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["source_id"], ["knowledge_entities.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["target_id"], ["knowledge_entities.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_knowledge_relations_company_id"),
        "knowledge_relations",
        ["company_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_knowledge_relations_source_id"), "knowledge_relations", ["source_id"], unique=False
    )
    op.create_index(
        op.f("ix_knowledge_relations_target_id"), "knowledge_relations", ["target_id"], unique=False
    )
    op.create_index(
        op.f("ix_knowledge_relations_relation_type"),
        "knowledge_relations",
        ["relation_type"],
        unique=False,
    )

    # 9. agent_core_memory_blocks
    op.create_table(
        "agent_core_memory_blocks",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("agent_id", sa.Uuid(), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("block_name", sa.String(length=50), nullable=False),
        sa.Column("label", sa.String(length=100), nullable=False),
        sa.Column("content", sa.Text(), nullable=False, server_default=""),
        sa.Column("char_limit", sa.Integer(), nullable=False, server_default="2000"),
        sa.Column("is_read_only", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.ForeignKeyConstraint(["agent_id"], ["agents.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_agent_core_memory_blocks_agent_id"),
        "agent_core_memory_blocks",
        ["agent_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_agent_core_memory_blocks_company_id"),
        "agent_core_memory_blocks",
        ["company_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_agent_core_memory_blocks_block_name"),
        "agent_core_memory_blocks",
        ["block_name"],
        unique=False,
    )

    # 10. agent_recall_logs
    op.create_table(
        "agent_recall_logs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("agent_id", sa.Uuid(), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("role", sa.String(length=50), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("tool_calls", sa.JSON(), nullable=False),
        sa.Column("tool_call_id", sa.String(length=100), nullable=True),
        sa.Column("estimated_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_evicted", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.ForeignKeyConstraint(["agent_id"], ["agents.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_agent_recall_logs_agent_id"), "agent_recall_logs", ["agent_id"], unique=False
    )
    op.create_index(
        op.f("ix_agent_recall_logs_company_id"), "agent_recall_logs", ["company_id"], unique=False
    )


def downgrade() -> None:
    op.drop_table("agent_recall_logs")
    op.drop_table("agent_core_memory_blocks")
    op.drop_table("knowledge_relations")
    op.drop_table("knowledge_entities")
    op.drop_table("simulation_runs")
    op.drop_table("simulation_scenarios")
    op.drop_table("organizational_adaptations")
    op.drop_table("performance_metric_records")
    op.drop_table("organizational_snapshots")
    op.drop_table("custom_kpi_definitions")
