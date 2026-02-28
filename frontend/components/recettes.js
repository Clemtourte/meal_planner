/**
 * recettes.js — Gestion des recettes et de leurs ingrédients.
 */

let _recettes = [];
let _allIngredients = [];
let _editingRecetteId = null;
let _currentRecetteDetail = null;
let _searchQuery = "";
let _activeTag = null;

// Cache des prix par ingredient_id → array de prix
const _priceCache = new Map();

// ---------------------------------------------------------------------------
// Conversion d'unités (miroir de la logique backend _to_base)
// ---------------------------------------------------------------------------

const _UNIT_TO_BASE_JS = {
  kg: ["g", 1000], Kg: ["g", 1000], KG: ["g", 1000],
  kilo: ["g", 1000], kilos: ["g", 1000],
  l: ["ml", 1000], L: ["ml", 1000],
  litre: ["ml", 1000], litres: ["ml", 1000],
  liter: ["ml", 1000], liters: ["ml", 1000],
  cl: ["ml", 10], CL: ["ml", 10],
  dl: ["ml", 100], DL: ["ml", 100],
};

function _unitToBase(qty, unit) {
  const conv = _UNIT_TO_BASE_JS[unit];
  if (conv) return [qty * conv[1], conv[0]];
  return [qty, unit];
}

/**
 * Calcule le coût estimé d'une quantité d'ingrédient à partir de la liste de prix.
 * Retourne { cout, magasin } ou null si aucun prix compatible.
 */
function _estimateCostFromPrices(prices, qty, unit) {
  if (!prices || prices.length === 0 || !qty || qty <= 0 || !unit) return null;
  const [normQty, normUnit] = _unitToBase(qty, unit);
  let best = null;
  let bestCostPerUnit = Infinity;
  for (const p of prices) {
    const [refQtyBase, refUnitBase] = _unitToBase(
      parseFloat(p.quantite_reference),
      p.unite_reference
    );
    if (refUnitBase !== normUnit) continue;
    const costPerUnit = parseFloat(p.prix) / refQtyBase;
    if (costPerUnit < bestCostPerUnit) {
      bestCostPerUnit = costPerUnit;
      best = { magasin: p.magasin, costPerUnit };
    }
  }
  if (!best) return null;
  return { cout: best.costPerUnit * normQty, magasin: best.magasin };
}

async function initRecettes() {
  await Promise.all([_loadRecettes(), _loadAllIngredients()]);
  _renderRecettes();
  _renderTagFilters();
  _bindRecetteEvents();
}

async function _loadRecettes() {
  try {
    _recettes = await apiGet("/recettes");
  } catch (err) {
    showToast("Erreur chargement recettes : " + err.message, "error");
    _recettes = [];
  }
}

async function _loadAllIngredients() {
  try {
    _allIngredients = await apiGet("/ingredients");
  } catch (err) {
    _allIngredients = [];
  }
}

// ---------------------------------------------------------------------------
// Rendu de la liste avec filtres
// ---------------------------------------------------------------------------

function _getFilteredRecettes() {
  let list = _recettes;
  if (_searchQuery) {
    const q = _searchQuery.toLowerCase();
    list = list.filter(
      (r) =>
        r.nom.toLowerCase().includes(q) ||
        (r.description && r.description.toLowerCase().includes(q))
    );
  }
  if (_activeTag) {
    list = list.filter((r) => (r.tags || []).includes(_activeTag));
  }
  return list;
}

function _renderRecettes() {
  const container = document.getElementById("recettes-container");
  const filtered = _getFilteredRecettes();
  if (filtered.length === 0) {
    const msg = _searchQuery || _activeTag
      ? "Aucune recette ne correspond à votre recherche."
      : "Votre livre de recettes est vide.";
    const sub = _searchQuery || _activeTag
      ? "Essayez d'autres mots-clés ou filtres."
      : "Cliquez sur « Ajouter » pour créer votre première recette.";
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
             stroke-linecap="round" stroke-linejoin="round">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
        </svg>
        <p>${msg}</p>
        <small>${sub}</small>
      </div>`;
    return;
  }
  container.innerHTML = filtered
    .map(
      (r) => `
    <div class="card recette-card" id="recette-card-${r.id}">
      <div class="card-header">
        <div class="card-title">
          <span class="recette-avatar" style="background:${_avatarColor(r.nom)}">${_escR(r.nom.charAt(0))}</span>
          <span class="recette-nom">${_escR(r.nom)}</span>
          <span class="badge badge-portions">${r.nb_portions} portion${r.nb_portions > 1 ? "s" : ""}</span>
        </div>
        <div class="card-actions">
          <button class="btn btn-sm btn-primary" onclick="openRecetteDetail('${r.id}')">Détail</button>
          <button class="btn btn-sm btn-outline" onclick="openEditRecette('${r.id}')">Modifier</button>
          <button class="btn btn-sm btn-danger" onclick="confirmDeleteRecette('${r.id}', '${_escR(r.nom)}')">Supprimer</button>
        </div>
      </div>
      ${r.description ? `<p class="recette-desc">${_escR(r.description)}</p>` : ""}
      ${
        r.tags && r.tags.length > 0
          ? `<div class="rec-tags">${r.tags.map((t) => `<span class="rec-tag">${_escR(t)}</span>`).join("")}</div>`
          : ""
      }
    </div>`
    )
    .join("");
}

function _collectAllTags() {
  const tags = new Set();
  _recettes.forEach((r) => (r.tags || []).forEach((t) => tags.add(t)));
  return [...tags].sort();
}

function _renderTagFilters() {
  const container = document.getElementById("recette-tag-filters");
  if (!container) return;
  const tags = _collectAllTags();
  if (tags.length === 0) {
    container.innerHTML = "";
    return;
  }
  container.innerHTML = tags
    .map(
      (t) =>
        `<button class="tag-filter-btn${_activeTag === t ? " active" : ""}" onclick="_toggleTagFilter('${_escR(t)}')">${_escR(t)}</button>`
    )
    .join("");
}

function _toggleTagFilter(tag) {
  _activeTag = _activeTag === tag ? null : tag;
  _renderTagFilters();
  _renderRecettes();
}

function _bindRecetteEvents() {
  const btn = document.getElementById("btn-add-recette");
  if (btn) btn.onclick = () => openAddRecette();

  const form = document.getElementById("form-recette");
  if (form) form.onsubmit = (e) => submitRecetteForm(e);

  const formRI = document.getElementById("form-recette-ingredient");
  if (formRI) formRI.onsubmit = (e) => submitAddIngredientToRecette(e);

  const btnAddRow = document.getElementById("btn-add-ing-row");
  if (btnAddRow) btnAddRow.onclick = () => _addIngredientRow();

  const search = document.getElementById("recette-search");
  if (search) {
    search.oninput = () => {
      _searchQuery = search.value.trim();
      _renderRecettes();
    };
  }

  // Mise à jour de l'unité et de l'estimation de coût dans la modale détail
  const riIngredient = document.getElementById("ri-ingredient");
  if (riIngredient) riIngredient.onchange = () => _onDetailIngRowChange();

  const riQuantite = document.getElementById("ri-quantite");
  if (riQuantite) riQuantite.oninput = () => _updateDetailCostHint();

  const riUnite = document.getElementById("ri-unite");
  if (riUnite) riUnite.oninput = () => _updateDetailCostHint();
}

// ---------------------------------------------------------------------------
// Modale recette (création / modification)
// ---------------------------------------------------------------------------

function openAddRecette() {
  _editingRecetteId = null;
  document.getElementById("modal-recette-title").textContent = "Nouvelle recette";
  document.getElementById("form-recette").reset();
  document.getElementById("rec-ing-rows").innerHTML = "";
  document.getElementById("rec-ingredients-section").style.display = "block";
  showModal("modal-recette");
}

function openEditRecette(id) {
  const rec = _recettes.find((r) => r.id === id);
  if (!rec) return;
  _editingRecetteId = id;
  document.getElementById("modal-recette-title").textContent = "Modifier la recette";
  document.getElementById("rec-nom").value = rec.nom;
  document.getElementById("rec-portions").value = rec.nb_portions;
  document.getElementById("rec-desc").value = rec.description || "";
  document.getElementById("rec-tags").value = (rec.tags || []).join(", ");
  document.getElementById("rec-ingredients-section").style.display = "none";
  showModal("modal-recette");
}

// ---------------------------------------------------------------------------
// Lignes d'ingrédients dynamiques (formulaire de création)
// ---------------------------------------------------------------------------

function _makeIngredientOptions() {
  return (
    '<option value="">— Sélectionner —</option>' +
    _allIngredients
      .map(
        (i) =>
          `<option value="${i.id}" data-unite="${_escR(i.unite_defaut)}">${_escR(i.nom)}</option>`
      )
      .join("")
  );
}

function _addIngredientRow() {
  const container = document.getElementById("rec-ing-rows");
  const row = document.createElement("div");
  row.className = "ri-row";
  row.innerHTML = `
    <select class="ri-row-ingredient" onchange="_onIngRowChange(this)">
      ${_makeIngredientOptions()}
    </select>
    <input class="ri-row-quantite" type="number" step="0.001" min="0" placeholder="Qté"
           oninput="_onIngRowQtyChange(this)" />
    <input class="ri-row-unite" type="text" placeholder="unité"
           oninput="_onIngRowQtyChange(this)" />
    <button type="button" class="btn btn-xs btn-danger" onclick="this.closest('.ri-row').remove()">×</button>
    <span class="ri-cost-hint"></span>
  `;
  container.appendChild(row);
}

async function _onIngRowChange(sel) {
  const row = sel.closest(".ri-row");
  const opt = sel.options[sel.selectedIndex];
  const unite = opt ? opt.dataset.unite || "" : "";
  const uniteInput = row.querySelector(".ri-row-unite");
  if (uniteInput) uniteInput.value = unite;

  const ingId = sel.value;
  if (ingId) {
    if (!_priceCache.has(ingId)) {
      try {
        const prices = await apiGet(`/ingredients/${ingId}/prix`);
        _priceCache.set(ingId, prices);
      } catch {
        _priceCache.set(ingId, []);
      }
    }
    _updateRowCostHint(row, ingId);
  } else {
    const hint = row.querySelector(".ri-cost-hint");
    if (hint) { hint.textContent = ""; hint.className = "ri-cost-hint"; }
  }
}

function _onIngRowQtyChange(input) {
  const row = input.closest(".ri-row");
  const sel = row.querySelector(".ri-row-ingredient");
  const ingId = sel?.value;
  if (ingId) _updateRowCostHint(row, ingId);
}

function _updateRowCostHint(row, ingId) {
  const hint = row.querySelector(".ri-cost-hint");
  if (!hint) return;
  const qty = parseFloat(row.querySelector(".ri-row-quantite").value);
  const unit = row.querySelector(".ri-row-unite").value.trim();
  if (!unit || isNaN(qty) || qty <= 0) {
    hint.textContent = "";
    hint.className = "ri-cost-hint";
    return;
  }
  const prices = _priceCache.get(ingId) || [];
  const est = _estimateCostFromPrices(prices, qty, unit);
  if (est) {
    hint.textContent = `≈ ${est.cout.toFixed(2)} € (${est.magasin})`;
    hint.className = "ri-cost-hint has-cost";
  } else {
    hint.textContent = "";
    hint.className = "ri-cost-hint";
  }
}

// ---------------------------------------------------------------------------
// Estimation de coût dans la modale détail (formulaire ajout ingrédient)
// ---------------------------------------------------------------------------

async function _onDetailIngRowChange() {
  const sel = document.getElementById("ri-ingredient");
  if (!sel) return;
  const opt = sel.options[sel.selectedIndex];
  const unite = opt ? opt.dataset.unite || "" : "";
  const uniteInput = document.getElementById("ri-unite");
  if (uniteInput) uniteInput.value = unite;

  const ingId = sel.value;
  if (ingId) {
    if (!_priceCache.has(ingId)) {
      try {
        const prices = await apiGet(`/ingredients/${ingId}/prix`);
        _priceCache.set(ingId, prices);
      } catch {
        _priceCache.set(ingId, []);
      }
    }
    _updateDetailCostHint();
  } else {
    const hint = document.getElementById("ri-cost-hint-detail");
    if (hint) { hint.textContent = ""; hint.className = "ri-cost-hint"; }
  }
}

function _updateDetailCostHint() {
  const hint = document.getElementById("ri-cost-hint-detail");
  if (!hint) return;
  const sel = document.getElementById("ri-ingredient");
  const ingId = sel?.value;
  if (!ingId) { hint.textContent = ""; hint.className = "ri-cost-hint"; return; }
  const qty = parseFloat(document.getElementById("ri-quantite")?.value);
  const unit = document.getElementById("ri-unite")?.value.trim();
  if (!unit || isNaN(qty) || qty <= 0) {
    hint.textContent = "";
    hint.className = "ri-cost-hint";
    return;
  }
  const prices = _priceCache.get(ingId) || [];
  const est = _estimateCostFromPrices(prices, qty, unit);
  if (est) {
    hint.textContent = `≈ ${est.cout.toFixed(2)} € (basé sur le prix ${est.magasin})`;
    hint.className = "ri-cost-hint has-cost";
  } else {
    hint.textContent = "";
    hint.className = "ri-cost-hint";
  }
}

// ---------------------------------------------------------------------------
// Soumission du formulaire recette
// ---------------------------------------------------------------------------

function _parseTags() {
  const val = document.getElementById("rec-tags").value;
  return val
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

async function submitRecetteForm(e) {
  e.preventDefault();
  const nom = document.getElementById("rec-nom").value.trim();
  const nb_portions = parseInt(document.getElementById("rec-portions").value, 10);
  const description = document.getElementById("rec-desc").value.trim() || null;
  const tags = _parseTags();

  try {
    if (_editingRecetteId) {
      await apiPatch(`/recettes/${_editingRecetteId}`, { nom, nb_portions, description, tags });
      showToast("Recette modifiée ✓");
    } else {
      // Étape 1 : créer la recette via POST /recettes
      const recette = await apiPost("/recettes", { nom, nb_portions, description, tags });

      // Étape 2 : ajouter les ingrédients un par un
      const rows = document.querySelectorAll("#rec-ing-rows .ri-row");
      for (const row of rows) {
        const sel = row.querySelector(".ri-row-ingredient");
        const ingId = sel.value;
        const opt = sel.options[sel.selectedIndex];
        // Lire l'unité depuis l'input (éditable) ou le data-unite par défaut
        const uniteInput = row.querySelector(".ri-row-unite");
        const unite = uniteInput
          ? uniteInput.value.trim()
          : opt
          ? opt.dataset.unite || ""
          : "";
        const quantite = parseFloat(row.querySelector(".ri-row-quantite").value);
        if (!ingId || !unite || isNaN(quantite) || quantite <= 0) continue;
        await apiPost(`/recettes/${recette.id}/ingredients`, {
          ingredient_id: ingId,
          quantite,
          unite,
        });
      }

      showToast("Recette créée ✓");
    }
    hideModal("modal-recette");
    await _loadRecettes();
    _renderRecettes();
    _renderTagFilters();
  } catch (err) {
    showToast("Erreur : " + err.message, "error");
  }
}

async function confirmDeleteRecette(id, nom) {
  if (!confirm(`Supprimer la recette « ${nom} » ?`)) return;
  try {
    await apiDelete(`/recettes/${id}`);
    showToast("Recette supprimée");
    await _loadRecettes();
    _renderRecettes();
    _renderTagFilters();
  } catch (err) {
    const msg = err.message || "";
    if (msg.includes("calendrier") || msg.includes("planifi")) {
      showFKError(msg);
    } else {
      showToast("Erreur : " + msg, "error");
    }
  }
}

// ---------------------------------------------------------------------------
// Détail recette — liste et gestion des ingrédients
// ---------------------------------------------------------------------------

async function openRecetteDetail(id) {
  try {
    _currentRecetteDetail = await apiGet(`/recettes/${id}`);
    _renderRecetteDetail();
    _populateIngredientSelect();
    // Réinitialiser l'hint de coût
    const hint = document.getElementById("ri-cost-hint-detail");
    if (hint) { hint.textContent = ""; hint.className = "ri-cost-hint"; }
    showModal("modal-recette-detail");
  } catch (err) {
    showToast("Erreur : " + err.message, "error");
  }
}

function _renderRecetteDetail() {
  const rec = _currentRecetteDetail;
  document.getElementById("detail-recette-nom").textContent = rec.nom;
  document.getElementById("detail-recette-meta").textContent =
    `${rec.nb_portions} portion${rec.nb_portions > 1 ? "s" : ""}` +
    (rec.description ? ` · ${rec.description}` : "");

  const tbody = document.getElementById("detail-ingredients-body");
  if (rec.ingredients.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="3" class="empty-cell">Aucun ingrédient. Ajoutez-en un ci-dessous.</td></tr>';
    return;
  }
  tbody.innerHTML = rec.ingredients
    .map(
      (ri) => `
    <tr id="ri-row-${ri.id}">
      <td>${_escR(ri.ingredient_nom || "—")}</td>
      <td class="text-center" id="ri-qty-${ri.id}">${ri.quantite} <span class="ri-unite-lbl">${_escR(ri.unite)}</span></td>
      <td class="text-center" id="ri-act-${ri.id}">
        <div class="ri-actions">
          <button class="btn btn-xs btn-outline" title="Modifier" onclick="editIngredientInDetail('${rec.id}', '${ri.id}', ${ri.quantite}, '${_escR(ri.unite)}')">✏️</button>
          <button class="btn btn-xs btn-danger" title="Supprimer" onclick="removeIngredientFromRecette('${rec.id}', '${ri.id}')">✕</button>
        </div>
      </td>
    </tr>`
    )
    .join("");
}

// ---------------------------------------------------------------------------
// Édition inline d'un ingrédient dans la vue détail
// ---------------------------------------------------------------------------

function editIngredientInDetail(recetteId, riId, currentQty, currentUnite) {
  document.getElementById(`ri-qty-${riId}`).innerHTML =
    `<input type="number" step="0.001" min="0" value="${currentQty}" id="edit-qty-${riId}" class="inline-input inline-input--cell" style="width:60px" />` +
    ` <input type="text" value="${_escR(currentUnite)}" id="edit-unite-${riId}" class="inline-input inline-input--cell" style="width:48px" placeholder="unité" />`;

  document.getElementById(`ri-act-${riId}`).innerHTML = `
    <div class="ri-actions">
      <button class="btn btn-xs btn-primary" title="Valider" onclick="saveIngredientInDetail('${recetteId}', '${riId}')">✓</button>
      <button class="btn btn-xs btn-secondary" title="Annuler" onclick="cancelIngredientEdit('${recetteId}', '${riId}', ${currentQty}, '${_escR(currentUnite)}')">✗</button>
    </div>
  `;
}

async function saveIngredientInDetail(recetteId, riId) {
  const quantite = parseFloat(document.getElementById(`edit-qty-${riId}`).value);
  const unite = document.getElementById(`edit-unite-${riId}`).value.trim();
  if (isNaN(quantite) || quantite <= 0) {
    showToast("Quantité invalide", "error");
    return;
  }
  if (!unite) {
    showToast("Unité invalide", "error");
    return;
  }
  try {
    await apiPatch(`/recettes/${recetteId}/ingredients/${riId}`, { quantite, unite });
    showToast("Ingrédient mis à jour ✓");
    _currentRecetteDetail = await apiGet(`/recettes/${recetteId}`);
    _renderRecetteDetail();
  } catch (err) {
    showToast("Erreur : " + err.message, "error");
  }
}

function cancelIngredientEdit(recetteId, riId, originalQty, originalUnite) {
  document.getElementById(`ri-qty-${riId}`).innerHTML =
    `${originalQty} <span class="ri-unite-lbl">${_escR(originalUnite)}</span>`;
  document.getElementById(`ri-act-${riId}`).innerHTML = `
    <div class="ri-actions">
      <button class="btn btn-xs btn-outline" title="Modifier" onclick="editIngredientInDetail('${recetteId}', '${riId}', ${originalQty}, '${_escR(originalUnite)}')">✏️</button>
      <button class="btn btn-xs btn-danger" title="Supprimer" onclick="removeIngredientFromRecette('${recetteId}', '${riId}')">✕</button>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Formulaire "Ajouter un ingrédient" dans la vue détail
// ---------------------------------------------------------------------------

function _populateIngredientSelect() {
  const sel = document.getElementById("ri-ingredient");
  sel.innerHTML =
    '<option value="">— Sélectionner un ingrédient —</option>' +
    _allIngredients
      .map(
        (i) =>
          `<option value="${i.id}" data-unite="${_escR(i.unite_defaut)}">${_escR(i.nom)} (${_escR(i.unite_defaut)})</option>`
      )
      .join("");
  // Réinitialiser l'unité et le hint
  const uniteInput = document.getElementById("ri-unite");
  if (uniteInput) uniteInput.value = "";
}

async function submitAddIngredientToRecette(e) {
  e.preventDefault();
  const form = e.target;
  const ingId = form["ri-ingredient"].value;
  if (!ingId) {
    showToast("Veuillez sélectionner un ingrédient", "error");
    return;
  }
  const uniteInput = document.getElementById("ri-unite");
  const unite = uniteInput
    ? uniteInput.value.trim()
    : (() => {
        const sel = document.getElementById("ri-ingredient");
        const opt = sel?.options[sel.selectedIndex];
        return opt ? opt.dataset.unite || "" : "";
      })();
  if (!unite) {
    showToast("Veuillez saisir une unité", "error");
    return;
  }
  const data = {
    ingredient_id: ingId,
    quantite: parseFloat(form["ri-quantite"].value),
    unite,
  };
  try {
    await apiPost(`/recettes/${_currentRecetteDetail.id}/ingredients`, data);
    showToast("Ingrédient ajouté ✓");
    form.reset();
    if (uniteInput) uniteInput.value = "";
    const hint = document.getElementById("ri-cost-hint-detail");
    if (hint) { hint.textContent = ""; hint.className = "ri-cost-hint"; }
    _currentRecetteDetail = await apiGet(`/recettes/${_currentRecetteDetail.id}`);
    _renderRecetteDetail();
    _populateIngredientSelect();
  } catch (err) {
    showToast("Erreur : " + err.message, "error");
  }
}

async function removeIngredientFromRecette(recetteId, riId) {
  try {
    await apiDelete(`/recettes/${recetteId}/ingredients/${riId}`);
    showToast("Ingrédient retiré");
    _currentRecetteDetail = await apiGet(`/recettes/${recetteId}`);
    _renderRecetteDetail();
  } catch (err) {
    showToast("Erreur : " + err.message, "error");
  }
}

function _escR(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Derive a stable avatar background color from a recipe name. */
function _avatarColor(nom) {
  const palette = [
    "#7C9A7E", "#9B8EA0", "#C09A6B", "#7A9BAA",
    "#AA8585", "#8FAA7A", "#6B8CA0", "#A09B7A",
  ];
  let h = 0;
  for (let i = 0; i < nom.length; i++) h = (nom.charCodeAt(i) + ((h << 5) - h)) | 0;
  return palette[Math.abs(h) % palette.length];
}
