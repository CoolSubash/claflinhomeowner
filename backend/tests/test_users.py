import os

import pytest
from fastapi.testclient import TestClient

from app.main import app

pytestmark = pytest.mark.skipif(
    not os.getenv("DATABASE_URL"),
    reason="DATABASE_URL not set; requires a running PostgreSQL instance",
)

client = TestClient(app)


def test_user_count_endpoint() -> None:
    response = client.get("/api/v1/users/count")
    assert response.status_code == 200
    body = response.json()
    assert isinstance(body["count"], int)
    assert body["count"] >= 0
