-- =============================================================================
-- FIX subida de imágenes desde panel admin
-- Ejecutar en Supabase SQL Editor → Run (una vez)
-- =============================================================================

-- 1) Bucket público con formatos comunes (PC + móvil)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];

-- 2) Políticas RLS — lectura pública, escritura solo usuarios autenticados (admin)
DROP POLICY IF EXISTS "product_images_public_read" ON storage.objects;
CREATE POLICY "product_images_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "product_images_auth_upload" ON storage.objects;
CREATE POLICY "product_images_auth_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'product-images' AND auth.uid() IS NOT NULL
  );

DROP POLICY IF EXISTS "product_images_auth_update" ON storage.objects;
CREATE POLICY "product_images_auth_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'product-images' AND auth.uid() IS NOT NULL
  );

DROP POLICY IF EXISTS "product_images_auth_delete" ON storage.objects;
CREATE POLICY "product_images_auth_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'product-images' AND auth.uid() IS NOT NULL
  );

-- 3) Verificación
SELECT id, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'product-images';
