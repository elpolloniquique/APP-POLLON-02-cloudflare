-- =============================================================================
-- Dejar solo 5 platos base en las categorías de ofertas
-- Ofertas Familiares | Ofertas para Dos | Ofertas Personales
-- Ejecutar en Supabase SQL Editor → Run (una vez)
-- =============================================================================

-- Elimina platos seed del 6 en adelante (conserva Plato 1–5)
DELETE FROM public.products p
USING public.categories c
WHERE p.category_id = c.id
  AND c.name IN ('Ofertas Familiares', 'Ofertas para Dos', 'Ofertas Personales')
  AND p.name ~ ' — Plato ([6-9]|1[0-9]|2[0-9])$';

-- Verificación: debe quedar máximo 5 productos por categoría y sucursal
SELECT
  b.name AS sucursal,
  c.name AS categoria,
  COUNT(p.id)::int AS platos
FROM public.branches b
JOIN public.categories c ON c.branch_id = b.id
  AND c.name IN ('Ofertas Familiares', 'Ofertas para Dos', 'Ofertas Personales')
LEFT JOIN public.products p ON p.category_id = c.id
GROUP BY b.id, b.name, b.display_order, c.id, c.name
ORDER BY b.display_order, c.display_order;

-- Detalle de platos que quedaron (Plato 1–5)
SELECT b.name AS sucursal, c.name AS categoria, p.display_order AS orden, p.name, p.price
FROM public.products p
JOIN public.categories c ON c.id = p.category_id
JOIN public.branches b ON b.id = p.branch_id
WHERE c.name IN ('Ofertas Familiares', 'Ofertas para Dos', 'Ofertas Personales')
ORDER BY b.display_order, c.display_order, p.display_order;
