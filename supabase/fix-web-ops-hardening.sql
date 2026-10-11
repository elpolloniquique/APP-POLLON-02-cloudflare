-- =============================================================================
-- El Pollón — Caja/stock en la nube + seguimiento invitado + RLS seguro
-- Ejecutar en Supabase SQL Editor DESPUÉS de que Cloudflare despliegue este commit.
-- No toca GPS, app nativa ni WhatsApp/Bot.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Helpers (idempotentes) ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.auth_user_profile_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM profiles WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.auth_user_branch_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT branch_id FROM profiles WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.ep_my_role()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r TEXT;
BEGIN
  SELECT role INTO r FROM profiles WHERE auth_user_id = auth.uid() LIMIT 1;
  IF r IS NOT NULL AND r <> '' THEN
    RETURN r;
  END IF;
  BEGIN
    SELECT rol INTO r FROM administradores WHERE id = auth.uid() LIMIT 1;
  EXCEPTION
    WHEN undefined_table THEN
      r := NULL;
  END;
  RETURN COALESCE(r, '');
END;
$$;

CREATE OR REPLACE FUNCTION public.ep_is_catalog_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.ep_my_role() IN ('super_admin', 'admin_sucursal', 'administrador');
$$;

GRANT EXECUTE ON FUNCTION public.auth_user_profile_id() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.auth_user_branch_id() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ep_my_role() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ep_is_catalog_admin() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.ep_is_branch_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.ep_my_role() IN (
    'super_admin', 'admin_sucursal', 'administrador',
    'cajera', 'cajero', 'cocina', 'cocinero', 'despachador',
    'admin_repartidores', 'delivery', 'repartidor'
  );
$$;

GRANT EXECUTE ON FUNCTION public.ep_is_branch_staff() TO authenticated, service_role;

-- ── Caja / stock compartidos por sucursal ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ep_caja_sesiones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL,
  abierta BOOLEAN NOT NULL DEFAULT true,
  monto_inicial NUMERIC(12,0) NOT NULL DEFAULT 0,
  monto_cierre NUMERIC(12,0),
  ventas_efectivo NUMERIC(12,0) DEFAULT 0,
  ventas_transferencia NUMERIC(12,0) DEFAULT 0,
  ventas_tarjeta NUMERIC(12,0) DEFAULT 0,
  ventas_total NUMERIC(12,0) DEFAULT 0,
  pedidos_count INT DEFAULT 0,
  apertura_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  cierre_en TIMESTAMPTZ,
  opened_by UUID,
  closed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ep_caja_sesiones_open_branch
  ON public.ep_caja_sesiones (branch_id)
  WHERE abierta;

CREATE TABLE IF NOT EXISTS public.ep_stock_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL,
  nombre TEXT NOT NULL,
  cantidad NUMERIC(12,2) NOT NULL DEFAULT 0,
  minimo NUMERIC(12,2) NOT NULL DEFAULT 5,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ep_stock_items_branch_idx
  ON public.ep_stock_items (branch_id);

ALTER TABLE public.ep_caja_sesiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ep_stock_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ep_caja_staff ON public.ep_caja_sesiones;
CREATE POLICY ep_caja_staff ON public.ep_caja_sesiones
  FOR ALL TO authenticated
  USING (
    public.ep_my_role() = 'super_admin'
    OR (
      public.ep_my_role() IN ('admin_sucursal', 'administrador', 'cajera', 'cajero')
      AND public.auth_user_branch_id() IS NOT NULL
      AND branch_id = public.auth_user_branch_id()
    )
  )
  WITH CHECK (
    public.ep_my_role() = 'super_admin'
    OR (
      public.ep_my_role() IN ('admin_sucursal', 'administrador', 'cajera', 'cajero')
      AND branch_id = public.auth_user_branch_id()
    )
  );

DROP POLICY IF EXISTS ep_stock_staff ON public.ep_stock_items;
CREATE POLICY ep_stock_staff ON public.ep_stock_items
  FOR ALL TO authenticated
  USING (
    public.ep_my_role() = 'super_admin'
    OR (
      public.ep_my_role() IN ('admin_sucursal', 'administrador', 'cajera', 'cajero')
      AND branch_id = public.auth_user_branch_id()
    )
  )
  WITH CHECK (
    public.ep_my_role() = 'super_admin'
    OR (
      public.ep_my_role() IN ('admin_sucursal', 'administrador', 'cajera', 'cajero')
      AND branch_id = public.auth_user_branch_id()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ep_caja_sesiones TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ep_stock_items TO authenticated;
GRANT ALL ON public.ep_caja_sesiones TO service_role;
GRANT ALL ON public.ep_stock_items TO service_role;

-- ── Ticket seguro (checkout ya no necesita leer todos los pedidos) ──────────
CREATE OR REPLACE FUNCTION public.ep_next_pedido_codigo()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last BIGINT;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(COALESCE(codigo_pedido, ''), '[^0-9]', '', 'g'), '')::bigint), 0)
  INTO v_last
  FROM public.pedidos
  WHERE codigo_pedido ~ '^[0-9]+$';
  RETURN lpad((v_last + 1)::text, 6, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.ep_next_pedido_codigo() TO anon, authenticated, service_role;

-- ── Seguimiento invitado (código + teléfono) ────────────────────────────────
CREATE OR REPLACE FUNCTION public.ep_guest_track_order(p_ticket TEXT, p_phone TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket TEXT;
  v_phone TEXT;
  v_order public.pedidos%ROWTYPE;
  v_order_phone TEXT;
  v_hist JSONB;
  v_branch TEXT;
BEGIN
  v_ticket := regexp_replace(COALESCE(p_ticket, ''), '[^0-9]', '', 'g');
  v_phone := regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g');
  IF length(v_ticket) < 3 OR length(v_phone) < 8 THEN
    RAISE EXCEPTION 'Ingresa el código del pedido y el teléfono con el que compraste';
  END IF;

  SELECT * INTO v_order
  FROM public.pedidos
  WHERE regexp_replace(COALESCE(codigo_pedido, ''), '[^0-9]', '', 'g') = v_ticket
     OR ltrim(regexp_replace(COALESCE(codigo_pedido, ''), '[^0-9]', '', 'g'), '0') = ltrim(v_ticket, '0')
  ORDER BY creado_en DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No encontramos un pedido con ese código';
  END IF;

  v_order_phone := regexp_replace(
    COALESCE(v_order.cliente_telefono, v_order.datos_json->'customer'->>'phone', ''),
    '[^0-9]', '', 'g'
  );
  IF length(v_order_phone) < 8
     OR (
       right(v_order_phone, 8) <> right(v_phone, 8)
       AND right(v_order_phone, 9) <> right(v_phone, 9)
     ) THEN
    RAISE EXCEPTION 'El teléfono no coincide con el del pedido';
  END IF;

  SELECT name INTO v_branch FROM public.branches WHERE id = v_order.branch_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'status', h.status,
    'createdAt', h.created_at
  ) ORDER BY h.created_at), '[]'::jsonb)
  INTO v_hist
  FROM public.order_status_history h
  WHERE h.order_id = v_order.id;

  RETURN jsonb_build_object(
    'ok', true,
    'order', jsonb_build_object(
      'id', v_order.id,
      'ticketNumber', v_order.codigo_pedido,
      'estado', v_order.estado,
      'orderType', v_order.tipo_entrega,
      'total', v_order.total,
      'createdAt', v_order.creado_en,
      'items', COALESCE(v_order.datos_json->'items', '[]'::jsonb),
      'branchName', COALESCE(v_branch, '')
    ),
    'history', COALESCE(v_hist, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ep_guest_track_order(TEXT, TEXT) TO anon, authenticated, service_role;

-- ── Más vendidos sin PII ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ep_bestsellers_for_branch(p_branch UUID, p_days INT DEFAULT 7)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from TIMESTAMPTZ;
  v_items JSONB;
BEGIN
  IF p_branch IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;
  v_from := now() - make_interval(days => GREATEST(COALESCE(p_days, 7), 1));

  SELECT COALESCE(jsonb_agg(row_to_json(s)::jsonb), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT
      COALESCE(item->>'name', item->>'nombre', 'Producto') AS name,
      NULLIF(item->>'id', '') AS product_id,
      SUM(COALESCE(NULLIF(item->>'qty', '')::numeric, NULLIF(item->>'quantity', '')::numeric, 1)) AS qty
    FROM public.pedidos p
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.datos_json->'items', '[]'::jsonb)) AS item
    WHERE p.branch_id = p_branch
      AND p.creado_en >= v_from
      AND COALESCE(p.estado, '') <> 'cancelado'
    GROUP BY 1, 2
    ORDER BY qty DESC
    LIMIT 12
  ) s;

  RETURN COALESCE(v_items, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.ep_bestsellers_for_branch(UUID, INT) TO anon, authenticated, service_role;

-- ── Catálogo: el público sigue LEYENDO el menú; solo admin escribe ──────────
DO $$
BEGIN
  IF to_regclass('public.products') IS NOT NULL THEN
    DROP POLICY IF EXISTS products_auth_all ON public.products;
    DROP POLICY IF EXISTS products_staff_write ON public.products;
    DROP POLICY IF EXISTS products_staff_update ON public.products;
    DROP POLICY IF EXISTS products_staff_delete ON public.products;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'products' AND policyname = 'products_public_read'
    ) THEN
      CREATE POLICY products_public_read ON public.products FOR SELECT USING (true);
    END IF;
    CREATE POLICY products_staff_write ON public.products
      FOR INSERT TO authenticated
      WITH CHECK (public.ep_is_catalog_admin());
    CREATE POLICY products_staff_update ON public.products
      FOR UPDATE TO authenticated
      USING (public.ep_is_catalog_admin())
      WITH CHECK (public.ep_is_catalog_admin());
    CREATE POLICY products_staff_delete ON public.products
      FOR DELETE TO authenticated
      USING (public.ep_is_catalog_admin());
  END IF;
  IF to_regclass('public.categories') IS NOT NULL THEN
    DROP POLICY IF EXISTS categories_auth_all ON public.categories;
    DROP POLICY IF EXISTS categories_staff_write ON public.categories;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'categories' AND policyname = 'categories_public_read'
    ) THEN
      CREATE POLICY categories_public_read ON public.categories FOR SELECT USING (true);
    END IF;
    CREATE POLICY categories_staff_write ON public.categories
      FOR ALL TO authenticated
      USING (public.ep_is_catalog_admin())
      WITH CHECK (public.ep_is_catalog_admin());
  END IF;
  IF to_regclass('public.branches') IS NOT NULL THEN
    DROP POLICY IF EXISTS branches_auth_all ON public.branches;
    DROP POLICY IF EXISTS branches_staff_write ON public.branches;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'branches' AND policyname = 'branches_public_read'
    ) THEN
      CREATE POLICY branches_public_read ON public.branches FOR SELECT USING (true);
    END IF;
    CREATE POLICY branches_staff_write ON public.branches
      FOR ALL TO authenticated
      USING (public.ep_is_catalog_admin())
      WITH CHECK (public.ep_is_catalog_admin());
  END IF;
  IF to_regclass('public.settings') IS NOT NULL THEN
    DROP POLICY IF EXISTS settings_auth_all ON public.settings;
    DROP POLICY IF EXISTS settings_staff_write ON public.settings;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'settings' AND policyname = 'settings_public_read'
    ) THEN
      CREATE POLICY settings_public_read ON public.settings FOR SELECT USING (true);
    END IF;
    CREATE POLICY settings_staff_write ON public.settings
      FOR ALL TO authenticated
      USING (public.ep_is_catalog_admin())
      WITH CHECK (public.ep_is_catalog_admin());
  END IF;
END $$;

-- ── Pedidos: checkout puede INSERTAR; ya no puede LEER/EDITAR todo ──────────
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pedidos_anon_select ON public.pedidos;
DROP POLICY IF EXISTS pedidos_auth_update ON public.pedidos;
DROP POLICY IF EXISTS pedidos_staff_all ON public.pedidos;
DROP POLICY IF EXISTS pedidos_staff_select ON public.pedidos;
DROP POLICY IF EXISTS pedidos_customer_select ON public.pedidos;
DROP POLICY IF EXISTS pedidos_staff_update ON public.pedidos;

CREATE POLICY pedidos_staff_select ON public.pedidos
  FOR SELECT TO authenticated
  USING (
    public.ep_my_role() = 'super_admin'
    OR (
      public.ep_is_branch_staff()
      AND public.auth_user_branch_id() IS NOT NULL
      AND branch_id = public.auth_user_branch_id()
    )
    OR customer_id = public.auth_user_profile_id()
  );

CREATE POLICY pedidos_staff_update ON public.pedidos
  FOR UPDATE TO authenticated
  USING (
    public.ep_my_role() = 'super_admin'
    OR (
      public.ep_my_role() IN ('admin_sucursal', 'administrador', 'cajera', 'cajero', 'cocina', 'cocinero', 'despachador')
      AND branch_id = public.auth_user_branch_id()
    )
  )
  WITH CHECK (
    public.ep_my_role() = 'super_admin'
    OR (
      public.ep_my_role() IN ('admin_sucursal', 'administrador', 'cajera', 'cajero', 'cocina', 'cocinero', 'despachador')
      AND branch_id = public.auth_user_branch_id()
    )
  );

-- Historial y detalle: ya no son públicos
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS order_history_select_all ON public.order_status_history;
DROP POLICY IF EXISTS order_history_staff_select ON public.order_status_history;
CREATE POLICY order_history_staff_select ON public.order_status_history
  FOR SELECT TO authenticated
  USING (
    public.ep_is_branch_staff()
    OR EXISTS (
      SELECT 1 FROM public.pedidos p
      WHERE p.id = order_id AND p.customer_id = public.auth_user_profile_id()
    )
  );

ALTER TABLE public.detalle_pedidos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS detalle_auth_read ON public.detalle_pedidos;
DROP POLICY IF EXISTS detalle_staff_select ON public.detalle_pedidos;
CREATE POLICY detalle_staff_select ON public.detalle_pedidos
  FOR SELECT TO authenticated
  USING (
    public.ep_is_branch_staff()
    OR EXISTS (
      SELECT 1 FROM public.pedidos p
      WHERE p.id = detalle_pedidos.pedido_id AND p.customer_id = public.auth_user_profile_id()
    )
  );

COMMENT ON FUNCTION public.ep_guest_track_order(TEXT, TEXT) IS
  'Seguimiento de invitado: código + teléfono. No expone otros pedidos.';
COMMENT ON FUNCTION public.ep_next_pedido_codigo() IS
  'Siguiente código de pedido. Usar en checkout en lugar de SELECT global.';
