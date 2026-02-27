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

  const btnAddRow = document.getElementById("btn-add-ing-row");
  if (btnAddRow) btnAddRow.onclick = () => _addIngredientRow();
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
    <select class="ri-row-ingredient" onchange="_onIngSelectChange(this)">
      ${_makeIngredientOptions()}
    </select>
    <input class="ri-row-quantite" type="number" step="0.001" min="0" placeholder="Qté" />
    <input class="ri-row-unite" type="text" placeholder="Unité" />
    <button type="button" class="btn btn-xs btn-danger" onclick="this.closest('.ri-row').remove()">×</button>
  `;
  container.appendChild(row);
}

function _onIngSelectChange(sel) {
  const row = sel.closest(".ri-row");
  const opt = sel.options[sel.selectedIndex];
  const uniteDefaut = opt ? opt.dataset.unite || "" : "";
  const uniteInput = row.querySelector(".ri-row-unite");
  if (uniteInput && uniteDefaut) uniteInput.value = uniteDefaut;
}

// ---------------------------------------------------------------------------
// Soumission du formulaire recette
// ---------------------------------------------------------------------------

async function submitRecetteForm(e) {
  e.preventDefault();
  const nom = document.getElementById("rec-nom").value.trim();
  const nb_portions = parseInt(document.getElementById("rec-portions").value, 10);
  const description = document.getElementById("rec-desc").value.trim() || null;

  try {
    if (_editingRecetteId) {
      await apiPatch(`/recettes/${_editingRecetteId}`, { nom, nb_portions, description });
      showToast("Recette modifiée ✓");
    } else {
      // Collecter les lignes d'ingrédients
      const rows = document.querySelectorAll("#rec-ing-rows .ri-row");
      const ingredients = [];
      for (const row of rows) {
        const ingId = row.querySelector(".ri-row-ingredient").value;
        const quantite = parseFloat(row.querySelector(".ri-row-quantite").value);
        const unite = row.querySelector(".ri-row-unite").value.trim();
        if (!ingId || !unite || isNaN(quantite) || quantite <= 0) continue;
        ingredients.push({ ingredient_id: ingId, quantite, unite });
      }
      await apiPost("/recettes/with-ingredients", { nom, nb_portions, description, ingredients });
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
// Détail recette — liste et gestion des ingrédients
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
    <tr id="ri-row-${ri.id}">
      <td>${_escR(ri.ingredient_nom || "—")}</td>
      <td class="text-center" id="ri-qty-${ri.id}">${ri.quantite}</td>
      <td class="text-center" id="ri-unite-${ri.id}">${_escR(ri.unite)}</td>
      <td class="text-center">
        <button class="btn btn-xs btn-outline" onclick="editIngredientInDetail('${rec.id}', '${ri.id}', ${ri.quantite}, '${_escR(ri.unite)}')">Modifier</button>
        <button class="btn btn-xs btn-danger" onclick="removeIngredientFromRecette('${rec.id}', '${ri.id}')">×</button>
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
    `<input type="number" step="0.001" min="0" value="${currentQty}" id="edit-qty-${riId}" class="inline-input" style="width:70px" />`;
  document.getElementById(`ri-unite-${riId}`).innerHTML =
    `<input type="text" value="${currentUnite}" id="edit-unite-${riId}" class="inline-input" style="width:55px" />`;

  const row = document.getElementById(`ri-row-${riId}`);
  row.querySelector("td:last-child").innerHTML = `
    <button class="btn btn-xs btn-primary" onclick="saveIngredientInDetail('${recetteId}', '${riId}')">Sauvegarder</button>
    <button class="btn btn-xs btn-secondary" onclick="cancelIngredientEdit('${recetteId}', '${riId}', ${currentQty}, '${_escR(currentUnite)}')">Annuler</button>
  `;
}

async function saveIngredientInDetail(recetteId, riId) {
  const quantite = parseFloat(document.getElementById(`edit-qty-${riId}`).value);
  const unite = document.getElementById(`edit-unite-${riId}`).value.trim();
  if (isNaN(quantite) || quantite <= 0 || !unite) {
    showToast("Quantité et unité invalides", "error");
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
  document.getElementById(`ri-qty-${riId}`).innerHTML = originalQty;
  document.getElementById(`ri-unite-${riId}`).innerHTML = _escR(originalUnite);
  const row = document.getElementById(`ri-row-${riId}`);
  row.querySelector("td:last-child").innerHTML = `
    <button class="btn btn-xs btn-outline" onclick="editIngredientInDetail('${recetteId}', '${riId}', ${originalQty}, '${_escR(originalUnite)}')">Modifier</button>
    <button class="btn btn-xs btn-danger" onclick="removeIngredientFromRecette('${recetteId}', '${riId}')">×</button>
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
  // Auto-remplir l'unité selon l'ingrédient sélectionné
  sel.onchange = function () {
    const opt = this.options[this.selectedIndex];
    const unite = opt ? opt.dataset.unite || "" : "";
    if (unite) document.getElementById("ri-unite").value = unite;
  };
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
