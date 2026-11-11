"""
System Configuration API.
Provides read/write access to local .env provider keys for the settings UI.
Only available in local (non-production) deployments.
"""

import asyncio
import os
import re
import shutil
import sqlite3
import tempfile
from datetime import UTC
from pathlib import Path

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from nexora.config import get_settings
from nexora.database import get_db
from nexora.domains.auth.models import User
from nexora.domains.auth.router import get_current_user

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/system", tags=["System Configuration"])

# Absolute paths for API directory and Repository root
_ROUTER_PATH = Path(__file__).resolve()
_API_DIR = _ROUTER_PATH.parents[3]
_REPO_DIR = _ROUTER_PATH.parents[5]

# Path to the API .env file
_ENV_FILE = _API_DIR / ".env"

_ALLOWED_KEYS = {
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "GEMINI_API_KEY",
    "GROQ_API_KEY",
    "OPENROUTER_API_KEY",
    "MISTRAL_API_KEY",
    "DEEPSEEK_API_KEY",
    "CEREBRAS_API_KEY",
    "TOGETHER_AI_API_KEY",
    "COHERE_API_KEY",
    "XAI_API_KEY",
    "KILO_API_KEY",
    "KILOCODE_API_KEY",
    "META_API_KEY",
    "OLLAMA_API_KEY",
    "OLLAMA_HOST",
    "XIAOMIMIMO_API_KEY",
    "MIMO_API_KEY",
    "XIAOMI_MIMO_API_KEY",
    "MINIMAX_API_KEY",
    "UPSTAGE_API_KEY",
    "ARCEE_API_KEY",
    "POOLSIDE_API_KEY",
}


class ProviderKeyUpdate(BaseModel):
    openai_api_key: str | None = None
    anthropic_api_key: str | None = None
    gemini_api_key: str | None = None
    groq_api_key: str | None = None
    openrouter_api_key: str | None = None
    mistral_api_key: str | None = None
    deepseek_api_key: str | None = None
    cerebras_api_key: str | None = None
    together_ai_api_key: str | None = None
    cohere_api_key: str | None = None
    xai_api_key: str | None = None
    kilo_api_key: str | None = None
    meta_api_key: str | None = None
    ollama_api_key: str | None = None
    ollama_host: str | None = None
    xiaomimimo_api_key: str | None = None
    minimax_api_key: str | None = None
    upstage_api_key: str | None = None
    arcee_api_key: str | None = None
    poolside_api_key: str | None = None


class SetupResetRequest(BaseModel):
    confirmation: str


class ProviderKeyStatus(BaseModel):
    openai_configured: bool
    anthropic_configured: bool
    gemini_configured: bool
    groq_configured: bool = False
    openrouter_configured: bool = False
    mistral_configured: bool = False
    deepseek_configured: bool = False
    cerebras_configured: bool = False
    together_ai_configured: bool = False
    cohere_configured: bool = False
    xai_configured: bool = False
    kilo_configured: bool = False
    meta_configured: bool = False
    ollama_configured: bool = False
    ollama_host: str = ""
    xiaomimimo_configured: bool = False
    minimax_configured: bool = False
    upstage_configured: bool = False
    arcee_configured: bool = False
    poolside_configured: bool = False
    openai_fingerprint: str | None = None
    anthropic_fingerprint: str | None = None
    gemini_fingerprint: str | None = None
    groq_fingerprint: str | None = None
    openrouter_fingerprint: str | None = None
    mistral_fingerprint: str | None = None
    deepseek_fingerprint: str | None = None
    cerebras_fingerprint: str | None = None
    together_ai_fingerprint: str | None = None
    cohere_fingerprint: str | None = None
    xai_fingerprint: str | None = None
    kilo_fingerprint: str | None = None
    meta_fingerprint: str | None = None
    ollama_fingerprint: str | None = None
    xiaomimimo_fingerprint: str | None = None
    minimax_fingerprint: str | None = None
    upstage_fingerprint: str | None = None
    arcee_fingerprint: str | None = None
    poolside_fingerprint: str | None = None


def _mask_key(key: str) -> str:
    """Return a non-reversible configured marker; never reveal credential fragments."""
    return "Configured — hidden" if key else ""


def _read_env() -> dict[str, str]:
    """Read current .env into a key-value dict."""
    result: dict[str, str] = {}
    if not _ENV_FILE.exists():
        return result
    if _ENV_FILE.is_symlink():
        raise HTTPException(status_code=500, detail="Refusing to read a symlinked environment file")
    os.chmod(_ENV_FILE, 0o600)
    for line in _ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        result[k.strip()] = v.strip()
    return result


def _backup_sqlite_database(source_path: Path, backup_path: Path) -> None:
    """Write an atomic, integrity-checked SQLite backup with owner-only permissions."""
    temporary_path = backup_path.with_name(f".{backup_path.name}.tmp")
    try:
        with (
            sqlite3.connect(source_path, timeout=10) as source,
            sqlite3.connect(temporary_path, timeout=10) as destination,
        ):
            source.backup(destination)
            integrity = destination.execute("PRAGMA integrity_check").fetchone()
            if not integrity or integrity[0] != "ok":
                raise sqlite3.DatabaseError("SQLite backup integrity check did not return ok")
        os.chmod(temporary_path, 0o600)
        os.replace(temporary_path, backup_path)
    except Exception:
        try:
            temporary_path.unlink(missing_ok=True)
        except OSError as cleanup_exc:
            logger.error(
                "setup_reset_temporary_backup_cleanup_failed",
                path=str(temporary_path),
                error=str(cleanup_exc),
            )
        raise


def _write_env_key(key: str, value: str) -> None:
    """Atomically update a single allowed credential with owner-only file access."""
    if key not in _ALLOWED_KEYS:
        raise ValueError("Unsupported provider setting")
    if "\n" in value or "\r" in value or "\x00" in value:
        raise HTTPException(status_code=422, detail="Provider values must be single-line text")
    if _ENV_FILE.is_symlink():
        raise HTTPException(status_code=500, detail="Refusing to write a symlinked environment file")

    content = _ENV_FILE.read_text(encoding="utf-8") if _ENV_FILE.exists() else ""
    pattern = re.compile(rf"^{re.escape(key)}=.*$", re.MULTILINE)
    replacement = f"{key}={value}"
    if pattern.search(content):
        content = pattern.sub(lambda _match: replacement, content)
    else:
        content = content.rstrip("\n") + f"\n{replacement}\n"

    temp_path: str | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", dir=_API_DIR, prefix=".env.", delete=False
        ) as temp_file:
            temp_path = temp_file.name
            os.chmod(temp_path, 0o600)
            temp_file.write(content)
            temp_file.flush()
            os.fsync(temp_file.fileno())
        os.replace(temp_path, _ENV_FILE)
        os.chmod(_ENV_FILE, 0o600)
    finally:
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)


def _require_local(current_user: User):
    """Guard: only allow local system configuration in development mode."""
    settings = get_settings()
    if not settings.is_development and settings.ENVIRONMENT != "desktop":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="System config API is only available in local development or desktop mode.",
        )
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="System administration requires a platform administrator account.",
        )


@router.get("/provider-keys", response_model=ProviderKeyStatus)
async def get_provider_keys(current_user: User = Depends(get_current_user)):
    """Return current provider key status (masked — no plaintext exposure)."""
    _require_local(current_user)
    env = _read_env()

    openai = env.get("OPENAI_API_KEY", "")
    anthropic = env.get("ANTHROPIC_API_KEY", "")
    gemini = env.get("GEMINI_API_KEY", "")
    groq = env.get("GROQ_API_KEY", "")
    openrouter = env.get("OPENROUTER_API_KEY", "")
    mistral = env.get("MISTRAL_API_KEY", "")
    deepseek = env.get("DEEPSEEK_API_KEY", "")
    cerebras = env.get("CEREBRAS_API_KEY", "")
    together_ai = env.get("TOGETHER_AI_API_KEY", "")
    cohere = env.get("COHERE_API_KEY", "")
    xai = env.get("XAI_API_KEY", "")
    kilo = env.get("KILO_API_KEY") or env.get("KILOCODE_API_KEY", "")
    meta = env.get("META_API_KEY") or env.get("META_MUSE_API_KEY", "")
    ollama_key = env.get("OLLAMA_API_KEY", "")
    ollama = env.get("OLLAMA_HOST", "")
    xiaomimimo = env.get("XIAOMIMIMO_API_KEY") or env.get("MIMO_API_KEY") or env.get("XIAOMI_MIMO_API_KEY", "")
    minimax = env.get("MINIMAX_API_KEY", "")
    upstage = env.get("UPSTAGE_API_KEY", "")
    arcee = env.get("ARCEE_API_KEY", "")
    poolside = env.get("POOLSIDE_API_KEY", "")

    return ProviderKeyStatus(
        openai_configured=bool(openai),
        anthropic_configured=bool(anthropic),
        gemini_configured=bool(gemini),
        groq_configured=bool(groq),
        openrouter_configured=bool(openrouter),
        mistral_configured=bool(mistral),
        deepseek_configured=bool(deepseek),
        cerebras_configured=bool(cerebras),
        together_ai_configured=bool(together_ai),
        cohere_configured=bool(cohere),
        xai_configured=bool(xai),
        kilo_configured=bool(kilo),
        meta_configured=bool(meta),
        ollama_configured=bool(ollama_key),
        ollama_host=ollama,
        xiaomimimo_configured=bool(xiaomimimo),
        minimax_configured=bool(minimax),
        upstage_configured=bool(upstage),
        arcee_configured=bool(arcee),
        poolside_configured=bool(poolside),
        openai_fingerprint=_mask_key(openai) if openai else None,
        anthropic_fingerprint=_mask_key(anthropic) if anthropic else None,
        gemini_fingerprint=_mask_key(gemini) if gemini else None,
        groq_fingerprint=_mask_key(groq) if groq else None,
        openrouter_fingerprint=_mask_key(openrouter) if openrouter else None,
        mistral_fingerprint=_mask_key(mistral) if mistral else None,
        deepseek_fingerprint=_mask_key(deepseek) if deepseek else None,
        cerebras_fingerprint=_mask_key(cerebras) if cerebras else None,
        together_ai_fingerprint=_mask_key(together_ai) if together_ai else None,
        cohere_fingerprint=_mask_key(cohere) if cohere else None,
        xai_fingerprint=_mask_key(xai) if xai else None,
        kilo_fingerprint=_mask_key(kilo) if kilo else None,
        meta_fingerprint=_mask_key(meta) if meta else None,
        ollama_fingerprint=_mask_key(ollama_key) if ollama_key else None,
        xiaomimimo_fingerprint=_mask_key(xiaomimimo) if xiaomimimo else None,
        minimax_fingerprint=_mask_key(minimax) if minimax else None,
        upstage_fingerprint=_mask_key(upstage) if upstage else None,
        arcee_fingerprint=_mask_key(arcee) if arcee else None,
        poolside_fingerprint=_mask_key(poolside) if poolside else None,
    )


@router.patch("/provider-keys", response_model=ProviderKeyStatus)
async def update_provider_keys(
    body: ProviderKeyUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save provider API keys to the local .env file, os.environ, and database vault."""
    _require_local(current_user)

    updates: dict[str, str] = {}
    if body.openai_api_key is not None:
        updates["OPENAI_API_KEY"] = body.openai_api_key
    if body.anthropic_api_key is not None:
        updates["ANTHROPIC_API_KEY"] = body.anthropic_api_key
    if body.gemini_api_key is not None:
        updates["GEMINI_API_KEY"] = body.gemini_api_key
    if body.groq_api_key is not None:
        updates["GROQ_API_KEY"] = body.groq_api_key
    if body.openrouter_api_key is not None:
        updates["OPENROUTER_API_KEY"] = body.openrouter_api_key
    if body.mistral_api_key is not None:
        updates["MISTRAL_API_KEY"] = body.mistral_api_key
    if body.deepseek_api_key is not None:
        updates["DEEPSEEK_API_KEY"] = body.deepseek_api_key
    if body.cerebras_api_key is not None:
        updates["CEREBRAS_API_KEY"] = body.cerebras_api_key
    if body.together_ai_api_key is not None:
        updates["TOGETHER_AI_API_KEY"] = body.together_ai_api_key
    if body.cohere_api_key is not None:
        updates["COHERE_API_KEY"] = body.cohere_api_key
    if body.xai_api_key is not None:
        updates["XAI_API_KEY"] = body.xai_api_key
    if body.kilo_api_key is not None:
        updates["KILO_API_KEY"] = body.kilo_api_key
    if body.meta_api_key is not None:
        updates["META_API_KEY"] = body.meta_api_key
    if body.ollama_api_key is not None:
        updates["OLLAMA_API_KEY"] = body.ollama_api_key
    if body.ollama_host is not None:
        updates["OLLAMA_HOST"] = body.ollama_host
    if body.xiaomimimo_api_key is not None:
        updates["XIAOMIMIMO_API_KEY"] = body.xiaomimimo_api_key
    if body.minimax_api_key is not None:
        updates["MINIMAX_API_KEY"] = body.minimax_api_key
    if body.upstage_api_key is not None:
        updates["UPSTAGE_API_KEY"] = body.upstage_api_key
    if body.arcee_api_key is not None:
        updates["ARCEE_API_KEY"] = body.arcee_api_key
    if body.poolside_api_key is not None:
        updates["POOLSIDE_API_KEY"] = body.poolside_api_key

    for key, value in updates.items():
        _write_env_key(key, value)
        os.environ[key] = value
        logger.info("provider_key_updated", key=key, configured=bool(value))

    # Synchronize database ModelProvider entries if matching providers exist
    from sqlalchemy import select

    from nexora.core.crypto import encrypt_secret
    from nexora.domains.intelligence.models import ModelProvider

    provider_map = {
        "OPENAI_API_KEY": ("openai", True),
        "ANTHROPIC_API_KEY": ("anthropic", True),
        "GEMINI_API_KEY": ("google_gemini", True),
        "GROQ_API_KEY": ("groq", True),
        "OPENROUTER_API_KEY": ("openrouter", True),
        "MISTRAL_API_KEY": ("mistral", True),
        "DEEPSEEK_API_KEY": ("deepseek", True),
        "CEREBRAS_API_KEY": ("cerebras", True),
        "TOGETHER_AI_API_KEY": ("together_ai", True),
        "COHERE_API_KEY": ("cohere", True),
        "XAI_API_KEY": ("xai", True),
        "KILO_API_KEY": ("kilocode", True),
        "KILOCODE_API_KEY": ("kilocode", True),
        "META_API_KEY": ("meta_muse", True),
        "META_MUSE_API_KEY": ("meta_muse", True),
        "OLLAMA_API_KEY": ("ollama", True),
        "XIAOMIMIMO_API_KEY": ("xiaomimimo", True),
        "MIMO_API_KEY": ("xiaomimimo", True),
        "XIAOMI_MIMO_API_KEY": ("xiaomimimo", True),
        "MINIMAX_API_KEY": ("minimax", True),
        "UPSTAGE_API_KEY": ("upstage", True),
        "ARCEE_API_KEY": ("arcee", True),
        "POOLSIDE_API_KEY": ("poolside", True),
    }

    for env_key, val in updates.items():
        mapping = provider_map.get(env_key)
        if not mapping:
            continue
        prov_name, is_api_key = mapping
        q = select(ModelProvider).where(ModelProvider.name == prov_name)
        res = await db.execute(q)
        prov = res.scalars().first()
        if prov:
            if is_api_key:
                clean_val = val.strip() or None
                prov.api_key_encrypted = encrypt_secret(clean_val) if clean_val else None
                prov.is_configured = bool(prov.api_key_encrypted)
                prov.is_healthy = prov.is_configured
            else:
                clean_url = val.strip() or None
                prov.base_url = clean_url
                prov.is_configured = bool(clean_url)
                prov.is_healthy = prov.is_configured
            prov.consecutive_failures = 0

    await db.flush()

    # Clear the settings cache so the new keys are picked up on next request
    get_settings.cache_clear()

    return await get_provider_keys(current_user)


@router.get("/health-extended")
async def health_extended(current_user: User = Depends(get_current_user)):
    """Deep health check including provider connectivity status."""
    _require_local(current_user)
    env = _read_env()
    settings = get_settings()

    providers: dict[str, dict] = {}

    # OpenAI
    openai_key = env.get("OPENAI_API_KEY", "")
    providers["openai"] = {
        "configured": bool(openai_key),
        "status": "ready" if openai_key else "not_configured",
    }

    # Anthropic
    anthropic_key = env.get("ANTHROPIC_API_KEY", "")
    providers["anthropic"] = {
        "configured": bool(anthropic_key),
        "status": "ready" if anthropic_key else "not_configured",
    }

    # Gemini
    gemini_key = env.get("GEMINI_API_KEY", "")
    providers["gemini"] = {
        "configured": bool(gemini_key),
        "status": "ready" if gemini_key else "not_configured",
    }

    # Cloud Suite Providers
    for prov_name, env_var in [
        ("groq", "GROQ_API_KEY"),
        ("openrouter", "OPENROUTER_API_KEY"),
        ("mistral", "MISTRAL_API_KEY"),
        ("deepseek", "DEEPSEEK_API_KEY"),
        ("cerebras", "CEREBRAS_API_KEY"),
        ("together_ai", "TOGETHER_AI_API_KEY"),
        ("cohere", "COHERE_API_KEY"),
        ("xai", "XAI_API_KEY"),
        ("xiaomimimo", "XIAOMIMIMO_API_KEY"),
        ("minimax", "MINIMAX_API_KEY"),
        ("upstage", "UPSTAGE_API_KEY"),
        ("arcee", "ARCEE_API_KEY"),
        ("poolside", "POOLSIDE_API_KEY"),
    ]:
        k = env.get(env_var, "")
        providers[prov_name] = {
            "configured": bool(k),
            "status": "ready" if k else "not_configured",
        }

    # Local Air-Gapped
    providers["local"] = {
        "configured": True,
        "status": "ready",
        "description": "On-premise zero-retention air-gapped execution",
    }

    # Ollama optional connectivity
    ollama_host = env.get("OLLAMA_HOST", "")
    if ollama_host:
        try:
            import httpx

            async with httpx.AsyncClient(timeout=2.0) as client:
                resp = await client.get(f"{ollama_host.rstrip('/')}/api/tags")
                if resp.status_code == 200:
                    models = [m.get("name") for m in resp.json().get("models", [])]
                    providers["ollama"] = {
                        "configured": True,
                        "status": "reachable",
                        "available_models": models,
                    }
                else:
                    providers["ollama"] = {"configured": False, "status": "unreachable"}
        except Exception:
            providers["ollama"] = {"configured": False, "status": "offline"}

    return {
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "auth_disabled": settings.DISABLE_AUTH,
        "providers": providers,
    }


class UpdateStatusResponse(BaseModel):
    version: str
    current_commit: str
    remote_commit: str | None = None
    update_available: bool
    branch: str = "main"
    commits_behind: int = 0
    latest_summary: str | None = None
    last_checked_at: str
    is_updating: bool = False
    check_error: str | None = None


class UpdateProgressResponse(BaseModel):
    is_updating: bool
    stage: str
    stage_index: int
    total_stages: int
    stage_name: str
    progress_percent: int
    log_tail: list[str]
    error: str | None = None
    completed_at: str | None = None


_update_state: dict = {
    "is_updating": False,
    "stage": "IDLE",
    "stage_index": 0,
    "total_stages": 1,
    "stage_name": "Update status not checked",
    "progress_percent": 0,
    "log_tail": [],
    "error": None,
    "completed_at": None,
}


@router.get("/updates/status", response_model=UpdateStatusResponse)
async def get_update_status(current_user: User = Depends(get_current_user)):
    """Compare local HEAD with the already-fetched origin/main reference; no network access."""
    _require_local(current_user)
    import subprocess
    from datetime import datetime

    from nexora.core.security import PromptSanitizer

    def run_git(*args: str) -> str:
        result = subprocess.run(
            ["git", *args],
            cwd=_REPO_DIR,
            text=True,
            capture_output=True,
            timeout=5,
            check=False,
        )
        if result.returncode != 0:
            raise RuntimeError("Could not read the cached Git update reference.")
        return result.stdout.strip()

    settings = get_settings()
    current_commit = "unknown"
    remote_commit = None
    latest_summary = None
    commits_behind = 0
    branch = "unknown"
    check_error = None

    try:
        branch, current_commit = await asyncio.gather(
            asyncio.to_thread(run_git, "branch", "--show-current"),
            asyncio.to_thread(run_git, "rev-parse", "HEAD"),
        )
        remote_commit = await asyncio.to_thread(run_git, "rev-parse", "--verify", "origin/main")
        counts = await asyncio.to_thread(
            run_git, "rev-list", "--left-right", "--count", "HEAD...origin/main"
        )
        ahead_raw, behind_raw = counts.split()
        if not ahead_raw.isdigit() or not behind_raw.isdigit():
            raise RuntimeError("Git returned an invalid ahead/behind count.")
        commits_behind = int(behind_raw)
        if commits_behind:
            latest_summary = await asyncio.to_thread(
                run_git, "log", "-1", "--format=%s", "origin/main"
            )
    except Exception as exc:
        check_error = PromptSanitizer.scrub_secrets(str(exc)) or "Unable to read cached origin/main."

    return UpdateStatusResponse(
        version=settings.APP_VERSION,
        current_commit=current_commit[:7] if len(current_commit) >= 7 else current_commit,
        remote_commit=remote_commit[:7]
        if remote_commit and len(remote_commit) >= 7
        else remote_commit,
        update_available=bool(remote_commit and commits_behind > 0),
        branch=branch,
        commits_behind=commits_behind,
        latest_summary=latest_summary,
        last_checked_at=datetime.now(UTC).isoformat(),
        is_updating=_update_state.get("is_updating", False),
        check_error=check_error,
    )


@router.get("/updates/progress", response_model=UpdateProgressResponse)
async def get_update_progress(current_user: User = Depends(get_current_user)):
    """Return real-time telemetry of the active update pipeline."""
    _require_local(current_user)
    return UpdateProgressResponse(
        is_updating=_update_state.get("is_updating", False),
        stage=_update_state.get("stage", "IDLE"),
        stage_index=_update_state.get("stage_index", 0),
        total_stages=_update_state.get("total_stages", 1),
        stage_name=_update_state.get("stage_name", "Idle"),
        progress_percent=_update_state.get("progress_percent", 0),
        log_tail=_update_state.get("log_tail", [])[-15:],
        error=_update_state.get("error"),
        completed_at=_update_state.get("completed_at"),
    )


async def _execute_update_job():
    from datetime import datetime

    repo_dir = _REPO_DIR
    _update_state["is_updating"] = True
    _update_state["error"] = None
    _update_state["completed_at"] = None
    _update_state["log_tail"] = [
        "Checking already-fetched update references; source files will not be changed."
    ]

    try:
        async def git_output(*args: str) -> str:
            proc = await asyncio.create_subprocess_exec(
                "git",
                *args,
                cwd=str(repo_dir),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.DEVNULL,
            )
            try:
                stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=10)
            except TimeoutError as exc:
                proc.kill()
                await proc.communicate()
                raise RuntimeError("Local Git status check timed out.") from exc
            if proc.returncode != 0:
                raise RuntimeError("Could not read local Git update references.")
            return stdout.decode(errors="replace").strip()

        _update_state.update(
            stage="GIT_CHECK",
            stage_index=1,
            total_stages=1,
            stage_name="Checking local update references",
            progress_percent=25,
        )
        branch = await git_output("branch", "--show-current")
        if branch != "main":
            _update_state.update(
                stage="MANUAL_ACTION_REQUIRED",
                stage_name="Update check requires the main branch",
                progress_percent=100, completed_at=datetime.now(UTC).isoformat(),
            )
            _update_state["log_tail"].append("No checkout or database changes were made.")
            return

        working_tree = await git_output("status", "--porcelain", "--untracked-files=all")
        current = await git_output("rev-parse", "HEAD")
        remote = await git_output("rev-parse", "--verify", "origin/main")
        if current == remote:
            _update_state.update(
                stage="COMPLETE",
                stage_index=1,
                total_stages=1,
                stage_name="Already up to date",
                progress_percent=100,
                completed_at=datetime.now(UTC).isoformat(),
            )
            _update_state["log_tail"].append(
                "No update is available in the fetched origin/main reference."
            )
        else:
            counts = await git_output("rev-list", "--left-right", "--count", "HEAD...origin/main")
            ahead_raw, behind_raw = counts.split()
            if not ahead_raw.isdigit() or not behind_raw.isdigit():
                raise RuntimeError("Git returned an invalid ahead/behind count.")
            if int(behind_raw) == 0:
                _update_state.update(
                    stage="COMPLETE",
                    stage_index=1,
                    total_stages=1,
                    stage_name="No remote update is available",
                    progress_percent=100,
                    completed_at=datetime.now(UTC).isoformat(),
                )
                _update_state["log_tail"].append(
                    "This checkout is at or ahead of the cached origin/main reference."
                )
                return
            _update_state.update(
                stage="MANUAL_ACTION_REQUIRED",
                stage_index=1,
                total_stages=1,
                stage_name="Update available — reviewed deployment required",
                progress_percent=100,
                completed_at=datetime.now(UTC).isoformat(),
            )
            reason = "The working tree has local changes. " if working_tree else ""
            _update_state["log_tail"].append(
                f"{reason}The fetched remote differs from this checkout. No source, database, or build artifacts were changed; apply it through the reviewed deployment process."
            )
    except Exception as exc:
        from nexora.core.security import PromptSanitizer

        safe_error = PromptSanitizer.scrub_secrets(str(exc))
        _update_state["stage"] = "FAILED"
        _update_state["error"] = safe_error
        _update_state["log_tail"].append(f"Update check failed: {safe_error}")
    finally:
        _update_state["is_updating"] = False


@router.post("/updates/trigger")
async def trigger_update(current_user: User = Depends(get_current_user)):
    """Check already-fetched Git refs without changing source or operational data."""
    _require_local(current_user)
    if _update_state.get("is_updating"):
        return {"status": "in_progress", "message": "An update pipeline is already active."}

    _update_state["is_updating"] = True
    asyncio.create_task(_execute_update_job())
    return {"status": "started", "message": "Read-only update check started."}


@router.post("/setup/reset")
async def trigger_setup_reset(
    body: SetupResetRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Overwrites and wipes all operational databases, vector storage, and state.
    Safely archives existing database, runs alembic migrations, and places the system in pristine setup mode.
    """
    _require_local(current_user)
    if body.confirmation != "RESET NEIMAN OPERATIONAL DATA":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Type RESET NEIMAN OPERATIONAL DATA exactly to confirm this destructive action.",
        )
    import asyncio
    from datetime import datetime

    from nexora.database import engine

    data_dir = Path.home() / ".local" / "share" / "neiman"
    data_dir.mkdir(parents=True, exist_ok=True)
    db_file = data_dir / "production.db"
    archived_backup = None
    archived_backups: list[str] = []
    cleanup_warnings: list[str] = []
    api_dir = _API_DIR
    database_files = [db_file, api_dir / "NEIMAN.db", api_dir / "nexora.db"]

    # Back up every database file before deleting any active or legacy operational state.
    stamp = datetime.now(UTC).strftime("%Y%m%d_%H%M%S_%f")
    for source_file in database_files:
        if not source_file.exists():
            continue
        backup_name = f"{source_file.stem}_{stamp}.db.bak"
        backup_file = data_dir / backup_name
        try:
            _backup_sqlite_database(source_file, backup_file)
            archived_backups.append(backup_file.name)
            if source_file == db_file:
                archived_backup = backup_file.name
        except Exception as exc:
            logger.error("setup_reset_backup_failed", database=str(source_file), error=str(exc))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Operational data could not be backed up and was not reset.",
            ) from exc

    # Stop pooled connections only after the consistent online backup has completed.
    try:
        await engine.dispose()
    except Exception as exc:
        logger.error("engine_dispose_failed", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connections could not be safely closed; operational data was not reset.",
        ) from exc

    for source_file in database_files:
        for ext in ["", "-wal", "-shm"]:
            target = Path(f"{source_file}{ext}")
            if target.exists():
                target.unlink()

    # Clean LanceDB vector cache
    for vector_dir in [data_dir / ".vectors_lancedb"]:
        if vector_dir.exists():
            try:
                shutil.rmtree(vector_dir)
            except OSError as exc:
                logger.error("setup_reset_vector_cleanup_failed", path=str(vector_dir), error=str(exc))
                cleanup_warnings.append("Vector memory could not be fully cleared.")

    # Clean webview storage to reset browser-side setup flags
    webview_dir = Path.home() / ".local" / "share" / "org.NEIMAN.desktop" / "localstorage"
    if webview_dir.exists():
        try:
            shutil.rmtree(webview_dir)
        except OSError as exc:
            logger.error("setup_reset_webview_cleanup_failed", path=str(webview_dir), error=str(exc))
            cleanup_warnings.append("Desktop setup state could not be fully cleared.")

    # 4. Signal clean setup protocol required
    try:
        (data_dir / ".setup_required").touch(exist_ok=True)
    except OSError as exc:
        logger.error("setup_reset_marker_failed", path=str(data_dir / ".setup_required"), error=str(exc))
        cleanup_warnings.append("The setup-required marker could not be written.")

    # 5. Apply pristine alembic migrations
    proc = await asyncio.create_subprocess_exec(
        "uv",
        "run",
        "alembic",
        "upgrade",
        "head",
        cwd=str(api_dir),
        env={**os.environ, "DATABASE_URL": f"sqlite+aiosqlite:///{db_file}"},
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()
    if proc.returncode != 0:
        logger.error("setup_alembic_failed", stderr=stderr.decode())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database migration failed: {stderr.decode()}",
        )

    logger.info(
        "setup_reset_completed",
        archived_backup=archived_backup,
        archived_backups=archived_backups,
        warnings=cleanup_warnings,
    )
    return {
        "status": "success" if not cleanup_warnings else "completed_with_warnings",
        "message": "Database reset completed." if not cleanup_warnings else "Database reset completed with cleanup warnings.",
        "archived_backup": archived_backup,
        "archived_backups": archived_backups,
        "warnings": cleanup_warnings,
    }
