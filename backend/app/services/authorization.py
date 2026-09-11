from __future__ import annotations

from uuid import UUID

from psycopg import Connection
from psycopg.rows import dict_row


def get_user_roles_and_permissions(conn: Connection, user_id: UUID) -> tuple[set[str], set[str]]:
    """
    Resolve a user's roles and effective (unioned) permissions in a single
    round trip:

        user_roles -> roles -> role_permissions -> permissions

    A role with no permissions yet (e.g. REALTOR today) still appears in
    `roles` via the LEFT JOINs; it just contributes nothing to `permissions`.
    """
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT r.name AS role_name, p.key AS permission_key
            FROM user_roles ur
            JOIN roles r ON r.id = ur.role_id
            LEFT JOIN role_permissions rp ON rp.role_id = ur.role_id
            LEFT JOIN permissions p ON p.id = rp.permission_id
            WHERE ur.user_id = %s
            """,
            (user_id,),
        )
        rows = cur.fetchall()

    roles = {row["role_name"] for row in rows}
    permissions = {row["permission_key"] for row in rows if row["permission_key"] is not None}
    return roles, permissions
