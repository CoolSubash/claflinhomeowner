"""create email verification tokens table

Revision ID: 5c4803c01e8b
Revises: 484310a89338
Create Date: 2026-09-12 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '5c4803c01e8b'
down_revision: Union[str, None] = '484310a89338'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Same shape/rationale as refresh_tokens: the plaintext token is never
    # stored, only its SHA-256 hash (app/security/tokens.py::hash_token) -
    # a verification token is high-entropy random data, not a human
    # password, so a fast collision-resistant hash is correct here, not
    # Argon2id (see docs/authentication.md).
    op.execute(
        """
        CREATE TABLE email_verification_tokens (
            id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            token_hash    VARCHAR(64) NOT NULL,
            expires_at    TIMESTAMPTZ NOT NULL,
            used_at       TIMESTAMPTZ,
            created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE UNIQUE INDEX uq_email_verification_tokens_token_hash ON email_verification_tokens (token_hash)"
    )
    op.execute(
        "CREATE INDEX ix_email_verification_tokens_user_id ON email_verification_tokens (user_id)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS email_verification_tokens")
