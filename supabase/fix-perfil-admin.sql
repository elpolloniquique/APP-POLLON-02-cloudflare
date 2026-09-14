-- =============================================================================
-- REPARAR acceso admin + sucursales (ejecutar en SQL Editor de Supabase)
-- Cambia el email si no es el tuyo
-- =============================================================================

-- 1) Tu usuario debe ser super_admin en profiles (no solo en administradores)
UPDATE profiles p
SET
  role = 'super_admin',
  is_active = true,
  full_name = COALESCE(NULLIF(p.full_name, ''), 'Administrador Principal')
FROM auth.users u
WHERE p.auth_user_id = u.id
  AND u.email = 'tutacanehuillca@gmail.com';

-- Si no existe fila en profiles, créala
INSERT INTO profiles (auth_user_id, full_name, email, role, is_active)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'full_name', 'Administrador Principal'),
  u.email,
  'super_admin',
  true
FROM auth.users u
WHERE u.email = 'tutacanehuillca@gmail.com'
  AND NOT EXISTS (
    SELECT 1 FROM profiles p WHERE p.auth_user_id = u.id
  );

-- 2) Mantener también administradores (compatibilidad)
INSERT INTO administradores (id, email, nombre, rol, activo)
SELECT u.id, u.email, 'Administrador Principal', 'super_admin', true
FROM auth.users u
WHERE u.email = 'tutacanehuillca@gmail.com'
ON CONFLICT (id) DO UPDATE SET
  rol = 'super_admin',
  activo = true,
  email = EXCLUDED.email;

-- 3) Políticas RLS de branches: permitir INSERT/UPDATE a usuarios autenticados
DROP POLICY IF EXISTS branches_auth_all ON branches;
CREATE POLICY branches_auth_all ON branches
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 4) Verificación (debe mostrar super_admin)
SELECT p.email, p.role, p.is_active
FROM profiles p
JOIN auth.users u ON u.id = p.auth_user_id
WHERE u.email = 'tutacanehuillca@gmail.com';
