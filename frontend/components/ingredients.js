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
    container.innerHTML =
      '<p class="empty-state">Aucun ingrédient. Cliquez sur « Ajouter » pour commencer.</p>';
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
    showToast("Erreur : " + err.message, "error");
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
          <tr>
            <td>${_esc(p.magasin)}</td>
            <td>${parseFloat(p.prix).toFixed(2)} €</td>
            <td>${p.quantite_reference} ${_esc(p.unite_reference)}</td>
            <td>${(parseFloat(p.prix) / parseFloat(p.quantite_reference)).toFixed(3)} €/${_esc(p.unite_reference)}</td>
            <td>
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
