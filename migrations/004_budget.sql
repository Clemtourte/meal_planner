-- Migration 004 : Gestion du budget alimentaire
-- À exécuter dans le SQL Editor de Supabase

CREATE TABLE budgets (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  type        text        NOT NULL CHECK (type IN ('hebdomadaire', 'mensuel')),
  montant     numeric     NOT NULL,
  date_debut  date        NOT NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE historique_depenses (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  semaine_debut   date        NOT NULL,
  montant_estime  numeric     NOT NULL,
  magasin_choisi  text,
  created_at      timestamptz DEFAULT now()
);
