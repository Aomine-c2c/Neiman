---
name: fastapi-backend-suite
description: High-throughput async FastAPI microservice architecture, Pydantic v2 schemas, dependency injection, and exception filters.
---

# FastAPI Backend Suite Skill

## Core Standards
1. **Asynchronous Execution**: Always declare asynchronous endpoint handlers (`async def`) when calling DB (`await db.execute(...)`) or network resources.
2. **Pydantic v2 Modeling**: Use `model_config = ConfigDict(from_attributes=True, extra='forbid')` for strict validation.
3. **Dependency Injection**: Isolate database sessions, authenticated user contexts, and rate limiters via `Depends(...)`.
4. **Error Payloads**: Raise typed `HTTPException` with structured `detail` dictionaries containing error codes and remediation context.

