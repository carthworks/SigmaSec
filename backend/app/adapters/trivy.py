# app/adapters/trivy.py

import os
import json
import uuid
import logging
from typing import List

from app.adapters.base import BaseAdapter
from app.adapters import config
from app.adapters.runner import run_logged_command

logger = logging.getLogger(__name__)

_SUBCOMMANDS = {"image": "image", "fs": "fs", "repo": "repo"}


class TrivyAdapter(BaseAdapter):
    """
    Runs Trivy SCA. Defaults to image scanning; options["scan_type"] can select
    "fs" or "repo". Extracts fixed_version into metadata for the UI badge.
    """

    tool_name = "trivy"

    def __init__(self, binary_path: str = None):
        self.binary = self.resolve_binary(
            binary_path or config.TRIVY_BINARY, "/usr/bin/trivy", "/usr/local/bin/trivy"
        )

    def run(
        self,
        target: str,
        scan_id: str,
        org_id: str,
        asset_id: str,
        options: dict = None,
    ) -> List[dict]:
        options = options or {}
        subcmd = _SUBCOMMANDS.get(options.get("scan_type", "image"), "image")
        trivy_timeout_min = int(options.get("trivy_timeout_min", 10))

        cmd = [
            self.binary,
            subcmd,
            "--format", "json",
            "--severity", "LOW,MEDIUM,HIGH,CRITICAL",
            "--quiet",
            "--timeout", f"{trivy_timeout_min}m",
            target,
        ]

        env = os.environ.copy()
        env["TRIVY_USERAGENT"] = config.USER_AGENT

        result = run_logged_command(
            scan_id=scan_id, cmd=cmd, timeout=config.TRIVY_TIMEOUT, env=env
        )

        if result.timed_out:
            logger.warning("[trivy] timed out target=%s", target)

        out = result.stdout.strip()
        if not out:
            # Empty + failure = the scan didn't run (auth, pull, rate limit). Do NOT
            # report this as a clean image.
            if not result.ok:
                logger.error(
                    "[trivy] scan failed rc=%s (no output) target=%s",
                    result.returncode, target,
                )
            return []

        try:
            data = json.loads(out)
        except json.JSONDecodeError as e:
            logger.error("[trivy] JSON parse error: %s target=%s", e, target)
            return []

        findings: List[dict] = []
        seen: set = set()
        for block in data.get("Results", []) or []:
            for vuln in block.get("Vulnerabilities") or []:
                finding = self._parse_finding(vuln, scan_id, org_id, asset_id, block)
                if finding and finding["fingerprint"] not in seen:
                    seen.add(finding["fingerprint"])
                    findings.append(finding)

        logger.info("[trivy] %d findings target=%s", len(findings), target)
        return findings

    def _parse_finding(
        self,
        vuln: dict,
        scan_id: str,
        org_id: str,
        asset_id: str,
        result_block: dict,
    ) -> dict | None:
        cve_id = vuln.get("VulnerabilityID")
        pkg = vuln.get("PkgName", "")
        installed = vuln.get("InstalledVersion", "")

        # Identity = tool + asset + cve + package + installed version. The same CVE on
        # two different packages is two findings; the same one across scans is one.
        fingerprint = self.make_fingerprint(
            self.tool_name, asset_id, cve_id, pkg, installed
        )

        return {
            "id": str(uuid.uuid4()),
            "org_id": org_id,
            "scan_id": scan_id,
            "asset_id": asset_id,
            "fingerprint": fingerprint,
            "title": vuln.get("Title") or cve_id or "Unknown",
            "severity": config.normalize_severity(vuln.get("Severity", "UNKNOWN")),
            "cve_id": cve_id,
            "tool": self.tool_name,
            "url": (vuln.get("PrimaryURL") or ""),
            "description": vuln.get("Description", ""),
            "metadata": {
                "fixed_version": vuln.get("FixedVersion", ""),
                "installed_version": installed,
                "package": pkg,
                "target": result_block.get("Target", ""),
                "type": result_block.get("Type", ""),
                "references": vuln.get("References", []),
            },
        }
