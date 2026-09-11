import os

import pytest

from app.db.connection import close_pool, get_connection

pytestmark = pytest.mark.skipif(
    not os.getenv("DATABASE_URL"),
    reason="DATABASE_URL not set; requires a running PostgreSQL instance",
)


def test_can_connect_and_run_query() -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
            assert cur.fetchone() == (1,)
    close_pool()
