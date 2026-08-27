import sys
import os

from app.adapters.trivy import TrivyAdapter

mock_trivy_output = """
{
  "SchemaVersion": 2,
  "Results": [
    {
      "Target": "nginx:1.24 (debian 12.0)",
      "Vulnerabilities": [
        {
          "VulnerabilityID": "CVE-2023-45853",
          "PkgName": "zlib1g",
          "InstalledVersion": "1:1.2.13.dfsg-1",
          "FixedVersion": "1:1.2.13.dfsg-1+deb12u1",
          "Severity": "CRITICAL",
          "Title": "zlib: integer overflow in zipOpenNewFileInZip4_64",
          "Description": "An integer overflow...",
          "PrimaryURL": "https://avd.aquasecurity.github.io/appshield/vulnerabilities/CVE-2023-45853"
        },
        {
          "VulnerabilityID": "CVE-2023-12345",
          "PkgName": "libssl3",
          "InstalledVersion": "3.0.9-1",
          "FixedVersion": "3.0.9-1+deb12u1",
          "Severity": "HIGH",
          "Title": "openssl: buffer overflow",
          "Description": "Some buffer issue",
          "PrimaryURL": "https://openssl.org"
        }
      ]
    }
  ]
}
"""

def run_test():
    adapter = TrivyAdapter()
    findings = adapter.parse(mock_trivy_output)
    
    print(f"Total parsed findings: {len(findings)}")
    assert len(findings) == 2, "Should parse 2 findings"
    
    # Check critical finding
    f1 = findings[0]
    assert f1["title"] == "zlib: integer overflow in zipOpenNewFileInZip4_64", "Title mismatch"
    assert f1["severity"] == "critical", "Severity mismatch"
    assert f1["cve_id"] == "CVE-2023-45853", "CVE ID mismatch"
    assert f1["tool"] == "trivy", "Tool mismatch"
    assert f1["url"] == "https://avd.aquasecurity.github.io/appshield/vulnerabilities/CVE-2023-45853", "URL mismatch"
    assert f1["scan_metadata"]["fixed_version"] == "1:1.2.13.dfsg-1+deb12u1", "Fixed version mismatch"
    
    # Check high finding
    f2 = findings[1]
    assert f2["title"] == "openssl: buffer overflow", "Title mismatch"
    assert f2["severity"] == "high", "Severity mismatch"
    assert f2["cve_id"] == "CVE-2023-12345", "CVE ID mismatch"
    assert f2["scan_metadata"]["fixed_version"] == "3.0.9-1+deb12u1", "Fixed version mismatch"
    
    print("All automated assertion tests passed successfully!")

if __name__ == "__main__":
    run_test()
