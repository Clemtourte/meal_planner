/**
 * recettes.js — Gestion des recettes et de leurs ingrédients.
 */

let _recettes = [];
let _allIngredients = [];
let _editingRecetteId = null;
let _currentRecetteDetail = null;

async function initRecettes() {
  await Promise.all([_loadRecettes(), _loadAllIngredients()]);
  _renderRecettes();
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

function _renderRecettes() {
  const container = document.getElementById("recettes-container");
  if (_recettes.length === 0) {
    container.innerHTML =
      '<p class="empty-state">Aucune recette. Cliquez sur « Ajouter » pour commencer.</p>';
    return;
  }
  container.innerHTML = _recettes
    .map(
      (r) => `
    <div class="card recette-card" id="recette-card-${r.id}">
      <div class="card-header">
        <div class="card-title">
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
    </div>`
    )
    .join("");
}

function _bindRecetteEvents() {
  const btn = document.getElementById("btn-add-recette");
  if (btn) btn.onclick = () => openAddRecette();

  const form = document.getElementById("form-recette");
  if (form) form.onsubmit = (e) => submitRecetteForm(e);

  const formRI = document.getElementById("form-recette-ingredient");
  if (formRI) formRI.onsubmit = (e) => submitAddIngredientToRecette(e);
}

// ---------------------------------------------------------------------------
// Modale recette
// ---------------------------------------------------------------------------

function openAddRecette() {
  _editingRecetteId = null;
  document.getElementById("modal-recette-title").textContent = "Nouvelle recette";
  document.getElementById("form-recette").reset();
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
  showModal("modal-recette");
}

async function submitRecetteForm(e) {
  e.preventDefault();
  const data = {
    nom: document.getElementById("rec-nom").value.trim(),
    nb_portions: parseInt(document.getElementById("rec-portions").value, 10),
    description: document.getElementById("rec-desc").value.trim() || null,
  };
  try {
    if (_editingRecetteId) {
      await apiPatch(`/recettes/${_editingRecetteId}`, data);
      showToast("Recette modifiée ✓");
    } else {
      await apiPost("/recettes", data);
      showToast("Recette créée ✓");
    }
    hideModal("modal-recette");
    await _loadRecettes();
    _renderRecettes();
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
  } catch (err) {
    showToast("Erreur : " + err.message, "error");
  }
}

// ---------------------------------------------------------------------------
// Détail recette (ingrédients)
// ---------------------------------------------------------------------------

async function openRecetteDetail(id) {
  try {
    _currentRecetteDetail = await apiGet(`/recettes/${id}`);
    _renderRecetteDetail();
    _populateIngredientSelect();
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
      '<tr><td colspan="4" class="empty-cell">Aucun ingrédient. Ajoutez-en un ci-dessous.</td></tr>';
    return;
  }
  tbody.innerHTML = rec.ingredients
    .map(
      (ri) => `
    <tr>
      <td>${_escR(ri.ingredient_nom || "—")}</td>
      <td class="text-center">${ri.quantite}</td>
      <td class="text-center">${_escR(ri.unite)}</td>
      <td class="text-center">
        <button class="btn btn-xs btn-danger" onclick="removeIngredientFromRecette('${rec.id}', '${ri.id}')">×</button>
      </td>
    </tr>`
    )
    .join("");
}

function _populateIngredientSelect() {
  const sel = document.getElementById("ri-ingredient");
  sel.innerHTML =
    '<option value="">— Sélectionner un ingrédient —</option>' +
    _allIngredients
      .map((i) => `<option value="${i.id}">${_escR(i.nom)} (${_escR(i.unite_defaut)})</option>`)
      .join("");
}

async function submitAddIngredientToRecette(e) {
  e.preventDefault();
  const form = e.target;
  const ingId = form["ri-ingredient"].value;
  if (!ingId) {
    showToast("Veuillez sélectionner un ingrédient", "error");
    return;
  }
  const data = {
    ingredient_id: ingId,
    quantite: parseFloat(form["ri-quantite"].value),
    unite: form["ri-unite"].value.trim(),
  };
  try {
    await apiPost(`/recettes/${_currentRecetteDetail.id}/ingredients`, data);
    showToast("Ingrédient ajouté ✓");
    form.reset();
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
