"""Schémas Pydantic pour les ingrédients et les prix."""

from uuid import UUID
from typing import Optional
from pydantic import BaseModel


class IngredientBase(BaseModel):
    """Champs communs d'un ingrédient."""

    nom: str
    unite_defaut: str
    categorie: Optional[str] = None


class IngredientCreate(IngredientBase):
    """Payload de création d'un ingrédient."""

    pass


class IngredientUpdate(BaseModel):
    """Payload de mise à jour partielle d'un ingrédient."""

    nom: Optional[str] = None
    unite_defaut: Optional[str] = None
    categorie: Optional[str] = None


class IngredientResponse(IngredientBase):
    """Réponse complète d'un ingrédient."""

    id: UUID

    model_config = {"from_attributes": True}


class PrixBase(BaseModel):
    """Champs communs d'un prix par magasin."""

    magasin: str
    prix: float
    quantite_reference: float
    unite_reference: str


class PrixCreate(PrixBase):
    """Payload de création d'un prix."""

    pass


class PrixResponse(PrixBase):
    """Réponse complète d'un prix."""

    id: UUID
    ingredient_id: UUID

    model_config = {"from_attributes": True}
