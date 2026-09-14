-- =============================================================================
-- Galería de imágenes por producto (múltiples fotos + URL)
-- Ejecutar en Supabase SQL Editor → Run (una vez)
-- =============================================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS gallery_urls JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Migrar imagen principal existente a la galería
UPDATE public.products
SET gallery_urls = jsonb_build_array(image_url)
WHERE (gallery_urls IS NULL OR gallery_urls = '[]'::jsonb)
  AND COALESCE(TRIM(image_url), '') <> '';

-- Verificación
SELECT id, name, image_url, gallery_urls
FROM public.products
WHERE jsonb_array_length(gallery_urls) > 0
LIMIT 10;
