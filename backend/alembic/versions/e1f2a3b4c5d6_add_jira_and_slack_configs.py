"""add jira and slack configs

Revision ID: e1f2a3b4c5d6
Revises: d5e6c7b8a910
Create Date: 2026-07-16 23:55:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'e1f2a3b4c5d6'
down_revision: Union[str, Sequence[str], None] = 'd5e6c7b8a910'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create jira_configs table
    op.create_table(
        'jira_configs',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('org_id', sa.UUID(), nullable=False),
        sa.Column('base_url', sa.String(length=255), nullable=False),
        sa.Column('project_key', sa.String(length=50), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('api_token', sa.String(length=512), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['org_id'], ['orgs.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_jira_configs_org_id'), 'jira_configs', ['org_id'], unique=True)

    # 2. Create slack_configs table
    op.create_table(
        'slack_configs',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('org_id', sa.UUID(), nullable=False),
        sa.Column('webhook_url', sa.String(length=512), nullable=False),
        sa.Column('channel', sa.String(length=100), nullable=False),
        sa.Column('critical_only', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['org_id'], ['orgs.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_slack_configs_org_id'), 'slack_configs', ['org_id'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_slack_configs_org_id'), table_name='slack_configs')
    op.drop_table('slack_configs')
    op.drop_index(op.f('ix_jira_configs_org_id'), table_name='jira_configs')
    op.drop_table('jira_configs')
