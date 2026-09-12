from __future__ import annotations

from uuid import UUID

from psycopg import Connection
from psycopg.rows import dict_row


def create_partner(conn: Connection, *, name: str, contact_email: str | None, contact_phone: str | None) -> dict:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO real_estate_partners (name, contact_email, contact_phone)
            VALUES (%s, %s, %s)
            RETURNING id, name, contact_email, contact_phone, is_active, user_id, created_at
            """,
            (name, contact_email, contact_phone),
        )
        return cur.fetchone()


def list_partners(conn: Connection) -> list[dict]:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT id, name, contact_email, contact_phone, is_active, user_id, created_at
            FROM real_estate_partners
            ORDER BY created_at DESC
            """
        )
        return cur.fetchall()


def get_partner_by_id(conn: Connection, partner_id: UUID) -> dict | None:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT id, name, contact_email, contact_phone, is_active, user_id, created_at
            FROM real_estate_partners
            WHERE id = %s
            """,
            (partner_id,),
        )
        return cur.fetchone()


def get_partner_by_user_id(conn: Connection, user_id: UUID) -> dict | None:
    """
    The realtor-side ownership anchor: every realtor route resolves "which
    partner record does this caller manage" through this lookup rather
    than trusting a client-supplied partner_id (same principle as every
    other get_owned_* function in app/services/ownership.py).
    """
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT id, name, contact_email, contact_phone, is_active, user_id, created_at
            FROM real_estate_partners
            WHERE user_id = %s
            """,
            (user_id,),
        )
        return cur.fetchone()
