# backend/tests/test_opengrep_adapter.py

import os
import json
import uuid
import tempfile
import pytest

from app.models import Finding, FindingStatus, Severity
from app.adapters import OpengrepAdapter, OpenGrepAdapter, OpenGroupAdapter
from app.compliance.mapper import map_finding_to_controls


def test_opengrep_adapter_initialization():
    adapter = OpengrepAdapter()
    assert adapter.tool_name == "opengrep"

    alias_adapter = OpenGrepAdapter()
    assert alias_adapter.tool_name == "opengrep"

    legacy_adapter = OpenGroupAdapter()
    assert legacy_adapter.tool_name == "opengroup"


def test_opengrep_adapter_parse_finding():
    adapter = OpengrepAdapter()
    item = {
        "check_id": "rules.python.sql-injection",
        "path": "app/db.py",
        "start": {"line": 42},
        "extra": {
            "message": "Potential SQL Injection detected",
            "severity": "ERROR",
            "metadata": {
                "severity": "HIGH",
                "category": "security",
                "cve": "CVE-2023-12345",
                "shortlink": "https://sg.run/sql-inject"
            }
        }
    }
    scan_id = str(uuid.uuid4())
    org_id = str(uuid.uuid4())
    asset_id = str(uuid.uuid4())

    finding = adapter._parse_finding(item, scan_id, org_id, asset_id)
    assert finding["tool"] == "opengrep"
    assert finding["severity"] == "high"
    assert finding["cve_id"] == "CVE-2023-12345"
    assert finding["url"] == "https://sg.run/sql-inject"
    assert finding["metadata"]["check_id"] == "rules.python.sql-injection"
    assert finding["metadata"]["file_path"] == "app/db.py"
    assert finding["metadata"]["line"] == "42"


def test_opengrep_adapter_run_local(monkeypatch):
    adapter = OpengrepAdapter()

    with tempfile.TemporaryDirectory() as tmp_dir:
        test_file = os.path.join(tmp_dir, "vuln.py")
        with open(test_file, "w") as f:
            f.write("query = f'SELECT * FROM users WHERE name = {user_input}'\n")

        mock_json_out = json.dumps({
            "results": [
                {
                    "check_id": "python.sqli.fstring",
                    "path": "vuln.py",
                    "start": {"line": 1},
                    "extra": {
                        "message": "Direct f-string in SQL query",
                        "severity": "ERROR",
                        "metadata": {"severity": "CRITICAL"}
                    }
                }
            ]
        })

        scan_cmd_executed = []

        def mock_run_logged_command(scan_id, cmd, timeout=600, capture_stdout=True, cwd=None, env=None):
            scan_cmd_executed.append(cmd)
            from app.adapters.runner import CommandResult
            return CommandResult(stdout=mock_json_out, returncode=0, timed_out=False)

        monkeypatch.setattr("app.adapters.opengrep.run_logged_command", mock_run_logged_command)

        findings = adapter.run(
            target=tmp_dir,
            scan_id=str(uuid.uuid4()),
            org_id=str(uuid.uuid4()),
            asset_id=str(uuid.uuid4()),
            options={"ruleset": "p/ci"}
        )

        assert len(findings) == 1
        assert "--config" in scan_cmd_executed[0]
        assert "p/ci" in scan_cmd_executed[0]
        assert findings[0]["severity"] == "critical"
        assert findings[0]["tool"] == "opengrep"


def test_opengrep_compliance_mapping():
    class DummyFinding:
        def __init__(self, tool, title, metadata=None, cve_id=None, severity="medium"):
            self.tool = tool
            self.title = title
            self.metadata = metadata or {}
            self.cve_id = cve_id
            self.severity = severity

    f = DummyFinding(tool="opengrep", title="XSS vulnerability in template", metadata={"check_id": "rules.python.xss"})
    controls = map_finding_to_controls(f)
    assert "CC6.8" in controls["soc2"]
    assert "Req-6.3" in controls["pci_dss"]
    assert "A.8.28" in controls["iso_27001"]
    assert "SA-11" in controls["nist_800_53"]


def test_opengrep_reconciliation_pass(setup_db):
    from app.tasks.scan_tasks import save_findings
    db = setup_db
    org_id = str(uuid.uuid4())
    scan_id_1 = str(uuid.uuid4())
    scan_id_2 = str(uuid.uuid4())
    asset_id = str(uuid.uuid4())

    adapter = OpengrepAdapter()
    fp_1 = adapter.make_fingerprint("opengrep", asset_id, "check.rule.1", "src/auth.py", "10")
    fp_2 = adapter.make_fingerprint("opengrep", asset_id, "check.rule.2", "src/db.py", "25")

    raw_findings_1 = [
        {
            "id": str(uuid.uuid4()),
            "org_id": org_id,
            "scan_id": scan_id_1,
            "asset_id": asset_id,
            "fingerprint": fp_1,
            "title": "Opengrep finding 1",
            "severity": "high",
            "tool": "opengrep",
            "url": "src/auth.py#10",
            "description": "Hardcoded secret",
            "metadata": {"file_path": "src/auth.py", "line": "10", "check_id": "check.rule.1"},
        },
        {
            "id": str(uuid.uuid4()),
            "org_id": org_id,
            "scan_id": scan_id_1,
            "asset_id": asset_id,
            "fingerprint": fp_2,
            "title": "Opengrep finding 2",
            "severity": "medium",
            "tool": "opengrep",
            "url": "src/db.py#25",
            "description": "Insecure config",
            "metadata": {"file_path": "src/db.py", "line": "25", "check_id": "check.rule.2"},
        },
    ]

    save_findings(db, raw_findings_1)
    db_findings = db.query(Finding).filter(Finding.asset_id == uuid.UUID(asset_id)).all()
    assert len(db_findings) == 2
    assert all(f.status == FindingStatus.new for f in db_findings)

    # In scan 2, finding 2 is resolved
    raw_findings_2 = [
        {
            "id": str(uuid.uuid4()),
            "org_id": org_id,
            "scan_id": scan_id_2,
            "asset_id": asset_id,
            "fingerprint": fp_1,
            "title": "Opengrep finding 1",
            "severity": "high",
            "tool": "opengrep",
            "url": "src/auth.py#10",
            "description": "Hardcoded secret",
            "metadata": {"file_path": "src/auth.py", "line": "10", "check_id": "check.rule.1"},
        }
    ]

    save_findings(db, raw_findings_2)
    finding_1 = db.query(Finding).filter(Finding.fingerprint == fp_1).first()
    finding_2 = db.query(Finding).filter(Finding.fingerprint == fp_2).first()

    assert finding_1.status == FindingStatus.new
    assert finding_2.status == FindingStatus.fixed
