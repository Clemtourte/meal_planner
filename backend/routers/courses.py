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
from backend.models.courses import ListeCourses, LigneCoursesItem

router = APIRouter()


async def _run(fn: Any) -> Any:
    """Exécute un appel Supabase synchrone dans un thread (async-safe)."""
    return await asyncio.to_thread(fn)


async def _build_liste(debut: date, db: Client) -> ListeCourses:
    """
    Génère la liste de courses agrégée pour la semaine commençant à 'debut'.

    Calcul :
        quantite_ajustee = quantite_recette × (nb_personnes / nb_portions)
    Les quantités sont sommées par ingredient_id, puis groupées par catégorie.
    Le coût estimé est calculé avec le prix le moins cher disponible par unité.
    """
    fin = debut + timedelta(days=6)

    # 1. Récupérer tous les repas de la semaine avec leurs recettes
    repas_result = await _run(
        lambda: db.table("semaine_repas")
        .select("*, recettes(id, nb_portions)")
        .gte("date", str(debut))
        .lte("date", str(fin))
        .execute()
    )

    if not repas_result.data:
        return ListeCourses(
            semaine_debut=str(debut),
            semaine_fin=str(fin),
            items_par_categorie={},
            cout_total_estime=None,
        )

    # 2. Agréger les quantités par ingrédient
    ingredient_totals: dict[str, dict] = {}

    for repas in repas_result.data:
        recette = repas.get("recettes")
        if not repas.get("recette_id") or not recette:
            continue

        nb_personnes: int = repas["nb_personnes"]
        nb_portions: int = recette["nb_portions"]
        ratio: float = nb_personnes / nb_portions

        ri_result = await _run(
            lambda r_id=str(repas["recette_id"]): db.table("recette_ingredients")
            .select("*, ingredients(nom, unite_defaut, categorie)")
            .eq("recette_id", r_id)
            .execute()
        )

        for ri in ri_result.data:
            ing = ri.get("ingredients") or {}
            if not ing:
                continue
            ingredient_id: str = ri["ingredient_id"]
            quantite_ajustee: float = float(ri["quantite"]) * ratio

            if ingredient_id not in ingredient_totals:
                ingredient_totals[ingredient_id] = {
                    "ingredient_id": ingredient_id,
                    "nom": ing["nom"],
                    "categorie": ing.get("categorie"),
                    "quantite_totale": 0.0,
                    "unite": ri["unite"],
                }
            ingredient_totals[ingredient_id]["quantite_totale"] += quantite_ajustee

    # 3. Calculer les coûts estimés depuis la table prix
    cout_total = 0.0
    has_prix = False

    if ingredient_totals:
        ingredient_ids = list(ingredient_totals.keys())
        prix_result = await _run(
            lambda: db.table("prix").select("*").in_("ingredient_id", ingredient_ids).execute()
        )

        prix_by_ingredient: dict[str, list] = defaultdict(list)
        for p in prix_result.data:
            prix_by_ingredient[p["ingredient_id"]].append(p)

        for ing_id, totals in ingredient_totals.items():
            prix_list = prix_by_ingredient.get(ing_id, [])
            if prix_list:
                # Prix le moins cher à la quantité de référence
                best = min(
                    prix_list,
                    key=lambda p: float(p["prix"]) / float(p["quantite_reference"]),
                )
                prix_par_unite = float(best["prix"]) / float(best["quantite_reference"])
                cout_ing = prix_par_unite * totals["quantite_totale"]
                totals["cout_estime"] = round(cout_ing, 2)
                totals["magasin_moins_cher"] = best["magasin"]
                cout_total += cout_ing
                has_prix = True

    # 4. Grouper par catégorie
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

    # Trier chaque catégorie par nom d'ingrédient
    for cat_items in items_par_categorie.values():
        cat_items.sort(key=lambda x: x.nom)

    return ListeCourses(
        semaine_debut=str(debut),
        semaine_fin=str(fin),
        items_par_categorie=dict(sorted(items_par_categorie.items())),
        cout_total_estime=round(cout_total, 2) if has_prix else None,
    )


@router.get("/", response_model=ListeCourses)
async def get_liste_courses(debut: date, db: Client = Depends(get_supabase)) -> ListeCourses:
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
        "CustomTitle",
        parent=styles["Title"],
        fontSize=18,
        spaceAfter=6,
    )
    subtitle_style = ParagraphStyle(
        "Subtitle",
        parent=styles["Normal"],
        fontSize=11,
        textColor=colors.HexColor("#52B788"),
        spaceAfter=12,
    )
    category_style = ParagraphStyle(
        "CategoryTitle",
        parent=styles["Heading2"],
        fontSize=13,
        spaceBefore=14,
        spaceAfter=4,
        textColor=colors.HexColor("#2D6A4F"),
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

    col_widths = [5.5 * cm, 2.5 * cm, 2.5 * cm, 3 * cm, 3 * cm]

    for categorie, items in liste.items_par_categorie.items():
        story.append(Paragraph(categorie, category_style))

        table_data = [["Ingrédient", "Quantité", "Unité", "Coût estimé", "Magasin"]]
        for item in items:
            cout = f"{item.cout_estime:.2f} €" if item.cout_estime is not None else "—"
            magasin = item.magasin_moins_cher or "—"
            table_data.append(
                [item.nom, f"{item.quantite_totale:g}", item.unite, cout, magasin]
            )

        table = Table(table_data, colWidths=col_widths)
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2D6A4F")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                    ("ALIGN", (1, 0), (-1, -1), "CENTER"),
                    (
                        "ROWBACKGROUNDS",
                        (0, 1),
                        (-1, -1),
                        [colors.white, colors.HexColor("#F1FAF5")],
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
        headers={
            "Content-Disposition": f'attachment; filename="courses_{debut}.pdf"'
        },
    )
