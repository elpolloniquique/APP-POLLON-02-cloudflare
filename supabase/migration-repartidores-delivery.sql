-- =============================================================================
-- El Pollón — Módulo Repartidores / Despacho GPS (estilo Uber / inDriver)
-- ADITIVO: no modifica tablas de menú, caja, cocina ni ventas existentes.
-- Mapas: MapLibre + OSRM + CARTO (gratis). Sin Mapbox/Google Maps de pago.
-- Ejecutar en SQL Editor de Supabase DESPUÉS del schema base.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Helpers de rol (compatibles con profiles existentes) ─────────────────────
-- Helpers de rol (NO referencian ep_* todavía — las tablas se crean abajo)
CREATE OR REPLACE FUNCTION public.ep_my_role()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r TEXT;
BEGIN
  SELECT role INTO r FROM profiles WHERE auth_user_id = auth.uid() LIMIT 1;
  IF r IS NOT NULL AND r <> '' THEN
    RETURN r;
  END IF;

  BEGIN
    SELECT rol INTO r FROM administradores WHERE id = auth.uid() LIMIT 1;
  EXCEPTION
    WHEN undefined_table THEN
      r := NULL;
  END;

  RETURN COALESCE(r, '');
END;
$$;

CREATE OR REPLACE FUNCTION public.ep_is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.ep_my_role() IN ('super_admin');
$$;

CREATE OR REPLACE FUNCTION public.ep_is_dispatch_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.ep_my_role() IN (
    'super_admin', 'admin_sucursal', 'administrador', 'cajera', 'cajero', 'despachador'
  );
$$;

CREATE OR REPLACE FUNCTION public.ep_is_driver_role()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.ep_my_role() IN ('delivery', 'repartidor');
$$;

CREATE OR REPLACE FUNCTION public.ep_my_profile_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM profiles WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

-- ── Extensiones opcionales en branches (no rompe si ya existen) ──────────────
DO $$
BEGIN
  IF to_regclass('public.branches') IS NOT NULL THEN
    ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
    ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
    ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS delivery_dispatch_enabled BOOLEAN DEFAULT true;
    ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS max_orders_per_driver INTEGER DEFAULT 2;
    ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS arrival_radius_m INTEGER DEFAULT 80;
    ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS avg_prep_minutes INTEGER DEFAULT 25;
  END IF;
END $$;

-- ── Perfil operativo del repartidor (PRIMERO la tabla, luego funciones que la usan) ─
CREATE TABLE IF NOT EXISTS public.ep_driver_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  admin_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (admin_status IN ('pending', 'approved', 'rejected', 'suspended', 'blocked')),
  operational_status TEXT NOT NULL DEFAULT 'offline'
    CHECK (operational_status IN (
      'offline', 'available', 'offered', 'heading_to_branch', 'waiting_at_branch',
      'carrying_orders', 'delivering', 'paused', 'location_unavailable'
    )),
  preferred_branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  max_orders INTEGER NOT NULL DEFAULT 2 CHECK (max_orders BETWEEN 1 AND 5),
  vehicle_type TEXT NOT NULL DEFAULT 'motocicleta'
    CHECK (vehicle_type IN ('motocicleta', 'automovil', 'bicicleta', 'bicicleta_electrica', 'otro')),
  vehicle_plate TEXT DEFAULT '',
  vehicle_color TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  photo_url TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ep_drivers_status
  ON public.ep_driver_profiles (admin_status, operational_status);
CREATE INDEX IF NOT EXISTS idx_ep_drivers_branch
  ON public.ep_driver_profiles (preferred_branch_id);

-- Ahora sí: función que depende de ep_driver_profiles
CREATE OR REPLACE FUNCTION public.ep_my_driver_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.id
  FROM public.ep_driver_profiles d
  JOIN public.profiles p ON p.id = d.profile_id
  WHERE p.auth_user_id = auth.uid()
  LIMIT 1;
$$;

-- ── Configuración de despacho por sucursal ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ep_dispatch_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL UNIQUE REFERENCES public.branches(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  auto_offer BOOLEAN NOT NULL DEFAULT false,
  offer_ttl_seconds INTEGER NOT NULL DEFAULT 60,
  max_search_radius_km NUMERIC(6,2) NOT NULL DEFAULT 8,
  arrival_radius_m INTEGER NOT NULL DEFAULT 80,
  customer_arrival_radius_m INTEGER NOT NULL DEFAULT 60,
  max_orders_per_driver INTEGER NOT NULL DEFAULT 2,
  require_gps BOOLEAN NOT NULL DEFAULT true,
  voice_alerts BOOLEAN NOT NULL DEFAULT false,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Tarifas de delivery ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ep_pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rule_type TEXT NOT NULL DEFAULT 'fixed'
    CHECK (rule_type IN ('fixed', 'per_km', 'tiers')),
  base_fee INTEGER NOT NULL DEFAULT 0,
  per_km_fee INTEGER NOT NULL DEFAULT 0,
  min_fee INTEGER NOT NULL DEFAULT 0,
  max_fee INTEGER,
  tiers JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ep_pricing_branch ON public.ep_pricing_rules (branch_id, is_active);

-- ── Jobs de delivery (espejo de pedidos delivery) ────────────────────────────
CREATE TABLE IF NOT EXISTS public.ep_delivery_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_order_id TEXT NOT NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  ticket_code TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'ready_for_dispatch'
    CHECK (status IN (
      'pending_prep', 'ready_for_dispatch', 'searching_driver', 'offered',
      'assigned', 'heading_to_branch', 'at_branch', 'picked_up',
      'delivering', 'delivered', 'delivery_failed', 'cancelled'
    )),
  customer_name TEXT NOT NULL DEFAULT '',
  customer_phone TEXT NOT NULL DEFAULT '',
  customer_address TEXT NOT NULL DEFAULT '',
  customer_lat DOUBLE PRECISION,
  customer_lng DOUBLE PRECISION,
  order_total INTEGER NOT NULL DEFAULT 0,
  delivery_fee INTEGER NOT NULL DEFAULT 0,
  delivery_distance_km NUMERIC(8,3),
  payment_method TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  assigned_driver_id UUID REFERENCES public.ep_driver_profiles(id) ON DELETE SET NULL,
  offered_at TIMESTAMPTZ,
  assigned_at TIMESTAMPTZ,
  picked_up_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_order_id)
);

CREATE INDEX IF NOT EXISTS idx_ep_jobs_status ON public.ep_delivery_jobs (status);
CREATE INDEX IF NOT EXISTS idx_ep_jobs_branch ON public.ep_delivery_jobs (branch_id);
CREATE INDEX IF NOT EXISTS idx_ep_jobs_driver ON public.ep_delivery_jobs (assigned_driver_id);

-- ── Ofertas a repartidores ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ep_delivery_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.ep_delivery_jobs(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES public.ep_driver_profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'expired', 'taken_by_other')),
  offered_fee INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, driver_id)
);

CREATE INDEX IF NOT EXISTS idx_ep_offers_driver ON public.ep_delivery_offers (driver_id, status);
CREATE INDEX IF NOT EXISTS idx_ep_offers_job ON public.ep_delivery_offers (job_id, status);

-- ── Asignaciones ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ep_delivery_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.ep_delivery_jobs(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES public.ep_driver_profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'cancelled')),
  phase TEXT NOT NULL DEFAULT 'to_store'
    CHECK (phase IN ('to_store', 'at_store', 'to_customer', 'done')),
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  picked_up_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  driver_fee INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ep_assignments_driver
  ON public.ep_delivery_assignments (driver_id, status);

-- ── GPS en vivo ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ep_driver_location_latest (
  driver_id UUID PRIMARY KEY REFERENCES public.ep_driver_profiles(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  heading DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  accuracy DOUBLE PRECISION,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ep_driver_location_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.ep_driver_profiles(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  heading DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  accuracy DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ep_loc_events_driver
  ON public.ep_driver_location_events (driver_id, created_at DESC);

-- ── updated_at trigger genérico ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ep_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ep_drivers_updated ON public.ep_driver_profiles;
CREATE TRIGGER trg_ep_drivers_updated
  BEFORE UPDATE ON public.ep_driver_profiles
  FOR EACH ROW EXECUTE FUNCTION public.ep_set_updated_at();

DROP TRIGGER IF EXISTS trg_ep_jobs_updated ON public.ep_delivery_jobs;
CREATE TRIGGER trg_ep_jobs_updated
  BEFORE UPDATE ON public.ep_delivery_jobs
  FOR EACH ROW EXECUTE FUNCTION public.ep_set_updated_at();

DROP TRIGGER IF EXISTS trg_ep_settings_updated ON public.ep_dispatch_settings;
CREATE TRIGGER trg_ep_settings_updated
  BEFORE UPDATE ON public.ep_dispatch_settings
  FOR EACH ROW EXECUTE FUNCTION public.ep_set_updated_at();

-- ── RPC: asegurar perfil driver ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ep_ensure_driver_profile()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pid UUID;
  did UUID;
BEGIN
  IF NOT public.ep_is_driver_role() AND NOT public.ep_is_dispatch_staff() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  pid := public.ep_my_profile_id();
  IF pid IS NULL THEN
    RAISE EXCEPTION 'Perfil no encontrado';
  END IF;

  SELECT id INTO did FROM ep_driver_profiles WHERE profile_id = pid;
  IF did IS NULL THEN
    INSERT INTO ep_driver_profiles (profile_id, admin_status, phone)
    SELECT pid,
      CASE WHEN public.ep_is_driver_role() THEN 'approved' ELSE 'pending' END,
      COALESCE(p.phone, '')
    FROM profiles p WHERE p.id = pid
    RETURNING id INTO did;
  END IF;
  RETURN did;
END;
$$;

-- ── RPC: estado operativo ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ep_set_my_operational_status(p_status TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  did UUID;
BEGIN
  did := public.ep_my_driver_id();
  IF did IS NULL THEN
    did := public.ep_ensure_driver_profile();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM ep_driver_profiles
    WHERE id = did AND admin_status = 'approved'
  ) THEN
    RAISE EXCEPTION 'Repartidor no aprobado';
  END IF;

  UPDATE ep_driver_profiles
  SET operational_status = p_status, updated_at = now()
  WHERE id = did;

  RETURN jsonb_build_object('ok', true, 'driver_id', did, 'status', p_status);
END;
$$;

-- ── RPC: upsert GPS ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ep_upsert_driver_location(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_heading DOUBLE PRECISION DEFAULT NULL,
  p_speed DOUBLE PRECISION DEFAULT NULL,
  p_accuracy DOUBLE PRECISION DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  did UUID;
BEGIN
  did := public.ep_my_driver_id();
  IF did IS NULL THEN
    RAISE EXCEPTION 'No eres repartidor';
  END IF;

  INSERT INTO ep_driver_location_latest (driver_id, lat, lng, heading, speed, accuracy, updated_at)
  VALUES (did, p_lat, p_lng, p_heading, p_speed, p_accuracy, now())
  ON CONFLICT (driver_id) DO UPDATE SET
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng,
    heading = EXCLUDED.heading,
    speed = EXCLUDED.speed,
    accuracy = EXCLUDED.accuracy,
    updated_at = now();

  INSERT INTO ep_driver_location_events (driver_id, lat, lng, heading, speed, accuracy)
  VALUES (did, p_lat, p_lng, p_heading, p_speed, p_accuracy);

  RETURN jsonb_build_object('ok', true, 'driver_id', did);
END;
$$;

-- ── RPC: crear/actualizar job desde pedido ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.ep_upsert_job_from_pedido(p_order_id TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  jid UUID;
  fee INTEGER;
  datos JSONB;
BEGIN
  SELECT * INTO r FROM pedidos WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido no encontrado';
  END IF;

  IF COALESCE(r.tipo_entrega, 'delivery') <> 'delivery' THEN
    RETURN NULL;
  END IF;

  datos := COALESCE(r.datos_json, '{}'::jsonb);
  fee := COALESCE((datos->>'deliveryFee')::INTEGER, 0);

  INSERT INTO ep_delivery_jobs (
    source_order_id, branch_id, ticket_code, status,
    customer_name, customer_phone, customer_address,
    customer_lat, customer_lng, order_total, delivery_fee,
    payment_method, notes
  ) VALUES (
    r.id,
    r.branch_id,
    COALESCE(r.codigo_pedido, ''),
    CASE
      WHEN r.estado IN ('listo', 'preparando', 'confirmado', 'en_cocina') THEN 'ready_for_dispatch'
      WHEN r.estado = 'en_delivery' THEN 'delivering'
      WHEN r.estado = 'entregado' THEN 'delivered'
      WHEN r.estado = 'cancelado' THEN 'cancelled'
      ELSE 'pending_prep'
    END,
    COALESCE(r.cliente_nombre, ''),
    COALESCE(r.cliente_telefono, ''),
    COALESCE(r.cliente_direccion, ''),
    NULLIF(datos->>'customerLat', '')::DOUBLE PRECISION,
    NULLIF(datos->>'customerLng', '')::DOUBLE PRECISION,
    COALESCE(r.total, 0)::INTEGER,
    fee,
    COALESCE(r.metodo_pago, ''),
    COALESCE(r.observaciones, '')
  )
  ON CONFLICT (source_order_id) DO UPDATE SET
    branch_id = EXCLUDED.branch_id,
    ticket_code = EXCLUDED.ticket_code,
    customer_name = EXCLUDED.customer_name,
    customer_phone = EXCLUDED.customer_phone,
    customer_address = EXCLUDED.customer_address,
    order_total = EXCLUDED.order_total,
    delivery_fee = EXCLUDED.delivery_fee,
    payment_method = EXCLUDED.payment_method,
    notes = EXCLUDED.notes,
    updated_at = now()
  RETURNING id INTO jid;

  RETURN jid;
END;
$$;

-- ── RPC: ofertar a repartidores disponibles ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.ep_start_driver_search(p_job_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  job RECORD;
  settings RECORD;
  ttl INT;
  drv RECORD;
  offered INT := 0;
BEGIN
  IF NOT public.ep_is_dispatch_staff() THEN
    RAISE EXCEPTION 'Solo personal de despacho';
  END IF;

  SELECT * INTO job FROM ep_delivery_jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Job no encontrado'; END IF;
  IF job.status IN ('delivered', 'cancelled', 'assigned', 'heading_to_branch', 'picked_up', 'delivering') THEN
    RAISE EXCEPTION 'Job no disponible para ofertar';
  END IF;

  SELECT * INTO settings FROM ep_dispatch_settings WHERE branch_id = job.branch_id;
  ttl := COALESCE(settings.offer_ttl_seconds, 60);

  UPDATE ep_delivery_jobs
  SET status = 'searching_driver', offered_at = now(), updated_at = now()
  WHERE id = p_job_id;

  FOR drv IN
    SELECT d.id
    FROM ep_driver_profiles d
    WHERE d.admin_status = 'approved'
      AND d.operational_status = 'available'
      AND (job.branch_id IS NULL OR d.preferred_branch_id IS NULL OR d.preferred_branch_id = job.branch_id)
      AND (
        SELECT COUNT(*) FROM ep_delivery_assignments a
        WHERE a.driver_id = d.id AND a.status = 'active'
      ) < COALESCE(d.max_orders, 2)
  LOOP
    INSERT INTO ep_delivery_offers (job_id, driver_id, status, offered_fee, expires_at)
    VALUES (p_job_id, drv.id, 'pending', job.delivery_fee, now() + make_interval(secs => ttl))
    ON CONFLICT (job_id, driver_id) DO UPDATE SET
      status = 'pending',
      offered_fee = EXCLUDED.offered_fee,
      expires_at = EXCLUDED.expires_at,
      responded_at = NULL;
    offered := offered + 1;
  END LOOP;

  IF offered > 0 THEN
    UPDATE ep_delivery_jobs SET status = 'offered', updated_at = now() WHERE id = p_job_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'offered', offered);
END;
$$;

-- ── RPC: aceptar oferta (race-safe) ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ep_accept_delivery_offer(p_offer_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  off RECORD;
  did UUID;
  lock_key BIGINT;
BEGIN
  did := public.ep_my_driver_id();
  IF did IS NULL THEN RAISE EXCEPTION 'No eres repartidor'; END IF;

  SELECT * INTO off FROM ep_delivery_offers WHERE id = p_offer_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Oferta no encontrada'; END IF;
  IF off.driver_id <> did THEN RAISE EXCEPTION 'Oferta de otro repartidor'; END IF;
  IF off.status <> 'pending' THEN RAISE EXCEPTION 'Oferta ya no disponible'; END IF;
  IF off.expires_at < now() THEN
    UPDATE ep_delivery_offers SET status = 'expired' WHERE id = p_offer_id;
    RAISE EXCEPTION 'Oferta expirada';
  END IF;

  lock_key := hashtext(off.job_id::text);
  PERFORM pg_advisory_xact_lock(lock_key);

  IF EXISTS (
    SELECT 1 FROM ep_delivery_assignments
    WHERE job_id = off.job_id AND status = 'active'
  ) THEN
    UPDATE ep_delivery_offers SET status = 'taken_by_other', responded_at = now() WHERE id = p_offer_id;
    RAISE EXCEPTION 'Pedido tomado por otro repartidor';
  END IF;

  UPDATE ep_delivery_offers SET status = 'accepted', responded_at = now() WHERE id = p_offer_id;
  UPDATE ep_delivery_offers
  SET status = 'taken_by_other', responded_at = now()
  WHERE job_id = off.job_id AND id <> p_offer_id AND status = 'pending';

  INSERT INTO ep_delivery_assignments (job_id, driver_id, status, phase, driver_fee)
  VALUES (off.job_id, did, 'active', 'to_store', off.offered_fee);

  UPDATE ep_delivery_jobs
  SET status = 'assigned',
      assigned_driver_id = did,
      assigned_at = now(),
      updated_at = now()
  WHERE id = off.job_id;

  UPDATE ep_driver_profiles
  SET operational_status = 'heading_to_branch', updated_at = now()
  WHERE id = did;

  -- Sync pedido negocio (si existe)
  UPDATE pedidos
  SET estado = 'en_delivery'
  WHERE id = (SELECT source_order_id FROM ep_delivery_jobs WHERE id = off.job_id)
    AND estado NOT IN ('entregado', 'cancelado');

  RETURN jsonb_build_object('ok', true, 'job_id', off.job_id, 'driver_id', did);
END;
$$;

-- ── RPC: rechazar oferta ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ep_reject_delivery_offer(p_offer_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  did UUID;
BEGIN
  did := public.ep_my_driver_id();
  UPDATE ep_delivery_offers
  SET status = 'rejected', responded_at = now()
  WHERE id = p_offer_id AND driver_id = did AND status = 'pending';
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ── RPC: marcar recogido ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ep_confirm_pickup(p_assignment_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a RECORD;
  did UUID;
BEGIN
  did := public.ep_my_driver_id();
  SELECT * INTO a FROM ep_delivery_assignments WHERE id = p_assignment_id AND driver_id = did AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'Asignación no encontrada'; END IF;

  UPDATE ep_delivery_assignments
  SET phase = 'to_customer', picked_up_at = now(), updated_at = now()
  WHERE id = p_assignment_id;

  UPDATE ep_delivery_jobs
  SET status = 'picked_up', picked_up_at = now(), updated_at = now()
  WHERE id = a.job_id;

  UPDATE ep_driver_profiles SET operational_status = 'delivering', updated_at = now() WHERE id = did;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ── RPC: marcar entregado ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ep_confirm_delivery(p_assignment_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a RECORD;
  did UUID;
  oid TEXT;
BEGIN
  did := public.ep_my_driver_id();
  SELECT * INTO a FROM ep_delivery_assignments WHERE id = p_assignment_id AND driver_id = did AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'Asignación no encontrada'; END IF;

  UPDATE ep_delivery_assignments
  SET status = 'completed', phase = 'done', delivered_at = now(), updated_at = now()
  WHERE id = p_assignment_id;

  UPDATE ep_delivery_jobs
  SET status = 'delivered', delivered_at = now(), updated_at = now()
  WHERE id = a.job_id
  RETURNING source_order_id INTO oid;

  UPDATE pedidos SET estado = 'entregado', entregado_en = now() WHERE id = oid;

  -- Si no hay más activos → available
  IF NOT EXISTS (
    SELECT 1 FROM ep_delivery_assignments WHERE driver_id = did AND status = 'active'
  ) THEN
    UPDATE ep_driver_profiles SET operational_status = 'available', updated_at = now() WHERE id = did;
  END IF;

  RETURN jsonb_build_object('ok', true, 'order_id', oid);
END;
$$;

-- ── RPC: cotizar delivery ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ep_quote_delivery(
  p_branch_id UUID,
  p_distance_km NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rule RECORD;
  fee INTEGER;
  km NUMERIC := GREATEST(COALESCE(p_distance_km, 0), 0);
BEGIN
  SELECT * INTO rule
  FROM ep_pricing_rules
  WHERE is_active = true
    AND (branch_id IS NULL OR branch_id = p_branch_id)
  ORDER BY
    CASE WHEN branch_id = p_branch_id THEN 0 ELSE 1 END,
    priority DESC
  LIMIT 1;

  IF NOT FOUND THEN
    fee := 2000 + ROUND(km * 500)::INTEGER;
  ELSIF rule.rule_type = 'fixed' THEN
    fee := rule.base_fee;
  ELSIF rule.rule_type = 'per_km' THEN
    fee := rule.base_fee + ROUND(km * rule.per_km_fee)::INTEGER;
  ELSE
    fee := rule.base_fee + ROUND(km * rule.per_km_fee)::INTEGER;
  END IF;

  fee := GREATEST(fee, COALESCE(rule.min_fee, 0));
  IF rule.max_fee IS NOT NULL THEN
    fee := LEAST(fee, rule.max_fee);
  END IF;

  RETURN jsonb_build_object(
    'fee', fee,
    'distance_km', km,
    'rule_id', rule.id,
    'rule_name', COALESCE(rule.name, 'default')
  );
END;
$$;

-- ── RPC: reporte despacho ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ep_dispatch_report(
  p_branch_id UUID DEFAULT NULL,
  p_from TIMESTAMPTZ DEFAULT (now() - interval '7 days'),
  p_to TIMESTAMPTZ DEFAULT now()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  IF NOT public.ep_is_dispatch_staff() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT jsonb_build_object(
    'delivered', COUNT(*) FILTER (WHERE j.status = 'delivered'),
    'cancelled', COUNT(*) FILTER (WHERE j.status = 'cancelled'),
    'active', COUNT(*) FILTER (WHERE j.status IN ('assigned','heading_to_branch','picked_up','delivering','offered','searching_driver')),
    'total_fees', COALESCE(SUM(j.delivery_fee) FILTER (WHERE j.status = 'delivered'), 0),
    'avg_delivery_minutes', ROUND(AVG(
      EXTRACT(EPOCH FROM (j.delivered_at - j.assigned_at)) / 60.0
    ) FILTER (WHERE j.delivered_at IS NOT NULL AND j.assigned_at IS NOT NULL)::NUMERIC, 1)
  )
  INTO result
  FROM ep_delivery_jobs j
  WHERE j.created_at BETWEEN p_from AND p_to
    AND (p_branch_id IS NULL OR j.branch_id = p_branch_id);

  RETURN COALESCE(result, '{}'::jsonb);
END;
$$;

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.ep_driver_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ep_dispatch_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ep_pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ep_delivery_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ep_delivery_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ep_delivery_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ep_driver_location_latest ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ep_driver_location_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ep_drivers_staff_all ON public.ep_driver_profiles;
CREATE POLICY ep_drivers_staff_all ON public.ep_driver_profiles
  FOR ALL USING (public.ep_is_dispatch_staff() OR public.ep_is_super_admin())
  WITH CHECK (public.ep_is_dispatch_staff() OR public.ep_is_super_admin());

DROP POLICY IF EXISTS ep_drivers_self_read ON public.ep_driver_profiles;
CREATE POLICY ep_drivers_self_read ON public.ep_driver_profiles
  FOR SELECT USING (id = public.ep_my_driver_id() OR profile_id = public.ep_my_profile_id());

DROP POLICY IF EXISTS ep_drivers_self_update ON public.ep_driver_profiles;
CREATE POLICY ep_drivers_self_update ON public.ep_driver_profiles
  FOR UPDATE USING (id = public.ep_my_driver_id());

DROP POLICY IF EXISTS ep_settings_staff ON public.ep_dispatch_settings;
CREATE POLICY ep_settings_staff ON public.ep_dispatch_settings
  FOR ALL USING (public.ep_is_dispatch_staff())
  WITH CHECK (public.ep_is_dispatch_staff());

DROP POLICY IF EXISTS ep_pricing_staff ON public.ep_pricing_rules;
CREATE POLICY ep_pricing_staff ON public.ep_pricing_rules
  FOR ALL USING (public.ep_is_dispatch_staff())
  WITH CHECK (public.ep_is_dispatch_staff());

DROP POLICY IF EXISTS ep_pricing_read_drivers ON public.ep_pricing_rules;
CREATE POLICY ep_pricing_read_drivers ON public.ep_pricing_rules
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS ep_jobs_staff ON public.ep_delivery_jobs;
CREATE POLICY ep_jobs_staff ON public.ep_delivery_jobs
  FOR ALL USING (public.ep_is_dispatch_staff())
  WITH CHECK (public.ep_is_dispatch_staff());

DROP POLICY IF EXISTS ep_jobs_driver_read ON public.ep_delivery_jobs;
CREATE POLICY ep_jobs_driver_read ON public.ep_delivery_jobs
  FOR SELECT USING (
    assigned_driver_id = public.ep_my_driver_id()
    OR EXISTS (
      SELECT 1 FROM ep_delivery_offers o
      WHERE o.job_id = ep_delivery_jobs.id AND o.driver_id = public.ep_my_driver_id()
    )
  );

DROP POLICY IF EXISTS ep_offers_staff ON public.ep_delivery_offers;
CREATE POLICY ep_offers_staff ON public.ep_delivery_offers
  FOR ALL USING (public.ep_is_dispatch_staff())
  WITH CHECK (public.ep_is_dispatch_staff());

DROP POLICY IF EXISTS ep_offers_driver ON public.ep_delivery_offers;
CREATE POLICY ep_offers_driver ON public.ep_delivery_offers
  FOR SELECT USING (driver_id = public.ep_my_driver_id());

DROP POLICY IF EXISTS ep_assignments_staff ON public.ep_delivery_assignments;
CREATE POLICY ep_assignments_staff ON public.ep_delivery_assignments
  FOR ALL USING (public.ep_is_dispatch_staff())
  WITH CHECK (public.ep_is_dispatch_staff());

DROP POLICY IF EXISTS ep_assignments_driver ON public.ep_delivery_assignments;
CREATE POLICY ep_assignments_driver ON public.ep_delivery_assignments
  FOR SELECT USING (driver_id = public.ep_my_driver_id());

DROP POLICY IF EXISTS ep_loc_staff ON public.ep_driver_location_latest;
CREATE POLICY ep_loc_staff ON public.ep_driver_location_latest
  FOR SELECT USING (public.ep_is_dispatch_staff());

DROP POLICY IF EXISTS ep_loc_self ON public.ep_driver_location_latest;
CREATE POLICY ep_loc_self ON public.ep_driver_location_latest
  FOR ALL USING (driver_id = public.ep_my_driver_id())
  WITH CHECK (driver_id = public.ep_my_driver_id());

DROP POLICY IF EXISTS ep_loc_events_staff ON public.ep_driver_location_events;
CREATE POLICY ep_loc_events_staff ON public.ep_driver_location_events
  FOR SELECT USING (public.ep_is_dispatch_staff());

DROP POLICY IF EXISTS ep_loc_events_self ON public.ep_driver_location_events;
CREATE POLICY ep_loc_events_self ON public.ep_driver_location_events
  FOR INSERT WITH CHECK (driver_id = public.ep_my_driver_id());

-- Realtime
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ep_delivery_jobs;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ep_delivery_offers;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ep_driver_location_latest;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ep_delivery_assignments;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- Seed tarifas globales
INSERT INTO public.ep_pricing_rules (name, rule_type, base_fee, per_km_fee, min_fee, max_fee, is_active, priority)
SELECT 'Tarifa base El Pollón', 'per_km', 1500, 400, 2000, 8000, true, 10
WHERE NOT EXISTS (SELECT 1 FROM public.ep_pricing_rules WHERE name = 'Tarifa base El Pollón');

COMMENT ON TABLE public.ep_driver_profiles IS 'Perfiles operativos de repartidores El Pollón (módulo delivery GPS)';
COMMENT ON TABLE public.ep_delivery_jobs IS 'Jobs de despacho espejo de pedidos delivery — no altera menú/caja';
