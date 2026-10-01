# app/routers/dashboard.py
"""
Unified Dashboard metrics and API endpoint for SigmaSec Security Platform.
GET /dashboard/summary?timeframe=30d&days=30
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, get_user_org_id
from app.database import get_db
from app.models import Asset, Finding, Scan, ScanStatus, User
from app.models.finding import FindingStatus, Severity, Reachability

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


def _dt_aware(dt) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _sev_str(f: Finding) -> str:
    sev = f.ai_severity_override or f.severity
    return sev.value if hasattr(sev, "value") else str(sev)


def _intel_sync_state() -> Dict[str, Any]:
    """KEV catalogue size and last-refresh timestamps, as recorded by the intel clients."""
    state: Dict[str, Any] = {"kev_indexed": None, "kev": None, "epss": None, "nvd": None}
    try:
        import os
        import redis

        r = redis.from_url(os.environ.get("REDIS_URL", "redis://redis:6379/0"), decode_responses=True)
        state["kev_indexed"] = r.scard("kev:cves") or None
        state["kev"] = r.get("kev:last_refresh")
        state["epss"] = r.get("epss:last_refresh")
        state["nvd"] = r.get("nvd:last_refresh")
    except Exception as e:  # dashboard must still render if Redis is down
        logger.warning(f"[dashboard] could not read intel sync state: {e}")
    return state


def _kev_due(f: Finding) -> Optional[datetime]:
    if not f.kev_due_date:
        return None
    try:
        return datetime.strptime(f.kev_due_date[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _pct(part: int, whole: int) -> Optional[int]:
    return round(part / whole * 100) if whole else None


@router.get("/summary")
def get_dashboard_summary(
    days: Optional[int] = Query(None, description="Filter timeframe by days (e.g. 1, 30, 90)"),
    timeframe: Optional[str] = Query(None, description="Timeframe code e.g. 24h, 30d, 90d, custom"),
    db: Session = Depends(get_db),
    org_id: str = Depends(get_user_org_id),
    current_user: User = Depends(get_current_user),
):
    """
    Every value in this response is derived from the organisation's own data.
    When something is not known (no history, no feed sync yet, feature not built),
    the value is null or an empty list and the UI shows an empty state. Never
    substitute illustrative numbers here: customers read this as fact.
    """
    # Parse days
    num_days = 30
    if days is not None and days > 0:
        num_days = days
    elif timeframe:
        tf_clean = timeframe.lower().strip()
        if tf_clean == "24h":
            num_days = 1
        elif tf_clean in ["7d", "7 days"]:
            num_days = 7
        elif tf_clean in ["30d", "30 days"]:
            num_days = 30
        elif tf_clean in ["90d", "90 days"]:
            num_days = 90
        elif tf_clean == "custom":
            num_days = 180

    now_utc = datetime.now(timezone.utc)
    cutoff = now_utc - timedelta(days=num_days)

    # 1. Fetch assets
    assets = db.query(Asset).filter(Asset.org_id == org_id).all()
    asset_map = {str(a.id): a.name for a in assets}

    # 2. Fetch scans
    scans_query = db.query(Scan).filter(Scan.org_id == org_id)
    if num_days < 180:
        scans_query = scans_query.filter(Scan.created_at >= cutoff)
    scans = scans_query.order_by(Scan.created_at.desc()).all()

    # 3. Fetch findings
    findings_query = db.query(Finding).filter(Finding.org_id == org_id)
    if num_days < 180:
        findings_query = findings_query.filter(Finding.created_at >= cutoff)
    findings = findings_query.all()
    total_findings = len(findings)

    open_findings = [f for f in findings if f.status not in [FindingStatus.fixed, FindingStatus.false_positive]]
    crit_count = sum(1 for f in open_findings if _sev_str(f) == "critical")
    high_count = sum(1 for f in open_findings if _sev_str(f) == "high")
    kev_open = [f for f in open_findings if f.kev_listed]

    # Posture score: the same formula and inputs as the executive view (all org
    # findings, weighted by asset), so both screens always show the same number.
    # Null until the org has scanned something, so a new account doesn't show a score.
    posture_score = None
    if scans or findings:
        from app.routers.executive import _compute_posture_score

        all_org_findings = db.query(Finding).filter(Finding.org_id == org_id).all()
        asset_weights = {str(a.id): float(a.asset_weight or 1.0) for a in assets}
        posture_score = _compute_posture_score(all_org_findings, asset_weights)

    if not (scans or findings):
        posture_driver = "No scans yet. Run a scan to calculate your posture score."
    elif not open_findings:
        posture_driver = "No open findings in this timeframe."
    else:
        parts = []
        if kev_open:
            parts.append(f"{len(kev_open)} open finding{'s' if len(kev_open) != 1 else ''} on CISA KEV")
        if crit_count:
            parts.append(f"{crit_count} critical")
        if high_count:
            parts.append(f"{high_count} high")
        posture_driver = ("Driven by " + ", ".join(parts) + ".") if parts else "Only medium or lower findings are open."

    # Funnel: real counts only.
    crit_high_count = sum(1 for f in findings if _sev_str(f) in ["critical", "high"])
    reachable_count = sum(1 for f in findings if f.reachability == Reachability.reachable)
    exploitable_now = [
        f for f in open_findings if f.kev_listed or (f.epss_score is not None and f.epss_score >= 0.5)
    ]

    # "Do this next": real open findings only, ranked; no filler items.
    sorted_prioritized = sorted(
        open_findings,
        key=lambda f: (f.kev_listed, f.priority_score or 0.0, _sev_str(f) == "critical"),
        reverse=True,
    )
    do_this_next = []
    for f in sorted_prioritized[:4]:
        b_type = "KEV" if f.kev_listed else ("SECRET" if f.tool == "gitleaks" else _sev_str(f).upper())
        a_label = "Review fix PR" if f.pr_url else ("Open in Jira" if f.jira_issue_key else "Generate fix PR")
        a_href = "/remediation-hub" if f.pr_url or b_type in ["KEV", "SECRET"] else "/findings?view=jira"

        reasons = []
        if f.kev_listed:
            reasons.append("on CISA KEV")
        if f.epss_score is not None:
            reasons.append(f"EPSS {f.epss_score:.2f}")
        reach = f.reachability.value if hasattr(f.reachability, "value") else f.reachability
        if reach == "reachable":
            reasons.append("dependency used in code")
        if f.tool == "gitleaks":
            reasons.append("secret committed to repository")
        if not reasons:
            reasons.append(f"{_sev_str(f)} severity")

        due = _kev_due(f)
        if due:
            delta = (due.date() - now_utc.date()).days
            sla_status = f"KEV due in {delta}d" if delta >= 0 else f"KEV overdue {-delta}d"
            sla_breaching = delta < 0
        else:
            sla_status = None
            sla_breaching = False

        do_this_next.append({
            "id": str(f.id),
            "badge": b_type,
            "title": f.title,
            "why_now": "Why now: " + " · ".join(reasons),
            "sla_status": sla_status,
            "sla_breaching": sla_breaching,
            "action_type": "review_pr" if f.pr_url else "generate_pr",
            "action_label": a_label,
            "action_href": a_href,
        })

    # KPIs
    jira_linked_count = sum(1 for f in findings if f.jira_issue_key)
    pr_open_count = sum(1 for f in findings if f.pr_url and (f.pr_status or "open") == "open")
    accepted_risk_count = sum(1 for f in findings if f.status == FindingStatus.accepted_risk)
    sla_breaches = sum(1 for f in open_findings if _kev_due(f) and _kev_due(f) < now_utc)

    fixed_findings = [f for f in findings if f.status == FindingStatus.fixed and f.updated_at and f.created_at]
    mttr_days = None
    if fixed_findings:
        total_days = sum((_dt_aware(f.updated_at) - _dt_aware(f.created_at)).total_seconds() / 86400.0 for f in fixed_findings)
        mttr_days = round(total_days / len(fixed_findings), 1)

    scanned_7d_cutoff = now_utc - timedelta(days=7)
    assets_scanned_7d = (
        db.query(Scan.asset_id)
        .filter(Scan.org_id == org_id, Scan.created_at >= scanned_7d_cutoff, Scan.asset_id.isnot(None))
        .distinct()
        .count()
    )
    scanned_pct = _pct(assets_scanned_7d, len(assets))

    # Trend: open vs remediated per day, reconstructed from finding timestamps.
    # A finding counts as remediated from the time it was marked fixed (updated_at).
    trend_data = []
    if findings:
        for i in range(num_days - 1, -1, -1):
            day_end = (now_utc - timedelta(days=i)).replace(hour=23, minute=59, second=59)
            created = [f for f in findings if f.created_at and _dt_aware(f.created_at) <= day_end]
            remediated = [
                f for f in created
                if f.status == FindingStatus.fixed and f.updated_at and _dt_aware(f.updated_at) <= day_end
            ]
            trend_data.append({
                "date": day_end.strftime("%b %d"),
                "open": len(created) - len(remediated),
                "remediated": len(remediated),
            })

    # Recent scans (real only)
    recent_scans_data = []
    for s in scans[:3]:
        target_type = "Git repo" if s.target.endswith(".git") or "github.com" in s.target else ("Container" if ":" in s.target and not s.target.startswith("http") else "Web app")
        cnt = s.findings_count or {}
        status_val = s.status.value if hasattr(s.status, "value") else str(s.status)
        recent_scans_data.append({
            "id": str(s.id),
            "target": s.target,
            "target_type": target_type,
            "status": status_val,
            "created_at": s.created_at.isoformat(),
            "critical_count": cnt.get("critical", 0),
            "high_count": cnt.get("high", 0),
            "medium_count": cnt.get("medium", 0),
            "summary_text": f"{status_val.capitalize()} · {cnt.get('critical', 0)} critical",
        })

    # Remediation pipeline: findings with a fix PR or Jira ticket, grouped by asset.
    pipeline_groups: Dict[str, List[Dict[str, str]]] = {}
    for f in open_findings:
        if not (f.pr_url or f.jira_issue_key):
            continue
        group = asset_map.get(str(f.asset_id), "Unassigned asset")
        subtitle = " · ".join(x for x in [f.cve_id, f.jira_issue_key] if x) or (f.tool or "")
        if f.pr_url:
            badge, color = "PR open", "emerald"
        else:
            badge, color = "Jira open", "blue"
        pipeline_groups.setdefault(group, []).append(
            {"title": f.title, "subtitle": subtitle, "badge": badge, "badge_color": color}
        )
    remediation_pipeline = [
        {"group": f"{name} · {len(items)} in flight", "items": items[:4]}
        for name, items in pipeline_groups.items()
    ]

    intel = _intel_sync_state()
    cve_findings = [f for f in findings if f.cve_id]
    analyzed_reach = [f for f in findings if f.reachability in (Reachability.reachable, Reachability.unreachable)]

    return {
        "timeframe": timeframe or "30d",
        "num_days": num_days,
        "posture_score": posture_score,
        "points_changed_this_week": None,  # needs score history; not tracked yet
        "posture_driver": posture_driver,
        "funnel": {
            "total_findings": total_findings,
            "critical_high_count": crit_high_count,
            "critical_high_pct": _pct(crit_high_count, total_findings),
            "reachable_count": reachable_count,
            "reachable_pct": _pct(reachable_count, crit_high_count),
            "exploitable_now_count": len(exploitable_now),
            "exploitable_pct": _pct(len(exploitable_now), total_findings),
        },
        "do_this_next": do_this_next,
        "kpis": {
            "mttr_days": mttr_days,
            "mttr_change_days": None,  # needs history; not tracked yet
            "prs_open": pr_open_count,
            "jira_linked": jira_linked_count,
            "sla_breaches": sla_breaches,
            "accepted_risks": accepted_risk_count,
            "assets_scanned_7d_pct": scanned_pct,
        },
        "trend_data": trend_data,
        "intel_coverage": {
            "cisa_kev": {
                "indexed": intel["kev_indexed"],
                "matches": sum(1 for f in findings if f.kev_listed),
                "last_sync": intel["kev"],
            },
            "epss": {
                "scored": sum(1 for f in cve_findings if f.epss_score is not None),
                "total": len(cve_findings),
                "above_threshold": sum(1 for f in findings if f.epss_score is not None and f.epss_score >= 0.5),
                "last_sync": intel["epss"],
            },
            "ast_reachability": {
                "analyzed": len(analyzed_reach),
                "total_assets": len(assets),
                "reachable_count": reachable_count,
                "pending": None,
            },
            "exploit_validation": {
                # Not implemented yet (docs/CLAIMS_AUDIT.md, claim 5).
                "available": False,
                "sandbox_confirmed": 0,
                "inconclusive": 0,
            },
        },
        "recent_scans": recent_scans_data,
        "remediation_pipeline": remediation_pipeline,
        "system_status": {
            "api_version": "v0.1.0",
            "db_connected": True,
            "scan_engine_idle": not any(s.status == ScanStatus.running for s in scans),
            "total_scans": len(scans),
            "intel_synced_at": intel["kev"] or intel["epss"],
        },
    }
