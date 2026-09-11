"""create readiness results tables

Revision ID: 81b554a986a8
Revises: 40ab8825fa3e
Create Date: 2026-09-11 13:29:09.608175

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '81b554a986a8'
down_revision: Union[str, None] = '40ab8825fa3e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE readiness_results (
            id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            assessment_id        UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
            user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            scoring_version_id   UUID NOT NULL REFERENCES scoring_versions(id) ON DELETE RESTRICT,
            overall_score        SMALLINT NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
            status               VARCHAR(20) NOT NULL
                                     CHECK (status IN ('NOT_READY', 'NEEDS_IMPROVEMENT', 'ALMOST_READY', 'READY', 'HIGHLY_READY')),
            created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE INDEX ix_readiness_results_assessment_id ON readiness_results (assessment_id)"
    )
    op.execute(
        "CREATE INDEX ix_readiness_results_user_id ON readiness_results (user_id)"
    )

    op.execute(
        """
        CREATE TABLE score_breakdowns (
            id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            readiness_result_id   UUID NOT NULL REFERENCES readiness_results(id) ON DELETE CASCADE,
            user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            category              VARCHAR(50) NOT NULL
                                      CHECK (category IN ('financial_stability', 'debt_management', 'down_payment', 'credit', 'savings', 'employment_stability')),
            raw_value             NUMERIC(12,2),
            category_score        SMALLINT NOT NULL CHECK (category_score BETWEEN 0 AND 100),
            weight                NUMERIC(4,3) NOT NULL,
            created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE INDEX ix_score_breakdowns_readiness_result_id ON score_breakdowns (readiness_result_id)"
    )
    op.execute("CREATE INDEX ix_score_breakdowns_user_id ON score_breakdowns (user_id)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS score_breakdowns")
    op.execute("DROP TABLE IF EXISTS readiness_results")
