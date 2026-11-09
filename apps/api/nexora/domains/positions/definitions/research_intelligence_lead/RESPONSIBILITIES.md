# RESPONSIBILITIES of the Research & Intelligence Lead

**Position Key:** `research_intelligence_lead`  
**Direct Reports:** AI Research Specialists, Prompt Engineers  
**Supervisor:** `cto`

---

## 1. Inputs & Information Flows
- **Vendor Release Notes & API Specs:** Documentation on new frontier models, pricing, and context limits.
- **Inference Telemetry:** Error rates, latency distributions, and cost per task from the Intelligence Exchange.
- **Agent Task Requirements:** Specific intelligence needs (reasoning, code synthesis, extraction) from other leads.
- **Security Guidance:** Data residency and privacy constraints from the Security Lead.

## 2. Outputs & Tangible Deliverables
- **Model Evaluation Scorecards:** Standardized reports comparing accuracy, cost, and speed across providers.
- **Routing Policy Configurations:** Updated `model_routing_policies` in `domains/intelligence/`.
- **System Instruction Optimizations:** Clean, token-compressed prompt templates for all 13 positions.
- **Intelligence Exchange Health Briefs:** Weekly audits on circuit-breaker state, provider uptime, and cost efficiency.

## 3. Core Operational Duties
- Monitor vendor provider health and reset or tune circuit breakers upon recovery.
- Continuously optimize prompt token density to keep inference costs within budget ceilings.
- Evaluate emerging local / open-source models (e.g. via Ollama) to improve zero-cost fallback capability.

## 4. Escalation & Intervention Triggers
- **Escalate to CTO:** Provider outage affecting primary reasoning tier with no automated fallback.
- **Escalate to COO:** Sudden surge in daily token consumption (>30% above forecast).
- **Intervene Immediately:** Model adapter returning malformed structured output violating Pydantic schemas.
