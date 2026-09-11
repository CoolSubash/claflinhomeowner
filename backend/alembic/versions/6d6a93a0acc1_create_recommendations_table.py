"""create recommendations table

Revision ID: 6d6a93a0acc1
Revises: 81b554a986a8
Create Date: 2026-09-11 13:29:09.749613

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '6d6a93a0acc1'
down_revision: Union[str, None] = '81b554a986a8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE recommendations (
            id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            readiness_result_id   UUID NOT NULL REFERENCES readiness_results(id) ON DELETE CASCADE,
            user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            category              VARCHAR(50) NOT NULL,
            priority              VARCHAR(10) NOT NULL CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH')),
            title                 VARCHAR(200) NOT NULL,
            description           TEXT NOT NULL,
            source                VARCHAR(20) NOT NULL DEFAULT 'system' CHECK (source IN ('system', 'ai')),
            created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE INDEX ix_recommendations_readiness_result_id ON recommendations (readiness_result_id)"
    )
    op.execute("CREATE INDEX ix_recommendations_user_id ON recommendations (user_id)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS recommendations")
