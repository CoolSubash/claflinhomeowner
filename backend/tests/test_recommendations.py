import os
import uuid

import pytest
from fastapi.testclient import TestClient

from app.db.connection import get_connection
from app.main import app
from app.services.recommendations import build_recommendations, identify_weak_areas

pytestmark = pytest.mark.skipif(
    not os.getenv("DATABASE_URL"),
    reason="DATABASE_URL not set; requires a running PostgreSQL instance",
)

client = TestClient(app)

TEST_PASSWORD = "CorrectHorse123"

# Chosen to score below 75 on down_payment, savings, and employment_stability
# (low overall), so recommendations are actually generated for this fixture.
WEAK_ASSESSMENT = {
    "income": "40000.00",
    "monthly_debt": "1600.00",
    "credit_score": 600,
    "savings": "2000.00",
    "down_payment": "2000.00",
    "target_home_price": "300000.00",
    "employment_years": "0.5",
}

STRONG_ASSESSMENT = {
    "income": "150000.00",
    "monthly_debt": "500.00",
    "credit_score": 820,
    "savings": "90000.00",
    "down_payment": "60000.00",
    "target_home_price": "300000.00",
    "employment_years": "6.0",
}


def _unique_email() -> str:
    return f"recs_{uuid.uuid4().hex}@example.com"


def _cleanup_user(email: str) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM users WHERE LOWER(email) = %s", (email.lower(),))


def _register_and_login() -> dict:
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

    login_response = client.post("/api/v1/auth/login", json={"email": email, "password": TEST_PASSWORD})
    assert login_response.status_code == 200, login_response.text
    return {"email": email, "id": user_id, **login_response.json()}


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


def _score_result(account: dict, **overrides) -> dict:
    fields = {**WEAK_ASSESSMENT, **overrides}
    created = client.post("/api/v1/assessments", json=fields, headers=_auth_headers(account))
    assert created.status_code == 201, created.text
    assessment = created.json()
    submitted = client.post(
        f"/api/v1/assessments/{assessment['id']}/submit", headers=_auth_headers(account)
    )
    assert submitted.status_code == 200, submitted.text
    scored = client.post(
        f"/api/v1/assessments/{assessment['id']}/score", headers=_auth_headers(account)
    )
    assert scored.status_code == 201, scored.text
    return scored.json()


# --- Pure engine unit tests ------------------------------------------------


def test_build_recommendations_only_for_weak_categories() -> None:
    breakdowns = [
        {"category": "financial_stability", "category_score": 90},
        {"category": "debt_management", "category_score": 82},
        {"category": "credit", "category_score": 50},
        {"category": "down_payment", "category_score": 20},
        {"category": "savings", "category_score": 70},
        {"category": "employment_stability", "category_score": 95},
    ]
    recs = build_recommendations(breakdowns)
    categories = {r["category"] for r in recs}
    assert categories == {"credit", "down_payment", "savings"}


def test_build_recommendations_priority_thresholds() -> None:
    breakdowns = [
        {"category": "down_payment", "category_score": 10},  # HIGH
        {"category": "savings", "category_score": 45},  # MEDIUM
        {"category": "credit", "category_score": 65},  # LOW
    ]
    by_category = {r["category"]: r["priority"] for r in build_recommendations(breakdowns)}
    assert by_category == {"down_payment": "HIGH", "savings": "MEDIUM", "credit": "LOW"}


def test_build_recommendations_is_deterministic() -> None:
    breakdowns = [
        {"category": "financial_stability", "category_score": 30},
        {"category": "debt_management", "category_score": 30},
    ]
    first = build_recommendations(breakdowns)
    second = build_recommendations(breakdowns)
    assert first == second


def test_identify_weak_areas_returns_two_lowest_in_order() -> None:
    breakdowns = [
        {"category": "credit", "category_score": 85},
        {"category": "employment_stability", "category_score": 90},
        {"category": "debt_management", "category_score": 82},
        {"category": "financial_stability", "category_score": 78},
        {"category": "savings", "category_score": 70},
        {"category": "down_payment", "category_score": 55},
    ]
    weak = identify_weak_areas(breakdowns)
    assert [row["category"] for row in weak] == ["down_payment", "savings"]


# --- GET /readiness-results/{id}/recommendations --------------------------


def test_recommendations_generated_for_weak_result(user_a) -> None:
    result = _score_result(user_a)
    response = client.get(
        f"/api/v1/readiness-results/{result['id']}/recommendations", headers=_auth_headers(user_a)
    )
    assert response.status_code == 200
    body = response.json()
    assert len(body) > 0
    for rec in body:
        assert rec["source"] == "system"
        assert rec["priority"] in {"HIGH", "MEDIUM", "LOW"}
        assert rec["readiness_result_id"] == result["id"]


def test_recommendations_empty_for_strong_result(user_a) -> None:
    result = _score_result(user_a, **STRONG_ASSESSMENT)
    response = client.get(
        f"/api/v1/readiness-results/{result['id']}/recommendations", headers=_auth_headers(user_a)
    )
    assert response.status_code == 200
    assert response.json() == []


def test_recommendations_no_duplicates_on_repeated_get(user_a) -> None:
    result = _score_result(user_a)
    first = client.get(
        f"/api/v1/readiness-results/{result['id']}/recommendations", headers=_auth_headers(user_a)
    ).json()
    second = client.get(
        f"/api/v1/readiness-results/{result['id']}/recommendations", headers=_auth_headers(user_a)
    ).json()
    # Same rows both times - order isn't guaranteed to match (freshly
    # inserted rows come back in insertion order, a later SELECT in
    # category order), but the set of ids must be identical.
    assert {r["id"] for r in first} == {r["id"] for r in second}

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) FROM recommendations WHERE readiness_result_id = %s", (result["id"],)
            )
            (count,) = cur.fetchone()
    assert count == len(first)


def test_recommendations_non_owner_denied(user_a, user_b) -> None:
    result = _score_result(user_a)
    response = client.get(
        f"/api/v1/readiness-results/{result['id']}/recommendations", headers=_auth_headers(user_b)
    )
    assert response.status_code == 404


def test_recommendations_unauthenticated_rejected(user_a) -> None:
    result = _score_result(user_a)
    response = client.get(f"/api/v1/readiness-results/{result['id']}/recommendations")
    assert response.status_code == 401


def test_recommendations_nonexistent_result_returns_404(user_a) -> None:
    response = client.get(
        f"/api/v1/readiness-results/{uuid.uuid4()}/recommendations", headers=_auth_headers(user_a)
    )
    assert response.status_code == 404


def test_recommendations_creates_audit_log(user_a) -> None:
    result = _score_result(user_a)
    client.get(f"/api/v1/readiness-results/{result['id']}/recommendations", headers=_auth_headers(user_a))
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT action FROM audit_logs WHERE resource_id = %s AND action = 'RECOMMENDATIONS_VIEWED'",
                (result["id"],),
            )
            assert cur.fetchone() is not None


# --- Historical immutability: two assessments -> two separate result sets --


def test_two_assessments_keep_separate_recommendation_sets(user_a) -> None:
    result_1 = _score_result(user_a)
    recs_1 = client.get(
        f"/api/v1/readiness-results/{result_1['id']}/recommendations", headers=_auth_headers(user_a)
    ).json()

    result_2 = _score_result(user_a, **STRONG_ASSESSMENT)
    recs_2 = client.get(
        f"/api/v1/readiness-results/{result_2['id']}/recommendations", headers=_auth_headers(user_a)
    ).json()

    assert len(recs_1) > 0
    assert len(recs_2) == 0

    # Re-fetching result 1's recommendations after result 2 was scored shows
    # they were never touched.
    recs_1_again = client.get(
        f"/api/v1/readiness-results/{result_1['id']}/recommendations", headers=_auth_headers(user_a)
    ).json()
    assert {r["id"] for r in recs_1_again} == {r["id"] for r in recs_1}
