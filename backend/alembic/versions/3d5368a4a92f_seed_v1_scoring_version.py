"""seed v1 scoring version

Revision ID: 3d5368a4a92f
Revises: ccfdce7b23e5
Create Date: 2026-09-11 16:43:12.851716

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '3d5368a4a92f'
down_revision: Union[str, None] = 'ccfdce7b23e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Reference/audit snapshot of the v1 methodology (CLAUDE.md §13,
    # docs/scoring-v1.md). The executable source of truth is
    # app/services/scoring.py's WEIGHTS/READINESS bands - this row exists so
    # the methodology is introspectable from the database and so
    # readiness_results.scoring_version_id has something to point at. It is
    # never read back into the scoring calculation itself.
    op.execute(
        """
        INSERT INTO scoring_versions (version, weights, thresholds, is_active)
        VALUES (
            'v1',
            '{
                "financial_stability": 0.25,
                "debt_management": 0.25,
                "credit": 0.20,
                "down_payment": 0.15,
                "savings": 0.10,
                "employment_stability": 0.05
            }'::jsonb,
            '{
                "NOT_READY": [0, 39],
                "NEEDS_IMPROVEMENT": [40, 59],
                "ALMOST_READY": [60, 74],
                "READY": [75, 89],
                "HIGHLY_READY": [90, 100]
            }'::jsonb,
            true
        )
        """
    )


def downgrade() -> None:
    op.execute("DELETE FROM scoring_versions WHERE version = 'v1'")
