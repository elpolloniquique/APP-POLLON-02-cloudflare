-- =============================================================================
-- Config despacho v2: comisión default, gate enabled, verify real, columnas
-- Idempotente. Ejecutar en Supabase SQL Editor.
-- =============================================================================

-- Columnas nuevas / faltantes
ALTER TABLE public.ep_dispatch_settings
  ADD COLUMN IF NOT EXISTS retry_after_seconds INTEGER;

ALTER TABLE public.ep_dispatch_settings
  ADD COLUMN IF NOT EXISTS default_commission_percent NUMERIC(5,2);

UPDATE public.ep_dispatch_settings
SET retry_after_seconds = 180
WHERE retry_after_seconds IS NULL;

UPDATE public.ep_dispatch_settings
SET default_commission_percent = 5
WHERE default_commission_percent IS NULL;

ALTER TABLE public.ep_dispatch_settings
  ALTER COLUMN retry_after_seconds SET DEFAULT 180;

ALTER TABLE public.ep_dispatch_settings
  ALTER COLUMN default_commission_percent SET DEFAULT 5;

ALTER TABLE public.ep_dispatch_settings
  ALTER COLUMN offer_ttl_seconds SET DEFAULT 120;

DO $$
BEGIN
  ALTER TABLE public.ep_dispatch_settings
    DROP CONSTRAINT IF EXISTS ep_dispatch_settings_default_commission_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE public.ep_dispatch_settings
  DROP CONSTRAINT IF EXISTS ep_dispatch_settings_default_commission_check;

ALTER TABLE public.ep_dispatch_settings
  ADD CONSTRAINT ep_dispatch_settings_default_commission_check
  CHECK (default_commission_percent IS NULL OR (default_commission_percent >= 0 AND default_commission_percent <= 100));

-- Comisión por repartidor (si aún no se corrió el fix dedicado)
ALTER TABLE public.ep_driver_profiles
  ADD COLUMN IF NOT EXISTS commission_percent NUMERIC(5,2);

UPDATE public.ep_driver_profiles
SET commission_percent = 5
WHERE commission_percent IS NULL;

-- Gate: no ofertar si despacho desactivado en la sucursal
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

  IF settings IS NOT NULL AND settings.enabled IS FALSE THEN
    RETURN jsonb_build_object(
      'ok', false,
      'offered', 0,
      'reason', 'dispatch_disabled',
      'message', 'Despacho desactivado en la configuración de esta sucursal'
    );
  END IF;

  ttl := COALESCE(settings.offer_ttl_seconds, 120);
  IF ttl < 15 THEN ttl := 15; END IF;
  IF ttl > 300 THEN ttl := 300; END IF;

  UPDATE ep_delivery_jobs
  SET status = 'searching_driver', offered_at = now(), updated_at = now()
  WHERE id = p_job_id;

  FOR drv IN
    SELECT d.id
    FROM ep_driver_profiles d
    WHERE d.admin_status = 'approved'
      AND d.operational_status IN ('available', 'heading_to_branch', 'carrying_orders', 'offered')
      AND (job.branch_id IS NULL OR d.preferred_branch_id IS NULL OR d.preferred_branch_id = job.branch_id)
      AND public.ep_driver_can_receive_offers(d.id)
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

  RETURN jsonb_build_object('ok', true, 'offered', offered, 'ttl_seconds', ttl);
END;
$$;

GRANT EXECUTE ON FUNCTION public.ep_start_driver_search(UUID) TO authenticated;

-- Verify real (ok = AND de tablas críticas + columnas)
CREATE OR REPLACE FUNCTION public.ep_verify_delivery_module()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tables JSONB;
  functions JSONB;
  columns JSONB;
  ok_tables BOOLEAN;
  ok_funcs BOOLEAN;
  ok_cols BOOLEAN;
BEGIN
  tables := jsonb_build_object(
    'ep_driver_profiles', to_regclass('public.ep_driver_profiles') IS NOT NULL,
    'ep_dispatch_settings', to_regclass('public.ep_dispatch_settings') IS NOT NULL,
    'ep_delivery_jobs', to_regclass('public.ep_delivery_jobs') IS NOT NULL,
    'ep_delivery_offers', to_regclass('public.ep_delivery_offers') IS NOT NULL,
    'ep_delivery_assignments', to_regclass('public.ep_delivery_assignments') IS NOT NULL,
    'ep_driver_location_latest', to_regclass('public.ep_driver_location_latest') IS NOT NULL
  );

  functions := jsonb_build_object(
    'ep_ensure_driver_profile', EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='ep_ensure_driver_profile'),
    'ep_start_driver_search', EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='ep_start_driver_search'),
    'ep_accept_delivery_offer', EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='ep_accept_delivery_offer'),
    'ep_retry_stale_driver_searches', EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='ep_retry_stale_driver_searches'),
    'ep_driver_can_receive_offers', EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='ep_driver_can_receive_offers'),
    'ep_upsert_driver_location', EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='ep_upsert_driver_location')
  );

  columns := jsonb_build_object(
    'dispatch.retry_after_seconds', EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='ep_dispatch_settings' AND column_name='retry_after_seconds'
    ),
    'dispatch.default_commission_percent', EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='ep_dispatch_settings' AND column_name='default_commission_percent'
    ),
    'driver.commission_percent', EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='ep_driver_profiles' AND column_name='commission_percent'
    ),
    'driver.max_orders', EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='ep_driver_profiles' AND column_name='max_orders'
    )
  );

  ok_tables := (tables->>'ep_driver_profiles')::boolean
    AND (tables->>'ep_dispatch_settings')::boolean
    AND (tables->>'ep_delivery_jobs')::boolean
    AND (tables->>'ep_delivery_offers')::boolean
    AND (tables->>'ep_delivery_assignments')::boolean;

  ok_funcs := (functions->>'ep_start_driver_search')::boolean
    AND (functions->>'ep_accept_delivery_offer')::boolean
    AND (functions->>'ep_ensure_driver_profile')::boolean;

  ok_cols := (columns->>'dispatch.retry_after_seconds')::boolean
    AND (columns->>'driver.max_orders')::boolean;

  RETURN jsonb_build_object(
    'ok', ok_tables AND ok_funcs AND ok_cols,
    'tables', tables,
    'functions', functions,
    'columns', columns,
    'counts', jsonb_build_object(
      'drivers', (SELECT COUNT(*) FROM ep_driver_profiles),
      'jobs', (SELECT COUNT(*) FROM ep_delivery_jobs),
      'dispatch_settings', (SELECT COUNT(*) FROM ep_dispatch_settings),
      'branches_with_gps', (SELECT COUNT(*) FROM branches WHERE lat IS NOT NULL AND lng IS NOT NULL)
    ),
    'hint', CASE
      WHEN NOT ok_cols THEN 'Ejecuta supabase/fix-dispatch-config-v2.sql y fix-driver-commission-percent.sql'
      WHEN NOT ok_funcs THEN 'Ejecuta supabase/fix-delivery-production-ready.sql'
      ELSE NULL
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ep_verify_delivery_module() TO anon, authenticated;

COMMENT ON COLUMN public.ep_dispatch_settings.default_commission_percent IS
  'Comisión % por defecto al aplicar a repartidores de la sucursal (0–100).';
