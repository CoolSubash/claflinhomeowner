from __future__ import annotations

import logging
from collections.abc import Iterator
from contextlib import contextmanager

from psycopg import Connection
from psycopg_pool import ConnectionPool

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_pool: ConnectionPool | None = None


def get_pool() -> ConnectionPool:
    """Return the process-wide connection pool, creating it on first use."""
    global _pool
    if _pool is None:
        settings = get_settings()
        if not settings.database_url:
            raise RuntimeError("DATABASE_URL is not configured")
        _pool = ConnectionPool(conninfo=settings.database_url, open=True)
    return _pool


def close_pool() -> None:
    """Close the pool and release all connections. Safe to call repeatedly."""
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


@contextmanager
def get_connection() -> Iterator[Connection]:
    """
    Borrow a connection from the pool for the duration of the block.

    Commits on success, rolls back on exception, and always returns the
    connection to the pool rather than leaking it.
    """
    pool = get_pool()
    with pool.connection() as conn:
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
