"""Application configuration via environment variables."""

import os
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_api_dir = Path(__file__).resolve().parent.parent
_repo_dir = _api_dir.parent.parent
# Project dotenv files are a local-development convenience. Staging and
# production must receive credentials from the process environment so a
# checked-in or copied development .env cannot silently activate provider keys.
_is_development_process = (
    os.environ.get("ENVIRONMENT", "development").strip().lower() == "development"
)
_is_desktop_process = os.environ.get("ENVIRONMENT", "development").strip().lower() == "desktop"
_desktop_secrets_file = (
    Path(os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config"))
    / "neiman"
    / "desktop.env"
)
_env_candidates = (
    (
        str(_api_dir / ".env"),
        str(_repo_dir / ".env"),
        str(Path.cwd() / "apps/api/.env"),
        str(Path.cwd() / ".env"),
        str(Path.home() / ".config/neiman/.env"),
        ".env",
    )
    if _is_development_process
    else (str(_api_dir / ".env"), str(_desktop_secrets_file)) if _is_desktop_process else ()
)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=_env_candidates, extra="ignore")

    # Application
    APP_NAME: str = "NEIMAN API"
    APP_VERSION: str = "1.1.1"
    ENVIRONMENT: Literal["development", "test", "staging", "production", "desktop"] = "development"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./NEIMAN.db"
    TEST_DATABASE_URL: str = "sqlite+aiosqlite:///:memory:"
    DATABASE_POOL_SIZE: int = 10
    DATABASE_MAX_OVERFLOW: int = 20
    DATABASE_POOL_TIMEOUT_SECONDS: int = 30
    DATABASE_POOL_RECYCLE_SECONDS: int = 1800
    VECTOR_DB_PATH: str = "./.vectors_lancedb"

    # Security
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    # Authentication is disabled by default for local operator mode; tests/cloud can opt into auth.
    DISABLE_AUTH: bool = True
    NEIMAN_BOOTSTRAP_ADMIN_PASSWORD: str | None = None
    NEIMAN_BOOTSTRAP_ADMIN_EMAIL: str = "admin@neiman.ai"
    NEIMAN_BOOTSTRAP_ADMIN_USERNAME: str = "admin"
    AUDIT_SECRET_SALT: str = "NEIMAN_audit_cryptographic_anchor_v1"

    # Rate Limiting
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_WINDOW: int = 60

    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ]

    # Redis (optional for MVP)
    REDIS_URL: str = "redis://localhost:6379/0"

    # External Intelligence Provider Keys (Optional: when provided, live adapters activate)
    OPENAI_API_KEY: str | None = None
    OPENAI_BASE_URL: str | None = None
    ANTHROPIC_API_KEY: str | None = None
    ANTHROPIC_BASE_URL: str | None = None
    GEMINI_API_KEY: str | None = None
    GOOGLE_API_KEY: str | None = None
    OLLAMA_HOST: str | None = None
    OLLAMA_API_KEY: str | None = None
    OLLAMA_BASE_URL: str | None = None
    GROQ_API_KEY: str | None = None
    OPENROUTER_API_KEY: str | None = None
    MISTRAL_API_KEY: str | None = None
    DEEPSEEK_API_KEY: str | None = None
    CEREBRAS_API_KEY: str | None = None
    TOGETHER_AI_API_KEY: str | None = None
    COHERE_API_KEY: str | None = None
    XAI_API_KEY: str | None = None
    KILO_API_KEY: str | None = None
    KILOCODE_API_KEY: str | None = None
    META_API_KEY: str | None = None
    META_MUSE_API_KEY: str | None = None
    HUGGINGFACE_API_KEY: str | None = None
    HF_TOKEN: str | None = None
    KIMI_API_KEY: str | None = None
    MOONSHOT_API_KEY: str | None = None
    ZAI_API_KEY: str | None = None
    Z_AI_API_KEY: str | None = None
    ZHIPU_API_KEY: str | None = None
    ZHIPUAI_API_KEY: str | None = None
    ALIBABACLOUD_API_KEY: str | None = None
    ALIBABA_API_KEY: str | None = None
    DASHSCOPE_API_KEY: str | None = None
    QWEN_API_KEY: str | None = None
    POOLSIDE_API_KEY: str | None = None
    ARCEE_API_KEY: str | None = None
    XIAOMIMIMO_API_KEY: str | None = None
    MIMO_API_KEY: str | None = None
    XIAOMI_MIMO_API_KEY: str | None = None
    MINIMAX_API_KEY: str | None = None
    UPSTAGE_API_KEY: str | None = None
    ENABLE_SIMULATION_MODE: bool = False

    @model_validator(mode="after")
    def validate_deployment_security(self) -> "Settings":
        if self.ENVIRONMENT in ("staging", "production", "desktop"):
            if self.DISABLE_AUTH and self.ENVIRONMENT != "desktop":
                raise ValueError("DISABLE_AUTH cannot be enabled outside development")
            if len(self.SECRET_KEY) < 32 or self.SECRET_KEY == "change-me-in-production":
                raise ValueError(
                    "Staging and production require a unique SECRET_KEY of at least 32 characters"
                )
            if self.DEBUG:
                raise ValueError("DEBUG cannot be enabled outside development")
            if self.ENVIRONMENT in ("staging", "production") and self.DATABASE_URL.startswith("sqlite"):
                raise ValueError(
                    "Staging and production require PostgreSQL; SQLite is for local use"
                )
            if (
                len(self.AUDIT_SECRET_SALT) < 32
                or self.AUDIT_SECRET_SALT == "NEIMAN_audit_cryptographic_anchor_v1"
            ):
                raise ValueError(
                    "Staging and production require a unique AUDIT_SECRET_SALT of at least 32 characters"
                )
        if self.DATABASE_POOL_SIZE < 1:
            raise ValueError("DATABASE_POOL_SIZE must be at least 1")
        if self.DATABASE_MAX_OVERFLOW < 0:
            raise ValueError("DATABASE_MAX_OVERFLOW cannot be negative")
        if self.DATABASE_POOL_TIMEOUT_SECONDS < 1 or self.DATABASE_POOL_RECYCLE_SECONDS < 1:
            raise ValueError("Database pool timeout and recycle values must be positive")
        return self

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT in ("production", "desktop")

    @property
    def is_development(self) -> bool:
        return self.ENVIRONMENT == "development"


@lru_cache
def get_settings() -> Settings:
    return Settings()
