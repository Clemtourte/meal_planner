"""Schémas Pydantic pour les sorties resto et commandes."""

from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel


class SortieBase(BaseModel):
    """Champs communs d'une sortie resto / commande."""

    date: date
    type: Literal["restaurant", "commande"]
    titre: str
    montant: float
    notes: Optional[str] = None


class SortieCreate(SortieBase):
    """Payload de création d'une sortie."""

    pass


class SortieUpdate(BaseModel):
    """Payload de mise à jour partielle d'une sortie."""

    date: Optional[date] = None
    type: Optional[Literal["restaurant", "commande"]] = None
    titre: Optional[str] = None
    montant: Optional[float] = None
    notes: Optional[str] = None


class SortieResponse(SortieBase):
    """Réponse complète d'une sortie."""

    id: str

    model_config = {"from_attributes": True}
