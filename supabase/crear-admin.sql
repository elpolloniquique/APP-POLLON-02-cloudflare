-- Crear administrador después de registrar usuario en Authentication
-- 1. Ve a Authentication > Users > Add user (email + password)
-- 2. Ejecuta este script (cambia el email si hace falta)
-- 3. IMPORTANTE: el rol debe estar en profiles Y en administradores

-- Tabla legacy (compatibilidad)
INSERT INTO administradores (id, email, nombre, rol, activo)
SELECT id, email, 'Admin El Pollón', 'super_admin', true
FROM auth.users
WHERE email = 'tutacanehuillca@gmail.com'
ON CONFLICT (id) DO UPDATE SET activo = true, rol = 'super_admin', nombre = EXCLUDED.nombre;

-- Tabla principal que usa la app (profiles)
INSERT INTO profiles (auth_user_id, full_name, email, role, is_active)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'full_name', 'Admin El Pollón'),
  u.email,
  'super_admin',
  true
FROM auth.users u
WHERE u.email = 'tutacanehuillca@gmail.com'
ON CONFLICT (auth_user_id) DO UPDATE SET
  role = 'super_admin',
  is_active = true,
  email = EXCLUDED.email;
