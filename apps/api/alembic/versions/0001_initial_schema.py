"""Initial schema — all NEIMAN core entities

Revision ID: 0001
Revises:
Create Date: 2026-09-25
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Offline SQL generation has no live schema to inspect. It always starts
    # from the Alembic base revision, so emit the complete initial schema.
    if op.get_context().as_sql:
        existing: set[str] = set()
    else:
        bind = op.get_bind()
        insp = sa.inspect(bind)
        existing = set(insp.get_table_names())

    # ── users ──────────────────────────────────────────────────────────────
    if "users" not in existing:
        op.create_table(
            "users",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("email", sa.String(320), nullable=False),
            sa.Column("username", sa.String(50), nullable=False),
            sa.Column("password_hash", sa.String(255), nullable=False),
            sa.Column("first_name", sa.String(100), nullable=False, server_default=""),
            sa.Column("last_name", sa.String(100), nullable=False, server_default=""),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default="1"),
            sa.Column("is_superuser", sa.Boolean(), nullable=False, server_default="0"),
            sa.Column(
                "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
            ),
            sa.Column(
                "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
            ),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_users_email", "users", ["email"], unique=True)
        op.create_index("ix_users_username", "users", ["username"], unique=True)

    # ── companies ──────────────────────────────────────────────────────────
    if "companies" not in existing:
        op.create_table(
            "companies",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("slug", sa.String(100), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("mission", sa.Text(), nullable=True),
            sa.Column("vision", sa.Text(), nullable=True),
            sa.Column("industry", sa.String(100), nullable=True),
            sa.Column("status", sa.String(20), nullable=False, server_default="ACTIVE"),
            sa.Column("owner_id", sa.Uuid(), nullable=False),
            sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default="0"),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column(
                "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
            ),
            sa.Column(
                "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
            ),
            sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="RESTRICT"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_companies_slug", "companies", ["slug"], unique=True)
        op.create_index("ix_companies_owner_id", "companies", ["owner_id"])

    # ── organizational_dna ─────────────────────────────────────────────────
    if "organizational_dna" not in existing:
        op.create_table(
            "organizational_dna",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("company_id", sa.Uuid(), nullable=False),
            sa.Column("operating_philosophy", sa.Text(), nullable=True),
            sa.Column("innovation_level", sa.String(20), nullable=False, server_default="MODERATE"),
            sa.Column("autonomy_level", sa.String(20), nullable=False, server_default="BALANCED"),
            sa.Column("risk_tolerance", sa.String(20), nullable=False, server_default="MODERATE"),
            sa.Column("quality_threshold", sa.String(20), nullable=False, server_default="STANDARD"),
            sa.Column("decision_style", sa.String(20), nullable=False, server_default="CONSULTATIVE"),
            sa.Column(
                "communication_style", sa.String(20), nullable=False, server_default="SEMI_FORMAL"
            ),
            sa.Column("resource_strategy", sa.String(20), nullable=False, server_default="BALANCED"),
            sa.Column(
                "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
            ),
            sa.Column(
                "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
            ),
            sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("company_id"),
        )

    # ── departments ────────────────────────────────────────────────────────
    if "departments" not in existing:
        op.create_table(
            "departments",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("company_id", sa.Uuid(), nullable=False),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("purpose", sa.Text(), nullable=True),
            sa.Column("status", sa.String(20), nullable=False, server_default="ACTIVE"),
            sa.Column("parent_id", sa.Uuid(), nullable=True),
            sa.Column("manager_id", sa.Uuid(), nullable=True),
            sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default="0"),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column(
                "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
            ),
            sa.Column(
                "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
            ),
            sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["parent_id"], ["departments.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["manager_id"], ["users.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_departments_company_id", "departments", ["company_id"])
        op.create_index("ix_departments_parent_id", "departments", ["parent_id"])

    # ── org_roles ──────────────────────────────────────────────────────────
    if "org_roles" not in existing:
        op.create_table(
            "org_roles",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("department_id", sa.Uuid(), nullable=False),
            sa.Column("company_id", sa.Uuid(), nullable=False),
            sa.Column("title", sa.String(255), nullable=False),
            sa.Column("responsibilities", sa.JSON(), nullable=False),
            sa.Column("capabilities", sa.JSON(), nullable=False),
            sa.Column("authority", sa.String(20), nullable=False, server_default="READ"),
            sa.Column("required_skills", sa.JSON(), nullable=False),
            sa.Column("autonomy_level", sa.String(20), nullable=False, server_default="GUIDED"),
            sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default="0"),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column(
                "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
            ),
            sa.Column(
                "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
            ),
            sa.ForeignKeyConstraint(["department_id"], ["departments.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_org_roles_department_id", "org_roles", ["department_id"])
        op.create_index("ix_org_roles_company_id", "org_roles", ["company_id"])

    # ── company_members ────────────────────────────────────────────────────
    if "company_members" not in existing:
        op.create_table(
            "company_members",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("company_id", sa.Uuid(), nullable=False),
            sa.Column("user_id", sa.Uuid(), nullable=False),
            sa.Column("role", sa.String(20), nullable=False, server_default="MEMBER"),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default="1"),
            sa.Column(
                "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
            ),
            sa.Column(
                "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
            ),
            sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("company_id", "user_id", name="uq_company_member"),
        )
        op.create_index("ix_company_members_company_id", "company_members", ["company_id"])
        op.create_index("ix_company_members_user_id", "company_members", ["user_id"])

    # ── agents ─────────────────────────────────────────────────────────────
    if "agents" not in existing:
        op.create_table(
            "agents",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("company_id", sa.Uuid(), nullable=False),
            sa.Column("role_id", sa.Uuid(), nullable=True),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("identity", sa.JSON(), nullable=False),
            sa.Column("system_instructions", sa.Text(), nullable=True),
            sa.Column("capabilities", sa.JSON(), nullable=False),
            sa.Column("permissions", sa.JSON(), nullable=False),
            sa.Column("autonomy", sa.String(20), nullable=False, server_default="SUPERVISED"),
            sa.Column("status", sa.String(20), nullable=False, server_default="ACTIVE"),
            sa.Column("intelligence_config", sa.JSON(), nullable=False),
            sa.Column("performance_metadata", sa.JSON(), nullable=False),
            sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default="0"),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column(
                "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
            ),
            sa.Column(
                "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
            ),
            sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["role_id"], ["org_roles.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_agents_company_id", "agents", ["company_id"])
        op.create_index("ix_agents_role_id", "agents", ["role_id"])

    # ── projects ───────────────────────────────────────────────────────────
    if "projects" not in existing:
        op.create_table(
            "projects",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("company_id", sa.Uuid(), nullable=False),
            sa.Column("owner_id", sa.Uuid(), nullable=False),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("objective", sa.Text(), nullable=True),
            sa.Column("priority", sa.String(20), nullable=False, server_default="MEDIUM"),
            sa.Column("status", sa.String(20), nullable=False, server_default="DRAFT"),
            sa.Column("milestones", sa.JSON(), nullable=False),
            sa.Column("deadline", sa.DateTime(timezone=True), nullable=True),
            sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default="0"),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column(
                "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
            ),
            sa.Column(
                "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
            ),
            sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="RESTRICT"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_projects_company_id", "projects", ["company_id"])

    # ── tasks ──────────────────────────────────────────────────────────────
    if "tasks" not in existing:
        op.create_table(
            "tasks",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("project_id", sa.Uuid(), nullable=False),
            sa.Column("company_id", sa.Uuid(), nullable=False),
            sa.Column("assigned_agent_id", sa.Uuid(), nullable=True),
            sa.Column("title", sa.String(255), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("priority", sa.String(20), nullable=False, server_default="MEDIUM"),
            sa.Column("status", sa.String(20), nullable=False, server_default="PENDING"),
            sa.Column("dependencies", sa.JSON(), nullable=False),
            sa.Column("resource_requirements", sa.JSON(), nullable=False),
            sa.Column("expected_outcome", sa.Text(), nullable=True),
            sa.Column("due_date", sa.DateTime(timezone=True), nullable=True),
            sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default="0"),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column(
                "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
            ),
            sa.Column(
                "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
            ),
            sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["assigned_agent_id"], ["agents.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_tasks_project_id", "tasks", ["project_id"])
        op.create_index("ix_tasks_company_id", "tasks", ["company_id"])
        op.create_index("ix_tasks_assigned_agent_id", "tasks", ["assigned_agent_id"])

    # ── workflows ──────────────────────────────────────────────────────────
    if "workflows" not in existing:
        op.create_table(
            "workflows",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("company_id", sa.Uuid(), nullable=False),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("trigger_type", sa.String(20), nullable=False, server_default="MANUAL"),
            sa.Column("trigger_config", sa.JSON(), nullable=False),
            sa.Column("steps", sa.JSON(), nullable=False),
            sa.Column("agents", sa.JSON(), nullable=False),
            sa.Column("tools", sa.JSON(), nullable=False),
            sa.Column("conditions", sa.JSON(), nullable=False),
            sa.Column("approvals", sa.JSON(), nullable=False),
            sa.Column("completion_criteria", sa.JSON(), nullable=False),
            sa.Column("status", sa.String(20), nullable=False, server_default="DRAFT"),
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
        op.create_index("ix_workflows_company_id", "workflows", ["company_id"])

    # ── policies ───────────────────────────────────────────────────────────
    if "policies" not in existing:
        op.create_table(
            "policies",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("company_id", sa.Uuid(), nullable=False),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("scope", sa.String(20), nullable=False, server_default="COMPANY"),
            sa.Column("scope_id", sa.Uuid(), nullable=True),
            sa.Column("rules", sa.JSON(), nullable=False),
            sa.Column("enforcement_level", sa.String(20), nullable=False, server_default="SOFT"),
            sa.Column("status", sa.String(20), nullable=False, server_default="DRAFT"),
            sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
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
        op.create_index("ix_policies_company_id", "policies", ["company_id"])
        op.create_index("ix_policies_scope_id", "policies", ["scope_id"])

    # ── decisions ──────────────────────────────────────────────────────────
    if "decisions" not in existing:
        op.create_table(
            "decisions",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("company_id", sa.Uuid(), nullable=False),
            sa.Column("title", sa.String(255), nullable=False),
            sa.Column("problem", sa.Text(), nullable=False),
            sa.Column("proposals", sa.JSON(), nullable=False),
            sa.Column("evidence", sa.JSON(), nullable=False),
            sa.Column("participants", sa.JSON(), nullable=False),
            sa.Column("decision", sa.Text(), nullable=True),
            sa.Column("rationale", sa.Text(), nullable=True),
            sa.Column("expected_outcome", sa.Text(), nullable=True),
            sa.Column("actual_outcome", sa.Text(), nullable=True),
            sa.Column("status", sa.String(20), nullable=False, server_default="OPEN"),
            sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("decided_by_id", sa.Uuid(), nullable=True),
            sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default="0"),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column(
                "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
            ),
            sa.Column(
                "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
            ),
            sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["decided_by_id"], ["users.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_decisions_company_id", "decisions", ["company_id"])


def downgrade() -> None:
    op.drop_table("decisions")
    op.drop_table("policies")
    op.drop_table("workflows")
    op.drop_table("tasks")
    op.drop_table("projects")
    op.drop_table("agents")
    op.drop_table("company_members")
    op.drop_table("org_roles")
    op.drop_table("departments")
    op.drop_table("organizational_dna")
    op.drop_table("companies")
    op.drop_table("users")
