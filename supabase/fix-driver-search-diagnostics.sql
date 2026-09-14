-- =============================================================================
-- Diagnóstico al buscar repartidor: por qué offered = 0
-- GPS fresco 3 min (antes 90s) + mensaje claro para caja/admin
-- =============================================================================

CREATE OR REPLACE FUNCTION public.ep_driver_location_is_fresh(p_driver_id UUID, p_max_age_seconds INT DEFAULT 180)
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
  RETURN last_at >= (now() - make_interval(secs => GREATEST(30, COALESCE(p_max_age_seconds, 180))));
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
  online_n INT := 0;
  gps_ok_n INT := 0;
  skipped_gps INT := 0;
  skipped_offers INT := 0;
  skipped_branch INT := 0;
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
    SELECT d.id, d.preferred_branch_id, d.operational_status
    FROM ep_driver_profiles d
    WHERE d.admin_status = 'approved'
      AND d.operational_status IN ('available', 'heading_to_branch', 'carrying_orders', 'offered')
  LOOP
    online_n := online_n + 1;

    IF job.branch_id IS NOT NULL
       AND drv.preferred_branch_id IS NOT NULL
       AND drv.preferred_branch_id <> job.branch_id THEN
      skipped_branch := skipped_branch + 1;
      CONTINUE;
    END IF;

    IF NOT public.ep_driver_can_receive_offers(drv.id) THEN
      skipped_offers := skipped_offers + 1;
      CONTINUE;
    END IF;

    IF require_gps_flag AND NOT public.ep_driver_location_is_fresh(drv.id, 180) THEN
      skipped_gps := skipped_gps + 1;
      CONTINUE;
    END IF;

    gps_ok_n := gps_ok_n + 1;

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
    'require_gps', require_gps_flag,
    'online', online_n,
    'gps_ok', gps_ok_n,
    'skipped_gps', skipped_gps,
    'skipped_offers', skipped_offers,
    'skipped_branch', skipped_branch,
    'message', CASE
      WHEN offered > 0 THEN format('Oferta enviada a %s repartidor(es)', offered)
      WHEN online_n = 0 THEN 'No hay repartidores en Disponible. Pídele que pulse Conectarme en la app.'
      WHEN skipped_gps > 0 THEN 'El repartidor está en línea pero su GPS aún no llega al servidor (pantalla “GPS: Buscando…”). Espera 10 s o pide que salga al aire libre y pulse Disponible de nuevo.'
      WHEN skipped_branch > 0 THEN 'Hay repartidores en línea, pero de otra sucursal.'
      WHEN skipped_offers > 0 THEN 'El repartidor no puede recibir más ofertas ahora (cupo o pedido en entrega).'
      ELSE 'Ningún repartidor elegible en este momento.'
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ep_start_driver_search(UUID) TO authenticated;
