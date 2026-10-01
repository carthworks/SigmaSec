"""Add target_verifications table for scan target ownership proof

Revision ID: m3n4o5p6q7r8
Revises: l2m3n4o5p6q7
Create Date: 2026-10-02
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "m3n4o5p6q7r8"
down_revision = "l2m3n4o5p6q7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "target_verifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("orgs.id"), nullable=False),
        sa.Column("scope", sa.String(255), nullable=False),
        sa.Column("method", sa.String(20), nullable=False),
        sa.Column("token", sa.String(64), nullable=False),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_checked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_check_detail", sa.Text(), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("org_id", "scope", "method", name="uq_target_verification_scope"),
    )
    op.create_index("ix_target_verifications_org_id", "target_verifications", ["org_id"])


def downgrade() -> None:
    op.drop_index("ix_target_verifications_org_id", table_name="target_verifications")
    op.drop_table("target_verifications")
