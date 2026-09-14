-- =============================================================================
-- CAJERAS — 2 por sucursal (8 usuarios en total)
-- Ejecutar DESPUÉS de crear los 8 usuarios en Supabase Authentication
-- =============================================================================
--
-- PASO 1 (manual): Authentication → Users → Add user (x8)
--   Marcar "Auto Confirm User" en cada uno
--
-- | Email                      | Sucursal           |
-- |----------------------------|--------------------|
-- | cajera1.iquique@elpollon.cl      | Iquique            |
-- | cajera2.iquique@elpollon.cl      | Iquique            |
-- | cajera1.altohospicio@elpollon.cl | Alto Hospicio      |
-- | cajera2.altohospicio@elpollon.cl | Alto Hospicio      |
-- | cajera1.arica.sm@elpollon.cl     | Arica Santa María  |
-- | cajera2.arica.sm@elpollon.cl     | Arica Santa María  |
-- | cajera1.arica.saucache@elpollon.cl | Arica Saucache   |
-- | cajera2.arica.saucache@elpollon.cl | Arica Saucache   |
--
-- PASO 2: Ejecutar TODO este archivo → Run
-- =============================================================================

-- Macro: asignar cajera por email + slug sucursal
-- (repetido por cada cajera)

-- ─── IQUIQUE ─────────────────────────────────────────────────────────────────
INSERT INTO profiles (auth_user_id, full_name, email, role, branch_id, is_active)
SELECT u.id, 'Cajera 1 Iquique', u.email, 'cajera', b.id, true
FROM auth.users u CROSS JOIN branches b
WHERE u.email = 'cajera1.iquique@elpollon.cl' AND b.slug = 'iquique-vivar'
ON CONFLICT (auth_user_id) DO UPDATE SET role = 'cajera', branch_id = EXCLUDED.branch_id, is_active = true, full_name = EXCLUDED.full_name;

INSERT INTO profiles (auth_user_id, full_name, email, role, branch_id, is_active)
SELECT u.id, 'Cajera 2 Iquique', u.email, 'cajera', b.id, true
FROM auth.users u CROSS JOIN branches b
WHERE u.email = 'cajera2.iquique@elpollon.cl' AND b.slug = 'iquique-vivar'
ON CONFLICT (auth_user_id) DO UPDATE SET role = 'cajera', branch_id = EXCLUDED.branch_id, is_active = true, full_name = EXCLUDED.full_name;

INSERT INTO administradores (id, email, nombre, rol, activo, branch_id)
SELECT u.id, u.email, 'Cajera Iquique', 'cajero', true, b.id
FROM auth.users u CROSS JOIN branches b
WHERE u.email IN ('cajera1.iquique@elpollon.cl', 'cajera2.iquique@elpollon.cl') AND b.slug = 'iquique-vivar'
ON CONFLICT (id) DO UPDATE SET rol = 'cajero', branch_id = EXCLUDED.branch_id, activo = true;

-- ─── ALTO HOSPICIO ───────────────────────────────────────────────────────────
INSERT INTO profiles (auth_user_id, full_name, email, role, branch_id, is_active)
SELECT u.id, 'Cajera 1 Alto Hospicio', u.email, 'cajera', b.id, true
FROM auth.users u CROSS JOIN branches b
WHERE u.email = 'cajera1.altohospicio@elpollon.cl' AND b.slug = 'alto-hospicio'
ON CONFLICT (auth_user_id) DO UPDATE SET role = 'cajera', branch_id = EXCLUDED.branch_id, is_active = true, full_name = EXCLUDED.full_name;

INSERT INTO profiles (auth_user_id, full_name, email, role, branch_id, is_active)
SELECT u.id, 'Cajera 2 Alto Hospicio', u.email, 'cajera', b.id, true
FROM auth.users u CROSS JOIN branches b
WHERE u.email = 'cajera2.altohospicio@elpollon.cl' AND b.slug = 'alto-hospicio'
ON CONFLICT (auth_user_id) DO UPDATE SET role = 'cajera', branch_id = EXCLUDED.branch_id, is_active = true, full_name = EXCLUDED.full_name;

INSERT INTO administradores (id, email, nombre, rol, activo, branch_id)
SELECT u.id, u.email, 'Cajera Alto Hospicio', 'cajero', true, b.id
FROM auth.users u CROSS JOIN branches b
WHERE u.email IN ('cajera1.altohospicio@elpollon.cl', 'cajera2.altohospicio@elpollon.cl') AND b.slug = 'alto-hospicio'
ON CONFLICT (id) DO UPDATE SET rol = 'cajero', branch_id = EXCLUDED.branch_id, activo = true;

-- ─── ARICA SANTA MARÍA ───────────────────────────────────────────────────────
INSERT INTO profiles (auth_user_id, full_name, email, role, branch_id, is_active)
SELECT u.id, 'Cajera 1 Arica SM', u.email, 'cajera', b.id, true
FROM auth.users u CROSS JOIN branches b
WHERE u.email = 'cajera1.arica.sm@elpollon.cl' AND b.slug = 'arica-santa-maria'
ON CONFLICT (auth_user_id) DO UPDATE SET role = 'cajera', branch_id = EXCLUDED.branch_id, is_active = true, full_name = EXCLUDED.full_name;

INSERT INTO profiles (auth_user_id, full_name, email, role, branch_id, is_active)
SELECT u.id, 'Cajera 2 Arica SM', u.email, 'cajera', b.id, true
FROM auth.users u CROSS JOIN branches b
WHERE u.email = 'cajera2.arica.sm@elpollon.cl' AND b.slug = 'arica-santa-maria'
ON CONFLICT (auth_user_id) DO UPDATE SET role = 'cajera', branch_id = EXCLUDED.branch_id, is_active = true, full_name = EXCLUDED.full_name;

INSERT INTO administradores (id, email, nombre, rol, activo, branch_id)
SELECT u.id, u.email, 'Cajera Arica SM', 'cajero', true, b.id
FROM auth.users u CROSS JOIN branches b
WHERE u.email IN ('cajera1.arica.sm@elpollon.cl', 'cajera2.arica.sm@elpollon.cl') AND b.slug = 'arica-santa-maria'
ON CONFLICT (id) DO UPDATE SET rol = 'cajero', branch_id = EXCLUDED.branch_id, activo = true;

-- ─── ARICA SAUCACHE ──────────────────────────────────────────────────────────
INSERT INTO profiles (auth_user_id, full_name, email, role, branch_id, is_active)
SELECT u.id, 'Cajera 1 Arica Saucache', u.email, 'cajera', b.id, true
FROM auth.users u CROSS JOIN branches b
WHERE u.email = 'cajera1.arica.saucache@elpollon.cl' AND b.slug = 'arica-saucache'
ON CONFLICT (auth_user_id) DO UPDATE SET role = 'cajera', branch_id = EXCLUDED.branch_id, is_active = true, full_name = EXCLUDED.full_name;

INSERT INTO profiles (auth_user_id, full_name, email, role, branch_id, is_active)
SELECT u.id, 'Cajera 2 Arica Saucache', u.email, 'cajera', b.id, true
FROM auth.users u CROSS JOIN branches b
WHERE u.email = 'cajera2.arica.saucache@elpollon.cl' AND b.slug = 'arica-saucache'
ON CONFLICT (auth_user_id) DO UPDATE SET role = 'cajera', branch_id = EXCLUDED.branch_id, is_active = true, full_name = EXCLUDED.full_name;

INSERT INTO administradores (id, email, nombre, rol, activo, branch_id)
SELECT u.id, u.email, 'Cajera Arica Saucache', 'cajero', true, b.id
FROM auth.users u CROSS JOIN branches b
WHERE u.email IN ('cajera1.arica.saucache@elpollon.cl', 'cajera2.arica.saucache@elpollon.cl') AND b.slug = 'arica-saucache'
ON CONFLICT (id) DO UPDATE SET rol = 'cajero', branch_id = EXCLUDED.branch_id, activo = true;

-- ─── Verificación (deben ser 8 filas con role = cajera) ─────────────────────
SELECT u.email, p.role, p.full_name, b.name AS sucursal, b.slug
FROM profiles p
JOIN auth.users u ON u.id = p.auth_user_id
LEFT JOIN branches b ON b.id = p.branch_id
WHERE p.role = 'cajera'
ORDER BY b.display_order, u.email;
