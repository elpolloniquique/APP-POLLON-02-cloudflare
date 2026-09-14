-- Aviso a pantalla completa POR SUCURSAL.
-- Si está activo en Iquique, solo aparece cuando el cliente elige esa sucursal.
-- Ejecutar en el SQL Editor de Supabase.

ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS alert_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS alert_title TEXT NOT NULL DEFAULT 'Aviso importante';

ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS alert_message TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN public.branches.alert_enabled IS
  'Aviso a pantalla completa solo para clientes de esta sucursal.';
COMMENT ON COLUMN public.branches.alert_title IS
  'Título del aviso de esta sucursal.';
COMMENT ON COLUMN public.branches.alert_message IS
  'Texto del aviso. Vacío = no mostrar.';
