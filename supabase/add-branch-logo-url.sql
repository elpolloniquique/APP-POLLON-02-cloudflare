-- Logotipo del header POR SUCURSAL.
-- PNG/WebP transparente recomendado (sin fondo).
-- Ejecutar en el SQL Editor de Supabase.

ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS logo_url TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN public.branches.logo_url IS
  'Logotipo del header (sin fondo). Si está vacío se usa el logo por defecto.';
