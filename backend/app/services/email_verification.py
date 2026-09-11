"""
Email verification (CLAUDE.md's own Phase 3 note deferred this - "Do not
implement email verification yet" - this session's user has now asked for
it explicitly, and a new user must be verified before they can log in).

Token lifecycle mirrors refresh_tokens (docs/authentication.md): a
high-entropy random value is generated, only its SHA-256 hash is ever
persisted, and it is single-use (`used_at`) with an expiry.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from urllib.parse import quote
from uuid import UUID

from psycopg import Connection
from psycopg.rows import dict_row

from app.core.config import get_settings
from app.security.tokens import generate_secure_token, hash_token
from app.services.audit import log_event
from app.services.email.base import EmailService

VERIFICATION_TOKEN_TTL_HOURS = 24


class EmailVerificationError(Exception):
    """Base class for email-verification-flow errors mapped to HTTP responses."""


class InvalidVerificationToken(EmailVerificationError):
    """Unknown, already-used, or expired token."""


def _build_verification_url(token: str) -> str:
    settings = get_settings()
    return f"{settings.frontend_base_url}/verify-email?token={quote(token)}"


def _issue_token(conn: Connection, *, user_id: UUID) -> str:
    token = generate_secure_token()
    token_hash = hash_token(token)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=VERIFICATION_TOKEN_TTL_HOURS)

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
            VALUES (%s, %s, %s)
            """,
            (user_id, token_hash, expires_at),
        )
    return token


def send_verification_email(
    conn: Connection, *, user_id: UUID, email: str, first_name: str, email_service: EmailService
) -> None:
    """Issues a fresh token and hands the finished URL to the EmailService - never the raw token to a caller that might log it."""
    token = _issue_token(conn, user_id=user_id)
    email_service.send_verification_email(
        to_email=email, first_name=first_name, verification_url=_build_verification_url(token)
    )
    log_event(conn, user_id=user_id, action="EMAIL_VERIFICATION_SENT", resource_type="user", resource_id=user_id)


def verify_email_token(conn: Connection, *, token: str) -> dict:
    """Returns the verified user row. Raises InvalidVerificationToken for anything else - unknown, expired, or already-used, all mapped to the same error so a caller can't distinguish which (avoids confirming a guessed token ever existed)."""
    token_hash = hash_token(token)

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT id, user_id, expires_at, used_at
            FROM email_verification_tokens
            WHERE token_hash = %s
            """,
            (token_hash,),
        )
        row = cur.fetchone()

        if row is None or row["used_at"] is not None or row["expires_at"] <= datetime.now(timezone.utc):
            raise InvalidVerificationToken()

        cur.execute("UPDATE email_verification_tokens SET used_at = now() WHERE id = %s", (row["id"],))
        cur.execute(
            """
            UPDATE users SET email_verified = true
            WHERE id = %s
            RETURNING id, email, first_name, last_name, is_active, email_verified, created_at
            """,
            (row["user_id"],),
        )
        user_row = cur.fetchone()

    log_event(conn, user_id=user_row["id"], action="EMAIL_VERIFIED", resource_type="user", resource_id=user_row["id"])
    return user_row


def resend_verification_email(conn: Connection, *, email: str, email_service: EmailService) -> None:
    """
    Always succeeds from the caller's point of view (see the route) - an
    unknown or already-verified email is silently a no-op here, the same
    user-enumeration-resistance pattern app/services/auth_service.py::logout
    uses for an unrecognized refresh token.
    """
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT id, email, first_name, email_verified FROM users WHERE LOWER(email) = %s",
            (email.lower(),),
        )
        row = cur.fetchone()

    if row is None or row["email_verified"]:
        return

    send_verification_email(
        conn, user_id=row["id"], email=row["email"], first_name=row["first_name"], email_service=email_service
    )
