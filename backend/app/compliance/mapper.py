# backend/app/compliance/mapper.py

"""
Automated Compliance Control Mapping Engine
Translates security findings (Trivy, Gitleaks, Nuclei, OpenGroup) into 
regulatory framework controls for SOC 2 Type II, PCI-DSS v4.0, ISO 27001:2022, and NIST SP 800-53 R5.
"""

from typing import Dict, List, Any

FRAMEWORKS = {
    "soc2": {
        "name": "SOC 2 Type II",
        "version": "2023 Trust Services Criteria",
        "description": "Security, Availability, and Confidentiality Controls",
        "controls": {
            "CC6.1": {
                "title": "Logical Access Security & Authentication",
                "category": "Access Control",
                "description": "Protects infrastructure and data from unauthorized logical access.",
            },
            "CC6.6": {
                "title": "Vulnerability Management & System Integrity",
                "category": "Risk Mitigation",
                "description": "Identifies and mitigates technical vulnerabilities across systems.",
            },
            "CC6.8": {
                "title": "Malware & Unauthorized Code Prevention",
                "category": "Software Security",
                "description": "Detects unauthorized code execution, injection, and malicious payloads.",
            },
            "CC7.1": {
                "title": "Infrastructure & Configuration Security",
                "category": "Operations",
                "description": "Monitors infrastructure components and security configurations.",
            },
        },
    },
    "pci_dss": {
        "name": "PCI-DSS v4.0",
        "version": "v4.0 (Payment Card Industry Standard)",
        "description": "Cardholder Data Protection & Application Security",
        "controls": {
            "Req-6.3": {
                "title": "Software Development & Vulnerability Management",
                "category": "Secure Development",
                "description": "Software is developed securely to prevent vulnerabilities.",
            },
            "Req-6.4": {
                "title": "Public Web Application Protection",
                "category": "Web Security",
                "description": "Public web applications are protected against web attacks.",
            },
            "Req-8.3": {
                "title": "Strong Authentication & Secret Management",
                "category": "Identity & Secrets",
                "description": "Authentication mechanisms and secret keys are secured.",
            },
            "Req-11.3": {
                "title": "Regular Vulnerability Scanning & Testing",
                "category": "Monitoring",
                "description": "Internal and external vulnerability scans are performed regularly.",
            },
        },
    },
    "iso_27001": {
        "name": "ISO 27001:2022",
        "version": "ISO/IEC 27001:2022 Annex A",
        "description": "Information Security Management Controls",
        "controls": {
            "A.8.8": {
                "title": "Management of Technical Vulnerabilities",
                "category": "Technological Controls",
                "description": "Information about technical vulnerabilities is evaluated and addressed.",
            },
            "A.8.28": {
                "title": "Secure Coding & AST Principles",
                "category": "Application Security",
                "description": "Secure coding rules are applied to software development.",
            },
            "A.8.24": {
                "title": "Use of Cryptographic Controls",
                "category": "Cryptography",
                "description": "Rules for the effective use of cryptography are enforced.",
            },
            "A.5.15": {
                "title": "Access Control & Credential Protection",
                "category": "Organizational Controls",
                "description": "Access to information assets is controlled in accordance with business requirements.",
            },
        },
    },
    "nist_800_53": {
        "name": "NIST SP 800-53 R5",
        "version": "Revision 5 (Security & Privacy Controls)",
        "description": "Federal Information Security Modernization Controls",
        "controls": {
            "SI-2": {
                "title": "Flaw Remediation",
                "category": "System & Information Integrity",
                "description": "Identifies, reports, and corrects system and application flaws.",
            },
            "RA-5": {
                "title": "Vulnerability Monitoring & Scanning",
                "category": "Risk Assessment",
                "description": "Monitors and scans for vulnerabilities in systems and applications.",
            },
            "SA-11": {
                "title": "Developer Security Testing & Verification",
                "category": "System Acquisition",
                "description": "Requires developer static and dynamic security testing.",
            },
            "IA-5": {
                "title": "Authenticator & Credential Management",
                "category": "Identification & Authentication",
                "description": "Manages system authenticators, tokens, and secret keys.",
            },
        },
    },
}


def map_finding_to_controls(finding: Any) -> Dict[str, List[str]]:
    """
    Maps a single Finding model object or dictionary to corresponding controls in each framework.
    Returns a dictionary of framework_id -> list of control_ids.
    """
    def get_val(obj, key, default=""):
        if hasattr(obj, key):
            val = getattr(obj, key)
            if val is not None:
                return val
        if isinstance(obj, dict):
            return obj.get(key, default)
        return default

    tool = str(get_val(finding, "tool", "")).lower()
    title = str(get_val(finding, "title", "")).lower()
    desc = str(get_val(finding, "description", "")).lower()
    meta = get_val(finding, "scan_metadata") or get_val(finding, "metadata") or {}
    check_id = str(meta.get("check_id", "")).lower() if isinstance(meta, dict) else ""
    cve_id = str(get_val(finding, "cve_id", "") or "").lower()

    mapped = {
        "soc2": [],
        "pci_dss": [],
        "iso_27001": [],
        "nist_800_53": [],
    }

    # 1. Gitleaks / Secret findings
    if tool == "secret" or tool == "gitleaks" or "secret" in title or "password" in title or "token" in title or "key" in title:
        mapped["soc2"].append("CC6.1")
        mapped["pci_dss"].append("Req-8.3")
        mapped["iso_27001"].append("A.5.15")
        mapped["nist_800_53"].append("IA-5")

    # 2. OpenGroup / SAST findings
    if tool == "opengroup" or "sast" in check_id or "injection" in title or "sqli" in title or "xss" in title:
        mapped["soc2"].append("CC6.8")
        mapped["pci_dss"].append("Req-6.3")
        mapped["iso_27001"].append("A.8.28")
        mapped["nist_800_53"].append("SA-11")

    # 3. Trivy / SCA / CVE findings
    if tool == "sca" or tool == "trivy" or cve_id:
        mapped["soc2"].append("CC6.6")
        mapped["pci_dss"].append("Req-6.3")
        mapped["iso_27001"].append("A.8.8")
        mapped["nist_800_53"].append("SI-2")

    # 4. Nuclei / DAST / Vuln findings
    if tool == "vuln" or tool == "nuclei" or "misconfig" in title or "http" in title:
        mapped["soc2"].append("CC7.1")
        mapped["pci_dss"].append("Req-6.4")
        mapped["iso_27001"].append("A.8.8")
        mapped["nist_800_53"].append("RA-5")

    # Ensure every finding is mapped to general scanning controls if specific mapping didn't trigger
    if not mapped["soc2"]:
        mapped["soc2"].append("CC6.6")
    if not mapped["pci_dss"]:
        mapped["pci_dss"].append("Req-11.3")
    if not mapped["iso_27001"]:
        mapped["iso_27001"].append("A.8.8")
    if not mapped["nist_800_53"]:
        mapped["nist_800_53"].append("RA-5")

    return mapped


def compute_compliance_summary(findings: List[Any]) -> Dict[str, Any]:
    """
    Computes global compliance posture scores, control statuses, and control-finding counts
    across all 4 regulatory frameworks.
    """
    summary = {}

    for fw_id, fw_info in FRAMEWORKS.items():
        control_counts: Dict[str, Dict[str, int]] = {
            cid: {"total": 0, "critical": 0, "high": 0, "medium": 0, "low": 0}
            for cid in fw_info["controls"]
        }

        failing_controls = set()

        for f in findings:
            mapped_ctrls = map_finding_to_controls(f).get(fw_id, [])
            sev_attr = getattr(f, "ai_severity_override", None) or getattr(f, "severity", "info")
            sev = (sev_attr.value if hasattr(sev_attr, "value") else str(sev_attr or "info")).lower().strip()

            for cid in mapped_ctrls:
                if cid in control_counts:
                    control_counts[cid]["total"] += 1
                    if sev in control_counts[cid]:
                        control_counts[cid][sev] += 1
                    if sev in ("critical", "high"):
                        failing_controls.add(cid)

        total_controls = len(fw_info["controls"])
        passing_controls = total_controls - len(failing_controls)
        readiness_score = round((passing_controls / total_controls) * 100.0, 1) if total_controls > 0 else 100.0

        controls_detail = []
        for cid, cinfo in fw_info["controls"].items():
            counts = control_counts[cid]
            status = "compliant" if counts["critical"] == 0 and counts["high"] == 0 else "non_compliant"
            controls_detail.append({
                "control_id": cid,
                "title": cinfo["title"],
                "category": cinfo["category"],
                "description": cinfo["description"],
                "status": status,
                "total_findings": counts["total"],
                "critical_findings": counts["critical"],
                "high_findings": counts["high"],
                "medium_findings": counts["medium"],
                "low_findings": counts["low"],
            })

        summary[fw_id] = {
            "name": fw_info["name"],
            "version": fw_info["version"],
            "description": fw_info["description"],
            "readiness_score": readiness_score,
            "passing_controls": passing_controls,
            "total_controls": total_controls,
            "controls": controls_detail,
        }

    return summary
