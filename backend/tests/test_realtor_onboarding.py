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
    return f"realtor_{uuid.uuid4().hex}@example.com"


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


@pytest.fixture
def admin():
    account = _register_and_login(roles=["ADMIN"])
    yield account
    _cleanup_user(account["email"])


@pytest.fixture
def user_a():
    account = _register_and_login()
    yield account
    _cleanup_user(account["email"])


def _auth_headers(account: dict) -> dict:
    return {"Authorization": f"Bearer {account['access_token']}"}


# real_estate_partners rows created via the admin API have no user to
# cascade-delete them, unlike every user fixture above - tracked here and
# swept up by _cleanup_partners so the dev database (and the admin
# dashboard) doesn't accumulate test data across runs.
_created_partner_ids: list[str] = []


@pytest.fixture(autouse=True)
def _cleanup_partners():
    yield
    if _created_partner_ids:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM real_estate_partners WHERE id = ANY(%s::uuid[])", (_created_partner_ids,)
                )
        _created_partner_ids.clear()


def _create_partner(admin_account: dict, **overrides) -> dict:
    fields = {"name": "Acme Realty", "contact_email": None, "contact_phone": None, **overrides}
    response = client.post("/api/v1/admin/realtor-partners", json=fields, headers=_auth_headers(admin_account))
    assert response.status_code == 201, response.text
    partner = response.json()
    _created_partner_ids.append(partner["id"])
    return partner


def _insert_invitation(*, partner_id: str, email: str, expires_delta=timedelta(hours=1)) -> str:
    raw_token = generate_secure_token()
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO realtor_invitations (partner_id, email, token_hash, expires_at)
                VALUES (%s, %s, %s, %s)
                """,
                (partner_id, email, hash_token(raw_token), datetime.now(timezone.utc) + expires_delta),
            )
    return raw_token


# --- Admin: create partner --------------------------------------------


def test_admin_can_create_partner(admin) -> None:
    partner = _create_partner(admin, contact_email="agent@example.com")
    assert partner["name"] == "Acme Realty"
    assert partner["user_id"] is None


def test_non_admin_cannot_create_partner(user_a) -> None:
    response = client.post(
        "/api/v1/admin/realtor-partners",
        json={"name": "Acme Realty"},
        headers=_auth_headers(user_a),
    )
    assert response.status_code == 403


def test_create_partner_unauthenticated_rejected() -> None:
    response = client.post("/api/v1/admin/realtor-partners", json={"name": "Acme Realty"})
    assert response.status_code == 401


def test_admin_can_list_partners(admin) -> None:
    _create_partner(admin)
    response = client.get("/api/v1/admin/realtor-partners", headers=_auth_headers(admin))
    assert response.status_code == 200
    assert len(response.json()) >= 1


# --- Admin: send invite -------------------------------------------------


def test_admin_can_invite_realtor(admin) -> None:
    partner = _create_partner(admin)
    response = client.post(
        f"/api/v1/admin/realtor-partners/{partner['id']}/invite",
        json={"email": _unique_email()},
        headers=_auth_headers(admin),
    )
    assert response.status_code == 204

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) FROM realtor_invitations WHERE partner_id = %s", (partner["id"],)
            )
            (count,) = cur.fetchone()
    assert count == 1


def test_invite_nonexistent_partner_returns_404(admin) -> None:
    response = client.post(
        f"/api/v1/admin/realtor-partners/{uuid.uuid4()}/invite",
        json={"email": _unique_email()},
        headers=_auth_headers(admin),
    )
    assert response.status_code == 404


def test_non_admin_cannot_invite_realtor(admin, user_a) -> None:
    partner = _create_partner(admin)
    response = client.post(
        f"/api/v1/admin/realtor-partners/{partner['id']}/invite",
        json={"email": _unique_email()},
        headers=_auth_headers(user_a),
    )
    assert response.status_code == 403


def test_invite_creates_audit_log(admin) -> None:
    partner = _create_partner(admin)
    client.post(
        f"/api/v1/admin/realtor-partners/{partner['id']}/invite",
        json={"email": _unique_email()},
        headers=_auth_headers(admin),
    )
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT action FROM audit_logs WHERE resource_id = %s AND action = 'REALTOR_INVITE_SENT'",
                (partner["id"],),
            )
            assert cur.fetchone() is not None


# --- Admin: list users ---------------------------------------------------


def test_admin_can_list_users_with_roles(admin) -> None:
    response = client.get("/api/v1/admin/users", headers=_auth_headers(admin))
    assert response.status_code == 200
    by_id = {row["id"]: row for row in response.json()}
    assert admin["id"] in by_id
    assert "ADMIN" in by_id[admin["id"]]["roles"]


def test_non_admin_cannot_list_users(user_a) -> None:
    response = client.get("/api/v1/admin/users", headers=_auth_headers(user_a))
    assert response.status_code == 403


# --- Invitation lookup ----------------------------------------------------


def test_lookup_unknown_token_rejected() -> None:
    response = client.post("/api/v1/realtor-invitations/lookup", json={"token": "not-a-real-token"})
    assert response.status_code == 400


def test_lookup_new_email_reports_account_does_not_exist(admin) -> None:
    partner = _create_partner(admin)
    email = _unique_email()
    token = _insert_invitation(partner_id=partner["id"], email=email)

    response = client.post("/api/v1/realtor-invitations/lookup", json={"token": token})
    assert response.status_code == 200
    assert response.json() == {"email": email, "account_exists": False}


def test_lookup_existing_email_reports_account_exists(admin, user_a) -> None:
    partner = _create_partner(admin)
    token = _insert_invitation(partner_id=partner["id"], email=user_a["email"])

    response = client.post("/api/v1/realtor-invitations/lookup", json={"token": token})
    assert response.status_code == 200
    assert response.json() == {"email": user_a["email"], "account_exists": True}


def test_lookup_expired_token_rejected(admin) -> None:
    partner = _create_partner(admin)
    token = _insert_invitation(
        partner_id=partner["id"], email=_unique_email(), expires_delta=timedelta(hours=-1)
    )
    response = client.post("/api/v1/realtor-invitations/lookup", json={"token": token})
    assert response.status_code == 400


# --- Invitation acceptance: brand-new account ------------------------------


def test_accept_invite_new_account_creates_user_and_links_partner(admin) -> None:
    partner = _create_partner(admin)
    email = _unique_email()
    token = _insert_invitation(partner_id=partner["id"], email=email)

    response = client.post(
        "/api/v1/realtor-invitations/accept",
        json={"token": token, "first_name": "Riley", "last_name": "Realtor", "password": TEST_PASSWORD},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["email"] == email
    assert body["email_verified"] is True

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT user_id FROM real_estate_partners WHERE id = %s", (partner["id"],))
                (linked_user_id,) = cur.fetchone()
                assert linked_user_id == uuid.UUID(body["id"])

                cur.execute(
                    """
                    SELECT r.name FROM roles r
                    JOIN user_roles ur ON ur.role_id = r.id
                    WHERE ur.user_id = %s
                    """,
                    (body["id"],),
                )
                roles = {row[0] for row in cur.fetchall()}
                assert roles == {"USER", "REALTOR"}

        # The new account can log in immediately (email pre-verified by the invite).
        login = client.post("/api/v1/auth/login", json={"email": email, "password": TEST_PASSWORD})
        assert login.status_code == 200
    finally:
        _cleanup_user(email)


def test_accept_invite_new_account_missing_fields_rejected(admin) -> None:
    partner = _create_partner(admin)
    token = _insert_invitation(partner_id=partner["id"], email=_unique_email())

    response = client.post("/api/v1/realtor-invitations/accept", json={"token": token})
    assert response.status_code == 422


def test_accept_invite_token_is_single_use(admin) -> None:
    partner = _create_partner(admin)
    email = _unique_email()
    token = _insert_invitation(partner_id=partner["id"], email=email)

    first = client.post(
        "/api/v1/realtor-invitations/accept",
        json={"token": token, "first_name": "Riley", "last_name": "Realtor", "password": TEST_PASSWORD},
    )
    assert first.status_code == 200
    try:
        second = client.post(
            "/api/v1/realtor-invitations/accept",
            json={"token": token, "first_name": "Riley", "last_name": "Realtor", "password": TEST_PASSWORD},
        )
        assert second.status_code == 400
    finally:
        _cleanup_user(email)


def test_accept_invite_creates_role_changed_audit_log(admin) -> None:
    partner = _create_partner(admin)
    email = _unique_email()
    token = _insert_invitation(partner_id=partner["id"], email=email)
    response = client.post(
        "/api/v1/realtor-invitations/accept",
        json={"token": token, "first_name": "Riley", "last_name": "Realtor", "password": TEST_PASSWORD},
    )
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT action FROM audit_logs WHERE user_id = %s AND action = 'ROLE_CHANGED'",
                    (response.json()["id"],),
                )
                assert cur.fetchone() is not None
    finally:
        _cleanup_user(email)


# --- Invitation acceptance: existing account -------------------------------


def test_accept_invite_existing_account_adds_realtor_role_without_password(admin, user_a) -> None:
    partner = _create_partner(admin)
    token = _insert_invitation(partner_id=partner["id"], email=user_a["email"])

    response = client.post("/api/v1/realtor-invitations/accept", json={"token": token})
    assert response.status_code == 200, response.text
    assert response.json()["id"] == user_a["id"]

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT r.name FROM roles r
                JOIN user_roles ur ON ur.role_id = r.id
                WHERE ur.user_id = %s
                """,
                (user_a["id"],),
            )
            roles = {row[0] for row in cur.fetchall()}
            assert roles == {"USER", "REALTOR"}

            cur.execute("SELECT user_id FROM real_estate_partners WHERE id = %s", (partner["id"],))
            (linked_user_id,) = cur.fetchone()
            assert str(linked_user_id) == user_a["id"]

    # Existing account's original password still works - it was never touched.
    login = client.post("/api/v1/auth/login", json={"email": user_a["email"], "password": TEST_PASSWORD})
    assert login.status_code == 200
