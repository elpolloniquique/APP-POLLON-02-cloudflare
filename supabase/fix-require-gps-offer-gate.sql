-- =============================================================================
-- require_gps: no ofertar sin ubicación fresca (< 90s)
-- Basado en fix-dispatch-config-v2.sql + filtro GPS
-- Requiere: fix-driver-native-fcm.sql (función ep_driver_location_is_fresh)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.ep_driver_location_is_fresh(p_driver_id UUID, p_max_age_seconds INT DEFAULT 90)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  last_at TIMESTAMPTZ;
BEGIN
  SELECT updated_at INTO last_at
  FROM public.ep_driver_location_latest
  WHERE driver_id = p_driver_id;

  IF last_at IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN last_at >= (now() - make_interval(secs => GREATEST(30, COALESCE(p_max_age_seconds, 90))));
END;
$$;

GRANT EXECUTE ON FUNCTION public.ep_driver_location_is_fresh(UUID, INT) TO authenticated, service_role;

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
  require_gps_flag BOOLEAN := TRUE;
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

  require_gps_flag := COALESCE(settings.require_gps, TRUE);

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
      AND (
        NOT require_gps_flag
        OR public.ep_driver_location_is_fresh(d.id, 90)
      )
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

  RETURN jsonb_build_object(
    'ok', true,
    'offered', offered,
    'ttl_seconds', ttl,
    'require_gps', require_gps_flag
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ep_start_driver_search(UUID) TO authenticated;
