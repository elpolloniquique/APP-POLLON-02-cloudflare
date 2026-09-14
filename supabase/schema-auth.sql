-- =============================================================================
-- EL POLLÓN — Autenticación, perfiles, clientes y marketing
-- Ejecutar DESPUÉS de schema-multi-sucursal.sql
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- ROLES DEL SISTEMA
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO roles (id, label, description) VALUES
  ('super_admin', 'Super Admin', 'Acceso total a todas las sucursales'),
  ('admin_sucursal', 'Admin sucursal', 'Administra una sucursal'),
  ('cajera', 'Cajera', 'Pedidos, caja y clientes de su sucursal'),
  ('cocina', 'Cocina', 'Pedidos en cocina de su sucursal'),
  ('delivery', 'Delivery', 'Pedidos asignados para reparto'),
  ('cliente', 'Cliente', 'Perfil, pedidos y seguimiento propios')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- PERFILES (vinculados a auth.users)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  phone TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'cliente' REFERENCES roles(id),
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_auth_user ON profiles(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_branch ON profiles(branch_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- user_roles: roles adicionales opcionales
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(profile_id, role_id, branch_id)
);

-- -----------------------------------------------------------------------------
-- DIRECCIONES DE CLIENTE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_addresses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  label TEXT DEFAULT 'Casa',
  address TEXT NOT NULL,
  reference TEXT DEFAULT '',
  city TEXT DEFAULT '',
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_addresses_customer ON customer_addresses(customer_id);

-- -----------------------------------------------------------------------------
-- PREFERENCIAS DE MARKETING
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_marketing_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  accepts_email_promotions BOOLEAN DEFAULT false,
  accepts_whatsapp_promotions BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- CAMPAÑAS DE MARKETING
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  campaign_type TEXT DEFAULT 'promotion' CHECK (campaign_type IN ('promotion', 'news', 'coupon')),
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'cancelled')),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campaign_recipients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'bounced')),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign ON campaign_recipients(campaign_id);

-- -----------------------------------------------------------------------------
-- PEDIDOS: vincular cliente + historial de estados
-- -----------------------------------------------------------------------------
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_pedidos_customer ON pedidos(customer_id);

CREATE TABLE IF NOT EXISTS order_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id TEXT NOT NULL,
  status TEXT NOT NULL,
  note TEXT DEFAULT '',
  changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON order_status_history(order_id);

-- Trigger: registrar cambio de estado en pedidos (SECURITY DEFINER evita bloqueo RLS al checkout)
CREATE OR REPLACE FUNCTION public.log_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.estado IS DISTINCT FROM NEW.estado THEN
    INSERT INTO public.order_status_history (order_id, status, note)
    VALUES (NEW.id, NEW.estado, 'Cambio automático');
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.order_status_history (order_id, status, note)
    VALUES (NEW.id, COALESCE(NEW.estado, 'pendiente'), 'Pedido creado');
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'log_order_status_change: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pedidos_status_history ON pedidos;
CREATE TRIGGER trg_pedidos_status_history
  AFTER INSERT OR UPDATE OF estado ON pedidos
  FOR EACH ROW EXECUTE FUNCTION public.log_order_status_change();

-- -----------------------------------------------------------------------------
-- Auto-crear perfil al registrarse (cliente)
-- -----------------------------------------------------------------------------
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
  RAISE WARNING 'handle_new_user profiles: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_marketing_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;

-- Helper: rol del usuario actual
CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION auth_user_profile_id()
RETURNS UUID AS $$
  SELECT id FROM profiles WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION auth_user_branch_id()
RETURNS UUID AS $$
  SELECT branch_id FROM profiles WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ROLES (catálogo)
DROP POLICY IF EXISTS roles_select_all ON roles;
CREATE POLICY roles_select_all ON roles FOR SELECT USING (true);

DROP POLICY IF EXISTS roles_manage_super_admin ON roles;
CREATE POLICY roles_manage_super_admin ON roles
  FOR ALL
  TO authenticated
  USING (auth_user_role() = 'super_admin')
  WITH CHECK (auth_user_role() = 'super_admin');

-- USER_ROLES (roles extra por perfil)
DROP POLICY IF EXISTS user_roles_select_own ON user_roles;
CREATE POLICY user_roles_select_own ON user_roles
  FOR SELECT
  TO authenticated
  USING (
    profile_id = auth_user_profile_id()
    OR auth_user_role() IN ('super_admin', 'admin_sucursal')
  );

DROP POLICY IF EXISTS user_roles_manage_super_admin ON user_roles;
CREATE POLICY user_roles_manage_super_admin ON user_roles
  FOR ALL
  TO authenticated
  USING (auth_user_role() = 'super_admin')
  WITH CHECK (auth_user_role() = 'super_admin');

-- PROFILES
CREATE POLICY profiles_select_own ON profiles FOR SELECT
  USING (auth_user_id = auth.uid() OR auth_user_role() IN ('super_admin', 'admin_sucursal', 'cajera'));

CREATE POLICY profiles_update_own ON profiles FOR UPDATE
  USING (auth_user_id = auth.uid());

CREATE POLICY profiles_staff_all ON profiles FOR ALL
  USING (auth_user_role() = 'super_admin');

CREATE POLICY profiles_admin_branch ON profiles FOR SELECT
  USING (
    auth_user_role() = 'admin_sucursal' AND role = 'cliente'
  );

-- CUSTOMER ADDRESSES
CREATE POLICY addresses_own ON customer_addresses FOR ALL
  USING (customer_id = auth_user_profile_id());

CREATE POLICY addresses_staff ON customer_addresses FOR SELECT
  USING (auth_user_role() IN ('super_admin', 'admin_sucursal', 'cajera'));

-- MARKETING PREFERENCES
CREATE POLICY marketing_own ON customer_marketing_preferences FOR ALL
  USING (customer_id = auth_user_profile_id());

CREATE POLICY marketing_staff ON customer_marketing_preferences FOR SELECT
  USING (auth_user_role() IN ('super_admin', 'admin_sucursal', 'cajera'));

-- CAMPAIGNS (solo staff)
CREATE POLICY campaigns_staff ON marketing_campaigns FOR ALL
  USING (auth_user_role() IN ('super_admin', 'admin_sucursal'));

CREATE POLICY campaign_recipients_staff ON campaign_recipients FOR ALL
  USING (auth_user_role() IN ('super_admin', 'admin_sucursal'));

-- ORDER STATUS HISTORY
DROP POLICY IF EXISTS order_history_insert ON order_status_history;
CREATE POLICY order_history_insert ON order_status_history
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS order_history_select_all ON order_status_history;
CREATE POLICY order_history_select_all ON order_status_history
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS order_history_customer ON order_status_history;
CREATE POLICY order_history_customer ON order_status_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM pedidos p
      WHERE p.id = order_status_history.order_id
        AND p.customer_id = auth_user_profile_id()
    )
  );

DROP POLICY IF EXISTS order_history_staff ON order_status_history;
CREATE POLICY order_history_staff ON order_status_history FOR SELECT
  USING (auth_user_role() IN ('super_admin', 'admin_sucursal', 'cajera', 'cocina', 'delivery'));

-- PEDIDOS: clientes solo los suyos
DROP POLICY IF EXISTS pedidos_customer_select ON pedidos;
CREATE POLICY pedidos_customer_select ON pedidos FOR SELECT
  USING (customer_id = auth_user_profile_id());

-- Actualizar pedidos existentes (staff) — mantener políticas amplias si existen
-- Nota: en producción ajustar políticas de pedidos según tu schema actual

COMMENT ON TABLE profiles IS 'Perfiles de clientes y personal autorizado';
