-- =============================================================================
-- EL POLLÓN BOT — FASE 19 seguridad
-- Revoca anon/public, endurece RLS de settings, auditoría en bot_logs.
-- No DROP de ep_wa_*. No IA. No Meta.
-- =============================================================================

REVOKE ALL ON TABLE
  public.bot_settings, public.bot_synonyms, public.bot_intents, public.bot_knowledge,
  public.bot_documents, public.bot_knowledge_chunks, public.bot_conversations, public.bot_messages,
  public.bot_unanswered_questions, public.bot_events, public.bot_notification_queue, public.bot_logs
FROM anon, public;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.bot_settings, public.bot_synonyms, public.bot_intents, public.bot_knowledge,
  public.bot_documents, public.bot_knowledge_chunks, public.bot_conversations, public.bot_messages,
  public.bot_unanswered_questions, public.bot_events, public.bot_notification_queue, public.bot_logs
TO authenticated;

GRANT ALL ON
  public.bot_settings, public.bot_synonyms, public.bot_intents, public.bot_knowledge,
  public.bot_documents, public.bot_knowledge_chunks, public.bot_conversations, public.bot_messages,
  public.bot_unanswered_questions, public.bot_events, public.bot_notification_queue, public.bot_logs
TO service_role;

-- Admin sucursal: LEE global + su sucursal; SOLO ESCRIBE override de su sucursal
DROP POLICY IF EXISTS bot_settings_as ON public.bot_settings;
DROP POLICY IF EXISTS bot_settings_as_select ON public.bot_settings;
DROP POLICY IF EXISTS bot_settings_as_write ON public.bot_settings;
DROP POLICY IF EXISTS bot_settings_as_ins ON public.bot_settings;
DROP POLICY IF EXISTS bot_settings_as_upd ON public.bot_settings;
DROP POLICY IF EXISTS bot_settings_as_del ON public.bot_settings;

CREATE POLICY bot_settings_as_select ON public.bot_settings
  FOR SELECT TO authenticated
  USING (
    public.auth_user_role() IN ('admin_sucursal', 'administrador')
    AND (
      branch_id IS NULL
      OR branch_id = (SELECT p.branch_id FROM public.profiles p WHERE p.auth_user_id = auth.uid() LIMIT 1)
    )
  );

CREATE POLICY bot_settings_as_ins ON public.bot_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_user_role() IN ('admin_sucursal', 'administrador')
    AND branch_id IS NOT NULL
    AND branch_id = (SELECT p.branch_id FROM public.profiles p WHERE p.auth_user_id = auth.uid() LIMIT 1)
  );

CREATE POLICY bot_settings_as_upd ON public.bot_settings
  FOR UPDATE TO authenticated
  USING (
    public.auth_user_role() IN ('admin_sucursal', 'administrador')
    AND branch_id IS NOT NULL
    AND branch_id = (SELECT p.branch_id FROM public.profiles p WHERE p.auth_user_id = auth.uid() LIMIT 1)
  )
  WITH CHECK (
    public.auth_user_role() IN ('admin_sucursal', 'administrador')
    AND branch_id IS NOT NULL
    AND branch_id = (SELECT p.branch_id FROM public.profiles p WHERE p.auth_user_id = auth.uid() LIMIT 1)
  );

CREATE POLICY bot_settings_as_del ON public.bot_settings
  FOR DELETE TO authenticated
  USING (
    public.auth_user_role() IN ('admin_sucursal', 'administrador')
    AND branch_id IS NOT NULL
    AND branch_id = (SELECT p.branch_id FROM public.profiles p WHERE p.auth_user_id = auth.uid() LIMIT 1)
  );

CREATE OR REPLACE FUNCTION public.bot_audit_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key TEXT;
  v_branch UUID;
BEGIN
  v_key := COALESCE(NEW.key, OLD.key, NEW.title, OLD.title, NEW.code, OLD.code, TG_TABLE_NAME);
  v_branch := COALESCE(NEW.branch_id, OLD.branch_id);
  INSERT INTO public.bot_logs (level, event, event_type, message, branch_id, metadata)
  VALUES (
    'info',
    'audit',
    'audit_' || TG_TABLE_NAME,
    TG_OP || ' ' || COALESCE(v_key, TG_TABLE_NAME),
    v_branch,
    jsonb_build_object('table', TG_TABLE_NAME, 'op', TG_OP)
  );
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_bot_audit_settings ON public.bot_settings;
CREATE TRIGGER trg_bot_audit_settings
  AFTER INSERT OR UPDATE OR DELETE ON public.bot_settings
  FOR EACH ROW EXECUTE FUNCTION public.bot_audit_row();

DROP TRIGGER IF EXISTS trg_bot_audit_knowledge ON public.bot_knowledge;
CREATE TRIGGER trg_bot_audit_knowledge
  AFTER INSERT OR UPDATE OR DELETE ON public.bot_knowledge
  FOR EACH ROW EXECUTE FUNCTION public.bot_audit_row();

COMMENT ON FUNCTION public.bot_audit_row() IS
  'FASE 19: auditoría mínima en bot_logs (sin secretos ni respuestas completas)';

SELECT 'fase19 security ok' AS check;
