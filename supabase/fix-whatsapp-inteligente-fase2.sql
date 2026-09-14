-- =============================================================================
-- EL POLLÓN — WhatsApp Inteligente FASE 2 (aditivo)
-- Métricas (se calculan de tablas F1) + foto de plato + Ollama local OFF
-- Ejecutar DESPUÉS de fix-whatsapp-inteligente.sql
-- =============================================================================

ALTER TABLE public.ep_wa_settings
  ADD COLUMN IF NOT EXISTS ollama_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.ep_wa_settings
  ADD COLUMN IF NOT EXISTS ollama_model TEXT NOT NULL DEFAULT 'llama3.2';

-- Anti-spam foto: 1 imagen por plato/chat, no repetir enseguida
ALTER TABLE public.ep_wa_sessions
  ADD COLUMN IF NOT EXISTS last_photo_product_id TEXT;

ALTER TABLE public.ep_wa_sessions
  ADD COLUMN IF NOT EXISTS last_photo_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_ep_wa_outbox_order_event
  ON public.ep_wa_outbox (order_id, event);

CREATE INDEX IF NOT EXISTS idx_ep_wa_alerts_type_created
  ON public.ep_wa_alerts (type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ep_wa_messages_branch_dir_created
  ON public.ep_wa_messages (branch_id, direction, created_at DESC);

COMMENT ON COLUMN public.ep_wa_settings.ollama_enabled IS
  'Fase 2: reescritura local con Ollama SOLO en fallback. Default OFF. Cero LLM de pago.';
COMMENT ON COLUMN public.ep_wa_settings.enviar_foto_plato IS
  'Fase 2: enviar 1 foto pública del plato (máx. 1, sin spam). Default OFF.';
