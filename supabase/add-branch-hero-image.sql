-- Foto de portada del inicio POR SUCURSAL.
-- Cada local puede tener su propia imagen de banner.
-- Ejecutar en el SQL Editor de Supabase.

ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS hero_image_url TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN public.branches.hero_image_url IS
  'Imagen de fondo del banner de inicio. Cambia al elegir esta sucursal.';
