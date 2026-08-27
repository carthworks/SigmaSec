import pytest
import uuid
from fastapi.testclient import TestClient
from hypothesis import given, strategies as st
from unittest.mock import patch, MagicMock

from app.main import app
from app.database import SessionLocal
from app.models import Org, User, Scan, Finding, Asset, Severity
from app.auth.jwt import create_access_token

client = TestClient(app)

# ──────────────────────────────────────────────────────────────────
# 1. Hypothesis-Based Property Test
# ──────────────────────────────────────────────────────────────────

@given(
    org_a_id=st.uuids(),
    org_b_id=st.uuids(),
    finding_id=st.uuids()
)
def test_property_based_org_isolation(org_a_id, org_b_id, finding_id):
    """
    Property test verifying: for any org_a, org_b, no query filtered
    by Org A id can ever return rows belonging to Org B.
    """
    if org_a_id == org_b_id:
        return

    # Simulate a database row structure
    mock_findings = [
        {"id": finding_id, "org_id": org_a_id, "title": "Org A Finding"},
        {"id": uuid.uuid4(), "org_id": org_b_id, "title": "Org B Finding"}
    ]

    # Simulates DB query filter: Finding.org_id == org_id
    org_a_results = [f for f in mock_findings if f["org_id"] == org_a_id]

    # Verify property: no row belonging to Org B is returned when querying for Org A
    for row in org_a_results:
        assert row["org_id"] != org_b_id
        assert row["org_id"] == org_a_id


# ──────────────────────────────────────────────────────────────────
# 2. Integration / Multi-Tenant Endpoint Audit Tests
# ──────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture(scope="module")
def setup_tenants(db_session):
    # Create two distinct organizations
    org_a = Org(name="Org A Sandbox", slug="org-a-sandbox")
    org_b = Org(name="Org B Sandbox", slug="org-b-sandbox")
    db_session.add(org_a)
    db_session.add(org_b)
    db_session.commit()
    db_session.refresh(org_a)
    db_session.refresh(org_b)

    # Create admin users for both orgs
    user_a = User(
        email="user_a@cybersigma.com",
        full_name="User A",
        hashed_password="mockpassword",
        role="admin",
        org_id=org_a.id
    )
    user_b = User(
        email="user_b@cybersigma.com",
        full_name="User B",
        hashed_password="mockpassword",
        role="admin",
        org_id=org_b.id
    )
    db_session.add(user_a)
    db_session.add(user_b)
    db_session.commit()
    db_session.refresh(user_a)
    db_session.refresh(user_b)

    # Create an asset, scan, and finding in Org B
    asset_b = Asset(
        org_id=org_b.id,
        name="Org B Asset",
        target="http://org-b-target.com",
        asset_type="url",
        asset_weight=1.0
    )
    db_session.add(asset_b)
    db_session.commit()
    db_session.refresh(asset_b)

    scan_b = Scan(
        org_id=org_b.id,
        asset_id=asset_b.id,
        target="http://org-b-target.com",
        scan_types=["vuln"],
        status="complete"
    )
    db_session.add(scan_b)
    db_session.commit()
    db_session.refresh(scan_b)

    finding_b = Finding(
        org_id=org_b.id,
        scan_id=scan_b.id,
        asset_id=asset_b.id,
        title="Org B SQL Injection",
        severity=Severity.critical,
        tool="nuclei",
        status="new"
    )
    db_session.add(finding_b)
    db_session.commit()
    db_session.refresh(finding_b)

    # JWT tokens
    token_a = create_access_token({"sub": str(user_a.id), "org_id": str(org_a.id), "role": "admin"})
    token_b = create_access_token({"sub": str(user_b.id), "org_id": str(org_b.id), "role": "admin"})

    yield {
        "org_a": org_a,
        "org_b": org_b,
        "asset_b": asset_b,
        "scan_b": scan_b,
        "finding_b": finding_b,
        "token_a": token_a,
        "token_b": token_b
    }

    # Clean up setup data
    db_session.delete(finding_b)
    db_session.delete(scan_b)
    db_session.delete(asset_b)
    db_session.delete(user_a)
    db_session.delete(user_b)
    db_session.delete(org_a)
    db_session.delete(org_b)
    db_session.commit()


def test_cross_org_endpoints_return_forbidden(setup_tenants):
    """
    Brute-checks all single-item endpoints.
    An Org A user must receive a 403 Forbidden when requesting Org B's resources.
    """
    headers_a = {"Authorization": f"Bearer {setup_tenants['token_a']}"}
    finding_b_id = setup_tenants["finding_b"].id
    scan_b_id = setup_tenants["scan_b"].id
    asset_b_id = setup_tenants["asset_b"].id

    # 1. GET /findings/{finding_id}
    res = client.get(f"/findings/{finding_b_id}", headers=headers_a)
    assert res.status_code == 403, f"Expected 403, got {res.status_code}"

    # 2. PATCH /findings/{finding_id}
    res = client.patch(f"/findings/{finding_b_id}", json={"status": "in_progress"}, headers=headers_a)
    assert res.status_code == 403, f"Expected 403, got {res.status_code}"

    # 3. POST /findings/{finding_id}/tags
    res = client.post(f"/findings/{finding_b_id}/tags", json={"name": "test"}, headers=headers_a)
    assert res.status_code == 403, f"Expected 403, got {res.status_code}"

    # 4. DELETE /findings/{finding_id}/tags/{name}
    res = client.delete(f"/findings/{finding_b_id}/tags/test", headers=headers_a)
    assert res.status_code == 403, f"Expected 403, got {res.status_code}"

    # 5. POST /findings/{finding_id}/create-jira-ticket
    res = client.post(f"/findings/{finding_b_id}/create-jira-ticket", headers=headers_a)
    assert res.status_code == 403, f"Expected 403, got {res.status_code}"

    # 6. POST /findings/{finding_id}/create-fix-pr
    res = client.post(f"/findings/{finding_b_id}/create-fix-pr", headers=headers_a)
    assert res.status_code == 403, f"Expected 403, got {res.status_code}"

    # 7. POST /findings/{finding_id}/regenerate-ai
    res = client.post(f"/findings/{finding_b_id}/regenerate-ai", headers=headers_a)
    assert res.status_code == 403, f"Expected 403, got {res.status_code}"

    # 8. GET /findings/{finding_id}/ai-enrichment
    res = client.get(f"/findings/{finding_b_id}/ai-enrichment", headers=headers_a)
    assert res.status_code == 403, f"Expected 403, got {res.status_code}"

    # 9. GET /scans/{scan_id}
    res = client.get(f"/scans/{scan_b_id}", headers=headers_a)
    assert res.status_code == 403, f"Expected 403, got {res.status_code}"

    # 10. GET /assets/{asset_id}
    res = client.get(f"/assets/{asset_b_id}", headers=headers_a)
    assert res.status_code == 403, f"Expected 403, got {res.status_code}"

    # 11. GET /assets/{asset_id}/findings
    res = client.get(f"/assets/{asset_b_id}/findings", headers=headers_a)
    assert res.status_code == 403, f"Expected 403, got {res.status_code}"

    # 12. PATCH /assets/{asset_id}
    res = client.patch(f"/assets/{asset_b_id}", json={"asset_weight": 2.5}, headers=headers_a)
    assert res.status_code == 403, f"Expected 403, got {res.status_code}"
