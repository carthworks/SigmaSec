# app/routers/executive.py
"""
FR-UI-08 — CISO Executive View endpoint.

GET /executive
  Returns a complete org-level posture snapshot cached in Redis for 5 min.
  Accessible to any authenticated user (CISO can bookmark one URL).
"""

import json
import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional

import redis
from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, get_user_org_id
from app.database import get_db
from app.models import Asset, Finding, Scan, ScanStatus, User
from app.models.finding import FindingStatus, Severity

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/executive", tags=["Executive"])

REDIS_URL = os.environ.get("REDIS_URL", "redis://redis:6379/0")
try:
    _redis = redis.from_url(REDIS_URL, decode_responses=True)
except Exception:
    _redis = None

CACHE_TTL = 300  # 5 minutes


# ─── Helpers ─────────────────────────────────────────────────────────────────


def _sev(f: Finding) -> str:
    """Return the effective severity string (AI override takes precedence)."""
    sev = f.ai_severity_override or f.severity
    return sev.value if hasattr(sev, "value") else str(sev)


def _status_eq(f: Finding, target: FindingStatus) -> bool:
    """Safely compare finding status whether stored as enum or raw string."""
    if f.status is None:
        return False
    fs = f.status.value if hasattr(f.status, "value") else str(f.status)
    return fs == target.value


def _is_fp(f: Finding) -> bool:
    return _status_eq(f, FindingStatus.false_positive) or bool(f.fp_candidate)


def _is_fixed(f: Finding) -> bool:
    return _status_eq(f, FindingStatus.fixed)


def _dt_aware(dt) -> Optional[datetime]:
    """Ensure a datetime is timezone-aware (UTC). Handles naive DB timestamps."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


# ─── Pydantic response models ─────────────────────────────────────────────────


class TopRisk(BaseModel):
    id: str
    title: str
    severity: str
    cve_id: Optional[str] = None
    priority_score: Optional[float] = None
    kev_listed: bool
    exploit_validated: bool
    asset_name: Optional[str] = None


class WoWTrend(BaseModel):
    fixed: int
    new: int
    regressed: int


class ExecutiveSummary(BaseModel):
    posture_score: float
    top_risks: List[TopRisk]
    wow_trend: WoWTrend
    exec_summary_paragraph: str
    kev_count: int
    validated_critical_count: int
    total_open_findings: int
    critical_count: int
    high_count: int
    medium_count: int
    cached: bool
    computed_at: str


# ─── Posture score formula ────────────────────────────────────────────────────


def _compute_posture_score(findings: list, assets: dict) -> float:
    """
    posture_score (0–100):
      base = 100
      − 10 per critical finding × asset_weight
      − 3  per high finding × asset_weight
      + 1  per finding fixed in past 7 days (capped at +20)
    Clamped to [0, 100].
    """
    score = 100.0
    bonus = 0.0
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)

    for f in findings:
        try:
            if _is_fp(f):
                continue

            weight = assets.get(str(f.asset_id), 1.0) if f.asset_id else 1.0

            if _is_fixed(f):
                updated = _dt_aware(f.updated_at)
                if updated and updated >= week_ago:
                    bonus += 1.0
                continue

            sev_val = _sev(f)
            if sev_val == "critical":
                score -= 10.0 * weight
            elif sev_val == "high":
                score -= 3.0 * weight
        except Exception as e:
            logger.warning(f"[executive] Skipping finding {f.id} in score calc: {e}")
            continue

    score += min(bonus, 20.0)
    return round(max(0.0, min(100.0, score)), 1)


# ─── Main endpoint ────────────────────────────────────────────────────────────


@router.get("", response_model=ExecutiveSummary)
def get_executive_summary(
    response: Response,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_user_org_id),
    current_user: User = Depends(get_current_user),
):
    """
    Returns the CISO-ready posture snapshot for the current organization.
    Results are cached in Redis for 5 minutes.
    """
    cache_key = f"executive:{org_id}"

    # ── Try cache first ────────────────────────────────────────────────────────
    try:
        if _redis:
            cached_raw = _redis.get(cache_key)
            if cached_raw:
                response.headers["X-Cache"] = "HIT"
                data = json.loads(cached_raw)
                data["cached"] = True
                return ExecutiveSummary(**data)
    except Exception as e:
        logger.warning(f"[executive] Redis cache read failed: {e}")

    response.headers["X-Cache"] = "MISS"
    computed_at = datetime.utcnow().isoformat()

    # ── Fetch all org findings ─────────────────────────────────────────────────
    findings = db.query(Finding).filter(Finding.org_id == org_id).all()

    # Asset lookup maps
    assets_q = db.query(Asset).filter(Asset.org_id == org_id).all()
    asset_weights = {str(a.id): float(a.asset_weight or 1.0) for a in assets_q}
    asset_names = {str(a.id): a.name for a in assets_q}

    # ── Posture score ──────────────────────────────────────────────────────────
    posture_score = _compute_posture_score(findings, asset_weights)

    # ── Open findings (not FP, not fixed) ─────────────────────────────────────
    open_findings = [f for f in findings if not _is_fp(f) and not _is_fixed(f)]

    critical_count = sum(1 for f in open_findings if _sev(f) == "critical")
    high_count = sum(1 for f in open_findings if _sev(f) == "high")
    medium_count = sum(1 for f in open_findings if _sev(f) == "medium")
    kev_count = sum(1 for f in open_findings if f.kev_listed)
    validated_critical_count = sum(
        1 for f in open_findings if _sev(f) == "critical" and f.exploit_validated
    )

    # ── WoW Trend (7-day window) ───────────────────────────────────────────────
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)

    new_count = 0
    fixed_count = 0
    regressed_count = 0

    for f in findings:
        try:
            created = _dt_aware(f.created_at)
            updated = _dt_aware(f.updated_at)

            if not _is_fp(f) and not _is_fixed(f):
                if created and created >= week_ago:
                    new_count += 1

            if _is_fixed(f) and updated and updated >= week_ago:
                fixed_count += 1

            # Regressed: was old, now re-opened/investigating
            status_val = (f.status.value if hasattr(f.status, "value") else str(f.status or ""))
            if status_val in ("investigating", "in_progress"):
                if updated and updated >= week_ago and created and created < week_ago:
                    regressed_count += 1
        except Exception as e:
            logger.warning(f"[executive] WoW trend calc skipped for {f.id}: {e}")

    wow_trend = WoWTrend(fixed=fixed_count, new=new_count, regressed=regressed_count)

    # ── Top 5 risks ────────────────────────────────────────────────────────────
    sorted_risks = sorted(
        open_findings,
        key=lambda f: (
            bool(f.kev_listed),
            bool(f.exploit_validated),
            float(f.priority_score or 0.0),
        ),
        reverse=True,
    )[:5]

    top_risks = [
        TopRisk(
            id=str(f.id),
            title=f.title,
            severity=_sev(f),
            cve_id=f.cve_id,
            priority_score=f.priority_score,
            kev_listed=bool(f.kev_listed),
            exploit_validated=bool(f.exploit_validated),
            asset_name=asset_names.get(str(f.asset_id)) if f.asset_id else None,
        )
        for f in sorted_risks
    ]

    # ── Executive paragraph ────────────────────────────────────────────────────
    try:
        latest_scan = (
            db.query(Scan)
            .filter(Scan.org_id == org_id, Scan.status == ScanStatus.complete)
            .order_by(Scan.created_at.desc())
            .first()
        )
        exec_para = (
            latest_scan.exec_summary
            if latest_scan and latest_scan.exec_summary
            else (
                "No completed scans available yet. Run a scan to generate an "
                "AI-powered executive summary of your organization's security posture."
            )
        )
    except Exception:
        exec_para = "Executive summary unavailable — run a completed scan to generate one."

    # ── Assemble payload ───────────────────────────────────────────────────────
    payload = ExecutiveSummary(
        posture_score=posture_score,
        top_risks=top_risks,
        wow_trend=wow_trend,
        exec_summary_paragraph=exec_para,
        kev_count=kev_count,
        validated_critical_count=validated_critical_count,
        total_open_findings=len(open_findings),
        critical_count=critical_count,
        high_count=high_count,
        medium_count=medium_count,
        cached=False,
        computed_at=computed_at,
    )

    # ── Write to cache ─────────────────────────────────────────────────────────
    try:
        if _redis:
            cache_data = payload.model_dump()
            cache_data["top_risks"] = [r.model_dump() for r in top_risks]
            cache_data["wow_trend"] = wow_trend.model_dump()
            _redis.setex(cache_key, CACHE_TTL, json.dumps(cache_data, default=str))
    except Exception as e:
        logger.warning(f"[executive] Redis cache write failed: {e}")

    return payload
