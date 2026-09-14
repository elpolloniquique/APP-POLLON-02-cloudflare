-- =============================================================================
-- EL POLLÓN BOT — FASE 0 diagnóstico (SOLO LECTURA)
-- Ejecutar en SQL Editor. No crea, no borra, no altera.
-- =============================================================================

DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'pedidos','detalle_pedidos','branches','products','categories','profiles',
    'ep_wa_settings','ep_wa_kb','ep_wa_sessions','ep_wa_messages','ep_wa_outbox','ep_wa_alerts',
    'bot_events','bot_logs','bot_knowledge','bot_ai_usage','notification_queue',
    'bot_conversations','bot_messages','bot_settings','bot_synonyms','bot_intents',
    'bot_unanswered_questions','bot_notification_queue','bot_knowledge_chunks'
  ];
BEGIN
  RAISE NOTICE '=== EL POLLÓN BOT FASE 0 — tablas ===';
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      RAISE NOTICE 'EXISTE: %', t;
    ELSE
      RAISE NOTICE 'NO existe: %', t;
    END IF;
  END LOOP;
END $$;

-- Extensiones útiles para búsqueda (FASE 8)
SELECT extname, extversion
FROM pg_extension
WHERE extname IN ('pg_trgm', 'unaccent', 'uuid-ossp', 'vector')
ORDER BY 1;

-- Pedidos: columnas de teléfono / tracking / sucursal
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'pedidos'
  AND column_name IN (
    'id','codigo_pedido','cliente_nombre','cliente_telefono','cliente_direccion',
    'tipo_entrega','metodo_pago','total','estado','datos_json','branch_id','customer_id'
  )
ORDER BY column_name;

-- Conteos rápidos (no modifica)
SELECT
  (SELECT COUNT(*) FROM public.pedidos) AS pedidos,
  (SELECT COUNT(*) FROM public.products) AS products,
  (SELECT COUNT(*) FROM public.branches) AS sucursales;

-- Estados usados realmente
SELECT estado, COUNT(*) AS n
FROM public.pedidos
GROUP BY estado
ORDER BY n DESC;
