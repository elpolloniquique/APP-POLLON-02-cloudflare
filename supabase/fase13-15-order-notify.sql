-- =============================================================================
-- EL POLLÓN BOT — FASE 13–15
-- Trigger pedidos → bot_events (idempotencia) → bot_notification_queue
-- No toca ep_wa_*. No Meta Cloud API. No IA.
--
-- Tras ejecutar: Database Webhook (recomendado) → POST /api/bot-order-hook
-- =============================================================================

ALTER TABLE public.bot_notification_queue
  ADD COLUMN IF NOT EXISTS event_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bot_notif_event_key
  ON public.bot_notification_queue (event_key)
  WHERE event_key IS NOT NULL;

INSERT INTO public.bot_settings (branch_id, key, value) VALUES
  (NULL, 'evolution_instance', '"pollon-bot"'::jsonb),
  (NULL, 'order_notify_via_queue', 'true'::jsonb)
ON CONFLICT (key) WHERE branch_id IS NULL DO NOTHING;

-- =============================================================================
-- Encolar aviso (INSERT pedido o cambio de estado)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.bot_enqueue_pedido_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone TEXT;
  v_event_key TEXT;
  v_event_type TEXT;
  v_prev TEXT;
  v_inserted_id UUID;
BEGIN
  v_phone := NULLIF(TRIM(COALESCE(NEW.cliente_telefono, '')), '');
  IF v_phone IS NULL THEN
    v_phone := NULLIF(TRIM(COALESCE(NEW.datos_json#>>'{customer,phone}', '')), '');
  END IF;
  IF v_phone IS NULL THEN
    RETURN NEW;
  END IF;

  IF to_regprocedure('public.normalize_chile_phone(text)') IS NOT NULL THEN
    v_phone := COALESCE(public.normalize_chile_phone(v_phone), v_phone);
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_event_type := 'order_created';
    v_event_key := 'order:' || NEW.id::text || ':created';
    v_prev := NULL;
  ELSIF TG_OP = 'UPDATE' AND NEW.estado IS DISTINCT FROM OLD.estado THEN
    v_event_type := 'order_status';
    v_event_key := 'order:' || NEW.id::text || ':status:' || lower(COALESCE(NEW.estado, ''));
    v_prev := OLD.estado;
  ELSE
    RETURN NEW;
  END IF;

  BEGIN
    INSERT INTO public.bot_events (
      event_key, event_type, entity_type, entity_id, phone, status, payload
    ) VALUES (
      v_event_key,
      v_event_type,
      'pedido',
      NEW.id::text,
      v_phone,
      'pending',
      jsonb_build_object(
        'order_id', NEW.id,
        'codigo_pedido', NEW.codigo_pedido,
        'estado', NEW.estado,
        'prev_estado', v_prev,
        'branch_id', NEW.branch_id,
        'op', TG_OP
      )
    )
    RETURNING id INTO v_inserted_id;
  EXCEPTION WHEN unique_violation THEN
    RETURN NEW;
  END;

  IF v_inserted_id IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    INSERT INTO public.bot_notification_queue (
      type, phone, customer_id, order_id, branch_id, payload, status, event_key
    ) VALUES (
      v_event_type,
      v_phone,
      NEW.customer_id,
      NEW.id::text,
      NEW.branch_id,
      jsonb_build_object(
        'event_key', v_event_key,
        'codigo_pedido', NEW.codigo_pedido,
        'estado', NEW.estado,
        'prev_estado', v_prev,
        'nombre', NEW.cliente_nombre
      ),
      'pending',
      v_event_key
    );
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bot_pedido_insert ON public.pedidos;
CREATE TRIGGER trg_bot_pedido_insert
  AFTER INSERT ON public.pedidos
  FOR EACH ROW
  EXECUTE FUNCTION public.bot_enqueue_pedido_notify();

DROP TRIGGER IF EXISTS trg_bot_pedido_status ON public.pedidos;
CREATE TRIGGER trg_bot_pedido_status
  AFTER UPDATE OF estado ON public.pedidos
  FOR EACH ROW
  WHEN (NEW.estado IS DISTINCT FROM OLD.estado)
  EXECUTE FUNCTION public.bot_enqueue_pedido_notify();

COMMENT ON FUNCTION public.bot_enqueue_pedido_notify() IS
  'FASE 13–14: encola avisos WA (creación + estados) con idempotencia bot_events.event_key';

SELECT 'fase13-15 triggers ok' AS check,
  EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_bot_pedido_insert' AND tgrelid = 'public.pedidos'::regclass
  ) AS insert_trigger,
  EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_bot_pedido_status' AND tgrelid = 'public.pedidos'::regclass
  ) AS status_trigger;
