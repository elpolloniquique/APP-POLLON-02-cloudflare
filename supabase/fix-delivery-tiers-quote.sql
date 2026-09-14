-- ============================================================
-- Tarifas por tramos (zonas km) — cotización inteligente
-- Ejecutar en Supabase SQL Editor (una vez).
-- ============================================================

-- Asegura columna tiers
ALTER TABLE public.ep_pricing_rules
  ADD COLUMN IF NOT EXISTS tiers JSONB DEFAULT '[]'::jsonb;

-- Cotiza según tramos: primera zona con to_km >= distancia
CREATE OR REPLACE FUNCTION public.ep_quote_delivery(
  p_branch_id UUID,
  p_distance_km NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rule RECORD;
  fee INTEGER := 0;
  km NUMERIC := GREATEST(COALESCE(p_distance_km, 0), 0);
  tier JSONB;
  max_km NUMERIC := 0;
  zone_name TEXT;
  zone_color TEXT;
  from_km NUMERIC := 0;
  to_km NUMERIC := 0;
  found_tier BOOLEAN := false;
  prev_to NUMERIC := 0;
BEGIN
  SELECT * INTO rule
  FROM ep_pricing_rules
  WHERE is_active = true
    AND (branch_id IS NULL OR branch_id = p_branch_id)
  ORDER BY
    CASE WHEN branch_id = p_branch_id THEN 0 ELSE 1 END,
    CASE WHEN rule_type = 'tiers' THEN 0 ELSE 1 END,
    priority DESC
  LIMIT 1;

  IF NOT FOUND THEN
    fee := 2000 + ROUND(km * 500)::INTEGER;
    RETURN jsonb_build_object(
      'fee', fee,
      'distance_km', km,
      'rule_id', NULL,
      'rule_name', 'default',
      'out_of_range', false
    );
  END IF;

  IF rule.rule_type = 'fixed' THEN
    fee := rule.base_fee;

  ELSIF rule.rule_type = 'tiers' AND jsonb_typeof(rule.tiers) = 'array' AND jsonb_array_length(rule.tiers) > 0 THEN
    -- max cobertura
    SELECT COALESCE(MAX((t->>'to_km')::NUMERIC), 0)
      INTO max_km
    FROM jsonb_array_elements(rule.tiers) t;

    IF km > max_km THEN
      RETURN jsonb_build_object(
        'fee', 0,
        'distance_km', km,
        'rule_id', rule.id,
        'rule_name', rule.name,
        'out_of_range', true,
        'max_km', max_km
      );
    END IF;

    -- Ordenar por to_km y tomar la primera zona que cubre km
    FOR tier IN
      SELECT value
      FROM jsonb_array_elements(rule.tiers) WITH ORDINALITY AS arr(value, ord)
      ORDER BY (value->>'to_km')::NUMERIC ASC
    LOOP
      to_km := COALESCE((tier->>'to_km')::NUMERIC, 0);
      IF km <= to_km THEN
        fee := COALESCE((tier->>'fee')::INTEGER, 0);
        zone_name := COALESCE(tier->>'name', 'Zona');
        zone_color := tier->>'color';
        from_km := COALESCE((tier->>'from_km')::NUMERIC, prev_to);
        found_tier := true;
        EXIT;
      END IF;
      prev_to := to_km;
    END LOOP;

    IF NOT found_tier THEN
      RETURN jsonb_build_object(
        'fee', 0,
        'distance_km', km,
        'rule_id', rule.id,
        'rule_name', rule.name,
        'out_of_range', true,
        'max_km', max_km
      );
    END IF;

    RETURN jsonb_build_object(
      'fee', fee,
      'distance_km', km,
      'rule_id', rule.id,
      'rule_name', rule.name,
      'out_of_range', false,
      'max_km', max_km,
      'zone', jsonb_build_object(
        'name', zone_name,
        'color', zone_color,
        'from_km', from_km,
        'to_km', to_km,
        'fee', fee
      )
    );

  ELSE
    -- per_km (y legacy)
    fee := rule.base_fee + ROUND(km * rule.per_km_fee)::INTEGER;
  END IF;

  fee := GREATEST(fee, COALESCE(rule.min_fee, 0));
  IF rule.max_fee IS NOT NULL THEN
    fee := LEAST(fee, rule.max_fee);
  END IF;

  RETURN jsonb_build_object(
    'fee', fee,
    'distance_km', km,
    'rule_id', rule.id,
    'rule_name', COALESCE(rule.name, 'default'),
    'out_of_range', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ep_quote_delivery(UUID, NUMERIC) TO anon, authenticated;

-- Seed: si no hay regla tiers, crear la de El Pollón (4 zonas)
INSERT INTO public.ep_pricing_rules (
  name, rule_type, base_fee, per_km_fee, min_fee, max_fee, is_active, priority, tiers
)
SELECT
  'Tarifas por kilómetro',
  'tiers',
  0, 0, 0, NULL,
  true,
  100,
  '[
    {"id":"z1","name":"Zona 01","color":"#ef4444","from_km":0,"to_km":2.5,"fee":2500},
    {"id":"z2","name":"Zona 02","color":"#22c55e","from_km":2.5,"to_km":3,"fee":3000},
    {"id":"z3","name":"Zona 03","color":"#3b82f6","from_km":3,"to_km":3.5,"fee":3500},
    {"id":"z4","name":"Zona 04","color":"#a855f7","from_km":3.5,"to_km":5,"fee":4000}
  ]'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.ep_pricing_rules WHERE rule_type = 'tiers' AND is_active = true
);

-- Desactivar reglas per_km genéricas viejas si ya hay tiers (evita confusión)
UPDATE public.ep_pricing_rules
SET is_active = false, updated_at = now()
WHERE rule_type <> 'tiers'
  AND is_active = true
  AND EXISTS (SELECT 1 FROM public.ep_pricing_rules r2 WHERE r2.rule_type = 'tiers' AND r2.is_active = true);
