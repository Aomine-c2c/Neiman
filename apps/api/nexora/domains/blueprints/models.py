"""
Blueprint domain models:
- CompanyBlueprint (Preconfigured organizational template)
- BlueprintGeneration (Build My Company natural language generation proposal)
"""

import uuid

from sqlalchemy import (
    JSON,
    Boolean,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column

from nexora.core.base import UUIDTimestampBase


class CompanyBlueprint(UUIDTimestampBase):
    """
    A comprehensive preconfigured organizational blueprint that can be
    customized, duplicated, imported, exported, saved as template, and instantiated into a real Company.
    """

    __tablename__ = "company_blueprints"

    # Identity & Category
    key: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    tagline: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    icon: Mapped[str] = mapped_column(String(50), default="building", nullable=False)
    is_system_template: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    # Optional origin company / creator
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    source_company_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("companies.id", ondelete="SET NULL"), nullable=True
    )

    # Organizational Structure Specification
    company_definition: Mapped[dict] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
        comment="{name, mission, vision, industry, dna: {operating_philosophy, risk_tolerance, autonomy_level...}}",
    )
    departments: Mapped[list] = mapped_column(
        JSON, default=list, nullable=False, comment="[{name, purpose, roles: [...]}]"
    )
    roles: Mapped[list] = mapped_column(
        JSON,
        default=list,
        nullable=False,
        comment="[{department_name, title, responsibilities, capabilities, authority, autonomy_level}]",
    )
    agents: Mapped[list] = mapped_column(
        JSON,
        default=list,
        nullable=False,
        comment="[{name, role_title, department_name, system_instructions, responsibilities, capabilities, tools, autonomy_level, intelligence_config, resource_limits}]",
    )
    workflows: Mapped[list] = mapped_column(
        JSON,
        default=list,
        nullable=False,
        comment="[{name, description, trigger_type, steps: [...]}]",
    )
    policies: Mapped[list] = mapped_column(
        JSON,
        default=list,
        nullable=False,
        comment="[{name, description, scope, rules: [...], enforcement_level}]",
    )
    constitution: Mapped[dict] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
        comment="{mission, values, operating_principles, prohibited_actions, approval_requirements, security_rules, financial_rules, data_rules, autonomy_boundaries, escalation_rules}",
    )

    # Operational Requirements & Metrics
    recommended_tools: Mapped[list] = mapped_column(
        JSON, default=list, nullable=False, comment="[{name, description, category, risk_level}]"
    )
    intelligence_requirements: Mapped[dict] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
        comment="{capabilities_required: [...], recommended_models: [...], context_capacity: str}",
    )
    resource_policies: Mapped[dict] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
        comment="{compute: {...}, intelligence: {...}, financial_budget_usd: float, execution_slots: int}",
    )
    kpis: Mapped[list] = mapped_column(
        JSON, default=list, nullable=False, comment="[{name, metric, target, review_frequency}]"
    )
    approval_rules: Mapped[list] = mapped_column(
        JSON,
        default=list,
        nullable=False,
        comment="[{action, condition, approver_role, risk_level}]",
    )
    default_autonomy: Mapped[int] = mapped_column(
        Integer, default=3, nullable=False, comment="Default global autonomy level: 0 to 5"
    )
    escalation_rules: Mapped[list] = mapped_column(
        JSON, default=list, nullable=False, comment="[{trigger, route_to, severity, sla_minutes}]"
    )

    # Cost & Feasibility Estimates
    estimated_monthly_cost_usd: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    metadata_tags: Mapped[list] = mapped_column(JSON, default=list, nullable=False)


class BlueprintGenerationProposal(UUIDTimestampBase):
    """
    Stores a 'Build My Company' natural language generation proposal
    before it is approved and instantiated.
    """

    __tablename__ = "blueprint_generation_proposals"

    prompt: Mapped[str] = mapped_column(
        Text, nullable=False, comment="User natural language organization description"
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(50), default="PROPOSED", nullable=False
    )  # PROPOSED | APPROVED | INSTANTIATED | DISCARDED

    # Analysis & Synthesis Results
    proposed_blueprint: Mapped[dict] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
        comment="Complete synthesized Blueprint JSON structure ready for instantiation",
    )
    estimated_operating_cost: Mapped[dict] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
        comment="{total_monthly_usd, token_cost_usd, compute_cost_usd, staffing_ratio}",
    )
    risks_identified: Mapped[list] = mapped_column(
        JSON, default=list, nullable=False, comment="[{risk, severity, mitigation}]"
    )
    # 12-Step Synthesis Pipeline Artifacts
    generation_stages: Mapped[dict] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
        comment="Tracks stages: user_description, requirement_analysis, industry_identification, organizational_design, department_generation, role_generation, agent_generation, workflow_generation, policy_generation, resource_model, intelligence_requirements, risk_analysis",
    )
    simulation_results: Mapped[dict] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
        comment="Dry-run simulation benchmark metrics (cost, latency, throughput, quality) before review/approval",
    )
    human_approval_requirements: Mapped[list] = mapped_column(
        JSON,
        default=list,
        nullable=False,
        comment="Mandatory governance sign-off criteria before real organization instantiation",
    )
    estimated_operational_complexity: Mapped[str] = mapped_column(
        String(50), default="MODERATE", nullable=False
    )
    instantiated_company_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("companies.id", ondelete="SET NULL"), nullable=True
    )
