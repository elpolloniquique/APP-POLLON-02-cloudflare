-- =============================================================================
-- Reglas ofertas repartidor v2
-- - TTL 60s
-- - Reintento a 3 min SOLO si pedido.estado = 'pendiente'
-- - Si cajera/admin pasa a aceptado/confirmado/en_delivery/entregado/etc.
--   → se cancelan ofertas abiertas (salvo assignment activo)
-- - Buscar repartidor manual sigue pudiendo ofertar
-- Ejecutar UNA vez en Supabase SQL Editor.
-- =============================================================================

ALTER TABLE public.ep_dispatch_settings
  ALTER COLUMN offer_ttl_seconds SET DEFAULT 60;

UPDATE public.ep_dispatch_settings
SET offer_ttl_seconds = 60
WHERE COALESCE(offer_ttl_seconds, 0) <> 60;

ALTER TABLE public.ep_dispatch_settings
  ADD COLUMN IF NOT EXISTS retry_after_seconds INTEGER NOT NULL DEFAULT 180;

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
 * Cancela búsqueda/ofertas de un pedido si ya no está en "pendiente"
 * y no hay repartidor asignado activo.
 */
CREATE OR REPLACE FUNCTION public.ep_cancel_open_driver_offers_for_order(p_order_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jid UUID;
  n INT := 0;
BEGIN
  SELECT id INTO jid
  FROM public.ep_delivery_jobs
  WHERE source_order_id = p_order_id
  LIMIT 1;

  IF jid IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'cancelled', 0);
  END IF;

  -- Si ya hay assignment activo, no tocar
  IF EXISTS (
    SELECT 1 FROM public.ep_delivery_assignments a
    WHERE a.job_id = jid AND a.status = 'active'
  ) THEN
    RETURN jsonb_build_object('ok', true, 'cancelled', 0, 'reason', 'assigned');
  END IF;

  UPDATE public.ep_delivery_offers
  SET status = 'expired', responded_at = COALESCE(responded_at, now())
  WHERE job_id = jid AND status = 'pending';
  GET DIAGNOSTICS n = ROW_COUNT;

  UPDATE public.ep_delivery_jobs
  SET status = CASE
      WHEN status IN ('offered', 'searching_driver', 'ready_for_dispatch') THEN 'ready_for_dispatch'
      ELSE status
    END,
    updated_at = now()
  WHERE id = jid
    AND assigned_driver_id IS NULL;

  RETURN jsonb_build_object('ok', true, 'cancelled', n, 'job_id', jid);
END;
$$;

/** Trigger: al salir de pendiente, quitar ofertas del panel repartidor */
CREATE OR REPLACE FUNCTION public.ep_trg_pedido_estado_cancel_offers()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.estado IS DISTINCT FROM OLD.estado
     AND NEW.estado IS DISTINCT FROM 'pendiente'
  THEN
    PERFORM public.ep_cancel_open_driver_offers_for_order(NEW.id::text);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pedido_estado_cancel_offers ON public.pedidos;
CREATE TRIGGER trg_pedido_estado_cancel_offers
  AFTER UPDATE OF estado ON public.pedidos
  FOR EACH ROW
  EXECUTE FUNCTION public.ep_trg_pedido_estado_cancel_offers();

/**
 * Re-oferta solo pedidos aún "pendiente" (botón Nuevo),
 * sin assignment, tras retry_after_seconds (3 min).
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
  ped_estado TEXT;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' AND NOT public.ep_is_dispatch_staff() THEN
    RAISE EXCEPTION 'Solo personal de despacho';
  END IF;

  PERFORM public.ep_expire_pending_offers();

  -- Limpiar ofertas de pedidos que ya no están pendientes
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

    IF ped_estado IS NULL OR ped_estado IS DISTINCT FROM 'pendiente' THEN
      PERFORM public.ep_cancel_open_driver_offers_for_order(job.source_order_id);
    END IF;
  END LOOP;

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

    ttl := COALESCE(settings.offer_ttl_seconds, 60);
    retry_after := COALESCE(p_retry_after_seconds, settings.retry_after_seconds, 180);

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
GRANT EXECUTE ON FUNCTION public.ep_cancel_open_driver_offers_for_order(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ep_retry_stale_driver_searches(INT) TO authenticated, service_role;
