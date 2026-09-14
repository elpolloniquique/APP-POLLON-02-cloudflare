-- =============================================================================
-- Corregir Security Advisor: RLS en roles y user_roles
-- Ejecutar en Supabase → SQL Editor → Run → luego Security Advisor → Rerun linter
-- =============================================================================

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- roles: catálogo de solo lectura para la app; solo super_admin puede modificar
DROP POLICY IF EXISTS roles_select_all ON public.roles;
CREATE POLICY roles_select_all ON public.roles
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS roles_manage_super_admin ON public.roles;
CREATE POLICY roles_manage_super_admin ON public.roles
  FOR ALL
  TO authenticated
  USING (public.auth_user_role() = 'super_admin')
  WITH CHECK (public.auth_user_role() = 'super_admin');

-- user_roles: cada usuario ve los suyos; super_admin gestiona todo
DROP POLICY IF EXISTS user_roles_select_own ON public.user_roles;
CREATE POLICY user_roles_select_own ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (
    profile_id = public.auth_user_profile_id()
    OR public.auth_user_role() IN ('super_admin', 'admin_sucursal')
  );

DROP POLICY IF EXISTS user_roles_manage_super_admin ON public.user_roles;
CREATE POLICY user_roles_manage_super_admin ON public.user_roles
  FOR ALL
  TO authenticated
  USING (public.auth_user_role() = 'super_admin')
  WITH CHECK (public.auth_user_role() = 'super_admin');
