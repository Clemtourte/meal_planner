/**
 * auth.js — Gestion de l'authentification via Supabase Auth (JS SDK).
 *
 * API publique :
 *   initAuth()        → initialise le client, écoute les changements de session
 *   getAccessToken()  → retourne le JWT de la session courante (ou null)
 *   signIn(email, pw) → connexion email/mot de passe
 *   signOut()         → déconnexion
 */

// ---------------------------------------------------------------------------
// Initialisation du client Supabase JS
// ---------------------------------------------------------------------------

// `supabase` est le namespace exposé par le CDN @supabase/supabase-js (UMD).
const { createClient } = supabase;
const _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let _session = null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Retourne le JWT de l'utilisateur connecté, ou null. */
function getAccessToken() {
  return _session?.access_token ?? null;
}

/** Retourne l'email de l'utilisateur connecté, ou null. */
function getCurrentUserEmail() {
  return _session?.user?.email ?? null;
}

// ---------------------------------------------------------------------------
// Gestion de l'UI auth
// ---------------------------------------------------------------------------

function _showApp() {
  document.getElementById("auth-screen").style.display = "none";
  document.getElementById("app-root").style.display = "";
  const emailEl = document.getElementById("auth-user-email");
  if (emailEl) emailEl.textContent = getCurrentUserEmail() ?? "";
}

function _showAuthScreen() {
  document.getElementById("auth-screen").style.display = "";
  document.getElementById("app-root").style.display = "none";
  _clearAuthError();
}

function _setAuthError(msg) {
  const el = document.getElementById("auth-error");
  if (el) {
    el.textContent = msg;
    el.style.display = msg ? "" : "none";
  }
}

function _clearAuthError() {
  _setAuthError("");
}

// ---------------------------------------------------------------------------
// Actions publiques
// ---------------------------------------------------------------------------

/**
 * Connexion avec email + mot de passe.
 * @param {string} email
 * @param {string} password
 */
async function signIn(email, password) {
  _clearAuthError();
  const { error } = await _client.auth.signInWithPassword({ email, password });
  if (error) {
    _setAuthError(error.message === "Invalid login credentials"
      ? "Email ou mot de passe incorrect."
      : error.message);
  }
}

/** Déconnexion. */
async function signOut() {
  await _client.auth.signOut();
}

// ---------------------------------------------------------------------------
// Initialisation — à appeler une seule fois au chargement de la page
// ---------------------------------------------------------------------------

/**
 * Initialise l'auth : récupère la session existante, écoute les changements.
 * Affiche l'écran de login ou l'app selon l'état.
 */
async function initAuth() {
  // Récupère la session stockée localement (localStorage)
  const { data } = await _client.auth.getSession();
  _session = data.session;

  if (_session) {
    _showApp();
  } else {
    _showAuthScreen();
  }

  // Écoute les changements d'état (login / logout / refresh token)
  _client.auth.onAuthStateChange((_event, session) => {
    _session = session;
    if (session) {
      _showApp();
    } else {
      _showAuthScreen();
    }
  });

  // Formulaire de connexion
  const form = document.getElementById("auth-form");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email    = document.getElementById("auth-email").value.trim();
      const password = document.getElementById("auth-password").value;
      const btn      = form.querySelector("button[type=submit]");
      btn.disabled = true;
      btn.textContent = "Connexion…";
      await signIn(email, password);
      btn.disabled = false;
      btn.textContent = "Se connecter";
    });
  }

  // Bouton de déconnexion
  const btnLogout = document.getElementById("btn-logout");
  if (btnLogout) {
    btnLogout.addEventListener("click", signOut);
  }
}
