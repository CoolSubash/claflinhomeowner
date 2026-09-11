"""add recommendations idempotency index

Revision ID: 484310a89338
Revises: 3d5368a4a92f
Create Date: 2026-09-11 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '484310a89338'
down_revision: Union[str, None] = '3d5368a4a92f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Phase 7 requires "one recommendation set per readiness_result" (no
    # duplicate rows on repeated GET calls). Same pattern as
    # uq_readiness_results_assessment_scoring_version: idempotency is
    # enforced at the database level as a backstop, not only in the
    # application's check-then-insert logic.
    op.execute(
        """
        CREATE UNIQUE INDEX uq_recommendations_readiness_result_category
        ON recommendations (readiness_result_id, category)
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_recommendations_readiness_result_category")
