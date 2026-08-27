"""add scan_id and call_type to ai_calls

Revision ID: d5e6c7b8a910
Revises: a1b2c3d4e5f6
Create Date: 2026-07-16 13:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d5e6c7b8a910"
down_revision: Union[str, Sequence[str], None] = ("f9a8c3d5e2b1", "b3f1a2c9d7e0", "a1b2c3d4e5f6")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("ai_calls", sa.Column("scan_id", sa.UUID(), nullable=True))
    op.add_column("ai_calls", sa.Column("call_type", sa.String(length=50), nullable=True))
    op.create_foreign_key(
        "fk_ai_calls_scan_id",
        "ai_calls",
        "scans",
        ["scan_id"],
        ["id"],
        ondelete="SET NULL"
    )
    op.create_index(op.f("ix_ai_calls_scan_id"), "ai_calls", ["scan_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_ai_calls_scan_id"), table_name="ai_calls")
    op.drop_constraint("fk_ai_calls_scan_id", "ai_calls", type_="foreignkey")
    op.drop_column("ai_calls", "call_type")
    op.drop_column("ai_calls", "scan_id")
