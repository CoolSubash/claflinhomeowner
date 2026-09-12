from psycopg import Connection
from psycopg.rows import dict_row


def count_users(conn: Connection) -> int:
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM users")
        (count,) = cur.fetchone()
    return count


def list_users_with_roles(conn: Connection) -> list[dict]:
    """Administrative listing (requires user:read:any) - every account plus its role names."""
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT u.id, u.email, u.first_name, u.last_name, u.is_active, u.email_verified, u.created_at,
                   COALESCE(array_agg(r.name) FILTER (WHERE r.name IS NOT NULL), '{}') AS roles
            FROM users u
            LEFT JOIN user_roles ur ON ur.user_id = u.id
            LEFT JOIN roles r ON r.id = ur.role_id
            GROUP BY u.id
            ORDER BY u.created_at DESC
            """
        )
        return cur.fetchall()
