import enum
import uuid

from sqlalchemy import ARRAY, Column, Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from .base import Base, TimestampMixin


class ScanStatus(str, enum.Enum):
    queued = "queued"
    running = "running"
    complete = "complete"
    failed = "failed"


class ScanType(str, enum.Enum):
    vuln = "vuln"  # Nuclei
    sca = "sca"  # Trivy
    secret = "secret"  # Gitleaks
    opengroup = "opengroup"  # OpenGroup (legacy alias)
    opengrep = "opengrep"  # Opengrep SAST
    network = "network"  # Nmap port / service scan



class Scan(Base, TimestampMixin):
    __tablename__ = "scans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(
        UUID(as_uuid=True), ForeignKey("orgs.id"), nullable=False, index=True
    )
    asset_id = Column(
        UUID(as_uuid=True), ForeignKey("assets.id"), nullable=True, index=True
    )
    target = Column(String(1024), nullable=False)
    scan_types = Column(ARRAY(String), nullable=False)  # ["vuln","sca","secret"]
    status = Column(Enum(ScanStatus), default=ScanStatus.queued, nullable=False)
    celery_task_id = Column(String(255))
    exec_summary = Column(String)  # AI-generated (Week 7)

    org = relationship("Org", back_populates="scans")
    asset = relationship("Asset", back_populates="scans")
    findings = relationship(
        "Finding", back_populates="scan", cascade="all, delete-orphan"
    )

    @property
    def findings_count(self) -> dict:
        counts = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
        try:
            for f in self.findings:
                sev = getattr(f, "ai_severity_override", None) or getattr(f, "severity", "info")
                val = (sev.value if hasattr(sev, "value") else str(sev or "")).lower().strip()
                if val in counts:
                    counts[val] += 1
        except Exception:
            pass
        return counts


