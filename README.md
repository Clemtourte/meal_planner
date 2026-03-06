# Meal Planner

Application web de planification de repas hebdomadaire avec liste de courses et export PDF.

## Stack

| Couche | Technologie |
|--------|-------------|
| Backend | Python 3.11+ / FastAPI |
| Frontend | HTML / CSS / JS Vanilla |
| Base de données | Supabase (PostgreSQL) |
| Export PDF | reportlab |

---

## Prérequis

- Python 3.11+
- Un projet [Supabase](https://supabase.com) avec les tables créées (voir ci-dessous)
- Le virtualenv `.venv/` (déjà créé si vous avez cloné le dépôt)

---

## Installation

```bash
# 1. Cloner le dépôt
git clone <url-du-repo>
cd meal_planner

# 2. Activer le virtualenv (Windows)
.venv\Scripts\activate

# 3. Installer les dépendances (si besoin)
pip install -r requirements.txt

# 4. Configurer les variables d'environnement
cp .env.example .env
# Éditer .env avec vos clés Supabase
```

---

## Variables d'environnement

Créer un fichier `.env` à la racine du projet :

```env
SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co
SUPABASE_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_KEY=your_supabase_service_role_key_here
ALLOWED_ORIGINS=http://localhost:5500
```

Retrouvez ces valeurs dans votre dashboard Supabase → **Project Settings → API**.
La `SUPABASE_SERVICE_KEY` est recommandée : le backend l'utilise pour accéder
aux données tout en appliquant l'isolation multi-utilisateurs via `user_id`.

---

## Schéma Supabase

Exécuter ce SQL dans l'éditeur SQL de Supabase (**SQL Editor**) :

```sql
CREATE TABLE ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  unite_defaut text NOT NULL,
  categorie text
);

CREATE TABLE recettes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  nb_portions integer NOT NULL DEFAULT 4,
  description text
);

CREATE TABLE recette_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recette_id uuid REFERENCES recettes(id) ON DELETE CASCADE,
  ingredient_id uuid REFERENCES ingredients(id),
  quantite numeric NOT NULL,
  unite text NOT NULL
);

CREATE TABLE semaine_repas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  type_repas text NOT NULL,
  recette_id uuid REFERENCES recettes(id),
  nb_personnes integer NOT NULL DEFAULT 2,
  UNIQUE(date, type_repas)
);

CREATE TABLE prix (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id uuid REFERENCES ingredients(id) ON DELETE CASCADE,
  magasin text NOT NULL,
  prix numeric NOT NULL,
  quantite_reference numeric NOT NULL,
  unite_reference text NOT NULL
);
```

---

## Lancement

### Backend

```bash
# Depuis la racine du projet, avec le venv activé
uvicorn backend.main:app --reload
```

L'API est disponible sur `http://localhost:8000`.
Documentation interactive : `http://localhost:8000/docs`

### Frontend

Ouvrir `frontend/index.html` directement dans un navigateur **ou** lancer un serveur HTTP local :

```bash
# Depuis le dossier frontend/
python -m http.server 3000
# Puis ouvrir http://localhost:3000
```

---

## Structure du projet

```
meal_planner/
├── backend/
│   ├── main.py          # Point d'entrée FastAPI
│   ├── database.py      # Connexion Supabase
│   ├── models/
│   │   ├── ingredients.py
│   │   ├── recettes.py
│   │   ├── calendrier.py
│   │   └── courses.py
│   └── routers/
│       ├── ingredients.py   # CRUD + prix multi-magasins
│       ├── recettes.py      # CRUD + gestion ingrédients
│       ├── calendrier.py    # Planification hebdomadaire
│       └── courses.py       # Liste de courses + export PDF
├── frontend/
│   ├── index.html
│   ├── style.css
│   ├── config.js        # BASE_URL
│   ├── app.js           # Navigation + helpers API
│   └── components/
│       ├── ingredients.js
│       ├── recettes.js
│       ├── calendrier.js
│       └── courses.js
├── .env.example
├── requirements.txt
└── CLAUDE.md
```

---

## Fonctionnalités

### Ingrédients
- Création, modification, suppression d'ingrédients
- Groupage par catégorie
- Gestion des prix multi-magasins (prix unitaire calculé automatiquement)

### Recettes
- Création et modification de recettes
- Ajout/retrait d'ingrédients avec quantité et unité
- Nombre de portions configurable

### Calendrier
- Vue semaine (lundi → dimanche)
- 3 repas par jour : petit-déjeuner, déjeuner, dîner
- Navigation entre semaines
- Sélection de recette et nombre de personnes par repas

### Liste de courses
- Génération automatique à partir du calendrier de la semaine
- Calcul : `quantité ajustée = quantité × (nb_personnes / nb_portions)`
- Groupage par catégorie d'ingrédient
- Estimation du coût avec le magasin le moins cher
- **Export PDF** via reportlab

---

## API — Endpoints principaux

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/ingredients` | Liste des ingrédients |
| POST | `/api/ingredients` | Créer un ingrédient |
| PATCH | `/api/ingredients/{id}` | Modifier un ingrédient |
| DELETE | `/api/ingredients/{id}` | Supprimer un ingrédient |
| GET/POST | `/api/ingredients/{id}/prix` | Prix par magasin |
| GET | `/api/recettes` | Liste des recettes |
| POST | `/api/recettes` | Créer une recette |
| GET | `/api/recettes/{id}` | Détail avec ingrédients |
| POST | `/api/recettes/{id}/ingredients` | Ajouter un ingrédient |
| GET | `/api/calendrier/semaine?debut=YYYY-MM-DD` | Repas de la semaine |
| POST | `/api/calendrier/` | Planifier un repas (upsert) |
| DELETE | `/api/calendrier/{id}` | Supprimer un repas |
| GET | `/api/courses/?debut=YYYY-MM-DD` | Liste de courses JSON |
| GET | `/api/courses/pdf?debut=YYYY-MM-DD` | Export PDF |
| POST | `/api/budgets/` | Créer un budget (hebdo/mensuel) |
| GET | `/api/budgets/actuel` | Budget actuel par type |
| GET | `/api/budgets/historique` | Historique des dépenses |
| POST | `/api/budgets/historique` | Enregistrer une dépense |
| GET | `/api/recettes/{id}/cout` | Coût estimé d'une recette |

---

## Multi-utilisateurs

L'architecture supporte plusieurs utilisateurs via Supabase Auth (JWT),
et **l'isolation est assurée côté backend** par le filtrage `user_id`.
La `SUPABASE_SERVICE_KEY` est utilisée pour accéder à la base (bypass RLS),
ce qui évite les blocages liés à RLS tout en gardant un contrôle strict
sur les données via l'API.

**Fonctionnement actuel :**
- Chaque requête doit inclure un JWT Supabase (`Authorization: Bearer ...`)
- Le backend dérive `user_id` depuis le JWT
- Les tables `ingredients`, `recettes`, `semaine_repas`, `budgets`,
  `historique_depenses`, `prix`, `courses_checks` filtrent et taguent
  les données par `user_id`

**Migrations requises :** exécuter `migrations/005_multiuser.sql`,
`migrations/010_courses_checks_user_id.sql` et
`migrations/011_ingredients_prix_user_id.sql` dans Supabase
pour ajouter la colonne `user_id` aux tables concernées.
