  -- =============================================================================
-- Verificar que el seed multi-sucursal cargó correctamente
-- Ejecutar en SQL Editor → debe devolver filas con números (no "0 row" vacío)
-- =============================================================================

SELECT
  b.slug,
  b.name AS sucursal,
  (SELECT COUNT(*)::int FROM categories c WHERE c.branch_id = b.id) AS categorias,
  (SELECT COUNT(*)::int FROM products p WHERE p.branch_id = b.id) AS productos
FROM branches b
ORDER BY b.display_order;

-- Totales (valores esperados tras seed completo)
SELECT
  (SELECT COUNT(*)::int FROM branches) AS total_sucursales,
  (SELECT COUNT(*)::int FROM categories) AS total_categorias,
  (SELECT COUNT(*)::int FROM products) AS total_productos;

-- Si total_sucursales = 0 → ejecuta schema-multi-sucursal.sql antes del seed
-- Si total_sucursales = 4 pero productos = 0 → el seed no terminó (timeout); vuelve a ejecutar seed-multi-sucursal.sql
