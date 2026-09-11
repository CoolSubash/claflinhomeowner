"""create real estate tables

Revision ID: 3f83a149589a
Revises: 5a539c7a2e33
Create Date: 2026-09-11 13:29:10.194567

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '3f83a149589a'
down_revision: Union[str, None] = '5a539c7a2e33'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE real_estate_partners (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name            VARCHAR(200) NOT NULL,
            contact_email   VARCHAR(320),
            contact_phone   VARCHAR(30),
            is_active       BOOLEAN NOT NULL DEFAULT true,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )

    op.execute(
        """
        CREATE TABLE connection_requests (
            id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            partner_id          UUID NOT NULL REFERENCES real_estate_partners(id) ON DELETE RESTRICT,
            status              VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                                    CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED')),
            consent_given_at    TIMESTAMPTZ NOT NULL,
            created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE INDEX ix_connection_requests_user_id ON connection_requests (user_id)"
    )
    op.execute(
        "CREATE INDEX ix_connection_requests_partner_id ON connection_requests (partner_id)"
    )
    op.execute(
        """
        CREATE TRIGGER trg_connection_requests_set_updated_at
        BEFORE UPDATE ON connection_requests
        FOR EACH ROW
        EXECUTE FUNCTION set_updated_at()
        """
    )


def downgrade() -> None:
    op.execute(
        "DROP TRIGGER IF EXISTS trg_connection_requests_set_updated_at ON connection_requests"
    )
    op.execute("DROP TABLE IF EXISTS connection_requests")
    op.execute("DROP TABLE IF EXISTS real_estate_partners")
