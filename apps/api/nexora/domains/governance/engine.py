"""
Governance Evaluation Engine:
Evaluates whether any organizational action is permitted, prohibited, or requires approval.
Implements the 6-tier Autonomy Matrix (LEVEL 0 to 5) across Company, Department, Role, Agent, Tool, Task Type, and Action scopes.
"""

import uuid
from typing import Any

from nexora.core.enums import GovernanceAutonomyLevel, GovernanceRiskLevel
from nexora.domains.governance.models import AutonomyConfig, CompanyConstitution


class GovernanceEngine:
    @staticmethod
    def resolve_effective_autonomy(
        configs: list[AutonomyConfig],
        department_id: uuid.UUID | None = None,
        role_id: uuid.UUID | None = None,
        agent_id: uuid.UUID | None = None,
        tool_name: str | None = None,
        task_type: str | None = None,
        action_name: str | None = None,
    ) -> tuple[int, AutonomyConfig | None]:
        """
        Calculates the effective autonomy level by evaluating highest-precedence specific rules:
        1. Action-level config
        2. Tool-level config
        3. Agent-level config
        4. Role-level config
        5. Department-level config
        6. Task-type config
        7. Default Company baseline (LEVEL 2: EXECUTE_WITH_APPROVAL / LEVEL 3: EXECUTE_WITHIN_POLICY)
        """
        # Score matches by specificity
        best_match: AutonomyConfig | None = None
        best_score = -1

        for cfg in configs:
            score = 0
            if cfg.action_name and cfg.action_name == action_name:
                score += 100
            elif cfg.action_name and cfg.action_name != action_name:
                continue

            if cfg.tool_name and cfg.tool_name == tool_name:
                score += 80
            elif cfg.tool_name and cfg.tool_name != tool_name:
                continue

            if cfg.agent_id and cfg.agent_id == agent_id:
                score += 60
            elif cfg.agent_id and cfg.agent_id != agent_id:
                continue

            if cfg.role_id and cfg.role_id == role_id:
                score += 40
            elif cfg.role_id and cfg.role_id != role_id:
                continue

            if cfg.department_id and cfg.department_id == department_id:
                score += 20
            elif cfg.department_id and cfg.department_id != department_id:
                continue

            if cfg.task_type and cfg.task_type == task_type:
                score += 10
            elif cfg.task_type and cfg.task_type != task_type:
                continue

            # Pure company-wide fallback
            if (
                not cfg.action_name
                and not cfg.tool_name
                and not cfg.agent_id
                and not cfg.role_id
                and not cfg.department_id
                and not cfg.task_type
            ):
                score = 1

            if score > best_score:
                best_score = score
                best_match = cfg

        if best_match:
            return best_match.autonomy_level, best_match

        # Default organizational conservative baseline is LEVEL 2 (EXECUTE_WITH_APPROVAL)
        return GovernanceAutonomyLevel.LEVEL_2.value, None

    @staticmethod
    def evaluate_constitution_compliance(
        constitution: CompanyConstitution | None,
        action_name: str,
        target: str,
        reason: str,
        payload: dict[str, Any],
        declared_risk: GovernanceRiskLevel | None = None,
    ) -> tuple[bool, str | None, bool]:
        """
        Verifies whether an action violates prohibited actions or triggers approval requirements in the constitution.
        Returns: (is_prohibited, matched_clause, mandatory_approval_required)
        """
        if not constitution or not constitution.is_active:
            return False, None, False

        text_to_check = f"{action_name} {target} {reason} {payload}".lower()

        # Check prohibited actions
        for prohibited in constitution.prohibited_actions:
            p_lower = prohibited.lower()
            if p_lower in text_to_check:
                return True, prohibited, True
            # Also check for distinctive 2+ word keyphrases
            phrases = [
                "exfiltration",
                "unapproved financial",
                "bypassing policy",
                "modifying company charter",
            ]
            if any(phrase in p_lower and phrase in text_to_check for phrase in phrases):
                return True, prohibited, True

        # Check approval requirements
        for req in constitution.approval_requirements:
            r_lower = req.lower()
            if r_lower in text_to_check:
                return False, req, True
            phrases = [
                "production infrastructure",
                "outbound payment",
                "granting role:admin",
                "database drop",
            ]
            if any(phrase in r_lower and phrase in text_to_check for phrase in phrases):
                return False, req, True

        # High-risk operations require explicit approval unless deliberately overridden
        if declared_risk in (GovernanceRiskLevel.HIGH, GovernanceRiskLevel.CRITICAL):
            return False, "High-risk operation mandatory approval requirement", True

        return False, None, False
