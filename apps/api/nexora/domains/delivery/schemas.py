"""
Delivery Domain Schemas.

Models linked records across all 12 stages of the autonomous software delivery workflow:
1. Discovery
2. Requirements
3. Architecture
4. UI/UX Design (when applicable)
5. Task Decomposition
6. Implementation
7. Code Review
8. Automated Testing
9. Security Review
10. Staging Deployment
11. Acceptance Verification
12. Release Authorization

Also models:
- Workspace & Git branch records
- Diagnostic back-routing payloads
- Rollback records
- Release Provenance & Final Delivery Report
"""

from datetime import UTC, datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class DeliveryStage(str, Enum):
    DISCOVERY = "DISCOVERY"
    REQUIREMENTS = "REQUIREMENTS"
    ARCHITECTURE = "ARCHITECTURE"
    DESIGN = "DESIGN"
    DECOMPOSITION = "DECOMPOSITION"
    IMPLEMENTATION = "IMPLEMENTATION"
    CODE_REVIEW = "CODE_REVIEW"
    TESTING = "TESTING"
    SECURITY_REVIEW = "SECURITY_REVIEW"
    STAGING_DEPLOYMENT = "STAGING_DEPLOYMENT"
    ACCEPTANCE_VERIFICATION = "ACCEPTANCE_VERIFICATION"
    RELEASE_AUTHORIZATION = "RELEASE_AUTHORIZATION"
    PRODUCTION_RELEASE = "PRODUCTION_RELEASE"
    COMPLETED = "COMPLETED"
    FAILED_CHECKS = "FAILED_CHECKS"
    BLOCKED_BY_SECURITY = "BLOCKED_BY_SECURITY"
    REJECTED = "REJECTED"
    ROLLED_BACK = "ROLLED_BACK"


class TargetEnvironment(str, Enum):
    LOCAL_DEV = "LOCAL_DEV"
    STAGING = "STAGING"
    CANARY = "CANARY"
    PRODUCTION = "PRODUCTION"


class DeliveryRequest(BaseModel):
    id: str = Field(..., description="Unique Delivery Request ID")
    title: str = Field(..., description="Title of the feature or product request")
    raw_request: str = Field(..., description="Raw user prompt or product initiative")
    target_environment: TargetEnvironment = Field(
        default=TargetEnvironment.STAGING, description="Target environment for release"
    )
    author_id: str = Field(default="human_ceo", description="Initiator of the delivery request")
    requires_ui: bool = Field(default=True, description="Whether UI/UX design stage is required")
    max_patch_lines: int = Field(default=500, description="Patch-size budget limit in lines")
    max_token_budget: int = Field(default=100000, description="Token consumption budget")
    max_retries_per_stage: int = Field(default=3, description="Bounded retry attempts for failed checks")
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class DiscoveryArtifact(BaseModel):
    run_id: str
    feasibility_score: float = Field(..., ge=0.0, le=1.0)
    stack_recommendations: list[str]
    identified_risks: list[str]
    estimated_complexity: str
    approved_by: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))


class RequirementsArtifact(BaseModel):
    run_id: str
    user_stories: list[str]
    acceptance_criteria: list[str]
    non_functional_requirements: list[str]
    approved_by: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))


class ArchitectureArtifact(BaseModel):
    run_id: str
    adr_title: str
    component_boundaries: list[str]
    schema_changes: list[str]
    data_invariants: list[str]
    security_boundaries: list[str]
    approved_by: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))


class DesignArtifact(BaseModel):
    run_id: str
    design_system_tokens: dict[str, Any]
    wireframe_specs: list[str]
    accessibility_standards: list[str]
    approved_by: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))


class TaskDecompositionArtifact(BaseModel):
    run_id: str
    dag_tasks: list[dict[str, Any]]
    task_dependencies: dict[str, list[str]]
    agent_assignments: dict[str, str]
    tool_allowlists: dict[str, list[str]]
    approved_by: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))


class ImplementationArtifact(BaseModel):
    run_id: str
    git_branch: str
    commit_sha: str
    workspace_dir: str
    files_changed: list[str]
    patch_size_lines: int
    tokens_consumed: int
    diff_stat: str
    committed_by: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))


class CodeReviewVerdict(str, Enum):
    APPROVED = "APPROVED"
    CHANGES_REQUESTED = "CHANGES_REQUESTED"
    REJECTED = "REJECTED"


class CodeReviewArtifact(BaseModel):
    run_id: str
    reviewer_agent: str
    verdict: CodeReviewVerdict
    invariants_verified: bool
    architectural_drift_detected: bool
    review_comments: list[str]
    diff_size_within_budget: bool
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))


class TestEvidenceArtifact(BaseModel):
    run_id: str
    suite_name: str
    total_tests: int
    passed_tests: int
    failed_tests: int
    skipped_tests: int
    passed: bool
    execution_latency_ms: int
    failures_diagnostics: list[dict[str, Any]] = Field(default_factory=list)
    raw_output: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))


class SecurityReviewArtifact(BaseModel):
    run_id: str
    security_lead: str
    approved: bool
    red_line_violations: list[str] = Field(default_factory=list)
    secrets_detected: list[str] = Field(default_factory=list)
    cve_dependencies_found: list[str] = Field(default_factory=list)
    block_release: bool = False
    audit_notes: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))


class StagingDeploymentArtifact(BaseModel):
    run_id: str
    environment: str
    deployment_url: str
    deployed_commit_sha: str
    health_check_endpoint: str
    health_check_passed: bool
    deployed_by: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))


class AcceptanceVerificationArtifact(BaseModel):
    run_id: str
    qa_lead: str
    all_criteria_met: bool
    criteria_evaluations: dict[str, bool]
    independent_test_evidence_verified: bool
    qa_notes: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))


class ReleaseAuthorizationArtifact(BaseModel):
    run_id: str
    target_environment: TargetEnvironment
    ceo_approved: bool
    four_eyes_signoffs: list[str]
    risk_level: str
    destructive_actions_approved: bool
    authorization_timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))


class RollbackRecord(BaseModel):
    run_id: str
    reason: str
    rolled_back_from_sha: str
    rolled_back_to_sha: str
    environment: str
    successful: bool
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))


class DiagnosticBackRoute(BaseModel):
    run_id: str
    failed_stage: DeliveryStage
    responsible_agent: str
    error_summary: str
    diagnostic_evidence: dict[str, Any]
    retry_attempt: int
    max_retries: int
    suggested_fix: str
    routed_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class LinkedDeliveryRecord(BaseModel):
    run_id: str
    request: DeliveryRequest
    discovery: DiscoveryArtifact | None = None
    requirements: RequirementsArtifact | None = None
    architecture: ArchitectureArtifact | None = None
    design: DesignArtifact | None = None
    decomposition: TaskDecompositionArtifact | None = None
    implementation: ImplementationArtifact | None = None
    code_review: CodeReviewArtifact | None = None
    test_evidence: TestEvidenceArtifact | None = None
    security_review: SecurityReviewArtifact | None = None
    staging_deployment: StagingDeploymentArtifact | None = None
    acceptance_verification: AcceptanceVerificationArtifact | None = None
    release_authorization: ReleaseAuthorizationArtifact | None = None
    rollbacks: list[RollbackRecord] = Field(default_factory=list)
    diagnostic_routes: list[DiagnosticBackRoute] = Field(default_factory=list)


class DeliveryReport(BaseModel):
    run_id: str
    title: str
    current_stage: DeliveryStage
    status: str
    target_environment: str
    total_duration_seconds: float
    total_tokens_consumed: int
    patch_size_lines: int
    branch_name: str | None = None
    deployed_commit_sha: str | None = None
    release_provenance_hash: str | None = None
    verified_deliverable: bool
    linked_records: LinkedDeliveryRecord
    summary: str
    generated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
