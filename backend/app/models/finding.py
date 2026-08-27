import enum
import uuid

from sqlalchemy import Boolean, Column, Enum, Float, ForeignKey, Integer, String, Text, Index, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from .base import Base, TimestampMixin


class Severity(str, enum.Enum):
    critical = "critical"
    high = "high"
    medium = "medium"
    low = "low"
    info = "info"


class FindingStatus(str, enum.Enum):
    new = "new"
    investigating = "investigating"
    in_progress = "in_progress"
    fixed = "fixed"
    accepted_risk = "accepted_risk"
    false_positive = "false_positive"


class Reachability(str, enum.Enum):
    reachable = "reachable"
    unreachable = "unreachable"
    uncertain = "uncertain"


class Finding(Base, TimestampMixin):
    __tablename__ = "findings"

    __table_args__ = (
        Index("idx_findings_org_scan", "org_id", "scan_id"),
        Index("idx_findings_org_severity", "org_id", "severity"),
        Index("ix_findings_priority_score_desc", text("priority_score DESC")),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(
        UUID(as_uuid=True), ForeignKey("orgs.id"), nullable=False, index=True
    )
    scan_id = Column(
        UUID(as_uuid=True), ForeignKey("scans.id"), nullable=False, index=True
    )
    asset_id = Column(
        UUID(as_uuid=True), ForeignKey("assets.id"), nullable=True, index=True
    )

    # Core finding fields
    fingerprint = Column(String(64), unique=True, index=True, nullable=True)
    title = Column(String(512), nullable=False)

    severity = Column(Enum(Severity), nullable=False, index=True)
    cve_id = Column(String(30), index=True)  # CVE-2024-XXXXX
    tool = Column(String(50), nullable=False)  # nuclei | trivy | gitleaks
    url = Column(String(1024))
    description = Column(Text)

    # Threat intel (Week 5)
    cvss_score = Column(Float)
    cvss_vector = Column(String(100))
    epss_score = Column(Float)
    epss_percentile = Column(Float)
    kev_listed = Column(Boolean, default=False)
    kev_due_date = Column(String(20))

    # Priority (Week 5)
    priority_score = Column(Float, index=True)
    priority_rank = Column(Integer)

    # AI enrichment (Week 6 & Revised Schema)
    ai_plain_english = Column(Text)
    ai_remediation = Column(JSONB)  # list of steps (legacy string array)
    ai_severity_override = Column(Enum(Severity))
    ai_override_reason = Column(Text)
    reachability = Column(Enum(Reachability))
    reachability_reason = Column(Text)

    # Revised AI Schema & AST Reachability Payload
    ai_why_now = Column(Text)
    ai_remediation_structured = Column(JSONB)  # list of {action, command, file, verification}
    ai_patch = Column(JSONB)  # {diff, applies_to_sha, files_touched}
    ai_blockers = Column(JSONB)  # list of strings
    ai_breaking_change_risk = Column(String(20))  # low, medium, high
    ai_confidence = Column(Float)
    ai_insufficient_context = Column(JSONB)  # list of strings
    reachability_context = Column(JSONB)  # AST reachability payload

    # Outputs (Week 7)
    jira_issue_key = Column(String(50))
    pr_url = Column(String(512))
    pr_status = Column(String(20))

    # Flags
    exploit_validated = Column(Boolean, default=False)  # FR-SCN-13
    fp_candidate = Column(Boolean, default=False)
    status = Column(Enum(FindingStatus), default=FindingStatus.new, nullable=False)
    tags = Column(JSONB, default=list, nullable=False)

    # Raw tool output
    scan_metadata = Column("metadata", JSONB, nullable=True)

    org = relationship("Org", back_populates="findings")
    scan = relationship("Scan", back_populates="findings")
    asset = relationship("Asset", back_populates="findings")
