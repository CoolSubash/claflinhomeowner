from __future__ import annotations

from uuid import UUID

from psycopg import Connection
from psycopg.rows import dict_row

from app.services.ownership import get_partner_owned_connection_request


class ConnectionRequestError(Exception):
    """Base class for connection-request-flow errors mapped to HTTP responses."""


class ConnectionRequestNotFound(ConnectionRequestError):
    pass


def _requester_name(first_name: str, last_name: str) -> str:
    # First name + last initial only - the realtor never sees a
    # requester's email or full name through this endpoint (docs/database.md,
    # same minimization pattern as public testimonials).
    initial = f"{last_name[0]}." if last_name else ""
    return f"{first_name} {initial}".strip()


def list_connection_requests_for_partner(conn: Connection, partner_id: UUID) -> list[dict]:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT cr.id, cr.status, cr.consent_given_at, cr.created_at, cr.updated_at,
                   u.first_name, u.last_name
            FROM connection_requests cr
            JOIN users u ON u.id = cr.user_id
            WHERE cr.partner_id = %s
            ORDER BY cr.created_at DESC
            """,
            (partner_id,),
        )
        rows = cur.fetchall()

    for row in rows:
        row["requester_name"] = _requester_name(row.pop("first_name"), row.pop("last_name"))
    return rows


def respond_to_connection_request(
    conn: Connection, *, request_id: UUID, partner_id: UUID, status: str
) -> dict:
    """Raises ConnectionRequestNotFound if the request doesn't exist or isn't addressed to this partner."""
    existing = get_partner_owned_connection_request(conn, request_id, partner_id)
    if existing is None:
        raise ConnectionRequestNotFound()

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "UPDATE connection_requests SET status = %s WHERE id = %s AND partner_id = %s",
            (status, request_id, partner_id),
        )
        # first_name/last_name live on `users`, not `connection_requests` -
        # re-fetch through the same joined shape list_connection_requests_for_partner
        # uses, rather than a RETURNING clause that can't reach them.
        cur.execute(
            """
            SELECT cr.id, cr.status, cr.consent_given_at, cr.created_at, cr.updated_at,
                   u.first_name, u.last_name
            FROM connection_requests cr
            JOIN users u ON u.id = cr.user_id
            WHERE cr.id = %s
            """,
            (request_id,),
        )
        row = cur.fetchone()

    row["requester_name"] = _requester_name(row.pop("first_name"), row.pop("last_name"))
    return row
