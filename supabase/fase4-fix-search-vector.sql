-- =============================================================================
-- FIX FASE 4 — columnas + search_vector (sin GENERATED)
--
-- Por qué falló: al abortar fase4-pollon-bot.sql, Postgres deshizo los ALTER
-- y bot_knowledge quedó como estaba (sin columna question).
--
-- Ejecuta ESTE archivo completo. Si sale "OK", después corre otra vez
-- TODO: supabase/fase4-pollon-bot.sql
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
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
ALTER TABLE public.bot_knowledge ADD COLUMN IF NOT EXISTS search_vector tsvector;

UPDATE public.bot_knowledge
SET answer = content
WHERE COALESCE(answer, '') = '' AND COALESCE(content, '') <> '';

UPDATE public.bot_knowledge
SET normalized_question = public.bot_normalize_text(btrim(COALESCE(question, '') || ' ' || COALESCE(title, '')))
WHERE COALESCE(normalized_question, '') = '';

CREATE OR REPLACE FUNCTION public.bot_knowledge_search_text(
  p_title TEXT, p_question TEXT, p_answer TEXT, p_content TEXT, p_keywords TEXT[], p_variants TEXT[]
)
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

UPDATE public.bot_knowledge
SET search_vector = public.bot_knowledge_search_text(title, question, answer, content, keywords, variants)
WHERE search_vector IS NULL;

CREATE INDEX IF NOT EXISTS idx_bot_knowledge_fts
  ON public.bot_knowledge USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS idx_bot_knowledge_question_trgm
  ON public.bot_knowledge USING GIN (question gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_bot_knowledge_norm_trgm
  ON public.bot_knowledge USING GIN (normalized_question gin_trgm_ops);

SELECT
  'OK' AS status,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bot_knowledge' AND column_name = 'question'
  ) AS tiene_question,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bot_knowledge' AND column_name = 'search_vector'
  ) AS tiene_search_vector;
