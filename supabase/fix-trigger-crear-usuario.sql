-- =============================================================================
-- CORREGIR: "Database error creating new user" al crear usuarios en Auth
-- Ejecutar en Supabase → SQL Editor → Run
-- Luego vuelve a Authentication → Users → Add user
-- =============================================================================

-- 1) Asegurar que existan todos los roles (FK en profiles.role)
INSERT INTO roles (id, label, description) VALUES
  ('super_admin', 'Super Admin', 'Acceso total'),
  ('admin_sucursal', 'Admin sucursal', 'Administra una sucursal'),
  ('cajera', 'Cajera', 'Pedidos y caja'),
  ('cocina', 'Cocina', 'Pantalla cocina'),
  ('delivery', 'Delivery', 'Reparto'),
  ('cliente', 'Cliente', 'Tienda online')
ON CONFLICT (id) DO NOTHING;

-- 2) Trigger seguro: no rompe la creación del usuario en Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_profile_id UUID;
  v_email_ok BOOLEAN;
  v_whatsapp_ok BOOLEAN;
BEGIN
  -- Rol válido (si no existe en tabla roles → cliente)
  v_role := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'role'), ''), 'cliente');
  IF NOT EXISTS (SELECT 1 FROM public.roles WHERE id = v_role) THEN
    v_role := 'cliente';
  END IF;

  INSERT INTO public.profiles (auth_user_id, full_name, email, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''), split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    v_role
  )
  ON CONFLICT (auth_user_id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = now()
  RETURNING id INTO v_profile_id;

  -- Marketing solo para clientes (admins no necesitan esta fila)
  IF v_role = 'cliente' AND v_profile_id IS NOT NULL THEN
  BEGIN
    v_email_ok := false;
    v_whatsapp_ok := false;
    IF NEW.raw_user_meta_data ? 'accepts_email_promotions' THEN
      BEGIN
        v_email_ok := COALESCE((NEW.raw_user_meta_data->>'accepts_email_promotions')::boolean, false);
      EXCEPTION WHEN OTHERS THEN
        v_email_ok := false;
      END;
    END IF;
    IF NEW.raw_user_meta_data ? 'accepts_whatsapp_promotions' THEN
      BEGIN
        v_whatsapp_ok := COALESCE((NEW.raw_user_meta_data->>'accepts_whatsapp_promotions')::boolean, false);
      EXCEPTION WHEN OTHERS THEN
        v_whatsapp_ok := false;
      END;
    END IF;

    INSERT INTO public.customer_marketing_preferences (
      customer_id, accepts_email_promotions, accepts_whatsapp_promotions
    )
    VALUES (v_profile_id, v_email_ok, v_whatsapp_ok)
    ON CONFLICT (customer_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user marketing: %', SQLERRM;
  END;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Permite crear el usuario en Auth aunque falle el perfil (luego lo arreglas con SQL)
  RAISE WARNING 'handle_new_user profiles: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 3) Comprobar que el trigger quedó activo
SELECT tgname AS trigger_name
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'auth' AND c.relname = 'users' AND tgname = 'on_auth_user_created';
