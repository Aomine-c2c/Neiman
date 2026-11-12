"""
Cryptographic utilities for NEIMAN OS.
Provides key encryption and decryption for provider API keys using Fernet and machine secret salt.
Supports key rotation and input length boundary validation.
"""

import base64
import hashlib
import logging

from cryptography.fernet import Fernet, InvalidToken

from nexora.config import get_settings

logger = logging.getLogger(__name__)

# Max plain secret length (64 KB) to avoid memory or buffer abuse
MAX_SECRET_LENGTH = 65536


def _derive_fernet_key(secret_key: str, salt: str) -> bytes:
    """Derive a stable 32-byte url-safe base64-encoded key from secret + salt."""
    key_material = f"{secret_key}:{salt}".encode()
    derived = hashlib.sha256(key_material).digest()
    return base64.urlsafe_b64encode(derived)


def _get_fernet_instances() -> list[Fernet]:
    """
    Returns active Fernet instance, followed by legacy/fallback key instances
    for zero-downtime key rotation. Never caches across settings changes.
    """
    settings = get_settings()
    current_key = _derive_fernet_key(settings.SECRET_KEY, settings.AUDIT_SECRET_SALT)
    instances = [Fernet(current_key)]

    # If key rotation is configured via environment / fallback secrets
    fallback_secrets = getattr(settings, "FALLBACK_SECRET_KEYS", None) or []
    for old_secret in fallback_secrets:
        old_key = _derive_fernet_key(old_secret, settings.AUDIT_SECRET_SALT)
        instances.append(Fernet(old_key))

    return instances


def encrypt_secret(plain_text: str | None) -> str | None:
    """
    Encrypt a secret string into a Fernet ciphertext.
    Validates input length boundaries.
    """
    if not plain_text or not plain_text.strip():
        return None

    clean = plain_text.strip()
    if len(clean) > MAX_SECRET_LENGTH:
        raise ValueError(
            f"Secret input exceeds maximum allowable size of {MAX_SECRET_LENGTH} characters."
        )

    cipher = _get_fernet_instances()[0]
    return cipher.encrypt(clean.encode("utf-8")).decode("utf-8")


def decrypt_secret(cipher_text: str | None) -> str | None:
    """
    Decrypt a Fernet ciphertext back to plaintext secret.
    Attempts primary key, then fallback keys in rotation chain.
    If decryption fails, raises an error or returns None rather than leaking raw ciphertext.
    """
    if not cipher_text or not cipher_text.strip():
        return None

    clean = cipher_text.strip()
    instances = _get_fernet_instances()

    for cipher in instances:
        try:
            return cipher.decrypt(clean.encode("utf-8")).decode("utf-8")
        except (InvalidToken, Exception):
            continue

    logger.warning("Decryption failure: Invalid token or mismatched encryption key.")
    return None


def mask_secret(secret: str | None) -> str | None:
    """Return only a configured marker; never reveal any credential characters."""
    return "••••••••" if secret else None
