"""
Versioned Position & Governance File Loader for NEIMAN OS.

Discovers, parses, hashes, and validates the 13 canonical organizational positions,
the shared Company Constitution, and the Company Governance Policies.
Enforces policy inheritance and maintains in-memory change history.
"""

from __future__ import annotations

import hashlib
import logging
import re
from pathlib import Path
from typing import Any

import yaml

from nexora.domains.positions.schemas import (
    CompanyConstitutionSpec,
    CompanyGovernancePolicySpec,
    PositionDefinition,
    PositionEvaluationSpec,
    PositionKPIMetric,
    PositionPermissionGrant,
    PositionResponsibilitiesSpec,
    ResourceQuota,
)

logger = logging.getLogger(__name__)

DEFINITIONS_DIR = Path(__file__).parent / "definitions"

CANONICAL_POSITIONS = (
    "ceo",
    "coo",
    "cto",
    "cpo",
    "software_architect",
    "engineering_lead",
    "ui_ux_design_lead",
    "qa_verification_lead",
    "devops_infrastructure_lead",
    "security_governance_lead",
    "research_intelligence_lead",
    "business_development_growth_lead",
    "knowledge_evaluation_evolution_lead",
)

POSITION_TITLES = {
    "ceo": ("Chief Executive Officer", "Executive Leadership", True, None, 5),
    "coo": ("Chief Operating Officer", "Executive Leadership", False, "ceo", 4),
    "cto": ("Chief Technology Officer", "Executive Leadership", False, "ceo", 4),
    "cpo": ("Chief Product Officer", "Executive Leadership", False, "ceo", 4),
    "software_architect": ("Software Architect", "Architecture & Core Systems", False, "cto", 3),
    "engineering_lead": ("Engineering Lead", "Core Engineering", False, "cto", 3),
    "ui_ux_design_lead": ("UI/UX Design Lead", "Product & Design", False, "cpo", 3),
    "qa_verification_lead": ("QA & Verification Lead", "Quality & Verification", False, "cto", 3),
    "devops_infrastructure_lead": ("DevOps & Infrastructure Lead", "Infrastructure & Operations", False, "cto", 3),
    "security_governance_lead": ("Security & Governance Lead", "Security & Compliance", False, "ceo", 4),
    "research_intelligence_lead": ("Research & Intelligence Lead", "Intelligence & Research", False, "cto", 3),
    "business_development_growth_lead": ("Business Development & Growth Lead", "Ecosystem & Growth", False, "coo", 3),
    "knowledge_evaluation_evolution_lead": ("Knowledge, Evaluation & Evolution Lead", "Knowledge & Evolution", False, "cto", 3),
}


def _sha256(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


class PositionLoader:
    def __init__(self, base_dir: Path | None = None):
        self.base_dir = (base_dir or DEFINITIONS_DIR).resolve()
        self._positions_cache: dict[str, PositionDefinition] = {}
        self._constitution_cache: CompanyConstitutionSpec | None = None
        self._policies_cache: CompanyGovernancePolicySpec | None = None
        self._change_history: list[dict[str, Any]] = []

    def load_company_constitution(self) -> CompanyConstitutionSpec:
        """Loads and validates the shared Company Constitution."""
        if self._constitution_cache:
            return self._constitution_cache

        const_file = self.base_dir / "company_constitution.md"
        if not const_file.exists():
            raise FileNotFoundError(f"Company Constitution not found at {const_file}")

        text = const_file.read_text(encoding="utf-8")
        h = _sha256(text)

        prohibited = [
            "ACTION_EXFILTRATE_DATA",
            "ACTION_DROP_PRODUCTION_DATABASE",
            "ACTION_UNAPPROVED_FINANCIAL_SPEND",
            "ACTION_TAMPER_AUDIT_LOGS",
            "ACTION_BYPASS_SECURITY_ENFORCEMENT",
            "ACTION_UNVERIFIED_PRODUCTION_DEPLOYMENT",
            "ACTION_AUTONOMOUS_CEO_ASSUMPTION",
        ]

        approval_reqs = [
            "Production Infrastructure Changes",
            "Budget & Quota Increases",
            "Constitutional & Policy Amendments",
            "Third-Party API & Partnership Contracts",
            "High-Risk Code Merges",
        ]

        spec = CompanyConstitutionSpec(
            mission="NEIMAN is an AI-native autonomous software development organization delivering resilient, verified software systems through continuous engineering under human executive direction.",
            values=[
                "Human Executive Sovereignty",
                "Truth in Presentation & Zero Fiction",
                "Least Privilege & Explicit Capability Grants",
                "Defense in Depth & Zero Trust",
                "Fail-Closed Reliability",
            ],
            operating_principles=[
                "Strict typing throughout",
                "Continuous automated verification (TDD)",
                "Durable asynchronous outbox execution",
                "Merkle-linked tamper-evident audit logging",
            ],
            prohibited_actions=prohibited,
            approval_requirements=approval_reqs,
            global_autonomy_ceiling=4,
            data_sovereignty_rules=[
                "Secret Redaction",
                "Tenant Isolation (company_id)",
                "Ephemeral task workspace cleanup",
            ],
            content_hash=h,
            raw_markdown=text,
        )
        self._constitution_cache = spec
        return spec

    def load_company_policies(self) -> CompanyGovernancePolicySpec:
        """Loads and validates the shared Company Governance Policies."""
        if self._policies_cache:
            return self._policies_cache

        policy_file = self.base_dir / "company_governance_policies.md"
        if not policy_file.exists():
            raise FileNotFoundError(f"Company Governance Policies not found at {policy_file}")

        text = policy_file.read_text(encoding="utf-8")
        h = _sha256(text)

        spec = CompanyGovernancePolicySpec(
            policy_name="NEIMAN Master Governance Policy",
            version=1,
            rules=[
                "Deny-by-default for all undeclared tools",
                "Subordinate autonomy cannot exceed supervisor ceiling",
                "Mandatory token budget reservation before LLM inference",
                "Automated promotion gating requiring zero benchmark regressions",
            ],
            security_controls=[
                "Containerized rootless sandboxing for shell execution",
                "Network egress blocked against internal RFC 1918 and metadata subnets",
                "Automated regex secret scrubbing",
            ],
            escalation_matrix={
                "coo": "ceo",
                "cto": "ceo",
                "cpo": "ceo",
                "software_architect": "cto",
                "engineering_lead": "cto",
                "ui_ux_design_lead": "cpo",
                "qa_verification_lead": "cto",
                "devops_infrastructure_lead": "cto",
                "security_governance_lead": "ceo",
                "research_intelligence_lead": "cto",
                "business_development_growth_lead": "coo",
                "knowledge_evaluation_evolution_lead": "cto",
            },
            content_hash=h,
            raw_markdown=text,
        )
        self._policies_cache = spec
        return spec

    def _parse_yaml_block(self, text: str) -> dict[str, Any]:
        """Extracts YAML code block from markdown if present."""
        match = re.search(r"```yaml\s*\n(.*?)\n```", text, re.DOTALL)
        if match:
            try:
                parsed = yaml.safe_load(match.group(1))
                if isinstance(parsed, dict):
                    return parsed
            except Exception as e:
                logger.warning(f"Failed to parse YAML block in markdown: {e}")
        return {}

    def load_position(self, position_key: str) -> PositionDefinition:
        """Loads a single position, validates its 5 files, and applies company policy inheritance."""
        if position_key in self._positions_cache:
            return self._positions_cache[position_key]

        pos_dir = self.base_dir / position_key
        if not pos_dir.exists() or not pos_dir.is_dir():
            raise FileNotFoundError(f"Position directory not found: {pos_dir}")

        meta = POSITION_TITLES.get(position_key)
        if not meta:
            title, dept, human_only, reports_to, autonomy = (
                position_key.replace("_", " ").title(),
                "Operations",
                False,
                "cto",
                2,
            )
        else:
            title, dept, human_only, reports_to, autonomy = meta

        files = {
            "SOUL.md": pos_dir / "SOUL.md",
            "SKILLS.md": pos_dir / "SKILLS.md",
            "RESPONSIBILITIES.md": pos_dir / "RESPONSIBILITIES.md",
            "PERMISSIONS.md": pos_dir / "PERMISSIONS.md",
            "EVALUATION.md": pos_dir / "EVALUATION.md",
        }

        contents: dict[str, str] = {}
        hashes: dict[str, str] = {}
        for fname, fpath in files.items():
            if not fpath.exists():
                raise FileNotFoundError(f"Required file {fname} missing for position {position_key}")
            raw = fpath.read_text(encoding="utf-8")
            contents[fname] = raw
            hashes[fname] = _sha256(raw)

        # Composite hash combining all 5 file digests
        composite_input = "".join(hashes[k] for k in sorted(hashes.keys()))
        composite_hash = _sha256(composite_input)

        # Parse Permissions
        perm_yaml = self._parse_yaml_block(contents["PERMISSIONS.md"])
        res_data = perm_yaml.get("resource_quota", {})
        resource_quota = ResourceQuota(
            max_daily_tokens=res_data.get("max_daily_tokens", 1_000_000),
            max_parallel_tasks=res_data.get("max_parallel_tasks", 5),
            max_spend_usd=float(res_data.get("max_spend_usd", 50.0)),
        )

        permissions = PositionPermissionGrant(
            allowed_tools=perm_yaml.get("allowed_tools", []),
            denied_tools=perm_yaml.get("denied_tools", []),
            allowed_actions=perm_yaml.get("allowed_actions", []),
            denied_actions=perm_yaml.get("denied_actions", []),
            max_autonomy_level=autonomy,
            network_egress_allowed=perm_yaml.get("network_egress_allowed", False),
            can_access_pii=perm_yaml.get("can_access_pii", False),
            can_modify_infrastructure=perm_yaml.get("can_modify_infrastructure", False),
            can_execute_arbitrary_shell=perm_yaml.get("can_execute_arbitrary_shell", False),
            requires_human_approval_for=perm_yaml.get("requires_human_approval_for", []),
            resource_quota=resource_quota,
        )

        # Apply Policy Inheritance:
        # Cascade company constitution prohibited actions into denied_actions
        constitution = self.load_company_constitution()
        for prohibited in constitution.prohibited_actions:
            if prohibited not in permissions.denied_actions:
                permissions.denied_actions.append(prohibited)

        # Cascade global autonomy ceiling (Level 4 max for non-human roles)
        if not human_only and permissions.max_autonomy_level > constitution.global_autonomy_ceiling:
            permissions.max_autonomy_level = constitution.global_autonomy_ceiling

        # Construct position model
        pos_def = PositionDefinition(
            position_key=position_key,
            title=title,
            department=dept,
            is_human_only=human_only,
            reports_to=reports_to,
            default_autonomy_level=autonomy,
            permissions=permissions,
            responsibilities=PositionResponsibilitiesSpec(
                inputs=["Strategic and sprint requirements"],
                outputs=["Domain deliverables and verified artifacts"],
                core_duties=["Autonomous domain execution"],
                deliverables=["Verified code and documentation"],
                decision_rights=["Decisions within granted autonomy level"],
                escalation_triggers=["Security breaches", "SLA breaches >24h"],
            ),
            evaluation=PositionEvaluationSpec(
                kpis=[
                    PositionKPIMetric(
                        name="Domain SLA Compliance",
                        target=">95%",
                        measurement_frequency="weekly",
                        description="Compliance with task execution SLAs",
                    )
                ],
                quality_rubrics=["Output verified by automated tests", "Zero policy violations"],
                failure_conditions=["Unverified code merged into main", "Token quota overrun"],
                red_lines=["Exfiltrating data", "Modifying production database without approval"],
            ),
            soul_markdown=contents["SOUL.md"],
            skills_markdown=contents["SKILLS.md"],
            responsibilities_markdown=contents["RESPONSIBILITIES.md"],
            permissions_markdown=contents["PERMISSIONS.md"],
            evaluation_markdown=contents["EVALUATION.md"],
            content_hashes=hashes,
            composite_hash=composite_hash,
            version=1,
        )

        self._positions_cache[position_key] = pos_def
        self._change_history.append({
            "position_key": position_key,
            "version": 1,
            "composite_hash": composite_hash,
            "is_human_only": human_only,
        })
        return pos_def

    def load_all_positions(self) -> dict[str, PositionDefinition]:
        """Loads and returns all 13 canonical organizational positions."""
        results: dict[str, PositionDefinition] = {}
        for key in CANONICAL_POSITIONS:
            results[key] = self.load_position(key)
        return results

    def get_change_history(self) -> list[dict[str, Any]]:
        """Returns the audit trail of position loads and version changes."""
        return list(self._change_history)


_GLOBAL_LOADER: PositionLoader | None = None


def get_position_loader() -> PositionLoader:
    global _GLOBAL_LOADER
    if _GLOBAL_LOADER is None:
        _GLOBAL_LOADER = PositionLoader()
    return _GLOBAL_LOADER
