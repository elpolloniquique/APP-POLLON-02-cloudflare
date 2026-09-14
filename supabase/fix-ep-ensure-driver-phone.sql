-- FIX rápido: profiles usa "phone", NO "telefono"
-- Ejecutar solo este archivo en Supabase SQL Editor (no hace falta re-correr toda la migración)

CREATE OR REPLACE FUNCTION public.ep_ensure_driver_profile()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pid UUID;
  did UUID;
BEGIN
  IF NOT public.ep_is_driver_role() AND NOT public.ep_is_dispatch_staff() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  pid := public.ep_my_profile_id();
  IF pid IS NULL THEN
    RAISE EXCEPTION 'Perfil no encontrado';
  END IF;

  SELECT id INTO did FROM ep_driver_profiles WHERE profile_id = pid;
  IF did IS NULL THEN
    INSERT INTO ep_driver_profiles (profile_id, admin_status, phone)
    SELECT pid,
      CASE WHEN public.ep_is_driver_role() THEN 'approved' ELSE 'pending' END,
      COALESCE(p.phone, '')
    FROM profiles p WHERE p.id = pid
    RETURNING id INTO did;
  END IF;
  RETURN did;
END;
$$;
