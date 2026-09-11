"""
Phase 8 chat service. Wires together (in this order, matching Phase 8
section 11 / section 27):

    authentication (done by the route's Depends(get_current_user))
    -> authorization (Depends(require_permission))
    -> session ownership (get_owned_chat_session)
    -> assessment ownership (get_owned_assessment, only if the session is
       linked to one)
    -> authorized context (_build_context)
    -> AIService
    -> persist both messages

The AIService is never the authorization layer (section 27) - every
ownership check below happens in SQL before any context is built or any
provider is called.
"""
from __future__ import annotations

from uuid import UUID

from psycopg import Connection
from psycopg.rows import dict_row

from app.services.ai.base import AIService, ChatTurn
from app.services.ai.system_prompt import build_system_prompt
from app.services.ownership import get_owned_assessment, get_owned_chat_session, list_owned_chat_messages
from app.services.rate_limit import chat_rate_limiter
from app.services.readiness_results import get_result_for_assessment
from app.services.recommendations import get_or_create_recommendations

# How many prior messages (not exchanges) are sent to the model as history,
# in addition to the new question - a simple bounded-context strategy
# (Phase 8 section 22/23) rather than the full lifetime conversation.
CHAT_HISTORY_LIMIT = 10


class ChatError(Exception):
    """Base class for chat-flow errors mapped to HTTP responses."""


class SessionNotFound(ChatError):
    pass


class AssessmentNotFound(ChatError):
    """The assessment_id given at session creation isn't owned by the caller."""


def create_session(
    conn: Connection, *, user_id: UUID, title: str | None, assessment_id: UUID | None
) -> dict:
    if assessment_id is not None and get_owned_assessment(conn, assessment_id, user_id) is None:
        # A client-supplied assessment_id is never trusted just because
        # it's a valid UUID (Phase 8 section 6) - it must resolve to an
        # assessment this caller actually owns.
        raise AssessmentNotFound()

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO chat_sessions (user_id, title, assessment_id)
            VALUES (%s, %s, %s)
            RETURNING id, title, assessment_id, created_at, updated_at
            """,
            (user_id, title, assessment_id),
        )
        return cur.fetchone()


def list_sessions(conn: Connection, *, user_id: UUID) -> list[dict]:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT id, title, assessment_id, created_at, updated_at
            FROM chat_sessions
            WHERE user_id = %s
            ORDER BY updated_at DESC
            """,
            (user_id,),
        )
        return cur.fetchall()


def get_session_with_messages(
    conn: Connection, *, session_id: UUID, user_id: UUID
) -> tuple[dict, list[dict]] | None:
    session = get_owned_chat_session(conn, session_id, user_id)
    if session is None:
        return None
    messages = list_owned_chat_messages(conn, session_id, user_id) or []
    return session, messages


def _build_context(conn: Connection, *, session: dict, user_id: UUID) -> dict | None:
    """
    Only the fields Phase 8 section 12 lists - never the row's id,
    user_id, or timestamps, and never anything from another table this
    session isn't linked to.
    """
    assessment_id = session["assessment_id"]
    if assessment_id is None:
        return None

    assessment = get_owned_assessment(conn, assessment_id, user_id)
    if assessment is None:
        # Ownership was already verified when the session was created; a
        # missing assessment here would mean it was deleted since - treat
        # as "no context" rather than erroring the whole chat turn.
        return None

    context: dict = {
        "assessment": {
            "income": assessment["income"],
            "monthly_debt": assessment["monthly_debt"],
            "credit_score": assessment["credit_score"],
            "savings": assessment["savings"],
            "down_payment": assessment["down_payment"],
            "target_home_price": assessment["target_home_price"],
            "employment_years": assessment["employment_years"],
            "location": assessment["location"],
        }
    }

    found = get_result_for_assessment(conn, assessment_id=assessment_id, user_id=user_id)
    if found is None:
        return context

    result_row, breakdown_rows = found
    context["result"] = {
        "overall_score": result_row["overall_score"],
        "readiness_level": result_row["status"],
        "scoring_version": result_row["scoring_version"],
    }
    context["breakdowns"] = [
        {
            "category": row["category"],
            "score": row["category_score"],
            "weight": row["weight"],
            "explanation": row["explanation"],
        }
        for row in breakdown_rows
    ]

    recommendations = get_or_create_recommendations(
        conn, readiness_result_id=result_row["id"], user_id=user_id
    )
    context["recommendations"] = [
        {
            "category": rec["category"],
            "priority": rec["priority"],
            "title": rec["title"],
            "description": rec["description"],
        }
        for rec in recommendations
    ]

    return context


def _insert_message(conn: Connection, *, session_id: UUID, user_id: UUID, role: str, content: str) -> dict:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO chat_messages (session_id, user_id, role, content)
            VALUES (%s, %s, %s, %s)
            RETURNING id, session_id, role, content, created_at
            """,
            (session_id, user_id, role, content),
        )
        row = cur.fetchone()
        cur.execute("UPDATE chat_sessions SET updated_at = now() WHERE id = %s", (session_id,))
        return row


def send_message(
    conn: Connection, *, session_id: UUID, user_id: UUID, content: str, ai_service: AIService
) -> tuple[dict, dict]:
    """
    Returns (user_message_row, assistant_message_row). Raises SessionNotFound
    for an unowned/missing session, rate_limit.RateLimitExceeded if the
    caller has sent too many messages recently, or ai.base.AIServiceError
    if generation fails - in the failure case nothing is persisted (the
    whole request's transaction rolls back via get_db), matching Phase 8
    section 24's "do not create a fake assistant response".
    """
    session = get_owned_chat_session(conn, session_id, user_id)
    if session is None:
        raise SessionNotFound()

    chat_rate_limiter.check_and_record(user_id)

    prior_messages = list_owned_chat_messages(conn, session_id, user_id) or []
    history = [
        ChatTurn(role=m["role"].lower(), content=m["content"])
        for m in prior_messages[-CHAT_HISTORY_LIMIT:]
        if m["role"] in ("USER", "ASSISTANT")
    ]

    context = _build_context(conn, session=session, user_id=user_id)
    system_prompt = build_system_prompt(context)

    # Treated as untrusted input end to end (Phase 8 section 16): `content`
    # is only ever passed as the final user turn to the model, never
    # concatenated into system_prompt or interpreted as a command by
    # anything in this function.
    answer = ai_service.generate_response(system_prompt=system_prompt, history=history, question=content)

    user_message = _insert_message(conn, session_id=session_id, user_id=user_id, role="USER", content=content)
    assistant_message = _insert_message(
        conn, session_id=session_id, user_id=user_id, role="ASSISTANT", content=answer
    )
    return user_message, assistant_message
