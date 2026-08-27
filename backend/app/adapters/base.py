# app/adapters/base.py

import os
import hashlib
import logging
from abc import ABC, abstractmethod
from typing import List, Optional

logger = logging.getLogger(__name__)


class BaseAdapter(ABC):
    """
    Abstract base class for all scanner adapters.
    Every scanner (Nuclei, Trivy, Gitleaks) implements this.

    Contract:
      - run() may raise; safe_run() is the entry point orchestration should call.
      - Each returned finding SHOULD carry a stable "fingerprint" so the persistence
        layer can de-duplicate the same issue across repeated scans (issue identity,
        not row identity). Use make_fingerprint() to build it.
    """

    tool_name: str = "base"

    @abstractmethod
    def run(
        self,
        target: str,
        scan_id: str,
        org_id: str,
        asset_id: str,
        options: dict = None,
    ) -> List[dict]:
        """
        Run the scanner against target. Return list of finding dicts.
        May raise; safe_run() isolates failures.
        """
        raise NotImplementedError

    def safe_run(
        self,
        target: str,
        scan_id: str,
        org_id: str,
        asset_id: str,
        options: dict = None,
    ) -> List[dict]:
        """
        Wrapper that isolates a single adapter's failure from the whole scan.
        Logs full traceback (not just str(e)) for debuggability.
        """
        try:
            return self.run(target, scan_id, org_id, asset_id, options or {}) or []
        except Exception:
            logger.exception(
                "[%s] adapter failed target=%s scan=%s",
                self.__class__.__name__,
                target,
                scan_id,
            )
            return []

    # --- shared helpers -----------------------------------------------------

    @staticmethod
    def resolve_binary(preferred: str, *fallbacks: str) -> str:
        """
        Resolve a scanner binary from PATH or absolute fallbacks.
        Returns the first hit; if nothing resolves, returns `preferred` so the
        exec fails loudly (rather than silently mis-resolving).
        """
        import shutil

        for cand in (preferred, *fallbacks):
            if not cand:
                continue
            found = shutil.which(cand)
            if found:
                return found
        for cand in (preferred, *fallbacks):
            if cand and cand.startswith("/") and os.path.exists(cand):
                return cand
        return preferred

    @staticmethod
    def make_fingerprint(*parts: Optional[str]) -> str:
        """
        Stable SHA-256 identity for a finding. Pass the invariants that define
        "the same issue" (tool, asset, cve/template, location) — NOT volatile
        fields like scan_id or timestamps.
        """
        joined = "|".join((p or "").strip().lower() for p in parts)
        return hashlib.sha256(joined.encode("utf-8")).hexdigest()
