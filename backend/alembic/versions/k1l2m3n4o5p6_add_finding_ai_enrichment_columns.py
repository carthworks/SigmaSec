"""Add structured AI enrichment and reachability context columns to findings

The Finding model gained these columns without a migration, so a database
created from migrations alone could not store findings. IF NOT EXISTS keeps
this safe on databases where the columns were added by hand.

Revision ID: k1l2m3n4o5p6
Revises: j0k1l2m3n4o5
Create Date: 2026-10-02
"""

from alembic import op

revision = "k1l2m3n4o5p6"
down_revision = "j0k1l2m3n4o5"
branch_labels = None
depends_on = None

COLUMNS = [
    ("ai_why_now", "TEXT"),
    ("ai_remediation_structured", "JSONB"),
    ("ai_patch", "JSONB"),
    ("ai_blockers", "JSONB"),
    ("ai_breaking_change_risk", "VARCHAR(20)"),
    ("ai_confidence", "DOUBLE PRECISION"),
    ("ai_insufficient_context", "JSONB"),
    ("reachability_context", "JSONB"),
]


def upgrade() -> None:
    for name, sql_type in COLUMNS:
        op.execute(f"ALTER TABLE findings ADD COLUMN IF NOT EXISTS {name} {sql_type}")


def downgrade() -> None:
    for name, _ in reversed(COLUMNS):
        op.execute(f"ALTER TABLE findings DROP COLUMN IF EXISTS {name}")
