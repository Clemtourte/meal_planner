/**
 * budget.js — Gestion du budget alimentaire hebdomadaire / mensuel.
 */

let _budgets = {};
let _historique = [];
let _currentWeekDebutStr = null;
let _currentWeekCout = null;
let _currentWeekMagasin = null;

async function initBudget() {
  await _loadBudgets();
  _renderBudgetForm();
  _bindBudgetForm();
  await _renderSemaineCourante();
  await _loadHistorique();
  _renderHistorique();
}

// ---------------------------------------------------------------------------
// Chargement
// ---------------------------------------------------------------------------

async function _loadBudgets() {
  try {
    const data = await apiGet("/budgets/actuel");
    _budgets = {};
    for (const b of data) {
      _budgets[b.type] = b;
    }
  } catch (err) {
    console.error("Erreur chargement budgets:", err);
    _budgets = {};
  }
}

async function _loadHistorique() {
  try {
    _historique = await apiGet("/budgets/historique");
  } catch (err) {
    console.error("Erreur chargement historique:", err);
    _historique = [];
  }
}

// ---------------------------------------------------------------------------
// Formulaire budget
// ---------------------------------------------------------------------------

function _renderBudgetForm() {
  const hebdo = _budgets.hebdomadaire?.montant || "";
  const mensuel = _budgets.mensuel?.montant || "";
  const inputHebdo = document.getElementById("budget-hebdo");
  const inputMensuel = document.getElementById("budget-mensuel");
  if (inputHebdo) inputHebdo.value = hebdo;
  if (inputMensuel) inputMensuel.value = mensuel;
}

function _bindBudgetForm() {
  const form = document.getElementById("form-budget");
  if (!form || form._budgetBound) return;
  form._budgetBound = true;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const hebdo = parseFloat(document.getElementById("budget-hebdo").value);
    const mensuel = parseFloat(document.getElementById("budget-mensuel").value);
    const today = new Date().toISOString().split("T")[0];
    try {
      if (!isNaN(hebdo) && hebdo > 0) {
        if (_budgets.hebdomadaire?.id) {
          await apiPatch(`/budgets/${_budgets.hebdomadaire.id}`, { montant: hebdo });
        } else {
          await apiPost("/budgets/", { type: "hebdomadaire", montant: hebdo, date_debut: today });
        }
      }
      if (!isNaN(mensuel) && mensuel > 0) {
        if (_budgets.mensuel?.id) {
          await apiPatch(`/budgets/${_budgets.mensuel.id}`, { montant: mensuel });
        } else {
          await apiPost("/budgets/", { type: "mensuel", montant: mensuel, date_debut: today });
        }
      }
      showToast("Budget enregistré ✓");
      await _loadBudgets();
      await _renderSemaineCourante();
    } catch (err) {
      showToast("Erreur : " + err.message, "error");
    }
  });
}

// ---------------------------------------------------------------------------
// Semaine en cours
// ---------------------------------------------------------------------------

async function _renderSemaineCourante() {
  const section = document.getElementById("budget-semaine-content");
  if (!section) return;

  const today = new Date();
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  today.setDate(today.getDate() + diff);
  const debutStr = today.toISOString().split("T")[0];

  const budgetHebdo = _budgets.hebdomadaire
    ? Number(_budgets.hebdomadaire.montant)
    : null;

  try {
    const data = await apiGet(`/courses/?debut=${debutStr}`);
    const cout = data.cout_total_estime;

    // Mémoriser pour le bouton Valider
    _currentWeekDebutStr = debutStr;
    _currentWeekCout = cout;
    const magasins = Object.entries(data.cout_par_magasin || {});
    _currentWeekMagasin =
      magasins.length > 0
        ? magasins.sort(([, a], [, b]) => b - a)[0][0]
        : null;

    if (cout === null) {
      section.innerHTML =
        '<p class="empty-state">Aucun coût estimé pour la semaine en cours (aucun prix renseigné).</p>';
      return;
    }

    const pct =
      budgetHebdo !== null
        ? Math.min(100, Math.round((cout / budgetHebdo) * 100))
        : null;
    const restant = budgetHebdo !== null ? budgetHebdo - cout : null;
    const barClass =
      pct === null ? "ok" : pct >= 100 ? "danger" : pct >= 80 ? "warning" : "ok";

    const kpiHebdo =
      budgetHebdo !== null
        ? `<div class="budget-kpi">
             <span class="budget-kpi-label">Budget hebdo.</span>
             <span class="budget-kpi-value">${budgetHebdo.toFixed(2)} €</span>
           </div>
           <div class="budget-kpi${restant < 0 ? " budget-kpi--over" : ""}">
             <span class="budget-kpi-label">Restant</span>
             <span class="budget-kpi-value">
               ${restant >= 0 ? "" : "−"}${Math.abs(restant).toFixed(2)} €
             </span>
           </div>`
        : "";

    const progressBar =
      pct !== null
        ? `<div class="budget-progress-wrap">
             <div class="budget-progress-bar budget-progress--${barClass}"
                  style="width:${pct}%"></div>
           </div>
           <p class="budget-progress-label">${pct}% du budget hebdomadaire utilisé</p>`
        : '<p class="budget-hint">Définissez un budget hebdomadaire pour voir la progression.</p>';

    section.innerHTML = `
      <div class="budget-kpi-grid">
        <div class="budget-kpi">
          <span class="budget-kpi-label">Coût estimé</span>
          <span class="budget-kpi-value">${cout.toFixed(2)} €</span>
        </div>
        ${kpiHebdo}
      </div>
      ${progressBar}
      <div class="btn-valider-courses" style="margin-top:12px">
        <button class="btn btn-outline btn-sm" onclick="_validateSemaineBudget()">
          ✓ Enregistrer dans l'historique
        </button>
      </div>
    `;
  } catch {
    section.innerHTML =
      '<p class="empty-state">Impossible de charger le coût de la semaine en cours.</p>';
  }
}

async function _validateSemaineBudget() {
  if (_currentWeekCout === null || !_currentWeekDebutStr) return;
  try {
    await apiPost("/budgets/historique", {
      semaine_debut: _currentWeekDebutStr,
      montant_estime: _currentWeekCout,
      magasin_choisi: _currentWeekMagasin,
    });
    showToast("Dépense enregistrée dans l'historique ✓");
    await _loadHistorique();
    _renderHistorique();
  } catch (err) {
    showToast("Erreur : " + err.message, "error");
  }
}

// ---------------------------------------------------------------------------
// Historique
// ---------------------------------------------------------------------------

function _renderHistorique() {
  const container = document.getElementById("budget-historique-content");
  if (!container) return;

  if (_historique.length === 0) {
    container.innerHTML =
      '<p class="empty-state">Aucune dépense enregistrée. Utilisez le bouton "Valider" dans l\'onglet Liste de courses.</p>';
    return;
  }

  const budgetHebdo = _budgets.hebdomadaire
    ? Number(_budgets.hebdomadaire.montant)
    : null;
  const last8 = _historique.slice(0, 8);
  const maxMontant = Math.max(...last8.map((h) => h.montant_estime));

  // CSS bar chart (last 8 weeks, newest first → reverse for display)
  const chartCols = [...last8].reverse().map((h) => {
    const pct =
      maxMontant > 0 ? Math.round((h.montant_estime / maxMontant) * 100) : 0;
    const overBudget = budgetHebdo !== null && h.montant_estime > budgetHebdo;
    const date = new Date(h.semaine_debut + "T00:00:00");
    const lbl = `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
    return `
      <div class="budget-chart-col">
        <span class="budget-chart-val">${h.montant_estime.toFixed(0)}€</span>
        <div class="budget-chart-bar-wrap">
          <div class="budget-chart-bar${overBudget ? " budget-chart-bar--over" : ""}"
               style="height:${pct}%"></div>
        </div>
        <span class="budget-chart-lbl">${lbl}</span>
      </div>`;
  });

  const barChart =
    last8.length > 1
      ? `<div class="budget-chart">${chartCols.join("")}</div>`
      : "";

  const tableRows = _historique
    .map((h) => {
      const ecart =
        budgetHebdo !== null ? h.montant_estime - budgetHebdo : null;
      const ecartHTML =
        ecart !== null
          ? `<span class="${ecart > 0 ? "text-danger" : "text-success"}">
               ${ecart > 0 ? "+" : ""}${ecart.toFixed(2)} €
             </span>`
          : "—";
      return `
        <tr>
          <td>${_escB(h.semaine_debut)}</td>
          <td class="text-center">${h.montant_estime.toFixed(2)} €</td>
          <td class="text-center">${_escB(h.magasin_choisi || "—")}</td>
          <td class="text-center">${ecartHTML}</td>
          <td class="text-center">
            <button class="btn btn-xs btn-danger" title="Supprimer"
              onclick="_deleteHistorique('${h.id}')">🗑</button>
          </td>
        </tr>`;
    })
    .join("");

  container.innerHTML = `
    ${barChart}
    <table class="detail-table budget-history-table">
      <thead>
        <tr>
          <th>Semaine</th>
          <th class="text-center">Coût estimé</th>
          <th class="text-center">Magasin principal</th>
          <th class="text-center">ÉCART</th>
          <th class="text-center"></th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
  `;
}

async function _deleteHistorique(id) {
  if (!confirm("Supprimer cette entrée de l'historique ?")) return;
  try {
    await apiDelete(`/budgets/historique/${id}`);
    showToast("Entrée supprimée");
    await _loadHistorique();
    _renderHistorique();
  } catch (err) {
    showToast("Erreur : " + err.message, "error");
  }
}

function _escB(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
