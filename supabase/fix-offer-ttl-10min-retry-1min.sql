-- =============================================================================
-- Ofertas: 10 min en el panel · reaviso / reintento cada 1 min hasta aceptar
-- GPS fresco: 120s (con keep-alive 2s el pin llega al servidor al instante)
-- =============================================================================

ALTER TABLE public.ep_dispatch_settings
  ALTER COLUMN offer_ttl_seconds SET DEFAULT 600;

ALTER TABLE public.ep_dispatch_settings
  ALTER COLUMN retry_after_seconds SET DEFAULT 60;

UPDATE public.ep_dispatch_settings
SET
  offer_ttl_seconds = 600,
  retry_after_seconds = 60
WHERE TRUE;

COMMENT ON COLUMN public.ep_dispatch_settings.offer_ttl_seconds IS
  'Segundos que la oferta permanece en el celular del repartidor (10 min).';
COMMENT ON COLUMN public.ep_dispatch_settings.retry_after_seconds IS
  'Cada cuántos segundos reavisar / re-ofertar si nadie aceptó (1 min).';

CREATE OR REPLACE FUNCTION public.ep_driver_location_is_fresh(p_driver_id UUID, p_max_age_seconds INT DEFAULT 120)
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
  RETURN last_at >= (now() - make_interval(secs => GREATEST(30, COALESCE(p_max_age_seconds, 120))));
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

  ttl := COALESCE(settings.offer_ttl_seconds, 600);
  IF ttl < 15 THEN ttl := 15; END IF;
  IF ttl > 900 THEN ttl := 900; END IF;

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

    IF require_gps_flag AND NOT public.ep_driver_location_is_fresh(drv.id, 120) THEN
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
      WHEN offered > 0 THEN format('Oferta enviada a %s repartidor(es) · %s min para aceptar', offered, GREATEST(1, ttl / 60))
      WHEN online_n = 0 THEN 'No hay repartidores en Disponible. Pídele que pulse Conectarme en la app.'
      WHEN skipped_gps > 0 THEN 'El repartidor está en línea pero su GPS aún no llega al servidor. Espera 2–5 s con la app nativa en ruta y vuelve a buscar.'
      WHEN skipped_branch > 0 THEN 'Hay repartidores en línea, pero de otra sucursal.'
      WHEN skipped_offers > 0 THEN 'El repartidor no puede recibir más ofertas ahora.'
      ELSE 'Ningún repartidor elegible en este momento.'
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ep_start_driver_search(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.ep_retry_stale_driver_searches(
  p_retry_after_seconds INT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  job RECORD;
  settings RECORD;
  ttl INT;
  retry_after INT;
  drv RECORD;
  offered INT;
  total_retried INT := 0;
  job_ids UUID[] := ARRAY[]::UUID[];
  ped_estado TEXT;
  terminal TEXT[] := ARRAY[
    'aceptado', 'confirmado', 'en_cocina', 'preparando',
    'en_delivery', 'en_camino', 'entregado', 'cancelado'
  ];
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' AND NOT public.ep_is_dispatch_staff() THEN
    RAISE EXCEPTION 'Solo personal de despacho';
  END IF;

  PERFORM public.ep_expire_pending_offers();

  FOR job IN
    SELECT j.id, j.source_order_id
    FROM public.ep_delivery_jobs j
    WHERE j.assigned_driver_id IS NULL
      AND j.status IN ('offered', 'searching_driver', 'ready_for_dispatch')
  LOOP
    SELECT p.estado INTO ped_estado
    FROM public.pedidos p
    WHERE p.id::text = job.source_order_id
    LIMIT 1;

    IF ped_estado IS NULL OR ped_estado = ANY (terminal) OR ped_estado IS DISTINCT FROM 'pendiente' THEN
      PERFORM public.ep_cancel_open_driver_offers_for_order(job.source_order_id);
    END IF;
  END LOOP;

  -- A) Reaviso cada 1 min mientras la oferta sigue viva (misma tarjeta, nueva alarma)
  FOR job IN
    SELECT j.*
    FROM public.ep_delivery_jobs j
    INNER JOIN public.pedidos p ON p.id::text = j.source_order_id
    WHERE p.estado = 'pendiente'
      AND j.status IN ('offered', 'searching_driver')
      AND j.assigned_driver_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.ep_delivery_assignments a
        WHERE a.job_id = j.id AND a.status = 'active'
      )
      AND EXISTS (
        SELECT 1 FROM public.ep_delivery_offers o
        WHERE o.job_id = j.id
          AND o.status = 'pending'
          AND o.expires_at > now()
      )
  LOOP
    SELECT * INTO settings
    FROM public.ep_dispatch_settings
    WHERE branch_id = job.branch_id;

    retry_after := COALESCE(p_retry_after_seconds, settings.retry_after_seconds, 60);
    IF retry_after < 30 THEN retry_after := 30; END IF;

    IF COALESCE(job.offered_at, job.created_at, job.updated_at)
         > now() - make_interval(secs => retry_after) THEN
      CONTINUE;
    END IF;

    UPDATE public.ep_delivery_jobs
    SET offered_at = now(), updated_at = now()
    WHERE id = job.id;

    total_retried := total_retried + 1;
    job_ids := array_append(job_ids, job.id);
  END LOOP;

  -- B) Nueva ola si ya no hay oferta pending (expiró a los 10 min)
  FOR job IN
    SELECT j.*
    FROM public.ep_delivery_jobs j
    INNER JOIN public.pedidos p ON p.id::text = j.source_order_id
    WHERE p.estado = 'pendiente'
      AND j.status IN ('offered', 'searching_driver', 'ready_for_dispatch')
      AND j.assigned_driver_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.ep_delivery_assignments a
        WHERE a.job_id = j.id AND a.status = 'active'
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.ep_delivery_offers o
        WHERE o.job_id = j.id
          AND o.status = 'pending'
          AND o.expires_at > now()
      )
  LOOP
    SELECT * INTO settings
    FROM public.ep_dispatch_settings
    WHERE branch_id = job.branch_id;

    ttl := COALESCE(settings.offer_ttl_seconds, 600);
    IF ttl < 15 THEN ttl := 15; END IF;
    IF ttl > 900 THEN ttl := 900; END IF;
    retry_after := COALESCE(p_retry_after_seconds, settings.retry_after_seconds, 60);
    IF retry_after < 30 THEN retry_after := 30; END IF;

    IF COALESCE(job.offered_at, job.created_at, job.updated_at)
         > now() - make_interval(secs => retry_after) THEN
      CONTINUE;
    END IF;

    offered := 0;

    UPDATE public.ep_delivery_jobs
    SET status = 'searching_driver', offered_at = now(), updated_at = now()
    WHERE id = job.id;

    FOR drv IN
      SELECT d.id
      FROM public.ep_driver_profiles d
      WHERE d.admin_status = 'approved'
        AND d.operational_status IN ('available', 'heading_to_branch', 'carrying_orders', 'offered')
        AND (job.branch_id IS NULL OR d.preferred_branch_id IS NULL OR d.preferred_branch_id = job.branch_id)
        AND public.ep_driver_can_receive_offers(d.id)
        AND public.ep_driver_location_is_fresh(d.id, 120)
    LOOP
      INSERT INTO public.ep_delivery_offers (job_id, driver_id, status, offered_fee, expires_at)
      VALUES (job.id, drv.id, 'pending', job.delivery_fee, now() + make_interval(secs => ttl))
      ON CONFLICT (job_id, driver_id) DO UPDATE SET
        status = 'pending',
        offered_fee = EXCLUDED.offered_fee,
        expires_at = EXCLUDED.expires_at,
        responded_at = NULL;
      offered := offered + 1;
    END LOOP;

    IF offered > 0 THEN
      UPDATE public.ep_delivery_jobs
      SET status = 'offered', updated_at = now()
      WHERE id = job.id;
      total_retried := total_retried + 1;
      job_ids := array_append(job_ids, job.id);
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'retried', total_retried,
    'job_ids', to_jsonb(job_ids)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ep_retry_stale_driver_searches(INT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ep_start_driver_search(UUID) TO authenticated;
