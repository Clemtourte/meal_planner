"""Router FastAPI pour la gestion des ingrédients et des prix."""

import asyncio
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from backend.database import get_supabase
from backend.models.ingredients import (
    IngredientCreate,
    IngredientResponse,
    IngredientUpdate,
    PrixCreate,
    PrixResponse,
    PrixUpdate,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _run(fn: Any) -> Any:
    """Exécute un appel Supabase synchrone dans un thread (async-safe)."""
    return await asyncio.to_thread(fn)


# ---------------------------------------------------------------------------
# Ingrédients — CRUD
# ---------------------------------------------------------------------------


@router.get("/", response_model=list[IngredientResponse])
async def list_ingredients(db: Client = Depends(get_supabase)) -> list[dict]:
    """Retourne tous les ingrédients triés par nom."""
    result = await _run(
        lambda: db.table("ingredients").select("*").order("nom").execute()
    )
    return result.data


@router.post("/", response_model=IngredientResponse, status_code=201)
async def create_ingredient(
    ingredient: IngredientCreate, db: Client = Depends(get_supabase)
) -> dict:
    """Crée un nouvel ingrédient."""
    result = await _run(
        lambda: db.table("ingredients").insert(ingredient.model_dump()).execute()
    )
    if not result.data:
        raise HTTPException(
            status_code=400, detail="Échec de la création de l'ingrédient"
        )
    return result.data[0]


@router.get("/{ingredient_id}", response_model=IngredientResponse)
async def get_ingredient(
    ingredient_id: UUID, db: Client = Depends(get_supabase)
) -> dict:
    """Retourne un ingrédient par son identifiant."""
    result = await _run(
        lambda: (
            db.table("ingredients").select("*").eq("id", str(ingredient_id)).execute()
        )
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Ingrédient introuvable")
    return result.data[0]


@router.patch("/{ingredient_id}", response_model=IngredientResponse)
async def update_ingredient(
    ingredient_id: UUID,
    ingredient: IngredientUpdate,
    db: Client = Depends(get_supabase),
) -> dict:
    """Met à jour les champs d'un ingrédient."""
    update_data = ingredient.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="Aucune donnée à mettre à jour")
    result = await _run(
        lambda: (
            db.table("ingredients")
            .update(update_data)
            .eq("id", str(ingredient_id))
            .execute()
        )
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Ingrédient introuvable")
    return result.data[0]


@router.delete("/{ingredient_id}", status_code=204)
async def delete_ingredient(
    ingredient_id: UUID, db: Client = Depends(get_supabase)
) -> None:
    """Supprime un ingrédient et ses prix associés (cascade).

    Retourne 409 si l'ingrédient est encore référencé dans une recette.
    """
    try:
        await _run(
            lambda: (
                db.table("ingredients").delete().eq("id", str(ingredient_id)).execute()
            )
        )
    except Exception as exc:
        exc_str = str(exc).lower()
        if "23503" in exc_str or "foreign key" in exc_str or "violates" in exc_str:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Cet ingrédient est utilisé dans une ou plusieurs recettes. "
                    "Retirez-le des recettes avant de le supprimer."
                ),
            ) from exc
        raise HTTPException(
            status_code=500,
            detail=f"Erreur lors de la suppression : {exc}",
        ) from exc


# ---------------------------------------------------------------------------
# Prix — gestion multi-magasins
# ---------------------------------------------------------------------------


@router.get("/{ingredient_id}/prix", response_model=list[PrixResponse])
async def list_prix(
    ingredient_id: UUID, db: Client = Depends(get_supabase)
) -> list[dict]:
    """Retourne tous les prix d'un ingrédient, triés par magasin."""
    result = await _run(
        lambda: (
            db.table("prix")
            .select("*")
            .eq("ingredient_id", str(ingredient_id))
            .order("magasin")
            .execute()
        )
    )
    return result.data


@router.post("/{ingredient_id}/prix", response_model=PrixResponse, status_code=201)
async def add_prix(
    ingredient_id: UUID, prix: PrixCreate, db: Client = Depends(get_supabase)
) -> dict:
    """Ajoute un prix pour un ingrédient dans un magasin."""
    data = prix.model_dump()
    data["ingredient_id"] = str(ingredient_id)
    result = await _run(lambda: db.table("prix").insert(data).execute())
    if not result.data:
        raise HTTPException(status_code=400, detail="Échec de l'ajout du prix")
    return result.data[0]


@router.patch("/{ingredient_id}/prix/{prix_id}", response_model=PrixResponse)
async def update_prix(
    ingredient_id: UUID,
    prix_id: UUID,
    prix: PrixUpdate,
    db: Client = Depends(get_supabase),
) -> dict:
    """Met à jour les champs d'un prix."""
    update_data = prix.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="Aucune donnée à mettre à jour")
    result = await _run(
        lambda: (
            db.table("prix")
            .update(update_data)
            .eq("id", str(prix_id))
            .eq("ingredient_id", str(ingredient_id))
            .execute()
        )
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Prix introuvable")
    return result.data[0]


@router.delete("/{ingredient_id}/prix/{prix_id}", status_code=204)
async def delete_prix(
    ingredient_id: UUID, prix_id: UUID, db: Client = Depends(get_supabase)
) -> None:
    """Supprime un prix."""
    await _run(
        lambda: (
            db.table("prix")
            .delete()
            .eq("id", str(prix_id))
            .eq("ingredient_id", str(ingredient_id))
            .execute()
        )
    )
