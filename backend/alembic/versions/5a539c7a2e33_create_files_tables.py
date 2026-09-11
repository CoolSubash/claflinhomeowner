"""create files tables

Revision ID: 5a539c7a2e33
Revises: 2c200096d5cb
Create Date: 2026-09-11 13:29:10.034196

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '5a539c7a2e33'
down_revision: Union[str, None] = '2c200096d5cb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE files (
            id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            assessment_id       UUID REFERENCES assessments(id) ON DELETE SET NULL,
            chat_session_id     UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
            original_filename   VARCHAR(255) NOT NULL,
            storage_key         TEXT NOT NULL,
            content_type        VARCHAR(100) NOT NULL,
            file_size           BIGINT NOT NULL,
            processing_status   VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                                    CHECK (processing_status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
            created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute("CREATE UNIQUE INDEX uq_files_storage_key ON files (storage_key)")
    op.execute("CREATE INDEX ix_files_user_id ON files (user_id)")
    op.execute("CREATE INDEX ix_files_assessment_id ON files (assessment_id)")
    op.execute("CREATE INDEX ix_files_chat_session_id ON files (chat_session_id)")

    op.execute(
        """
        CREATE TABLE file_extractions (
            id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            file_id             UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
            user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            extracted_text      TEXT,
            structured_data     JSONB,
            processing_status   VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                                    CHECK (processing_status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
            created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE UNIQUE INDEX uq_file_extractions_file_id ON file_extractions (file_id)"
    )
    op.execute("CREATE INDEX ix_file_extractions_user_id ON file_extractions (user_id)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS file_extractions")
    op.execute("DROP TABLE IF EXISTS files")
