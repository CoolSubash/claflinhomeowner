import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.db.connection import get_connection
from app.main import app
from app.security.tokens import generate_secure_token, hash_token

pytestmark = pytest.mark.skipif(
    not os.getenv("DATABASE_URL"),
    reason="DATABASE_URL not set; requires a running PostgreSQL instance",
)

client = TestClient(app)

TEST_PASSWORD = "CorrectHorse123"


def _unique_email() -> str:
    return f"verify_{uuid.uuid4().hex}@example.com"


def _cleanup_user(email: str) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM users WHERE LOWER(email) = %s", (email.lower(),))


def _register() -> dict:
    email = _unique_email()
    response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": TEST_PASSWORD, "first_name": "Test", "last_name": "User"},
    )
    assert response.status_code == 201, response.text
    return {"email": email, "id": response.json()["id"]}


@pytest.fixture
def registered_user():
    account = _register()
    yield account
    _cleanup_user(account["email"])


# --- Registration issues a token --------------------------------------


def test_register_creates_verification_token(registered_user) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) FROM email_verification_tokens WHERE user_id = %s",
                (registered_user["id"],),
            )
            (count,) = cur.fetchone()
    assert count == 1


def test_register_creates_verification_sent_audit_log(registered_user) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT action FROM audit_logs WHERE user_id = %s AND action = 'EMAIL_VERIFICATION_SENT'",
                (registered_user["id"],),
            )
            assert cur.fetchone() is not None


# --- POST /auth/verify-email ------------------------------------------


def test_verify_email_with_bogus_token_rejected() -> None:
    response = client.post("/api/v1/auth/verify-email", json={"token": "not-a-real-token"})
    assert response.status_code == 400


def test_verify_email_unknown_token_message_does_not_leak(registered_user) -> None:
    response = client.post("/api/v1/auth/verify-email", json={"token": "not-a-real-token"})
    assert response.status_code == 400
    assert "password_hash" not in response.text
    assert registered_user["email"] not in response.text


def test_verify_email_expired_token_rejected(registered_user) -> None:
    raw_token = generate_secure_token()
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
                VALUES (%s, %s, %s)
                """,
                (registered_user["id"], hash_token(raw_token), datetime.now(timezone.utc) - timedelta(hours=1)),
            )

    response = client.post("/api/v1/auth/verify-email", json={"token": raw_token})
    assert response.status_code == 400


def test_verify_email_valid_token_marks_verified_and_allows_login(registered_user) -> None:
    raw_token = generate_secure_token()
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
                VALUES (%s, %s, %s)
                """,
                (registered_user["id"], hash_token(raw_token), datetime.now(timezone.utc) + timedelta(hours=1)),
            )

    response = client.post("/api/v1/auth/verify-email", json={"token": raw_token})
    assert response.status_code == 200, response.text
    assert response.json()["email_verified"] is True

    login = client.post(
        "/api/v1/auth/login", json={"email": registered_user["email"], "password": TEST_PASSWORD}
    )
    assert login.status_code == 200


def test_verify_email_token_is_single_use(registered_user) -> None:
    raw_token = generate_secure_token()
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
                VALUES (%s, %s, %s)
                """,
                (registered_user["id"], hash_token(raw_token), datetime.now(timezone.utc) + timedelta(hours=1)),
            )

    first = client.post("/api/v1/auth/verify-email", json={"token": raw_token})
    assert first.status_code == 200

    second = client.post("/api/v1/auth/verify-email", json={"token": raw_token})
    assert second.status_code == 400


def test_verify_email_creates_audit_log(registered_user) -> None:
    raw_token = generate_secure_token()
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
                VALUES (%s, %s, %s)
                """,
                (registered_user["id"], hash_token(raw_token), datetime.now(timezone.utc) + timedelta(hours=1)),
            )
    client.post("/api/v1/auth/verify-email", json={"token": raw_token})

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT action FROM audit_logs WHERE user_id = %s AND action = 'EMAIL_VERIFIED'",
                (registered_user["id"],),
            )
            assert cur.fetchone() is not None


# --- Login gating -------------------------------------------------------


def test_login_before_verification_rejected(registered_user) -> None:
    response = client.post(
        "/api/v1/auth/login", json={"email": registered_user["email"], "password": TEST_PASSWORD}
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "Please verify your email before signing in"


# --- POST /auth/resend-verification -------------------------------------


def test_resend_verification_unknown_email_returns_204() -> None:
    response = client.post(
        "/api/v1/auth/resend-verification", json={"email": _unique_email()}
    )
    assert response.status_code == 204


def test_resend_verification_issues_new_token(registered_user) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) FROM email_verification_tokens WHERE user_id = %s",
                (registered_user["id"],),
            )
            (before,) = cur.fetchone()

    response = client.post(
        "/api/v1/auth/resend-verification", json={"email": registered_user["email"]}
    )
    assert response.status_code == 204

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) FROM email_verification_tokens WHERE user_id = %s",
                (registered_user["id"],),
            )
            (after,) = cur.fetchone()
    assert after == before + 1


def test_resend_verification_already_verified_is_noop(registered_user) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE users SET email_verified = true WHERE id = %s", (registered_user["id"],)
            )
            cur.execute(
                "SELECT COUNT(*) FROM email_verification_tokens WHERE user_id = %s",
                (registered_user["id"],),
            )
            (before,) = cur.fetchone()

    response = client.post(
        "/api/v1/auth/resend-verification", json={"email": registered_user["email"]}
    )
    assert response.status_code == 204

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) FROM email_verification_tokens WHERE user_id = %s",
                (registered_user["id"],),
            )
            (after,) = cur.fetchone()
    assert after == before
