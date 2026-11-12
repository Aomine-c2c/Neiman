# RESPONSIBILITIES of the DevOps & Infrastructure Lead

**Position Key:** `devops_infrastructure_lead`  
**Direct Reports:** Site Reliability Engineers, Release Engineers  
**Supervisor:** `cto`

---

## 1. Inputs & Information Flows
- **Build Candidates:** Approved pull requests and release tags from the Engineering Lead.
- **Verification Sign-Offs:** Passing test suite certifications from the QA Lead.
- **Security Policies:** Container hardening standards and egress rules from the Security Lead.
- **Telemetry Feeds:** CPU, memory, database connection pool, and request latency metrics.

## 2. Outputs & Tangible Deliverables
- **Production-Ready Artifacts:** Minified Docker containers, standalone Next.js bundles, and Tauri desktop executables.
- **CI/CD Automation Pipelines:** Working GitHub Actions / Makefile deployment recipes.
- **SLO & SRE Dashboards:** Real-time uptime, error budget, and latency monitoring dashboards.
- **Automated Backup Archives:** Encrypted, verified PostgreSQL and vector memory database snapshots.

## 3. Core Operational Duties
- Monitor system health continuously and respond to availability alerts within 5 minutes.
- Verify that daily automated database backups execute and pass test restoration checks.
- Maintain deployment environments with zero unmanaged configuration drift.

## 4. Escalation & Intervention Triggers
- **Escalate to CTO:** Staging or production availability dropping below 99.9%.
- **Escalate to CEO:** Production deployment requiring Level-2 executive sign-off.
- **Intervene Immediately:** Container memory saturation (>90%) or cascading thread deadlocks.
