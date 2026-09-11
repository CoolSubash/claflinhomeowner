"""
Phase 7 deterministic rule-based recommendation engine.

Pure logic (build_recommendations) is separated from persistence
(get_or_create_recommendations) the same way app/services/scoring.py keeps
score calculation free of SQL. No AI is involved anywhere in this module
(CLAUDE.md section 15 / Phase 7 section 11).

Priority thresholds intentionally reuse the exact score boundaries already
defined by app/services/scoring.py's READINESS_BANDS (0-39, 40-59, 60-74)
rather than introducing new numbers - see Phase 7 spec section 13 ("Use
thresholds defined by the scoring methodology. Do not introduce unrelated
magic numbers.").
"""
from __future__ import annotations

from uuid import UUID

from psycopg import Connection
from psycopg.errors import UniqueViolation
from psycopg.rows import dict_row

from app.services.scoring import WEIGHTS

# A category scoring at or above this is already at "READY" level for that
# component (mirrors scoring.READINESS_BANDS' 75 boundary) - no
# recommendation is generated for it.
_RECOMMENDATION_THRESHOLD = 75
_HIGH_PRIORITY_CEILING = 40  # mirrors READINESS_BANDS' NOT_READY upper bound
_MEDIUM_PRIORITY_CEILING = 60  # mirrors READINESS_BANDS' NEEDS_IMPROVEMENT upper bound

# How many of the lowest-scoring categories count as "weak areas" for the
# UI's "Areas to Focus On" list (Phase 7 section 10/21).
WEAK_AREA_LIMIT = 2

_CATEGORY_ORDER = {category: index for index, category in enumerate(WEIGHTS.keys())}

_CATEGORY_COPY: dict[str, dict[str, str]] = {
    "financial_stability": {
        "title": "Strengthen your financial stability",
        "description": (
            "Consider ways to increase or stabilize your income. Under the HomeReady "
            "methodology, this is one area you could focus on to improve your readiness."
        ),
    },
    "debt_management": {
        "title": "Reduce your monthly debt",
        "description": (
            "Consider focusing on reducing your monthly debt obligations before "
            "increasing your target home price."
        ),
    },
    "credit": {
        "title": "Improve your credit profile",
        "description": (
            "Consider steps to raise your credit score. Under the HomeReady "
            "methodology, this is one area you could focus on to improve your readiness."
        ),
    },
    "down_payment": {
        "title": "Grow your down payment",
        "description": (
            "Consider increasing your planned down payment toward the HomeReady "
            "methodology's 20% reference point."
        ),
    },
    "savings": {
        "title": "Build your savings cushion",
        "description": (
            "Consider building additional savings beyond your planned down payment, "
            "under the HomeReady methodology."
        ),
    },
    "employment_stability": {
        "title": "Build employment history",
        "description": (
            "Consider building a longer employment history. Under the HomeReady "
            "methodology, this is one area you could focus on to improve your readiness."
        ),
    },
}


def _priority_for_score(score: int) -> str:
    if score < _HIGH_PRIORITY_CEILING:
        return "HIGH"
    if score < _MEDIUM_PRIORITY_CEILING:
        return "MEDIUM"
    return "LOW"


def identify_weak_areas(breakdown_rows: list[dict], limit: int = WEAK_AREA_LIMIT) -> list[dict]:
    """
    The `limit` lowest-scoring categories, weakest first. Ties are broken by
    the fixed category order in scoring.WEIGHTS so the result is
    deterministic regardless of the order breakdown_rows was fetched in.
    """
    return sorted(
        breakdown_rows,
        key=lambda row: (row["category_score"], _CATEGORY_ORDER[row["category"]]),
    )[:limit]


def build_recommendations(breakdown_rows: list[dict]) -> list[dict]:
    """
    One recommendation per category scoring below _RECOMMENDATION_THRESHOLD,
    weakest category first. Returns plain dicts (category, priority, title,
    description, source) ready to persist - never touches the database.
    """
    weak = [row for row in breakdown_rows if row["category_score"] < _RECOMMENDATION_THRESHOLD]
    weak.sort(key=lambda row: (row["category_score"], _CATEGORY_ORDER[row["category"]]))

    recommendations = []
    for row in weak:
        copy = _CATEGORY_COPY[row["category"]]
        recommendations.append(
            {
                "category": row["category"],
                "priority": _priority_for_score(row["category_score"]),
                "title": copy["title"],
                "description": copy["description"],
                "source": "system",
            }
        )
    return recommendations


# --- Persistence ------------------------------------------------------


def _list_recommendations(conn: Connection, readiness_result_id: UUID, user_id: UUID) -> list[dict]:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT id, readiness_result_id, category, priority, title, description, source, created_at
            FROM recommendations
            WHERE readiness_result_id = %s AND user_id = %s
            ORDER BY category
            """,
            (readiness_result_id, user_id),
        )
        return cur.fetchall()


def _list_breakdowns(conn: Connection, readiness_result_id: UUID, user_id: UUID) -> list[dict]:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT category, category_score
            FROM score_breakdowns
            WHERE readiness_result_id = %s AND user_id = %s
            """,
            (readiness_result_id, user_id),
        )
        return cur.fetchall()


def _insert_recommendations(
    conn: Connection, readiness_result_id: UUID, user_id: UUID, recommendations: list[dict]
) -> list[dict]:
    inserted = []
    with conn.cursor(row_factory=dict_row) as cur:
        for rec in recommendations:
            cur.execute(
                """
                INSERT INTO recommendations
                    (readiness_result_id, user_id, category, priority, title, description, source)
                VALUES (%(readiness_result_id)s, %(user_id)s, %(category)s, %(priority)s,
                        %(title)s, %(description)s, %(source)s)
                RETURNING id, readiness_result_id, category, priority, title, description, source, created_at
                """,
                {"readiness_result_id": readiness_result_id, "user_id": user_id, **rec},
            )
            inserted.append(cur.fetchone())
    return inserted


def get_or_create_recommendations(
    conn: Connection, *, readiness_result_id: UUID, user_id: UUID
) -> list[dict]:
    """
    Idempotent by (readiness_result_id, category) - repeated calls (e.g. the
    frontend reloading the results page) never create duplicate rows
    (Phase 7 section 15). Callers must already have verified the caller
    owns the readiness result (see get_owned_readiness_result); this
    function re-filters by user_id anyway as defense in depth.
    """
    existing = _list_recommendations(conn, readiness_result_id, user_id)
    if existing:
        return existing

    breakdown_rows = _list_breakdowns(conn, readiness_result_id, user_id)
    to_create = build_recommendations(breakdown_rows)
    if not to_create:
        return []

    try:
        with conn.transaction():
            return _insert_recommendations(conn, readiness_result_id, user_id, to_create)
    except UniqueViolation:
        # A concurrent request for the same result won the race and
        # generated the set first; uq_recommendations_readiness_result_category
        # is the idempotency backstop - fall back to what it inserted.
        return _list_recommendations(conn, readiness_result_id, user_id)
