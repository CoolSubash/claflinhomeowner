from __future__ import annotations
from uuid import UUID

from psycopg import Connection
from psycopg.types.json import Json


def log_event(
    conn: Connection,
    *,
    user_id: UUID | None,
    action: str,
    resource_type: str | None = None,
    resource_id: UUID | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    metadata: dict | None = None,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO audit_logs
                (user_id, action, resource_type, resource_id, ip_address, user_agent, metadata)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                user_id,
                action,
                resource_type,
                resource_id,
                ip_address,
                user_agent,
                Json(metadata) if metadata is not None else None,
            ),
        )
