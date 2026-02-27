/**
 * courses.js — Liste de courses agrégée pour une semaine, avec export PDF.
 */

let _coursesWeekStart = null;
let _lastCoursesData = null;

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
          <tr>
            <td>${_escCo(item.nom)}</td>
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
      ? magasins.sort(([, a], [, b]) => b - a)[0][0]
      : null;

  try {
    await apiPost("/budgets/historique", {
      semaine_debut: debutStr,
      montant_estime: data.cout_total_estime,
      magasin_choisi: magasinChoisi,
    });
    showToast("Dépense enregistrée dans l'historique ✓");
  } catch (err) {
    showToast("Erreur : " + err.message, "error");
  }
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

function _escCo(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
