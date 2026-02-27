"""Configuration pytest — client de test FastAPI."""

import pytest
from fastapi.testclient import TestClient

from backend.main import app


@pytest.fixture
def client() -> TestClient:
    """Client HTTP de test FastAPI (synchrone, wrappé httpx)."""
    with TestClient(app) as c:
        yield c
