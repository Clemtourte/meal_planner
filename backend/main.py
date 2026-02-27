"""Point d'entrée de l'application FastAPI — Meal Planner."""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from backend.routers import budget, calendrier, courses, ingredients, recettes

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


class UserIDMiddleware(BaseHTTPMiddleware):
    """Lit le header X-User-ID et l'injecte dans request.state.user_id.

    Si le header est absent, utilise 'default_user' pour maintenir la
    compatibilité avec le frontend actuel (authentification complète via
    Supabase Auth sera activée lors du déploiement).
    """

    async def dispatch(self, request: Request, call_next):
        """Injecte user_id dans request.state avant de passer au handler."""
        request.state.user_id = request.headers.get("X-User-ID", "default_user")
        return await call_next(request)


app.add_middleware(UserIDMiddleware)

app.include_router(ingredients.router, prefix="/api/ingredients", tags=["ingredients"])
app.include_router(recettes.router, prefix="/api/recettes", tags=["recettes"])
app.include_router(calendrier.router, prefix="/api/calendrier", tags=["calendrier"])
app.include_router(courses.router, prefix="/api/courses", tags=["courses"])
app.include_router(budget.router, prefix="/api/budgets", tags=["budget"])


@app.get("/api/health")
async def health_check() -> dict[str, str]:
    """Vérifie que l'API est opérationnelle."""
    return {"status": "ok"}
