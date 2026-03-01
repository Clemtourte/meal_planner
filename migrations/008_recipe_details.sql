-- Migration 008 : Détails de préparation et instructions sur les recettes
-- À exécuter dans le SQL Editor de Supabase

ALTER TABLE recettes ADD COLUMN IF NOT EXISTS
  temps_preparation integer; -- en minutes

ALTER TABLE recettes ADD COLUMN IF NOT EXISTS
  temps_cuisson integer; -- en minutes

ALTER TABLE recettes ADD COLUMN IF NOT EXISTS
  difficulte text CHECK (difficulte IN ('facile', 'moyen', 'difficile'));

ALTER TABLE recettes ADD COLUMN IF NOT EXISTS
  instructions text[] DEFAULT '{}'; -- étapes numérotées
