-- =============================================================================
-- GPS nativo sin WebView: token de ping + upsert por token
-- El servicio Android POSTea a /api/driver-gps-ping?k=TOKEN aunque
-- la pantalla esté apagada o el repartidor esté en otra app.
-- =============================================================================

ALTER TABLE public.ep_driver_profiles
  ADD COLUMN IF NOT EXISTS gps_ping_token UUID;

CREATE UNIQUE INDEX IF NOT EXISTS ep_driver_profiles_gps_ping_token_uidx
  ON public.ep_driver_profiles (gps_ping_token)
  WHERE gps_ping_token IS NOT NULL;

COMMENT ON COLUMN public.ep_driver_profiles.gps_ping_token IS
  'Token opaco para POST nativo de GPS (pantalla apagada / otra app).';

CREATE OR REPLACE FUNCTION public.ep_ensure_my_gps_ping_token()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  did UUID;
  tok UUID;
BEGIN
  did := public.ep_my_driver_id();
  IF did IS NULL THEN
    did := public.ep_ensure_driver_profile();
  END IF;
  IF did IS NULL THEN
    RAISE EXCEPTION 'No eres repartidor';
  END IF;

  SELECT gps_ping_token INTO tok FROM public.ep_driver_profiles WHERE id = did;
  IF tok IS NULL THEN
    tok := gen_random_uuid();
    UPDATE public.ep_driver_profiles
    SET gps_ping_token = tok, updated_at = now()
    WHERE id = did;
  END IF;

  RETURN tok::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ep_ensure_my_gps_ping_token() TO authenticated;

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

  RETURN jsonb_build_object('ok', true, 'driver_id', did);
END;
$$;

REVOKE ALL ON FUNCTION public.ep_upsert_driver_location_by_ping(UUID, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ep_upsert_driver_location_by_ping(UUID, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO service_role;
