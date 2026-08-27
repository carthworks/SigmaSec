"""Add network scan type and host asset type

Revision ID: i9j0k1l2m3n4
Revises: h7i8j9k0l1m2
Create Date: 2026-08-24

Adds:
  - 'network' value to the scantype postgres enum  (Nmap support)
  - 'host'    value to the assettype postgres enum  (host/IP asset)

Uses IF NOT EXISTS so the migration is idempotent.
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "i9j0k1l2m3n4"
down_revision = "h7i8j9k0l1m2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assettype') THEN
                ALTER TYPE assettype ADD VALUE IF NOT EXISTS 'host';
            END IF;
            IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'scantype') THEN
                ALTER TYPE scantype ADD VALUE IF NOT EXISTS 'network';
            END IF;
        END $$;
    """)


def downgrade() -> None:
    # Postgres does not support removing enum values without recreating the type.
    # Downgrade is intentionally a no-op; remove values manually if needed.
    pass
