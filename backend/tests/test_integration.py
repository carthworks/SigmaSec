import pytest
import uuid
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

from app.main import app
from app.database import SessionLocal
from app.models import Org, User, Scan, Finding, ScanStatus, Asset
from app.auth.jwt import create_access_token

client = TestClient(app)

@pytest.fixture(scope="module")
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture(scope="module")
def setup_data(db_session):
    # Create two distinct organizations with required slugs
    org_a = Org(name="Test Org A", slug="test-org-a")
    org_b = Org(name="Test Org B", slug="test-org-b")
    db_session.add(org_a)
    db_session.add(org_b)
    db_session.commit()
    db_session.refresh(org_a)
    db_session.refresh(org_b)

    # Create users belonging to the respective organizations
    user_a = User(
        email="user_a@test.com",
        full_name="User A",
        hashed_password="mockpassword",
        role="admin",
        org_id=org_a.id
    )
    user_b = User(
        email="user_b@test.com",
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

    # Generate valid JWT tokens for both users
    token_a = create_access_token({"sub": str(user_a.id), "org_id": str(org_a.id), "role": "admin"})
    token_b = create_access_token({"sub": str(user_b.id), "org_id": str(org_b.id), "role": "admin"})

    yield {
        "org_a": org_a,
        "org_b": org_b,
        "user_a": user_a,
        "user_b": user_b,
        "token_a": token_a,
        "token_b": token_b
    }

    # Database cleanup post-test execution
    db_session.query(Finding).filter(Finding.org_id.in_([org_a.id, org_b.id])).delete(synchronize_session=False)
    db_session.query(Scan).filter(Scan.org_id.in_([org_a.id, org_b.id])).delete(synchronize_session=False)
    db_session.delete(user_a)
    db_session.delete(user_b)
    db_session.delete(org_a)
    db_session.delete(org_b)
    db_session.commit()


def test_full_scan_lifecycle(setup_data, db_session):
    """
    Verifies that a scan can be queued via POST, mock-run, 
    and its completed findings can be successfully retrieved via GET.
    """
    headers_a = {"Authorization": f"Bearer {setup_data['token_a']}"}
    
    payload = {
        "target": "https://api.test-org-a.com",
        "scan_types": ["vuln", "sca"],
        "active_validation": False,
        "docker_image": "nginx:1.24"
    }
    
    # Mock the Celery run_scan_task delay call
    with patch("app.routers.scans.run_scan_task.delay") as mock_delay:
        mock_task = MagicMock()
        mock_task.id = "mock-celery-task-id-123"
        mock_delay.return_value = mock_task

        res = client.post("/scans", json=payload, headers=headers_a)
        assert res.status_code == 201, res.text
        scan_data = res.json()
        assert scan_data["target"] == payload["target"]
        assert scan_data["status"] == "queued"
        scan_id = scan_data["id"]

        mock_delay.assert_called_once()
        
    # Ingest a mock finding directly to test retrieve lifecycle
    f1 = Finding(
        org_id=setup_data["org_a"].id,
        scan_id=uuid.UUID(scan_id),
        title="CVE-2023-1234 in nginx",
        severity="high",
        cve_id="CVE-2023-1234",
        tool="trivy",
        url="nginx:1.24",
        description="Vulnerability description",
        scan_metadata={"fixed_version": "1.24.1"}
    )
    db_session.add(f1)
    
    # Simulate Celery worker updating scan to complete
    scan = db_session.query(Scan).filter(Scan.id == uuid.UUID(scan_id)).first()
    scan.status = ScanStatus.complete
    db_session.commit()

    # Retrieve findings via GET
    res_findings = client.get(f"/scans/{scan_id}/findings", headers=headers_a)
    assert res_findings.status_code == 200
    findings_list = res_findings.json()
    assert len(findings_list) == 1
    assert findings_list[0]["cve_id"] == "CVE-2023-1234"


def test_org_isolation(setup_data, db_session):
    """
    Verifies that Org B user cannot access scans or findings belonging to Org A.
    """
    headers_b = {"Authorization": f"Bearer {setup_data['token_b']}"}

    # Create scan for Org A
    scan_a = Scan(
        org_id=setup_data["org_a"].id,
        target="https://target-a.com",
        scan_types=["vuln"],
        status=ScanStatus.complete
    )
    db_session.add(scan_a)
    db_session.commit()
    db_session.refresh(scan_a)

    # Attempt to read Org A's scan details as Org B -> 404 (Not Found / Access Blocked)
    res_get = client.get(f"/scans/{scan_a.id}", headers=headers_b)
    assert res_get.status_code in (403, 404)

    # Attempt to read Org A's findings as Org B -> 404 (Not Found / Access Blocked)
    res_findings = client.get(f"/scans/{scan_a.id}/findings", headers=headers_b)
    assert res_findings.status_code in (403, 404)


def test_gitleaks_adapter_unit():
    """
    Verifies that GitleaksAdapter correctly parses findings and masks secrets.
    """
    from app.adapters.gitleaks import GitleaksAdapter
    adapter = GitleaksAdapter()
    
    # Test secret masking
    assert adapter.mask_secret("123") == "******"
    assert adapter.mask_secret("12345") == "12...45"
    assert adapter.mask_secret("abcdefghijkl") == "abcd...ijkl"
    assert adapter.mask_secret("") == ""

    # Test report parsing
    mock_report = """[
        {
            "Description": "AWS Access Key",
            "File": "config/aws.py",
            "StartLine": 10,
            "Secret": "AKIAIOSFODNN7EXAMPLE",
            "Commit": "commit123",
            "RuleID": "aws-access-key"
        }
    ]"""
    findings = adapter.parse(mock_report)
    assert len(findings) == 1
    assert findings[0]["title"] == "Secret Detected: AWS Access Key"
    assert findings[0]["severity"] == "critical"
    assert findings[0]["tool"] == "gitleaks"
    assert findings[0]["url"] == "config/aws.py#L10"
    assert findings[0]["scan_metadata"]["partial_secret"] == "AKIA...MPLE"


def test_gitleaks_severity_refinement():
    """
    Verifies that GitleaksAdapter maps rule IDs to appropriate severities:
    critical for high-confidence rules, medium for generic/entropy rules.
    """
    from app.adapters.gitleaks import GitleaksAdapter
    adapter = GitleaksAdapter()

    assert adapter.determine_severity("aws-access-token", "AWS Access Key") == "critical"
    assert adapter.determine_severity("stripe-api-key", "Stripe Key") == "critical"
    assert adapter.determine_severity("github-pat", "GitHub Personal Access Token") == "critical"
    assert adapter.determine_severity("private-key", "RSA Private Key") == "critical"
    
    assert adapter.determine_severity("generic-api-key", "Generic API Key") == "medium"
    assert adapter.determine_severity("high-entropy-string", "Entropy secret") == "medium"

    assert adapter.determine_severity("some-custom-scanner-rule", "Custom Token") == "high"


def test_gitleaks_fp_heuristic():
    """
    Verifies that paths under test/fixture/example or with sample/example extensions are flagged as FP candidates.
    """
    from app.adapters.gitleaks import GitleaksAdapter
    adapter = GitleaksAdapter()

    # Candidate paths
    assert adapter.is_fp_candidate_path("tests/unit/test_auth.py") is True
    assert adapter.is_fp_candidate_path("fixtures/dummy_keys.json") is True
    assert adapter.is_fp_candidate_path("examples/demo.py") is True
    assert adapter.is_fp_candidate_path("node_modules/package/index.js") is True
    assert adapter.is_fp_candidate_path("config/database.yml.example") is True
    assert adapter.is_fp_candidate_path("env.sample") is True

    # Non-candidate path
    assert adapter.is_fp_candidate_path("backend/app/main.py") is False


def test_signup_flow(db_session):
    """
    Verifies that a user can successfully sign up a new organization and admin account.
    """
    email = "new_admin@testsignup.com"
    org_name = "New Test Signup Org"
    payload = {
        "email": email,
        "password": "securepassword123",
        "full_name": "New Admin User",
        "org_name": org_name
    }
    res = client.post("/auth/signup", json=payload)
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["email"] == email
    assert data["full_name"] == "New Admin User"
    assert data["role"] == "admin"
    assert data["org_name"] == org_name
    
    # Verify DB entry exists
    user_id = data["id"]
    org_id = data["org_id"]
    
    # Cleanup DB
    user = db_session.query(User).filter(User.id == user_id).first()
    org = db_session.query(Org).filter(Org.id == org_id).first()
    if user:
        db_session.delete(user)
    if org:
        db_session.delete(org)
    db_session.commit()


def test_signup_duplicate_email(setup_data):
    """
    Verifies that signup fails with a 409 Conflict if the email is already registered.
    """
    payload = {
        "email": setup_data["user_a"].email,
        "password": "anotherpassword123",
        "full_name": "Duplicate User",
        "org_name": "Another Org"
    }
    res = client.post("/auth/signup", json=payload)
    assert res.status_code == 409
    assert "already registered" in res.json()["detail"]


def test_gitleaks_deduplication():
    """
    Verifies that GitleaksAdapter correctly deduplicates the same secret value
    across multiple commits into a single finding.
    """
    from app.adapters.gitleaks import GitleaksAdapter
    adapter = GitleaksAdapter()

    # Same secret in two different commits
    mock_report = """[
        {
            "Description": "AWS Access Key",
            "File": "config/aws.py",
            "StartLine": 10,
            "Secret": "AKIAIOSFODNN7EXAMPLE",
            "Commit": "commit123",
            "RuleID": "aws-access-key"
        },
        {
            "Description": "AWS Access Key",
            "File": "config/aws.py",
            "StartLine": 10,
            "Secret": "AKIAIOSFODNN7EXAMPLE",
            "Commit": "commit456",
            "RuleID": "aws-access-key"
        }
    ]"""

    findings = adapter.parse(mock_report)
    assert len(findings) == 1
    finding = findings[0]
    assert finding["title"] == "Secret Detected: AWS Access Key"
    assert finding["tool"] == "gitleaks"
    
    metadata = finding["metadata"]
    assert metadata["fingerprint"] is not None
    assert len(metadata["occurrences"]) == 2
    assert metadata["occurrences"][0]["commit"] == "commit123"
    assert metadata["occurrences"][1]["commit"] == "commit456"


def test_watchdog_timeout(db_session):
    """
    Verifies that the check_scan_timeout_task correctly marks stuck/running scans as failed.
    """
    from app.tasks.scan_tasks import check_scan_timeout_task
    
    # 1. Create a dummy scan in database in "running" state
    org = Org(name="Timeout Test Org", slug="timeout-test-org")
    db_session.add(org)
    db_session.commit()
    db_session.refresh(org)
    
    scan = Scan(
        org_id=org.id,
        target="https://timeout-test.com",
        scan_types=["vuln"],
        status=ScanStatus.running
    )
    db_session.add(scan)
    db_session.commit()
    db_session.refresh(scan)
    
    # 2. Run the watchdog timeout task
    check_scan_timeout_task(str(scan.id))
    
    # 3. Verify scan status is now failed
    db_session.refresh(scan)
    assert scan.status == ScanStatus.failed
    
    # Clean up DB
    db_session.delete(scan)
    db_session.delete(org)
    db_session.commit()


def test_asset_management_api(setup_data, db_session):
    """
    Verifies creating, listing, and patching asset weights.
    """
    from app.models import Asset
    headers = {"Authorization": f"Bearer {setup_data['token_a']}"}
    
    # 1. Create asset
    payload = {
        "name": "Test Asset X",
        "target": "https://test-asset-x.com",
        "asset_type": "url",
        "asset_weight": 1.5
    }
    res = client.post("/assets", json=payload, headers=headers)
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["name"] == "Test Asset X"
    assert data["asset_weight"] == 1.5
    asset_id = data["id"]
    
    # 2. List assets and assert present
    res_list = client.get("/assets", headers=headers)
    assert res_list.status_code == 200
    assets = res_list.json()
    assert any(a["id"] == asset_id for a in assets)
    
    # 3. Patch asset weight
    patch_payload = {"asset_weight": 2.0}
    res_patch = client.patch(f"/assets/{asset_id}", json=patch_payload, headers=headers)
    assert res_patch.status_code == 200
    patched_data = res_patch.json()
    assert patched_data["asset_weight"] == 2.0
    
    # 4. Patch with invalid weight -> should return 422 validation error
    invalid_patch = {"asset_weight": 3.0}
    res_invalid = client.patch(f"/assets/{asset_id}", json=invalid_patch, headers=headers)
    assert res_invalid.status_code == 422
    
    # Cleanup
    asset = db_session.query(Asset).filter(Asset.id == uuid.UUID(asset_id)).first()
    if asset:
        db_session.delete(asset)
        db_session.commit()


@pytest.fixture(scope="module")
def multi_tenant_setup(db_session):
    # 1. Create two test orgs
    org_1 = Org(name="Audit Org 1", slug="audit-org-1")
    org_2 = Org(name="Audit Org 2", slug="audit-org-2")
    db_session.add_all([org_1, org_2])
    db_session.commit()
    db_session.refresh(org_1)
    db_session.refresh(org_2)
    
    # 2. Create users
    user_1 = User(email="user1@audit.com", full_name="User 1", hashed_password="pw", role="admin", org_id=org_1.id)
    user_2 = User(email="user2@audit.com", full_name="User 2", hashed_password="pw", role="admin", org_id=org_2.id)
    db_session.add_all([user_1, user_2])
    db_session.commit()
    db_session.refresh(user_1)
    db_session.refresh(user_2)
    
    # 3. Create 5 assets for each
    assets_1 = []
    assets_2 = []
    for i in range(5):
        a1 = Asset(org_id=org_1.id, name=f"Org1 Asset {i}", target=f"https://org1-target-{i}.com", asset_type="url")
        a2 = Asset(org_id=org_2.id, name=f"Org2 Asset {i}", target=f"https://org2-target-{i}.com", asset_type="url")
        db_session.add_all([a1, a2])
        assets_1.append(a1)
        assets_2.append(a2)
    db_session.commit()
    
    # 4. Create 5 scans for each
    scans_1 = []
    scans_2 = []
    for i in range(5):
        s1 = Scan(org_id=org_1.id, asset_id=assets_1[i].id, target=assets_1[i].target, scan_types=["vuln"], status=ScanStatus.complete)
        s2 = Scan(org_id=org_2.id, asset_id=assets_2[i].id, target=assets_2[i].target, scan_types=["vuln"], status=ScanStatus.complete)
        db_session.add_all([s1, s2])
        scans_1.append(s1)
        scans_2.append(s2)
    db_session.commit()
    
    # 5. Create 5 findings for each
    findings_1 = []
    findings_2 = []
    for i in range(5):
        f1 = Finding(org_id=org_1.id, scan_id=scans_1[i].id, asset_id=assets_1[i].id, title=f"Org1 Finding {i}", severity="high", tool="nuclei", exploit_validated=False)
        f2 = Finding(org_id=org_2.id, scan_id=scans_2[i].id, asset_id=assets_2[i].id, title=f"Org2 Finding {i}", severity="high", tool="nuclei", exploit_validated=False)
        db_session.add_all([f1, f2])
        findings_1.append(f1)
        findings_2.append(f2)
    db_session.commit()
    
    # Refresh to load IDs
    for items in [assets_1, assets_2, scans_1, scans_2, findings_1, findings_2]:
        for item in items:
            db_session.refresh(item)
            
    token_1 = create_access_token({"sub": str(user_1.id), "org_id": str(org_1.id), "role": "admin"})
    token_2 = create_access_token({"sub": str(user_2.id), "org_id": str(org_2.id), "role": "admin"})
    
    data = {
        "org_1": org_1,
        "org_2": org_2,
        "token_1": token_1,
        "token_2": token_2,
        "assets_1": assets_1,
        "assets_2": assets_2,
        "scans_1": scans_1,
        "scans_2": scans_2,
        "findings_1": findings_1,
        "findings_2": findings_2,
    }
    
    yield data
    
    # Cleanup
    for items in [findings_1, findings_2, scans_1, scans_2, assets_1, assets_2]:
        for item in items:
            db_session.delete(item)
    db_session.delete(user_1)
    db_session.delete(user_2)
    db_session.delete(org_1)
    db_session.delete(org_2)
    db_session.commit()


def test_multi_tenant_security_audit(multi_tenant_setup, db_session):
    """
    Attempts cross-tenant access from Org 2 to Org 1's resources on EVERY endpoint
    and verifies that it returns 403 or 404 (isolation enforced).
    """
    token_2 = multi_tenant_setup["token_2"]
    headers_2 = {"Authorization": f"Bearer {token_2}"}
    
    target_scan = multi_tenant_setup["scans_1"][0]
    target_asset = multi_tenant_setup["assets_1"][0]
    target_finding = multi_tenant_setup["findings_1"][0]
    
    # ─── Scans Endpoints ───
    # GET /scans/{id}
    res = client.get(f"/scans/{target_scan.id}", headers=headers_2)
    assert res.status_code in (403, 404)
    
    # GET /scans/{id}/progress
    res = client.get(f"/scans/{target_scan.id}/progress", headers=headers_2)
    assert res.status_code in (403, 404)
    
    # GET /scans/{id}/findings
    res = client.get(f"/scans/{target_scan.id}/findings", headers=headers_2)
    assert res.status_code in (403, 404)
    
    # ─── Assets Endpoints ───
    # GET /assets/{id}
    res = client.get(f"/assets/{target_asset.id}", headers=headers_2)
    assert res.status_code in (403, 404)
    
    # PATCH /assets/{id}
    res = client.patch(f"/assets/{target_asset.id}", json={"asset_weight": 2.0}, headers=headers_2)
    assert res.status_code in (403, 404)
    
    # GET /assets/{id}/findings
    res = client.get(f"/assets/{target_asset.id}/findings", headers=headers_2)
    assert res.status_code in (403, 404)
    
    # ─── Findings Endpoints ───
    # GET /findings/{id}
    res = client.get(f"/findings/{target_finding.id}", headers=headers_2)
    assert res.status_code in (403, 404)
    
    # PATCH /findings/{id}
    res = client.patch(f"/findings/{target_finding.id}", json={"status": "false_positive"}, headers=headers_2)
    assert res.status_code in (403, 404)
    
    # POST /findings/{id}/tags
    res = client.post(f"/findings/{target_finding.id}/tags", json={"name": "audit-leak"}, headers=headers_2)
    assert res.status_code in (403, 404)
    
    # DELETE /findings/{id}/tags/{name}
    res = client.delete(f"/findings/{target_finding.id}/tags/audit-leak", headers=headers_2)
    assert res.status_code in (403, 404)
    
    # POST /findings/{id}/create-jira-ticket
    res = client.post(f"/findings/{target_finding.id}/create-jira-ticket", headers=headers_2)
    assert res.status_code in (403, 404)
    
    # POST /findings/{id}/create-fix-pr
    res = client.post(f"/findings/{target_finding.id}/create-fix-pr", headers=headers_2)
    assert res.status_code in (403, 404)


def test_opengroup_scan_creation(client, setup_data):
    """
    Test creating a scan with the new 'opengroup' scan_type.
    """
    headers_a = {"Authorization": f"Bearer {setup_data['token_a']}"}
    payload = {
        "target": "github.com/org/repo-with-sast",
        "scan_types": ["opengroup", "vuln"],
    }
    with patch("app.routers.scans.run_scan_task.delay") as mock_delay:
        mock_task = MagicMock()
        mock_task.id = "mock-opengroup-task-id-456"
        mock_delay.return_value = mock_task

        res = client.post("/scans", json=payload, headers=headers_a)
        assert res.status_code == 201, res.text
        scan_data = res.json()
        assert "opengroup" in scan_data["scan_types"]
        assert scan_data["status"] == "queued"
        mock_delay.assert_called_once()

    from app.adapters.opengroup import OpenGroupAdapter
    adapter = OpenGroupAdapter()
    assert adapter.tool_name == "opengroup"


def test_opengrep_scan_creation(client, setup_data):
    """
    Test creating a scan with the 'opengrep' scan_type.
    """
    headers_a = {"Authorization": f"Bearer {setup_data['token_a']}"}
    payload = {
        "target": "github.com/org/repo-with-opengrep",
        "scan_types": ["opengrep", "vuln"],
    }
    with patch("app.routers.scans.run_scan_task.delay") as mock_delay:
        mock_task = MagicMock()
        mock_task.id = "mock-opengrep-task-id-789"
        mock_delay.return_value = mock_task

        res = client.post("/scans", json=payload, headers=headers_a)
        assert res.status_code == 201, res.text
        scan_data = res.json()
        assert "opengrep" in scan_data["scan_types"]
        assert scan_data["status"] == "queued"
        mock_delay.assert_called_once()

    from app.adapters.opengrep import OpengrepAdapter, OpenGrepAdapter
    adapter = OpengrepAdapter()
    assert adapter.tool_name == "opengrep"
    alias = OpenGrepAdapter()
    assert alias.tool_name == "opengrep"





