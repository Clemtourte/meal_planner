"""Point d'entrée de l'application FastAPI — Meal Planner."""

import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routers import budget, calendrier, courses, ingredients, recettes, sorties

logger = logging.getLogger(__name__)

_allowed_origins_raw = os.environ.get("ALLOWED_ORIGINS", "http://localhost:5500")
_allowed_origins = [o.strip() for o in _allowed_origins_raw.split(",")]

logger.info("CORS configuré pour : %s", _allowed_origins)

app = FastAPI(
    title="Meal Planner API",
    description="API de planification de repas hebdomadaire",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingredients.router, prefix="/api/ingredients", tags=["ingredients"])
app.include_router(recettes.router, prefix="/api/recettes", tags=["recettes"])
app.include_router(calendrier.router, prefix="/api/calendrier", tags=["calendrier"])
app.include_router(courses.router, prefix="/api/courses", tags=["courses"])
app.include_router(budget.router, prefix="/api/budgets", tags=["budget"])
app.include_router(sorties.router, prefix="/api/sorties", tags=["sorties"])


@app.get("/api/health")
async def health_check() -> dict[str, str]:
    """Vérifie que l'API est opérationnelle."""
    return {"status": "ok"}
