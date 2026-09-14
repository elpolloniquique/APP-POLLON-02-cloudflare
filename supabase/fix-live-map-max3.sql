-- =============================================================================
-- FIX Live Map: max 3 pedidos, ofertas pre-pickup, bloqueo post-pickup
-- Ejecutar UNA VEZ en Supabase SQL Editor
-- =============================================================================

ALTER TABLE public.ep_driver_profiles
  ALTER COLUMN max_orders SET DEFAULT 3;

ALTER TABLE public.ep_dispatch_settings
  ALTER COLUMN max_orders_per_driver SET DEFAULT 3;

ALTER TABLE public.branches
  ALTER COLUMN max_orders_per_driver SET DEFAULT 3;

UPDATE public.ep_driver_profiles
SET max_orders = 3
WHERE max_orders IS NULL OR max_orders < 3;

UPDATE public.ep_dispatch_settings
SET max_orders_per_driver = 3
WHERE max_orders_per_driver IS NULL OR max_orders_per_driver < 3;

-- Helper: ¿el driver aún puede recibir ofertas? (pre-pickup + cupo)
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
  SELECT COALESCE(max_orders, 3), operational_status
  INTO v_max, v_status
  FROM ep_driver_profiles WHERE id = p_driver_id;

  IF NOT FOUND THEN RETURN false; END IF;
  IF v_status IN ('offline', 'blocked', 'paused', 'location_unavailable') THEN
    RETURN false;
  END IF;

  SELECT COUNT(*) INTO v_active
  FROM ep_delivery_assignments
  WHERE driver_id = p_driver_id AND status = 'active';

  IF v_active >= v_max THEN RETURN false; END IF;

  -- Si ya recogió algún pedido (to_customer), no más ofertas
  SELECT COUNT(*) INTO v_post_pickup
  FROM ep_delivery_assignments
  WHERE driver_id = p_driver_id
    AND status = 'active'
    AND phase IN ('to_customer', 'done');

  IF v_post_pickup > 0 THEN RETURN false; END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ep_driver_can_receive_offers(UUID) TO authenticated;

-- Ofertar solo a elegibles (available O heading_to_branch/carrying con cupo y sin pickup)
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
  ttl := COALESCE(settings.offer_ttl_seconds, 60);

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

  RETURN jsonb_build_object('ok', true, 'offered', offered);
END;
$$;

-- Aceptar: mantener elegible si aún hay cupo y no hay pickup
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
    RAISE EXCEPTION 'Ya tienes el máximo de pedidos o ya recogiste pedidos en curso';
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

  SELECT COALESCE(max_orders, 3) INTO v_max FROM ep_driver_profiles WHERE id = did;
  SELECT COUNT(*) INTO v_active
  FROM ep_delivery_assignments WHERE driver_id = did AND status = 'active';
  SELECT COUNT(*) INTO v_post_pickup
  FROM ep_delivery_assignments
  WHERE driver_id = did AND status = 'active' AND phase IN ('to_customer', 'done');

  -- Si aún puede recibir más ofertas → available (o carrying); si cupo lleno → heading_to_branch
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

  RETURN jsonb_build_object('ok', true, 'job_id', off.job_id, 'driver_id', did, 'active_count', v_active);
END;
$$;

-- Pickup: bloquea nuevas ofertas (delivering)
CREATE OR REPLACE FUNCTION public.ep_confirm_pickup(p_assignment_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a RECORD;
  did UUID;
  is_staff BOOLEAN;
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
  SET phase = 'to_customer', picked_up_at = now(), updated_at = now()
  WHERE id = p_assignment_id;

  UPDATE ep_delivery_jobs
  SET status = 'picked_up', picked_up_at = now(), updated_at = now()
  WHERE id = a.job_id;

  -- Bloquear ofertas hasta entregar todo
  UPDATE ep_driver_profiles
  SET operational_status = 'delivering', updated_at = now()
  WHERE id = a.driver_id;

  -- Expirar ofertas pendientes del driver
  UPDATE ep_delivery_offers
  SET status = 'expired', responded_at = now()
  WHERE driver_id = a.driver_id AND status = 'pending';

  RETURN jsonb_build_object('ok', true, 'driver_id', a.driver_id);
END;
$$;

-- Entrega: available solo si 0 activos
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

  UPDATE pedidos SET estado = 'entregado', entregado_en = now() WHERE id = oid;

  IF NOT EXISTS (
    SELECT 1 FROM ep_delivery_assignments WHERE driver_id = a.driver_id AND status = 'active'
  ) THEN
    UPDATE ep_driver_profiles SET operational_status = 'available', updated_at = now() WHERE id = a.driver_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'order_id', oid);
END;
$$;

GRANT EXECUTE ON FUNCTION public.ep_start_driver_search(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ep_accept_delivery_offer(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ep_confirm_pickup(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ep_confirm_delivery(UUID) TO authenticated;

SELECT 'OK: live map max 3 + pre-pickup offers' AS resultado;
