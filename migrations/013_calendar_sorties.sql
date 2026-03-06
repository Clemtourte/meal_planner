-- Migration 013 : Lier sorties au calendrier
-- À exécuter dans le SQL Editor de Supabase

ALTER TABLE semaine_repas ADD COLUMN IF NOT EXISTS
  sortie_id uuid REFERENCES sorties(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS semaine_repas_sortie_idx
  ON semaine_repas (sortie_id);
