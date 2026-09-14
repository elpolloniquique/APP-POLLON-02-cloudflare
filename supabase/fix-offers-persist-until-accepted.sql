-- =============================================================================
-- Ofertas persistentes hasta que alguien acepte + reaviso cada 1 min
-- Ejecutar UNA vez en Supabase SQL Editor.
-- =============================================================================
-- Cambios:
-- 1) expires_at muy largo (24h) — la tarjeta no “caduca” a los 10 min
-- 2) ep_expire_pending_offers solo limpia ofertas de jobs ya no ofertables
-- 3) ep_accept_delivery_offer ya no rechaza por tiempo
-- 4) offer_ttl_seconds se usa solo como hint; el insert usa 24h
-- 5) retry_after sigue en 60s (reaviso push)
-- =============================================================================

ALTER TABLE public.ep_dispatch_settings
  ALTER COLUMN offer_ttl_seconds SET DEFAULT 86400;

ALTER TABLE public.ep_dispatch_settings
  ALTER COLUMN retry_after_seconds SET DEFAULT 60;

UPDATE public.ep_dispatch_settings
SET
  offer_ttl_seconds = 86400,
  retry_after_seconds = 60
WHERE TRUE;

COMMENT ON COLUMN public.ep_dispatch_settings.offer_ttl_seconds IS
  'Segundos de vida de la oferta pending (24h). La UI muestra el pedido hasta que alguien acepte.';
COMMENT ON COLUMN public.ep_dispatch_settings.retry_after_seconds IS
  'Cada cuántos segundos reavisar push si nadie aceptó (1 min).';

-- Extender ofertas pending actuales que aún no fueron tomadas
UPDATE public.ep_delivery_offers
SET expires_at = now() + interval '24 hours'
WHERE status = 'pending'
  AND expires_at < now() + interval '12 hours';

-- Solo expirar ofertas huérfanas (job ya asignado/cancelado/entregado)
CREATE OR REPLACE FUNCTION public.ep_expire_pending_offers()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n INT := 0;
BEGIN
  UPDATE public.ep_delivery_offers o
  SET status = 'expired', responded_at = COALESCE(o.responded_at, now())
  FROM public.ep_delivery_jobs j
  WHERE o.job_id = j.id
    AND o.status = 'pending'
    AND (
      j.status IN ('assigned', 'heading_to_branch', 'picked_up', 'delivering', 'delivered', 'cancelled')
      OR j.assigned_driver_id IS NOT NULL
    );
  GET DIAGNOSTICS n = ROW_COUNT;

  -- Seguridad: ofertas pending sin job (raro)
  UPDATE public.ep_delivery_offers o
  SET status = 'expired', responded_at = COALESCE(o.responded_at, now())
  WHERE o.status = 'pending'
    AND NOT EXISTS (SELECT 1 FROM public.ep_delivery_jobs j WHERE j.id = o.job_id);

  RETURN n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ep_expire_pending_offers() TO authenticated, service_role;

-- TTL efectivo al ofertar: mínimo 24h (no 10 min)
CREATE OR REPLACE FUNCTION public.ep_start_driver_search(p_job_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  job RECORD;
  settings RECORD;
  ttl INT;
  drv RECORD;
  offered INT := 0;
  require_gps_flag BOOLEAN := TRUE;
  online_n INT := 0;
  gps_ok_n INT := 0;
  skipped_gps INT := 0;
  skipped_offers INT := 0;
  skipped_branch INT := 0;
BEGIN
  IF NOT public.ep_is_dispatch_staff() THEN
    RAISE EXCEPTION 'Solo personal de despacho';
  END IF;

  SELECT * INTO job FROM ep_delivery_jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Job no encontrado'; END IF;
  IF job.status IN ('delivered', 'cancelled', 'assigned', 'heading_to_branch', 'picked_up', 'delivering') THEN
    RAISE EXCEPTION 'Job no disponible para ofertar';
  END IF;

  SELECT * INTO settings FROM ep_dispatch_settings WHERE branch_id = job.branch_id;

  IF settings IS NOT NULL AND settings.enabled IS FALSE THEN
    RETURN jsonb_build_object(
      'ok', false,
      'offered', 0,
      'reason', 'dispatch_disabled',
      'message', 'Despacho desactivado en la configuración de esta sucursal'
    );
  END IF;

  require_gps_flag := COALESCE(settings.require_gps, TRUE);

  -- Oferta viva 24h (o más si settings lo pide); mínimo 24h
  ttl := GREATEST(86400, COALESCE(settings.offer_ttl_seconds, 86400));
  IF ttl > 604800 THEN ttl := 604800; END IF; -- máx 7 días

  UPDATE ep_delivery_jobs
  SET status = 'searching_driver', offered_at = now(), updated_at = now()
  WHERE id = p_job_id;

  FOR drv IN
    SELECT d.id, d.preferred_branch_id, d.operational_status
    FROM ep_driver_profiles d
    WHERE d.admin_status = 'approved'
      AND d.operational_status IN ('available', 'heading_to_branch', 'carrying_orders', 'offered')
  LOOP
    online_n := online_n + 1;

    IF job.branch_id IS NOT NULL
       AND drv.preferred_branch_id IS NOT NULL
       AND drv.preferred_branch_id <> job.branch_id THEN
      skipped_branch := skipped_branch + 1;
      CONTINUE;
    END IF;

    IF NOT public.ep_driver_can_receive_offers(drv.id) THEN
      skipped_offers := skipped_offers + 1;
      CONTINUE;
    END IF;

    IF require_gps_flag AND NOT public.ep_driver_location_is_fresh(drv.id, 120) THEN
      skipped_gps := skipped_gps + 1;
      CONTINUE;
    END IF;

    gps_ok_n := gps_ok_n + 1;

    INSERT INTO ep_delivery_offers (job_id, driver_id, status, offered_fee, expires_at)
    VALUES (p_job_id, drv.id, 'pending', job.delivery_fee, now() + make_interval(secs => ttl))
    ON CONFLICT (job_id, driver_id) DO UPDATE SET
      status = 'pending',
      offered_fee = EXCLUDED.offered_fee,
      expires_at = EXCLUDED.expires_at,
      responded_at = NULL;
    offered := offered + 1;
  END LOOP;

  IF offered > 0 THEN
    UPDATE ep_delivery_jobs SET status = 'offered', updated_at = now() WHERE id = p_job_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'offered', offered,
    'ttl_seconds', ttl,
    'require_gps', require_gps_flag,
    'online', online_n,
    'gps_ok', gps_ok_n,
    'skipped_gps', skipped_gps,
    'skipped_offers', skipped_offers,
    'skipped_branch', skipped_branch,
    'message', CASE
      WHEN offered > 0 THEN format('Oferta enviada a %s repartidor(es). Visible hasta que alguien acepte · reaviso cada 1 min', offered)
      WHEN online_n = 0 THEN 'No hay repartidores en Disponible. Pídele que pulse Conectarme en la app.'
      WHEN skipped_gps > 0 THEN 'El repartidor está en línea pero su GPS aún no llega al servidor. Espera 2–5 s con la app nativa en ruta y vuelve a buscar.'
      WHEN skipped_branch > 0 THEN 'Hay repartidores en línea, pero de otra sucursal.'
      WHEN skipped_offers > 0 THEN 'El repartidor no puede recibir más ofertas ahora.'
      ELSE 'Ningún repartidor elegible en este momento.'
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ep_start_driver_search(UUID) TO authenticated;

-- Aceptar: sin rechazo por reloj (solo pending / tomado por otro / cupo)
CREATE OR REPLACE FUNCTION public.ep_accept_delivery_offer(p_offer_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  off RECORD;
  did UUID;
  lock_key BIGINT;
  v_active INT;
  v_max INT;
  v_post_pickup INT;
BEGIN
  did := public.ep_my_driver_id();
  IF did IS NULL THEN RAISE EXCEPTION 'No eres repartidor'; END IF;

  SELECT COALESCE(max_orders, 2) INTO v_max FROM ep_driver_profiles WHERE id = did;

  IF NOT public.ep_driver_can_receive_offers(did) THEN
    RAISE EXCEPTION 'Ya tienes el máximo de % pedidos o ya recogiste pedidos en curso. Entrega todos antes de aceptar más.', v_max;
  END IF;

  SELECT * INTO off FROM ep_delivery_offers WHERE id = p_offer_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Oferta no encontrada'; END IF;
  IF off.driver_id <> did THEN RAISE EXCEPTION 'Oferta de otro repartidor'; END IF;
  IF off.status <> 'pending' THEN RAISE EXCEPTION 'Oferta ya no disponible'; END IF;

  -- Extender si por error quedó corta (no bloquear aceptar)
  IF off.expires_at IS NOT NULL AND off.expires_at < now() THEN
    UPDATE ep_delivery_offers
    SET expires_at = now() + interval '24 hours'
    WHERE id = p_offer_id;
  END IF;

  lock_key := hashtext(off.job_id::text);
  PERFORM pg_advisory_xact_lock(lock_key);

  IF EXISTS (
    SELECT 1 FROM ep_delivery_assignments
    WHERE job_id = off.job_id AND status = 'active'
  ) THEN
    UPDATE ep_delivery_offers SET status = 'taken_by_other', responded_at = now() WHERE id = p_offer_id;
    RAISE EXCEPTION 'Pedido tomado por otro repartidor';
  END IF;

  SELECT COUNT(*) INTO v_active
  FROM ep_delivery_assignments WHERE driver_id = did AND status = 'active';
  SELECT COUNT(*) INTO v_post_pickup
  FROM ep_delivery_assignments
  WHERE driver_id = did AND status = 'active' AND phase IN ('to_customer', 'done');

  IF v_post_pickup > 0 THEN
    RAISE EXCEPTION 'Ya recogiste pedidos. Debes entregar todos antes de aceptar más.';
  END IF;
  IF v_active >= v_max THEN
    RAISE EXCEPTION 'Cupo completo: máximo % pedidos.', v_max;
  END IF;

  UPDATE ep_delivery_offers SET status = 'accepted', responded_at = now() WHERE id = p_offer_id;
  UPDATE ep_delivery_offers
  SET status = 'taken_by_other', responded_at = now()
  WHERE job_id = off.job_id AND id <> p_offer_id AND status = 'pending';

  INSERT INTO ep_delivery_assignments (job_id, driver_id, status, phase, driver_fee)
  VALUES (off.job_id, did, 'active', 'to_store', off.offered_fee);

  UPDATE ep_delivery_jobs
  SET status = 'assigned',
      assigned_driver_id = did,
      assigned_at = now(),
      updated_at = now()
  WHERE id = off.job_id;

  SELECT COUNT(*) INTO v_active
  FROM ep_delivery_assignments WHERE driver_id = did AND status = 'active';

  IF v_active < v_max THEN
    UPDATE ep_driver_profiles
    SET operational_status = 'available', updated_at = now()
    WHERE id = did;
  ELSE
    UPDATE ep_driver_profiles
    SET operational_status = 'heading_to_branch', updated_at = now()
    WHERE id = did;
  END IF;

  RETURN jsonb_build_object('ok', true, 'active', v_active, 'max', v_max);
END;
$$;

GRANT EXECUTE ON FUNCTION public.ep_accept_delivery_offer(UUID) TO authenticated;
