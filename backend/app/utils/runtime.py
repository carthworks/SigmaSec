# app/utils/runtime.py
"""
Runtime environment helpers.

ENVIRONMENT controls behaviour that must never leak into production,
such as development encryption keys or simulated GitHub pull requests.
Anything other than an explicit development value is treated as production,
so a missing or mistyped variable fails safe.
"""

import os

DEV_ENVIRONMENTS = {"development", "dev", "local", "test"}


def environment() -> str:
    return os.environ.get("ENVIRONMENT", "production").strip().lower()


def is_development() -> bool:
    return environment() in DEV_ENVIRONMENTS


def pr_simulation_enabled() -> bool:
    """
    Simulated fix PRs write to a throwaway local repo and return a fake PR URL.
    They are only allowed in a development environment AND when explicitly
    switched on, so a misconfigured production deploy can never report a PR
    that does not exist.
    """
    flag = os.environ.get("SIGMASEC_PR_SIMULATION", "").strip().lower()
    return is_development() and flag in {"1", "true", "yes"}
