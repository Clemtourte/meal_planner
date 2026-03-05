"""Dépendances FastAPI partagées entre les routers."""

import logging
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase import Client

from backend.database import get_supabase_auth

logger = logging.getLogger(__name__)

_bearer = HTTPBearer(auto_error=False)


async def get_user_id(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    db: Client = Depends(get_supabase_auth),
) -> str:
    """Vérifie le JWT Supabase et retourne l'UUID de l'utilisateur.

    Lève HTTP 401 si le token est absent, invalide ou expiré.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token d'authentification manquant",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        response = db.auth.get_user(credentials.credentials)
        return response.user.id
    except Exception as exc:
        logger.warning("JWT invalide : %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalide ou expiré",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
