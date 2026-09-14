-- =============================================================================
-- FIX productos duplicados + evitar que vuelvan a repetirse
-- Ejecutar en Supabase SQL Editor → Run (una vez)
-- =============================================================================

-- 1) Mover productos de categorías duplicadas a la categoría principal
DO $move_cats$
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
  END LOOP;
END
$move_cats$;

-- 2) Fusionar productos duplicados (mismo nombre en misma categoría y sucursal)
DO $dedupe$
DECLARE
  rec RECORD;
  v_keeper UUID;
BEGIN
  FOR rec IN
    SELECT branch_id, category_id, TRIM(name) AS prod_name
    FROM public.products
    GROUP BY branch_id, category_id, TRIM(name)
    HAVING COUNT(*) > 1
  LOOP
    SELECT id INTO v_keeper
    FROM public.products
    WHERE branch_id = rec.branch_id
      AND category_id = rec.category_id
      AND TRIM(name) = rec.prod_name
    ORDER BY
      (CASE WHEN COALESCE(TRIM(image_url), '') <> '' THEN 0 ELSE 1 END),
      (CASE WHEN is_available THEN 0 ELSE 1 END),
      display_order ASC,
      created_at ASC NULLS LAST,
      id ASC
    LIMIT 1;

    DELETE FROM public.products
    WHERE branch_id = rec.branch_id
      AND category_id = rec.category_id
      AND TRIM(name) = rec.prod_name
      AND id <> v_keeper;
  END LOOP;
END
$dedupe$;

-- 3) Índice único: un producto por nombre en cada categoría/sucursal
DROP INDEX IF EXISTS public.idx_products_branch_category_name_unique;
CREATE UNIQUE INDEX idx_products_branch_category_name_unique
  ON public.products (branch_id, category_id, name);

-- 4) Verificación (no debe haber duplicados)
SELECT branch_id, category_id, name, COUNT(*)::int AS veces
FROM public.products
GROUP BY branch_id, category_id, name
HAVING COUNT(*) > 1;

-- Resumen por categoría
SELECT b.name AS sucursal, c.name AS categoria, COUNT(p.id)::int AS platos
FROM public.branches b
JOIN public.categories c ON c.branch_id = b.id
LEFT JOIN public.products p ON p.category_id = c.id
WHERE c.name IN ('Ofertas Familiares', 'Ofertas para Dos', 'Ofertas Personales')
GROUP BY b.id, b.name, b.display_order, c.id, c.name
ORDER BY b.display_order, c.display_order;
