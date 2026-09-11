"""create refresh tokens table

Revision ID: e8c6f1ddb21f
Revises: a0c751054685
Create Date: 2026-09-11 13:29:09.184029

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'e8c6f1ddb21f'
down_revision: Union[str, None] = 'a0c751054685'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE refresh_tokens (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            token_hash      TEXT NOT NULL,
            issued_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
            expires_at      TIMESTAMPTZ NOT NULL,
            revoked_at      TIMESTAMPTZ,
            replaced_by_id  UUID REFERENCES refresh_tokens(id) ON DELETE SET NULL,
            user_agent      TEXT,
            ip_address      INET
        )
        """
    )
    op.execute(
        "CREATE UNIQUE INDEX uq_refresh_tokens_token_hash ON refresh_tokens (token_hash)"
    )
    op.execute("CREATE INDEX ix_refresh_tokens_user_id ON refresh_tokens (user_id)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS refresh_tokens")
