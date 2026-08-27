# tests/test_pdf_report.py

import os
import sys
import unittest
from datetime import datetime
from uuid import uuid4

# Ensure app is in path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.models.scan import Scan, ScanStatus
from app.models.finding import Finding, Severity, Reachability
from app.reports.pdf import ScanReport

class MockScan:
    def __init__(self, target, scan_types, created_at, exec_summary=None):
        self.id = uuid4()
        self.org_id = uuid4()
        self.target = target
        self.scan_types = scan_types
        self.created_at = created_at
        self.exec_summary = exec_summary
        self.status = ScanStatus.complete
        self.findings = []

    @property
    def findings_count(self) -> dict:
        counts = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
        for f in self.findings:
            sev_val = f.severity.value if hasattr(f.severity, "value") else str(f.severity)
            if sev_val in counts:
                counts[sev_val] += 1
        return counts


class MockFinding:
    def __init__(self, title, severity, tool, cve_id=None, priority_score=0.0, reachability=Reachability.uncertain, ai_plain_english=None, ai_remediation=None, reachability_reason=None):
        self.id = uuid4()
        self.title = title
        self.severity = severity
        self.tool = tool
        self.cve_id = cve_id
        self.priority_score = priority_score
        self.reachability = reachability
        self.ai_plain_english = ai_plain_english
        self.ai_remediation = ai_remediation or []
        self.reachability_reason = reachability_reason
        self.status = "new"


class TestPDFReport(unittest.TestCase):
    def test_generate_pdf_report(self):
        # Create a mock scan
        scan = MockScan(
            target="http://example.com/test-repo.git",
            scan_types=["vuln", "sca", "secret"],
            created_at=datetime.utcnow(),
            exec_summary="CyberSigma security platform analyzed the target repository and discovered multiple security findings. There are two critical vulnerabilities involving Remote Code Execution (RCE) and sql injection. Security administrators should patch immediately to protect active infrastructure."
        )

        # Mock findings
        findings = [
            MockFinding(
                title="Remote Code Execution via deserialization in Jackson Databind",
                severity=Severity.critical,
                tool="trivy",
                cve_id="CVE-2023-4586",
                priority_score=9.4,
                reachability=Reachability.reachable,
                ai_plain_english="An attacker can execute arbitrary code on the hosting server by exploiting an unsafe deserialization process in the Jackson Databind library.",
                ai_remediation=[
                    "Upgrade com.fasterxml.jackson.core:jackson-databind to version 2.15.2 or newer.",
                    "Verify serialization contexts restrict deserialization input.",
                    "Recommended Patch Diff:\n"
                    "diff --git a/pom.xml b/pom.xml\n"
                    "--- a/pom.xml\n"
                    "+++ b/pom.xml\n"
                    "@@ -10,3 +10,3 @@\n"
                    " <dependency>\n"
                    "-  <version>2.14.1</version>\n"
                    "+  <version>2.15.2</version>\n"
                    " </dependency>"
                ],
                reachability_reason="Static analysis detected a direct dependency and active method invocation import path in Jackson serialization utilities."
            ),
            MockFinding(
                title="SQL Injection in login controller",
                severity=Severity.critical,
                tool="nuclei",
                cve_id=None,
                priority_score=9.0,
                reachability=Reachability.uncertain,
                ai_plain_english="Raw SQL query concatenation allows unauthorized database inspection and data dumping.",
                ai_remediation=[
                    "Use parameterized prepared statements.",
                    "Ensure user inputs are sanitized."
                ],
                reachability_reason="Static AST analysis could not resolve DB driver interface bindings."
            ),
            MockFinding(
                title="GitHub API Token exposed in source files",
                severity=Severity.high,
                tool="gitleaks",
                cve_id=None,
                priority_score=8.2,
                reachability=Reachability.unreachable,
                ai_plain_english="A plain-text personal access token was discovered in testing source files. This could allow unauthorized access to repos.",
                ai_remediation=[
                    "Revoke the exposed API token immediately.",
                    "Add token to repository environment secrets instead."
                ]
            ),
        ]
        
        # Link findings to scan
        scan.findings = findings

        # Generate Executive Report PDF
        exec_report = ScanReport(scan, findings, template="executive")
        exec_pdf_bytes = exec_report.generate()
        self.assertGreater(len(exec_pdf_bytes), 0)

        # Generate Technical Report PDF
        tech_report = ScanReport(scan, findings, template="technical")
        tech_pdf_bytes = tech_report.generate()
        self.assertGreater(len(tech_pdf_bytes), 0)

        # Output to local dir for debugging / verification
        test_dir = os.path.dirname(os.path.abspath(__file__))
        output_exec = os.path.join(test_dir, "test_output_executive.pdf")
        output_tech = os.path.join(test_dir, "test_output_technical.pdf")
        
        with open(output_exec, "wb") as f:
            f.write(exec_pdf_bytes)
            
        with open(output_tech, "wb") as f:
            f.write(tech_pdf_bytes)

        print(f"Generated test executive report at: {output_exec}")
        print(f"Generated test technical report at: {output_tech}")
        
        self.assertTrue(os.path.exists(output_exec))
        self.assertTrue(os.path.exists(output_tech))


if __name__ == "__main__":
    unittest.main()
