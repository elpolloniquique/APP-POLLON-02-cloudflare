-- =============================================================================
-- Dejar solo 3 categorías base por sucursal
-- Ofertas Familiares | Ofertas para Dos | Ofertas Personales
-- Ejecutar en Supabase SQL Editor → Run (una vez)
-- =============================================================================

-- 1) Fusionar duplicados antes de limpiar (por si aún existen)
DO $dedupe$
DECLARE
  rec RECORD;
  v_keeper UUID;
BEGIN
  FOR rec IN
    SELECT branch_id, TRIM(name) AS cat_name
    FROM public.categories
    GROUP BY branch_id, TRIM(name)
    HAVING COUNT(*) > 1
  LOOP
    SELECT id INTO v_keeper
    FROM public.categories
    WHERE branch_id = rec.branch_id AND TRIM(name) = rec.cat_name
    ORDER BY display_order ASC, created_at ASC NULLS LAST, id ASC
    LIMIT 1;

    UPDATE public.products p
    SET category_id = v_keeper
    WHERE p.category_id IN (
      SELECT id FROM public.categories
      WHERE branch_id = rec.branch_id
        AND TRIM(name) = rec.cat_name
        AND id <> v_keeper
    );

    DELETE FROM public.categories
    WHERE branch_id = rec.branch_id
      AND TRIM(name) = rec.cat_name
      AND id <> v_keeper;
  END LOOP;
END
$dedupe$;

-- 2) Eliminar categorías que no son las 3 base (productos se eliminan en cascada)
DELETE FROM public.categories
WHERE name NOT IN (
  'Ofertas Familiares',
  'Ofertas para Dos',
  'Ofertas Personales'
);

-- 3) Crear las 3 base en sucursales que no las tengan
INSERT INTO public.categories (branch_id, name, description, display_order, is_active)
SELECT b.id, v.name, 'Menú ' || v.name || ' — ' || b.name, v.ord, true
FROM public.branches b
CROSS JOIN (
  VALUES
    ('Ofertas Familiares', 1),
    ('Ofertas para Dos', 2),
    ('Ofertas Personales', 3)
) AS v(name, ord)
WHERE NOT EXISTS (
  SELECT 1 FROM public.categories c
  WHERE c.branch_id = b.id AND c.name = v.name
)
ON CONFLICT (branch_id, name) DO UPDATE SET
  display_order = EXCLUDED.display_order,
  is_active = true;

-- 4) Orden fijo de las 3 categorías base
UPDATE public.categories SET display_order = 1 WHERE name = 'Ofertas Familiares';
UPDATE public.categories SET display_order = 2 WHERE name = 'Ofertas para Dos';
UPDATE public.categories SET display_order = 3 WHERE name = 'Ofertas Personales';

-- 5) Índice único (evita duplicados futuros)
DROP INDEX IF EXISTS public.idx_categories_branch_name_unique;
CREATE UNIQUE INDEX idx_categories_branch_name_unique
  ON public.categories (branch_id, name);

-- 6) Tiempo real: actualizar tienda al cambiar categorías/productos en admin
ALTER TABLE public.categories REPLICA IDENTITY FULL;
ALTER TABLE public.products REPLICA IDENTITY FULL;
DO $rt$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.categories;
EXCEPTION WHEN duplicate_object THEN NULL;
END $rt$;
DO $rt$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
EXCEPTION WHEN duplicate_object THEN NULL;
END $rt$;

-- 7) Verificación
SELECT b.name AS sucursal, c.name AS categoria, c.display_order AS orden
FROM public.branches b
LEFT JOIN public.categories c ON c.branch_id = b.id
ORDER BY b.display_order, c.display_order;
