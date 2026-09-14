-- Permite texto en costo delivery (ej. "Varía según distancia") además de montos fijos.
-- Ejecutar en Supabase → SQL Editor (una sola vez).

ALTER TABLE branches
  ALTER COLUMN delivery_cost TYPE TEXT
  USING delivery_cost::TEXT;

ALTER TABLE branches
  ALTER COLUMN delivery_cost SET DEFAULT '0';

COMMENT ON COLUMN branches.delivery_cost IS 'Monto fijo en CLP (ej. 2500) o texto descriptivo del costo de delivery';
