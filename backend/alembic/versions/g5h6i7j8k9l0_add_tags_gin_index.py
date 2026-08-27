"""Add GIN index on findings.tags for fast JSONB tag lookup

Revision ID: g5h6i7j8k9l0
Revises: f3a4b5c6d7e8
Create Date: 2026-07-19

"""

from alembic import op

revision = "g5h6i7j8k9l0"
down_revision = "f3a4b5c6d7e8"
branch_labels = None
depends_on = None

# ← ADD THIS LINE
transaction_per_migration = False


def upgrade():
    with op.get_context().autocommit_block():
        op.execute(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_findings_tags_gin "
            "ON findings USING gin (tags jsonb_path_ops);"
        )


def downgrade():
    with op.get_context().autocommit_block():
        op.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_findings_tags_gin;")
