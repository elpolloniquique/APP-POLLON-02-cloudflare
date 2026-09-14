-- =============================================================================
-- ARREGLO: reloj 1 min (pg_cron + pg_net) + ofertas que no caducan a los 10 min
-- Ejecutar TODO este archivo UNA vez en Supabase SQL Editor.
--
-- Fallas que corrige:
--  1) pg_net a veces no manda el header Authorization → se usa ?secret=
--  2) postgres no tenía permiso sobre schema net → el cron fallaba en silencio
--  3) ep_retry_stale_driver_searches seguía con TTL 10 min / clamp 900s
--  4) ofertas expired se reactivan si el pedido sigue pendiente
--
-- DESPUÉS de este SQL, ejecuta (secreto completo de Vercel):
--   SELECT public.ep_set_cron_secret('PEGA_AQUI_EL_CRON_SECRET');
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  BEGIN EXECUTE 'GRANT USAGE ON SCHEMA cron TO postgres'; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN EXECUTE 'GRANT USAGE ON SCHEMA net TO postgres'; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN EXECUTE 'GRANT USAGE ON SCHEMA extensions TO postgres'; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN EXECUTE 'GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA net TO postgres'; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN EXECUTE 'GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO postgres'; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

CREATE TABLE IF NOT EXISTS public.ep_internal_secrets (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ep_internal_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ep_internal_secrets FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.ep_internal_secrets TO postgres, service_role;

CREATE OR REPLACE FUNCTION public.ep_set_cron_secret(p_secret TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_secret IS NULL OR length(trim(p_secret)) < 16 THEN
    RAISE EXCEPTION 'CRON_SECRET demasiado corto';
  END IF;
  INSERT INTO public.ep_internal_secrets(key, value, updated_at)
  VALUES ('cron_secret', trim(p_secret), now())
  ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value, updated_at = now();
  RETURN jsonb_build_object('ok', true, 'updated_at', now(), 'len', length(trim(p_secret)));
END;
$$;

CREATE OR REPLACE FUNCTION public.ep_get_cron_secret()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT value FROM public.ep_internal_secrets WHERE key = 'cron_secret' LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.ep_set_cron_secret(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ep_get_cron_secret() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ep_set_cron_secret(TEXT) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.ep_get_cron_secret() TO postgres, service_role;

CREATE OR REPLACE FUNCTION public.ep_cron_retry_driver_offers()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, extensions, pg_temp
AS $$
DECLARE
  secret TEXT;
  req_id BIGINT;
  endpoint TEXT;
BEGIN
  secret := public.ep_get_cron_secret();
  IF secret IS NULL OR length(trim(secret)) < 16 THEN
    RAISE WARNING '[Pollón] pg_cron: falta CRON_SECRET';
    RETURN NULL;
  END IF;

  -- Query string: pg_net a menudo no envía Authorization
  endpoint := 'https://www.el-pollon.cl/api/cron-retry-driver-offers?secret=' || trim(secret);

  BEGIN
    SELECT net.http_post(
      url := endpoint,
      body := jsonb_build_object('source', 'supabase_pg_cron'),
      headers := jsonb_build_object('Content-Type', 'application/json')
    ) INTO req_id;
  EXCEPTION WHEN undefined_function THEN
    SELECT extensions.http_post(
      url := endpoint,
      body := jsonb_build_object('source', 'supabase_pg_cron'),
      headers := jsonb_build_object('Content-Type', 'application/json')
    ) INTO req_id;
  END;

  RETURN req_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ep_cron_retry_driver_offers() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ep_cron_retry_driver_offers() TO postgres, service_role;

-- Ofertas persistentes: no caducar por reloj
CREATE OR REPLACE FUNCTION public.ep_expire_pending_offers()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n INT := 0;
BEGIN
  UPDATE public.ep_delivery_offers o
  SET status = 'expired', responded_at = COALESCE(o.responded_at, now())
  FROM public.ep_delivery_jobs j
  WHERE o.job_id = j.id
    AND o.status = 'pending'
    AND (
      j.status IN ('assigned', 'heading_to_branch', 'picked_up', 'delivering', 'delivered', 'cancelled')
      OR j.assigned_driver_id IS NOT NULL
    );
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ep_expire_pending_offers() TO authenticated, service_role;

-- Reactivar ofertas que murieron a los 10 min si el pedido sigue nuevo
UPDATE public.ep_delivery_offers o
SET
  status = 'pending',
  expires_at = now() + interval '24 hours',
  responded_at = NULL
FROM public.ep_delivery_jobs j
JOIN public.pedidos p ON p.id::text = j.source_order_id
WHERE o.job_id = j.id
  AND o.status = 'expired'
  AND j.assigned_driver_id IS NULL
  AND j.status IN ('offered', 'searching_driver', 'ready_for_dispatch')
  AND p.estado = 'pendiente';

UPDATE public.ep_delivery_offers
SET expires_at = now() + interval '24 hours'
WHERE status = 'pending';

UPDATE public.ep_dispatch_settings
SET offer_ttl_seconds = 86400, retry_after_seconds = 60
WHERE TRUE;

-- Retry cada 1 min SIN depender de expires_at
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

  -- Reavisar jobs con oferta pending (aunque expires_at esté vencido)
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
        WHERE o.job_id = j.id AND o.status = 'pending'
      )
  LOOP
    SELECT * INTO settings FROM public.ep_dispatch_settings WHERE branch_id = job.branch_id;
    retry_after := COALESCE(p_retry_after_seconds, settings.retry_after_seconds, 60);
    IF retry_after < 30 THEN retry_after := 30; END IF;

    IF COALESCE(job.offered_at, job.created_at, job.updated_at)
         > now() - make_interval(secs => retry_after) THEN
      CONTINUE;
    END IF;

    UPDATE public.ep_delivery_jobs
    SET offered_at = now(), updated_at = now()
    WHERE id = job.id;

    UPDATE public.ep_delivery_offers
    SET expires_at = GREATEST(expires_at, now() + interval '24 hours')
    WHERE job_id = job.id AND status = 'pending';

    total_retried := total_retried + 1;
    job_ids := array_append(job_ids, job.id);
  END LOOP;

  -- Nueva ola si no hay pending
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
        WHERE o.job_id = j.id AND o.status = 'pending'
      )
  LOOP
    SELECT * INTO settings FROM public.ep_dispatch_settings WHERE branch_id = job.branch_id;
    ttl := GREATEST(86400, COALESCE(settings.offer_ttl_seconds, 86400));
    IF ttl > 604800 THEN ttl := 604800; END IF;
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
      UPDATE public.ep_delivery_jobs SET status = 'offered', updated_at = now() WHERE id = job.id;
      total_retried := total_retried + 1;
      job_ids := array_append(job_ids, job.id);
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'retried', total_retried, 'job_ids', to_jsonb(job_ids));
END;
$$;

GRANT EXECUTE ON FUNCTION public.ep_retry_stale_driver_searches(INT) TO authenticated, service_role;

DO $$
DECLARE jid BIGINT;
BEGIN
  FOR jid IN SELECT jobid FROM cron.job WHERE jobname = 'pollon-retry-driver-offers'
  LOOP
    PERFORM cron.unschedule(jid);
  END LOOP;
END $$;

SELECT cron.schedule(
  'pollon-retry-driver-offers',
  '* * * * *',
  $cron$SELECT public.ep_cron_retry_driver_offers();$cron$
);

SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE jobname = 'pollon-retry-driver-offers';
