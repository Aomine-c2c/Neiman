# Multi-stage build for NEIMAN API
FROM python:3.11-slim as builder

WORKDIR /app

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

# Copy dependency files
COPY pyproject.toml uv.lock ./

# Install dependencies
RUN uv sync --frozen --no-dev --no-install-project

# Production stage
FROM python:3.11-slim as production

RUN apt-get update && apt-get install -y --no-install-recommends bubblewrap \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Create non-root user
RUN groupadd -r NEIMAN && useradd -r -g NEIMAN NEIMAN

# Copy installed dependencies from builder
COPY --from=builder /app/.venv /app/.venv

# Copy application code
COPY nexora/ ./nexora/
COPY alembic/ ./alembic/
COPY alembic.ini ./

# Set ownership
RUN chown -R NEIMAN:NEIMAN /app

# Switch to non-root user
USER NEIMAN

# Add venv to PATH
ENV PATH="/app/.venv/bin:$PATH"

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=5)"]

# Apply schema migrations before serving requests.
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn nexora.main:app --host 0.0.0.0 --port 8000"]
