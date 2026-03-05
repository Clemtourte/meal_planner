"""Module de connexion à la base de données Supabase."""

import os

from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv()

SUPABASE_URL: str = os.environ["SUPABASE_URL"]
SUPABASE_KEY: str = os.environ["SUPABASE_KEY"]

# La service role key bypass le RLS pour les requêtes backend.
# La sécurité est assurée par la vérification JWT dans dependencies.py.
# Fallback sur la clé anon si non définie (dev sans RLS).
_service_key: str = os.environ.get("SUPABASE_SERVICE_KEY", SUPABASE_KEY)

# Client anon — utilisé uniquement pour vérifier les JWT (auth.get_user)
supabase_auth: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Client service role — utilisé pour toutes les requêtes DB (bypass RLS)
supabase: Client = create_client(SUPABASE_URL, _service_key)


def get_supabase() -> Client:
    """Retourne le client service-role (bypass RLS, sécurité via JWT FastAPI)."""
    return supabase


def get_supabase_auth() -> Client:
    """Retourne le client Supabase anon, utilisé pour vérifier les JWT."""
    return supabase_auth
