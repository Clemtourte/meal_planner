"""Schémas Pydantic pour le calendrier de repas."""

from datetime import date
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class RepasBase(BaseModel):
    """Champs communs d'un repas planifié."""

    date: date
    type_repas: str  # "petit_dejeuner" | "dejeuner" | "diner"
    recette_id: Optional[UUID] = None
    nb_personnes: int = 2


class RepasCreate(RepasBase):
    """Payload de création/mise à jour d'un repas dans le calendrier."""

    pass


class RepasUpdate(BaseModel):
    """Payload de mise à jour partielle d'un repas."""

    recette_id: Optional[UUID] = None
    nb_personnes: Optional[int] = None


class RepasResponse(RepasBase):
    """Réponse complète d'un repas planifié."""

    id: UUID
    recette_nom: Optional[str] = None

    model_config = {"from_attributes": True}
