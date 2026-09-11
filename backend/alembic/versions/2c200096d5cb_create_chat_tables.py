"""create chat tables

Revision ID: 2c200096d5cb
Revises: 6d6a93a0acc1
Create Date: 2026-09-11 13:29:09.891892

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '2c200096d5cb'
down_revision: Union[str, None] = '6d6a93a0acc1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE chat_sessions (
            id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            title          VARCHAR(200),
            assessment_id  UUID REFERENCES assessments(id) ON DELETE SET NULL,
            created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute("CREATE INDEX ix_chat_sessions_user_id ON chat_sessions (user_id)")
    op.execute(
        "CREATE INDEX ix_chat_sessions_assessment_id ON chat_sessions (assessment_id)"
    )
    op.execute(
        """
        CREATE TRIGGER trg_chat_sessions_set_updated_at
        BEFORE UPDATE ON chat_sessions
        FOR EACH ROW
        EXECUTE FUNCTION set_updated_at()
        """
    )

    op.execute(
        """
        CREATE TABLE chat_messages (
            id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            session_id     UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
            user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            role           VARCHAR(10) NOT NULL CHECK (role IN ('USER', 'ASSISTANT', 'SYSTEM')),
            content        TEXT NOT NULL,
            created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute("CREATE INDEX ix_chat_messages_session_id ON chat_messages (session_id)")
    op.execute("CREATE INDEX ix_chat_messages_user_id ON chat_messages (user_id)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS chat_messages")
    op.execute("DROP TRIGGER IF EXISTS trg_chat_sessions_set_updated_at ON chat_sessions")
    op.execute("DROP TABLE IF EXISTS chat_sessions")
