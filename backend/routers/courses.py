"""Router FastAPI pour la liste de courses et l'export PDF."""

import asyncio
from collections import defaultdict
from datetime import date, timedelta
from io import BytesIO
from typing import Any

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from supabase import Client

from backend.database import get_supabase
from backend.models.courses import LigneCoursesItem, ListeCourses

router = APIRouter()

# ---------------------------------------------------------------------------
# Normalisation des unités vers l'unité de base
# ---------------------------------------------------------------------------

# (unite_base, facteur) : quantite_base = quantite_source × facteur
_UNIT_TO_BASE: dict[str, tuple[str, float]] = {
    # Masse
    "kg": ("g", 1000.0),
    "Kg": ("g", 1000.0),
    "KG": ("g", 1000.0),
    "kilo": ("g", 1000.0),
    "kilos": ("g", 1000.0),
    # Volume
    "l": ("ml", 1000.0),
    "L": ("ml", 1000.0),
    "litre": ("ml", 1000.0),
    "litres": ("ml", 1000.0),
    "liter": ("ml", 1000.0),
    "liters": ("ml", 1000.0),
    "cl": ("ml", 10.0),
    "CL": ("ml", 10.0),
    "dl": ("ml", 100.0),
    "DL": ("ml", 100.0),
}


def _to_base(quantite: float, unite: str) -> tuple[float, str]:
    """Convertit une quantité vers son unité de base (g, ml, ou inchangée)."""
    conv = _UNIT_TO_BASE.get(unite)
    if conv:
        base_unite, factor = conv
        return quantite * factor, base_unite
    return quantite, unite


def _fmt_qty(qty: float) -> str:
    """Formate un nombre : supprime les zéros décimaux inutiles."""
    if qty == int(qty):
        return str(int(qty))
    # Arrondi à 3 décimales max, sans zéros trailing
    return f"{qty:.3f}".rstrip("0").rstrip(".")


# ---------------------------------------------------------------------------
# Helpers async
# ---------------------------------------------------------------------------


async def _run(fn: Any) -> Any:
    """Exécute un appel Supabase synchrone dans un thread (async-safe)."""
    return await asyncio.to_thread(fn)


# ---------------------------------------------------------------------------
# Construction de la liste de courses
# ---------------------------------------------------------------------------


async def _build_liste(debut: date, db: Client) -> ListeCourses:
    """
    Génère la liste de courses agrégée pour la semaine commençant à 'debut'.

    Calcul :
        quantite_ajustee = quantite_recette × (nb_personnes / nb_portions)
    Les unités sont normalisées (kg→g, L→ml, cl→ml…) avant sommation.
    Agrégation par (ingredient_id, unite_normalisee) pour éviter les
    mélanges d'unités incompatibles.
    Le coût estimé utilise le prix le moins cher compatible par unité.
    """
    fin = debut + timedelta(days=6)

    # 1. Repas de la semaine avec leur recette
    repas_result = await _run(
        lambda: (
            db.table("semaine_repas")
            .select("*, recettes(id, nb_portions)")
            .gte("date", str(debut))
            .lte("date", str(fin))
            .execute()
        )
    )

    if not repas_result.data:
        return ListeCourses(
            semaine_debut=str(debut),
            semaine_fin=str(fin),
            items_par_categorie={},
            cout_total_estime=None,
        )

    # 2. Agréger par clé composite "ingredient_id|unite_base"
    ingredient_totals: dict[str, dict] = {}

    for repas in repas_result.data:
        recette = repas.get("recettes")
        if not repas.get("recette_id") or not recette:
            continue

        nb_personnes: int = repas["nb_personnes"]
        nb_portions: int = recette["nb_portions"]
        ratio: float = nb_personnes / nb_portions

        ri_result = await _run(
            lambda r_id=str(repas["recette_id"]): (
                db.table("recette_ingredients")
                .select("*, ingredients(nom, unite_defaut, categorie)")
                .eq("recette_id", r_id)
                .execute()
            )
        )

        for ri in ri_result.data:
            ing = ri.get("ingredients") or {}
            if not ing:
                continue
            ingredient_id: str = ri["ingredient_id"]
            quantite_ajustee = float(ri["quantite"]) * ratio
            norm_qty, norm_unite = _to_base(quantite_ajustee, ri["unite"])

            # Clé = id + unité normalisée pour sommer proprement
            key = f"{ingredient_id}|{norm_unite}"
            if key not in ingredient_totals:
                ingredient_totals[key] = {
                    "ingredient_id": ingredient_id,
                    "nom": ing["nom"],
                    "categorie": ing.get("categorie"),
                    "quantite_totale": 0.0,
                    "unite": norm_unite,
                }
            ingredient_totals[key]["quantite_totale"] += norm_qty

    # 3. Coûts estimés — normaliser aussi les prix de référence
    cout_total = 0.0
    has_prix = False

    if ingredient_totals:
        ingredient_ids = list({t["ingredient_id"] for t in ingredient_totals.values()})
        prix_result = await _run(
            lambda: (
                db.table("prix")
                .select("*")
                .in_("ingredient_id", ingredient_ids)
                .execute()
            )
        )

        prix_by_ingredient: dict[str, list] = defaultdict(list)
        for p in prix_result.data:
            prix_by_ingredient[p["ingredient_id"]].append(p)

        for totals in ingredient_totals.values():
            ing_id = totals["ingredient_id"]
            unite_item = totals["unite"]
            prix_list = prix_by_ingredient.get(ing_id, [])
            if not prix_list:
                continue

            # Garder uniquement les prix dont l'unité de référence normalisée
            # correspond à l'unité de l'article (sinon les calculs seraient absurdes)
            compatible: list[tuple] = []
            for p in prix_list:
                ref_qty_base, ref_unite_base = _to_base(
                    float(p["quantite_reference"]), p["unite_reference"]
                )
                if ref_unite_base == unite_item:
                    compatible.append((p, ref_qty_base))

            if not compatible:
                continue

            best_p, best_ref_qty = min(
                compatible,
                key=lambda x: float(x[0]["prix"]) / x[1],
            )
            prix_par_unite = float(best_p["prix"]) / best_ref_qty
            cout_ing = prix_par_unite * totals["quantite_totale"]
            totals["cout_estime"] = round(cout_ing, 2)
            totals["magasin_moins_cher"] = best_p["magasin"]
            cout_total += cout_ing
            has_prix = True

    # 3b. Coûts par magasin
    cout_par_magasin: dict[str, float] = {}
    for totals in ingredient_totals.values():
        mag = totals.get("magasin_moins_cher")
        if mag and "cout_estime" in totals:
            cout_par_magasin[mag] = (
                cout_par_magasin.get(mag, 0.0) + totals["cout_estime"]
            )
    cout_par_magasin = {k: round(v, 2) for k, v in sorted(cout_par_magasin.items())}

    # 4. Grouper par catégorie, trier par nom
    items_par_categorie: dict[str, list[LigneCoursesItem]] = defaultdict(list)
    for totals in ingredient_totals.values():
        categorie = totals.get("categorie") or "Autre"
        item = LigneCoursesItem(
            ingredient_id=totals["ingredient_id"],
            nom=totals["nom"],
            categorie=totals.get("categorie"),
            quantite_totale=round(totals["quantite_totale"], 3),
            unite=totals["unite"],
            cout_estime=totals.get("cout_estime"),
            magasin_moins_cher=totals.get("magasin_moins_cher"),
        )
        items_par_categorie[categorie].append(item)

    for cat_items in items_par_categorie.values():
        cat_items.sort(key=lambda x: x.nom)

    return ListeCourses(
        semaine_debut=str(debut),
        semaine_fin=str(fin),
        items_par_categorie=dict(sorted(items_par_categorie.items())),
        cout_total_estime=round(cout_total, 2) if has_prix else None,
        cout_par_magasin=cout_par_magasin,
    )


@router.get("/", response_model=ListeCourses)
async def get_liste_courses(
    debut: date, db: Client = Depends(get_supabase)
) -> ListeCourses:
    """Génère la liste de courses pour la semaine commençant à la date 'debut'."""
    return await _build_liste(debut, db)


@router.get("/pdf")
async def export_pdf(debut: date, db: Client = Depends(get_supabase)) -> Response:
    """Exporte la liste de courses en PDF via reportlab."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import cm
    from reportlab.platypus import (
        Paragraph,
        SimpleDocTemplate,
        Spacer,
        Table,
        TableStyle,
    )

    liste = await _build_liste(debut, db)

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2 * cm,
        leftMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "CustomTitle", parent=styles["Title"], fontSize=18, spaceAfter=6
    )
    subtitle_style = ParagraphStyle(
        "Subtitle",
        parent=styles["Normal"],
        fontSize=11,
        textColor=colors.HexColor("#7C9A7E"),
        spaceAfter=12,
    )
    category_style = ParagraphStyle(
        "CategoryTitle",
        parent=styles["Heading2"],
        fontSize=13,
        spaceBefore=14,
        spaceAfter=4,
        textColor=colors.HexColor("#4A7C59"),
    )

    story = []
    story.append(
        Paragraph(
            f"Liste de courses — {liste.semaine_debut} au {liste.semaine_fin}",
            title_style,
        )
    )
    if liste.cout_total_estime is not None:
        story.append(
            Paragraph(
                f"Coût total estimé : {liste.cout_total_estime:.2f} €",
                subtitle_style,
            )
        )
    story.append(Spacer(1, 0.4 * cm))

    col_widths = [5.5 * cm, 3.5 * cm, 3 * cm, 3 * cm]

    for categorie, items in liste.items_par_categorie.items():
        story.append(Paragraph(categorie, category_style))
        table_data = [["Ingrédient", "Quantité", "Coût estimé", "Magasin"]]
        for item in items:
            qty_str = f"{_fmt_qty(item.quantite_totale)} {item.unite}"
            cout = f"{item.cout_estime:.2f} €" if item.cout_estime is not None else "—"
            magasin = item.magasin_moins_cher or "—"
            table_data.append([item.nom, qty_str, cout, magasin])

        table = Table(table_data, colWidths=col_widths)
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4A7C59")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                    ("ALIGN", (1, 0), (-1, -1), "CENTER"),
                    (
                        "ROWBACKGROUNDS",
                        (0, 1),
                        (-1, -1),
                        [colors.white, colors.HexColor("#F0F5F0")],
                    ),
                    ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CCCCCC")),
                    ("TOPPADDING", (0, 0), (-1, -1), 5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ]
            )
        )
        story.append(table)
        story.append(Spacer(1, 0.3 * cm))

    doc.build(story)
    buffer.seek(0)

    return Response(
        content=buffer.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="courses_{debut}.pdf"'},
    )
