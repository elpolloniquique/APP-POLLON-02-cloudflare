-- =============================================================================
-- Baja el consumo de Realtime SIN perder funcionalidad.
--
-- Causa: cada ping GPS se retransmitía a TODOS los paneles abiertos.
--        Eso gastó 7.9 M de mensajes (cuota Pro = 5 M).
--
-- Qué hace:
--  1) Saca GPS y perfiles de moto de Realtime (el mapa ya consulta cada 8–10 s).
--  2) El GPS se sigue guardando. Pedidos, cocina y avisos siguen en vivo.
--  3) No escribe de nuevo si el último punto tiene menos de 8 segundos.
--
-- Ejecutar TODO este archivo en el SQL Editor de Supabase UNA vez.
-- =============================================================================

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ep_driver_location_latest',
    'ep_driver_location_events',
    'ep_driver_profiles',
    'ep_delivery_assignments'
  ]
  LOOP
    IF EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.ep_upsert_driver_location(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_heading DOUBLE PRECISION DEFAULT NULL,
  p_speed DOUBLE PRECISION DEFAULT NULL,
  p_accuracy DOUBLE PRECISION DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  did UUID;
  last_at TIMESTAMPTZ;
BEGIN
  IF p_lat IS NULL OR p_lng IS NULL THEN
    RAISE EXCEPTION 'lat/lng requeridos';
  END IF;

  did := public.ep_my_driver_id();
  IF did IS NULL THEN
    did := public.ep_ensure_driver_profile();
  END IF;

  SELECT updated_at INTO last_at
  FROM public.ep_driver_location_latest
  WHERE driver_id = did;

  IF last_at IS NOT NULL AND last_at > now() - interval '8 seconds' THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'driver_id', did, 'lat', p_lat, 'lng', p_lng);
  END IF;

  INSERT INTO ep_driver_location_latest (driver_id, lat, lng, heading, speed, accuracy, updated_at)
  VALUES (did, p_lat, p_lng, p_heading, p_speed, p_accuracy, now())
  ON CONFLICT (driver_id) DO UPDATE SET
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng,
    heading = EXCLUDED.heading,
    speed = EXCLUDED.speed,
    accuracy = EXCLUDED.accuracy,
    updated_at = now();

  INSERT INTO ep_driver_location_events (driver_id, lat, lng, heading, speed, accuracy)
  VALUES (did, p_lat, p_lng, p_heading, p_speed, p_accuracy);

  RETURN jsonb_build_object('ok', true, 'skipped', false, 'driver_id', did, 'lat', p_lat, 'lng', p_lng);
END;
$$;

GRANT EXECUTE ON FUNCTION public.ep_upsert_driver_location(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;

CREATE OR REPLACE FUNCTION public.ep_upsert_driver_location_by_ping(
  p_token UUID,
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_heading DOUBLE PRECISION DEFAULT NULL,
  p_speed DOUBLE PRECISION DEFAULT NULL,
  p_accuracy DOUBLE PRECISION DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  did UUID;
  last_at TIMESTAMPTZ;
BEGIN
  IF p_token IS NULL THEN
    RAISE EXCEPTION 'token requerido';
  END IF;
  IF p_lat IS NULL OR p_lng IS NULL THEN
    RAISE EXCEPTION 'lat/lng requeridos';
  END IF;

  SELECT id INTO did
  FROM public.ep_driver_profiles
  WHERE gps_ping_token = p_token
  LIMIT 1;

  IF did IS NULL THEN
    RAISE EXCEPTION 'token GPS inválido';
  END IF;

  SELECT updated_at INTO last_at
  FROM public.ep_driver_location_latest
  WHERE driver_id = did;

  IF last_at IS NOT NULL AND last_at > now() - interval '8 seconds' THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'driver_id', did);
  END IF;

  INSERT INTO ep_driver_location_latest (driver_id, lat, lng, heading, speed, accuracy, updated_at)
  VALUES (did, p_lat, p_lng, p_heading, p_speed, p_accuracy, now())
  ON CONFLICT (driver_id) DO UPDATE SET
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng,
    heading = EXCLUDED.heading,
    speed = EXCLUDED.speed,
    accuracy = EXCLUDED.accuracy,
    updated_at = now();

  INSERT INTO ep_driver_location_events (driver_id, lat, lng, heading, speed, accuracy)
  VALUES (did, p_lat, p_lng, p_heading, p_speed, p_accuracy);

  RETURN jsonb_build_object('ok', true, 'skipped', false, 'driver_id', did);
END;
$$;

REVOKE ALL ON FUNCTION public.ep_upsert_driver_location_by_ping(UUID, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ep_upsert_driver_location_by_ping(UUID, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO service_role;
