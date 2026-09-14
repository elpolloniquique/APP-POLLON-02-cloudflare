-- =============================================================================
-- EL POLLÓN IA — FASE 2 (Prompt Maestro Cloud API / serverless)
-- Migración ADITIVA. Ejecutar en Supabase → SQL Editor → Run (todo el archivo).
--
-- NO borra tablas. NO hace DROP de datos.
-- Requiere: fix-whatsapp-inteligente.sql (y fase2/fase3 antiguas si ya corrían).
-- Idempotente: se puede re-ejecutar.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- pgvector para RAG (Fase 9). Si el plan no lo permite, el resto igual funciona.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pgvector no disponible en este proyecto: %', SQLERRM;
END $$;

-- -----------------------------------------------------------------------------
-- Teléfono Chile (misma lógica que lib/whatsapp/phone.js)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.normalize_cl_phone(raw TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  digits TEXT;
BEGIN
  digits := regexp_replace(COALESCE(raw, ''), '\D', '', 'g');
  IF length(digits) < 8 THEN
    RETURN NULL;
  END IF;
  IF digits LIKE '56%' AND length(digits) >= 11 THEN
    RETURN digits;
  END IF;
  IF digits LIKE '9%' AND length(digits) = 9 THEN
    RETURN '56' || digits;
  END IF;
  IF length(digits) >= 10 THEN
    IF digits LIKE '56%' THEN
      RETURN digits;
    END IF;
    RETURN '56' || digits;
  END IF;
  RETURN NULL;
END;
$$;

-- Índice de búsqueda de pedidos por teléfono (estado / avisos)
CREATE INDEX IF NOT EXISTS idx_pedidos_cliente_telefono
  ON public.pedidos (cliente_telefono);

CREATE INDEX IF NOT EXISTS idx_profiles_phone
  ON public.profiles (phone)
  WHERE phone IS NOT NULL AND phone <> '';

-- -----------------------------------------------------------------------------
-- SETTINGS: Cloud API + personalidad (tokens NUNCA en esta tabla)
-- -----------------------------------------------------------------------------
ALTER TABLE public.ep_wa_settings
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'meta';

ALTER TABLE public.ep_wa_settings
  ADD COLUMN IF NOT EXISTS bot_name TEXT NOT NULL DEFAULT 'Pollito IA';

ALTER TABLE public.ep_wa_settings
  ADD COLUMN IF NOT EXISTS personality TEXT NOT NULL DEFAULT 'cercana';

ALTER TABLE public.ep_wa_settings
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'es-CL';

ALTER TABLE public.ep_wa_settings
  ADD COLUMN IF NOT EXISTS wa_phone_number_id TEXT;

ALTER TABLE public.ep_wa_settings
  ADD COLUMN IF NOT EXISTS wa_business_account_id TEXT;

ALTER TABLE public.ep_wa_settings
  ADD COLUMN IF NOT EXISTS wa_display_phone TEXT;

ALTER TABLE public.ep_wa_settings
  ADD COLUMN IF NOT EXISTS meta_connected BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.ep_wa_settings
  ADD COLUMN IF NOT EXISTS meta_last_webhook_at TIMESTAMPTZ;

ALTER TABLE public.ep_wa_settings
  ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.ep_wa_settings
  ADD COLUMN IF NOT EXISTS ai_provider TEXT NOT NULL DEFAULT 'none';

ALTER TABLE public.ep_wa_settings
  ADD COLUMN IF NOT EXISTS ai_model TEXT;

COMMENT ON COLUMN public.ep_wa_settings.provider IS
  'Canal WhatsApp: meta (Cloud API, serverless) | evolution (solo si hay VPS). Default meta.';
COMMENT ON COLUMN public.ep_wa_settings.wa_phone_number_id IS
  'ID público Cloud API (no es el token). El token vive en secrets de Vercel/Supabase.';
COMMENT ON COLUMN public.ep_wa_settings.ai_enabled IS
  'Fase 10. Default OFF: solo reglas + Supabase.';

UPDATE public.ep_wa_settings
SET provider = 'meta'
WHERE provider IS NULL OR provider = '';

-- Plantillas internas extra (no pisa las existentes)
UPDATE public.ep_wa_settings
SET templates = COALESCE(templates, '{}'::jsonb) || jsonb_build_object(
  'saludo_nuevo', COALESCE(templates->>'saludo_nuevo',
    '👋 ¡Hola! Bienvenido a Pollería El Pollón 🍗' || E'\n\n' ||
    'Puedo ayudarte con menú, precios, delivery, horarios, sucursales o tu pedido.' || E'\n\n' ||
    'También puedes comprar en: https://www.el-pollon.cl/' || E'\n\n' ||
    '¿En qué te ayudo?'),
  'saludo_conocido', COALESCE(templates->>'saludo_conocido',
    '👋 ¡Hola, {nombre}! Qué gusto atenderte de nuevo en El Pollón 🍗'),
  'fuera_horario', COALESCE(templates->>'fuera_horario',
    'Ahora estamos fuera de horario. Puedes pedir en https://www.el-pollon.cl/ y te avisamos aquí apenas avancemos.'),
  'humano', COALESCE(templates->>'humano',
    'Claro 😊. Dejo tu conversación disponible para nuestro equipo de atención.'),
  'despedida', COALESCE(templates->>'despedida',
    'Gracias por escribir a El Pollón. ¡Que tengas un buen día! 🍗'),
  'sin_dato', COALESCE(templates->>'sin_dato',
    'No tengo ese dato confirmado en este momento. Si quieres, te dejo con una persona del local.'),
  'ia_caida', COALESCE(templates->>'ia_caida',
    'En este momento no pude obtener esa información. Si deseas, dejo tu consulta para nuestro equipo.')
)
WHERE true;

-- -----------------------------------------------------------------------------
-- SESIONES / conversaciones (ep_wa_sessions = whatsapp_conversations)
-- -----------------------------------------------------------------------------
ALTER TABLE public.ep_wa_sessions
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.ep_wa_sessions
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open';

ALTER TABLE public.ep_wa_sessions
  ADD COLUMN IF NOT EXISTS assigned_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.ep_wa_sessions
  ADD COLUMN IF NOT EXISTS unread_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.ep_wa_sessions
  ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ;

ALTER TABLE public.ep_wa_sessions
  ADD COLUMN IF NOT EXISTS last_message_preview TEXT;

ALTER TABLE public.ep_wa_sessions
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

ALTER TABLE public.ep_wa_sessions
  ADD COLUMN IF NOT EXISTS summary TEXT;

ALTER TABLE public.ep_wa_sessions
  ADD COLUMN IF NOT EXISTS current_product TEXT;

ALTER TABLE public.ep_wa_sessions
  ADD COLUMN IF NOT EXISTS last_branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

ALTER TABLE public.ep_wa_sessions
  ADD COLUMN IF NOT EXISTS bot_enabled BOOLEAN NOT NULL DEFAULT true;

DO $$
BEGIN
  ALTER TABLE public.ep_wa_sessions
    ADD CONSTRAINT ep_wa_sessions_status_check
    CHECK (status IN ('open', 'waiting', 'human', 'closed'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

UPDATE public.ep_wa_sessions
SET status = 'human', bot_enabled = false
WHERE mode = 'human' AND status = 'open';

CREATE INDEX IF NOT EXISTS idx_ep_wa_sessions_status
  ON public.ep_wa_sessions (branch_id, status, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_ep_wa_sessions_customer
  ON public.ep_wa_sessions (customer_id)
  WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ep_wa_sessions_assigned
  ON public.ep_wa_sessions (assigned_user_id)
  WHERE assigned_user_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- MENSAJES
-- -----------------------------------------------------------------------------
ALTER TABLE public.ep_wa_messages
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.ep_wa_messages
  ADD COLUMN IF NOT EXISTS whatsapp_message_id TEXT;

ALTER TABLE public.ep_wa_messages
  ADD COLUMN IF NOT EXISTS sender_type TEXT;

ALTER TABLE public.ep_wa_messages
  ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'text';

ALTER TABLE public.ep_wa_messages
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'stored';

ALTER TABLE public.ep_wa_messages
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- direction sigue siendo in/out (código actual). No romper CHECK.

CREATE UNIQUE INDEX IF NOT EXISTS idx_ep_wa_messages_wa_id
  ON public.ep_wa_messages (whatsapp_message_id)
  WHERE whatsapp_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ep_wa_messages_customer
  ON public.ep_wa_messages (customer_id, created_at DESC)
  WHERE customer_id IS NOT NULL;

UPDATE public.ep_wa_messages
SET sender_type = CASE
  WHEN direction = 'in' THEN 'customer'
  WHEN extra ? 'employee' OR extra->>'from' = 'employee' THEN 'employee'
  WHEN extra ? 'system' THEN 'system'
  ELSE 'bot'
END
WHERE sender_type IS NULL;

-- -----------------------------------------------------------------------------
-- ALERTAS: ampliar tipos (humano)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'ep_wa_alerts'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%type%'
  LOOP
    EXECUTE format('ALTER TABLE public.ep_wa_alerts DROP CONSTRAINT %I', r.conname);
  END LOOP;

  ALTER TABLE public.ep_wa_alerts
    ADD CONSTRAINT ep_wa_alerts_type_check
    CHECK (type IN (
      'complaint', 'no_phone', 'disconnected', 'human', 'handoff', 'system'
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- CLIENTES WHATSAPP (contacto aunque no tenga cuenta web)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ep_wa_customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  phone TEXT NOT NULL,
  whatsapp_id TEXT,
  name TEXT DEFAULT '',
  profile_name TEXT DEFAULT '',
  last_branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  last_order_id TEXT,
  total_orders INTEGER NOT NULL DEFAULT 0,
  first_contact_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_contact_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  bot_enabled BOOLEAN NOT NULL DEFAULT true,
  human_mode BOOLEAN NOT NULL DEFAULT false,
  blocked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ep_wa_customers_phone
  ON public.ep_wa_customers (phone);

CREATE INDEX IF NOT EXISTS idx_ep_wa_customers_customer
  ON public.ep_wa_customers (customer_id)
  WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ep_wa_customers_branch
  ON public.ep_wa_customers (last_branch_id);

DROP TRIGGER IF EXISTS trg_ep_wa_customers_touch ON public.ep_wa_customers;
CREATE TRIGGER trg_ep_wa_customers_touch
  BEFORE UPDATE ON public.ep_wa_customers
  FOR EACH ROW EXECUTE FUNCTION public.ep_wa_touch_updated_at();

-- Backfill desde sesiones existentes
INSERT INTO public.ep_wa_customers (phone, name, last_branch_id, last_order_id, last_contact_at, first_contact_at, human_mode, bot_enabled)
SELECT DISTINCT ON (s.phone)
  s.phone,
  COALESCE(s.last_name, ''),
  s.branch_id,
  s.last_order_id,
  COALESCE(s.updated_at, s.created_at),
  s.created_at,
  s.mode = 'human',
  COALESCE(s.bot_enabled, s.mode <> 'human')
FROM public.ep_wa_sessions s
WHERE s.phone IS NOT NULL AND s.phone <> ''
ORDER BY s.phone, s.updated_at DESC
ON CONFLICT (phone) DO NOTHING;

-- -----------------------------------------------------------------------------
-- bot_events — idempotencia (order_1548_en_delivery)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bot_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_key TEXT NOT NULL,
  event_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  processed BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMPTZ,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bot_events_key ON public.bot_events (event_key);
CREATE INDEX IF NOT EXISTS idx_bot_events_entity ON public.bot_events (entity_type, entity_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- notification_queue — reintentos (sin infinito)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL,
  recipient TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notification_queue_pending
  ON public.notification_queue (status, next_attempt_at)
  WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_notification_queue_recipient
  ON public.notification_queue (recipient, created_at DESC);

-- -----------------------------------------------------------------------------
-- bot_logs
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bot_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'warning', 'error')),
  event TEXT NOT NULL,
  conversation_id UUID,
  customer_id UUID,
  order_id TEXT,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  message TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_logs_created ON public.bot_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_logs_level ON public.bot_logs (level, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_logs_branch ON public.bot_logs (branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_logs_conversation ON public.bot_logs (conversation_id)
  WHERE conversation_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- bot_knowledge — RAG (embeddings en Fase 9)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bot_knowledge (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'general',
  content TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'manual',
  source_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_knowledge_active ON public.bot_knowledge (active, category);
CREATE INDEX IF NOT EXISTS idx_bot_knowledge_branch ON public.bot_knowledge (branch_id);

DROP TRIGGER IF EXISTS trg_bot_knowledge_touch ON public.bot_knowledge;
CREATE TRIGGER trg_bot_knowledge_touch
  BEFORE UPDATE ON public.bot_knowledge
  FOR EACH ROW EXECUTE FUNCTION public.ep_wa_touch_updated_at();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    BEGIN
      ALTER TABLE public.bot_knowledge ADD COLUMN IF NOT EXISTS embedding vector(1536);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'No se pudo añadir embedding vector: %', SQLERRM;
    END;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Uso IA (Fase 10 / costos)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bot_ai_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider TEXT,
  model TEXT,
  reason TEXT,
  conversation_id UUID,
  tokens_in INTEGER,
  tokens_out INTEGER,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_ai_usage_created ON public.bot_ai_usage (created_at DESC);

-- -----------------------------------------------------------------------------
-- RLS nuevas tablas
-- -----------------------------------------------------------------------------
ALTER TABLE public.ep_wa_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_ai_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ep_wa_customers_sa ON public.ep_wa_customers;
CREATE POLICY ep_wa_customers_sa ON public.ep_wa_customers
  FOR ALL TO authenticated
  USING (public.auth_user_role() = 'super_admin')
  WITH CHECK (public.auth_user_role() = 'super_admin');

DROP POLICY IF EXISTS ep_wa_customers_as ON public.ep_wa_customers;
CREATE POLICY ep_wa_customers_as ON public.ep_wa_customers
  FOR ALL TO authenticated
  USING (
    public.auth_user_role() IN ('admin_sucursal', 'administrador')
    AND last_branch_id = (SELECT p.branch_id FROM public.profiles p WHERE p.auth_user_id = auth.uid() LIMIT 1)
  )
  WITH CHECK (
    public.auth_user_role() IN ('admin_sucursal', 'administrador')
    AND last_branch_id = (SELECT p.branch_id FROM public.profiles p WHERE p.auth_user_id = auth.uid() LIMIT 1)
  );

DROP POLICY IF EXISTS bot_events_sa ON public.bot_events;
CREATE POLICY bot_events_sa ON public.bot_events
  FOR ALL TO authenticated
  USING (public.auth_user_role() = 'super_admin')
  WITH CHECK (public.auth_user_role() = 'super_admin');

DROP POLICY IF EXISTS bot_events_as_select ON public.bot_events;
CREATE POLICY bot_events_as_select ON public.bot_events
  FOR SELECT TO authenticated
  USING (public.auth_user_role() IN ('admin_sucursal', 'administrador', 'super_admin'));

DROP POLICY IF EXISTS notification_queue_sa ON public.notification_queue;
CREATE POLICY notification_queue_sa ON public.notification_queue
  FOR ALL TO authenticated
  USING (public.auth_user_role() = 'super_admin')
  WITH CHECK (public.auth_user_role() = 'super_admin');

DROP POLICY IF EXISTS bot_logs_sa ON public.bot_logs;
CREATE POLICY bot_logs_sa ON public.bot_logs
  FOR ALL TO authenticated
  USING (public.auth_user_role() = 'super_admin')
  WITH CHECK (public.auth_user_role() = 'super_admin');

DROP POLICY IF EXISTS bot_logs_as_select ON public.bot_logs;
CREATE POLICY bot_logs_as_select ON public.bot_logs
  FOR SELECT TO authenticated
  USING (
    public.auth_user_role() IN ('admin_sucursal', 'administrador')
    AND (
      branch_id IS NULL
      OR branch_id = (SELECT p.branch_id FROM public.profiles p WHERE p.auth_user_id = auth.uid() LIMIT 1)
    )
  );

DROP POLICY IF EXISTS bot_knowledge_sa ON public.bot_knowledge;
CREATE POLICY bot_knowledge_sa ON public.bot_knowledge
  FOR ALL TO authenticated
  USING (public.auth_user_role() = 'super_admin')
  WITH CHECK (public.auth_user_role() = 'super_admin');

DROP POLICY IF EXISTS bot_knowledge_as ON public.bot_knowledge;
CREATE POLICY bot_knowledge_as ON public.bot_knowledge
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
    AND (
      branch_id IS NULL
      OR branch_id = (SELECT p.branch_id FROM public.profiles p WHERE p.auth_user_id = auth.uid() LIMIT 1)
    )
  );

DROP POLICY IF EXISTS bot_ai_usage_sa ON public.bot_ai_usage;
CREATE POLICY bot_ai_usage_sa ON public.bot_ai_usage
  FOR ALL TO authenticated
  USING (public.auth_user_role() = 'super_admin')
  WITH CHECK (public.auth_user_role() = 'super_admin');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ep_wa_customers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_queue TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_knowledge TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_ai_usage TO authenticated;

GRANT ALL ON public.ep_wa_customers TO service_role;
GRANT ALL ON public.bot_events TO service_role;
GRANT ALL ON public.notification_queue TO service_role;
GRANT ALL ON public.bot_logs TO service_role;
GRANT ALL ON public.bot_knowledge TO service_role;
GRANT ALL ON public.bot_ai_usage TO service_role;

-- -----------------------------------------------------------------------------
-- Realtime inbox
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.ep_wa_messages;
EXCEPTION WHEN duplicate_object THEN NULL;
WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.ep_wa_customers;
EXCEPTION WHEN duplicate_object THEN NULL;
WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_events;
EXCEPTION WHEN duplicate_object THEN NULL;
WHEN undefined_object THEN NULL;
END $$;

COMMENT ON TABLE public.ep_wa_customers IS 'Contactos WhatsApp (prompt: whatsapp_customers). Relaciona phone ↔ profiles.';
COMMENT ON TABLE public.bot_events IS 'Idempotencia de avisos/webhooks. event_key único.';
COMMENT ON TABLE public.notification_queue IS 'Reintentos de envío WhatsApp. Máx. 5 intentos.';
COMMENT ON TABLE public.bot_knowledge IS 'Base de conocimiento RAG. Embeddings en Fase 9.';
COMMENT ON TABLE public.bot_logs IS 'Logs del bot. Nunca guardar tokens ni service_role.';
