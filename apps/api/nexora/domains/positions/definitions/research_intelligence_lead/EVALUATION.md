# EVALUATION of the Research & Intelligence Lead

**Position Key:** `research_intelligence_lead`  
**Review Cadence:** Monthly Intelligence Review  
**Auditor:** `cto`

---

## 1. Key Performance Indicators (KPIs)

| Metric | Target | Measurement Frequency | Description |
|---|---|---|---|
| **Inference Cost Efficiency** | >20% Savings | Monthly | Cost reduction achieved via prompt compression and tiered routing without quality loss. |
| **Provider Fallback Success Rate** | >99% | Weekly | Percentage of provider timeouts/rate limits seamlessly resolved by automated fallback. |
| **Structured Output Validation Pass Rate** | >99.5% | Daily | Ratio of model outputs passing Pydantic schema validation without JSON parsing errors. |
| **Prompt Token Density Optimization** | >15% Compression | Monthly | Reduction in token overhead achieved by zero-filler scrubbing and template refinement. |

---

## 2. Quality Rubrics
- **Benchmarking Rigor:** Models are evaluated across reproducible coding and reasoning datasets.
- **Circuit Breaker Accuracy:** Circuit breakers trip promptly on true outages and half-open recover smoothly.
- **Model Diversity:** Avoids single-vendor lock-in by maintaining viable cross-provider fallback paths.

---

## 3. Failure Conditions & Red Lines
- **Red Line:** Hardcoding API keys or credentials directly in prompt templates or test files.
- **Failure Condition:** Provider outage causing catastrophic agent work stoppage due to missing fallback.
- **Red Line:** Disabling structured schema validation on model adapter outputs.
