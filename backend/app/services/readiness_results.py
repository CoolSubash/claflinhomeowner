from __future__ import annotations

from uuid import UUID

from psycopg import Connection
from psycopg.rows import dict_row

from app.services.ownership import get_owned_assessment
from app.services.scoring import SCORING_VERSION, score_assessment


class ScoringError(Exception):
    """Base class for scoring-flow errors mapped to HTTP responses."""


class AssessmentNotFound(ScoringError):
    """The assessment doesn't exist or isn't owned by the caller."""


class AssessmentNotSubmitted(ScoringError):
    """Only a SUBMITTED assessment may be scored."""


def _get_scoring_version_id(conn: Connection, version: str) -> UUID:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute("SELECT id FROM scoring_versions WHERE version = %s", (version,))
        row = cur.fetchone()
        if row is None:
            raise RuntimeError(f"Scoring version {version!r} is not seeded - run migrations")
        return row["id"]


def _get_result_row(conn: Connection, *, assessment_id: UUID, scoring_version_id: UUID) -> dict | None:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT rr.id, rr.assessment_id, rr.user_id, rr.overall_score, rr.status, rr.created_at,
                   sv.version AS scoring_version
            FROM readiness_results rr
            JOIN scoring_versions sv ON sv.id = rr.scoring_version_id
            WHERE rr.assessment_id = %s AND rr.scoring_version_id = %s
            """,
            (assessment_id, scoring_version_id),
        )
        return cur.fetchone()


def _get_breakdowns(conn: Connection, readiness_result_id: UUID) -> list[dict]:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT id, readiness_result_id, user_id, category, raw_value,
                   category_score, weight, explanation, created_at
            FROM score_breakdowns
            WHERE readiness_result_id = %s
            ORDER BY category
            """,
            (readiness_result_id,),
        )
        return cur.fetchall()


def score_and_persist(
    conn: Connection, *, assessment_id: UUID, user_id: UUID
) -> tuple[dict, list[dict], bool]:
    """
    Returns (readiness_result_row, score_breakdown_rows, was_newly_created).

    Idempotent by (assessment_id, scoring_version): a second call for the
    same assessment under the same scoring version returns the existing
    canonical result rather than creating a duplicate - enforced at the
    database level by uq_readiness_results_assessment_scoring_version, and
    checked here first to avoid relying on that constraint violation as
    the normal code path.
    """
    scoring_version_id = _get_scoring_version_id(conn, SCORING_VERSION)

    existing = _get_result_row(conn, assessment_id=assessment_id, scoring_version_id=scoring_version_id)
    if existing is not None:
        return existing, _get_breakdowns(conn, existing["id"]), False

    assessment = get_owned_assessment(conn, assessment_id, user_id)
    if assessment is None:
        raise AssessmentNotFound()
    if assessment["status"] != "SUBMITTED":
        raise AssessmentNotSubmitted()

    result = score_assessment(assessment)

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO readiness_results (assessment_id, user_id, scoring_version_id, overall_score, status)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id, assessment_id, user_id, overall_score, status, created_at
            """,
            (assessment_id, user_id, scoring_version_id, result.overall_score, result.readiness_level),
        )
        readiness_result_row = cur.fetchone()
        readiness_result_row["scoring_version"] = result.scoring_version

        breakdown_rows = []
        for component in result.components:
            cur.execute(
                """
                INSERT INTO score_breakdowns
                    (readiness_result_id, user_id, category, raw_value, category_score, weight, explanation)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id, readiness_result_id, user_id, category, raw_value,
                          category_score, weight, explanation, created_at
                """,
                (
                    readiness_result_row["id"],
                    user_id,
                    component.category,
                    component.raw_value,
                    component.score,
                    component.weight,
                    component.explanation,
                ),
            )
            breakdown_rows.append(cur.fetchone())

    return readiness_result_row, breakdown_rows, True


def get_result_for_assessment(
    conn: Connection, *, assessment_id: UUID, user_id: UUID
) -> tuple[dict, list[dict]] | None:
    """
    Returns None if the assessment isn't found/owned, OR if it exists but
    has no v1 result yet - callers that need to distinguish those two
    cases (for a more specific 404 message) should check
    get_owned_assessment first.
    """
    assessment = get_owned_assessment(conn, assessment_id, user_id)
    if assessment is None:
        return None

    scoring_version_id = _get_scoring_version_id(conn, SCORING_VERSION)
    result_row = _get_result_row(conn, assessment_id=assessment_id, scoring_version_id=scoring_version_id)
    if result_row is None:
        return None

    return result_row, _get_breakdowns(conn, result_row["id"])


def list_results_for_user(conn: Connection, *, user_id: UUID, limit: int = 20, offset: int = 0) -> list[dict]:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT rr.id, rr.assessment_id, rr.user_id, rr.overall_score, rr.status, rr.created_at,
                   sv.version AS scoring_version
            FROM readiness_results rr
            JOIN scoring_versions sv ON sv.id = rr.scoring_version_id
            WHERE rr.user_id = %s
            ORDER BY rr.created_at DESC
            LIMIT %s OFFSET %s
            """,
            (user_id, limit, offset),
        )
        return cur.fetchall()
