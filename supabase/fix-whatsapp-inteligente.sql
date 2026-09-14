-- =============================================================================
-- EL POLLÓN — WhatsApp Inteligente (concierge + avisos + FAQ + quejas)
-- Ejecutar en Supabase → SQL Editor (idempotente)
-- Solo super_admin ve/edita estas tablas vía RLS.
-- Los webhooks usan SERVICE_ROLE (bypassa RLS).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- SETTINGS por sucursal
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ep_wa_settings (
  branch_id UUID PRIMARY KEY REFERENCES public.branches(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  modo_proactivo BOOLEAN NOT NULL DEFAULT false,
  avisos_en_modo_humano BOOLEAN NOT NULL DEFAULT true,
  enviar_foto_plato BOOLEAN NOT NULL DEFAULT false,
  usar_horario_sucursal BOOLEAN NOT NULL DEFAULT true,
  bot_24_7 BOOLEAN NOT NULL DEFAULT false,
  bot_from TEXT,
  bot_to TEXT,
  human_timeout_min INTEGER NOT NULL DEFAULT 120,
  contar_compras_solo_sucursal BOOLEAN NOT NULL DEFAULT true,
  lookback_hours INTEGER NOT NULL DEFAULT 48,
  rate_limit_per_min INTEGER NOT NULL DEFAULT 4,
  link_web TEXT NOT NULL DEFAULT 'https://www.el-pollon.cl/',
  evolution_instance TEXT,
  connected BOOLEAN NOT NULL DEFAULT false,
  connected_phone TEXT,
  last_qr_at TIMESTAMPTZ,
  templates JSONB NOT NULL DEFAULT '{}'::jsonb,
  complaint_keywords TEXT[] NOT NULL DEFAULT ARRAY[
    'reclamo','queja','malo','mala','fría','fria','frío','frio','crudo',
    'demora','tarde','horrible','asco','nunca más','nunca mas','estafa',
    'mal servicio','no llegó','no llego','faltó','falto','pelo','sucio','sucia'
  ],
  loyalty_tiers JSONB NOT NULL DEFAULT '[
    {"n":1,"text":"Qué gusto atenderte."},
    {"n":2,"text":"Qué alegría tenerte de nuevo."},
    {"n":3,"text":"Gracias por tu tercera compra con nosotros, se agradece de verdad."},
    {"n":5,"text":"Ya eres de la casa en {sucursal}. ¡Gracias por volver!"},
    {"n":10,"text":"Diez pedidos con nosotros en {sucursal}: eres de la familia Pollón. 🙏"}
  ]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ep_wa_settings_instance
  ON public.ep_wa_settings (evolution_instance)
  WHERE evolution_instance IS NOT NULL;

-- -----------------------------------------------------------------------------
-- KB (entrenamiento local)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ep_wa_kb (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  keywords TEXT[] NOT NULL DEFAULT '{}',
  pregunta TEXT NOT NULL DEFAULT '',
  respuesta TEXT NOT NULL DEFAULT '',
  intent_hint TEXT,
  activa BOOLEAN NOT NULL DEFAULT true,
  prioridad INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ep_wa_kb_branch ON public.ep_wa_kb (branch_id);
CREATE INDEX IF NOT EXISTS idx_ep_wa_kb_activa ON public.ep_wa_kb (activa);

-- -----------------------------------------------------------------------------
-- SESIONES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ep_wa_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone TEXT NOT NULL,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'bot' CHECK (mode IN ('bot', 'human')),
  human_until TIMESTAMPTZ,
  last_order_id TEXT,
  order_count_cache INTEGER NOT NULL DEFAULT 0,
  last_name TEXT DEFAULT '',
  last_intent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (phone, branch_id)
);

CREATE INDEX IF NOT EXISTS idx_ep_wa_sessions_branch ON public.ep_wa_sessions (branch_id);
CREATE INDEX IF NOT EXISTS idx_ep_wa_sessions_phone ON public.ep_wa_sessions (phone);

-- -----------------------------------------------------------------------------
-- MENSAJES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ep_wa_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES public.ep_wa_sessions(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  phone TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  body TEXT NOT NULL DEFAULT '',
  intent TEXT,
  extra JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ep_wa_messages_session ON public.ep_wa_messages (session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ep_wa_messages_branch ON public.ep_wa_messages (branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ep_wa_messages_phone ON public.ep_wa_messages (phone, created_at DESC);

-- -----------------------------------------------------------------------------
-- OUTBOX (idempotencia avisos)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ep_wa_outbox (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id TEXT NOT NULL,
  event TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'error')),
  sent_at TIMESTAMPTZ,
  error_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (order_id, event)
);

CREATE INDEX IF NOT EXISTS idx_ep_wa_outbox_status ON public.ep_wa_outbox (status, created_at);

-- -----------------------------------------------------------------------------
-- ALERTAS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ep_wa_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN ('complaint', 'no_phone', 'disconnected')),
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  order_id TEXT,
  phone TEXT,
  preview TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ep_wa_alerts_unread
  ON public.ep_wa_alerts (branch_id, created_at DESC)
  WHERE read_at IS NULL;

-- -----------------------------------------------------------------------------
-- updated_at
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ep_wa_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ep_wa_settings_touch ON public.ep_wa_settings;
CREATE TRIGGER trg_ep_wa_settings_touch
  BEFORE UPDATE ON public.ep_wa_settings
  FOR EACH ROW EXECUTE FUNCTION public.ep_wa_touch_updated_at();

DROP TRIGGER IF EXISTS trg_ep_wa_kb_touch ON public.ep_wa_kb;
CREATE TRIGGER trg_ep_wa_kb_touch
  BEFORE UPDATE ON public.ep_wa_kb
  FOR EACH ROW EXECUTE FUNCTION public.ep_wa_touch_updated_at();

DROP TRIGGER IF EXISTS trg_ep_wa_sessions_touch ON public.ep_wa_sessions;
CREATE TRIGGER trg_ep_wa_sessions_touch
  BEFORE UPDATE ON public.ep_wa_sessions
  FOR EACH ROW EXECUTE FUNCTION public.ep_wa_touch_updated_at();

-- -----------------------------------------------------------------------------
-- Seed settings por sucursal activa
-- -----------------------------------------------------------------------------
INSERT INTO public.ep_wa_settings (branch_id, evolution_instance)
SELECT b.id, 'ep_' || replace(b.id::text, '-', '')
FROM public.branches b
ON CONFLICT (branch_id) DO NOTHING;

-- KB global de arranque (branch_id NULL = todas)
INSERT INTO public.ep_wa_kb (branch_id, title, keywords, pregunta, respuesta, intent_hint, prioridad)
SELECT NULL, v.title, v.keywords, v.pregunta, v.respuesta, v.intent_hint, v.prioridad
FROM (VALUES
  (
    'Formas de pago',
    ARRAY['pago','pagar','efectivo','transferencia','tarjeta','webpay'],
    'como se paga',
    'En El Pollón el pago es *al recibir*: *efectivo* o *transferencia*. No cobramos con tarjeta en la web ni por WhatsApp. Los datos de transferencia te los entrega el local o el repartidor al momento de la entrega.',
    'como_comprar',
    40
  ),
  (
    'Cómo pedir en la web',
    ARRAY['como pido','cómo pido','pagina','página','web','carrito'],
    'como pedir',
    'Pide en {link_web}: 1) elige sucursal 2) arma el carrito 3) confirma. Luego te avisamos aquí cocina, reparto y entrega. Tienda de esta sucursal: {link_tienda}',
    'como_comprar',
    30
  ),
  (
    'Seguimiento',
    ARRAY['seguimiento','rastrear','donde va','dónde va','tracking'],
    'seguir pedido',
    'Si me pasas el código (#000123) te digo el estado. También puedes seguirlo en {link_seguimiento} si ya tienes cuenta.',
    'estado_pedido',
    25
  ),
  (
    'Libro de reclamaciones',
    ARRAY['libro de reclamaciones','reclamo formal','sernac'],
    'libro de reclamaciones',
    'Puedes dejar un reclamo formal en {link_web}libro-reclamaciones. Si prefieres, te paso ahora con un encargado de {sucursal}.',
    'kb',
    20
  )
) AS v(title, keywords, pregunta, respuesta, intent_hint, prioridad)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ep_wa_kb k WHERE k.branch_id IS NULL AND k.title = v.title
);

-- -----------------------------------------------------------------------------
-- RLS — solo super_admin
-- -----------------------------------------------------------------------------
ALTER TABLE public.ep_wa_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ep_wa_kb ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ep_wa_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ep_wa_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ep_wa_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ep_wa_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ep_wa_settings_sa ON public.ep_wa_settings;
CREATE POLICY ep_wa_settings_sa ON public.ep_wa_settings
  FOR ALL TO authenticated
  USING (public.auth_user_role() = 'super_admin')
  WITH CHECK (public.auth_user_role() = 'super_admin');

DROP POLICY IF EXISTS ep_wa_kb_sa ON public.ep_wa_kb;
CREATE POLICY ep_wa_kb_sa ON public.ep_wa_kb
  FOR ALL TO authenticated
  USING (public.auth_user_role() = 'super_admin')
  WITH CHECK (public.auth_user_role() = 'super_admin');

DROP POLICY IF EXISTS ep_wa_sessions_sa ON public.ep_wa_sessions;
CREATE POLICY ep_wa_sessions_sa ON public.ep_wa_sessions
  FOR ALL TO authenticated
  USING (public.auth_user_role() = 'super_admin')
  WITH CHECK (public.auth_user_role() = 'super_admin');

DROP POLICY IF EXISTS ep_wa_messages_sa ON public.ep_wa_messages;
CREATE POLICY ep_wa_messages_sa ON public.ep_wa_messages
  FOR ALL TO authenticated
  USING (public.auth_user_role() = 'super_admin')
  WITH CHECK (public.auth_user_role() = 'super_admin');

DROP POLICY IF EXISTS ep_wa_outbox_sa ON public.ep_wa_outbox;
CREATE POLICY ep_wa_outbox_sa ON public.ep_wa_outbox
  FOR ALL TO authenticated
  USING (public.auth_user_role() = 'super_admin')
  WITH CHECK (public.auth_user_role() = 'super_admin');

DROP POLICY IF EXISTS ep_wa_alerts_sa ON public.ep_wa_alerts;
CREATE POLICY ep_wa_alerts_sa ON public.ep_wa_alerts
  FOR ALL TO authenticated
  USING (public.auth_user_role() = 'super_admin')
  WITH CHECK (public.auth_user_role() = 'super_admin');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ep_wa_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ep_wa_kb TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ep_wa_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ep_wa_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ep_wa_outbox TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ep_wa_alerts TO authenticated;

GRANT ALL ON public.ep_wa_settings TO service_role;
GRANT ALL ON public.ep_wa_kb TO service_role;
GRANT ALL ON public.ep_wa_sessions TO service_role;
GRANT ALL ON public.ep_wa_messages TO service_role;
GRANT ALL ON public.ep_wa_outbox TO service_role;
GRANT ALL ON public.ep_wa_alerts TO service_role;

-- -----------------------------------------------------------------------------
-- Realtime opcional (panel LIVE)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.ep_wa_alerts;
EXCEPTION WHEN duplicate_object THEN NULL;
WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.ep_wa_sessions;
EXCEPTION WHEN duplicate_object THEN NULL;
WHEN undefined_object THEN NULL;
END $$;

-- Fase 2 (idempotente): Ollama OFF + anti-spam foto
ALTER TABLE public.ep_wa_settings
  ADD COLUMN IF NOT EXISTS ollama_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.ep_wa_settings
  ADD COLUMN IF NOT EXISTS ollama_model TEXT NOT NULL DEFAULT 'llama3.2';
ALTER TABLE public.ep_wa_sessions
  ADD COLUMN IF NOT EXISTS last_photo_product_id TEXT;
ALTER TABLE public.ep_wa_sessions
  ADD COLUMN IF NOT EXISTS last_photo_at TIMESTAMPTZ;
