"""Tests pour le router /api/budgets."""

import uuid
from unittest.mock import MagicMock

from fastapi.testclient import TestClient

from backend.database import get_supabase
from backend.main import app

_BUDGET_ID = str(uuid.uuid4())
_BUDGET_HEBDO = {
    "id": _BUDGET_ID,
    "type": "hebdomadaire",
    "montant": 150.0,
    "date_debut": "2026-02-23",
    "user_id": "default_user",
}

_HISTORIQUE_ID = str(uuid.uuid4())
_HISTORIQUE_ROW = {
    "id": _HISTORIQUE_ID,
    "semaine_debut": "2026-02-23",
    "montant_estime": 87.50,
    "magasin_choisi": "Carrefour",
    "user_id": "default_user",
}


def _mock_budget_insert(data: list) -> MagicMock:
    """Mock pour table().insert().execute()."""
    mock = MagicMock()
    result = MagicMock()
    result.data = data
    mock.table.return_value.insert.return_value.execute.return_value = result
    return mock


def _mock_budget_upsert(data: list) -> MagicMock:
    """Mock pour table().upsert().execute()."""
    mock = MagicMock()
    result = MagicMock()
    result.data = data
    mock.table.return_value.upsert.return_value.execute.return_value = result
    return mock


def _mock_budget_select(data: list) -> MagicMock:
    """Mock pour table().select().eq().order().execute()."""
    mock = MagicMock()
    result = MagicMock()
    result.data = data
    chain = mock.table.return_value.select.return_value
    chain.eq.return_value.order.return_value.execute.return_value = result
    return mock


def test_create_budget_hebdomadaire(client: TestClient) -> None:
    """POST /api/budgets/ → 201 avec le budget créé."""
    app.dependency_overrides[get_supabase] = lambda: _mock_budget_insert(
        [_BUDGET_HEBDO]
    )
    try:
        response = client.post(
            "/api/budgets/",
            json={"type": "hebdomadaire", "montant": 150.0, "date_debut": "2026-02-23"},
        )
        assert response.status_code == 201
        body = response.json()
        assert body["type"] == "hebdomadaire"
        assert float(body["montant"]) == 150.0
    finally:
        app.dependency_overrides.clear()


def test_update_budget(client: TestClient) -> None:
    """PATCH /api/budgets/{id} → 200 avec le budget mis à jour."""
    updated = {**_BUDGET_HEBDO, "montant": 200.0}
    mock = MagicMock()
    result = MagicMock()
    result.data = [updated]
    (
        mock.table.return_value.update.return_value.eq.return_value.eq.return_value.execute.return_value
    ) = result
    app.dependency_overrides[get_supabase] = lambda: mock
    try:
        response = client.patch(
            f"/api/budgets/{_BUDGET_ID}",
            json={"montant": 200.0},
        )
        assert response.status_code == 200
        body = response.json()
        assert float(body["montant"]) == 200.0
    finally:
        app.dependency_overrides.clear()


def test_create_budget_validation(client: TestClient) -> None:
    """POST /api/budgets/ avec un type invalide → 422."""
    response = client.post(
        "/api/budgets/",
        json={"type": "annuel", "montant": 500.0, "date_debut": "2026-02-23"},
    )
    assert response.status_code == 422


def test_get_budget_actuel(client: TestClient) -> None:
    """GET /api/budgets/actuel → 200 avec la liste des budgets."""
    app.dependency_overrides[get_supabase] = lambda: _mock_budget_select(
        [_BUDGET_HEBDO]
    )
    try:
        response = client.get("/api/budgets/actuel")
        assert response.status_code == 200
        body = response.json()
        assert isinstance(body, list)
        assert body[0]["type"] == "hebdomadaire"
    finally:
        app.dependency_overrides.clear()


def test_add_historique(client: TestClient) -> None:
    """POST /api/budgets/historique → 201, upsert par semaine."""
    app.dependency_overrides[get_supabase] = lambda: _mock_budget_upsert(
        [_HISTORIQUE_ROW]
    )
    try:
        response = client.post(
            "/api/budgets/historique",
            json={
                "semaine_debut": "2026-02-23",
                "montant_estime": 87.50,
                "magasin_choisi": "Carrefour",
            },
        )
        assert response.status_code == 201
        body = response.json()
        assert float(body["montant_estime"]) == 87.50
        assert body["magasin_choisi"] == "Carrefour"
    finally:
        app.dependency_overrides.clear()


def test_delete_historique(client: TestClient) -> None:
    """DELETE /api/budgets/historique/{id} → 204."""
    mock = MagicMock()
    result = MagicMock()
    result.data = []
    (
        mock.table.return_value.delete.return_value.eq.return_value.eq.return_value.execute.return_value
    ) = result
    app.dependency_overrides[get_supabase] = lambda: mock
    try:
        response = client.delete(f"/api/budgets/historique/{_HISTORIQUE_ID}")
        assert response.status_code == 204
    finally:
        app.dependency_overrides.clear()


def test_get_historique(client: TestClient) -> None:
    """GET /api/budgets/historique → 200 avec la liste des dépenses."""
    app.dependency_overrides[get_supabase] = lambda: _mock_budget_select(
        [_HISTORIQUE_ROW]
    )
    try:
        response = client.get("/api/budgets/historique")
        assert response.status_code == 200
        body = response.json()
        assert isinstance(body, list)
        assert body[0]["semaine_debut"] == "2026-02-23"
    finally:
        app.dependency_overrides.clear()
