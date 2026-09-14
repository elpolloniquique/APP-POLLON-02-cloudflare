-- =============================================================================
-- EL POLLÓN BOT — FASE 7 (intenciones) + FASE 8 (búsqueda PostgreSQL)
-- Sin IA. Requiere pg_trgm + unaccent + bot_normalize_text (fase4 / fix).
-- Ejecutar TODO en SQL Editor. Idempotente.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

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

-- -----------------------------------------------------------------------------
-- FASE 7: patrones / ejemplos extra en intenciones + sinónimos
-- -----------------------------------------------------------------------------
UPDATE public.bot_intents SET
  patterns = ARRAY['cuanto sale','cuanto vale','cuanto cuesta','cual es el precio','presio'],
  examples = ARRAY['cuánto cuesta el cuarto','precio del pollo entero']
WHERE code = 'PRODUCT_PRICE';

UPDATE public.bot_intents SET
  patterns = ARRAY['cuanto delivery','cuanto el despacho','valor despacho','cuanto cobran envio','cuanto vale llevarlo','cuanto cobran por traer'],
  examples = ARRAY['cuánto sale delivery','delivery cuanto']
WHERE code = 'DELIVERY_PRICE';

UPDATE public.bot_intents SET
  patterns = ARRAY['hacen delivery','llegan a','zona de despacho','cobertura'],
  examples = ARRAY['llegan a mi sector','hacen delivery']
WHERE code IN ('DELIVERY', 'DELIVERY_ZONE');

UPDATE public.bot_intents SET
  patterns = ARRAY['como compro','como pido','quiero pedir','hacer un pedido'],
  examples = ARRAY['cómo hago un pedido','quiero comprar']
WHERE code = 'HOW_TO_BUY';

UPDATE public.bot_intents SET
  patterns = ARRAY['como va mi pedido','donde esta mi pedido','ya salio','estado de mi pedido'],
  examples = ARRAY['cómo va mi pedido','dónde está mi pollo']
WHERE code = 'ORDER_STATUS';

UPDATE public.bot_intents SET
  patterns = ARRAY['a que hora','estan abiertos','estan atendiendo','horario de'],
  examples = ARRAY['a qué hora cierran','están atendiendo']
WHERE code = 'OPENING_HOURS';

UPDATE public.bot_intents SET
  patterns = ARRAY['donde estan','donde queda','direccion del local'],
  examples = ARRAY['dónde están','cuál es la dirección']
WHERE code IN ('BRANCH', 'BRANCH_ADDRESS');

UPDATE public.bot_intents SET
  patterns = ARRAY['quiero hablar con alguien','necesito una persona','pasame con un encargado'],
  examples = ARRAY['quiero hablar con alguien']
WHERE code = 'HUMAN_SUPPORT';

INSERT INTO public.bot_synonyms (canonical, aliases, category)
SELECT v.canonical, v.aliases, v.category
FROM (VALUES
  ('cuarto', ARRAY['un cuarto','1 4','cuarto de pollo'], 'producto'),
  ('horario', ARRAY['estan abiertos','abren','cierran a'], 'sucursal'),
  ('delivery', ARRAY['domicilio','a domicilio','mandar'], 'delivery')
) AS v(canonical, aliases, category)
WHERE NOT EXISTS (
  SELECT 1 FROM public.bot_synonyms s WHERE lower(s.canonical) = lower(v.canonical)
);

-- -----------------------------------------------------------------------------
-- Expandir query con sinónimos (para FTS)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bot_expand_query(p_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  out TEXT := public.bot_normalize_text(COALESCE(p_text, ''));
  rec RECORD;
  alias TEXT;
  a_norm TEXT;
  c_norm TEXT;
BEGIN
  IF out = '' THEN
    RETURN '';
  END IF;
  FOR rec IN
    SELECT canonical, aliases FROM public.bot_synonyms WHERE active IS NOT FALSE
  LOOP
    c_norm := public.bot_normalize_text(rec.canonical);
    FOREACH alias IN ARRAY COALESCE(rec.aliases, '{}'::TEXT[])
    LOOP
      a_norm := public.bot_normalize_text(alias);
      IF a_norm <> '' AND position(a_norm IN out) > 0 AND c_norm <> '' AND position(c_norm IN out) = 0 THEN
        out := out || ' ' || c_norm;
      END IF;
    END LOOP;
  END LOOP;
  RETURN btrim(out);
END;
$$;

-- -----------------------------------------------------------------------------
-- FASE 8: búsqueda memoria (FTS + pg_trgm)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bot_search_knowledge(
  p_query TEXT,
  p_branch_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 5,
  p_min_score NUMERIC DEFAULT 0.15
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  category TEXT,
  question TEXT,
  answer TEXT,
  content TEXT,
  source_type TEXT,
  score NUMERIC,
  fts_rank REAL,
  sim REAL
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  q_norm TEXT;
  q_exp TEXT;
  tsq tsquery;
BEGIN
  q_norm := public.bot_normalize_text(COALESCE(p_query, ''));
  IF length(q_norm) < 2 THEN
    RETURN;
  END IF;
  q_exp := public.bot_expand_query(q_norm);

  BEGIN
    tsq := websearch_to_tsquery('spanish', q_exp);
  EXCEPTION WHEN OTHERS THEN
    tsq := NULL;
  END;
  IF tsq IS NULL OR tsq::text = '' THEN
    BEGIN
      tsq := plainto_tsquery('spanish', q_exp);
    EXCEPTION WHEN OTHERS THEN
      tsq := plainto_tsquery('simple', q_exp);
    END;
  END IF;

  RETURN QUERY
  SELECT s.*
  FROM (
    SELECT
      k.id,
      k.title,
      k.category,
      k.question,
      COALESCE(NULLIF(k.answer, ''), k.content) AS answer,
      k.content,
      k.source_type,
      ROUND((
        COALESCE(ts_rank_cd(k.search_vector, tsq), 0) * 2.2
        + GREATEST(
            similarity(COALESCE(k.normalized_question, ''), q_norm),
            similarity(public.bot_normalize_text(COALESCE(k.question, '')), q_norm),
            similarity(public.bot_normalize_text(COALESCE(k.title, '')), q_norm),
            word_similarity(q_norm, COALESCE(k.normalized_question, k.question, k.title, ''))
          ) * 1.5
        + CASE
            WHEN COALESCE(k.normalized_question, '') LIKE '%' || q_norm || '%' THEN 0.28
            ELSE 0
          END
        + LEAST(0.08, COALESCE(k.priority, 0)::NUMERIC / 2000.0)
      )::NUMERIC, 4) AS score,
      COALESCE(ts_rank_cd(k.search_vector, tsq), 0)::REAL AS fts_rank,
      GREATEST(
        similarity(COALESCE(k.normalized_question, ''), q_norm),
        similarity(public.bot_normalize_text(COALESCE(k.question, '')), q_norm)
      )::REAL AS sim
    FROM public.bot_knowledge k
    WHERE k.active = true
      AND (
        p_branch_id IS NULL
        OR k.branch_id IS NULL
        OR k.branch_id = p_branch_id
      )
      AND (
        (k.search_vector IS NOT NULL AND tsq IS NOT NULL AND k.search_vector @@ tsq)
        OR similarity(COALESCE(k.normalized_question, ''), q_norm) >= 0.18
        OR similarity(public.bot_normalize_text(COALESCE(k.question, '')), q_norm) >= 0.18
        OR word_similarity(q_norm, COALESCE(k.normalized_question, k.question, k.title, '')) >= 0.22
        OR COALESCE(k.normalized_question, '') LIKE '%' || q_norm || '%'
        OR EXISTS (
          SELECT 1
          FROM unnest(COALESCE(k.keywords, '{}'::TEXT[])) AS kw
          WHERE public.bot_normalize_text(kw) <> ''
            AND q_norm LIKE '%' || public.bot_normalize_text(kw) || '%'
        )
        OR EXISTS (
          SELECT 1
          FROM unnest(COALESCE(k.variants, '{}'::TEXT[])) AS vr
          WHERE similarity(public.bot_normalize_text(vr), q_norm) >= 0.35
        )
      )
  ) s
  WHERE s.score >= COALESCE(p_min_score, 0.15)
  ORDER BY s.score DESC, s.fts_rank DESC
  LIMIT GREATEST(COALESCE(p_limit, 5), 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.bot_search_chunks(
  p_query TEXT,
  p_branch_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  knowledge_id UUID,
  document_id UUID,
  content TEXT,
  score REAL
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  q_norm TEXT;
  tsq tsquery;
BEGIN
  q_norm := public.bot_normalize_text(COALESCE(p_query, ''));
  IF length(q_norm) < 3 THEN
    RETURN;
  END IF;
  BEGIN
    tsq := plainto_tsquery('spanish', q_norm);
  EXCEPTION WHEN OTHERS THEN
    tsq := plainto_tsquery('simple', q_norm);
  END;

  RETURN QUERY
  SELECT
    c.id,
    c.knowledge_id,
    c.document_id,
    c.content,
    GREATEST(
      COALESCE(ts_rank_cd(c.search_vector, tsq), 0),
      similarity(public.bot_normalize_text(c.content), q_norm)
    )::REAL AS score
  FROM public.bot_knowledge_chunks c
  LEFT JOIN public.bot_knowledge k ON k.id = c.knowledge_id
  LEFT JOIN public.bot_documents d ON d.id = c.document_id
  WHERE (k.id IS NULL OR k.active = true)
    AND (d.id IS NULL OR d.active = true)
    AND (
      p_branch_id IS NULL
      OR k.branch_id IS NULL
      OR k.branch_id = p_branch_id
      OR d.branch_id IS NULL
      OR d.branch_id = p_branch_id
    )
    AND (
      (c.search_vector IS NOT NULL AND tsq IS NOT NULL AND c.search_vector @@ tsq)
      OR similarity(public.bot_normalize_text(c.content), q_norm) >= 0.2
    )
  ORDER BY 5 DESC
  LIMIT GREATEST(COALESCE(p_limit, 5), 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.bot_find_similar_unanswered(
  p_normalized TEXT,
  p_branch_id UUID DEFAULT NULL,
  p_min_sim NUMERIC DEFAULT 0.45
)
RETURNS TABLE (
  id UUID,
  occurrences INTEGER,
  sim REAL,
  original_question TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  q_norm TEXT;
BEGIN
  q_norm := public.bot_normalize_text(COALESCE(p_normalized, ''));
  IF length(q_norm) < 3 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.occurrences,
    similarity(u.normalized_question, q_norm)::REAL AS sim,
    u.original_question
  FROM public.bot_unanswered_questions u
  WHERE u.status = 'pending'
    AND (
      p_branch_id IS NULL
      OR u.branch_id IS NULL
      OR u.branch_id = p_branch_id
    )
    AND similarity(u.normalized_question, q_norm) >= COALESCE(p_min_sim, 0.45)
  ORDER BY similarity(u.normalized_question, q_norm) DESC, u.occurrences DESC
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bot_expand_query(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.bot_search_knowledge(TEXT, UUID, INTEGER, NUMERIC) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.bot_search_chunks(TEXT, UUID, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.bot_find_similar_unanswered(TEXT, UUID, NUMERIC) TO authenticated, service_role;

-- Verificación rápida (puede devolver 0 filas si aún no hay memoria)
SELECT * FROM public.bot_search_knowledge('cuanto sale delivery', NULL, 5, 0.1);
