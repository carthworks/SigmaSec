"""
The customer dashboard must only show the organisation's own data.
These tests run against the real database (DATABASE_URL) and call the
endpoint function directly.
"""

import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from app.database import SessionLocal
from app.models import Asset, Finding, Scan
from app.models.asset import AssetType
from app.models.finding import FindingStatus, Reachability, Severity
from app.models.org import Org
from app.models.scan import ScanStatus
from app.routers.dashboard import get_dashboard_summary

# Values that used to be injected when real data was missing.
ILLUSTRATIVE = {1204, 399, 86, 14, 68.0, 4.2, 94, 1647}


@pytest.fixture
def db():
    session = SessionLocal()
    created = []
    yield session, created
    session.rollback()
    for obj in reversed(created):
        session.delete(obj)
    session.commit()
    session.close()


def _org(session, created):
    org = Org(id=uuid.uuid4(), name="Dash Test", slug=f"dash-{uuid.uuid4().hex[:10]}")
    session.add(org)
    session.commit()
    created.append(org)
    return org


def _summary(session, org):
    return get_dashboard_summary(
        days=None, timeframe="30d", db=session, org_id=org.id,
        current_user=SimpleNamespace(org_id=org.id),
    )


def _walk_numbers(obj):
    if isinstance(obj, bool):
        return
    if isinstance(obj, (int, float)):
        yield obj
    elif isinstance(obj, dict):
        for v in obj.values():
            yield from _walk_numbers(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from _walk_numbers(v)


def test_empty_org_gets_empty_dashboard_not_sample_data(db):
    session, created = db
    org = _org(session, created)
    out = _summary(session, org)

    assert out["posture_score"] is None
    assert out["points_changed_this_week"] is None
    assert out["do_this_next"] == []
    assert out["recent_scans"] == []
    assert out["remediation_pipeline"] == []
    assert out["trend_data"] == []
    assert out["funnel"]["total_findings"] == 0
    assert out["funnel"]["reachable_count"] == 0
    assert out["funnel"]["exploitable_now_count"] == 0
    assert out["kpis"]["mttr_days"] is None
    assert out["kpis"]["prs_open"] == 0
    assert out["kpis"]["assets_scanned_7d_pct"] is None
    assert out["intel_coverage"]["exploit_validation"]["available"] is False

    text = str(out)
    for leaked in ("libraDigit", "earthworks", "akitra", "payments-api", "gnutls", "libxslt", "Jul 18"):
        assert leaked not in text
    leaked_numbers = ILLUSTRATIVE & set(_walk_numbers(out))
    assert not leaked_numbers, f"illustrative numbers leaked: {leaked_numbers}"


def test_dashboard_reflects_real_findings(db):
    session, created = db
    org = _org(session, created)
    asset = Asset(id=uuid.uuid4(), org_id=org.id, name="acme/api", target="https://github.com/acme/api.git",
                  asset_type=AssetType.git_repo)
    session.add(asset)
    session.commit()
    created.append(asset)
    scan = Scan(id=uuid.uuid4(), org_id=org.id, asset_id=asset.id, target=asset.target,
                scan_types=["sca"], status=ScanStatus.complete)
    session.add(scan)
    session.commit()
    created.append(scan)

    overdue = (datetime.now(timezone.utc) - timedelta(days=3)).strftime("%Y-%m-%d")
    rows = [
        Finding(org_id=org.id, scan_id=scan.id, asset_id=asset.id, title="KEV one", severity=Severity.critical,
                tool="trivy", cve_id="CVE-2021-44228", kev_listed=True, kev_due_date=overdue, epss_score=0.97,
                reachability=Reachability.reachable, priority_score=9.5, pr_url="https://github.com/acme/api/pull/1",
                pr_status="open", fingerprint=uuid.uuid4().hex),
        Finding(org_id=org.id, scan_id=scan.id, asset_id=asset.id, title="Plain high", severity=Severity.high,
                tool="trivy", cve_id="CVE-2020-0001", epss_score=0.01, reachability=Reachability.uncertain,
                priority_score=2.0, fingerprint=uuid.uuid4().hex),
        Finding(org_id=org.id, scan_id=scan.id, asset_id=asset.id, title="Medium thing", severity=Severity.medium,
                tool="opengrep", priority_score=1.0, fingerprint=uuid.uuid4().hex),
    ]
    for r in rows:
        session.add(r)
    session.commit()
    created.extend(rows)

    out = _summary(session, org)
    funnel = out["funnel"]
    assert funnel["total_findings"] == 3
    assert funnel["critical_high_count"] == 2
    assert funnel["reachable_count"] == 1
    assert funnel["exploitable_now_count"] == 1
    # 100 - (10 + 3 + 1) + 10 (fewer than 5 open)
    assert out["posture_score"] == 96
    assert "1 open finding on CISA KEV" in out["posture_driver"]

    titles = [i["title"] for i in out["do_this_next"]]
    assert titles[0] == "KEV one"
    assert len(titles) == 3  # no filler items
    top = out["do_this_next"][0]
    assert "on CISA KEV" in top["why_now"] and "EPSS 0.97" in top["why_now"]
    assert top["sla_status"] == "KEV overdue 3d" and top["sla_breaching"] is True
    plain = next(i for i in out["do_this_next"] if i["title"] == "Plain high")
    assert "used in code" not in plain["why_now"]  # reachability is uncertain, so don't claim it
    assert plain["sla_status"] is None

    assert out["kpis"]["prs_open"] == 1
    assert out["kpis"]["sla_breaches"] == 1
    assert out["kpis"]["assets_scanned_7d_pct"] == 100
    assert [s["target"] for s in out["recent_scans"]] == [asset.target]
    assert out["remediation_pipeline"][0]["group"] == "acme/api · 1 in flight"
    assert out["trend_data"][-1] == {"date": out["trend_data"][-1]["date"], "open": 3, "remediated": 0}
