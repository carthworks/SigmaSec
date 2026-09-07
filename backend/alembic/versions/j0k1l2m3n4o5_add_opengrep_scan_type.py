"""Add opengrep scan type

Revision ID: j0k1l2m3n4o5
Revises: i9j0k1l2m3n4
Create Date: 2026-09-07

Adds:
  - 'opengrep' value to the scantype postgres enum (Opengrep SAST support)

Uses IF NOT EXISTS so the migration is idempotent.
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "j0k1l2m3n4o5"
down_revision = "i9j0k1l2m3n4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'scantype') THEN
                ALTER TYPE scantype ADD VALUE IF NOT EXISTS 'opengrep';
            END IF;
        END $$;
    """)


def downgrade() -> None:
    # Postgres does not support removing enum values without recreating the type.
    pass
