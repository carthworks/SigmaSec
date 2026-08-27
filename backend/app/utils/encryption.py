# app/utils/encryption.py

import os
import base64
from cryptography.fernet import Fernet

# Fernet requires a 32-byte url-safe base64-encoded key
ENCRYPTION_KEY = os.environ.get("ENCRYPTION_KEY")
if not ENCRYPTION_KEY:
    # A standard fallback key for development / testing
    ENCRYPTION_KEY = base64.urlsafe_b64encode(b"cybersigma_secret_key_32_bytes!!").decode("utf-8")

# Ensure the key is valid base64 and 32 bytes
try:
    # Try creating the Fernet object to validate key format
    fernet = Fernet(ENCRYPTION_KEY.encode("utf-8"))
except Exception:
    # Fallback to key derivation if key is not valid base64
    derived = base64.urlsafe_b64encode(ENCRYPTION_KEY.encode("utf-8")[:32].ljust(32, b"0"))
    fernet = Fernet(derived)

def encrypt_value(value: str) -> str:
    """Encrypt a string value using Fernet symmetric encryption."""
    if not value:
        return ""
    return fernet.encrypt(value.encode("utf-8")).decode("utf-8")

def decrypt_value(value: str) -> str:
    """Decrypt a Fernet-encrypted string value back to plain text."""
    if not value:
        return ""
    try:
        return fernet.decrypt(value.encode("utf-8")).decode("utf-8")
    except Exception:
        # Fallback to returning the raw value in case of unencrypted legacy database data
        return value
