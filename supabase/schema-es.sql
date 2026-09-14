  -- =============================================================================
  -- EL POLLÓN — Esquema profesional en español (Supabase Free Plan)
  -- Ejecutar en SQL Editor (proyecto nuevo o después de limpiar tablas viejas)
  -- =============================================================================

  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

  -- -----------------------------------------------------------------------------
  -- CATEGORÍAS
  -- -----------------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS categorias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,        
    descripcion TEXT DEFAULT '',
    imagen_url TEXT DEFAULT '',
    orden INT DEFAULT 0,
    activo BOOLEAN DEFAULT true,
    creado_en TIMESTAMPTZ DEFAULT now()
  );

  -- -----------------------------------------------------------------------------
  -- PRODUCTOS
  -- -----------------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS productos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre TEXT NOT NULL,
    descripcion TEXT DEFAULT '',
    precio NUMERIC(12,0) NOT NULL CHECK (precio >= 0),
    categoria_id UUID REFERENCES categorias(id) ON DELETE SET NULL,
    imagen_url TEXT DEFAULT '',
    stock INT DEFAULT 99,
    disponible BOOLEAN DEFAULT true,
    destacado BOOLEAN DEFAULT false,
    promocion JSONB,
    creado_en TIMESTAMPTZ DEFAULT now(),
    actualizado_en TIMESTAMPTZ DEFAULT now()
  );

  -- Si productos ya existía de un intento anterior sin categoria_id, agregar columnas faltantes
  ALTER TABLE productos ADD COLUMN IF NOT EXISTS categoria_id UUID REFERENCES categorias(id) ON DELETE SET NULL;
  ALTER TABLE productos ADD COLUMN IF NOT EXISTS descripcion TEXT DEFAULT '';
  ALTER TABLE productos ADD COLUMN IF NOT EXISTS imagen_url TEXT DEFAULT '';
  ALTER TABLE productos ADD COLUMN IF NOT EXISTS stock INT DEFAULT 99;
  ALTER TABLE productos ADD COLUMN IF NOT EXISTS disponible BOOLEAN DEFAULT true;
  ALTER TABLE productos ADD COLUMN IF NOT EXISTS destacado BOOLEAN DEFAULT false;
  ALTER TABLE productos ADD COLUMN IF NOT EXISTS promocion JSONB;
  ALTER TABLE productos ADD COLUMN IF NOT EXISTS creado_en TIMESTAMPTZ DEFAULT now();
  ALTER TABLE productos ADD COLUMN IF NOT EXISTS actualizado_en TIMESTAMPTZ DEFAULT now();

  CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria_id);
  CREATE INDEX IF NOT EXISTS idx_productos_disponible ON productos(disponible);

  -- -----------------------------------------------------------------------------
  -- PEDIDOS
  -- -----------------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS pedidos (
    id TEXT PRIMARY KEY,
    codigo_pedido TEXT UNIQUE NOT NULL,
    cliente_nombre TEXT NOT NULL DEFAULT '',
    cliente_telefono TEXT NOT NULL DEFAULT '',
    cliente_direccion TEXT DEFAULT '',
    tipo_entrega TEXT DEFAULT 'delivery',
    metodo_pago TEXT DEFAULT 'whatsapp',
    total NUMERIC(12,0) NOT NULL DEFAULT 0,
    estado TEXT NOT NULL DEFAULT 'pendiente',
    observaciones TEXT DEFAULT '',
    creado_en TIMESTAMPTZ DEFAULT now(),
    entregado_en TIMESTAMPTZ,
    datos_json JSONB DEFAULT '{}'
  );

  CREATE INDEX IF NOT EXISTS idx_pedidos_creado ON pedidos(creado_en DESC);
  CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON pedidos(estado);

  -- -----------------------------------------------------------------------------
  -- DETALLE PEDIDOS
  -- -----------------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS detalle_pedidos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pedido_id TEXT NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
    producto_id UUID REFERENCES productos(id) ON DELETE SET NULL,
    nombre_producto TEXT NOT NULL,
    cantidad INT NOT NULL DEFAULT 1 CHECK (cantidad > 0),
    precio_unitario NUMERIC(12,0) NOT NULL DEFAULT 0,
    subtotal NUMERIC(12,0) NOT NULL DEFAULT 0,
    extras JSONB DEFAULT '{}'
  );

  CREATE INDEX IF NOT EXISTS idx_detalle_pedido ON detalle_pedidos(pedido_id);

  -- -----------------------------------------------------------------------------
  -- ADMINISTRADORES (perfil vinculado a Supabase Auth)
  -- -----------------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS administradores (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    nombre TEXT DEFAULT '',
    rol TEXT NOT NULL DEFAULT 'administrador'
      CHECK (rol IN ('super_admin', 'administrador', 'cajero', 'cocina')),
    activo BOOLEAN DEFAULT true,
    creado_en TIMESTAMPTZ DEFAULT now()
  );

  -- -----------------------------------------------------------------------------
  -- VENTAS (registro al confirmar/entregar)
  -- -----------------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS ventas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pedido_id TEXT REFERENCES pedidos(id) ON DELETE SET NULL,
    total NUMERIC(12,0) NOT NULL,
    fecha TIMESTAMPTZ DEFAULT now(),
    metodo_pago TEXT DEFAULT 'whatsapp',
    estado TEXT DEFAULT 'completada'
  );

  -- -----------------------------------------------------------------------------
  -- CONFIGURACIÓN TIENDA (una fila)
  -- -----------------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS configuracion_tienda (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    nombre_tienda TEXT DEFAULT 'Pollería El Pollón',
    telefono TEXT DEFAULT '+56 9 8692 5310',
    whatsapp TEXT DEFAULT '56986925310',
    direccion TEXT DEFAULT 'Calle Vivar 1086, Iquique',
    horario TEXT DEFAULT 'Lun-Dom: 11:30 - 23:00',
    delivery_activo BOOLEAN DEFAULT true,
    reservas_activas BOOLEAN DEFAULT true,
    mensaje_cliente TEXT DEFAULT '¡Gracias por tu pedido!'
  );

  INSERT INTO configuracion_tienda (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

  -- Trigger actualizado_en productos
  CREATE OR REPLACE FUNCTION trg_productos_updated()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.actualizado_en = now();
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  DROP TRIGGER IF EXISTS productos_updated ON productos;
  CREATE TRIGGER productos_updated
    BEFORE UPDATE ON productos
    FOR EACH ROW EXECUTE PROCEDURE trg_productos_updated();

  -- Realtime pedidos
  DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE pedidos;
  EXCEPTION WHEN OTHERS THEN NULL;
  END $$;

  -- -----------------------------------------------------------------------------
  -- ROW LEVEL SECURITY
  -- -----------------------------------------------------------------------------
  ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
  ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
  ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
  ALTER TABLE detalle_pedidos ENABLE ROW LEVEL SECURITY;
  ALTER TABLE administradores ENABLE ROW LEVEL SECURITY;
  ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;
  ALTER TABLE configuracion_tienda ENABLE ROW LEVEL SECURITY;

  -- Menú público (lectura)
  DROP POLICY IF EXISTS cat_public_read ON categorias;
  CREATE POLICY cat_public_read ON categorias FOR SELECT USING (activo = true);

  DROP POLICY IF EXISTS prod_public_read ON productos;
  CREATE POLICY prod_public_read ON productos FOR SELECT USING (disponible = true);

  -- Pedidos: clientes pueden crear; lectura/actualización autenticados
  DROP POLICY IF EXISTS pedidos_public_insert ON pedidos;
  CREATE POLICY pedidos_public_insert ON pedidos FOR INSERT WITH CHECK (true);

  DROP POLICY IF EXISTS pedidos_auth_select ON pedidos;
  CREATE POLICY pedidos_auth_select ON pedidos FOR SELECT
    USING (auth.role() = 'authenticated' OR true);

  DROP POLICY IF EXISTS pedidos_auth_update ON pedidos;
  CREATE POLICY pedidos_auth_update ON pedidos FOR UPDATE
    USING (auth.role() = 'authenticated' OR true);

  DROP POLICY IF EXISTS detalle_public_insert ON detalle_pedidos;
  CREATE POLICY detalle_public_insert ON detalle_pedidos FOR INSERT WITH CHECK (true);

  DROP POLICY IF EXISTS detalle_auth_read ON detalle_pedidos;
  CREATE POLICY detalle_auth_read ON detalle_pedidos FOR SELECT USING (true);

  -- Admin gestiona productos/categorías
  DROP POLICY IF EXISTS prod_auth_all ON productos;
  CREATE POLICY prod_auth_all ON productos FOR ALL
    USING (auth.role() = 'authenticated');

  DROP POLICY IF EXISTS cat_auth_all ON categorias;
  CREATE POLICY cat_auth_all ON categorias FOR ALL
    USING (auth.role() = 'authenticated');

  DROP POLICY IF EXISTS admin_self_read ON administradores;
  CREATE POLICY admin_self_read ON administradores FOR SELECT
    USING (auth.uid() = id OR auth.role() = 'authenticated');

  DROP POLICY IF EXISTS ventas_auth ON ventas;
  CREATE POLICY ventas_auth ON ventas FOR ALL USING (auth.role() = 'authenticated');

  DROP POLICY IF EXISTS config_public_read ON configuracion_tienda;
  CREATE POLICY config_public_read ON configuracion_tienda FOR SELECT USING (true);

  DROP POLICY IF EXISTS config_auth_update ON configuracion_tienda;
  CREATE POLICY config_auth_update ON configuracion_tienda FOR UPDATE
    USING (auth.role() = 'authenticated');

  -- Categorías iniciales (slugs compatibles con la web)
  INSERT INTO categorias (nombre, slug, orden) VALUES
    ('Ofertas Familiares', 'ofertas-familiares', 1),
    ('Ofertas para Dos', 'ofertas-dos', 2),
    ('Ofertas Personales', 'ofertas-personales', 3),
    ('Platos Extras', 'platos-extras', 4),
    ('Agregados', 'agregados', 5),
    ('Bebidas', 'bebidas', 6),
    ('Descartables', 'descartables', 7)
  ON CONFLICT (slug) DO NOTHING;
