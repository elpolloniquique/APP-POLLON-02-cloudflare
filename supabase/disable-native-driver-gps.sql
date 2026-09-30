-- Apaga la exigencia de GPS para ofertar pedidos.
-- La APK nativa de repartidor ya no debe escribir ubicación.
UPDATE public.ep_dispatch_settings
SET require_gps = false
WHERE require_gps IS DISTINCT FROM false;
