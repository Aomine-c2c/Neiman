"""
Service layer for NEIMAN Organizational Positions & Governance Foundation.
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from nexora.core.enums import MembershipRole
from nexora.domains.positions.enforcer import get_position_enforcer
from nexora.domains.positions.loader import get_position_loader
from nexora.domains.positions.schemas import (
    CompanyConstitutionSpec,
    CompanyGovernancePolicySpec,
    PositionDefinition,
    RuntimeActionRequest,
    RuntimeEvaluationResult,
)
from nexora.exceptions import NotFoundError


class PositionService:
    def __init__(self, db: AsyncSession | None = None):
        self.db = db
        self.loader = get_position_loader()
        self.enforcer = get_position_enforcer()

    def list_positions(self) -> list[PositionDefinition]:
        """Returns all 13 canonical organizational positions."""
        all_pos = self.loader.load_all_positions()
        return list(all_pos.values())

    def get_position(self, position_key: str) -> PositionDefinition:
        """Returns a specific position by its unique slug."""
        try:
            return self.loader.load_position(position_key)
        except FileNotFoundError:
            raise NotFoundError(f"Position '{position_key}' not found in organizational catalog.")

    def get_constitution(self) -> CompanyConstitutionSpec:
        """Returns the shared corporate constitution."""
        return self.loader.load_company_constitution()

    def get_governance_policies(self) -> CompanyGovernancePolicySpec:
        """Returns the shared corporate governance policies."""
        return self.loader.load_company_policies()

    def evaluate_action(self, request: RuntimeActionRequest) -> RuntimeEvaluationResult:
        """Evaluates whether an action is permitted by the runtime permission enforcer."""
        # Ensure position exists first
        self.get_position(request.position_key)
        return self.enforcer.authorize_action(request)

    def validate_and_assign_position(
        self,
        company_id: uuid.UUID,
        position_key: str,
        is_human: bool,
        membership_role: MembershipRole | str | None = None,
        agent_id: uuid.UUID | None = None,
        user_id: uuid.UUID | None = None,
    ) -> dict[str, Any]:
        """
        Validates position assignment rules, strictly enforcing that CEO is human-only.
        """
        pos = self.get_position(position_key)
        self.enforcer.assert_position_assignment(position_key, is_human, membership_role)

        return {
            "company_id": str(company_id),
            "position_key": position_key,
            "title": pos.title,
            "department": pos.department,
            "is_human_only": pos.is_human_only,
            "assigned_to": str(user_id if is_human else agent_id),
            "actor_type": "HUMAN" if is_human else "AGENT",
            "status": "ASSIGNED",
            "autonomy_level": pos.default_autonomy_level,
        }

    def get_change_history(self) -> list[dict[str, Any]]:
        """Returns the version change history and cryptographic hashes for all positions."""
        return self.loader.get_change_history()
