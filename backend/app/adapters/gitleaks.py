# app/adapters/gitleaks.py

import os
import json
import uuid
import shutil
import logging
import hashlib
import tempfile
from urllib.parse import urlparse

from app.adapters.base import BaseAdapter
from app.adapters import config
from app.adapters.runner import run_logged_command

logger = logging.getLogger(__name__)

# Only these transports are permitted for cloning untrusted targets. This blocks
# git's file:// and ext:: transports, which are a remote-code-execution vector
# when the repo URL is attacker-controlled.
_ALLOWED_SCHEMES = {"http", "https"}


class GitleaksAdapter(BaseAdapter):
    tool_name = "gitleaks"

    def __init__(self, binary_path: str = None):
        self.binary = self.resolve_binary(
            binary_path or config.GITLEAKS_BINARY,
            "/app/tools/gitleaks",
            "/usr/local/bin/gitleaks",
        )

    # --- security: validate the clone target before touching git ------------

    def _validate_target(self, target: str, allow_ssh: bool = False) -> str:
        cleaned = target.strip("'\" \t\r\n")
        if not cleaned.startswith("http://") and not cleaned.startswith("https://") and not cleaned.startswith("git@"):
            cleaned = f"https://{cleaned}"
        if allow_ssh and cleaned.startswith("git@"):
            return cleaned  # scp-like ssh, only if the caller explicitly opted in
        parsed = urlparse(cleaned)
        if parsed.scheme not in _ALLOWED_SCHEMES:
            raise ValueError(f"disallowed git URL scheme: {parsed.scheme or 'none'}")
        if not parsed.netloc:
            raise ValueError("git URL missing host")
        return cleaned

    def mask_secret(self, secret: str) -> str:
        if not secret:
            return ""
        secret = secret.strip()
        if len(secret) <= 8:
            return secret[:2] + "..." + secret[-2:] if len(secret) > 4 else "******"
        return secret[:4] + "..." + secret[-4:]

    def run(
        self,
        target: str,
        scan_id: str,
        org_id: str,
        asset_id: str,
        options: dict = None,
    ) -> list[dict]:
        options = options or {}
        allow_ssh = bool(options.get("allow_ssh", False))
        depth = int(options.get("depth", 50))
        target = self._validate_target(target, allow_ssh=allow_ssh)

        # Unpredictable workspace; report kept outside the cloned tree.
        work = tempfile.mkdtemp(prefix="gl_")
        scan_dir = os.path.join(work, "repo")
        report_file = os.path.join(work, "report.json")

        # Harden git: no credential prompts (avoid hangs), restrict transports.
        git_env = os.environ.copy()
        git_env["GIT_TERMINAL_PROMPT"] = "0"
        git_env["GIT_ALLOW_PROTOCOL"] = "http:https:ssh" if allow_ssh else "http:https"

        try:
            clone_cmd = [
                "git", "clone",
                "--depth", str(depth),
                "--single-branch",
                "-c", "protocol.file.allow=never",
                "-c", "protocol.ext.allow=never",
                target, scan_dir,
            ]
            clone = run_logged_command(
                scan_id=scan_id,
                cmd=clone_cmd,
                timeout=config.GIT_CLONE_TIMEOUT,
                capture_stdout=False,
                env=git_env,
            )
            if clone.timed_out or clone.returncode not in (0, None) or not os.path.isdir(scan_dir):
                logger.error(
                    "[gitleaks] clone failed rc=%s timed_out=%s target=%s",
                    clone.returncode, clone.timed_out, target,
                )
                return []

            # --exit-code=0 => gitleaks returns 0 even when leaks are found, so any
            # non-zero code now means a real operational error, not "found secrets".
            gl_cmd = [
                self.binary,
                "detect",  # NOTE: deprecated in gitleaks >=8.19 in favor of `git`; still supported
                f"--source={scan_dir}",
                "--report-format=json",
                f"--report-path={report_file}",
                "--exit-code=0",
                "--no-git=false",  # scan git history
            ]
            scan = run_logged_command(
                scan_id=scan_id,
                cmd=gl_cmd,
                timeout=config.GITLEAKS_TIMEOUT,
                capture_stdout=False,
            )
            if scan.timed_out or scan.returncode not in (0, None):
                logger.error(
                    "[gitleaks] scan failed rc=%s timed_out=%s target=%s",
                    scan.returncode, scan.timed_out, target,
                )
                return []

            if not os.path.exists(report_file):
                return []  # gitleaks writes no report when there are zero findings
            with open(report_file, "r") as f:
                return self.parse(f.read(), scan_id, org_id, asset_id)

        finally:
            shutil.rmtree(work, ignore_errors=True)

    def determine_severity(self, rule_id: str, secret_type: str = "") -> str:
        """
        Maps Gitleaks rule_id/description to severity:
        - Critical: high-confidence specific rules (AWS, Stripe, GitHub PAT, private keys, GCP, Azure, Slack, OpenAI, etc.)
        - Medium: generic or entropy-based rules (generic-api-key, generic-secret, high-entropy)
        - High: other specific service rules
        """
        rid = (rule_id or "").lower()
        stype = (secret_type or "").lower()

        # Check generic / entropy rules first -> Medium
        generic_keywords = ["generic", "entropy"]
        if any(kw in rid for kw in generic_keywords) or any(kw in stype for kw in generic_keywords):
            return "medium"

        # Check high-confidence rules -> Critical
        critical_keywords = [
            "aws", "stripe", "github", "private-key", "private_key", "rsa", "ssh", "pgp",
            "pkcs", "slack", "openai", "anthropic", "gcp", "google", "azure", "twilio",
            "sendgrid", "jwt", "password", "database-url", "connection-string"
        ]
        if any(kw in rid for kw in critical_keywords) or any(kw in stype for kw in critical_keywords):
            return "critical"

        # Default for other specific rules
        return "high"

    def is_fp_candidate_path(self, file_path: str) -> bool:
        """
        Determines if a file path is a false-positive candidate (test files, fixtures,
        examples, node_modules, .example/.sample extensions).
        """
        if not file_path:
            return False
        normalized = file_path.replace("\\", "/").lower().strip("/")
        parts = normalized.split("/")

        fp_dirs = {"test", "tests", "fixtures", "examples", "node_modules", "spec", "specs", "mock", "mocks", "testdata"}
        if any(part in fp_dirs for part in parts):
            return True

        filename = parts[-1]
        fp_exts = (".example", ".sample", ".test", ".spec", ".mock", ".fixture")
        fp_substrings = (".example.", ".sample.", ".test.", ".spec.", ".mock.")
        if filename.endswith(fp_exts) or any(sub in filename for sub in fp_substrings):
            return True

        return False

    def parse(
        self,
        json_data: str,
        scan_id: str = None,
        org_id: str = None,
        asset_id: str = None,
    ) -> list[dict]:
        if not json_data or not json_data.strip():
            return []
        try:
            findings_raw = json.loads(json_data)
        except json.JSONDecodeError as e:
            logger.error("[gitleaks] failed to parse JSON report: %s", e)
            return []

        by_secret: dict = {}
        for f in findings_raw:
            secret_type = f.get("Description", "Secret Leak")
            file_path = f.get("File", "unknown")
            line_no = f.get("StartLine", 1)
            commit = f.get("Commit", "N/A")
            rule_id = f.get("RuleID", "unknown")
            raw_secret = f.get("Secret", "")

            # Cluster occurrences of the same secret value.
            secret_hash = hashlib.sha256(raw_secret.strip().encode("utf-8")).hexdigest()

            occurrence = {
                "file": file_path,
                "line": line_no,
                "commit": commit,
                "author": f.get("Author", "N/A"),
                "date": f.get("Date", "N/A"),
            }

            if secret_hash in by_secret:
                occ = by_secret[secret_hash]["metadata"]["occurrences"]
                if occurrence not in occ:
                    occ.append(occurrence)
                continue

            # Cross-scan identity: tool + asset + rule + secret hash. Location is
            # deliberately excluded so a moved/re-committed secret stays one issue.
            fingerprint = self.make_fingerprint(
                self.tool_name, asset_id, rule_id, secret_hash
            )
            severity = self.determine_severity(rule_id, secret_type)
            fp_candidate = self.is_fp_candidate_path(file_path)

            metadata = {
                "secret_type": secret_type,
                "partial_secret": self.mask_secret(raw_secret),
                "secret_hash": secret_hash,
                "rule_id": rule_id,
                "occurrences": [occurrence],
                "fp_candidate": fp_candidate,
                # Back-compat flat keys
                "file": file_path,
                "line": line_no,
                "commit": commit,
                "author": f.get("Author", "N/A"),
                "date": f.get("Date", "N/A"),
            }
            by_secret[secret_hash] = {
                "id": str(uuid.uuid4()),
                "org_id": org_id,
                "scan_id": scan_id,
                "asset_id": asset_id,
                "fingerprint": fingerprint,
                "title": f"Secret Detected: {secret_type}",
                "severity": severity,
                "cve_id": None,
                "tool": self.tool_name,
                "url": f"{file_path}#L{line_no}",
                "description": (
                    f"A potential plaintext secret was detected in '{file_path}' "
                    f"at line {line_no} (rule: '{rule_id}')."
                ),
                "fp_candidate": fp_candidate,
                "metadata": metadata,
                "scan_metadata": metadata,  # kept for test_integration.py compatibility
            }

        return list(by_secret.values())
