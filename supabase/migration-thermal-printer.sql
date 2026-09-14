-- Impresora térmica WiFi (tablet/móvil) — configuración por sucursal
ALTER TABLE branches ADD COLUMN IF NOT EXISTS thermal_printer_ip TEXT DEFAULT '';
ALTER TABLE branches ADD COLUMN IF NOT EXISTS thermal_printer_port INT DEFAULT 9100;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS thermal_print_bridge_url TEXT DEFAULT '';
ALTER TABLE branches ADD COLUMN IF NOT EXISTS thermal_network_print_enabled BOOLEAN DEFAULT false;

COMMENT ON COLUMN branches.thermal_printer_ip IS 'IP LAN de la impresora térmica WiFi (ej. 192.168.1.100)';
COMMENT ON COLUMN branches.thermal_print_bridge_url IS 'URL del puente local en la red del local (ej. http://192.168.1.50:3009)';
