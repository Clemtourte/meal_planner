"""Schémas Pydantic pour les recettes et leurs ingrédients."""

from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class RecetteIngredientBase(BaseModel):
    """Champs communs d'un ingrédient de recette."""

    ingredient_id: UUID
    quantite: float
    unite: str


class RecetteIngredientCreate(RecetteIngredientBase):
    """Payload d'ajout d'un ingrédient à une recette."""

    pass


class RecetteIngredientUpdate(BaseModel):
    """Payload de mise à jour partielle d'un ingrédient de recette."""

    quantite: Optional[float] = None
    unite: Optional[str] = None


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
    tags: list[str] = []
    temps_preparation: Optional[int] = None
    temps_cuisson: Optional[int] = None
    difficulte: Optional[str] = None
    instructions: list[str] = []


class RecetteCreate(RecetteBase):
    """Payload de création d'une recette."""

    pass


class RecetteCreateWithIngredients(BaseModel):
    """Création d'une recette avec tous ses ingrédients en une requête."""

    nom: str
    nb_portions: int = 4
    description: Optional[str] = None
    tags: list[str] = []
    temps_preparation: Optional[int] = None
    temps_cuisson: Optional[int] = None
    difficulte: Optional[str] = None
    instructions: list[str] = []
    ingredients: list[RecetteIngredientCreate] = []


class RecetteUpdate(BaseModel):
    """Payload de mise à jour partielle d'une recette."""

    nom: Optional[str] = None
    nb_portions: Optional[int] = None
    description: Optional[str] = None
    tags: Optional[list[str]] = None
    temps_preparation: Optional[int] = None
    temps_cuisson: Optional[int] = None
    difficulte: Optional[str] = None
    instructions: Optional[list[str]] = None


class RecetteResponse(RecetteBase):
    """Réponse d'une recette sans ses ingrédients."""

    id: UUID

    model_config = {"from_attributes": True}


class RecetteDetailResponse(RecetteResponse):
    """Réponse complète d'une recette avec ses ingrédients."""

    ingredients: list[RecetteIngredientResponse] = []


class RecetteCoutIngredient(BaseModel):
    """Coût estimé d'un ingrédient dans une recette."""

    ingredient_id: str
    ingredient_nom: Optional[str]
    quantite: float
    unite: str
    cout_estime: Optional[float]
    magasin_moins_cher: Optional[str]


class RecetteCoutResponse(BaseModel):
    """Réponse du calcul du coût estimé d'une recette."""

    recette_id: str
    nb_portions: int
    cout_total: Optional[float]
    cout_par_portion: Optional[float]
    ingredients: list[RecetteCoutIngredient]
    ingredients_sans_prix: list[str]
