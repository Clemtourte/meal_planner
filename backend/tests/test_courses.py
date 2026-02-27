"""Tests pour la logique d'agrégation de la liste de courses."""

import pytest

from backend.routers.courses import _to_base


def test_aggregation_same_unit() -> None:
    """0.5 kg + 200 g du même ingrédient doit totaliser 700 g."""
    q1, u1 = _to_base(0.5, "kg")  # → 500 g
    q2, u2 = _to_base(200, "g")  # → 200 g (inchangé)
    assert u1 == "g"
    assert u2 == "g"
    assert q1 + q2 == pytest.approx(700.0)


def test_aggregation_portion_ratio() -> None:
    """Recette 4 portions planifiée pour 2 personnes → ratio 0.5 → quantité divisée par 2."""
    quantite_recette = 400.0
    nb_personnes = 2
    nb_portions = 4
    ratio = nb_personnes / nb_portions
    quantite_ajustee = quantite_recette * ratio
    assert ratio == pytest.approx(0.5)
    assert quantite_ajustee == pytest.approx(200.0)
