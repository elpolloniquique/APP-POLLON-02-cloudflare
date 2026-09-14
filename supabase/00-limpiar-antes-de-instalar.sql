-- =============================================================================
-- SOLO usar si es proyecto NUEVO o quieres empezar de cero
-- Borra tablas viejas que causan error "categoria_id does not exist"
-- Después ejecuta: schema-es.sql → schema-multi-sucursal.sql → seed → schema-auth.sql
-- =============================================================================

DROP TABLE IF EXISTS order_status_history CASCADE;
DROP TABLE IF EXISTS campaign_recipients CASCADE;
DROP TABLE IF EXISTS marketing_campaigns CASCADE;
DROP TABLE IF EXISTS customer_marketing_preferences CASCADE;
DROP TABLE IF EXISTS customer_addresses CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS product_extras CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS promotions CASCADE;
DROP TABLE IF EXISTS delivery_zones CASCADE;
DROP TABLE IF EXISTS settings CASCADE;
DROP TABLE IF EXISTS branches CASCADE;
DROP TABLE IF EXISTS detalle_pedidos CASCADE;
DROP TABLE IF EXISTS ventas CASCADE;
DROP TABLE IF EXISTS pedidos CASCADE;
DROP TABLE IF EXISTS productos CASCADE;
DROP TABLE IF EXISTS categorias CASCADE;
DROP TABLE IF EXISTS administradores CASCADE;
DROP TABLE IF EXISTS configuracion_tienda CASCADE;

-- Listo. Ahora ejecuta schema-es.sql (paso 1)
