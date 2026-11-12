---
name: memory-leak-detection
description: Process memory profiling, uncollected object tracing, event listener teardown audits, and streaming response leak detection.
---

# Memory Leak Detection Skill

## Remediation Protocol
1. **Node.js / React Leaks**: Audit `useEffect` hooks for uncleaned intervals, event listeners, WebSocket subscriptions, or detached DOM references.
2. **Python Garbage Collection**: Use `tracemalloc` to record object allocations before and after stress tests; identify uncollected circular references.
3. **Streaming Responses**: Ensure chunk iterators (`StreamingResponse`) explicitly release underlying HTTP clients upon client disconnect or exception.

