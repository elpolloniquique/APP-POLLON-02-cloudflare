-- =============================================================================
-- Ofertas repartidor: TTL 60s + reintento automático a los 3 minutos
-- Ejecutar en Supabase SQL Editor UNA vez.
-- =============================================================================

-- TTL por defecto / forzar 1 minuto en todas las sucursales
ALTER TABLE public.ep_dispatch_settings
  ALTER COLUMN offer_ttl_seconds SET DEFAULT 60;

UPDATE public.ep_dispatch_settings
SET offer_ttl_seconds = 60
WHERE COALESCE(offer_ttl_seconds, 0) <> 60;

ALTER TABLE public.ep_dispatch_settings
  ADD COLUMN IF NOT EXISTS retry_after_seconds INTEGER NOT NULL DEFAULT 180;

COMMENT ON COLUMN public.ep_dispatch_settings.retry_after_seconds IS
  'Segundos sin aceptación antes de volver a ofertar automáticamente (default 180 = 3 min).';

-- Expira ofertas vencidas (limpieza)
CREATE OR REPLACE FUNCTION public.ep_expire_pending_offers()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n INT;
BEGIN
  UPDATE public.ep_delivery_offers
  SET status = 'expired', responded_at = COALESCE(responded_at, now())
  WHERE status = 'pending'
    AND expires_at <= now();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

/**
 * Re-oferta jobs sin repartidor tras retry_after_seconds (default 3 min),
 * solo si ya no hay ofertas pending vigentes.
 * Retorna { ok, retried, job_ids: [] }
 */
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
  jid UUID;
BEGIN
  -- Staff de despacho o service_role (cron / API)
  IF auth.role() IS DISTINCT FROM 'service_role' AND NOT public.ep_is_dispatch_staff() THEN
    RAISE EXCEPTION 'Solo personal de despacho';
  END IF;

  PERFORM public.ep_expire_pending_offers();

  FOR job IN
    SELECT j.*
    FROM public.ep_delivery_jobs j
    WHERE j.status IN ('offered', 'searching_driver', 'ready_for_dispatch')
      AND j.assigned_driver_id IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.ep_delivery_assignments a
        WHERE a.job_id = j.id AND a.status = 'active'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.ep_delivery_offers o
        WHERE o.job_id = j.id
          AND o.status = 'pending'
          AND o.expires_at > now()
      )
  LOOP
    SELECT * INTO settings
    FROM public.ep_dispatch_settings
    WHERE branch_id = job.branch_id;

    ttl := COALESCE(settings.offer_ttl_seconds, 60);
    retry_after := COALESCE(
      p_retry_after_seconds,
      settings.retry_after_seconds,
      180
    );

    -- Esperar 3 min desde la última oferta (offered_at)
    IF COALESCE(job.offered_at, job.created_at, job.updated_at) > now() - make_interval(secs => retry_after) THEN
      CONTINUE;
    END IF;

    offered := 0;

    UPDATE public.ep_delivery_jobs
    SET status = 'searching_driver',
        offered_at = now(),
        updated_at = now()
    WHERE id = job.id;

    FOR drv IN
      SELECT d.id
      FROM public.ep_driver_profiles d
      WHERE d.admin_status = 'approved'
        AND d.operational_status IN ('available', 'heading_to_branch', 'carrying_orders', 'offered')
        AND (job.branch_id IS NULL OR d.preferred_branch_id IS NULL OR d.preferred_branch_id = job.branch_id)
        AND public.ep_driver_can_receive_offers(d.id)
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

GRANT EXECUTE ON FUNCTION public.ep_expire_pending_offers() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ep_retry_stale_driver_searches(INT) TO authenticated, service_role;
