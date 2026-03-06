"""Registre des routers FastAPI."""

from backend.routers import budget, calendrier, courses, ingredients, recettes, sorties

__all__ = ["ingredients", "recettes", "calendrier", "courses", "budget", "sorties"]
