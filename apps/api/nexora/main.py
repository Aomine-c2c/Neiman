"""
NEIMAN API — Main Application Entry Point.

Wires together all domain routers, middleware, and lifecycle events.
"""

import asyncio
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

import nexora.domains.activity.models  # noqa: F401
import nexora.domains.agents.models  # noqa: F401

# Import all models so Alembic/SQLAlchemy can discover them
import nexora.domains.auth.models  # noqa: F401
import nexora.domains.blueprints.models  # noqa: F401
import nexora.domains.councils.models  # noqa: F401
import nexora.domains.decisions.models  # noqa: F401
import nexora.domains.governance.models  # noqa: F401
import nexora.domains.intelligence.evolution_models  # noqa: F401
import nexora.domains.intelligence.models  # noqa: F401
import nexora.domains.jobs.models  # noqa: F401
import nexora.domains.memory.models  # noqa: F401
import nexora.domains.organizations.models  # noqa: F401
import nexora.domains.policies.models  # noqa: F401
import nexora.domains.projects.models  # noqa: F401
import nexora.domains.resources.models  # noqa: F401
import nexora.domains.workflows.models  # noqa: F401
from nexora.config import get_settings
from nexora.database import get_session_factory
from nexora.domains.activity.router import router as activity_router
from nexora.domains.agents.cto_router import router as cto_router
from nexora.domains.agents.external_agents_router import router as external_agents_router
from nexora.domains.agents.router import router as agent_router

# Domain routers
from nexora.domains.auth.router import router as auth_router
from nexora.domains.blueprints.router import router as blueprint_router
from nexora.domains.councils.router import router as council_router
from nexora.domains.decisions.router import router as decision_router
from nexora.domains.delivery.router import router as delivery_router
from nexora.domains.governance.router import router as governance_router
from nexora.domains.intelligence.evolution_router import router as evolution_router
from nexora.domains.intelligence.router import router as intelligence_router
from nexora.domains.jobs.router import router as jobs_router
from nexora.domains.jobs.service import DurableWorkerLoop
from nexora.domains.memory.router import router as memory_router
from nexora.domains.orchestration.router import router as orchestration_router
from nexora.domains.organizations.router import router as org_router
from nexora.domains.policies.router import router as policy_router
from nexora.domains.positions.router import router as positions_router
from nexora.domains.projects.router import router as project_router
from nexora.domains.resources.router import router as resource_router
from nexora.domains.system.harvester_router import router as harvester_router
from nexora.domains.system.mcp_router import router as mcp_router
from nexora.domains.system.runtime_router import router as runtime_router
from nexora.domains.terminal.router import router as terminal_router
from nexora.domains.skills.router import router as skills_router
from nexora.domains.system.router import router as system_router
from nexora.domains.vcs.router import router as vcs_router
from nexora.domains.workflows.router import router as workflow_router
from nexora.exceptions import register_exception_handlers
from nexora.middleware import RateLimitMiddleware, RequestIDMiddleware, SecurityHeadersMiddleware

settings = get_settings()
logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle."""
    logger.info("NEIMAN_startup", environment=settings.ENVIRONMENT, version=settings.APP_VERSION)
    from nexora.database import get_db_context
    from nexora.domains.agents.supervisor import start_all_supervisors, stop_all_supervisors
    from nexora.domains.intelligence.service import IntelligenceService

    try:
        async with get_db_context() as session:
            intel_svc = IntelligenceService(session)
            count = await intel_svc.seed_default_providers_if_empty()
            await session.commit()
            logger.info("NEIMAN_providers_seeded", configured_count=count)
    except Exception as exc:
        logger.warning("Provider auto-seed warning on boot: %s", exc)

    # Company records are created only by an explicit operator action.
    # Continuous supervisors remain paused until an operator presses Play.
    await start_all_supervisors()

    # 5-hour Token Regeneration & Depleted Model Verification Loop
    async def _token_regeneration_loop():
        import asyncio

        from nexora.domains.intelligence.rotation import ModelDepletionTracker

        while True:
            try:
                await asyncio.sleep(18000)  # 5 hours
                depleted = ModelDepletionTracker.get_depleted_models_status()
                logger.info("NEIMAN_token_regeneration_probe", active_depleted_count=len(depleted))
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.warning("Token regeneration probe error: %s", e)

    regen_task = asyncio.create_task(_token_regeneration_loop())

    # Background Codebase Knowledge Graph Pre-Indexing Task
    async def _preindex_codebase_knowledge_graph():
        import asyncio
        from nexora.domains.memory.code_graph import CodebaseKnowledgeGraphEngine

        try:
            await asyncio.sleep(0.2)
            logger.info("NEIMAN_codebase_preindexing_start")
            engine = CodebaseKnowledgeGraphEngine()
            _idx, summary = await asyncio.to_thread(
                engine.get_or_build_index, force_refresh=True, sync_vector=True
            )
            logger.info(
                "NEIMAN_codebase_preindexed",
                indexed_files=summary.indexed_files,
                total_symbols=summary.total_symbols,
                total_dependencies=summary.total_dependencies,
                duration_ms=summary.duration_ms,
            )
        except Exception as e:
            logger.warning("Codebase knowledge graph preindexing warning: %s", e)

    preindex_task = asyncio.create_task(_preindex_codebase_knowledge_graph())

    import os

    worker_loop: DurableWorkerLoop | None = None
    if not os.environ.get("PYTEST_CURRENT_TEST") and settings.ENVIRONMENT != "test":
        worker_loop = DurableWorkerLoop()
        worker_loop.start()

    try:
        yield
    finally:
        if worker_loop is not None:
            await worker_loop.stop()
        regen_task.cancel()
        preindex_task.cancel()
        try:
            await regen_task
        except asyncio.CancelledError:
            pass
        try:
            await preindex_task
        except asyncio.CancelledError:
            pass
        await stop_all_supervisors()
        logger.info("NEIMAN_shutdown")


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description=(
            "NEIMAN — Autonomous Organization OS\n\n"
            "The AI-native platform for organizational intelligence and automation."
        ),
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )

    # ── Middleware ─────────────────────────────────────────────────────────
    app.add_middleware(RequestIDMiddleware)
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    )
    app.add_middleware(RateLimitMiddleware, path_prefixes=["/api/v1/auth/"])

    # ── Exception Handlers ─────────────────────────────────────────────────
    register_exception_handlers(app)

    # ── API Routes ─────────────────────────────────────────────────────────
    API_PREFIX = "/api/v1"

    app.include_router(auth_router, prefix=API_PREFIX)
    app.include_router(org_router, prefix=API_PREFIX)
    app.include_router(agent_router, prefix=API_PREFIX)
    app.include_router(cto_router, prefix=API_PREFIX)
    app.include_router(external_agents_router, prefix=API_PREFIX)
    app.include_router(project_router, prefix=API_PREFIX)
    app.include_router(workflow_router, prefix=API_PREFIX)
    app.include_router(policy_router, prefix=API_PREFIX)
    app.include_router(decision_router, prefix=API_PREFIX)
    app.include_router(intelligence_router, prefix=API_PREFIX)
    app.include_router(resource_router, prefix=API_PREFIX)
    app.include_router(memory_router, prefix=API_PREFIX)
    app.include_router(governance_router, prefix=API_PREFIX)
    app.include_router(blueprint_router, prefix=API_PREFIX)
    app.include_router(council_router, prefix=API_PREFIX)
    app.include_router(evolution_router, prefix=API_PREFIX)
    app.include_router(activity_router, prefix=API_PREFIX)
    app.include_router(system_router, prefix=API_PREFIX)
    app.include_router(mcp_router, prefix=API_PREFIX)
    app.include_router(runtime_router, prefix=API_PREFIX)
    app.include_router(terminal_router, prefix=API_PREFIX)
    app.include_router(skills_router, prefix=API_PREFIX)
    app.include_router(harvester_router, prefix=API_PREFIX)
    app.include_router(positions_router, prefix=API_PREFIX)
    app.include_router(orchestration_router, prefix=API_PREFIX)
    app.include_router(delivery_router, prefix=API_PREFIX)
    app.include_router(vcs_router, prefix=API_PREFIX)
    app.include_router(jobs_router, prefix=API_PREFIX)

    # ── UI Route ───────────────────────────────────────────────────────────
    from pathlib import Path

    from fastapi.responses import FileResponse
    from fastapi.staticfiles import StaticFiles

    static_dir = Path(__file__).parent / "static"
    if static_dir.exists():
        app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

        @app.get("/ui/agents", tags=["UI"], summary="Agent Profile Inspector UI")
        async def agent_profile_ui():
            return FileResponse(static_dir / "agent_profile.html")

        @app.get("/ui/intelligence", tags=["UI"], summary="Intelligence Exchange Dashboard UI")
        async def intelligence_dashboard_ui():
            return FileResponse(static_dir / "intelligence_dashboard.html")

        @app.get("/ui/resources", tags=["UI"], summary="Resource Control Center UI")
        async def resource_control_center_ui():
            return FileResponse(static_dir / "resource_control_center.html")

        @app.get("/ui/memory", tags=["UI"], summary="Organizational Knowledge & Memory UI")
        async def memory_ui():
            return FileResponse(static_dir / "organizational_memory.html")

        @app.get(
            "/ui/governance", tags=["UI"], summary="Organizational Governance & Audit Viewer UI"
        )
        async def governance_ui():
            return FileResponse(static_dir / "governance_dashboard.html")

        @app.get("/ui/blueprints", tags=["UI"], summary="Company Blueprints & Build My Company UI")
        async def blueprints_ui():
            return FileResponse(static_dir / "company_blueprints.html")

        @app.get(
            "/ui/workflows",
            tags=["UI"],
            summary="NEIMAN Workflow Observability & Execution Engine UI",
        )
        async def workflows_ui():
            return FileResponse(static_dir / "workflow_dashboard.html")

        @app.get("/ui/councils", tags=["UI"], summary="Agent Council & Deliberation UI")
        async def councils_ui():
            return FileResponse(static_dir / "council_deliberation.html")

    # ── Health Check ───────────────────────────────────────────────────────
    async def _check_redis_status() -> str:
        """Probe optional Redis TCP connectivity without failing embedded deployments."""
        import asyncio
        import urllib.parse

        if not settings.REDIS_URL or settings.REDIS_URL == "none":
            return "not_configured"
        try:
            redis_url = urllib.parse.urlparse(settings.REDIS_URL)
            host = redis_url.hostname or "localhost"
            port = redis_url.port or 6379
            _, writer = await asyncio.wait_for(
                asyncio.open_connection(host, port), timeout=1.0
            )
            writer.close()
            await writer.wait_closed()
            return "ok"
        except Exception:
            logger.warning("NEIMAN_health_check_degraded", component="redis")
            return "optional (offline)"

    @app.get("/livez", tags=["System"], summary="Process liveness probe")
    @app.get("/health/live", tags=["System"], summary="Kubernetes liveness probe")
    async def liveness_probe():
        """Report that the API process can serve requests; no external dependency checks."""
        return {"status": "ok", "service": settings.APP_NAME, "version": settings.APP_VERSION}

    @app.get("/readyz", tags=["System"], summary="Dependency readiness probe")
    @app.get("/health/ready", tags=["System"], summary="Kubernetes readiness probe")
    async def readiness_probe():
        """Return 503 until the required SQL database accepts a lightweight query."""
        from sqlalchemy import text

        try:
            async with get_session_factory()() as session:
                await session.execute(text("SELECT 1"))
        except Exception:
            logger.exception("NEIMAN_readiness_failed", component="database")
            raise HTTPException(status_code=503, detail="Service dependencies are unavailable")
        return {
            "status": "ok",
            "service": settings.APP_NAME,
            "components": {"database": "ok", "redis": await _check_redis_status()},
        }

    @app.get("/health", tags=["System"], summary="Detailed health check")
    async def health():
        from fastapi.responses import JSONResponse
        from sqlalchemy import text

        components: dict[str, str] = {}

        # Database check
        try:
            async with get_session_factory()() as session:
                await session.execute(text("SELECT 1"))
                components["database"] = "ok"
        except Exception:
            logger.exception("NEIMAN_health_check_failed", component="database")
            components["database"] = "error"

        components["redis"] = await _check_redis_status()

        overall = "ok" if components.get("database") == "ok" else "error"

        payload = {
            "status": overall,
            "service": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "environment": settings.ENVIRONMENT,
            "auth_disabled": settings.DISABLE_AUTH,
            "components": components,
        }
        return JSONResponse(payload, status_code=200 if overall == "ok" else 503)

    @app.get("/api/v1", tags=["System"], summary="API v1 root info")
    @app.get("/api/v1/", tags=["System"], include_in_schema=False)
    async def api_v1_root():
        return {
            "status": "ok",
            "api_version": "v1",
            "service": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "docs": "/api/docs",
            "health": "/api/v1/health",
        }

    @app.get("/api/v1/health", tags=["System"], summary="API v1 health check")
    async def api_v1_health():
        return await health()

    @app.get("/", include_in_schema=False)
    async def root():
        return {"message": "NEIMAN API", "docs": "/api/docs", "ui": "/ui/agents"}

    return app


app = create_app()
