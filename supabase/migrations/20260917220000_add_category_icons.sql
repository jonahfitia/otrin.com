-- Add icon to categories so the app can display a tactile, icon-based picker.
ALTER TABLE categories ADD COLUMN IF NOT EXISTS icon text;

UPDATE categories SET icon = 'Payments' WHERE type = 'entree' AND lower(name) = 'salaire';
UPDATE categories SET icon = 'Savings' WHERE type = 'entree' AND lower(name) = 'investissement';
UPDATE categories SET icon = 'CardGiftcard' WHERE type = 'entree' AND lower(name) = 'cadeau';
UPDATE categories SET icon = 'Help' WHERE type = 'entree' AND lower(name) = 'source oublié';

UPDATE categories SET icon = 'Church' WHERE type = 'sortie' AND lower(name) = 'dieu';
UPDATE categories SET icon = 'Home' WHERE type = 'sortie' AND lower(name) = 'logement';
UPDATE categories SET icon = 'DirectionsBus' WHERE type = 'sortie' AND lower(name) = 'transport';
UPDATE categories SET icon = 'SyncAlt' WHERE type = 'sortie' AND lower(name) = 'abonnement';
UPDATE categories SET icon = 'Restaurant' WHERE type = 'sortie' AND lower(name) = 'alimentations';
UPDATE categories SET icon = 'FolderOpen' WHERE type = 'sortie' AND lower(name) = 'administratifs';
UPDATE categories SET icon = 'Phone' WHERE type = 'sortie' AND lower(name) = 'communication';
UPDATE categories SET icon = 'SportsSoccer' WHERE type = 'sortie' AND lower(name) = 'loisirs';
UPDATE categories SET icon = 'Savings' WHERE type = 'sortie' AND lower(name) = 'investissement';
UPDATE categories SET icon = 'ShoppingBasket' WHERE type = 'sortie' AND lower(name) = 'besoins';
UPDATE categories SET icon = 'WarningAmber' WHERE type = 'sortie' AND lower(name) = 'imprévues';
UPDATE categories SET icon = 'AccountBalanceWallet' WHERE type = 'sortie' AND lower(name) = 'dettes';
UPDATE categories SET icon = 'VolunteerActivism' WHERE type = 'sortie' AND lower(name) = 'dons';