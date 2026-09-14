-- =============================================================================
-- EL POLLÓN BOT — FASE 6 teléfono (alineado con lib/bot/phone.js)
-- Idempotente. Ejecutar en SQL Editor si ya corriste fase4.
-- =============================================================================

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

-- Ejemplos (solo lectura)
SELECT
  raw,
  public.normalize_chile_phone(raw) AS e164
FROM (VALUES
  ('925586256'),
  ('09 2558 6256'),
  ('56925586256'),
  ('+56925586256'),
  ('+56 9 2558 6256'),
  ('56 9 2558 6256'),
  ('+51987654321')
) AS t(raw);
