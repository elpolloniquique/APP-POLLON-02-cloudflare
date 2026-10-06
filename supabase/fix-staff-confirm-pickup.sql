-- Admin / caja / super_admin pueden marcar recojo y entrega
-- aunque su usuario también tenga perfil de repartidor.
-- Antes: si tenías driver_id, buscaba el pedido como si fuera TUYO
-- y fallaba con "Asignación no encontrada" (p. ej. tutacanehuillca).

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
  is_staff := public.ep_is_dispatch_staff() OR public.ep_is_super_admin();

  IF is_staff THEN
    SELECT * INTO a FROM ep_delivery_assignments
    WHERE id = p_assignment_id AND status = 'active';
  ELSIF did IS NOT NULL THEN
    SELECT * INTO a FROM ep_delivery_assignments
    WHERE id = p_assignment_id AND driver_id = did AND status = 'active';
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
  is_staff := public.ep_is_dispatch_staff() OR public.ep_is_super_admin();

  IF is_staff THEN
    SELECT * INTO a FROM ep_delivery_assignments
    WHERE id = p_assignment_id AND status = 'active';
  ELSIF did IS NOT NULL THEN
    SELECT * INTO a FROM ep_delivery_assignments
    WHERE id = p_assignment_id AND driver_id = did AND status = 'active';
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

GRANT EXECUTE ON FUNCTION public.ep_confirm_pickup(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ep_confirm_delivery(UUID) TO authenticated;

SELECT 'OK: admin/caja pueden marcar recojo y entrega aunque también sean repartidor' AS resultado;
