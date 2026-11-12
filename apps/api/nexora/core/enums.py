"""All domain enums for NEIMAN."""

from enum import Enum, StrEnum

# ── Company ────────────────────────────────────────────────────────────────


class CompanyStatus(str, Enum):
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"
    ARCHIVED = "ARCHIVED"


# ── Organizational DNA ─────────────────────────────────────────────────────


class InnovationLevel(str, Enum):
    CONSERVATIVE = "CONSERVATIVE"
    MODERATE = "MODERATE"
    PROGRESSIVE = "PROGRESSIVE"
    RADICAL = "RADICAL"


class AutonomyLevel(str, Enum):
    CENTRALIZED = "CENTRALIZED"
    GUIDED = "GUIDED"
    BALANCED = "BALANCED"
    DELEGATED = "DELEGATED"
    FULLY_AUTONOMOUS = "FULLY_AUTONOMOUS"


class RiskTolerance(str, Enum):
    RISK_AVERSE = "RISK_AVERSE"
    CAUTIOUS = "CAUTIOUS"
    MODERATE = "MODERATE"
    AGGRESSIVE = "AGGRESSIVE"
    FEARLESS = "FEARLESS"


class QualityThreshold(str, Enum):
    MINIMUM = "MINIMUM"
    STANDARD = "STANDARD"
    HIGH = "HIGH"
    EXCEPTIONAL = "EXCEPTIONAL"
    PERFECT = "PERFECT"


class DecisionStyle(str, Enum):
    AUTHORITATIVE = "AUTHORITATIVE"
    CONSULTATIVE = "CONSULTATIVE"
    CONSENSUS = "CONSENSUS"
    DELEGATIVE = "DELEGATIVE"


class CommunicationStyle(str, Enum):
    FORMAL = "FORMAL"
    SEMI_FORMAL = "SEMI_FORMAL"
    CASUAL = "CASUAL"
    ASYNC_FIRST = "ASYNC_FIRST"
    DIRECT = "DIRECT"


class ResourceStrategy(str, Enum):
    LEAN = "LEAN"
    BALANCED = "BALANCED"
    GROWTH = "GROWTH"
    INVEST_HEAVY = "INVEST_HEAVY"


# ── Department ─────────────────────────────────────────────────────────────


class DepartmentStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"


# ── Role (Org Role) ────────────────────────────────────────────────────────


class RoleAuthority(str, Enum):
    NONE = "NONE"
    READ = "READ"
    EXECUTE = "EXECUTE"
    MANAGE = "MANAGE"
    FULL = "FULL"


# ── Membership ─────────────────────────────────────────────────────────────


class MembershipRole(str, Enum):
    OWNER = "OWNER"
    ADMIN = "ADMIN"
    MANAGER = "MANAGER"
    MEMBER = "MEMBER"
    VIEWER = "VIEWER"

    @property
    def level(self) -> int:
        """Higher number = more permissions."""
        return {
            "OWNER": 100,
            "ADMIN": 80,
            "MANAGER": 60,
            "MEMBER": 40,
            "VIEWER": 20,
        }[self.value]

    def can(self, required: "MembershipRole") -> bool:
        """Check if this role meets or exceeds the required role level."""
        return self.level >= required.level


# ── Agent ──────────────────────────────────────────────────────────────────


class AgentAutonomy(str, Enum):
    SUPERVISED = "SUPERVISED"
    SEMI_AUTONOMOUS = "SEMI_AUTONOMOUS"
    AUTONOMOUS = "AUTONOMOUS"


class AgentStatus(StrEnum):
    # NEIMAN Employee Lifecycle
    CREATED = "CREATED"
    CONFIGURED = "CONFIGURED"
    AVAILABLE = "AVAILABLE"
    WORKING = "WORKING"
    BLOCKED = "BLOCKED"
    PAUSED = "PAUSED"
    RETIRED = "RETIRED"


class AgentMessageType(str, Enum):
    REQUEST = "REQUEST"
    RESPONSE = "RESPONSE"
    DELEGATION = "DELEGATION"
    ESCALATION = "ESCALATION"
    REVIEW = "REVIEW"
    NOTIFICATION = "NOTIFICATION"
    COLLABORATION = "COLLABORATION"


class ExecutionStep(str, Enum):
    TASK_RECEIVED = "TASK_RECEIVED"
    CONTEXT_ASSEMBLY = "CONTEXT_ASSEMBLY"
    PLAN = "PLAN"
    RESOURCE_CHECK = "RESOURCE_CHECK"
    INTELLIGENCE_SELECTION = "INTELLIGENCE_SELECTION"
    TOOL_EXECUTION = "TOOL_EXECUTION"
    RESULT = "RESULT"
    VALIDATION = "VALIDATION"
    REPORT = "REPORT"
    MEMORY_UPDATE = "MEMORY_UPDATE"


class ExecutionStatus(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    BLOCKED = "BLOCKED"


class AuditAction(str, Enum):
    AGENT_CREATED = "AGENT_CREATED"
    STATUS_TRANSITION = "STATUS_TRANSITION"
    DELEGATION = "DELEGATION"
    ESCALATION = "ESCALATION"
    APPROVAL_REQUESTED = "APPROVAL_REQUESTED"
    APPROVAL_RESOLVED = "APPROVAL_RESOLVED"
    TOOL_EXECUTED = "TOOL_EXECUTED"
    EXECUTION_STEP = "EXECUTION_STEP"
    PERMISSION_DENIED = "PERMISSION_DENIED"
    MEMORY_STORED = "MEMORY_STORED"
    POLICY_CHECKED = "POLICY_CHECKED"


# ── Project ────────────────────────────────────────────────────────────────


class Priority(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class ProjectStatus(str, Enum):
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    IN_PROGRESS = "IN_PROGRESS"
    ON_HOLD = "ON_HOLD"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


# ── Task ───────────────────────────────────────────────────────────────────


class TaskStatus(str, Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    BLOCKED = "BLOCKED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


# ── Workflow ───────────────────────────────────────────────────────────────


class WorkflowStatus(str, Enum):
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    ARCHIVED = "ARCHIVED"


class WorkflowTriggerType(str, Enum):
    MANUAL = "MANUAL"
    SCHEDULE = "SCHEDULE"
    WEBHOOK = "WEBHOOK"
    EVENT = "EVENT"
    AGENT = "AGENT"


class WorkflowExecutionStatus(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    WAITING_APPROVAL = "WAITING_APPROVAL"
    WAITING_RESOURCE = "WAITING_RESOURCE"
    WAITING_RETRY = "WAITING_RETRY"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    ESCALATED = "ESCALATED"
    CANCELLED = "CANCELLED"
    TIMED_OUT = "TIMED_OUT"


class WorkflowStepType(str, Enum):
    TRIGGER = "TRIGGER"
    AGENT = "AGENT"
    TOOL = "TOOL"
    TASK = "TASK"
    APPROVAL = "APPROVAL"
    HUMAN_REVIEW = "HUMAN_REVIEW"
    RESOURCE_REQUEST = "RESOURCE_REQUEST"
    MODEL_SELECTION = "MODEL_SELECTION"
    DECISION = "DECISION"
    CONDITION = "CONDITION"
    VALIDATION = "VALIDATION"
    ESCALATION = "ESCALATION"
    PARALLEL = "PARALLEL"
    DELAY = "DELAY"
    WEBHOOK = "WEBHOOK"
    SUCCESS = "SUCCESS"
    FAILURE = "FAILURE"


# ── Policy ─────────────────────────────────────────────────────────────────


class PolicyScope(str, Enum):
    COMPANY = "COMPANY"
    DEPARTMENT = "DEPARTMENT"
    AGENT = "AGENT"
    PROJECT = "PROJECT"
    WORKFLOW = "WORKFLOW"


class EnforcementLevel(str, Enum):
    ADVISORY = "ADVISORY"  # Suggestions only
    SOFT = "SOFT"  # Warns but allows override
    HARD = "HARD"  # Blocks action, allows escalation
    ABSOLUTE = "ABSOLUTE"  # Cannot be overridden


class PolicyStatus(str, Enum):
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"


# ── Decision ───────────────────────────────────────────────────────────────


class DecisionStatus(str, Enum):
    OPEN = "OPEN"
    IN_REVIEW = "IN_REVIEW"
    DECIDED = "DECIDED"
    IMPLEMENTED = "IMPLEMENTED"
    EVALUATED = "EVALUATED"


# ── Resources ──────────────────────────────────────────────────────────────


class ResourceCategory(str, Enum):
    COMPUTE = "COMPUTE"
    INTELLIGENCE = "INTELLIGENCE"
    FINANCIAL = "FINANCIAL"
    OPERATIONAL = "OPERATIONAL"


class ResourcePriority(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    NORMAL = "NORMAL"
    LOW = "LOW"
    BACKGROUND = "BACKGROUND"

    @property
    def rank(self) -> int:
        return {
            "CRITICAL": 50,
            "HIGH": 40,
            "NORMAL": 30,
            "LOW": 20,
            "BACKGROUND": 10,
        }[self.value]


class ResourceEvaluationDecision(str, Enum):
    APPROVE = "APPROVE"
    DENY = "DENY"
    DEFER = "DEFER"
    REDUCE = "REDUCE"
    QUEUE = "QUEUE"


class MetricState(str, Enum):
    OBSERVED = "OBSERVED"
    ESTIMATED = "ESTIMATED"
    ALLOCATED = "ALLOCATED"
    LIMITED = "LIMITED"
    AVAILABLE = "AVAILABLE"


class AllocationStatus(str, Enum):
    PENDING = "PENDING"
    ACTIVE = "ACTIVE"
    RELEASED = "RELEASED"
    REVOKED = "REVOKED"
    EXPIRED = "EXPIRED"


# ── Organizational Memory System ───────────────────────────────────────────


class MemoryDomain(str, Enum):
    COMPANY = "COMPANY"
    DEPARTMENT = "DEPARTMENT"
    AGENT = "AGENT"
    PROJECT = "PROJECT"
    CUSTOMER = "CUSTOMER"
    DECISION = "DECISION"
    POLICY = "POLICY"
    EXPERIMENT = "EXPERIMENT"
    FAILURE = "FAILURE"
    KNOWLEDGE_BASE = "KNOWLEDGE_BASE"


class MemoryScope(str, Enum):
    PUBLIC = "PUBLIC"  # Organization-wide
    INTERNAL = "INTERNAL"  # Department or project-wide
    CONFIDENTIAL = "CONFIDENTIAL"  # Role or team restricted
    RESTRICTED = "RESTRICTED"  # Executive or owner only
    PRIVATE = "PRIVATE"  # Single agent/user only


class RetentionPolicy(str, Enum):
    PERMANENT = "PERMANENT"
    YEAR_1 = "YEAR_1"
    DAYS_90 = "DAYS_90"
    DAYS_30 = "DAYS_30"
    SESSION_ONLY = "SESSION_ONLY"


class ProvenanceType(str, Enum):
    HUMAN_INPUT = "HUMAN_INPUT"
    AGENT_OBSERVATION = "AGENT_OBSERVATION"
    TASK_EXECUTION = "TASK_EXECUTION"
    DECISION_OUTCOME = "DECISION_OUTCOME"
    POLICY_DOCUMENT = "POLICY_DOCUMENT"
    SYSTEM_SYNTHESIS = "SYSTEM_SYNTHESIS"
    EXTERNAL_INGESTION = "EXTERNAL_INGESTION"


# ── Organizational Governance & Autonomy ────────────────────────────────────


class GovernanceAutonomyLevel(int, Enum):
    LEVEL_0 = 0  # OBSERVE - Listen only, no recommendations or executions
    LEVEL_1 = 1  # RECOMMEND - Can formulate suggestions, proposals, and plans
    LEVEL_2 = (
        2  # EXECUTE WITH APPROVAL - Must obtain explicit human/manager approval before execution
    )
    LEVEL_3 = (
        3  # EXECUTE WITHIN POLICY - Autonomous execution allowed within defined boundaries/ceilings
    )
    LEVEL_4 = 4  # AUTONOMOUS - Proactive execution across assigned scope, auto-escalates exceptions
    LEVEL_5 = 5  # AUTONOMOUS + ADAPTIVE - Self-optimizing, adaptive policy tuning, full delegation

    @property
    def label(self) -> str:
        return {
            0: "LEVEL 0 — OBSERVE",
            1: "LEVEL 1 — RECOMMEND",
            2: "LEVEL 2 — EXECUTE WITH APPROVAL",
            3: "LEVEL 3 — EXECUTE WITHIN POLICY",
            4: "LEVEL 4 — AUTONOMOUS",
            5: "LEVEL 5 — AUTONOMOUS + ADAPTIVE",
        }[self.value]


class GovernanceRiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class ApprovalStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CHANGES_REQUESTED = "CHANGES_REQUESTED"
    CANCELLED = "CANCELLED"
    EXPIRED = "EXPIRED"


class EscalationStatus(str, Enum):
    OPEN = "OPEN"
    UNDER_REVIEW = "UNDER_REVIEW"
    RESOLVED = "RESOLVED"
    DISMISSED = "DISMISSED"


# ── Agent Council & Deliberation ──────────────────────────────────────────


class CouncilType(str, Enum):
    PERMANENT = "PERMANENT"
    TEMPORARY = "TEMPORARY"


class DeliberationStage(str, Enum):
    PROPOSAL = "PROPOSAL"
    INDEPENDENT_REVIEW = "INDEPENDENT_REVIEW"
    OBJECTIONS = "OBJECTIONS"
    DISCUSSION = "DISCUSSION"
    SYNTHESIS = "SYNTHESIS"
    DECISION = "DECISION"
    RECORDED = "RECORDED"


class DeliberationStatus(str, Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    SYNTHESIZED = "SYNTHESIZED"
    RESOLVED = "RESOLVED"
    STALEMATE = "STALEMATE"
    CANCELLED = "CANCELLED"


# ── Performance & Evolution ────────────────────────────────────────────────


class PerformanceDimension(str, Enum):
    COMPANY = "COMPANY"
    DEPARTMENT = "DEPARTMENT"
    PROJECT = "PROJECT"
    WORKFLOW = "WORKFLOW"
    ROLE = "ROLE"
    AGENT = "AGENT"
    MODEL_PROVIDER = "MODEL_PROVIDER"
    TASK = "TASK"


class AdaptationType(str, Enum):
    CHANGE_AGENT_CONFIG = "CHANGE_AGENT_CONFIG"
    CHANGE_SYSTEM_PROMPT = "CHANGE_SYSTEM_PROMPT"
    CHANGE_MODEL_PROVIDER = "CHANGE_MODEL_PROVIDER"
    CHANGE_MODEL_ROUTING = "CHANGE_MODEL_ROUTING"
    CREATE_SPECIALIZATION = "CREATE_SPECIALIZATION"
    CREATE_NEW_AGENT = "CREATE_NEW_AGENT"
    RETIRE_AGENT = "RETIRE_AGENT"
    MODIFY_WORKFLOW = "MODIFY_WORKFLOW"
    MODIFY_RESOURCE_ALLOCATION = "MODIFY_RESOURCE_ALLOCATION"
    CREATE_TEMPORARY_DEPARTMENT = "CREATE_TEMPORARY_DEPARTMENT"
    MODIFY_STRATEGY = "MODIFY_STRATEGY"
    PROPOSE_POLICY_CHANGES = "PROPOSE_POLICY_CHANGES"


class AdaptationStage(str, Enum):
    OBSERVE = "OBSERVE"
    DIAGNOSE = "DIAGNOSE"
    PROPOSE = "PROPOSE"
    SIMULATE = "SIMULATE"
    EVALUATE = "EVALUATE"
    VALIDATE = "VALIDATE"
    APPROVE = "APPROVE"
    DEPLOY = "DEPLOY"
    MONITOR = "MONITOR"
    ROLLBACK = "ROLLBACK"


class AdaptationStatus(str, Enum):
    PROPOSED = "PROPOSED"
    SIMULATING = "SIMULATING"
    SIMULATED = "SIMULATED"
    VALIDATED = "VALIDATED"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    DEPLOYED = "DEPLOYED"
    MONITORING = "MONITORING"
    ROLLED_BACK = "ROLLED_BACK"
    SUCCESSFUL = "SUCCESSFUL"
