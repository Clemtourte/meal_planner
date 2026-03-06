"""Router FastAPI pour la gestion du calendrier de repas."""

import asyncio
from datetime import date, timedelta
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from backend.database import get_supabase
from backend.dependencies import get_user_id
from backend.models.calendrier import RepasCreate, RepasResponse, RepasUpdate

router = APIRouter()


async def _run(fn: Any) -> Any:
    """Exécute un appel Supabase synchrone dans un thread (async-safe)."""
    return await asyncio.to_thread(fn)


@router.get("/semaine", response_model=list[RepasResponse])
async def get_semaine(
    debut: date,
    db: Client = Depends(get_supabase),
    user_id: str = Depends(get_user_id),
) -> list[dict]:
    """Retourne tous les repas planifiés pour la semaine commençant à 'debut'."""
    fin = debut + timedelta(days=6)
    result = await _run(
        lambda: (
            db.table("semaine_repas")
            .select("*, recettes(nom)")
            .gte("date", str(debut))
            .lte("date", str(fin))
            .eq("user_id", user_id)
            .order("date")
            .execute()
        )
    )
    repas_list = []
    for repas in result.data:
        recette_info = repas.get("recettes") or {}
        repas_list.append(
            {
                "id": repas["id"],
                "date": repas["date"],
                "type_repas": repas["type_repas"],
                "recette_id": repas["recette_id"],
                "nb_personnes": repas["nb_personnes"],
                "recette_nom": recette_info.get("nom"),
            }
        )
    return repas_list


@router.post("/", response_model=RepasResponse, status_code=201)
async def create_or_update_repas(
    repas: RepasCreate,
    db: Client = Depends(get_supabase),
    user_id: str = Depends(get_user_id),
) -> dict:
    """Crée ou remplace un repas dans le calendrier.

    Contrainte unique : date + type_repas + user_id.
    """
    data: dict = repas.model_dump()
    data["date"] = str(data["date"])
    data["user_id"] = user_id
    if data.get("recette_id"):
        data["recette_id"] = str(data["recette_id"])

    result = await _run(
        lambda: (
            db.table("semaine_repas")
            .upsert(data, on_conflict="date,type_repas,user_id")
            .execute()
        )
    )
    if not result.data:
        raise HTTPException(
            status_code=400, detail="Échec de la planification du repas"
        )
    return result.data[0]


@router.patch("/{repas_id}", response_model=RepasResponse)
async def update_repas(
    repas_id: UUID,
    repas: RepasUpdate,
    db: Client = Depends(get_supabase),
    user_id: str = Depends(get_user_id),
) -> dict:
    """Met à jour un repas planifié (recette, nombre de personnes)."""
    update_data = repas.model_dump(exclude_none=True)
    if "recette_id" in update_data and update_data["recette_id"] is not None:
        update_data["recette_id"] = str(update_data["recette_id"])
    result = await _run(
        lambda: (
            db.table("semaine_repas")
            .update(update_data)
            .eq("id", str(repas_id))
            .eq("user_id", user_id)
            .execute()
        )
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Repas introuvable")
    return result.data[0]


@router.delete("/{repas_id}", status_code=204)
async def delete_repas(
    repas_id: UUID,
    db: Client = Depends(get_supabase),
    user_id: str = Depends(get_user_id),
) -> None:
    """Supprime un repas du calendrier."""
    await _run(
        lambda: (
            db.table("semaine_repas")
            .delete()
            .eq("id", str(repas_id))
            .eq("user_id", user_id)
            .execute()
        )
    )
