---
name: docker-containerization
description: Containerizes backend, frontend, and sidecar services using multi-stage non-root OCI-compliant Dockerfiles.
---

# Docker Containerization Skill

## Principles & Guardrails
- **Multi-Stage Builds**: Build dependencies in builder stages; output minimal production runtime distroless or alpine images.
- **Non-Root Execution**: Always declare non-root system users (`USER nonroot:nonroot` or `USER 10001:10001`). Never execute containers as root.
- **Deterministic Dependencies**: Pin exact base image digests (`@sha256:...`) or LTS tags. Never use `:latest`.
- **Secret Hygiene**: Never copy `.env`, secrets, credentials, or local caches into images. Use `.dockerignore` and BuildKit secret mounts (`--mount=type=secret`).

## Standard Python FastAPI Container Template
```dockerfile
# syntax=docker/dockerfile:1.6
FROM python:3.12-slim-bookworm AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends gcc libpq-dev && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

FROM python:3.12-slim-bookworm AS runner
WORKDIR /app
RUN useradd -u 10001 -m neiman
COPY --from=builder /root/.local /home/neiman/.local
COPY . .
USER neiman
ENV PATH="/home/neiman/.local/bin:$PATH"
EXPOSE 8000
CMD ["uvicorn", "nexora.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

