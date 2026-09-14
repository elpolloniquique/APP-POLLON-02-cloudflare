-- Vincular pedido de invitado a la cuenta del cliente por código de seguimiento
-- Ejecutar en Supabase SQL Editor

CREATE OR REPLACE FUNCTION public.claim_order_by_ticket(
  p_ticket TEXT,
  p_phone TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id UUID;
  v_ticket TEXT;
  v_phone_digits TEXT;
  v_order pedidos%ROWTYPE;
  v_order_phone TEXT;
BEGIN
  v_profile_id := public.auth_user_profile_id();
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión para vincular un pedido';
  END IF;

  -- Normalizar código: quitar # y ceros a la izquierda, luego pad a 6
  v_ticket := regexp_replace(COALESCE(p_ticket, ''), '[^0-9]', '', 'g');
  IF length(v_ticket) = 0 THEN
    RAISE EXCEPTION 'Ingresa un código de seguimiento válido';
  END IF;
  -- Buscar coincidencia flexible (000115 o 115)
  SELECT * INTO v_order
  FROM pedidos
  WHERE regexp_replace(COALESCE(codigo_pedido, ''), '[^0-9]', '', 'g') = v_ticket
     OR ltrim(regexp_replace(COALESCE(codigo_pedido, ''), '[^0-9]', '', 'g'), '0')
        = ltrim(v_ticket, '0')
  ORDER BY creado_en DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No encontramos un pedido con ese código. Revisa el número e intenta de nuevo';
  END IF;

  -- Ya vinculado a esta cuenta
  IF v_order.customer_id = v_profile_id THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_linked', true,
      'order_id', v_order.id,
      'codigo_pedido', v_order.codigo_pedido
    );
  END IF;

  -- Vinculado a otra cuenta
  IF v_order.customer_id IS NOT NULL THEN
    RAISE EXCEPTION 'Este pedido ya está vinculado a otra cuenta';
  END IF;

  -- Verificar teléfono del pedido (seguridad)
  v_phone_digits := regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g');
  v_order_phone := regexp_replace(COALESCE(v_order.cliente_telefono, ''), '[^0-9]', '', 'g');

  IF length(v_order_phone) >= 8 THEN
    IF length(v_phone_digits) < 8 THEN
      RAISE EXCEPTION 'Ingresa el mismo teléfono que usaste al hacer el pedido';
    END IF;
    -- Comparar últimos 8–9 dígitos (Chile)
    IF right(v_order_phone, 8) <> right(v_phone_digits, 8)
       AND right(v_order_phone, 9) <> right(v_phone_digits, 9) THEN
      RAISE EXCEPTION 'El teléfono no coincide con el del pedido. Usa el mismo número del checkout';
    END IF;
  END IF;

  UPDATE pedidos
  SET customer_id = v_profile_id
  WHERE id = v_order.id
    AND customer_id IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se pudo vincular el pedido. Intenta de nuevo';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'already_linked', false,
    'order_id', v_order.id,
    'codigo_pedido', v_order.codigo_pedido
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_order_by_ticket(TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.claim_order_by_ticket IS
  'Permite a un cliente autenticado vincular un pedido de invitado (customer_id null) usando código + teléfono';
