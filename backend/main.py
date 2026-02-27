"""Point d'entrée de l'application FastAPI — Meal Planner."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routers import ingredients, recettes, calendrier, courses

app = FastAPI(
    title="Meal Planner API",
    description="API de planification de repas hebdomadaire",
    version="1.0.0",
    redirect_slashes=False,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingredients.router, prefix="/api/ingredients", tags=["ingredients"])
app.include_router(recettes.router, prefix="/api/recettes", tags=["recettes"])
app.include_router(calendrier.router, prefix="/api/calendrier", tags=["calendrier"])
app.include_router(courses.router, prefix="/api/courses", tags=["courses"])


@app.get("/api/health")
async def health_check() -> dict[str, str]:
    """Vérifie que l'API est opérationnelle."""
    return {"status": "ok"}
