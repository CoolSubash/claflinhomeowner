"""create roles and permissions tables

Revision ID: a0c751054685
Revises: 43c68d6abb7c
Create Date: 2026-09-11 13:29:04.601257

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'a0c751054685'
down_revision: Union[str, None] = '43c68d6abb7c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE roles (
            id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name          VARCHAR(50) NOT NULL,
            description   TEXT,
            created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute("CREATE UNIQUE INDEX uq_roles_name ON roles (name)")

    op.execute(
        """
        CREATE TABLE permissions (
            id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            key           VARCHAR(100) NOT NULL,
            description   TEXT,
            created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute("CREATE UNIQUE INDEX uq_permissions_key ON permissions (key)")

    op.execute(
        """
        CREATE TABLE user_roles (
            user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            role_id     UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (user_id, role_id)
        )
        """
    )
    op.execute("CREATE INDEX ix_user_roles_role_id ON user_roles (role_id)")

    op.execute(
        """
        CREATE TABLE role_permissions (
            role_id        UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
            permission_id  UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
            PRIMARY KEY (role_id, permission_id)
        )
        """
    )
    op.execute(
        "CREATE INDEX ix_role_permissions_permission_id ON role_permissions (permission_id)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS role_permissions")
    op.execute("DROP TABLE IF EXISTS user_roles")
    op.execute("DROP TABLE IF EXISTS permissions")
    op.execute("DROP TABLE IF EXISTS roles")
