"""seed permissions and role permissions

Revision ID: 2a66097269d8
Revises: 3b9836935094
Create Date: 2026-09-11 14:25:37.826222

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '2a66097269d8'
down_revision: Union[str, None] = '3b9836935094'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # The permission catalog - CLAUDE.md section 8 / Phase 4 RBAC spec.
    op.execute(
        """
        INSERT INTO permissions (key, description) VALUES
            ('assessment:create',    'Create a new readiness assessment'),
            ('assessment:read:own',  'Read an assessment owned by the caller'),
            ('assessment:read:any',  'Read any user''s assessment (administrative)'),
            ('assessment:update:own','Update an assessment owned by the caller'),

            ('chat:create',   'Create a chat session/message'),
            ('chat:read:own', 'Read a chat session owned by the caller'),

            ('file:create',      'Upload a file'),
            ('file:read:own',    'Read a file owned by the caller'),
            ('file:delete:own',  'Delete a file owned by the caller'),

            ('user:read:any', 'Read any user''s account information (administrative)'),

            ('audit:read', 'Read audit log entries (administrative)'),

            ('scoring:update', 'Modify scoring methodology/versions (administrative)'),

            ('partner:manage', 'Manage real-estate partner records (administrative)'),

            ('connection:create', 'Request a connection with a real-estate partner')
        """
    )

    # Role -> permission grants. Table-driven per CLAUDE.md/RBAC-spec: the
    # database, not application code, is the source of truth for who gets
    # what. See docs/authorization.md for the rationale behind each grant.
    #
    # USER: the standard self-service permissions for a signed-up user.
    op.execute(
        """
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id
        FROM roles r, permissions p
        WHERE r.name = 'USER'
          AND p.key IN (
              'assessment:create',
              'assessment:read:own',
              'assessment:update:own',
              'chat:create',
              'chat:read:own',
              'file:create',
              'file:read:own',
              'file:delete:own',
              'connection:create'
          )
        """
    )

    # ADMIN: explicit administrative permissions only - not "everything".
    op.execute(
        """
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id
        FROM roles r, permissions p
        WHERE r.name = 'ADMIN'
          AND p.key IN (
              'assessment:read:any',
              'user:read:any',
              'audit:read',
              'scoring:update',
              'partner:manage'
          )
        """
    )

    # SUPPORT: only what's needed to look up an account for a support
    # ticket. Explicitly excludes scoring:update, partner:manage, and any
    # permission that exposes a user's financial data (assessment:read:any,
    # file:read:*, chat:read:*) - none of that is granted here.
    op.execute(
        """
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id
        FROM roles r, permissions p
        WHERE r.name = 'SUPPORT'
          AND p.key IN (
              'user:read:any'
          )
        """
    )

    # REALTOR: intentionally granted no permissions yet. The connection
    # workflow needs a realtor-facing "view requests shared with me"
    # permission, but that requires linking real_estate_partners to a user
    # account - a schema/business-logic decision that belongs to the phase
    # that implements the real-estate connection workflow, not this one.
    # See docs/authorization.md for details.


def downgrade() -> None:
    op.execute(
        """
        DELETE FROM role_permissions
        WHERE role_id IN (SELECT id FROM roles WHERE name IN ('USER', 'ADMIN', 'SUPPORT', 'REALTOR'))
        """
    )
    op.execute(
        """
        DELETE FROM permissions
        WHERE key IN (
            'assessment:create',
            'assessment:read:own',
            'assessment:read:any',
            'assessment:update:own',
            'chat:create',
            'chat:read:own',
            'file:create',
            'file:read:own',
            'file:delete:own',
            'user:read:any',
            'audit:read',
            'scoring:update',
            'partner:manage',
            'connection:create'
        )
        """
    )
