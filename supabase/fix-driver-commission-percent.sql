-- =============================================================================
-- Comisión % por repartidor (admin la define manualmente)
-- Sobre el valor del delivery. Default 5%. Solo staff puede cambiarla.
-- Idempotente. No DROP de tablas.
-- =============================================================================

ALTER TABLE public.ep_driver_profiles
  ADD COLUMN IF NOT EXISTS commission_percent NUMERIC(5,2);

UPDATE public.ep_driver_profiles
SET commission_percent = 5
WHERE commission_percent IS NULL;

ALTER TABLE public.ep_driver_profiles
  ALTER COLUMN commission_percent SET DEFAULT 5;

ALTER TABLE public.ep_driver_profiles
  ALTER COLUMN commission_percent SET NOT NULL;

DO $$
BEGIN
  ALTER TABLE public.ep_driver_profiles
    DROP CONSTRAINT IF EXISTS ep_driver_profiles_commission_percent_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE public.ep_driver_profiles
  DROP CONSTRAINT IF EXISTS ep_driver_profiles_commission_percent_check;

ALTER TABLE public.ep_driver_profiles
  ADD CONSTRAINT ep_driver_profiles_commission_percent_check
  CHECK (commission_percent >= 0 AND commission_percent <= 100);

-- ── El repartidor no puede cambiar su propia comisión ───────────────────────
CREATE OR REPLACE FUNCTION public.ep_guard_driver_commission_percent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.commission_percent IS DISTINCT FROM OLD.commission_percent THEN
    IF NOT (public.ep_is_dispatch_staff() OR public.ep_is_super_admin()) THEN
      NEW.commission_percent := OLD.commission_percent;
    END IF;
    IF NEW.commission_percent IS NULL THEN NEW.commission_percent := 5; END IF;
    IF NEW.commission_percent < 0 THEN NEW.commission_percent := 0; END IF;
    IF NEW.commission_percent > 100 THEN NEW.commission_percent := 100; END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ep_guard_driver_commission_percent ON public.ep_driver_profiles;
CREATE TRIGGER trg_ep_guard_driver_commission_percent
  BEFORE UPDATE ON public.ep_driver_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.ep_guard_driver_commission_percent();

COMMENT ON COLUMN public.ep_driver_profiles.commission_percent IS
  'Porcentaje de comisión del repartidor sobre el delivery (0–100). Solo admin/staff.';
