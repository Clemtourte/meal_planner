"""Schémas Pydantic pour les recettes et leurs ingrédients."""

from uuid import UUID
from typing import Optional
from pydantic import BaseModel


class RecetteIngredientBase(BaseModel):
    """Champs communs d'un ingrédient de recette."""

    ingredient_id: UUID
    quantite: float
    unite: str


class RecetteIngredientCreate(RecetteIngredientBase):
    """Payload d'ajout d'un ingrédient à une recette."""

    pass


class RecetteIngredientResponse(RecetteIngredientBase):
    """Réponse complète d'un ingrédient de recette."""

    id: UUID
    recette_id: UUID
    ingredient_nom: Optional[str] = None

    model_config = {"from_attributes": True}


class RecetteBase(BaseModel):
    """Champs communs d'une recette."""

    nom: str
    nb_portions: int = 4
    description: Optional[str] = None


class RecetteCreate(RecetteBase):
    """Payload de création d'une recette."""

    pass


class RecetteUpdate(BaseModel):
    """Payload de mise à jour partielle d'une recette."""

    nom: Optional[str] = None
    nb_portions: Optional[int] = None
    description: Optional[str] = None


class RecetteResponse(RecetteBase):
    """Réponse d'une recette sans ses ingrédients."""

    id: UUID

    model_config = {"from_attributes": True}


class RecetteDetailResponse(RecetteResponse):
    """Réponse complète d'une recette avec ses ingrédients."""

    ingredients: list[RecetteIngredientResponse] = []
