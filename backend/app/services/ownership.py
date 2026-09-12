"""
Resource ownership checks.

RBAC alone is not sufficient (docs/authorization.md). Every one of these
functions takes the caller's user_id as a mandatory parameter and filters
for it in SQL - never "fetch by id, then compare in Python" - so a missing
or forgotten check can't accidentally return another user's row.

Each `get_owned_*` returns the row (as a dict) when it belongs to the
given user, or None otherwise - deliberately not distinguishing "does not
exist" from "belongs to someone else" (see docs/authorization.md, IDOR
protection). Callers should turn None into a 404, never a message that
reveals which case it was.

`readiness_results`, `score_breakdowns`, `recommendations` and
`chat_messages` all carry a denormalized `user_id` column (Phase 2 schema)
even though they're reachable via a FK chain back to `users`. Filtering on
that column directly is the same security property as walking the chain -
just without the joins - so that's what these do.
"""
from __future__ import annotations

from uuid import UUID

from psycopg import Connection
from psycopg.rows import dict_row

# --- Assessments ------------------------------------------------------


def get_owned_assessment(conn: Connection, assessment_id: UUID, user_id: UUID) -> dict | None:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT id, user_id, status, income, monthly_debt, credit_score,
                   savings, down_payment, target_home_price, employment_years,
                   location, created_at, updated_at, submitted_at
            FROM assessments
            WHERE id = %s AND user_id = %s
            """,
            (assessment_id, user_id),
        )
        return cur.fetchone()


def get_assessment_by_id(conn: Connection, assessment_id: UUID) -> dict | None:
    """
    No ownership filter. Only for callers who already hold
    `assessment:read:any` (checked separately via require_permission) -
    e.g. administrative access.
    """
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT id, user_id, status, income, monthly_debt, credit_score,
                   savings, down_payment, target_home_price, employment_years,
                   location, created_at, updated_at, submitted_at
            FROM assessments
            WHERE id = %s
            """,
            (assessment_id,),
        )
        return cur.fetchone()


# --- Files --------------------------------------------------------------


def get_owned_file(conn: Connection, file_id: UUID, user_id: UUID) -> dict | None:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT id, user_id, assessment_id, chat_session_id, original_filename,
                   storage_key, content_type, file_size, processing_status, created_at
            FROM files
            WHERE id = %s AND user_id = %s
            """,
            (file_id, user_id),
        )
        return cur.fetchone()


# --- Chat sessions / messages --------------------------------------------


def get_owned_chat_session(conn: Connection, session_id: UUID, user_id: UUID) -> dict | None:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT id, user_id, title, assessment_id, created_at, updated_at
            FROM chat_sessions
            WHERE id = %s AND user_id = %s
            """,
            (session_id, user_id),
        )
        return cur.fetchone()


def list_owned_chat_messages(conn: Connection, session_id: UUID, user_id: UUID) -> list[dict] | None:
    """
    Returns None if the session doesn't belong to `user_id` (caller should
    treat this as not-found); otherwise the session's messages, oldest
    first. The session ownership check comes first, per docs/authorization.md
    - a client-supplied session_id is never trusted on its own.
    """
    if get_owned_chat_session(conn, session_id, user_id) is None:
        return None

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT id, session_id, user_id, role, content, created_at
            FROM chat_messages
            WHERE session_id = %s AND user_id = %s
            ORDER BY created_at
            """,
            (session_id, user_id),
        )
        return cur.fetchall()


# --- Readiness results / score breakdowns / recommendations -------------


def get_owned_readiness_result(conn: Connection, result_id: UUID, user_id: UUID) -> dict | None:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT id, assessment_id, user_id, scoring_version_id, overall_score, status, created_at
            FROM readiness_results
            WHERE id = %s AND user_id = %s
            """,
            (result_id, user_id),
        )
        return cur.fetchone()


def get_owned_score_breakdown(conn: Connection, breakdown_id: UUID, user_id: UUID) -> dict | None:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT id, readiness_result_id, user_id, category, raw_value, category_score, weight, created_at
            FROM score_breakdowns
            WHERE id = %s AND user_id = %s
            """,
            (breakdown_id, user_id),
        )
        return cur.fetchone()


def get_owned_recommendation(conn: Connection, recommendation_id: UUID, user_id: UUID) -> dict | None:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT id, readiness_result_id, user_id, category, priority, title, description, source, created_at
            FROM recommendations
            WHERE id = %s AND user_id = %s
            """,
            (recommendation_id, user_id),
        )
        return cur.fetchone()


# --- Connection requests --------------------------------------------------


def get_owned_connection_request(conn: Connection, request_id: UUID, user_id: UUID) -> dict | None:
    """The requesting user's own view of a connection request."""
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT id, user_id, partner_id, status, consent_given_at, created_at, updated_at
            FROM connection_requests
            WHERE id = %s AND user_id = %s
            """,
            (request_id, user_id),
        )
        return cur.fetchone()


def get_partner_owned_connection_request(conn: Connection, request_id: UUID, partner_id: UUID) -> dict | None:
    """
    The realtor-side equivalent of get_owned_connection_request - ownership
    here means "addressed to my linked real_estate_partners row", not a
    user_id column. Callers resolve partner_id via
    realtor_partners.get_partner_by_user_id first (see docs/authorization.md);
    this function never trusts a client-supplied partner_id on its own.
    """
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT id, user_id, partner_id, status, consent_given_at, created_at, updated_at
            FROM connection_requests
            WHERE id = %s AND partner_id = %s
            """,
            (request_id, partner_id),
        )
        return cur.fetchone()
