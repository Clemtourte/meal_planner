"""Tests pour le router /api/recettes — notamment POST /with-ingredients."""

import uuid
from unittest.mock import MagicMock

from fastapi.testclient import TestClient

from backend.database import get_supabase
from backend.main import app

_REC_ID = str(uuid.uuid4())
_ING_ID = str(uuid.uuid4())

_RECETTE = {
    "id": _REC_ID,
    "nom": "Quiche Lorraine",
    "nb_portions": 4,
    "description": "Un classique",
    "tags": ["végétarien"],
    "user_id": "default_user",
}


def _mock_recettes_db() -> MagicMock:
    """Mock Supabase pour les routes recettes.

    Différencie les appels aux tables 'recettes' et 'recette_ingredients'.
    """
    mock = MagicMock()

    recette_result = MagicMock()
    recette_result.data = [_RECETTE]

    ri_result = MagicMock()
    ri_result.data = []

    def table_fn(table_name: str) -> MagicMock:
        tbl = MagicMock()
        if table_name == "recettes":
            tbl.insert.return_value.execute.return_value = recette_result
            tbl.select.return_value.eq.return_value.execute.return_value = (
                recette_result
            )
            (
                tbl.select.return_value.eq.return_value.order.return_value
                .execute.return_value
            ) = recette_result
        elif table_name == "recette_ingredients":
            tbl.select.return_value.eq.return_value.execute.return_value = ri_result
            tbl.insert.return_value.execute.return_value = MagicMock(data=[])
        return tbl

    mock.table.side_effect = table_fn
    return mock


def test_post_recettes_with_ingredients_not_405(client: TestClient) -> None:
    """POST /api/recettes/with-ingredients → 201 (jamais 405).

    Ce test vérifie que la route est bien déclarée et accessible,
    et que redirect_slashes=False ne bloque pas l'endpoint.
    """
    app.dependency_overrides[get_supabase] = lambda: _mock_recettes_db()
    try:
        response = client.post(
            "/api/recettes/with-ingredients",
            json={
                "nom": "Quiche Lorraine",
                "nb_portions": 4,
                "description": "Un classique",
                "tags": ["végétarien"],
                "ingredients": [],
            },
        )
        assert response.status_code != 405, (
            "La route POST /api/recettes/with-ingredients retourne 405 — "
            "vérifier l'ordre des routes dans le router."
        )
        assert response.status_code == 201
        body = response.json()
        assert body["nom"] == "Quiche Lorraine"
        assert body["nb_portions"] == 4
    finally:
        app.dependency_overrides.clear()


def test_post_recettes_simple_not_405(client: TestClient) -> None:
    """POST /api/recettes → 201 (route simple de création sans ingrédients)."""
    mock = MagicMock()
    recette_result = MagicMock()
    recette_result.data = [_RECETTE]
    mock.table.return_value.insert.return_value.execute.return_value = recette_result

    app.dependency_overrides[get_supabase] = lambda: mock
    try:
        response = client.post(
            "/api/recettes/",
            json={
                "nom": "Quiche Lorraine",
                "nb_portions": 4,
            },
        )
        assert response.status_code != 405, "La route POST /api/recettes retourne 405."
        assert response.status_code == 201
    finally:
        app.dependency_overrides.clear()
