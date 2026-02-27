/**
 * ingredients.js — Gestion des ingrédients et des prix par magasin.
 */

let _ingredients = [];
let _editingIngredientId = null;

async function initIngredients() {
  await _loadIngredients();
  _renderIngredients();
  _bindIngredientEvents();
}

async function _loadIngredients() {
  try {
    _ingredients = await apiGet("/ingredients");
  } catch (err) {
    showToast("Erreur chargement ingrédients : " + err.message, "error");
    _ingredients = [];
  }
}

function _renderIngredients() {
  const container = document.getElementById("ingredients-container");

  if (_ingredients.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
             stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/>
          <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
        </svg>
        <p>Votre garde-manger est vide.</p>
        <small>Cliquez sur « Ajouter » pour enregistrer vos premiers ingrédients.</small>
      </div>`;
    return;
  }

  // Grouper par catégorie
  const byCategory = {};
  _ingredients.forEach((ing) => {
    const cat = ing.categorie || "Sans catégorie";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(ing);
  });

  container.innerHTML = Object.entries(byCategory)
    .sort(([a], [b]) => a.localeCompare(b, "fr"))
    .map(
      ([cat, ings]) => `
      <div class="category-group">
        <h3 class="category-label">${_esc(cat)}</h3>
        <div class="ingredient-grid">
          ${ings.map(_renderIngredientCard).join("")}
        </div>
      </div>`
    )
    .join("");
}

function _renderIngredientCard(ing) {
  return `
    <div class="card ingredient-card" id="ing-card-${ing.id}">
      <div class="card-header">
        <div class="card-title">
          <span class="ing-nom">${_esc(ing.nom)}</span>
          <span class="badge">${_esc(ing.unite_defaut)}</span>
        </div>
        <div class="card-actions">
          <button class="btn btn-sm btn-outline" onclick="openEditIngredient('${ing.id}')">Modifier</button>
          <button class="btn btn-sm btn-danger" onclick="confirmDeleteIngredient('${ing.id}', '${_esc(ing.nom)}')">Supprimer</button>
        </div>
      </div>
      <div class="prix-toggle">
        <button class="btn btn-link" onclick="togglePrix('${ing.id}', this)">
          ▶ Prix par magasin
        </button>
        <div class="prix-panel" id="prix-panel-${ing.id}" style="display:none"></div>
      </div>
    </div>`;
}

function _bindIngredientEvents() {
  // Bouton "Ajouter un ingrédient"
  const btn = document.getElementById("btn-add-ingredient");
  if (btn) {
    btn.onclick = () => openAddIngredient();
  }

  // Formulaire de la modale
  const form = document.getElementById("form-ingredient");
  if (form) {
    form.onsubmit = (e) => submitIngredientForm(e);
  }
}

// ---------------------------------------------------------------------------
// Modale ingrédient
// ---------------------------------------------------------------------------

function openAddIngredient() {
  _editingIngredientId = null;
  document.getElementById("modal-ingredient-title").textContent = "Nouvel ingrédient";
  document.getElementById("form-ingredient").reset();
  showModal("modal-ingredient");
}

function openEditIngredient(id) {
  const ing = _ingredients.find((i) => i.id === id);
  if (!ing) return;
  _editingIngredientId = id;
  document.getElementById("modal-ingredient-title").textContent = "Modifier l'ingrédient";
  document.getElementById("ing-nom").value = ing.nom;
  document.getElementById("ing-unite").value = ing.unite_defaut;
  document.getElementById("ing-categorie").value = ing.categorie || "";
  showModal("modal-ingredient");
}

async function submitIngredientForm(e) {
  e.preventDefault();
  const data = {
    nom: document.getElementById("ing-nom").value.trim(),
    unite_defaut: document.getElementById("ing-unite").value.trim(),
    categorie: document.getElementById("ing-categorie").value.trim() || null,
  };

  try {
    if (_editingIngredientId) {
      await apiPatch(`/ingredients/${_editingIngredientId}`, data);
      showToast("Ingrédient modifié ✓");
    } else {
      await apiPost("/ingredients", data);
      showToast("Ingrédient ajouté ✓");
    }
    hideModal("modal-ingredient");
    await _loadIngredients();
    _renderIngredients();
  } catch (err) {
    showToast("Erreur : " + err.message, "error");
  }
}

async function confirmDeleteIngredient(id, nom) {
  if (!confirm(`Supprimer l'ingrédient « ${nom} » ?`)) return;
  try {
    await apiDelete(`/ingredients/${id}`);
    showToast("Ingrédient supprimé");
    await _loadIngredients();
    _renderIngredients();
  } catch (err) {
    const msg = err.message || "";
    if (
      msg.includes("utilisé dans") ||
      msg.includes("recettes") ||
      msg.includes("409")
    ) {
      showFKError(msg);
    } else {
      showToast("Erreur : " + msg, "error");
    }
  }
}

// ---------------------------------------------------------------------------
// Prix par magasin
// ---------------------------------------------------------------------------

async function togglePrix(ingId, btn) {
  const panel = document.getElementById(`prix-panel-${ingId}`);
  if (panel.style.display === "none") {
    panel.style.display = "block";
    btn.textContent = "▼ Prix par magasin";
    await _loadAndRenderPrix(ingId);
  } else {
    panel.style.display = "none";
    btn.textContent = "▶ Prix par magasin";
  }
}

async function _loadAndRenderPrix(ingId) {
  const panel = document.getElementById(`prix-panel-${ingId}`);
  panel.innerHTML = '<span class="loading-text">Chargement…</span>';
  try {
    const prix = await apiGet(`/ingredients/${ingId}/prix`);
    _renderPrix(ingId, prix);
  } catch (err) {
    panel.innerHTML = `<p class="error-text">Erreur : ${_esc(err.message)}</p>`;
  }
}

function _renderPrix(ingId, prix) {
  const panel = document.getElementById(`prix-panel-${ingId}`);

  const rows =
    prix.length === 0
      ? '<tr><td colspan="5" class="empty-cell">Aucun prix enregistré</td></tr>'
      : prix
          .map(
            (p) => `
          <tr id="prix-row-${p.id}">
            <td id="prix-mag-${p.id}">${_esc(p.magasin)}</td>
            <td id="prix-val-${p.id}">${parseFloat(p.prix).toFixed(2)} €</td>
            <td id="prix-qty-${p.id}">${p.quantite_reference} ${_esc(p.unite_reference)}</td>
            <td id="prix-pu-${p.id}">${(parseFloat(p.prix) / parseFloat(p.quantite_reference)).toFixed(3)} €/${_esc(p.unite_reference)}</td>
            <td id="prix-act-${p.id}">
              <button class="btn btn-xs btn-outline" onclick="editPrix('${ingId}', '${p.id}', '${_esc(p.magasin)}', ${p.prix}, ${p.quantite_reference}, '${_esc(p.unite_reference)}')">Modifier</button>
              <button class="btn btn-xs btn-danger" onclick="deletePrix('${ingId}', '${p.id}')">×</button>
            </td>
          </tr>`
          )
          .join("");

  panel.innerHTML = `
    <table class="prix-table">
      <thead>
        <tr>
          <th>Magasin</th><th>Prix</th><th>Qté réf.</th><th>Prix/unité</th><th></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <form class="prix-form" onsubmit="addPrix(event, '${ingId}')">
      <input type="text"   name="magasin"            placeholder="Magasin"      required>
      <input type="number" name="prix"                placeholder="Prix (€)"     step="0.01" min="0" required>
      <input type="number" name="quantite_reference"  placeholder="Qté réf."     step="0.001" min="0" required>
      <input type="text"   name="unite_reference"     placeholder="Unité (ex: kg)" required>
      <button type="submit" class="btn btn-sm btn-primary">+ Ajouter</button>
    </form>`;
}

function editPrix(ingId, prixId, magasin, prix, qtyRef, uniteRef) {
  const panel = document.getElementById(`prix-panel-${ingId}`);
  panel.innerHTML = `
    <div class="prix-edit-form">
      <p class="prix-edit-title">Modifier le prix — ${_esc(magasin)}</p>
      <div class="prix-edit-fields">
        <div class="form-group" style="margin:0">
          <label>Magasin</label>
          <input type="text" id="e-mag-${prixId}" value="${_esc(magasin)}" class="prix-edit-input" placeholder="Magasin" />
        </div>
        <div class="form-group" style="margin:0">
          <label>Prix (€)</label>
          <input type="number" id="e-val-${prixId}" value="${prix}" step="0.01" min="0" class="prix-edit-input" />
        </div>
        <div class="form-group" style="margin:0">
          <label>Qté de référence</label>
          <input type="number" id="e-qty-${prixId}" value="${qtyRef}" step="0.001" min="0" class="prix-edit-input" />
        </div>
        <div class="form-group" style="margin:0">
          <label>Unité (ex : kg, L)</label>
          <input type="text" id="e-unite-${prixId}" value="${_esc(uniteRef)}" class="prix-edit-input" placeholder="ex: kg" />
        </div>
      </div>
      <div class="form-actions" style="margin-top:0">
        <button class="btn btn-secondary btn-sm" onclick="_loadAndRenderPrix('${ingId}')">Annuler</button>
        <button class="btn btn-primary btn-sm" onclick="savePrix('${ingId}', '${prixId}')">Sauvegarder</button>
      </div>
    </div>`;
}

async function savePrix(ingId, prixId) {
  const magasin = document.getElementById(`e-mag-${prixId}`).value.trim();
  const prix = parseFloat(document.getElementById(`e-val-${prixId}`).value);
  const quantite_reference = parseFloat(document.getElementById(`e-qty-${prixId}`).value);
  const unite_reference = document.getElementById(`e-unite-${prixId}`).value.trim();

  if (!magasin || isNaN(prix) || prix <= 0 || isNaN(quantite_reference) || quantite_reference <= 0 || !unite_reference) {
    showToast("Données invalides", "error");
    return;
  }
  try {
    await apiPatch(`/ingredients/${ingId}/prix/${prixId}`, {
      magasin, prix, quantite_reference, unite_reference,
    });
    showToast("Prix mis à jour ✓");
    await _loadAndRenderPrix(ingId);
  } catch (err) {
    showToast("Erreur : " + err.message, "error");
  }
}

async function addPrix(e, ingId) {
  e.preventDefault();
  const form = e.target;
  const data = {
    magasin: form.magasin.value.trim(),
    prix: parseFloat(form.prix.value),
    quantite_reference: parseFloat(form.quantite_reference.value),
    unite_reference: form.unite_reference.value.trim(),
  };
  try {
    await apiPost(`/ingredients/${ingId}/prix`, data);
    showToast("Prix ajouté ✓");
    form.reset();
    await _loadAndRenderPrix(ingId);
  } catch (err) {
    showToast("Erreur : " + err.message, "error");
  }
}

async function deletePrix(ingId, prixId) {
  try {
    await apiDelete(`/ingredients/${ingId}/prix/${prixId}`);
    showToast("Prix supprimé");
    await _loadAndRenderPrix(ingId);
  } catch (err) {
    showToast("Erreur : " + err.message, "error");
  }
}

// ---------------------------------------------------------------------------
// Utilitaire
// ---------------------------------------------------------------------------

function _esc(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
