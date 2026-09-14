-- =============================================================================
-- Cupo máx 2 pedidos / oferta visible 2 min / reintento 3 min si sigue Nuevo
-- Ejecutar UNA vez. Si aún no corriste fix-driver-offer-rules-v2.sql, córrelo antes
-- (o este script recrea expire/cancel mínimos abajo).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.ep_expire_pending_offers()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n INT;
BEGIN
  UPDATE public.ep_delivery_offers
  SET status = 'expired', responded_at = COALESCE(responded_at, now())
  WHERE status = 'pending' AND expires_at <= now();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

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
  SELECT id INTO jid FROM public.ep_delivery_jobs WHERE source_order_id = p_order_id LIMIT 1;
  IF jid IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'cancelled', 0);
  END IF;
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
  WHERE id = jid AND assigned_driver_id IS NULL;
  RETURN jsonb_build_object('ok', true, 'cancelled', n, 'job_id', jid);
END;
$$;

GRANT EXECUTE ON FUNCTION public.ep_expire_pending_offers() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ep_cancel_open_driver_offers_for_order(TEXT) TO authenticated, service_role;

-- TTL oferta = 120 segundos (2 minutos)
ALTER TABLE public.ep_dispatch_settings
  ALTER COLUMN offer_ttl_seconds SET DEFAULT 120;

UPDATE public.ep_dispatch_settings
SET offer_ttl_seconds = 120;

ALTER TABLE public.ep_dispatch_settings
  ALTER COLUMN max_orders_per_driver SET DEFAULT 2;

UPDATE public.ep_dispatch_settings
SET max_orders_per_driver = 2;

ALTER TABLE public.ep_dispatch_settings
  ADD COLUMN IF NOT EXISTS retry_after_seconds INTEGER NOT NULL DEFAULT 180;

UPDATE public.ep_dispatch_settings
SET retry_after_seconds = 180
WHERE retry_after_seconds IS NULL OR retry_after_seconds < 60;

-- Cupo repartidor = 2
ALTER TABLE public.ep_driver_profiles
  ALTER COLUMN max_orders SET DEFAULT 2;

UPDATE public.ep_driver_profiles
SET max_orders = 2
WHERE max_orders IS NULL OR max_orders > 2;

ALTER TABLE public.branches
  ALTER COLUMN max_orders_per_driver SET DEFAULT 2;

UPDATE public.branches
SET max_orders_per_driver = 2
WHERE max_orders_per_driver IS NULL OR max_orders_per_driver > 2;

-- Elegibilidad: cupo < 2 y sin pedidos ya recogidos (to_customer)
CREATE OR REPLACE FUNCTION public.ep_driver_can_receive_offers(p_driver_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max INT;
  v_active INT;
  v_post_pickup INT;
  v_status TEXT;
BEGIN
  SELECT COALESCE(max_orders, 2), operational_status
  INTO v_max, v_status
  FROM ep_driver_profiles WHERE id = p_driver_id;

  IF NOT FOUND THEN RETURN false; END IF;
  IF v_status IN ('offline', 'blocked', 'paused', 'location_unavailable') THEN
    RETURN false;
  END IF;

  -- Solo disponibles / hacia sucursal / con cupo (sin delivery en curso post-recojo)
  IF v_status NOT IN ('available', 'heading_to_branch', 'carrying_orders', 'offered') THEN
    RETURN false;
  END IF;

  SELECT COUNT(*) INTO v_active
  FROM ep_delivery_assignments
  WHERE driver_id = p_driver_id AND status = 'active';

  IF v_active >= v_max THEN RETURN false; END IF;

  -- Si ya recogió algún pedido (hacia cliente), no más ofertas hasta entregar
  SELECT COUNT(*) INTO v_post_pickup
  FROM ep_delivery_assignments
  WHERE driver_id = p_driver_id
    AND status = 'active'
    AND phase IN ('to_customer', 'done');

  IF v_post_pickup > 0 THEN RETURN false; END IF;

  RETURN true;
END;
$$;

-- Ofertar con TTL 120s por defecto
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
  ttl := COALESCE(settings.offer_ttl_seconds, 120);

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

-- Aceptar: cupo máx 2
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

  IF NOT public.ep_driver_can_receive_offers(did) THEN
    RAISE EXCEPTION 'Ya tienes el máximo de 2 pedidos o ya recogiste pedidos en curso';
  END IF;

  SELECT * INTO off FROM ep_delivery_offers WHERE id = p_offer_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Oferta no encontrada'; END IF;
  IF off.driver_id <> did THEN RAISE EXCEPTION 'Oferta de otro repartidor'; END IF;
  IF off.status <> 'pending' THEN RAISE EXCEPTION 'Oferta ya no disponible'; END IF;
  IF off.expires_at < now() THEN
    UPDATE ep_delivery_offers SET status = 'expired' WHERE id = p_offer_id;
    RAISE EXCEPTION 'Oferta expirada';
  END IF;

  lock_key := hashtext(off.job_id::text);
  PERFORM pg_advisory_xact_lock(lock_key);

  IF EXISTS (
    SELECT 1 FROM ep_delivery_assignments
    WHERE job_id = off.job_id AND status = 'active'
  ) THEN
    UPDATE ep_delivery_offers SET status = 'taken_by_other', responded_at = now() WHERE id = p_offer_id;
    RAISE EXCEPTION 'Pedido tomado por otro repartidor';
  END IF;

  UPDATE ep_delivery_offers SET status = 'accepted', responded_at = now() WHERE id = p_offer_id;
  UPDATE ep_delivery_offers
  SET status = 'taken_by_other', responded_at = now()
  WHERE job_id = off.job_id AND id <> p_offer_id AND status = 'pending';

  INSERT INTO ep_delivery_assignments (job_id, driver_id, status, phase, driver_fee)
  VALUES (off.job_id, did, 'active', 'to_store', off.offered_fee);

  UPDATE ep_delivery_jobs
  SET status = 'assigned',
      assigned_driver_id = did,
      assigned_at = now(),
      updated_at = now()
  WHERE id = off.job_id;

  SELECT COALESCE(max_orders, 2) INTO v_max FROM ep_driver_profiles WHERE id = did;
  SELECT COUNT(*) INTO v_active
  FROM ep_delivery_assignments WHERE driver_id = did AND status = 'active';
  SELECT COUNT(*) INTO v_post_pickup
  FROM ep_delivery_assignments
  WHERE driver_id = did AND status = 'active' AND phase IN ('to_customer', 'done');

  IF v_active < v_max AND v_post_pickup = 0 THEN
    UPDATE ep_driver_profiles
    SET operational_status = 'available', updated_at = now()
    WHERE id = did;
  ELSE
    UPDATE ep_driver_profiles
    SET operational_status = 'heading_to_branch', updated_at = now()
    WHERE id = did;
  END IF;

  UPDATE pedidos
  SET estado = 'en_delivery'
  WHERE id = (SELECT source_order_id FROM ep_delivery_jobs WHERE id = off.job_id)
    AND estado NOT IN ('entregado', 'cancelado');

  RETURN jsonb_build_object('ok', true, 'active', v_active, 'max', v_max);
END;
$$;

-- Reintento 3 min solo si pendiente (incluye TTL 120)
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

    ttl := COALESCE(settings.offer_ttl_seconds, 120);
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

GRANT EXECUTE ON FUNCTION public.ep_driver_can_receive_offers(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ep_start_driver_search(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ep_accept_delivery_offer(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ep_retry_stale_driver_searches(INT) TO authenticated, service_role;
