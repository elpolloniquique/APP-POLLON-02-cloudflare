-- =============================================================================
-- PEDIDOS EN TIEMPO REAL — configuración Supabase
-- Ejecutar en SQL Editor → Run → luego Database → Replication (verificar pedidos)
-- =============================================================================

-- 1) Activar Realtime en la tabla pedidos
ALTER TABLE public.pedidos REPLICA IDENTITY FULL;

DO $rt$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.pedidos;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN OTHERS THEN
    RAISE NOTICE 'publication pedidos: %', SQLERRM;
END
$rt$;

-- 2) order_status_history (seguimiento cliente)
DO $rt2$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.order_status_history;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN OTHERS THEN NULL;
END
$rt2$;

-- 3) RLS: clientes crean pedidos; staff lee y actualiza todos
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pedidos_public_insert ON public.pedidos;
CREATE POLICY pedidos_public_insert ON public.pedidos
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS pedidos_anon_select ON public.pedidos;
CREATE POLICY pedidos_anon_select ON public.pedidos
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS pedidos_auth_update ON public.pedidos;
CREATE POLICY pedidos_auth_update ON public.pedidos
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS pedidos_staff_all ON public.pedidos;
CREATE POLICY pedidos_staff_all ON public.pedidos
  FOR ALL
  TO authenticated
  USING (
    public.auth_user_role() IN ('super_admin', 'admin_sucursal', 'cajera', 'cocina', 'delivery')
  )
  WITH CHECK (
    public.auth_user_role() IN ('super_admin', 'admin_sucursal', 'cajera', 'cocina', 'delivery')
  );

-- 4) Detalle pedidos
ALTER TABLE public.detalle_pedidos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS detalle_public_insert ON public.detalle_pedidos;
CREATE POLICY detalle_public_insert ON public.detalle_pedidos
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS detalle_auth_read ON public.detalle_pedidos;
CREATE POLICY detalle_auth_read ON public.detalle_pedidos
  FOR SELECT
  USING (true);

-- 5) Verificación
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename IN ('pedidos', 'order_status_history');

-- Columnas necesarias para checkout (branch_id, no sucursal_id)
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

SELECT COUNT(*)::int AS pedidos_en_bd FROM public.pedidos;
