"""alter score breakdowns and readiness results for scoring engine

Revision ID: ccfdce7b23e5
Revises: 5e5ad50add74
Create Date: 2026-09-11 16:43:00.602438

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'ccfdce7b23e5'
down_revision: Union[str, None] = '5e5ad50add74'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Phase 2's score_breakdowns has category/raw_value/category_score/weight
    # but no explanation text. Phase 6 requires each breakdown to be
    # explainable, and the explanation must be generated deterministically
    # from (category, score) at scoring time and then frozen alongside the
    # rest of the breakdown - if it were instead recomputed from a template
    # function at read time, a future wording change to that function would
    # silently alter how an already-frozen historical result reads, which
    # violates the historical-immutability requirement just as much as
    # changing its score would.
    op.execute(
        "ALTER TABLE score_breakdowns ADD COLUMN explanation TEXT NOT NULL DEFAULT ''"
    )

    # Enforces "one canonical result per assessment per scoring version" at
    # the database level, not just in application logic - a second POST
    # /assessments/{id}/score for the same (assessment, scoring version)
    # must find this row already exists rather than being able to insert a
    # duplicate.
    op.execute(
        """
        CREATE UNIQUE INDEX uq_readiness_results_assessment_scoring_version
        ON readiness_results (assessment_id, scoring_version_id)
        """
    )


def downgrade() -> None:
    op.execute(
        "DROP INDEX IF EXISTS uq_readiness_results_assessment_scoring_version"
    )
    op.execute("ALTER TABLE score_breakdowns DROP COLUMN IF EXISTS explanation")
