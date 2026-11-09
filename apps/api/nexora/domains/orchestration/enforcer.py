"""
Security Enforcer for NEIMAN Agent Orchestration Core.
Enforces:
1. Anti-Self-Modification: Agents CANNOT alter their own permissions, code, or identity to escalate privileges.
2. Tool Allowlists & Least-Privilege Execution.
3. Multi-layer Sandboxing (Path traversal, command blacklists, SQL injection/destruction, SSRF).
4. Explicit Authorization for High-Risk Side Effects.
"""

from __future__ import annotations

import os
import re
from typing import Any

from nexora.domains.orchestration.schemas import RunAuthority
from nexora.exceptions import ForbiddenError


class OrchestrationSecurityEnforcer:
    """
    Runtime security enforcer preventing rogue autonomous behavior,
    unbounded self-modification, unauthorized tool invocation, and resource destruction.
    """

    PROHIBITED_COMMAND_PATTERNS = [
        re.compile(r"\brm\s+-[a-zA-Z]*[rf][a-zA-Z]*\s+(?:/|/\*|~|\$HOME)(?:\s|$)", re.IGNORECASE),
        re.compile(r"\b(?:mkfs|fdisk|parted|dd\s+if=)\b", re.IGNORECASE),
        re.compile(r"\b(?:sudo|su)\b", re.IGNORECASE),
        re.compile(r"\bchmod\s+(?:-R\s+)?777\b", re.IGNORECASE),
        re.compile(r"\bcurl\s+.*\|\s*(?:bash|sh)\b", re.IGNORECASE),
        re.compile(r"\b(?:wget|curl)\s+.*169\.254\.169\.254\b", re.IGNORECASE),
    ]

    DESTRUCTIVE_SQL_PATTERNS = [
        re.compile(r"\bdrop\s+(?:table|database|schema)\b", re.IGNORECASE),
        re.compile(r"\btruncate\s+table\b", re.IGNORECASE),
        re.compile(r"\balter\s+table\s+.*drop\s+column\b", re.IGNORECASE),
    ]

    BLOCKED_NETWORK_TARGETS = [
        "169.254.169.254",  # AWS/GCP/Azure instance metadata
        "metadata.google.internal",
        "127.0.0.1",
        "localhost",
        "0.0.0.0",
    ]

    # -------------------------------------------------------------
    # 1. ANTI-SELF-MODIFICATION GUARD
    # -------------------------------------------------------------
    @classmethod
    def assert_no_self_modification(
        cls,
        actor_agent_id: str,
        target_resource: str,
        operation: str,
        payload: dict[str, Any] | None = None,
    ) -> None:
        """
        Guarantees that an autonomous agent cannot modify its own:
        - Permissions / Tool allowlists
        - Autonomy level
        - System instructions / Prompt / Persona
        - Assigned organizational position
        """
        target_norm = target_resource.strip().lower()
        op_norm = operation.strip().upper()

        # Check self-targeting
        is_self_target = (
            actor_agent_id.lower() in target_norm
            or target_norm in ("agent:self", "me", "current_agent")
        )

        sensitive_fields = {
            "permissions",
            "allowed_tools",
            "autonomy",
            "autonomy_level",
            "system_instructions",
            "identity",
            "role_id",
            "position_key",
        }

        if is_self_target and op_norm in ("UPDATE", "PATCH", "MODIFY", "ELEVATE"):
            if payload:
                modified_keys = set(payload.keys())
                violating = modified_keys.intersection(sensitive_fields)
                if violating:
                    raise ForbiddenError(
                        f"Security Violation: Autonomous agent '{actor_agent_id}' attempted self-modification "
                        f"of privileged governance parameters: {violating}. Privilege escalation blocked."
                    )
            else:
                raise ForbiddenError(
                    f"Security Violation: Autonomous agent '{actor_agent_id}' cannot modify its own governance spec."
                )

    # -------------------------------------------------------------
    # 2. TOOL ALLOWLIST & LEAST PRIVILEGE
    # -------------------------------------------------------------
    @classmethod
    def assert_tool_permitted(cls, tool_name: str, authority: RunAuthority) -> None:
        """
        Enforces strict deny-by-default: Tool MUST be present in granted_tools
        and NOT present in denied_tools.
        """
        if tool_name in authority.denied_tools:
            raise ForbiddenError(
                f"Tool '{tool_name}' is explicitly DENIED by position authority policy ({authority.position_key})."
            )

        if tool_name not in authority.granted_tools:
            raise ForbiddenError(
                f"Tool '{tool_name}' is not in the granted tool allowlist for position '{authority.position_key}'. "
                f"Granted tools: {authority.granted_tools}."
            )

    # -------------------------------------------------------------
    # 3. SANDBOXING (Paths, Commands, SQL, URLs)
    # -------------------------------------------------------------
    @classmethod
    def validate_filesystem_path(
        cls, file_path: str, allowed_roots: list[str] | None = None
    ) -> str:
        """
        Prevents directory traversal attacks (e.g. `../../etc/shadow`).
        Confines access strictly within configured allowed roots.
        """
        roots = allowed_roots or ["/workspace", "/tmp"]
        normalized_target = os.path.normpath(os.path.abspath(file_path))

        is_allowed = False
        for root in roots:
            normalized_root = os.path.normpath(os.path.abspath(root))
            if normalized_target == normalized_root or normalized_target.startswith(
                normalized_root + os.sep
            ):
                is_allowed = True
                break

        if not is_allowed:
            raise ForbiddenError(
                f"Path traversal blocked: target path '{file_path}' is outside allowed boundaries: {roots}."
            )
        return normalized_target

    @classmethod
    def validate_terminal_command(cls, command: str) -> None:
        """Blocks catastrophic shell commands and remote code execution pipes."""
        for pattern in cls.PROHIBITED_COMMAND_PATTERNS:
            if pattern.search(command):
                raise ForbiddenError(
                    f"Command execution blocked: dangerous pattern detected in '{command}'."
                )

    @classmethod
    def validate_database_query(cls, sql_query: str) -> None:
        """Blocks destructive SQL statements."""
        for pattern in cls.DESTRUCTIVE_SQL_PATTERNS:
            if pattern.search(sql_query):
                raise ForbiddenError(
                    "Database execution blocked: destructive SQL pattern detected in query."
                )

    @classmethod
    def validate_network_url(cls, url: str) -> None:
        """Prevents SSRF attacks against cloud metadata endpoints and internal localhost."""
        url_lower = url.lower()
        for blocked in cls.BLOCKED_NETWORK_TARGETS:
            if blocked in url_lower:
                raise ForbiddenError(
                    f"Network egress blocked: destination '{url}' resolves to forbidden target '{blocked}' (SSRF guard)."
                )

    # -------------------------------------------------------------
    # 4. EXPLICIT AUTHORIZATION FOR SIDE EFFECTS
    # -------------------------------------------------------------
    @classmethod
    def assert_side_effect_authorized(
        cls, action_name: str, payload: dict[str, Any], authority: RunAuthority
    ) -> bool:
        """
        Determines whether an action requires explicit human authorization.
        High-risk actions (autonomy level > granted autonomy, or financial payments > $500)
        require human approval.
        """
        financial_amount = float(payload.get("amount_usd", 0.0))
        if financial_amount > 500.0 and authority.autonomy_level < 5:
            return False  # Requires human approval

        if action_name in (
            "DEPLOY_PRODUCTION",
            "MIGRATE_SCHEMA",
            "TRANSFER_FUNDS",
            "DELETE_COMPANY_DATA",
        ):
            if authority.autonomy_level < 4:
                return False

        return True
