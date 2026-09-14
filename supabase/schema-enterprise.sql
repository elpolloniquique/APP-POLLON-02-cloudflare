-- EL POLLÓN — Esquema empresarial multi-sucursal (ejecutar después de schema-es.sql o en proyecto nuevo)
-- Compatible con tablas existentes: categorias, productos, pedidos, detalle_pedidos, administradores, configuracion_tienda

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- SUCURSALES
CREATE TABLE IF NOT EXISTS sucursales (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  ciudad TEXT DEFAULT '',
  direccion TEXT DEFAULT '',
  horario TEXT DEFAULT '',
  telefono TEXT DEFAULT '',
  whatsapp TEXT DEFAULT '',
  abierta BOOLEAN DEFAULT true,
  zona_delivery TEXT DEFAULT '',
  costo_delivery NUMERIC(12,0) DEFAULT 0,
  tiempo_entrega TEXT DEFAULT '30-45 min',
  proximamente BOOLEAN DEFAULT false,
  orden INT DEFAULT 0,
  creado_en TIMESTAMPTZ DEFAULT now(),
  actualizado_en TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS sucursal_id TEXT REFERENCES sucursales(id);

-- HISTORIAL ESTADOS
CREATE TABLE IF NOT EXISTS historial_estados_pedido (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pedido_id TEXT NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  estado TEXT NOT NULL,
  notas TEXT DEFAULT '',
  usuario_id UUID REFERENCES auth.users(id),
  creado_en TIMESTAMPTZ DEFAULT now()
);

-- CAJA
CREATE TABLE IF NOT EXISTS caja_registros (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sucursal_id TEXT REFERENCES sucursales(id),
  abierta BOOLEAN DEFAULT true,
  monto_inicial NUMERIC(12,0) DEFAULT 0,
  monto_cierre NUMERIC(12,0),
  ventas_efectivo NUMERIC(12,0) DEFAULT 0,
  ventas_transferencia NUMERIC(12,0) DEFAULT 0,
  ventas_tarjeta NUMERIC(12,0) DEFAULT 0,
  egresos NUMERIC(12,0) DEFAULT 0,
  diferencia NUMERIC(12,0) DEFAULT 0,
  apertura_en TIMESTAMPTZ DEFAULT now(),
  cierre_en TIMESTAMPTZ,
  usuario_id UUID REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS caja_movimientos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  caja_id UUID REFERENCES caja_registros(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('ingreso', 'egreso')),
  monto NUMERIC(12,0) NOT NULL,
  descripcion TEXT DEFAULT '',
  creado_en TIMESTAMPTZ DEFAULT now()
);

-- INVENTARIO
CREATE TABLE IF NOT EXISTS inventario_insumos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sucursal_id TEXT REFERENCES sucursales(id),
  nombre TEXT NOT NULL,
  unidad TEXT DEFAULT 'unidad',
  cantidad NUMERIC(12,2) DEFAULT 0,
  stock_minimo NUMERIC(12,2) DEFAULT 5,
  creado_en TIMESTAMPTZ DEFAULT now(),
  actualizado_en TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventario_movimientos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  insumo_id UUID REFERENCES inventario_insumos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'salida')),
  cantidad NUMERIC(12,2) NOT NULL,
  motivo TEXT DEFAULT '',
  creado_en TIMESTAMPTZ DEFAULT now()
);

-- ZONAS DELIVERY
CREATE TABLE IF NOT EXISTS zonas_delivery (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sucursal_id TEXT REFERENCES sucursales(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  costo NUMERIC(12,0) DEFAULT 0,
  tiempo_estimado TEXT DEFAULT '30-45 min',
  activa BOOLEAN DEFAULT true
);

-- SEED SUCURSALES
INSERT INTO sucursales (id, slug, nombre, ciudad, direccion, horario, telefono, whatsapp, costo_delivery, orden) VALUES
  ('arica-santa-maria', 'arica-santa-maria', 'El Pollón Arica — Santa María', 'Arica', 'Santa María, Arica', 'Lun-Dom: 11:30 - 23:00', '+56 9 0000 0001', '56900000001', 2500, 1),
  ('arica-saucache', 'arica-saucache', 'El Pollón Arica — Saucache', 'Arica', 'Saucache, Arica', 'Lun-Dom: 11:30 - 23:00', '+56 9 0000 0002', '56900000002', 2500, 2),
  ('iquique-vivar', 'iquique-vivar', 'El Pollón Iquique — Vivar', 'Iquique', 'Calle Vivar 1086, Iquique', 'Lun-Dom: 11:30 - 23:00', '+56 9 8692 5310', '56986925310', 2000, 3),
  ('alto-hospicio', 'alto-hospicio', 'El Pollón Alto Hospicio', 'Alto Hospicio', 'Alto Hospicio', 'Lun-Dom: 11:30 - 23:00', '+56 9 0000 0004', '56900000004', 3000, 4),
  ('pendiente', 'pendiente', 'Nueva sucursal — Próximamente', 'Por definir', '—', 'Próximamente', '—', '56986925310', 0, 5)
ON CONFLICT (id) DO NOTHING;

-- RLS básico
ALTER TABLE sucursales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sucursales_public_read ON sucursales;
CREATE POLICY sucursales_public_read ON sucursales FOR SELECT USING (true);

ALTER TABLE inventario_insumos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS inventario_auth ON inventario_insumos;
CREATE POLICY inventario_auth ON inventario_insumos FOR ALL USING (auth.role() = 'authenticated');
