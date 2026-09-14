-- =============================================================================
-- EL POLLÓN — Gestión de usuarios staff (panel Admin → Usuarios)
-- Ejecutar en Supabase → SQL Editor
-- =============================================================================

-- Roles usados por el panel
INSERT INTO roles (id, label, description) VALUES
  ('super_admin', 'Super Admin', 'Acceso total a todas las sucursales'),
  ('admin_sucursal', 'Admin sucursal', 'Administra una sucursal'),
  ('cajera', 'Cajera', 'Pedidos, caja y clientes de su sucursal'),
  ('cajero', 'Cajero', 'Pedidos, caja y clientes de su sucursal'),
  ('despachador', 'Despacho', 'Gestiona pedidos para despacho'),
  ('cocina', 'Cocina', 'Pedidos en cocina de su sucursal'),
  ('cocinero', 'Cocinero', 'Pedidos en cocina de su sucursal'),
  ('delivery', 'Repartidor', 'Entrega a clientes'),
  ('repartidor', 'Repartidor', 'Entrega a clientes'),
  ('cliente', 'Cliente', 'Perfil y pedidos propios')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles (username);

-- Trigger: tomar branch_id / username / avatar desde metadata al crear auth user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_profile_id UUID;
  v_email_ok BOOLEAN;
  v_whatsapp_ok BOOLEAN;
  v_branch UUID;
  v_username TEXT;
  v_avatar TEXT;
BEGIN
  v_role := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'role'), ''), 'cliente');
  IF NOT EXISTS (SELECT 1 FROM public.roles WHERE id = v_role) THEN
    v_role := 'cliente';
  END IF;

  BEGIN
    v_branch := NULLIF(trim(NEW.raw_user_meta_data->>'branch_id'), '')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_branch := NULL;
  END;

  v_username := NULLIF(trim(NEW.raw_user_meta_data->>'username'), '');
  v_avatar := NULLIF(trim(NEW.raw_user_meta_data->>'avatar_url'), '');

  INSERT INTO public.profiles (
    auth_user_id, full_name, email, phone, role, branch_id, username, avatar_url, is_active
  )
  VALUES (
    NEW.id,
    COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''), split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    v_role,
    v_branch,
    v_username,
    v_avatar,
    COALESCE((NEW.raw_user_meta_data->>'is_active')::boolean, true)
  )
  ON CONFLICT (auth_user_id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), profiles.full_name),
    phone = COALESCE(NULLIF(EXCLUDED.phone, ''), profiles.phone),
    role = CASE WHEN EXCLUDED.role IS DISTINCT FROM 'cliente' THEN EXCLUDED.role ELSE profiles.role END,
    branch_id = COALESCE(EXCLUDED.branch_id, profiles.branch_id),
    username = COALESCE(EXCLUDED.username, profiles.username),
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    updated_at = now()
  RETURNING id INTO v_profile_id;

  IF v_role = 'cliente' AND v_profile_id IS NOT NULL THEN
  BEGIN
    v_email_ok := false;
    v_whatsapp_ok := false;
    IF NEW.raw_user_meta_data ? 'accepts_email_promotions' THEN
      BEGIN
        v_email_ok := COALESCE((NEW.raw_user_meta_data->>'accepts_email_promotions')::boolean, false);
      EXCEPTION WHEN OTHERS THEN
        v_email_ok := false;
      END;
    END IF;
    IF NEW.raw_user_meta_data ? 'accepts_whatsapp_promotions' THEN
      BEGIN
        v_whatsapp_ok := COALESCE((NEW.raw_user_meta_data->>'accepts_whatsapp_promotions')::boolean, false);
      EXCEPTION WHEN OTHERS THEN
        v_whatsapp_ok := false;
      END;
    END IF;

    INSERT INTO public.customer_marketing_preferences (
      customer_id, accepts_email_promotions, accepts_whatsapp_promotions
    )
    VALUES (v_profile_id, v_email_ok, v_whatsapp_ok)
    ON CONFLICT (customer_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user marketing: %', SQLERRM;
  END;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user profiles: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Helpers
CREATE OR REPLACE FUNCTION public.ep_is_staff_manager()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role FROM profiles WHERE auth_user_id = auth.uid() LIMIT 1)
      IN ('super_admin', 'admin_sucursal', 'administrador'),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.ep_staff_roles()
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ARRAY[
    'super_admin', 'admin_sucursal', 'administrador',
    'cajera', 'cajero', 'despachador',
    'cocina', 'cocinero', 'delivery', 'repartidor'
  ];
$$;

-- RLS: listar / editar staff
DROP POLICY IF EXISTS profiles_staff_select_managers ON profiles;
CREATE POLICY profiles_staff_select_managers ON profiles
  FOR SELECT TO authenticated
  USING (
    public.ep_is_super_admin()
    OR (
      public.ep_is_staff_manager()
      AND (
        branch_id = public.auth_user_branch_id()
        OR public.auth_user_branch_id() IS NULL
        OR auth_user_id = auth.uid()
      )
      AND role = ANY (public.ep_staff_roles())
    )
    OR auth_user_id = auth.uid()
  );

DROP POLICY IF EXISTS profiles_staff_update_managers ON profiles;
CREATE POLICY profiles_staff_update_managers ON profiles
  FOR UPDATE TO authenticated
  USING (
    public.ep_is_super_admin()
    OR (
      public.ep_is_staff_manager()
      AND role = ANY (public.ep_staff_roles())
      AND role IS DISTINCT FROM 'super_admin'
      AND (branch_id = public.auth_user_branch_id() OR auth_user_id = auth.uid())
    )
  )
  WITH CHECK (
    public.ep_is_super_admin()
    OR (
      public.ep_is_staff_manager()
      AND role = ANY (public.ep_staff_roles())
      AND role IS DISTINCT FROM 'super_admin'
      AND (branch_id = public.auth_user_branch_id() OR branch_id IS NULL OR auth_user_id = auth.uid())
    )
  );

GRANT EXECUTE ON FUNCTION public.ep_is_staff_manager() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ep_staff_roles() TO authenticated;
