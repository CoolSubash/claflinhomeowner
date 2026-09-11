"""create audit logs table

Revision ID: 59cb86819d86
Revises: 3f83a149589a
Create Date: 2026-09-11 13:29:10.347070

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '59cb86819d86'
down_revision: Union[str, None] = '3f83a149589a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE audit_logs (
            id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id        UUID REFERENCES users(id) ON DELETE SET NULL,
            action         VARCHAR(50) NOT NULL,
            resource_type  VARCHAR(50),
            resource_id    UUID,
            ip_address     INET,
            user_agent     TEXT,
            metadata       JSONB,
            created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute("CREATE INDEX ix_audit_logs_user_id ON audit_logs (user_id)")
    op.execute("CREATE INDEX ix_audit_logs_created_at ON audit_logs (created_at)")
    op.execute(
        "CREATE INDEX ix_audit_logs_resource ON audit_logs (resource_type, resource_id)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS audit_logs")
