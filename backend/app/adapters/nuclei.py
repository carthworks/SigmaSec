# app/adapters/nuclei.py

import json
import uuid
import logging
from typing import List

from app.adapters.base import BaseAdapter
from app.adapters import config
from app.adapters.runner import run_logged_command

logger = logging.getLogger(__name__)


class NucleiAdapter(BaseAdapter):
    """
    Runs Nuclei against a web target. Parses JSONL (one object per line).
    FR-SCN-13: when options["validate"] is True, runs -validate and marks
    exploit_validated=True on every returned finding.
    """

    tool_name = "nuclei"

    def __init__(self, binary_path: str = None):
        self.binary = self.resolve_binary(
            binary_path or config.NUCLEI_BINARY, "/usr/local/bin/nuclei"
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
        validate = bool(options.get("validate", False))

        # Prefer the live-updated template volume; fall back to bundled default.
        import os as _os
        templates_path = config.NUCLEI_TEMPLATES_PATH
        if templates_path and _os.path.isdir(templates_path):
            templates = templates_path
        else:
            templates = options.get("templates", "cves,vulnerabilities")

        cmd = [
            self.binary,
            "-target", target,
            "-t", templates,
            "-jsonl",
            "-silent",
            "-no-color",
            "-timeout", str(options.get("request_timeout", 10)),
            "-retries", "1",
            "-H", f"User-Agent: {config.USER_AGENT}",
        ]
        if options.get("rate_limit"):
            cmd += ["-rate-limit", str(options["rate_limit"])]
        if validate:
            cmd.append("-validate")

        result = run_logged_command(scan_id=scan_id, cmd=cmd, timeout=config.NUCLEI_TIMEOUT)

        if result.timed_out:
            logger.warning("[nuclei] timed out target=%s", target)
        # Nuclei exits 0 even when it finds things. Non-zero + no output = real failure,
        # which we must not silently report as "clean".
        if result.returncode not in (0, None) and not result.stdout.strip():
            logger.error("[nuclei] scan failed rc=%s target=%s", result.returncode, target)
            return []

        findings: List[dict] = []
        seen: set = set()
        for line in result.stdout.splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
            except json.JSONDecodeError:
                continue  # skip malformed lines
            finding = self._parse_finding(data, scan_id, org_id, asset_id, validate)
            if not finding or finding["fingerprint"] in seen:
                continue
            seen.add(finding["fingerprint"])
            findings.append(finding)

        logger.info(
            "[nuclei] %d findings (validate=%s) target=%s", len(findings), validate, target
        )
        return findings

    def _parse_finding(
        self,
        data: dict,
        scan_id: str,
        org_id: str,
        asset_id: str,
        validate_mode: bool = False,
    ) -> dict | None:
        info = data.get("info", {})
        severity = config.normalize_severity(info.get("severity", "info"))

        cve_id = None
        cve_ids = (info.get("classification") or {}).get("cve-id") or []
        if cve_ids:
            cve_id = cve_ids[0] if isinstance(cve_ids, list) else cve_ids

        template_id = data.get("template-id", "")
        matched_at = data.get("matched-at", "")

        # Identity = tool + asset + (cve or template) + location. Stable across scans.
        fingerprint = self.make_fingerprint(
            self.tool_name, asset_id, cve_id or template_id, matched_at
        )

        return {
            "id": str(uuid.uuid4()),
            "org_id": org_id,
            "scan_id": scan_id,
            "asset_id": asset_id,
            "fingerprint": fingerprint,
            "title": info.get("name", template_id or "Unknown"),
            "severity": severity,
            "cve_id": cve_id,
            "tool": self.tool_name,
            "url": matched_at,
            "description": info.get("description", ""),
            "exploit_validated": validate_mode,  # FR-SCN-13
            "metadata": {
                "template_id": template_id,
                "host": data.get("host", ""),
                "tags": info.get("tags", []),
                "reference": info.get("reference", []),
                "validate_mode": validate_mode,
            },
        }
