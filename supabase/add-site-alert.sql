-- Aviso a pantalla completa en la web (lluvia, mantenimiento, zonas, etc.)
-- Ejecutar en el SQL Editor de Supabase. La web pública lo lee sin login.

ALTER TABLE public.configuracion_tienda
  ADD COLUMN IF NOT EXISTS aviso_activo BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.configuracion_tienda
  ADD COLUMN IF NOT EXISTS aviso_titulo TEXT NOT NULL DEFAULT 'Aviso importante';

ALTER TABLE public.configuracion_tienda
  ADD COLUMN IF NOT EXISTS aviso_mensaje TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN public.configuracion_tienda.aviso_activo IS
  'Si es true, el sitio muestra un aviso a pantalla completa que el cliente puede cerrar.';
COMMENT ON COLUMN public.configuracion_tienda.aviso_titulo IS
  'Título del aviso (ej. Aviso importante, Mantenimiento).';
COMMENT ON COLUMN public.configuracion_tienda.aviso_mensaje IS
  'Texto que ven los clientes. Ej: Solo estamos haciendo delivery zona centro por lluvia.';

-- Índice único para el fallback en settings (clave global, branch_id nulo)
DO $$
BEGIN
  IF to_regclass('public.settings') IS NOT NULL THEN
    CREATE UNIQUE INDEX IF NOT EXISTS settings_global_key_unique
      ON public.settings (key)
      WHERE branch_id IS NULL;
  END IF;
END $$;
