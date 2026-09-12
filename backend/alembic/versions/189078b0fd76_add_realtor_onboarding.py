"""add realtor onboarding: partner-user link, invitations, connection:respond:own

Revision ID: 189078b0fd76
Revises: 5c4803c01e8b
Create Date: 2026-09-12 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '189078b0fd76'
down_revision: Union[str, None] = '5c4803c01e8b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # The missing link docs/authorization.md called out: a REALTOR account
    # has no way to be tied to a specific real_estate_partners row until
    # this column exists. Nullable + ON DELETE SET NULL: a partner record
    # can exist before anyone has been onboarded to it (created by an
    # admin ahead of sending the invite), and deleting a user should never
    # cascade into deleting the partner record itself.
    op.execute(
        "ALTER TABLE real_estate_partners ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE SET NULL"
    )
    op.execute(
        "CREATE UNIQUE INDEX uq_real_estate_partners_user_id ON real_estate_partners (user_id) WHERE user_id IS NOT NULL"
    )

    # Same shape as email_verification_tokens/refresh_tokens: a random
    # token, only its hash stored, single-use, expiring. invited_by is
    # SET NULL (not CASCADE) so deleting the admin who sent an invite
    # doesn't retroactively delete the invitation record itself.
    op.execute(
        """
        CREATE TABLE realtor_invitations (
            id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            partner_id    UUID NOT NULL REFERENCES real_estate_partners(id) ON DELETE CASCADE,
            email         VARCHAR(320) NOT NULL,
            token_hash    VARCHAR(64) NOT NULL,
            invited_by    UUID REFERENCES users(id) ON DELETE SET NULL,
            expires_at    TIMESTAMPTZ NOT NULL,
            used_at       TIMESTAMPTZ,
            created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE UNIQUE INDEX uq_realtor_invitations_token_hash ON realtor_invitations (token_hash)"
    )
    op.execute(
        "CREATE INDEX ix_realtor_invitations_partner_id ON realtor_invitations (partner_id)"
    )

    # A REALTOR needs its own permission to view/respond to connection
    # requests routed to the partner record it's linked to - distinct from
    # connection:create (the USER-side permission for requesting a
    # connection in the first place).
    op.execute(
        "INSERT INTO permissions (key, description) VALUES "
        "('connection:respond:own', 'Respond to a connection request addressed to the caller''s linked real-estate partner record')"
    )
    op.execute(
        """
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id FROM roles r, permissions p
        WHERE r.name = 'REALTOR' AND p.key = 'connection:respond:own'
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DELETE FROM role_permissions
        WHERE permission_id = (SELECT id FROM permissions WHERE key = 'connection:respond:own')
        """
    )
    op.execute("DELETE FROM permissions WHERE key = 'connection:respond:own'")
    op.execute("DROP TABLE IF EXISTS realtor_invitations")
    op.execute("DROP INDEX IF EXISTS uq_real_estate_partners_user_id")
    op.execute("ALTER TABLE real_estate_partners DROP COLUMN IF EXISTS user_id")
