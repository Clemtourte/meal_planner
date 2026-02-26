"""Router FastAPI pour la gestion des recettes."""

import asyncio
from uuid import UUID
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from backend.database import get_supabase
from backend.models.recettes import (
    RecetteCreate,
    RecetteUpdate,
    RecetteResponse,
    RecetteDetailResponse,
    RecetteIngredientCreate,
    RecetteIngredientResponse,
)

router = APIRouter()


async def _run(fn: Any) -> Any:
    """Exécute un appel Supabase synchrone dans un thread (async-safe)."""
    return await asyncio.to_thread(fn)


# ---------------------------------------------------------------------------
# Recettes — CRUD
# ---------------------------------------------------------------------------

@router.get("/", response_model=list[RecetteResponse])
async def list_recettes(db: Client = Depends(get_supabase)) -> list[dict]:
    """Retourne toutes les recettes triées par nom."""
    result = await _run(lambda: db.table("recettes").select("*").order("nom").execute())
    return result.data


@router.post("/", response_model=RecetteResponse, status_code=201)
async def create_recette(
    recette: RecetteCreate, db: Client = Depends(get_supabase)
) -> dict:
    """Crée une nouvelle recette."""
    result = await _run(
        lambda: db.table("recettes").insert(recette.model_dump()).execute()
    )
    if not result.data:
        raise HTTPException(status_code=400, detail="Échec de la création de la recette")
    return result.data[0]


@router.get("/{recette_id}", response_model=RecetteDetailResponse)
async def get_recette(recette_id: UUID, db: Client = Depends(get_supabase)) -> dict:
    """Retourne une recette avec la liste de ses ingrédients."""
    result = await _run(
        lambda: db.table("recettes").select("*").eq("id", str(recette_id)).execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Recette introuvable")
    recette = result.data[0]

    ri_result = await _run(
        lambda: db.table("recette_ingredients")
        .select("*, ingredients(nom)")
        .eq("recette_id", str(recette_id))
        .execute()
    )

    ingredients = []
    for ri in ri_result.data:
        ing_info = ri.get("ingredients") or {}
        ingredients.append(
            {
                "id": ri["id"],
                "recette_id": ri["recette_id"],
                "ingredient_id": ri["ingredient_id"],
                "quantite": ri["quantite"],
                "unite": ri["unite"],
                "ingredient_nom": ing_info.get("nom"),
            }
        )

    return {**recette, "ingredients": ingredients}


@router.patch("/{recette_id}", response_model=RecetteResponse)
async def update_recette(
    recette_id: UUID,
    recette: RecetteUpdate,
    db: Client = Depends(get_supabase),
) -> dict:
    """Met à jour les champs d'une recette."""
    update_data = recette.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="Aucune donnée à mettre à jour")
    result = await _run(
        lambda: db.table("recettes")
        .update(update_data)
        .eq("id", str(recette_id))
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Recette introuvable")
    return result.data[0]


@router.delete("/{recette_id}", status_code=204)
async def delete_recette(
    recette_id: UUID, db: Client = Depends(get_supabase)
) -> None:
    """Supprime une recette et ses associations d'ingrédients (cascade)."""
    await _run(
        lambda: db.table("recettes").delete().eq("id", str(recette_id)).execute()
    )


# ---------------------------------------------------------------------------
# Ingrédients d'une recette
# ---------------------------------------------------------------------------

@router.post(
    "/{recette_id}/ingredients",
    response_model=RecetteIngredientResponse,
    status_code=201,
)
async def add_ingredient_to_recette(
    recette_id: UUID,
    ri: RecetteIngredientCreate,
    db: Client = Depends(get_supabase),
) -> dict:
    """Ajoute un ingrédient (avec quantité et unité) à une recette."""
    data = ri.model_dump()
    data["recette_id"] = str(recette_id)
    data["ingredient_id"] = str(data["ingredient_id"])
    result = await _run(lambda: db.table("recette_ingredients").insert(data).execute())
    if not result.data:
        raise HTTPException(
            status_code=400, detail="Échec de l'ajout de l'ingrédient à la recette"
        )
    return result.data[0]


@router.delete("/{recette_id}/ingredients/{ri_id}", status_code=204)
async def remove_ingredient_from_recette(
    recette_id: UUID, ri_id: UUID, db: Client = Depends(get_supabase)
) -> None:
    """Retire un ingrédient d'une recette."""
    await _run(
        lambda: db.table("recette_ingredients")
        .delete()
        .eq("id", str(ri_id))
        .eq("recette_id", str(recette_id))
        .execute()
    )
