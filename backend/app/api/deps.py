from collections.abc import Iterator

from psycopg import Connection

from app.db.connection import get_connection


def get_db() -> Iterator[Connection]:
    with get_connection() as conn:
        yield conn


# Additional dependencies (auth, current user, etc.) will be added
# as the corresponding phases are implemented.
