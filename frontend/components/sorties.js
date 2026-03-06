/**
 * sorties.js — Gestion des sorties resto et commandes.
 */

let _sorties = [];
let _editingSortieId = null;

async function initSorties() {
  await _loadSorties();
  _renderSorties();
  _bindSortiesEvents();
}

async function _loadSorties() {
  try {
    _sorties = await apiGet("/sorties/");
  } catch (err) {
    showToast("Erreur chargement sorties : " + err.message, "error");
    _sorties = [];
  }
}

function _bindSortiesEvents() {
  const btn = document.getElementById("btn-add-sortie");
  if (btn) btn.onclick = () => openAddSortie();

  const form = document.getElementById("form-sortie");
  if (form && !form._bound) {
    form._bound = true;
    form.onsubmit = (e) => submitSortieForm(e);
  }
}

function _renderSorties() {
  const container = document.getElementById("sorties-container");
  if (!container) return;

  if (_sorties.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
             stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 9l1-7h16l1 7"/>
          <path d="M5 22V10h14v12"/>
          <path d="M9 22V14h6v8"/>
        </svg>
        <p>Aucune sortie enregistrée.</p>
        <small>Ajoutez vos restos et commandes pour les suivre ici.</small>
      </div>`;
    return;
  }

  container.innerHTML = _sorties
    .map((s) => {
      const typeLabel = s.type === "commande" ? "Commande" : "Restaurant";
      const badgeClass = s.type === "commande" ? "badge-sortie badge-sortie--cmd" : "badge-sortie";
      return `
        <div class="card sortie-card" id="sortie-card-${s.id}">
          <div class="card-header">
            <div class="card-title">
              <span class="${badgeClass}">${typeLabel}</span>
              <span class="sortie-title">${_escS(s.titre)}</span>
            </div>
            <div class="card-actions">
              <button class="btn btn-sm btn-outline" onclick="openEditSortie('${s.id}')">Modifier</button>
              <button class="btn btn-sm btn-danger" onclick="confirmDeleteSortie('${s.id}', '${_escS(s.titre)}')">Supprimer</button>
            </div>
          </div>
          <div class="sortie-meta">
            <span class="sortie-date">${_formatSortieDate(s.date)}</span>
            <span class="sortie-montant">${Number(s.montant).toFixed(2)} €</span>
          </div>
          ${s.notes ? `<p class="sortie-notes">${_escS(s.notes)}</p>` : ""}
        </div>`;
    })
    .join("");
}

function openAddSortie() {
  _editingSortieId = null;
  document.getElementById("modal-sortie-title").textContent = "Nouvelle sortie";
  document.getElementById("form-sortie").reset();
  document.getElementById("sortie-date").value = new Date().toISOString().split("T")[0];
  document.getElementById("sortie-type").value = "restaurant";
  showModal("modal-sortie");
}

function openEditSortie(id) {
  const s = _sorties.find((x) => x.id === id);
  if (!s) return;
  _editingSortieId = id;
  document.getElementById("modal-sortie-title").textContent = "Modifier la sortie";
  document.getElementById("sortie-date").value = s.date;
  document.getElementById("sortie-type").value = s.type;
  document.getElementById("sortie-titre").value = s.titre;
  document.getElementById("sortie-montant").value = s.montant;
  document.getElementById("sortie-notes").value = s.notes || "";
  showModal("modal-sortie");
}

async function submitSortieForm(e) {
  e.preventDefault();
  const payload = {
    date: document.getElementById("sortie-date").value,
    type: document.getElementById("sortie-type").value,
    titre: document.getElementById("sortie-titre").value.trim(),
    montant: parseFloat(document.getElementById("sortie-montant").value),
    notes: document.getElementById("sortie-notes").value.trim() || null,
  };
  try {
    if (_editingSortieId) {
      await apiPatch(`/sorties/${_editingSortieId}`, payload);
      showToast("Sortie modifiée ✓");
    } else {
      await apiPost("/sorties/", payload);
      showToast("Sortie ajoutée ✓");
    }
    hideModal("modal-sortie");
    await _loadSorties();
    _renderSorties();
  } catch (err) {
    showToast("Erreur : " + err.message, "error");
  }
}

async function confirmDeleteSortie(id, titre) {
  if (!confirm(`Supprimer « ${titre} » ?`)) return;
  try {
    await apiDelete(`/sorties/${id}`);
    showToast("Sortie supprimée");
    await _loadSorties();
    _renderSorties();
  } catch (err) {
    showToast("Erreur : " + err.message, "error");
  }
}

function _formatSortieDate(dateStr) {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function _escS(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
