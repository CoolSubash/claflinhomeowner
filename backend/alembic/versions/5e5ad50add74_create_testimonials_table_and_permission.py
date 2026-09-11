"""create testimonials table and permission

Revision ID: 5e5ad50add74
Revises: 2a66097269d8
Create Date: 2026-09-11 15:34:34.303685

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '5e5ad50add74'
down_revision: Union[str, None] = '2a66097269d8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE testimonials (
            id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            rating        SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
            content       VARCHAR(500) NOT NULL,
            created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    # One testimonial per account - keeps a single user from flooding the
    # public-facing selection with repeated submissions.
    op.execute("CREATE UNIQUE INDEX uq_testimonials_user_id ON testimonials (user_id)")
    # The public "featured" query filters on rating and orders by
    # (rating, created_at) - index that access pattern directly.
    op.execute(
        "CREATE INDEX ix_testimonials_rating_created_at ON testimonials (rating DESC, created_at DESC)"
    )

    # New permission: who may submit a testimonial at all. Public reads
    # (the featured-testimonials list shown on the homepage) require no
    # permission - they're unauthenticated marketing content.
    op.execute(
        """
        INSERT INTO permissions (key, description) VALUES
            ('testimonial:create', 'Submit a testimonial/review about the application')
        """
    )
    op.execute(
        """
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id
        FROM roles r, permissions p
        WHERE r.name IN ('USER', 'REALTOR')
          AND p.key = 'testimonial:create'
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DELETE FROM role_permissions
        WHERE permission_id IN (SELECT id FROM permissions WHERE key = 'testimonial:create')
        """
    )
    op.execute("DELETE FROM permissions WHERE key = 'testimonial:create'")
    op.execute("DROP TABLE IF EXISTS testimonials")
