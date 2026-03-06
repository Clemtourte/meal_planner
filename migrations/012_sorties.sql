-- Migration 012 : Sorties resto & commandes
-- À exécuter dans le SQL Editor de Supabase

CREATE TABLE IF NOT EXISTS sorties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text DEFAULT 'default_user',
  date date NOT NULL,
  type text NOT NULL CHECK (type IN ('restaurant', 'commande')),
  titre text NOT NULL,
  montant numeric NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sorties_user_date_idx
  ON sorties (user_id, date DESC);
