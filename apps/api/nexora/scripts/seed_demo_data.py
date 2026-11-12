"""
NEIMAN Autonomous Organization OS — Comprehensive Realistic Data Simulator.
Uses Faker to generate rich, realistic organizational datasets across all 15 domains:
- Companies & Organizational DNA
- Departments (Hierarchy & functional charters)
- Organizational Roles (Responsibilities, required skills, authority levels)
- Agent Employees (Personas, autonomy levels, capabilities, permissions, reporting hierarchies)
- Projects & Tasks (Milestones, priority matrices, dependencies)
- Workflows (Multi-step operational pipelines)
- Policies & Governance (Constitutions, autonomy constraints)
- Deliberation Councils (Multi-model reviews, debate threads, dissent preservation)
- Decisions & Permanent Organizational Memory
"""

import asyncio
import random
import uuid

from faker import Faker

# Domain models
from nexora.core.enums import (
    AgentAutonomy,
    AgentStatus,
    AutonomyLevel,
    CommunicationStyle,
    CompanyStatus,
    DecisionStatus,
    DecisionStyle,
    DepartmentStatus,
    EnforcementLevel,
    InnovationLevel,
    MembershipRole,
    PolicyScope,
    PolicyStatus,
    Priority,
    ProjectStatus,
    QualityThreshold,
    ResourceStrategy,
    RiskTolerance,
    RoleAuthority,
    TaskStatus,
    WorkflowExecutionStatus,
    WorkflowStatus,
    WorkflowTriggerType,
)
from nexora.database import AsyncSessionLocal
from nexora.domains.agents.models import Agent
from nexora.domains.auth.service import AuthService
from nexora.domains.councils.models import AgentCouncil, CouncilDeliberation
from nexora.domains.decisions.models import Decision
from nexora.domains.memory.models import MemoryItem
from nexora.domains.organizations.models import (
    Company,
    CompanyMember,
    Department,
    OrganizationalDNA,
    OrgRole,
)
from nexora.domains.policies.models import Policy
from nexora.domains.projects.models import Project, Task
from nexora.domains.workflows.models import Workflow, WorkflowExecution

fake = Faker()
Faker.seed(42)
random.seed(42)

AI_PROVIDERS = [
    {"provider": "anthropic", "model": "claude-3-5-sonnet", "cost_per_1k": 0.015},
    {"provider": "google", "model": "gemini-1.5-pro", "cost_per_1k": 0.007},
    {"provider": "openai", "model": "gpt-4o", "cost_per_1k": 0.010},
    {"provider": "anthropic", "model": "claude-3-5-haiku", "cost_per_1k": 0.002},
    {"provider": "google", "model": "gemini-1.5-flash", "cost_per_1k": 0.001},
]

DEPARTMENT_TEMPLATES = [
    (
        "Core Engineering & Architecture",
        "High-throughput distributed systems and autonomous agent coordination mesh",
    ),
    (
        "Product Strategy & UX",
        "User journeys, operational telemetry, and autonomous interface specifications",
    ),
    (
        "Cybersecurity & Zero-Trust Governance",
        "Autonomous threat modeling, policy validation, and least-privilege boundary enforcement",
    ),
    (
        "Data Intelligence & Model Mesh",
        "Multi-provider model routing, semantic vector indexing, and latency optimization",
    ),
    (
        "Operations, Finance & Compliance",
        "Budget allocations, cloud infrastructure scaling, and regulatory audit trail generation",
    ),
]

ROLE_TEMPLATES = [
    (
        "Chief Technology Officer",
        RoleAuthority.FULL,
        AutonomyLevel.FULLY_AUTONOMOUS,
        ["Platform Architecture", "Autonomous Strategy", "Risk Mitigation"],
    ),
    (
        "Principal Systems Architect",
        RoleAuthority.MANAGE,
        AutonomyLevel.FULLY_AUTONOMOUS,
        ["Microservices", "Event-Driven Queues", "Vector Store Design"],
    ),
    (
        "Security & Compliance Sentinel",
        RoleAuthority.EXECUTE,
        AutonomyLevel.GUIDED,
        ["Audit Analysis", "Vulnerability Scanning", "Constitutional Compliance"],
    ),
    (
        "Lead Backend Engineer",
        RoleAuthority.EXECUTE,
        AutonomyLevel.BALANCED,
        ["FastAPI", "SQLAlchemy", "Async Task Queues"],
    ),
    (
        "Intelligence Routing Specialist",
        RoleAuthority.EXECUTE,
        AutonomyLevel.DELEGATED,
        ["LLM Routing", "Cost Minimization", "Fallback Resilience"],
    ),
]


async def seed_data():
    print("🚀 Initializing realistic Faker simulation for NEIMAN...")

    async with AsyncSessionLocal() as db:
        auth_svc = AuthService(db)

        # 1. Preconfigured Persona Users across RBAC tiers
        preconfigured_users = [
            {
                "email": "elena.vance@neiman.ai",
                "username": "elena_vance",
                "password": "password123",
                "first_name": "Elena",
                "last_name": "Vance",
                "role": MembershipRole.OWNER,
                "is_superuser": True,
                "title": "Chief Executive Officer & Founder",
            },
            {
                "email": "marcus.sterling@neiman.ai",
                "username": "marcus_sterling",
                "password": "password123",
                "first_name": "Marcus",
                "last_name": "Sterling",
                "role": MembershipRole.ADMIN,
                "is_superuser": False,
                "title": "Principal Systems Architect (Admin)",
            },
            {
                "email": "elena.rostova@neiman.ai",
                "username": "elena_rostova",
                "password": "password123",
                "first_name": "Elena",
                "last_name": "Rostova",
                "role": MembershipRole.MEMBER,
                "is_superuser": False,
                "title": "Reliability SRE Manager (Manager)",
            },
            {
                "email": "tariq.almansoor@neiman.ai",
                "username": "tariq_almansoor",
                "password": "password123",
                "first_name": "Tariq",
                "last_name": "Al-Mansoor",
                "role": MembershipRole.VIEWER,
                "is_superuser": False,
                "title": "Security & Compliance Auditor (Viewer)",
            },
            # Also preserve legacy admin account
            {
                "email": "admin@furnitureco.com",
                "username": "admin_furniture",
                "password": "password123",
                "first_name": "Elena",
                "last_name": "Vance",
                "role": MembershipRole.OWNER,
                "is_superuser": True,
                "title": "Default Dev Admin",
            },
        ]

        created_users = []
        for u_data in preconfigured_users:
            existing = await auth_svc.repo.get_by_email(u_data["email"])
            if not existing:
                existing = await auth_svc.register(
                    email=u_data["email"],
                    username=u_data["username"],
                    password=u_data["password"],
                    first_name=u_data["first_name"],
                    last_name=u_data["last_name"],
                )
                if u_data["is_superuser"]:
                    existing.is_superuser = True
                    await db.commit()
                    await db.refresh(existing)
            created_users.append((existing, u_data["role"]))
            print(f"👤 Preconfigured User Ready: {existing.email} ({u_data['title']})")

        primary_owner = created_users[0][0]

        # 2. Flagship Company & DNA
        comp_name = "Aether Dynamics AI"
        company = Company(
            name=comp_name,
            slug=f"aether-dynamics-{uuid.uuid4().hex[:6]}",
            description="Autonomous, AI-native aerospace systems engineering and mission telemetry operations.",
            mission="To pioneer hyper-resilient autonomous organizational systems through multi-agent deliberation.",
            vision="A world where decentralized, self-optimizing organizations operate with total transparency and zero waste.",
            industry="Aerospace & AI Systems",
            status=CompanyStatus.ACTIVE,
            owner_id=primary_owner.id,
        )
        db.add(company)
        await db.flush()

        # Memberships for all preconfigured personas
        for u_obj, role in created_users:
            membership = CompanyMember(
                company_id=company.id,
                user_id=u_obj.id,
                role=role,
                is_active=True,
            )
            db.add(membership)
        await db.flush()

        # DNA
        dna = OrganizationalDNA(
            company_id=company.id,
            operating_philosophy="Radical transparency, multi-model consensus, and observable least-privilege automation.",
            innovation_level=InnovationLevel.RADICAL,
            autonomy_level=AutonomyLevel.FULLY_AUTONOMOUS,
            risk_tolerance=RiskTolerance.AGGRESSIVE,
            quality_threshold=QualityThreshold.EXCEPTIONAL,
            decision_style=DecisionStyle.CONSULTATIVE,
            communication_style=CommunicationStyle.ASYNC_FIRST,
            resource_strategy=ResourceStrategy.GROWTH,
        )
        db.add(dna)
        print(f"🏢 Created Company: {company.name} with Organizational DNA")

        # 3. Departments & Roles
        created_depts = []
        for name, purpose in DEPARTMENT_TEMPLATES:
            dept = Department(
                company_id=company.id,
                name=name,
                purpose=purpose,
                status=DepartmentStatus.ACTIVE,
            )
            db.add(dept)
            created_depts.append(dept)
        await db.flush()

        created_roles = []
        for i, (title, auth, aut_lvl, skills) in enumerate(ROLE_TEMPLATES):
            dept = created_depts[i % len(created_depts)]
            role = OrgRole(
                company_id=company.id,
                department_id=dept.id,
                title=title,
                authority=auth,
                autonomy_level=aut_lvl,
                responsibilities=[f"Lead {s}" for s in skills],
                capabilities=skills,
                required_skills=skills,
            )
            db.add(role)
            created_roles.append(role)
        await db.flush()
        print(
            f"🏛️ Created {len(created_depts)} Departments and {len(created_roles)} Organizational Roles"
        )

        # 4. Agent Workforce
        created_agents = []
        for i, role in enumerate(created_roles):
            prov = AI_PROVIDERS[i % len(AI_PROVIDERS)]
            agent = Agent(
                company_id=company.id,
                role_id=role.id,
                department_id=role.department_id,
                name=f"{fake.first_name()} AI ({role.title.split()[0]})",
                identity={
                    "persona": fake.catch_phrase(),
                    "tone": "Precision-focused, analytical, and collaborative",
                    "avatar": f"bot-{i + 1}",
                },
                system_instructions=f"You are the {role.title} of {comp_name}. {role.responsibilities[0]}. Maintain least privilege and verify all evidence.",
                responsibilities=role.responsibilities,
                goals=[fake.bs() for _ in range(2)],
                capabilities=role.capabilities,
                permissions={
                    "allowed_tools": [
                        "db_query",
                        "schema_validator",
                        "audit_logger",
                        "deploy_checker",
                    ]
                },
                tools=[
                    {"name": "code_auditor", "risk": "LOW"},
                    {"name": "benchmark_runner", "risk": "MEDIUM"},
                ],
                autonomy=AgentAutonomy.AUTONOMOUS if i % 2 == 0 else AgentAutonomy.SEMI_AUTONOMOUS,
                status=AgentStatus.AVAILABLE if i != 1 else AgentStatus.WORKING,
                intelligence_config={
                    "provider": prov["provider"],
                    "model": prov["model"],
                    "temperature": 0.2,
                },
                resource_usage={
                    "total_tokens": random.randint(25000, 150000),
                    "total_cost_usd": round(random.uniform(0.5, 4.5), 3),
                },
                performance_metadata={
                    "tasks_completed": random.randint(15, 60),
                    "success_rate": 0.98,
                },
            )
            db.add(agent)
            created_agents.append(agent)
        await db.flush()

        # Link manager hierarchy
        if len(created_agents) > 1:
            for ag in created_agents[1:]:
                ag.manager_agent_id = created_agents[0].id
        await db.flush()
        print(f"🤖 Created {len(created_agents)} AI Employees with Reporting Hierarchy")

        # 5. Projects & Tasks
        projects = []
        for title, prio in [
            ("Orbital Telemetry Stream Mesh", Priority.CRITICAL),
            ("Zero-Trust Agent Auth Gate 2.0", Priority.HIGH),
            ("Autonomous Fault-Tolerant Routing", Priority.MEDIUM),
        ]:
            proj = Project(
                company_id=company.id,
                owner_id=primary_owner.id,
                name=title,
                objective=fake.paragraph(nb_sentences=2),
                priority=prio,
                status=ProjectStatus.ACTIVE,
                milestones=[
                    {"milestone": "Phase 1 Scaffolding", "status": "DONE"},
                    {"milestone": "Live Deployment", "status": "IN_PROGRESS"},
                ],
            )
            db.add(proj)
            projects.append(proj)
        await db.flush()

        for proj in projects:
            for _ in range(3):
                assigned = random.choice(created_agents)
                task = Task(
                    company_id=company.id,
                    project_id=proj.id,
                    assigned_agent_id=assigned.id,
                    title=f"{fake.word().capitalize()} {fake.bs()}",
                    description=fake.sentence(),
                    priority=random.choice(list(Priority)),
                    status=random.choice(
                        [TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED, TaskStatus.PENDING]
                    ),
                    dependencies=[],
                    resource_requirements={
                        "tokens": random.randint(5000, 20000),
                        "compute_slots": 1,
                    },
                )
                db.add(task)
        await db.flush()
        print(f"📁 Created {len(projects)} Strategic Projects with Automated Tasks")

        # 6. Workflows
        wf = Workflow(
            company_id=company.id,
            name="Autonomous Incident Mitigation Pipeline",
            description="End-to-end detection, analysis, human approval gate, and rollback deployment.",
            trigger_type=WorkflowTriggerType.EVENT,
            trigger_config={"event_name": "system.anomaly.detected"},
            steps=[
                {
                    "id": "st-1",
                    "name": "Telemetry Ingestion & Diagnostic",
                    "type": "AGENT",
                    "config": {"agent": created_agents[0].name},
                },
                {
                    "id": "st-2",
                    "name": "Vulnerability Impact Assessment",
                    "type": "AGENT",
                    "config": {"agent": created_agents[1].name},
                },
                {
                    "id": "st-3",
                    "name": "Executive Sign-Off",
                    "type": "APPROVAL",
                    "config": {"title": "Authorize Patch Application", "risk_level": "CRITICAL"},
                },
                {
                    "id": "st-4",
                    "name": "Deploy Automated Remediation",
                    "type": "TOOL",
                    "config": {"tool_name": "ansible_executor"},
                },
            ],
            agents=[str(a.id) for a in created_agents[:2]],
            tools=["ansible_executor", "telemetry_collector"],
            status=WorkflowStatus.ACTIVE,
        )
        db.add(wf)
        await db.flush()

        wf_exec = WorkflowExecution(
            workflow_id=wf.id,
            company_id=company.id,
            title="Incident Run #0042",
            status=WorkflowExecutionStatus.RUNNING,
            current_step_id="st-2",
            current_step_name="Vulnerability Impact Assessment",
            current_step_index=1,
            total_steps=4,
            input_payload={"anomaly_id": "anom-9081", "severity": "HIGH"},
            state_payload={"diagnostics_cleared": True},
        )
        db.add(wf_exec)
        print("⚡ Created Orchestrated Incident Mitigation Workflow & Active Run")

        # 7. Agent Council & Deliberation
        council = AgentCouncil(
            company_id=company.id,
            name="Aether Systems Architecture Council",
            charter="Deliberates architectural safety, model routing fallbacks, and autonomous policy violations.",
            council_type="PERMANENT",
            synthesis_agent_id=created_agents[0].id,
            members=[
                {
                    "role_title": created_roles[0].title,
                    "agent_name": created_agents[0].name,
                    "perspective": "Strategic Feasibility",
                    "model_identifier": "gpt-4o",
                    "model_provider": "openai",
                },
                {
                    "role_title": created_roles[1].title,
                    "agent_name": created_agents[1].name,
                    "perspective": "Scalability & Resilience",
                    "model_identifier": "claude-3-5-sonnet",
                    "model_provider": "anthropic",
                },
                {
                    "role_title": created_roles[2].title,
                    "agent_name": created_agents[2].name,
                    "perspective": "Zero-Trust Security",
                    "model_identifier": "gemini-1.5-pro",
                    "model_provider": "google",
                },
            ],
        )
        db.add(council)
        await db.flush()

        delib = CouncilDeliberation(
            council_id=council.id,
            company_id=company.id,
            title="Multi-Model Failover Resilience Under API Throttling",
            problem_statement="How should autonomous agents degrade gracefully when primary providers experience rate-limiting?",
            current_stage="SYNTHESIS",
            status="SYNTHESIZED",
            proposals=[
                {
                    "author": created_agents[1].name,
                    "strategy": "Instant fallback to Gemini 1.5 Flash with cached schemas",
                }
            ],
            independent_reviews=[
                {
                    "agent_name": created_agents[0].name,
                    "role": "CTO",
                    "model": "GPT-4o",
                    "proposal": "Prioritize business tasks",
                    "confidence": 0.95,
                    "risks": ["Cost spikes"],
                },
                {
                    "agent_name": created_agents[1].name,
                    "role": "Architect",
                    "model": "Claude 3.5 Sonnet",
                    "proposal": "Local model fallback",
                    "confidence": 0.91,
                    "risks": ["Lower reasoning depth"],
                },
            ],
            synthesis_proposal={
                "title": "Hierarchical Fallback Protocol",
                "synthesized_decision": "Use Claude 3.5 Sonnet as primary, fallback to Gemini 1.5 Pro within 1.5s timeout, and preserve state in Redis.",
                "consensus_points": [
                    "Zero data loss is mandatory",
                    "Strict schema validation required across all fallbacks",
                ],
            },
            disagreements_recorded=[
                {
                    "topic": "Local Llama vs Cloud Fallback",
                    "dissenting_agents": [created_agents[1].name],
                    "dissenting_models": ["Claude 3.5 Sonnet"],
                    "argument": "Local models ensure total sovereignty during network partitions.",
                    "counter_argument": "Cloud providers offer superior tool calling compliance.",
                    "mitigation": "Hybrid approach: Cloud secondary with local tertiary emergency queue.",
                }
            ],
        )
        db.add(delib)
        print("🏛️ Created Architecture Council with Multi-Model Dissent Deliberation")

        # 8. Governance Policies & Organizational Memory
        policy = Policy(
            company_id=company.id,
            name="Autonomous Tool Execution Security Constitution",
            description="Constitutional constraints for autonomous agent tool invocations.",
            scope=PolicyScope.COMPANY,
            enforcement_level=EnforcementLevel.HARD,
            status=PolicyStatus.ACTIVE,
            rules=[
                {
                    "id": "r-1",
                    "name": "Financial Limit",
                    "condition": "cost > 50.0",
                    "action": "REQUIRE_APPROVAL",
                }
            ],
        )
        db.add(policy)

        decision = Decision(
            company_id=company.id,
            title="Adoption of Multi-Model Intelligence Architecture",
            problem="Avoid single-vendor lock-in across critical organizational workflows.",
            decision="Adopt NEIMAN Intelligence Exchange with capability routing.",
            rationale="Eliminates single point of failure and allows model swapping without rewrites.",
            expected_outcome="99.99% workflow uptime even during major cloud vendor outages.",
            status=DecisionStatus.DECIDED,
        )
        db.add(decision)

        mem = MemoryItem(
            company_id=company.id,
            domain="DECISION",
            title="Multi-Model Mesh Architecture Decision",
            content="Ratified decision to route tasks based on capabilities: Claude for architecture, Gemini for high context, OpenAI for general dispatch.",
            source="Architecture Council Ratification",
            scope="INTERNAL",
        )
        db.add(mem)

        await db.commit()
        print("✅ Successfully seeded all 15 domains with realistic simulated data!")


if __name__ == "__main__":
    asyncio.run(seed_data())
