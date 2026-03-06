/**
 * calendrier.js — Vue semaine avec navigation et sélection de recettes.
 */

const MEAL_TYPES = [
  { key: "petit_dejeuner", label: "Petit-déjeuner" },
  { key: "dejeuner",       label: "Déjeuner" },
  { key: "diner",          label: "Dîner" },
];

const DAY_NAMES = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

let _currentWeekStart = null;   // Date (lundi de la semaine affichée)
let _weekMeals = [];            // Repas de la semaine chargés depuis l'API
let _weekSorties = [];          // Sorties / commandes de la semaine
let _recettesForSelect = [];    // Liste des recettes pour le dropdown
let _editingRepas = null;       // Repas en cours d'édition dans la modale

async function initCalendrier() {
  if (!_currentWeekStart) {
    _currentWeekStart = _getMondayOf(new Date());
  }
  await Promise.all([
    _loadWeekMeals(),
    _loadWeekSorties(),
    _loadRecettesForSelect(),
  ]);
  _renderCalendrier();
  _bindCalendrierEvents();
}

// ---------------------------------------------------------------------------
// Chargement des données
// ---------------------------------------------------------------------------

async function _loadWeekMeals() {
  try {
    const debutStr = _dateToISO(_currentWeekStart);
    _weekMeals = await apiGet(`/calendrier/semaine?debut=${debutStr}`);
  } catch (err) {
    showToast("Erreur chargement calendrier : " + err.message, "error");
    _weekMeals = [];
  }
}

async function _loadWeekSorties() {
  try {
    const debutStr = _dateToISO(_currentWeekStart);
    const fin = new Date(_currentWeekStart);
    fin.setDate(fin.getDate() + 6);
    const finStr = _dateToISO(fin);
    _weekSorties = await apiGet(`/sorties/?debut=${debutStr}&fin=${finStr}`);
  } catch (err) {
    showToast("Erreur chargement sorties : " + err.message, "error");
    _weekSorties = [];
  }
}

async function _loadRecettesForSelect() {
  try {
    _recettesForSelect = await apiGet("/recettes");
  } catch (err) {
    _recettesForSelect = [];
  }
}

// ---------------------------------------------------------------------------
// Rendu du calendrier
// ---------------------------------------------------------------------------

function _renderCalendrier() {
  const title = document.getElementById("cal-week-title");
  const fin = new Date(_currentWeekStart);
  fin.setDate(fin.getDate() + 6);
  title.textContent =
    `Semaine du ${_formatDate(_currentWeekStart)} au ${_formatDate(fin)}`;

  const grid = document.getElementById("cal-grid");

  // En-tête : jours
  const headerRow = `
    <div class="cal-header-cell"></div>
    ${DAY_NAMES.map((d, i) => {
      const day = new Date(_currentWeekStart);
      day.setDate(day.getDate() + i);
      return `<div class="cal-header-cell">
        <span class="cal-day-name">${d}</span>
        <span class="cal-day-date">${day.getDate()}/${day.getMonth() + 1}</span>
      </div>`;
    }).join("")}
  `;

  // Lignes : types de repas
  const rows = MEAL_TYPES.map(({ key, label }) => {
    const cells = DAY_NAMES.map((_, i) => {
      const day = new Date(_currentWeekStart);
      day.setDate(day.getDate() + i);
      const dayStr = _dateToISO(day);
      const repas = _weekMeals.find(
        (r) => r.date === dayStr && r.type_repas === key
      );
      return _renderCell(day, key, repas);
    }).join("");
    return `
      <div class="cal-row-label">${label}</div>
      ${cells}`;
  }).join("");

  const sortieCells = DAY_NAMES.map((_, i) => {
    const day = new Date(_currentWeekStart);
    day.setDate(day.getDate() + i);
    return _renderSortiesCell(day);
  }).join("");

  grid.innerHTML = headerRow + rows;
  grid.innerHTML += `
    <div class="cal-row-label">Sorties</div>
    ${sortieCells}
  `;
}

function _renderCell(day, mealType, repas) {
  if (repas) {
    return `
      <div class="cal-cell cal-cell-filled" onclick="openEditRepas('${repas.id}', '${_dateToISO(day)}', '${mealType}')">
        <span class="cal-meal-name">${_escC(repas.recette_nom || "Repas sans recette")}</span>
        <span class="cal-meal-persons">${repas.nb_personnes} pers.</span>
        <button class="cal-delete-btn" onclick="deleteRepas(event, '${repas.id}')">×</button>
      </div>`;
  }
  return `
    <div class="cal-cell cal-cell-empty" onclick="openAddRepas('${_dateToISO(day)}', '${mealType}')">
      <span class="cal-add-hint">+ Ajouter</span>
    </div>`;
}

function _renderSortiesCell(day) {
  const dayStr = _dateToISO(day);
  const sorties = _weekSorties.filter((s) => s.date === dayStr);
  if (sorties.length === 0) {
    return `
      <div class="cal-cell cal-cell-empty" onclick="openAddSortieWithDate('${dayStr}')">
        <span class="cal-add-hint">+ Ajouter</span>
      </div>`;
  }
  const items = sorties
    .map(
      (s) =>
        `<div class="cal-sortie-item">
           <span>${_escC(s.titre)}</span>
           <small>${Number(s.montant).toFixed(2)} €</small>
         </div>`
    )
    .join("");
  return `
    <div class="cal-cell cal-cell-filled" onclick="openAddSortieWithDate('${dayStr}')">
      <div class="cal-sortie-list">${items}</div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

function _bindCalendrierEvents() {
  document.getElementById("btn-prev-week").onclick = () => navigateWeek(-1);
  document.getElementById("btn-next-week").onclick = () => navigateWeek(1);
  document.getElementById("btn-today").onclick = () => {
    _currentWeekStart = _getMondayOf(new Date());
    _refreshCalendrier();
  };

  const form = document.getElementById("form-repas");
  if (form) form.onsubmit = (e) => submitRepasForm(e);
}

async function navigateWeek(delta) {
  _currentWeekStart = new Date(_currentWeekStart);
  _currentWeekStart.setDate(_currentWeekStart.getDate() + delta * 7);
  await _refreshCalendrier();
}

async function _refreshCalendrier() {
  await Promise.all([_loadWeekMeals(), _loadWeekSorties()]);
  _renderCalendrier();
}

// ---------------------------------------------------------------------------
// Modale repas
// ---------------------------------------------------------------------------

function _populateRepasModal(dateStr, mealType, repas) {
  // Titre
  const dayIdx = _getDayIndex(dateStr);
  const mealLabel = MEAL_TYPES.find((m) => m.key === mealType)?.label || mealType;
  document.getElementById("modal-repas-title").textContent =
    `${mealLabel} — ${DAY_NAMES[dayIdx]} ${_formatDateFromStr(dateStr)}`;

  // Sélecteur de recettes
  const sel = document.getElementById("repas-recette");
  sel.innerHTML =
    '<option value="">— Aucune recette —</option>' +
    _recettesForSelect
      .map(
        (r) =>
          `<option value="${r.id}" ${repas?.recette_id === r.id ? "selected" : ""}>${_escC(r.nom)}</option>`
      )
      .join("");

  // Nombre de personnes
  document.getElementById("repas-personnes").value =
    repas?.nb_personnes ?? 2;

  // Données cachées
  document.getElementById("repas-date").value = dateStr;
  document.getElementById("repas-type").value = mealType;
}

function openAddRepas(dateStr, mealType) {
  _editingRepas = null;
  _populateRepasModal(dateStr, mealType, null);
  showModal("modal-repas");
}

function openEditRepas(repasId, dateStr, mealType) {
  _editingRepas = _weekMeals.find((r) => r.id === repasId) || null;
  _populateRepasModal(dateStr, mealType, _editingRepas);
  showModal("modal-repas");
}

async function submitRepasForm(e) {
  e.preventDefault();
  const recetteId = document.getElementById("repas-recette").value || null;
  const data = {
    date: document.getElementById("repas-date").value,
    type_repas: document.getElementById("repas-type").value,
    recette_id: recetteId,
    nb_personnes: parseInt(document.getElementById("repas-personnes").value, 10),
  };
  try {
    await apiPost("/calendrier/", data);
    showToast("Repas enregistré ✓");
    hideModal("modal-repas");
    await _refreshCalendrier();
  } catch (err) {
    showToast("Erreur : " + err.message, "error");
  }
}

async function deleteRepas(e, repasId) {
  e.stopPropagation();
  try {
    await apiDelete(`/calendrier/${repasId}`);
    showToast("Repas supprimé");
    await _refreshCalendrier();
  } catch (err) {
    showToast("Erreur : " + err.message, "error");
  }
}

// ---------------------------------------------------------------------------
// Utilitaires date
// ---------------------------------------------------------------------------

function _getMondayOf(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=dim, 1=lun...
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function _dateToISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function _formatDate(date) {
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

function _formatDateFromStr(dateStr) {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function _getDayIndex(dateStr) {
  const date = new Date(dateStr + "T00:00:00");
  const day = date.getDay();
  return day === 0 ? 6 : day - 1;
}

function _escC(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
