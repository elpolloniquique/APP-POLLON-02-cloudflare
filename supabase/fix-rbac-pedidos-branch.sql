-- RBAC por sucursal en pedidos (ejecutar en Supabase SQL Editor)
-- Super admin ve todo; resto del personal solo pedidos de su branch_id en profiles.

DROP POLICY IF EXISTS pedidos_staff_select ON public.pedidos;
DROP POLICY IF EXISTS pedidos_staff_update ON public.pedidos;

CREATE POLICY pedidos_staff_select ON public.pedidos
  FOR SELECT
  TO authenticated
  USING (
    public.auth_user_role() = 'super_admin'
    OR branch_id = public.auth_user_branch_id()
    OR branch_id IS NULL
  );

CREATE POLICY pedidos_staff_update ON public.pedidos
  FOR UPDATE
  TO authenticated
  USING (
    public.auth_user_role() IN ('super_admin', 'admin_sucursal', 'cajera', 'cocina', 'delivery')
    AND (
      public.auth_user_role() = 'super_admin'
      OR branch_id = public.auth_user_branch_id()
    )
  )
  WITH CHECK (
    public.auth_user_role() = 'super_admin'
    OR branch_id = public.auth_user_branch_id()
  );
