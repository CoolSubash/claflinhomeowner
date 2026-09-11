import os
import uuid
from datetime import datetime, timedelta, timezone

import jwt
import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.db.connection import get_connection
from app.main import app
from app.security.passwords import verify_password
from app.security.tokens import generate_refresh_token, hash_refresh_token

pytestmark = pytest.mark.skipif(
    not os.getenv("DATABASE_URL"),
    reason="DATABASE_URL not set; requires a running PostgreSQL instance",
)

client = TestClient(app)

TEST_PASSWORD = "CorrectHorse123"


def _unique_email() -> str:
    return f"test_{uuid.uuid4().hex}@example.com"


def _register(email: str, password: str = TEST_PASSWORD):
    return client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": password,
            "first_name": "Test",
            "last_name": "User",
        },
    )


def _cleanup_user(email: str) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM users WHERE LOWER(email) = %s", (email.lower(),))


@pytest.fixture
def registered_user():
    email = _unique_email()
    response = _register(email)
    assert response.status_code == 201, response.text
    body = response.json()
    yield {"email": email, "password": TEST_PASSWORD, "id": body["id"]}
    _cleanup_user(email)


def _mark_verified(user_id: str) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE users SET email_verified = true WHERE id = %s", (user_id,))


@pytest.fixture
def verified_user(registered_user):
    _mark_verified(registered_user["id"])
    return registered_user


@pytest.fixture
def logged_in_user(verified_user):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": verified_user["email"], "password": verified_user["password"]},
    )
    assert response.status_code == 200, response.text
    tokens = response.json()
    return {**verified_user, **tokens}


# --- Registration -----------------------------------------------------


def test_register_success() -> None:
    email = _unique_email()
    try:
        response = _register(email)
        assert response.status_code == 201
        body = response.json()
        assert body["email"] == email
        assert body["is_active"] is True
        assert body["email_verified"] is False
        assert "password_hash" not in body
        assert "password" not in body
    finally:
        _cleanup_user(email)


def test_register_duplicate_email_rejected(registered_user) -> None:
    response = _register(registered_user["email"])
    assert response.status_code == 409
    assert "password_hash" not in response.text


def test_register_duplicate_email_case_insensitive(registered_user) -> None:
    response = _register(registered_user["email"].upper())
    assert response.status_code == 409


def test_register_invalid_email_rejected() -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "not-an-email",
            "password": TEST_PASSWORD,
            "first_name": "Test",
            "last_name": "User",
        },
    )
    assert response.status_code == 422


@pytest.mark.parametrize(
    "password",
    ["short1", "alllettersnodigits", "12345678", ""],
)
def test_register_weak_password_rejected(password: str) -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": _unique_email(),
            "password": password,
            "first_name": "Test",
            "last_name": "User",
        },
    )
    assert response.status_code == 422


def test_register_assigns_user_role(registered_user) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT r.name FROM roles r
                JOIN user_roles ur ON ur.role_id = r.id
                WHERE ur.user_id = %s
                """,
                (registered_user["id"],),
            )
            roles = [row[0] for row in cur.fetchall()]
    assert roles == ["USER"]


def test_register_password_hash_not_plaintext_and_verifies(registered_user) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT password_hash FROM users WHERE id = %s", (registered_user["id"],)
            )
            (password_hash,) = cur.fetchone()

    assert password_hash != TEST_PASSWORD
    assert password_hash.startswith("$argon2id$")
    assert verify_password(TEST_PASSWORD, password_hash)
    assert not verify_password("wrong-password", password_hash)


def test_register_creates_audit_log(registered_user) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT action FROM audit_logs WHERE user_id = %s AND action = 'USER_REGISTERED'",
                (registered_user["id"],),
            )
            assert cur.fetchone() is not None


# --- Login --------------------------------------------------------------


def test_login_success_returns_tokens(verified_user) -> None:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": verified_user["email"], "password": verified_user["password"]},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["access_token"]
    assert body["refresh_token"]
    assert body["token_type"] == "bearer"
    assert body["expires_in"] == 15 * 60


def test_login_unverified_email_rejected(registered_user) -> None:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": registered_user["email"], "password": registered_user["password"]},
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "Please verify your email before signing in"


def test_login_incorrect_password_rejected(registered_user) -> None:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": registered_user["email"], "password": "WrongPassword123"},
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password"


def test_login_nonexistent_email_rejected() -> None:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": _unique_email(), "password": TEST_PASSWORD},
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password"


def test_login_inactive_user_rejected(registered_user) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE users SET is_active = false WHERE id = %s", (registered_user["id"],)
            )

    response = client.post(
        "/api/v1/auth/login",
        json={"email": registered_user["email"], "password": registered_user["password"]},
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password"


def test_login_stores_refresh_token_hash(logged_in_user) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT token_hash FROM refresh_tokens WHERE user_id = %s", (logged_in_user["id"],)
            )
            (stored_hash,) = cur.fetchone()

    assert stored_hash != logged_in_user["refresh_token"]
    assert stored_hash == hash_refresh_token(logged_in_user["refresh_token"])


def test_login_updates_last_login_at(logged_in_user) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT last_login_at FROM users WHERE id = %s", (logged_in_user["id"],)
            )
            (last_login_at,) = cur.fetchone()
    assert last_login_at is not None


def test_login_creates_audit_log(logged_in_user) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT action FROM audit_logs WHERE user_id = %s AND action = 'USER_LOGIN'",
                (logged_in_user["id"],),
            )
            assert cur.fetchone() is not None


def test_login_failure_creates_audit_log(registered_user) -> None:
    client.post(
        "/api/v1/auth/login",
        json={"email": registered_user["email"], "password": "WrongPassword123"},
    )
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT action FROM audit_logs WHERE user_id = %s AND action = 'USER_LOGIN_FAILED'",
                (registered_user["id"],),
            )
            assert cur.fetchone() is not None


# --- Access token / current-user dependency -----------------------------


def test_me_valid_token_accepted(logged_in_user) -> None:
    response = client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {logged_in_user['access_token']}"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["email"] == logged_in_user["email"]
    assert "password_hash" not in response.text


def test_me_missing_token_rejected() -> None:
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401


def test_me_malformed_token_rejected() -> None:
    response = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer not-a-jwt"})
    assert response.status_code == 401


def test_me_invalid_signature_rejected(logged_in_user) -> None:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    bad_token = jwt.encode(
        {
            "sub": logged_in_user["id"],
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(minutes=15)).timestamp()),
            "jti": str(uuid.uuid4()),
        },
        "a-completely-different-secret",
        algorithm="HS256",
    )
    response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {bad_token}"})
    assert response.status_code == 401


def test_me_expired_token_rejected(logged_in_user) -> None:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    expired_token = jwt.encode(
        {
            "sub": logged_in_user["id"],
            "iat": int((now - timedelta(minutes=30)).timestamp()),
            "exp": int((now - timedelta(minutes=15)).timestamp()),
            "jti": str(uuid.uuid4()),
        },
        settings.jwt_secret,
        algorithm="HS256",
    )
    response = client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {expired_token}"}
    )
    assert response.status_code == 401


def test_me_nonexistent_user_rejected(logged_in_user) -> None:
    _cleanup_user(logged_in_user["email"])
    response = client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {logged_in_user['access_token']}"}
    )
    assert response.status_code == 401


def test_me_inactive_user_rejected(logged_in_user) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE users SET is_active = false WHERE id = %s", (logged_in_user["id"],)
            )
    response = client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {logged_in_user['access_token']}"}
    )
    assert response.status_code == 401


# --- Refresh tokens -------------------------------------------------------


def test_refresh_valid_token_works(logged_in_user) -> None:
    response = client.post(
        "/api/v1/auth/refresh", json={"refresh_token": logged_in_user["refresh_token"]}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["access_token"]
    assert body["refresh_token"] != logged_in_user["refresh_token"]


def test_refresh_expired_token_rejected(registered_user) -> None:
    raw_token = generate_refresh_token()
    token_hash = hash_refresh_token(raw_token)
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
                VALUES (%s, %s, %s)
                """,
                (registered_user["id"], token_hash, datetime.now(timezone.utc) - timedelta(days=1)),
            )

    response = client.post("/api/v1/auth/refresh", json={"refresh_token": raw_token})
    assert response.status_code == 401


def test_refresh_rotation_and_reuse_detection(logged_in_user) -> None:
    first_refresh = logged_in_user["refresh_token"]

    rotated = client.post("/api/v1/auth/refresh", json={"refresh_token": first_refresh})
    assert rotated.status_code == 200
    second_refresh = rotated.json()["refresh_token"]
    assert second_refresh != first_refresh

    # Old token cannot be reused.
    reused = client.post("/api/v1/auth/refresh", json={"refresh_token": first_refresh})
    assert reused.status_code == 401

    # Reuse of a revoked token must invalidate the whole family, including
    # the token that replaced it.
    rotated_again = client.post("/api/v1/auth/refresh", json={"refresh_token": second_refresh})
    assert rotated_again.status_code == 401


def test_refresh_new_token_stored_hashed(logged_in_user) -> None:
    response = client.post(
        "/api/v1/auth/refresh", json={"refresh_token": logged_in_user["refresh_token"]}
    )
    new_refresh_token = response.json()["refresh_token"]

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT token_hash FROM refresh_tokens WHERE user_id = %s ORDER BY issued_at DESC LIMIT 1",
                (logged_in_user["id"],),
            )
            (stored_hash,) = cur.fetchone()

    assert stored_hash == hash_refresh_token(new_refresh_token)
    assert stored_hash != new_refresh_token


def test_refresh_nonexistent_token_rejected() -> None:
    response = client.post(
        "/api/v1/auth/refresh", json={"refresh_token": "totally-made-up-token"}
    )
    assert response.status_code == 401


def test_refresh_creates_audit_log(logged_in_user) -> None:
    client.post("/api/v1/auth/refresh", json={"refresh_token": logged_in_user["refresh_token"]})
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT action FROM audit_logs WHERE user_id = %s AND action = 'TOKEN_REFRESHED'",
                (logged_in_user["id"],),
            )
            assert cur.fetchone() is not None


# --- Logout ---------------------------------------------------------------


def test_logout_revokes_refresh_token(logged_in_user) -> None:
    response = client.post(
        "/api/v1/auth/logout", json={"refresh_token": logged_in_user["refresh_token"]}
    )
    assert response.status_code == 204

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT revoked_at FROM refresh_tokens WHERE user_id = %s", (logged_in_user["id"],)
            )
            (revoked_at,) = cur.fetchone()
    assert revoked_at is not None


def test_logout_then_refresh_rejected(logged_in_user) -> None:
    client.post("/api/v1/auth/logout", json={"refresh_token": logged_in_user["refresh_token"]})
    response = client.post(
        "/api/v1/auth/refresh", json={"refresh_token": logged_in_user["refresh_token"]}
    )
    assert response.status_code == 401


def test_logout_creates_audit_log(logged_in_user) -> None:
    client.post("/api/v1/auth/logout", json={"refresh_token": logged_in_user["refresh_token"]})
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT action FROM audit_logs WHERE user_id = %s AND action = 'USER_LOGOUT'",
                (logged_in_user["id"],),
            )
            assert cur.fetchone() is not None


def test_logout_unknown_token_still_succeeds() -> None:
    # Idempotent by design: logout never reveals whether a token was valid.
    response = client.post(
        "/api/v1/auth/logout", json={"refresh_token": "a-token-that-was-never-issued"}
    )
    assert response.status_code == 204
