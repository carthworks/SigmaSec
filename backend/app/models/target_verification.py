import uuid

from sqlalchemy import Column, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID

from .base import Base, TimestampMixin


class TargetVerification(Base, TimestampMixin):
    """
    An organisation's proof that it controls a domain or IP, required before
    SigmaSec sends active (web or network) scan traffic to it.
    See app.security.ownership for the methods.
    """

    __tablename__ = "target_verifications"
    __table_args__ = (UniqueConstraint("org_id", "scope", "method", name="uq_target_verification_scope"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("orgs.id"), nullable=False, index=True)
    scope = Column(String(255), nullable=False)  # lower-cased domain or IP
    method = Column(String(20), nullable=False)  # dns_txt | http_file
    token = Column(String(64), nullable=False)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    last_checked_at = Column(DateTime(timezone=True), nullable=True)
    last_check_detail = Column(Text, nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
