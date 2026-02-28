"""Script de seed des donnees de demo via l'API Meal Planner.

Usage :
    python -m backend.scripts.seed_demo
    # ou depuis la racine du projet avec le venv active
"""

import sys

import httpx

BASE_URL = "http://localhost:8000/api"
HEADERS = {"X-User-ID": "default_user", "Content-Type": "application/json"}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def step(msg: str) -> None:
    """Affiche une etape en cours."""
    print(f"\n>> {msg}")


def ok(msg: str) -> None:
    """Affiche un succes."""
    print(f"   [OK] {msg}")


def fail(msg: str, detail: str = "") -> None:
    """Affiche une erreur et arrete le script."""
    print(f"\n[ERREUR] {msg}")
    if detail:
        print(f"  Detail : {detail}")
    sys.exit(1)


def post(client: httpx.Client, path: str, payload: dict) -> dict:
    """POST sur l'API, leve une erreur explicite si echec."""
    url = f"{BASE_URL}{path}"
    resp = client.post(url, json=payload, headers=HEADERS)
    if resp.status_code not in (200, 201):
        fail(
            f"POST {path} a echoue ({resp.status_code})",
            resp.text[:400],
        )
    return resp.json()


# ---------------------------------------------------------------------------
# Donnees de demo
# ---------------------------------------------------------------------------

VIANDE = "Viande hach\u00e9e"

INGREDIENTS_SPEC = [
    {"nom": VIANDE, "unite_defaut": "g", "categorie": "Viandes"},
    {"nom": "Riz", "unite_defaut": "g", "categorie": "F\u00e9culents"},
    {"nom": "Oignon", "unite_defaut": "unit\u00e9", "categorie": "L\u00e9gumes"},
    {"nom": "Sauce soja", "unite_defaut": "cs", "categorie": "Condiments"},
    {"nom": "Sel", "unite_defaut": "pinc\u00e9e", "categorie": "Condiments"},
    {"nom": "Poivre", "unite_defaut": "pinc\u00e9e", "categorie": "Condiments"},
]

PRIX_SPEC = [
    (
        VIANDE,
        {
            "magasin": "Carrefour",
            "prix": 9.00,
            "quantite_reference": 1000.0,
            "unite_reference": "g",
        },
    ),
    (
        "Riz",
        {
            "magasin": "Carrefour",
            "prix": 5.00,
            "quantite_reference": 1000.0,
            "unite_reference": "g",
        },
    ),
    (
        "Oignon",
        {
            "magasin": "Carrefour",
            "prix": 2.50,
            "quantite_reference": 1000.0,
            "unite_reference": "g",
        },
    ),
]

RECETTE_NOM = "Riz b\u0153uf hach\u00e9 oignons"
RECETTE_PORTIONS = 2


def recette_ingredients_spec(ing: dict) -> list:
    """Retourne la liste des ingredients de la recette avec IDs resolus."""
    return [
        {"ingredient_id": ing[VIANDE]["id"], "quantite": 350.0, "unite": "g"},
        {"ingredient_id": ing["Riz"]["id"], "quantite": 180.0, "unite": "g"},
        {"ingredient_id": ing["Oignon"]["id"], "quantite": 1.0, "unite": "unit\u00e9"},
        {"ingredient_id": ing["Sauce soja"]["id"], "quantite": 2.0, "unite": "cs"},
        {"ingredient_id": ing["Sel"]["id"], "quantite": 1.0, "unite": "pinc\u00e9e"},
        {"ingredient_id": ing["Poivre"]["id"], "quantite": 1.0, "unite": "pinc\u00e9e"},
    ]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    """Insere les donnees de demo : ingredients, recette, calendrier."""
    print("=" * 55)
    print("  Meal Planner -- Seed donnees de demo")
    print("=" * 55)

    with httpx.Client(timeout=10, follow_redirects=True) as client:
        # -- Sanity check ----------------------------------------------------
        step("Verification de l'API (health check)...")
        try:
            resp = client.get(f"{BASE_URL}/health")
            resp.raise_for_status()
        except Exception as exc:
            fail("L'API n'est pas joignable. Lancez le backend d'abord.", str(exc))
        ok("API operationnelle")

        # -- Ingredients -----------------------------------------------------
        step("Creation des ingredients...")

        ingredients: dict[str, dict] = {}
        for spec in INGREDIENTS_SPEC:
            data = post(client, "/ingredients", spec)
            ingredients[spec["nom"]] = data
            ok(f"{spec['nom']} (id={data['id']})")

        # -- Prix ------------------------------------------------------------
        step("Ajout des prix Carrefour...")

        for ing_nom, prix_data in PRIX_SPEC:
            ing_id = ingredients[ing_nom]["id"]
            data = post(client, f"/ingredients/{ing_id}/prix", prix_data)
            ok(
                f"{ing_nom} -> {prix_data['prix']} EUR / "
                f"{int(prix_data['quantite_reference'])}{prix_data['unite_reference']} "
                f"chez {prix_data['magasin']} (id={data['id']})"
            )

        # -- Recette (creation puis ajout des ingredients) -------------------
        step(f"Creation de la recette ({RECETTE_PORTIONS} portions)...")

        recette = post(
            client,
            "/recettes",
            {
                "nom": RECETTE_NOM,
                "nb_portions": RECETTE_PORTIONS,
            },
        )
        recette_id = recette["id"]
        ok(f"{recette['nom']} (id={recette_id})")

        step("Ajout des 6 ingredients a la recette...")

        # Construire un index id -> nom pour l'affichage
        id_to_nom = {v["id"]: k for k, v in ingredients.items()}

        for ri_spec in recette_ingredients_spec(ingredients):
            post(client, f"/recettes/{recette_id}/ingredients", ri_spec)
            nom = id_to_nom.get(ri_spec["ingredient_id"], ri_spec["ingredient_id"])
            ok(f"{nom} x{ri_spec['quantite']} {ri_spec['unite']}")

        # -- Calendrier ------------------------------------------------------
        step("Planification : 2026-03-01, dejeuner, 2 personnes...")

        repas = post(
            client,
            "/calendrier/",
            {
                "date": "2026-03-01",
                "type_repas": "dejeuner",
                "recette_id": recette_id,
                "nb_personnes": 2,
            },
        )
        ok(f"Repas planifie (id={repas['id']})")

    # -- Resume --------------------------------------------------------------
    print()
    print("=" * 55)
    print("  Seed termine avec succes !")
    print(f"  Ingredients crees : {len(ingredients)}")
    print(f"  Recette           : {recette['nom']}")
    print("  Calendrier        : 2026-03-01 / dejeuner / 2 personnes")
    print("=" * 55)


if __name__ == "__main__":
    main()
