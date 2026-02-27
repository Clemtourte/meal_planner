"""Schémas Pydantic pour la liste de courses."""

from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class LigneCoursesItem(BaseModel):
    """Un article dans la liste de courses."""

    ingredient_id: UUID
    nom: str
    categorie: Optional[str] = None
    quantite_totale: float
    unite: str
    cout_estime: Optional[float] = None
    magasin_moins_cher: Optional[str] = None


class ListeCourses(BaseModel):
    """Liste de courses complète pour une semaine."""

    semaine_debut: str
    semaine_fin: str
    items_par_categorie: dict[str, list[LigneCoursesItem]]
    cout_total_estime: Optional[float] = None
    cout_par_magasin: dict[str, float] = {}
