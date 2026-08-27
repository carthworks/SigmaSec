"""add github configs

Revision ID: f2f3a4b5c6d7
Revises: e1f2a3b4c5d6
Create Date: 2026-07-17 07:44:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'f2f3a4b5c6d7'
down_revision: Union[str, Sequence[str], None] = 'e1f2a3b4c5d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'github_configs',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('org_id', sa.UUID(), nullable=False),
        sa.Column('installation_id', sa.String(length=255), nullable=True),
        sa.Column('access_token', sa.String(length=512), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['org_id'], ['orgs.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_github_configs_org_id'), 'github_configs', ['org_id'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_github_configs_org_id'), table_name='github_configs')
    op.drop_table('github_configs')
