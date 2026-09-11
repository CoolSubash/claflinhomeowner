"""seed initial roles

Revision ID: 3b9836935094
Revises: 59cb86819d86
Create Date: 2026-09-11 13:57:23.832244

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '3b9836935094'
down_revision: Union[str, None] = '59cb86819d86'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Data-only migration: the initial roles are reference data required
    # for registration to attach a USER role (CLAUDE.md §8), not new RBAC
    # logic. Permission-string assignment to these roles happens in the
    # phase that implements authorization enforcement.
    op.execute(
        """
        INSERT INTO roles (name, description) VALUES
            ('USER', 'Standard authenticated user'),
            ('ADMIN', 'Full administrative access'),
            ('SUPPORT', 'Customer support staff'),
            ('REALTOR', 'Real estate professional partner')
        """
    )


def downgrade() -> None:
    op.execute(
        "DELETE FROM roles WHERE name IN ('USER', 'ADMIN', 'SUPPORT', 'REALTOR')"
    )
