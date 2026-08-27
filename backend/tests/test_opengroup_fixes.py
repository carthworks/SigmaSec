# backend/tests/test_opengroup_fixes.py

import os
import json
import uuid
import tempfile
import pytest
from unittest.mock import patch, MagicMock

from app.database import SessionLocal, engine
from app.models import Base, Scan, Finding, ScanStatus, Severity, FindingStatus, Reachability
from app.adapters.opengroup import OpenGroupAdapter
from app.adapters.runner import _redact_sensitive, run_logged_command
from app.tasks.scan_tasks import save_findings, enrich_findings_task, ai_enrichment_task
from app.adapters import config


def test_redact_sensitive_credentials():
    raw_log = "API_KEY = 'sk-proj-1234567890abcdef' Bearer eyJhbGciOiJIUzI1NiJ9.test"
    redacted = _redact_sensitive(raw_log)
    assert "sk-proj-1234567890abcdef" not in redacted
    assert "Bearer [REDACTED]" in redacted


def test_opengroup_adapter_parse_severity_critical():
    adapter = OpenGroupAdapter()
    item = {
        "check_id": "rules.python.hardcoded-secret",
        "path": "app/auth.py",
        "start": {"line": 15},
        "extra": {
            "message": "Hardcoded secret detected",
            "severity": "ERROR",
            "metadata": {
                "severity": "CRITICAL",
                "impact": "HIGH"
            }
        }
    }
    scan_id = str(uuid.uuid4())
    org_id = str(uuid.uuid4())
    asset_id = str(uuid.uuid4())

    finding = adapter._parse_finding(item, scan_id, org_id, asset_id)
    assert finding["severity"] == "critical"
    assert finding["metadata"]["check_id"] == "rules.python.hardcoded-secret"
    assert finding["metadata"]["file_path"] == "app/auth.py"
    assert finding["metadata"]["line"] == "15"


def test_opengroup_adapter_run_local_and_config(monkeypatch):
    adapter = OpenGroupAdapter()

    # Create temporary local repo directory
    with tempfile.TemporaryDirectory() as tmp_dir:
        test_file = os.path.join(tmp_dir, "app.py")
        with open(test_file, "w") as f:
            f.write("SECRET_KEY = 'super-secret-token-key'\n")

        mock_json_out = json.dumps({
            "results": [
                {
                    "check_id": "python.hardcoded-secret",
                    "path": "app.py",
                    "start": {"line": 1},
                    "extra": {
                        "message": "Hardcoded secret in code",
                        "severity": "WARNING",
                        "metadata": {"severity": "HIGH"}
                    }
                }
            ]
        })

        scan_cmd_executed = []

        def mock_run_logged_command(scan_id, cmd, timeout=600, capture_stdout=True, cwd=None, env=None):
            scan_cmd_executed.append(cmd)
            from app.adapters.runner import CommandResult
            return CommandResult(stdout=mock_json_out, returncode=0, timed_out=False)

        monkeypatch.setattr("app.adapters.opengroup.run_logged_command", mock_run_logged_command)

        findings = adapter.run(
            target=tmp_dir,
            scan_id=str(uuid.uuid4()),
            org_id=str(uuid.uuid4()),
            asset_id=str(uuid.uuid4()),
            options={"ruleset": "p/security-audit"}
        )

        assert len(findings) == 1
        assert "--config" in scan_cmd_executed[0]
        assert "p/security-audit" in scan_cmd_executed[0]
        assert findings[0]["severity"] == "high"
        assert findings[0]["tool"] == "opengroup"


def test_save_findings_upsert_and_reconciliation(setup_db):
    db = setup_db
    org_id = str(uuid.uuid4())
    scan_id_1 = str(uuid.uuid4())
    scan_id_2 = str(uuid.uuid4())
    asset_id = str(uuid.uuid4())

    adapter = OpenGroupAdapter()
    fp_1 = adapter.make_fingerprint("opengroup", asset_id, "check.rule.1", "src/auth.py", "10")
    fp_2 = adapter.make_fingerprint("opengroup", asset_id, "check.rule.2", "src/db.py", "25")

    raw_findings_run_1 = [
        {
            "id": str(uuid.uuid4()),
            "org_id": org_id,
            "scan_id": scan_id_1,
            "asset_id": asset_id,
            "fingerprint": fp_1,
            "title": "Secret 1",
            "severity": "high",
            "tool": "opengroup",
            "url": "src/auth.py#10",
            "description": "Hardcoded secret 1",
            "metadata": {"file_path": "src/auth.py", "line": "10", "check_id": "check.rule.1"},
        },
        {
            "id": str(uuid.uuid4()),
            "org_id": org_id,
            "scan_id": scan_id_1,
            "asset_id": asset_id,
            "fingerprint": fp_2,
            "title": "Secret 2",
            "severity": "medium",
            "tool": "opengroup",
            "url": "src/db.py#25",
            "description": "Hardcoded secret 2",
            "metadata": {"file_path": "src/db.py", "line": "25", "check_id": "check.rule.2"},
        },
    ]

    # Save Run 1
    save_findings(db, raw_findings_run_1)
    db_findings = db.query(Finding).filter(Finding.asset_id == uuid.UUID(asset_id)).all()
    assert len(db_findings) == 2
    assert all(f.status == FindingStatus.new for f in db_findings)
    assert all(f.priority_score > 0.0 for f in db_findings)

    # Save Run 2 (Secret 1 remains, Secret 2 resolved/absent)
    raw_findings_run_2 = [
        {
            "id": str(uuid.uuid4()),
            "org_id": org_id,
            "scan_id": scan_id_2,
            "asset_id": asset_id,
            "fingerprint": fp_1,
            "title": "Secret 1 Updated Title",
            "severity": "critical",
            "tool": "opengroup",
            "url": "src/auth.py#10",
            "description": "Hardcoded secret 1",
            "metadata": {"file_path": "src/auth.py", "line": "10", "check_id": "check.rule.1"},
        }
    ]

    save_findings(db, raw_findings_run_2)

    db_findings_after = db.query(Finding).filter(Finding.asset_id == uuid.UUID(asset_id)).all()
    assert len(db_findings_after) == 2  # No duplicate rows created!

    finding_1 = db.query(Finding).filter(Finding.fingerprint == fp_1).first()
    finding_2 = db.query(Finding).filter(Finding.fingerprint == fp_2).first()

    assert finding_1.status == FindingStatus.new
    assert finding_1.severity == Severity.critical
    assert finding_1.title == "Secret 1 Updated Title"

    # Reconciliation pass marked missing finding_2 as Fixed!
    assert finding_2.status == FindingStatus.fixed
