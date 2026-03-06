/**
 * courses.js — Liste de courses agrégée pour une semaine, avec export PDF.
 * Includes real-time collaborative check-off via 5s polling.
 */

let _coursesWeekStart = null;
let _lastCoursesData = null;
let _checksState = {}; // ingredient_id → CourseCheck object
let _pollInterval = null;
let _currentCheckedSemaine = null;

function initCourses() {
  if (!_coursesWeekStart) {
    _coursesWeekStart = _getCoursesMonday(new Date());
  }
  _renderCoursesDatePicker();
  _bindCoursesEvents();
}

function _getCoursesMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function _coursesDateToISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function _renderCoursesDatePicker() {
  const input = document.getElementById("courses-week-input");
  if (input) {
    input.value = _coursesDateToISO(_coursesWeekStart);
  }
  const label = document.getElementById("courses-week-label");
  if (label) {
    const fin = new Date(_coursesWeekStart);
    fin.setDate(fin.getDate() + 6);
    label.textContent = `Semaine du ${_fmtDate(_coursesWeekStart)} au ${_fmtDate(fin)}`;
  }
}

function _fmtDate(d) {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function _bindCoursesEvents() {
  const input = document.getElementById("courses-week-input");
  if (input) {
    input.onchange = () => {
      if (input.value) {
        const d = new Date(input.value + "T00:00:00");
        _coursesWeekStart = _getCoursesMonday(d);
        _renderCoursesDatePicker();
      }
    };
  }

  const btnGenerate = document.getElementById("btn-generate-courses");
  if (btnGenerate) btnGenerate.onclick = () => generateCourses();

  const btnPdf = document.getElementById("btn-export-pdf");
  if (btnPdf) btnPdf.onclick = () => exportPdf();
}

async function generateCourses() {
  const container = document.getElementById("courses-result");
  const btnPdf = document.getElementById("btn-export-pdf");
  container.innerHTML = '<p class="loading-text">Génération en cours…</p>';
  btnPdf.style.display = "none";

  try {
    const debutStr = _coursesDateToISO(_coursesWeekStart);
    const data = await apiGet(`/courses/?debut=${debutStr}`);
    _lastCoursesData = { data, debutStr };
    _renderCoursesList(data);
    btnPdf.style.display = "inline-flex";

    // Charger et appliquer les checks, puis démarrer le polling
    _currentCheckedSemaine = debutStr;
    await _loadAndApplyChecks(debutStr);
    _startPolling(debutStr);

    // Déléguer le clic sur les lignes pour le check-off
    container.onclick = (e) => {
      const row = e.target.closest(".courses-category tbody tr[data-ingredient-id]");
      if (row) _toggleCheck(row.dataset.ingredientId, _currentCheckedSemaine);
    };
  } catch (err) {
    container.innerHTML = `<p class="error-text">Erreur : ${_escCo(err.message)}</p>`;
    showToast("Erreur génération : " + err.message, "error");
  }
}

function _renderCoursesList(data) {
  const container = document.getElementById("courses-result");

  if (Object.keys(data.items_par_categorie).length === 0) {
    container.innerHTML =
      '<p class="empty-state">Aucun repas planifié pour cette semaine.</p>';
    return;
  }

  const totalHTML =
    data.cout_total_estime !== null
      ? `<div class="courses-total">
           <span>Coût total estimé</span>
           <span class="courses-total-amount">${data.cout_total_estime.toFixed(2)} €</span>
         </div>`
      : "";

  // Comparatif par magasin
  const magasinEntries = Object.entries(data.cout_par_magasin || {});
  const magasinHTML =
    magasinEntries.length > 1
      ? `<div class="magasin-comparatif">
           <h3 class="category-label">Répartition par magasin</h3>
           <table class="courses-table">
             <thead><tr><th>Magasin</th><th class="text-center">Coût estimé</th></tr></thead>
             <tbody>
               ${magasinEntries
                 .map(
                   ([mag, cout]) =>
                     `<tr><td>${_escCo(mag)}</td><td class="text-center courses-cout">${cout.toFixed(2)} €</td></tr>`
                 )
                 .join("")}
             </tbody>
           </table>
         </div>`
      : "";

  const categoriesHTML = Object.entries(data.items_par_categorie)
    .map(([cat, items]) => {
      const rows = items
        .map((item) => {
          const cout =
            item.cout_estime !== null ? `${item.cout_estime.toFixed(2)} €` : "—";
          const magasin = item.magasin_moins_cher || "—";
          return `
          <tr data-ingredient-id="${item.ingredient_id}" style="cursor:pointer">
            <td>
              ${_escCo(item.nom)}
              <span class="check-by-info" style="display:none;font-size:0.7em;color:#888;margin-left:6px"></span>
            </td>
            <td class="text-center">${item.quantite_totale % 1 === 0 ? item.quantite_totale : item.quantite_totale.toFixed(3)}</td>
            <td class="text-center">${_escCo(item.unite)}</td>
            <td class="text-center courses-cout">${cout}</td>
            <td class="text-center">${_escCo(magasin)}</td>
          </tr>`;
        })
        .join("");

      return `
      <div class="courses-category">
        <h3 class="category-label">${_escCo(cat)}</h3>
        <table class="courses-table">
          <thead>
            <tr>
              <th>Ingrédient</th>
              <th class="text-center">Quantité</th>
              <th class="text-center">Unité</th>
              <th class="text-center">Coût estimé</th>
              <th class="text-center">Magasin</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
    })
    .join("");

  const validerHTML =
    data.cout_total_estime !== null
      ? `<div class="btn-valider-courses">
           <button class="btn btn-outline" onclick="validateCourses()">
             ✓ Valider et enregistrer dans l'historique
           </button>
         </div>`
      : "";

  container.innerHTML = totalHTML + magasinHTML + categoriesHTML + validerHTML;
}

async function validateCourses() {
  if (!_lastCoursesData) return;
  const { data, debutStr } = _lastCoursesData;
  const magasins = Object.entries(data.cout_par_magasin || {});
  const magasinChoisi =
    magasins.length > 0
      ? magasins.sort(([, a], [, b]) => a - b)[0][0] // magasin le moins cher
      : null;

  try {
    const finStr = _coursesDateToISO(_addDays(new Date(debutStr + "T00:00:00"), 6));
    const sorties = await apiGet(`/sorties/?debut=${debutStr}&fin=${finStr}`);
    const sortiesTotal = sorties.reduce(
      (sum, s) => sum + Number(s.montant || 0),
      0
    );
    await apiPost("/budgets/historique", {
      semaine_debut: debutStr,
      montant_estime: (data.cout_total_estime ?? 0) + sortiesTotal,
      magasin_choisi: magasinChoisi,
    });
    showToast("Dépense enregistrée dans l'historique ✓");
  } catch (err) {
    showToast("Erreur : " + err.message, "error");
  }
}

function _addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

async function exportPdf() {
  const debutStr = _coursesDateToISO(_coursesWeekStart);
  const url = `${BASE_URL}/courses/pdf?debut=${debutStr}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Erreur serveur PDF");
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `courses_${debutStr}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
    showToast("PDF téléchargé ✓");
  } catch (err) {
    showToast("Erreur export PDF : " + err.message, "error");
  }
}

// ---------------------------------------------------------------------------
// Checks collaboratifs
// ---------------------------------------------------------------------------

async function _loadAndApplyChecks(semaine) {
  try {
    const checks = await apiGet(`/courses/checks?semaine=${semaine}`);
    _checksState = {};
    for (const c of checks) {
      _checksState[c.ingredient_id] = c;
    }
    _applyChecksToUI();
  } catch (e) {
    console.warn("Checks unavailable:", e.message);
  }
}

function _applyChecksToUI() {
  document
    .querySelectorAll(".courses-category tbody tr[data-ingredient-id]")
    .forEach((row) => {
      const ingId = row.dataset.ingredientId;
      const check = _checksState[ingId];
      const bySpan = row.querySelector(".check-by-info");
      if (check?.checked) {
        row.classList.add("item-checked");
        if (bySpan) {
          bySpan.textContent = `✓ ${check.checked_by || "autre utilisateur"}`;
          bySpan.style.display = "inline";
        }
      } else {
        row.classList.remove("item-checked");
        if (bySpan) bySpan.style.display = "none";
      }
    });
}

async function _toggleCheck(ingredientId, semaine) {
  const current = _checksState[ingredientId];
  const newChecked = !current?.checked;
  try {
    const updated = await apiPut(`/courses/checks/${ingredientId}`, {
      semaine_debut: semaine,
      checked: newChecked,
    });
    _checksState[ingredientId] = updated;
    _applyChecksToUI();
  } catch (e) {
    showToast("Erreur synchro : " + e.message, "error");
  }
}

function _startPolling(semaine) {
  _stopPolling();
  _pollInterval = setInterval(async () => {
    if (currentTab !== "courses" || document.visibilityState === "hidden") return;
    await _loadAndApplyChecks(semaine);
  }, 5000);
}

function _stopPolling() {
  if (_pollInterval) {
    clearInterval(_pollInterval);
    _pollInterval = null;
  }
}

function _escCo(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
