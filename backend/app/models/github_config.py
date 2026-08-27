# app/models/github_config.py

import uuid
from sqlalchemy import Column, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from .base import Base, TimestampMixin

class GitHubConfig(Base, TimestampMixin):
    __tablename__ = "github_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    installation_id = Column(String(255), nullable=True)
    access_token = Column(String(512), nullable=False)  # Fernet encrypted value

    org = relationship("Org")
