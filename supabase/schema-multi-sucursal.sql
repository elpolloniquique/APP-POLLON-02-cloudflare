-- =============================================================================
-- EL POLLÓN — Plataforma multi-sucursal (menú independiente por sucursal)
-- Ejecutar en Supabase SQL Editor (proyecto nuevo o migración)
--
-- IMPORTANTE:
-- 1) Ejecuta schema-es.sql ANTES de este archivo
-- 2) Copia TODO el archivo (Ctrl+A) y pulsa RUN una sola vez
-- 3) NO uses "Run selected" ni ejecutes solo un fragmento (causa error 42601)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- SUCURSALES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS branches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  city TEXT DEFAULT '',
  address TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  whatsapp TEXT DEFAULT '',
  opening_hours TEXT DEFAULT 'Lun-Dom: 11:30 - 23:00',
  delivery_enabled BOOLEAN DEFAULT true,
  pickup_enabled BOOLEAN DEFAULT true,
  reservations_enabled BOOLEAN DEFAULT true,
  delivery_cost TEXT DEFAULT '0',
  delivery_eta TEXT DEFAULT '30-45 min',
  is_active BOOLEAN DEFAULT true,
  display_order INT DEFAULT 0,
  payment_methods TEXT[] NOT NULL DEFAULT ARRAY['efectivo', 'transferencia']::text[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- CATEGORÍAS (por sucursal)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_categories_branch ON categories(branch_id);
CREATE INDEX IF NOT EXISTS idx_categories_branch_order ON categories(branch_id, display_order);

-- Una categoría por nombre en cada sucursal (evita triplicados al re-ejecutar seed)
  CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_branch_name_unique ON categories(branch_id, name);

-- -----------------------------------------------------------------------------
-- PRODUCTOS (por sucursal y categoría)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  gallery_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  price NUMERIC(12,0) NOT NULL DEFAULT 0 CHECK (price >= 0),
  old_price NUMERIC(12,0),
  is_available BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  is_promotion BOOLEAN DEFAULT false,
  display_order INT DEFAULT 0,
  preparation_time INT DEFAULT 15,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_branch ON products(branch_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_branch_available ON products(branch_id, is_available);
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_branch_category_name_unique ON products(branch_id, category_id, name);

-- -----------------------------------------------------------------------------
-- EXTRAS / AGREGADOS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_extras (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC(12,0) NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- PROMOCIONES (por sucursal)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS promotions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  discount_type TEXT DEFAULT 'percent' CHECK (discount_type IN ('percent', 'fixed')),
  discount_value NUMERIC(12,2) DEFAULT 0,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- ZONAS DE DELIVERY
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS delivery_zones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  zone_name TEXT NOT NULL,
  delivery_price NUMERIC(12,0) DEFAULT 0,
  estimated_time TEXT DEFAULT '30-45 min',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- CONFIGURACIÓN (global o por sucursal)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL,
  value JSONB DEFAULT '{}',
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(key, branch_id)
);

-- -----------------------------------------------------------------------------
-- HISTORIAL DE CAMBIOS (auditoría)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_branch ON audit_logs(branch_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- ADMINISTRADORES / PEDIDOS — columnas extra (requiere schema-es.sql previo)
-- -----------------------------------------------------------------------------
DO $pollon$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'administradores'
  ) THEN
    ALTER TABLE administradores
      ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'pedidos'
  ) THEN
    ALTER TABLE pedidos
      ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
  END IF;
END
$pollon$;

-- -----------------------------------------------------------------------------
-- TRIGGERS updated_at
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $fn$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS branches_updated ON branches;
CREATE TRIGGER branches_updated
  BEFORE UPDATE ON branches
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS categories_updated ON categories;
CREATE TRIGGER categories_updated
  BEFORE UPDATE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS products_updated ON products;
CREATE TRIGGER products_updated
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_extras ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Lectura pública: sucursales activas, menú activo
DROP POLICY IF EXISTS branches_public_read ON branches;
CREATE POLICY branches_public_read ON branches FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS categories_public_read ON categories;
CREATE POLICY categories_public_read ON categories FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS products_public_read ON products;
CREATE POLICY products_public_read ON products FOR SELECT USING (is_available = true);

DROP POLICY IF EXISTS promotions_public_read ON promotions;
CREATE POLICY promotions_public_read ON promotions FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS delivery_zones_public_read ON delivery_zones;
CREATE POLICY delivery_zones_public_read ON delivery_zones FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS settings_public_read ON settings;
CREATE POLICY settings_public_read ON settings FOR SELECT USING (true);

-- Admin autenticado: gestión completa
DROP POLICY IF EXISTS branches_auth_all ON branches;
CREATE POLICY branches_auth_all ON branches
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS categories_auth_all ON categories;
CREATE POLICY categories_auth_all ON categories FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS products_auth_all ON products;
CREATE POLICY products_auth_all ON products FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS product_extras_auth_all ON product_extras;
CREATE POLICY product_extras_auth_all ON product_extras FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS promotions_auth_all ON promotions;
CREATE POLICY promotions_auth_all ON promotions FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS delivery_zones_auth_all ON delivery_zones;
CREATE POLICY delivery_zones_auth_all ON delivery_zones FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS settings_auth_all ON settings;
CREATE POLICY settings_auth_all ON settings FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS audit_logs_auth_all ON audit_logs;
CREATE POLICY audit_logs_auth_all ON audit_logs FOR ALL USING (auth.role() = 'authenticated');

-- Realtime pedidos (ignora si ya está agregado o la tabla no existe)
DO $realtime$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE pedidos;
EXCEPTION
  WHEN OTHERS THEN NULL;
END
$realtime$;

-- Verificación rápida (debe mostrar 8 tablas)
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'branches', 'categories', 'products', 'product_extras',
    'promotions', 'delivery_zones', 'settings', 'audit_logs'
  )
ORDER BY table_name;
