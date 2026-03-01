-- Migration 006 : Contrainte unique calendrier pour multi-utilisateurs
-- À exécuter dans le SQL Editor de Supabase
--
-- La contrainte UNIQUE(date, type_repas) empêche deux utilisateurs
-- d'avoir le même slot. On la remplace par UNIQUE(date, type_repas, user_id).

ALTER TABLE semaine_repas DROP CONSTRAINT IF EXISTS
  semaine_repas_date_type_repas_key;

ALTER TABLE semaine_repas ADD CONSTRAINT
  semaine_repas_date_type_repas_user_id_key
  UNIQUE(date, type_repas, user_id);
