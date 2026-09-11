from __future__ import annotations

from uuid import UUID

from psycopg import Connection
from psycopg.rows import dict_row

from app.schemas.assessments import AssessmentCreate, AssessmentUpdate
from app.services.ownership import get_owned_assessment

# Fields that must be present before an assessment can move DRAFT -> SUBMITTED.
# location is intentionally excluded - Phase 6 explicitly keeps it out of the
# v1 score, so nothing downstream depends on it being filled in.
REQUIRED_FOR_SUBMIT = (
    "income",
    "monthly_debt",
    "credit_score",
    "savings",
    "down_payment",
    "target_home_price",
    "employment_years",
)


class AssessmentError(Exception):
    """Base class for assessment-flow errors mapped to HTTP responses."""


class AssessmentNotEditable(AssessmentError):
    """The assessment exists and is owned by the caller, but is no longer DRAFT."""


class AssessmentAlreadySubmitted(AssessmentError):
    pass


class AssessmentIncomplete(AssessmentError):
    def __init__(self, missing_fields: list[str]) -> None:
        self.missing_fields = missing_fields
        super().__init__(f"Missing required fields: {', '.join(missing_fields)}")


def create_assessment(conn: Connection, *, user_id: UUID, data: AssessmentCreate) -> dict:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO assessments
                (user_id, income, monthly_debt, credit_score, savings,
                 down_payment, target_home_price, employment_years, location)
            VALUES (%(user_id)s, %(income)s, %(monthly_debt)s, %(credit_score)s, %(savings)s,
                    %(down_payment)s, %(target_home_price)s, %(employment_years)s, %(location)s)
            RETURNING
                id, user_id, status, income, monthly_debt, credit_score, savings,
                down_payment, target_home_price, employment_years, location,
                created_at, updated_at, submitted_at
            """,
            {"user_id": user_id, **data.model_dump()},
        )
        return cur.fetchone()


def list_assessments(conn: Connection, *, user_id: UUID) -> list[dict]:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                id, user_id, status, income, monthly_debt, credit_score, savings,
                down_payment, target_home_price, employment_years, location,
                created_at, updated_at, submitted_at
            FROM assessments
            WHERE user_id = %s
            ORDER BY created_at DESC
            """,
            (user_id,),
        )
        return cur.fetchall()


def update_assessment(
    conn: Connection, *, assessment_id: UUID, user_id: UUID, data: AssessmentUpdate
) -> dict | None:
    """Returns None if the assessment doesn't exist or isn't owned by user_id."""
    existing = get_owned_assessment(conn, assessment_id, user_id)
    if existing is None:
        return None
    if existing["status"] != "DRAFT":
        raise AssessmentNotEditable()

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE assessments
            SET
                income = COALESCE(%(income)s, income),
                monthly_debt = COALESCE(%(monthly_debt)s, monthly_debt),
                credit_score = COALESCE(%(credit_score)s, credit_score),
                savings = COALESCE(%(savings)s, savings),
                down_payment = COALESCE(%(down_payment)s, down_payment),
                target_home_price = COALESCE(%(target_home_price)s, target_home_price),
                employment_years = COALESCE(%(employment_years)s, employment_years),
                location = COALESCE(%(location)s, location)
            WHERE id = %(assessment_id)s AND user_id = %(user_id)s
            RETURNING
                id, user_id, status, income, monthly_debt, credit_score, savings,
                down_payment, target_home_price, employment_years, location,
                created_at, updated_at, submitted_at
            """,
            {"assessment_id": assessment_id, "user_id": user_id, **data.model_dump()},
        )
        return cur.fetchone()


def submit_assessment(conn: Connection, *, assessment_id: UUID, user_id: UUID) -> dict | None:
    """Returns None if the assessment doesn't exist or isn't owned by user_id."""
    existing = get_owned_assessment(conn, assessment_id, user_id)
    if existing is None:
        return None
    if existing["status"] != "DRAFT":
        raise AssessmentAlreadySubmitted()

    missing = [field for field in REQUIRED_FOR_SUBMIT if existing[field] is None]
    if missing:
        raise AssessmentIncomplete(missing)

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE assessments
            SET status = 'SUBMITTED', submitted_at = now()
            WHERE id = %s AND user_id = %s
            RETURNING
                id, user_id, status, income, monthly_debt, credit_score, savings,
                down_payment, target_home_price, employment_years, location,
                created_at, updated_at, submitted_at
            """,
            (assessment_id, user_id),
        )
        return cur.fetchone()
