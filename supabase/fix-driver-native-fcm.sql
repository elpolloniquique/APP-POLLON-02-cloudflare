-- App nativa: tokens FCM + flags onboarding
-- Ejecutar en Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.ep_driver_fcm_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.ep_driver_profiles(id) ON DELETE CASCADE,
  auth_user_id UUID,
  token TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'android',
  app_version TEXT,
  device_info JSONB DEFAULT '{}'::jsonb,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ep_driver_fcm_tokens_token_unique UNIQUE (token)
);

CREATE INDEX IF NOT EXISTS idx_ep_driver_fcm_tokens_driver ON public.ep_driver_fcm_tokens (driver_id);

ALTER TABLE public.ep_driver_fcm_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ep_driver_fcm_tokens_own ON public.ep_driver_fcm_tokens;
CREATE POLICY ep_driver_fcm_tokens_own ON public.ep_driver_fcm_tokens
  FOR ALL
  USING (auth.uid() IS NOT NULL AND auth_user_id = auth.uid())
  WITH CHECK (auth.uid() IS NOT NULL AND auth_user_id = auth.uid());

DROP POLICY IF EXISTS ep_driver_fcm_tokens_staff ON public.ep_driver_fcm_tokens;
CREATE POLICY ep_driver_fcm_tokens_staff ON public.ep_driver_fcm_tokens
  FOR SELECT
  USING (public.ep_is_dispatch_staff());

ALTER TABLE public.ep_driver_profiles
  ADD COLUMN IF NOT EXISTS native_onboarding_completed_at TIMESTAMPTZ;

ALTER TABLE public.ep_driver_profiles
  ADD COLUMN IF NOT EXISTS native_push_ok BOOLEAN DEFAULT FALSE;

ALTER TABLE public.ep_driver_profiles
  ADD COLUMN IF NOT EXISTS native_gps_always_ok BOOLEAN DEFAULT FALSE;

CREATE OR REPLACE FUNCTION public.ep_driver_location_is_fresh(p_driver_id UUID, p_max_age_seconds INT DEFAULT 90)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE last_at TIMESTAMPTZ;
BEGIN
  SELECT updated_at INTO last_at FROM public.ep_driver_location_latest WHERE driver_id = p_driver_id;
  IF last_at IS NULL THEN RETURN FALSE; END IF;
  RETURN last_at >= (now() - make_interval(secs => GREATEST(30, COALESCE(p_max_age_seconds, 90))));
END;
$$;

GRANT EXECUTE ON FUNCTION public.ep_driver_location_is_fresh(UUID, INT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.ep_upsert_my_fcm_token(
  p_token TEXT,
  p_platform TEXT DEFAULT 'android',
  p_app_version TEXT DEFAULT NULL,
  p_device_info JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE drv_id UUID; tok_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF p_token IS NULL OR length(trim(p_token)) < 20 THEN RAISE EXCEPTION 'Token FCM inválido'; END IF;

  SELECT d.id INTO drv_id
  FROM public.ep_driver_profiles d
  JOIN public.profiles p ON p.id = d.profile_id
  WHERE p.auth_user_id = auth.uid()
  LIMIT 1;

  IF drv_id IS NULL THEN RAISE EXCEPTION 'Perfil repartidor no encontrado'; END IF;

  INSERT INTO public.ep_driver_fcm_tokens AS t (
    driver_id, auth_user_id, token, platform, app_version, device_info, last_seen_at, updated_at
  ) VALUES (
    drv_id, auth.uid(), trim(p_token), COALESCE(NULLIF(p_platform, ''), 'android'),
    p_app_version, COALESCE(p_device_info, '{}'::jsonb), now(), now()
  )
  ON CONFLICT (token) DO UPDATE SET
    driver_id = EXCLUDED.driver_id,
    auth_user_id = EXCLUDED.auth_user_id,
    platform = EXCLUDED.platform,
    app_version = EXCLUDED.app_version,
    device_info = EXCLUDED.device_info,
    last_seen_at = now(),
    updated_at = now()
  RETURNING id INTO tok_id;

  UPDATE public.ep_driver_profiles SET native_push_ok = TRUE, updated_at = now() WHERE id = drv_id;
  RETURN tok_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ep_upsert_my_fcm_token(TEXT, TEXT, TEXT, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.ep_mark_my_native_onboarding(
  p_gps_always_ok BOOLEAN DEFAULT TRUE,
  p_push_ok BOOLEAN DEFAULT TRUE
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE drv_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT d.id INTO drv_id
  FROM public.ep_driver_profiles d
  JOIN public.profiles p ON p.id = d.profile_id
  WHERE p.auth_user_id = auth.uid() LIMIT 1;
  IF drv_id IS NULL THEN RAISE EXCEPTION 'Perfil repartidor no encontrado'; END IF;
  UPDATE public.ep_driver_profiles SET
    native_onboarding_completed_at = now(),
    native_gps_always_ok = COALESCE(p_gps_always_ok, TRUE),
    native_push_ok = COALESCE(p_push_ok, TRUE),
    updated_at = now()
  WHERE id = drv_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ep_mark_my_native_onboarding(BOOLEAN, BOOLEAN) TO authenticated;
