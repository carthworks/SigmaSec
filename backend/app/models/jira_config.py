# app/models/jira_config.py

import uuid
from sqlalchemy import Column, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from .base import Base, TimestampMixin

class JiraConfig(Base, TimestampMixin):
    __tablename__ = "jira_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    base_url = Column(String(255), nullable=False)
    project_key = Column(String(50), nullable=False)
    email = Column(String(255), nullable=False)
    api_token = Column(String(512), nullable=False)  # Fernet encrypted value

    org = relationship("Org")
