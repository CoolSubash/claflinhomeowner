from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from psycopg import Connection
from psycopg.errors import UniqueViolation
from psycopg.rows import dict_row

from app.core.config import get_settings
from app.schemas.auth import RegisterRequest
from app.schemas.users import UserPublic
from app.security.passwords import hash_password, verify_dummy_password, verify_password
from app.security.tokens import create_access_token, generate_refresh_token, hash_refresh_token
from app.services.audit import log_event


class AuthError(Exception):
    """Base class for authentication-flow errors mapped to HTTP responses."""


class EmailAlreadyRegistered(AuthError):
    pass


class InvalidCredentials(AuthError):
    pass


class EmailNotVerified(AuthError):
    pass


class InvalidRefreshToken(AuthError):
    pass


def register_user(
    conn: Connection,
    data: RegisterRequest,
    *,
    ip_address: str | None,
    user_agent: str | None,
) -> UserPublic:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute("SELECT id FROM users WHERE LOWER(email) = %s", (data.email,))
        if cur.fetchone() is not None:
            raise EmailAlreadyRegistered()

        password_hash = hash_password(data.password)

        try:
            cur.execute(
                """
                INSERT INTO users (email, password_hash, first_name, last_name)
                VALUES (%s, %s, %s, %s)
                RETURNING id, email, first_name, last_name, is_active, email_verified, created_at
                """,
                (data.email, password_hash, data.first_name, data.last_name),
            )
        except UniqueViolation as exc:
            raise EmailAlreadyRegistered() from exc
        user_row = cur.fetchone()

        cur.execute("SELECT id FROM roles WHERE name = 'USER'")
        role_row = cur.fetchone()
        if role_row is None:
            raise RuntimeError("USER role is not seeded - run migrations")

        cur.execute(
            "INSERT INTO user_roles (user_id, role_id) VALUES (%s, %s)",
            (user_row["id"], role_row["id"]),
        )

        log_event(
            conn,
            user_id=user_row["id"],
            action="USER_REGISTERED",
            resource_type="user",
            resource_id=user_row["id"],
            ip_address=ip_address,
            user_agent=user_agent,
        )

        return UserPublic(**user_row)


def authenticate_user(
    conn: Connection,
    *,
    email: str,
    password: str,
    ip_address: str | None,
    user_agent: str | None,
) -> tuple[UserPublic, str, str, int]:
    settings = get_settings()

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT id, email, password_hash, first_name, last_name,
                   is_active, email_verified, created_at
            FROM users
            WHERE LOWER(email) = %s
            """,
            (email,),
        )
        row = cur.fetchone()

        if row is None:
            verify_dummy_password(password)
            log_event(
                conn,
                user_id=None,
                action="USER_LOGIN_FAILED",
                ip_address=ip_address,
                user_agent=user_agent,
                metadata={"reason": "user_not_found"},
            )
            # Commit the audit entry now: the caller will turn this into an
            # HTTPException, which FastAPI throws back into the get_db
            # dependency's generator and triggers a rollback of anything
            # still pending on this connection - without an explicit commit
            # here, the failure would never actually be recorded.
            conn.commit()
            raise InvalidCredentials()

        if not verify_password(password, row["password_hash"]):
            log_event(
                conn,
                user_id=row["id"],
                action="USER_LOGIN_FAILED",
                ip_address=ip_address,
                user_agent=user_agent,
                metadata={"reason": "invalid_password"},
            )
            conn.commit()
            raise InvalidCredentials()

        if not row["is_active"]:
            log_event(
                conn,
                user_id=row["id"],
                action="USER_LOGIN_FAILED",
                ip_address=ip_address,
                user_agent=user_agent,
                metadata={"reason": "inactive_user"},
            )
            conn.commit()
            raise InvalidCredentials()

        if not row["email_verified"]:
            # Deliberately a distinct error from InvalidCredentials, unlike
            # every other rejection above - the caller already proved they
            # know the correct password, so telling them specifically to
            # verify their email doesn't leak anything a wrong-password
            # guesser couldn't already tell from a correct email/password
            # pair (see docs/authentication.md).
            log_event(
                conn,
                user_id=row["id"],
                action="USER_LOGIN_FAILED",
                ip_address=ip_address,
                user_agent=user_agent,
                metadata={"reason": "email_not_verified"},
            )
            conn.commit()
            raise EmailNotVerified()

        access_token, expires_in = create_access_token(row["id"])
        refresh_token = generate_refresh_token()
        token_hash = hash_refresh_token(refresh_token)
        expires_at = datetime.now(timezone.utc) + timedelta(
            days=settings.refresh_token_expire_days
        )

        cur.execute(
            """
            INSERT INTO refresh_tokens (user_id, token_hash, expires_at, user_agent, ip_address)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (row["id"], token_hash, expires_at, user_agent, ip_address),
        )

        cur.execute(
            "UPDATE users SET last_login_at = now() WHERE id = %s",
            (row["id"],),
        )

        log_event(
            conn,
            user_id=row["id"],
            action="USER_LOGIN",
            ip_address=ip_address,
            user_agent=user_agent,
        )

        user = UserPublic(
            id=row["id"],
            email=row["email"],
            first_name=row["first_name"],
            last_name=row["last_name"],
            is_active=row["is_active"],
            email_verified=row["email_verified"],
            created_at=row["created_at"],
        )
        return user, access_token, refresh_token, expires_in


def refresh_access_token(
    conn: Connection,
    *,
    refresh_token: str,
    ip_address: str | None,
    user_agent: str | None,
) -> tuple[str, str, int]:
    settings = get_settings()
    token_hash = hash_refresh_token(refresh_token)

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT id, user_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = %s",
            (token_hash,),
        )
        row = cur.fetchone()

        if row is None:
            raise InvalidRefreshToken()

        if row["revoked_at"] is not None:
            # A revoked token being presented again means either the old
            # token leaked or a race duplicated a request - either way,
            # treat it as compromise and kill every active session for
            # this user rather than trusting the token family further.
            cur.execute(
                "UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = %s AND revoked_at IS NULL",
                (row["user_id"],),
            )
            log_event(
                conn,
                user_id=row["user_id"],
                action="REFRESH_TOKEN_REUSE_DETECTED",
                ip_address=ip_address,
                user_agent=user_agent,
            )
            # As above: this revocation must survive even though the
            # request ultimately fails, so commit before raising rather
            # than let get_db's exception-triggered rollback erase it.
            conn.commit()
            raise InvalidRefreshToken()

        if row["expires_at"] <= datetime.now(timezone.utc):
            raise InvalidRefreshToken()

        cur.execute("SELECT is_active FROM users WHERE id = %s", (row["user_id"],))
        user_row = cur.fetchone()
        if user_row is None or not user_row["is_active"]:
            raise InvalidRefreshToken()

        new_refresh_token = generate_refresh_token()
        new_token_hash = hash_refresh_token(new_refresh_token)
        new_expires_at = datetime.now(timezone.utc) + timedelta(
            days=settings.refresh_token_expire_days
        )

        cur.execute(
            """
            INSERT INTO refresh_tokens (user_id, token_hash, expires_at, user_agent, ip_address)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id
            """,
            (row["user_id"], new_token_hash, new_expires_at, user_agent, ip_address),
        )
        new_token_id = cur.fetchone()["id"]

        cur.execute(
            "UPDATE refresh_tokens SET revoked_at = now(), replaced_by_id = %s WHERE id = %s",
            (new_token_id, row["id"]),
        )

        new_access_token, expires_in = create_access_token(row["user_id"])

        log_event(
            conn,
            user_id=row["user_id"],
            action="TOKEN_REFRESHED",
            ip_address=ip_address,
            user_agent=user_agent,
        )

        return new_access_token, new_refresh_token, expires_in


def logout(
    conn: Connection,
    *,
    refresh_token: str,
    ip_address: str | None,
    user_agent: str | None,
) -> None:
    token_hash = hash_refresh_token(refresh_token)

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE refresh_tokens
            SET revoked_at = now()
            WHERE token_hash = %s AND revoked_at IS NULL
            RETURNING user_id
            """,
            (token_hash,),
        )
        row = cur.fetchone()
        if row is not None:
            log_event(
                conn,
                user_id=row["user_id"],
                action="USER_LOGOUT",
                ip_address=ip_address,
                user_agent=user_agent,
            )
    # Logout is intentionally idempotent and always "succeeds" from the
    # caller's point of view, whether or not the token matched anything -
    # this avoids leaking whether a given refresh token was ever valid.


def get_user_by_id(conn: Connection, user_id: UUID) -> UserPublic | None:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT id, email, first_name, last_name, is_active, email_verified, created_at
            FROM users
            WHERE id = %s
            """,
            (user_id,),
        )
        row = cur.fetchone()
        return UserPublic(**row) if row else None
