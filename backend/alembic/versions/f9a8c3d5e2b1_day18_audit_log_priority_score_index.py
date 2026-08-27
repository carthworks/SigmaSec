"""day18_audit_log_priority_score_index

Revision ID: f9a8c3d5e2b1
Revises: ea290e24f810
Create Date: 2026-07-09 00:00:00.000000

Day 18 tasks:
- Ensure audit_logs table exists with all required columns
- Add index on audit_logs.action for efficient filtering
- Add index on findings.exploit_validated for FR-SCN-13 queries
- Add index on findings.priority_score for sorting
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "f9a8c3d5e2b1"
down_revision = "ea290e24f810"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Ensure audit_logs table exists (idempotent guard)
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    if "audit_logs" not in existing_tables:
        op.create_table(
            "audit_logs",
            sa.Column(
                "id",
                postgresql.UUID(as_uuid=True),
                primary_key=True,
                server_default=sa.text("gen_random_uuid()"),
            ),
            sa.Column(
                "org_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("orgs.id"),
                nullable=False,
                index=True,
            ),
            sa.Column(
                "user_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("users.id"),
                nullable=True,
                index=True,
            ),
            sa.Column("action", sa.String(100), nullable=False),
            sa.Column("target_type", sa.String(50), nullable=False),
            sa.Column("target_id", sa.String(100), nullable=False),
            sa.Column("details", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(),
                nullable=False,
                server_default=sa.text("now()"),
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(),
                nullable=False,
                server_default=sa.text("now()"),
            ),
        )

    # Add index on audit_logs.action if not already present
    existing_audit_indexes = [
        idx["name"] for idx in inspector.get_indexes("audit_logs")
        if "audit_logs" in existing_tables
    ] if "audit_logs" in existing_tables else []

    if "ix_audit_logs_action" not in existing_audit_indexes:
        op.create_index("ix_audit_logs_action", "audit_logs", ["action"])

    # Add index on findings.exploit_validated if not already present
    existing_finding_indexes = [idx["name"] for idx in inspector.get_indexes("findings")]
    if "ix_findings_exploit_validated" not in existing_finding_indexes:
        op.create_index(
            "ix_findings_exploit_validated", "findings", ["exploit_validated"]
        )

    # Add index on findings.priority_score if not present
    if "ix_findings_priority_score" not in existing_finding_indexes:
        # priority_score column was added in initial schema; just add the index
        op.create_index(
            "ix_findings_priority_score", "findings", ["priority_score"]
        )


def downgrade() -> None:
    op.drop_index("ix_findings_priority_score", table_name="findings")
    op.drop_index("ix_findings_exploit_validated", table_name="findings")
    op.drop_index("ix_audit_logs_action", table_name="audit_logs")
