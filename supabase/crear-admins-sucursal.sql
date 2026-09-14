-- =============================================================================
-- ASIGNAR admin_sucursal a 4 sucursales (ejecutar DESPUÉS de crear usuarios en Auth)
-- Requisitos: schema-auth.sql + seed-multi-sucursal.sql ya ejecutados
-- =============================================================================
--
-- PASO PREVIO (manual en Supabase):
-- Authentication → Users → Add user → crear estos 4 correos con contraseña
--   admin.iquique@elpollon.cl
--   admin.altohospicio@elpollon.cl
--   admin.arica.sm@elpollon.cl
--   admin.arica.saucache@elpollon.cl
-- Marcar "Auto Confirm User"
--
-- Luego ejecuta TODO este archivo en SQL Editor → Run
-- =============================================================================

-- ─── Iquique (slug: iquique-vivar) ───────────────────────────────────────────
INSERT INTO profiles (auth_user_id, full_name, email, role, branch_id, is_active)
SELECT
  u.id,
  'Admin Sucursal Iquique',
  u.email,
  'admin_sucursal',
  b.id,
  true
FROM auth.users u
CROSS JOIN branches b
WHERE u.email = 'admin.iquique@elpollon.cl'
  AND b.slug = 'iquique-vivar'
ON CONFLICT (auth_user_id) DO UPDATE SET
  role = 'admin_sucursal',
  branch_id = EXCLUDED.branch_id,
  full_name = EXCLUDED.full_name,
  email = EXCLUDED.email,
  is_active = true;

INSERT INTO administradores (id, email, nombre, rol, activo, branch_id)
SELECT u.id, u.email, 'Admin Iquique', 'administrador', true, b.id
FROM auth.users u
CROSS JOIN branches b
WHERE u.email = 'admin.iquique@elpollon.cl' AND b.slug = 'iquique-vivar'
ON CONFLICT (id) DO UPDATE SET
  rol = 'administrador',
  branch_id = EXCLUDED.branch_id,
  activo = true,
  nombre = EXCLUDED.nombre;

-- ─── Alto Hospicio (slug: alto-hospicio) ─────────────────────────────────────
INSERT INTO profiles (auth_user_id, full_name, email, role, branch_id, is_active)
SELECT
  u.id,
  'Admin Sucursal Alto Hospicio',
  u.email,
  'admin_sucursal',
  b.id,
  true
FROM auth.users u
CROSS JOIN branches b
WHERE u.email = 'admin.altohospicio@elpollon.cl'
  AND b.slug = 'alto-hospicio'
ON CONFLICT (auth_user_id) DO UPDATE SET
  role = 'admin_sucursal',
  branch_id = EXCLUDED.branch_id,
  full_name = EXCLUDED.full_name,
  email = EXCLUDED.email,
  is_active = true;

INSERT INTO administradores (id, email, nombre, rol, activo, branch_id)
SELECT u.id, u.email, 'Admin Alto Hospicio', 'administrador', true, b.id
FROM auth.users u
CROSS JOIN branches b
WHERE u.email = 'admin.altohospicio@elpollon.cl' AND b.slug = 'alto-hospicio'
ON CONFLICT (id) DO UPDATE SET
  rol = 'administrador',
  branch_id = EXCLUDED.branch_id,
  activo = true,
  nombre = EXCLUDED.nombre;

-- ─── Arica Santa María (slug: arica-santa-maria) ─────────────────────────────
INSERT INTO profiles (auth_user_id, full_name, email, role, branch_id, is_active)
SELECT
  u.id,
  'Admin Sucursal Arica Santa María',
  u.email,
  'admin_sucursal',
  b.id,
  true
FROM auth.users u
CROSS JOIN branches b
WHERE u.email = 'admin.arica.sm@elpollon.cl'
  AND b.slug = 'arica-santa-maria'
ON CONFLICT (auth_user_id) DO UPDATE SET
  role = 'admin_sucursal',
  branch_id = EXCLUDED.branch_id,
  full_name = EXCLUDED.full_name,
  email = EXCLUDED.email,
  is_active = true;

INSERT INTO administradores (id, email, nombre, rol, activo, branch_id)
SELECT u.id, u.email, 'Admin Arica SM', 'administrador', true, b.id
FROM auth.users u
CROSS JOIN branches b
WHERE u.email = 'admin.arica.sm@elpollon.cl' AND b.slug = 'arica-santa-maria'
ON CONFLICT (id) DO UPDATE SET
  rol = 'administrador',
  branch_id = EXCLUDED.branch_id,
  activo = true,
  nombre = EXCLUDED.nombre;

-- ─── Arica Saucache (slug: arica-saucache) ───────────────────────────────────
INSERT INTO profiles (auth_user_id, full_name, email, role, branch_id, is_active)
SELECT
  u.id,
  'Admin Sucursal Arica Saucache',
  u.email,
  'admin_sucursal',
  b.id,
  true
FROM auth.users u
CROSS JOIN branches b
WHERE u.email = 'admin.saucache@elpollon.cl'
  AND b.slug = 'arica-saucache'
ON CONFLICT (auth_user_id) DO UPDATE SET
  role = 'admin_sucursal',
  branch_id = EXCLUDED.branch_id,
  full_name = EXCLUDED.full_name,
  email = EXCLUDED.email,
  is_active = true;

INSERT INTO administradores (id, email, nombre, rol, activo, branch_id)
SELECT u.id, u.email, 'Admin Arica Saucache', 'administrador', true, b.id
FROM auth.users u
CROSS JOIN branches b
WHERE u.email = 'admin.saucache@elpollon.cl' AND b.slug = 'arica-saucache'
ON CONFLICT (id) DO UPDATE SET
  rol = 'administrador',
  branch_id = EXCLUDED.branch_id,
  activo = true,
  nombre = EXCLUDED.nombre;

-- ─── Verificación ────────────────────────────────────────────────────────────
SELECT
  u.email,
  p.role,
  p.full_name,
  b.name AS sucursal,
  b.slug
FROM profiles p
JOIN auth.users u ON u.id = p.auth_user_id
LEFT JOIN branches b ON b.id = p.branch_id
WHERE p.role = 'admin_sucursal'
ORDER BY b.display_order;
