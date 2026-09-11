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
    return f"readiness_{uuid.uuid4().hex}@example.com"


def _cleanup_user(email: str) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM users WHERE LOWER(email) = %s", (email.lower(),))


def _register_and_login(*, roles: list[str] | None = None) -> dict:
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

    if roles is not None:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM user_roles WHERE user_id = %s", (user_id,))
                for role_name in roles:
                    cur.execute(
                        "INSERT INTO user_roles (user_id, role_id) SELECT %s, id FROM roles WHERE name = %s",
                        (user_id, role_name),
                    )

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


def _create_and_submit(account: dict, **overrides) -> dict:
    fields = {**COMPLETE_ASSESSMENT, **overrides}
    created = client.post("/api/v1/assessments", json=fields, headers=_auth_headers(account))
    assert created.status_code == 201, created.text
    assessment = created.json()
    submitted = client.post(
        f"/api/v1/assessments/{assessment['id']}/submit", headers=_auth_headers(account)
    )
    assert submitted.status_code == 200, submitted.text
    return assessment


# --- POST /assessments/{id}/score --------------------------------------


def test_score_submitted_assessment_succeeds(user_a) -> None:
    assessment = _create_and_submit(user_a)
    response = client.post(
        f"/api/v1/assessments/{assessment['id']}/score", headers=_auth_headers(user_a)
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["assessment_id"] == assessment["id"]
    assert body["scoring_version"] == "v1"
    assert body["overall_score"] == 58
    assert body["readiness_level"] == "NEEDS_IMPROVEMENT"
    assert len(body["components"]) == 6
    categories = {c["category"] for c in body["components"]}
    assert categories == {
        "financial_stability",
        "debt_management",
        "credit",
        "down_payment",
        "savings",
        "employment_stability",
    }
    for component in body["components"]:
        assert 0 <= component["score"] <= 100
        assert component["explanation"]


def test_score_draft_assessment_rejected(user_a) -> None:
    created = client.post("/api/v1/assessments", json={}, headers=_auth_headers(user_a))
    assert created.status_code == 201
    response = client.post(
        f"/api/v1/assessments/{created.json()['id']}/score", headers=_auth_headers(user_a)
    )
    assert response.status_code == 409


def test_score_nonexistent_assessment_rejected(user_a) -> None:
    response = client.post(
        f"/api/v1/assessments/{uuid.uuid4()}/score", headers=_auth_headers(user_a)
    )
    assert response.status_code == 404


def test_score_non_owner_rejected(user_a, user_b) -> None:
    assessment = _create_and_submit(user_a)
    response = client.post(
        f"/api/v1/assessments/{assessment['id']}/score", headers=_auth_headers(user_b)
    )
    assert response.status_code == 404


def test_score_unauthenticated_rejected(user_a) -> None:
    assessment = _create_and_submit(user_a)
    response = client.post(f"/api/v1/assessments/{assessment['id']}/score")
    assert response.status_code == 401


def test_score_lacking_permission_rejected(user_a) -> None:
    # An account with only ADMIN (no USER role) has no assessment:update:own.
    admin_only = _register_and_login(roles=["ADMIN"])
    try:
        assessment = _create_and_submit(user_a)
        response = client.post(
            f"/api/v1/assessments/{assessment['id']}/score", headers=_auth_headers(admin_only)
        )
        assert response.status_code == 403
    finally:
        _cleanup_user(admin_only["email"])


def test_score_repeated_call_is_idempotent(user_a) -> None:
    assessment = _create_and_submit(user_a)
    first = client.post(
        f"/api/v1/assessments/{assessment['id']}/score", headers=_auth_headers(user_a)
    )
    assert first.status_code == 201
    first_result_id = first.json()["id"]

    second = client.post(
        f"/api/v1/assessments/{assessment['id']}/score", headers=_auth_headers(user_a)
    )
    assert second.status_code == 200
    assert second.json()["id"] == first_result_id
    assert second.json()["overall_score"] == first.json()["overall_score"]

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) FROM readiness_results WHERE assessment_id = %s",
                (assessment["id"],),
            )
            (count,) = cur.fetchone()
    assert count == 1


def test_score_persists_result_and_breakdowns(user_a) -> None:
    assessment = _create_and_submit(user_a)
    response = client.post(
        f"/api/v1/assessments/{assessment['id']}/score", headers=_auth_headers(user_a)
    )
    result_id = response.json()["id"]

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT overall_score, status FROM readiness_results WHERE id = %s", (result_id,))
            row = cur.fetchone()
            assert row is not None
            assert row[0] == 58
            assert row[1] == "NEEDS_IMPROVEMENT"

            cur.execute(
                "SELECT COUNT(*) FROM score_breakdowns WHERE readiness_result_id = %s", (result_id,)
            )
            (breakdown_count,) = cur.fetchone()
            assert breakdown_count == 6


def test_score_creates_audit_log(user_a) -> None:
    assessment = _create_and_submit(user_a)
    client.post(f"/api/v1/assessments/{assessment['id']}/score", headers=_auth_headers(user_a))
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT metadata FROM audit_logs WHERE user_id = %s AND action = 'ASSESSMENT_SCORED'",
                (user_a["id"],),
            )
            row = cur.fetchone()
            assert row is not None
            assert row[0]["assessment_id"] == assessment["id"]
            assert "income" not in row[0]
            assert "monthly_debt" not in row[0]


# --- GET /assessments/{id}/result ---------------------------------------


def test_get_result_owner_allowed(user_a) -> None:
    assessment = _create_and_submit(user_a)
    client.post(f"/api/v1/assessments/{assessment['id']}/score", headers=_auth_headers(user_a))

    response = client.get(
        f"/api/v1/assessments/{assessment['id']}/result", headers=_auth_headers(user_a)
    )
    assert response.status_code == 200
    assert response.json()["overall_score"] == 58


def test_get_result_non_owner_rejected(user_a, user_b) -> None:
    assessment = _create_and_submit(user_a)
    client.post(f"/api/v1/assessments/{assessment['id']}/score", headers=_auth_headers(user_a))

    response = client.get(
        f"/api/v1/assessments/{assessment['id']}/result", headers=_auth_headers(user_b)
    )
    assert response.status_code == 404


def test_get_result_unauthenticated_rejected(user_a) -> None:
    assessment = _create_and_submit(user_a)
    response = client.get(f"/api/v1/assessments/{assessment['id']}/result")
    assert response.status_code == 401


def test_get_result_no_result_yet_returns_404(user_a) -> None:
    assessment = _create_and_submit(user_a)
    response = client.get(
        f"/api/v1/assessments/{assessment['id']}/result", headers=_auth_headers(user_a)
    )
    assert response.status_code == 404


# --- GET /readiness-results ----------------------------------------------


def test_readiness_results_history_returns_own_only(user_a, user_b) -> None:
    assessment_a = _create_and_submit(user_a)
    client.post(f"/api/v1/assessments/{assessment_a['id']}/score", headers=_auth_headers(user_a))

    assessment_b = _create_and_submit(user_b)
    client.post(f"/api/v1/assessments/{assessment_b['id']}/score", headers=_auth_headers(user_b))

    response = client.get("/api/v1/readiness-results", headers=_auth_headers(user_a))
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["assessment_id"] == assessment_a["id"]


def test_readiness_results_history_unauthenticated_rejected() -> None:
    response = client.get("/api/v1/readiness-results")
    assert response.status_code == 401


def test_readiness_results_history_ordered_newest_first(user_a) -> None:
    first_assessment = _create_and_submit(user_a, credit_score=650)
    client.post(f"/api/v1/assessments/{first_assessment['id']}/score", headers=_auth_headers(user_a))

    second_assessment = _create_and_submit(user_a, credit_score=800)
    client.post(f"/api/v1/assessments/{second_assessment['id']}/score", headers=_auth_headers(user_a))

    response = client.get("/api/v1/readiness-results", headers=_auth_headers(user_a))
    body = response.json()
    assert len(body) == 2
    assert body[0]["assessment_id"] == second_assessment["id"]
    assert body[1]["assessment_id"] == first_assessment["id"]


def test_readiness_results_history_pagination_limit(user_a) -> None:
    for _ in range(3):
        assessment = _create_and_submit(user_a)
        client.post(f"/api/v1/assessments/{assessment['id']}/score", headers=_auth_headers(user_a))

    response = client.get("/api/v1/readiness-results?limit=2", headers=_auth_headers(user_a))
    assert response.status_code == 200
    assert len(response.json()) == 2


# --- Mandatory two-user security test --------------------------------------


def test_two_user_readiness_result_security(user_a, user_b) -> None:
    assessment_a = _create_and_submit(user_a)
    result_a = client.post(
        f"/api/v1/assessments/{assessment_a['id']}/score", headers=_auth_headers(user_a)
    ).json()

    assessment_b = _create_and_submit(user_b)
    client.post(f"/api/v1/assessments/{assessment_b['id']}/score", headers=_auth_headers(user_b))

    # User A -> own result: ALLOWED
    own = client.get(
        f"/api/v1/assessments/{assessment_a['id']}/result", headers=_auth_headers(user_a)
    )
    assert own.status_code == 200
    assert own.json()["id"] == result_a["id"]

    # User A -> User B's result (via User B's assessment id): DENIED
    other = client.get(
        f"/api/v1/assessments/{assessment_b['id']}/result", headers=_auth_headers(user_a)
    )
    assert other.status_code == 404

    # User A's history contains only Result A.
    history = client.get("/api/v1/readiness-results", headers=_auth_headers(user_a)).json()
    assert len(history) == 1
    assert history[0]["id"] == result_a["id"]
