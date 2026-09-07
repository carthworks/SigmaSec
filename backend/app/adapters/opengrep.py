# app/adapters/opengrep.py

import os
import json
import uuid
import shutil
import logging
import tempfile
from typing import List

from app.adapters.base import BaseAdapter
from app.adapters import config
from app.adapters.runner import run_logged_command

logger = logging.getLogger(__name__)


class OpengrepAdapter(BaseAdapter):
    """
    Runs Opengrep static security analysis (SAST) scanner against codebases and target repositories.
    Parses security rules, static analysis AST findings, and code misconfigurations.
    """

    tool_name = "opengrep"

    def __init__(self, binary_path: str = None):
        self.binary = self.resolve_binary(
            binary_path or getattr(config, "OPENGREP_BINARY", "opengrep"),
            "/usr/local/bin/opengrep",
            "/usr/bin/opengrep",
            "opengrep",
            getattr(config, "OPENGROUP_BINARY", "opengroup"),
            "/usr/local/bin/opengroup",
            "/usr/bin/opengroup",
        )

    def _clone_remote_target(self, target: str, scan_id: str) -> str:
        """
        Clones a remote git repository target into a temporary directory.
        Returns the path to the local repository checkout.
        """
        cleaned = target.strip("'\" \t\r\n")
        if not cleaned.startswith("http://") and not cleaned.startswith("https://") and not cleaned.startswith("git@"):
            cleaned = f"https://{cleaned}"

        work_dir = tempfile.mkdtemp(prefix="opengrep_")
        repo_dir = os.path.join(work_dir, "repo")

        git_env = os.environ.copy()
        git_env["GIT_TERMINAL_PROMPT"] = "0"
        git_env["GIT_ALLOW_PROTOCOL"] = "http:https:ssh"

        clone_cmd = [
            "git", "clone",
            "--depth", "50",
            "--single-branch",
            "-c", "protocol.file.allow=never",
            "-c", "protocol.ext.allow=never",
            cleaned, repo_dir,
        ]

        clone_res = run_logged_command(
            scan_id=scan_id,
            cmd=clone_cmd,
            timeout=config.GIT_CLONE_TIMEOUT,
            capture_stdout=False,
            env=git_env,
        )

        if clone_res.timed_out or clone_res.returncode not in (0, None) or not os.path.isdir(repo_dir):
            logger.error(
                "[%s] clone failed rc=%s timed_out=%s target=%s",
                self.tool_name, clone_res.returncode, clone_res.timed_out, target,
            )
            shutil.rmtree(work_dir, ignore_errors=True)
            raise ValueError(f"Opengrep target checkout failed for {target}")

        return work_dir

    def run(
        self,
        target: str,
        scan_id: str,
        org_id: str,
        asset_id: str,
        options: dict = None,
    ) -> List[dict]:
        options = options or {}
        ruleset = (
            options.get("ruleset")
            or getattr(config, "OPENGREP_RULESET", None)
            or getattr(config, "OPENGROUP_RULESET", "p/default")
        )
        scan_timeout = getattr(config, "OPENGREP_TIMEOUT", None) or getattr(config, "OPENGROUP_TIMEOUT", 600)

        temp_work_dir = None
        scan_target = target

        # Scan a local checkout, not a URL
        if not os.path.isdir(target):
            try:
                temp_work_dir = self._clone_remote_target(target, scan_id)
                scan_target = os.path.join(temp_work_dir, "repo")
            except Exception as e:
                logger.error("[%s] failed to prepare local target for %s: %s", self.tool_name, target, e)
                return []

        try:
            cmd = [
                self.binary,
                "scan",
                "--config", ruleset,
                "--json",
                "--quiet",
                scan_target,
            ]

            result = run_logged_command(
                scan_id=scan_id,
                cmd=cmd,
                timeout=scan_timeout,
            )

            if result.timed_out:
                logger.warning("[%s] scan timed out for target=%s", self.tool_name, target)

            out = result.stdout.strip()
            if not out:
                if not result.ok:
                    logger.info(
                        "[%s] process completed (rc=%s) for target=%s",
                        self.tool_name,
                        result.returncode,
                        target,
                    )
                return []

            try:
                data = json.loads(out)
            except json.JSONDecodeError as e:
                logger.error("[%s] JSON parse error: %s for target=%s", self.tool_name, e, target)
                return []

            findings: List[dict] = []
            seen: set = set()
            results_list = data.get("results") or data.get("findings") or []
            for item in results_list:
                finding = self._parse_finding(item, scan_id, org_id, asset_id)
                if finding and finding["fingerprint"] not in seen:
                    seen.add(finding["fingerprint"])
                    findings.append(finding)

            logger.info("[%s] %d findings target=%s", self.tool_name, len(findings), target)
            return findings

        finally:
            if temp_work_dir and os.path.exists(temp_work_dir):
                shutil.rmtree(temp_work_dir, ignore_errors=True)

    def _parse_finding(
        self,
        item: dict,
        scan_id: str,
        org_id: str,
        asset_id: str,
    ) -> dict | None:
        check_id = item.get("check_id") or item.get("rule_id") or f"{self.tool_name}-rule"
        file_path = item.get("path") or item.get("filename") or ""
        line_num = str(item.get("start", {}).get("line") or item.get("line") or "")

        fingerprint = self.make_fingerprint(
            self.tool_name, asset_id, check_id, file_path, line_num
        )

        extra = item.get("extra", {})
        metadata = extra.get("metadata", {}) or {}

        title = extra.get("message") or item.get("message") or check_id

        severity_raw = (
            metadata.get("severity")
            or metadata.get("impact")
            or extra.get("severity")
            or item.get("severity")
            or "WARNING"
        )

        return {
            "id": str(uuid.uuid4()),
            "org_id": org_id,
            "scan_id": scan_id,
            "asset_id": asset_id,
            "fingerprint": fingerprint,
            "title": title,
            "severity": config.normalize_severity(severity_raw),
            "cve_id": extra.get("cve") or metadata.get("cve") or None,
            "tool": self.tool_name,
            "url": metadata.get("shortlink") or "",
            "description": metadata.get("description") or title,
            "metadata": {
                "file_path": file_path,
                "line": line_num,
                "check_id": check_id,
                "category": metadata.get("category", "sast"),
            },
        }


# Alias for capitalization consistency
OpenGrepAdapter = OpengrepAdapter
