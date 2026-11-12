"""
Preconfigured catalog of industry organizational blueprints for NEIMAN.

Blueprints included:
1. Software Development Company
2. Forex Trading Company
3. Marketing Agency
4. Social Media Company
5. Cybersecurity Company
6. Research Organization
7. E-commerce Company
8. Game Studio
9. IT Services Company
10. Education Organization
11. Mining Technology Company
"""

SYSTEM_BLUEPRINTS = [
    # -------------------------------------------------------------
    # 1. SOFTWARE DEVELOPMENT COMPANY
    # -------------------------------------------------------------
    {
        "key": "software_development_company",
        "name": "Software Development Company",
        "tagline": "Autonomous Agile Product Engineering & Quality-Driven Delivery",
        "description": "Full-lifecycle autonomous software engineering firm featuring product strategy, architecture review, parallel worktree engineering, automated QA, security auditing, and continuous production delivery.",
        "category": "Technology",
        "icon": "code",
        "is_system_template": True,
        "default_autonomy": 3,
        "estimated_monthly_cost_usd": 0.0,
        "metadata_tags": [
            "software",
            "devops",
            "engineering",
            "agile",
            "ai-native",
            "quality-first",
        ],
        "company_definition": {
            "name": "Software Development Company",
            "mission": "Deliver mission-critical, resilient software systems through continuous AI-augmented engineering under human executive direction.",
            "vision": "Autonomous self-healing, verified software engineering driven by operational quality gates.",
            "industry": "Software Engineering",
            "dna": {
                "operating_philosophy": "Rigorous Continuous Integration, 100% test verification, and isolated worktree execution",
                "innovation_level": "PROGRESSIVE",
                "autonomy_level": "DELEGATED",
                "risk_tolerance": "MODERATE",
                "quality_threshold": "EXCEPTIONAL",
                "decision_style": "CONSULTATIVE",
                "communication_style": "ASYNC_FIRST",
                "resource_strategy": "GROWTH",
            },
        },
        "departments": [
            {
                "name": "Executive Leadership",
                "purpose": "Strategic engineering directives, swarm orchestration, executive briefs, and resource allocation",
            },
            {
                "name": "Product & Architecture",
                "purpose": "Product specifications, technical requirements, ADR synthesis, and domain modeling",
            },
            {
                "name": "Core Engineering",
                "purpose": "Backend microservices, frontend interfaces, and distributed system development",
            },
            {
                "name": "Security & Compliance",
                "purpose": "Vulnerability scanning, dependency audit, secret detection, and AST compliance enforcement",
            },
            {
                "name": "Quality & Reliability",
                "purpose": "Automated regression testing, test matrix execution, latency monitoring, and SRE operations",
            },
            {
                "name": "Infrastructure & Operations",
                "purpose": "Git worktree orchestration, CI/CD pipelines, containerization, and production convergence",
            },
            {
                "name": "Database & Data Architecture",
                "purpose": "Relational schemas, Alembic migrations, SQL query optimization, and data consistency",
            },
            {
                "name": "Code Quality & Governance",
                "purpose": "Architectural rot prevention, boundary enforcement, PR auditing, and code hygiene",
            },
            {
                "name": "Documentation & Knowledge",
                "purpose": "API reference specs, system architecture documentation, and changelog maintenance",
            },
            {
                "name": "Growth & Ecosystem",
                "purpose": "MCP/OpenAPI ecosystem integrations, programmatic SEO, launch distribution, and partnerships",
            },
        ],
        "roles": [
            {
                "department_name": "Executive Leadership",
                "title": "Chief Technology Officer",
                "responsibilities": [
                    "Direct autonomous engineering swarm execution and milestone roadmapping",
                    "Synthesize Stage 2 Architecture Briefs and Stage 5 Production Release Cards for Human CEO",
                    "Resolve inter-agent technical deadlocks and enforce platform architectural integrity",
                ],
                "capabilities": [
                    "swarm_orchestration",
                    "roadmap_planning",
                    "executive_briefing",
                    "deadlock_resolution",
                    "architecture_governance",
                ],
                "authority": "MANAGE",
                "autonomy_level": 4,
            },
            {
                "department_name": "Product & Architecture",
                "title": "Product Manager",
                "responsibilities": [
                    "Synthesize raw user requirements into formal technical specs",
                    "Score requirement completeness and testability",
                    "Prioritize delivery milestones and acceptance criteria",
                ],
                "capabilities": ["requirement_analysis", "spec_synthesis", "acceptance_testing"],
                "authority": "MANAGE",
                "autonomy_level": 3,
            },
            {
                "department_name": "Product & Architecture",
                "title": "Lead Software Architect",
                "responsibilities": [
                    "Formulate system architecture and technical ADRs",
                    "Evaluate scalability, concurrency, and schema tradeoffs",
                    "Present Stage 2 Executive Briefing Cards to Human CEO",
                ],
                "capabilities": ["architectural_reasoning", "system_design", "adr_synthesis"],
                "authority": "MANAGE",
                "autonomy_level": 4,
            },
            {
                "department_name": "Product & Architecture",
                "title": "Scrum Master & Workflow Coordinator",
                "responsibilities": [
                    "Coordinate autonomous sprint cadence and monitor DAG dependency progression",
                    "Proactively identify and eliminate task bottlenecks across the 13 agents",
                    "Maintain real-time completion velocity metrics and standup summaries",
                ],
                "capabilities": [
                    "sprint_coordination",
                    "dag_scheduling",
                    "blocker_resolution",
                    "velocity_tracking",
                    "workload_balancing",
                ],
                "authority": "MANAGE",
                "autonomy_level": 3,
            },
            {
                "department_name": "Core Engineering",
                "title": "Backend Engineer",
                "responsibilities": [
                    "Implement domain APIs, ORM schemas, and business workflows",
                    "Ensure idempotent endpoints and strict type safety",
                    "Maintain zero unhandled database exceptions",
                ],
                "capabilities": [
                    "code_generation",
                    "api_design",
                    "debugging",
                    "database_optimization",
                ],
                "authority": "EXECUTE",
                "autonomy_level": 3,
            },
            {
                "department_name": "Core Engineering",
                "title": "Frontend / UI Engineer",
                "responsibilities": [
                    "Build responsive, high-contrast, accessible user interfaces",
                    "Integrate API endpoints with React Query and TypeScript",
                    "Enforce zero untyped business logic and complete UI states",
                ],
                "capabilities": ["ui_engineering", "typescript", "design_systems", "accessibility"],
                "authority": "EXECUTE",
                "autonomy_level": 3,
            },
            {
                "department_name": "Database & Data Architecture",
                "title": "Database & Migrations Engineer",
                "responsibilities": [
                    "Author and verify reversible Alembic schema migrations",
                    "Design relational tables with strict foreign keys and composite indexes",
                    "Audit query execution plans to eliminate N+1 latency bottlenecks",
                ],
                "capabilities": [
                    "database_architecture",
                    "schema_migrations",
                    "sql_optimization",
                    "alembic",
                ],
                "authority": "EXECUTE",
                "autonomy_level": 3,
            },
            {
                "department_name": "Code Quality & Governance",
                "title": "Code Reviewer & Quality Sentinel",
                "responsibilities": [
                    "Audit code diffs for architectural rot, boundary violations, and dead imports",
                    "Enforce strict TypeScript typing and zero untyped any business logic",
                    "Validate modular encapsulation and prevent circular dependency coupling",
                ],
                "capabilities": [
                    "code_review",
                    "architecture_rot_audit",
                    "refactoring",
                    "circular_dependency_detection",
                ],
                "authority": "MANAGE",
                "autonomy_level": 4,
            },
            {
                "department_name": "Security & Compliance",
                "title": "Security Sentinel",
                "responsibilities": [
                    "Audit code diffs for CVE vulnerabilities and unsafe calls",
                    "Enforce secret scrubbing and least-privilege token access",
                    "Verify tenant isolation across all storage boundaries",
                ],
                "capabilities": ["security_audit", "vulnerability_scan", "policy_enforcement"],
                "authority": "MANAGE",
                "autonomy_level": 4,
            },
            {
                "department_name": "Quality & Reliability",
                "title": "QA Test Automation Engineer",
                "responsibilities": [
                    "Author unit, integration, and regression test suites",
                    "Enforce minimum 80% branch code coverage gate",
                    "Validate edge cases and payload validation failure paths",
                ],
                "capabilities": ["test_generation", "mutation_testing", "coverage_analysis"],
                "authority": "EXECUTE",
                "autonomy_level": 3,
            },
            {
                "department_name": "Quality & Reliability",
                "title": "Site Reliability Engineer",
                "responsibilities": [
                    "Observe system latency, error budgets, and uptime telemetry",
                    "Automate canary validation and zero-downtime rollouts",
                    "Escalate error spikes and trip circuit breakers when needed",
                ],
                "capabilities": [
                    "telemetry_analysis",
                    "incident_remediation",
                    "circuit_breaker_control",
                ],
                "authority": "EXECUTE",
                "autonomy_level": 3,
            },
            {
                "department_name": "Infrastructure & Operations",
                "title": "DevOps & CI/CD Engineer",
                "responsibilities": [
                    "Orchestrate isolated Git worktree sandboxes (apps/api, apps/web)",
                    "Manage test runners, linters, and containerized builds",
                    "Prepare Stage 5 Production Release Briefing Cards for Human CEO",
                ],
                "capabilities": ["git_worktrees", "ci_cd_orchestration", "build_optimization"],
                "authority": "EXECUTE",
                "autonomy_level": 3,
            },
            {
                "department_name": "Documentation & Knowledge",
                "title": "Technical Writer",
                "responsibilities": [
                    "Generate and update OpenAPI specs and architectural docs",
                    "Produce human-readable release notes and changelogs",
                    "Maintain living developer guides and onboarding playbooks",
                ],
                "capabilities": [
                    "documentation_synthesis",
                    "changelog_generation",
                    "spec_formatting",
                ],
                "authority": "EXECUTE",
                "autonomy_level": 3,
            },
        ],
        "agents": [
            {
                "name": "Solomon · CTO",
                "role_title": "Chief Technology Officer",
                "department_name": "Executive Leadership",
                "identity": {
                    "slug": "cto_agent",
                    "avatar_url": "/avatars/cto_agent.png",
                    "soul_file": "cto_agent/soul.md",
                    "tone": "authoritative",
                    "style": "strategic",
                    "skills": [
                        "swarm_orchestration",
                        "roadmap_planning",
                        "executive_briefing",
                        "deadlock_resolution",
                        "architecture_governance",
                    ],
                },
                "system_instructions": "Oversee end-to-end engineering roadmap delivery, agent task delegation, architecture consensus, and strategic milestones. Coordinate swarm execution, resolve cross-domain deadlocks, and formulate executive briefing cards for the Human CEO.",
                "responsibilities": [
                    "Direct autonomous engineering swarm execution and milestone roadmapping",
                    "Synthesize Stage 2 Architecture Briefs and Stage 5 Production Release Cards for Human CEO",
                    "Resolve inter-agent technical deadlocks and enforce platform architectural integrity",
                ],
                "capabilities": [
                    "swarm_orchestration",
                    "roadmap_planning",
                    "executive_briefing",
                    "deadlock_resolution",
                    "architecture_governance",
                ],
                "tools": [
                    {
                        "name": "swarm_delegator",
                        "description": "Delegate tasks and monitor execution across autonomous agents",
                        "risk_level": "MEDIUM",
                    }
                ],
                "autonomy_level": 4,
                "intelligence_config": {
                    "routing_strategy": "AUTO_DYNAMIC",
                    "tier": "FRONTIER_ARCHITECT",
                },
                "resource_limits": {"unlimited_context": True},
            },
            {
                "name": "Daniel · Product Spec",
                "role_title": "Product Manager",
                "department_name": "Product & Architecture",
                "identity": {
                    "slug": "product_spec_agent",
                    "avatar_url": "/avatars/product_spec_agent.png",
                    "soul_file": "product_spec_agent/soul.md",
                    "tone": "structured",
                    "style": "exhaustive",
                    "skills": [
                        "requirement_analysis",
                        "spec_synthesis",
                        "acceptance_testing",
                        "story_decomposition",
                        "completeness_scoring",
                    ],
                },
                "system_instructions": "Transform high-level prompts into rigorous engineering requirements with clear user stories and acceptance criteria. Score completeness and verify testability.",
                "responsibilities": [
                    "Draft technical requirements",
                    "Score requirement completeness",
                    "Formulate verifiable Given-When-Then acceptance criteria",
                ],
                "capabilities": [
                    "requirement_analysis",
                    "spec_synthesis",
                    "acceptance_testing",
                    "story_decomposition",
                    "completeness_scoring",
                ],
                "tools": [
                    {
                        "name": "spec_validator",
                        "description": "Validate requirement schema and acceptance criteria",
                        "risk_level": "LOW",
                    }
                ],
                "autonomy_level": 3,
                "intelligence_config": {"routing_strategy": "AUTO_DYNAMIC", "tier": "REASONING"},
                "resource_limits": {"unlimited_context": True},
            },
            {
                "name": "Bezalel · Lead Architect",
                "role_title": "Lead Software Architect",
                "department_name": "Product & Architecture",
                "identity": {
                    "slug": "lead_architect_agent",
                    "avatar_url": "/avatars/lead_architect_agent.png",
                    "soul_file": "lead_architect_agent/soul.md",
                    "tone": "analytical",
                    "style": "principled",
                    "skills": [
                        "architectural_reasoning",
                        "adr_synthesis",
                        "system_design",
                        "concurrency_modeling",
                        "boundary_enforcement",
                    ],
                },
                "system_instructions": "Design maintainable, decoupled microservices. Prioritize asynchronous patterns, strict typing, and produce ADRs for CEO sign-off.",
                "responsibilities": [
                    "Draft Architecture Decision Records",
                    "Prepare Stage 2 Executive Briefing",
                    "Enforce strict modular boundary separation",
                ],
                "capabilities": [
                    "architectural_reasoning",
                    "adr_synthesis",
                    "system_design",
                    "concurrency_modeling",
                    "boundary_enforcement",
                ],
                "tools": [
                    {
                        "name": "repo_indexer",
                        "description": "Index repo AST and dependencies",
                        "risk_level": "LOW",
                    }
                ],
                "autonomy_level": 4,
                "intelligence_config": {
                    "routing_strategy": "AUTO_DYNAMIC",
                    "tier": "FRONTIER_ARCHITECT",
                },
                "resource_limits": {"unlimited_context": True},
            },
            {
                "name": "Jethro · Scrum Master",
                "role_title": "Scrum Master & Workflow Coordinator",
                "department_name": "Product & Architecture",
                "identity": {
                    "slug": "scrum_master_agent",
                    "avatar_url": "/avatars/scrum_master_agent.png",
                    "soul_file": "scrum_master_agent/soul.md",
                    "tone": "disciplined",
                    "style": "unblocking",
                    "skills": [
                        "sprint_coordination",
                        "dag_scheduling",
                        "blocker_resolution",
                        "velocity_tracking",
                        "workload_balancing",
                    ],
                },
                "system_instructions": "Coordinate autonomous sprint cadence, monitor DAG task dependencies, unblock stuck worker agents, balance worktree allocations, and maintain real-time task velocity metrics.",
                "responsibilities": [
                    "Coordinate autonomous sprint cadence",
                    "Monitor DAG task dependencies and resolve blockers",
                    "Track completion velocity and pipeline burndown",
                ],
                "capabilities": [
                    "sprint_coordination",
                    "dag_scheduling",
                    "blocker_resolution",
                    "velocity_tracking",
                    "workload_balancing",
                ],
                "tools": [
                    {
                        "name": "cadence_coordinator",
                        "description": "Track sprint velocity and unblock agent dependencies",
                        "risk_level": "LOW",
                    }
                ],
                "autonomy_level": 3,
                "intelligence_config": {"routing_strategy": "AUTO_DYNAMIC", "tier": "EXECUTION"},
                "resource_limits": {"unlimited_context": True},
            },
            {
                "name": "Luke · Backend Engineer",
                "role_title": "Backend Engineer",
                "department_name": "Core Engineering",
                "identity": {
                    "slug": "backend_engineer_agent",
                    "avatar_url": "/avatars/backend_engineer_agent.png",
                    "soul_file": "backend_engineer_agent/soul.md",
                    "tone": "pragmatic",
                    "style": "defensive",
                    "skills": [
                        "code_generation",
                        "api_design",
                        "debugging",
                        "async_programming",
                        "transaction_boundaries",
                    ],
                },
                "system_instructions": "Write performant Python/FastAPI code with SQLAlchemy 2.0 async, pydantic validation, idempotent endpoints, and comprehensive test fixtures.",
                "responsibilities": [
                    "Implement backend features and microservice APIs",
                    "Validate input schemas and ensure idempotent transactions",
                    "Maintain zero unhandled server exceptions",
                ],
                "capabilities": [
                    "code_generation",
                    "api_design",
                    "debugging",
                    "async_programming",
                    "transaction_boundaries",
                ],
                "tools": [
                    {
                        "name": "backend_test_runner",
                        "description": "Run pytest suite and verify route contracts",
                        "risk_level": "LOW",
                    }
                ],
                "autonomy_level": 3,
                "intelligence_config": {"routing_strategy": "AUTO_DYNAMIC", "tier": "DEEP_CODING"},
                "resource_limits": {"unlimited_context": True},
            },
            {
                "name": "Ruth · Frontend Engineer",
                "role_title": "Frontend / UI Engineer",
                "department_name": "Core Engineering",
                "identity": {
                    "slug": "frontend_engineer_agent",
                    "avatar_url": "/avatars/frontend_engineer_agent.png",
                    "soul_file": "frontend_engineer_agent/soul.md",
                    "tone": "detail-oriented",
                    "style": "accessible",
                    "skills": [
                        "ui_engineering",
                        "typescript",
                        "design_systems",
                        "accessibility",
                        "state_management",
                    ],
                },
                "system_instructions": "Implement clean, responsive React/Next.js interfaces with strict TypeScript typing, accessible markup, dark/light themes, and zero unhandled errors.",
                "responsibilities": [
                    "Build responsive React and Next.js frontend interfaces",
                    "Enforce zero untyped any business logic and full UI state completeness",
                    "Maintain design system tokens and WCAG 2.1 AA accessibility",
                ],
                "capabilities": [
                    "ui_engineering",
                    "typescript",
                    "design_systems",
                    "accessibility",
                    "state_management",
                ],
                "tools": [
                    {
                        "name": "ui_linter",
                        "description": "Run Next.js and TypeScript linter",
                        "risk_level": "LOW",
                    }
                ],
                "autonomy_level": 3,
                "intelligence_config": {"routing_strategy": "AUTO_DYNAMIC", "tier": "DEEP_CODING"},
                "resource_limits": {"unlimited_context": True},
            },
            {
                "name": "Ezra · Database Engineer",
                "role_title": "Database & Migrations Engineer",
                "department_name": "Database & Data Architecture",
                "identity": {
                    "slug": "database_engineer_agent",
                    "avatar_url": "/avatars/database_engineer_agent.png",
                    "soul_file": "database_engineer_agent/soul.md",
                    "tone": "conservative",
                    "style": "performance-focused",
                    "skills": [
                        "database_architecture",
                        "schema_migrations",
                        "sql_optimization",
                        "alembic",
                        "transaction_isolation",
                        "indexing",
                    ],
                },
                "system_instructions": "Design normalized, high-performance relational schemas for SQLite and PostgreSQL. Author zero-downtime Alembic migrations, optimize queries with composite indexes, enforce foreign key integrity, and prevent N+1 query patterns.",
                "responsibilities": [
                    "Author and verify reversible Alembic migrations",
                    "Optimize relational schemas with composite indexes",
                    "Audit queries to eliminate N+1 latency bottlenecks",
                ],
                "capabilities": [
                    "database_architecture",
                    "schema_migrations",
                    "sql_optimization",
                    "alembic",
                    "transaction_isolation",
                    "indexing",
                ],
                "tools": [
                    {
                        "name": "migration_verifier",
                        "description": "Verify reversible database migrations and schema consistency",
                        "risk_level": "MEDIUM",
                    }
                ],
                "autonomy_level": 3,
                "intelligence_config": {
                    "routing_strategy": "AUTO_DYNAMIC",
                    "tier": "DATA_ARCHITECT",
                },
                "resource_limits": {"unlimited_context": True},
            },
            {
                "name": "Nathan · Code Reviewer",
                "role_title": "Code Reviewer & Quality Sentinel",
                "department_name": "Code Quality & Governance",
                "identity": {
                    "slug": "code_reviewer_agent",
                    "avatar_url": "/avatars/code_reviewer_agent.png",
                    "soul_file": "code_reviewer_agent/soul.md",
                    "tone": "pedantic",
                    "style": "thorough",
                    "skills": [
                        "code_review",
                        "architecture_rot_audit",
                        "refactoring",
                        "circular_dependency_detection",
                        "clean_code_enforcement",
                    ],
                },
                "system_instructions": "Audit all code modifications for architectural rot, boundary violations, code duplication, untyped business logic, and circular imports. Enforce clean code standards and strict pairing guidelines prior to branch merging.",
                "responsibilities": [
                    "Audit code diffs for architectural rot and circular imports",
                    "Enforce strict TypeScript typing and zero untyped any",
                    "Validate modular encapsulation and boundary compliance",
                ],
                "capabilities": [
                    "code_review",
                    "architecture_rot_audit",
                    "refactoring",
                    "circular_dependency_detection",
                    "clean_code_enforcement",
                ],
                "tools": [
                    {
                        "name": "rot_auditor",
                        "description": "Scan codebase for architectural rot and style violations",
                        "risk_level": "LOW",
                    }
                ],
                "autonomy_level": 4,
                "intelligence_config": {"routing_strategy": "AUTO_DYNAMIC", "tier": "CODE_REVIEW"},
                "resource_limits": {"unlimited_context": True},
            },
            {
                "name": "Michael · Security Lead",
                "role_title": "Security Sentinel",
                "department_name": "Security & Compliance",
                "identity": {
                    "slug": "security_sentinel_agent",
                    "avatar_url": "/avatars/security_sentinel_agent.png",
                    "soul_file": "security_sentinel_agent/soul.md",
                    "tone": "zero-trust",
                    "style": "vigilant",
                    "skills": [
                        "security_audit",
                        "vulnerability_scan",
                        "secret_scrubbing",
                        "policy_enforcement",
                        "cve_triage",
                    ],
                },
                "system_instructions": "Review all AST diffs and dependencies for security flaws, unauthorized file access, CVE vulnerabilities, and credential leakage. Enforce least-privilege token access and tenant isolation.",
                "responsibilities": [
                    "Perform static security audits across codebase diffs",
                    "Enforce zero secret retention and scrub credentials",
                    "Triage third-party dependency CVE advisories",
                ],
                "capabilities": [
                    "security_audit",
                    "vulnerability_scan",
                    "secret_scrubbing",
                    "policy_enforcement",
                    "cve_triage",
                ],
                "tools": [
                    {
                        "name": "security_scanner",
                        "description": "Scan diffs for vulnerabilities and leaked secrets",
                        "risk_level": "LOW",
                    }
                ],
                "autonomy_level": 4,
                "intelligence_config": {
                    "routing_strategy": "AUTO_DYNAMIC",
                    "tier": "SECURITY_AUDIT",
                },
                "resource_limits": {"unlimited_context": True},
            },
            {
                "name": "Deborah · QA Automation",
                "role_title": "QA Test Automation Engineer",
                "department_name": "Quality & Reliability",
                "identity": {
                    "slug": "qa_automation_agent",
                    "avatar_url": "/avatars/qa_automation_agent.png",
                    "soul_file": "qa_automation_agent/soul.md",
                    "tone": "empirical",
                    "style": "test-driven",
                    "skills": [
                        "test_generation",
                        "coverage_analysis",
                        "mutation_testing",
                        "regression_verification",
                        "e2e_journey_testing",
                    ],
                },
                "system_instructions": "Generate comprehensive unit and integration tests. Enforce strict 80%+ branch coverage and verify negative test cases, edge cases, and regression assertions.",
                "responsibilities": [
                    "Run automated regression test suites",
                    "Calculate branch and line code coverage %",
                    "Script end-to-end user journeys verifying full-stack workflows",
                ],
                "capabilities": [
                    "test_generation",
                    "coverage_analysis",
                    "mutation_testing",
                    "regression_verification",
                    "e2e_journey_testing",
                ],
                "tools": [
                    {
                        "name": "coverage_analyzer",
                        "description": "Measure test pass rate and branch coverage %",
                        "risk_level": "LOW",
                    }
                ],
                "autonomy_level": 3,
                "intelligence_config": {"routing_strategy": "AUTO_DYNAMIC", "tier": "VERIFICATION"},
                "resource_limits": {"unlimited_context": True},
            },
            {
                "name": "Gabriel · SRE Guard",
                "role_title": "Site Reliability Engineer",
                "department_name": "Quality & Reliability",
                "identity": {
                    "slug": "sre_guard_agent",
                    "avatar_url": "/avatars/sre_guard_agent.png",
                    "soul_file": "sre_guard_agent/soul.md",
                    "tone": "telemetry-driven",
                    "style": "protective",
                    "skills": [
                        "telemetry_analysis",
                        "circuit_breaker_control",
                        "incident_remediation",
                        "error_budget_monitoring",
                        "synthetic_probing",
                    ],
                },
                "system_instructions": "Observe uptime, latency thresholds, error budgets, and API health. Block promotions if error rates exceed 0.1%, trigger canary rollbacks, and manage circuit breakers.",
                "responsibilities": [
                    "Monitor system health telemetry and endpoint latencies",
                    "Manage automated circuit breakers and rollback triggers",
                    "Steward error budgets and enforce reliability SLAs",
                ],
                "capabilities": [
                    "telemetry_analysis",
                    "circuit_breaker_control",
                    "incident_remediation",
                    "error_budget_monitoring",
                    "synthetic_probing",
                ],
                "tools": [
                    {
                        "name": "telemetry_probe",
                        "description": "Poll health endpoints and telemetry feeds",
                        "risk_level": "LOW",
                    }
                ],
                "autonomy_level": 3,
                "intelligence_config": {
                    "routing_strategy": "AUTO_DYNAMIC",
                    "tier": "LOW_LATENCY_OBSERVABILITY",
                },
                "resource_limits": {"unlimited_context": True},
            },
            {
                "name": "Noah · DevOps & Release",
                "role_title": "DevOps & CI/CD Engineer",
                "department_name": "Infrastructure & Operations",
                "identity": {
                    "slug": "devops_release_agent",
                    "avatar_url": "/avatars/devops_release_agent.png",
                    "soul_file": "devops_release_agent/soul.md",
                    "tone": "automated",
                    "style": "hermetic",
                    "skills": [
                        "git_worktrees",
                        "ci_cd_orchestration",
                        "build_optimization",
                        "release_management",
                        "daemon_lifecycle",
                    ],
                },
                "system_instructions": "Manage parallel Git worktrees, execute hermetic container builds, coordinate merge trains, and prepare Stage 5 Production Release Briefing Cards for the CEO.",
                "responsibilities": [
                    "Orchestrate isolated Git worktree sandboxes",
                    "Maintain CI test runners, linters, and hermetic build jobs",
                    "Prepare Stage 5 Production Release Briefing Cards",
                ],
                "capabilities": [
                    "git_worktrees",
                    "ci_cd_orchestration",
                    "build_optimization",
                    "release_management",
                    "daemon_lifecycle",
                ],
                "tools": [
                    {
                        "name": "worktree_manager",
                        "description": "Spawn and merge isolated worktrees",
                        "risk_level": "MEDIUM",
                    }
                ],
                "autonomy_level": 3,
                "intelligence_config": {"routing_strategy": "AUTO_DYNAMIC", "tier": "EXECUTION"},
                "resource_limits": {"unlimited_context": True},
            },
            {
                "name": "Baruch · Technical Writer",
                "role_title": "Technical Writer",
                "department_name": "Documentation & Knowledge",
                "identity": {
                    "slug": "technical_writer_agent",
                    "avatar_url": "/avatars/technical_writer_agent.png",
                    "soul_file": "technical_writer_agent/soul.md",
                    "tone": "lucid",
                    "style": "developer-centric",
                    "skills": [
                        "documentation_synthesis",
                        "openapi_authoring",
                        "changelog_generation",
                        "spec_formatting",
                        "developer_runbooks",
                    ],
                },
                "system_instructions": "Synchronize documentation with code changes. Produce concise, accurate OpenAPI specifications, user runbooks, architecture markdown files, and executive changelogs.",
                "responsibilities": [
                    "Generate release notes and semantic changelogs",
                    "Author living OpenAPI reference specs and architecture documentation",
                    "Maintain operator setup runbooks and troubleshooting guides",
                ],
                "capabilities": [
                    "documentation_synthesis",
                    "openapi_authoring",
                    "changelog_generation",
                    "spec_formatting",
                    "developer_runbooks",
                ],
                "tools": [
                    {
                        "name": "docs_generator",
                        "description": "Generate markdown documentation and OpenAPI artifacts",
                        "risk_level": "LOW",
                    }
                ],
                "autonomy_level": 3,
                "intelligence_config": {"routing_strategy": "AUTO_DYNAMIC", "tier": "SYNTHESIS"},
                "resource_limits": {"unlimited_context": True},
            },
            {
                "name": "Esther · CPO",
                "role_title": "Chief Product Officer",
                "department_name": "Executive Leadership",
                "identity": {
                    "slug": "cpo_agent",
                    "avatar_url": "/avatars/cpo_agent.png",
                    "soul_file": "cpo_agent/soul.md",
                    "tone": "outcome-focused",
                    "style": "strategic",
                    "skills": ["prd_authoring", "roadmap_prioritization", "user_journey_mapping", "acceptance_criteria_design"],
                },
                "system_instructions": "Own product strategy, PRDs, roadmap prioritization, and hard pre-implementation and pre-release feature acceptance gates.",
                "capabilities": ["prd_authoring", "roadmap_prioritization", "user_journey_mapping", "acceptance_criteria_design"],
                "mcp_servers": ["github", "filesystem", "web_search", "memory"],
                "autonomy_level": 4,
                "intelligence_config": {"routing_strategy": "AUTO_DYNAMIC", "tier": "FRONTIER_ARCHITECT"},
                "resource_limits": {"unlimited_context": True},
            },
            {
                "name": "Nehemiah · COO",
                "role_title": "Chief Operating Officer",
                "department_name": "Executive Leadership",
                "identity": {
                    "slug": "coo_agent",
                    "avatar_url": "/avatars/coo_agent.png",
                    "soul_file": "coo_agent/soul.md",
                    "tone": "operational",
                    "style": "structured",
                    "skills": ["workflow_orchestration", "capacity_and_quota_management", "sla_and_telemetry_auditing", "process_optimization"],
                },
                "system_instructions": "Orchestrate org-wide cadence, cross-departmental workflows, capacity balancing, and token/API budget governance.",
                "capabilities": ["workflow_orchestration", "capacity_and_quota_management", "sla_and_telemetry_auditing", "process_optimization"],
                "mcp_servers": ["sila-internal", "filesystem", "memory"],
                "autonomy_level": 4,
                "intelligence_config": {"routing_strategy": "AUTO_DYNAMIC", "tier": "FRONTIER_ARCHITECT"},
                "resource_limits": {"unlimited_context": True},
            },
            {
                "name": "Miriam · UI/UX Design Lead",
                "role_title": "Miriam · UI/UX Design Lead",
                "department_name": "Product & Architecture",
                "identity": {
                    "slug": "ui_ux_designer_agent",
                    "avatar_url": "/avatars/ui_ux_designer_agent.png",
                    "soul_file": "ui_ux_designer_agent/soul.md",
                    "tone": "visual",
                    "style": "ergonomic",
                    "skills": ["impeccable", "design-taste-frontend", "ui-ux-pro-max", "web-design-guidelines"],
                },
                "system_instructions": "Own DESIGN.md, globals.css, tailwind.config.ts tokens, Light/Dark parity, WCAG accessibility, and UI PR gates.",
                "capabilities": ["impeccable", "design-taste-frontend", "ui-ux-pro-max", "web-design-guidelines"],
                "mcp_servers": ["playwright", "filesystem", "context7"],
                "autonomy_level": 3,
                "intelligence_config": {"routing_strategy": "AUTO_DYNAMIC", "tier": "SYNTHESIS"},
                "resource_limits": {"unlimited_context": True},
            },
            {
                "name": "Nicodemus · Research & Intel",
                "role_title": "Nicodemus · Research & Intel",
                "department_name": "Product & Architecture",
                "identity": {
                    "slug": "research_intel_agent",
                    "avatar_url": "/avatars/research_intel_agent.png",
                    "soul_file": "research_intel_agent/soul.md",
                    "tone": "analytical",
                    "style": "empirical",
                    "skills": ["model_benchmarking", "routing_topology_design", "prompt_and_token_compression", "zero-filler"],
                },
                "system_instructions": "Benchmark LLMs/embeddings, optimize multi-model routing/fallback configs, compress prompts, and run external tech research spikes.",
                "capabilities": ["model_benchmarking", "routing_topology_design", "prompt_and_token_compression", "zero-filler"],
                "mcp_servers": ["web_search", "context7", "sila-internal", "filesystem"],
                "autonomy_level": 3,
                "intelligence_config": {"routing_strategy": "AUTO_DYNAMIC", "tier": "FRONTIER_ARCHITECT"},
                "resource_limits": {"unlimited_context": True},
            },
            {
                "name": "Joshua · Engineering Lead",
                "role_title": "Joshua · Engineering Lead",
                "department_name": "Core Engineering",
                "identity": {
                    "slug": "engineering_lead_agent",
                    "avatar_url": "/avatars/engineering_lead_agent.png",
                    "soul_file": "engineering_lead_agent/soul.md",
                    "tone": "technical",
                    "style": "pragmatic",
                    "skills": ["worktree_coordination", "enforce-tdd", "code_review", "find-bugs"],
                },
                "system_instructions": "Player-coach commander for Core Engineering: dispatch worktrees, unblock engineers, resolve merge conflicts, and merge green PRs.",
                "capabilities": ["worktree_coordination", "enforce-tdd", "code_review", "find-bugs"],
                "mcp_servers": ["git", "github", "filesystem", "sila-internal", "context7"],
                "autonomy_level": 3,
                "intelligence_config": {"routing_strategy": "AUTO_DYNAMIC", "tier": "EXECUTION"},
                "resource_limits": {"unlimited_context": True},
            },
            {
                "name": "Enoch · AI/ML Engineer",
                "role_title": "AI & Agent Systems Engineer",
                "department_name": "Core Engineering",
                "identity": {
                    "slug": "ai_ml_engineer_agent",
                    "avatar_url": "/avatars/ai_ml_engineer_agent.png",
                    "soul_file": "ai_ml_engineer_agent/soul.md",
                    "tone": "precise",
                    "style": "empirical",
                    "skills": ["llm_adapter_engineering", "rag_and_embeddings", "eval_harness_design", "enforce-tdd"],
                },
                "system_instructions": "Own LLM adapters, execution.py, mcp.py, memory/ RAG pipelines, and external_agents.py runtime with strict TDD.",
                "capabilities": ["llm_adapter_engineering", "rag_and_embeddings", "eval_harness_design", "enforce-tdd"],
                "mcp_servers": ["filesystem", "git", "github", "context7", "postgres"],
                "autonomy_level": 3,
                "intelligence_config": {"routing_strategy": "AUTO_DYNAMIC", "tier": "EXECUTION"},
                "resource_limits": {"unlimited_context": True},
            },
            {
                "name": "Gideon · QA Lead",
                "role_title": "Gideon · QA Lead",
                "department_name": "Quality & Reliability",
                "identity": {
                    "slug": "qa_lead_agent",
                    "avatar_url": "/avatars/qa_lead_agent.png",
                    "soul_file": "qa_lead_agent/soul.md",
                    "tone": "adversarial",
                    "style": "repro-first",
                    "skills": ["verification-before-completion", "test_strategy_design", "flaky_test_triage"],
                },
                "system_instructions": "Own test strategy, adversarial edge-case plans, flaky-test triage, and hard PR/Stage 4 release verification vetoes.",
                "capabilities": ["verification-before-completion", "test_strategy_design", "flaky_test_triage"],
                "mcp_servers": ["git", "github", "filesystem", "sila-internal"],
                "autonomy_level": 3,
                "intelligence_config": {"routing_strategy": "AUTO_DYNAMIC", "tier": "EXECUTION"},
                "resource_limits": {"unlimited_context": True},
            },
            {
                "name": "Samuel · Knowledge & Eval",
                "role_title": "Knowledge, Evaluation & Evolution Lead",
                "department_name": "Documentation & Knowledge",
                "identity": {
                    "slug": "knowledge_eval_agent",
                    "avatar_url": "/avatars/knowledge_eval_agent.png",
                    "soul_file": "knowledge_eval_agent/soul.md",
                    "tone": "analytical",
                    "style": "insight-driven",
                    "skills": ["memory_distillation", "agent_eval_scoring", "soul_and_skill_evolution"],
                },
                "system_instructions": "Curate institutional memory, run agent fitness evals, synthesize post-mortems, and propose soul.md/SKILLS.md evolutions.",
                "capabilities": ["memory_distillation", "agent_eval_scoring", "soul_and_skill_evolution"],
                "mcp_servers": ["sila-internal", "filesystem", "postgres"],
                "autonomy_level": 3,
                "intelligence_config": {"routing_strategy": "AUTO_DYNAMIC", "tier": "SYNTHESIS"},
                "resource_limits": {"unlimited_context": True},
            },
            {
                "name": "Joseph · Growth & BD",
                "role_title": "Business Development & Growth Lead",
                "department_name": "Growth & Ecosystem",
                "identity": {
                    "slug": "growth_bd_agent",
                    "avatar_url": "/avatars/growth_bd_agent.png",
                    "soul_file": "growth_bd_agent/soul.md",
                    "tone": "commercial",
                    "style": "strategic",
                    "skills": ["programmatic-seo", "schema", "content-research-writer", "brag"],
                },
                "system_instructions": "Scope MCP/OpenAPI ecosystem integrations, developer adoption funnels, SEO, and launch/partnership drafts gated on CEO approval.",
                "capabilities": ["programmatic-seo", "schema", "content-research-writer", "brag"],
                "mcp_servers": ["web_search", "filesystem", "github", "memory"],
                "autonomy_level": 3,
                "intelligence_config": {"routing_strategy": "AUTO_DYNAMIC", "tier": "SYNTHESIS"},
                "resource_limits": {"unlimited_context": True},
            },
        ],
        "workflows": [
            {
                "name": "Canonical 5-Stage Autonomous Engineering Pipeline",
                "description": "Stage 1 (Ingestion & Quality Gate) -> Stage 2 (Spec & Architecture CEO Approval) -> Stage 3 (Worktree Binding) -> Stage 4 (Parallel Engineering) -> Stage 5 (Verification & Production CEO Release)",
                "trigger_type": "EVENT",
                "steps": [
                    {
                        "step_name": "Stage 1: Requirement Quality & Completeness Gate",
                        "agent": "Daniel · Product Spec",
                    },
                    {
                        "step_name": "Stage 2: Architecture ADR Ratification (CEO Executive Briefing Gate)",
                        "agent": "Bezalel · Lead Architect",
                    },
                    {
                        "step_name": "Stage 3: Project Workspace & Branch Binding",
                        "agent": "Noah · DevOps & Release",
                    },
                    {
                        "step_name": "Stage 4: Parallel Engineering (Backend, Frontend, Security)",
                        "agent": "Luke · Backend Engineer",
                    },
                    {
                        "step_name": "Stage 5: QA Verification & Production Release (CEO Closeout Gate)",
                        "agent": "Deborah · QA Automation",
                    },
                ],
            }
        ],
        "policies": [
            {
                "name": "Zero Untested Code Policy",
                "description": "All pull requests and merged worktrees must contain unit tests covering altered lines.",
                "scope": "COMPANY",
                "rules": [
                    {"condition": "test_coverage < 80%", "action": "BLOCK_PR"},
                    {"condition": "lint_errors > 0", "action": "BLOCK_PR"},
                ],
                "enforcement_level": "HARD",
            },
            {
                "name": "Security Sentinel Diff Scan Policy",
                "description": "Mandatory AST security and secret scanning prior to build compilation.",
                "scope": "COMPANY",
                "rules": [
                    {"condition": "cve_severity in ['HIGH', 'CRITICAL']", "action": "BLOCK_PR"},
                    {"condition": "secret_detected == True", "action": "BLOCK_PR"},
                ],
                "enforcement_level": "HARD",
            },
        ],
        "constitution": {
            "mission": "Deliver rock-solid, verified software without manual toil, governed by human executive approvals.",
            "values": [
                "Engineering excellence",
                "Automated verification",
                "Zero manual data entry for CEO",
                "Quality over speed",
            ],
            "operating_principles": [
                "The Human CEO leads by exception: 1-click approvals on Stage 2 and Stage 5",
                "Never merge untested or lint-failing code to main branch",
                "All worktrees execute in isolated directories with automated rebase",
            ],
            "prohibited_actions": [
                "Deploying directly to production without Stage 5 CEO sign-off",
                "Committing plaintext secrets or API keys",
                "Bypassing automated test suites or coverage thresholds",
            ],
            "approval_requirements": [
                "Stage 2 Architecture ADR Ratification (Executive Briefing Card)",
                "Stage 5 Production Release & Closeout (Executive Briefing Card)",
                "Destructive database schema changes or data drops",
            ],
            "security_rules": [
                "Zero secret retention in memory prompts or git history",
                "Strict file boundary isolation between domain worktrees",
            ],
            "quality_rules": [
                "Minimum 80% test coverage on all new or modified code",
                "Zero TypeScript or compiler errors in production builds",
                "Mean time to rollback under 60 seconds",
            ],
            "autonomy_boundaries": {
                "stage_1_ingestion": "LEVEL_4_FULL_AUTONOMY",
                "stage_2_architecture": "LEVEL_2_CEO_APPROVAL_REQUIRED",
                "stage_3_workspace_binding": "LEVEL_4_FULL_AUTONOMY",
                "stage_4_parallel_coding": "LEVEL_4_FULL_AUTONOMY",
                "stage_5_production_release": "LEVEL_2_CEO_APPROVAL_REQUIRED",
            },
            "escalation_rules": [
                "Escalate test runner failures unresolved after 3 automated attempts",
                "Escalate architecture council dissent to Human CEO via 1-click decision card",
            ],
        },
        "recommended_tools": [
            {
                "name": "git_worktree_engine",
                "description": "Parallel isolated Git worktree sandboxing",
                "risk_level": "MEDIUM",
            },
            {
                "name": "automated_test_runner",
                "description": "Hermetic pytest and npm test execution engine",
                "risk_level": "LOW",
            },
            {
                "name": "ast_security_scanner",
                "description": "Static code analysis and secret detection probe",
                "risk_level": "LOW",
            },
        ],
        "intelligence_requirements": {
            "capabilities_required": [
                "deep_coding",
                "architectural_reasoning",
                "security_analysis",
                "test_synthesis",
            ],
            "recommended_models": ["claude-3-5-sonnet", "gpt-4o", "gemini-1.5-flash"],
        },
        "resource_policies": {
            "compute": {"cpu_cores": 8, "ram_gb": 16, "storage_gb": 100},
            "execution_slots": 8,
            "max_parallel_worktrees": 4,
        },
        "kpis": [
            {
                "name": "Automated Test Pass Rate",
                "metric": "test_pass_rate_pct",
                "target": "100%",
                "review_frequency": "CONTINUOUS",
            },
            {
                "name": "Branch Code Coverage",
                "metric": "code_coverage_pct",
                "target": ">= 85%",
                "review_frequency": "PER_PULL_REQUEST",
            },
            {
                "name": "Production Defect Rate",
                "metric": "escaped_defects",
                "target": "0",
                "review_frequency": "WEEKLY",
            },
            {
                "name": "Build & Lint Health",
                "metric": "type_check_errors",
                "target": "0",
                "review_frequency": "CONTINUOUS",
            },
        ],
        "approval_rules": [
            {
                "action": "STAGE_2_ARCHITECTURE_RATIFICATION",
                "condition": "stage == 'STAGE_2'",
                "approver_role": "CEO",
                "risk_level": "HIGH",
            },
            {
                "action": "STAGE_5_PRODUCTION_RELEASE",
                "condition": "stage == 'STAGE_5'",
                "approver_role": "CEO",
                "risk_level": "CRITICAL",
            },
        ],
        "escalation_rules": [
            {
                "trigger": "Unresolved architecture council dissent or test runner blocker",
                "route_to": "Human CEO",
                "severity": "HIGH",
                "sla_minutes": 30,
            }
        ],
        "projects": [
            {
                "name": "Core Platform Architecture & API Gateway Mesh",
                "objective": "Design and engineer unified asynchronous microservice mesh, schema validation gates, and secure token isolation.",
                "priority": "CRITICAL",
                "status": "ACTIVE",
                "milestones": [
                    {
                        "title": "Stage 1: Requirements & Interface Contracts Specification",
                        "description": "Formalize REST and WebSocket contracts with strict Pydantic schemas.",
                        "completed": False,
                    },
                    {
                        "title": "Stage 2: Architecture ADR Ratification",
                        "description": "Deliberate and ratify Architectural Decision Record for service boundary isolation.",
                        "completed": False,
                    },
                    {
                        "title": "Stage 3: Async Microservice & Persistence Implementation",
                        "description": "Implement async service handlers and reversible Alembic database migrations.",
                        "completed": False,
                    },
                    {
                        "title": "Stage 4: Automated CI/CD Regression & Quality Gate",
                        "description": "Enforce 80%+ branch coverage and zero TypeScript/Python type warnings.",
                        "completed": False,
                    },
                ],
                "tasks": [
                    {
                        "title": "Synthesize Technical Specification & Acceptance Criteria",
                        "description": "Draft formal interface contracts and edge-case validation suites for core microservice endpoints.",
                        "assigned_agent_name": "Daniel · Product Spec",
                        "priority": "HIGH",
                        "status": "PENDING",
                        "expected_outcome": "Comprehensive PRD with acceptance criteria ratified.",
                        "resource_requirements": {"estimated_tokens": 12000},
                    },
                    {
                        "title": "Draft Architecture Decision Record (ADR-001: Service Topologies)",
                        "description": "Document modular service separation, async event-bus protocol, and tenant data isolation boundaries.",
                        "assigned_agent_name": "Bezalel · Lead Architect",
                        "priority": "CRITICAL",
                        "status": "PENDING",
                        "expected_outcome": "ADR-001 ratified by Architecture Council and Human Executive.",
                        "resource_requirements": {"estimated_tokens": 20000},
                    },
                    {
                        "title": "Implement Idempotent FastAPI Microservice Endpoints",
                        "description": "Implement async FastAPI route handlers with strict Pydantic schema validation and zero unhandled exceptions.",
                        "assigned_agent_name": "Luke · Backend Engineer",
                        "priority": "HIGH",
                        "status": "PENDING",
                        "expected_outcome": "All endpoints operational with idempotent transaction boundaries.",
                        "resource_requirements": {"estimated_tokens": 35000},
                    },
                    {
                        "title": "Design Reversible Alembic Migrations & Composite Indexing",
                        "description": "Construct optimized SQLite/PostgreSQL relational schemas with strict foreign keys and query execution plan verification.",
                        "assigned_agent_name": "Ezra · Database Engineer",
                        "priority": "HIGH",
                        "status": "PENDING",
                        "expected_outcome": "Zero N+1 query bottlenecks and automated rollback-tested migrations.",
                        "resource_requirements": {"estimated_tokens": 18000},
                    },
                    {
                        "title": "Audit AST Call Graph for Circular Dependencies & Rot",
                        "description": "Audit backend service diffs for architectural decay, dead imports, and boundary leaks.",
                        "assigned_agent_name": "Nathan · Code Reviewer",
                        "priority": "HIGH",
                        "status": "PENDING",
                        "expected_outcome": "Zero architectural rot violations or circular couplings detected.",
                        "resource_requirements": {"estimated_tokens": 15000},
                    },
                ],
            },
            {
                "name": "Autonomous Web & Desktop Command Cockpit",
                "objective": "Deliver high-density, accessible, desktop-optimized command center interface with real-time operational telemetry feeds and universal keyboard navigation.",
                "priority": "HIGH",
                "status": "ACTIVE",
                "milestones": [
                    {
                        "title": "Milestone 1: Design Tokens & Accessible ARIA Primitives",
                        "description": "Light-first theme tokens and accessible focus states.",
                        "completed": False,
                    },
                    {
                        "title": "Milestone 2: Command Palette & Keyboard Telemetry Hub",
                        "description": "Universal Cmd/Ctrl+K hub and shortcut navigation.",
                        "completed": False,
                    },
                    {
                        "title": "Milestone 3: Dynamic Activity Telemetry & Worker Visualization",
                        "description": "Observable workflow streams and live resource telemetry.",
                        "completed": False,
                    },
                ],
                "tasks": [
                    {
                        "title": "Build Accessible React Components with Zero Untyped Logic",
                        "description": "Develop responsive, desktop-optimized dashboard surfaces with complete Loading, Empty, and Error state boundaries.",
                        "assigned_agent_name": "Ruth · Frontend Engineer",
                        "priority": "HIGH",
                        "status": "PENDING",
                        "expected_outcome": "Zero untyped any business logic and accessible ARIA compliance.",
                        "resource_requirements": {"estimated_tokens": 28000},
                    },
                    {
                        "title": "Automate Playwright E2E & Unit Test Coverage Thresholds",
                        "description": "Author end-to-end user journey tests and verify minimum 80% branch coverage across all frontend components.",
                        "assigned_agent_name": "Deborah · QA Automation",
                        "priority": "HIGH",
                        "status": "PENDING",
                        "expected_outcome": "100% green test passing matrix across all viewports.",
                        "resource_requirements": {"estimated_tokens": 22000},
                    },
                    {
                        "title": "Execute AST Security & Vulnerability Scans",
                        "description": "Perform automated secret scrubbing, dependency CVE audits, and client-side token sandbox verification.",
                        "assigned_agent_name": "Michael · Security Lead",
                        "priority": "CRITICAL",
                        "status": "PENDING",
                        "expected_outcome": "Zero high/critical CVEs and zero exposed credentials.",
                        "resource_requirements": {"estimated_tokens": 16000},
                    },
                    {
                        "title": "Generate Living OpenAPI Reference Specs & Runbooks",
                        "description": "Maintain living developer runbooks, interactive OpenAPI specs, and human CEO release briefing notes.",
                        "assigned_agent_name": "Baruch · Technical Writer",
                        "priority": "LOW",
                        "status": "PENDING",
                        "expected_outcome": "Complete documentation synchronized with active codebase.",
                        "resource_requirements": {"estimated_tokens": 16000},
                    },
                ],
            },
            {
                "name": "Continuous Delivery & Swarm Orchestration",
                "objective": "Automate parallel Git worktree sandboxing, hermetic build validation, swarm sprint coordination, and zero-downtime releases.",
                "priority": "MEDIUM",
                "status": "ACTIVE",
                "milestones": [
                    {
                        "title": "Milestone 1: Isolated Git Worktree Sandboxing",
                        "description": "Automated worktree creation and hermetic branch merging.",
                        "completed": False,
                    },
                    {
                        "title": "Milestone 2: Automated Canary Probes & Circuit Breaker Watchers",
                        "description": "Sub-second health monitoring and automated rollback.",
                        "completed": False,
                    },
                    {
                        "title": "Milestone 3: Autonomous Swarm Roadmapping & Sprint Cadence",
                        "description": "Autonomous task DAG coordination and blocker resolution.",
                        "completed": False,
                    },
                ],
                "tasks": [
                    {
                        "title": "Oversee Autonomous Swarm Orchestration & Executive Roadmapping",
                        "description": "Establish strategic delivery milestones, coordinate agent handoffs across worktrees, and publish executive status briefs.",
                        "assigned_agent_name": "Solomon · CTO",
                        "priority": "CRITICAL",
                        "status": "PENDING",
                        "expected_outcome": "Unified autonomous delivery cadence aligned with human executive directives.",
                        "resource_requirements": {"estimated_tokens": 25000},
                    },
                    {
                        "title": "Coordinate Autonomous Sprint Cadence & DAG Blocker Resolution",
                        "description": "Monitor DAG dependency progression, reassign stalled queue items, and optimize cross-agent pipeline throughput.",
                        "assigned_agent_name": "Jethro · Scrum Master",
                        "priority": "HIGH",
                        "status": "PENDING",
                        "expected_outcome": "Zero dependency deadlocks across all 13 agents and real-time sprint velocity tracking.",
                        "resource_requirements": {"estimated_tokens": 18000},
                    },
                    {
                        "title": "Orchestrate Parallel Git Worktree Branch Isolation",
                        "description": "Manage hermetic worktree sandboxes for parallel frontend and backend engineering.",
                        "assigned_agent_name": "Noah · DevOps & Release",
                        "priority": "HIGH",
                        "status": "PENDING",
                        "expected_outcome": "Isolated build pipelines with automated clean tear-downs.",
                        "resource_requirements": {"estimated_tokens": 20000},
                    },
                    {
                        "title": "Configure Low-Latency Health Probes & Circuit Breakers",
                        "description": "Monitor endpoint latencies, error budgets, and automatically trip circuit breakers upon anomaly detection.",
                        "assigned_agent_name": "Gabriel · SRE Guard",
                        "priority": "HIGH",
                        "status": "PENDING",
                        "expected_outcome": "Mean time to rollback under 60 seconds with live telemetry alerts.",
                        "resource_requirements": {"estimated_tokens": 14000},
                    },
                ],
            },
        ],
    },
    # -------------------------------------------------------------
    # 2. FOREX TRADING COMPANY
    # -------------------------------------------------------------
    {
        "key": "forex_trading_company",
        "name": "Forex Trading Company",
        "tagline": "Algorithmic Quantitative Currency Trading & Arbitrage",
        "description": "High-frequency macro and quantitative foreign exchange firm utilizing real-time volatility analysis, sentiment scoring, and strict risk guardrails.",
        "category": "Finance",
        "icon": "trending-up",
        "is_system_template": True,
        "default_autonomy": 2,
        "estimated_monthly_cost_usd": 650.0,
        "metadata_tags": ["finance", "forex", "trading", "quant", "risk-controlled"],
        "company_definition": {
            "name": "ApexFX Global Capital",
            "mission": "Execute disciplined, quantitative currency strategies with rigorous drawdown controls.",
            "vision": "Algorithmic market neutral returns across G10 and emerging currency pairs.",
            "industry": "Financial Services & Quant Trading",
            "dna": {
                "operating_philosophy": "Capital preservation first, systematic edge over emotional speculation",
                "innovation_level": "PROGRESSIVE",
                "autonomy_level": "BALANCED",
                "risk_tolerance": "CAUTIOUS",
                "quality_threshold": "PERFECT",
                "decision_style": "AUTHORITATIVE",
                "communication_style": "DIRECT",
                "resource_strategy": "INVEST_HEAVY",
            },
        },
        "departments": [
            {
                "name": "Quantitative Research",
                "purpose": "Market regime modeling, backtesting, and indicator generation",
            },
            {
                "name": "Execution & Trading",
                "purpose": "Order routing, latency optimization, and liquidity management",
            },
            {
                "name": "Risk Management & Compliance",
                "purpose": "VaR computation, drawdown limits, and margin monitoring",
            },
        ],
        "roles": [
            {
                "department_name": "Quantitative Research",
                "title": "Quant Alpha Researcher",
                "responsibilities": [
                    "Identify statistical arbitrage opportunities",
                    "Backtest mean-reversion signals",
                ],
                "capabilities": ["time_series_analysis", "backtesting", "macroeconomic_reasoning"],
                "authority": "EXECUTE",
                "autonomy_level": 3,
            },
            {
                "department_name": "Execution & Trading",
                "title": "Execution Algorithmic Trader",
                "responsibilities": [
                    "Route limit orders",
                    "Minimize slippage",
                    "Manage FIX protocol connections",
                ],
                "capabilities": ["order_routing", "slippage_optimization"],
                "authority": "EXECUTE",
                "autonomy_level": 2,
            },
            {
                "department_name": "Risk Management & Compliance",
                "title": "Chief Risk Officer Agent",
                "responsibilities": [
                    "Monitor max daily drawdown",
                    "Enforce leverage caps",
                    "Halt runaway algorithms",
                ],
                "capabilities": ["risk_modeling", "circuit_breaker_enforcement"],
                "authority": "FULL",
                "autonomy_level": 4,
            },
        ],
        "agents": [
            {
                "name": "Alpha Quant Agent",
                "role_title": "Quant Alpha Researcher",
                "department_name": "Quantitative Research",
                "system_instructions": "Analyze currency correlations, central bank rate curves, and COT reports. Propose probabilistic trade setups.",
                "responsibilities": [
                    "Formulate trade hypotheses with strict risk-to-reward ratios"
                ],
                "capabilities": ["time_series_analysis", "macroeconomic_reasoning"],
                "tools": [
                    {
                        "name": "market_feed_poller",
                        "description": "FX tick data reader",
                        "risk_level": "LOW",
                    }
                ],
                "autonomy_level": 3,
                "intelligence_config": {"model": "gpt-4o", "temperature": 0.2},
                "resource_limits": {"max_tokens_per_call": 12000, "max_daily_budget_usd": 20.0},
            },
            {
                "name": "Trade Execution Agent",
                "role_title": "Execution Algorithmic Trader",
                "department_name": "Execution & Trading",
                "system_instructions": "Execute approved trade signals only when spread and volatility metrics are within predefined thresholds.",
                "responsibilities": ["Execute orders", "Monitor fill rates"],
                "capabilities": ["order_routing"],
                "tools": [
                    {
                        "name": "broker_api_bridge",
                        "description": "FIX protocol trading bridge",
                        "risk_level": "HIGH",
                    }
                ],
                "autonomy_level": 2,
                "intelligence_config": {"model": "gemini-1.5-pro", "temperature": 0.0},
                "resource_limits": {"max_tokens_per_call": 4096, "max_daily_budget_usd": 25.0},
            },
            {
                "name": "Risk Sentry Agent",
                "role_title": "Chief Risk Officer Agent",
                "department_name": "Risk Management & Compliance",
                "system_instructions": "Enforce maximum 1.5% single-trade risk and 4% daily portfolio drawdown. Kill all open positions upon breach.",
                "responsibilities": ["Portfolio circuit breakers", "Margin compliance"],
                "capabilities": ["circuit_breaker_enforcement"],
                "tools": [
                    {
                        "name": "emergency_kill_switch",
                        "description": "Flatten all broker positions",
                        "risk_level": "CRITICAL",
                    }
                ],
                "autonomy_level": 4,
                "intelligence_config": {"model": "claude-3-5-sonnet", "temperature": 0.0},
                "resource_limits": {"max_tokens_per_call": 8192, "max_daily_budget_usd": 30.0},
            },
        ],
        "workflows": [
            {
                "name": "Signal to Execution Protocol",
                "description": "Quant Signal Generation -> Risk Parameter Verification -> Human/Manager Approval -> Order Routing",
                "trigger_type": "SCHEDULE",
                "steps": [
                    {"step_name": "Market Scan", "agent": "Alpha Quant Agent"},
                    {"step_name": "Risk Verification", "agent": "Risk Sentry Agent"},
                    {"step_name": "Order Execution", "agent": "Trade Execution Agent"},
                ],
            }
        ],
        "policies": [
            {
                "name": "Maximum Leverage Policy",
                "description": "Aggregate account leverage must never exceed 1:20 on major pairs and 1:10 on exotic pairs.",
                "scope": "COMPANY",
                "rules": [{"condition": "account_leverage > 20", "action": "HALT_TRADING"}],
                "enforcement_level": "ABSOLUTE",
            }
        ],
        "constitution": {
            "mission": "Maximize risk-adjusted returns while eliminating ruin scenarios through strict algorithmic governance.",
            "values": ["Capital protection", "Systematic discipline", "Zero emotional override"],
            "operating_principles": [
                "Never trade through tier-1 high impact news without manual review",
                "Honor stop losses without exception",
            ],
            "prohibited_actions": [
                "Exceeding 2% single trade loss risk",
                "Disabling stop loss parameters",
                "Trading unapproved illiquid pairs",
            ],
            "approval_requirements": [
                "Initial strategy capital allocation > $5,000",
                "Manual overnight position rollover exemptions",
            ],
            "security_rules": ["API credentials stored in HSM vaults with IP whitelisting"],
            "financial_rules": ["Daily max loss circuit breaker at $1,000"],
            "data_rules": ["Tick logs preserved for 7 years regulatory compliance"],
            "autonomy_boundaries": {
                "order_placement": "LEVEL_2",
                "market_analysis": "LEVEL_3",
                "emergency_stop": "LEVEL_4",
            },
            "escalation_rules": [
                "Immediately notify Risk Officer on 3 consecutive losing trades in any single currency pair"
            ],
        },
        "recommended_tools": [
            {
                "name": "meta_trader_gateway",
                "description": "MT5 / cTrader bridge",
                "risk_level": "HIGH",
            },
            {
                "name": "economic_calendar_feed",
                "description": "News volatility radar",
                "risk_level": "LOW",
            },
        ],
        "intelligence_requirements": {
            "capabilities_required": [
                "fast_inference",
                "probabilistic_reasoning",
                "strict_precision",
            ],
            "recommended_models": ["claude-3-5-sonnet", "gpt-4o", "gemini-1.5-flash"],
        },
        "resource_policies": {"financial_budget_usd": 1500.0, "execution_slots": 10},
        "kpis": [
            {
                "name": "Sharpe Ratio",
                "metric": "sharpe_ratio",
                "target": ">= 2.0",
                "review_frequency": "MONTHLY",
            },
            {
                "name": "Max Drawdown",
                "metric": "max_drawdown_pct",
                "target": "<= 5%",
                "review_frequency": "WEEKLY",
            },
        ],
        "approval_rules": [
            {
                "action": "LIVE_TRADE_ORDER",
                "condition": "lot_size > 1.0",
                "approver_role": "MANAGER",
                "risk_level": "HIGH",
            }
        ],
        "escalation_rules": [
            {
                "trigger": "Drawdown exceeds 3%",
                "route_to": "Chief Risk Officer Agent",
                "severity": "CRITICAL",
                "sla_minutes": 1,
            }
        ],
    },
    # -------------------------------------------------------------
    # 3. MARKETING AGENCY
    # -------------------------------------------------------------
    {
        "key": "marketing_agency",
        "name": "Marketing Agency",
        "tagline": "Full-Funnel Growth Marketing, SEO & Creative Campaigns",
        "description": "Autonomous digital marketing agency driving client acquisition, ad creative production, organic search dominance, and multi-channel campaign automation.",
        "category": "Marketing & Creative",
        "icon": "megaphone",
        "is_system_template": True,
        "default_autonomy": 3,
        "estimated_monthly_cost_usd": 280.0,
        "metadata_tags": ["marketing", "seo", "copywriting", "growth", "creative"],
        "company_definition": {
            "name": "Vanguard Growth Agency",
            "mission": "Deliver measurable revenue growth for clients through hyper-personalized, data-driven multi-channel marketing campaigns.",
            "vision": "Autonomous creative ideation and performance marketing at scale.",
            "industry": "Marketing & Advertising",
            "dna": {
                "operating_philosophy": "Test rapidly, double down on what works, kill what doesn't",
                "innovation_level": "RADICAL",
                "autonomy_level": "DELEGATED",
                "risk_tolerance": "MODERATE",
                "quality_threshold": "HIGH",
                "decision_style": "CONSENSUS",
                "communication_style": "SEMI_FORMAL",
                "resource_strategy": "GROWTH",
            },
        },
        "departments": [
            {
                "name": "Strategy & SEO",
                "purpose": "Keyword research, competitor analysis, and organic traffic growth",
            },
            {
                "name": "Creative & Content Studio",
                "purpose": "Ad copy, landing pages, email drip sequences, and blog posts",
            },
            {
                "name": "Paid Acquisition",
                "purpose": "Ad spend optimization, A/B testing, and ROAS attribution",
            },
        ],
        "roles": [
            {
                "department_name": "Strategy & SEO",
                "title": "SEO Strategist",
                "responsibilities": [
                    "Identify high-intent search queries",
                    "Audit technical on-page SEO",
                    "Construct topical authority clusters",
                ],
                "capabilities": ["keyword_clustering", "competitive_analysis", "seo_audit"],
                "authority": "EXECUTE",
                "autonomy_level": 4,
            },
            {
                "department_name": "Creative & Content Studio",
                "title": "Lead Copywriter",
                "responsibilities": [
                    "Draft high-converting ad copy",
                    "Create long-form thought leadership articles",
                ],
                "capabilities": ["creative_writing", "persuasive_copywriting", "hook_generation"],
                "authority": "EXECUTE",
                "autonomy_level": 3,
            },
            {
                "department_name": "Paid Acquisition",
                "title": "Performance Marketer",
                "responsibilities": [
                    "Manage ad budgets",
                    "Set up multi-variant creative tests",
                    "Optimize cost per acquisition (CPA)",
                ],
                "capabilities": ["ad_campaign_management", "cpa_optimization", "roas_analysis"],
                "authority": "MANAGE",
                "autonomy_level": 2,
            },
        ],
        "agents": [
            {
                "name": "SEO Analyst Agent",
                "role_title": "SEO Strategist",
                "department_name": "Strategy & SEO",
                "system_instructions": "Identify search demand gaps. Produce structured content briefs with semantic entity keywords.",
                "responsibilities": ["Generate keyword maps", "Analyze competitor search rankings"],
                "capabilities": ["keyword_clustering", "seo_audit"],
                "tools": [
                    {
                        "name": "serp_api_tool",
                        "description": "Query Google search rankings",
                        "risk_level": "LOW",
                    }
                ],
                "autonomy_level": 4,
                "intelligence_config": {"model": "gemini-1.5-flash", "temperature": 0.3},
                "resource_limits": {"max_tokens_per_call": 8192, "max_daily_budget_usd": 10.0},
            },
            {
                "name": "Copy Master Agent",
                "role_title": "Lead Copywriter",
                "department_name": "Creative & Content Studio",
                "system_instructions": "Craft compelling marketing copy adhering to brand voice and PAS (Problem-Agitate-Solve) frameworks.",
                "responsibilities": ["Write landing pages, email copy, and social hooks"],
                "capabilities": ["creative_writing", "persuasive_copywriting"],
                "tools": [
                    {
                        "name": "readability_analyzer",
                        "description": "Score reading grade level",
                        "risk_level": "LOW",
                    }
                ],
                "autonomy_level": 3,
                "intelligence_config": {"model": "gpt-4o", "temperature": 0.7},
                "resource_limits": {"max_tokens_per_call": 8192, "max_daily_budget_usd": 12.0},
            },
            {
                "name": "Ad Optimizer Agent",
                "role_title": "Performance Marketer",
                "department_name": "Paid Acquisition",
                "system_instructions": "Optimize PPC budgets. Allocate spend strictly to campaigns exceeding 2.5x ROAS targets.",
                "responsibilities": ["Bid adjustments", "A/B test reporting"],
                "capabilities": ["ad_campaign_management", "roas_analysis"],
                "tools": [
                    {
                        "name": "ads_manager_api",
                        "description": "Google/Meta Ads API",
                        "risk_level": "HIGH",
                    }
                ],
                "autonomy_level": 2,
                "intelligence_config": {"model": "claude-3-5-sonnet", "temperature": 0.2},
                "resource_limits": {"max_tokens_per_call": 6144, "max_daily_budget_usd": 15.0},
            },
        ],
        "workflows": [
            {
                "name": "Campaign Launch Lifecycle",
                "description": "Keyword Research -> Brief Generation -> Copy Drafting -> Compliance Review -> Campaign Staging",
                "trigger_type": "MANUAL",
                "steps": [
                    {"step_name": "Research", "agent": "SEO Analyst Agent"},
                    {"step_name": "Drafting", "agent": "Copy Master Agent"},
                    {"step_name": "Review & Launch", "agent": "Ad Optimizer Agent"},
                ],
            }
        ],
        "policies": [
            {
                "name": "Brand Safety Policy",
                "description": "Never publish misleading claims or guarantees in customer-facing promotional copy.",
                "scope": "COMPANY",
                "rules": [
                    {"condition": "contains_unverified_guarantee", "action": "REQUIRE_LEGAL_REVIEW"}
                ],
                "enforcement_level": "HARD",
            }
        ],
        "constitution": {
            "mission": "Drive measurable growth while upholding strict advertising ethics and client trust.",
            "values": ["Data integrity", "Creative bravery", "Transparent attribution"],
            "operating_principles": [
                "Every claim must be provable",
                "Never waste ad spend on unvalidated landing pages",
            ],
            "prohibited_actions": [
                "Deploying ad spend > $500 without client sign-off",
                "Purchasing deceptive bot followers or spam backlinks",
            ],
            "approval_requirements": [
                "Live client ad launch",
                "Budget increases > 20% week-over-week",
            ],
            "security_rules": ["Client analytics data must remain anonymized and isolated"],
            "financial_rules": [
                "Total monthly client ad commitments must not exceed approved retainer"
            ],
            "data_rules": ["Adherence to GDPR and CCPA marketing consent directives"],
            "autonomy_boundaries": {
                "creative_generation": "LEVEL_4",
                "ad_spend_execution": "LEVEL_2",
            },
            "escalation_rules": [
                "Escalate campaign ROAS dropping below 1.5x to account manager immediately"
            ],
        },
        "recommended_tools": [
            {
                "name": "google_analytics_bridge",
                "description": "GA4 metric pipeline",
                "risk_level": "LOW",
            },
            {
                "name": "meta_ads_bridge",
                "description": "Meta Graph API connection",
                "risk_level": "HIGH",
            },
        ],
        "intelligence_requirements": {
            "capabilities_required": [
                "creative_writing",
                "persuasive_copywriting",
                "fast_inference",
            ],
            "recommended_models": ["gpt-4o", "gemini-1.5-flash"],
        },
        "resource_policies": {"financial_budget_usd": 400.0, "execution_slots": 6},
        "kpis": [
            {
                "name": "Client ROAS",
                "metric": "return_on_ad_spend",
                "target": ">= 3.0",
                "review_frequency": "WEEKLY",
            },
            {
                "name": "Organic Traffic Growth",
                "metric": "monthly_unique_visitors",
                "target": "+15% MoM",
                "review_frequency": "MONTHLY",
            },
        ],
        "approval_rules": [
            {
                "action": "AD_BUDGET_INCREASE",
                "condition": "amount > 500",
                "approver_role": "MANAGER",
                "risk_level": "HIGH",
            }
        ],
        "escalation_rules": [
            {
                "trigger": "Client churn warning flag",
                "route_to": "Account Director",
                "severity": "HIGH",
                "sla_minutes": 30,
            }
        ],
    },
    # -------------------------------------------------------------
    # 4. SOCIAL MEDIA COMPANY
    # -------------------------------------------------------------
    {
        "key": "social_media_company",
        "name": "Social Media Company",
        "tagline": "Real-Time Viral Content Generation, Curation & Community Management",
        "description": "24/7 social presence network managing viral post scheduling, audience engagement, sentiment monitoring, and automated trend response.",
        "category": "Media & Entertainment",
        "icon": "share-2",
        "is_system_template": True,
        "default_autonomy": 3,
        "estimated_monthly_cost_usd": 220.0,
        "metadata_tags": ["social-media", "community", "viral", "content", "x-twitter", "linkedin"],
        "company_definition": {
            "name": "TrendWave Social Network",
            "mission": "Amplify brand voice and foster high-engagement global digital communities through timely cultural commentary and storytelling.",
            "vision": "Autonomous real-time digital culture coordination.",
            "industry": "Social Media & Community",
            "dna": {
                "operating_philosophy": "Speed, relevance, cultural awareness, and rapid feedback loops",
                "innovation_level": "RADICAL",
                "autonomy_level": "FULLY_AUTONOMOUS",
                "risk_tolerance": "MODERATE",
                "quality_threshold": "HIGH",
                "decision_style": "DELEGATIVE",
                "communication_style": "CASUAL",
                "resource_strategy": "GROWTH",
            },
        },
        "departments": [
            {
                "name": "Trend Intelligence",
                "purpose": "Monitoring real-time viral trends, memes, and cultural moments",
            },
            {
                "name": "Content Studio",
                "purpose": "Drafting threads, carousel scripts, and short-form video hooks",
            },
            {
                "name": "Community Care",
                "purpose": "Replying to comments, customer queries, and brand mentions",
            },
        ],
        "roles": [
            {
                "department_name": "Trend Intelligence",
                "title": "Trend Scout",
                "responsibilities": [
                    "Monitor social feeds",
                    "Score trending topic relevance",
                    "Flag brand-aligned hashtags",
                ],
                "capabilities": ["social_listening", "trend_forecasting"],
                "authority": "EXECUTE",
                "autonomy_level": 4,
            },
            {
                "department_name": "Content Studio",
                "title": "Social Content Creator",
                "responsibilities": [
                    "Write viral hooks",
                    "Draft daily posting schedules",
                    "Repurpose long-form content into punchy posts",
                ],
                "capabilities": ["hook_crafting", "thread_writing", "visual_scripting"],
                "authority": "EXECUTE",
                "autonomy_level": 3,
            },
            {
                "department_name": "Community Care",
                "title": "Community Moderator",
                "responsibilities": [
                    "Respond to inbound DMs and replies",
                    "De-escalate negative sentiment",
                    "Engage with industry leaders",
                ],
                "capabilities": ["sentiment_analysis", "empathetic_messaging", "deescalation"],
                "authority": "EXECUTE",
                "autonomy_level": 3,
            },
        ],
        "agents": [
            {
                "name": "Trend Scout Agent",
                "role_title": "Trend Scout",
                "department_name": "Trend Intelligence",
                "system_instructions": "Monitor Twitter/X and LinkedIn APIs for breakout conversations in tech, AI, and entrepreneurship.",
                "responsibilities": ["Feed trending topics to Content Studio"],
                "capabilities": ["social_listening"],
                "tools": [
                    {
                        "name": "trend_tracker",
                        "description": "Social API trend listener",
                        "risk_level": "LOW",
                    }
                ],
                "autonomy_level": 4,
                "intelligence_config": {"model": "gemini-1.5-flash", "temperature": 0.4},
                "resource_limits": {"max_tokens_per_call": 4096, "max_daily_budget_usd": 8.0},
            },
            {
                "name": "Post Generator Agent",
                "role_title": "Social Content Creator",
                "department_name": "Content Studio",
                "system_instructions": "Generate punchy, insightful social posts. Keep hooks under 100 characters. Avoid corporate jargon.",
                "responsibilities": ["Daily post generation"],
                "capabilities": ["hook_crafting", "thread_writing"],
                "tools": [
                    {
                        "name": "post_scheduler",
                        "description": "Buffer/Hootsuite staging API",
                        "risk_level": "MEDIUM",
                    }
                ],
                "autonomy_level": 3,
                "intelligence_config": {"model": "gpt-4o", "temperature": 0.8},
                "resource_limits": {"max_tokens_per_call": 6144, "max_daily_budget_usd": 10.0},
            },
            {
                "name": "Community Responder Agent",
                "role_title": "Community Moderator",
                "department_name": "Community Care",
                "system_instructions": "Respond warmly and helpfully. Escalate serious complaints or public relations risks immediately.",
                "responsibilities": ["Reply to followers within 5 minutes"],
                "capabilities": ["sentiment_analysis", "deescalation"],
                "tools": [
                    {
                        "name": "reply_publisher",
                        "description": "Publish reply to thread",
                        "risk_level": "MEDIUM",
                    }
                ],
                "autonomy_level": 3,
                "intelligence_config": {"model": "gpt-4o-mini", "temperature": 0.3},
                "resource_limits": {"max_tokens_per_call": 4096, "max_daily_budget_usd": 6.0},
            },
        ],
        "workflows": [
            {
                "name": "Trend Response Workflow",
                "description": "Trend Discovery -> Angle Synthesis -> Draft Post -> Safety Check -> Post Publication",
                "trigger_type": "SCHEDULE",
                "steps": [
                    {"step_name": "Trend Discovery", "agent": "Trend Scout Agent"},
                    {"step_name": "Post Generation", "agent": "Post Generator Agent"},
                    {"step_name": "Community Ingestion", "agent": "Community Responder Agent"},
                ],
            }
        ],
        "policies": [
            {
                "name": "Social PR Guardrail Policy",
                "description": "Never take partisan political stances or publish unverified controversy.",
                "scope": "COMPANY",
                "rules": [{"condition": "contains_political_hotspot", "action": "BLOCK_POST"}],
                "enforcement_level": "HARD",
            }
        ],
        "constitution": {
            "mission": "Ignite meaningful digital community interactions with relentless positivity and wit.",
            "values": ["Authenticity", "Responsiveness", "Cultural empathy"],
            "operating_principles": [
                "Engage proactively",
                "Never argue with community members online",
            ],
            "prohibited_actions": [
                "Publishing unauthorized client customer names",
                "Using copyright-infringing media",
            ],
            "approval_requirements": [
                "Crisis communication statements",
                "Sponsored campaign activations",
            ],
            "security_rules": [
                "Two-factor authentication mandatory on all connected social handles"
            ],
            "financial_rules": ["Zero unapproved tool subscription purchases"],
            "data_rules": [
                "Private DM contents must never be fed into public LLM training datasets"
            ],
            "autonomy_boundaries": {"trend_identification": "LEVEL_5", "reply_posting": "LEVEL_3"},
            "escalation_rules": [
                "Escalate negative sentiment spike > 30% in 1 hour to PR Director"
            ],
        },
        "recommended_tools": [
            {
                "name": "social_scheduler_api",
                "description": "Posting engine",
                "risk_level": "MEDIUM",
            },
            {
                "name": "sentiment_filter",
                "description": "Toxicity and sentiment classifier",
                "risk_level": "LOW",
            },
        ],
        "intelligence_requirements": {
            "capabilities_required": ["creative_writing", "fast_inference", "sentiment_analysis"],
            "recommended_models": ["gpt-4o", "gemini-1.5-flash", "gpt-4o-mini"],
        },
        "resource_policies": {"financial_budget_usd": 300.0, "execution_slots": 5},
        "kpis": [
            {
                "name": "Engagement Rate",
                "metric": "engagement_pct",
                "target": ">= 4.5%",
                "review_frequency": "WEEKLY",
            },
            {
                "name": "Average Reply Time",
                "metric": "response_time_minutes",
                "target": "< 10",
                "review_frequency": "DAILY",
            },
        ],
        "approval_rules": [
            {
                "action": "CRISIS_PR_STATEMENT",
                "condition": "pr_risk == true",
                "approver_role": "ADMIN",
                "risk_level": "CRITICAL",
            }
        ],
        "escalation_rules": [
            {
                "trigger": "Viral complaint post reaching 10k views",
                "route_to": "PR Communications Lead",
                "severity": "CRITICAL",
                "sla_minutes": 5,
            }
        ],
    },
    # -------------------------------------------------------------
    # 5. CYBERSECURITY COMPANY
    # -------------------------------------------------------------
    {
        "key": "cybersecurity_company",
        "name": "Cybersecurity Company",
        "tagline": "Continuous Threat Intelligence, Vulnerability Scanning & SOC Automation",
        "description": "Defensive and offensive security organization providing 24/7 Security Operations Center (SOC) monitoring, CVE penetration analysis, and zero-trust policy enforcement.",
        "category": "Security & Defense",
        "icon": "shield",
        "is_system_template": True,
        "default_autonomy": 2,
        "estimated_monthly_cost_usd": 500.0,
        "metadata_tags": ["cybersecurity", "soc", "infosec", "threat-intel", "zero-trust"],
        "company_definition": {
            "name": "SentinX Cyber Defense",
            "mission": "Neutralize cyber threats and safeguard enterprise assets through relentless proactive security vigilance.",
            "vision": "Autonomous zero-trust threat detection and incident remediation.",
            "industry": "Information Security & Defense",
            "dna": {
                "operating_philosophy": "Zero trust, assume breach, verify continuously, automate defense",
                "innovation_level": "PROGRESSIVE",
                "autonomy_level": "GUIDED",
                "risk_tolerance": "RISK_AVERSE",
                "quality_threshold": "PERFECT",
                "decision_style": "AUTHORITATIVE",
                "communication_style": "FORMAL",
                "resource_strategy": "INVEST_HEAVY",
            },
        },
        "departments": [
            {
                "name": "Threat Intelligence",
                "purpose": "Hunting zero-days, monitoring dark web leaks, and tracking APT campaigns",
            },
            {
                "name": "Security Operations Center",
                "purpose": "SIEM log correlation, firewall rule validation, and alert triage",
            },
            {
                "name": "Vulnerability Assessment",
                "purpose": "Static code analysis, dependency CVE scanning, and penetration probing",
            },
        ],
        "roles": [
            {
                "department_name": "Threat Intelligence",
                "title": "Threat Intel Hunter",
                "responsibilities": [
                    "Track CVE databases",
                    "Extract IOCs (Indicators of Compromise)",
                    "Map tactics to MITRE ATT&CK",
                ],
                "capabilities": ["threat_intelligence", "ioc_extraction", "mitre_mapping"],
                "authority": "EXECUTE",
                "autonomy_level": 4,
            },
            {
                "department_name": "Security Operations Center",
                "title": "SOC Tier 2 Analyst",
                "responsibilities": [
                    "Triage SIEM alerts",
                    "Isolate suspicious host instances",
                    "Correlate intrusion attempts",
                ],
                "capabilities": ["siem_correlation", "incident_triage", "forensics"],
                "authority": "MANAGE",
                "autonomy_level": 3,
            },
            {
                "department_name": "Vulnerability Assessment",
                "title": "AppSec Auditor",
                "responsibilities": [
                    "Run SAST and DAST scans",
                    "Enforce software supply chain integrity",
                    "Verify patch deployments",
                ],
                "capabilities": ["vulnerability_scanning", "sast_audit", "remediation_advisory"],
                "authority": "EXECUTE",
                "autonomy_level": 3,
            },
        ],
        "agents": [
            {
                "name": "Threat Hunter Agent",
                "role_title": "Threat Intel Hunter",
                "department_name": "Threat Intelligence",
                "system_instructions": "Monitor NVD, CISA bulletins, and GitHub advisories. Alert on high-severity zero-day disclosures affecting stack.",
                "responsibilities": ["Daily threat briefing generation"],
                "capabilities": ["threat_intelligence", "ioc_extraction"],
                "tools": [
                    {
                        "name": "cve_nvd_feed",
                        "description": "National Vulnerability Database API",
                        "risk_level": "LOW",
                    }
                ],
                "autonomy_level": 4,
                "intelligence_config": {"model": "claude-3-5-sonnet", "temperature": 0.0},
                "resource_limits": {"max_tokens_per_call": 10000, "max_daily_budget_usd": 15.0},
            },
            {
                "name": "SOC Analyst Agent",
                "role_title": "SOC Tier 2 Analyst",
                "department_name": "Security Operations Center",
                "system_instructions": "Analyze intrusion logs. When brute force or credential stuffing detected, immediately stage IP blocklist rule.",
                "responsibilities": ["SIEM log analysis and alerting"],
                "capabilities": ["siem_correlation", "incident_triage"],
                "tools": [
                    {
                        "name": "waf_ip_blocker",
                        "description": "Add IP to firewall blocklist",
                        "risk_level": "HIGH",
                    }
                ],
                "autonomy_level": 3,
                "intelligence_config": {"model": "gpt-4o", "temperature": 0.1},
                "resource_limits": {"max_tokens_per_call": 8192, "max_daily_budget_usd": 18.0},
            },
            {
                "name": "Vulnerability Auditor Agent",
                "role_title": "AppSec Auditor",
                "department_name": "Vulnerability Assessment",
                "system_instructions": "Audit third-party dependencies. Fail builds containing CVEs with CVSS score >= 7.0.",
                "responsibilities": ["Software supply chain verification"],
                "capabilities": ["vulnerability_scanning", "sast_audit"],
                "tools": [
                    {
                        "name": "dependency_checker",
                        "description": "Scan package lockfiles",
                        "risk_level": "LOW",
                    }
                ],
                "autonomy_level": 3,
                "intelligence_config": {"model": "gemini-1.5-pro", "temperature": 0.0},
                "resource_limits": {"max_tokens_per_call": 8192, "max_daily_budget_usd": 12.0},
            },
        ],
        "workflows": [
            {
                "name": "Incident Detection and Triage",
                "description": "Anomaly Detection -> Log Correlation -> Threat Verification -> Containment -> Post-Mortem",
                "trigger_type": "EVENT",
                "steps": [
                    {"step_name": "Threat Ingestion", "agent": "Threat Hunter Agent"},
                    {"step_name": "SOC Log Correlation", "agent": "SOC Analyst Agent"},
                    {
                        "step_name": "Remediation Verification",
                        "agent": "Vulnerability Auditor Agent",
                    },
                ],
            }
        ],
        "policies": [
            {
                "name": "Zero Critical Vulnerability Policy",
                "description": "No software artifact with known unpatched CVSS >= 8.0 may remain deployed for > 24 hours.",
                "scope": "COMPANY",
                "rules": [{"condition": "unpatched_critical_cve > 0", "action": "ALERT_CISO"}],
                "enforcement_level": "ABSOLUTE",
            }
        ],
        "constitution": {
            "mission": "Protect enterprise sovereignty and digital resilience against all cyber threat actors.",
            "values": ["Uncompromising integrity", "Vigilant paranoia", "Responsible disclosure"],
            "operating_principles": [
                "Assume every environment is breached until proven clean",
                "Encrypt everywhere",
            ],
            "prohibited_actions": [
                "Executing unapproved penetration tests against third-party non-authorized targets",
                "Storing plain-text private keys",
            ],
            "approval_requirements": [
                "Emergency host network isolation",
                "Modifying core perimeter firewall routing",
            ],
            "security_rules": ["Zero-trust mutual TLS required for all agent RPC communications"],
            "financial_rules": [
                "Security bug bounty payout limits capped at $5,000 without board sign-off"
            ],
            "data_rules": ["Forensic evidence disk images encrypted with client public key"],
            "autonomy_boundaries": {
                "threat_research": "LEVEL_4",
                "firewall_rule_changes": "LEVEL_2",
            },
            "escalation_rules": ["Escalate confirmed breach attempt to CISO within 3 minutes"],
        },
        "recommended_tools": [
            {
                "name": "siem_collector",
                "description": "Elastic / Splunk log collector",
                "risk_level": "LOW",
            },
            {
                "name": "firewall_api",
                "description": "Cloudflare / AWS WAF rule updater",
                "risk_level": "HIGH",
            },
        ],
        "intelligence_requirements": {
            "capabilities_required": ["threat_intelligence", "incident_remediation", "deep_coding"],
            "recommended_models": ["claude-3-5-sonnet", "gpt-4o"],
        },
        "resource_policies": {"financial_budget_usd": 800.0, "execution_slots": 8},
        "kpis": [
            {
                "name": "Mean Time to Detect (MTTD)",
                "metric": "mttd_minutes",
                "target": "< 5",
                "review_frequency": "WEEKLY",
            },
            {
                "name": "Mean Time to Contain (MTTC)",
                "metric": "mttc_minutes",
                "target": "< 15",
                "review_frequency": "WEEKLY",
            },
        ],
        "approval_rules": [
            {
                "action": "ISOLATE_PRODUCTION_CLUSTER",
                "condition": "scope == 'production'",
                "approver_role": "ADMIN",
                "risk_level": "CRITICAL",
            }
        ],
        "escalation_rules": [
            {
                "trigger": "Ransomware signature detected",
                "route_to": "Incident Commander",
                "severity": "CRITICAL",
                "sla_minutes": 1,
            }
        ],
    },
    # -------------------------------------------------------------
    # 6. RESEARCH ORGANIZATION
    # -------------------------------------------------------------
    {
        "key": "research_organization",
        "name": "Research Organization",
        "tagline": "Scientific Literature Synthesis, Hypothesis Testing & Deep Analysis",
        "description": "Advanced research institute conducting systematic literature reviews, experimental hypothesis design, quantitative meta-analysis, and whitepaper authorship.",
        "category": "Science & Academia",
        "icon": "book-open",
        "is_system_template": True,
        "default_autonomy": 3,
        "estimated_monthly_cost_usd": 320.0,
        "metadata_tags": [
            "research",
            "academia",
            "scientific",
            "literature-review",
            "deep-analysis",
        ],
        "company_definition": {
            "name": "Synthetica Institute of Advanced Research",
            "mission": "Accelerate scientific discovery and evidence-based innovation through rigorous AI-driven synthesis and reproducible research methodologies.",
            "vision": "Autonomous scientific hypothesis generation and peer-review level rigor.",
            "industry": "Scientific Research & Development",
            "dna": {
                "operating_philosophy": "Follow empirical evidence, state uncertainty explicitly, verify citations",
                "innovation_level": "RADICAL",
                "autonomy_level": "DELEGATED",
                "risk_tolerance": "MODERATE",
                "quality_threshold": "EXCEPTIONAL",
                "decision_style": "CONSENSUS",
                "communication_style": "FORMAL",
                "resource_strategy": "INVEST_HEAVY",
            },
        },
        "departments": [
            {
                "name": "Literature & Meta-Analysis",
                "purpose": "Ingesting ArXiv, PubMed, and patent libraries to identify state of the art",
            },
            {
                "name": "Hypothesis & Experimental Design",
                "purpose": "Formulating falsifiable hypotheses and designing statistical tests",
            },
            {
                "name": "Publications & Peer Review",
                "purpose": "Drafting manuscripts, citation verification, and methodological critique",
            },
        ],
        "roles": [
            {
                "department_name": "Literature & Meta-Analysis",
                "title": "Principal Literature Scientist",
                "responsibilities": [
                    "Conduct systematic domain meta-analyses",
                    "Synthesize consensus findings",
                    "Track citation networks",
                ],
                "capabilities": ["literature_synthesis", "citation_graph_analysis"],
                "authority": "MANAGE",
                "autonomy_level": 4,
            },
            {
                "department_name": "Hypothesis & Experimental Design",
                "title": "Quantitative Methodologist",
                "responsibilities": [
                    "Formulate null hypotheses",
                    "Compute statistical power calculations",
                    "Design control experiments",
                ],
                "capabilities": [
                    "statistical_modeling",
                    "experimental_design",
                    "p_value_validation",
                ],
                "authority": "EXECUTE",
                "autonomy_level": 4,
            },
            {
                "department_name": "Publications & Peer Review",
                "title": "Scientific Editor & Reviewer",
                "responsibilities": [
                    "Audit manuscript rigor",
                    "Verify source integrity",
                    "Produce peer-review assessments",
                ],
                "capabilities": ["peer_review", "academic_writing", "hallucination_detection"],
                "authority": "EXECUTE",
                "autonomy_level": 3,
            },
        ],
        "agents": [
            {
                "name": "Literature Synthesizer Agent",
                "role_title": "Principal Literature Scientist",
                "department_name": "Literature & Meta-Analysis",
                "system_instructions": "Read academic papers. Synthesize claims, methodology, and limitations with exact DOI attribution.",
                "responsibilities": ["Literature summaries and state-of-the-art reports"],
                "capabilities": ["literature_synthesis"],
                "tools": [
                    {
                        "name": "arxiv_scholar_api",
                        "description": "Query academic repositories",
                        "risk_level": "LOW",
                    }
                ],
                "autonomy_level": 4,
                "intelligence_config": {"model": "claude-3-5-sonnet", "temperature": 0.2},
                "resource_limits": {"max_tokens_per_call": 32768, "max_daily_budget_usd": 18.0},
            },
            {
                "name": "Hypothesis Engine Agent",
                "role_title": "Quantitative Methodologist",
                "department_name": "Hypothesis & Experimental Design",
                "system_instructions": "Formulate mathematically sound hypotheses. Define measurable independent and dependent variables.",
                "responsibilities": ["Experiment protocol design"],
                "capabilities": ["statistical_modeling", "experimental_design"],
                "tools": [
                    {
                        "name": "math_symbolic_solver",
                        "description": "SymPy / NumPy calculation engine",
                        "risk_level": "LOW",
                    }
                ],
                "autonomy_level": 4,
                "intelligence_config": {"model": "gpt-4o", "temperature": 0.1},
                "resource_limits": {"max_tokens_per_call": 16384, "max_daily_budget_usd": 14.0},
            },
            {
                "name": "Peer Review Auditor Agent",
                "role_title": "Scientific Editor & Reviewer",
                "department_name": "Publications & Peer Review",
                "system_instructions": "Rigorously challenge proposed conclusions. Detect circular reasoning and unproven leaps of logic.",
                "responsibilities": ["Peer review assessments"],
                "capabilities": ["peer_review", "hallucination_detection"],
                "tools": [
                    {
                        "name": "citation_verifier",
                        "description": "Cross-reference claimed DOI references",
                        "risk_level": "LOW",
                    }
                ],
                "autonomy_level": 3,
                "intelligence_config": {"model": "gemini-1.5-pro", "temperature": 0.1},
                "resource_limits": {"max_tokens_per_call": 16384, "max_daily_budget_usd": 12.0},
            },
        ],
        "workflows": [
            {
                "name": "Scientific Discovery Pipeline",
                "description": "Problem Formulation -> Systematic Literature Review -> Hypothesis Generation -> Peer Review Verification",
                "trigger_type": "MANUAL",
                "steps": [
                    {"step_name": "Literature Survey", "agent": "Literature Synthesizer Agent"},
                    {"step_name": "Hypothesis Formulation", "agent": "Hypothesis Engine Agent"},
                    {"step_name": "Peer Review Audit", "agent": "Peer Review Auditor Agent"},
                ],
            }
        ],
        "policies": [
            {
                "name": "Citation Verifiability Policy",
                "description": "Every scientific assertion must cite an active, verifiable primary source with DOI.",
                "scope": "COMPANY",
                "rules": [
                    {"condition": "contains_unverified_citation", "action": "BLOCK_PUBLICATION"}
                ],
                "enforcement_level": "HARD",
            }
        ],
        "constitution": {
            "mission": "Expand human knowledge through transparent, verifiable, and reproducible intellectual inquiry.",
            "values": ["Intellectual honesty", "Reproducibility", "Methodological transparency"],
            "operating_principles": [
                "State margins of error honestly",
                "Never cherry-pick favorable data points",
            ],
            "prohibited_actions": [
                "Fabricating experimental data",
                "Publishing unverified claims as settled science",
            ],
            "approval_requirements": ["Public dissemination of whitepapers under company name"],
            "security_rules": [
                "Proprietary research and patent drafts kept in encrypted air-gapped repositories"
            ],
            "financial_rules": ["Research computing spend allocated per grant milestone"],
            "data_rules": ["Raw datasets published under Open Science Foundation guidelines"],
            "autonomy_boundaries": {
                "literature_analysis": "LEVEL_5",
                "whitepaper_publication": "LEVEL_2",
            },
            "escalation_rules": [
                "Flag potential research fraud or non-reproducible methodology immediately to Research Board"
            ],
        },
        "recommended_tools": [
            {
                "name": "semantic_scholar_connector",
                "description": "Access to 200M+ research papers",
                "risk_level": "LOW",
            },
            {
                "name": "latex_typesetter",
                "description": "Compile academic PDFs",
                "risk_level": "LOW",
            },
        ],
        "intelligence_requirements": {
            "capabilities_required": ["deep_reasoning", "large_context", "academic_writing"],
            "recommended_models": ["claude-3-5-sonnet", "gemini-1.5-pro", "gpt-4o"],
        },
        "resource_policies": {"financial_budget_usd": 500.0, "execution_slots": 6},
        "kpis": [
            {
                "name": "Research Rigor Score",
                "metric": "peer_review_acceptance_rate",
                "target": ">= 90%",
                "review_frequency": "QUARTERLY",
            },
            {
                "name": "Verified Citations",
                "metric": "citation_accuracy_pct",
                "target": "100%",
                "review_frequency": "MONTHLY",
            },
        ],
        "approval_rules": [
            {
                "action": "PUBLISH_WHITEPAPER",
                "condition": "target == 'public'",
                "approver_role": "ADMIN",
                "risk_level": "HIGH",
            }
        ],
        "escalation_rules": [
            {
                "trigger": "Hallucinated citation detected in manuscript",
                "route_to": "Lead Research Director",
                "severity": "HIGH",
                "sla_minutes": 60,
            }
        ],
    },
    # -------------------------------------------------------------
    # 7. E-COMMERCE COMPANY
    # -------------------------------------------------------------
    {
        "key": "ecommerce_company",
        "name": "E-commerce Company",
        "tagline": "Catalog Merchandising, Supply Chain Tracking & Customer Delight",
        "description": "Direct-to-consumer online retail brand automating catalog copywriting, pricing strategy, inventory reorder alerts, and 24/7 post-purchase support.",
        "category": "Retail & E-commerce",
        "icon": "shopping-cart",
        "is_system_template": True,
        "default_autonomy": 3,
        "estimated_monthly_cost_usd": 260.0,
        "metadata_tags": ["ecommerce", "retail", "shopify", "inventory", "customer-support"],
        "company_definition": {
            "name": "AuraGoods Global Retail",
            "mission": "Deliver premium consumer goods worldwide through friction-free discovery, transparent fulfillment, and proactive customer care.",
            "vision": "Autonomous predictive merchandising and zero-friction global commerce.",
            "industry": "E-commerce & Retail",
            "dna": {
                "operating_philosophy": "Customer obsession, inventory velocity, and automated unit economics",
                "innovation_level": "MODERATE",
                "autonomy_level": "DELEGATED",
                "risk_tolerance": "MODERATE",
                "quality_threshold": "HIGH",
                "decision_style": "CONSULTATIVE",
                "communication_style": "SEMI_FORMAL",
                "resource_strategy": "BALANCED",
            },
        },
        "departments": [
            {
                "name": "Merchandising & Catalog",
                "purpose": "Product descriptions, categorization, and pricing optimization",
            },
            {
                "name": "Supply Chain & Fulfillment",
                "purpose": "Stock level monitoring, supplier PO tracking, and courier logistics",
            },
            {
                "name": "Customer Experience",
                "purpose": "Order tracking, returns processing, and customer ticket resolution",
            },
        ],
        "roles": [
            {
                "department_name": "Merchandising & Catalog",
                "title": "Digital Merchandiser",
                "responsibilities": [
                    "Optimize product titles and descriptions",
                    "Set pricing rules",
                    "Manage discount coupons",
                ],
                "capabilities": ["catalog_management", "dynamic_pricing", "seo_copywriting"],
                "authority": "EXECUTE",
                "autonomy_level": 3,
            },
            {
                "department_name": "Supply Chain & Fulfillment",
                "title": "Inventory Controller",
                "responsibilities": [
                    "Forecast stock depletion",
                    "Generate supplier reorder recommendations",
                    "Track logistics delays",
                ],
                "capabilities": ["inventory_forecasting", "logistics_tracking"],
                "authority": "MANAGE",
                "autonomy_level": 3,
            },
            {
                "department_name": "Customer Experience",
                "title": "Customer Success Specialist",
                "responsibilities": [
                    "Resolve shipping status inquiries",
                    "Authorize return merchandise authorizations (RMA)",
                ],
                "capabilities": ["order_lookup", "ticket_resolution", "customer_deescalation"],
                "authority": "EXECUTE",
                "autonomy_level": 3,
            },
        ],
        "agents": [
            {
                "name": "Catalog Copilot Agent",
                "role_title": "Digital Merchandiser",
                "department_name": "Merchandising & Catalog",
                "system_instructions": "Craft appealing, benefit-driven product copy with SEO keywords and structured JSON-LD specifications.",
                "responsibilities": ["Product description generation"],
                "capabilities": ["catalog_management", "seo_copywriting"],
                "tools": [
                    {
                        "name": "shopify_catalog_tool",
                        "description": "Shopify product API",
                        "risk_level": "MEDIUM",
                    }
                ],
                "autonomy_level": 3,
                "intelligence_config": {"model": "gpt-4o", "temperature": 0.7},
                "resource_limits": {"max_tokens_per_call": 6144, "max_daily_budget_usd": 10.0},
            },
            {
                "name": "Inventory Sentinel Agent",
                "role_title": "Inventory Controller",
                "department_name": "Supply Chain & Fulfillment",
                "system_instructions": "Monitor warehouse SKU counts. When inventory drops below 14 days of run-rate, alert operations.",
                "responsibilities": ["Reorder trigger alerts"],
                "capabilities": ["inventory_forecasting"],
                "tools": [
                    {
                        "name": "warehouse_erp_tool",
                        "description": "ERP stock query",
                        "risk_level": "LOW",
                    }
                ],
                "autonomy_level": 3,
                "intelligence_config": {"model": "gemini-1.5-flash", "temperature": 0.1},
                "resource_limits": {"max_tokens_per_call": 4096, "max_daily_budget_usd": 8.0},
            },
            {
                "name": "Customer Concierge Agent",
                "role_title": "Customer Success Specialist",
                "department_name": "Customer Experience",
                "system_instructions": "Provide instant, empathetic order support. Process standard returns if within 30-day policy window.",
                "responsibilities": ["24/7 customer support inbox"],
                "capabilities": ["ticket_resolution", "customer_deescalation"],
                "tools": [
                    {
                        "name": "order_lookup_tool",
                        "description": "Retrieve order tracking status",
                        "risk_level": "LOW",
                    }
                ],
                "autonomy_level": 3,
                "intelligence_config": {"model": "gpt-4o-mini", "temperature": 0.2},
                "resource_limits": {"max_tokens_per_call": 4096, "max_daily_budget_usd": 8.0},
            },
        ],
        "workflows": [
            {
                "name": "Order Issue & Return Resolution",
                "description": "Inquiry Received -> Order Ingestion -> Policy Evaluation -> RMA Authorization -> Notification",
                "trigger_type": "WEBHOOK",
                "steps": [
                    {"step_name": "Support Ticket Ingest", "agent": "Customer Concierge Agent"},
                    {"step_name": "Inventory Restock Check", "agent": "Inventory Sentinel Agent"},
                ],
            }
        ],
        "policies": [
            {
                "name": "Refund Ceiling Policy",
                "description": "Automated refunds without manual verification are capped at $75 per customer transaction.",
                "scope": "COMPANY",
                "rules": [{"condition": "refund_amount > 75", "action": "REQUIRE_HUMAN_APPROVAL"}],
                "enforcement_level": "HARD",
            }
        ],
        "constitution": {
            "mission": "Delight customers globally with high quality products and rapid, transparent customer care.",
            "values": ["Customer respect", "Fulfillment reliability", "Fair pricing"],
            "operating_principles": [
                "Fix delivery problems promptly without bureaucratic friction"
            ],
            "prohibited_actions": [
                "Selling out-of-stock items without backorder notification",
                "Misrepresenting shipping transit times",
            ],
            "approval_requirements": [
                "Bulk supplier payments > $2,000",
                "Discount codes exceeding 30%",
            ],
            "security_rules": [
                "Payment tokenization via PCI-DSS certified gateway (never handle raw cards)"
            ],
            "financial_rules": ["Minimum gross product margin of 45% enforced across all sales"],
            "data_rules": [
                "Customer addresses purged from temporary cache after shipping label generation"
            ],
            "autonomy_boundaries": {"customer_support": "LEVEL_3", "supplier_reorders": "LEVEL_2"},
            "escalation_rules": ["Escalate angry customer threats or chargebacks to Support Lead"],
        },
        "recommended_tools": [
            {
                "name": "shopify_admin_bridge",
                "description": "Storefront integration",
                "risk_level": "MEDIUM",
            },
            {
                "name": "shipstation_bridge",
                "description": "Courier dispatch API",
                "risk_level": "LOW",
            },
        ],
        "intelligence_requirements": {
            "capabilities_required": ["fast_inference", "creative_writing", "empathetic_messaging"],
            "recommended_models": ["gpt-4o-mini", "gpt-4o", "gemini-1.5-flash"],
        },
        "resource_policies": {"financial_budget_usd": 350.0, "execution_slots": 5},
        "kpis": [
            {
                "name": "First Contact Resolution",
                "metric": "fcr_pct",
                "target": ">= 80%",
                "review_frequency": "WEEKLY",
            },
            {
                "name": "Stockout Rate",
                "metric": "stockout_sku_pct",
                "target": "< 2%",
                "review_frequency": "MONTHLY",
            },
        ],
        "approval_rules": [
            {
                "action": "ISSUE_REFUND",
                "condition": "amount > 75",
                "approver_role": "MANAGER",
                "risk_level": "MEDIUM",
            }
        ],
        "escalation_rules": [
            {
                "trigger": "Courier delivery delay affecting > 50 orders",
                "route_to": "Head of Logistics",
                "severity": "HIGH",
                "sla_minutes": 20,
            }
        ],
    },
    # -------------------------------------------------------------
    # 8. GAME STUDIO
    # -------------------------------------------------------------
    {
        "key": "game_studio",
        "name": "Game Studio",
        "tagline": "Game Mechanics Design, Lore Worldbuilding, Asset Pipelines & Playtesting",
        "description": "Interactive game development studio crafting immersive game worlds, balanced RPG systems, dialogue trees, and automated game loop playtesting.",
        "category": "Gaming & Interactive",
        "icon": "gamepad-2",
        "is_system_template": True,
        "default_autonomy": 3,
        "estimated_monthly_cost_usd": 380.0,
        "metadata_tags": [
            "gaming",
            "game-dev",
            "worldbuilding",
            "narrative",
            "playtesting",
            "unity",
            "unreal",
        ],
        "company_definition": {
            "name": "IronMyth Interactive Studios",
            "mission": "Forge unforgettable interactive entertainment worlds uniting rich systemic gameplay with deeply emotional narratives.",
            "vision": "Living, dynamic virtual worlds shaped continuously by autonomous game systems.",
            "industry": "Interactive Entertainment & Video Games",
            "dna": {
                "operating_philosophy": "Player agency, systemic consistency, iteration through rapid playtesting",
                "innovation_level": "RADICAL",
                "autonomy_level": "DELEGATED",
                "risk_tolerance": "AGGRESSIVE",
                "quality_threshold": "EXCEPTIONAL",
                "decision_style": "CONSENSUS",
                "communication_style": "CASUAL",
                "resource_strategy": "GROWTH",
            },
        },
        "departments": [
            {
                "name": "Game Design & Systems",
                "purpose": "Combat math, skill progression trees, and economy balancing",
            },
            {
                "name": "Narrative & Worldbuilding",
                "purpose": "Faction lore, NPC dialogue trees, quest scripts, and environmental story",
            },
            {
                "name": "Engineering & QA Playtesting",
                "purpose": "Core mechanics scripting, shader pipelines, and automated bot playtesting",
            },
        ],
        "roles": [
            {
                "department_name": "Game Design & Systems",
                "title": "Lead Systems Designer",
                "responsibilities": [
                    "Balance combat equations",
                    "Tune loot drop probability curves",
                    "Design boss mechanics",
                ],
                "capabilities": ["game_mechanics_balancing", "economy_tuning", "progression_math"],
                "authority": "MANAGE",
                "autonomy_level": 4,
            },
            {
                "department_name": "Narrative & Worldbuilding",
                "title": "Principal Lore Architect",
                "responsibilities": [
                    "Write branching NPC dialogues",
                    "Develop world history codex",
                    "Script dynamic quest lines",
                ],
                "capabilities": ["narrative_design", "branching_dialogue", "worldbuilding"],
                "authority": "EXECUTE",
                "autonomy_level": 4,
            },
            {
                "department_name": "Engineering & QA Playtesting",
                "title": "Playtest Automation Engineer",
                "responsibilities": [
                    "Script playtest bots",
                    "Identify soft-locks and progression bugs",
                    "Measure player drop-off",
                ],
                "capabilities": ["game_playtesting", "bug_reporting", "telemetry_logging"],
                "authority": "EXECUTE",
                "autonomy_level": 3,
            },
        ],
        "agents": [
            {
                "name": "Mechanics Balancer Agent",
                "role_title": "Lead Systems Designer",
                "department_name": "Game Design & Systems",
                "system_instructions": "Balance RPG damage formulas and economy sinks. Prevent dominant strategies that render other builds obsolete.",
                "responsibilities": ["Combat and economy balance simulations"],
                "capabilities": ["game_mechanics_balancing", "economy_tuning"],
                "tools": [
                    {
                        "name": "monte_carlo_simulator",
                        "description": "Loot table Monte Carlo simulator",
                        "risk_level": "LOW",
                    }
                ],
                "autonomy_level": 4,
                "intelligence_config": {"model": "gpt-4o", "temperature": 0.2},
                "resource_limits": {"max_tokens_per_call": 12000, "max_daily_budget_usd": 15.0},
            },
            {
                "name": "Narrative Weaver Agent",
                "role_title": "Principal Lore Architect",
                "department_name": "Narrative & Worldbuilding",
                "system_instructions": "Write compelling character dialogues with distinct voices, subtext, and branching player choices.",
                "responsibilities": ["Quest and dialogue generation"],
                "capabilities": ["narrative_design", "worldbuilding"],
                "tools": [
                    {
                        "name": "dialogue_tree_exporter",
                        "description": "Export Ink / Yarn Spinner format",
                        "risk_level": "LOW",
                    }
                ],
                "autonomy_level": 4,
                "intelligence_config": {"model": "claude-3-5-sonnet", "temperature": 0.8},
                "resource_limits": {"max_tokens_per_call": 16384, "max_daily_budget_usd": 18.0},
            },
            {
                "name": "Playtest Bot Agent",
                "role_title": "Playtest Automation Engineer",
                "department_name": "Engineering & QA Playtesting",
                "system_instructions": "Execute automated game playthroughs across different player playstyles (aggressive, stealth, completionist).",
                "responsibilities": ["Soft-lock and physics bug detection"],
                "capabilities": ["game_playtesting", "bug_reporting"],
                "tools": [
                    {
                        "name": "game_telemetry_probe",
                        "description": "Inspect player coordinate and health state",
                        "risk_level": "LOW",
                    }
                ],
                "autonomy_level": 3,
                "intelligence_config": {"model": "gemini-1.5-flash", "temperature": 0.1},
                "resource_limits": {"max_tokens_per_call": 6144, "max_daily_budget_usd": 10.0},
            },
        ],
        "workflows": [
            {
                "name": "Quest Creation & Playtest Workflow",
                "description": "Quest Outline -> Dialogue Authoring -> Balance Simulation -> Automated Playtest -> Bug Log",
                "trigger_type": "MANUAL",
                "steps": [
                    {"step_name": "Narrative Crafting", "agent": "Narrative Weaver Agent"},
                    {"step_name": "Systems Tuning", "agent": "Mechanics Balancer Agent"},
                    {"step_name": "Playtest Validation", "agent": "Playtest Bot Agent"},
                ],
            }
        ],
        "policies": [
            {
                "name": "Fair Microtransaction Policy",
                "description": "No pay-to-win mechanics or deceptive loot box odds allowed in game design specifications.",
                "scope": "COMPANY",
                "rules": [{"condition": "design_includes_p2w", "action": "BLOCK_DESIGN"}],
                "enforcement_level": "ABSOLUTE",
            }
        ],
        "constitution": {
            "mission": "Create deeply engaging interactive art that respects player time and fosters genuine community.",
            "values": ["Player respect", "Creative fearlessness", "Systemic depth"],
            "operating_principles": [
                "Fun over friction",
                "Reward player curiosity through environmental detail",
            ],
            "prohibited_actions": [
                "Implementing predatory dark patterns in monetization",
                "Plagiarizing existing game lore or assets",
            ],
            "approval_requirements": [
                "Master release build gold master sign-off",
                "IP licensing contracts",
            ],
            "security_rules": [
                "Game build source code and unwrapped assets watermarked and encrypted"
            ],
            "financial_rules": [
                "Outsourced voice acting or soundtrack budget allocations require producer review"
            ],
            "data_rules": [
                "In-game player analytics anonymized without personally identifiable tracking"
            ],
            "autonomy_boundaries": {
                "worldbuilding": "LEVEL_4",
                "monetization_structure": "LEVEL_2",
            },
            "escalation_rules": [
                "Escalate game-breaking blocker in vertical slice build immediately to Creative Director"
            ],
        },
        "recommended_tools": [
            {
                "name": "unity_editor_bridge",
                "description": "Scene hierarchy and asset manager",
                "risk_level": "MEDIUM",
            },
            {
                "name": "yarn_spinner_tool",
                "description": "Dialogue compilation",
                "risk_level": "LOW",
            },
        ],
        "intelligence_requirements": {
            "capabilities_required": [
                "creative_writing",
                "game_mechanics_balancing",
                "deep_reasoning",
            ],
            "recommended_models": ["claude-3-5-sonnet", "gpt-4o"],
        },
        "resource_policies": {"financial_budget_usd": 600.0, "execution_slots": 6},
        "kpis": [
            {
                "name": "Playtest Bug Discovery",
                "metric": "bugs_logged_per_build",
                "target": ">= 10",
                "review_frequency": "WEEKLY",
            },
            {
                "name": "Player Retention Target",
                "metric": "day_7_retention",
                "target": ">= 45%",
                "review_frequency": "MONTHLY",
            },
        ],
        "approval_rules": [
            {
                "action": "GOLD_MASTER_RELEASE",
                "condition": "version_type == 'release'",
                "approver_role": "ADMIN",
                "risk_level": "CRITICAL",
            }
        ],
        "escalation_rules": [
            {
                "trigger": "Soft-lock detected in primary main quest campaign",
                "route_to": "Lead Game Designer",
                "severity": "HIGH",
                "sla_minutes": 30,
            }
        ],
    },
    # -------------------------------------------------------------
    # 9. IT SERVICES COMPANY
    # -------------------------------------------------------------
    {
        "key": "it_services_company",
        "name": "IT Services Company",
        "tagline": "Enterprise Cloud Infrastructure, Helpdesk Support & System Administration",
        "description": "Managed Service Provider (MSP) and IT consulting firm automating helpdesk ticket resolution, IAM credential management, backup auditing, and cloud migration.",
        "category": "Enterprise Services",
        "icon": "server",
        "is_system_template": True,
        "default_autonomy": 2,
        "estimated_monthly_cost_usd": 300.0,
        "metadata_tags": ["it-services", "msp", "sysadmin", "cloud", "helpdesk", "iam"],
        "company_definition": {
            "name": "NexusPoint Enterprise IT Solutions",
            "mission": "Provide unyielding uptime, seamless workforce enablement, and airtight IT infrastructure management for global enterprises.",
            "vision": "Autonomous self-managing enterprise IT operations.",
            "industry": "Information Technology Services",
            "dna": {
                "operating_philosophy": "Standardized automation, preventive maintenance, and strict privilege management",
                "innovation_level": "MODERATE",
                "autonomy_level": "GUIDED",
                "risk_tolerance": "RISK_AVERSE",
                "quality_threshold": "EXCEPTIONAL",
                "decision_style": "AUTHORITATIVE",
                "communication_style": "FORMAL",
                "resource_strategy": "BALANCED",
            },
        },
        "departments": [
            {
                "name": "Service Desk & Support",
                "purpose": "Tier 1-3 helpdesk, password resets, hardware provisioning, and SaaS permissions",
            },
            {
                "name": "Cloud & Infrastructure Operations",
                "purpose": "AWS/Azure cloud instances, Kubernetes clusters, and networking",
            },
            {
                "name": "Compliance & Disaster Recovery",
                "purpose": "Daily backup verification, SOC 2 controls, and business continuity",
            },
        ],
        "roles": [
            {
                "department_name": "Service Desk & Support",
                "title": "Service Desk Engineer",
                "responsibilities": [
                    "Triage employee support tickets",
                    "Diagnose software errors",
                    "Grant role-based SaaS access",
                ],
                "capabilities": ["helpdesk_triage", "troubleshooting", "iam_administration"],
                "authority": "EXECUTE",
                "autonomy_level": 3,
            },
            {
                "department_name": "Cloud & Infrastructure Operations",
                "title": "Cloud Systems Administrator",
                "responsibilities": [
                    "Manage Terraform state files",
                    "Monitor VM CPU/memory thresholds",
                    "Execute OS patch cycles",
                ],
                "capabilities": [
                    "cloud_administration",
                    "terraform_orchestration",
                    "patch_management",
                ],
                "authority": "MANAGE",
                "autonomy_level": 2,
            },
            {
                "department_name": "Compliance & Disaster Recovery",
                "title": "Business Continuity Auditor",
                "responsibilities": [
                    "Verify daily database snapshots",
                    "Conduct mock restore drills",
                    "Audit SOC 2 evidence",
                ],
                "capabilities": ["backup_verification", "compliance_audit"],
                "authority": "EXECUTE",
                "autonomy_level": 3,
            },
        ],
        "agents": [
            {
                "name": "Helpdesk Assistant Agent",
                "role_title": "Service Desk Engineer",
                "department_name": "Service Desk & Support",
                "system_instructions": "Resolve user IT tickets quickly. Verify employee identity before executing password resets or permission changes.",
                "responsibilities": ["Automated helpdesk ticket resolution"],
                "capabilities": ["helpdesk_triage", "troubleshooting"],
                "tools": [
                    {
                        "name": "ticket_system_bridge",
                        "description": "ServiceNow / Jira Service Desk API",
                        "risk_level": "LOW",
                    }
                ],
                "autonomy_level": 3,
                "intelligence_config": {"model": "gpt-4o-mini", "temperature": 0.2},
                "resource_limits": {"max_tokens_per_call": 4096, "max_daily_budget_usd": 8.0},
            },
            {
                "name": "SysAdmin Cloud Agent",
                "role_title": "Cloud Systems Administrator",
                "department_name": "Cloud & Infrastructure Operations",
                "system_instructions": "Inspect cloud infrastructure health. Stage patch updates in staging. Require human sign-off for production changes.",
                "responsibilities": ["Cloud instance scaling and patching"],
                "capabilities": ["cloud_administration", "terraform_orchestration"],
                "tools": [
                    {
                        "name": "cloud_cli_tool",
                        "description": "AWS / Azure control bridge",
                        "risk_level": "HIGH",
                    }
                ],
                "autonomy_level": 2,
                "intelligence_config": {"model": "claude-3-5-sonnet", "temperature": 0.0},
                "resource_limits": {"max_tokens_per_call": 8192, "max_daily_budget_usd": 14.0},
            },
            {
                "name": "Backup Sentry Agent",
                "role_title": "Business Continuity Auditor",
                "department_name": "Compliance & Disaster Recovery",
                "system_instructions": "Verify all client databases have completed automated snapshots within the past 24 hours. Alert on failures.",
                "responsibilities": ["Disaster recovery readiness audits"],
                "capabilities": ["backup_verification"],
                "tools": [
                    {
                        "name": "snapshot_auditor",
                        "description": "Cloud backup validator",
                        "risk_level": "LOW",
                    }
                ],
                "autonomy_level": 3,
                "intelligence_config": {"model": "gemini-1.5-flash", "temperature": 0.0},
                "resource_limits": {"max_tokens_per_call": 4096, "max_daily_budget_usd": 6.0},
            },
        ],
        "workflows": [
            {
                "name": "Access Request Lifecycle",
                "description": "Ticket Submission -> Manager Approval Verification -> IAM Provisioning -> Audit Logging",
                "trigger_type": "WEBHOOK",
                "steps": [
                    {"step_name": "Ticket Ingestion", "agent": "Helpdesk Assistant Agent"},
                    {"step_name": "Privilege Provisioning", "agent": "SysAdmin Cloud Agent"},
                    {"step_name": "Compliance Check", "agent": "Backup Sentry Agent"},
                ],
            }
        ],
        "policies": [
            {
                "name": "Privilege Access Management Policy",
                "description": "Administrative root access must never be granted permanently; enforce temporary just-in-time elevation.",
                "scope": "COMPANY",
                "rules": [{"condition": "permanent_admin_grant", "action": "BLOCK_REQUEST"}],
                "enforcement_level": "ABSOLUTE",
            }
        ],
        "constitution": {
            "mission": "Ensure unbroken business operations and bulletproof IT reliability across all managed enterprise environments.",
            "values": ["Reliability", "Zero data loss", "Customer security"],
            "operating_principles": [
                "Test all backups periodically",
                "Never bypass change management tickets",
            ],
            "prohibited_actions": [
                "Deleting client infrastructure without multi-party approval",
                "Sharing administrative credentials in plain text",
            ],
            "approval_requirements": [
                "Production server termination",
                "Major cloud network routing changes",
            ],
            "security_rules": ["MFA mandatory for all accounts; least-privilege role assignment"],
            "financial_rules": [
                "Cloud resource provisioning exceeding $200/month requires client sign-off"
            ],
            "data_rules": ["Strict adherence to enterprise client data protection agreements"],
            "autonomy_boundaries": {
                "helpdesk_troubleshooting": "LEVEL_3",
                "cloud_provisioning": "LEVEL_2",
            },
            "escalation_rules": [
                "Escalate unrecoverable backup failure to VP of Infrastructure within 15 minutes"
            ],
        },
        "recommended_tools": [
            {"name": "aws_management_api", "description": "Cloud API bridge", "risk_level": "HIGH"},
            {
                "name": "jira_service_desk",
                "description": "Ticketing integration",
                "risk_level": "LOW",
            },
        ],
        "intelligence_requirements": {
            "capabilities_required": ["cloud_administration", "troubleshooting", "fast_inference"],
            "recommended_models": ["claude-3-5-sonnet", "gpt-4o-mini", "gemini-1.5-flash"],
        },
        "resource_policies": {"financial_budget_usd": 400.0, "execution_slots": 6},
        "kpis": [
            {
                "name": "Ticket Resolution SLA",
                "metric": "sla_compliance_pct",
                "target": ">= 98%",
                "review_frequency": "WEEKLY",
            },
            {
                "name": "Backup Success Rate",
                "metric": "backup_completion_pct",
                "target": "100%",
                "review_frequency": "DAILY",
            },
        ],
        "approval_rules": [
            {
                "action": "TERMINATE_CLOUD_INSTANCE",
                "condition": "environment == 'production'",
                "approver_role": "ADMIN",
                "risk_level": "CRITICAL",
            }
        ],
        "escalation_rules": [
            {
                "trigger": "Major server outage impacting > 100 users",
                "route_to": "Incident Commander",
                "severity": "CRITICAL",
                "sla_minutes": 5,
            }
        ],
    },
    # -------------------------------------------------------------
    # 10. EDUCATION ORGANIZATION
    # -------------------------------------------------------------
    {
        "key": "education_organization",
        "name": "Education Organization",
        "tagline": "Curriculum Design, Adaptive Learning Pathways & Student Mentorship",
        "description": "EdTech academy and learning institution generating structured syllabi, interactive coding tutorials, grading rubric evaluations, and personalized student coaching.",
        "category": "Education & Learning",
        "icon": "graduation-cap",
        "is_system_template": True,
        "default_autonomy": 3,
        "estimated_monthly_cost_usd": 240.0,
        "metadata_tags": ["education", "edtech", "curriculum", "tutoring", "pedagogy", "grading"],
        "company_definition": {
            "name": "Veritas Academy of Applied Intelligence",
            "mission": "Democratize world-class technical education through personalized, adaptive learning systems that empower every student to master modern craft.",
            "vision": "Autonomous 1-on-1 tutoring accessible to every learner on Earth.",
            "industry": "Education & EdTech",
            "dna": {
                "operating_philosophy": "Socratic inquiry, mastery-based progression, and constructive psychological encouragement",
                "innovation_level": "PROGRESSIVE",
                "autonomy_level": "DELEGATED",
                "risk_tolerance": "CAUTIOUS",
                "quality_threshold": "EXCEPTIONAL",
                "decision_style": "CONSULTATIVE",
                "communication_style": "SEMI_FORMAL",
                "resource_strategy": "BALANCED",
            },
        },
        "departments": [
            {
                "name": "Curriculum & Pedagogy",
                "purpose": "Designing course syllabi, learning outcomes, and practical project exercises",
            },
            {
                "name": "Adaptive Tutoring",
                "purpose": "Providing 1-on-1 Socratic feedback, explaining difficult concepts, and answering questions",
            },
            {
                "name": "Assessment & Evaluation",
                "purpose": "Grading student assignment submissions against standardized rubrics",
            },
        ],
        "roles": [
            {
                "department_name": "Curriculum & Pedagogy",
                "title": "Master Instructional Designer",
                "responsibilities": [
                    "Construct progressive module roadmaps",
                    "Author engaging problem sets",
                    "Verify prerequisite alignment",
                ],
                "capabilities": ["curriculum_design", "pedagogical_structuring", "bloom_taxonomy"],
                "authority": "MANAGE",
                "autonomy_level": 4,
            },
            {
                "department_name": "Adaptive Tutoring",
                "title": "Socratic Mentor",
                "responsibilities": [
                    "Guide students to answers without giving the solution directly",
                    "Provide constructive encouragement",
                ],
                "capabilities": [
                    "socratic_dialogue",
                    "concept_simplification",
                    "empathetic_tutoring",
                ],
                "authority": "EXECUTE",
                "autonomy_level": 4,
            },
            {
                "department_name": "Assessment & Evaluation",
                "title": "Academic Assessment Evaluator",
                "responsibilities": [
                    "Grade submitted project code",
                    "Provide granular constructive feedback",
                    "Check for academic honesty",
                ],
                "capabilities": ["rubric_grading", "code_review_pedagogy", "plagiarism_detection"],
                "authority": "EXECUTE",
                "autonomy_level": 3,
            },
        ],
        "agents": [
            {
                "name": "Curriculum Architect Agent",
                "role_title": "Master Instructional Designer",
                "department_name": "Curriculum & Pedagogy",
                "system_instructions": "Build comprehensive course syllabi with progressive difficulty, clear learning outcomes, and real-world milestones.",
                "responsibilities": ["Course design and exercise authoring"],
                "capabilities": ["curriculum_design", "pedagogical_structuring"],
                "tools": [
                    {
                        "name": "curriculum_exporter",
                        "description": "Markdown / LMS exporter",
                        "risk_level": "LOW",
                    }
                ],
                "autonomy_level": 4,
                "intelligence_config": {"model": "claude-3-5-sonnet", "temperature": 0.4},
                "resource_limits": {"max_tokens_per_call": 16384, "max_daily_budget_usd": 12.0},
            },
            {
                "name": "Socratic Tutor Agent",
                "role_title": "Socratic Mentor",
                "department_name": "Adaptive Tutoring",
                "system_instructions": "Use Socratic questioning to guide learners. Explain complex computer science ideas using intuitive analogies.",
                "responsibilities": ["1-on-1 personalized tutoring"],
                "capabilities": ["socratic_dialogue", "concept_simplification"],
                "tools": [
                    {
                        "name": "code_sandbox_runner",
                        "description": "Execute Python snippet safely",
                        "risk_level": "LOW",
                    }
                ],
                "autonomy_level": 4,
                "intelligence_config": {"model": "gpt-4o", "temperature": 0.6},
                "resource_limits": {"max_tokens_per_call": 8192, "max_daily_budget_usd": 14.0},
            },
            {
                "name": "Assignment Grader Agent",
                "role_title": "Academic Assessment Evaluator",
                "department_name": "Assessment & Evaluation",
                "system_instructions": "Evaluate submitted projects against the rubric. Highlight strengths before giving actionable correction steps.",
                "responsibilities": ["Project grading and feedback"],
                "capabilities": ["rubric_grading", "plagiarism_detection"],
                "tools": [
                    {
                        "name": "rubric_scorer",
                        "description": "Structured grade score generator",
                        "risk_level": "LOW",
                    }
                ],
                "autonomy_level": 3,
                "intelligence_config": {"model": "gpt-4o", "temperature": 0.1},
                "resource_limits": {"max_tokens_per_call": 8192, "max_daily_budget_usd": 10.0},
            },
        ],
        "workflows": [
            {
                "name": "Student Project Submission & Feedback",
                "description": "Project Received -> Plagiarism Check -> Rubric Assessment -> Personalized Socratic Feedback Delivered",
                "trigger_type": "WEBHOOK",
                "steps": [
                    {"step_name": "Evaluation", "agent": "Assignment Grader Agent"},
                    {"step_name": "Mentorship Follow-up", "agent": "Socratic Tutor Agent"},
                ],
            }
        ],
        "policies": [
            {
                "name": "Academic Rigor & Anti-Cheating Policy",
                "description": "Assessments must test deep conceptual understanding and synthesis rather than rote memorization.",
                "scope": "COMPANY",
                "rules": [
                    {
                        "condition": "contains_unattributed_plagiarism",
                        "action": "FLAG_ACADEMIC_INTEGRITY",
                    }
                ],
                "enforcement_level": "HARD",
            }
        ],
        "constitution": {
            "mission": "Empower learners of all backgrounds through compassionate, rigorous, and individualized educational mentorship.",
            "values": ["Intellectual growth", "Patience", "Accessibility"],
            "operating_principles": [
                "Celebrate effort and growth mindset",
                "Every student can master the material with the right scaffolding",
            ],
            "prohibited_actions": [
                "Belittling student efforts",
                "Providing complete homework answers directly without fostering inquiry",
            ],
            "approval_requirements": [
                "Official certificate issuance",
                "Changing graduation requirements",
            ],
            "security_rules": [
                "Student grade books and personal learning records protected under FERPA guidelines"
            ],
            "financial_rules": ["Scholarship and fee waiver allocations audited semesterly"],
            "data_rules": [
                "Student conversation transcripts anonymized before model quality evaluations"
            ],
            "autonomy_boundaries": {
                "tutoring_interactions": "LEVEL_4",
                "credential_issuance": "LEVEL_2",
            },
            "escalation_rules": [
                "Escalate reports of student distress or severe learning blockers to Academic Dean"
            ],
        },
        "recommended_tools": [
            {
                "name": "canvas_lms_bridge",
                "description": "LMS gradebook connector",
                "risk_level": "LOW",
            },
            {
                "name": "python_sandbox",
                "description": "Safe code evaluation environment",
                "risk_level": "LOW",
            },
        ],
        "intelligence_requirements": {
            "capabilities_required": [
                "empathetic_messaging",
                "concept_simplification",
                "deep_coding",
            ],
            "recommended_models": ["gpt-4o", "claude-3-5-sonnet", "gemini-1.5-flash"],
        },
        "resource_policies": {"financial_budget_usd": 350.0, "execution_slots": 6},
        "kpis": [
            {
                "name": "Course Completion Rate",
                "metric": "completion_pct",
                "target": ">= 75%",
                "review_frequency": "MONTHLY",
            },
            {
                "name": "Student Satisfaction",
                "metric": "csat_score",
                "target": ">= 4.8 / 5.0",
                "review_frequency": "WEEKLY",
            },
        ],
        "approval_rules": [
            {
                "action": "ISSUE_COMPLETION_CERTIFICATE",
                "condition": "type == 'graduation'",
                "approver_role": "ADMIN",
                "risk_level": "HIGH",
            }
        ],
        "escalation_rules": [
            {
                "trigger": "Student fails 3 consecutive milestone submissions",
                "route_to": "Academic Success Counselor",
                "severity": "MEDIUM",
                "sla_minutes": 120,
            }
        ],
    },
    # -------------------------------------------------------------
    # 11. MINING TECHNOLOGY COMPANY
    # -------------------------------------------------------------
    {
        "key": "mining_technology_company",
        "name": "Mining Technology Company",
        "tagline": "Autonomous Geological Exploration, Fleet Telemetry & Extraction Safety",
        "description": "Industrial intelligence organization specializing in real-time geospatial ore body modeling, autonomous heavy haulage telemetry, predictive maintenance, and environmental compliance.",
        "category": "Heavy Industry & Mining",
        "icon": "pickaxe",
        "is_system_template": True,
        "default_autonomy": 2,
        "estimated_monthly_cost_usd": 680.0,
        "metadata_tags": [
            "mining",
            "geospatial",
            "iot",
            "fleet-telemetry",
            "predictive-maintenance",
            "safety",
        ],
        "company_definition": {
            "name": "OreDynamics Autonomous Tech",
            "mission": "Pioneer zero-harm autonomous mining operations through real-time geological sensors, predictive fleet management, and continuous environmental stewardship.",
            "vision": "Fully autonomous, carbon-neutral subsurface and open-pit resource extraction.",
            "industry": "Mining & Natural Resources",
            "dna": {
                "operating_philosophy": "Zero-compromise occupational safety, continuous telemetry streaming, and predictive asset protection",
                "innovation_level": "PROGRESSIVE",
                "autonomy_level": "GUIDED",
                "risk_tolerance": "CAUTIOUS",
                "quality_threshold": "EXCEPTIONAL",
                "decision_style": "AUTHORITATIVE",
                "communication_style": "FORMAL",
                "resource_strategy": "INVEST_HEAVY",
            },
        },
        "departments": [
            {
                "name": "Geological Exploration & Geospatial",
                "purpose": "Seismic data processing, 3D ore deposit block modeling, and grade control estimation",
            },
            {
                "name": "Fleet Telemetry & Autonomous Operations",
                "purpose": "Heavy equipment IoT telemetry, haul road dispatch optimization, and haul truck diagnostics",
            },
            {
                "name": "Safety, Environmental & Regulatory Compliance",
                "purpose": "Ground stability radar monitoring, emissions tracking, MSHA/OSHA compliance, and blast clearing protocols",
            },
        ],
        "roles": [
            {
                "department_name": "Geological Exploration & Geospatial",
                "title": "Principal Geostatistician",
                "responsibilities": [
                    "Kriging deposit grade estimation",
                    "Geotechnical core scan interpretation",
                    "Coordinate borehole drilling campaigns",
                ],
                "capabilities": [
                    "geostatistical_modeling",
                    "seismic_inversion",
                    "resource_classification",
                ],
                "authority": "MANAGE",
                "autonomy_level": 3,
            },
            {
                "department_name": "Fleet Telemetry & Autonomous Operations",
                "title": "Fleet Dispatch & Systems Engineer",
                "responsibilities": [
                    "Route optimization for haulage trucks",
                    "Predictive vibration and thermal anomaly detection",
                    "Autonomous drill rig scheduling",
                ],
                "capabilities": [
                    "scada_integration",
                    "iot_telemetry_analysis",
                    "predictive_maintenance",
                ],
                "authority": "EXECUTE",
                "autonomy_level": 3,
            },
            {
                "department_name": "Safety, Environmental & Regulatory Compliance",
                "title": "Mine Safety & Environmental Controller",
                "responsibilities": [
                    "Radar geotechnical slope stability monitoring",
                    "Autonomous blast zone exclusion perimeter verification",
                    "Environmental runoff and water table chemical monitoring",
                ],
                "capabilities": [
                    "slope_stability_analysis",
                    "hazard_triangulation",
                    "regulatory_audit",
                ],
                "authority": "MANAGE",
                "autonomy_level": 2,
            },
        ],
        "agents": [
            {
                "name": "Geological Modeler Agent",
                "role_title": "Principal Geostatistician",
                "department_name": "Geological Exploration & Geospatial",
                "system_instructions": "You are the OreDynamics Chief Geological AI. Ingest assay drillhole tables, construct 3D block models, calculate cut-off grades, and identify structural faults with strict confidence intervals.",
                "responsibilities": [
                    "Process hyperspectral core imagery",
                    "Run 3D geostatistical kriging estimations",
                    "Generate mine development block models",
                ],
                "capabilities": ["geostatistical_modeling", "seismic_inversion"],
                "tools": [
                    {
                        "name": "geospatial_gis_bridge",
                        "description": "GIS shapefile & voxel block grid reader",
                        "risk_level": "LOW",
                    },
                    {
                        "name": "assay_csv_parser",
                        "description": "Chemical composition assay lab parser",
                        "risk_level": "LOW",
                    },
                ],
                "autonomy_level": 3,
                "intelligence_config": {"model": "claude-3-5-sonnet", "temperature": 0.1},
                "resource_limits": {"max_tokens_per_call": 16384, "max_daily_budget_usd": 25.0},
            },
            {
                "name": "Fleet Telemetry Diagnostics Agent",
                "role_title": "Fleet Dispatch & Systems Engineer",
                "department_name": "Fleet Telemetry & Autonomous Operations",
                "system_instructions": "Continuously analyze CAN-bus telemetry, tire pressure/temperature sensors, and hydraulic fluid vibration metrics across autonomous haulage fleets to prevent catastrophic machine downtime.",
                "responsibilities": [
                    "Monitor engine telemetry streams",
                    "Trigger preventative maintenance work orders",
                    "Optimize shovel-to-crusher cycle times",
                ],
                "capabilities": ["scada_integration", "iot_telemetry_analysis"],
                "tools": [
                    {
                        "name": "canbus_telemetry_stream",
                        "description": "Real-time heavy machinery CAN-bus reader",
                        "risk_level": "LOW",
                    },
                    {
                        "name": "sap_work_order_connector",
                        "description": "Enterprise maintenance ERP connector",
                        "risk_level": "MEDIUM",
                    },
                ],
                "autonomy_level": 3,
                "intelligence_config": {"model": "gemini-1.5-pro", "temperature": 0.2},
                "resource_limits": {"max_tokens_per_call": 8192, "max_daily_budget_usd": 20.0},
            },
            {
                "name": "Mine Safety & Environmental Guardian",
                "role_title": "Mine Safety & Environmental Controller",
                "department_name": "Safety, Environmental & Regulatory Compliance",
                "system_instructions": "Maintain absolute vigilance over highwall slope stability, blast exclusion perimeters, and toxic gas sensor clusters (CO, NO2, CH4). Halt operations immediately if human safety or environmental thresholds are breached.",
                "responsibilities": [
                    "Inspect geotechnical displacement radar data",
                    "Verify zero-personnel confirmation in active blast zones",
                    "Track particulate and groundwater acidity metrics",
                ],
                "capabilities": ["slope_stability_analysis", "hazard_triangulation"],
                "tools": [
                    {
                        "name": "slope_radar_telemetry",
                        "description": "Sub-millimeter slope displacement radar API",
                        "risk_level": "LOW",
                    },
                    {
                        "name": "emergency_beacon_broadcaster",
                        "description": "Emergency mine evacuation sirens and radios",
                        "risk_level": "CRITICAL",
                    },
                ],
                "autonomy_level": 2,
                "intelligence_config": {"model": "gpt-4o", "temperature": 0.0},
                "resource_limits": {"max_tokens_per_call": 8192, "max_daily_budget_usd": 30.0},
            },
        ],
        "workflows": [
            {
                "name": "Autonomous Blast Clearing & Verification",
                "description": "Multi-tier perimeter sweep verifying all personnel and equipment are evac'd before detonation",
                "trigger_type": "SCHEDULED",
                "steps": [
                    {
                        "step": 1,
                        "action": "Query GPS wearable tags in blast radius",
                        "responsible_role": "Mine Safety & Environmental Controller",
                    },
                    {
                        "step": 2,
                        "action": "Lock autonomous haul truck paths outside containment",
                        "responsible_role": "Fleet Dispatch & Systems Engineer",
                    },
                    {
                        "step": 3,
                        "action": "Verify atmospheric gas dispersion simulations",
                        "responsible_role": "Mine Safety & Environmental Controller",
                    },
                    {
                        "step": 4,
                        "action": "Require human General Mine Manager sign-off",
                        "responsible_role": "Mine Safety & Environmental Controller",
                    },
                ],
            },
            {
                "name": "Predictive Hauler Overhaul Scheduling",
                "description": "Detects bearing degradation and schedules depot turnaround without impacting production targets",
                "trigger_type": "EVENT_DRIVEN",
                "steps": [
                    {
                        "step": 1,
                        "action": "Ingest anomalous vibration spectrum on rear axle",
                        "responsible_role": "Fleet Dispatch & Systems Engineer",
                    },
                    {
                        "step": 2,
                        "action": "Re-route redundant CAT 797 hauler into cycle",
                        "responsible_role": "Fleet Dispatch & Systems Engineer",
                    },
                    {
                        "step": 3,
                        "action": "Dispatch maintenance work order and reserve parts",
                        "responsible_role": "Fleet Dispatch & Systems Engineer",
                    },
                ],
            },
        ],
        "policies": [
            {
                "name": "Zero-Harm Pit Safety Directive",
                "description": "Any geotechnical ground movement above 5mm/hr triggers mandatory automated evacuation",
                "scope": "COMPANY",
                "enforcement_level": "HARD",
                "rules": [
                    {
                        "metric": "slope_displacement_rate_mm_hr",
                        "max_allowed": 5.0,
                        "violation": "TRIGGER_EMERGENCY_ALARM",
                    },
                    {
                        "metric": "toxic_gas_ppm_ch4",
                        "max_allowed": 1.0,
                        "violation": "VENTILATE_AND_HALT",
                    },
                ],
            }
        ],
        "constitution": {
            "mission": "Safely and efficiently extract essential mineral resources through autonomous technology without endangering human lives.",
            "values": [
                "Zero Harm to Workers",
                "Environmental Responsibility",
                "Predictive Over Reactive Operations",
                "Data Integrity and Sensor Rigor",
            ],
            "operating_principles": [
                "Never bypass geotechnical safety radars for production speed",
                "Blast authorization requires affirmative human double-verification",
                "Strict auditability of all hazardous materials and emissions",
            ],
            "prohibited_actions": [
                "Disabling safety interlocks or exclusion zone warnings",
                "Automating live blast ignition without human safety officer approval",
                "Suppressing environmental exceedance records",
            ],
            "approval_requirements": [
                "Pit boundary modifications and blast execution require General Manager approval",
                "Autonomous fleet speed cap adjustments above 45km/h require Safety Director review",
            ],
            "security_rules": [
                "SCADA network isolation with read-only diode bridging",
                "Air-gapped safety instrumented systems (SIS)",
            ],
            "financial_rules": [
                "Expenditures over $25,000 for heavy component replacements require executive signoff"
            ],
            "data_rules": [
                "Sensor telemetry retained for 10 years for statutory compliance",
                "Geological core sample logs protected as proprietary IP",
            ],
            "autonomy_boundaries": {
                "blast_operations": "LEVEL_2",
                "fleet_diagnostics": "LEVEL_3",
                "environmental_alarms": "LEVEL_4",
            },
            "escalation_rules": [
                "Immediately alert pit superintendent and trigger siren on slope displacement warning"
            ],
        },
        "recommended_tools": [
            {
                "name": "scada_opcua_collector",
                "description": "Industrial IoT OPC-UA collector",
                "risk_level": "LOW",
            },
            {
                "name": "geotech_radar_api",
                "description": "Slope stability interferometric radar connector",
                "risk_level": "LOW",
            },
            {
                "name": "gis_3d_engine",
                "description": "3D geological voxel voxelization service",
                "risk_level": "LOW",
            },
        ],
        "intelligence_requirements": {
            "capabilities_required": [
                "geostatistical_modeling",
                "iot_telemetry_analysis",
                "predictive_maintenance",
                "hazard_triangulation",
            ],
            "recommended_models": ["claude-3-5-sonnet", "gemini-1.5-pro", "gpt-4o"],
        },
        "resource_policies": {"financial_budget_usd": 680.0, "execution_slots": 8},
        "kpis": [
            {
                "name": "Total Recordable Incident Rate (TRIR)",
                "metric": "trir_value",
                "target": "0.00",
                "review_frequency": "DAILY",
            },
            {
                "name": "Haulage Fleet Availability",
                "metric": "fleet_uptime_pct",
                "target": ">= 94.5%",
                "review_frequency": "WEEKLY",
            },
            {
                "name": "Ore Grade Compliance",
                "metric": "cut_off_variance_pct",
                "target": "< 2.0%",
                "review_frequency": "WEEKLY",
            },
        ],
        "approval_rules": [
            {
                "action": "EXECUTE_BLAST_SEQUENCE",
                "condition": "all",
                "approver_role": "ADMIN",
                "risk_level": "CRITICAL",
            },
            {
                "action": "EXCEED_HEAVY_COMPONENT_BUDGET",
                "condition": "cost > 25000",
                "approver_role": "MANAGER",
                "risk_level": "HIGH",
            },
        ],
        "escalation_rules": [
            {
                "trigger": "Slope radar detects displacement >= 4mm/hr",
                "route_to": "Mine Safety & Environmental Controller",
                "severity": "CRITICAL",
                "sla_minutes": 5,
            },
            {
                "trigger": "Autonomous hauler telemetry timeout >= 30 seconds",
                "route_to": "Fleet Dispatch & Systems Engineer",
                "severity": "HIGH",
                "sla_minutes": 10,
            },
        ],
    },
]
