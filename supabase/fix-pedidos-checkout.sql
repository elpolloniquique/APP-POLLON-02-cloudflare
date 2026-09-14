-- =============================================================================
-- FIX COMPLETO CHECKOUT CLIENTE — ejecutar TODO en Supabase SQL Editor → Run
-- Corrige:
--   • "sucursal_id column does not exist" (usa branch_id)
--   • "row-level security policy for table order_status_history"
--   • Pedidos en tiempo real
-- =============================================================================

-- ─── 1) Columnas pedidos (multi-sucursal) ───────────────────────────────────
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pedidos_branch ON public.pedidos(branch_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_customer ON public.pedidos(customer_id);

-- ─── 2) Trigger historial de estados (SECURITY DEFINER = no bloqueado por RLS) ─
CREATE OR REPLACE FUNCTION public.log_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.estado IS DISTINCT FROM NEW.estado THEN
    INSERT INTO public.order_status_history (order_id, status, note)
    VALUES (NEW.id, NEW.estado, 'Cambio automático');
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.order_status_history (order_id, status, note)
    VALUES (NEW.id, COALESCE(NEW.estado, 'pendiente'), 'Pedido creado');
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'log_order_status_change: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pedidos_status_history ON public.pedidos;
CREATE TRIGGER trg_pedidos_status_history
  AFTER INSERT OR UPDATE OF estado ON public.pedidos
  FOR EACH ROW
  EXECUTE FUNCTION public.log_order_status_change();

-- ─── 3) RLS pedidos: clientes anónimos pueden CREAR pedidos ─────────────────
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

-- ─── 4) RLS order_status_history: permitir inserts del trigger + lectura ────
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS order_history_insert ON public.order_status_history;
CREATE POLICY order_history_insert ON public.order_status_history
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS order_history_select_all ON public.order_status_history;
CREATE POLICY order_history_select_all ON public.order_status_history
  FOR SELECT
  USING (true);

-- ─── 5) RLS detalle_pedidos ─────────────────────────────────────────────────
ALTER TABLE public.detalle_pedidos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS detalle_public_insert ON public.detalle_pedidos;
CREATE POLICY detalle_public_insert ON public.detalle_pedidos
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS detalle_auth_read ON public.detalle_pedidos;
CREATE POLICY detalle_auth_read ON public.detalle_pedidos
  FOR SELECT
  USING (true);

-- ─── 6) Realtime pedidos ────────────────────────────────────────────────────
ALTER TABLE public.pedidos REPLICA IDENTITY FULL;

DO $rt$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.pedidos;
EXCEPTION WHEN duplicate_object THEN NULL;
END
$rt$;

-- ─── 7) Verificación ────────────────────────────────────────────────────────
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'pedidos'
  AND column_name IN ('branch_id', 'customer_id')
ORDER BY column_name;

SELECT COUNT(*)::int AS pedidos_totales FROM public.pedidos;
