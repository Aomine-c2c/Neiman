import uuid
from typing import Any, cast

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from nexora.domains.blueprints.catalog import SYSTEM_BLUEPRINTS
from nexora.domains.blueprints.models import BlueprintGenerationProposal, CompanyBlueprint
from nexora.exceptions import BusinessRuleError


class BlueprintRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, blueprint_id: uuid.UUID) -> CompanyBlueprint | None:
        stmt = select(CompanyBlueprint).where(CompanyBlueprint.id == blueprint_id)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_by_key(self, key: str) -> CompanyBlueprint | None:
        stmt = select(CompanyBlueprint).where(CompanyBlueprint.key == key)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def list_blueprints(
        self,
        category: str | None = None,
        include_custom: bool = True,
        owner_user_id: uuid.UUID | None = None,
        limit: int | None = None,
        offset: int = 0,
    ) -> list[CompanyBlueprint]:
        stmt = select(CompanyBlueprint)
        if category:
            stmt = stmt.where(CompanyBlueprint.category == category)
        if not include_custom:
            stmt = stmt.where(CompanyBlueprint.is_system_template.is_(True))
        elif owner_user_id is not None:
            stmt = stmt.where(
                or_(
                    CompanyBlueprint.is_system_template.is_(True),
                    CompanyBlueprint.created_by_user_id == owner_user_id,
                )
            )
        stmt = stmt.order_by(
            CompanyBlueprint.is_system_template.desc(),
            CompanyBlueprint.name.asc(),
        )
        if limit is not None:
            stmt = stmt.limit(limit).offset(offset)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def create_blueprint(self, **kwargs) -> CompanyBlueprint:
        # Validate required fields
        required = ["key", "name", "tagline", "description", "category"]
        for field in required:
            if field not in kwargs or not kwargs[field]:
                raise BusinessRuleError(f"Missing required field '{field}' for blueprint creation.")
        # Validate key uniqueness
        existing = await self.get_by_key(kwargs["key"])
        if existing:
            raise BusinessRuleError(f"Blueprint with key '{kwargs['key']}' already exists.")
        blueprint = CompanyBlueprint(**kwargs)
        self.db.add(blueprint)
        await self.db.flush()
        await self.db.refresh(blueprint)
        return blueprint

    async def update_blueprint(self, blueprint: CompanyBlueprint, **kwargs) -> CompanyBlueprint:
        changed = False
        for k, v in kwargs.items():
            if v is not None and hasattr(blueprint, k):
                current = getattr(blueprint, k)
                if current != v:
                    setattr(blueprint, k, v)
                    changed = True
        if changed:
            blueprint.version += 1
            await self.db.flush()
            await self.db.refresh(blueprint)
        return blueprint

    async def delete_blueprint(self, blueprint: CompanyBlueprint) -> None:
        if blueprint.is_system_template:
            raise BusinessRuleError(
                "System templates cannot be deleted. Duplicate and customize instead."
            )
        await self.db.delete(blueprint)
        await self.db.flush()

    async def ensure_system_blueprints(self) -> list[CompanyBlueprint]:
        """Ensure all system blueprints exist in the database.
        Only creates missing blueprints; never overwrites existing ones.
        """
        existing = await self.list_blueprints(include_custom=False)
        existing_map = {b.key: b for b in existing}

        created = []
        for bp_data in SYSTEM_BLUEPRINTS:
            key = bp_data.get("key")
            if not key:
                raise BusinessRuleError("System blueprint catalog entry is missing 'key' field.")
            if key in existing_map:
                if key == "software_development_company":
                    existing_bp = existing_map[key]
                    existing_bp.agents = cast(list[Any], bp_data["agents"])
                    existing_bp.roles = cast(list[Any], bp_data["roles"])
                    existing_bp.departments = cast(list[Any], bp_data["departments"])
                    existing_bp.company_definition = cast(dict[str, Any], bp_data["company_definition"])
                    existing_bp.workflows = cast(list[Any], bp_data.get("workflows", []))
                    existing_bp.policies = cast(list[Any], bp_data.get("policies", []))
                    existing_bp.constitution = cast(dict[str, Any], bp_data.get("constitution", {}))
                    self.db.add(existing_bp)
                continue
            bp = CompanyBlueprint(
                key=bp_data["key"],
                name=bp_data["name"],
                tagline=bp_data["tagline"],
                description=bp_data["description"],
                category=bp_data["category"],
                icon=bp_data["icon"],
                is_system_template=True,
                company_definition=bp_data["company_definition"],
                departments=bp_data["departments"],
                roles=bp_data["roles"],
                agents=bp_data["agents"],
                workflows=bp_data["workflows"],
                policies=bp_data["policies"],
                constitution=bp_data["constitution"],
                recommended_tools=bp_data["recommended_tools"],
                intelligence_requirements=bp_data["intelligence_requirements"],
                resource_policies=bp_data["resource_policies"],
                kpis=bp_data["kpis"],
                approval_rules=bp_data["approval_rules"],
                default_autonomy=bp_data.get("default_autonomy", 3),
                escalation_rules=bp_data["escalation_rules"],
                estimated_monthly_cost_usd=bp_data.get("estimated_monthly_cost_usd", 0.0),
                metadata_tags=bp_data.get("metadata_tags", []),
            )
            self.db.add(bp)
            created.append(bp)
        if created:
            await self.db.flush()
        return created

    # -------------------------------------------------------------
    # BUILD MY COMPANY PROPOSALS
    # -------------------------------------------------------------
    async def create_proposal(
        self,
        prompt: str,
        proposed_blueprint: dict,
        estimated_operating_cost: dict,
        risks_identified: list,
        generation_stages: dict,
        simulation_results: dict,
        human_approval_requirements: list,
        estimated_operational_complexity: str = "MODERATE",
        user_id: uuid.UUID | None = None,
    ) -> BlueprintGenerationProposal:
        proposal = BlueprintGenerationProposal(
            prompt=prompt,
            user_id=user_id,
            status="PROPOSED",
            proposed_blueprint=proposed_blueprint,
            estimated_operating_cost=estimated_operating_cost,
            risks_identified=risks_identified,
            generation_stages=generation_stages,
            simulation_results=simulation_results,
            human_approval_requirements=human_approval_requirements,
            estimated_operational_complexity=estimated_operational_complexity,
        )
        self.db.add(proposal)
        await self.db.flush()
        await self.db.refresh(proposal)
        return proposal

    async def get_proposal(self, proposal_id: uuid.UUID) -> BlueprintGenerationProposal | None:
        stmt = select(BlueprintGenerationProposal).where(
            BlueprintGenerationProposal.id == proposal_id
        )
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def update_proposal(
        self, proposal: BlueprintGenerationProposal, **kwargs
    ) -> BlueprintGenerationProposal:
        # Validate status transitions
        if proposal.status in ("DISCARDED", "INSTANTIATED"):
            raise BusinessRuleError(f"Cannot update proposal in '{proposal.status}' status.")
        for k, v in kwargs.items():
            if hasattr(proposal, k):
                setattr(proposal, k, v)
        await self.db.flush()
        await self.db.refresh(proposal)
        return proposal
