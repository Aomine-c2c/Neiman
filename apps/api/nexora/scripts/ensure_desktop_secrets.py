"""Create persistent, private keys for the local desktop runtime."""

from __future__ import annotations

import os
import secrets
import tempfile
from pathlib import Path


def _write_secret(path: Path, value: str) -> None:
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(path.parent, 0o700)
    temp_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", dir=path.parent, prefix=f".{path.name}.", delete=False
        ) as secret_file:
            temp_path = Path(secret_file.name)
            os.chmod(temp_path, 0o600)
            secret_file.write(value)
            secret_file.flush()
            os.fsync(secret_file.fileno())
        os.replace(temp_path, path)
        os.chmod(path, 0o600)
    except OSError:
        if temp_path is not None:
            temp_path.unlink(missing_ok=True)
        raise


def ensure_desktop_secrets(config_home: Path | None = None) -> Path:
    """Create or validate the persistent desktop dotenv file and return its path."""
    root = config_home or Path(os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config"))
    secrets_file = root / "neiman" / "desktop.env"
    names = ("SECRET_KEY", "AUDIT_SECRET_SALT")
    current: dict[str, str] = {}
    if secrets_file.exists():
        if secrets_file.is_symlink() or not secrets_file.is_file():
            raise OSError(f"Desktop secret path is not a regular file: {secrets_file}")
        if secrets_file.stat().st_mode & 0o077:
            os.chmod(secrets_file, 0o600)
        for line in secrets_file.read_text(encoding="utf-8").splitlines():
            key, separator, value = line.partition("=")
            if separator and key in names:
                current[key] = value

    for name in names:
        value = current.get(name, "")
        if len(value) < 64 or any(character not in "0123456789abcdef" for character in value):
            current[name] = secrets.token_hex(32)

    content = "\n".join(f"{name}={current[name]}" for name in names) + "\n"
    _write_secret(secrets_file, content)
    return secrets_file


def main() -> int:
    try:
        ensure_desktop_secrets()
    except (OSError, ValueError) as error:
        raise SystemExit(f"Unable to initialize private desktop credentials: {error}") from error
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
