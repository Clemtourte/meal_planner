-- Migration 005 : Préparation multi-utilisateurs
-- À exécuter dans le SQL Editor de Supabase
--
-- Ajoute une colonne user_id (texte, valeur par défaut 'default_user')
-- à toutes les tables concernées. L'authentification complète sera activée
-- lors du déploiement avec Supabase Auth Row Level Security.

ALTER TABLE recettes ADD COLUMN IF NOT EXISTS
  user_id text DEFAULT 'default_user';

ALTER TABLE semaine_repas ADD COLUMN IF NOT EXISTS
  user_id text DEFAULT 'default_user';

ALTER TABLE budgets ADD COLUMN IF NOT EXISTS
  user_id text DEFAULT 'default_user';

ALTER TABLE historique_depenses ADD COLUMN IF NOT EXISTS
  user_id text DEFAULT 'default_user';
