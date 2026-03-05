/**
 * Configuration globale de l'API et de Supabase.
 * En production, définir ces variables via des scripts inline (Vercel, Render…).
 *   window.ENV_API_URL = "https://meal-planner-api.onrender.com/api"
 *   window.ENV_SUPABASE_URL = "https://xxxx.supabase.co"
 *   window.ENV_SUPABASE_ANON_KEY = "sb_publishable_..."
 */
const BASE_URL = window.ENV_API_URL || "http://localhost:8000/api";

// Clé anon Supabase — publique par conception (la sécurité vient du RLS).
const SUPABASE_URL = window.ENV_SUPABASE_URL || "https://dchxkydvmuszqvajkkor.supabase.co";
const SUPABASE_ANON_KEY = window.ENV_SUPABASE_ANON_KEY || "sb_publishable_K8MVwE2mTaIUjQ3-15uiGA_Cq9yeXKI";
