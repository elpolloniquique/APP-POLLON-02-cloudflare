-- =============================================================================
-- Voz mapa en vivo: minutos de aviso, volumen, velocidad, tono (pitch)
-- Idempotente. Ejecutar en Supabase SQL Editor.
-- =============================================================================

ALTER TABLE public.ep_dispatch_settings
  ADD COLUMN IF NOT EXISTS voice_eta_minutes INTEGER;

ALTER TABLE public.ep_dispatch_settings
  ADD COLUMN IF NOT EXISTS voice_volume INTEGER;

ALTER TABLE public.ep_dispatch_settings
  ADD COLUMN IF NOT EXISTS voice_rate NUMERIC(4,2);

ALTER TABLE public.ep_dispatch_settings
  ADD COLUMN IF NOT EXISTS voice_pitch NUMERIC(4,2);

UPDATE public.ep_dispatch_settings
SET voice_eta_minutes = 5
WHERE voice_eta_minutes IS NULL;

UPDATE public.ep_dispatch_settings
SET voice_volume = 100
WHERE voice_volume IS NULL;

UPDATE public.ep_dispatch_settings
SET voice_rate = 1.00
WHERE voice_rate IS NULL;

UPDATE public.ep_dispatch_settings
SET voice_pitch = 1.25
WHERE voice_pitch IS NULL;

ALTER TABLE public.ep_dispatch_settings
  ALTER COLUMN voice_eta_minutes SET DEFAULT 5;

ALTER TABLE public.ep_dispatch_settings
  ALTER COLUMN voice_volume SET DEFAULT 100;

ALTER TABLE public.ep_dispatch_settings
  ALTER COLUMN voice_rate SET DEFAULT 1.00;

ALTER TABLE public.ep_dispatch_settings
  ALTER COLUMN voice_pitch SET DEFAULT 1.25;

DO $$
BEGIN
  ALTER TABLE public.ep_dispatch_settings
    DROP CONSTRAINT IF EXISTS ep_dispatch_settings_voice_eta_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE public.ep_dispatch_settings
  DROP CONSTRAINT IF EXISTS ep_dispatch_settings_voice_eta_check;

ALTER TABLE public.ep_dispatch_settings
  ADD CONSTRAINT ep_dispatch_settings_voice_eta_check
  CHECK (voice_eta_minutes IS NULL OR (voice_eta_minutes >= 3 AND voice_eta_minutes <= 15));

DO $$
BEGIN
  ALTER TABLE public.ep_dispatch_settings
    DROP CONSTRAINT IF EXISTS ep_dispatch_settings_voice_volume_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE public.ep_dispatch_settings
  DROP CONSTRAINT IF EXISTS ep_dispatch_settings_voice_volume_check;

ALTER TABLE public.ep_dispatch_settings
  ADD CONSTRAINT ep_dispatch_settings_voice_volume_check
  CHECK (voice_volume IS NULL OR (voice_volume >= 20 AND voice_volume <= 100));

DO $$
BEGIN
  ALTER TABLE public.ep_dispatch_settings
    DROP CONSTRAINT IF EXISTS ep_dispatch_settings_voice_rate_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE public.ep_dispatch_settings
  DROP CONSTRAINT IF EXISTS ep_dispatch_settings_voice_rate_check;

ALTER TABLE public.ep_dispatch_settings
  ADD CONSTRAINT ep_dispatch_settings_voice_rate_check
  CHECK (voice_rate IS NULL OR (voice_rate >= 0.70 AND voice_rate <= 1.40));

DO $$
BEGIN
  ALTER TABLE public.ep_dispatch_settings
    DROP CONSTRAINT IF EXISTS ep_dispatch_settings_voice_pitch_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE public.ep_dispatch_settings
  DROP CONSTRAINT IF EXISTS ep_dispatch_settings_voice_pitch_check;

ALTER TABLE public.ep_dispatch_settings
  ADD CONSTRAINT ep_dispatch_settings_voice_pitch_check
  CHECK (voice_pitch IS NULL OR (voice_pitch >= 0.80 AND voice_pitch <= 1.60));
