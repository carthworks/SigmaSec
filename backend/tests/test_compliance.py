# backend/tests/test_compliance.py

import uuid
import pytest
from app.compliance.mapper import map_finding_to_controls, compute_compliance_summary, FRAMEWORKS


class DummyFinding:
    def __init__(self, tool, title, cve_id=None, severity="high", metadata=None):
        self.id = uuid.uuid4()
        self.tool = tool
        self.title = title
        self.cve_id = cve_id
        self.severity = severity
        self.scan_metadata = metadata or {}
        self.ai_severity_override = None


def test_map_finding_to_controls_gitleaks():
    f = DummyFinding(tool="gitleaks", title="AWS Secret Access Key Leaked")
    mapped = map_finding_to_controls(f)

    assert "CC6.1" in mapped["soc2"]
    assert "Req-8.3" in mapped["pci_dss"]
    assert "A.5.15" in mapped["iso_27001"]
    assert "IA-5" in mapped["nist_800_53"]


def test_map_finding_to_controls_opengroup():
    f = DummyFinding(tool="opengroup", title="SQL Injection in auth handler", metadata={"check_id": "rules.python.sqli"})
    mapped = map_finding_to_controls(f)

    assert "CC6.8" in mapped["soc2"]
    assert "Req-6.3" in mapped["pci_dss"]
    assert "A.8.28" in mapped["iso_27001"]
    assert "SA-11" in mapped["nist_800_53"]


def test_compute_compliance_summary():
    findings = [
        DummyFinding(tool="gitleaks", title="Secret Leak", severity="critical"),
        DummyFinding(tool="opengroup", title="XSS flaw", severity="low"),
    ]

    summary = compute_compliance_summary(findings)
    assert "soc2" in summary
    assert "pci_dss" in summary
    assert "iso_27001" in summary
    assert "nist_800_53" in summary

    soc2 = summary["soc2"]
    assert soc2["total_controls"] == 4
    assert soc2["readiness_score"] < 100.0  # Because critical finding maps to CC6.1 making it non-compliant
