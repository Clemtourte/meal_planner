"""Tests pour le router /api/sorties."""

import uuid
from unittest.mock import MagicMock

from fastapi.testclient import TestClient

from backend.database import get_supabase
from backend.main import app

_SORTIE_ID = str(uuid.uuid4())
_SORTIE = {
    "id": _SORTIE_ID,
    "date": "2026-03-01",
    "type": "restaurant",
    "titre": "Sushi Express",
    "montant": 32.5,
    "notes": "À deux",
    "user_id": "default_user",
}


def _mock_sorties_select(data: list) -> MagicMock:
    mock = MagicMock()
    result = MagicMock()
    result.data = data
    chain = mock.table.return_value.select.return_value
    chain.eq.return_value = chain
    chain.order.return_value.execute.return_value = result
    return mock


def _mock_sorties_insert(data: list) -> MagicMock:
    mock = MagicMock()
    result = MagicMock()
    result.data = data
    mock.table.return_value.insert.return_value.execute.return_value = result
    return mock


def test_list_sorties(client: TestClient) -> None:
    """GET /api/sorties → 200 avec liste."""
    app.dependency_overrides[get_supabase] = lambda: _mock_sorties_select([_SORTIE])
    try:
        response = client.get("/api/sorties/")
        assert response.status_code == 200
        body = response.json()
        assert isinstance(body, list)
        assert body[0]["titre"] == "Sushi Express"
    finally:
        app.dependency_overrides.clear()


def test_create_sortie(client: TestClient) -> None:
    """POST /api/sorties → 201."""
    app.dependency_overrides[get_supabase] = lambda: _mock_sorties_insert([_SORTIE])
    try:
        response = client.post(
            "/api/sorties/",
            json={
                "date": "2026-03-01",
                "type": "restaurant",
                "titre": "Sushi Express",
                "montant": 32.5,
                "notes": "À deux",
            },
        )
        assert response.status_code == 201
        body = response.json()
        assert body["type"] == "restaurant"
        assert float(body["montant"]) == 32.5
    finally:
        app.dependency_overrides.clear()
