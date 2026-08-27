"""add findings indexes

Revision ID: f3a4b5c6d7e8
Revises: f2f3a4b5c6d7
Create Date: 2026-07-19 23:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f3a4b5c6d7e8'
down_revision: Union[str, Sequence[str], None] = 'f2f3a4b5c6d7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    existing_indexes = [idx["name"] for idx in inspector.get_indexes("findings")]

    # 1. Composite index on (org_id, scan_id)
    if "idx_findings_org_scan" not in existing_indexes:
        op.create_index("idx_findings_org_scan", "findings", ["org_id", "scan_id"])

    # 2. Composite index on (org_id, severity)
    if "idx_findings_org_severity" not in existing_indexes:
        op.create_index("idx_findings_org_severity", "findings", ["org_id", "severity"])

    # 3. Single index on (cve_id)
    if "ix_findings_cve_id" not in existing_indexes:
        op.create_index("ix_findings_cve_id", "findings", ["cve_id"])

    # 4. Single index on (priority_score DESC)
    if "ix_findings_priority_score_desc" not in existing_indexes:
        op.create_index("ix_findings_priority_score_desc", "findings", [sa.text("priority_score DESC")])


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    existing_indexes = [idx["name"] for idx in inspector.get_indexes("findings")]

    if "ix_findings_priority_score_desc" in existing_indexes:
        op.drop_index("ix_findings_priority_score_desc", table_name="findings")

    if "ix_findings_cve_id" in existing_indexes:
        op.drop_index("ix_findings_cve_id", table_name="findings")

    if "idx_findings_org_severity" in existing_indexes:
        op.drop_index("idx_findings_org_severity", table_name="findings")

    if "idx_findings_org_scan" in existing_indexes:
        op.drop_index("idx_findings_org_scan", table_name="findings")
