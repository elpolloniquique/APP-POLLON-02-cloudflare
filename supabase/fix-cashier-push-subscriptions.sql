-- =============================================================================
-- Web Push para cajeras (bandeja del sistema, solo pedidos nuevos de SU sucursal)
-- Ejecutar en Supabase SQL Editor UNA vez.
-- Reutiliza las mismas claves VAPID que los repartidores. No toca FCM nativo.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.ep_cashier_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ep_cashier_push_subscriptions_endpoint_uq UNIQUE (endpoint)
);

CREATE INDEX IF NOT EXISTS ep_cashier_push_subscriptions_branch_idx
  ON public.ep_cashier_push_subscriptions (branch_id);

CREATE INDEX IF NOT EXISTS ep_cashier_push_subscriptions_profile_idx
  ON public.ep_cashier_push_subscriptions (profile_id);

ALTER TABLE public.ep_cashier_push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ep_cashier_push_select_own ON public.ep_cashier_push_subscriptions;
CREATE POLICY ep_cashier_push_select_own ON public.ep_cashier_push_subscriptions
  FOR SELECT TO authenticated
  USING (profile_id = public.ep_my_profile_id() OR public.ep_is_dispatch_staff());

DROP POLICY IF EXISTS ep_cashier_push_insert_own ON public.ep_cashier_push_subscriptions;
CREATE POLICY ep_cashier_push_insert_own ON public.ep_cashier_push_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (
    profile_id = public.ep_my_profile_id()
    AND branch_id = (
      SELECT p.branch_id FROM public.profiles p WHERE p.id = public.ep_my_profile_id()
    )
  );

DROP POLICY IF EXISTS ep_cashier_push_update_own ON public.ep_cashier_push_subscriptions;
CREATE POLICY ep_cashier_push_update_own ON public.ep_cashier_push_subscriptions
  FOR UPDATE TO authenticated
  USING (profile_id = public.ep_my_profile_id())
  WITH CHECK (
    profile_id = public.ep_my_profile_id()
    AND branch_id = (
      SELECT p.branch_id FROM public.profiles p WHERE p.id = public.ep_my_profile_id()
    )
  );

DROP POLICY IF EXISTS ep_cashier_push_delete_own ON public.ep_cashier_push_subscriptions;
CREATE POLICY ep_cashier_push_delete_own ON public.ep_cashier_push_subscriptions
  FOR DELETE TO authenticated
  USING (profile_id = public.ep_my_profile_id() OR public.ep_is_dispatch_staff());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ep_cashier_push_subscriptions TO authenticated;
GRANT ALL ON public.ep_cashier_push_subscriptions TO service_role;

COMMENT ON TABLE public.ep_cashier_push_subscriptions IS
  'Suscripciones Web Push de cajeras. Avisos de bandeja solo para pedidos nuevos de su sucursal.';
