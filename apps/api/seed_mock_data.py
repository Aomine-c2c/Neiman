"""
Seed high-fidelity operational mock data directly into SQLite production DB.
Uses standard compliant 36-char hyphenated UUIDs for all foreign keys and primary keys.
"""

import json
import os
import sqlite3
import uuid

DB_PATHS = [
    "/home/sila/.local/share/neiman/production.db",
    "/home/sila/Projects/Sila/apps/api/nexora.db",
]


def seed_db(db_path: str):
    if not os.path.exists(db_path):
        return
    print(f"\n[+] Seeding database: {db_path}")
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    cur.execute("SELECT id FROM companies;")
    companies = [r[0] for r in cur.fetchall()]
    if not companies:
        print("[!] No companies found.")
        return

    cur.execute("SELECT id FROM users LIMIT 1;")
    user_row = cur.fetchone()
    user_id = user_row[0] if user_row else str(uuid.uuid4())

    for company_id in companies:
        print(f"[*] Populating company {company_id}...")

        # 1. Departments
        dept_eng = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{company_id}-dept-eng"))
        dept_gov = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{company_id}-dept-gov"))
        dept_prod = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{company_id}-dept-prod"))

        cur.execute(
            """
            INSERT OR REPLACE INTO departments (id, company_id, name, purpose, status, created_at, updated_at)
            VALUES
                (?, ?, 'Autonomous Systems Core', 'Build, harden, and evolve core agentic pipelines', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
                (?, ?, 'Governance & Compliance', 'Constitution enforcement, safety gates, and budget audits', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
                (?, ?, 'Product & Strategy', 'Roadmap synthesis, milestone tracking, and user alignment', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
        """,
            (dept_eng, company_id, dept_gov, company_id, dept_prod, company_id),
        )

        # 2. Org Roles
        role_lead = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{company_id}-role-lead"))
        role_sec = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{company_id}-role-sec"))
        role_prod = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{company_id}-role-prod"))

        cur.execute(
            """
            INSERT OR REPLACE INTO org_roles (id, department_id, company_id, title, responsibilities, capabilities, authority, required_skills, autonomy_level, created_at, updated_at)
            VALUES
                (?, ?, ?, 'Principal Systems Architect', '["System architecture", "Code review", "Task decomposition"]', '["code_execution", "git_ops"]', 'FULL', '["Rust", "Python", "TypeScript"]', 'FULLY_AUTONOMOUS', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
                (?, ?, ?, 'Governance Officer', '["Constitution auditing", "Approval vetting", "Budget guardrails"]', '["governance_check", "audit_log"]', 'MANAGE', '["Constitutional Law", "Risk Scoring"]', 'DELEGATED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
                (?, ?, ?, 'Lead Product Synthesizer', '["Feature scoping", "Milestone alignment"]', '["planning", "user_interview"]', 'MANAGE', '["Product Strategy"]', 'DELEGATED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
        """,
            (
                role_lead,
                dept_eng,
                company_id,
                role_sec,
                dept_gov,
                company_id,
                role_prod,
                dept_prod,
                company_id,
            ),
        )

        # 3. Agents
        agent_atlas = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{company_id}-agent-atlas"))
        agent_themis = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{company_id}-agent-themis"))
        agent_orion = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{company_id}-agent-orion"))
        agent_cipher = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{company_id}-agent-cipher"))

        agents_data = [
            (
                agent_atlas,
                company_id,
                role_lead,
                dept_eng,
                "Atlas // Principal Engineer",
                json.dumps({"avatar": "robot", "codename": "ATLAS"}),
                "Execute full-stack architecture, perform code generation, enforce TypeScript strictness.",
                json.dumps(["code_execution", "terminal_ops", "git_commit"]),
                json.dumps({"max_spend_per_day": 50, "can_create_tasks": True}),
                "AUTONOMOUS",
                "WORKING",
                json.dumps({"provider": "anthropic", "model": "claude-3-5-sonnet-20241022"}),
                json.dumps(
                    {"tasks_completed": 42, "accuracy_score": 0.98, "tokens_consumed": 184500}
                ),
            ),
            (
                agent_themis,
                company_id,
                role_sec,
                dept_gov,
                "Themis // Constitutional Guardian",
                json.dumps({"avatar": "shield", "codename": "THEMIS"}),
                "Vet all autonomous operations against the immutable organizational constitution.",
                json.dumps(["policy_verification", "audit_trail", "escalation_gate"]),
                json.dumps({"can_block_tasks": True, "approval_threshold_usd": 100}),
                "AUTONOMOUS",
                "AVAILABLE",
                json.dumps({"provider": "openai", "model": "gpt-4o"}),
                json.dumps(
                    {"tasks_completed": 118, "accuracy_score": 0.99, "tokens_consumed": 89200}
                ),
            ),
            (
                agent_orion,
                company_id,
                role_prod,
                dept_prod,
                "Orion // Product Strategist",
                json.dumps({"avatar": "compass", "codename": "ORION"}),
                "Analyze market telemetry, decompose strategic projects into granular atomic actions.",
                json.dumps(["task_decomposition", "milestone_synthesis", "spec_writing"]),
                json.dumps({"can_create_projects": True}),
                "SEMI_AUTONOMOUS",
                "WORKING",
                json.dumps({"provider": "google", "model": "gemini-1.5-pro"}),
                json.dumps(
                    {"tasks_completed": 29, "accuracy_score": 0.96, "tokens_consumed": 142000}
                ),
            ),
            (
                agent_cipher,
                company_id,
                role_lead,
                dept_eng,
                "Cipher // Security Auditor",
                json.dumps({"avatar": "lock", "codename": "CIPHER"}),
                "Cryptographic proof verification, sandbox boundary enforcement, and secret scanning.",
                json.dumps(["crypto_verify", "static_analysis", "sandbox_isolate"]),
                json.dumps({"can_kill_processes": True}),
                "AUTONOMOUS",
                "AVAILABLE",
                json.dumps({"provider": "anthropic", "model": "claude-3-5-haiku"}),
                json.dumps(
                    {"tasks_completed": 76, "accuracy_score": 0.995, "tokens_consumed": 61000}
                ),
            ),
        ]

        for a in agents_data:
            cur.execute(
                """
                INSERT OR REPLACE INTO agents (
                    id, company_id, role_id, department_id, name, identity, system_instructions,
                    capabilities, permissions, autonomy, status, intelligence_config, performance_metadata,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
            """,
                a,
            )

        # 4. Strategic Projects
        proj_core = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{company_id}-proj-core"))
        proj_scale = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{company_id}-proj-scale"))

        cur.execute(
            """
            INSERT OR REPLACE INTO projects (id, company_id, owner_id, name, objective, priority, status, milestones, created_at, updated_at)
            VALUES
                (?, ?, ?, 'Cockpit OS 3.0 Modernization', 'Deliver seamless zero-sidebar slide-over command experience with Nothing OS aesthetics', 'CRITICAL', 'ACTIVE', '["Phase 1 Layout", "Phase 2 Swarm Canvas", "Phase 3 Drawers"]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
                (?, ?, ?, 'Autonomous Agent Runtime Sandbox', 'Implement cgroup compute isolation and per-agent token burn limits', 'HIGH', 'ACTIVE', '["Kernel namespaces", "Rate limiters", "Audit ledger"]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
        """,
            (proj_core, company_id, user_id, proj_scale, company_id, user_id),
        )

        # 5. Tasks Execution Matrix
        task_1 = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{company_id}-task-1"))
        task_2 = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{company_id}-task-2"))
        task_3 = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{company_id}-task-3"))
        task_4 = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{company_id}-task-4"))

        cur.execute(
            """
            INSERT OR REPLACE INTO tasks (id, project_id, company_id, assigned_agent_id, title, description, priority, status, dependencies, resource_requirements, created_at, updated_at)
            VALUES
                (?, ?, ?, ?, 'Verify Nothing OS 3.0 Capsule Ergonomics', 'Ensure all header pills and bottom dock systems match Nothing OS dot-matrix standards.', 'HIGH', 'IN_PROGRESS', '[]', '{"cpu": 2, "memory_mb": 512}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
                (?, ?, ?, ?, 'Run Cryptographic Verification on Decoupled Drawers', 'Audit ?drawer= URL query routing to ensure zero regressions.', 'MEDIUM', 'COMPLETED', '[]', '{"cpu": 1, "memory_mb": 256}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
                (?, ?, ?, ?, 'Calibrate AI Swarm Canvas Particle Force Vectors', 'Tune floating mesh connection rays and repulsion thresholds for active agents.', 'CRITICAL', 'IN_PROGRESS', '[]', '{"cpu": 4, "memory_mb": 1024}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
                (?, ?, ?, ?, 'Constitutional Boundary Compliance Audit', 'Audit all executive sign-off thresholds before triggering Stage 5 production release.', 'CRITICAL', 'BLOCKED', '[]', '{"cpu": 1, "memory_mb": 256}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
        """,
            (
                task_1,
                proj_core,
                company_id,
                agent_atlas,
                task_2,
                proj_core,
                company_id,
                agent_cipher,
                task_3,
                proj_core,
                company_id,
                agent_orion,
                task_4,
                proj_scale,
                company_id,
                agent_themis,
            ),
        )

        # 6. Governance Approval Requests
        appr_1 = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{company_id}-appr-1"))
        appr_2 = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{company_id}-appr-2"))

        cur.execute(
            """
            INSERT OR REPLACE INTO approval_requests (id, company_id, agent_id, title, action, target, risk_level, proposed_payload, reason, status, created_at, updated_at)
            VALUES
                (?, ?, ?, 'Release Stage 2 AI Swarm Canvas to Production', 'DEPLOY_CANVAS', 'PROD_FRONTEND', 'HIGH', '{"version": "0.3.0", "canvas": "enabled"}', 'Verification passes all tests; requires executive CEO gate before deploying.', 'PENDING', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
                (?, ?, ?, 'Authorize Dedicated Compute Pool Expansion (+16 Cores)', 'RESIZE_POOL', 'CGROUP_WORKFORCE', 'MEDIUM', '{"cores": 16, "monthly_budget_usd": 250}', 'Atlas agent throughput increased 240% due to parallel task decomposition.', 'PENDING', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
        """,
            (appr_1, company_id, agent_atlas, appr_2, company_id, agent_themis),
        )

        # 7. Decisions Ledger Records
        dec_1 = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{company_id}-dec-1"))
        dec_2 = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{company_id}-dec-2"))

        cur.execute(
            """
            INSERT OR REPLACE INTO decisions (id, company_id, title, problem, proposals, evidence, participants, decision, rationale, status, created_at, updated_at)
            VALUES
                (?, ?, 'Adopt Nothing OS 3.0 Cockpit Architecture', 'Legacy sidebar consumed 240px horizontal space and forced disorienting full-page unmounts.', '["Zero-Sidebar + Slide-Over Drawers", "Retain Multi-Page Tabs", "Modal Popups"]', '["Ergonomic testing", "Tauri native window efficiency"]', '["Atlas", "Themis", "Human Operator"]', 'Unanimously approved Zero-Sidebar architecture with Slide-Over Drawers.', 'Provides maximum canvas real estate while keeping all 18 domains immediately accessible.', 'DECIDED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
                (?, ?, 'Decouple Synthetic Mock Data into SQLite Production DB Seed', 'Testing requires rich operational data without polluting production runtime components with mock fixtures.', '["Seed real DB", "Hardcode in React state"]', '["NEIMAN Rule 5 Compliance"]', '["Human Operator", "Architect"]', 'Seed production.db with isolated, realistic operational records.', 'Guarantees backend truth and zero hardcoded frontend mocks.', 'DECIDED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
        """,
            (dec_1, company_id, dec_2, company_id),
        )

    conn.commit()
    conn.close()
    print(f"[✓] Operational database mock seed completed for {db_path}.")


def seed():
    for db in DB_PATHS:
        seed_db(db)


if __name__ == "__main__":
    seed()
