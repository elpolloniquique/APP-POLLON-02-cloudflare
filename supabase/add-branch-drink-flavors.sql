-- Sabores de bebida del modal (combos / ofertas familiares), por sucursal.
-- Ejecutar UNA vez en Supabase → SQL Editor.
ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS drink_flavors JSONB DEFAULT NULL;

COMMENT ON COLUMN public.branches.drink_flavors IS
  'Lista de sabores de bebida del modal: { flavors: [{ id, name, active, sort }], updatedAt }';

NOTIFY pgrst, 'reload schema';
