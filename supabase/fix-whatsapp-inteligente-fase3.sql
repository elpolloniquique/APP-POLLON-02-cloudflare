-- =============================================================================
-- EL POLLÓN — WhatsApp Inteligente FASE 3 (aditivo)
-- Dashboard origen WA · A/B bienvenida · opt-out · admin_sucursal (solo su local)
-- Ejecutar DESPUÉS de fix-whatsapp-inteligente.sql y fase2.sql
-- =============================================================================

ALTER TABLE public.ep_wa_settings
  ADD COLUMN IF NOT EXISTS ab_welcome_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.ep_wa_settings
  ADD COLUMN IF NOT EXISTS avisos_si_opt_out BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.ep_wa_sessions
  ADD COLUMN IF NOT EXISTS ab_variant TEXT CHECK (ab_variant IS NULL OR ab_variant IN ('a', 'b'));

ALTER TABLE public.ep_wa_sessions
  ADD COLUMN IF NOT EXISTS opt_out BOOLEAN NOT NULL DEFAULT false;

-- -----------------------------------------------------------------------------
-- RLS Fase 3: super_admin todo; admin_sucursal solo SU sucursal (live/KB)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS ep_wa_settings_sa ON public.ep_wa_settings;
DROP POLICY IF EXISTS ep_wa_settings_as_select ON public.ep_wa_settings;
CREATE POLICY ep_wa_settings_sa ON public.ep_wa_settings
  FOR ALL TO authenticated
  USING (public.auth_user_role() = 'super_admin')
  WITH CHECK (public.auth_user_role() = 'super_admin');
CREATE POLICY ep_wa_settings_as_select ON public.ep_wa_settings
  FOR SELECT TO authenticated
  USING (
    public.auth_user_role() IN ('admin_sucursal', 'administrador')
    AND branch_id = (SELECT p.branch_id FROM public.profiles p WHERE p.auth_user_id = auth.uid() LIMIT 1)
  );

DROP POLICY IF EXISTS ep_wa_kb_sa ON public.ep_wa_kb;
DROP POLICY IF EXISTS ep_wa_kb_as ON public.ep_wa_kb;
CREATE POLICY ep_wa_kb_sa ON public.ep_wa_kb
  FOR ALL TO authenticated
  USING (public.auth_user_role() = 'super_admin')
  WITH CHECK (public.auth_user_role() = 'super_admin');
CREATE POLICY ep_wa_kb_as ON public.ep_wa_kb
  FOR ALL TO authenticated
  USING (
    public.auth_user_role() IN ('admin_sucursal', 'administrador')
    AND (
      branch_id IS NULL
      OR branch_id = (SELECT p.branch_id FROM public.profiles p WHERE p.auth_user_id = auth.uid() LIMIT 1)
    )
  )
  WITH CHECK (
    public.auth_user_role() IN ('admin_sucursal', 'administrador')
    AND branch_id = (SELECT p.branch_id FROM public.profiles p WHERE p.auth_user_id = auth.uid() LIMIT 1)
  );

DROP POLICY IF EXISTS ep_wa_sessions_sa ON public.ep_wa_sessions;
DROP POLICY IF EXISTS ep_wa_sessions_as ON public.ep_wa_sessions;
CREATE POLICY ep_wa_sessions_sa ON public.ep_wa_sessions
  FOR ALL TO authenticated
  USING (public.auth_user_role() = 'super_admin')
  WITH CHECK (public.auth_user_role() = 'super_admin');
CREATE POLICY ep_wa_sessions_as ON public.ep_wa_sessions
  FOR ALL TO authenticated
  USING (
    public.auth_user_role() IN ('admin_sucursal', 'administrador')
    AND branch_id = (SELECT p.branch_id FROM public.profiles p WHERE p.auth_user_id = auth.uid() LIMIT 1)
  )
  WITH CHECK (
    public.auth_user_role() IN ('admin_sucursal', 'administrador')
    AND branch_id = (SELECT p.branch_id FROM public.profiles p WHERE p.auth_user_id = auth.uid() LIMIT 1)
  );

DROP POLICY IF EXISTS ep_wa_messages_sa ON public.ep_wa_messages;
DROP POLICY IF EXISTS ep_wa_messages_as ON public.ep_wa_messages;
CREATE POLICY ep_wa_messages_sa ON public.ep_wa_messages
  FOR ALL TO authenticated
  USING (public.auth_user_role() = 'super_admin')
  WITH CHECK (public.auth_user_role() = 'super_admin');
CREATE POLICY ep_wa_messages_as ON public.ep_wa_messages
  FOR ALL TO authenticated
  USING (
    public.auth_user_role() IN ('admin_sucursal', 'administrador')
    AND branch_id = (SELECT p.branch_id FROM public.profiles p WHERE p.auth_user_id = auth.uid() LIMIT 1)
  )
  WITH CHECK (
    public.auth_user_role() IN ('admin_sucursal', 'administrador')
    AND branch_id = (SELECT p.branch_id FROM public.profiles p WHERE p.auth_user_id = auth.uid() LIMIT 1)
  );

DROP POLICY IF EXISTS ep_wa_alerts_sa ON public.ep_wa_alerts;
DROP POLICY IF EXISTS ep_wa_alerts_as ON public.ep_wa_alerts;
CREATE POLICY ep_wa_alerts_sa ON public.ep_wa_alerts
  FOR ALL TO authenticated
  USING (public.auth_user_role() = 'super_admin')
  WITH CHECK (public.auth_user_role() = 'super_admin');
CREATE POLICY ep_wa_alerts_as ON public.ep_wa_alerts
  FOR ALL TO authenticated
  USING (
    public.auth_user_role() IN ('admin_sucursal', 'administrador')
    AND branch_id = (SELECT p.branch_id FROM public.profiles p WHERE p.auth_user_id = auth.uid() LIMIT 1)
  )
  WITH CHECK (
    public.auth_user_role() IN ('admin_sucursal', 'administrador')
    AND branch_id = (SELECT p.branch_id FROM public.profiles p WHERE p.auth_user_id = auth.uid() LIMIT 1)
  );

DROP POLICY IF EXISTS ep_wa_outbox_sa ON public.ep_wa_outbox;
DROP POLICY IF EXISTS ep_wa_outbox_as_select ON public.ep_wa_outbox;
CREATE POLICY ep_wa_outbox_sa ON public.ep_wa_outbox
  FOR ALL TO authenticated
  USING (public.auth_user_role() = 'super_admin')
  WITH CHECK (public.auth_user_role() = 'super_admin');
CREATE POLICY ep_wa_outbox_as_select ON public.ep_wa_outbox
  FOR SELECT TO authenticated
  USING (
    public.auth_user_role() IN ('admin_sucursal', 'administrador')
    AND EXISTS (
      SELECT 1 FROM public.pedidos p
      WHERE p.id::text = ep_wa_outbox.order_id
        AND p.branch_id = (SELECT pr.branch_id FROM public.profiles pr WHERE pr.auth_user_id = auth.uid() LIMIT 1)
    )
  );

COMMENT ON COLUMN public.ep_wa_settings.ab_welcome_enabled IS
  'Fase 3: A/B de plantilla bienvenida (a vs b) por teléfono. Default OFF.';
COMMENT ON COLUMN public.ep_wa_sessions.opt_out IS
  'Fase 3: cliente pidió no recibir mensajes promocionales / baja WhatsApp.';
