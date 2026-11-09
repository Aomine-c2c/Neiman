# Project Readiness Assessment Framework

## Overview
A structured evaluation framework to determine whether a project has all necessary preconditions met before entering execution phase. Each dimension includes diagnostic questions, scoring criteria, and evidence requirements.

---

## 1. Resource Availability

### 1.1 Human Resources
| Criterion | Diagnostic Questions | Evidence Required | Score (1-5) |
|-----------|---------------------|-------------------|-------------|
| **Team Composition** | Are all required roles filled (PM, architects, developers, QA, DevOps)? | Org chart, role assignments | |
| **Skill Coverage** | Does the team have required skills (language, framework, domain)? | Skills matrix, certifications | |
| **Capacity Allocation** | What % FTE is each person allocated? Is it sufficient? | Resource calendar, allocation % | |
| **Key Person Risk** | Are any critical roles single-point-of-failure? | Bus factor analysis | |
| **Onboarding Status** | Are new team members ramped up? | Onboarding completion records | |

### 1.2 Infrastructure & Tools
| Criterion | Diagnostic Questions | Evidence Required | Score (1-5) |
|-----------|---------------------|-------------------|-------------|
| **Dev Environments** | Are local/dev/staging/prod environments provisioned? | Environment inventory | |
| **CI/CD Pipeline** | Is automated build/test/deploy configured? | Pipeline definition, test runs | |
| **Monitoring/Observability** | Are logging, metrics, tracing, alerting in place? | Dashboard screenshots, alert rules | |
| **Version Control** | Is branching strategy defined and enforced? | Branch protection rules | |
| **Collaboration Tools** | Are issue tracking, wiki, comms tools configured? | Tool access verification | |

### 1.3 External Dependencies
| Criterion | Diagnostic Questions | Evidence Required | Score (1-5) |
|-----------|---------------------|-------------------|-------------|
| **Third-party APIs** | Are API keys, contracts, SLAs secured? | Contracts, key vault | |
| **Vendor Services** | Are cloud accounts, support tiers active? | Account access, invoices | |
| **Data Access** | Is required data accessible with proper permissions? | Data catalog, IAM policies | |

---

## 2. Stakeholder Alignment

### 2.1 Executive Sponsorship
| Criterion | Diagnostic Questions | Evidence Required | Score (1-5) |
|-----------|---------------------|-------------------|-------------|
| **Sponsor Identified** | Is there a named executive sponsor with authority? | Sponsor charter | |
| **Active Engagement** | Has sponsor attended kickoff? Regular check-ins scheduled? | Meeting minutes, calendar | |
| **Decision Authority** | Can sponsor unblock cross-team dependencies? | Escalation path documented | |
| **Budget Authority** | Does sponsor control budget or have direct line? | Budget approval chain | |

### 2.2 Business Stakeholders
| Criterion | Diagnostic Questions | Evidence Required | Score (1-5) |
|-----------|---------------------|-------------------|-------------|
| **Product Owner** | Is a dedicated PO assigned with backlog authority? | PO assignment letter | |
| **SME Availability** | Are subject matter experts committed for discovery? | SME commitment letters | |
| **User Access** | Can team access real users for validation? | User research plan | |
| **Requirement Sign-off** | Are requirements baselined and signed off? | Signed requirements doc | |

### 2.3 Cross-functional Alignment
| Criterion | Diagnostic Questions | Evidence Required | Score (1-5) |
|-----------|---------------------|-------------------|-------------|
| **Legal/Compliance** | Has legal reviewed data, contracts, regulatory needs? | Legal sign-off | |
| **Security/Privacy** | Has security architecture review completed? | Threat model, DPIA | |
| **Ops/SRE** | Is operational handoff plan defined? | Runbooks, on-call schedule | |
| **Architecture Review** | Has technical design been reviewed by architects? | ADR records | |

---

## 3. Technical Feasibility

### 3.1 Architecture & Design
| Criterion | Diagnostic Questions | Evidence Required | Score (1-5) |
|-----------|---------------------|-------------------|-------------|
| **Architecture Documented** | Is there a current architecture decision record (ADR)? | ADR repository | |
| **Technical Spikes Done** | Have high-risk technical unknowns been validated? | Spike outcomes, POCs | |
| **Scalability Plan** | Does design meet projected load (10x growth)? | Load test results, capacity model | |
| **Integration Points** | Are all internal/external interfaces specified? | API contracts, sequence diagrams | |
| **Data Model Finalized** | Is schema stable with migration strategy? | ER diagrams, migration scripts | |

### 3.2 Technology Choices
| Criterion | Diagnostic Questions | Evidence Required | Score (1-5) |
|-----------|---------------------|-------------------|-------------|
| **Stack Justified** | Are language/framework choices documented with rationale? | Tech selection matrix | |
| **Dependency Currency** | Are all dependencies on supported versions? | Dependency audit (Dependabot) | |
| **License Compliance** | Are all licenses compatible with distribution model? | License scan report | |
| **Vendor Lock-in Risk** | Is there an exit strategy for key dependencies? | Portability assessment | |

### 3.3 Non-functional Requirements
| Criterion | Diagnostic Questions | Evidence Required | Score (1-5) |
|-----------|---------------------|-------------------|-------------|
| **Performance Targets** | Are latency, throughput, availability targets defined? | SLA/SLO document | |
| **Security Requirements** | Are authZ/authN, encryption, audit requirements defined? | Security requirements spec | |
| **Accessibility** | Is WCAG 2.1 AA compliance required/verified? | Accessibility audit | |
| **Disaster Recovery** | Are RPO/RTO defined and tested? | DR runbook, test results | |

---

## 4. Budget Sufficiency

### 4.1 Cost Estimation
| Criterion | Diagnostic Questions | Evidence Required | Score (1-5) |
|-----------|---------------------|-------------------|-------------|
| **Bottom-up Estimate** | Is estimate based on task-level breakdown? | WBS with estimates | |
| **Contingency Buffer** | Is 15-25% contingency included for uncertainty? | Budget with contingency line | |
| **Historical Calibration** | Does estimate align with similar past projects? | Historical actuals comparison | |
| **TCO Considered** | Does budget include Year 2+ ops, maintenance, licenses? | 3-year TCO model | |

### 4.2 Funding Status
| Criterion | Diagnostic Questions | Evidence Required | Score (1-5) |
|-----------|---------------------|-------------------|-------------|
| **Funding Committed** | Is full budget approved and accessible? | PO/budget code | |
| **Phased Funding** | Are gates defined for incremental funding? | Funding release criteria | |
| **Cost Tracking** | Is there a mechanism for monthly burn tracking? | Financial dashboard | |

### 4.3 ROI/Value Case
| Criterion | Diagnostic Questions | Evidence Required | Score (1-5) |
|-----------|---------------------|-------------------|-------------|
| **Business Case** | Is NPV/IRR/payback calculated with realistic assumptions? | Financial model | |
| **Success Metrics** | Are leading/lagging KPIs defined for value tracking? | KPI dashboard design | |
| **Benefits Realization** | Is there a plan to measure post-launch value? | Benefits realization plan | |

---

## 5. Risk Assessment

### 5.1 Risk Identification
| Criterion | Diagnostic Questions | Evidence Required | Score (1-5) |
|-----------|---------------------|-------------------|-------------|
| **Risk Register** | Are ≥15 risks identified across all categories? | Risk register (probability × impact) | |
| **Risk Categories Covered** | Technical, schedule, budget, stakeholder, operational, legal? | Categorized risk register | |
| **Black Swan Considered** | Are low-probability/high-impact scenarios documented? | Scenario analysis | |

### 5.2 Risk Mitigation
| Criterion | Diagnostic Questions | Evidence Required | Score (1-5) |
|-----------|---------------------|-------------------|-------------|
| **Mitigation Plans** | Does each High/Critical risk have owner, action, deadline? | Mitigation action items | |
| **Contingency Triggers** | Are early warning indicators defined for each risk? | Leading indicators dashboard | |
| **Risk Review Cadence** | Is weekly/biweekly risk review scheduled? | Calendar invites, agenda template | |

### 5.3 Assumption Validation
| Criterion | Diagnostic Questions | Evidence Required | Score (1-5) |
|-----------|---------------------|-------------------|-------------|
| **Assumptions Logged** | Are all project assumptions explicit and testable? | Assumptions log | |
| **Validation Plan** | Is there a plan to validate/disprove each assumption? | Validation experiments | |
| **Assumption Gates** | Are go/no-go checkpoints tied to assumption validation? | Gate criteria document | |

---

## 6. Data Readiness

### 6.1 Data Availability & Access
| Criterion | Diagnostic Questions | Evidence Required | Score (1-5) |
|-----------|---------------------|-------------------|-------------|
| **Source Systems Identified** | Are all required data sources cataloged with owners? | Data source inventory | |
| **Access Permissions** | Does team have read/write access to required datasets? | IAM policies, access tickets | |
| **Data Freshness** | Are SLAs for data freshness defined and met? | SLA documents, monitoring | |
| **Schema Stability** | Are source schemas stable or versioned with deprecation policy? | Schema registry, changelog | |

### 6.2 Data Quality
| Criterion | Diagnostic Questions | Evidence Required | Score (1-5) |
|-----------|---------------------|-------------------|-------------|
| **Quality Metrics Defined** | Are completeness, accuracy, consistency, timeliness metrics defined? | Data quality scorecard | |
| **Quality Baseline Measured** | Has current state been profiled against metrics? | Profiling report (Great Expectations, etc.) | |
| **Quality Gates** | Are automated quality checks in CI/CD pipeline? | Pipeline quality stage | |
| **Remediation Process** | Is there a process for data quality incidents? | Incident runbook | |

### 6.3 Data Governance & Compliance
| Criterion | Diagnostic Questions | Evidence Required | Score (1-5) |
|-----------|---------------------|-------------------|-------------|
| **Data Classification** | Is data classified (PII, sensitive, public) with handling rules? | Classification matrix | |
| **Retention/Deletion Policy** | Are retention schedules defined and automated? | Policy document, automation | |
| **Lineage Tracking** | Is end-to-end lineage available for audit/debug? | Lineage graph (OpenLineage) | |
| **Regulatory Alignment** | Does data handling meet GDPR, HIPAA, CCPA as applicable? | DPIA, compliance attestation | |

### 6.4 Data Migration & Integration Readiness
| Criterion | Diagnostic Questions | Evidence Required | Score (1-5) |
|-----------|---------------------|-------------------|-------------|
| **Migration Strategy** | Is migration approach defined (big bang, phased, parallel)? | Migration plan | |
| **Validation Criteria** | Are reconciliation rules defined for migration verification? | Validation test cases | |
| **Rollback Plan** | Is there a tested rollback procedure? | Rollback runbook, test results | |
| **Integration Contracts** | Are API/data contracts with downstream consumers versioned? | Contract registry | |

---

## 7. Timeline Viability

### 6.1 Schedule Realism
| Criterion | Diagnostic Questions | Evidence Required | Score (1-5) |
|-----------|---------------------|-------------------|-------------|
| **Critical Path Identified** | Is the longest dependency chain mapped? | Network diagram / Gantt | |
| **Buffer Allocated** | Are feeding buffers and project buffer included? | Schedule with buffers | |
| **Resource Leveling** | Are resource conflicts resolved in schedule? | Resource histogram | |
| **Historical Comparison** | Does duration match similar completed projects? | Analogous project data | |

### 6.2 Milestone Definition
| Criterion | Diagnostic Questions | Evidence Required | Score (1-5) |
|-----------|---------------------|-------------------|-------------|
| **Milestones SMART** | Specific, Measurable, Achievable, Relevant, Time-bound? | Milestone register | |
| **Go/No-Go Gates** | Are phase gates defined with objective criteria? | Gate criteria checklist | |
| **External Dependencies** | Are vendor/delivery dates confirmed in writing? | Vendor commitment letters | |

### 7.3 Change Management
| Criterion | Diagnostic Questions | Evidence Required | Score (1-5) |
|-----------|---------------------|-------------------|-------------|
| **Change Control Process** | Is there a defined process for scope/schedule changes? | Change request template | |
| **Impact Assessment** | Does process require schedule/budget impact analysis? | Impact assessment template | |
| **Approval Authority** | Is change approval authority matrix defined? | RACI for changes | |

---

## 8. Definition of Ready (DoR) - Project Level

### Pre-Execution Gate Checklist
The project may ONLY proceed to execution when ALL of the following are ✅:

| # | Gate | Owner | Status | Evidence Link |
|---|------|-------|--------|---------------|
| 1 | Team fully staffed with required skills | PM | ☐ | |
| 2 | All dev/staging/prod environments provisioned | DevOps | ☐ | |
| 3 | CI/CD pipeline passing with quality gates | Tech Lead | ☐ | |
| 4 | Executive sponsor engaged and unblocking | Sponsor | ☐ | |
| 5 | Product Owner assigned with authority | Product | ☐ | |
| 6 | Requirements baselined and signed off | PO/PM | ☐ | |
| 7 | Architecture reviewed and approved | Architect | ☐ | |
| 8 | Security/Privacy review completed | Security | ☐ | |
| 9 | Budget fully committed with contingency | Finance | ☐ | |
| 10 | Risk register complete with mitigations | PM | ☐ | |
| 11 | Schedule baselined with buffers | PM | ☐ | |
| 12 | Go/No-Go criteria defined for each phase | PM/Sponsor | ☐ | |
| 13 | Legal/Compliance sign-off obtained | Legal | ☐ | |
| 14 | **Data sources cataloged, access granted, quality baselined** | Data Eng | ☐ | |
| 15 | **Data governance (classification, retention, lineage) operational** | Data Gov | ☐ | |
| 16 | Disaster recovery plan tested (RPO/RTO validated per §3.3) | SRE | ☐ | |
| 17 | Team has completed onboarding/ramp-up | PM | ☐ | |

---

## 9. Scoring & Decision Matrix

### Dimension Weighting
| Dimension | Weight | Minimum Score to Proceed |
|-----------|--------|-------------------------|
| Resource Availability | 18% | 3.5/5 |
| Stakeholder Alignment | 18% | 3.5/5 |
| Technical Feasibility | 18% | 3.5/5 |
| Budget Sufficiency | 13% | 3.5/5 |
| Risk Assessment | 13% | 3.5/5 |
| Timeline Viability | 8% | 3.0/5 |
| Data Readiness | 12% | 3.5/5 |
| **Weighted Total** | **100%** | **3.5/5** |

### Go/No-Go Decision Rules
| Condition | Decision |
|-----------|----------|
| Weighted total ≥ 4.0 AND all minimums met | **GO** - Proceed to execution |
| Weighted total 3.5-3.9 AND all minimums met | **CONDITIONAL GO** - Address gaps in sprint 0 |
| Any minimum NOT met | **NO-GO** - Do not proceed until resolved |
| Weighted total < 3.5 | **NO-GO** - Fundamental re-planning required |

### Quantitative Scoring Anchors (for calibration)
| Score | Definition |
|-------|------------|
| 5 — Exemplary | All criteria exceeded; evidence exceeds requirements; zero gaps |
| 4 — Strong | All criteria met; evidence complete; minor gaps with clear remediation |
| 3 — Adequate | ≥70% criteria met; evidence sufficient; gaps identified with owners/dates |
| 2 — Marginal | 40-69% criteria met; evidence incomplete; significant gaps |
| 1 — Insufficient | <40% criteria met; evidence missing; critical gaps blocking execution |

---

## 10. Assessment Execution Process

### Phase 1: Preparation (Week -2 to -1)
- [ ] Assemble assessment team (PM, Tech Lead, Product, Finance, Security)
- [ ] Distribute framework and evidence checklist to owners
- [ ] Schedule 1:1 evidence review sessions

### Phase 2: Evidence Collection (Week -1)
- [ ] Each owner provides evidence for their criteria
- [ ] Assessment team reviews evidence, scores independently
- [ ] Discrepancies resolved via calibration meeting

### Phase 3: Consolidation & Decision (Day 0)
- [ ] Calculate weighted scores
- [ ] Identify all NO-GO items
- [ ] Present to sponsor for Go/No-Go decision
- [ ] Document decision with rationale

### Phase 4: Gap Remediation (If Conditional Go)
- [ ] Create remediation backlog with owners/dates
- [ ] Define sprint 0 objectives for gap closure
- [ ] Re-assess at sprint 0 review

---

## 11. Templates & Artifacts

### 10.1 Risk Register Template
| ID | Risk Description | Category | Probability (1-5) | Impact (1-5) | Score | Owner | Mitigation | Trigger | Status |
|----|------------------|----------|-------------------|--------------|-------|-------|------------|---------|--------|

### 10.2 Assumptions Log Template
| ID | Assumption | Owner | Validation Method | Target Date | Status | Outcome |
|----|------------|-------|-------------------|-------------|--------|---------|

### 10.3 Milestone Register Template
| ID | Milestone | Description | Target Date | Gate Criteria | Dependencies | Owner | Status |
|----|-----------|-------------|-------------|---------------|--------------|-------|--------|

### 10.4 Decision Log Template
| Date | Decision | Options Considered | Rationale | Decision Maker | Impact |
|------|----------|-------------------|-----------|----------------|--------|

---

## 12. Continuous Readiness Monitoring

### Weekly Health Checks During Execution
| Metric | Green | Yellow | Red | Action |
|--------|-------|--------|-----|--------|
| Schedule Variance | < 5% | 5-15% | > 15% | Re-plan |
| Budget Variance | < 5% | 5-15% | > 15% | Re-forecast |
| Risk Exposure Trend | Decreasing | Stable | Increasing | Escalate |
| Team Capacity | > 90% | 70-90% | < 70% | Adjust scope |
| Stakeholder Engagement | High | Medium | Low | Re-engage |
| Technical Debt Ratio | < 5% | 5-15% | > 15% | Allocate refactor |

---

## 13. References & Standards

- PMBOK 7th Edition - Project Performance Domains
- PRINCE2 - Starting Up a Project Process
- ISO 31000 - Risk Management
- CMMI - Project Planning (PP) & Project Monitoring (PMC)
- DoD 5000.02 - Milestone Decision Authority
- NASA NPR 7123.1 - Systems Engineering Readiness

---

*Document Version: 1.1 | Last Updated: 2026-10-15 | Next Review: Per project initiation*

---

## 14. Self-Critique: Gaps, Errors & Improvements

### 13.1 Structural Gaps

| # | Gap | Severity | Impact | Status |
|---|-----|----------|--------|--------|
| 1 | **No industry/context adaptation** — Framework assumes generic software project; no guidance for hardware, regulated, ML, or infrastructure projects | HIGH | Misapplied criteria lead to false GO/NO-GO | OPEN |
| 2 | **No organizational maturity model** — Doesn't account for startup vs enterprise vs government context | MEDIUM | Over/under-engineering for context | OPEN |
| 3 | **Missing Agile/SAFe integration** — No mapping to Definition of Ready (DoR) at team level or PI planning gates | MEDIUM | Disconnect from delivery methodology | OPEN |
| 4 | **No portfolio/program view** — Single-project focus ignores resource contention across portfolio | HIGH | False confidence when shared resources overcommitted | OPEN |
| 5 | **No quantitative scoring rubric** — "Score 1-5" is subjective without anchor definitions | HIGH | Inter-rater reliability < 0.6 expected | **FIXED** (added §8 anchors) |

### 13.2 Content Errors & Flaws

| # | Error | Location | Correction | Status |
|---|-------|----------|------------|--------|
| 1 | **Weighted total minimum (3.6) < Stakeholder minimum (4.0)** — Mathematically impossible to pass if Stakeholder=4.0 but others=3.5 (0.2×3.5+0.2×4.0+0.2×3.5+0.15×3.5+0.15×3.5+0.1×3.0 = 3.575 < 3.6) | §8 Dimension Weighting | Fix: Lower Stakeholder min to 3.5, adjust weights, set weighted min to 3.5 | **FIXED** |
| 2 | **§6.1 "Buffer Allocated" references feeding buffers but framework has no CCPM methodology** | §6.1 (now §7.1) | Add CCPM reference or remove feeding buffer requirement | OPEN |
| 3 | **§5.1 "≥15 risks" arbitrary threshold** — No justification for number | §5.1 | Replace with "risks covering all categories with ≥2 per category" | OPEN |
| 4 | **§4.1 "15-25% contingency" contradicts §4.2 "Phased Funding" gates** | §4.1, §4.2 | Clarify contingency is for execution phase only | OPEN |
| 5 | **§7 Gate 14 "DR plan tested" but §3.3 only requires "RPO/RTO defined and tested"** | §3.3, §7 | Align: Gate 14 should reference §3.3 evidence | **FIXED** (Gate 16 now references §3.3) |
| 6 | **§11 "Technical Debt Ratio < 5%" has no measurement method defined** | §11 | Add: "Measured via SonarQube/CodeClimate ratio" | OPEN |
| 7 | **§9 Phase 2 "Evidence Collection (Week -1)" unrealistic for complex projects** | §9 | Make duration configurable: "Week -2 to Week 0" | OPEN |

### 13.3 Missing Critical Dimensions

| # | Missing Dimension | Why Critical | Status |
|---|-------------------|--------------|--------|
| 1 | **Data Readiness** — Data quality, lineage, governance, migration readiness | #1 cause of ML/analytics project failure | **FIXED** (added §6) |

### 13.4 Missing Diagnostic Depth (unchanged)

| Area | What's Missing |
|------|----------------|
| **Technical Feasibility** | No spike/POC validation criteria; no architectural fitness function; no chaos engineering readiness |
| **Risk Assessment** | No risk appetite statement; no risk aggregation methodology; no Monte Carlo schedule risk |
| **Budget** | No cash flow projection; no foreign exchange risk; no capital vs opex split |
| **Timeline** | No critical chain analysis; no resource histogram visualization; no learning curve modeling |
| **Stakeholders** | No RACI maturity assessment; no communication plan quality criteria; no conflict resolution mechanism |
| **Resources** | No skills gap quantification; no contractor vs FTE cost model; no knowledge retention risk |

### 13.5 Usability & Implementation Flaws (unchanged)

| # | Flaw | Recommendation |
|---|------|----------------|
| 1 | **No tooling support** — Purely manual spreadsheet/process | Provide: Excel template, Jira/Confluence automation, API for CI/CD integration |
| 2 | **No calibration guidance** — How to align scores across assessors | Add: Calibration workshop script, anchor examples for each 1-5 score |
| 3 | **No executive summary template** — Decision makers need 1-page view | Add: 1-page dashboard with traffic lights per dimension |
| 4 | **No version control for assessment** — Framework evolves, assessments don't | Add: Assessment versioning, baseline comparison, audit trail |
| 5 | **No integration with project management tools** — Jira, Azure DevOps, Asana, MS Project | Add: Webhook/API specs for automatic evidence collection |
| 6 | **No retrospective mechanism** — Post-project: how accurate was readiness prediction? | Add: Post-mortem template comparing predicted vs actual gaps |

### 13.6 Specific Advancements to Implement (Updated)

#### Priority 1: Immediate Fixes (Week 1) — **COMPLETED**
1. ✅ **Fix mathematical inconsistency** in §8 weighting vs minimums
2. ✅ **Add quantitative scoring anchors** (e.g., "3 = 70% of criteria met with minor gaps")
3. ✅ **Align Gate 16 with §3.3** DR evidence requirement
4. ✅ **Add "Data Readiness" as 7th dimension** (weight 12%, reduce Timeline to 8%)

#### Priority 2: Enhanced Depth (Week 2-3)
5. **Add OCM dimension** with ADKAR-based diagnostic questions
6. **Add Compliance dimension** with regulatory mapping table
7. **Create Excel/Google Sheets template** with conditional formatting
8. **Add calibration workshop facilitator guide**
9. **Create executive 1-page dashboard template**
10. **Add Monte Carlo schedule risk to Timeline dimension**

#### Priority 3: Tooling & Automation (Month 1-2)
11. **Build Jira/Confluence integration** for automatic evidence linking
12. **Create GitHub Action** for CI/CD readiness checks
13. **Add API specification** for programmatic assessment submission
14. **Build historical database** for calibration against past project outcomes
15. **Add ML-based risk predictor** using historical project data

#### Priority 4: Advanced Maturity (Quarter 1)
16. **Develop maturity model** (Level 1-5) for organizational readiness capability
17. **Create industry-specific variants** (FinTech, HealthTech, GovCloud, ML/AI)
18. **Add portfolio-level resource contention analyzer**
19. **Integrate with financial planning tools** (Adaptive Insights, Anaplan)
20. **Build real-time readiness dashboard** with webhook updates
20. **Publish as open-source framework** with community governance

### 13.7 Quality Metrics for Framework Itself

| Metric | Current State | Target |
|--------|---------------|--------|
| Inter-rater reliability (Cohen's κ) | **Improved with anchors** (estimated 0.65) | ≥ 0.8 |
| False GO rate (projects that failed despite GO) | Unknown | < 10% |
| False NO-GO rate (projects that succeeded despite NO-GO) | Unknown | < 20% |
| Assessment duration | 1 week (estimated) | < 3 days with tooling |
| Stakeholder satisfaction | Not measured | ≥ 4.5/5 |
| Framework adoption rate | 0 (new) | 80% of new projects |

---

## 15. Revised Action Plan

| Phase | Focus | Deliverables |
|-------|-------|--------------|
| **Phase 0** (Week 1) | Critical fixes | ✅ Corrected weighting, ✅ Scoring anchors, ✅ Gate alignment, ✅ Data Readiness dimension |
| **Phase 1** (Week 2-3) | Missing dimensions | OCM, Compliance, Vendor, IP, Sustainability, Exit dimensions |
| **Phase 2** (Week 4-6) | Tooling | Excel template, calibration guide, executive dashboard, Jira integration spec |
| **Phase 3** (Month 2-3) | Automation | GitHub Action, API spec, historical database, ML predictor |
| **Phase 4** (Quarter 1) | Maturity | Industry variants, portfolio analyzer, maturity model, open-source release |

---

*Self-critique updated: 2026-10-15 | Next framework revision: 2026-10-29*