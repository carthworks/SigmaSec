import uuid
from sqlalchemy import Column, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from .base import Base, TimestampMixin

class AuditLog(Base, TimestampMixin):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("orgs.id"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    action = Column(String(100), nullable=False)  # e.g., "update_asset_weight", "start_scan"
    target_type = Column(String(50), nullable=False)  # e.g., "asset", "scan"
    target_id = Column(String(100), nullable=False)
    details = Column(JSONB, nullable=True)

    org = relationship("Org")
    user = relationship("User")
