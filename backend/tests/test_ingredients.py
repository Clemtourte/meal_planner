"""Tests pour le router /api/ingredients."""

import uuid
from unittest.mock import MagicMock

from fastapi.testclient import TestClient

from backend.database import get_supabase
from backend.main import app

_ING_ID = str(uuid.uuid4())
_ING = {
    "id": _ING_ID,
    "nom": "Poulet",
    "unite_defaut": "g",
    "categorie": "Viandes",
}


def _mock_insert(data: list) -> MagicMock:
    """Mock Supabase : table().insert().execute() → data."""
    mock = MagicMock()
    result = MagicMock()
    result.data = data
    mock.table.return_value.insert.return_value.execute.return_value = result
    return mock


def _mock_select_order(data: list) -> MagicMock:
    """Mock Supabase : table().select().order().execute() → data."""
    mock = MagicMock()
    result = MagicMock()
    result.data = data
    chain = mock.table.return_value.select.return_value
    chain.eq.return_value = chain
    chain.order.return_value.execute.return_value = result
    return mock


def test_create_ingredient(client: TestClient) -> None:
    """POST /api/ingredients → 201 avec les données de l'ingrédient créé."""
    app.dependency_overrides[get_supabase] = lambda: _mock_insert([_ING])
    try:
        response = client.post(
            "/api/ingredients/",
            json={"nom": "Poulet", "unite_defaut": "g", "categorie": "Viandes"},
        )
        assert response.status_code == 201
        body = response.json()
        assert body["nom"] == "Poulet"
        assert body["unite_defaut"] == "g"
    finally:
        app.dependency_overrides.clear()


def test_list_ingredients(client: TestClient) -> None:
    """GET /api/ingredients → 200 avec une liste d'ingrédients."""
    app.dependency_overrides[get_supabase] = lambda: _mock_select_order([_ING])
    try:
        response = client.get("/api/ingredients/")
        assert response.status_code == 200
        body = response.json()
        assert isinstance(body, list)
        assert len(body) == 1
        assert body[0]["nom"] == "Poulet"
    finally:
        app.dependency_overrides.clear()


def test_create_ingredient_missing_field(client: TestClient) -> None:
    """POST sans 'unite_defaut' → 422 Unprocessable Entity (validation Pydantic)."""
    response = client.post("/api/ingredients/", json={"nom": "Farine"})
    assert response.status_code == 422
