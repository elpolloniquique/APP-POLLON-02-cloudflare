-- Jefe: mismo correo en app nativa. Los pedidos nuevos le llegan a él
-- sin asignárselos. Las motos siguen viendo solo lo que él les asigne.
-- Ejecutar UNA vez en el SQL Editor de Supabase.

UPDATE public.ep_driver_profiles d
SET
  is_fleet_boss = TRUE,
  admin_status = 'approved',
  updated_at = now()
FROM public.profiles p
WHERE d.profile_id = p.id
  AND p.role = 'admin_repartidores'
  AND (d.is_fleet_boss IS DISTINCT FROM TRUE OR d.admin_status IS DISTINCT FROM 'approved');

UPDATE public.ep_driver_profiles d
SET
  fleet_id = f.id,
  preferred_branch_id = COALESCE(d.preferred_branch_id, f.branch_id),
  updated_at = now()
FROM public.ep_driver_fleets f
WHERE f.owner_profile_id = d.profile_id
  AND d.fleet_id IS DISTINCT FROM f.id;

CREATE OR REPLACE FUNCTION public.ep_ensure_driver_profile()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pid UUID;
  did UUID;
  v_phone TEXT;
  my_role TEXT;
  fid UUID;
  fbranch UUID;
BEGIN
  IF NOT public.ep_is_driver_role() AND NOT public.ep_is_dispatch_staff() THEN
    RAISE EXCEPTION 'No autorizado: tu perfil debe tener role = delivery o repartidor';
  END IF;

  pid := public.ep_my_profile_id();
  IF pid IS NULL THEN
    RAISE EXCEPTION 'Perfil no encontrado en profiles (auth_user_id)';
  END IF;

  my_role := public.ep_my_role();
  SELECT COALESCE(phone, '') INTO v_phone FROM profiles WHERE id = pid;
  SELECT id INTO did FROM ep_driver_profiles WHERE profile_id = pid;

  IF did IS NULL THEN
    INSERT INTO ep_driver_profiles (profile_id, admin_status, phone, operational_status)
    VALUES (
      pid,
      CASE WHEN public.ep_is_driver_role() THEN 'approved' ELSE 'pending' END,
      v_phone,
      'offline'
    )
    RETURNING id INTO did;
  ELSIF public.ep_is_driver_role() THEN
    UPDATE ep_driver_profiles
    SET admin_status = 'approved',
        approved_at = COALESCE(approved_at, now()),
        phone = CASE WHEN COALESCE(phone, '') = '' THEN v_phone ELSE phone END,
        updated_at = now()
    WHERE id = did AND admin_status IN ('pending', 'rejected');
  END IF;

  IF my_role = 'admin_repartidores' THEN
    SELECT f.id, f.branch_id INTO fid, fbranch
    FROM public.ep_driver_fleets f
    WHERE f.owner_profile_id = pid
    LIMIT 1;

    UPDATE public.ep_driver_profiles
    SET
      is_fleet_boss = TRUE,
      admin_status = 'approved',
      approved_at = COALESCE(approved_at, now()),
      fleet_id = COALESCE(fleet_id, fid),
      preferred_branch_id = COALESCE(preferred_branch_id, fbranch),
      updated_at = now()
    WHERE id = did;
  END IF;

  RETURN did;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ep_ensure_driver_profile() TO authenticated;
