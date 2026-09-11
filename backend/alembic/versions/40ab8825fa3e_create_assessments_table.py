"""create assessments table

Revision ID: 40ab8825fa3e
Revises: e57b12790ccc
Create Date: 2026-09-11 13:29:09.466676

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '40ab8825fa3e'
down_revision: Union[str, None] = 'e57b12790ccc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE assessments (
            id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            status              VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
                                    CHECK (status IN ('DRAFT', 'SUBMITTED', 'PROCESSING', 'COMPLETED', 'FAILED')),
            income              NUMERIC(12,2),
            monthly_debt        NUMERIC(12,2),
            credit_score        SMALLINT,
            savings             NUMERIC(12,2),
            down_payment        NUMERIC(12,2),
            target_home_price   NUMERIC(12,2),
            employment_years    NUMERIC(4,1),
            location            TEXT,
            created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
            submitted_at        TIMESTAMPTZ
        )
        """
    )
    op.execute("CREATE INDEX ix_assessments_user_id ON assessments (user_id)")
    op.execute(
        """
        CREATE TRIGGER trg_assessments_set_updated_at
        BEFORE UPDATE ON assessments
        FOR EACH ROW
        EXECUTE FUNCTION set_updated_at()
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_assessments_set_updated_at ON assessments")
    op.execute("DROP TABLE IF EXISTS assessments")
