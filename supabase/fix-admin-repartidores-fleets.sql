-- =============================================================================
-- Jefe de repartidores: flotas + pedido primero a jefes + asignar a una moto.
-- Ejecutar UNA vez en el SQL Editor de Supabase.
-- La app nativa no cambia: la moto solo recibe oferta cuando se la asignan
-- (o el jefe la acepta para él). Si la sucursal aún no tiene flota, el
-- comportamiento anterior se mantiene.
-- =============================================================================

INSERT INTO public.roles (id, label, description) VALUES
  ('admin_repartidores', 'Jefe de repartidores', 'Asigna motos de su flota. También trabaja en la app nativa')
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.ep_is_dispatch_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.ep_my_role() IN (
    'super_admin', 'admin_sucursal', 'administrador', 'cajera', 'cajero', 'despachador',
    'admin_repartidores'
  );
$$;

CREATE OR REPLACE FUNCTION public.ep_is_driver_role()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.ep_my_role() IN ('delivery', 'repartidor', 'admin_repartidores');
$$;

CREATE OR REPLACE FUNCTION public.ep_driver_matches_job_branch(p_driver_id UUID, p_job_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  job_branch UUID;
  drv_branch UUID;
BEGIN
  SELECT COALESCE(j.branch_id, p.branch_id)
  INTO job_branch
  FROM public.ep_delivery_jobs j
  LEFT JOIN public.pedidos p ON p.id::text = j.source_order_id
  WHERE j.id = p_job_id;

  SELECT COALESCE(d.preferred_branch_id, pr.branch_id)
  INTO drv_branch
  FROM public.ep_driver_profiles d
  LEFT JOIN public.profiles pr ON pr.id = d.profile_id
  WHERE d.id = p_driver_id;

  IF job_branch IS NULL OR drv_branch IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN job_branch = drv_branch;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ep_driver_matches_job_branch(UUID, UUID) TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.ep_driver_fleets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  owner_profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ep_driver_fleets_owner_uidx
  ON public.ep_driver_fleets (owner_profile_id)
  WHERE owner_profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ep_driver_fleets_branch_idx
  ON public.ep_driver_fleets (branch_id)
  WHERE is_active;

ALTER TABLE public.ep_driver_profiles
  ADD COLUMN IF NOT EXISTS fleet_id UUID REFERENCES public.ep_driver_fleets(id) ON DELETE SET NULL;

ALTER TABLE public.ep_driver_profiles
  ADD COLUMN IF NOT EXISTS is_fleet_boss BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.ep_delivery_jobs
  ADD COLUMN IF NOT EXISTS fleet_hold_driver_id UUID REFERENCES public.ep_driver_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ep_driver_profiles_fleet_idx
  ON public.ep_driver_profiles (fleet_id);

CREATE INDEX IF NOT EXISTS ep_jobs_fleet_hold_idx
  ON public.ep_delivery_jobs (fleet_hold_driver_id)
  WHERE fleet_hold_driver_id IS NOT NULL;

ALTER TABLE public.ep_driver_fleets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ep_fleets_select_auth ON public.ep_driver_fleets;
CREATE POLICY ep_fleets_select_auth ON public.ep_driver_fleets
  FOR SELECT TO authenticated
  USING (true);

GRANT SELECT ON public.ep_driver_fleets TO authenticated;
GRANT ALL ON public.ep_driver_fleets TO service_role;

CREATE OR REPLACE FUNCTION public.ep_branch_has_active_fleet(p_branch_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.ep_driver_fleets f
    WHERE f.is_active
      AND f.branch_id IS NOT NULL
      AND f.branch_id = p_branch_id
  );
$$;

CREATE OR REPLACE FUNCTION public.ep_driver_is_offer_target(p_driver_id UUID, p_job_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  job RECORD;
  drv RECORD;
  job_branch UUID;
BEGIN
  SELECT j.id, j.branch_id, j.source_order_id, j.fleet_hold_driver_id, j.assigned_driver_id
  INTO job
  FROM public.ep_delivery_jobs j
  WHERE j.id = p_job_id;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  IF job.assigned_driver_id IS NOT NULL THEN
    RETURN FALSE;
  END IF;

  SELECT d.id, d.is_fleet_boss, d.admin_status, d.preferred_branch_id, d.profile_id, d.fleet_id
  INTO drv
  FROM public.ep_driver_profiles d
  WHERE d.id = p_driver_id;
  IF NOT FOUND OR drv.admin_status IS DISTINCT FROM 'approved' THEN
    RETURN FALSE;
  END IF;

  SELECT COALESCE(job.branch_id, p.branch_id)
  INTO job_branch
  FROM public.pedidos p
  WHERE p.id::text = job.source_order_id
  LIMIT 1;
  job_branch := COALESCE(job.branch_id, job_branch);

  IF job.fleet_hold_driver_id IS NOT NULL THEN
    RETURN drv.id = job.fleet_hold_driver_id;
  END IF;

  IF job_branch IS NOT NULL AND public.ep_branch_has_active_fleet(job_branch) THEN
    RETURN drv.is_fleet_boss
      AND public.ep_driver_matches_job_branch(p_driver_id, p_job_id);
  END IF;

  RETURN public.ep_driver_matches_job_branch(p_driver_id, p_job_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.ep_branch_has_active_fleet(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ep_driver_is_offer_target(UUID, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.ep_ensure_fleet_for_boss(
  p_profile_id UUID,
  p_branch_id UUID,
  p_fleet_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fid UUID;
  did UUID;
  fname TEXT;
BEGIN
  IF p_profile_id IS NULL OR p_branch_id IS NULL THEN
    RAISE EXCEPTION 'Faltan perfil o sucursal para crear la flota';
  END IF;
  fname := NULLIF(btrim(p_fleet_name), '');
  IF fname IS NULL THEN
    fname := 'Flota';
  END IF;

  SELECT id INTO fid
  FROM public.ep_driver_fleets
  WHERE owner_profile_id = p_profile_id
  LIMIT 1;

  IF fid IS NULL THEN
    INSERT INTO public.ep_driver_fleets (name, branch_id, owner_profile_id)
    VALUES (fname, p_branch_id, p_profile_id)
    RETURNING id INTO fid;
  ELSE
    UPDATE public.ep_driver_fleets
    SET name = fname,
        branch_id = p_branch_id,
        is_active = TRUE,
        updated_at = now()
    WHERE id = fid;
  END IF;

  INSERT INTO public.ep_driver_profiles (
    profile_id, admin_status, preferred_branch_id, fleet_id, is_fleet_boss, operational_status
  )
  VALUES (p_profile_id, 'approved', p_branch_id, fid, TRUE, 'offline')
  ON CONFLICT (profile_id) DO UPDATE SET
    admin_status = 'approved',
    preferred_branch_id = EXCLUDED.preferred_branch_id,
    fleet_id = EXCLUDED.fleet_id,
    is_fleet_boss = TRUE,
    updated_at = now()
  RETURNING id INTO did;

  RETURN fid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ep_ensure_fleet_for_boss(UUID, UUID, TEXT) TO service_role;

-- Cierra ofertas pending que ya no son destino (motos sueltas si hay flota)
UPDATE public.ep_delivery_offers o
SET status = 'expired', responded_at = now()
WHERE o.status = 'pending'
  AND NOT public.ep_driver_is_offer_target(o.driver_id, o.job_id);

CREATE OR REPLACE FUNCTION public.ep_reject_delivery_offer(p_offer_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  did UUID;
  oid UUID;
  jid UUID;
BEGIN
  did := public.ep_my_driver_id();
  UPDATE ep_delivery_offers
  SET status = 'rejected', responded_at = now()
  WHERE id = p_offer_id AND driver_id = did AND status = 'pending'
  RETURNING id, job_id INTO oid, jid;
  IF oid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_pending');
  END IF;
  UPDATE public.ep_delivery_jobs
  SET fleet_hold_driver_id = NULL, updated_at = now()
  WHERE id = jid
    AND fleet_hold_driver_id = did
    AND assigned_driver_id IS NULL;
  RETURN jsonb_build_object('ok', true, 'released', true, 'job_id', jid);
END;
$$;

GRANT EXECUTE ON FUNCTION public.ep_reject_delivery_offer(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.ep_refresh_open_offers_for_driver(p_driver_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  drv RECORD;
  job RECORD;
  ttl INT := 86400;
  settings RECORD;
  revived INT := 0;
  inserted INT := 0;
  skipped_rejected INT := 0;
BEGIN
  IF p_driver_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_driver');
  END IF;

  SELECT * INTO drv FROM public.ep_driver_profiles WHERE id = p_driver_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'driver_missing');
  END IF;

  IF NOT public.ep_driver_can_receive_offers(p_driver_id) THEN
    RETURN jsonb_build_object('ok', true, 'revived', 0, 'inserted', 0, 'reason', 'not_eligible');
  END IF;

  FOR job IN
    SELECT j.id, COALESCE(j.branch_id, p.branch_id) AS branch_id, j.delivery_fee, j.status
    FROM public.ep_delivery_jobs j
    INNER JOIN public.pedidos p ON p.id::text = j.source_order_id
    WHERE j.assigned_driver_id IS NULL
      AND j.status NOT IN ('delivered', 'cancelled', 'assigned', 'heading_to_branch', 'picked_up', 'delivering')
      AND NOT EXISTS (
        SELECT 1 FROM public.ep_delivery_assignments a
        WHERE a.job_id = j.id AND a.status = 'active'
      )
      AND LOWER(COALESCE(p.estado, '')) IN ('pendiente', 'nuevo')
      AND COALESCE(p.tipo_entrega, 'delivery') = 'delivery'
  LOOP
    IF NOT public.ep_driver_is_offer_target(p_driver_id, job.id) THEN
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.ep_delivery_offers o
      WHERE o.job_id = job.id AND o.driver_id = p_driver_id AND o.status = 'rejected'
    ) THEN
      skipped_rejected := skipped_rejected + 1;
      CONTINUE;
    END IF;

    SELECT * INTO settings FROM public.ep_dispatch_settings WHERE branch_id = job.branch_id;
    ttl := GREATEST(86400, COALESCE(settings.offer_ttl_seconds, 86400));
    IF ttl > 604800 THEN ttl := 604800; END IF;

    UPDATE public.ep_delivery_offers
    SET
      status = 'pending',
      offered_fee = job.delivery_fee,
      expires_at = now() + make_interval(secs => ttl),
      responded_at = NULL
    WHERE job_id = job.id
      AND driver_id = p_driver_id
      AND status IN ('expired', 'taken_by_other', 'pending');

    IF FOUND THEN
      revived := revived + 1;
    ELSE
      INSERT INTO public.ep_delivery_offers (job_id, driver_id, status, offered_fee, expires_at)
      VALUES (job.id, p_driver_id, 'pending', job.delivery_fee, now() + make_interval(secs => ttl))
      ON CONFLICT (job_id, driver_id) DO UPDATE SET
        status = 'pending',
        offered_fee = EXCLUDED.offered_fee,
        expires_at = EXCLUDED.expires_at,
        responded_at = NULL
      WHERE ep_delivery_offers.status IN ('expired', 'taken_by_other');
      IF FOUND THEN
        inserted := inserted + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'revived', revived, 'inserted', inserted, 'skipped_rejected', skipped_rejected);
END;
$$;

GRANT EXECUTE ON FUNCTION public.ep_refresh_open_offers_for_driver(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.ep_guard_offer_target()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'pending'
     AND NEW.driver_id IS NOT NULL
     AND NEW.job_id IS NOT NULL
     AND NOT public.ep_driver_is_offer_target(NEW.driver_id, NEW.job_id) THEN
    NEW.status := 'expired';
    NEW.responded_at := COALESCE(NEW.responded_at, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ep_guard_offer_target ON public.ep_delivery_offers;
CREATE TRIGGER trg_ep_guard_offer_target
  BEFORE INSERT OR UPDATE OF status, driver_id, job_id
  ON public.ep_delivery_offers
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION public.ep_guard_offer_target();
