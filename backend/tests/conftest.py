"""Configuration pytest — client de test FastAPI."""

import pytest
from fastapi.testclient import TestClient

from backend.dependencies import get_user_id
from backend.main import app

TEST_USER_ID = "test-user-00000000-0000-0000-0000-000000000001"


@pytest.fixture(autouse=True)
def _override_auth():
    """Override get_user_id pour tous les tests (pas de vraie auth JWT)."""
    app.dependency_overrides[get_user_id] = lambda: TEST_USER_ID
    yield
    app.dependency_overrides.pop(get_user_id, None)


@pytest.fixture
def client() -> TestClient:
    """Client HTTP de test FastAPI (synchrone, wrappé httpx)."""
    with TestClient(app) as c:
        yield c
