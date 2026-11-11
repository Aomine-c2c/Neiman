# SKILLS of the Research & Intelligence Lead

**Domain:** Multi-Model Orchestration, Benchmarking & Prompt Optimization

---

## 1. Heterogeneous Model Benchmarking & Evaluation
- Measuring reasoning accuracy, code generation correctness, and structured JSON fidelity across 20+ vendors.
- Profiling time-to-first-token (TTFT), token generation throughput (tokens/sec), and tail latency.
- Benchmarking embedding models for semantic code search and retrieval-augmented generation (RAG).

## 2. Dynamic Intelligence Routing Topology Design
- Designing four-tier fallback hierarchies: Primary Model → Same-Provider Tier Alternate → Cross-Vendor Alternate → Local Degraded.
- Configuring adaptive circuit breakers based on consecutive 429/500/timeout error rates.
- Implementing cost-aware dynamic routing based on task complexity classification.

## 3. Prompt Engineering & Token Compression
- Designing versioned system instructions with clear role markers (`[SOUL_SPECIFICATION]`, `[SKILLS_SPECIFICATION]`).
- Implementing zero-filler token scrubbers that eliminate conversational padding without losing technical fidelity.
- Structuring few-shot examples and output schemas for deterministic JSON extraction.
