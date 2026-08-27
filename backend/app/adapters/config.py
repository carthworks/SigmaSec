# app/adapters/config.py
"""
Centralized, env-overridable configuration for all scanner adapters.
Keeps binary paths, timeouts, and severity normalization in one place so
deploy targets (local WSL2, CI, customer VPC) can override without code changes.
"""

import os


def _env(name: str, default: str) -> str:
    return os.environ.get(name, default)


# --- Binary paths (resolved via shutil.which at adapter init, these are hints) ---
NUCLEI_BINARY = _env("NUCLEI_BINARY", "nuclei")
TRIVY_BINARY = _env("TRIVY_BINARY", "trivy")
GITLEAKS_BINARY = _env("GITLEAKS_BINARY", "gitleaks")
OPENGROUP_BINARY = _env("OPENGROUP_BINARY", "opengroup")
OPENGROUP_RULESET = _env("OPENGROUP_RULESET", "p/default")
NMAP_BINARY = _env("NMAP_BINARY", "nmap")

# --- Wall-clock ceilings per scan (seconds) ---
NUCLEI_TIMEOUT = int(_env("NUCLEI_TIMEOUT", "600"))
TRIVY_TIMEOUT = int(_env("TRIVY_TIMEOUT", "600"))
GITLEAKS_TIMEOUT = int(_env("GITLEAKS_TIMEOUT", "600"))
OPENGROUP_TIMEOUT = int(_env("OPENGROUP_TIMEOUT", "600"))
GIT_CLONE_TIMEOUT = int(_env("GIT_CLONE_TIMEOUT", "300"))
NMAP_TIMEOUT = int(_env("NMAP_TIMEOUT", "300"))

# Path to live Nuclei templates (Docker named volume; empty = use bundled templates)
NUCLEI_TEMPLATES_PATH = _env("NUCLEI_TEMPLATES_PATH", "")


USER_AGENT = _env(
    "SCANNER_USER_AGENT",
    "SigmaSec-Scanner/0.1.0 (+https://sigmasec.ai/scanner)",
)

# --- Redis log stream ---
REDIS_URL = _env("REDIS_URL", "redis://redis:6379")
LOG_TTL_SECONDS = int(_env("SCAN_LOG_TTL", "86400"))        # expire log lists after 24h
LOG_MAX_ENTRIES = int(_env("SCAN_LOG_MAX_ENTRIES", "5000"))  # cap per-scan log lines

# --- Severity normalization (handles Trivy, Nuclei, Gitleaks, and Semgrep/Opengrep) ---
_SEVERITY_MAP = {
    "critical": "critical",
    "high": "high",
    "error": "high",
    "medium": "medium",
    "warning": "medium",
    "warn": "medium",
    "low": "low",
    "info": "info",
    "informational": "info",
    "unknown": "info",
    "none": "info",
}


def normalize_severity(raw) -> str:
    return _SEVERITY_MAP.get(str(raw or "").strip().lower(), "info")

