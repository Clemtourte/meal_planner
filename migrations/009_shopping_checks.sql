-- Migration 009 : Cases à cocher synchronisées pour la liste de courses
-- À exécuter dans le SQL Editor de Supabase

CREATE TABLE IF NOT EXISTS courses_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semaine_debut date NOT NULL,
  ingredient_id uuid REFERENCES ingredients(id) ON DELETE CASCADE,
  checked boolean NOT NULL DEFAULT false,
  checked_by text, -- user_id
  updated_at timestamptz DEFAULT now(),
  UNIQUE(semaine_debut, ingredient_id)
);
