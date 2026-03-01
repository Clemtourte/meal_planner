/**
 * app.js — Logique principale : navigation par onglets, helpers API, toasts, modales.
 */

// ---------------------------------------------------------------------------
// Helpers API
// ---------------------------------------------------------------------------

async function apiGet(path) {
  const res = await fetch(BASE_URL + path);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Erreur serveur");
  }
  return res.json();
}

async function apiPost(path, data) {
  const res = await fetch(BASE_URL + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Erreur serveur");
  }
  return res.json();
}

async function apiPatch(path, data) {
  const res = await fetch(BASE_URL + path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Erreur serveur");
  }
  return res.json();
}

async function apiPut(path, data) {
  const res = await fetch(BASE_URL + path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Erreur serveur");
  }
  return res.json();
}

async function apiDelete(path) {
  const url = BASE_URL + path;
  let res;
  try {
    res = await fetch(url, { method: "DELETE" });
  } catch (networkErr) {
    console.error(`[DELETE ${url}] Network error:`, networkErr.message);
    throw networkErr;
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    console.error(`[DELETE ${url}] HTTP ${res.status}:`, err.detail);
    throw new Error(err.detail || "Erreur serveur");
  }
}

// ---------------------------------------------------------------------------
// Notifications toast
// ---------------------------------------------------------------------------

/** Affiche une alerte d'erreur contrainte FK (fond rouge clair, texte explicite). */
function showFKError(message) {
  const container = document.getElementById("toast-container");
  const el = document.createElement("div");
  el.className = "fk-alert";
  el.innerHTML = `<strong>⚠ Suppression impossible</strong><p>${message}</p>`;
  container.appendChild(el);
  requestAnimationFrame(() => el.classList.add("toast-visible"));
  setTimeout(() => {
    el.classList.remove("toast-visible");
    setTimeout(() => el.remove(), 300);
  }, 7000);
}

function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  // Apparition progressive
  requestAnimationFrame(() => toast.classList.add("toast-visible"));
  setTimeout(() => {
    toast.classList.remove("toast-visible");
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// ---------------------------------------------------------------------------
// Modales
// ---------------------------------------------------------------------------

function showModal(modalId) {
  const modal = document.getElementById(modalId);
  modal.style.display = "flex";
  requestAnimationFrame(() => modal.classList.add("modal-visible"));
}

function hideModal(modalId) {
  const modal = document.getElementById(modalId);
  modal.classList.remove("modal-visible");
  setTimeout(() => (modal.style.display = "none"), 200);
}

// Fermer une modale en cliquant sur l'overlay
document.addEventListener("click", (e) => {
  if (e.target.classList.contains("modal-overlay")) {
    hideModal(e.target.id);
  }
});

// ---------------------------------------------------------------------------
// Navigation par onglets
// ---------------------------------------------------------------------------

let currentTab = null;

function _updateTabIndicator(tabName) {
  requestAnimationFrame(() => {
    const btn = document.querySelector(`[data-tab="${tabName}"]`);
    const indicator = document.getElementById("tab-indicator");
    if (!btn || !indicator) return;
    indicator.style.left  = btn.offsetLeft + "px";
    indicator.style.width = btn.offsetWidth + "px";
  });
}

function switchTab(tabName) {
  if (currentTab === tabName) return;
  currentTab = tabName;

  document.querySelectorAll(".tab-content").forEach((el) =>
    el.classList.remove("active")
  );
  document.querySelectorAll(".tab-btn").forEach((el) =>
    el.classList.remove("active")
  );

  document.getElementById(`tab-${tabName}`).classList.add("active");
  document.querySelector(`[data-tab="${tabName}"]`).classList.add("active");
  _updateTabIndicator(tabName);

  switch (tabName) {
    case "ingredients":
      initIngredients();
      break;
    case "recettes":
      clearPriceCache();
      initRecettes();
      break;
    case "calendrier":
      initCalendrier();
      break;
    case "courses":
      initCourses();
      break;
    case "budget":
      initBudget();
      break;
  }
}

// ---------------------------------------------------------------------------
// Démarrage
// ---------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
  switchTab("ingredients");

  // Shopping list check-off handled by courses.js with API sync
});
