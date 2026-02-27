"""Dépendances FastAPI partagées entre les routers."""

from fastapi import Request


def get_user_id(request: Request) -> str:
    """Retourne l'identifiant utilisateur injecté par UserIDMiddleware.

    Valeur par défaut : 'default_user' si le header X-User-ID est absent.
    """
    return getattr(request.state, "user_id", "default_user")
