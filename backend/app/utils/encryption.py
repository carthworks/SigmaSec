# app/utils/encryption.py
"""
Application-level encryption for stored integration credentials
(GitHub, Jira, Slack tokens).

ENCRYPTION_KEY must be a Fernet key:
    python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

Outside a development environment the app refuses to start without a valid
key, rather than silently encrypting customer credentials with a key that is
published in the source code.
"""

import base64
import hashlib
import logging
import os

from cryptography.fernet import Fernet, InvalidToken

from app.utils.runtime import is_development

logger = logging.getLogger(__name__)

# Fernet tokens are base64 of a payload that starts with version byte 0x80,
# so every token starts with "gAAAAA".
_FERNET_PREFIX = "gAAAAA"


class EncryptionConfigError(RuntimeError):
    """ENCRYPTION_KEY is missing or invalid outside development."""


class DecryptionError(ValueError):
    """A stored value looked encrypted but could not be decrypted."""


def _dev_key() -> bytes:
    # Deterministic per-machine development key. Never used in production.
    seed = f"sigmasec-dev-only:{os.environ.get('HOSTNAME', 'local')}".encode("utf-8")
    return base64.urlsafe_b64encode(hashlib.sha256(seed).digest())


def _load_fernet() -> Fernet:
    raw = os.environ.get("ENCRYPTION_KEY", "").strip()
    if raw:
        try:
            return Fernet(raw.encode("utf-8"))
        except (ValueError, TypeError) as exc:
            if not is_development():
                raise EncryptionConfigError(
                    "ENCRYPTION_KEY is not a valid Fernet key. Generate one with "
                    "Fernet.generate_key()."
                ) from exc
            logger.warning("ENCRYPTION_KEY is invalid; using a development-only key.")
            return Fernet(_dev_key())

    if not is_development():
        raise EncryptionConfigError(
            "ENCRYPTION_KEY is not set. Refusing to start: stored integration "
            "credentials would otherwise be encrypted with a non-secret key."
        )
    logger.warning("ENCRYPTION_KEY is not set; using a development-only key.")
    return Fernet(_dev_key())


fernet = _load_fernet()


def encrypt_value(value: str) -> str:
    """Encrypt a string value using Fernet symmetric encryption."""
    if not value:
        return ""
    return fernet.encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_value(value: str) -> str:
    """
    Decrypt a Fernet-encrypted value.

    Legacy rows stored before encryption was introduced are plaintext and are
    returned unchanged. A value that IS a Fernet token but fails to decrypt
    (wrong or rotated key, tampering) raises DecryptionError instead of being
    handed back as if it were the credential.
    """
    if not value:
        return ""
    try:
        return fernet.decrypt(value.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        if value.startswith(_FERNET_PREFIX):
            raise DecryptionError(
                "Stored credential could not be decrypted with the current ENCRYPTION_KEY."
            ) from exc
        logger.warning("Returning legacy unencrypted credential; re-save it to encrypt it.")
        return value
