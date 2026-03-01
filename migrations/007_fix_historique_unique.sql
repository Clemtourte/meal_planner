-- Migration 007 : Une semaine = une ligne dans historique_depenses
-- À exécuter dans le SQL Editor de Supabase
--
-- 1. Dédupliquer en gardant la ligne la plus récente par (semaine_debut, user_id)
-- 2. Ajouter la contrainte UNIQUE pour forcer l'upsert côté backend

DELETE FROM historique_depenses a USING historique_depenses b
WHERE a.created_at < b.created_at
AND a.semaine_debut = b.semaine_debut
AND a.user_id = b.user_id;

ALTER TABLE historique_depenses ADD CONSTRAINT
  historique_depenses_semaine_user_key
  UNIQUE(semaine_debut, user_id);
