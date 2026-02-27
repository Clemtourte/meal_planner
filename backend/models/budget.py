"""Schémas Pydantic pour la gestion du budget alimentaire."""

from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel


class BudgetCreate(BaseModel):
    """Payload pour créer ou remplacer un budget."""

    type: Literal["hebdomadaire", "mensuel"]
    montant: float
    date_debut: date


class Budget(BaseModel):
    """Représentation complète d'un budget enregistré."""

    id: str
    type: str
    montant: float
    date_debut: date


class DepenseHistoriqueCreate(BaseModel):
    """Payload pour enregistrer la dépense estimée d'une semaine."""

    semaine_debut: date
    montant_estime: float
    magasin_choisi: Optional[str] = None


class DepenseHistorique(BaseModel):
    """Représentation complète d'une dépense historique."""

    id: str
    semaine_debut: date
    montant_estime: float
    magasin_choisi: Optional[str] = None
