-- =============================================================================
-- FIX categorías duplicadas + evitar que vuelvan a repetirse
-- Ejecutar en Supabase SQL Editor → Run (una vez)
-- =============================================================================

-- 1) Fusionar duplicados: conserva la categoría más antigua por sucursal+nombre
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

-- 2) Índice único: una categoría por nombre en cada sucursal
DROP INDEX IF EXISTS public.idx_categories_branch_name_unique;
CREATE UNIQUE INDEX idx_categories_branch_name_unique
  ON public.categories (branch_id, name);

-- 3) Verificación (no debe haber duplicados)
SELECT branch_id, name, COUNT(*)::int AS veces
FROM public.categories
GROUP BY branch_id, name
HAVING COUNT(*) > 1;

-- Si la consulta anterior no devuelve filas → OK
SELECT b.name AS sucursal, COUNT(c.id)::int AS categorias
FROM public.branches b
LEFT JOIN public.categories c ON c.branch_id = b.id
GROUP BY b.id, b.name
ORDER BY b.display_order;
