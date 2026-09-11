import os
import uuid

import pytest
from fastapi.testclient import TestClient

from app.db.connection import get_connection
from app.main import app

pytestmark = pytest.mark.skipif(
    not os.getenv("DATABASE_URL"),
    reason="DATABASE_URL not set; requires a running PostgreSQL instance",
)

client = TestClient(app)

TEST_PASSWORD = "CorrectHorse123"

COMPLETE_ASSESSMENT = {
    "income": "72000.00",
    "monthly_debt": "1200.00",
    "credit_score": 720,
    "savings": "30000.00",
    "down_payment": "20000.00",
    "target_home_price": "300000.00",
    "employment_years": "3.0",
}


def _unique_email() -> str:
    return f"assessment_{uuid.uuid4().hex}@example.com"


def _cleanup_user(email: str) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM users WHERE LOWER(email) = %s", (email.lower(),))


def _register_and_login() -> dict:
    email = _unique_email()
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": TEST_PASSWORD,
            "first_name": "Test",
            "last_name": "User",
        },
    )
    assert response.status_code == 201, response.text
    user_id = response.json()["id"]

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE users SET email_verified = true WHERE id = %s", (user_id,))

    login_response = client.post(
        "/api/v1/auth/login", json={"email": email, "password": TEST_PASSWORD}
    )
    assert login_response.status_code == 200, login_response.text
    tokens = login_response.json()
    return {"email": email, "id": user_id, **tokens}


@pytest.fixture
def user_a():
    account = _register_and_login()
    yield account
    _cleanup_user(account["email"])


@pytest.fixture
def user_b():
    account = _register_and_login()
    yield account
    _cleanup_user(account["email"])


def _auth_headers(account: dict) -> dict:
    return {"Authorization": f"Bearer {account['access_token']}"}


def _create_draft(account: dict, **fields) -> dict:
    response = client.post("/api/v1/assessments", json=fields, headers=_auth_headers(account))
    assert response.status_code == 201, response.text
    return response.json()


# --- Create ---------------------------------------------------------------


def test_create_assessment_defaults_to_draft(user_a) -> None:
    body = _create_draft(user_a)
    assert body["status"] == "DRAFT"
    assert body["user_id"] == user_a["id"]
    assert body["income"] is None
    assert body["submitted_at"] is None


def test_create_assessment_with_partial_fields(user_a) -> None:
    body = _create_draft(user_a, income="50000.00", credit_score=650)
    assert body["income"] == "50000.00"
    assert body["credit_score"] == 650
    assert body["monthly_debt"] is None


def test_create_assessment_unauthenticated_rejected() -> None:
    response = client.post("/api/v1/assessments", json={})
    assert response.status_code == 401


def test_create_assessment_invalid_credit_score_rejected(user_a) -> None:
    response = client.post(
        "/api/v1/assessments", json={"credit_score": 200}, headers=_auth_headers(user_a)
    )
    assert response.status_code == 422


def test_create_assessment_invalid_target_home_price_rejected(user_a) -> None:
    response = client.post(
        "/api/v1/assessments", json={"target_home_price": "0"}, headers=_auth_headers(user_a)
    )
    assert response.status_code == 422


def test_create_assessment_negative_income_rejected(user_a) -> None:
    response = client.post(
        "/api/v1/assessments", json={"income": "-1"}, headers=_auth_headers(user_a)
    )
    assert response.status_code == 422


def test_create_assessment_creates_audit_log(user_a) -> None:
    body = _create_draft(user_a)
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT action FROM audit_logs WHERE resource_id = %s AND action = 'ASSESSMENT_CREATED'",
                (body["id"],),
            )
            assert cur.fetchone() is not None


# --- List / get -------------------------------------------------------------


def test_list_assessments_returns_only_own(user_a, user_b) -> None:
    _create_draft(user_a)
    _create_draft(user_b)

    response = client.get("/api/v1/assessments", headers=_auth_headers(user_a))
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["user_id"] == user_a["id"]


def test_list_assessments_unauthenticated_rejected() -> None:
    response = client.get("/api/v1/assessments")
    assert response.status_code == 401


def test_get_assessment_owner_allowed(user_a) -> None:
    created = _create_draft(user_a, income="60000.00")
    response = client.get(f"/api/v1/assessments/{created['id']}", headers=_auth_headers(user_a))
    assert response.status_code == 200
    assert response.json()["id"] == created["id"]


def test_get_assessment_non_owner_denied(user_a, user_b) -> None:
    created = _create_draft(user_a)
    response = client.get(f"/api/v1/assessments/{created['id']}", headers=_auth_headers(user_b))
    assert response.status_code == 404


def test_get_assessment_nonexistent_returns_404(user_a) -> None:
    response = client.get(f"/api/v1/assessments/{uuid.uuid4()}", headers=_auth_headers(user_a))
    assert response.status_code == 404


def test_get_assessment_unauthenticated_rejected(user_a) -> None:
    created = _create_draft(user_a)
    response = client.get(f"/api/v1/assessments/{created['id']}")
    assert response.status_code == 401


def test_get_assessment_creates_audit_log(user_a) -> None:
    created = _create_draft(user_a)
    client.get(f"/api/v1/assessments/{created['id']}", headers=_auth_headers(user_a))
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT action FROM audit_logs WHERE resource_id = %s AND action = 'ASSESSMENT_VIEWED'",
                (created["id"],),
            )
            assert cur.fetchone() is not None


# --- Update -----------------------------------------------------------------


def test_update_draft_assessment_owner_allowed(user_a) -> None:
    created = _create_draft(user_a, income="50000.00")
    response = client.patch(
        f"/api/v1/assessments/{created['id']}",
        json={"income": "80000.00", "credit_score": 700},
        headers=_auth_headers(user_a),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["income"] == "80000.00"
    assert body["credit_score"] == 700


def test_update_preserves_unspecified_fields(user_a) -> None:
    created = _create_draft(user_a, income="50000.00", credit_score=650)
    response = client.patch(
        f"/api/v1/assessments/{created['id']}",
        json={"income": "55000.00"},
        headers=_auth_headers(user_a),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["income"] == "55000.00"
    assert body["credit_score"] == 650


def test_update_non_owner_denied(user_a, user_b) -> None:
    created = _create_draft(user_a)
    response = client.patch(
        f"/api/v1/assessments/{created['id']}",
        json={"income": "10.00"},
        headers=_auth_headers(user_b),
    )
    assert response.status_code == 404


def test_update_after_submit_rejected(user_a) -> None:
    created = _create_draft(user_a, **COMPLETE_ASSESSMENT)
    submit_response = client.post(
        f"/api/v1/assessments/{created['id']}/submit", headers=_auth_headers(user_a)
    )
    assert submit_response.status_code == 200

    response = client.patch(
        f"/api/v1/assessments/{created['id']}",
        json={"income": "999.00"},
        headers=_auth_headers(user_a),
    )
    assert response.status_code == 409


def test_update_invalid_value_rejected(user_a) -> None:
    created = _create_draft(user_a)
    response = client.patch(
        f"/api/v1/assessments/{created['id']}",
        json={"credit_score": 900},
        headers=_auth_headers(user_a),
    )
    assert response.status_code == 422


# --- Submit -------------------------------------------------------------


def test_submit_missing_fields_rejected(user_a) -> None:
    created = _create_draft(user_a, income="50000.00")
    response = client.post(
        f"/api/v1/assessments/{created['id']}/submit", headers=_auth_headers(user_a)
    )
    assert response.status_code == 422


def test_submit_complete_assessment_succeeds(user_a) -> None:
    created = _create_draft(user_a, **COMPLETE_ASSESSMENT)
    response = client.post(
        f"/api/v1/assessments/{created['id']}/submit", headers=_auth_headers(user_a)
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "SUBMITTED"
    assert body["submitted_at"] is not None


def test_submit_twice_rejected(user_a) -> None:
    created = _create_draft(user_a, **COMPLETE_ASSESSMENT)
    first = client.post(f"/api/v1/assessments/{created['id']}/submit", headers=_auth_headers(user_a))
    assert first.status_code == 200

    second = client.post(f"/api/v1/assessments/{created['id']}/submit", headers=_auth_headers(user_a))
    assert second.status_code == 409


def test_submit_non_owner_denied(user_a, user_b) -> None:
    created = _create_draft(user_a, **COMPLETE_ASSESSMENT)
    response = client.post(
        f"/api/v1/assessments/{created['id']}/submit", headers=_auth_headers(user_b)
    )
    assert response.status_code == 404


def test_submit_unauthenticated_rejected(user_a) -> None:
    created = _create_draft(user_a, **COMPLETE_ASSESSMENT)
    response = client.post(f"/api/v1/assessments/{created['id']}/submit")
    assert response.status_code == 401


def test_submit_creates_audit_log(user_a) -> None:
    created = _create_draft(user_a, **COMPLETE_ASSESSMENT)
    client.post(f"/api/v1/assessments/{created['id']}/submit", headers=_auth_headers(user_a))
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT action FROM audit_logs WHERE resource_id = %s AND action = 'ASSESSMENT_SUBMITTED'",
                (created["id"],),
            )
            assert cur.fetchone() is not None


# --- Two-user IDOR sweep -----------------------------------------------------


def test_two_user_idor_sweep(user_a, user_b) -> None:
    assessment_a = _create_draft(user_a, **COMPLETE_ASSESSMENT)

    # User B can never read, edit, or submit User A's assessment by ID.
    assert client.get(
        f"/api/v1/assessments/{assessment_a['id']}", headers=_auth_headers(user_b)
    ).status_code == 404
    assert client.patch(
        f"/api/v1/assessments/{assessment_a['id']}",
        json={"income": "1.00"},
        headers=_auth_headers(user_b),
    ).status_code == 404
    assert client.post(
        f"/api/v1/assessments/{assessment_a['id']}/submit", headers=_auth_headers(user_b)
    ).status_code == 404

    # And User A's list never contains User B's data.
    listing = client.get("/api/v1/assessments", headers=_auth_headers(user_a)).json()
    assert all(item["user_id"] == user_a["id"] for item in listing)
