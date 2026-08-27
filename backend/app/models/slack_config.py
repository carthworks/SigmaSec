# app/models/slack_config.py

import uuid
from sqlalchemy import Column, ForeignKey, String, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from .base import Base, TimestampMixin

class SlackConfig(Base, TimestampMixin):
    __tablename__ = "slack_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    webhook_url = Column(String(512), nullable=False)  # Fernet encrypted value
    channel = Column(String(100), nullable=False)
    critical_only = Column(Boolean, default=True, nullable=False)

    org = relationship("Org")
