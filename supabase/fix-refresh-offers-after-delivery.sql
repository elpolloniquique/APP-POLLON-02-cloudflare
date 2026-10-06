-- =============================================================================
-- Al entregar (0 pedidos activos) el repartidor vuelve a ver pedidos nuevos
-- de inmediato. Ejecutar UNA vez en SQL Editor.
--
-- Causa: al recojo se vencen TODAS las ofertas pending de ese chofer.
-- El reintento SQL no lo reinserta si otro chofer sigue con pending
-- (TTL 24 h). Tras "Pedido entregado" la bandeja queda vacía.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.ep_refresh_open_offers_for_driver(p_driver_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  drv RECORD;
  job RECORD;
  ttl INT := 86400;
  settings RECORD;
  revived INT := 0;
  inserted INT := 0;
  skipped_rejected INT := 0;
BEGIN
  IF p_driver_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_driver');
  END IF;

  SELECT * INTO drv FROM public.ep_driver_profiles WHERE id = p_driver_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'driver_missing');
  END IF;

  IF NOT public.ep_driver_can_receive_offers(p_driver_id) THEN
    RETURN jsonb_build_object('ok', true, 'revived', 0, 'inserted', 0, 'reason', 'not_eligible');
  END IF;

  FOR job IN
    SELECT j.id, j.branch_id, j.delivery_fee, j.status
    FROM public.ep_delivery_jobs j
    INNER JOIN public.pedidos p ON p.id::text = j.source_order_id
    WHERE j.assigned_driver_id IS NULL
      AND j.status NOT IN ('delivered', 'cancelled', 'assigned', 'heading_to_branch', 'picked_up', 'delivering')
      AND NOT EXISTS (
        SELECT 1 FROM public.ep_delivery_assignments a
        WHERE a.job_id = j.id AND a.status = 'active'
      )
      AND LOWER(COALESCE(p.estado, '')) IN ('pendiente', 'nuevo')
      AND COALESCE(p.tipo_entrega, 'delivery') = 'delivery'
  LOOP
    IF job.branch_id IS NOT NULL
       AND drv.preferred_branch_id IS NOT NULL
       AND drv.preferred_branch_id <> job.branch_id THEN
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.ep_delivery_offers o
      WHERE o.job_id = job.id AND o.driver_id = p_driver_id AND o.status = 'rejected'
    ) THEN
      skipped_rejected := skipped_rejected + 1;
      CONTINUE;
    END IF;

    SELECT * INTO settings FROM public.ep_dispatch_settings WHERE branch_id = job.branch_id;
    ttl := GREATEST(86400, COALESCE(settings.offer_ttl_seconds, 86400));
    IF ttl > 604800 THEN ttl := 604800; END IF;

    UPDATE public.ep_delivery_offers
    SET
      status = 'pending',
      offered_fee = job.delivery_fee,
      expires_at = now() + make_interval(secs => ttl),
      responded_at = NULL
    WHERE job_id = job.id
      AND driver_id = p_driver_id
      AND status IN ('expired', 'taken_by_other', 'pending');

    IF FOUND THEN
      revived := revived + 1;
    ELSE
      INSERT INTO public.ep_delivery_offers (job_id, driver_id, status, offered_fee, expires_at)
      VALUES (job.id, p_driver_id, 'pending', job.delivery_fee, now() + make_interval(secs => ttl))
      ON CONFLICT (job_id, driver_id) DO NOTHING;
      IF FOUND THEN
        inserted := inserted + 1;
      END IF;
    END IF;

    IF job.status <> 'offered' THEN
      UPDATE public.ep_delivery_jobs
      SET status = 'offered', offered_at = COALESCE(offered_at, now()), updated_at = now()
      WHERE id = job.id
        AND assigned_driver_id IS NULL
        AND status NOT IN ('assigned', 'heading_to_branch', 'picked_up', 'delivering', 'delivered', 'cancelled');
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'revived', revived,
    'inserted', inserted,
    'skipped_rejected', skipped_rejected
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.ep_refresh_my_open_offers()
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
  RETURN public.ep_refresh_open_offers_for_driver(did);
END;
$$;

GRANT EXECUTE ON FUNCTION public.ep_refresh_open_offers_for_driver(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.ep_refresh_my_open_offers() TO authenticated, service_role;

-- ── Entrega: disponible + ofertas nuevas al instante ────────────────────────
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
  is_staff BOOLEAN;
  left_active INT;
  refreshed JSONB;
BEGIN
  did := public.ep_my_driver_id();
  is_staff := public.ep_is_dispatch_staff();

  IF did IS NOT NULL THEN
    SELECT * INTO a FROM ep_delivery_assignments
    WHERE id = p_assignment_id AND driver_id = did AND status = 'active';
  ELSIF is_staff THEN
    SELECT * INTO a FROM ep_delivery_assignments
    WHERE id = p_assignment_id AND status = 'active';
  ELSE
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF NOT FOUND THEN RAISE EXCEPTION 'Asignación no encontrada'; END IF;

  UPDATE ep_delivery_assignments
  SET status = 'completed', phase = 'done', delivered_at = now(), updated_at = now()
  WHERE id = p_assignment_id;

  UPDATE ep_delivery_jobs
  SET status = 'delivered', delivered_at = now(), updated_at = now()
  WHERE id = a.job_id
  RETURNING source_order_id INTO oid;

  IF oid IS NOT NULL THEN
    UPDATE pedidos SET estado = 'entregado', entregado_en = now() WHERE id = oid;
  END IF;

  SELECT COUNT(*) INTO left_active
  FROM ep_delivery_assignments
  WHERE driver_id = a.driver_id AND status = 'active';

  refreshed := jsonb_build_object('ok', true, 'revived', 0);

  IF left_active = 0 THEN
    UPDATE ep_driver_profiles
    SET operational_status = 'available', updated_at = now()
    WHERE id = a.driver_id;
    refreshed := public.ep_refresh_open_offers_for_driver(a.driver_id);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'order_id', oid,
    'active_left', left_active,
    'offers', refreshed
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ep_confirm_delivery(UUID) TO authenticated, service_role;
