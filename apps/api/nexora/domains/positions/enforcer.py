"""
Runtime Permission Enforcer for NEIMAN Organizational Positions.

Enforces:
1. Markdown documents are advisory declarations; security boundaries are strictly enforced here in code.
2. The CEO position must remain assigned to the human owner by default (rejects agent assignments).
3. Deny-by-default tool authorization: tools must be explicitly declared in position permissions.
4. Company Constitution prohibited actions strictly override any departmental permission.
5. High-risk operations exceeding autonomy limits or flagged for approval require Level-2 human sign-off.
6. Cryptographic SHA-256 audit attestation for all authorization evaluations.
"""

from __future__ import annotations

import hashlib
from datetime import UTC, datetime

from nexora.core.enums import MembershipRole
from nexora.domains.positions.loader import get_position_loader
from nexora.domains.positions.schemas import (
    PositionDefinition,
    RuntimeActionRequest,
    RuntimeEvaluationResult,
)
from nexora.exceptions import ForbiddenError, PermissionDeniedError


class RuntimePositionPermissionEnforcer:
    def __init__(self, loader=None):
        self.loader = loader or get_position_loader()

    def verify_position_assignment(
        self,
        position_key: str,
        is_human: bool,
        membership_role: MembershipRole | str | None = None,
    ) -> tuple[bool, str | None]:
        """
        Validates whether an actor (human or agent) is eligible to be assigned to a position.
        The CEO position is strictly reserved for the human owner.
        """
        pos = self.loader.load_position(position_key)

        # Enforce Human-Only rule on CEO position
        if pos.is_human_only or position_key == "ceo":
            if not is_human:
                return False, "The CEO position is strictly reserved for the human owner and cannot be assigned to an autonomous AI agent."

            # Enforce owner membership role
            role_str = membership_role.value if isinstance(membership_role, MembershipRole) else str(membership_role or "")
            if role_str.upper() not in ("OWNER", "ADMIN"):
                return False, "Only the company owner (human CEO) may hold the CEO position."

        return True, None

    def assert_position_assignment(
        self,
        position_key: str,
        is_human: bool,
        membership_role: MembershipRole | str | None = None,
    ) -> None:
        """Raises PermissionDeniedError if the assignment violates organizational invariants."""
        valid, reason = self.verify_position_assignment(position_key, is_human, membership_role)
        if not valid:
            raise PermissionDeniedError(reason or "Unauthorized position assignment.")

    def authorize_action(self, request: RuntimeActionRequest) -> RuntimeEvaluationResult:
        """
        Authoritatively evaluates whether an agent action or tool invocation is permitted,
        requires human sign-off, or is denied.
        """
        now = datetime.now(UTC)
        pos: PositionDefinition = self.loader.load_position(request.position_key)
        constitution = self.loader.load_company_constitution()

        def _make_result(
            permitted: bool,
            reason: str,
            requires_approval: bool = False,
            matched_clause: str | None = None,
        ) -> RuntimeEvaluationResult:
            payload_str = f"{request.company_id}:{request.position_key}:{request.action_name}:{request.tool_name}:{permitted}:{requires_approval}:{now.isoformat()}"
            sig = hashlib.sha256(payload_str.encode("utf-8")).hexdigest()
            return RuntimeEvaluationResult(
                permitted=permitted,
                requires_human_approval=requires_approval,
                reason=reason,
                effective_autonomy_level=pos.permissions.max_autonomy_level,
                matched_policy_clause=matched_clause,
                audit_signature=sig,
                timestamp=now,
            )

        # 1. Guard against autonomous agents assuming CEO position authority
        if request.position_key == "ceo" and not request.actor_is_human:
            return _make_result(
                permitted=False,
                reason="Policy Violation: Autonomous agents are forbidden from executing sovereign CEO actions.",
                matched_clause="ACTION_AUTONOMOUS_CEO_ASSUMPTION",
            )

        # 2. Check Company Constitution Prohibited Actions (Non-negotiable company-wide overrides)
        norm_action = request.action_name.upper().strip()
        for prohibited in constitution.prohibited_actions:
            if norm_action == prohibited or prohibited in norm_action:
                return _make_result(
                    permitted=False,
                    reason=f"Company Constitution Violation: Action '{request.action_name}' is explicitly prohibited by company charter.",
                    matched_clause=prohibited,
                )

        # Check dangerous keyword substrings in action, tool, or target
        danger_checks = [
            ("drop table", "ACTION_DROP_PRODUCTION_DATABASE"),
            ("drop_table", "ACTION_DROP_PRODUCTION_DATABASE"),
            ("drop database", "ACTION_DROP_PRODUCTION_DATABASE"),
            ("truncate", "ACTION_DROP_PRODUCTION_DATABASE"),
            ("exfiltrate", "ACTION_EXFILTRATE_DATA"),
            ("tamper_audit", "ACTION_TAMPER_AUDIT_LOGS"),
            ("delete_audit", "ACTION_TAMPER_AUDIT_LOGS"),
        ]
        text_context = f"{request.action_name} {request.tool_name or ''} {request.target_resource}".lower()
        for phrase, clause in danger_checks:
            if phrase in text_context and not (request.actor_is_human and request.position_key == "ceo"):
                return _make_result(
                    permitted=False,
                    reason=f"Company Constitution Violation: Action matched prohibited pattern '{phrase}'.",
                    matched_clause=clause,
                )

        # 3. Check Position-Specific Denied Actions
        for denied_act in pos.permissions.denied_actions:
            if norm_action == denied_act.upper() or denied_act.upper() in norm_action:
                return _make_result(
                    permitted=False,
                    reason=f"Position Permission Violation: Action '{request.action_name}' is explicitly denied for position '{pos.title}'.",
                    matched_clause=denied_act,
                )

        # 4. Check Position-Specific Denied Tools
        if request.tool_name:
            norm_tool = request.tool_name.strip()
            for denied_tool in pos.permissions.denied_tools:
                if norm_tool == denied_tool or denied_tool in norm_tool:
                    return _make_result(
                        permitted=False,
                        reason=f"Position Permission Violation: Tool '{request.tool_name}' is explicitly denied for position '{pos.title}'.",
                        matched_clause=denied_tool,
                    )

        # 5. Deny-by-Default Tool Authorization
        if request.tool_name:
            norm_tool = request.tool_name.strip()
            allowed = pos.permissions.allowed_tools
            # Check if allowed or wildcard
            if "all_administrative_tools" not in allowed and norm_tool not in allowed:
                return _make_result(
                    permitted=False,
                    reason=f"Least Privilege Violation: Tool '{request.tool_name}' is not in the authorized tool allowlist for position '{pos.title}'.",
                    matched_clause="DENY_BY_DEFAULT_TOOL_CHECK",
                )

        # 6. Autonomy Ceiling Check
        if request.declared_autonomy_level > pos.permissions.max_autonomy_level:
            return _make_result(
                permitted=False,
                reason=f"Autonomy Violation: Requested autonomy Level {request.declared_autonomy_level} exceeds position ceiling Level {pos.permissions.max_autonomy_level}.",
                matched_clause="AUTONOMY_CEILING_EXCEEDED",
            )

        # 7. Human Approval Triggers (Level 2 Gates)
        for req_appr in pos.permissions.requires_human_approval_for:
            if req_appr.lower() in text_context or norm_action in req_appr.upper():
                return _make_result(
                    permitted=True,
                    requires_approval=True,
                    reason=f"Action permitted under Level 2 gating: Requires explicit human approval before execution ({req_appr}).",
                    matched_clause=req_appr,
                )

        # 8. Action is fully authorized within policy bounds
        return _make_result(
            permitted=True,
            requires_approval=False,
            reason=f"Action '{request.action_name}' is fully authorized under Level {pos.permissions.max_autonomy_level} policy for position '{pos.title}'.",
        )

    def enforce_or_raise(self, request: RuntimeActionRequest) -> RuntimeEvaluationResult:
        """Evaluates action and raises ForbiddenError if permitted is False."""
        res = self.authorize_action(request)
        if not res.permitted:
            raise ForbiddenError(f"Permission Enforcer Denied Action: {res.reason}")
        return res


_GLOBAL_ENFORCER: RuntimePositionPermissionEnforcer | None = None


def get_position_enforcer() -> RuntimePositionPermissionEnforcer:
    global _GLOBAL_ENFORCER
    if _GLOBAL_ENFORCER is None:
        _GLOBAL_ENFORCER = RuntimePositionPermissionEnforcer()
    return _GLOBAL_ENFORCER
