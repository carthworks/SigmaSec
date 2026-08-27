import uuid
from typing import Any, List

from pydantic import BaseModel, model_validator


class FindingOut(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    scan_id: uuid.UUID
    asset_id: uuid.UUID | None
    title: str
    severity: str  # overall severity label (critical/high/medium/low)
    cve_id: str | None  # associated CVE identifier, if any
    tool: str  # scanner/tool that produced this finding (e.g. Trivy, Gitleaks)
    cvss_score: float | None  # numeric CVSS base score (0-10)
    cvss_vector: str | None  # CVSS vector string (AV/AC/PR/UI/etc)
    epss_score: float | None  # EPSS probability of exploitation in the wild
    epss_percentile: float | None = None  # EPSS score as a percentile vs all CVEs
    kev_listed: bool  # whether listed in CISA's Known Exploited Vulnerabilities catalog
    kev_due_date: str | None = None  # remediation due date mandated by KEV listing
    priority_score: float | None  # computed score used to rank/triage urgency
    priority_rank: int | None  # rank position based on priority_score
    ai_plain_english: str | None  # AI-generated plain-English summary
    reachability: (
        str | None
    )  # whether the vulnerable code path is reachable/exploitable
    asset_name: str | None = (
        None  # human-readable asset name (joined from asset relation)
    )
    exploit_validated: (
        bool  # whether an exploit was actually confirmed against this finding
    )
    jira_issue_key: str | None  # linked Jira ticket key, if created
    pr_url: str | None  # URL of an auto-generated fix pull request, if any
    pr_status: str | None  # status of that fix PR (open/merged/closed)
    fp_candidate: bool  # flagged as a likely false positive
    status: str | None = None  # workflow status (open/triaged/resolved etc)
    raw_output: str | None = (
        None  # raw scanner output/metadata, serialized as JSON text
    )
    tags: List[str] = []  # free-form tags attached to the finding
    ai_remediation: List[str] | None = (
        None  # AI-generated remediation suggestions (plain text)
    )
    ai_severity_override: str | None = None  # severity as overridden by AI analysis
    ai_override_reason: str | None = None  # explanation for the AI severity override
    reachability_reason: str | None = (
        None  # explanation supporting the reachability verdict
    )
    ai_why_now: str | None = None  # AI explanation of why this finding is urgent now
    ai_remediation_structured: List[dict] | None = (
        None  # structured action/command/file/verification steps
    )
    ai_patch: dict | None = None  # suggested code patch/diff to fix the finding
    ai_blockers: List[str] | None = (
        None  # things blocking auto-remediation (e.g. missing tests)
    )
    ai_breaking_change_risk: str | None = (
        None  # AI's assessed risk that the fix breaks something
    )
    ai_confidence: float | None = None  # AI's confidence score in its own analysis
    ai_insufficient_context: List[str] | None = (
        None  # gaps where AI lacked enough context
    )
    reachability_context: dict | None = (
        None  # structured detail behind reachability (entry point, call path, snippets)
    )

    model_config = {"from_attributes": True}

    @model_validator(mode="before")
    @classmethod
    def coerce_orm(cls, data: Any) -> Any:
        if hasattr(data, "__dict__"):
            # SQLAlchemy ORM object
            sm = getattr(data, "scan_metadata", None)
            raw_out = None
            if sm is not None:
                import json

                raw_out = json.dumps(sm, indent=2) if not isinstance(sm, str) else sm

            return {
                "id": getattr(data, "id", None),
                "org_id": getattr(data, "org_id", None),
                "scan_id": getattr(data, "scan_id", None),
                "asset_id": getattr(data, "asset_id", None),
                "title": getattr(data, "title", None),
                "severity": (
                    getattr(data, "severity", None).value
                    if hasattr(getattr(data, "severity", None), "value")
                    else getattr(data, "severity", None)
                ),
                "cve_id": getattr(data, "cve_id", None),
                "tool": getattr(data, "tool", None),
                "cvss_score": getattr(data, "cvss_score", None),
                "cvss_vector": getattr(data, "cvss_vector", None),
                "epss_score": getattr(data, "epss_score", None),
                "epss_percentile": getattr(data, "epss_percentile", None),
                "kev_listed": getattr(data, "kev_listed", False),
                "kev_due_date": getattr(data, "kev_due_date", None),
                "priority_score": getattr(data, "priority_score", None),
                "priority_rank": getattr(data, "priority_rank", None),
                "ai_plain_english": getattr(data, "ai_plain_english", None),
                "reachability": (
                    getattr(data, "reachability", None).value
                    if hasattr(getattr(data, "reachability", None), "value")
                    else getattr(data, "reachability", None)
                ),
                "asset_name": getattr(getattr(data, "asset", None), "name", None),
                "exploit_validated": getattr(data, "exploit_validated", False),
                "jira_issue_key": getattr(data, "jira_issue_key", None),
                "pr_url": getattr(data, "pr_url", None),
                "pr_status": getattr(data, "pr_status", None),
                "fp_candidate": getattr(data, "fp_candidate", False),
                "status": (
                    getattr(data, "status", None).value
                    if hasattr(getattr(data, "status", None), "value")
                    else getattr(data, "status", None)
                ),
                "raw_output": raw_out,
                "tags": getattr(data, "tags", None) or [],
                "ai_remediation": getattr(data, "ai_remediation", None),
                "ai_severity_override": (
                    getattr(data, "ai_severity_override", None).value
                    if hasattr(getattr(data, "ai_severity_override", None), "value")
                    else getattr(data, "ai_severity_override", None)
                ),
                "ai_override_reason": getattr(data, "ai_override_reason", None),
                "reachability_reason": getattr(data, "reachability_reason", None),
                "ai_why_now": getattr(data, "ai_why_now", None),
                "ai_remediation_structured": getattr(
                    data, "ai_remediation_structured", None
                ),
                "ai_patch": getattr(data, "ai_patch", None),
                "ai_blockers": getattr(data, "ai_blockers", None),
                "ai_breaking_change_risk": getattr(
                    data, "ai_breaking_change_risk", None
                ),
                "ai_confidence": getattr(data, "ai_confidence", None),
                "ai_insufficient_context": getattr(
                    data, "ai_insufficient_context", None
                ),
                "reachability_context": getattr(data, "reachability_context", None),
            }
        return data


class FindingUpdate(BaseModel):
    status: str | None = None
    fp_candidate: bool | None = None
    jira_issue_key: str | None = None
    pr_url: str | None = None
