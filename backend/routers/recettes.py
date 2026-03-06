"""Router FastAPI pour la gestion des recettes."""

import asyncio
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from backend.database import get_supabase
from backend.dependencies import get_user_id
from backend.models.recettes import (
    RecetteCoutIngredient,
    RecetteCoutResponse,
    RecetteCreate,
    RecetteCreateWithIngredients,
    RecetteDetailResponse,
    RecetteIngredientCreate,
    RecetteIngredientResponse,
    RecetteIngredientUpdate,
    RecetteResponse,
    RecetteUpdate,
)
from backend.routers.courses import _to_base

router = APIRouter()


async def _run(fn: Any) -> Any:
    """Exécute un appel Supabase synchrone dans un thread (async-safe)."""
    return await asyncio.to_thread(fn)


async def _get_recette_detail(recette_id: str, db: Client, user_id: str) -> dict:
    """Charge une recette avec ses ingrédients (jointure PostgREST)."""
    result = await _run(
        lambda: (
            db.table("recettes")
            .select("*")
            .eq("id", recette_id)
            .eq("user_id", user_id)
            .execute()
        )
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Recette introuvable")
    recette = result.data[0]

    ri_result = await _run(
        lambda: (
            db.table("recette_ingredients")
            .select("*, ingredients(nom)")
            .eq("recette_id", recette_id)
            .execute()
        )
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


# ---------------------------------------------------------------------------
# Recettes — CRUD
# ---------------------------------------------------------------------------


@router.get("/", response_model=list[RecetteResponse])
async def list_recettes(
    db: Client = Depends(get_supabase),
    user_id: str = Depends(get_user_id),
) -> list[dict]:
    """Retourne toutes les recettes, triées par nom."""
    result = await _run(
        lambda: (
            db.table("recettes")
            .select("*")
            .eq("user_id", user_id)
            .order("nom")
            .execute()
        )
    )
    return result.data


@router.post("/", response_model=RecetteResponse, status_code=201)
async def create_recette(
    recette: RecetteCreate,
    db: Client = Depends(get_supabase),
    user_id: str = Depends(get_user_id),
) -> dict:
    """Crée une nouvelle recette (sans ingrédients)."""
    data = recette.model_dump()
    data["user_id"] = user_id
    result = await _run(lambda: db.table("recettes").insert(data).execute())
    if not result.data:
        raise HTTPException(
            status_code=400, detail="Échec de la création de la recette"
        )
    return result.data[0]


@router.post("/with-ingredients", response_model=RecetteDetailResponse, status_code=201)
async def create_recette_with_ingredients(
    payload: RecetteCreateWithIngredients,
    db: Client = Depends(get_supabase),
    user_id: str = Depends(get_user_id),
) -> dict:
    """
    Crée une recette avec tous ses ingrédients en une seule requête.

    Crée d'abord la recette, puis insère chaque ingrédient associé.
    En cas d'erreur sur les ingrédients, la recette est supprimée (rollback manuel).
    """
    recette_data = {
        "nom": payload.nom,
        "nb_portions": payload.nb_portions,
        "description": payload.description,
        "tags": payload.tags,
        "user_id": user_id,
    }
    result = await _run(lambda: db.table("recettes").insert(recette_data).execute())
    if not result.data:
        raise HTTPException(
            status_code=400, detail="Échec de la création de la recette"
        )
    recette_id = result.data[0]["id"]

    try:
        if payload.ingredients:
            ingredient_ids = [str(ing.ingredient_id) for ing in payload.ingredients]
            ing_check = await _run(
                lambda: (
                    db.table("ingredients")
                    .select("id")
                    .in_("id", ingredient_ids)
                    .eq("user_id", user_id)
                    .execute()
                )
            )
            found_ids = {row["id"] for row in ing_check.data}
            missing = [i for i in ingredient_ids if i not in found_ids]
            if missing:
                raise HTTPException(
                    status_code=400,
                    detail="Certains ingrédients sont introuvables",
                )
        for ing in payload.ingredients:
            ri_data = ing.model_dump()
            ri_data["recette_id"] = recette_id
            ri_data["ingredient_id"] = str(ri_data["ingredient_id"])
            await _run(
                lambda d=ri_data: db.table("recette_ingredients").insert(d).execute()
            )
    except Exception as exc:
        # Rollback manuel : supprimer la recette (cascade supprime les RI)
        await _run(lambda: db.table("recettes").delete().eq("id", recette_id).execute())
        raise HTTPException(
            status_code=400,
            detail=f"Erreur lors de l'ajout des ingrédients : {exc}",
        ) from exc

    return await _get_recette_detail(recette_id, db, user_id)


@router.get("/{recette_id}", response_model=RecetteDetailResponse)
async def get_recette(
    recette_id: UUID,
    db: Client = Depends(get_supabase),
    user_id: str = Depends(get_user_id),
) -> dict:
    """Retourne une recette avec la liste de ses ingrédients."""
    result = await _run(
        lambda: (
            db.table("recettes")
            .select("*")
            .eq("id", str(recette_id))
            .eq("user_id", user_id)
            .execute()
        )
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Recette introuvable")
    return await _get_recette_detail(str(recette_id), db, user_id)


@router.get("/{recette_id}/cout", response_model=RecetteCoutResponse)
async def get_recette_cout(
    recette_id: UUID,
    db: Client = Depends(get_supabase),
    user_id: str = Depends(get_user_id),
) -> dict:
    """
    Calcule le coût estimé d'une recette.

    Pour chaque ingrédient, recherche le prix le moins cher compatible
    (unité normalisée) dans la table prix. Retourne le coût total,
    le coût par portion et le détail par ingrédient.
    """
    recette_result = await _run(
        lambda: (
            db.table("recettes")
            .select("*")
            .eq("id", str(recette_id))
            .eq("user_id", user_id)
            .execute()
        )
    )
    if not recette_result.data:
        raise HTTPException(status_code=404, detail="Recette introuvable")
    recette = recette_result.data[0]
    nb_portions: int = recette["nb_portions"]

    ri_result = await _run(
        lambda: (
            db.table("recette_ingredients")
            .select("*, ingredients(nom)")
            .eq("recette_id", str(recette_id))
            .execute()
        )
    )

    ingredient_ids = [ri["ingredient_id"] for ri in ri_result.data]
    prix_result = await _run(
        lambda: (
            db.table("prix")
            .select("*")
            .in_("ingredient_id", ingredient_ids)
            .eq("user_id", user_id)
            .execute()
        )
    )
    prix_by_ingredient: dict[str, list] = {}
    for p in prix_result.data:
        prix_by_ingredient.setdefault(p["ingredient_id"], []).append(p)

    detail: list[RecetteCoutIngredient] = []
    sans_prix: list[str] = []
    cout_total = 0.0
    has_prix = False

    for ri in ri_result.data:
        ing_nom = (ri.get("ingredients") or {}).get("nom")
        quantite = float(ri["quantite"])
        unite = ri["unite"]
        norm_qty, norm_unite = _to_base(quantite, unite)

        prix_list = prix_by_ingredient.get(ri["ingredient_id"], [])
        compatible = []
        for p in prix_list:
            ref_base, ref_unite = _to_base(
                float(p["quantite_reference"]), p["unite_reference"]
            )
            if ref_unite == norm_unite:
                compatible.append((p, ref_base))

        if not compatible:
            sans_prix.append(ing_nom or ri["ingredient_id"])
            detail.append(
                RecetteCoutIngredient(
                    ingredient_id=ri["ingredient_id"],
                    ingredient_nom=ing_nom,
                    quantite=quantite,
                    unite=unite,
                    cout_estime=None,
                    magasin_moins_cher=None,
                )
            )
            continue

        best_p, best_ref_qty = min(compatible, key=lambda x: float(x[0]["prix"]) / x[1])
        cout_ing = (float(best_p["prix"]) / best_ref_qty) * norm_qty
        cout_total += cout_ing
        has_prix = True
        detail.append(
            RecetteCoutIngredient(
                ingredient_id=ri["ingredient_id"],
                ingredient_nom=ing_nom,
                quantite=quantite,
                unite=unite,
                cout_estime=round(cout_ing, 2),
                magasin_moins_cher=best_p["magasin"],
            )
        )

    total = round(cout_total, 2) if has_prix else None
    par_portion = round(cout_total / nb_portions, 2) if has_prix else None

    return {
        "recette_id": str(recette_id),
        "nb_portions": nb_portions,
        "cout_total": total,
        "cout_par_portion": par_portion,
        "ingredients": detail,
        "ingredients_sans_prix": sans_prix,
    }


@router.patch("/{recette_id}", response_model=RecetteResponse)
async def update_recette(
    recette_id: UUID,
    recette: RecetteUpdate,
    db: Client = Depends(get_supabase),
    user_id: str = Depends(get_user_id),
) -> dict:
    """Met à jour les champs d'une recette."""
    update_data = recette.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="Aucune donnée à mettre à jour")
    result = await _run(
        lambda: (
            db.table("recettes")
            .update(update_data)
            .eq("id", str(recette_id))
            .eq("user_id", user_id)
            .execute()
        )
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Recette introuvable")
    return result.data[0]


@router.delete("/{recette_id}", status_code=204)
async def delete_recette(
    recette_id: UUID,
    db: Client = Depends(get_supabase),
    user_id: str = Depends(get_user_id),
) -> None:
    """Supprime une recette et ses associations d'ingrédients (cascade).

    Retourne 409 si la recette est encore référencée dans le calendrier.
    """
    try:
        await _run(
            lambda: (
                db.table("recettes")
                .delete()
                .eq("id", str(recette_id))
                .eq("user_id", user_id)
                .execute()
            )
        )
    except Exception as exc:
        exc_str = str(exc).lower()
        if "23503" in exc_str or "foreign key" in exc_str or "violates" in exc_str:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Cette recette est planifiée dans le calendrier. "
                    "Retirez-la du calendrier avant de la supprimer."
                ),
            ) from exc
        raise HTTPException(
            status_code=500,
            detail=f"Erreur lors de la suppression : {exc}",
        ) from exc


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
    user_id: str = Depends(get_user_id),
) -> dict:
    """Ajoute un ingrédient (avec quantité et unité) à une recette."""
    recette_result = await _run(
        lambda: (
            db.table("recettes")
            .select("id")
            .eq("id", str(recette_id))
            .eq("user_id", user_id)
            .execute()
        )
    )
    if not recette_result.data:
        raise HTTPException(status_code=404, detail="Recette introuvable")
    ing_result = await _run(
        lambda: (
            db.table("ingredients")
            .select("id")
            .eq("id", str(ri.ingredient_id))
            .eq("user_id", user_id)
            .execute()
        )
    )
    if not ing_result.data:
        raise HTTPException(status_code=404, detail="Ingrédient introuvable")
    data = ri.model_dump()
    data["recette_id"] = str(recette_id)
    data["ingredient_id"] = str(data["ingredient_id"])
    result = await _run(lambda: db.table("recette_ingredients").insert(data).execute())
    if not result.data:
        raise HTTPException(
            status_code=400, detail="Échec de l'ajout de l'ingrédient à la recette"
        )
    return result.data[0]


@router.patch(
    "/{recette_id}/ingredients/{ri_id}",
    response_model=RecetteIngredientResponse,
)
async def update_ingredient_in_recette(
    recette_id: UUID,
    ri_id: UUID,
    ri: RecetteIngredientUpdate,
    db: Client = Depends(get_supabase),
    user_id: str = Depends(get_user_id),
) -> dict:
    """Met à jour la quantité et/ou l'unité d'un ingrédient dans une recette."""
    recette_result = await _run(
        lambda: (
            db.table("recettes")
            .select("id")
            .eq("id", str(recette_id))
            .eq("user_id", user_id)
            .execute()
        )
    )
    if not recette_result.data:
        raise HTTPException(status_code=404, detail="Recette introuvable")
    update_data = ri.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="Aucune donnée à mettre à jour")
    result = await _run(
        lambda: (
            db.table("recette_ingredients")
            .update(update_data)
            .eq("id", str(ri_id))
            .eq("recette_id", str(recette_id))
            .execute()
        )
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Ingrédient de recette introuvable")
    # Enrichir avec le nom de l'ingrédient
    row = result.data[0]
    ing_result = await _run(
        lambda: (
            db.table("ingredients")
            .select("nom")
            .eq("id", row["ingredient_id"])
            .eq("user_id", user_id)
            .execute()
        )
    )
    ing_nom = ing_result.data[0]["nom"] if ing_result.data else None
    return {**row, "ingredient_nom": ing_nom}


@router.delete("/{recette_id}/ingredients/{ri_id}", status_code=204)
async def remove_ingredient_from_recette(
    recette_id: UUID,
    ri_id: UUID,
    db: Client = Depends(get_supabase),
    user_id: str = Depends(get_user_id),
) -> None:
    """Retire un ingrédient d'une recette."""
    recette_result = await _run(
        lambda: (
            db.table("recettes")
            .select("id")
            .eq("id", str(recette_id))
            .eq("user_id", user_id)
            .execute()
        )
    )
    if not recette_result.data:
        raise HTTPException(status_code=404, detail="Recette introuvable")
    await _run(
        lambda: (
            db.table("recette_ingredients")
            .delete()
            .eq("id", str(ri_id))
            .eq("recette_id", str(recette_id))
            .execute()
        )
    )
