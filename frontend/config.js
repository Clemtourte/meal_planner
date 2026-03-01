/**
 * Configuration globale de l'API.
 * En production, définir window.ENV_API_URL dans un script inline (ex: Vercel).
 * Exemple : window.ENV_API_URL = "https://meal-planner-api.onrender.com/api"
 */
const BASE_URL = window.ENV_API_URL || "http://localhost:8000";
