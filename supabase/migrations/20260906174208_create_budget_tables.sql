/*
# Create Budget Tracking Tables

## Summary
Creates the core tables for a personal budget tracking application.

## New Tables

### 1. `categories`
Stores income/expense categories (e.g., "Salaire", "Logement", "Transport").
- `id` (uuid, primary key)
- `type` (text: 'entree' or 'sortie')
- `name` (text, unique per type)
- `created_at` (timestamp)

### 2. `designations`
Stores designation labels linked to a category (e.g., "Salaire mensuel", "Bus").
- `id` (uuid, primary key)
- `category_id` (uuid, FK to categories)
- `name` (text)
- `created_at` (timestamp)

### 3. `transactions`
Stores individual budget entries (income or expense).
- `id` (uuid, primary key)
- `type` (text: 'entree' or 'sortie')
- `category_id` (uuid, FK to categories)
- `designation_id` (uuid, FK to designations, nullable)
- `designation_custom` (text, nullable — for ad-hoc labels)
- `amount` (numeric, not null)
- `note` (text, nullable)
- `transaction_date` (date, not null)
- `created_at` (timestamp)

## Security
- RLS enabled on all tables with anon + authenticated access (single-tenant, no auth required).
*/

-- Categories
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('entree', 'sortie')),
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(type, name)
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_categories" ON categories;
CREATE POLICY "anon_select_categories" ON categories FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_categories" ON categories;
CREATE POLICY "anon_insert_categories" ON categories FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_categories" ON categories;
CREATE POLICY "anon_update_categories" ON categories FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_categories" ON categories;
CREATE POLICY "anon_delete_categories" ON categories FOR DELETE TO anon, authenticated USING (true);

-- Designations
CREATE TABLE IF NOT EXISTS designations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE designations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_designations" ON designations;
CREATE POLICY "anon_select_designations" ON designations FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_designations" ON designations;
CREATE POLICY "anon_insert_designations" ON designations FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_designations" ON designations;
CREATE POLICY "anon_update_designations" ON designations FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_designations" ON designations;
CREATE POLICY "anon_delete_designations" ON designations FOR DELETE TO anon, authenticated USING (true);

-- Transactions
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('entree', 'sortie')),
  category_id uuid NOT NULL REFERENCES categories(id),
  designation_id uuid REFERENCES designations(id),
  designation_custom text,
  amount numeric(15, 2) NOT NULL CHECK (amount > 0),
  note text,
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_transactions" ON transactions;
CREATE POLICY "anon_select_transactions" ON transactions FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_transactions" ON transactions;
CREATE POLICY "anon_insert_transactions" ON transactions FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_transactions" ON transactions;
CREATE POLICY "anon_update_transactions" ON transactions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_transactions" ON transactions;
CREATE POLICY "anon_delete_transactions" ON transactions FOR DELETE TO anon, authenticated USING (true);

-- Seed default categories and designations
INSERT INTO categories (type, name) VALUES
  ('entree', 'Salaire'),
  ('entree', 'Investissement'),
  ('entree', 'Cadeau'),
  ('entree', 'Source oublié'),
  ('sortie', 'Dieu'),
  ('sortie', 'Logement'),
  ('sortie', 'Transport'),
  ('sortie', 'Abonnement'),
  ('sortie', 'Alimentations'),
  ('sortie', 'Administratifs'),
  ('sortie', 'Communication'),
  ('sortie', 'Loisirs'),
  ('sortie', 'Investissement'),
  ('sortie', 'Besoins'),
  ('sortie', 'Imprévues'),
  ('sortie', 'Dettes'),
  ('sortie', 'Dons')
ON CONFLICT (type, name) DO NOTHING;

-- Seed designations
DO $$
DECLARE
  cat_id uuid;
BEGIN
  -- Entrée: Salaire
  SELECT id INTO cat_id FROM categories WHERE type='entree' AND name='Salaire';
  INSERT INTO designations (category_id, name) VALUES (cat_id, 'Salaire mensuel') ON CONFLICT DO NOTHING;

  -- Entrée: Investissement
  SELECT id INTO cat_id FROM categories WHERE type='entree' AND name='Investissement';
  INSERT INTO designations (category_id, name) VALUES (cat_id, 'Avec José Mickael'), (cat_id, 'Avec Hajamalala') ON CONFLICT DO NOTHING;

  -- Sortie: Dieu
  SELECT id INTO cat_id FROM categories WHERE type='sortie' AND name='Dieu';
  INSERT INTO designations (category_id, name) VALUES
    (cat_id, 'Dîmes'), (cat_id, 'Offrandes'), (cat_id, 'Dons pour leur services'),
    (cat_id, 'Tenu JA'), (cat_id, 'Sekoly Sabata'), (cat_id, 'Réparation Bible intéressé') ON CONFLICT DO NOTHING;

  -- Sortie: Logement
  SELECT id INTO cat_id FROM categories WHERE type='sortie' AND name='Logement';
  INSERT INTO designations (category_id, name) VALUES (cat_id, 'JIRAMA'), (cat_id, 'Electricité') ON CONFLICT DO NOTHING;

  -- Sortie: Transport
  SELECT id INTO cat_id FROM categories WHERE type='sortie' AND name='Transport';
  INSERT INTO designations (category_id, name) VALUES (cat_id, 'Bus'), (cat_id, 'Taxi moto'), (cat_id, 'Carburant moto') ON CONFLICT DO NOTHING;

  -- Sortie: Abonnement
  SELECT id INTO cat_id FROM categories WHERE type='sortie' AND name='Abonnement';
  INSERT INTO designations (category_id, name) VALUES (cat_id, 'Compte BOA (+ carte VISA)'), (cat_id, 'Internet') ON CONFLICT DO NOTHING;

  -- Sortie: Alimentations
  SELECT id INTO cat_id FROM categories WHERE type='sortie' AND name='Alimentations';
  INSERT INTO designations (category_id, name) VALUES (cat_id, 'Repas'), (cat_id, 'Snacks'), (cat_id, 'Fruits'), (cat_id, 'Eau') ON CONFLICT DO NOTHING;

  -- Sortie: Administratifs
  SELECT id INTO cat_id FROM categories WHERE type='sortie' AND name='Administratifs';
  INSERT INTO designations (category_id, name) VALUES (cat_id, 'Auto-école'), (cat_id, 'Passeport'), (cat_id, 'Adidy') ON CONFLICT DO NOTHING;

  -- Sortie: Communication
  SELECT id INTO cat_id FROM categories WHERE type='sortie' AND name='Communication';
  INSERT INTO designations (category_id, name) VALUES (cat_id, 'Crédit Téléphone') ON CONFLICT DO NOTHING;

  -- Sortie: Loisirs
  SELECT id INTO cat_id FROM categories WHERE type='sortie' AND name='Loisirs';
  INSERT INTO designations (category_id, name) VALUES
    (cat_id, 'Football'), (cat_id, 'Musique HF'), (cat_id, 'Bisikileta'),
    (cat_id, 'Jeux PC'), (cat_id, 'Motif oublié') ON CONFLICT DO NOTHING;

  -- Sortie: Investissement
  SELECT id INTO cat_id FROM categories WHERE type='sortie' AND name='Investissement';
  INSERT INTO designations (category_id, name) VALUES
    (cat_id, 'Haja'), (cat_id, 'Achat Ordinateur'), (cat_id, 'Achat Télephone'), (cat_id, 'José Mickael') ON CONFLICT DO NOTHING;

  -- Sortie: Besoins
  SELECT id INTO cat_id FROM categories WHERE type='sortie' AND name='Besoins';
  INSERT INTO designations (category_id, name) VALUES
    (cat_id, 'Ody moka'), (cat_id, 'Materiels informatique'), (cat_id, 'Savon / Lessive'),
    (cat_id, 'Equipements éléctroniques'), (cat_id, 'Colle ultra'), (cat_id, 'Chaussures'),
    (cat_id, 'Parapluie'), (cat_id, 'Vetements'), (cat_id, 'Motif oublié') ON CONFLICT DO NOTHING;

  -- Sortie: Imprévues
  SELECT id INTO cat_id FROM categories WHERE type='sortie' AND name='Imprévues';
  INSERT INTO designations (category_id, name) VALUES (cat_id, 'Réparation téléphone'), (cat_id, 'Réparation ordinateurs') ON CONFLICT DO NOTHING;

  -- Sortie: Dettes
  SELECT id INTO cat_id FROM categories WHERE type='sortie' AND name='Dettes';
  INSERT INTO designations (category_id, name) VALUES
    (cat_id, 'Remboursement Mvola Avance'), (cat_id, 'Parents'), (cat_id, 'Motif oublié') ON CONFLICT DO NOTHING;

  -- Sortie: Dons
  SELECT id INTO cat_id FROM categories WHERE type='sortie' AND name='Dons';
  INSERT INTO designations (category_id, name) VALUES (cat_id, 'Motif oublié'), (cat_id, 'Kanto'), (cat_id, 'Fafa') ON CONFLICT DO NOTHING;
END $$;
