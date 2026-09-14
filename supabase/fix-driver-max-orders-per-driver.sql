-- =============================================================================
-- Cupo por repartidor (admin): 2 | 3 | 4
-- Reglas:
--   · Puede aceptar hasta max_orders mientras NO haya recogido nada (to_store / at_store)
--   · Al primer "pedido recogido" (to_customer): 0 ofertas nuevas hasta entregar TODO
--   · Solo admin/staff cambia max_orders (el repartidor no puede auto-subirse el cupo)
-- Idempotente. No DROP de tablas.
-- =============================================================================

-- Rango permitido (sigue 1–5 en CHECK; operación usa 2–4 desde el admin)
DO $$
BEGIN
  ALTER TABLE public.ep_driver_profiles
    DROP CONSTRAINT IF EXISTS ep_driver_profiles_max_orders_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE public.ep_driver_profiles
  DROP CONSTRAINT IF EXISTS ep_driver_profiles_max_orders_check;

ALTER TABLE public.ep_driver_profiles
  ADD CONSTRAINT ep_driver_profiles_max_orders_check
  CHECK (max_orders BETWEEN 1 AND 5);

ALTER TABLE public.ep_driver_profiles
  ALTER COLUMN max_orders SET DEFAULT 2;

UPDATE public.ep_driver_profiles
SET max_orders = 2
WHERE max_orders IS NULL OR max_orders < 1;

-- ── El repartidor no puede cambiar su propio cupo ───────────────────────────
CREATE OR REPLACE FUNCTION public.ep_guard_driver_max_orders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.max_orders IS DISTINCT FROM OLD.max_orders THEN
    IF NOT (public.ep_is_dispatch_staff() OR public.ep_is_super_admin()) THEN
      NEW.max_orders := OLD.max_orders;
    END IF;
    IF NEW.max_orders < 1 THEN NEW.max_orders := 1; END IF;
    IF NEW.max_orders > 5 THEN NEW.max_orders := 5; END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ep_guard_driver_max_orders ON public.ep_driver_profiles;
CREATE TRIGGER trg_ep_guard_driver_max_orders
  BEFORE UPDATE ON public.ep_driver_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.ep_guard_driver_max_orders();

-- ── Elegibilidad de ofertas ─────────────────────────────────────────────────
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

  -- Tras recojo queda "delivering": no ofertas hasta entregar todos
  IF v_status IN ('offline', 'blocked', 'paused', 'location_unavailable', 'delivering') THEN
    RETURN false;
  END IF;

  IF v_status NOT IN ('available', 'heading_to_branch', 'carrying_orders', 'offered', 'at_store') THEN
    RETURN false;
  END IF;

  SELECT COUNT(*) INTO v_active
  FROM ep_delivery_assignments
  WHERE driver_id = p_driver_id AND status = 'active';

  IF v_active >= GREATEST(COALESCE(v_max, 2), 1) THEN
    RETURN false;
  END IF;

  -- Cualquier pedido ya recogido (en camino al cliente) bloquea nuevas ofertas
  SELECT COUNT(*) INTO v_post_pickup
  FROM ep_delivery_assignments
  WHERE driver_id = p_driver_id
    AND status = 'active'
    AND phase IN ('to_customer', 'done');

  IF v_post_pickup > 0 THEN RETURN false; END IF;

  RETURN true;
END;
$$;

-- ── Aceptar oferta respetando cupo del perfil ───────────────────────────────
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

  SELECT COALESCE(max_orders, 2) INTO v_max FROM ep_driver_profiles WHERE id = did;

  IF NOT public.ep_driver_can_receive_offers(did) THEN
    RAISE EXCEPTION 'Ya tienes el máximo de % pedidos o ya recogiste pedidos en curso. Entrega todos antes de aceptar más.', v_max;
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

  -- Revalidar cupo bajo lock
  SELECT COUNT(*) INTO v_active
  FROM ep_delivery_assignments WHERE driver_id = did AND status = 'active';
  SELECT COUNT(*) INTO v_post_pickup
  FROM ep_delivery_assignments
  WHERE driver_id = did AND status = 'active' AND phase IN ('to_customer', 'done');

  IF v_post_pickup > 0 THEN
    RAISE EXCEPTION 'Ya recogiste pedidos. Debes entregar todos antes de aceptar más.';
  END IF;
  IF v_active >= v_max THEN
    RAISE EXCEPTION 'Cupo completo: máximo % pedidos.', v_max;
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

  SELECT COUNT(*) INTO v_active
  FROM ep_delivery_assignments WHERE driver_id = did AND status = 'active';

  IF v_active < v_max THEN
    UPDATE ep_driver_profiles
    SET operational_status = 'available', updated_at = now()
    WHERE id = did;
  ELSE
    UPDATE ep_driver_profiles
    SET operational_status = 'heading_to_branch', updated_at = now()
    WHERE id = did;
  END IF;

  RETURN jsonb_build_object('ok', true, 'active', v_active, 'max', v_max);
END;
$$;

-- ── Recojo: bloquear ofertas de inmediato ───────────────────────────────────
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
  oid TEXT;
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
  WHERE id = a.job_id
  RETURNING source_order_id INTO oid;

  UPDATE ep_driver_profiles
  SET operational_status = 'delivering', updated_at = now()
  WHERE id = a.driver_id;

  -- Corta cualquier oferta pendiente (ya no puede aceptar más)
  UPDATE ep_delivery_offers
  SET status = 'expired', responded_at = now()
  WHERE driver_id = a.driver_id AND status = 'pending';

  IF oid IS NOT NULL THEN
    UPDATE pedidos
    SET
      estado = 'en_delivery',
      datos_json = COALESCE(datos_json, '{}'::jsonb)
        || jsonb_build_object('picked_up_at', to_jsonb(now()))
    WHERE id = oid
      AND estado NOT IN ('entregado', 'cancelado');
  END IF;

  RETURN jsonb_build_object('ok', true, 'driver_id', a.driver_id, 'order_id', oid);
END;
$$;

-- ── Entrega: vuelve a recibir ofertas solo si 0 activos ─────────────────────
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

  IF left_active = 0 THEN
    UPDATE ep_driver_profiles
    SET operational_status = 'available', updated_at = now()
    WHERE id = a.driver_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'order_id', oid, 'active_left', left_active);
END;
$$;

GRANT EXECUTE ON FUNCTION public.ep_driver_can_receive_offers(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ep_accept_delivery_offer(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ep_confirm_pickup(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ep_confirm_delivery(UUID) TO authenticated;

COMMENT ON COLUMN public.ep_driver_profiles.max_orders IS
  'Cupo simultáneo (admin). Ofertas solo pre-recojo; al pickup se cortan hasta entregar todos.';

SELECT 'OK: cupo por repartidor 2-4 + bloqueo post-recojo' AS resultado;
