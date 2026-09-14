-- Seed multi-sucursal — generado automáticamente

-- Pollón Iquique - Vivar
INSERT INTO branches (slug, name, city, address, phone, whatsapp, delivery_cost, display_order, is_active)
VALUES ('iquique-vivar', 'Pollón Iquique - Vivar', 'Iquique', 'Calle Vivar 1086, Iquique', '+56 9 8692 5310', '56986925310', 2000, 1, true)
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, city = EXCLUDED.city, address = EXCLUDED.address,
  phone = EXCLUDED.phone, whatsapp = EXCLUDED.whatsapp, delivery_cost = EXCLUDED.delivery_cost, is_active = true;

INSERT INTO categories (branch_id, name, description, display_order, is_active)
SELECT id, 'Ofertas Familiares', 'Menú Ofertas Familiares — Pollón Iquique - Vivar', 1, true FROM branches WHERE slug = 'iquique-vivar'
ON CONFLICT (branch_id, name) DO UPDATE SET
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

INSERT INTO categories (branch_id, name, description, display_order, is_active)
SELECT id, 'Ofertas para Dos', 'Menú Ofertas para Dos — Pollón Iquique - Vivar', 2, true FROM branches WHERE slug = 'iquique-vivar'
ON CONFLICT (branch_id, name) DO UPDATE SET
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

INSERT INTO categories (branch_id, name, description, display_order, is_active)
SELECT id, 'Ofertas Personales', 'Menú Ofertas Personales — Pollón Iquique - Vivar', 3, true FROM branches WHERE slug = 'iquique-vivar'
ON CONFLICT (branch_id, name) DO UPDATE SET
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

INSERT INTO categories (branch_id, name, description, display_order, is_active)
SELECT id, 'Pollos a la Brasa', 'Menú Pollos a la Brasa — Pollón Iquique - Vivar', 4, true FROM branches WHERE slug = 'iquique-vivar'
ON CONFLICT (branch_id, name) DO UPDATE SET
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

INSERT INTO categories (branch_id, name, description, display_order, is_active)
SELECT id, 'Platos Extras', 'Menú Platos Extras — Pollón Iquique - Vivar', 5, true FROM branches WHERE slug = 'iquique-vivar'
ON CONFLICT (branch_id, name) DO UPDATE SET
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

INSERT INTO categories (branch_id, name, description, display_order, is_active)
SELECT id, 'Bebidas', 'Menú Bebidas — Pollón Iquique - Vivar', 6, true FROM branches WHERE slug = 'iquique-vivar'
ON CONFLICT (branch_id, name) DO UPDATE SET
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

INSERT INTO categories (branch_id, name, description, display_order, is_active)
SELECT id, 'Descartables', 'Menú Descartables — Pollón Iquique - Vivar', 7, true FROM branches WHERE slug = 'iquique-vivar'
ON CONFLICT (branch_id, name) DO UPDATE SET
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Ofertas Familiares — Plato 1', 'Delicioso ofertas familiares — plato 1 preparado al momento en Pollón Iquique - Vivar.', 5300, true, 1, true
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Ofertas Familiares'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Ofertas Familiares — Plato 1'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Ofertas Familiares — Plato 2', 'Delicioso ofertas familiares — plato 2 preparado al momento en Pollón Iquique - Vivar.', 5500, true, 2, true
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Ofertas Familiares'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Ofertas Familiares — Plato 2'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Ofertas Familiares — Plato 3', 'Delicioso ofertas familiares — plato 3 preparado al momento en Pollón Iquique - Vivar.', 5700, true, 3, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Ofertas Familiares'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Ofertas Familiares — Plato 3'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Ofertas Familiares — Plato 4', 'Delicioso ofertas familiares — plato 4 preparado al momento en Pollón Iquique - Vivar.', 5900, true, 4, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Ofertas Familiares'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Ofertas Familiares — Plato 4'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Ofertas Familiares — Plato 5', 'Delicioso ofertas familiares — plato 5 preparado al momento en Pollón Iquique - Vivar.', 6100, true, 5, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Ofertas Familiares'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Ofertas Familiares — Plato 5'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Ofertas para Dos — Plato 1', 'Delicioso ofertas para dos — plato 1 preparado al momento en Pollón Iquique - Vivar.', 5800, true, 1, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Ofertas para Dos'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Ofertas para Dos — Plato 1'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Ofertas para Dos — Plato 2', 'Delicioso ofertas para dos — plato 2 preparado al momento en Pollón Iquique - Vivar.', 6000, true, 2, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Ofertas para Dos'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Ofertas para Dos — Plato 2'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Ofertas para Dos — Plato 3', 'Delicioso ofertas para dos — plato 3 preparado al momento en Pollón Iquique - Vivar.', 6200, true, 3, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Ofertas para Dos'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Ofertas para Dos — Plato 3'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Ofertas para Dos — Plato 4', 'Delicioso ofertas para dos — plato 4 preparado al momento en Pollón Iquique - Vivar.', 6400, true, 4, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Ofertas para Dos'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Ofertas para Dos — Plato 4'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Ofertas para Dos — Plato 5', 'Delicioso ofertas para dos — plato 5 preparado al momento en Pollón Iquique - Vivar.', 6600, true, 5, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Ofertas para Dos'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Ofertas para Dos — Plato 5'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Ofertas Personales — Plato 1', 'Delicioso ofertas personales — plato 1 preparado al momento en Pollón Iquique - Vivar.', 6300, true, 1, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Ofertas Personales'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Ofertas Personales — Plato 1'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Ofertas Personales — Plato 2', 'Delicioso ofertas personales — plato 2 preparado al momento en Pollón Iquique - Vivar.', 6500, true, 2, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Ofertas Personales'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Ofertas Personales — Plato 2'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Ofertas Personales — Plato 3', 'Delicioso ofertas personales — plato 3 preparado al momento en Pollón Iquique - Vivar.', 6700, true, 3, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Ofertas Personales'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Ofertas Personales — Plato 3'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Ofertas Personales — Plato 4', 'Delicioso ofertas personales — plato 4 preparado al momento en Pollón Iquique - Vivar.', 6900, true, 4, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Ofertas Personales'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Ofertas Personales — Plato 4'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Ofertas Personales — Plato 5', 'Delicioso ofertas personales — plato 5 preparado al momento en Pollón Iquique - Vivar.', 7100, true, 5, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Ofertas Personales'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Ofertas Personales — Plato 5'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 1', 'Delicioso pollos a la brasa — plato 1 preparado al momento en Pollón Iquique - Vivar.', 6800, true, 1, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 1'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 2', 'Delicioso pollos a la brasa — plato 2 preparado al momento en Pollón Iquique - Vivar.', 7000, true, 2, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 2'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 3', 'Delicioso pollos a la brasa — plato 3 preparado al momento en Pollón Iquique - Vivar.', 7200, true, 3, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 3'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 4', 'Delicioso pollos a la brasa — plato 4 preparado al momento en Pollón Iquique - Vivar.', 7400, true, 4, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 4'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 5', 'Delicioso pollos a la brasa — plato 5 preparado al momento en Pollón Iquique - Vivar.', 7600, true, 5, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 5'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 6', 'Delicioso pollos a la brasa — plato 6 preparado al momento en Pollón Iquique - Vivar.', 7800, true, 6, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 6'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 7', 'Delicioso pollos a la brasa — plato 7 preparado al momento en Pollón Iquique - Vivar.', 8000, true, 7, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 7'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 8', 'Delicioso pollos a la brasa — plato 8 preparado al momento en Pollón Iquique - Vivar.', 8200, true, 8, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 8'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 9', 'Delicioso pollos a la brasa — plato 9 preparado al momento en Pollón Iquique - Vivar.', 8400, true, 9, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 9'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 10', 'Delicioso pollos a la brasa — plato 10 preparado al momento en Pollón Iquique - Vivar.', 8600, true, 10, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 10'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 11', 'Delicioso pollos a la brasa — plato 11 preparado al momento en Pollón Iquique - Vivar.', 8800, true, 11, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 11'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 12', 'Delicioso pollos a la brasa — plato 12 preparado al momento en Pollón Iquique - Vivar.', 9000, true, 12, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 12'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 13', 'Delicioso pollos a la brasa — plato 13 preparado al momento en Pollón Iquique - Vivar.', 9200, true, 13, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 13'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 14', 'Delicioso pollos a la brasa — plato 14 preparado al momento en Pollón Iquique - Vivar.', 9400, true, 14, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 14'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 15', 'Delicioso pollos a la brasa — plato 15 preparado al momento en Pollón Iquique - Vivar.', 9600, true, 15, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 15'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 1', 'Delicioso platos extras — plato 1 preparado al momento en Pollón Iquique - Vivar.', 7300, true, 1, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 1'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 2', 'Delicioso platos extras — plato 2 preparado al momento en Pollón Iquique - Vivar.', 7500, true, 2, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 2'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 3', 'Delicioso platos extras — plato 3 preparado al momento en Pollón Iquique - Vivar.', 7700, true, 3, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 3'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 4', 'Delicioso platos extras — plato 4 preparado al momento en Pollón Iquique - Vivar.', 7900, true, 4, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 4'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 5', 'Delicioso platos extras — plato 5 preparado al momento en Pollón Iquique - Vivar.', 8100, true, 5, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 5'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 6', 'Delicioso platos extras — plato 6 preparado al momento en Pollón Iquique - Vivar.', 8300, true, 6, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 6'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 7', 'Delicioso platos extras — plato 7 preparado al momento en Pollón Iquique - Vivar.', 8500, true, 7, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 7'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 8', 'Delicioso platos extras — plato 8 preparado al momento en Pollón Iquique - Vivar.', 8700, true, 8, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 8'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 9', 'Delicioso platos extras — plato 9 preparado al momento en Pollón Iquique - Vivar.', 8900, true, 9, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 9'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 10', 'Delicioso platos extras — plato 10 preparado al momento en Pollón Iquique - Vivar.', 9100, true, 10, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 10'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 11', 'Delicioso platos extras — plato 11 preparado al momento en Pollón Iquique - Vivar.', 9300, true, 11, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 11'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 12', 'Delicioso platos extras — plato 12 preparado al momento en Pollón Iquique - Vivar.', 9500, true, 12, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 12'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 13', 'Delicioso platos extras — plato 13 preparado al momento en Pollón Iquique - Vivar.', 9700, true, 13, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 13'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 14', 'Delicioso platos extras — plato 14 preparado al momento en Pollón Iquique - Vivar.', 9900, true, 14, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 14'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 15', 'Delicioso platos extras — plato 15 preparado al momento en Pollón Iquique - Vivar.', 10100, true, 15, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 15'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 1', 'Delicioso bebidas — plato 1 preparado al momento en Pollón Iquique - Vivar.', 7800, true, 1, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 1'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 2', 'Delicioso bebidas — plato 2 preparado al momento en Pollón Iquique - Vivar.', 8000, true, 2, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 2'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 3', 'Delicioso bebidas — plato 3 preparado al momento en Pollón Iquique - Vivar.', 8200, true, 3, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 3'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 4', 'Delicioso bebidas — plato 4 preparado al momento en Pollón Iquique - Vivar.', 8400, true, 4, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 4'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 5', 'Delicioso bebidas — plato 5 preparado al momento en Pollón Iquique - Vivar.', 8600, true, 5, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 5'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 6', 'Delicioso bebidas — plato 6 preparado al momento en Pollón Iquique - Vivar.', 8800, true, 6, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 6'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 7', 'Delicioso bebidas — plato 7 preparado al momento en Pollón Iquique - Vivar.', 9000, true, 7, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 7'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 8', 'Delicioso bebidas — plato 8 preparado al momento en Pollón Iquique - Vivar.', 9200, true, 8, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 8'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 9', 'Delicioso bebidas — plato 9 preparado al momento en Pollón Iquique - Vivar.', 9400, true, 9, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 9'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 10', 'Delicioso bebidas — plato 10 preparado al momento en Pollón Iquique - Vivar.', 9600, true, 10, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 10'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 11', 'Delicioso bebidas — plato 11 preparado al momento en Pollón Iquique - Vivar.', 9800, true, 11, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 11'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 12', 'Delicioso bebidas — plato 12 preparado al momento en Pollón Iquique - Vivar.', 10000, true, 12, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 12'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 13', 'Delicioso bebidas — plato 13 preparado al momento en Pollón Iquique - Vivar.', 10200, true, 13, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 13'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 14', 'Delicioso bebidas — plato 14 preparado al momento en Pollón Iquique - Vivar.', 10400, true, 14, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 14'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 15', 'Delicioso bebidas — plato 15 preparado al momento en Pollón Iquique - Vivar.', 10600, true, 15, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 15'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 1', 'Delicioso descartables — plato 1 preparado al momento en Pollón Iquique - Vivar.', 8300, true, 1, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 1'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 2', 'Delicioso descartables — plato 2 preparado al momento en Pollón Iquique - Vivar.', 8500, true, 2, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 2'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 3', 'Delicioso descartables — plato 3 preparado al momento en Pollón Iquique - Vivar.', 8700, true, 3, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 3'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 4', 'Delicioso descartables — plato 4 preparado al momento en Pollón Iquique - Vivar.', 8900, true, 4, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 4'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 5', 'Delicioso descartables — plato 5 preparado al momento en Pollón Iquique - Vivar.', 9100, true, 5, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 5'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 6', 'Delicioso descartables — plato 6 preparado al momento en Pollón Iquique - Vivar.', 9300, true, 6, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 6'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 7', 'Delicioso descartables — plato 7 preparado al momento en Pollón Iquique - Vivar.', 9500, true, 7, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 7'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 8', 'Delicioso descartables — plato 8 preparado al momento en Pollón Iquique - Vivar.', 9700, true, 8, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 8'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 9', 'Delicioso descartables — plato 9 preparado al momento en Pollón Iquique - Vivar.', 9900, true, 9, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 9'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 10', 'Delicioso descartables — plato 10 preparado al momento en Pollón Iquique - Vivar.', 10100, true, 10, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 10'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 11', 'Delicioso descartables — plato 11 preparado al momento en Pollón Iquique - Vivar.', 10300, true, 11, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 11'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 12', 'Delicioso descartables — plato 12 preparado al momento en Pollón Iquique - Vivar.', 10500, true, 12, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 12'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 13', 'Delicioso descartables — plato 13 preparado al momento en Pollón Iquique - Vivar.', 10700, true, 13, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 13'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 14', 'Delicioso descartables — plato 14 preparado al momento en Pollón Iquique - Vivar.', 10900, true, 14, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 14'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 15', 'Delicioso descartables — plato 15 preparado al momento en Pollón Iquique - Vivar.', 11100, true, 15, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'iquique-vivar'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 15'
);

INSERT INTO delivery_zones (branch_id, zone_name, delivery_price, estimated_time, is_active)
SELECT id, 'Zona principal', 2000, '30-45 min', true FROM branches WHERE slug = 'iquique-vivar'
AND NOT EXISTS (SELECT 1 FROM delivery_zones dz WHERE dz.branch_id = branches.id AND dz.zone_name = 'Zona principal');

-- Pollón Alto Hospicio
INSERT INTO branches (slug, name, city, address, phone, whatsapp, delivery_cost, display_order, is_active)
VALUES ('alto-hospicio', 'Pollón Alto Hospicio', 'Alto Hospicio', 'Alto Hospicio, Tarapacá', '+56 9 0000 0004', '56900000004', 3000, 2, true)
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, city = EXCLUDED.city, address = EXCLUDED.address,
  phone = EXCLUDED.phone, whatsapp = EXCLUDED.whatsapp, delivery_cost = EXCLUDED.delivery_cost, is_active = true;

INSERT INTO categories (branch_id, name, description, display_order, is_active)
SELECT id, 'Ofertas Familiares', 'Menú Ofertas Familiares — Pollón Alto Hospicio', 1, true FROM branches WHERE slug = 'alto-hospicio'
ON CONFLICT (branch_id, name) DO UPDATE SET
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

INSERT INTO categories (branch_id, name, description, display_order, is_active)
SELECT id, 'Ofertas para Dos', 'Menú Ofertas para Dos — Pollón Alto Hospicio', 2, true FROM branches WHERE slug = 'alto-hospicio'
ON CONFLICT (branch_id, name) DO UPDATE SET
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

INSERT INTO categories (branch_id, name, description, display_order, is_active)
SELECT id, 'Ofertas Personales', 'Menú Ofertas Personales — Pollón Alto Hospicio', 3, true FROM branches WHERE slug = 'alto-hospicio'
ON CONFLICT (branch_id, name) DO UPDATE SET
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

INSERT INTO categories (branch_id, name, description, display_order, is_active)
SELECT id, 'Pollos a la Brasa', 'Menú Pollos a la Brasa — Pollón Alto Hospicio', 4, true FROM branches WHERE slug = 'alto-hospicio'
ON CONFLICT (branch_id, name) DO UPDATE SET
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

INSERT INTO categories (branch_id, name, description, display_order, is_active)
SELECT id, 'Platos Extras', 'Menú Platos Extras — Pollón Alto Hospicio', 5, true FROM branches WHERE slug = 'alto-hospicio'
ON CONFLICT (branch_id, name) DO UPDATE SET
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

INSERT INTO categories (branch_id, name, description, display_order, is_active)
SELECT id, 'Agregados', 'Menú Agregados — Pollón Alto Hospicio', 6, true FROM branches WHERE slug = 'alto-hospicio'
ON CONFLICT (branch_id, name) DO UPDATE SET
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

INSERT INTO categories (branch_id, name, description, display_order, is_active)
SELECT id, 'Bebidas', 'Menú Bebidas — Pollón Alto Hospicio', 7, true FROM branches WHERE slug = 'alto-hospicio'
ON CONFLICT (branch_id, name) DO UPDATE SET
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

INSERT INTO categories (branch_id, name, description, display_order, is_active)
SELECT id, 'Descartables', 'Menú Descartables — Pollón Alto Hospicio', 8, true FROM branches WHERE slug = 'alto-hospicio'
ON CONFLICT (branch_id, name) DO UPDATE SET
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Ofertas Familiares — Plato 1', 'Delicioso ofertas familiares — plato 1 preparado al momento en Pollón Alto Hospicio.', 5400, true, 1, true
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Ofertas Familiares'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Ofertas Familiares — Plato 1'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Ofertas Familiares — Plato 2', 'Delicioso ofertas familiares — plato 2 preparado al momento en Pollón Alto Hospicio.', 5600, true, 2, true
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Ofertas Familiares'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Ofertas Familiares — Plato 2'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Ofertas Familiares — Plato 3', 'Delicioso ofertas familiares — plato 3 preparado al momento en Pollón Alto Hospicio.', 5800, true, 3, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Ofertas Familiares'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Ofertas Familiares — Plato 3'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Ofertas Familiares — Plato 4', 'Delicioso ofertas familiares — plato 4 preparado al momento en Pollón Alto Hospicio.', 6000, true, 4, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Ofertas Familiares'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Ofertas Familiares — Plato 4'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Ofertas Familiares — Plato 5', 'Delicioso ofertas familiares — plato 5 preparado al momento en Pollón Alto Hospicio.', 6200, true, 5, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Ofertas Familiares'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Ofertas Familiares — Plato 5'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Ofertas para Dos — Plato 1', 'Delicioso ofertas para dos — plato 1 preparado al momento en Pollón Alto Hospicio.', 5900, true, 1, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Ofertas para Dos'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Ofertas para Dos — Plato 1'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Ofertas para Dos — Plato 2', 'Delicioso ofertas para dos — plato 2 preparado al momento en Pollón Alto Hospicio.', 6100, true, 2, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Ofertas para Dos'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Ofertas para Dos — Plato 2'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Ofertas para Dos — Plato 3', 'Delicioso ofertas para dos — plato 3 preparado al momento en Pollón Alto Hospicio.', 6300, true, 3, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Ofertas para Dos'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Ofertas para Dos — Plato 3'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Ofertas para Dos — Plato 4', 'Delicioso ofertas para dos — plato 4 preparado al momento en Pollón Alto Hospicio.', 6500, true, 4, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Ofertas para Dos'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Ofertas para Dos — Plato 4'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Ofertas para Dos — Plato 5', 'Delicioso ofertas para dos — plato 5 preparado al momento en Pollón Alto Hospicio.', 6700, true, 5, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Ofertas para Dos'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Ofertas para Dos — Plato 5'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Ofertas Personales — Plato 1', 'Delicioso ofertas personales — plato 1 preparado al momento en Pollón Alto Hospicio.', 6400, true, 1, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Ofertas Personales'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Ofertas Personales — Plato 1'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Ofertas Personales — Plato 2', 'Delicioso ofertas personales — plato 2 preparado al momento en Pollón Alto Hospicio.', 6600, true, 2, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Ofertas Personales'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Ofertas Personales — Plato 2'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Ofertas Personales — Plato 3', 'Delicioso ofertas personales — plato 3 preparado al momento en Pollón Alto Hospicio.', 6800, true, 3, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Ofertas Personales'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Ofertas Personales — Plato 3'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Ofertas Personales — Plato 4', 'Delicioso ofertas personales — plato 4 preparado al momento en Pollón Alto Hospicio.', 7000, true, 4, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Ofertas Personales'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Ofertas Personales — Plato 4'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Ofertas Personales — Plato 5', 'Delicioso ofertas personales — plato 5 preparado al momento en Pollón Alto Hospicio.', 7200, true, 5, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Ofertas Personales'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Ofertas Personales — Plato 5'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 1', 'Delicioso pollos a la brasa — plato 1 preparado al momento en Pollón Alto Hospicio.', 6900, true, 1, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 1'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 2', 'Delicioso pollos a la brasa — plato 2 preparado al momento en Pollón Alto Hospicio.', 7100, true, 2, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 2'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 3', 'Delicioso pollos a la brasa — plato 3 preparado al momento en Pollón Alto Hospicio.', 7300, true, 3, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 3'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 4', 'Delicioso pollos a la brasa — plato 4 preparado al momento en Pollón Alto Hospicio.', 7500, true, 4, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 4'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 5', 'Delicioso pollos a la brasa — plato 5 preparado al momento en Pollón Alto Hospicio.', 7700, true, 5, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 5'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 6', 'Delicioso pollos a la brasa — plato 6 preparado al momento en Pollón Alto Hospicio.', 7900, true, 6, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 6'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 7', 'Delicioso pollos a la brasa — plato 7 preparado al momento en Pollón Alto Hospicio.', 8100, true, 7, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 7'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 8', 'Delicioso pollos a la brasa — plato 8 preparado al momento en Pollón Alto Hospicio.', 8300, true, 8, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 8'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 9', 'Delicioso pollos a la brasa — plato 9 preparado al momento en Pollón Alto Hospicio.', 8500, true, 9, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 9'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 10', 'Delicioso pollos a la brasa — plato 10 preparado al momento en Pollón Alto Hospicio.', 8700, true, 10, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 10'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 11', 'Delicioso pollos a la brasa — plato 11 preparado al momento en Pollón Alto Hospicio.', 8900, true, 11, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 11'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 12', 'Delicioso pollos a la brasa — plato 12 preparado al momento en Pollón Alto Hospicio.', 9100, true, 12, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 12'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 13', 'Delicioso pollos a la brasa — plato 13 preparado al momento en Pollón Alto Hospicio.', 9300, true, 13, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 13'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 14', 'Delicioso pollos a la brasa — plato 14 preparado al momento en Pollón Alto Hospicio.', 9500, true, 14, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 14'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 15', 'Delicioso pollos a la brasa — plato 15 preparado al momento en Pollón Alto Hospicio.', 9700, true, 15, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 15'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 1', 'Delicioso platos extras — plato 1 preparado al momento en Pollón Alto Hospicio.', 7400, true, 1, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 1'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 2', 'Delicioso platos extras — plato 2 preparado al momento en Pollón Alto Hospicio.', 7600, true, 2, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 2'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 3', 'Delicioso platos extras — plato 3 preparado al momento en Pollón Alto Hospicio.', 7800, true, 3, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 3'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 4', 'Delicioso platos extras — plato 4 preparado al momento en Pollón Alto Hospicio.', 8000, true, 4, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 4'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 5', 'Delicioso platos extras — plato 5 preparado al momento en Pollón Alto Hospicio.', 8200, true, 5, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 5'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 6', 'Delicioso platos extras — plato 6 preparado al momento en Pollón Alto Hospicio.', 8400, true, 6, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 6'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 7', 'Delicioso platos extras — plato 7 preparado al momento en Pollón Alto Hospicio.', 8600, true, 7, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 7'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 8', 'Delicioso platos extras — plato 8 preparado al momento en Pollón Alto Hospicio.', 8800, true, 8, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 8'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 9', 'Delicioso platos extras — plato 9 preparado al momento en Pollón Alto Hospicio.', 9000, true, 9, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 9'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 10', 'Delicioso platos extras — plato 10 preparado al momento en Pollón Alto Hospicio.', 9200, true, 10, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 10'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 11', 'Delicioso platos extras — plato 11 preparado al momento en Pollón Alto Hospicio.', 9400, true, 11, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 11'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 12', 'Delicioso platos extras — plato 12 preparado al momento en Pollón Alto Hospicio.', 9600, true, 12, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 12'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 13', 'Delicioso platos extras — plato 13 preparado al momento en Pollón Alto Hospicio.', 9800, true, 13, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 13'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 14', 'Delicioso platos extras — plato 14 preparado al momento en Pollón Alto Hospicio.', 10000, true, 14, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 14'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 15', 'Delicioso platos extras — plato 15 preparado al momento en Pollón Alto Hospicio.', 10200, true, 15, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 15'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Agregados — Plato 1', 'Delicioso agregados — plato 1 preparado al momento en Pollón Alto Hospicio.', 7900, true, 1, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Agregados'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Agregados — Plato 1'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Agregados — Plato 2', 'Delicioso agregados — plato 2 preparado al momento en Pollón Alto Hospicio.', 8100, true, 2, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Agregados'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Agregados — Plato 2'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Agregados — Plato 3', 'Delicioso agregados — plato 3 preparado al momento en Pollón Alto Hospicio.', 8300, true, 3, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Agregados'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Agregados — Plato 3'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Agregados — Plato 4', 'Delicioso agregados — plato 4 preparado al momento en Pollón Alto Hospicio.', 8500, true, 4, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Agregados'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Agregados — Plato 4'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Agregados — Plato 5', 'Delicioso agregados — plato 5 preparado al momento en Pollón Alto Hospicio.', 8700, true, 5, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Agregados'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Agregados — Plato 5'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Agregados — Plato 6', 'Delicioso agregados — plato 6 preparado al momento en Pollón Alto Hospicio.', 8900, true, 6, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Agregados'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Agregados — Plato 6'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Agregados — Plato 7', 'Delicioso agregados — plato 7 preparado al momento en Pollón Alto Hospicio.', 9100, true, 7, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Agregados'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Agregados — Plato 7'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Agregados — Plato 8', 'Delicioso agregados — plato 8 preparado al momento en Pollón Alto Hospicio.', 9300, true, 8, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Agregados'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Agregados — Plato 8'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Agregados — Plato 9', 'Delicioso agregados — plato 9 preparado al momento en Pollón Alto Hospicio.', 9500, true, 9, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Agregados'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Agregados — Plato 9'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Agregados — Plato 10', 'Delicioso agregados — plato 10 preparado al momento en Pollón Alto Hospicio.', 9700, true, 10, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Agregados'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Agregados — Plato 10'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Agregados — Plato 11', 'Delicioso agregados — plato 11 preparado al momento en Pollón Alto Hospicio.', 9900, true, 11, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Agregados'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Agregados — Plato 11'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Agregados — Plato 12', 'Delicioso agregados — plato 12 preparado al momento en Pollón Alto Hospicio.', 10100, true, 12, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Agregados'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Agregados — Plato 12'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Agregados — Plato 13', 'Delicioso agregados — plato 13 preparado al momento en Pollón Alto Hospicio.', 10300, true, 13, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Agregados'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Agregados — Plato 13'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Agregados — Plato 14', 'Delicioso agregados — plato 14 preparado al momento en Pollón Alto Hospicio.', 10500, true, 14, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Agregados'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Agregados — Plato 14'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Agregados — Plato 15', 'Delicioso agregados — plato 15 preparado al momento en Pollón Alto Hospicio.', 10700, true, 15, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Agregados'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Agregados — Plato 15'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 1', 'Delicioso bebidas — plato 1 preparado al momento en Pollón Alto Hospicio.', 8400, true, 1, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 1'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 2', 'Delicioso bebidas — plato 2 preparado al momento en Pollón Alto Hospicio.', 8600, true, 2, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 2'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 3', 'Delicioso bebidas — plato 3 preparado al momento en Pollón Alto Hospicio.', 8800, true, 3, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 3'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 4', 'Delicioso bebidas — plato 4 preparado al momento en Pollón Alto Hospicio.', 9000, true, 4, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 4'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 5', 'Delicioso bebidas — plato 5 preparado al momento en Pollón Alto Hospicio.', 9200, true, 5, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 5'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 6', 'Delicioso bebidas — plato 6 preparado al momento en Pollón Alto Hospicio.', 9400, true, 6, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 6'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 7', 'Delicioso bebidas — plato 7 preparado al momento en Pollón Alto Hospicio.', 9600, true, 7, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 7'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 8', 'Delicioso bebidas — plato 8 preparado al momento en Pollón Alto Hospicio.', 9800, true, 8, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 8'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 9', 'Delicioso bebidas — plato 9 preparado al momento en Pollón Alto Hospicio.', 10000, true, 9, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 9'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 10', 'Delicioso bebidas — plato 10 preparado al momento en Pollón Alto Hospicio.', 10200, true, 10, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 10'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 11', 'Delicioso bebidas — plato 11 preparado al momento en Pollón Alto Hospicio.', 10400, true, 11, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 11'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 12', 'Delicioso bebidas — plato 12 preparado al momento en Pollón Alto Hospicio.', 10600, true, 12, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 12'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 13', 'Delicioso bebidas — plato 13 preparado al momento en Pollón Alto Hospicio.', 10800, true, 13, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 13'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 14', 'Delicioso bebidas — plato 14 preparado al momento en Pollón Alto Hospicio.', 11000, true, 14, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 14'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 15', 'Delicioso bebidas — plato 15 preparado al momento en Pollón Alto Hospicio.', 11200, true, 15, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 15'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 1', 'Delicioso descartables — plato 1 preparado al momento en Pollón Alto Hospicio.', 8900, true, 1, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 1'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 2', 'Delicioso descartables — plato 2 preparado al momento en Pollón Alto Hospicio.', 9100, true, 2, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 2'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 3', 'Delicioso descartables — plato 3 preparado al momento en Pollón Alto Hospicio.', 9300, true, 3, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 3'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 4', 'Delicioso descartables — plato 4 preparado al momento en Pollón Alto Hospicio.', 9500, true, 4, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 4'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 5', 'Delicioso descartables — plato 5 preparado al momento en Pollón Alto Hospicio.', 9700, true, 5, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 5'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 6', 'Delicioso descartables — plato 6 preparado al momento en Pollón Alto Hospicio.', 9900, true, 6, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 6'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 7', 'Delicioso descartables — plato 7 preparado al momento en Pollón Alto Hospicio.', 10100, true, 7, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 7'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 8', 'Delicioso descartables — plato 8 preparado al momento en Pollón Alto Hospicio.', 10300, true, 8, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 8'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 9', 'Delicioso descartables — plato 9 preparado al momento en Pollón Alto Hospicio.', 10500, true, 9, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 9'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 10', 'Delicioso descartables — plato 10 preparado al momento en Pollón Alto Hospicio.', 10700, true, 10, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 10'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 11', 'Delicioso descartables — plato 11 preparado al momento en Pollón Alto Hospicio.', 10900, true, 11, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 11'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 12', 'Delicioso descartables — plato 12 preparado al momento en Pollón Alto Hospicio.', 11100, true, 12, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 12'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 13', 'Delicioso descartables — plato 13 preparado al momento en Pollón Alto Hospicio.', 11300, true, 13, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 13'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 14', 'Delicioso descartables — plato 14 preparado al momento en Pollón Alto Hospicio.', 11500, true, 14, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 14'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 15', 'Delicioso descartables — plato 15 preparado al momento en Pollón Alto Hospicio.', 11700, true, 15, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'alto-hospicio'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 15'
);

INSERT INTO delivery_zones (branch_id, zone_name, delivery_price, estimated_time, is_active)
SELECT id, 'Zona principal', 3000, '30-45 min', true FROM branches WHERE slug = 'alto-hospicio'
AND NOT EXISTS (SELECT 1 FROM delivery_zones dz WHERE dz.branch_id = branches.id AND dz.zone_name = 'Zona principal');

-- Pollón Arica - Santa María
INSERT INTO branches (slug, name, city, address, phone, whatsapp, delivery_cost, display_order, is_active)
VALUES ('arica-santa-maria', 'Pollón Arica - Santa María', 'Arica', 'Santa María, Arica', '+56 9 0000 0001', '56900000001', 2500, 3, true)
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, city = EXCLUDED.city, address = EXCLUDED.address,
  phone = EXCLUDED.phone, whatsapp = EXCLUDED.whatsapp, delivery_cost = EXCLUDED.delivery_cost, is_active = true;

INSERT INTO categories (branch_id, name, description, display_order, is_active)
SELECT id, 'Ofertas Familiares', 'Menú Ofertas Familiares — Pollón Arica - Santa María', 1, true FROM branches WHERE slug = 'arica-santa-maria'
ON CONFLICT (branch_id, name) DO UPDATE SET
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

INSERT INTO categories (branch_id, name, description, display_order, is_active)
SELECT id, 'Ofertas para Dos', 'Menú Ofertas para Dos — Pollón Arica - Santa María', 2, true FROM branches WHERE slug = 'arica-santa-maria'
ON CONFLICT (branch_id, name) DO UPDATE SET
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

INSERT INTO categories (branch_id, name, description, display_order, is_active)
SELECT id, 'Ofertas Personales', 'Menú Ofertas Personales — Pollón Arica - Santa María', 3, true FROM branches WHERE slug = 'arica-santa-maria'
ON CONFLICT (branch_id, name) DO UPDATE SET
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

INSERT INTO categories (branch_id, name, description, display_order, is_active)
SELECT id, 'Pollos a la Brasa', 'Menú Pollos a la Brasa — Pollón Arica - Santa María', 4, true FROM branches WHERE slug = 'arica-santa-maria'
ON CONFLICT (branch_id, name) DO UPDATE SET
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

INSERT INTO categories (branch_id, name, description, display_order, is_active)
SELECT id, 'Parrillas', 'Menú Parrillas — Pollón Arica - Santa María', 5, true FROM branches WHERE slug = 'arica-santa-maria'
ON CONFLICT (branch_id, name) DO UPDATE SET
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

INSERT INTO categories (branch_id, name, description, display_order, is_active)
SELECT id, 'Platos Extras', 'Menú Platos Extras — Pollón Arica - Santa María', 6, true FROM branches WHERE slug = 'arica-santa-maria'
ON CONFLICT (branch_id, name) DO UPDATE SET
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

INSERT INTO categories (branch_id, name, description, display_order, is_active)
SELECT id, 'Agregados', 'Menú Agregados — Pollón Arica - Santa María', 7, true FROM branches WHERE slug = 'arica-santa-maria'
ON CONFLICT (branch_id, name) DO UPDATE SET
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

INSERT INTO categories (branch_id, name, description, display_order, is_active)
SELECT id, 'Bebidas', 'Menú Bebidas — Pollón Arica - Santa María', 8, true FROM branches WHERE slug = 'arica-santa-maria'
ON CONFLICT (branch_id, name) DO UPDATE SET
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

INSERT INTO categories (branch_id, name, description, display_order, is_active)
SELECT id, 'Descartables', 'Menú Descartables — Pollón Arica - Santa María', 9, true FROM branches WHERE slug = 'arica-santa-maria'
ON CONFLICT (branch_id, name) DO UPDATE SET
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Ofertas Familiares — Plato 1', 'Delicioso ofertas familiares — plato 1 preparado al momento en Pollón Arica - Santa María.', 5500, true, 1, true
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Ofertas Familiares'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Ofertas Familiares — Plato 1'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Ofertas Familiares — Plato 2', 'Delicioso ofertas familiares — plato 2 preparado al momento en Pollón Arica - Santa María.', 5700, true, 2, true
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Ofertas Familiares'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Ofertas Familiares — Plato 2'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Ofertas Familiares — Plato 3', 'Delicioso ofertas familiares — plato 3 preparado al momento en Pollón Arica - Santa María.', 5900, true, 3, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Ofertas Familiares'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Ofertas Familiares — Plato 3'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Ofertas Familiares — Plato 4', 'Delicioso ofertas familiares — plato 4 preparado al momento en Pollón Arica - Santa María.', 6100, true, 4, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Ofertas Familiares'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Ofertas Familiares — Plato 4'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Ofertas Familiares — Plato 5', 'Delicioso ofertas familiares — plato 5 preparado al momento en Pollón Arica - Santa María.', 6300, true, 5, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Ofertas Familiares'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Ofertas Familiares — Plato 5'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Ofertas para Dos — Plato 1', 'Delicioso ofertas para dos — plato 1 preparado al momento en Pollón Arica - Santa María.', 6000, true, 1, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Ofertas para Dos'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Ofertas para Dos — Plato 1'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Ofertas para Dos — Plato 2', 'Delicioso ofertas para dos — plato 2 preparado al momento en Pollón Arica - Santa María.', 6200, true, 2, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Ofertas para Dos'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Ofertas para Dos — Plato 2'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Ofertas para Dos — Plato 3', 'Delicioso ofertas para dos — plato 3 preparado al momento en Pollón Arica - Santa María.', 6400, true, 3, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Ofertas para Dos'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Ofertas para Dos — Plato 3'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Ofertas para Dos — Plato 4', 'Delicioso ofertas para dos — plato 4 preparado al momento en Pollón Arica - Santa María.', 6600, true, 4, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Ofertas para Dos'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Ofertas para Dos — Plato 4'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Ofertas para Dos — Plato 5', 'Delicioso ofertas para dos — plato 5 preparado al momento en Pollón Arica - Santa María.', 6800, true, 5, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Ofertas para Dos'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Ofertas para Dos — Plato 5'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Ofertas Personales — Plato 1', 'Delicioso ofertas personales — plato 1 preparado al momento en Pollón Arica - Santa María.', 6500, true, 1, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Ofertas Personales'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Ofertas Personales — Plato 1'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Ofertas Personales — Plato 2', 'Delicioso ofertas personales — plato 2 preparado al momento en Pollón Arica - Santa María.', 6700, true, 2, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Ofertas Personales'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Ofertas Personales — Plato 2'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Ofertas Personales — Plato 3', 'Delicioso ofertas personales — plato 3 preparado al momento en Pollón Arica - Santa María.', 6900, true, 3, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Ofertas Personales'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Ofertas Personales — Plato 3'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Ofertas Personales — Plato 4', 'Delicioso ofertas personales — plato 4 preparado al momento en Pollón Arica - Santa María.', 7100, true, 4, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Ofertas Personales'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Ofertas Personales — Plato 4'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Ofertas Personales — Plato 5', 'Delicioso ofertas personales — plato 5 preparado al momento en Pollón Arica - Santa María.', 7300, true, 5, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Ofertas Personales'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Ofertas Personales — Plato 5'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 1', 'Delicioso pollos a la brasa — plato 1 preparado al momento en Pollón Arica - Santa María.', 7000, true, 1, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 1'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 2', 'Delicioso pollos a la brasa — plato 2 preparado al momento en Pollón Arica - Santa María.', 7200, true, 2, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 2'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 3', 'Delicioso pollos a la brasa — plato 3 preparado al momento en Pollón Arica - Santa María.', 7400, true, 3, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 3'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 4', 'Delicioso pollos a la brasa — plato 4 preparado al momento en Pollón Arica - Santa María.', 7600, true, 4, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 4'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 5', 'Delicioso pollos a la brasa — plato 5 preparado al momento en Pollón Arica - Santa María.', 7800, true, 5, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 5'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 6', 'Delicioso pollos a la brasa — plato 6 preparado al momento en Pollón Arica - Santa María.', 8000, true, 6, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 6'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 7', 'Delicioso pollos a la brasa — plato 7 preparado al momento en Pollón Arica - Santa María.', 8200, true, 7, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 7'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 8', 'Delicioso pollos a la brasa — plato 8 preparado al momento en Pollón Arica - Santa María.', 8400, true, 8, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 8'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 9', 'Delicioso pollos a la brasa — plato 9 preparado al momento en Pollón Arica - Santa María.', 8600, true, 9, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 9'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 10', 'Delicioso pollos a la brasa — plato 10 preparado al momento en Pollón Arica - Santa María.', 8800, true, 10, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 10'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 11', 'Delicioso pollos a la brasa — plato 11 preparado al momento en Pollón Arica - Santa María.', 9000, true, 11, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 11'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 12', 'Delicioso pollos a la brasa — plato 12 preparado al momento en Pollón Arica - Santa María.', 9200, true, 12, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 12'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 13', 'Delicioso pollos a la brasa — plato 13 preparado al momento en Pollón Arica - Santa María.', 9400, true, 13, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 13'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 14', 'Delicioso pollos a la brasa — plato 14 preparado al momento en Pollón Arica - Santa María.', 9600, true, 14, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 14'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 15', 'Delicioso pollos a la brasa — plato 15 preparado al momento en Pollón Arica - Santa María.', 9800, true, 15, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 15'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 16', 'Delicioso pollos a la brasa — plato 16 preparado al momento en Pollón Arica - Santa María.', 10000, true, 16, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 16'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Parrillas — Plato 1', 'Delicioso parrillas — plato 1 preparado al momento en Pollón Arica - Santa María.', 7500, true, 1, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Parrillas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Parrillas — Plato 1'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Parrillas — Plato 2', 'Delicioso parrillas — plato 2 preparado al momento en Pollón Arica - Santa María.', 7700, true, 2, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Parrillas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Parrillas — Plato 2'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Parrillas — Plato 3', 'Delicioso parrillas — plato 3 preparado al momento en Pollón Arica - Santa María.', 7900, true, 3, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Parrillas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Parrillas — Plato 3'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Parrillas — Plato 4', 'Delicioso parrillas — plato 4 preparado al momento en Pollón Arica - Santa María.', 8100, true, 4, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Parrillas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Parrillas — Plato 4'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Parrillas — Plato 5', 'Delicioso parrillas — plato 5 preparado al momento en Pollón Arica - Santa María.', 8300, true, 5, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Parrillas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Parrillas — Plato 5'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Parrillas — Plato 6', 'Delicioso parrillas — plato 6 preparado al momento en Pollón Arica - Santa María.', 8500, true, 6, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Parrillas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Parrillas — Plato 6'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Parrillas — Plato 7', 'Delicioso parrillas — plato 7 preparado al momento en Pollón Arica - Santa María.', 8700, true, 7, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Parrillas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Parrillas — Plato 7'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Parrillas — Plato 8', 'Delicioso parrillas — plato 8 preparado al momento en Pollón Arica - Santa María.', 8900, true, 8, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Parrillas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Parrillas — Plato 8'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Parrillas — Plato 9', 'Delicioso parrillas — plato 9 preparado al momento en Pollón Arica - Santa María.', 9100, true, 9, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Parrillas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Parrillas — Plato 9'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Parrillas — Plato 10', 'Delicioso parrillas — plato 10 preparado al momento en Pollón Arica - Santa María.', 9300, true, 10, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Parrillas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Parrillas — Plato 10'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Parrillas — Plato 11', 'Delicioso parrillas — plato 11 preparado al momento en Pollón Arica - Santa María.', 9500, true, 11, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Parrillas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Parrillas — Plato 11'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Parrillas — Plato 12', 'Delicioso parrillas — plato 12 preparado al momento en Pollón Arica - Santa María.', 9700, true, 12, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Parrillas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Parrillas — Plato 12'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Parrillas — Plato 13', 'Delicioso parrillas — plato 13 preparado al momento en Pollón Arica - Santa María.', 9900, true, 13, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Parrillas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Parrillas — Plato 13'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Parrillas — Plato 14', 'Delicioso parrillas — plato 14 preparado al momento en Pollón Arica - Santa María.', 10100, true, 14, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Parrillas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Parrillas — Plato 14'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Parrillas — Plato 15', 'Delicioso parrillas — plato 15 preparado al momento en Pollón Arica - Santa María.', 10300, true, 15, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Parrillas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Parrillas — Plato 15'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Parrillas — Plato 16', 'Delicioso parrillas — plato 16 preparado al momento en Pollón Arica - Santa María.', 10500, true, 16, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Parrillas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Parrillas — Plato 16'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 1', 'Delicioso platos extras — plato 1 preparado al momento en Pollón Arica - Santa María.', 8000, true, 1, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 1'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 2', 'Delicioso platos extras — plato 2 preparado al momento en Pollón Arica - Santa María.', 8200, true, 2, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 2'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 3', 'Delicioso platos extras — plato 3 preparado al momento en Pollón Arica - Santa María.', 8400, true, 3, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 3'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 4', 'Delicioso platos extras — plato 4 preparado al momento en Pollón Arica - Santa María.', 8600, true, 4, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 4'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 5', 'Delicioso platos extras — plato 5 preparado al momento en Pollón Arica - Santa María.', 8800, true, 5, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 5'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 6', 'Delicioso platos extras — plato 6 preparado al momento en Pollón Arica - Santa María.', 9000, true, 6, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 6'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 7', 'Delicioso platos extras — plato 7 preparado al momento en Pollón Arica - Santa María.', 9200, true, 7, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 7'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 8', 'Delicioso platos extras — plato 8 preparado al momento en Pollón Arica - Santa María.', 9400, true, 8, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 8'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 9', 'Delicioso platos extras — plato 9 preparado al momento en Pollón Arica - Santa María.', 9600, true, 9, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 9'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 10', 'Delicioso platos extras — plato 10 preparado al momento en Pollón Arica - Santa María.', 9800, true, 10, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 10'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 11', 'Delicioso platos extras — plato 11 preparado al momento en Pollón Arica - Santa María.', 10000, true, 11, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 11'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 12', 'Delicioso platos extras — plato 12 preparado al momento en Pollón Arica - Santa María.', 10200, true, 12, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 12'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 13', 'Delicioso platos extras — plato 13 preparado al momento en Pollón Arica - Santa María.', 10400, true, 13, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 13'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 14', 'Delicioso platos extras — plato 14 preparado al momento en Pollón Arica - Santa María.', 10600, true, 14, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 14'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 15', 'Delicioso platos extras — plato 15 preparado al momento en Pollón Arica - Santa María.', 10800, true, 15, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 15'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 16', 'Delicioso platos extras — plato 16 preparado al momento en Pollón Arica - Santa María.', 11000, true, 16, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 16'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Agregados — Plato 1', 'Delicioso agregados — plato 1 preparado al momento en Pollón Arica - Santa María.', 8500, true, 1, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Agregados'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Agregados — Plato 1'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Agregados — Plato 2', 'Delicioso agregados — plato 2 preparado al momento en Pollón Arica - Santa María.', 8700, true, 2, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Agregados'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Agregados — Plato 2'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Agregados — Plato 3', 'Delicioso agregados — plato 3 preparado al momento en Pollón Arica - Santa María.', 8900, true, 3, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Agregados'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Agregados — Plato 3'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Agregados — Plato 4', 'Delicioso agregados — plato 4 preparado al momento en Pollón Arica - Santa María.', 9100, true, 4, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Agregados'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Agregados — Plato 4'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Agregados — Plato 5', 'Delicioso agregados — plato 5 preparado al momento en Pollón Arica - Santa María.', 9300, true, 5, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Agregados'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Agregados — Plato 5'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Agregados — Plato 6', 'Delicioso agregados — plato 6 preparado al momento en Pollón Arica - Santa María.', 9500, true, 6, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Agregados'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Agregados — Plato 6'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Agregados — Plato 7', 'Delicioso agregados — plato 7 preparado al momento en Pollón Arica - Santa María.', 9700, true, 7, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Agregados'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Agregados — Plato 7'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Agregados — Plato 8', 'Delicioso agregados — plato 8 preparado al momento en Pollón Arica - Santa María.', 9900, true, 8, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Agregados'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Agregados — Plato 8'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Agregados — Plato 9', 'Delicioso agregados — plato 9 preparado al momento en Pollón Arica - Santa María.', 10100, true, 9, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Agregados'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Agregados — Plato 9'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Agregados — Plato 10', 'Delicioso agregados — plato 10 preparado al momento en Pollón Arica - Santa María.', 10300, true, 10, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Agregados'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Agregados — Plato 10'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Agregados — Plato 11', 'Delicioso agregados — plato 11 preparado al momento en Pollón Arica - Santa María.', 10500, true, 11, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Agregados'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Agregados — Plato 11'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Agregados — Plato 12', 'Delicioso agregados — plato 12 preparado al momento en Pollón Arica - Santa María.', 10700, true, 12, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Agregados'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Agregados — Plato 12'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Agregados — Plato 13', 'Delicioso agregados — plato 13 preparado al momento en Pollón Arica - Santa María.', 10900, true, 13, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Agregados'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Agregados — Plato 13'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Agregados — Plato 14', 'Delicioso agregados — plato 14 preparado al momento en Pollón Arica - Santa María.', 11100, true, 14, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Agregados'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Agregados — Plato 14'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Agregados — Plato 15', 'Delicioso agregados — plato 15 preparado al momento en Pollón Arica - Santa María.', 11300, true, 15, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Agregados'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Agregados — Plato 15'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Agregados — Plato 16', 'Delicioso agregados — plato 16 preparado al momento en Pollón Arica - Santa María.', 11500, true, 16, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Agregados'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Agregados — Plato 16'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 1', 'Delicioso bebidas — plato 1 preparado al momento en Pollón Arica - Santa María.', 9000, true, 1, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 1'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 2', 'Delicioso bebidas — plato 2 preparado al momento en Pollón Arica - Santa María.', 9200, true, 2, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 2'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 3', 'Delicioso bebidas — plato 3 preparado al momento en Pollón Arica - Santa María.', 9400, true, 3, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 3'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 4', 'Delicioso bebidas — plato 4 preparado al momento en Pollón Arica - Santa María.', 9600, true, 4, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 4'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 5', 'Delicioso bebidas — plato 5 preparado al momento en Pollón Arica - Santa María.', 9800, true, 5, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 5'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 6', 'Delicioso bebidas — plato 6 preparado al momento en Pollón Arica - Santa María.', 10000, true, 6, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 6'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 7', 'Delicioso bebidas — plato 7 preparado al momento en Pollón Arica - Santa María.', 10200, true, 7, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 7'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 8', 'Delicioso bebidas — plato 8 preparado al momento en Pollón Arica - Santa María.', 10400, true, 8, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 8'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 9', 'Delicioso bebidas — plato 9 preparado al momento en Pollón Arica - Santa María.', 10600, true, 9, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 9'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 10', 'Delicioso bebidas — plato 10 preparado al momento en Pollón Arica - Santa María.', 10800, true, 10, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 10'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 11', 'Delicioso bebidas — plato 11 preparado al momento en Pollón Arica - Santa María.', 11000, true, 11, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 11'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 12', 'Delicioso bebidas — plato 12 preparado al momento en Pollón Arica - Santa María.', 11200, true, 12, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 12'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 13', 'Delicioso bebidas — plato 13 preparado al momento en Pollón Arica - Santa María.', 11400, true, 13, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 13'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 14', 'Delicioso bebidas — plato 14 preparado al momento en Pollón Arica - Santa María.', 11600, true, 14, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 14'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 15', 'Delicioso bebidas — plato 15 preparado al momento en Pollón Arica - Santa María.', 11800, true, 15, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 15'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 16', 'Delicioso bebidas — plato 16 preparado al momento en Pollón Arica - Santa María.', 12000, true, 16, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 16'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 1', 'Delicioso descartables — plato 1 preparado al momento en Pollón Arica - Santa María.', 9500, true, 1, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 1'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 2', 'Delicioso descartables — plato 2 preparado al momento en Pollón Arica - Santa María.', 9700, true, 2, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 2'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 3', 'Delicioso descartables — plato 3 preparado al momento en Pollón Arica - Santa María.', 9900, true, 3, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 3'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 4', 'Delicioso descartables — plato 4 preparado al momento en Pollón Arica - Santa María.', 10100, true, 4, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 4'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 5', 'Delicioso descartables — plato 5 preparado al momento en Pollón Arica - Santa María.', 10300, true, 5, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 5'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 6', 'Delicioso descartables — plato 6 preparado al momento en Pollón Arica - Santa María.', 10500, true, 6, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 6'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 7', 'Delicioso descartables — plato 7 preparado al momento en Pollón Arica - Santa María.', 10700, true, 7, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 7'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 8', 'Delicioso descartables — plato 8 preparado al momento en Pollón Arica - Santa María.', 10900, true, 8, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 8'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 9', 'Delicioso descartables — plato 9 preparado al momento en Pollón Arica - Santa María.', 11100, true, 9, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 9'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 10', 'Delicioso descartables — plato 10 preparado al momento en Pollón Arica - Santa María.', 11300, true, 10, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 10'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 11', 'Delicioso descartables — plato 11 preparado al momento en Pollón Arica - Santa María.', 11500, true, 11, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 11'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 12', 'Delicioso descartables — plato 12 preparado al momento en Pollón Arica - Santa María.', 11700, true, 12, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 12'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 13', 'Delicioso descartables — plato 13 preparado al momento en Pollón Arica - Santa María.', 11900, true, 13, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 13'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 14', 'Delicioso descartables — plato 14 preparado al momento en Pollón Arica - Santa María.', 12100, true, 14, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 14'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 15', 'Delicioso descartables — plato 15 preparado al momento en Pollón Arica - Santa María.', 12300, true, 15, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 15'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 16', 'Delicioso descartables — plato 16 preparado al momento en Pollón Arica - Santa María.', 12500, true, 16, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-santa-maria'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 16'
);

INSERT INTO delivery_zones (branch_id, zone_name, delivery_price, estimated_time, is_active)
SELECT id, 'Zona principal', 2500, '30-45 min', true FROM branches WHERE slug = 'arica-santa-maria'
AND NOT EXISTS (SELECT 1 FROM delivery_zones dz WHERE dz.branch_id = branches.id AND dz.zone_name = 'Zona principal');

-- Pollón Arica - Saucache
INSERT INTO branches (slug, name, city, address, phone, whatsapp, delivery_cost, display_order, is_active)
VALUES ('arica-saucache', 'Pollón Arica - Saucache', 'Arica', 'Saucache, Arica', '+56 9 0000 0002', '56900000002', 2500, 4, true)
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, city = EXCLUDED.city, address = EXCLUDED.address,
  phone = EXCLUDED.phone, whatsapp = EXCLUDED.whatsapp, delivery_cost = EXCLUDED.delivery_cost, is_active = true;

INSERT INTO categories (branch_id, name, description, display_order, is_active)
SELECT id, 'Ofertas Familiares', 'Menú Ofertas Familiares — Pollón Arica - Saucache', 1, true FROM branches WHERE slug = 'arica-saucache'
ON CONFLICT (branch_id, name) DO UPDATE SET
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

INSERT INTO categories (branch_id, name, description, display_order, is_active)
SELECT id, 'Ofertas para Dos', 'Menú Ofertas para Dos — Pollón Arica - Saucache', 2, true FROM branches WHERE slug = 'arica-saucache'
ON CONFLICT (branch_id, name) DO UPDATE SET
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

INSERT INTO categories (branch_id, name, description, display_order, is_active)
SELECT id, 'Ofertas Personales', 'Menú Ofertas Personales — Pollón Arica - Saucache', 3, true FROM branches WHERE slug = 'arica-saucache'
ON CONFLICT (branch_id, name) DO UPDATE SET
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

INSERT INTO categories (branch_id, name, description, display_order, is_active)
SELECT id, 'Pollos a la Brasa', 'Menú Pollos a la Brasa — Pollón Arica - Saucache', 4, true FROM branches WHERE slug = 'arica-saucache'
ON CONFLICT (branch_id, name) DO UPDATE SET
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

INSERT INTO categories (branch_id, name, description, display_order, is_active)
SELECT id, 'Parrillas', 'Menú Parrillas — Pollón Arica - Saucache', 5, true FROM branches WHERE slug = 'arica-saucache'
ON CONFLICT (branch_id, name) DO UPDATE SET
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

INSERT INTO categories (branch_id, name, description, display_order, is_active)
SELECT id, 'Platos Extras', 'Menú Platos Extras — Pollón Arica - Saucache', 6, true FROM branches WHERE slug = 'arica-saucache'
ON CONFLICT (branch_id, name) DO UPDATE SET
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

INSERT INTO categories (branch_id, name, description, display_order, is_active)
SELECT id, 'Agregados', 'Menú Agregados — Pollón Arica - Saucache', 7, true FROM branches WHERE slug = 'arica-saucache'
ON CONFLICT (branch_id, name) DO UPDATE SET
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

INSERT INTO categories (branch_id, name, description, display_order, is_active)
SELECT id, 'Bebidas', 'Menú Bebidas — Pollón Arica - Saucache', 8, true FROM branches WHERE slug = 'arica-saucache'
ON CONFLICT (branch_id, name) DO UPDATE SET
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

INSERT INTO categories (branch_id, name, description, display_order, is_active)
SELECT id, 'Descartables', 'Menú Descartables — Pollón Arica - Saucache', 9, true FROM branches WHERE slug = 'arica-saucache'
ON CONFLICT (branch_id, name) DO UPDATE SET
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Ofertas Familiares — Plato 1', 'Delicioso ofertas familiares — plato 1 preparado al momento en Pollón Arica - Saucache.', 5600, true, 1, true
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Ofertas Familiares'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Ofertas Familiares — Plato 1'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Ofertas Familiares — Plato 2', 'Delicioso ofertas familiares — plato 2 preparado al momento en Pollón Arica - Saucache.', 5800, true, 2, true
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Ofertas Familiares'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Ofertas Familiares — Plato 2'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Ofertas Familiares — Plato 3', 'Delicioso ofertas familiares — plato 3 preparado al momento en Pollón Arica - Saucache.', 6000, true, 3, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Ofertas Familiares'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Ofertas Familiares — Plato 3'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Ofertas Familiares — Plato 4', 'Delicioso ofertas familiares — plato 4 preparado al momento en Pollón Arica - Saucache.', 6200, true, 4, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Ofertas Familiares'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Ofertas Familiares — Plato 4'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Ofertas Familiares — Plato 5', 'Delicioso ofertas familiares — plato 5 preparado al momento en Pollón Arica - Saucache.', 6400, true, 5, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Ofertas Familiares'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Ofertas Familiares — Plato 5'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Ofertas para Dos — Plato 1', 'Delicioso ofertas para dos — plato 1 preparado al momento en Pollón Arica - Saucache.', 6100, true, 1, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Ofertas para Dos'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Ofertas para Dos — Plato 1'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Ofertas para Dos — Plato 2', 'Delicioso ofertas para dos — plato 2 preparado al momento en Pollón Arica - Saucache.', 6300, true, 2, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Ofertas para Dos'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Ofertas para Dos — Plato 2'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Ofertas para Dos — Plato 3', 'Delicioso ofertas para dos — plato 3 preparado al momento en Pollón Arica - Saucache.', 6500, true, 3, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Ofertas para Dos'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Ofertas para Dos — Plato 3'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Ofertas para Dos — Plato 4', 'Delicioso ofertas para dos — plato 4 preparado al momento en Pollón Arica - Saucache.', 6700, true, 4, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Ofertas para Dos'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Ofertas para Dos — Plato 4'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Ofertas para Dos — Plato 5', 'Delicioso ofertas para dos — plato 5 preparado al momento en Pollón Arica - Saucache.', 6900, true, 5, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Ofertas para Dos'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Ofertas para Dos — Plato 5'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Ofertas Personales — Plato 1', 'Delicioso ofertas personales — plato 1 preparado al momento en Pollón Arica - Saucache.', 6600, true, 1, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Ofertas Personales'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Ofertas Personales — Plato 1'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Ofertas Personales — Plato 2', 'Delicioso ofertas personales — plato 2 preparado al momento en Pollón Arica - Saucache.', 6800, true, 2, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Ofertas Personales'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Ofertas Personales — Plato 2'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Ofertas Personales — Plato 3', 'Delicioso ofertas personales — plato 3 preparado al momento en Pollón Arica - Saucache.', 7000, true, 3, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Ofertas Personales'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Ofertas Personales — Plato 3'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Ofertas Personales — Plato 4', 'Delicioso ofertas personales — plato 4 preparado al momento en Pollón Arica - Saucache.', 7200, true, 4, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Ofertas Personales'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Ofertas Personales — Plato 4'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Ofertas Personales — Plato 5', 'Delicioso ofertas personales — plato 5 preparado al momento en Pollón Arica - Saucache.', 7400, true, 5, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Ofertas Personales'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Ofertas Personales — Plato 5'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 1', 'Delicioso pollos a la brasa — plato 1 preparado al momento en Pollón Arica - Saucache.', 7100, true, 1, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 1'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 2', 'Delicioso pollos a la brasa — plato 2 preparado al momento en Pollón Arica - Saucache.', 7300, true, 2, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 2'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 3', 'Delicioso pollos a la brasa — plato 3 preparado al momento en Pollón Arica - Saucache.', 7500, true, 3, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 3'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 4', 'Delicioso pollos a la brasa — plato 4 preparado al momento en Pollón Arica - Saucache.', 7700, true, 4, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 4'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 5', 'Delicioso pollos a la brasa — plato 5 preparado al momento en Pollón Arica - Saucache.', 7900, true, 5, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 5'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 6', 'Delicioso pollos a la brasa — plato 6 preparado al momento en Pollón Arica - Saucache.', 8100, true, 6, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 6'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 7', 'Delicioso pollos a la brasa — plato 7 preparado al momento en Pollón Arica - Saucache.', 8300, true, 7, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 7'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 8', 'Delicioso pollos a la brasa — plato 8 preparado al momento en Pollón Arica - Saucache.', 8500, true, 8, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 8'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 9', 'Delicioso pollos a la brasa — plato 9 preparado al momento en Pollón Arica - Saucache.', 8700, true, 9, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 9'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 10', 'Delicioso pollos a la brasa — plato 10 preparado al momento en Pollón Arica - Saucache.', 8900, true, 10, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 10'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 11', 'Delicioso pollos a la brasa — plato 11 preparado al momento en Pollón Arica - Saucache.', 9100, true, 11, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 11'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 12', 'Delicioso pollos a la brasa — plato 12 preparado al momento en Pollón Arica - Saucache.', 9300, true, 12, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 12'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 13', 'Delicioso pollos a la brasa — plato 13 preparado al momento en Pollón Arica - Saucache.', 9500, true, 13, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 13'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 14', 'Delicioso pollos a la brasa — plato 14 preparado al momento en Pollón Arica - Saucache.', 9700, true, 14, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 14'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 15', 'Delicioso pollos a la brasa — plato 15 preparado al momento en Pollón Arica - Saucache.', 9900, true, 15, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 15'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 16', 'Delicioso pollos a la brasa — plato 16 preparado al momento en Pollón Arica - Saucache.', 10100, true, 16, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 16'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Pollos a la Brasa — Plato 17', 'Delicioso pollos a la brasa — plato 17 preparado al momento en Pollón Arica - Saucache.', 10300, true, 17, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Pollos a la Brasa'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Pollos a la Brasa — Plato 17'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Parrillas — Plato 1', 'Delicioso parrillas — plato 1 preparado al momento en Pollón Arica - Saucache.', 7600, true, 1, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Parrillas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Parrillas — Plato 1'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Parrillas — Plato 2', 'Delicioso parrillas — plato 2 preparado al momento en Pollón Arica - Saucache.', 7800, true, 2, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Parrillas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Parrillas — Plato 2'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Parrillas — Plato 3', 'Delicioso parrillas — plato 3 preparado al momento en Pollón Arica - Saucache.', 8000, true, 3, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Parrillas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Parrillas — Plato 3'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Parrillas — Plato 4', 'Delicioso parrillas — plato 4 preparado al momento en Pollón Arica - Saucache.', 8200, true, 4, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Parrillas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Parrillas — Plato 4'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Parrillas — Plato 5', 'Delicioso parrillas — plato 5 preparado al momento en Pollón Arica - Saucache.', 8400, true, 5, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Parrillas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Parrillas — Plato 5'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Parrillas — Plato 6', 'Delicioso parrillas — plato 6 preparado al momento en Pollón Arica - Saucache.', 8600, true, 6, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Parrillas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Parrillas — Plato 6'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Parrillas — Plato 7', 'Delicioso parrillas — plato 7 preparado al momento en Pollón Arica - Saucache.', 8800, true, 7, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Parrillas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Parrillas — Plato 7'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Parrillas — Plato 8', 'Delicioso parrillas — plato 8 preparado al momento en Pollón Arica - Saucache.', 9000, true, 8, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Parrillas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Parrillas — Plato 8'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Parrillas — Plato 9', 'Delicioso parrillas — plato 9 preparado al momento en Pollón Arica - Saucache.', 9200, true, 9, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Parrillas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Parrillas — Plato 9'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Parrillas — Plato 10', 'Delicioso parrillas — plato 10 preparado al momento en Pollón Arica - Saucache.', 9400, true, 10, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Parrillas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Parrillas — Plato 10'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Parrillas — Plato 11', 'Delicioso parrillas — plato 11 preparado al momento en Pollón Arica - Saucache.', 9600, true, 11, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Parrillas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Parrillas — Plato 11'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Parrillas — Plato 12', 'Delicioso parrillas — plato 12 preparado al momento en Pollón Arica - Saucache.', 9800, true, 12, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Parrillas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Parrillas — Plato 12'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Parrillas — Plato 13', 'Delicioso parrillas — plato 13 preparado al momento en Pollón Arica - Saucache.', 10000, true, 13, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Parrillas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Parrillas — Plato 13'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Parrillas — Plato 14', 'Delicioso parrillas — plato 14 preparado al momento en Pollón Arica - Saucache.', 10200, true, 14, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Parrillas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Parrillas — Plato 14'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Parrillas — Plato 15', 'Delicioso parrillas — plato 15 preparado al momento en Pollón Arica - Saucache.', 10400, true, 15, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Parrillas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Parrillas — Plato 15'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Parrillas — Plato 16', 'Delicioso parrillas — plato 16 preparado al momento en Pollón Arica - Saucache.', 10600, true, 16, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Parrillas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Parrillas — Plato 16'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Parrillas — Plato 17', 'Delicioso parrillas — plato 17 preparado al momento en Pollón Arica - Saucache.', 10800, true, 17, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Parrillas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Parrillas — Plato 17'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 1', 'Delicioso platos extras — plato 1 preparado al momento en Pollón Arica - Saucache.', 8100, true, 1, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 1'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 2', 'Delicioso platos extras — plato 2 preparado al momento en Pollón Arica - Saucache.', 8300, true, 2, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 2'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 3', 'Delicioso platos extras — plato 3 preparado al momento en Pollón Arica - Saucache.', 8500, true, 3, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 3'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 4', 'Delicioso platos extras — plato 4 preparado al momento en Pollón Arica - Saucache.', 8700, true, 4, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 4'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 5', 'Delicioso platos extras — plato 5 preparado al momento en Pollón Arica - Saucache.', 8900, true, 5, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 5'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 6', 'Delicioso platos extras — plato 6 preparado al momento en Pollón Arica - Saucache.', 9100, true, 6, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 6'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 7', 'Delicioso platos extras — plato 7 preparado al momento en Pollón Arica - Saucache.', 9300, true, 7, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 7'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 8', 'Delicioso platos extras — plato 8 preparado al momento en Pollón Arica - Saucache.', 9500, true, 8, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 8'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 9', 'Delicioso platos extras — plato 9 preparado al momento en Pollón Arica - Saucache.', 9700, true, 9, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 9'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 10', 'Delicioso platos extras — plato 10 preparado al momento en Pollón Arica - Saucache.', 9900, true, 10, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 10'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 11', 'Delicioso platos extras — plato 11 preparado al momento en Pollón Arica - Saucache.', 10100, true, 11, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 11'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 12', 'Delicioso platos extras — plato 12 preparado al momento en Pollón Arica - Saucache.', 10300, true, 12, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 12'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 13', 'Delicioso platos extras — plato 13 preparado al momento en Pollón Arica - Saucache.', 10500, true, 13, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 13'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 14', 'Delicioso platos extras — plato 14 preparado al momento en Pollón Arica - Saucache.', 10700, true, 14, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 14'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 15', 'Delicioso platos extras — plato 15 preparado al momento en Pollón Arica - Saucache.', 10900, true, 15, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 15'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 16', 'Delicioso platos extras — plato 16 preparado al momento en Pollón Arica - Saucache.', 11100, true, 16, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 16'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Platos Extras — Plato 17', 'Delicioso platos extras — plato 17 preparado al momento en Pollón Arica - Saucache.', 11300, true, 17, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Platos Extras'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Platos Extras — Plato 17'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Agregados — Plato 1', 'Delicioso agregados — plato 1 preparado al momento en Pollón Arica - Saucache.', 8600, true, 1, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Agregados'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Agregados — Plato 1'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Agregados — Plato 2', 'Delicioso agregados — plato 2 preparado al momento en Pollón Arica - Saucache.', 8800, true, 2, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Agregados'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Agregados — Plato 2'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Agregados — Plato 3', 'Delicioso agregados — plato 3 preparado al momento en Pollón Arica - Saucache.', 9000, true, 3, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Agregados'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Agregados — Plato 3'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Agregados — Plato 4', 'Delicioso agregados — plato 4 preparado al momento en Pollón Arica - Saucache.', 9200, true, 4, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Agregados'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Agregados — Plato 4'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Agregados — Plato 5', 'Delicioso agregados — plato 5 preparado al momento en Pollón Arica - Saucache.', 9400, true, 5, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Agregados'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Agregados — Plato 5'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Agregados — Plato 6', 'Delicioso agregados — plato 6 preparado al momento en Pollón Arica - Saucache.', 9600, true, 6, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Agregados'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Agregados — Plato 6'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Agregados — Plato 7', 'Delicioso agregados — plato 7 preparado al momento en Pollón Arica - Saucache.', 9800, true, 7, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Agregados'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Agregados — Plato 7'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Agregados — Plato 8', 'Delicioso agregados — plato 8 preparado al momento en Pollón Arica - Saucache.', 10000, true, 8, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Agregados'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Agregados — Plato 8'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Agregados — Plato 9', 'Delicioso agregados — plato 9 preparado al momento en Pollón Arica - Saucache.', 10200, true, 9, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Agregados'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Agregados — Plato 9'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Agregados — Plato 10', 'Delicioso agregados — plato 10 preparado al momento en Pollón Arica - Saucache.', 10400, true, 10, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Agregados'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Agregados — Plato 10'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Agregados — Plato 11', 'Delicioso agregados — plato 11 preparado al momento en Pollón Arica - Saucache.', 10600, true, 11, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Agregados'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Agregados — Plato 11'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Agregados — Plato 12', 'Delicioso agregados — plato 12 preparado al momento en Pollón Arica - Saucache.', 10800, true, 12, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Agregados'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Agregados — Plato 12'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Agregados — Plato 13', 'Delicioso agregados — plato 13 preparado al momento en Pollón Arica - Saucache.', 11000, true, 13, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Agregados'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Agregados — Plato 13'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Agregados — Plato 14', 'Delicioso agregados — plato 14 preparado al momento en Pollón Arica - Saucache.', 11200, true, 14, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Agregados'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Agregados — Plato 14'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Agregados — Plato 15', 'Delicioso agregados — plato 15 preparado al momento en Pollón Arica - Saucache.', 11400, true, 15, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Agregados'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Agregados — Plato 15'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Agregados — Plato 16', 'Delicioso agregados — plato 16 preparado al momento en Pollón Arica - Saucache.', 11600, true, 16, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Agregados'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Agregados — Plato 16'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Agregados — Plato 17', 'Delicioso agregados — plato 17 preparado al momento en Pollón Arica - Saucache.', 11800, true, 17, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Agregados'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Agregados — Plato 17'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 1', 'Delicioso bebidas — plato 1 preparado al momento en Pollón Arica - Saucache.', 9100, true, 1, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 1'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 2', 'Delicioso bebidas — plato 2 preparado al momento en Pollón Arica - Saucache.', 9300, true, 2, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 2'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 3', 'Delicioso bebidas — plato 3 preparado al momento en Pollón Arica - Saucache.', 9500, true, 3, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 3'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 4', 'Delicioso bebidas — plato 4 preparado al momento en Pollón Arica - Saucache.', 9700, true, 4, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 4'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 5', 'Delicioso bebidas — plato 5 preparado al momento en Pollón Arica - Saucache.', 9900, true, 5, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 5'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 6', 'Delicioso bebidas — plato 6 preparado al momento en Pollón Arica - Saucache.', 10100, true, 6, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 6'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 7', 'Delicioso bebidas — plato 7 preparado al momento en Pollón Arica - Saucache.', 10300, true, 7, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 7'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 8', 'Delicioso bebidas — plato 8 preparado al momento en Pollón Arica - Saucache.', 10500, true, 8, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 8'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 9', 'Delicioso bebidas — plato 9 preparado al momento en Pollón Arica - Saucache.', 10700, true, 9, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 9'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 10', 'Delicioso bebidas — plato 10 preparado al momento en Pollón Arica - Saucache.', 10900, true, 10, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 10'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 11', 'Delicioso bebidas — plato 11 preparado al momento en Pollón Arica - Saucache.', 11100, true, 11, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 11'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 12', 'Delicioso bebidas — plato 12 preparado al momento en Pollón Arica - Saucache.', 11300, true, 12, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 12'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 13', 'Delicioso bebidas — plato 13 preparado al momento en Pollón Arica - Saucache.', 11500, true, 13, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 13'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 14', 'Delicioso bebidas — plato 14 preparado al momento en Pollón Arica - Saucache.', 11700, true, 14, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 14'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 15', 'Delicioso bebidas — plato 15 preparado al momento en Pollón Arica - Saucache.', 11900, true, 15, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 15'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 16', 'Delicioso bebidas — plato 16 preparado al momento en Pollón Arica - Saucache.', 12100, true, 16, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 16'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Bebidas — Plato 17', 'Delicioso bebidas — plato 17 preparado al momento en Pollón Arica - Saucache.', 12300, true, 17, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Bebidas'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Bebidas — Plato 17'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 1', 'Delicioso descartables — plato 1 preparado al momento en Pollón Arica - Saucache.', 9600, true, 1, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 1'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 2', 'Delicioso descartables — plato 2 preparado al momento en Pollón Arica - Saucache.', 9800, true, 2, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 2'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 3', 'Delicioso descartables — plato 3 preparado al momento en Pollón Arica - Saucache.', 10000, true, 3, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 3'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 4', 'Delicioso descartables — plato 4 preparado al momento en Pollón Arica - Saucache.', 10200, true, 4, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 4'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 5', 'Delicioso descartables — plato 5 preparado al momento en Pollón Arica - Saucache.', 10400, true, 5, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 5'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 6', 'Delicioso descartables — plato 6 preparado al momento en Pollón Arica - Saucache.', 10600, true, 6, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 6'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 7', 'Delicioso descartables — plato 7 preparado al momento en Pollón Arica - Saucache.', 10800, true, 7, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 7'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 8', 'Delicioso descartables — plato 8 preparado al momento en Pollón Arica - Saucache.', 11000, true, 8, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 8'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 9', 'Delicioso descartables — plato 9 preparado al momento en Pollón Arica - Saucache.', 11200, true, 9, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 9'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 10', 'Delicioso descartables — plato 10 preparado al momento en Pollón Arica - Saucache.', 11400, true, 10, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 10'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 11', 'Delicioso descartables — plato 11 preparado al momento en Pollón Arica - Saucache.', 11600, true, 11, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 11'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 12', 'Delicioso descartables — plato 12 preparado al momento en Pollón Arica - Saucache.', 11800, true, 12, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 12'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 13', 'Delicioso descartables — plato 13 preparado al momento en Pollón Arica - Saucache.', 12000, true, 13, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 13'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 14', 'Delicioso descartables — plato 14 preparado al momento en Pollón Arica - Saucache.', 12200, true, 14, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 14'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 15', 'Delicioso descartables — plato 15 preparado al momento en Pollón Arica - Saucache.', 12400, true, 15, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 15'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 16', 'Delicioso descartables — plato 16 preparado al momento en Pollón Arica - Saucache.', 12600, true, 16, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 16'
);

INSERT INTO products (branch_id, category_id, name, description, price, is_available, display_order, is_featured)
SELECT br.id, cat.id, 'Descartables — Plato 17', 'Delicioso descartables — plato 17 preparado al momento en Pollón Arica - Saucache.', 12800, true, 17, false
FROM branches br
CROSS JOIN LATERAL (
  SELECT id FROM categories c
  WHERE c.branch_id = br.id AND c.name = 'Descartables'
  ORDER BY c.display_order, c.created_at NULLS LAST, c.id
  LIMIT 1
) cat
WHERE br.slug = 'arica-saucache'
AND NOT EXISTS (
  SELECT 1 FROM products pr WHERE pr.branch_id = br.id AND pr.category_id = cat.id AND pr.name = 'Descartables — Plato 17'
);

INSERT INTO delivery_zones (branch_id, zone_name, delivery_price, estimated_time, is_active)
SELECT id, 'Zona principal', 2500, '30-45 min', true FROM branches WHERE slug = 'arica-saucache'
AND NOT EXISTS (SELECT 1 FROM delivery_zones dz WHERE dz.branch_id = branches.id AND dz.zone_name = 'Zona principal');

-- Configuración global
INSERT INTO settings (key, value, branch_id) VALUES
  ('site_name', '"Pollería El Pollón"', NULL),
  ('payment_methods', '["efectivo","transferencia"]', NULL)
ON CONFLICT (key, branch_id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- VERIFICACIÓN (la última consulta muestra filas en Results — no es un error)
-- Esperado aprox.: 4 sucursales, 30+ categorías, 500+ productos
-- -----------------------------------------------------------------------------
SELECT
  (SELECT COUNT(*)::int FROM branches) AS sucursales,
  (SELECT COUNT(*)::int FROM categories) AS categorias,
  (SELECT COUNT(*)::int FROM products) AS productos,
  (SELECT COUNT(*)::int FROM delivery_zones) AS zonas_delivery;
