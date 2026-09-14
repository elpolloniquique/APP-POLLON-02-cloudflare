-- =============================================================================
-- Push notifications para repartidores (Web Push / VAPID)
-- Ejecutar en Supabase SQL Editor UNA vez.
-- Luego configura en Vercel:
--   VITE_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT,
--   SUPABASE_SERVICE_ROLE_KEY (y VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY ya existentes)
-- Generar claves: npx web-push generate-vapid-keys
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.ep_driver_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.ep_driver_profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ep_driver_push_subscriptions_endpoint_uq UNIQUE (endpoint)
);

CREATE INDEX IF NOT EXISTS ep_driver_push_subscriptions_driver_idx
  ON public.ep_driver_push_subscriptions (driver_id);

ALTER TABLE public.ep_driver_push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ep_push_select_own ON public.ep_driver_push_subscriptions;
CREATE POLICY ep_push_select_own ON public.ep_driver_push_subscriptions
  FOR SELECT TO authenticated
  USING (driver_id = public.ep_my_driver_id() OR public.ep_is_dispatch_staff());

DROP POLICY IF EXISTS ep_push_insert_own ON public.ep_driver_push_subscriptions;
CREATE POLICY ep_push_insert_own ON public.ep_driver_push_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (driver_id = public.ep_my_driver_id());

DROP POLICY IF EXISTS ep_push_update_own ON public.ep_driver_push_subscriptions;
CREATE POLICY ep_push_update_own ON public.ep_driver_push_subscriptions
  FOR UPDATE TO authenticated
  USING (driver_id = public.ep_my_driver_id())
  WITH CHECK (driver_id = public.ep_my_driver_id());

DROP POLICY IF EXISTS ep_push_delete_own ON public.ep_driver_push_subscriptions;
CREATE POLICY ep_push_delete_own ON public.ep_driver_push_subscriptions
  FOR DELETE TO authenticated
  USING (driver_id = public.ep_my_driver_id() OR public.ep_is_dispatch_staff());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ep_driver_push_subscriptions TO authenticated;
GRANT ALL ON public.ep_driver_push_subscriptions TO service_role;

COMMENT ON TABLE public.ep_driver_push_subscriptions IS
  'Suscripciones Web Push de repartidores (bandeja del sistema, pantalla apagada).';
