"""Router FastAPI pour la gestion du budget alimentaire."""

import asyncio
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from backend.database import get_supabase
from backend.dependencies import get_user_id
from backend.models.budget import (
    Budget,
    BudgetCreate,
    DepenseHistorique,
    DepenseHistoriqueCreate,
)

router = APIRouter()


async def _run(fn: Any) -> Any:
    """Exécute un appel Supabase synchrone dans un thread (async-safe)."""
    return await asyncio.to_thread(fn)


# ---------------------------------------------------------------------------
# Budget hebdomadaire / mensuel
# ---------------------------------------------------------------------------


@router.post("/", response_model=Budget, status_code=201)
async def create_budget(
    payload: BudgetCreate,
    db: Client = Depends(get_supabase),
    user_id: str = Depends(get_user_id),
) -> dict:
    """Crée un budget (hebdomadaire ou mensuel) pour une date de début donnée."""
    data = {
        "type": payload.type,
        "montant": payload.montant,
        "date_debut": str(payload.date_debut),
        "user_id": user_id,
    }
    result = await _run(lambda: db.table("budgets").insert(data).execute())
    if not result.data:
        raise HTTPException(status_code=400, detail="Échec de la création du budget")
    return result.data[0]


@router.get("/actuel", response_model=list[Budget])
async def get_budget_actuel(
    db: Client = Depends(get_supabase),
    user_id: str = Depends(get_user_id),
) -> list[dict]:
    """Retourne les budgets les plus récents (hebdomadaire et mensuel)."""
    result = await _run(
        lambda: (
            db.table("budgets")
            .select("*")
            .eq("user_id", user_id)
            .order("date_debut", desc=True)
            .execute()
        )
    )
    # Renvoie le budget le plus récent de chaque type
    seen: set[str] = set()
    budgets = []
    for row in result.data:
        if row["type"] not in seen:
            seen.add(row["type"])
            budgets.append(row)
    return budgets


# ---------------------------------------------------------------------------
# Historique des dépenses
# ---------------------------------------------------------------------------


@router.get("/historique", response_model=list[DepenseHistorique])
async def get_historique(
    db: Client = Depends(get_supabase),
    user_id: str = Depends(get_user_id),
) -> list[dict]:
    """Retourne l'historique des dépenses estimées, du plus récent au plus ancien."""
    result = await _run(
        lambda: (
            db.table("historique_depenses")
            .select("*")
            .eq("user_id", user_id)
            .order("semaine_debut", desc=True)
            .execute()
        )
    )
    return result.data


@router.post("/historique", response_model=DepenseHistorique, status_code=201)
async def add_historique(
    payload: DepenseHistoriqueCreate,
    db: Client = Depends(get_supabase),
    user_id: str = Depends(get_user_id),
) -> dict:
    """Enregistre la dépense estimée d'une semaine dans l'historique."""
    data = {
        "semaine_debut": str(payload.semaine_debut),
        "montant_estime": payload.montant_estime,
        "magasin_choisi": payload.magasin_choisi,
        "user_id": user_id,
    }
    result = await _run(lambda: db.table("historique_depenses").insert(data).execute())
    if not result.data:
        raise HTTPException(
            status_code=400, detail="Échec de l'enregistrement de la dépense"
        )
    return result.data[0]
