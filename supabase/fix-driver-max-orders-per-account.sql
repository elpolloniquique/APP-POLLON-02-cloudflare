-- =============================================================================
-- Cupo máximo POR REPARTIDOR (por su cuenta / correo)
-- Ejecutar UNA vez en SQL Editor.
--
-- Si en Admin → Repartidores le pones 3 a un correo, SOLO ese perfil puede
-- aceptar 3 pedidos a la vez. No es un tope global de la sucursal.
-- =============================================================================

-- Rango operativo 2–4 (el CHECK de tabla puede seguir 1–5)
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

-- El repartidor no puede cambiar su propio cupo.
-- Admin / staff sí, y el cambio queda en ESA fila (ese correo).
CREATE OR REPLACE FUNCTION public.ep_guard_driver_max_orders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.max_orders IS DISTINCT FROM OLD.max_orders THEN
    IF public.ep_is_driver_role()
       AND NOT public.ep_is_dispatch_staff()
       AND NOT public.ep_is_super_admin() THEN
      NEW.max_orders := OLD.max_orders;
    ELSE
      IF NEW.max_orders < 2 THEN NEW.max_orders := 2; END IF;
      IF NEW.max_orders > 4 THEN NEW.max_orders := 4; END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ep_guard_driver_max_orders ON public.ep_driver_profiles;
CREATE TRIGGER trg_ep_guard_driver_max_orders
  BEFORE UPDATE ON public.ep_driver_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.ep_guard_driver_max_orders();

-- Admin fija el cupo de UN repartidor (id de ep_driver_profiles)
CREATE OR REPLACE FUNCTION public.ep_admin_set_driver_max_orders(p_driver_id UUID, p_max INT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max INT;
  v_email TEXT;
  v_name TEXT;
BEGIN
  IF NOT (public.ep_is_dispatch_staff() OR public.ep_is_super_admin()) THEN
    RAISE EXCEPTION 'Solo administración puede cambiar el cupo de un repartidor';
  END IF;

  v_max := GREATEST(2, LEAST(4, COALESCE(p_max, 2)));

  UPDATE public.ep_driver_profiles
  SET max_orders = v_max, updated_at = now()
  WHERE id = p_driver_id
  RETURNING max_orders INTO v_max;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Repartidor no encontrado';
  END IF;

  SELECT p.email, COALESCE(p.full_name, p.email)
  INTO v_email, v_name
  FROM public.ep_driver_profiles d
  JOIN public.profiles p ON p.id = d.profile_id
  WHERE d.id = p_driver_id;

  RETURN jsonb_build_object(
    'ok', true,
    'driver_id', p_driver_id,
    'max_orders', v_max,
    'email', v_email,
    'name', v_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ep_admin_set_driver_max_orders(UUID, INT) TO authenticated;

-- Ofertas: usa el max_orders DE ESE repartidor
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
  FROM public.ep_driver_profiles
  WHERE id = p_driver_id;

  IF NOT FOUND THEN RETURN false; END IF;
  v_max := GREATEST(COALESCE(v_max, 2), 1);

  IF v_status IN ('offline', 'blocked', 'paused', 'location_unavailable', 'delivering') THEN
    RETURN false;
  END IF;

  IF v_status NOT IN ('available', 'heading_to_branch', 'carrying_orders', 'offered', 'at_store') THEN
    RETURN false;
  END IF;

  SELECT COUNT(*) INTO v_active
  FROM public.ep_delivery_assignments
  WHERE driver_id = p_driver_id AND status = 'active';

  IF v_active >= v_max THEN
    RETURN false;
  END IF;

  SELECT COUNT(*) INTO v_post_pickup
  FROM public.ep_delivery_assignments
  WHERE driver_id = p_driver_id
    AND status = 'active'
    AND phase IN ('to_customer', 'done');

  IF v_post_pickup > 0 THEN RETURN false; END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ep_driver_can_receive_offers(UUID) TO authenticated;

-- Aceptar: el tope es el de SU perfil, no el de la sucursal
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

COMMENT ON COLUMN public.ep_driver_profiles.max_orders IS
  'Cupo simultáneo de ESTA cuenta de repartidor. Lo define admin en Repartidores. No es global.';

NOTIFY pgrst, 'reload schema';

SELECT 'OK: cupo por cuenta de repartidor (2-4)' AS resultado;
