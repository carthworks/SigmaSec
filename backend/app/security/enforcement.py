# app/security/enforcement.py
"""
Pre-flight checks for scans that send traffic to a target (web/Nuclei and
network/Nmap). Called by POST /scans; the adapters re-check public addresses
right before they run.
"""

from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.models import TargetVerification
from app.security.ownership import VERIFICATION_TTL_DAYS
from app.security.targets import assert_public_target, covering_scope, extract_host
from app.utils.runtime import is_development

logger = logging.getLogger(__name__)

# Scan types that send traffic to the target itself.
ACTIVE_SCAN_TYPES = {"vuln", "network"}


class OwnershipRequired(PermissionError):
    """The organisation hasn't proven it controls the target."""


class ActiveScanRateLimited(RuntimeError):
    """Too many active scans for this organisation in the current hour."""


def unverified_targets_allowed() -> bool:
    flag = os.environ.get("SIGMASEC_ALLOW_UNVERIFIED_TARGETS", "").strip().lower()
    return is_development() and flag in {"1", "true", "yes"}


def active_scans_per_hour() -> int:
    try:
        return max(1, int(os.environ.get("SIGMASEC_ACTIVE_SCANS_PER_HOUR", "20")))
    except ValueError:
        return 20


def is_current(v: TargetVerification, now: Optional[datetime] = None) -> bool:
    if not v.verified_at:
        return False
    now = now or datetime.now(timezone.utc)
    verified_at = v.verified_at if v.verified_at.tzinfo else v.verified_at.replace(tzinfo=timezone.utc)
    return now - verified_at <= timedelta(days=VERIFICATION_TTL_DAYS)


def find_covering_verification(db: Session, org_id: uuid.UUID, target: str) -> Optional[TargetVerification]:
    host = extract_host(target)
    rows = (
        db.query(TargetVerification)
        .filter(TargetVerification.org_id == org_id, TargetVerification.verified_at.isnot(None))
        .all()
    )
    current = [r for r in rows if is_current(r)]
    match = covering_scope(host, [(r.scope, r.method) for r in current])
    if not match:
        return None
    return next(r for r in current if (r.scope, r.method) == match)


def check_rate_limit(org_id: uuid.UUID, redis_client=None) -> None:
    """Per-organisation hourly cap on active scans (Redis). Fails open if Redis is down."""
    limit = active_scans_per_hour()
    try:
        r = redis_client
        if r is None:
            import redis

            r = redis.from_url(os.environ.get("REDIS_URL", "redis://redis:6379/0"))
        key = f"ratelimit:active_scans:{org_id}:{datetime.now(timezone.utc):%Y%m%d%H}"
        count = r.incr(key)
        if count == 1:
            r.expire(key, 3600)
    except Exception as exc:  # availability over strictness: ownership is the primary control
        logger.warning(f"[scan-limits] rate limit check skipped, Redis unavailable: {exc}")
        return
    if count > limit:
        raise ActiveScanRateLimited(
            f"Limit reached: {limit} web or network scans per hour for your organisation. Try again later."
        )


def preflight_active_scan(db: Session, org_id: uuid.UUID, target: str, redis_client=None) -> Optional[TargetVerification]:
    """
    Raise TargetNotAllowed, OwnershipRequired or ActiveScanRateLimited if an
    active scan of target must not run. Returns the verification that covers it
    (None only when the development bypass is on).
    """
    assert_public_target(target)
    verification = find_covering_verification(db, org_id, target)
    if verification is None and not unverified_targets_allowed():
        host = extract_host(target)
        raise OwnershipRequired(
            f"Verify that your organisation controls '{host}' before running web or network scans against it. "
            "Add it under Assets → Verified targets."
        )
    check_rate_limit(org_id, redis_client=redis_client)
    return verification
