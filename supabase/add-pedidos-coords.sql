-- Agrega coordenadas GPS del cliente a la tabla pedidos
-- Ejecutar en Supabase SQL Editor
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS cliente_lat  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS cliente_lng  DOUBLE PRECISION;

SELECT 'OK: columnas cliente_lat y cliente_lng agregadas a pedidos' AS resultado;
