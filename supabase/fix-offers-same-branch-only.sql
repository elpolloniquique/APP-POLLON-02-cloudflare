-- =============================================================================
-- Pedido de Iquique → solo repartidores de Iquique.
-- Pedido de Alto Hospicio → solo repartidores de Alto Hospicio.
-- Ejecutar UNA vez en el SQL Editor de Supabase.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.ep_driver_matches_job_branch(p_driver_id UUID, p_job_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  job_branch UUID;
  drv_branch UUID;
BEGIN
  SELECT COALESCE(j.branch_id, p.branch_id)
  INTO job_branch
  FROM public.ep_delivery_jobs j
  LEFT JOIN public.pedidos p ON p.id::text = j.source_order_id
  WHERE j.id = p_job_id;

  SELECT COALESCE(d.preferred_branch_id, pr.branch_id)
  INTO drv_branch
  FROM public.ep_driver_profiles d
  LEFT JOIN public.profiles pr ON pr.id = d.profile_id
  WHERE d.id = p_driver_id;

  IF job_branch IS NULL OR drv_branch IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN job_branch = drv_branch;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ep_driver_matches_job_branch(UUID, UUID) TO authenticated, service_role;

-- Cierra ofertas pending que ya cruzaron de sucursal
UPDATE public.ep_delivery_offers o
SET status = 'expired', responded_at = now()
WHERE o.status = 'pending'
  AND NOT public.ep_driver_matches_job_branch(o.driver_id, o.job_id);

-- Rellena branch_id del job si el pedido sí lo tiene
UPDATE public.ep_delivery_jobs j
SET branch_id = p.branch_id
FROM public.pedidos p
WHERE j.branch_id IS NULL
  AND p.id::text = j.source_order_id
  AND p.branch_id IS NOT NULL;

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
  online_n INT := 0;
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

  IF job.branch_id IS NULL AND job.source_order_id IS NOT NULL THEN
    SELECT p.branch_id INTO job.branch_id
    FROM public.pedidos p
    WHERE p.id::text = job.source_order_id
    LIMIT 1;
    IF job.branch_id IS NOT NULL THEN
      UPDATE ep_delivery_jobs SET branch_id = job.branch_id WHERE id = job.id AND branch_id IS NULL;
    END IF;
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

  ttl := GREATEST(86400, COALESCE(settings.offer_ttl_seconds, 86400));
  IF ttl > 604800 THEN ttl := 604800; END IF;

  UPDATE ep_delivery_jobs
  SET status = 'searching_driver', offered_at = now(), updated_at = now()
  WHERE id = p_job_id;

  FOR drv IN
    SELECT d.id, COALESCE(d.preferred_branch_id, pr.branch_id) AS preferred_branch_id
    FROM ep_driver_profiles d
    LEFT JOIN profiles pr ON pr.id = d.profile_id
    WHERE d.admin_status = 'approved'
      AND (
        d.operational_status IN ('available', 'heading_to_branch', 'carrying_orders', 'offered', 'delivering')
        OR EXISTS (SELECT 1 FROM ep_driver_push_subscriptions s WHERE s.driver_id = d.id)
        OR EXISTS (SELECT 1 FROM ep_driver_fcm_tokens t WHERE t.driver_id = d.id)
      )
  LOOP
    online_n := online_n + 1;

    IF job.branch_id IS NULL
       OR drv.preferred_branch_id IS NULL
       OR drv.preferred_branch_id <> job.branch_id THEN
      skipped_branch := skipped_branch + 1;
      CONTINUE;
    END IF;

    IF NOT public.ep_driver_can_receive_offers(drv.id) THEN
      skipped_offers := skipped_offers + 1;
      CONTINUE;
    END IF;

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
    'require_gps', false,
    'online', online_n,
    'gps_ok', offered,
    'skipped_gps', 0,
    'skipped_offers', skipped_offers,
    'skipped_branch', skipped_branch,
    'message', CASE
      WHEN offered > 0 THEN format('Aviso enviado a %s repartidor(es) de esta sucursal.', offered)
      WHEN online_n = 0 THEN 'Ningún repartidor con avisos activos. Que inicie sesión en el pollito y pulse Activar notificaciones.'
      WHEN skipped_branch > 0 THEN 'Hay repartidores, pero de otra sucursal.'
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
    WHERE job_id = job.id AND status = 'pending'
      AND public.ep_driver_matches_job_branch(driver_id, job.id);

    UPDATE public.ep_delivery_offers
    SET status = 'expired', responded_at = now()
    WHERE job_id = job.id AND status = 'pending'
      AND NOT public.ep_driver_matches_job_branch(driver_id, job.id);

    total_retried := total_retried + 1;
    job_ids := array_append(job_ids, job.id);
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
        WHERE o.job_id = j.id AND o.status = 'pending'
      )
  LOOP
    IF job.branch_id IS NULL THEN
      SELECT p.branch_id INTO job.branch_id FROM public.pedidos p WHERE p.id::text = job.source_order_id LIMIT 1;
      IF job.branch_id IS NOT NULL THEN
        UPDATE ep_delivery_jobs SET branch_id = job.branch_id WHERE id = job.id AND branch_id IS NULL;
      END IF;
    END IF;

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
      LEFT JOIN public.profiles pr ON pr.id = d.profile_id
      WHERE d.admin_status = 'approved'
        AND job.branch_id IS NOT NULL
        AND COALESCE(d.preferred_branch_id, pr.branch_id) = job.branch_id
        AND public.ep_driver_can_receive_offers(d.id)
        AND (
          d.operational_status IN ('available', 'heading_to_branch', 'carrying_orders', 'offered', 'delivering')
          OR EXISTS (SELECT 1 FROM ep_driver_push_subscriptions s WHERE s.driver_id = d.id)
          OR EXISTS (SELECT 1 FROM ep_driver_fcm_tokens t WHERE t.driver_id = d.id)
        )
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
    SELECT j.id, COALESCE(j.branch_id, p.branch_id) AS branch_id, j.delivery_fee, j.status
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
    IF NOT public.ep_driver_matches_job_branch(p_driver_id, job.id) THEN
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

GRANT EXECUTE ON FUNCTION public.ep_refresh_open_offers_for_driver(UUID) TO service_role;

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
  v_active INT;
  v_max INT;
  v_post_pickup INT;
BEGIN
  did := public.ep_my_driver_id();
  IF did IS NULL THEN RAISE EXCEPTION 'No eres repartidor'; END IF;

  SELECT GREATEST(COALESCE(max_orders, 2), 1)
  INTO v_max
  FROM public.ep_driver_profiles
  WHERE id = did;

  IF NOT public.ep_driver_can_receive_offers(did) THEN
    RAISE EXCEPTION 'Ya tienes el máximo de % pedidos o ya recogiste pedidos en curso. Entrega todos antes de aceptar más.', v_max;
  END IF;

  SELECT * INTO off FROM public.ep_delivery_offers WHERE id = p_offer_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Oferta no encontrada'; END IF;
  IF off.driver_id <> did THEN RAISE EXCEPTION 'Oferta de otro repartidor'; END IF;
  IF off.status <> 'pending' THEN RAISE EXCEPTION 'Oferta ya no disponible'; END IF;

  IF NOT public.ep_driver_matches_job_branch(did, off.job_id) THEN
    UPDATE public.ep_delivery_offers
    SET status = 'expired', responded_at = now()
    WHERE id = p_offer_id;
    RAISE EXCEPTION 'Este pedido es de otra sucursal';
  END IF;

  IF off.expires_at IS NOT NULL AND off.expires_at < now() THEN
    UPDATE public.ep_delivery_offers
    SET expires_at = now() + interval '24 hours'
    WHERE id = p_offer_id;
  END IF;

  lock_key := hashtext(off.job_id::text);
  PERFORM pg_advisory_xact_lock(lock_key);

  IF EXISTS (
    SELECT 1 FROM public.ep_delivery_assignments
    WHERE job_id = off.job_id AND status = 'active'
  ) THEN
    UPDATE public.ep_delivery_offers SET status = 'taken_by_other', responded_at = now() WHERE id = p_offer_id;
    RAISE EXCEPTION 'Pedido tomado por otro repartidor';
  END IF;

  SELECT COUNT(*) INTO v_active
  FROM public.ep_delivery_assignments WHERE driver_id = did AND status = 'active';
  SELECT COUNT(*) INTO v_post_pickup
  FROM public.ep_delivery_assignments
  WHERE driver_id = did AND status = 'active' AND phase IN ('to_customer', 'done');

  IF v_post_pickup > 0 THEN
    RAISE EXCEPTION 'Ya recogiste pedidos. Debes entregar todos antes de aceptar más.';
  END IF;
  IF v_active >= v_max THEN
    RAISE EXCEPTION 'Cupo completo: máximo % pedidos para tu cuenta.', v_max;
  END IF;

  UPDATE public.ep_delivery_offers SET status = 'accepted', responded_at = now() WHERE id = p_offer_id;
  UPDATE public.ep_delivery_offers
  SET status = 'taken_by_other', responded_at = now()
  WHERE job_id = off.job_id AND id <> p_offer_id AND status = 'pending';

  INSERT INTO public.ep_delivery_assignments (job_id, driver_id, status, phase, driver_fee)
  VALUES (off.job_id, did, 'active', 'to_store', off.offered_fee);

  UPDATE public.ep_delivery_jobs
  SET status = 'assigned',
      assigned_driver_id = did,
      assigned_at = now(),
      updated_at = now()
  WHERE id = off.job_id;

  SELECT COUNT(*) INTO v_active
  FROM public.ep_delivery_assignments WHERE driver_id = did AND status = 'active';

  IF v_active < v_max THEN
    UPDATE public.ep_driver_profiles
    SET operational_status = 'available', updated_at = now()
    WHERE id = did;
  ELSE
    UPDATE public.ep_driver_profiles
    SET operational_status = 'heading_to_branch', updated_at = now()
    WHERE id = did;
  END IF;

  RETURN jsonb_build_object('ok', true, 'active', v_active, 'max', v_max);
END;
$$;

GRANT EXECUTE ON FUNCTION public.ep_accept_delivery_offer(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';

SELECT 'OK: ofertas solo de la misma sucursal' AS resultado;
