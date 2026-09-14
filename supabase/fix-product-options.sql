-- Opciones de personalización por producto (bebida / bolsa)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS drink_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS drink_required BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bag_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bag_required BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bag_price NUMERIC(12,0) NOT NULL DEFAULT 200 CHECK (bag_price >= 0),
  ADD COLUMN IF NOT EXISTS bag_units_per_bag INTEGER NOT NULL DEFAULT 1 CHECK (bag_units_per_bag >= 1);

-- Ofertas Familiares: activar bebida y bolsa obligatorias por defecto
UPDATE public.products p
SET
  drink_enabled = true,
  drink_required = true,
  bag_enabled = true,
  bag_required = true,
  bag_price = COALESCE(p.bag_price, 200)
FROM public.categories c
WHERE p.category_id = c.id
  AND lower(trim(c.name)) = lower('Ofertas Familiares');
