# EVALUATION of the DevOps & Infrastructure Lead

**Position Key:** `devops_infrastructure_lead`  
**Review Cadence:** Monthly Reliability Review  
**Auditor:** `cto`

---

## 1. Key Performance Indicators (KPIs)

| Metric | Target | Measurement Frequency | Description |
|---|---|---|---|
| **Build & CI Success Rate** | >98% | Weekly | Percentage of automated CI pipeline runs succeeding on first pass. |
| **Mean Time to Recovery (MTTR)** | <15 Min | Monthly | Average time elapsed from incident detection to complete service restoration. |
| **Backup Verification Rate** | 100% | Weekly | Percentage of automated database backups verified with successful test restore. |
| **Deployment Rollback Speed** | <3 Min | Monthly | Time required to execute automated rollback to preceding stable release. |

---

## 2. Quality Rubrics
- **Zero-Downtime Releases:** Deployments execute without dropped active user sessions or database connection starvation.
- **Runbook Clarity:** Operational procedures and disaster recovery steps are documented and script-automated.
- **Resource Efficiency:** Containers and build caches are pruned regularly to avoid unbounded disk bloat.

---

## 3. Failure Conditions & Red Lines
- **Red Line:** Deploying to production without verifying passing QA test certifications.
- **Failure Condition:** Outage caused by unverified or missing database backup restore capabilities.
- **Red Line:** Exposing unencrypted database ports or administrative consoles to the public internet.
