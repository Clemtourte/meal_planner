"""Router FastAPI pour les sorties resto et commandes."""

import asyncio
from datetime import date
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from backend.database import get_supabase
from backend.dependencies import get_user_id
from backend.models.sorties import SortieCreate, SortieResponse, SortieUpdate

router = APIRouter()


async def _run(fn: Any) -> Any:
    """Exécute un appel Supabase synchrone dans un thread (async-safe)."""
    return await asyncio.to_thread(fn)


@router.get("/", response_model=list[SortieResponse])
async def list_sorties(
    debut: date | None = None,
    fin: date | None = None,
    db: Client = Depends(get_supabase),
    user_id: str = Depends(get_user_id),
) -> list[dict]:
    """Retourne toutes les sorties, triées par date (desc)."""
    query = db.table("sorties").select("*").eq("user_id", user_id)
    if debut is not None:
        query = query.gte("date", str(debut))
    if fin is not None:
        query = query.lte("date", str(fin))
    result = await _run(lambda: query.order("date", desc=True).execute())
    return result.data


@router.post("/", response_model=SortieResponse, status_code=201)
async def create_sortie(
    payload: SortieCreate,
    db: Client = Depends(get_supabase),
    user_id: str = Depends(get_user_id),
) -> dict:
    """Crée une sortie resto ou commande."""
    data = payload.model_dump()
    data["date"] = str(payload.date)
    data["user_id"] = user_id
    result = await _run(lambda: db.table("sorties").insert(data).execute())
    if not result.data:
        raise HTTPException(status_code=400, detail="Échec de la création")
    return result.data[0]


@router.patch("/{sortie_id}", response_model=SortieResponse)
async def update_sortie(
    sortie_id: UUID,
    payload: SortieUpdate,
    db: Client = Depends(get_supabase),
    user_id: str = Depends(get_user_id),
) -> dict:
    """Met à jour une sortie."""
    update_data = payload.model_dump(exclude_none=True)
    if "date" in update_data:
        update_data["date"] = str(update_data["date"])
    if not update_data:
        raise HTTPException(status_code=400, detail="Aucune donnée à mettre à jour")
    result = await _run(
        lambda: (
            db.table("sorties")
            .update(update_data)
            .eq("id", str(sortie_id))
            .eq("user_id", user_id)
            .execute()
        )
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Sortie introuvable")
    return result.data[0]


@router.delete("/{sortie_id}", status_code=204)
async def delete_sortie(
    sortie_id: UUID,
    db: Client = Depends(get_supabase),
    user_id: str = Depends(get_user_id),
) -> None:
    """Supprime une sortie."""
    await _run(
        lambda: (
            db.table("sorties")
            .delete()
            .eq("id", str(sortie_id))
            .eq("user_id", user_id)
            .execute()
        )
    )
