"""
Realtor onboarding (docs/realtor-onboarding.md). A REALTOR account is
never created through POST /auth/register - it only ever comes from an
admin creating a real_estate_partners row and inviting a specific email
to it. Token lifecycle mirrors email_verification_tokens exactly: random,
hashed at rest, single-use, expiring.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from urllib.parse import quote
from uuid import UUID

from psycopg import Connection
from psycopg.rows import dict_row

from app.core.config import get_settings
from app.security.passwords import hash_password
from app.security.tokens import generate_secure_token, hash_token
from app.services.audit import log_event
from app.services.email.base import EmailService

INVITE_TOKEN_TTL_HOURS = 72


class RealtorInvitationError(Exception):
    """Base class for realtor-invitation-flow errors mapped to HTTP responses."""


class InvalidInvitation(RealtorInvitationError):
    """Unknown, already-used, or expired token."""


class MissingOnboardingFields(RealtorInvitationError):
    """The invited email has no account yet, so first_name/last_name/password are required."""

    def __init__(self, missing: list[str]) -> None:
        self.missing = missing
        super().__init__(f"Missing required fields: {', '.join(missing)}")


def _build_invite_url(token: str) -> str:
    settings = get_settings()
    return f"{settings.frontend_base_url}/onboard-realtor?token={quote(token)}"


def create_and_send_invite(
    conn: Connection, *, partner_id: UUID, email: str, invited_by: UUID, email_service: EmailService
) -> None:
    token = generate_secure_token()
    token_hash = hash_token(token)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=INVITE_TOKEN_TTL_HOURS)

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO realtor_invitations (partner_id, email, token_hash, invited_by, expires_at)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (partner_id, email, token_hash, invited_by, expires_at),
        )

    email_service.send_realtor_invite_email(to_email=email, invite_url=_build_invite_url(token))
    log_event(
        conn,
        user_id=invited_by,
        action="REALTOR_INVITE_SENT",
        resource_type="real_estate_partner",
        resource_id=partner_id,
    )


def _get_valid_invitation(conn: Connection, *, token: str) -> dict:
    token_hash = hash_token(token)
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT id, partner_id, email, expires_at, used_at FROM realtor_invitations WHERE token_hash = %s",
            (token_hash,),
        )
        row = cur.fetchone()

    if row is None or row["used_at"] is not None or row["expires_at"] <= datetime.now(timezone.utc):
        raise InvalidInvitation()
    return row


def lookup_invitation(conn: Connection, *, token: str) -> dict:
    """Validates the token without consuming it, so a frontend can decide
    which onboarding form to show. Safe to call repeatedly."""
    invitation = _get_valid_invitation(conn, token=token)
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute("SELECT id FROM users WHERE LOWER(email) = %s", (invitation["email"].lower(),))
        account_exists = cur.fetchone() is not None
    return {"email": invitation["email"], "account_exists": account_exists}


def _get_role_id(conn: Connection, name: str) -> UUID:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute("SELECT id FROM roles WHERE name = %s", (name,))
        row = cur.fetchone()
        if row is None:
            raise RuntimeError(f"{name} role is not seeded - run migrations")
        return row["id"]


def _grant_role(conn: Connection, *, user_id: UUID, role_name: str) -> None:
    role_id = _get_role_id(conn, role_name)
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO user_roles (user_id, role_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
            (user_id, role_id),
        )


def accept_invitation(
    conn: Connection,
    *,
    token: str,
    first_name: str | None,
    last_name: str | None,
    password: str | None,
) -> dict:
    """
    Redeems the invitation: links real_estate_partners.user_id, grants
    REALTOR (and USER, for a brand-new account - a realtor is also free to
    use the homebuyer-facing product), and marks the token used, all in
    one transaction. Returns the resulting user row.
    """
    invitation = _get_valid_invitation(conn, token=token)

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT id, email, first_name, last_name, is_active, email_verified, created_at
            FROM users WHERE LOWER(email) = %s
            """,
            (invitation["email"].lower(),),
        )
        existing_user = cur.fetchone()

        if existing_user is None:
            missing = [
                field
                for field, value in (("first_name", first_name), ("last_name", last_name), ("password", password))
                if not value
            ]
            if missing:
                raise MissingOnboardingFields(missing)

            cur.execute(
                """
                INSERT INTO users (email, password_hash, first_name, last_name, email_verified)
                VALUES (%s, %s, %s, %s, true)
                RETURNING id, email, first_name, last_name, is_active, email_verified, created_at
                """,
                (invitation["email"], hash_password(password), first_name, last_name),
            )
            user_row = cur.fetchone()
            _grant_role(conn, user_id=user_row["id"], role_name="USER")
        else:
            user_row = existing_user

        _grant_role(conn, user_id=user_row["id"], role_name="REALTOR")

        cur.execute(
            "UPDATE real_estate_partners SET user_id = %s WHERE id = %s",
            (user_row["id"], invitation["partner_id"]),
        )
        cur.execute("UPDATE realtor_invitations SET used_at = now() WHERE id = %s", (invitation["id"],))

    log_event(
        conn,
        user_id=user_row["id"],
        action="REALTOR_ONBOARDED",
        resource_type="real_estate_partner",
        resource_id=invitation["partner_id"],
    )
    log_event(
        conn,
        user_id=user_row["id"],
        action="ROLE_CHANGED",
        resource_type="user",
        resource_id=user_row["id"],
        metadata={"role": "REALTOR", "change": "granted"},
    )
    return user_row
