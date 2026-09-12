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
    return f"conn_{uuid.uuid4().hex}@example.com"


def _cleanup_user(email: str) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM users WHERE LOWER(email) = %s", (email.lower(),))


def _register_and_login(*, roles: list[str] | None = None) -> dict:
    email = _unique_email()
    response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": TEST_PASSWORD, "first_name": "Test", "last_name": "User"},
    )
    assert response.status_code == 201, response.text
    user_id = response.json()["id"]

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE users SET email_verified = true WHERE id = %s", (user_id,))
            if roles is not None:
                cur.execute("DELETE FROM user_roles WHERE user_id = %s", (user_id,))
                for role_name in roles:
                    cur.execute(
                        "INSERT INTO user_roles (user_id, role_id) SELECT %s, id FROM roles WHERE name = %s",
                        (user_id, role_name),
                    )

    login_response = client.post("/api/v1/auth/login", json={"email": email, "password": TEST_PASSWORD})
    assert login_response.status_code == 200, login_response.text
    return {"email": email, "id": user_id, **login_response.json()}


def _auth_headers(account: dict) -> dict:
    return {"Authorization": f"Bearer {account['access_token']}"}


# real_estate_partners.user_id is ON DELETE SET NULL, not CASCADE - deleting
# the realtor account (via _cleanup_user) never deletes the partner row
# itself, so it's tracked and swept up separately here.
_created_partner_ids: list[str] = []


@pytest.fixture(autouse=True)
def _cleanup_partners():
    yield
    if _created_partner_ids:
        with get_connection() as conn:
            with conn.cursor() as cur:
                # connection_requests.partner_id is ON DELETE RESTRICT, so any
                # request still pointing at a test partner must go first -
                # regardless of whether the owning homebuyer's fixture
                # teardown (which would cascade-delete it) already ran.
                cur.execute(
                    "DELETE FROM connection_requests WHERE partner_id = ANY(%s::uuid[])", (_created_partner_ids,)
                )
                cur.execute(
                    "DELETE FROM real_estate_partners WHERE id = ANY(%s::uuid[])", (_created_partner_ids,)
                )
        _created_partner_ids.clear()


def _create_partner_row(*, user_id: str | None = None) -> str:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO real_estate_partners (name, user_id) VALUES (%s, %s) RETURNING id",
                ("Test Realty", user_id),
            )
            (partner_id,) = cur.fetchone()
    _created_partner_ids.append(str(partner_id))
    return str(partner_id)


def _onboard_realtor(partner_id: str) -> dict:
    """Registers a fresh account and links it to partner_id via a real invitation redemption."""
    email = _unique_email()
    raw_token = generate_secure_token()
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO realtor_invitations (partner_id, email, token_hash, expires_at)
                VALUES (%s, %s, %s, %s)
                """,
                (partner_id, email, hash_token(raw_token), datetime.now(timezone.utc) + timedelta(hours=1)),
            )
    response = client.post(
        "/api/v1/realtor-invitations/accept",
        json={"token": raw_token, "first_name": "Riley", "last_name": "Realtor", "password": TEST_PASSWORD},
    )
    assert response.status_code == 200, response.text
    user_id = response.json()["id"]

    login = client.post("/api/v1/auth/login", json={"email": email, "password": TEST_PASSWORD})
    assert login.status_code == 200
    return {"email": email, "id": user_id, **login.json()}


def _create_connection_request(*, user_id: str, partner_id: str) -> str:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO connection_requests (user_id, partner_id, consent_given_at)
                VALUES (%s, %s, now())
                RETURNING id
                """,
                (user_id, partner_id),
            )
            (request_id,) = cur.fetchone()
    return str(request_id)


@pytest.fixture
def homebuyer():
    account = _register_and_login()
    yield account
    _cleanup_user(account["email"])


@pytest.fixture
def realtor_a(homebuyer):
    partner_id = _create_partner_row()
    account = _onboard_realtor(partner_id)
    account["partner_id"] = partner_id
    account["request_id"] = _create_connection_request(user_id=homebuyer["id"], partner_id=partner_id)
    yield account
    _cleanup_user(account["email"])


@pytest.fixture
def realtor_b():
    partner_id = _create_partner_row()
    account = _onboard_realtor(partner_id)
    account["partner_id"] = partner_id
    yield account
    _cleanup_user(account["email"])


# --- Listing ----------------------------------------------------------


def test_realtor_sees_own_connection_requests(realtor_a) -> None:
    response = client.get("/api/v1/realtor/connection-requests", headers=_auth_headers(realtor_a))
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["id"] == realtor_a["request_id"]
    assert body[0]["status"] == "PENDING"
    assert "requester_name" in body[0]


def test_realtor_does_not_see_other_partners_requests(realtor_a, realtor_b) -> None:
    response = client.get("/api/v1/realtor/connection-requests", headers=_auth_headers(realtor_b))
    assert response.status_code == 200
    assert response.json() == []


def test_list_connection_requests_unauthenticated_rejected() -> None:
    response = client.get("/api/v1/realtor/connection-requests")
    assert response.status_code == 401


def test_homebuyer_lacks_permission_to_list(homebuyer) -> None:
    response = client.get("/api/v1/realtor/connection-requests", headers=_auth_headers(homebuyer))
    assert response.status_code == 403


# --- Responding ---------------------------------------------------------


def test_realtor_can_accept_own_connection_request(realtor_a) -> None:
    response = client.post(
        f"/api/v1/realtor/connection-requests/{realtor_a['request_id']}/respond",
        json={"status": "ACCEPTED"},
        headers=_auth_headers(realtor_a),
    )
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "ACCEPTED"


def test_realtor_b_cannot_respond_to_realtor_a_request(realtor_a, realtor_b) -> None:
    response = client.post(
        f"/api/v1/realtor/connection-requests/{realtor_a['request_id']}/respond",
        json={"status": "ACCEPTED"},
        headers=_auth_headers(realtor_b),
    )
    assert response.status_code == 404

    # And it must remain untouched.
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT status FROM connection_requests WHERE id = %s", (realtor_a["request_id"],)
            )
            (status_value,) = cur.fetchone()
    assert status_value == "PENDING"


def test_respond_to_nonexistent_request_returns_404(realtor_a) -> None:
    response = client.post(
        f"/api/v1/realtor/connection-requests/{uuid.uuid4()}/respond",
        json={"status": "ACCEPTED"},
        headers=_auth_headers(realtor_a),
    )
    assert response.status_code == 404


def test_respond_creates_audit_log(realtor_a) -> None:
    client.post(
        f"/api/v1/realtor/connection-requests/{realtor_a['request_id']}/respond",
        json={"status": "DECLINED"},
        headers=_auth_headers(realtor_a),
    )
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT action FROM audit_logs WHERE resource_id = %s AND action = 'CONNECTION_REQUEST_RESPONDED'",
                (realtor_a["request_id"],),
            )
            assert cur.fetchone() is not None


# --- No linked partner (data-integrity edge case) --------------------------


def test_realtor_permission_without_linked_partner_returns_404() -> None:
    # A REALTOR-permissioned account with no real_estate_partners row
    # linked to it (shouldn't normally happen - onboarding always links
    # one) must still fail closed, not leak another partner's requests.
    account = _register_and_login(roles=["USER", "REALTOR"])
    try:
        response = client.get("/api/v1/realtor/connection-requests", headers=_auth_headers(account))
        assert response.status_code == 404
    finally:
        _cleanup_user(account["email"])
