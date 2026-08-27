import uuid

from sqlalchemy import Boolean, Column, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from .base import Base, TimestampMixin


class Org(Base, TimestampMixin):
    __tablename__ = "orgs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    is_active = Column(Boolean, default=True, nullable=False)

    users = relationship("User", back_populates="org", cascade="all, delete-orphan")
    assets = relationship("Asset", back_populates="org", cascade="all, delete-orphan")
    scans = relationship("Scan", back_populates="org", cascade="all, delete-orphan")
    findings = relationship(
        "Finding", back_populates="org", cascade="all, delete-orphan"
    )
