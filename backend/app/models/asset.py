import enum
import uuid

from sqlalchemy import Column, Enum, Float, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from .base import Base, TimestampMixin


class AssetType(str, enum.Enum):
    url = "url"
    docker_image = "docker_image"
    git_repo = "git_repo"
    host = "host"  # IP address / hostname — scanned by Nmap


class AssetWeight(float, enum.Enum):
    low = 0.5
    medium = 1.0
    high = 1.5
    critical = 2.0


class Asset(Base, TimestampMixin):
    __tablename__ = "assets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(
        UUID(as_uuid=True), ForeignKey("orgs.id"), nullable=False, index=True
    )
    name = Column(String(255), nullable=False)
    target = Column(String(1024), nullable=False)  # URL / image / repo
    asset_type = Column(Enum(AssetType), nullable=False)
    asset_weight = Column(Float, default=1.0, nullable=False)
    owner_email = Column(String(255))  # for Slack tagging (Week 7)

    org = relationship("Org", back_populates="assets")
    scans = relationship("Scan", back_populates="asset")
    findings = relationship("Finding", back_populates="asset")
