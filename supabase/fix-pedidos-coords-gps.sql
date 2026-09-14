-- =============================================================================
-- FIX: ep_upsert_job_from_pedido lee cliente_lat/lng de columnas nativas
-- Ejecutar UNA VEZ en Supabase SQL Editor
-- =============================================================================

-- 1) Columnas GPS en pedidos (idempotente)
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS cliente_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS cliente_lng DOUBLE PRECISION;

-- 2) RPC actualizado para leer de columnas y fallback a datos_json
CREATE OR REPLACE FUNCTION public.ep_upsert_job_from_pedido(p_order_id TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  jid UUID;
  fee INTEGER;
  datos JSONB;
  v_lat DOUBLE PRECISION;
  v_lng DOUBLE PRECISION;
BEGIN
  SELECT * INTO r FROM pedidos WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido no encontrado: %', p_order_id;
  END IF;

  IF COALESCE(r.tipo_entrega, 'delivery') <> 'delivery' THEN
    RETURN NULL;
  END IF;

  datos := COALESCE(r.datos_json, '{}'::jsonb);
  fee   := COALESCE((datos->>'deliveryFee')::INTEGER, 0);

  -- Coordenadas: primero columnas nativas, fallback a datos_json
  v_lat := COALESCE(
    r.cliente_lat,
    NULLIF(datos->'customer'->>'addressLat', '')::DOUBLE PRECISION,
    NULLIF(datos->>'customerLat', '')::DOUBLE PRECISION
  );
  v_lng := COALESCE(
    r.cliente_lng,
    NULLIF(datos->'customer'->>'addressLng', '')::DOUBLE PRECISION,
    NULLIF(datos->>'customerLng', '')::DOUBLE PRECISION
  );

  INSERT INTO ep_delivery_jobs (
    source_order_id, branch_id, ticket_code, status,
    customer_name, customer_phone, customer_address,
    customer_lat, customer_lng, order_total, delivery_fee,
    payment_method, notes
  ) VALUES (
    r.id,
    r.branch_id,
    COALESCE(r.codigo_pedido, ''),
    CASE
      WHEN r.estado IN ('listo', 'preparando', 'confirmado', 'en_cocina') THEN 'ready_for_dispatch'
      WHEN r.estado = 'en_delivery'  THEN 'delivering'
      WHEN r.estado = 'entregado'    THEN 'delivered'
      WHEN r.estado = 'cancelado'    THEN 'cancelled'
      ELSE 'pending_prep'
    END,
    COALESCE(r.cliente_nombre, ''),
    COALESCE(r.cliente_telefono, ''),
    COALESCE(r.cliente_direccion, ''),
    v_lat,
    v_lng,
    COALESCE(r.total, 0)::INTEGER,
    fee,
    COALESCE(r.metodo_pago, ''),
    COALESCE(r.observaciones, '')
  )
  ON CONFLICT (source_order_id) DO UPDATE SET
    branch_id        = EXCLUDED.branch_id,
    ticket_code      = EXCLUDED.ticket_code,
    customer_name    = EXCLUDED.customer_name,
    customer_phone   = EXCLUDED.customer_phone,
    customer_address = EXCLUDED.customer_address,
    customer_lat     = EXCLUDED.customer_lat,
    customer_lng     = EXCLUDED.customer_lng,
    order_total      = EXCLUDED.order_total,
    delivery_fee     = EXCLUDED.delivery_fee,
    payment_method   = EXCLUDED.payment_method,
    notes            = EXCLUDED.notes,
    updated_at       = now()
  RETURNING id INTO jid;

  RETURN jid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ep_upsert_job_from_pedido(TEXT) TO authenticated;

SELECT 'OK: coordenadas GPS del cliente ya se guardan en pedidos y delivery_jobs' AS resultado;
