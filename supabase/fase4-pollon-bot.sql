-- =============================================================================
-- EL POLLÓN BOT — FASE 4 migraciones (Prompt Maestro Definitivo)
-- Supabase = cerebro. SIN IA. SIN Meta Cloud API. SIN DROP destructivo.
--
-- Ejecutar TODO el archivo en SQL Editor → Run (idempotente).
-- No borra ep_wa_*, pedidos, products, ni bot_ai_usage (si existe, se ignora).
-- Si corriste fase2-pollon-ia.sql: se hace ALTER de bot_knowledge / bot_events / bot_logs.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bot_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.bot_normalize_text(raw TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT btrim(regexp_replace(
    lower(public.unaccent(COALESCE(raw, ''))),
    '[^a-z0-9ñáéíóúü\s]+',
    ' ',
    'g'
  ));
$$;

-- Teléfono Chile → +569XXXXXXXX. No fuerza +56 si el número es internacional.
CREATE OR REPLACE FUNCTION public.normalize_chile_phone(raw TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  digits TEXT;
  trimmed TEXT;
BEGIN
  trimmed := btrim(COALESCE(raw, ''));
  IF trimmed = '' THEN
    RETURN NULL;
  END IF;
  digits := regexp_replace(trimmed, '\D', '', 'g');
  IF left(digits, 1) = '0' AND length(digits) >= 9 THEN
    digits := substr(digits, 2);
  END IF;
  IF digits ~ '^9[0-9]{8}$' THEN
    RETURN '+56' || digits;
  END IF;
  IF digits ~ '^569[0-9]{8}$' THEN
    RETURN '+' || digits;
  END IF;
  IF digits LIKE '56%' AND length(digits) BETWEEN 10 AND 12 THEN
    RETURN '+' || digits;
  END IF;
  IF trimmed LIKE '+%' AND left(digits, 2) <> '56' AND length(digits) BETWEEN 8 AND 15 THEN
    RETURN '+' || digits;
  END IF;
  RETURN NULL;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_pedidos_cliente_telefono
  ON public.pedidos (cliente_telefono);

-- =============================================================================
-- bot_settings (key / value, global o por sucursal)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.bot_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB NOT NULL DEFAULT 'null'::jsonb,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bot_settings_global_key
  ON public.bot_settings (key) WHERE branch_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_bot_settings_branch_key
  ON public.bot_settings (branch_id, key) WHERE branch_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_bot_settings_touch ON public.bot_settings;
CREATE TRIGGER trg_bot_settings_touch
  BEFORE UPDATE ON public.bot_settings
  FOR EACH ROW EXECUTE FUNCTION public.bot_touch_updated_at();

INSERT INTO public.bot_settings (branch_id, key, value) VALUES
  (NULL, 'bot_enabled', 'true'::jsonb),
  (NULL, 'bot_name', '"Pollito"'::jsonb),
  (NULL, 'website_url', '"https://www.el-pollon.cl/"'::jsonb),
  (NULL, 'support_phone', '"+56986925310"'::jsonb),
  (NULL, 'support_message', '"Si necesitas atención directa, llama o escribe al {support_phone}."'::jsonb),
  (NULL, 'minimum_confidence', '0.80'::jsonb),
  (NULL, 'order_created_enabled', 'true'::jsonb),
  (NULL, 'order_status_enabled', 'true'::jsonb),
  (NULL, 'human_support_enabled', 'true'::jsonb),
  (NULL, 'rate_limit_per_min', '4'::jsonb),
  (NULL, 'unknown_response', '"Gracias por escribirnos 😊. No tengo una respuesta confirmada para esa consulta en este momento.\n\nHe registrado tu pregunta para que nuestro equipo pueda incorporarla a mi información.\n\nSi necesitas atención directa, puedes comunicarte al {support_phone}."'::jsonb),
  (NULL, 'how_to_buy', '"Así puedes pedir en El Pollón:\n\n1. Entra a {website}\n2. Elige tu sucursal\n3. Arma tu carrito en la tienda\n4. Completa nombre, teléfono y dirección (si es delivery)\n5. Elige delivery, retiro o reserva\n6. Paga al recibir: efectivo o transferencia\n7. Confirma. Te daremos un código de seguimiento (ej. #001548).\n\nSi tienes cuenta, también puedes ver el pedido en {website}cuenta/pedidos"'::jsonb),
  (NULL, 'templates', '{
    "greeting": [
      "👋 ¡Hola{nombre_coma}! Bienvenido a Pollería El Pollón 🍗. Puedo ayudarte con menú, precios, horarios, delivery, sucursales o tu pedido.\n\nTambién puedes comprar en: {website}",
      "¡Hola{nombre_coma}! 😊 Gracias por escribir a El Pollón. Estoy aquí para ayudarte con el menú, delivery u tu pedido.\n\nPide en: {website}",
      "👋 ¡Hola! Bienvenido a El Pollón. ¿Te ayudo con el menú, horarios, delivery o a revisar tu pedido?\n\nCompra en: {website}"
    ],
    "goodbye": ["¡Hasta luego! Gracias por preferir El Pollón 🍗"],
    "thanks": ["¡Con gusto! Si necesitas algo más, aquí estoy 😊"],
    "complaint": "Lamentamos mucho lo ocurrido{nombre_coma}. Queremos revisar tu caso correctamente.\n\nPor favor comunícate con nuestro equipo al: {support_phone}\n\nSi tienes número de pedido, indícalo (ej. #001548).",
    "human": "Claro 😊. Dejo tu conversación disponible para nuestro equipo. También puedes llamar al {support_phone}.",
    "order_created": "🍗 ¡Hola{nombre_coma}!\n\nTu pedido fue registrado correctamente en El Pollón. ✅\n\n🧾 Pedido N.º {pedido}\n🔎 Seguimiento: #{pedido}\n\n{detalle}\n\nSubtotal: {subtotal}\nDelivery: {delivery}\nTotal: {total}\n\n🏪 Sucursal: {sucursal}\n\nTe avisaremos aquí sobre el avance. ¡Gracias por preferir El Pollón!",
    "pendiente": "✅ {nombre}, recibimos tu pedido N.º {pedido}. Ya lo estamos revisando.",
    "aceptado": "✅ {nombre}, tu pedido N.º {pedido} fue aceptado.",
    "confirmado": "✅ {nombre}, tu pedido N.º {pedido} fue confirmado correctamente.",
    "preparando": "👨‍🍳 {nombre}, tu pedido N.º {pedido} ya está en preparación.",
    "listo": "🍗 ¡Tu pedido N.º {pedido} ya está listo!",
    "en_delivery": "🛵 {nombre}, tu pedido N.º {pedido} ya va en camino.",
    "entregado": "✅ {nombre}, tu pedido N.º {pedido} fue entregado correctamente.\n\nMuchas gracias por preferir El Pollón. 🍗",
    "cancelado": "{nombre}, tu pedido N.º {pedido} fue cancelado. Si fue un error, escríbenos o llama al {support_phone}."
  }'::jsonb)
ON CONFLICT (key) WHERE branch_id IS NULL DO NOTHING;

-- =============================================================================
-- bot_synonyms
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.bot_synonyms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  canonical TEXT NOT NULL,
  aliases TEXT[] NOT NULL DEFAULT '{}',
  category TEXT NOT NULL DEFAULT 'general',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bot_synonyms_canonical
  ON public.bot_synonyms (lower(canonical));
CREATE INDEX IF NOT EXISTS idx_bot_synonyms_aliases_gin
  ON public.bot_synonyms USING GIN (aliases);

DROP TRIGGER IF EXISTS trg_bot_synonyms_touch ON public.bot_synonyms;
CREATE TRIGGER trg_bot_synonyms_touch
  BEFORE UPDATE ON public.bot_synonyms
  FOR EACH ROW EXECUTE FUNCTION public.bot_touch_updated_at();

INSERT INTO public.bot_synonyms (canonical, aliases, category)
SELECT v.canonical, v.aliases, v.category
FROM (VALUES
  ('precio', ARRAY['valor','cuesta','sale','vale','presio','cuanto','cuánto','cobran'], 'producto'),
  ('delivery', ARRAY['envio','envío','despacho','reparto','delibery','delivery','llevarlo','traer','despacho a domicilio'], 'delivery'),
  ('comprar', ARRAY['pedir','ordenar','hacer pedido','como pido','cómo pido','quiero pedir'], 'compra'),
  ('pollo entero', ARRAY['pollo','entero','un pollo','pollo completo'], 'producto'),
  ('cuarto', ARRAY['1/4','cuarto pollo','cuarto de pollo','1/4 pollo','cuato'], 'producto'),
  ('medio', ARRAY['1/2','medio pollo','media'], 'producto'),
  ('horario', ARRAY['abierto','abiertos','cierran','atienden','hora'], 'sucursal'),
  ('sucursal', ARRAY['local','direccion','dirección','donde estan','dónde están','ubicacion','ubicación'], 'sucursal'),
  ('pedido', ARRAY['mi pedido','seguimiento','tracking','donde va','dónde va','estado'], 'pedido'),
  ('humano', ARRAY['persona','alguien','encargado','administrador','ejecutivo','hablar con alguien'], 'soporte'),
  ('reclamo', ARRAY['queja','malo','faltante','problema','cobro incorrecto','pedido malo'], 'soporte')
) AS v(canonical, aliases, category)
WHERE NOT EXISTS (
  SELECT 1 FROM public.bot_synonyms s WHERE lower(s.canonical) = lower(v.canonical)
);

-- =============================================================================
-- bot_intents
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.bot_intents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  keywords TEXT[] NOT NULL DEFAULT '{}',
  patterns TEXT[] NOT NULL DEFAULT '{}',
  examples TEXT[] NOT NULL DEFAULT '{}',
  priority INTEGER NOT NULL DEFAULT 100,
  handler TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT true,
  templates JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bot_intents_code ON public.bot_intents (code);
CREATE INDEX IF NOT EXISTS idx_bot_intents_active ON public.bot_intents (active, priority);

DROP TRIGGER IF EXISTS trg_bot_intents_touch ON public.bot_intents;
CREATE TRIGGER trg_bot_intents_touch
  BEFORE UPDATE ON public.bot_intents
  FOR EACH ROW EXECUTE FUNCTION public.bot_touch_updated_at();

INSERT INTO public.bot_intents (code, label, keywords, examples, priority, handler) VALUES
  ('GREETING', 'Saludo', ARRAY['hola','buenas','buenos dias','buenos días','buenas tardes','buenas noches','hey'], ARRAY['hola','buenas'], 10, 'handleGreeting'),
  ('GOODBYE', 'Despedida', ARRAY['chao','adios','adiós','hasta luego','nos vemos'], ARRAY['chao'], 15, 'handleGoodbye'),
  ('THANKS', 'Agradecimiento', ARRAY['gracias','muchas gracias','se agradece'], ARRAY['gracias'], 20, 'handleThanks'),
  ('HUMAN_SUPPORT', 'Hablar con persona', ARRAY['persona','alguien','encargado','administrador','ejecutivo','hablar con alguien'], ARRAY['quiero hablar con alguien'], 25, 'handleHumanSupport'),
  ('COMPLAINT', 'Reclamo', ARRAY['reclamo','queja','malo','faltante','problema','cobro incorrecto','pedido malo','llegó mal','llego mal'], ARRAY['mi pedido llegó mal'], 30, 'handleComplaint'),
  ('ORDER_STATUS', 'Estado pedido', ARRAY['mi pedido','estado','seguimiento','donde va','dónde va','como va','cómo va','ya salio','ya salió'], ARRAY['cómo va mi pedido'], 40, 'handleOrderStatus'),
  ('ORDER_DETAILS', 'Detalle pedido', ARRAY['detalle pedido','que pedi','qué pedí','mi orden'], ARRAY['qué pedí'], 45, 'handleOrderDetails'),
  ('ORDER_TRACKING', 'Seguimiento', ARRAY['tracking','codigo de seguimiento','código de seguimiento','rastrear'], ARRAY['mi seguimiento'], 46, 'handleOrderStatus'),
  ('HOW_TO_BUY', 'Cómo comprar', ARRAY['como compro','cómo compro','como pido','cómo pido','quiero pedir','deseo comprar','hacer pedido'], ARRAY['cómo hago un pedido'], 50, 'handleHowToBuy'),
  ('PAYMENT_METHOD', 'Pago', ARRAY['pago','pagar','efectivo','transferencia','webpay','tarjeta'], ARRAY['cómo se paga'], 55, 'handlePayment'),
  ('PRODUCT_PRICE', 'Precio producto', ARRAY['precio','cuanto','cuánto','vale','cuesta','sale','presio'], ARRAY['cuánto cuesta el cuarto'], 60, 'handleProductPrice'),
  ('PRODUCT_SEARCH', 'Buscar producto', ARRAY['tienen','hay','menu','menú','carta','pollo','cuarto','combo','chaufa'], ARRAY['tienen pollo entero'], 70, 'handleProductSearch'),
  ('MENU', 'Menú', ARRAY['menu','menú','carta','que venden','qué venden'], ARRAY['qué tienen'], 75, 'handleProductSearch'),
  ('PROMOTION', 'Promoción', ARRAY['promo','promocion','promoción','oferta','descuento'], ARRAY['tienen promos'], 80, 'handlePromotion'),
  ('DELIVERY_PRICE', 'Precio delivery', ARRAY['cuanto delivery','cuánto delivery','valor despacho','cuesta el envio','cuesta el envío'], ARRAY['cuánto sale delivery'], 85, 'handleDelivery'),
  ('DELIVERY_ZONE', 'Zona delivery', ARRAY['llegan','zona','sector','cobertura','hacen delivery'], ARRAY['llegan a mi sector'], 86, 'handleDelivery'),
  ('DELIVERY', 'Delivery', ARRAY['delivery','despacho','envio','envío','reparto','delibery'], ARRAY['hacen delivery'], 90, 'handleDelivery'),
  ('OPENING_HOURS', 'Horario', ARRAY['horario','abierto','cierran','atienden','hora'], ARRAY['a qué hora cierran'], 95, 'handleHours'),
  ('BRANCH_ADDRESS', 'Dirección sucursal', ARRAY['direccion','dirección','donde estan','dónde están','ubicados'], ARRAY['dónde están'], 100, 'handleBranch'),
  ('BRANCH', 'Sucursal', ARRAY['sucursal','local','iquique','alto hospicio'], ARRAY['qué sucursales tienen'], 105, 'handleBranch'),
  ('CONTACT', 'Contacto', ARRAY['telefono','teléfono','whatsapp','contacto','llamar'], ARRAY['cuál es el teléfono'], 110, 'handleContact'),
  ('FAQ', 'FAQ memoria', ARRAY[]::TEXT[], ARRAY[]::TEXT[], 800, 'handleKnowledgeSearch'),
  ('UNKNOWN', 'Desconocido', ARRAY[]::TEXT[], ARRAY[]::TEXT[], 999, 'handleUnknown')
ON CONFLICT (code) DO NOTHING;

-- =============================================================================
-- bot_knowledge (crear o ampliar si viene de fase2-pollon-ia)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.bot_knowledge (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'general',
  content TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT true,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bot_knowledge ADD COLUMN IF NOT EXISTS question TEXT NOT NULL DEFAULT '';
ALTER TABLE public.bot_knowledge ADD COLUMN IF NOT EXISTS answer TEXT NOT NULL DEFAULT '';
ALTER TABLE public.bot_knowledge ADD COLUMN IF NOT EXISTS keywords TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.bot_knowledge ADD COLUMN IF NOT EXISTS synonyms TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.bot_knowledge ADD COLUMN IF NOT EXISTS variants TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.bot_knowledge ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE public.bot_knowledge ADD COLUMN IF NOT EXISTS source_name TEXT;
ALTER TABLE public.bot_knowledge ADD COLUMN IF NOT EXISTS storage_path TEXT;
ALTER TABLE public.bot_knowledge ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 100;
ALTER TABLE public.bot_knowledge ADD COLUMN IF NOT EXISTS times_used INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.bot_knowledge ADD COLUMN IF NOT EXISTS times_matched INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.bot_knowledge ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;
ALTER TABLE public.bot_knowledge ADD COLUMN IF NOT EXISTS feedback_positive INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.bot_knowledge ADD COLUMN IF NOT EXISTS feedback_negative INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.bot_knowledge ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.bot_knowledge ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.bot_knowledge ADD COLUMN IF NOT EXISTS normalized_question TEXT NOT NULL DEFAULT '';
ALTER TABLE public.bot_knowledge ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bot_knowledge' AND column_name = 'source'
  ) THEN
    UPDATE public.bot_knowledge
    SET source_type = CASE
      WHEN source IN ('manual','document','faq','unanswered_training','system') THEN source
      ELSE COALESCE(NULLIF(source_type, ''), 'manual')
    END
    WHERE COALESCE(source_type, '') IN ('', 'manual') AND COALESCE(source, '') <> '';
  END IF;
END $$;

UPDATE public.bot_knowledge
SET answer = content
WHERE COALESCE(answer, '') = '' AND COALESCE(content, '') <> '';

UPDATE public.bot_knowledge
SET normalized_question = public.bot_normalize_text(COALESCE(question, title, ''))
WHERE COALESCE(normalized_question, '') = '';

-- search_vector NO puede ser GENERATED: to_tsvector() es STABLE, no IMMUTABLE (error 42P17).
ALTER TABLE public.bot_knowledge ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE OR REPLACE FUNCTION public.bot_knowledge_search_text(p_title TEXT, p_question TEXT, p_answer TEXT, p_content TEXT, p_keywords TEXT[], p_variants TEXT[])
RETURNS tsvector
LANGUAGE sql
STABLE
AS $$
  SELECT to_tsvector(
    'spanish',
    coalesce(p_title, '') || ' ' ||
    coalesce(p_question, '') || ' ' ||
    coalesce(p_answer, '') || ' ' ||
    coalesce(p_content, '') || ' ' ||
    coalesce(array_to_string(p_keywords, ' '), '') || ' ' ||
    coalesce(array_to_string(p_variants, ' '), '')
  );
$$;

CREATE OR REPLACE FUNCTION public.bot_knowledge_before_write()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT'
     OR NEW.question IS DISTINCT FROM OLD.question
     OR NEW.title IS DISTINCT FROM OLD.title
     OR COALESCE(NEW.normalized_question, '') = '' THEN
    NEW.normalized_question := public.bot_normalize_text(
      btrim(COALESCE(NEW.question, '') || ' ' || COALESCE(NEW.title, ''))
    );
  END IF;
  IF COALESCE(NEW.answer, '') <> '' AND COALESCE(NEW.content, '') = '' THEN
    NEW.content := NEW.answer;
  END IF;
  NEW.search_vector := public.bot_knowledge_search_text(
    NEW.title, NEW.question, NEW.answer, NEW.content, NEW.keywords, NEW.variants
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bot_knowledge_norm ON public.bot_knowledge;
CREATE TRIGGER trg_bot_knowledge_norm
  BEFORE INSERT OR UPDATE ON public.bot_knowledge
  FOR EACH ROW EXECUTE FUNCTION public.bot_knowledge_before_write();

DROP TRIGGER IF EXISTS trg_bot_knowledge_touch ON public.bot_knowledge;
CREATE TRIGGER trg_bot_knowledge_touch
  BEFORE UPDATE ON public.bot_knowledge
  FOR EACH ROW EXECUTE FUNCTION public.bot_touch_updated_at();

UPDATE public.bot_knowledge
SET search_vector = public.bot_knowledge_search_text(title, question, answer, content, keywords, variants)
WHERE search_vector IS NULL;

CREATE INDEX IF NOT EXISTS idx_bot_knowledge_active ON public.bot_knowledge (active, category);
CREATE INDEX IF NOT EXISTS idx_bot_knowledge_branch ON public.bot_knowledge (branch_id);
CREATE INDEX IF NOT EXISTS idx_bot_knowledge_source ON public.bot_knowledge (source_type);
CREATE INDEX IF NOT EXISTS idx_bot_knowledge_question_trgm
  ON public.bot_knowledge USING GIN (question gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_bot_knowledge_norm_trgm
  ON public.bot_knowledge USING GIN (normalized_question gin_trgm_ops);

DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_bot_knowledge_fts
    ON public.bot_knowledge USING GIN (search_vector);
EXCEPTION WHEN undefined_column THEN
  RAISE NOTICE 'search_vector aún no existe, índice FTS omitido';
END $$;

INSERT INTO public.bot_knowledge (title, category, question, answer, keywords, variants, source_type, priority)
SELECT v.title, v.category, v.question, v.answer, v.keywords, v.variants, 'faq', 40
FROM (VALUES
  (
    'Cómo comprar',
    'compra',
    '¿Cómo hago un pedido?',
    'Pide en https://www.el-pollon.cl/: 1) elige sucursal 2) arma el carrito 3) completa tus datos 4) delivery, retiro o reserva 5) pagas al recibir (efectivo o transferencia) 6) confirma y guarda tu código de seguimiento.',
    ARRAY['como compro','cómo pido','hacer pedido','pagina','página','web'],
    ARRAY['quiero pedir','cómo compro','deseo comprar','cómo hago pedido']
  ),
  (
    'Formas de pago',
    'pago',
    '¿Cómo se paga?',
    'En El Pollón el pago es al recibir: efectivo o transferencia. No cobramos con tarjeta ni Webpay en la web. Los datos de transferencia te los entrega el local o el repartidor al momento de la entrega.',
    ARRAY['pago','pagar','efectivo','transferencia','tarjeta','webpay'],
    ARRAY['aceptan tarjeta','puedo pagar con transferencia','es contraentrega']
  )
) AS v(title, category, question, answer, keywords, variants)
WHERE NOT EXISTS (
  SELECT 1 FROM public.bot_knowledge k WHERE k.title = v.title AND k.source_type IN ('faq','manual','system')
);

-- =============================================================================
-- bot_documents + chunks
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.bot_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  knowledge_id UUID REFERENCES public.bot_knowledge(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL DEFAULT '',
  mime_type TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'documento',
  storage_path TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processed', 'error', 'inactive')),
  chunk_count INTEGER NOT NULL DEFAULT 0,
  error_text TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_documents_status ON public.bot_documents (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_documents_branch ON public.bot_documents (branch_id);

DROP TRIGGER IF EXISTS trg_bot_documents_touch ON public.bot_documents;
CREATE TRIGGER trg_bot_documents_touch
  BEFORE UPDATE ON public.bot_documents
  FOR EACH ROW EXECUTE FUNCTION public.bot_touch_updated_at();

CREATE TABLE IF NOT EXISTS public.bot_knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  knowledge_id UUID REFERENCES public.bot_knowledge(id) ON DELETE CASCADE,
  document_id UUID REFERENCES public.bot_documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL DEFAULT 0,
  content TEXT NOT NULL DEFAULT '',
  keywords TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bot_knowledge_chunks ADD COLUMN IF NOT EXISTS search_vector tsvector;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bot_knowledge_chunks'
      AND column_name = 'search_vector'
      AND is_generated = 'ALWAYS'
  ) THEN
    -- si search_vector es normal, mantener trigger de actualización
    NULL;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.bot_chunks_before_write()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector := to_tsvector('spanish', COALESCE(NEW.content, ''));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bot_chunks_fts ON public.bot_knowledge_chunks;
CREATE TRIGGER trg_bot_chunks_fts
  BEFORE INSERT OR UPDATE OF content ON public.bot_knowledge_chunks
  FOR EACH ROW EXECUTE FUNCTION public.bot_chunks_before_write();

CREATE INDEX IF NOT EXISTS idx_bot_chunks_knowledge ON public.bot_knowledge_chunks (knowledge_id, chunk_index);
CREATE INDEX IF NOT EXISTS idx_bot_chunks_document ON public.bot_knowledge_chunks (document_id);
CREATE INDEX IF NOT EXISTS idx_bot_chunks_fts ON public.bot_knowledge_chunks USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS idx_bot_chunks_trgm ON public.bot_knowledge_chunks USING GIN (content gin_trgm_ops);

-- =============================================================================
-- Conversaciones + mensajes
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.bot_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  phone TEXT NOT NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  current_intent TEXT,
  current_product_id UUID,
  current_order_id TEXT,
  context_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  mode TEXT NOT NULL DEFAULT 'bot'
    CHECK (mode IN ('bot', 'human', 'human_required')),
  assigned_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  unread_count INTEGER NOT NULL DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bot_conversations_phone_global
  ON public.bot_conversations (phone) WHERE branch_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_bot_conversations_phone_branch
  ON public.bot_conversations (phone, branch_id) WHERE branch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bot_conversations_phone ON public.bot_conversations (phone);
CREATE INDEX IF NOT EXISTS idx_bot_conversations_branch_mode
  ON public.bot_conversations (branch_id, mode, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_conversations_customer
  ON public.bot_conversations (customer_id) WHERE customer_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_bot_conversations_touch ON public.bot_conversations;
CREATE TRIGGER trg_bot_conversations_touch
  BEFORE UPDATE ON public.bot_conversations
  FOR EACH ROW EXECUTE FUNCTION public.bot_touch_updated_at();

CREATE TABLE IF NOT EXISTS public.bot_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES public.bot_conversations(id) ON DELETE SET NULL,
  phone TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
  sender_type TEXT NOT NULL DEFAULT 'bot'
    CHECK (sender_type IN ('customer', 'bot', 'human', 'system')),
  original_text TEXT NOT NULL DEFAULT '',
  normalized_text TEXT NOT NULL DEFAULT '',
  intent TEXT,
  matched_knowledge_id UUID REFERENCES public.bot_knowledge(id) ON DELETE SET NULL,
  confidence NUMERIC(5,2),
  whatsapp_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'stored',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bot_messages_wa_id
  ON public.bot_messages (whatsapp_message_id)
  WHERE whatsapp_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bot_messages_conversation
  ON public.bot_messages (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_messages_phone
  ON public.bot_messages (phone, created_at DESC);

-- =============================================================================
-- Preguntas sin respuesta
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.bot_unanswered_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES public.bot_conversations(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  phone TEXT,
  original_question TEXT NOT NULL DEFAULT '',
  normalized_question TEXT NOT NULL DEFAULT '',
  detected_intent TEXT,
  possible_matches JSONB NOT NULL DEFAULT '[]'::jsonb,
  similarity_score NUMERIC(5,4),
  occurrences INTEGER NOT NULL DEFAULT 1,
  first_asked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_asked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'answered', 'ignored', 'merged')),
  answer TEXT,
  answered_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  answered_at TIMESTAMPTZ,
  knowledge_id UUID REFERENCES public.bot_knowledge(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_unanswered_status
  ON public.bot_unanswered_questions (status, occurrences DESC, last_asked_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_unanswered_norm_trgm
  ON public.bot_unanswered_questions USING GIN (normalized_question gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_bot_unanswered_branch
  ON public.bot_unanswered_questions (branch_id, status);

DROP TRIGGER IF EXISTS trg_bot_unanswered_touch ON public.bot_unanswered_questions;
CREATE TRIGGER trg_bot_unanswered_touch
  BEFORE UPDATE ON public.bot_unanswered_questions
  FOR EACH ROW EXECUTE FUNCTION public.bot_touch_updated_at();

-- =============================================================================
-- bot_events (idempotencia) — ALTER si ya existía
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.bot_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_key TEXT NOT NULL,
  event_type TEXT NOT NULL,
  entity_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bot_events ADD COLUMN IF NOT EXISTS entity_type TEXT;
ALTER TABLE public.bot_events ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.bot_events ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE public.bot_events ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.bot_events ADD COLUMN IF NOT EXISTS processed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.bot_events ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;
ALTER TABLE public.bot_events ADD COLUMN IF NOT EXISTS last_error TEXT;

UPDATE public.bot_events
SET status = CASE WHEN processed THEN 'sent' ELSE COALESCE(NULLIF(status, ''), 'pending') END
WHERE status IS NULL OR status = '';

DO $$
BEGIN
  ALTER TABLE public.bot_events
    ADD CONSTRAINT bot_events_status_check
    CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'skipped'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bot_events_key ON public.bot_events (event_key);
CREATE INDEX IF NOT EXISTS idx_bot_events_entity ON public.bot_events (entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_events_phone ON public.bot_events (phone) WHERE phone IS NOT NULL;

-- =============================================================================
-- bot_notification_queue (no usamos notification_queue legacy)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.bot_notification_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL,
  phone TEXT NOT NULL,
  customer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  order_id TEXT,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bot_notif_pending
  ON public.bot_notification_queue (status, next_attempt_at)
  WHERE status IN ('pending', 'processing');
CREATE INDEX IF NOT EXISTS idx_bot_notif_phone
  ON public.bot_notification_queue (phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_notif_order
  ON public.bot_notification_queue (order_id) WHERE order_id IS NOT NULL;

-- =============================================================================
-- bot_logs — ALTER si ya existía
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.bot_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'warning', 'error')),
  message TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bot_logs ADD COLUMN IF NOT EXISTS event TEXT;
ALTER TABLE public.bot_logs ADD COLUMN IF NOT EXISTS event_type TEXT;
ALTER TABLE public.bot_logs ADD COLUMN IF NOT EXISTS conversation_id UUID;
ALTER TABLE public.bot_logs ADD COLUMN IF NOT EXISTS customer_id UUID;
ALTER TABLE public.bot_logs ADD COLUMN IF NOT EXISTS order_id TEXT;
ALTER TABLE public.bot_logs ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.bot_logs ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.bot_logs
SET event_type = COALESCE(NULLIF(event_type, ''), event, 'log')
WHERE COALESCE(event_type, '') = '';

ALTER TABLE public.bot_logs ALTER COLUMN event_type SET DEFAULT 'log';

CREATE INDEX IF NOT EXISTS idx_bot_logs_created ON public.bot_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_logs_level ON public.bot_logs (level, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_logs_event_type ON public.bot_logs (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_logs_branch ON public.bot_logs (branch_id, created_at DESC);

COMMENT ON TABLE public.bot_ai_usage IS
  'LEGACY (no usar). El Pollón Bot no utiliza IA generativa. No eliminar por seguridad; ignorar.';

-- =============================================================================
-- RLS
-- =============================================================================
ALTER TABLE public.bot_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_synonyms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_unanswered_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_logs ENABLE ROW LEVEL SECURITY;

-- settings
DROP POLICY IF EXISTS bot_settings_sa ON public.bot_settings;
CREATE POLICY bot_settings_sa ON public.bot_settings
  FOR ALL TO authenticated
  USING (public.auth_user_role() = 'super_admin')
  WITH CHECK (public.auth_user_role() = 'super_admin');
DROP POLICY IF EXISTS bot_settings_as ON public.bot_settings;
CREATE POLICY bot_settings_as ON public.bot_settings
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

-- synonyms + intents: SA all, AS read+write (entrenamiento)
DROP POLICY IF EXISTS bot_synonyms_sa ON public.bot_synonyms;
CREATE POLICY bot_synonyms_sa ON public.bot_synonyms
  FOR ALL TO authenticated
  USING (public.auth_user_role() IN ('super_admin', 'admin_sucursal', 'administrador'))
  WITH CHECK (public.auth_user_role() IN ('super_admin', 'admin_sucursal', 'administrador'));

DROP POLICY IF EXISTS bot_intents_sa ON public.bot_intents;
CREATE POLICY bot_intents_sa ON public.bot_intents
  FOR ALL TO authenticated
  USING (public.auth_user_role() IN ('super_admin', 'admin_sucursal', 'administrador'))
  WITH CHECK (public.auth_user_role() IN ('super_admin', 'admin_sucursal', 'administrador'));

-- knowledge / documents / chunks
DROP POLICY IF EXISTS bot_knowledge_sa ON public.bot_knowledge;
DROP POLICY IF EXISTS bot_knowledge_as ON public.bot_knowledge;
CREATE POLICY bot_knowledge_sa ON public.bot_knowledge
  FOR ALL TO authenticated
  USING (public.auth_user_role() = 'super_admin')
  WITH CHECK (public.auth_user_role() = 'super_admin');
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

DROP POLICY IF EXISTS bot_documents_sa ON public.bot_documents;
DROP POLICY IF EXISTS bot_documents_as ON public.bot_documents;
CREATE POLICY bot_documents_sa ON public.bot_documents
  FOR ALL TO authenticated
  USING (public.auth_user_role() = 'super_admin')
  WITH CHECK (public.auth_user_role() = 'super_admin');
CREATE POLICY bot_documents_as ON public.bot_documents
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

DROP POLICY IF EXISTS bot_chunks_staff ON public.bot_knowledge_chunks;
CREATE POLICY bot_chunks_staff ON public.bot_knowledge_chunks
  FOR ALL TO authenticated
  USING (public.auth_user_role() IN ('super_admin', 'admin_sucursal', 'administrador'))
  WITH CHECK (public.auth_user_role() IN ('super_admin', 'admin_sucursal', 'administrador'));

-- conversations / messages / unanswered
DROP POLICY IF EXISTS bot_conversations_sa ON public.bot_conversations;
DROP POLICY IF EXISTS bot_conversations_as ON public.bot_conversations;
CREATE POLICY bot_conversations_sa ON public.bot_conversations
  FOR ALL TO authenticated
  USING (public.auth_user_role() = 'super_admin')
  WITH CHECK (public.auth_user_role() = 'super_admin');
CREATE POLICY bot_conversations_as ON public.bot_conversations
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

DROP POLICY IF EXISTS bot_messages_sa ON public.bot_messages;
DROP POLICY IF EXISTS bot_messages_as ON public.bot_messages;
CREATE POLICY bot_messages_sa ON public.bot_messages
  FOR ALL TO authenticated
  USING (public.auth_user_role() = 'super_admin')
  WITH CHECK (public.auth_user_role() = 'super_admin');
CREATE POLICY bot_messages_as ON public.bot_messages
  FOR ALL TO authenticated
  USING (
    public.auth_user_role() IN ('admin_sucursal', 'administrador')
    AND EXISTS (
      SELECT 1 FROM public.bot_conversations c
      WHERE c.id = bot_messages.conversation_id
        AND (
          c.branch_id IS NULL
          OR c.branch_id = (SELECT p.branch_id FROM public.profiles p WHERE p.auth_user_id = auth.uid() LIMIT 1)
        )
    )
  )
  WITH CHECK (
    public.auth_user_role() IN ('admin_sucursal', 'administrador')
    AND EXISTS (
      SELECT 1 FROM public.bot_conversations c
      WHERE c.id = bot_messages.conversation_id
        AND (
          c.branch_id IS NULL
          OR c.branch_id = (SELECT p.branch_id FROM public.profiles p WHERE p.auth_user_id = auth.uid() LIMIT 1)
        )
    )
  );

DROP POLICY IF EXISTS bot_unanswered_sa ON public.bot_unanswered_questions;
DROP POLICY IF EXISTS bot_unanswered_as ON public.bot_unanswered_questions;
CREATE POLICY bot_unanswered_sa ON public.bot_unanswered_questions
  FOR ALL TO authenticated
  USING (public.auth_user_role() = 'super_admin')
  WITH CHECK (public.auth_user_role() = 'super_admin');
CREATE POLICY bot_unanswered_as ON public.bot_unanswered_questions
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

DROP POLICY IF EXISTS bot_events_sa ON public.bot_events;
CREATE POLICY bot_events_sa ON public.bot_events
  FOR ALL TO authenticated
  USING (public.auth_user_role() = 'super_admin')
  WITH CHECK (public.auth_user_role() = 'super_admin');
DROP POLICY IF EXISTS bot_events_as_select ON public.bot_events;
CREATE POLICY bot_events_as_select ON public.bot_events
  FOR SELECT TO authenticated
  USING (public.auth_user_role() IN ('admin_sucursal', 'administrador'));

DROP POLICY IF EXISTS bot_notif_sa ON public.bot_notification_queue;
CREATE POLICY bot_notif_sa ON public.bot_notification_queue
  FOR ALL TO authenticated
  USING (public.auth_user_role() = 'super_admin')
  WITH CHECK (public.auth_user_role() = 'super_admin');
DROP POLICY IF EXISTS bot_notif_as ON public.bot_notification_queue;
CREATE POLICY bot_notif_as ON public.bot_notification_queue
  FOR SELECT TO authenticated
  USING (
    public.auth_user_role() IN ('admin_sucursal', 'administrador')
    AND (
      branch_id IS NULL
      OR branch_id = (SELECT p.branch_id FROM public.profiles p WHERE p.auth_user_id = auth.uid() LIMIT 1)
    )
  );

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

-- =============================================================================
-- Realtime
-- =============================================================================
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_conversations;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_messages;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_unanswered_questions;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_notification_queue;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;

-- =============================================================================
-- Storage privado: bot-documents
-- =============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'bot-documents',
  'bot-documents',
  false,
  20971520,
  ARRAY[
    'application/pdf',
    'text/plain',
    'text/markdown',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 20971520,
  allowed_mime_types = ARRAY[
    'application/pdf',
    'text/plain',
    'text/markdown',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

DROP POLICY IF EXISTS bot_documents_storage_select ON storage.objects;
CREATE POLICY bot_documents_storage_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'bot-documents' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS bot_documents_storage_insert ON storage.objects;
CREATE POLICY bot_documents_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'bot-documents' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS bot_documents_storage_update ON storage.objects;
CREATE POLICY bot_documents_storage_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'bot-documents' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS bot_documents_storage_delete ON storage.objects;
CREATE POLICY bot_documents_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'bot-documents' AND auth.uid() IS NOT NULL);

-- =============================================================================
-- Verificación
-- =============================================================================
SELECT 'pg_trgm' AS ext, EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') AS ok
UNION ALL
SELECT 'unaccent', EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'unaccent')
UNION ALL
SELECT 'bot_settings', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='bot_settings')
UNION ALL
SELECT 'bot_knowledge', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='bot_knowledge')
UNION ALL
SELECT 'bot_conversations', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='bot_conversations')
UNION ALL
SELECT 'bot_unanswered_questions', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='bot_unanswered_questions')
UNION ALL
SELECT 'bot_notification_queue', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='bot_notification_queue')
UNION ALL
SELECT 'bucket bot-documents', EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'bot-documents');
