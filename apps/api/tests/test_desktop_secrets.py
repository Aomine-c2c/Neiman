"""Tests for secure desktop key initialization and desktop-mode configuration."""

from pathlib import Path

import pytest

from nexora.config import Settings
from nexora.scripts.ensure_desktop_secrets import ensure_desktop_secrets


def test_desktop_secret_file_is_private_and_stable(tmp_path: Path) -> None:
    secrets_file = ensure_desktop_secrets(tmp_path)
    first_value = secrets_file.read_text(encoding="utf-8")

    assert secrets_file.parent.stat().st_mode & 0o777 == 0o700
    assert secrets_file.stat().st_mode & 0o777 == 0o600
    assert "SECRET_KEY=" in first_value
    assert "AUDIT_SECRET_SALT=" in first_value
    assert ensure_desktop_secrets(tmp_path) == secrets_file
    assert secrets_file.read_text(encoding="utf-8") == first_value


def test_desktop_mode_accepts_local_sqlite_with_strong_persistent_keys() -> None:
    settings = Settings(
        ENVIRONMENT="desktop",
        DATABASE_URL="sqlite+aiosqlite:////tmp/neiman/production.db",
        SECRET_KEY="a" * 64,
        AUDIT_SECRET_SALT="b" * 64,
        DISABLE_AUTH=False,
    )

    assert settings.is_production is True
    assert settings.is_development is False


def test_desktop_mode_allows_disabled_authentication() -> None:
    settings = Settings(
        ENVIRONMENT="desktop",
        DATABASE_URL="sqlite+aiosqlite:////tmp/neiman/production.db",
        SECRET_KEY="a" * 64,
        AUDIT_SECRET_SALT="b" * 64,
        DISABLE_AUTH=True,
    )

    assert settings.DISABLE_AUTH is True


def test_production_mode_rejects_disabled_authentication() -> None:
    with pytest.raises(ValueError, match="DISABLE_AUTH"):
        Settings(
            ENVIRONMENT="production",
            DATABASE_URL="postgresql+asyncpg://localhost/neiman",
            SECRET_KEY="a" * 64,
            AUDIT_SECRET_SALT="b" * 64,
            DISABLE_AUTH=True,
        )


def test_desktop_settings_load_provider_env_and_prioritize_private_desktop_secrets(
    tmp_path: Path,
) -> None:
    provider_env = tmp_path / "provider.env"
    desktop_env = tmp_path / "desktop.env"
    provider_env.write_text(
        "OPENAI_API_KEY=local-provider-key\nSECRET_KEY=" + "c" * 64 + "\n",
        encoding="utf-8",
    )
    desktop_env.write_text(
        "SECRET_KEY=" + "a" * 64 + "\nAUDIT_SECRET_SALT=" + "b" * 64 + "\n",
        encoding="utf-8",
    )

    settings = Settings(
        _env_file=(provider_env, desktop_env),
        ENVIRONMENT="desktop",
        DATABASE_URL="sqlite+aiosqlite:////tmp/neiman/production.db",
        DISABLE_AUTH=True,
    )

    assert settings.OPENAI_API_KEY == "local-provider-key"
    assert settings.SECRET_KEY == "a" * 64

