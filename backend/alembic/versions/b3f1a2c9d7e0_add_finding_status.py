"""add finding status column

Revision ID: b3f1a2c9d7e0
Revises: ea290e24f810
Create Date: 2026-07-08 10:25:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b3f1a2c9d7e0"
down_revision: Union[str, None] = "ea290e24f810"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Enum values that match the FindingStatus Python enum
finding_status_enum = sa.Enum(
    "new",
    "investigating",
    "in_progress",
    "fixed",
    "accepted_risk",
    "false_positive",
    name="findingstatus",
)


def upgrade() -> None:
    # Create the postgres ENUM type first, then add the column
    finding_status_enum.create(op.get_bind(), checkfirst=True)
    op.add_column(
        "findings",
        sa.Column(
            "status",
            finding_status_enum,
            nullable=False,
            server_default="new",
        ),
    )
    # Add tags JSONB column
    from sqlalchemy.dialects import postgresql
    op.add_column(
        "findings",
        sa.Column(
            "tags",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="[]",
        ),
    )
    # Remove server_default after backfill — keep it nullable-free
    op.alter_column("findings", "status", server_default=None)
    op.alter_column("findings", "tags", server_default=None)


def downgrade() -> None:
    op.drop_column("findings", "tags")
    op.drop_column("findings", "status")
    finding_status_enum.drop(op.get_bind(), checkfirst=True)
