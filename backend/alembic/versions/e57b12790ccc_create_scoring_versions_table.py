"""create scoring versions table

Revision ID: e57b12790ccc
Revises: e8c6f1ddb21f
Create Date: 2026-09-11 13:29:09.324887

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'e57b12790ccc'
down_revision: Union[str, None] = 'e8c6f1ddb21f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE scoring_versions (
            id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            version       VARCHAR(20) NOT NULL,
            weights       JSONB NOT NULL,
            thresholds    JSONB NOT NULL,
            is_active     BOOLEAN NOT NULL DEFAULT false,
            created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE UNIQUE INDEX uq_scoring_versions_version ON scoring_versions (version)"
    )
    # Only one scoring version may be active at a time - enforced at the DB
    # level with a partial unique index, not just application logic.
    op.execute(
        """
        CREATE UNIQUE INDEX uq_scoring_versions_one_active
        ON scoring_versions ((is_active))
        WHERE is_active = true
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS scoring_versions")
