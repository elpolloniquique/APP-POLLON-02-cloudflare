-- Tipos de pedido configurables por sucursal
ALTER TABLE branches ADD COLUMN IF NOT EXISTS pickup_min_order INTEGER DEFAULT 0;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS reservation_min_order INTEGER DEFAULT 0;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS reservation_schedule JSONB DEFAULT '{"slots":[]}'::jsonb;

COMMENT ON COLUMN branches.pickup_min_order IS 'Monto mínimo en pesos para retiro en local (0 = sin mínimo)';
COMMENT ON COLUMN branches.reservation_min_order IS 'Monto mínimo en pesos para reservas / pedidos grandes (0 = sin mínimo)';
COMMENT ON COLUMN branches.reservation_schedule IS 'Horarios de reserva: {"slots":[{"days":[5,6],"start":"18:00","end":"22:00"}]}';
