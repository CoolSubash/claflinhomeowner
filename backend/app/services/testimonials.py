from __future__ import annotations

from uuid import UUID

from psycopg import Connection
from psycopg.errors import UniqueViolation
from psycopg.rows import dict_row

from app.schemas.testimonials import TestimonialPublic


class TestimonialError(Exception):
    """Base class for testimonial-flow errors mapped to HTTP responses."""


class TestimonialAlreadyExists(TestimonialError):
    pass


def create_testimonial(conn: Connection, *, user_id: UUID, rating: int, content: str) -> UUID:
    with conn.cursor(row_factory=dict_row) as cur:
        try:
            cur.execute(
                """
                INSERT INTO testimonials (user_id, rating, content)
                VALUES (%s, %s, %s)
                RETURNING id
                """,
                (user_id, rating, content),
            )
        except UniqueViolation as exc:
            raise TestimonialAlreadyExists() from exc
        return cur.fetchone()["id"]


def list_featured_testimonials(conn: Connection, *, limit: int = 5) -> list[TestimonialPublic]:
    """
    Public, unauthenticated read used by the marketing homepage. Only
    ratings of 4-5 are eligible, and the display name is reduced to first
    name + last initial - visitors browsing this before creating an
    account should never see a full name/email pulled from someone else's
    account.
    """
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                t.id,
                u.first_name,
                u.last_name,
                t.rating,
                t.content,
                t.created_at,
                bool_or(r.name = 'REALTOR') AS is_realtor
            FROM testimonials t
            JOIN users u ON u.id = t.user_id
            LEFT JOIN user_roles ur ON ur.user_id = t.user_id
            LEFT JOIN roles r ON r.id = ur.role_id
            WHERE t.rating >= 4
            GROUP BY t.id, u.first_name, u.last_name, t.rating, t.content, t.created_at
            ORDER BY t.rating DESC, t.created_at DESC
            LIMIT %s
            """,
            (limit,),
        )
        rows = cur.fetchall()

    return [
        TestimonialPublic(
            id=row["id"],
            author_name=f"{row['first_name']} {row['last_name'][0]}.",
            author_role="Real Estate Partner" if row["is_realtor"] else "Homebuyer",
            rating=row["rating"],
            content=row["content"],
            created_at=row["created_at"],
        )
        for row in rows
    ]
