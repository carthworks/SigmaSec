import uuid
from unittest.mock import MagicMock, patch
import pytest

from app.models import Severity, Scan, Finding
from app.tasks.scan_tasks import save_findings, enrich_findings_task

@pytest.fixture
def mock_db():
    return MagicMock()

def test_save_findings_base(mock_db):
    finding_id = str(uuid.uuid4())
    org_id = str(uuid.uuid4())
    scan_id = str(uuid.uuid4())
    findings = [
        {
            "id": finding_id,
            "org_id": org_id,
            "scan_id": scan_id,
            "title": "Vulnerability title",
            "severity": "high",
            "cve_id": "CVE-2023-38606",
            "tool": "trivy"
        }
    ]

    save_findings(mock_db, findings)

    assert mock_db.add.call_count == 1
    added_finding = mock_db.add.call_args[0][0]
    assert added_finding.cve_id == "CVE-2023-38606"
    assert mock_db.commit.call_count == 1

@patch("app.tasks.scan_tasks.SessionLocal")
@patch("app.tasks.scan_tasks.NVDClient")
@patch("app.tasks.scan_tasks.KEVClient")
@patch("app.tasks.scan_tasks.EPSSClient")
def test_enrich_findings_task(mock_epss_class, mock_kev_class, mock_nvd_class, mock_session_local):
    # Setup mocks
    mock_db = MagicMock()
    mock_session_local.return_value = mock_db
    
    mock_nvd = mock_nvd_class.return_value
    mock_kev = mock_kev_class.return_value
    mock_epss = mock_epss_class.return_value

    # Mock responses
    mock_epss.get_epss_scores.return_value = {
        "CVE-2023-38606": {"epss_score": 0.05, "epss_percentile": 0.85}
    }
    mock_kev.is_cve_kev.return_value = True
    mock_kev.get_kev_due_date.return_value = "2023-08-15"
    mock_nvd.get_cve_metrics.return_value = {
        "cvss_v3": {"baseScore": 7.8, "vectorString": "CVSS:3.1/AV:L/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:H"},
        "description": "Apple AppleTV vulnerability"
    }

    # Setup scan and finding
    scan_id = uuid.uuid4()
    mock_asset = MagicMock()
    mock_asset.asset_weight = 1.5
    
    mock_scan = MagicMock(spec=Scan)
    mock_scan.id = scan_id
    mock_scan.asset = mock_asset
    
    mock_finding = MagicMock(spec=Finding)
    mock_finding.cve_id = "CVE-2023-38606"
    mock_finding.cvss_score = None
    mock_finding.cvss_vector = None
    mock_finding.description = None
    mock_finding.epss_score = None
    mock_finding.epss_percentile = None
    mock_finding.kev_listed = False
    mock_finding.kev_due_date = None
    mock_finding.priority_score = None

    # Database query mocks
    def mock_query(model):
        q = MagicMock()
        if model == Scan:
            q.filter.return_value.first.return_value = mock_scan
        elif model == Finding:
            q.filter.return_value.all.return_value = [mock_finding]
        return q

    mock_db.query.side_effect = mock_query

    # Run the enrichment task
    result = enrich_findings_task(str(scan_id))

    # Assertions
    assert result["status"] == "success"
    assert result["enriched_count"] == 1

    # Verify lookups
    mock_epss.get_epss_scores.assert_called_once_with(["CVE-2023-38606"])
    mock_kev.is_cve_kev.assert_called_once_with("CVE-2023-38606")
    mock_kev.get_kev_due_date.assert_called_once_with("CVE-2023-38606")
    mock_nvd.get_cve_metrics.assert_called_once_with("CVE-2023-38606")

    # Verify updates on the finding object
    assert mock_finding.cvss_score == 7.8
    assert mock_finding.cvss_vector == "CVSS:3.1/AV:L/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:H"
    assert mock_finding.epss_score == 0.05
    assert mock_finding.epss_percentile == 0.85
    assert mock_finding.kev_listed is True
    assert mock_finding.kev_due_date == "2023-08-15"
    assert mock_finding.description == "Apple AppleTV vulnerability"

    # Verify priority score math:
    # epss = 0.05, cvss = 7.8, kev = True (multiplier = 2), asset_weight = 1.5
    # priority_score = round(0.05 * 7.8 * 2 * 1.5, 3) = round(1.17, 3) = 1.17
    assert mock_finding.priority_score == 1.17

    # Verify rank update query
    assert mock_db.execute.call_count == 1
    assert mock_db.commit.call_count == 2
