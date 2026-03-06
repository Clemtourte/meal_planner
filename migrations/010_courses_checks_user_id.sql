-- Migration 010 : Isolation multi-utilisateurs pour courses_checks
-- À exécuter dans le SQL Editor de Supabase

ALTER TABLE courses_checks ADD COLUMN IF NOT EXISTS
  user_id text DEFAULT 'default_user';

ALTER TABLE courses_checks DROP CONSTRAINT IF EXISTS
  courses_checks_semaine_debut_ingredient_id_key;

ALTER TABLE courses_checks ADD CONSTRAINT
  courses_checks_semaine_ingredient_user_key
  UNIQUE(semaine_debut, ingredient_id, user_id);
