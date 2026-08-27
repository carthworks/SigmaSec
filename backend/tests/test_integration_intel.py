import uuid
import time
from unittest.mock import MagicMock, patch
import pytest

from app.models import Severity, Scan, Finding
from app.tasks.scan_tasks import enrich_findings_task

@patch("app.tasks.scan_tasks.SessionLocal")
@patch("app.tasks.scan_tasks.NVDClient")
@patch("app.tasks.scan_tasks.KEVClient")
@patch("app.tasks.scan_tasks.EPSSClient")
def test_scan_vulnerable_target_jquery(mock_epss_class, mock_kev_class, mock_nvd_class, mock_session_local):
    """
    Integration test: scan a known-vulnerable target (e.g. test app with old jQuery), 
    confirm CVSS+KEV+EPSS+rank are all populated.
    """
    mock_db = MagicMock()
    mock_session_local.return_value = mock_db
    
    mock_nvd = mock_nvd_class.return_value
    mock_kev = mock_kev_class.return_value
    mock_epss = mock_epss_class.return_value

    # Mock responses for jQuery CVE-2020-11022 (known vulnerable)
    mock_epss.get_epss_scores.return_value = {
        "CVE-2020-11022": {"epss_score": 0.45, "epss_percentile": 0.98}
    }
    mock_kev.is_cve_kev.return_value = True
    mock_kev.get_kev_due_date.return_value = "2022-05-28"
    mock_nvd.get_cve_metrics.return_value = {
        "cvss_v3": {"baseScore": 6.1, "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N"},
        "description": "jQuery vulnerabilities"
    }

    # Setup scan and finding
    scan_id = uuid.uuid4()
    mock_asset = MagicMock()
    mock_asset.asset_weight = 1.0
    
    mock_scan = MagicMock(spec=Scan)
    mock_scan.id = scan_id
    mock_scan.asset = mock_asset
    
    mock_finding = MagicMock(spec=Finding)
    mock_finding.cve_id = "CVE-2020-11022"
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

    # Verify lookups and database writes
    assert mock_finding.cvss_score == 6.1
    assert mock_finding.cvss_vector == "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N"
    assert mock_finding.epss_score == 0.45
    assert mock_finding.epss_percentile == 0.98
    assert mock_finding.kev_listed is True
    assert mock_finding.kev_due_date == "2022-05-28"
    assert mock_finding.description == "jQuery vulnerabilities"

    # Verify priority score math:
    # epss = 0.45, cvss = 6.1, kev = True (2x), asset_weight = 1.0
    # priority_score = round(0.45 * 6.1 * 2 * 1.0, 3) = 5.49
    assert mock_finding.priority_score == 5.49

    # Verify ranking query is called
    assert mock_db.execute.call_count == 1
    assert mock_db.commit.call_count == 2


@patch("app.tasks.scan_tasks.SessionLocal")
@patch("app.tasks.scan_tasks.NVDClient")
@patch("app.tasks.scan_tasks.KEVClient")
@patch("app.tasks.scan_tasks.EPSSClient")
def test_performance_100_findings_enrichment(mock_epss_class, mock_kev_class, mock_nvd_class, mock_session_local):
    """
    Performance test: 100-finding scan completes enrichment in <60s
    """
    mock_db = MagicMock()
    mock_session_local.return_value = mock_db
    
    mock_nvd = mock_nvd_class.return_value
    mock_kev = mock_kev_class.return_value
    mock_epss = mock_epss_class.return_value

    # Setup mocks responses
    mock_epss.get_epss_scores.return_value = {
        f"CVE-2023-{i:04d}": {"epss_score": 0.01 * (i % 100), "epss_percentile": 0.01 * (i % 100)}
        for i in range(100)
    }
    mock_kev.is_cve_kev.return_value = False
    mock_kev.get_kev_due_date.return_value = None
    mock_nvd.get_cve_metrics.return_value = {
        "cvss_v3": {"baseScore": 5.0, "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N"},
        "description": "mock vuln"
    }

    # Setup scan and 100 findings
    scan_id = uuid.uuid4()
    mock_asset = MagicMock()
    mock_asset.asset_weight = 1.0
    
    mock_scan = MagicMock(spec=Scan)
    mock_scan.id = scan_id
    mock_scan.asset = mock_asset
    
    mock_findings = []
    for i in range(100):
        f = MagicMock(spec=Finding)
        f.cve_id = f"CVE-2023-{i:04d}"
        f.cvss_score = None
        f.cvss_vector = None
        f.description = None
        f.epss_score = None
        f.epss_percentile = None
        f.kev_listed = False
        f.kev_due_date = None
        f.priority_score = None
        mock_findings.append(f)

    # Database query mocks
    def mock_query(model):
        q = MagicMock()
        if model == Scan:
            q.filter.return_value.first.return_value = mock_scan
        elif model == Finding:
            q.filter.return_value.all.return_value = mock_findings
        return q

    mock_db.query.side_effect = mock_query

    # Run and time the enrichment task
    start_time = time.time()
    result = enrich_findings_task(str(scan_id))
    elapsed_time = time.time() - start_time

    # Assertions
    assert result["status"] == "success"
    assert result["enriched_count"] == 100
    assert elapsed_time < 60.0, f"Enrichment took too long: {elapsed_time:.2f}s"
    print(f"Performance: 100 findings enriched in {elapsed_time:.4f} seconds.")
