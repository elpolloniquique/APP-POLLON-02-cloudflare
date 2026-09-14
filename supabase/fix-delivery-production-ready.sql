-- =============================================================================
-- FIX PRODUCCIÓN — Módulo Repartidores / GPS / Mapas
-- Ejecutar UNA VEZ en Supabase SQL Editor (rol postgres)
-- Deja grants, RPCs, RLS y seed GPS listos para usar al 100%
-- =============================================================================

-- 0) Columnas GPS en sucursales (idempotente)
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;

CREATE TABLE IF NOT EXISTS public.ep_driver_location_events (
  id BIGSERIAL PRIMARY KEY,
  driver_id UUID NOT NULL REFERENCES public.ep_driver_profiles(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  heading DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  accuracy DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1) RPC ensure sin columna telefono (profiles.phone)
CREATE OR REPLACE FUNCTION public.ep_ensure_driver_profile()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pid UUID;
  did UUID;
  v_phone TEXT;
BEGIN
  IF NOT public.ep_is_driver_role() AND NOT public.ep_is_dispatch_staff() THEN
    RAISE EXCEPTION 'No autorizado: tu perfil debe tener role = delivery o repartidor';
  END IF;

  pid := public.ep_my_profile_id();
  IF pid IS NULL THEN
    RAISE EXCEPTION 'Perfil no encontrado en profiles (auth_user_id)';
  END IF;

  SELECT COALESCE(phone, '') INTO v_phone FROM profiles WHERE id = pid;

  SELECT id INTO did FROM ep_driver_profiles WHERE profile_id = pid;

  IF did IS NULL THEN
    INSERT INTO ep_driver_profiles (profile_id, admin_status, phone, operational_status)
    VALUES (
      pid,
      CASE WHEN public.ep_is_driver_role() THEN 'approved' ELSE 'pending' END,
      v_phone,
      'offline'
    )
    RETURNING id INTO did;
  ELSIF public.ep_is_driver_role() THEN
    -- Si ya existía como pending, auto-aprobar rol delivery
    UPDATE ep_driver_profiles
    SET admin_status = 'approved',
        approved_at = COALESCE(approved_at, now()),
        phone = CASE WHEN COALESCE(phone, '') = '' THEN v_phone ELSE phone END,
        updated_at = now()
    WHERE id = did AND admin_status IN ('pending', 'rejected');
  END IF;

  RETURN did;
END;
$$;

-- 2) Estado operativo: auto-aprobar repartidores delivery
CREATE OR REPLACE FUNCTION public.ep_set_my_operational_status(p_status TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  did UUID;
BEGIN
  IF p_status NOT IN (
    'offline', 'available', 'offered', 'heading_to_branch', 'waiting_at_branch',
    'carrying_orders', 'delivering', 'paused', 'location_unavailable'
  ) THEN
    RAISE EXCEPTION 'Estado inválido: %', p_status;
  END IF;

  did := public.ep_my_driver_id();
  IF did IS NULL THEN
    did := public.ep_ensure_driver_profile();
  END IF;

  IF public.ep_is_driver_role() THEN
    UPDATE ep_driver_profiles
    SET admin_status = 'approved',
        approved_at = COALESCE(approved_at, now()),
        updated_at = now()
    WHERE id = did AND admin_status <> 'approved' AND admin_status <> 'blocked';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM ep_driver_profiles
    WHERE id = did AND admin_status = 'approved'
  ) THEN
    RAISE EXCEPTION 'Repartidor no aprobado. Pide a Super Admin que te apruebe en /admin/repartidores';
  END IF;

  UPDATE ep_driver_profiles
  SET operational_status = p_status, updated_at = now()
  WHERE id = did;

  RETURN jsonb_build_object('ok', true, 'driver_id', did, 'status', p_status);
END;
$$;

-- 3) GPS upsert (idempotente)
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
  IF p_lat IS NULL OR p_lng IS NULL THEN
    RAISE EXCEPTION 'lat/lng requeridos';
  END IF;

  did := public.ep_my_driver_id();
  IF did IS NULL THEN
    did := public.ep_ensure_driver_profile();
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

  RETURN jsonb_build_object('ok', true, 'driver_id', did, 'lat', p_lat, 'lng', p_lng);
END;
$$;

-- 4) Permisos: frontend authenticated debe poder ejecutar RPCs
GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.ep_driver_profiles,
  public.ep_dispatch_settings,
  public.ep_pricing_rules,
  public.ep_delivery_jobs,
  public.ep_delivery_offers,
  public.ep_delivery_assignments,
  public.ep_driver_location_latest,
  public.ep_driver_location_events
TO authenticated;

GRANT SELECT ON
  public.ep_pricing_rules,
  public.ep_delivery_jobs,
  public.ep_driver_location_latest
TO anon;

GRANT EXECUTE ON FUNCTION public.ep_my_role() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ep_is_super_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ep_is_dispatch_staff() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ep_is_driver_role() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ep_my_profile_id() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ep_my_driver_id() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ep_ensure_driver_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ep_set_my_operational_status(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ep_upsert_driver_location(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ep_upsert_job_from_pedido(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ep_start_driver_search(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ep_accept_delivery_offer(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ep_reject_delivery_offer(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ep_confirm_pickup(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ep_confirm_delivery(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ep_quote_delivery(UUID, NUMERIC) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ep_dispatch_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- 5) Seed GPS sucursales (Iquique / Arica / Alto Hospicio) si faltan coords
UPDATE public.branches
SET lat = -20.2304, lng = -70.1520
WHERE (lat IS NULL OR lng IS NULL)
  AND (city ILIKE '%iquique%' OR name ILIKE '%iquique%' OR slug ILIKE '%iquique%');

UPDATE public.branches
SET lat = -18.4783, lng = -70.3126
WHERE (lat IS NULL OR lng IS NULL)
  AND (city ILIKE '%arica%' OR name ILIKE '%arica%' OR slug ILIKE '%arica%');

UPDATE public.branches
SET lat = -20.2677, lng = -70.1050
WHERE (lat IS NULL OR lng IS NULL)
  AND (city ILIKE '%hospicio%' OR name ILIKE '%hospicio%' OR slug ILIKE '%hospicio%' OR name ILIKE '%alto hospicio%');

-- Cualquier sucursal activa sin GPS: anclar cerca de Iquique (mejorable en admin)
UPDATE public.branches
SET lat = -20.2304, lng = -70.1520
WHERE (lat IS NULL OR lng IS NULL) AND COALESCE(is_active, true) = true;

-- 6) Settings de despacho por cada sucursal activa
INSERT INTO public.ep_dispatch_settings (
  branch_id, enabled, auto_offer, offer_ttl_seconds, max_search_radius_km,
  arrival_radius_m, customer_arrival_radius_m, max_orders_per_driver, require_gps
)
SELECT b.id, true, false, 60, 8, 80, 60, 2, true
FROM public.branches b
WHERE COALESCE(b.is_active, true) = true
ON CONFLICT (branch_id) DO NOTHING;

-- 7) Realtime (ignora si ya está)
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.ep_delivery_jobs; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.ep_delivery_offers; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.ep_driver_location_latest; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.ep_delivery_assignments; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.ep_driver_profiles; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- 8) Función de verificación (ejecuta: SELECT public.ep_verify_delivery_module();)
CREATE OR REPLACE FUNCTION public.ep_verify_delivery_module()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'ok', true,
    'tables', jsonb_build_object(
      'ep_driver_profiles', to_regclass('public.ep_driver_profiles') IS NOT NULL,
      'ep_dispatch_settings', to_regclass('public.ep_dispatch_settings') IS NOT NULL,
      'ep_pricing_rules', to_regclass('public.ep_pricing_rules') IS NOT NULL,
      'ep_delivery_jobs', to_regclass('public.ep_delivery_jobs') IS NOT NULL,
      'ep_delivery_offers', to_regclass('public.ep_delivery_offers') IS NOT NULL,
      'ep_delivery_assignments', to_regclass('public.ep_delivery_assignments') IS NOT NULL,
      'ep_driver_location_latest', to_regclass('public.ep_driver_location_latest') IS NOT NULL,
      'ep_driver_location_events', to_regclass('public.ep_driver_location_events') IS NOT NULL
    ),
    'functions', jsonb_build_object(
      'ep_ensure_driver_profile', EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='ep_ensure_driver_profile'),
      'ep_upsert_driver_location', EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='ep_upsert_driver_location'),
      'ep_accept_delivery_offer', EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='ep_accept_delivery_offer'),
      'ep_quote_delivery', EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='ep_quote_delivery')
    ),
    'counts', jsonb_build_object(
      'drivers', (SELECT COUNT(*) FROM ep_driver_profiles),
      'pricing_rules', (SELECT COUNT(*) FROM ep_pricing_rules),
      'jobs', (SELECT COUNT(*) FROM ep_delivery_jobs),
      'branches_with_gps', (SELECT COUNT(*) FROM branches WHERE lat IS NOT NULL AND lng IS NOT NULL),
      'dispatch_settings', (SELECT COUNT(*) FROM ep_dispatch_settings)
    ),
    'sample_quote', public.ep_quote_delivery(NULL, 3.5)
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ep_verify_delivery_module() TO anon, authenticated;

-- Verificación inmediata
SELECT public.ep_verify_delivery_module() AS verificacion;
