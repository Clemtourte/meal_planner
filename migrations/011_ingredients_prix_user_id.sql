-- Migration 011 : Isolation multi-utilisateurs pour ingredients et prix
-- À exécuter dans le SQL Editor de Supabase

ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS
  user_id text DEFAULT 'default_user';

ALTER TABLE prix ADD COLUMN IF NOT EXISTS
  user_id text DEFAULT 'default_user';
