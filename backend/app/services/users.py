from psycopg import Connection


def count_users(conn: Connection) -> int:
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM users")
        (count,) = cur.fetchone()
    return count
