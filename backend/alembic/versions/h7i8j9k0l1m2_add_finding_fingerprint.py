"""Add fingerprint column and unique index to findings table

Revision ID: h7i8j9k0l1m2
Revises: g5h6i7j8k9l0
Create Date: 2026-07-26

"""

from alembic import op
import sqlalchemy as sa

revision = "h7i8j9k0l1m2"
down_revision = "g5h6i7j8k9l0"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE findings ADD COLUMN IF NOT EXISTS fingerprint VARCHAR(64)")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_findings_fingerprint ON findings (fingerprint)")


def downgrade():
    op.drop_index("ix_findings_fingerprint", table_name="findings")
    op.drop_column("findings", "fingerprint")
