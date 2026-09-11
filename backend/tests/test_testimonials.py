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


def _unique_email() -> str:
    return f"testimonial_{uuid.uuid4().hex}@example.com"


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
            "first_name": "Jordan",
            "last_name": "Rivera",
        },
    )
    assert response.status_code == 201, response.text
    user_id = response.json()["id"]

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE users SET email_verified = true WHERE id = %s", (user_id,))

    if roles:
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
def user():
    account = _register_and_login()
    yield account
    _cleanup_user(account["email"])


@pytest.fixture
def realtor():
    account = _register_and_login(roles=["USER", "REALTOR"])
    yield account
    _cleanup_user(account["email"])


def _auth_headers(account: dict) -> dict:
    return {"Authorization": f"Bearer {account['access_token']}"}


# --- Create ---------------------------------------------------------------


def test_create_testimonial_success(user) -> None:
    response = client.post(
        "/api/v1/testimonials",
        json={"rating": 5, "content": "This made shopping for a home so much clearer."},
        headers=_auth_headers(user),
    )
    assert response.status_code == 201, response.text
    assert response.json()["id"]


def test_create_testimonial_realtor_allowed(realtor) -> None:
    response = client.post(
        "/api/v1/testimonials",
        json={"rating": 4, "content": "Great platform for connecting with ready buyers."},
        headers=_auth_headers(realtor),
    )
    assert response.status_code == 201, response.text


def test_create_testimonial_duplicate_rejected(user) -> None:
    first = client.post(
        "/api/v1/testimonials",
        json={"rating": 5, "content": "First review."},
        headers=_auth_headers(user),
    )
    assert first.status_code == 201

    second = client.post(
        "/api/v1/testimonials",
        json={"rating": 4, "content": "Trying to submit a second one."},
        headers=_auth_headers(user),
    )
    assert second.status_code == 409


def test_create_testimonial_unauthenticated_rejected() -> None:
    response = client.post(
        "/api/v1/testimonials", json={"rating": 5, "content": "Anonymous review"}
    )
    assert response.status_code == 401


@pytest.mark.parametrize("rating", [0, 6, -1])
def test_create_testimonial_invalid_rating_rejected(user, rating: int) -> None:
    response = client.post(
        "/api/v1/testimonials",
        json={"rating": rating, "content": "Rating out of range."},
        headers=_auth_headers(user),
    )
    assert response.status_code == 422


def test_create_testimonial_empty_content_rejected(user) -> None:
    response = client.post(
        "/api/v1/testimonials",
        json={"rating": 5, "content": ""},
        headers=_auth_headers(user),
    )
    assert response.status_code == 422


# --- Featured (public) ------------------------------------------------------


def test_featured_requires_no_authentication(user) -> None:
    client.post(
        "/api/v1/testimonials",
        json={"rating": 5, "content": "No auth needed to read this back."},
        headers=_auth_headers(user),
    )
    response = client.get("/api/v1/testimonials/featured")
    assert response.status_code == 200


def test_featured_excludes_low_ratings(user) -> None:
    client.post(
        "/api/v1/testimonials",
        json={"rating": 2, "content": "Not happy with the experience."},
        headers=_auth_headers(user),
    )
    response = client.get("/api/v1/testimonials/featured")
    assert response.status_code == 200
    contents = [item["content"] for item in response.json()]
    assert "Not happy with the experience." not in contents


def test_featured_includes_high_ratings(user) -> None:
    client.post(
        "/api/v1/testimonials",
        json={"rating": 5, "content": "Exactly what I needed before buying."},
        headers=_auth_headers(user),
    )
    response = client.get("/api/v1/testimonials/featured")
    contents = [item["content"] for item in response.json()]
    assert "Exactly what I needed before buying." in contents


def test_featured_author_name_uses_first_name_and_last_initial(user) -> None:
    client.post(
        "/api/v1/testimonials",
        json={"rating": 5, "content": "Loved the transparency of the scoring."},
        headers=_auth_headers(user),
    )
    response = client.get("/api/v1/testimonials/featured")
    match = next(
        item for item in response.json() if item["content"] == "Loved the transparency of the scoring."
    )
    assert match["author_name"] == "Jordan R."
    assert "@" not in match["author_name"]


def test_featured_labels_realtor_role(realtor) -> None:
    client.post(
        "/api/v1/testimonials",
        json={"rating": 5, "content": "Steady stream of qualified, ready buyers."},
        headers=_auth_headers(realtor),
    )
    response = client.get("/api/v1/testimonials/featured")
    match = next(
        item for item in response.json() if item["content"] == "Steady stream of qualified, ready buyers."
    )
    assert match["author_role"] == "Real Estate Partner"


def test_featured_limited_to_five() -> None:
    accounts = [_register_and_login() for _ in range(6)]
    try:
        for account in accounts:
            client.post(
                "/api/v1/testimonials",
                json={"rating": 5, "content": f"Great experience #{account['id']}"},
                headers=_auth_headers(account),
            )
        response = client.get("/api/v1/testimonials/featured")
        assert response.status_code == 200
        assert len(response.json()) <= 5
    finally:
        for account in accounts:
            _cleanup_user(account["email"])
